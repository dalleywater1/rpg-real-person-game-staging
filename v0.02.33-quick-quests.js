/* ==========================================================================
   QUICK QUESTS (V1 2026-09-20; REBUILT as do-now actions 2026-10-03, Lyra D2)
   ==========================================================================
   Architecture rule: SOURCE SYSTEM -> SHARED DATA -> MULTIPLE VIEWS.

   state.quickQuests is the ONE source store. Home (a Quest Pane block) and
   the Quests page only read it and open its detail sheet; neither owns a
   copy, and nothing here writes into any other domain. The old generic
   To-Do system is RETIRED: its tasks were migrated into Quick Quests once
   (see qqMigrateLegacyTasks) and the originals are kept, untouched, in
   state.legacyTasks.

   What a Quick Quest is now: "Small. Immediate. No planning required."
   You pick one from the library (QUICK_QUEST_POOL, 80 approved actions in
   eight groups), from your saved ones, or type your own, and it STARTS.
   There is no queue, no due date and no reschedule: planning belongs to the
   Adventurer's Log, which owns every dated thing.

   Lifecycle:  active -> completed | cancelled.
   Only ONE quest may be active at a time. There is no pause/resume: the
   timer is the elapsed time between Start and Complete, always DERIVED as
   completedAt - startedAt (or now - startedAt while active). No duration
   is ever stored as authority.

   Records:
     item   { id, title, status, createdAt, startedAt?, completedAt?,
              cancelledAt?, notes?, presetId?, poolId?, migratedFrom?,
              scheduledDate?/scheduledTime? (inert legacy keys, never read) }
     preset { id, title, notes?, category?, createdAt }   (a template: using
              one creates a NEW item and never touches the preset)
   Completed and cancelled records are retained (most recent 500 together;
   the lifetime counters in stats survive pruning).

   Migration of the old model (no one-shot gate, per item, idempotent):
   every record that was still QUEUED (or had no status) is copied untouched,
   date and time included, into state.quickQuests.legacyQueued[] and leaves
   the live list; the Adventurer's Log imports each one as an ordinary Log
   item (v0.02.67). An ACTIVE quest is left running. Completed and cancelled
   records, and the counters, are untouched, so recaps and achievements read
   the same numbers before and after.

   Boundaries (locked with Lyra/Vale, 2026-09-21; D2/D10 2026-10-03):
   - No XP and no reward of any kind. Completion updates the counters,
     records the completion in the ledger and raises quickquest:completed.
   - Recurring "did I remember this?" habits belong to the Daily Routine
     Tracker, so none are seeded as presets.
   - Quick Quests are not in any schedule list or calendar.
   - Cooldown / repeat limits are a separate, unruled policy
     (QUEST_COOLDOWN_CONFIG, null in production).
   ========================================================================== */

const QQ_STATUSES=['queued','active','completed','cancelled'];   /* 'queued' is read for legacy records only; nothing creates it any more */
const QQ_RECENT_LIMIT=5;
const QQ_TERMINAL_KEEP=500;
const QQ_SEED_VERSION=2;
/* The library: the 80 approved Quick Quests (Quests redesign handoff, section 10), data-driven. Ids are permanent. The handoff's "potential
   pools" (5 Minutes, Low Energy, ...) are not assigned per quest because nobody has ruled which quest belongs to which, so the page offers
   the eight groups. */
const QQ_GROUPS=['Cleaning','Organising','Household','Admin','Food / Kitchen','Outside','Micro Adventures','Social'];
const QUICK_QUEST_POOL=(()=>{
  const sets={
    'Cleaning':['Clear one surface','Wipe kitchen counters','Clean a mirror','Hoover one room','Sweep one floor','Clean the sink','Wipe the hob','Clean one window','Dust one shelf','Ten-Minute Tidy'],
    'Organising':['Sort one drawer','Organise one shelf','Clear your desk','Sort five pieces of paperwork','Put away ten misplaced objects','Organise one bag','Clear your downloads folder','Sort one cable pile','Empty and organise your pockets/bag','Find five things to donate'],
    'Household':['Empty the bins','Unload the dishwasher','Load the dishwasher','Fold ten items of clothing','Put away one laundry load','Change one towel set','Refill one household supply','Water indoor plants','Make the bed','Prepare tomorrow’s clothes'],
    'Admin':['Answer one overdue message','Send one email you have avoided','Make one necessary phone call','Book one appointment','Pay one bill','File one document','Update one calendar entry','Cancel one unused subscription','Deal with one letter','Complete one small form'],
    'Food / Kitchen':['Prepare tomorrow’s lunch','Chop vegetables for later','Refill your water bottle','Prepare a useful snack','Check fridge dates','Freeze something before it spoils','Plan tonight’s meal','Prepare breakfast for later/tomorrow','Clean one fridge shelf','Restock one kitchen staple'],
    'Outside':['Pull ten weeds','Sweep the entrance','Pick up outdoor rubbish','Water outdoor plants','Tidy one garden corner','Put away outdoor equipment','Clear leaves for ten minutes','Inspect the garden for one job that needs doing','Clean the doorstep','Take something outside that belongs outside'],
    'Micro Adventures':['Take a different route on a short walk','Find something you have never noticed near home','Photograph something interesting','Spend five minutes outside','Find the oldest-looking object in one room','Identify a nearby plant or tree','Find somewhere nearby you have never sat before','Walk to a local landmark','Find three interesting things of the same colour','Explore one nearby street/path you have not used before'],
    'Social':['Message someone you have not spoken to recently','Thank someone','Send someone something funny','Ask someone how they are doing','Give a genuine compliment','Check in with a family member','Do one small useful thing for someone else','Arrange something with a friend','Share a photo or memory with someone','Help someone without being asked']
  };
  const out=[];
  QQ_GROUPS.forEach(g=>sets[g].forEach(title=>out.push({id:'qp_'+String(out.length+1).padStart(3,'0'),title,group:g})));
  return out;
})();
/* Default saved presets: reusable ONE-OFF actions only. These are the
   non-routine survivors of the old fixed catalogue (same ids as before, so
   an already-seeded save keeps them). */
const QQ_SEED_PRESETS=[
  {id:'seed_cleanCar',title:'Clean the Car',category:'Cleaning'},
  {id:'seed_cupboard',title:'Sort a Cupboard',category:'Organising'},
  {id:'seed_diy',title:'DIY Job',category:'DIY'},
  {id:'seed_admin',title:'Life Admin',category:'Admin'}
];
/* Routine-type chores from the old catalogue. They belong to the future
   Daily Routine Tracker, so they are removed from any save that was seeded
   with them (only these exact seeded ids; a preset the player saved
   themselves, even with the same title, is never touched). */
const QQ_RETIRED_SEED_IDS=['seed_hoover','seed_laundry','seed_garden','seed_meal'];
/* The two sample tasks every new save used to start with. */
const QQ_SAMPLE_TASKS=[{id:1,text:'Review today’s priorities'},{id:2,text:'Prepare tomorrow’s Main Quest'}];
const qqNormalized=new WeakSet();
let qqTickHandle=null;
let qqGroup=QQ_GROUPS[0];          /* the library group on show (this session only) */
let qqPending=null;                /* the source waiting while the active quest is resolved: {poolId?,presetId?,title,notes} */
let qqOwnDraft='';                 /* what is typed in "your own" survives a redraw (a tab switch, a flow) */
let qqLastAction=0,qqTapGap=300;   /* a second tap within qqTapGap ms of a handled one is ignored (the page redraws between taps and the target moves) */

/* ---------- small utilities ---------- */
function qqNewId(){return 'qq_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function qqNum(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null}
function qqIsDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(String(s||''))}
function qqIsTime(s){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s||''))}
function qqPad(n){return String(n).padStart(2,'0')}
function qqTrim(s,max){return String(s==null?'':s).trim().slice(0,max)}

/* ---------- record shapes ---------- */
function qqShape(raw){
  const q=(raw&&typeof raw==='object')?raw:{};
  const createdAt=qqNum(q.createdAt)||Date.now();
  const item={
    id:q.id?String(q.id):qqNewId(),
    title:qqTrim(q.title,120)||'Quick Quest',
    /* an unknown status is NOT turned into a queue entry any more: it reads as cancelled (kept, counted, never active) */
    status:QQ_STATUSES.includes(q.status)?q.status:'cancelled',
    createdAt,
    /* inert legacy keys: carried through when valid so nothing is lost, never defaulted, never read for behaviour */
    scheduledDate:qqIsDate(q.scheduledDate)?q.scheduledDate:null,
    scheduledTime:qqIsTime(q.scheduledTime)?q.scheduledTime:null,
    startedAt:qqNum(q.startedAt),
    completedAt:qqNum(q.completedAt),
    cancelledAt:qqNum(q.cancelledAt),
    notes:qqTrim(q.notes,500),
    reminder:q.reminder?String(q.reminder):null,
    presetId:q.presetId?String(q.presetId):null,
    poolId:q.poolId?String(q.poolId):null,
    migratedFrom:(q.migratedFrom&&typeof q.migratedFrom==='object')?{type:String(q.migratedFrom.type||'task'),id:q.migratedFrom.id}:null
  };
  /* status decides which timestamps may exist, so a hand-edited or
     half-written record can never come back as a phantom active quest */
  if(item.status==='queued'){item.startedAt=null;item.completedAt=null;item.cancelledAt=null}
  else if(item.status==='active'){item.completedAt=null;item.cancelledAt=null;if(!item.startedAt)item.startedAt=createdAt}   /* it was running: it keeps running from when it was made */
  else if(item.status==='completed'){item.cancelledAt=null;if(!item.completedAt)item.completedAt=item.startedAt||createdAt}
  else if(item.status==='cancelled'){item.completedAt=null;if(!item.cancelledAt)item.cancelledAt=item.startedAt||createdAt}
  return item;
}
function qqPresetShape(raw){
  const p=(raw&&typeof raw==='object')?raw:{};
  return {id:p.id?String(p.id):qqNewId(),title:qqTrim(p.title,120)||'Saved Quick Quest',notes:qqTrim(p.notes,500),category:p.category?qqTrim(p.category,40):null,createdAt:qqNum(p.createdAt)||Date.now()};
}

/* ---------- domain state ----------
   Normalised once per loaded state object (a WeakSet marks it), never
   saved from here: ensure() is also called from inside save()'s
   achievement hooks, so it must not call save() itself. */
function qqDomainDefault(){return {version:1,items:[],presets:[],seedVersion:0,stats:{completedTotal:0,cancelledTotal:0},legacyQueued:[]}}
/* Stage the legacy queue: every record for which `isQueued` holds is deep-copied, untouched, into legacyQueued (once per id) and removed
   from the live list. Returns true when anything moved. The Log imports from legacyQueued; nothing here calls into the Log. */
function qqStageQueued(qq,isQueued){
  const staged=new Map(qq.legacyQueued.map(x=>[String(x.id),JSON.stringify(x)]));
  let moved=false;
  qq.items=qq.items.filter(x=>{
    if(!x||typeof x!=='object'||!isQueued(x))return true;
    if(x.id==null||x.id==='')x.id=qqNewId();
    const key=String(x.id),copy=JSON.stringify(x);
    if(staged.has(key)&&staged.get(key)===copy){moved=true;return false}     /* exactly the copy already held: the idempotent case */
    let c=JSON.parse(copy);
    if(staged.has(key)){                                                      /* a DIFFERENT record sharing that id: kept, under a fresh id, so nothing is ever lost */
      let nid=qqNewId();while(staged.has(nid))nid=qqNewId();
      c.id=nid;
    }
    qq.legacyQueued.push(c);staged.set(String(c.id),JSON.stringify(c));
    moved=true;
    return false;
  });
  return moved;
}
/* a raw status that means "waiting": queued in any spelling, none at all, or an unknown word on a record that carries a real day */
function qqRawIsQueued(x){
  const st=String(x.status==null?'':x.status).trim().toLowerCase();
  if(st==='queued'||st==='')return true;
  return !['active','completed','cancelled'].includes(st)&&qqIsDate(x.scheduledDate);
}
function ensureQuickQuestsState(){
  if(!state.quickQuests||typeof state.quickQuests!=='object')state.quickQuests=qqDomainDefault();
  const qq=state.quickQuests;
  if(qqNormalized.has(qq))return qq;
  qq.version=1;
  qq.items=Array.isArray(qq.items)?qq.items:[];
  /* a stored legacyQueued is only ever tidied, never discarded: an id-less record gets an id, a non-array value is kept aside */
  {
    const lq=qq.legacyQueued,arr=Array.isArray(lq)?lq:[],bad=Array.isArray(qq.legacyQueuedBad)?qq.legacyQueuedBad:[];
    if(lq!=null&&!Array.isArray(lq)&&!(typeof lq==='object'&&!Object.keys(lq).length))bad.push(lq);
    arr.forEach(x=>{if(!x||typeof x!=='object')bad.push(x)});
    qq.legacyQueued=arr.filter(x=>x&&typeof x==='object').map(x=>{if(x.id==null||x.id==='')x.id=qqNewId();return x});
    if(bad.length)qq.legacyQueuedBad=bad;
  }
  let changed=false;
  /* 1. the queue as it was stored (raw: a record with no status counts as queued) leaves the live list */
  if(qqStageQueued(qq,qqRawIsQueued))changed=true;
  qq.items=qq.items.filter(x=>x&&typeof x==='object').map(qqShape);
  qq.presets=(Array.isArray(qq.presets)?qq.presets:[]).map(qqPresetShape);
  qq.stats=(qq.stats&&typeof qq.stats==='object')?qq.stats:{};
  /* default presets, versioned: v1 seeded the old eight chores, v2 keeps only
     the one-off ones. A fresh save gets the v2 list; a v1 save just loses the
     routine-type ids. A save that deleted a default on purpose is not re-seeded. */
  const seedV=Number(qq.seedVersion)||(qq.seededPresets===true?1:0);
  if(seedV<1)QQ_SEED_PRESETS.forEach(p=>{if(!qq.presets.some(x=>x.id===p.id))qq.presets.push(qqPresetShape(p))});
  if(seedV<QQ_SEED_VERSION){
    const before=qq.presets.length;
    qq.presets=qq.presets.filter(p=>!QQ_RETIRED_SEED_IDS.includes(p.id));
    changed=changed||before!==qq.presets.length||seedV!==QQ_SEED_VERSION;
  }
  qq.seedVersion=QQ_SEED_VERSION;delete qq.seededPresets;
  /* the retired To-Do system: its tasks become Quick Quests, once (open ones are queued records, so they are staged for the Log right away) */
  if(qqMigrateLegacyTasks(qq))changed=true;
  if(qqStageQueued(qq,x=>x.status==='queued'))changed=true;
  /* lifetime counters never fall below the Quick Quest records held; records
     that came from old tasks are history, not Quick Quest completions */
  qq.stats.completedTotal=Math.max(Math.max(0,Number(qq.stats.completedTotal)||0),qq.items.filter(x=>x.status==='completed'&&!x.migratedFrom).length);
  qq.stats.cancelledTotal=Math.max(Math.max(0,Number(qq.stats.cancelledTotal)||0),qq.items.filter(x=>x.status==='cancelled').length);
  /* one active quest at most: keep the earliest-started, cancel the rest (there is no queue to put them back in) */
  qq.items.filter(x=>x.status==='active').sort((a,b)=>a.startedAt-b.startedAt).slice(1).forEach(x=>{x.status='cancelled';x.cancelledAt=Date.now();x.completedAt=null;qq.stats.cancelledTotal+=1;changed=true});
  qqNormalized.add(qq);
  if(changed)qqSchedulePersist();
  return qq;
}
/* ensure() must not call save() (it runs inside save()'s own hooks), so a
   change it makes is persisted by one deferred save. */
let qqPersistTimer=null;
function qqSchedulePersist(){
  if(qqPersistTimer)return;
  qqPersistTimer=setTimeout(()=>{qqPersistTimer=null;save()},0);
}

/* ---------- retiring the old To-Do system ----------
   Every old task becomes a Quick Quest and nothing is deleted:
     title, date, time and notes carry over where the task had them,
     a done task becomes a completed Quick Quest (no duration: it was never
     timed), and the Top 3 ranking, bucket and difficulty are discarded.
   The two untouched sample tasks new saves used to start with are not
   migrated (they were never the player's data). All original records,
   samples included, move to state.legacyTasks with a pointer to their new
   record, and state.tasks is left empty. Idempotent: an old task that
   already has a migrated Quick Quest is never migrated twice. */
function qqMigrateLegacyTasks(qq){
  const tasks=Array.isArray(state.tasks)?state.tasks:[];
  if(!tasks.length)return false;
  state.legacyTasks=Array.isArray(state.legacyTasks)?state.legacyTasks:[];
  const done=new Map([...qq.items,...qq.legacyQueued].filter(x=>x.migratedFrom&&x.migratedFrom.type==='task').map(x=>[String(x.migratedFrom.id),x.id]));   /* staged twins count too */
  const now=Date.now();
  let moved=0,samples=0;
  tasks.forEach(t=>{
    if(!t||typeof t!=='object')return;
    const key=String(t.id);
    let newId=done.get(key)||null,skipped=null;
    if(!newId){
      const title=qqTrim(t.text!=null?t.text:t.title,120);
      if(QQ_SAMPLE_TASKS.some(sm=>Number(t.id)===sm.id&&String(t.text)===sm.text)&&!t.done){skipped='sample';samples++}
      else if(!title)skipped='no-title';
      else{
        const date=qqIsDate(t.date)?t.date:todayISO();
        const isDone=Boolean(t.done);
        const item=qqShape({
          id:qqNewId(),title,status:isDone?'completed':'queued',
          createdAt:Number(t.id)>1e12?Number(t.id):now,
          scheduledDate:date,scheduledTime:qqIsTime(t.time||t.startTime)?(t.time||t.startTime):null,
          notes:t.notes,
          completedAt:isDone?(qqNum(t.completedAt)||dateFromISO(date).getTime()):null,
          migratedFrom:{type:'task',id:t.id}
        });
        qq.items.push(item);done.set(key,item.id);newId=item.id;moved++;
      }
    }
    state.legacyTasks.push({...t,migratedTo:newId,skipped,migratedAt:now});
  });
  state.tasks=[];
  const prev=qq.taskMigration&&typeof qq.taskMigration==='object'?qq.taskMigration:{};
  qq.taskMigration={migratedAt:now,count:(Number(prev.count)||0)+moved,skippedSamples:(Number(prev.skippedSamples)||0)+samples,notified:Boolean(prev.notified)&&!moved};
  return true;
}
function qqNotifyMigration(){
  const m=state.quickQuests&&state.quickQuests.taskMigration;
  if(!m||m.notified||!m.count)return;
  m.notified=true;
  toast(`${m.count} old task${m.count===1?'':'s'} carried over.`,'info');
  save();
}

/* ---------- selectors ---------- */
function qqItems(){return ensureQuickQuestsState().items}
function qqById(id){return qqItems().find(x=>x.id===String(id))||null}
function qqActive(){return qqItems().find(x=>x.status==='active')||null}
function qqRecent(n=QQ_RECENT_LIMIT){return qqItems().filter(x=>x.status==='completed').sort((a,b)=>b.completedAt-a.completedAt).slice(0,n)}
function quickQuestPoolById(id){return QUICK_QUEST_POOL.find(x=>x.id===String(id))||null}
function quickQuestPoolGroup(group){return QUICK_QUEST_POOL.filter(x=>x.group===group)}
/* "Surprise me": a random library entry, from one group or from all of them */
function quickQuestRandomPick(group){
  const list=group?quickQuestPoolGroup(group):QUICK_QUEST_POOL;
  return list.length?list[Math.floor(Math.random()*list.length)]:null;
}
function quickQuestCompletedTotal(){return ensureQuickQuestsState().stats.completedTotal}
function quickQuestCompletedCountOn(date){return qqItems().filter(x=>x.status==='completed'&&x.completedAt&&localISO(new Date(x.completedAt))===date).length}

/* ---------- time formatting ---------- */
function qqClock(ms){const s=Math.max(0,Math.floor(ms/1000));return `${qqPad(Math.floor(s/3600))}:${qqPad(Math.floor(s%3600/60))}:${qqPad(s%60)}`}
function qqDuration(ms){
  const s=Math.max(0,Math.round(ms/1000));
  if(s<60)return `${s}s`;
  const m=Math.floor(s/60);
  if(m<60)return `${m}m ${s%60}s`;
  return `${Math.floor(m/60)}h ${qqPad(m%60)}m`;
}
function qqDurationShort(ms){const m=Math.round(ms/60000);if(m<1)return '<1m';if(m<60)return `${m}m`;return `${Math.floor(m/60)}h ${qqPad(m%60)}m`}
function qqMinutesLong(ms){
  const m=Math.round(ms/60000);
  if(m<1)return 'less than a minute';
  if(m===1)return '1 minute';
  if(m<60)return `${m} minutes`;
  const h=Math.floor(m/60),r=m%60;
  return r?`${h}h ${qqPad(r)}m`:`${h} hour${h>1?'s':''}`;
}
function qqTimeOfDay(ts){const d=new Date(ts);return `${qqPad(d.getHours())}:${qqPad(d.getMinutes())}`}
function qqElapsed(item){
  if(!item||!item.startedAt)return null;
  if(item.status==='active')return Math.max(0,Date.now()-item.startedAt);
  if(item.status==='completed'&&item.completedAt)return Math.max(0,item.completedAt-item.startedAt);
  return null;
}
function qqDayLabel(date){
  const t=todayISO();
  if(date===t)return 'Today';
  if(date===addDays(t,1))return 'Tomorrow';
  if(date===addDays(t,-1))return 'Yesterday';
  return fmtDate(date);
}

/* ---------- mutations (each one saves) ---------- */
function qqEmit(name,detail){try{document.dispatchEvent(new CustomEvent(name,{detail}))}catch(e){}}
/* Start a Quick Quest NOW from a source: {poolId} (the library), {presetId} (a saved one) or {title,notes} (typed). It is created active,
   with its timer running. When another is already active nothing is created: the reply carries the pending source so the player can
   resolve the active one first. */
function quickQuestBegin(src={}){
  const qq=ensureQuickQuestsState();
  let title='',notes='',poolId=null,presetId=null;
  if(src.poolId){
    const p=quickQuestPoolById(src.poolId);
    if(!p)return {ok:false,reason:'unknown-pool'};
    title=p.title;poolId=p.id;
  }else if(src.presetId){
    const p=qq.presets.find(x=>x.id===String(src.presetId));
    if(!p)return {ok:false,reason:'unknown-preset'};
    title=p.title;notes=p.notes;presetId=p.id;
  }else{title=qqTrim(src.title,120);notes=qqTrim(src.notes,500)}
  if(!title)return {ok:false,reason:'no-title'};
  const cur=qqActive();
  /* a double tap: the same thing started a moment ago is already running, not a conflict */
  if(cur&&cur.title===title&&Date.now()-cur.startedAt<1500)return {ok:true,item:cur,duplicate:true};
  if(cur)return {ok:false,reason:'active-exists',active:cur,pending:{poolId,presetId,title,notes}};
  const now=Date.now();
  const item=qqShape({id:qqNewId(),title,status:'active',createdAt:now,startedAt:now,notes,presetId,poolId});
  qq.items.push(item);
  save();
  qqEmit('quickquest:started',{id:item.id,title:item.title,startedAt:now,poolId,presetId});
  return {ok:true,item};
}
function quickQuestComplete(id){
  const qq=ensureQuickQuestsState(),item=qqById(id);
  if(!item||item.status!=='active')return {ok:false,reason:'not-completable'};
  const now=Date.now();
  if(typeof ensureQuestCompletionsState==='function')ensureQuestCompletionsState();/* seed before this item reads as completed, or the seed would swallow its own completion event */
  item.status='completed';item.completedAt=now;item.cancelledAt=null;
  const elapsedMs=item.startedAt?Math.max(0,now-item.startedAt):null;
  qq.stats.completedTotal+=1;
  /* D7: one permanent record per Quick Quest (history, Chains, achievements read it); no reward, Quick Quests grant no XP (D2/D10) */
  if(typeof recordQuestCompletion==='function')recordQuestCompletion({system:'quick',type:'quest',instanceId:item.id,questId:item.id,definitionId:item.poolId||undefined,title:item.title,source:(item.poolId||item.presetId)?'preset':'custom',at:now});
  qqPrune();
  save();
  /* the hook a future reward or Quick Quest achievement attaches to */
  qqEmit('quickquest:completed',{id:item.id,title:item.title,completedAt:now,elapsedMs,presetId:item.presetId,poolId:item.poolId,completedTotal:qq.stats.completedTotal});
  return {ok:true,item,elapsedMs};
}
function quickQuestCancel(id){
  const qq=ensureQuickQuestsState(),item=qqById(id);
  if(!item||item.status!=='active')return {ok:false,reason:'not-cancellable'};
  item.status='cancelled';item.cancelledAt=Date.now();item.completedAt=null;
  qq.stats.cancelledTotal+=1;
  qqPrune();
  save();
  qqEmit('quickquest:cancelled',{id:item.id,title:item.title,cancelledAt:item.cancelledAt});
  return {ok:true,item};
}
function quickQuestDelete(id){
  const qq=ensureQuickQuestsState(),item=qqById(id);
  if(!item||item.status==='active')return {ok:false,reason:'not-deletable'};
  qq.items=qq.items.filter(x=>x.id!==item.id);
  save();
  return {ok:true};
}
/* Repeat = a brand-new active quest from the same source; the old record is never reactivated. */
function quickQuestRepeat(id){
  const src=qqById(id);
  if(!src)return {ok:false,reason:'not-found'};
  if(src.poolId&&quickQuestPoolById(src.poolId))return quickQuestBegin({poolId:src.poolId});
  if(src.presetId&&ensureQuickQuestsState().presets.some(p=>p.id===src.presetId))return quickQuestBegin({presetId:src.presetId});
  return quickQuestBegin({title:src.title,notes:src.notes});
}
function quickQuestPresetSave(title,notes,category){
  const t=qqTrim(title,120);
  if(!t)return {ok:false,reason:'no-title'};
  const qq=ensureQuickQuestsState();
  const dupe=qq.presets.find(p=>p.title.toLowerCase()===t.toLowerCase());
  if(dupe)return {ok:false,reason:'exists',preset:dupe};
  const p=qqPresetShape({id:qqNewId(),title:t,notes,category,createdAt:Date.now()});
  qq.presets.push(p);
  save();
  return {ok:true,preset:p};
}
function quickQuestPresetRemove(id){
  const qq=ensureQuickQuestsState(),n=qq.presets.length;
  qq.presets=qq.presets.filter(p=>p.id!==id);
  if(qq.presets.length===n)return {ok:false};
  save();
  return {ok:true};
}
function qqPrune(){
  const qq=ensureQuickQuestsState();
  const terminal=qq.items.filter(x=>x.status==='completed'||x.status==='cancelled').sort((a,b)=>(b.completedAt||b.cancelledAt||0)-(a.completedAt||a.cancelledAt||0));
  if(terminal.length<=QQ_TERMINAL_KEEP)return;
  const drop=new Set(terminal.slice(QQ_TERMINAL_KEEP).map(x=>x.id));
  qq.items=qq.items.filter(x=>!drop.has(x.id));
}

/* Quick Quests are not in the shared schedule feed or on any calendar (Jay 2026-09-25; Lyra D1/D2): they have no day. Home's optional block
   is a normal Quest Pane panel: it shows in Home Settings' panel list and can be switched off there. */
if(typeof HOME_PANEL_KEYS!=='undefined'&&!HOME_PANEL_KEYS.includes('quickquest')){HOME_PANEL_KEYS.push('quickquest');HOME_PANEL_LABELS.quickquest='Quick Quests'}

/* ---------- views: rows and cards ---------- */
function qqDoneRowHTML(item){
  const ms=qqElapsed(item);
  const when=`${qqDayLabel(localISO(new Date(item.completedAt)))} ${qqTimeOfDay(item.completedAt)}${ms==null?'':` · ${qqDurationShort(ms)}`}`;
  return `<button type="button" class="q-row qq-row qq-row--done qq-row--nolead-end is-done" data-qq-action="open" data-qq-id="${item.id}">
    <span class="q-check is-done" aria-hidden="true"></span>
    <span class="q-row__body"><span class="q-row__title">${esc(item.title)}</span><span class="q-row__sub">${esc(when)}</span></span>
  </button>`;
}
/* one library entry: a plus, the title and a Start button */
function qqPoolRowHTML(p){
  const t=esc(p.title);
  return `<div class="q-row qq-pool-row" role="listitem"><span class="qq-plus" aria-hidden="true">+</span><span class="q-row__body"><span class="q-row__title">${t}</span></span><span class="q-row__actions"><button type="button" class="q-btn q-btn--sm q-btn--primary" data-qq-action="begin" data-qq-pool="${esc(p.id)}" aria-label="Start: ${t}">Start</button></span></div>`;
}
function qqPresetRowHTML(p){
  return `<div class="q-row qq-preset">
    <button type="button" class="qq-preset__use" data-qq-action="begin" data-qq-preset="${esc(p.id)}" aria-label="Start ${esc(p.title)}">
      <span class="qq-plus" aria-hidden="true">+</span>
      <span class="q-row__body"><span class="q-row__title">${esc(p.title)}</span>${p.category?`<span class="q-row__sub">${esc(p.category)}</span>`:''}</span>
    </button>
    <button type="button" class="q-icon-btn qq-preset__remove" data-qq-action="preset-remove" data-qq-id="${esc(p.id)}" aria-label="Remove saved Quick Quest ${esc(p.title)}">&times;</button>
  </div>`;
}
function qqActiveCardHTML(a){
  return `<article class="q-card q-glass--accent qq-active">
    <div class="q-card__head"><span class="q-icon-ring q-icon-ring--lg"><img src="${asset(QUEST_HUB_TILE_ART.quick.icon)}" alt=""></span>
      <div class="q-card__body"><span class="q-kicker">Quick Quest · Active</span>
        <h3 class="q-card__title"><button type="button" class="qq-titlebtn" data-qq-action="open" data-qq-id="${a.id}">${esc(a.title)}</button></h3>
        <span class="q-meta">Started ${qqTimeOfDay(a.startedAt)}</span></div></div>
    <div class="qq-timer" role="timer" aria-label="Elapsed time" data-qq-elapsed="${a.id}">${qqClock(Date.now()-a.startedAt)}</div>
    <div class="q-btn-row"><button type="button" class="q-btn q-btn--primary" data-qq-action="complete" data-qq-id="${a.id}">Complete</button><button type="button" class="q-btn q-btn--danger" data-qq-action="cancel" data-qq-id="${a.id}">Cancel</button></div>
  </article>`;
}

/* ---------- views: the Quick Quests page ---------- */
function quickQuestPageHTML(){
  const back=questsBackHTML('data-qp-view="hub"','← Quests');
  const active=qqActive(),recent=qqRecent(),presets=ensureQuickQuestsState().presets;
  if(!QQ_GROUPS.includes(qqGroup))qqGroup=QQ_GROUPS[0];
  const activeHTML=active?qqActiveCardHTML(active):'<div class="q-empty">Nothing active. Pick one below and it starts.</div>';
  const tabs=`<div class="q-tabs qq-group-tabs" role="group" aria-label="Quick Quest groups">${QQ_GROUPS.map(g=>`<button type="button" class="q-tab${g===qqGroup?' is-active':''}" data-qq-action="group" data-qq-group="${esc(g)}" aria-pressed="${g===qqGroup}">${esc(g)}</button>`).join('')}</div>`;
  const savedHTML=presets.length?`<div class="q-stack">${presets.map(qqPresetRowHTML).join('')}</div>`:'<div class="q-empty">Nothing saved yet. Save a Quick Quest from its details to reuse it.</div>';
  const recentHTML=recent.length?`<section class="q-section" data-arrange-id="recent" data-arrange-label="Recently completed"><h2 class="q-section__title">Recently completed</h2><div class="q-stack">${recent.map(qqDoneRowHTML).join('')}</div></section>`:'';
  return back+`
    <section class="q-section" data-arrange-id="active" data-arrange-label="Active"><h2 class="q-section__title">Active</h2>${activeHTML}</section>
    <section class="q-section" data-arrange-id="start" data-arrange-label="Start one"><h2 class="q-section__title">Start one</h2><p class="q-note">Small, immediate, no planning. Anything that needs a day belongs in the Adventurer’s Log.</p><div class="qq-own"><input class="q-input" id="qqOwnTitle" maxlength="120" placeholder="Something small to do now…" aria-label="Your own Quick Quest" autocomplete="off" enterkeyhint="go" value="${esc(qqOwnDraft)}"><button type="button" class="q-btn q-btn--primary" data-qq-action="begin-own">Start</button></div><div class="q-btn-row"><button type="button" class="q-btn" data-qq-action="surprise">Surprise me</button></div></section>
    <section class="q-section" data-arrange-id="library" data-arrange-label="Library"><h2 class="q-section__title">Library</h2>${tabs}<div class="q-stack" role="list">${quickQuestPoolGroup(qqGroup).map(qqPoolRowHTML).join('')}</div></section>
    <section class="q-section" data-arrange-id="saved" data-arrange-label="Saved"><h2 class="q-section__title">Saved</h2>${savedHTML}</section>
    ${recentHTML}`;
}

/* Quests hub tile (the Quick tile of the four-tile gateway grid). */
function quickQuestTileData(){
  const a=qqActive(),today=quickQuestCompletedCountOn(todayISO());
  if(a){
    return {html:`<span class="q-tile__kicker">Active</span><span class="q-tile__line">${esc(a.title)}</span><span class="q-tile__meta qq-tile-timer" data-qq-elapsed="${a.id}">${qqClock(Date.now()-a.startedAt)}</span>`,
      aria:`Quick Quest active: ${a.title}`};
  }
  return {html:`<span class="q-tile__kicker">Do one now</span><span class="q-tile__empty">Pick a small win. No planning.</span>${today?`<span class="q-tile__meta">${today} done today</span>`:''}`,aria:`Quick Quests: pick one to do now${today?`, ${today} done today`:''}`};
}

/* ---------- views: the Home block (a Quest Pane panel) ---------- */
function quickQuestHomeBlockHTML(){
  const a=qqActive(),icon=asset(QUEST_HUB_TILE_ART.quick.icon);
  const header=`<div class="home-panel-header home-panel-header-lg"><img class="home-panel-icon" src="${icon}" alt=""><span>${a?'Quick Quest':'Quick Quests'}</span></div>`;
  if(a){
    return `<div class="home-todaygroup-block home-todaygroup-quickquest qq-home is-active">
      ${header}
      <div class="hw-row qq-home-row">
        <button type="button" class="qq-home-open" data-qq-action="open" data-qq-id="${a.id}" aria-label="Open details: ${esc(a.title)}">
          <span class="hw-row-title">${esc(a.title)}</span>
          <span class="qq-home-timer" role="timer" aria-label="Elapsed time" data-qq-elapsed="${a.id}">${qqClock(Date.now()-a.startedAt)}</span>
        </button>
        <button type="button" class="feature-action-primary" data-qq-action="complete" data-qq-id="${a.id}" aria-label="Complete ${esc(a.title)}">Complete</button>
      </div>
    </div>`;
  }
  return `<div class="home-todaygroup-block home-todaygroup-quickquest qq-home">
    ${header}
    <div class="hw-row">
      <img class="hw-row-icon" src="${icon}" alt="">
      <div class="hw-row-body"><span class="hw-row-title muted">Nothing active</span><small class="hw-row-sub">Pick something small to do now</small></div>
    </div>
    <div class="qq-home-actions"><button type="button" class="feature-action-primary" data-qq-action="goto">Pick a Quick Quest</button><button type="button" class="feature-action-primary" data-qq-action="surprise">Surprise me</button></div>
  </div>`;
}

/* ---------- modals (the shared Quests glass dialog) ---------- */
function quickQuestConflictModal(){
  const cur=qqActive();
  if(!cur||!qqPending)return;
  questsModal({category:'quick',title:'Quick Quest already active',size:'sm',role:'alertdialog',describedBy:'qqConflictText',
    body:`<p class="qq-conflict__name">${esc(cur.title)}</p>
      <p class="qq-conflict__time">${esc(qqDuration(qqElapsed(cur)))}</p>
      <p class="q-modal__text" id="qqConflictText">Starting “${esc(qqPending.title)}” means resolving this one first.</p>`,
    actions:`<button type="button" class="q-btn" data-q-close>Go back</button><button type="button" class="q-btn q-btn--primary" data-qq-action="conflict-complete">Complete current</button><button type="button" class="q-btn q-btn--danger" data-qq-action="conflict-cancel">Cancel current</button>`,
    focus:'.q-modal__foot [data-q-close]'});
}
function quickQuestDetailModal(id){
  const item=qqById(id);
  if(!item)return;
  const notes=item.notes?`<div class="qq-notes"><span class="q-label">Notes</span><p>${esc(item.notes)}</p></div>`:'';
  const idAttr=`data-qq-id="${item.id}"`;
  let sub='',body='',actions='';
  if(item.status==='active'){
    body=`<div class="qq-timer" role="timer" aria-label="Elapsed time" data-qq-elapsed="${item.id}">${qqClock(Date.now()-item.startedAt)}</div><p class="qq-status"><span class="q-chip q-chip--accent">Active</span> <span class="q-meta">Started ${qqTimeOfDay(item.startedAt)}</span></p>${notes}`;
    actions=`<button type="button" class="q-btn q-btn--danger" data-qq-action="cancel" ${idAttr}>Cancel quest</button><button type="button" class="q-btn q-btn--primary" data-qq-action="complete" ${idAttr}>Complete</button>`;
  }else if(item.status==='completed'){
    const ms=qqElapsed(item);
    sub=`Completed ${qqDayLabel(localISO(new Date(item.completedAt)))}`;
    body=`<p class="qq-status"><span class="q-chip q-chip--good">✓ Complete</span></p>
      ${ms==null?`<p class="qq-times">Completed at ${qqTimeOfDay(item.completedAt)}</p>`:`<p class="qq-times">${qqTimeOfDay(item.startedAt)} → ${qqTimeOfDay(item.completedAt)}</p><p class="qq-times qq-times--long">${esc(qqMinutesLong(ms))}</p>`}${notes}`;
    const saved=ensureQuickQuestsState().presets.some(p=>p.title.toLowerCase()===item.title.toLowerCase());
    actions=`${saved?'':`<button type="button" class="q-btn" data-qq-action="save-preset" ${idAttr}>Save as preset</button>`}<button type="button" class="q-btn q-btn--primary" data-qq-action="repeat" ${idAttr}>Do it again</button>`;
  }else{
    sub=`Cancelled ${qqDayLabel(localISO(new Date(item.cancelledAt)))}`;
    body=`<p class="qq-status"><span class="q-chip q-chip--plain">Cancelled</span></p>${notes}`;
    actions=`<button type="button" class="q-btn q-btn--primary" data-qq-action="repeat" ${idAttr}>Do it again</button>`;
  }
  questsModal({category:'quick',title:item.title,sub,size:'sm',body,actions});
  qqEnsureTicker();
}

/* ---------- flows (what a tap does) ---------- */
function qqCompletionMessage(r){
  const dur=r.elapsedMs==null?'':` · ${qqDuration(r.elapsedMs)}`;
  return `Quest complete: ${r.item.title}${dur}`;
}
/* Start from a source. If another quest is active, remember the source and ask what to do with the active one. */
function qqBeginFlow(src){
  const r=quickQuestBegin(src);
  if(r.ok){qqPending=null;if(!src.poolId&&!src.presetId)qqOwnDraft='';closeModal();toast(`Started: ${r.item.title}`,'info');render();qqFocusAfter();return r}
  if(r.reason==='active-exists'){qqPending=r.pending;quickQuestConflictModal();return r}
  if(r.reason==='no-title')toast('Say what you are doing.','error');
  return r;
}
function qqCompleteFlow(id,thenBegin){
  const r=quickQuestComplete(id);
  if(!r.ok)return r;
  closeModal();
  let msg=qqCompletionMessage(r);
  if(thenBegin){const s=quickQuestBegin(thenBegin);if(s.ok)msg+=` — now timing ${s.item.title}`}
  qqPending=null;
  toast(msg,'success');
  render();
  qqFocusAfter();
  return r;
}
function qqCancelFlow(id,thenBegin){
  const r=quickQuestCancel(id);
  if(!r.ok)return r;
  closeModal();
  let msg=`Cancelled: ${r.item.title}`;
  if(thenBegin){const s=quickQuestBegin(thenBegin);if(s.ok)msg+=` — now timing ${s.item.title}`}
  qqPending=null;
  toast(msg,'info');
  render();
  qqFocusAfter();
  return r;
}
/* After a flow redraws the page the tapped button is gone, so put focus (and the view) where the result is: the Active card, or the "your own" field
   once nothing is active. It waits a moment so it lands AFTER a closing dialog has handed focus back to its launcher. */
function qqFocusAfter(){
  setTimeout(()=>{
    const t=document.querySelector('.qq-active .qq-titlebtn')||document.querySelector('.qq-home-open')||document.querySelector('#qqOwnTitle')||document.querySelector('.qq-home [data-qq-action="goto"]');
    if(!t)return;
    t.focus({preventScroll:true});
    const sec=t.closest('section')||t;
    if(sec.scrollIntoView)sec.scrollIntoView({block:'nearest'});
  },30);
}
/* the group tabs scroll sideways (eight of them): a redraw puts the strip back at the start, so bring the chosen tab back to the middle of it */
function qqScrollTabs(){
  const strip=document.querySelector('.qq-group-tabs'),tab=strip&&strip.querySelector('.q-tab.is-active');
  if(!tab)return;
  strip.scrollLeft=Math.max(0,tab.offsetLeft-(strip.clientWidth-tab.offsetWidth)/2);
}
/* el: the element that was tapped (its data-qq-* attributes carry the source); id: its item id when it has one */
function qqHandle(action,id,el){
  const item=id?qqById(id):null,ds=(el&&el.dataset)||{};
  switch(action){
    case 'goto':qpView='quick';return setPage('quests');
    case 'open':return item&&quickQuestDetailModal(item.id);
    case 'group':if(QQ_GROUPS.includes(ds.qqGroup)){qqGroup=ds.qqGroup;render();const t=document.querySelector(`[data-qq-group="${CSS.escape(qqGroup)}"]`);if(t)t.focus({preventScroll:true})}return;
    case 'begin':return qqBeginFlow(ds.qqPool?{poolId:ds.qqPool}:{presetId:ds.qqPreset});
    case 'begin-own':{const i=document.querySelector('#qqOwnTitle');return qqBeginFlow({title:i?i.value:''})}
    case 'surprise':{const p=quickQuestRandomPick();return p&&qqBeginFlow({poolId:p.id})}
    case 'complete':return item&&qqCompleteFlow(item.id);
    case 'cancel':
      if(!item)return;
      return questsConfirm({category:'quick',title:'Cancel Quick Quest?',message:`"${item.title}" will be cancelled and will not count as completed.`,confirmLabel:'Cancel quest',cancelLabel:'Keep going',danger:true},()=>qqCancelFlow(item.id));
    case 'repeat':{
      if(!item)return;
      const r=quickQuestRepeat(item.id);
      if(r.ok){qqPending=null;closeModal();toast(`Started: ${r.item.title}`,'info');render();qqFocusAfter()}
      else if(r.reason==='active-exists'){qqPending=r.pending;quickQuestConflictModal()}
      return;
    }
    case 'save-preset':{
      if(!item)return;
      const r=quickQuestPresetSave(item.title,item.notes);
      closeModal();
      toast(r.ok?`Saved: ${item.title}`:(r.reason==='exists'?'Already saved.':'Could not save.'),r.ok?'success':'info');
      render();
      return;
    }
    case 'preset-remove':{
      const p=ensureQuickQuestsState().presets.find(x=>x.id===id);
      if(!p)return;
      return questsConfirm({category:'quick',title:'Remove saved Quick Quest?',message:`"${p.title}" will no longer be offered. Quick Quests already created from it are not affected.`,confirmLabel:'Remove',cancelLabel:'Keep it',danger:true},()=>{quickQuestPresetRemove(p.id);toast('Removed.','info');render()});
    }
    case 'conflict-complete':{const cur=qqActive();return cur&&qqCompleteFlow(cur.id,qqPending)}
    case 'conflict-cancel':{const cur=qqActive();return cur&&qqCancelFlow(cur.id,qqPending)}
  }
}

/* ---------- live timer ----------
   Every timer element carries data-qq-elapsed and is repainted from the
   persisted startedAt, so there is no counter to lose: navigation and
   reloads simply render the right value. The interval runs only while an
   active quest AND at least one timer element exist, and stops itself. */
function qqTick(){
  const els=document.querySelectorAll('[data-qq-elapsed]'),a=qqActive();
  if(!els.length||!a){if(qqTickHandle){clearInterval(qqTickHandle);qqTickHandle=null}return}
  const text=qqClock(Date.now()-a.startedAt);
  els.forEach(el=>{if(el.textContent!==text)el.textContent=text});
}
function qqEnsureTicker(){
  if(qqTickHandle||!qqActive()||!document.querySelector('[data-qq-elapsed]'))return;
  qqTickHandle=setInterval(qqTick,1000);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)qqTick()});

/* ---------- wiring: one delegated handler, in the capture phase so it
   runs before a row's own click handler ---------- */
document.addEventListener('click',e=>{
  const el=e.target.closest&&e.target.closest('[data-qq-action]');
  if(!el)return;
  e.preventDefault();e.stopPropagation();
  const now=Date.now();
  if(now-qqLastAction<qqTapGap)return;      /* a double tap: the page has already redrawn under the finger */
  qqLastAction=now;
  qqHandle(el.dataset.qqAction,el.dataset.qqId,el);
},true);
document.addEventListener('input',e=>{if(e.target&&e.target.id==='qqOwnTitle')qqOwnDraft=e.target.value},true);
/* Enter in the "your own" field starts it (not mid-composition for an IME) */
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.isComposing||e.keyCode===229||!e.target||e.target.id!=='qqOwnTitle')return;
  e.preventDefault();e.stopPropagation();
  qqHandle('begin-own');
},true);
function qqAfterRender(){qqEnsureTicker();qqNotifyMigration();qqScrollTabs()}
const qqPrevRenderHome=renderHome;
renderHome=function(){qqPrevRenderHome();qqAfterRender()};
const qqPrevRenderTasks=renderTasks;
renderTasks=function(){qqPrevRenderTasks();qqAfterRender()};
const qqPrevRenderSideQuests=renderSideQuests;
renderSideQuests=function(){qqPrevRenderSideQuests();qqAfterRender()};
