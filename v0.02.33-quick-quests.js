/* ==========================================================================
   QUICK QUESTS V1 (Astra task "QUICK QUESTS V1", 2026-09-20)
   ==========================================================================
   Architecture rule: SOURCE SYSTEM -> SHARED DATA -> MULTIPLE VIEWS.

   state.quickQuests is the ONE source store. Home (a Quest Pane block) and
   the Adventurer's Log (a shared-schedule provider) only READ it and open
   its detail sheet; neither owns a copy, and nothing here writes into any
   other domain. The old generic To-Do system is RETIRED: its tasks were
   migrated into Quick Quests once (see qqMigrateLegacyTasks) and the
   originals are kept, untouched, in state.legacyTasks.

   Lifecycle:  queued -> active -> completed | cancelled
   (a queued quest can also be completed or cancelled directly, untimed).
   Only ONE quest may be active at a time. There is no pause/resume: the
   timer is the elapsed time between Start and Complete, always DERIVED as
   completedAt - startedAt (or now - startedAt while active). No duration
   is ever stored as authority.

   Records:
     item   { id, title, status, createdAt, scheduledDate, scheduledTime?,
              startedAt?, completedAt?, cancelledAt?, notes?, reminder?,
              presetId?, migratedFrom? }
     preset { id, title, notes?, category?, createdAt }   (a template: using
              one creates a NEW item and never touches the preset)
   Completed and cancelled records are retained (most recent 500 together;
   the lifetime counters in stats survive pruning).
   `reminder` is part of the schema but dormant: this app has no
   notification engine yet, so there is no control and nothing implies one.
   Wire it when a real notification system exists.

   Boundaries (locked with Lyra/Vale, 2026-09-21):
   - Quick Quest = a lightweight one-off action. Recurring "did I remember
     this?" habits (medication, teeth, vitamins, routine chores) belong to
     the future Daily Routine Tracker, so none are seeded as presets.
   - Quick Quests do NOT advance the Daily Quest minimum or any Daily Quest
     evaluator, and are not added to Character quest totals yet.
   - No XP. A user-authored one-off could otherwise be farmed ("stand up",
     "sit down"). Completion updates the counters, raises the
     quickquest:completed event and feeds the quickQuestCompletedTotal
     achievement trigger; any future reward attaches there and needs its own
     cap or rule. Achievement content itself (5/25/100) is Nox's, same
     "infrastructure only" precedent as Main Quest.
   ========================================================================== */

const QQ_STATUSES=['queued','active','completed','cancelled'];
const QQ_RECENT_LIMIT=5;
const QQ_UPCOMING_LIMIT=10;
const QQ_TERMINAL_KEEP=500;
const QQ_SEED_VERSION=2;
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
const QQ_SAMPLE_TASKS=[{id:1,text:'Review today\u2019s priorities'},{id:2,text:'Prepare tomorrow\u2019s Main Quest'}];
const qqNormalized=new WeakSet();
let qqTickHandle=null;

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
    status:QQ_STATUSES.includes(q.status)?q.status:'queued',
    createdAt,
    scheduledDate:qqIsDate(q.scheduledDate)?q.scheduledDate:localISO(new Date(createdAt)),
    scheduledTime:qqIsTime(q.scheduledTime)?q.scheduledTime:null,
    startedAt:qqNum(q.startedAt),
    completedAt:qqNum(q.completedAt),
    cancelledAt:qqNum(q.cancelledAt),
    notes:qqTrim(q.notes,500),
    reminder:q.reminder?String(q.reminder):null,
    presetId:q.presetId?String(q.presetId):null,
    migratedFrom:(q.migratedFrom&&typeof q.migratedFrom==='object')?{type:String(q.migratedFrom.type||'task'),id:q.migratedFrom.id}:null
  };
  /* status decides which timestamps may exist, so a hand-edited or
     half-written record can never come back as a phantom active quest */
  if(item.status==='queued'){item.startedAt=null;item.completedAt=null;item.cancelledAt=null}
  else if(item.status==='active'){item.completedAt=null;item.cancelledAt=null;if(!item.startedAt)item.status='queued'}
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
function qqDomainDefault(){return {version:1,items:[],presets:[],seedVersion:0,stats:{completedTotal:0,cancelledTotal:0}}}
function ensureQuickQuestsState(){
  if(!state.quickQuests||typeof state.quickQuests!=='object')state.quickQuests=qqDomainDefault();
  const qq=state.quickQuests;
  if(qqNormalized.has(qq))return qq;
  qq.version=1;
  qq.items=(Array.isArray(qq.items)?qq.items:[]).map(qqShape);
  qq.presets=(Array.isArray(qq.presets)?qq.presets:[]).map(qqPresetShape);
  qq.stats=(qq.stats&&typeof qq.stats==='object')?qq.stats:{};
  let changed=false;
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
  /* the retired To-Do system: its tasks become Quick Quests, once */
  if(qqMigrateLegacyTasks(qq))changed=true;
  /* lifetime counters never fall below the Quick Quest records held; records
     that came from old tasks are history, not Quick Quest completions */
  qq.stats.completedTotal=Math.max(Math.max(0,Number(qq.stats.completedTotal)||0),qq.items.filter(x=>x.status==='completed'&&!x.migratedFrom).length);
  qq.stats.cancelledTotal=Math.max(Math.max(0,Number(qq.stats.cancelledTotal)||0),qq.items.filter(x=>x.status==='cancelled').length);
  /* one active quest at most: keep the earliest-started, put the rest back in the queue */
  qq.items.filter(x=>x.status==='active').sort((a,b)=>a.startedAt-b.startedAt).slice(1).forEach(x=>{x.status='queued';x.startedAt=null});
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
  const done=new Map(qq.items.filter(x=>x.migratedFrom&&x.migratedFrom.type==='task').map(x=>[String(x.migratedFrom.id),x.id]));
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
  toast(`${m.count} old task${m.count===1?'':'s'} moved to Quick Quests.`,'info');
  save();
}

/* ---------- selectors ---------- */
function qqItems(){return ensureQuickQuestsState().items}
function qqById(id){return qqItems().find(x=>x.id===String(id))||null}
function qqActive(){return qqItems().find(x=>x.status==='active')||null}
function qqSortQueued(a,b){
  return a.scheduledDate.localeCompare(b.scheduledDate)
    ||((a.scheduledTime&&!b.scheduledTime)?-1:(!a.scheduledTime&&b.scheduledTime)?1:0)
    ||String(a.scheduledTime||'').localeCompare(String(b.scheduledTime||''))
    ||(a.createdAt-b.createdAt);
}
function qqDue(){const t=todayISO();return qqItems().filter(x=>x.status==='queued'&&x.scheduledDate<=t).sort(qqSortQueued)}
function qqUpcoming(){const t=todayISO();return qqItems().filter(x=>x.status==='queued'&&x.scheduledDate>t).sort(qqSortQueued)}
function qqRecent(n=QQ_RECENT_LIMIT){return qqItems().filter(x=>x.status==='completed').sort((a,b)=>b.completedAt-a.completedAt).slice(0,n)}
function qqWaitingCount(){return qqDue().length}
function quickQuestRandomWaiting(){const list=qqDue();return list.length?list[Math.floor(Math.random()*list.length)]:null}
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
function qqDueLabel(item){
  const t=todayISO();
  if(item.scheduledDate<t){
    const n=Math.round((dateFromISO(t)-dateFromISO(item.scheduledDate))/86400000);
    return n===1?'Due yesterday':`Due ${n} days ago`;
  }
  return qqDayLabel(item.scheduledDate);
}

/* ---------- mutations (each one saves) ---------- */
function quickQuestAdd(fields={}){
  const title=qqTrim(fields.title,120);
  if(!title)return null;
  const qq=ensureQuickQuestsState();
  const item=qqShape({
    id:qqNewId(),title,status:'queued',createdAt:Date.now(),
    scheduledDate:qqIsDate(fields.scheduledDate)?fields.scheduledDate:todayISO(),
    scheduledTime:qqIsTime(fields.scheduledTime)?fields.scheduledTime:null,
    notes:fields.notes,presetId:fields.presetId||null
  });
  qq.items.push(item);
  save();
  return item;
}
function quickQuestStart(id){
  const item=qqById(id);
  if(!item||item.status!=='queued')return {ok:false,reason:'not-startable'};
  const cur=qqActive();
  if(cur&&cur.id!==item.id)return {ok:false,reason:'active-exists',active:cur};
  item.status='active';item.startedAt=Date.now();item.completedAt=null;item.cancelledAt=null;
  save();
  return {ok:true,item};
}
function qqEmit(name,detail){try{document.dispatchEvent(new CustomEvent(name,{detail}))}catch(e){}}
function quickQuestComplete(id){
  const qq=ensureQuickQuestsState(),item=qqById(id);
  if(!item||(item.status!=='active'&&item.status!=='queued'))return {ok:false,reason:'not-completable'};
  const now=Date.now();
  item.status='completed';item.completedAt=now;item.cancelledAt=null;
  const elapsedMs=item.startedAt?Math.max(0,now-item.startedAt):null;
  qq.stats.completedTotal+=1;
  qqPrune();
  save();
  /* the hook a future reward or Quick Quest achievement attaches to */
  qqEmit('quickquest:completed',{id:item.id,title:item.title,completedAt:now,elapsedMs,presetId:item.presetId,completedTotal:qq.stats.completedTotal});
  return {ok:true,item,elapsedMs};
}
function quickQuestCancel(id){
  const qq=ensureQuickQuestsState(),item=qqById(id);
  if(!item||(item.status!=='active'&&item.status!=='queued'))return {ok:false,reason:'not-cancellable'};
  item.status='cancelled';item.cancelledAt=Date.now();item.completedAt=null;
  qq.stats.cancelledTotal+=1;
  qqPrune();
  save();
  qqEmit('quickquest:cancelled',{id:item.id,title:item.title,cancelledAt:item.cancelledAt});
  return {ok:true,item};
}
function quickQuestEdit(id,patch={}){
  const item=qqById(id);
  if(!item||item.status!=='queued')return {ok:false,reason:'not-editable'};
  if('title' in patch){const t=qqTrim(patch.title,120);if(!t)return {ok:false,reason:'no-title'};item.title=t}
  if('scheduledDate' in patch){if(!qqIsDate(patch.scheduledDate))return {ok:false,reason:'bad-date'};item.scheduledDate=patch.scheduledDate}
  if('scheduledTime' in patch)item.scheduledTime=qqIsTime(patch.scheduledTime)?patch.scheduledTime:null;
  if('notes' in patch)item.notes=qqTrim(patch.notes,500);
  save();
  return {ok:true,item};
}
function quickQuestReschedule(id,date,time){
  const patch={scheduledDate:date};
  if(time!==undefined)patch.scheduledTime=time;
  return quickQuestEdit(id,patch);
}
function quickQuestDelete(id){
  const qq=ensureQuickQuestsState(),item=qqById(id);
  if(!item||item.status==='active')return {ok:false,reason:'not-deletable'};
  qq.items=qq.items.filter(x=>x.id!==item.id);
  save();
  return {ok:true};
}
/* Repeat = a brand-new queued instance dated today; the source record is
   never reactivated. Only title, notes and preset link carry over. */
function quickQuestRepeat(id){
  const src=qqById(id);
  return src?quickQuestAdd({title:src.title,notes:src.notes,presetId:src.presetId}):null;
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
function quickQuestUsePreset(id){
  const p=ensureQuickQuestsState().presets.find(x=>x.id===id);
  return p?quickQuestAdd({title:p.title,notes:p.notes,presetId:p.id}):null;
}
function qqPrune(){
  const qq=ensureQuickQuestsState();
  const terminal=qq.items.filter(x=>x.status==='completed'||x.status==='cancelled').sort((a,b)=>(b.completedAt||b.cancelledAt||0)-(a.completedAt||a.cancelledAt||0));
  if(terminal.length<=QQ_TERMINAL_KEEP)return;
  const drop=new Set(terminal.slice(QQ_TERMINAL_KEEP).map(x=>x.id));
  qq.items=qq.items.filter(x=>!drop.has(x.id));
}

/* ---------- shared schedule provider ----------
   The Log calendar, its Today list, Home's Calendar block and the Today
   panel all read sharedScheduleItemsForDate(); registering here is what
   makes a dated Quick Quest appear in every one of them, as a reference
   to the same record (sourceType/sourceId), never a copy. A quest shows
   on its scheduled date only; cancelled quests do not appear. */
function scheduleProviderQuickQuest(date){
  return qqItems().filter(x=>x.scheduledDate===date&&x.status!=='cancelled').map(x=>{
    let sub='';
    if(x.status==='completed'){const ms=qqElapsed(x);sub=ms==null?'Complete':`Complete · ${qqDurationShort(ms)}`}
    else if(x.status==='active')sub='Active';
    return {time:x.scheduledTime||'Any',title:x.title,sub,kind:'quickQuest',done:x.status==='completed',sourceType:'quickQuest',sourceId:x.id,tagLabel:'quick'};
  });
}
/* Jay 2026-09-25: Quick Quests do not populate the calendar or any schedule list (Log Today, Home schedule). The provider is
   deliberately NOT registered with SHARED_SCHEDULE_PROVIDERS; Quick Quests live in their own Quest Pane views. */
if(typeof SCHEDULE_KIND_LABELS!=='undefined')SCHEDULE_KIND_LABELS.quickQuest='Quick Quest';
if(typeof HOME_SCHEDULE_KIND_ICON!=='undefined')HOME_SCHEDULE_KIND_ICON.quickQuest='Quests/V4/Icons/QUESTS_QUICK_ICON.png';
/* Quick Quests no longer add dots to the Log calendar (Jay 2026-09-25: quests do not populate the calendar). They still
   appear in the Today list, on Home and in the Quick Quest views. */
/* Home's optional block is a normal Quest Pane panel: it shows in Home
   Settings' panel list and can be switched off there. */
if(typeof HOME_PANEL_KEYS!=='undefined'&&!HOME_PANEL_KEYS.includes('quickquest')){HOME_PANEL_KEYS.push('quickquest');HOME_PANEL_LABELS.quickquest='Quick Quests'}

/* ---------- views: rows and cards ---------- */
function qqQueuedRowHTML(item){
  const late=item.scheduledDate<todayISO();
  const bits=[];
  if(late)bits.push(`<span class="qq-late">${esc(qqDueLabel(item))}</span>`);
  if(item.scheduledTime)bits.push(esc(item.scheduledTime));
  const sub=bits.length?`<span class="q-row__sub">${bits.join(' · ')}</span>`:'';
  const t=esc(item.title);
  return `<div class="q-row qq-row${late?' is-late':''}">
    <button type="button" class="q-check qq-check" data-qq-action="complete" data-qq-id="${item.id}" aria-label="Complete ${t}"></button>
    <button type="button" class="qq-row__body" data-qq-action="open" data-qq-id="${item.id}"><span class="q-row__title">${t}</span>${sub}</button>
    <span class="q-row__actions"><button type="button" class="q-btn q-btn--sm q-btn--primary" data-qq-action="start" data-qq-id="${item.id}" aria-label="Start ${t}">Start</button></span>
    ${late?`<div class="qq-row__more"><button type="button" class="q-btn q-btn--ghost q-btn--sm" data-qq-action="reschedule" data-qq-id="${item.id}" aria-label="Reschedule ${t}">Reschedule</button><button type="button" class="q-btn q-btn--ghost q-btn--sm" data-qq-action="complete" data-qq-id="${item.id}" aria-label="Complete ${t} without timing">Complete</button></div>`:''}
  </div>`;
}
function qqDoneRowHTML(item){
  const ms=qqElapsed(item);
  const when=`${qqDayLabel(localISO(new Date(item.completedAt)))} ${qqTimeOfDay(item.completedAt)}${ms==null?'':` · ${qqDurationShort(ms)}`}`;
  return `<button type="button" class="q-row qq-row qq-row--done qq-row--nolead-end is-done" data-qq-action="open" data-qq-id="${item.id}">
    <span class="q-check is-done" aria-hidden="true"></span>
    <span class="q-row__body"><span class="q-row__title">${esc(item.title)}</span><span class="q-row__sub">${esc(when)}</span></span>
  </button>`;
}
function qqPresetRowHTML(p){
  return `<div class="q-row qq-preset">
    <button type="button" class="qq-preset__use" data-qq-action="preset-use" data-qq-id="${esc(p.id)}" aria-label="Add ${esc(p.title)} to Today">
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
  const active=qqActive(),due=qqDue(),upcoming=qqUpcoming(),recent=qqRecent(),presets=ensureQuickQuestsState().presets;
  const activeHTML=active?qqActiveCardHTML(active):'<div class="q-empty">Nothing active. Start a Quick Quest below.</div>';
  const dueHTML=due.length?`<div class="q-stack">${due.map(qqQueuedRowHTML).join('')}</div>`:'<div class="q-empty">Nothing due today.</div>';
  let upcomingHTML='';
  if(upcoming.length){
    const shown=upcoming.slice(0,QQ_UPCOMING_LIMIT),groups=[];
    shown.forEach(x=>{const g=groups[groups.length-1];if(g&&g.date===x.scheduledDate)g.items.push(x);else groups.push({date:x.scheduledDate,items:[x]})});
    upcomingHTML=`<section class="q-section"><h2 class="q-section__title">Upcoming</h2>${groups.map(g=>`<div class="qq-group"><h3 class="qq-group__title">${esc(qqDayLabel(g.date))}</h3><div class="q-stack">${g.items.map(qqQueuedRowHTML).join('')}</div></div>`).join('')}${upcoming.length>shown.length?`<p class="q-note">+${upcoming.length-shown.length} more scheduled</p>`:''}</section>`;
  }
  const savedHTML=presets.length?`<div class="q-stack">${presets.map(qqPresetRowHTML).join('')}</div>`:'<div class="q-empty">Nothing saved yet. Save a Quick Quest from its details to reuse it.</div>';
  const recentHTML=recent.length?`<section class="q-section"><h2 class="q-section__title">Recently completed</h2><div class="q-stack">${recent.map(qqDoneRowHTML).join('')}</div></section>`:'';
  return back+`
    <section class="q-section"><button type="button" class="q-btn q-btn--primary q-btn--block" data-qq-action="add">+ Quick Add</button></section>
    <section class="q-section"><h2 class="q-section__title">Active</h2>${activeHTML}</section>
    <section class="q-section"><h2 class="q-section__title">Today</h2>${dueHTML}</section>
    ${upcomingHTML}
    <section class="q-section"><h2 class="q-section__title">Saved</h2>${savedHTML}</section>
    ${recentHTML}`;
}

/* Quests hub tile (the Quick tile of the four-tile gateway grid). */
function quickQuestTileData(){
  const a=qqActive(),due=qqDue();
  if(a){
    return {html:`<span class="q-tile__kicker">Active</span><span class="q-tile__line">${esc(a.title)}</span><span class="q-tile__meta qq-tile-timer" data-qq-elapsed="${a.id}">${qqClock(Date.now()-a.startedAt)}</span><span class="q-tile__meta">${due.length} waiting</span>`,
      aria:`Quick Quest active: ${a.title}, ${due.length} waiting`};
  }
  if(!due.length){
    return {html:`<span class="q-tile__kicker">Nothing waiting</span><span class="q-tile__empty">Add a Quick Quest for a small win.</span>`,aria:'no Quick Quests waiting'};
  }
  const preview=due.slice(0,3).map(x=>`<span class="q-tile__item"><i class="q-tile__check" aria-hidden="true"></i><span>${esc(x.title)}</span></span>`).join('');
  return {html:`<span class="q-tile__kicker">${due.length} waiting</span><span class="q-tile__list">${preview}</span>`,aria:`${due.length} Quick Quests waiting`};
}

/* ---------- views: the Home block (a Quest Pane panel) ---------- */
function quickQuestHomeBlockHTML(){
  const a=qqActive(),icon=asset(QUEST_HUB_TILE_ART.quick.icon);
  const header=`<div class="home-panel-header home-panel-header-lg"><img class="home-panel-icon" src="${icon}" alt=""><span>${a?'Quick Quest':'Quick Quests'}</span></div>`;
  if(a){
    return `<div class="home-todaygroup-block home-todaygroup-quickquest qq-home is-active">
      ${header}
      <div class="hw-row qq-home-row">
        <button type="button" class="qq-home-open" data-qq-action="open" data-qq-id="${a.id}">
          <span class="hw-row-title">${esc(a.title)}</span>
          <span class="qq-home-timer" role="timer" aria-label="Elapsed time" data-qq-elapsed="${a.id}">${qqClock(Date.now()-a.startedAt)}</span>
        </button>
        <button type="button" class="feature-action-primary" data-qq-action="complete" data-qq-id="${a.id}" aria-label="Complete ${esc(a.title)}">Complete</button>
      </div>
    </div>`;
  }
  const waiting=qqWaitingCount();
  return `<div class="home-todaygroup-block home-todaygroup-quickquest qq-home">
    ${header}
    <div class="hw-row">
      <img class="hw-row-icon" src="${icon}" alt="">
      <div class="hw-row-body"><span class="hw-row-title muted">Nothing active</span><small class="hw-row-sub">${waiting?`${waiting} waiting`:'Nothing waiting'}</small></div>
    </div>
    <div class="qq-home-actions"><button type="button" class="feature-action-primary" data-qq-action="goto">View Quick Quests</button><button type="button" class="feature-action-primary" data-qq-action="add">+ Quick Add</button></div>
  </div>`;
}

/* ---------- modals (the shared Quests glass dialog) ---------- */
function qqMoreOptionsHTML(){
  return `<div id="qqMore" hidden>
    <div class="q-field-row">
      <div class="q-field"><label class="q-label" for="qqDate">Date</label><input class="q-input" type="date" id="qqDate"></div>
      <div class="q-field"><label class="q-label" for="qqTime">Time</label><input class="q-input" type="time" id="qqTime"></div>
    </div>
    <div class="q-field"><label class="q-label" for="qqNotes">Notes</label><textarea class="q-input" id="qqNotes" rows="2" maxlength="500" placeholder="Optional"></textarea></div>
    <label class="q-check-row"><span>Also save as a reusable Quick Quest</span><input type="checkbox" id="qqSavePreset"></label>
  </div>`;
}
function quickQuestAddModal(){
  questsModal({category:'quick',title:'Quick Add',size:'sm',
    body:`<div class="q-field"><label class="q-label" for="qqTitle">What needs doing?</label><input class="q-input" id="qqTitle" maxlength="120" placeholder="e.g. Pick up parcel" autocomplete="off" enterkeyhint="done"></div>
      <div class="q-field"><span class="q-label" id="qqWhenLbl">When</span>${questsChoiceHTML('qqWhen',[{value:'today',label:'Today'},{value:'tomorrow',label:'Tomorrow'}],'today','qqWhenLbl')}</div>
      <button type="button" class="q-btn q-btn--ghost q-btn--sm qq-more-toggle" id="qqMoreToggle" aria-expanded="false" aria-controls="qqMore">More options</button>
      ${qqMoreOptionsHTML()}`,
    actions:`<button type="button" class="q-btn" data-q-close>Cancel</button><button type="button" class="q-btn q-btn--primary" id="qqAddBtn">Add</button>`,
    focus:'#qqTitle'});
  const root=modalRoot,more=root.querySelector('#qqMore'),tog=root.querySelector('#qqMoreToggle'),dateEl=root.querySelector('#qqDate');
  tog.onclick=()=>{const open=more.hidden;more.hidden=!open;tog.setAttribute('aria-expanded',String(open));tog.textContent=open?'Fewer options':'More options'};
  root.querySelectorAll('input[name="qqWhen"]').forEach(r=>r.onchange=()=>{dateEl.value=''});
  const submit=()=>{
    const title=root.querySelector('#qqTitle').value.trim();
    if(!title){toast('Say what needs doing.','error');root.querySelector('#qqTitle').focus();return}
    const pick=questsChoiceValue('qqWhen')||'today';
    let date=pick==='tomorrow'?addDays(todayISO(),1):todayISO();
    const typed=dateEl.value;
    if(typed){if(!qqIsDate(typed)){toast('Pick a valid date.','error');return}date=typed}
    const time=root.querySelector('#qqTime').value,notes=root.querySelector('#qqNotes').value;
    const item=quickQuestAdd({title,scheduledDate:date,scheduledTime:time,notes});
    if(!item)return;
    if(root.querySelector('#qqSavePreset').checked)quickQuestPresetSave(title,notes);
    closeModal();
    toast(`Added: ${item.title}${date===todayISO()?'':` · ${qqDayLabel(date)}`}`,'success');
    render();
  };
  root.querySelector('#qqAddBtn').onclick=submit;
  root.querySelector('#qqTitle').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit()}};
}
function quickQuestEditModal(id){
  const item=qqById(id);
  if(!item||item.status!=='queued')return;
  questsModal({category:'quick',title:'Edit Quick Quest',size:'sm',
    body:`<div class="q-field"><label class="q-label" for="qqETitle">What needs doing?</label><input class="q-input" id="qqETitle" maxlength="120" value="${esc(item.title)}" autocomplete="off"></div>
      <div class="q-field-row">
        <div class="q-field"><label class="q-label" for="qqEDate">Date</label><input class="q-input" type="date" id="qqEDate" value="${esc(item.scheduledDate)}"></div>
        <div class="q-field"><label class="q-label" for="qqETime">Time</label><input class="q-input" type="time" id="qqETime" value="${esc(item.scheduledTime||'')}"></div>
      </div>
      <div class="q-field"><label class="q-label" for="qqENotes">Notes</label><textarea class="q-input" id="qqENotes" rows="3" maxlength="500">${esc(item.notes)}</textarea></div>`,
    actions:`<button type="button" class="q-btn" data-q-close>Cancel</button><button type="button" class="q-btn q-btn--primary" id="qqESave">Save</button>`,
    focus:'#qqETitle'});
  modalRoot.querySelector('#qqESave').onclick=()=>{
    const title=modalRoot.querySelector('#qqETitle').value.trim(),date=modalRoot.querySelector('#qqEDate').value;
    if(!title)return toast('Give the Quick Quest a name.','error');
    if(!qqIsDate(date))return toast('Pick a valid date.','error');
    quickQuestEdit(item.id,{title,scheduledDate:date,scheduledTime:modalRoot.querySelector('#qqETime').value,notes:modalRoot.querySelector('#qqENotes').value});
    closeModal();toast('Quick Quest updated.','success');render();
  };
}
function quickQuestRescheduleModal(id){
  const item=qqById(id);
  if(!item||item.status!=='queued')return;
  questsModal({category:'quick',title:'Reschedule',sub:item.title,size:'sm',
    body:`<div class="q-field"><span class="q-label" id="qqRWhenLbl">Move to</span>${questsChoiceHTML('qqRWhen',[{value:'today',label:'Today'},{value:'tomorrow',label:'Tomorrow'}],'today','qqRWhenLbl')}</div>
      <div class="q-field"><label class="q-label" for="qqRDate">Or pick a date</label><input class="q-input" type="date" id="qqRDate"></div>`,
    actions:`<button type="button" class="q-btn" data-q-close>Cancel</button><button type="button" class="q-btn q-btn--primary" id="qqRSave">Reschedule</button>`,
    focus:'input[name="qqRWhen"]:checked'});
  modalRoot.querySelectorAll('input[name="qqRWhen"]').forEach(r=>r.onchange=()=>{modalRoot.querySelector('#qqRDate').value=''});
  modalRoot.querySelector('#qqRSave').onclick=()=>{
    const typed=modalRoot.querySelector('#qqRDate').value;
    let date=questsChoiceValue('qqRWhen')==='tomorrow'?addDays(todayISO(),1):todayISO();
    if(typed){if(!qqIsDate(typed))return toast('Pick a valid date.','error');date=typed}
    quickQuestReschedule(item.id,date);
    closeModal();toast(`Moved to ${qqDayLabel(date)}.`,'success');render();
  };
}
function quickQuestConflictModal(pendingId){
  const cur=qqActive(),next=qqById(pendingId);
  if(!cur||!next)return;
  questsModal({category:'quick',title:'Quick Quest already active',size:'sm',role:'alertdialog',describedBy:'qqConflictText',
    body:`<p class="qq-conflict__name">${esc(cur.title)}</p>
      <p class="qq-conflict__time">${esc(qqDuration(qqElapsed(cur)))}</p>
      <p class="q-modal__text" id="qqConflictText">Starting another Quick Quest requires resolving this one.</p>`,
    actions:`<button type="button" class="q-btn" data-q-close>Go back</button><button type="button" class="q-btn q-btn--primary" data-qq-action="conflict-complete" data-qq-id="${esc(next.id)}">Complete current</button><button type="button" class="q-btn q-btn--danger" data-qq-action="conflict-cancel" data-qq-id="${esc(next.id)}">Cancel current</button>`,
    focus:'.q-modal__foot [data-q-close]'});
}
function quickQuestDetailModal(id){
  const item=qqById(id);
  if(!item)return;
  const when=`${qqDayLabel(item.scheduledDate)}${item.scheduledTime?` · ${item.scheduledTime}`:''}`;
  const notes=item.notes?`<div class="qq-notes"><span class="q-label">Notes</span><p>${esc(item.notes)}</p></div>`:'';
  const idAttr=`data-qq-id="${item.id}"`;
  let sub=when,body='',actions='';
  if(item.status==='queued'){
    const late=item.scheduledDate<todayISO();
    body=`<p class="qq-status"><span class="q-chip ${late?'q-chip--warn':'q-chip--plain'}">Queued${late?` · ${esc(qqDueLabel(item))}`:''}</span></p>${notes}`;
    actions=`<button type="button" class="q-btn q-btn--danger q-btn--sm" data-qq-action="delete" ${idAttr}>Delete</button><button type="button" class="q-btn" data-qq-action="edit" ${idAttr}>Edit</button><button type="button" class="q-btn q-btn--primary" data-qq-action="start" ${idAttr}>Start</button>`;
  }else if(item.status==='active'){
    sub='';
    body=`<div class="qq-timer" role="timer" aria-label="Elapsed time" data-qq-elapsed="${item.id}">${qqClock(Date.now()-item.startedAt)}</div><p class="qq-status"><span class="q-chip q-chip--accent">Active</span> <span class="q-meta">Started ${qqTimeOfDay(item.startedAt)}</span></p>${notes}`;
    actions=`<button type="button" class="q-btn q-btn--danger" data-qq-action="cancel" ${idAttr}>Cancel quest</button><button type="button" class="q-btn q-btn--primary" data-qq-action="complete" ${idAttr}>Complete</button>`;
  }else if(item.status==='completed'){
    const ms=qqElapsed(item);
    sub=`Completed ${qqDayLabel(localISO(new Date(item.completedAt)))}`;
    body=`<p class="qq-status"><span class="q-chip q-chip--good">✓ Complete</span></p>
      ${ms==null?`<p class="qq-times">Completed at ${qqTimeOfDay(item.completedAt)}</p>`:`<p class="qq-times">${qqTimeOfDay(item.startedAt)} → ${qqTimeOfDay(item.completedAt)}</p><p class="qq-times qq-times--long">${esc(qqMinutesLong(ms))}</p>`}${notes}`;
    const saved=ensureQuickQuestsState().presets.some(p=>p.title.toLowerCase()===item.title.toLowerCase());
    actions=`${saved?'':`<button type="button" class="q-btn" data-qq-action="save-preset" ${idAttr}>Save as preset</button>`}<button type="button" class="q-btn q-btn--primary" data-qq-action="repeat" ${idAttr}>Repeat</button>`;
  }else{
    sub=`Cancelled ${qqDayLabel(localISO(new Date(item.cancelledAt)))}`;
    body=`<p class="qq-status"><span class="q-chip q-chip--plain">Cancelled</span></p>${notes}`;
    actions=`<button type="button" class="q-btn q-btn--primary" data-qq-action="repeat" ${idAttr}>Repeat</button>`;
  }
  questsModal({category:'quick',title:item.title,sub,size:'sm',body,actions});
  qqEnsureTicker();
}

/* ---------- flows (what a tap does) ---------- */
function qqCompletionMessage(r){
  const dur=r.elapsedMs==null?'':` · ${qqDuration(r.elapsedMs)}`;
  return `Quest complete: ${r.item.title}${dur}`;
}
function qqCompleteFlow(id,startNext){
  const r=quickQuestComplete(id);
  if(!r.ok)return r;
  closeModal();
  let msg=qqCompletionMessage(r);
  if(startNext){
    const s=quickQuestStart(startNext);
    if(s.ok)msg+=` — now timing ${s.item.title}`;
  }
  toast(msg,'success');
  render();
  return r;
}
function qqStartFlow(id){
  const r=quickQuestStart(id);
  if(r.ok){closeModal();toast(`Started: ${r.item.title}`,'info');render();return}
  if(r.reason==='active-exists')quickQuestConflictModal(id);
}
function qqCancelFlow(id,startNext){
  const r=quickQuestCancel(id);
  if(!r.ok)return r;
  closeModal();
  let msg=`Cancelled: ${r.item.title}`;
  if(startNext){const s=quickQuestStart(startNext);if(s.ok)msg+=` — now timing ${s.item.title}`}
  toast(msg,'info');
  render();
  return r;
}
function qqHandle(action,id){
  const item=id?qqById(id):null;
  switch(action){
    case 'add':return quickQuestAddModal();
    case 'goto':qpView='quick';return setPage('quests');
    case 'open':return item&&quickQuestDetailModal(item.id);
    case 'start':return item&&qqStartFlow(item.id);
    case 'complete':return item&&qqCompleteFlow(item.id);
    case 'edit':return item&&quickQuestEditModal(item.id);
    case 'reschedule':return item&&quickQuestRescheduleModal(item.id);
    case 'cancel':
      if(!item)return;
      return questsConfirm({category:'quick',title:'Cancel Quick Quest?',message:`"${item.title}" will be cancelled and will not count as completed.`,confirmLabel:'Cancel quest',cancelLabel:'Keep going',danger:true},()=>qqCancelFlow(item.id));
    case 'delete':
      if(!item)return;
      return questsConfirm({category:'quick',title:'Delete Quick Quest?',message:`"${item.title}" will be removed.`,confirmLabel:'Delete',cancelLabel:'Keep it',danger:true},()=>{quickQuestDelete(item.id);toast('Quick Quest deleted.','info');render()});
    case 'repeat':{
      if(!item)return;
      const n=quickQuestRepeat(item.id);
      if(n){closeModal();toast(`Added: ${n.title}`,'success');render()}
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
    case 'preset-use':{
      const n=quickQuestUsePreset(id);
      if(n){toast(`Added to Today: ${n.title}`,'success');render()}
      return;
    }
    case 'preset-remove':{
      const p=ensureQuickQuestsState().presets.find(x=>x.id===id);
      if(!p)return;
      return questsConfirm({category:'quick',title:'Remove saved Quick Quest?',message:`"${p.title}" will no longer be offered. Quick Quests already created from it are not affected.`,confirmLabel:'Remove',cancelLabel:'Keep it',danger:true},()=>{quickQuestPresetRemove(p.id);toast('Removed.','info');render()});
    }
    case 'conflict-complete':return qqCompleteFlow(qqActive()&&qqActive().id,id);
    case 'conflict-cancel':return qqCancelFlow(qqActive()&&qqActive().id,id);
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
   runs before (and can replace) a row's own click handler such as Home's
   schedule cards, which otherwise jump to the Log ---------- */
document.addEventListener('click',e=>{
  const el=e.target.closest&&e.target.closest('[data-qq-action],[data-source-type="quickQuest"]');
  if(!el)return;
  const action=el.dataset.qqAction||'open',id=el.dataset.qqId||el.dataset.sourceId;
  e.preventDefault();e.stopPropagation();
  qqHandle(action,id);
},true);
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const el=e.target.closest&&e.target.closest('[data-source-type="quickQuest"][role="button"]');
  if(!el||e.target!==el)return;
  e.preventDefault();e.stopPropagation();
  qqHandle('open',el.dataset.sourceId);
},true);
/* schedule rows are plain divs owned by their consumers; give the Quick
   Quest ones button semantics after each render */
function qqDecorateRows(){
  document.querySelectorAll('[data-source-type="quickQuest"]').forEach(el=>{
    if(el.getAttribute('role')==='button')return;
    el.setAttribute('role','button');el.setAttribute('tabindex','0');
    el.setAttribute('aria-label',`Quick Quest: ${el.querySelector('b,.hw-row-title,strong')?.textContent||'open details'}`);
  });
}
function qqAfterRender(){qqDecorateRows();qqEnsureTicker();qqNotifyMigration()}
const qqPrevRenderHome=renderHome;
renderHome=function(){qqPrevRenderHome();qqAfterRender()};
const qqPrevRenderTasks=renderTasks;
renderTasks=function(){qqPrevRenderTasks();qqAfterRender()};
const qqPrevRenderSideQuests=renderSideQuests;
renderSideQuests=function(){qqPrevRenderSideQuests();qqAfterRender()};
