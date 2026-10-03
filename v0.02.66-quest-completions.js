/* ==========================================================================
   QUEST COMPLETIONS (Lyra ruling D7, 2026-10-03; docs/QUESTS_LOG_BUILD_DESIGN_20261003.md section 1.3)
   ==========================================================================
   One authoritative, PERMANENT record of every quest completion.

   state.questCompletions = { version, events:[CompletionRecord], migrations:{sideHistory} }
   CompletionRecord = { id, system:'side'|'quick'|'main', type:'quest'|'milestone',
                        instanceId, occurrence?, questId, definitionId?, title, category?,
                        at:ms|null, date:'YYYY-MM-DD', source:'custom'|'preset'|'ai'|'migrated',
                        reward?:{xp,statXp,migrated?} }
   key (derived, never stored) = system ':' instanceId [':' occurrence]

   - recordQuestCompletion() is the ONLY writer. A second record with the same key
     is refused ({ok:false,duplicate:true}), so re-checking, re-opening or revisiting
     a completed quest can never pay or log twice. The key set is rebuilt from the
     events (one structure, nothing to drift). Never capped, never date-scoped, and
     not deleted when the quest object is.
   - It does NOT call save(): every caller is a completion flow that saves itself,
     and ensureQuestCompletionsState() must never save (it runs inside save()'s hooks).
   - Seeding: the first ensure backfills the ledger from sideQuestHistory and from live
     done Side Quests (source 'migrated', no event, no payment), so Quest History and
     Chains do not start empty and an old completion cannot be paid a second time.
   - A reward is paid by the CALLER, once, only when recordQuestCompletion returns
     ok:true (and, for Side Quests, the legacy xpAwarded flag is also clear). Nothing
     here pays.
   - Repeat/cooldown policy is separate: QUEST_COOLDOWN_CONFIG, null in production
     (thresholds are not ruled), injectable in tests.
   ========================================================================== */

const QC_SYSTEMS=['side','quick','main'];
const QC_SOURCES=['custom','preset','ai','migrated'];
/* Cooldown thresholds are NOT ruled (handoff section 10). null = no cooldown enforced; tests inject {side:{hours},...}. */
let QUEST_COOLDOWN_CONFIG=null;

/* ---------- ids ---------- */
/* newStringId() (the one generator for new string ids) lives in app.js beside uid(). */
function qcStr(v){return v==null?'':String(v)}

/* Side Quest instance id: deterministic from the legacy numeric id so the ledger key is stable across reloads and
   across an unsaved ensure run. A pre-existing duplicate numeric id gets a suffix. */
function sideQuestInstanceIdFor(q,taken){
  const base=`sq_${q.id}`;
  if(!taken||!taken.has(base))return base;
  for(let n=2;n<1000;n++){const c=`${base}_${n}`;if(!taken.has(c))return c}
  return newStringId('sq',taken);
}
/* Every instance id a NEW Side Quest must avoid: the live quests' ids AND the ledger's side keys (the ledger never forgets a deleted
   quest, so a reused key would make the new quest's first completion read as a duplicate and pay nothing). */
function sideQuestTakenInstanceIds(){
  const out=new Set((Array.isArray(state.sideQuests)?state.sideQuests:[]).map(x=>x&&x.instanceId).filter(Boolean));
  ensureQuestCompletionsState().events.forEach(e=>{if(e.system==='side'&&e.instanceId)out.add(e.instanceId)});
  return out;
}
function mainMilestoneRef(mq,m){return `${qcStr(mq&&mq.id)}:${qcStr(m&&m.id)}`}

/* ---------- state ---------- */
function qcDomainDefault(){return {version:1,events:[],migrations:{}}}
const qcNormalized=new WeakSet();
function qcShape(raw){
  const r=(raw&&typeof raw==='object')?raw:{};
  const rec={
    id:r.id?String(r.id):newStringId('qc'),
    system:QC_SYSTEMS.includes(r.system)?r.system:'side',
    type:r.type==='milestone'?'milestone':'quest',
    instanceId:qcStr(r.instanceId),
    questId:qcStr(r.questId!=null?r.questId:r.instanceId),
    title:qcStr(r.title).slice(0,160),
    at:Number.isFinite(Number(r.at))&&Number(r.at)>0?Number(r.at):null,
    date:/^\d{4}-\d{2}-\d{2}$/.test(String(r.date||''))?r.date:null,
    source:QC_SOURCES.includes(r.source)?r.source:'custom'
  };
  if(!rec.date)rec.date=rec.at?localISO(new Date(rec.at)):todayISO();
  if(r.occurrence!=null&&r.occurrence!=='')rec.occurrence=qcStr(r.occurrence);
  if(r.definitionId)rec.definitionId=qcStr(r.definitionId);
  if(r.category)rec.category=qcStr(r.category).slice(0,60);
  if(r.reward&&typeof r.reward==='object')rec.reward=r.reward;
  return rec;
}
function questCompletionKey(system,instanceId,occurrence){
  return `${system}:${qcStr(instanceId)}${occurrence!=null&&occurrence!==''?':'+qcStr(occurrence):''}`;
}
function qcKeyOf(rec){return questCompletionKey(rec.system,rec.instanceId,rec.occurrence)}

function ensureQuestCompletionsState(){
  if(!state.questCompletions||typeof state.questCompletions!=='object'||Array.isArray(state.questCompletions))state.questCompletions=qcDomainDefault();
  const qc=state.questCompletions;
  if(qcNormalized.has(qc))return qc;
  qc.version=1;
  qc.migrations=(qc.migrations&&typeof qc.migrations==='object'&&!Array.isArray(qc.migrations))?qc.migrations:{};
  qc.events=(Array.isArray(qc.events)?qc.events:[]).filter(e=>e&&typeof e==='object'&&qcStr(e.instanceId)).map(qcShape);
  qcNormalized.add(qc);          /* mark BEFORE seeding: seeding reads the ledger through the helpers below */
  qcSeedFromSideHistory(qc);
  return qc;
}
function qcKeys(qc){return new Set((qc||ensureQuestCompletionsState()).events.map(qcKeyOf))}

/* The one-time backfill. Idempotent by key presence (the marker is only a fast path), no event, no payment. */
function qcSeedFromSideHistory(qc){
  if(qc.migrations.sideHistory)return false;
  const keys=qcKeys(qc),hist=Array.isArray(state.sideQuestHistory)?state.sideQuestHistory:[];
  const quests=Array.isArray(state.sideQuests)?state.sideQuests:[];
  /* legacy numeric ids can repeat (migrate() keeps such quests apart with an instanceId suffix): group by id and let each history row
     CLAIM one quest that actually completed (done, or already paid), preferring done. A quest that has not completed and was never
     paid can never take a key, or its real completion would later be refused as a duplicate. */
  const byLegacy=new Map();
  quests.forEach(q=>{if(!q)return;const k=qcStr(q.id);if(!byLegacy.has(k))byLegacy.set(k,[]);byLegacy.get(k).push(q)});
  let added=0;
  hist.forEach((row,i)=>{
    if(!row||typeof row!=='object')return;
    const pool=(byLegacy.get(qcStr(row.sourceId))||[]).filter(x=>(x.done||x.xpAwarded)&&!keys.has(questCompletionKey('side',x.instanceId||`sq_${x.id}`)));
    const q=pool.find(x=>x.done)||pool[0]||null;
    let instanceId=q?(q.instanceId||`sq_${q.id}`):null;
    if(!instanceId)instanceId=`legacy:${i}:${qcStr(row.id)}`;   /* a row is never skipped */
    if(keys.has(questCompletionKey('side',instanceId)))return;
    const date=/^\d{4}-\d{2}-\d{2}$/.test(String(row.date||''))?row.date:null;
    qc.events.push(qcShape({system:'side',type:'quest',instanceId,questId:instanceId,title:row.title,category:row.category,at:null,date,source:'migrated',reward:{xp:Number(row.xp)||0,migrated:true}}));
    keys.add(questCompletionKey('side',instanceId));added++;
  });
  quests.filter(q=>q&&q.done).forEach(q=>{
    const instanceId=q.instanceId||`sq_${q.id}`,k=questCompletionKey('side',instanceId);
    if(keys.has(k))return;
    qc.events.push(qcShape({system:'side',type:'quest',instanceId,questId:instanceId,title:q.title,category:q.category,at:null,date:q.completedDate||null,source:'migrated',reward:{xp:Number(q.xp)||0,migrated:true}}));
    keys.add(k);added++;
  });
  /* completed Quick Quests. A task-migrated item that was already done when the To-Do list was migrated is history of that retired list,
     not a Quick Quest completion; one completed AFTER the migration was a real Quick Quest completion (quickQuestComplete records those). */
  const qqRoot=state.quickQuests&&typeof state.quickQuests==='object'?state.quickQuests:{};
  const qqItems=Array.isArray(qqRoot.items)?qqRoot.items:[];
  const qqMigratedAt=Number(qqRoot.taskMigration&&qqRoot.taskMigration.migratedAt)||Infinity;
  qqItems.filter(x=>x&&x.status==='completed'&&x.id&&(!x.migratedFrom||Number(x.completedAt)>qqMigratedAt)).forEach(x=>{
    const k=questCompletionKey('quick',String(x.id));
    if(keys.has(k))return;
    qc.events.push(qcShape({system:'quick',type:'quest',instanceId:String(x.id),questId:String(x.id),title:x.title,at:Number(x.completedAt)||null,source:'migrated'}));
    keys.add(k);added++;
  });
  qc.migrations.sideHistory={at:Date.now(),added};
  return true;
}

/* ---------- the writer ---------- */
function qcCooldownBlocks(system,definitionId,now){
  const cfg=QUEST_COOLDOWN_CONFIG&&QUEST_COOLDOWN_CONFIG[system];
  if(!cfg||!Number(cfg.hours)||!definitionId)return false;
  const qc=ensureQuestCompletionsState(),ms=Number(cfg.hours)*3600000;
  return qc.events.some(e=>e.system===system&&e.definitionId===definitionId&&e.at&&now-e.at<ms);
}
/* spec: {system, type?, instanceId, occurrence?, questId?, definitionId?, title, category?, at?, date?, source?, reward?, silent?}
   returns {ok:true,record} | {ok:false,duplicate:true,record} | {ok:false,reason} */
function recordQuestCompletion(spec){
  const s=(spec&&typeof spec==='object')?spec:{};
  if(!QC_SYSTEMS.includes(s.system))return {ok:false,reason:'bad-system'};
  if(typeof s.instanceId!=='string'||!s.instanceId.trim())return {ok:false,reason:'bad-instance-id'};   /* the 'side:undefined' collapse can never happen */
  const qc=ensureQuestCompletionsState(),key=questCompletionKey(s.system,s.instanceId,s.occurrence);
  const dup=qc.events.find(e=>qcKeyOf(e)===key);
  if(dup)return {ok:false,duplicate:true,record:dup};
  const now=Number(s.at)>0?Number(s.at):Date.now();
  if(qcCooldownBlocks(s.system,s.definitionId,now))return {ok:false,reason:'cooldown'};
  const rec=qcShape({...s,id:newStringId('qc',new Set(qc.events.map(e=>e.id))),at:now,source:s.source||'custom'});
  qc.events.push(rec);
  if(!s.silent){try{document.dispatchEvent(new CustomEvent('quest:completed',{detail:rec}))}catch(e){}}
  return {ok:true,record:rec};
}

/* ---------- readers (History, Chains, the Main Quest Log view) ---------- */
function questCompletions(filter){
  const f=filter||{};
  return ensureQuestCompletionsState().events.filter(e=>
    (!f.system||e.system===f.system)&&(!f.type||e.type===f.type)&&(!f.questId||e.questId===qcStr(f.questId))&&(!f.category||e.category===f.category)&&(!f.from||e.date>=f.from)&&(!f.to||e.date<=f.to)&&(!f.source||e.source===f.source));
}
function questCompletionCount(filter){return questCompletions(filter).length}
function questCompletionHas(system,instanceId,occurrence){return ensureQuestCompletionsState().events.some(e=>qcKeyOf(e)===questCompletionKey(system,instanceId,occurrence))}
