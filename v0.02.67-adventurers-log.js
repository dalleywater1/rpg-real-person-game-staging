/* ==========================================================================
   ADVENTURER'S LOG: the Log-owned store (Lyra ruling D3, 2026-10-03;
   docs/QUESTS_LOG_BUILD_DESIGN_20261003.md sections 1.1, 2, 3)
   ==========================================================================
   The Log owns ordinary real-life items and ORGANISATION IN TIME. It never owns
   a quest, a Training session or a habit: when one of those is scheduled the Log
   keeps a REFERENCE (a ScheduleEntry: sourceKind + sourceId + when), and the
   title, completion and rewards stay with the source system.

   state.adventurersLog = {
     version, items:[LogItem], schedule:[ScheduleEntry], top3:[{kind,id}],
     notes:[], templates:[], recurring:[], migrations:{}
   }
   (notes / templates / recurring are normalised here and given behaviour in the
   later Log milestones; migrations holds informational "has run" markers only,
   idempotency lives in the data itself.)

   Milestone 4a (store layer of Log core B) gives templates and recurring a behaviour: saved templates (never recurrence), Duplicate, weekly / daily
   recurring rules whose occurrences are VIRTUAL (computed on read, stored as an item only when the player touches one, keyed by recurrenceId + '@' + date),
   and the pure calendar helpers (six-month bounds, week, month grid, shift, day summary). There is still no UI here: the M4b screens call this API.

   Rules this file keeps:
   - ensureAdventurersLogState() normalises lazily, once per loaded state object,
     and never calls save() (it runs inside save()'s hooks). Every mutator below
     saves itself, like the Quick Quest API.
   - An ordinary item awards nothing and never becomes a quest.
   - Top 3 is a designation: at most three references, never a copy.
   - A ScheduleEntry stores no title, objectives, reward or completion; those are
     resolved from the source at read time (LOG_SOURCE_RESOLVERS), so there is
     exactly one completion state.
   - Quick Quests are NOT scheduled here (D1): the Log schedules Side Quests and
     Main Quest milestones the player explicitly chooses.
   ========================================================================== */

const LOG_BUCKETS=['unscheduled','soon','later'];
const LOG_TOP3_MAX=3;
const LOG_UNDO_MAX=20;
const LOG_TOMBSTONE_DAYS=90;
const LOG_DEFAULT_MINUTES=30;                  /* assumed length of a timed item with no duration, for the NEXT rule only */
/* Milestone 4a (templates, recurring rules, calendar helpers) */
const LOG_TEMPLATE_NAME_MAX=60;                /* a template's name: short enough to be a button label */
const LOG_RECENT_TEMPLATES=5;                  /* default length of the Quick Add drawer's Recent list */
const LOG_RC_FREQS=['daily','weekly'];         /* monthly / interval / count rules are deliberately NOT built: Lyra rules them first */
const LOG_RC_EXCEPTIONS_MAX=400;               /* skipped days kept per rule; past the cap the oldest go */
const LOG_OCC_MAX=200;                         /* default cap of recurringOccurrencesBetween */
const LOG_OCC_HARD_MAX=2000;                   /* the most a caller can ask it for */
const LOG_HORIZON_MONTHS=6;                    /* the calendar and the occurrence expansion reach six calendar months either side of today */
const LOG_DAY_KINDS=['activity','logItem','questRef','mainQuest'];   /* the feed kinds a calendar day counts (Personal Growth habits are not counted) */
const LOG_DQ_GENERIC_TITLES=['Complete Today’s Main Quest','Complete Main Quest'];   /* the singular Daily Quest's placeholder titles: the pair app.js blanks on load and hands to sharedHomeItemTitle */

/* ---------- small helpers ---------- */
/* a real calendar date: dateFromISO() rolls '2026-11-31' over to December, so the round trip must give the same string back. Only a STRING is a date:
   String() over an array or an object that prints as one would let it through, and it would then be stored as an array */
function logIsDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(dateFromISO(s).getTime())&&localISO(dateFromISO(s))===s}
function logTimeToMin(s){const m=typeof s==='string'?/^([01]\d|2[0-3]):([0-5]\d)$/.exec(s):null;return m?Number(m[1])*60+Number(m[2]):null}   /* strict HH:MM, anything else (a non-string too) is "untimed" */
function logClean(s,max){return String(s==null?'':s).trim().slice(0,max)}
function logNum(v){const n=Number(v);return Number.isFinite(n)&&n>0?Math.round(n):null}
function logDur(v){const n=logNum(v);return n==null?null:Math.min(n,1440)}                /* minutes, never longer than a day: an absurd length would keep a timed row NEXT all day */
/* the one resolver lookup: an own property only, so a kind like 'constructor' is simply unknown */
function logResolver(kind){return Object.prototype.hasOwnProperty.call(LOG_SOURCE_RESOLVERS,kind)?LOG_SOURCE_RESOLVERS[kind]:null}

/* ---------- record shapes ---------- */
function logItemShape(raw){
  const r=(raw&&typeof raw==='object')?raw:{};
  const status=r.status==='done'?'done':'open';
  const date=logIsDate(r.date)?r.date:null;
  const item={
    id:r.id?String(r.id):newStringId('li'),
    title:logClean(r.title,160)||'Untitled',
    notes:logClean(r.notes,2000),
    status,
    date,
    time:date&&logTimeToMin(r.time)!=null?r.time:null,
    durationMin:logDur(r.durationMin),
    bucket:LOG_BUCKETS.includes(r.bucket)?r.bucket:'unscheduled',
    category:r.category?logClean(r.category,60):null,
    reminder:null,                              /* reserved: wired when a Log source is registered with the notification engine */
    createdAt:logNum(r.createdAt)||Date.now(),
    updatedAt:logNum(r.updatedAt)||logNum(r.createdAt)||Date.now(),
    completedAt:status==='done'?(logNum(r.completedAt)||Date.now()):null,
    origin:['manual','quick-add','note','template','recurrence','legacy-dailyquest','legacy-quickquest'].includes(r.origin)?r.origin:'manual',
    legacy:(r.legacy&&typeof r.legacy==='object')?r.legacy:null,
    templateId:r.templateId?String(r.templateId):null,
    recurrenceId:r.recurrenceId?String(r.recurrenceId):null,
    occurrenceKey:r.occurrenceKey?String(r.occurrenceKey):null
  };
  if(item.date)item.bucket='unscheduled';       /* bucket is only meaningful while the item has no date */
  return item;
}
const LOG_SOURCE_KINDS=['sideQuest','mainQuestMilestone'];
function logEntryShape(raw){
  const r=(raw&&typeof raw==='object')?raw:{};
  return {
    scheduleId:r.scheduleId?String(r.scheduleId):newStringId('sc'),
    sourceSystem:'quests',
    /* a kind this build does not know (written by a newer build) is kept verbatim and simply not shown, never re-pointed at a Side Quest */
    sourceKind:typeof r.sourceKind==='string'&&/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(r.sourceKind)?r.sourceKind:'sideQuest',
    sourceId:String(r.sourceId==null?'':r.sourceId),
    questId:String(r.questId!=null?r.questId:(r.sourceId==null?'':r.sourceId)),
    startDate:logIsDate(r.startDate)?r.startDate:todayISO(),
    startTime:logTimeToMin(r.startTime)!=null?r.startTime:null,
    durationMin:logDur(r.durationMin),
    recurrence:null,
    schedulingNotes:logClean(r.schedulingNotes,500),
    schedulingState:r.schedulingState==='removed'?'removed':'scheduled',
    createdAt:logNum(r.createdAt)||Date.now(),
    updatedAt:logNum(r.updatedAt)||Date.now(),
    removedAt:r.schedulingState==='removed'?(logNum(r.removedAt)||Date.now()):null
  };
}
function logNoteShape(raw){
  const r=(raw&&typeof raw==='object')?raw:{};
  return {id:r.id?String(r.id):newStringId('ln'),text:logClean(r.text,2000),createdAt:logNum(r.createdAt)||Date.now(),updatedAt:logNum(r.updatedAt)||Date.now(),origin:r.origin==='brain-dump'?'brain-dump':'manual'};
}

/* ---------- templates and recurring rules: record shapes (Milestone 4a) ---------- */
/* text a person typed: a string or a number, never an object (it would become "[object Object]") */
function logText(v,max){return typeof v==='string'||typeof v==='number'?logClean(v,max):''}
function logTimeOrNull(v){return typeof v==='string'&&logTimeToMin(v)!=null?v:null}
function logDateOrNull(v){return typeof v==='string'&&logIsDate(v)?v:null}
/* a template name: trimmed, at most 60 characters, and trimmed again so the cut never leaves a trailing space */
function logTplName(v){return logText(v,LOG_TEMPLATE_NAME_MAX).trim()}
/* 0=MONDAY ... 6=SUNDAY (this app's week starts on Monday): whole numbers only, deduped, sorted */
function logWeekdays(v){
  const s=new Set();
  (Array.isArray(v)?v:[]).forEach(x=>{const n=typeof x==='number'?x:(typeof x==='string'&&/^\s*[0-6]\s*$/.test(x)?Number(x):NaN);if(Number.isInteger(n)&&n>=0&&n<=6)s.add(n)});
  return [...s].sort((a,b)=>a-b);
}
/* real calendar dates only, unique, oldest first. Past the cap the OLDEST go: a recent skipped day matters more than an old one */
function logDateList(v){
  const s=new Set();
  (Array.isArray(v)?v:[]).forEach(x=>{if(logDateOrNull(x))s.add(x)});
  const a=[...s].sort();
  return a.length>LOG_RC_EXCEPTIONS_MAX?a.slice(a.length-LOG_RC_EXCEPTIONS_MAX):a;
}
/* LogTemplate: a saved shape for something the player adds often. It is NOT recurrence (a template never creates anything by itself).
   lastUsedAt (null until used) is what the Quick Add drawer's Recent list is derived from. Returns null when there is no name. */
function logTemplateShape(raw){
  const r=(raw&&typeof raw==='object')?raw:{};
  const name=logTplName(r.name);
  if(!name)return null;
  const createdAt=logNum(r.createdAt)||Date.now();
  return {
    id:r.id?String(r.id):newStringId('lt'),
    name,
    category:logText(r.category,60)||null,
    durationMin:logDur(r.durationMin),
    usualTime:logTimeOrNull(r.usualTime),
    notes:logText(r.notes,2000),
    reminder:null,                              /* reserved, like a LogItem's */
    pinned:r.pinned===true,
    createdAt,
    updatedAt:logNum(r.updatedAt)||createdAt,
    lastUsedAt:logNum(r.lastUsedAt)||null
  };
}
/* RecurringEvent: weekly or daily only. A rule needs a title, a known freq, a real startDate and (weekly) at least one weekday, or it is
   not a rule at all (null). An unknown field is dropped. until before startDate means "no end". exceptions are the skipped days. */
function logRecurringShape(raw){
  const r=(raw&&typeof raw==='object')?raw:{};
  const title=logText(r.title,160),freq=LOG_RC_FREQS.includes(r.freq)?r.freq:null,startDate=logDateOrNull(r.startDate);
  if(!title||!freq||!startDate)return null;
  const byWeekday=freq==='weekly'?logWeekdays(r.byWeekday):[];
  if(freq==='weekly'&&!byWeekday.length)return null;
  const createdAt=logNum(r.createdAt)||Date.now(),until=logDateOrNull(r.until);
  return {
    id:r.id?String(r.id):newStringId('rc'),
    title,
    notes:logText(r.notes,2000),
    category:logText(r.category,60)||null,
    freq,
    byWeekday,
    time:logTimeOrNull(r.time),
    durationMin:logDur(r.durationMin),
    startDate,
    until:until&&until>=startDate?until:null,
    exceptions:logDateList(r.exceptions),
    createdAt,
    updatedAt:logNum(r.updatedAt)||createdAt
  };
}
/* The two containers' normalisers, used by ensureAdventurersLogState(). They never throw on junk and never save. {list, changed}: changed
   is true when something was dropped, re-id'd or renamed, so ensure() can write the repair out through its one deferred save.
   A template that repeats another's name (case-insensitively) is RENAMED ("Name (2)"), never dropped: it is something the player made. */
function logNormTemplates(raw){
  const src=Array.isArray(raw)?raw:[],ids=new Set(),names=new Set(),nextSuffix=new Map(),out=[];let changed=!Array.isArray(raw);
  src.forEach(x=>{
    const t=logTemplateShape(x);
    if(!t){changed=true;return}
    if(!(x.id!=null&&x.id!==''))changed=true;
    while(ids.has(t.id)){t.id=newStringId('lt',ids);changed=true}
    ids.add(t.id);
    /* the first free "(k)" only ever moves up (a name is never removed), so each base name remembers where it got to: 20000 copies of one name take
       20000 steps, not 200 million. The names that come out are exactly the ones a search from (2) every time would give. */
    let n=t.name;const base=n.toLowerCase();
    if(names.has(base)){let k=nextSuffix.get(base)||2;do{const suf=' ('+k+')';n=t.name.slice(0,LOG_TEMPLATE_NAME_MAX-suf.length).trim()+suf;k++}while(names.has(n.toLowerCase()));nextSuffix.set(base,k);changed=true}
    t.name=n;names.add(n.toLowerCase());
    out.push(t);
  });
  return {list:out,changed};
}
function logNormRecurring(raw){
  const src=Array.isArray(raw)?raw:[],ids=new Set(),out=[];let changed=!Array.isArray(raw);
  src.forEach(x=>{
    const r=logRecurringShape(x);
    if(!r){changed=true;return}
    if(!(x.id!=null&&x.id!==''))changed=true;
    while(ids.has(r.id)){r.id=newStringId('rc',ids);changed=true}
    ids.add(r.id);out.push(r);
  });
  return {list:out,changed};
}

/* ---------- state ---------- */
function logDomainDefault(){return {version:1,items:[],schedule:[],top3:[],notes:[],templates:[],recurring:[],migrations:{}}}
const logNormalized=new WeakSet();
function ensureAdventurersLogState(){
  if(!state.adventurersLog||typeof state.adventurersLog!=='object'||Array.isArray(state.adventurersLog))state.adventurersLog=logDomainDefault();
  const L=state.adventurersLog;
  if(logNormalized.has(L))return L;
  L.version=1;
  const ids=new Set();let repaired=false;
  const uniq=x=>{while(ids.has(x.id)){x.id=newStringId('li',ids);repaired=true}ids.add(x.id);return x};
  const n0=[L.items,L.schedule,L.top3].map(a=>Array.isArray(a)?a.length:0);
  L.items=(Array.isArray(L.items)?L.items:[]).filter(x=>x&&typeof x==='object').map(logItemShape).map(uniq);
  /* One entry per source (logScheduleSource is idempotent, so a second one can only come from hand-made or damaged data): keep the
     live one, else the most recently updated. Ids are unique too. Tombstones past their 90 days hold no user history and are dropped. */
  const cutoff=Date.now()-LOG_TOMBSTONE_DAYS*86400000;
  const shaped=(Array.isArray(L.schedule)?L.schedule:[]).filter(x=>x&&typeof x==='object'&&String(x.sourceId||'')).map(logEntryShape)
    .filter(e=>!(e.schedulingState==='removed'&&e.removedAt&&e.removedAt<cutoff));
  const bySource=new Map(),sIds=new Set();
  shaped.forEach(e=>{
    const k=e.sourceKind+'\u0000'+e.sourceId,cur=bySource.get(k);
    if(!cur||(cur.schedulingState!=='scheduled'&&e.schedulingState==='scheduled')||(cur.schedulingState===e.schedulingState&&e.updatedAt>cur.updatedAt))bySource.set(k,e);
  });
  L.schedule=shaped.filter(e=>bySource.get(e.sourceKind+'\u0000'+e.sourceId)===e).filter(e=>{if(sIds.has(e.scheduleId))return false;sIds.add(e.scheduleId);return true});
  L.notes=(Array.isArray(L.notes)?L.notes:[]).filter(x=>x&&typeof x==='object').map(logNoteShape);
  /* templates and recurring rules (M4a): junk dropped, ids unique, shapes enforced, a repeated template name renamed; anything that changed is written out by the one deferred save below */
  const tp=logNormTemplates(L.templates),rc=logNormRecurring(L.recurring);
  L.templates=tp.list;L.recurring=rc.list;
  if(tp.changed||rc.changed)repaired=true;
  L.migrations=(L.migrations&&typeof L.migrations==='object'&&!Array.isArray(L.migrations))?L.migrations:{};
  /* The old Brain Dump is copied ONCE into notes (the original array is left untouched, never read again). Each copy has a
     deterministic id, so even a lost marker cannot duplicate a note. */
  if(!L.migrations.brainDump){
    const bd=Array.isArray(state.brainDump)?state.brainDump:[],have=new Set(L.notes.map(x=>x.id)),thisPass=new Set();
    bd.forEach((x,i)=>{
      if(!x||typeof x!=='object')return;
      const text=logClean(x.text,2000);
      if(!text)return;
      /* An entry with no id, or one whose id REPEATS inside the Brain Dump (uid() can collide), gets a position-based id: still deterministic,
         never skipped. An id that is already among the notes was copied by an earlier pass and is left alone. */
      let id='ln_bd_'+(x.id==null||x.id===''?'i'+i:String(x.id));
      if(thisPass.has(id))id='ln_bd_i'+i;
      thisPass.add(id);
      if(have.has(id))return;
      have.add(id);
      const at=Number(x.id)>1e12?Number(x.id):Date.now();
      L.notes.push(logNoteShape({id,text,origin:'brain-dump',createdAt:at,updatedAt:at}));
    });
    L.migrations.brainDump={at:Date.now(),count:bd.length};   /* no persist of its own: the copy is idempotent by id and rides out with the next ordinary save */
  }
  if(logImportLegacyQuick(L)>0)repaired=true;
  if(logImportLegacyDaily(L)>0)repaired=true;
  const live=new Set(L.items.map(x=>'item:'+x.id).concat(L.schedule.filter(e=>e.schedulingState==='scheduled').map(e=>'schedule:'+e.scheduleId)));
  const seen=new Set();
  L.top3=(Array.isArray(L.top3)?L.top3:[]).filter(t=>t&&(t.kind==='item'||t.kind==='schedule')&&live.has(t.kind+':'+t.id)&&!seen.has(t.kind+':'+t.id)&&seen.add(t.kind+':'+t.id)).slice(0,LOG_TOP3_MAX).map(t=>({kind:t.kind,id:String(t.id)}));
  logNormalized.add(L);
  /* a repair that shrank or renamed something is written out by one deferred save (ensure itself must never save) */
  if(repaired||L.items.length!==n0[0]||L.schedule.length!==n0[1]||L.top3.length!==n0[2])logSchedulePersist();
  return L;
}
/* Quick Quests were rebuilt as do-now actions (Lyra D2), so a Quick Quest that was still waiting (queued, possibly with a day and time) is
   now an ordinary Log item. The OWNER stages every such record, untouched, in state.quickQuests.legacyQueued (v0.02.33); the Log imports
   each one here. Per item and idempotent with NO one-shot gate: the item id is deterministic (li_q_<quick quest id>), and the ids already
   imported are remembered in migrations.quickQuests.imported, so a deleted item is never brought back and a lost marker cannot duplicate.
   Date and time are kept (a past day shows in Overdue); nothing is rewritten or deleted in the owner. A running (active) quest is left alone.
   The owner's ensure never calls into the Log, so there is no cycle. Returns how many were imported. */
function logImportLegacyQuick(L){
  let owner=null;
  try{owner=typeof ensureQuickQuestsState==='function'?ensureQuickQuestsState():(state.quickQuests||null)}catch(e){owner=state.quickQuests||null}
  const staged=owner&&Array.isArray(owner.legacyQueued)?owner.legacyQueued:[];
  const mig=(L.migrations.quickQuests&&typeof L.migrations.quickQuests==='object'&&!Array.isArray(L.migrations.quickQuests))?L.migrations.quickQuests:(L.migrations.quickQuests={at:null,count:0,imported:[]});
  mig.imported=Array.isArray(mig.imported)?mig.imported.map(String):[];
  const have=new Set(L.items.map(x=>x.id)),done=new Set(mig.imported);
  let n=0;
  staged.forEach(q=>{
    if(!q||typeof q!=='object'||q.id==null||q.id==='')return;
    const qid=String(q.id),id='li_q_'+qid;
    if(have.has(id)){if(!done.has(qid)){mig.imported.push(qid);done.add(qid)}return}   /* already here (a lost record): note it, so a later delete still sticks */
    if(done.has(qid))return;
    const date=logIsDate(q.scheduledDate)?q.scheduledDate:null,time=date&&logTimeToMin(q.scheduledTime)!=null?q.scheduledTime:null;
    const at=logNum(q.createdAt)||Date.now();
    L.items.push(logItemShape({id,title:q.title,notes:q.notes,date,time,bucket:'unscheduled',status:'open',origin:'legacy-quickquest',createdAt:at,updatedAt:at,
      legacy:{type:'quickQuest',id:qid,via:(q.migratedFrom&&typeof q.migratedFrom==='object')?JSON.parse(JSON.stringify(q.migratedFrom)):null,scheduledDate:q.scheduledDate||null,scheduledTime:q.scheduledTime||null}}));
    mig.imported.push(qid);done.add(qid);have.add(id);n++;
  });
  if(n||!mig.at){mig.at=mig.at||Date.now();mig.count=(Number(mig.count)||0)+n}
  return n;
}
/* Daily Quest retirement (Lyra D4, 2026-10-03): an UNFINISHED singular Daily Quest (state.quest) becomes an ordinary Log item tagged as a legacy migration, with no
   reward promise: nothing is copied from rewardXP / rewardGold / lootBox (a LogItem has no reward field at all) and the Log never pays. state.quest is a legacy
   container, read here through guarded raw reads; its own code never calls into the Log, so there is no cycle. It is not rewritten, only marked retiredAt.
   Unfinished = a real title (not the placeholder pair), not rewarded (migrate() folds daily.questDone into it; read here too, in case a live quest disagrees), and
   no retiredAt. Per item and idempotent with NO one-shot gate, like the Quick Quest import: the id is deterministic (li_dq_<quest id>) and the quest ids already
   imported are remembered in migrations.dailyQuest.imported, so a deleted item is never brought back and a lost record cannot duplicate it; quest.retiredAt is a
   second, independent record of the same fact (either one alone stops a deleted item returning). The date is kept when it is a real day (a stale one shows in
   Overdue, a future one in Coming up), else the item is undated; the free-text duration rides in the notes.
   retiredAt is stamped on EVERY quest object this looks at (imported, finished, empty or placeholder), so "retiredAt" means "closed" for any reader and
   completeMainQuest() needs only that one test. A finished quest is just frozen history and is never imported. The stamp rides out with the next ordinary
   save; an import itself goes out through ensure()'s one deferred save. Returns how many were imported. */
function logImportLegacyDaily(L){
  const q=(typeof state!=='undefined'&&state&&state.quest&&typeof state.quest==='object'&&!Array.isArray(state.quest))?state.quest:null;
  const mig=(L.migrations.dailyQuest&&typeof L.migrations.dailyQuest==='object'&&!Array.isArray(L.migrations.dailyQuest))?L.migrations.dailyQuest:(L.migrations.dailyQuest={at:null,count:0,imported:[]});
  mig.imported=Array.isArray(mig.imported)?mig.imported.map(String):[];
  let n=0;
  if(q&&q.id!=null&&q.id!==''){
    const qid=String(q.id),id='li_dq_'+qid,have=L.items.some(x=>x.id===id),noted=mig.imported.includes(qid);
    if(have||noted){
      if(have&&!noted)mig.imported.push(qid);                 /* a lost record: note it again, so a later delete still sticks */
      if(!q.retiredAt)q.retiredAt=Date.now();
    }else if(!q.retiredAt){
      const rawTitle=typeof q.title==='string'?q.title:'';                       /* a title that is not text is damaged data: no title, so nothing to import */
      const title=typeof sharedHomeItemTitle==='function'?sharedHomeItemTitle(rawTitle,LOG_DQ_GENERIC_TITLES):(LOG_DQ_GENERIC_TITLES.includes(rawTitle.trim())?'':rawTitle.trim());
      const finished=Boolean(q.rewarded)||Boolean(state.daily&&state.daily.questDone);
      if(title&&!finished){
        const durRaw=(typeof q.duration==='string'||typeof q.duration==='number')?q.duration:'',descRaw=typeof q.description==='string'?q.description:'';   /* free text only: an object here is damaged data, not words to carry over */
        const dur=logClean(durRaw,120),durLine=dur?'Duration: '+dur:'',desc=logClean(descRaw,2000-(durLine?durLine.length+1:0));
        const at=logNum(q.createdAt)||Date.now();
        L.items.push(logItemShape({id,title,notes:desc&&durLine?desc+'\n'+durLine:(desc||durLine),date:logIsDate(q.date)?q.date:null,time:null,durationMin:null,bucket:'unscheduled',category:'Legacy Daily Quest',status:'open',origin:'legacy-dailyquest',createdAt:at,updatedAt:at,
          legacy:{type:'dailyQuest',id:qid,originalDate:typeof q.date==='string'&&q.date?q.date:null}}));
        mig.imported.push(qid);n++;
      }
      q.retiredAt=Date.now();
    }
  }
  if(n||!mig.at){mig.at=mig.at||Date.now();mig.count=(Number(mig.count)||0)+n}
  return n;
}
/* the Log's own persist: ensure() must not save, so a change it makes goes out through one deferred save */
let logPersistTimer=null;
function logSchedulePersist(){if(logPersistTimer)return;logPersistTimer=setTimeout(()=>{logPersistTimer=null;save()},0)}

/* ---------- selectors ---------- */
function logItems(){return ensureAdventurersLogState().items}
function logItemById(id){return logItems().find(x=>x.id===String(id))||null}
function logEntries(){return ensureAdventurersLogState().schedule}
function logEntryById(id){return logEntries().find(e=>e.scheduleId===String(id))||null}
function logEntryForSource(kind,sourceId){return logEntries().find(e=>e.schedulingState==='scheduled'&&e.sourceKind===kind&&e.sourceId===String(sourceId))||null}
function logOpenCount(){return logItems().filter(x=>x.status==='open').length}
function logUndated(bucket){return logItems().filter(x=>x.status==='open'&&!x.date&&(!bucket||x.bucket===bucket)).sort((a,b)=>a.createdAt-b.createdAt)}

/* ---------- ordinary items (each mutator saves) ---------- */
function logAddItem(fields={}){
  const title=logClean(fields.title,160);
  if(!title)return null;
  const L=ensureAdventurersLogState();
  const item=logItemShape({...fields,id:newStringId('li',new Set(L.items.map(x=>x.id))),title,status:'open',createdAt:Date.now(),updatedAt:Date.now()});
  L.items.push(item);
  save();
  return item;
}
function logUpdateItem(id,patch={}){
  const it=logItemById(id);
  if(!it)return {ok:false,reason:'not-found'};
  /* validate everything BEFORE changing anything, so a refusal leaves the item exactly as it was.
     A garbage date or time is refused, never silently turned into "Unscheduled" (null and '' are the explicit way to clear them). */
  const title='title' in patch?logClean(patch.title,160):null;
  if('title' in patch&&!title)return {ok:false,reason:'no-title'};
  if('date' in patch&&(patch.date===undefined||(patch.date!=null&&patch.date!==''&&!logIsDate(patch.date))))return {ok:false,reason:'bad-date'};
  if('time' in patch&&patch.time!=null&&patch.time!==''&&logTimeToMin(patch.time)==null)return {ok:false,reason:'bad-time'};
  if('title' in patch)it.title=title;
  if('notes' in patch)it.notes=logClean(patch.notes,2000);
  if('category' in patch)it.category=patch.category?logClean(patch.category,60):null;
  if('durationMin' in patch)it.durationMin=logDur(patch.durationMin);
  const wasDate=it.date;
  if('date' in patch||'time' in patch||'bucket' in patch)logApplyWhen(it,{date:'date' in patch?patch.date:it.date,time:'time' in patch?patch.time:it.time,bucket:'bucket' in patch?patch.bucket:it.bucket});
  logOccurrenceMoved(it,wasDate);                /* a recurring occurrence that left its own day: that day stays skipped (M4a) */
  it.updatedAt=Date.now();
  save();
  return {ok:true,item:it};
}
/* date, time and bucket always move together: an item with a date has no bucket; clearing the date puts it in a bucket */
function logApplyWhen(it,when){
  if(logIsDate(when.date)){it.date=when.date;it.time=logTimeToMin(when.time)!=null?when.time:null;it.bucket='unscheduled'}
  else{it.date=null;it.time=null;it.bucket=LOG_BUCKETS.includes(when.bucket)?when.bucket:'unscheduled'}
}
function logMoveItem(id,when){return logUpdateItem(id,{date:when.date||null,time:when.time||null,bucket:when.bucket||'unscheduled'})}
/* done is the item's OWN state: no reward, no history row elsewhere */
function logSetItemDone(id,done){
  const it=logItemById(id);
  if(!it)return {ok:false,reason:'not-found'};
  it.status=done?'done':'open';
  it.completedAt=done?Date.now():null;
  it.updatedAt=Date.now();
  save();
  return {ok:true,item:it};
}
/* returns a snapshot that logRestoreItem() puts back exactly (the undo for delete) */
function logDeleteItem(id){
  const L=ensureAdventurersLogState(),i=L.items.findIndex(x=>x.id===String(id));
  if(i<0)return null;
  const item=L.items[i],top=L.top3.findIndex(t=>t.kind==='item'&&t.id===item.id);
  const snap={item:JSON.parse(JSON.stringify(item)),index:i,top3Index:top,occurrenceException:logOccurrenceTombstone(L,item)};   /* a stored recurring occurrence: its day becomes an exception so it does not reappear (M4a) */
  L.items.splice(i,1);
  if(top>=0)L.top3.splice(top,1);
  save();
  return snap;
}
function logRestoreItem(snap){
  if(!snap||!snap.item)return false;
  const L=ensureAdventurersLogState();
  if(L.items.some(x=>x.id===snap.item.id))return false;
  L.items.splice(Math.min(Math.max(0,snap.index),L.items.length),0,logItemShape(snap.item));
  if(snap.top3Index>=0&&L.top3.length<LOG_TOP3_MAX)L.top3.splice(Math.min(snap.top3Index,L.top3.length),0,{kind:'item',id:snap.item.id});
  /* the delete that added a skipped day takes it off again; a day that was already skipped (the item had been moved off it) stays skipped */
  const ex=snap.occurrenceException;
  if(ex&&ex.added){const rule=L.recurring.find(r=>r.id===ex.ruleId);if(rule)logRemoveException(rule,ex.date)}
  save();
  return true;
}

/* ---------- Top 3 (a designation, never a copy) ---------- */
function logTop3Key(kind,id){return kind+':'+id}
function logTop3Add(kind,id){
  const L=ensureAdventurersLogState(),sid=String(id);
  if(kind!=='item'&&kind!=='schedule')return {ok:false,reason:'bad-kind'};
  if(kind==='item'&&!logItemById(sid))return {ok:false,reason:'not-found'};
  if(kind==='schedule'){const e=logEntryById(sid);if(!e||e.schedulingState!=='scheduled')return {ok:false,reason:'not-found'}}
  if(L.top3.some(t=>t.kind===kind&&t.id===sid))return {ok:true,already:true};
  /* a designation whose target no longer resolves is invisible, so it must not hold one of the three slots */
  const before=L.top3.length;
  L.top3=L.top3.filter(t=>t.kind==='item'?Boolean(logItemById(t.id)):Boolean(logTop3EntryLive(t.id)));
  if(L.top3.length!==before)logSchedulePersist();
  if(L.top3.length>=LOG_TOP3_MAX)return {ok:false,reason:'full'};
  L.top3.push({kind,id:sid});
  save();
  return {ok:true};
}
function logTop3Remove(kind,id){
  const L=ensureAdventurersLogState(),n=L.top3.length;
  L.top3=L.top3.filter(t=>!(t.kind===kind&&t.id===String(id)));
  if(L.top3.length===n)return false;
  save();
  return true;
}
function logTop3Move(kind,id,dir){
  const L=ensureAdventurersLogState(),i=L.top3.findIndex(t=>t.kind===kind&&t.id===String(id)),j=i+(dir<0?-1:1);
  if(i<0||j<0||j>=L.top3.length)return false;
  [L.top3[i],L.top3[j]]=[L.top3[j],L.top3[i]];
  save();
  return true;
}
/* a scheduled reference that still points at a real, un-abandoned source (else null) */
function logTop3EntryLive(scheduleId){
  const e=logEntryById(scheduleId);
  if(!e||e.schedulingState!=='scheduled')return null;
  const v=logResolveEntry(e);
  return v&&!v.missing&&!v.abandoned&&!v.unsupported?{entry:e,view:v}:null;
}
/* the designations resolved to something displayable; a missing or abandoned source is dropped, not shown */
function logTop3Resolved(){
  return ensureAdventurersLogState().top3.map(t=>{
    if(t.kind==='item'){const it=logItemById(t.id);return it?{kind:'item',id:t.id,title:it.title,done:it.status==='done',item:it}:null}
    const live=logTop3EntryLive(t.id);
    return live?{kind:'schedule',id:t.id,title:live.view.title,done:live.view.done,entry:live.entry,view:live.view}:null;
  }).filter(Boolean);
}

/* ---------- references to quest-owned things ---------- */
/* Each resolver: find(sourceId) -> the source record or null; view(source) -> {title,sub,done,open}.
   The completion of a scheduled quest is the SOURCE's: the Log shows done, it never stores it. */
const LOG_SOURCE_RESOLVERS={
  sideQuest:{
    /* the legacy 'sq_<id>' form only identifies a quest that has no instanceId; with duplicate numeric ids it would match the wrong twin */
    find(sourceId){return (Array.isArray(state.sideQuests)?state.sideQuests:[]).find(q=>q&&(q.instanceId?q.instanceId===sourceId:('sq_'+q.id)===sourceId))||null},
    view(q){return {title:q.title,sub:`${q.category||'Other'}`,done:Boolean(q.done),abandoned:q.status==='abandoned'}},
    questId(q){return q.instanceId||('sq_'+q.id)}
  },
  mainQuestMilestone:{
    find(sourceId){
      const s=String(sourceId),cut=s.indexOf(':'),mqId=cut<0?s:s.slice(0,cut),mId=cut<0?'':s.slice(cut+1);   /* split on the FIRST colon: a milestone id may contain one */
      const mq=(typeof ensureQuestHubState==='function'?ensureQuestHubState().mainQuests:[]).find(x=>String(x.id)===mqId);
      const m=mq&&(mq.plan&&mq.plan.milestones||[]).find(x=>String(x.id)===mId);
      return m?{mq,m}:null;
    },
    view(s){return {title:s.m.title,sub:(s.mq.goal&&s.mq.goal.title)||'Main Quest',done:s.m.status==='completed',abandoned:s.mq.status==='abandoned'}},
    questId(s){return String(s.mq.id)}
  }
};
function logResolveEntry(entry){
  const r=logResolver(entry.sourceKind);
  if(!r)return {missing:false,unsupported:true,title:'',sub:'',done:false};   /* an unknown kind is not a removed source: it is hidden */
  const src=r.find(entry.sourceId);
  if(!src)return {missing:true,title:'Source removed',sub:'',done:false};
  return {missing:false,...r.view(src),source:src};
}
/* Schedule (or re-schedule) a quest-owned thing. Idempotent: the same source never gets a second entry. */
function logScheduleSource(spec){
  const s=(spec&&typeof spec==='object')?spec:{};
  const r=logResolver(s.sourceKind);
  if(!r||s.sourceId==null||s.sourceId==='')return {ok:false,reason:'bad-source'};
  const src=r.find(String(s.sourceId));
  if(!src)return {ok:false,reason:'source-missing'};
  if(!logIsDate(s.startDate))return {ok:false,reason:'bad-date'};
  const L=ensureAdventurersLogState();
  let e=L.schedule.find(x=>x.sourceKind===s.sourceKind&&x.sourceId===String(s.sourceId));
  const now=Date.now();
  if(e){
    e.startDate=s.startDate;e.startTime=logTimeToMin(s.startTime)!=null?s.startTime:null;e.durationMin=logNum(s.durationMin);
    if('schedulingNotes' in s)e.schedulingNotes=logClean(s.schedulingNotes,500);
    e.schedulingState='scheduled';e.removedAt=null;e.updatedAt=now;
  }else{
    e=logEntryShape({scheduleId:newStringId('sc',new Set(L.schedule.map(x=>x.scheduleId))),sourceKind:s.sourceKind,sourceId:String(s.sourceId),questId:r.questId(src),startDate:s.startDate,startTime:s.startTime,durationMin:s.durationMin,schedulingNotes:s.schedulingNotes,createdAt:now,updatedAt:now});
    L.schedule.push(e);
  }
  save();
  return {ok:true,entry:e};
}
function logUnscheduleSource(scheduleId){
  const e=logEntryById(scheduleId);
  if(!e||e.schedulingState==='removed')return false;
  e.schedulingState='removed';e.removedAt=Date.now();e.updatedAt=e.removedAt;
  const L=ensureAdventurersLogState();
  L.top3=L.top3.filter(t=>!(t.kind==='schedule'&&t.id===e.scheduleId));
  save();
  return true;
}

/* a quest-owned thing was deleted: its schedule entries become tombstones (kept 90 days, hold no user history); completion records are never touched.
   Does NOT save: its caller is a delete flow that saves itself. */
function logOnSourceRemoved(kind,sourceId){
  const L=ensureAdventurersLogState();let n=0;
  L.schedule.forEach(e=>{if(e.sourceKind===kind&&e.sourceId===String(sourceId)&&e.schedulingState==='scheduled'){e.schedulingState='removed';e.removedAt=Date.now();e.updatedAt=e.removedAt;L.top3=L.top3.filter(t=>!(t.kind==='schedule'&&t.id===e.scheduleId));n++}});
  return n;
}

/* ---------- the shared schedule provider ---------- */
/* One row per open or done item dated that day and one per scheduled quest reference that day. Every row carries a unique
   sourceType + sourceId, because the shared aggregator de-dupes on kind|sourceType|sourceId|time|title: two items with the same
   title and time on one day must stay two rows (item ids are unique), and a source scheduled twice would collapse to one row
   (ensure() already keeps one entry per source). A reference to an ABANDONED quest is not shown, exactly as the Main Quest provider
   leaves non-active quests out; it comes back if the quest does. A reference to a REMOVED source still shows as "Source removed". A recurring rule's
   occurrence that nobody has touched yet is a VIRTUAL row (occurrence:true, logItemId:null, sourceId = its occurrenceKey, so two rules at one time stay two
   rows), appended last; the provider is read-only and never stores one (M4a). */
function logItemRow(it){
  return {time:it.time||'Any',title:it.title,sub:it.category||'',kind:'logItem',done:it.status==='done',sourceType:'logItem',sourceId:it.id,logItemId:it.id,tagLabel:'Log',date:it.date,durationMin:it.durationMin};
}
function logEntryRow(e){
  const v=logResolveEntry(e);
  return {time:e.startTime||'Any',title:v.title,sub:v.missing?'':v.sub,kind:'questRef',done:Boolean(v.done),sourceType:e.sourceKind,sourceId:e.sourceId,scheduleId:e.scheduleId,tagLabel:'Quest',date:e.startDate,durationMin:e.durationMin,missing:v.missing||undefined,hidden:(v.abandoned||v.unsupported)||undefined};
}
/* A virtual occurrence as a feed row: the shape of a Log item row, but with no stored item behind it (logItemId null). A control on it must
   logMaterialiseOccurrence(recurrenceId, date) first. */
function logOccurrenceRow(o){
  return {time:o.time||'Any',title:o.title,sub:o.category||'',kind:'logItem',done:false,sourceType:'logItem',sourceId:o.occurrenceKey,logItemId:null,occurrenceKey:o.occurrenceKey,recurrenceId:o.recurrenceId,occurrence:true,tagLabel:'Log',date:o.date,durationMin:o.durationMin};
}
function scheduleProviderLog(date){
  const L=ensureAdventurersLogState();
  return L.items.filter(x=>x.date===date).map(logItemRow)
    .concat(L.schedule.filter(e=>e.schedulingState==='scheduled'&&e.startDate===date).map(logEntryRow).filter(r=>!r.hidden))
    .concat(recurringOccurrencesOn(date).map(logOccurrenceRow));
}
if(Array.isArray(SHARED_SCHEDULE_PROVIDERS)&&!SHARED_SCHEDULE_PROVIDERS.includes(scheduleProviderLog))SHARED_SCHEDULE_PROVIDERS.push(scheduleProviderLog);
if(typeof SCHEDULE_KIND_LABELS!=='undefined'){SCHEDULE_KIND_LABELS.logItem='Log';SCHEDULE_KIND_LABELS.questRef='Quest'}
if(typeof HOME_SCHEDULE_KIND_ICON!=='undefined'){HOME_SCHEDULE_KIND_ICON.logItem='icons/navigation/NAV_LOG.png';HOME_SCHEDULE_KIND_ICON.questRef='icons/navigation/NAV_QUESTS.png'}

/* ---------- Today: Overdue, order, NEXT ---------- */
/* Overdue is DERIVED, never stored: an open item (or an open scheduled quest) whose date is before today. Stored dates are
   not touched until the player acts, so a past item is never silently rewritten. */
function logOverdue(today=todayISO()){
  const L=ensureAdventurersLogState();
  const items=L.items.filter(x=>x.status==='open'&&x.date&&x.date<today).map(logItemRow);
  const refs=L.schedule.filter(e=>e.schedulingState==='scheduled'&&e.startDate<today).map(logEntryRow).filter(r=>!r.done&&!r.missing&&!r.hidden);
  return items.concat(refs).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.time).localeCompare(String(b.time)));
}
/* Everything open that is dated AFTER today (items and scheduled quest references), soonest first, so nothing scheduled for later is ever
   out of sight. Today and Overdue have their own groups; undated items live in Soon / Later / Unscheduled. */
function logUpcoming(today=todayISO()){
  const L=ensureAdventurersLogState();
  const items=L.items.filter(x=>x.status==='open'&&x.date&&x.date>today).map(logItemRow);
  const refs=L.schedule.filter(e=>e.schedulingState==='scheduled'&&e.startDate>today).map(logEntryRow).filter(r=>!r.done&&!r.hidden);
  const key=r=>String(r.date)+'|'+(logTimeToMin(r.time)!=null?r.time:'99:99');
  return items.concat(refs).sort((a,b)=>key(a).localeCompare(key(b)));
}
/* The most recently finished items that are NOT shown in Today (a done item dated today stays in Today, struck), newest first, so a ticked
   undated or past-dated item can always be found and re-opened. */
function logRecentDone(limit=10,today=todayISO()){
  return logItems().filter(x=>x.status==='done'&&x.date!==today).sort((a,b)=>(b.completedAt||0)-(a.completedAt||0)).slice(0,limit);
}
/* Top 3 as a plain copy, and its restore: the undo of anything that changes Top 3 as a side effect (a save from the sheet, taking a reference off) */
function logTop3Snapshot(){return JSON.parse(JSON.stringify(ensureAdventurersLogState().top3))}
function logTop3Restore(snap){
  const L=ensureAdventurersLogState(),seen=new Set();
  L.top3=(Array.isArray(snap)?snap:[]).filter(t=>t&&(t.kind==='item'?logItemById(t.id):(t.kind==='schedule'&&logEntryById(t.id)&&logEntryById(t.id).schedulingState==='scheduled'))&&!seen.has(t.kind+':'+t.id)&&seen.add(t.kind+':'+t.id)).slice(0,LOG_TOP3_MAX).map(t=>({kind:t.kind,id:String(t.id)}));
  save();
}
/* Today for the Log. Timed rows (strict HH:MM) first by start, then untimed ('Any'); the shared feed is the source so Training and
   the rest are included, but a Personal Growth row (every-day habits) is separated out so it cannot become NEXT. */
function logTodayModel(nowMs=Date.now(),today=localISO(new Date(nowMs))){
  const rows=sharedScheduleItemsForDate(today).slice();
  const timed=r=>logTimeToMin(r.time)!=null;
  const habits=rows.filter(r=>r.kind==='personalGrowth');
  const main=rows.filter(r=>r.kind!=='personalGrowth');
  main.sort((a,b)=>{
    const ta=timed(a),tb=timed(b);
    if(ta&&tb)return logTimeToMin(a.time)-logTimeToMin(b.time)||String(a.title).localeCompare(String(b.title));
    if(ta!==tb)return ta?-1:1;
    return String(a.title).localeCompare(String(b.title));
  });
  const d=new Date(nowMs),nowMin=d.getHours()*60+d.getMinutes();
  const open=main.filter(r=>!r.done&&!r.missing);          /* a "Source removed" row is shown but is never what the player does next */
  /* NEXT = the first open timed row that has not ended, else the first open untimed row, else none */
  const next=open.find(r=>timed(r)&&logTimeToMin(r.time)+(r.durationMin||LOG_DEFAULT_MINUTES)>=nowMin)||open.find(r=>!timed(r))||null;
  return {overdue:logOverdue(today),rows:main,habits,next,today};
}

/* ---------- Notes (the Log's own capture list; replaces the Brain Dump) ---------- */
function logNotes(){return ensureAdventurersLogState().notes}
function logAddNote(text,origin='manual'){
  const t=logClean(text,2000);
  if(!t)return null;
  const L=ensureAdventurersLogState();
  const n=logNoteShape({id:newStringId('ln',new Set(L.notes.map(x=>x.id))),text:t,origin,createdAt:Date.now(),updatedAt:Date.now()});
  L.notes.push(n);
  save();
  return n;
}
/* returns a snapshot that logRestoreNote() puts back in place (the undo for delete) */
function logDeleteNote(id){
  const L=ensureAdventurersLogState(),i=L.notes.findIndex(n=>n.id===String(id));
  if(i<0)return null;
  const snap={note:JSON.parse(JSON.stringify(L.notes[i])),index:i};
  L.notes.splice(i,1);
  save();
  return snap;
}
function logRestoreNote(snap){
  if(!snap||!snap.note)return false;
  const L=ensureAdventurersLogState();
  if(L.notes.some(n=>n.id===snap.note.id))return false;
  L.notes.splice(Math.min(Math.max(0,snap.index),L.notes.length),0,logNoteShape(snap.note));
  save();
  return true;
}
/* "Make an item": the note becomes an Unscheduled item and leaves the notes list. Undoable as a pair. */
function logNoteToItem(id){
  const L=ensureAdventurersLogState(),n=L.notes.find(x=>x.id===String(id));
  if(!n)return null;
  /* nothing is lost: the first line is the title (cut at 160 with an ellipsis), and the whole note rides along in the item's notes
     whenever the title could not carry all of it (a note is at most 2000 characters and an item's notes hold 2000) */
  const first=n.text.split('\n')[0],cut=first.length>160;
  const item=logAddItem({title:cut?first.slice(0,159)+'…':first,notes:(n.text.includes('\n')||cut)?n.text:'',origin:'note',bucket:'unscheduled'});
  if(!item)return null;
  const noteSnap=logDeleteNote(n.id);
  return {item,noteSnap};
}

/* ---------- rapid reschedule (tap-based) ---------- */
/* The three one-tap choices. Pure: they depend only on the clock and the item's current time, so a fixed clock tests them.
   today        today, keeping the item's time (the Overdue group's "Today")
   later-today  today at the next whole hour that is at least 30 minutes away; after 22:00 it is simply today with no time
   tomorrow     the next day, keeping the item's time
   next-week    the coming Monday (the app's weeks start on Monday), keeping the item's time
   Returns {date,time}, or null for an unknown kind. */
function logQuickWhen(kind,now=new Date(),cur={}){
  const today=localISO(now),keep=logTimeToMin(cur.time)!=null?cur.time:null;
  if(kind==='today')return {date:today,time:keep};
  if(kind==='later-today'){
    let h=now.getHours()+1;if(now.getMinutes()>30)h+=1;
    return {date:today,time:h>22?null:String(h).padStart(2,'0')+':00'};
  }
  if(kind==='tomorrow')return {date:addDays(today,1),time:keep};
  if(kind==='next-week'){const dow=(dateFromISO(today).getDay()+6)%7;return {date:addDays(today,7-dow),time:keep}}
  return null;
}

/* ==========================================================================
   LOG CORE B, STORE LAYER (Milestone 4a): templates, Duplicate, recurring rules, calendar helpers
   ==========================================================================
   No UI here (M4b builds on this). Everything that changes data saves and returns an undo snapshot where it says so; the readers and the
   calendar helpers are pure and write nothing. Nothing here awards XP, Gold or a ledger record: the Log never pays. */

/* ---------- "when": the date / time / bucket argument of Duplicate and of adding from a template ---------- */
/* Each key is optional (undefined = not given, so `base` supplies it); a date or time that IS given but is not real is refused (null),
   because silently turning a bad date into "Unscheduled" would hide a bug (logUpdateItem refuses the same way). '' and null clear. */
function logResolveWhen(when,base){
  const w=(when&&typeof when==='object')?when:{},given=k=>w[k]!==undefined;
  if(given('date')&&w.date!==null&&w.date!==''&&logDateOrNull(w.date)==null)return null;
  if(given('time')&&w.time!==null&&w.time!==''&&logTimeOrNull(w.time)==null)return null;
  const r={date:null,time:null,bucket:'unscheduled'};
  logApplyWhen(r,{date:given('date')?(w.date||null):base.date,time:given('time')?(w.time||null):base.time,bucket:given('bucket')?w.bucket:base.bucket});
  return r;
}

/* ---------- templates: a saved shape for something the player adds often (never recurrence) ---------- */
function logTemplateOrder(a,b){return (b.pinned-a.pinned)||a.name.toLowerCase().localeCompare(b.name.toLowerCase())||a.createdAt-b.createdAt||(a.id<b.id?-1:a.id>b.id?1:0)}
/* pinned first, then by name (case-insensitive): a fresh array every call (the template objects in it are the live ones, like logItems) */
function logTemplates(){return ensureAdventurersLogState().templates.slice().sort(logTemplateOrder)}
function logTemplateById(id){return ensureAdventurersLogState().templates.find(t=>t.id===String(id))||null}
/* the template that already has this name (compared trimmed and case-insensitively), other than exceptId */
function logTemplateNamed(name,exceptId){const k=name.toLowerCase();return ensureAdventurersLogState().templates.find(t=>t.id!==exceptId&&t.name.toLowerCase()===k)||null}
/* {ok:true,template} | {ok:false,reason:'no-name'|'exists',template?}. The name is cut to 60 characters first, then compared. A time or length
   that is not valid is simply left out (an item is added the same way); logUpdateTemplate refuses them instead. */
function logSaveTemplate(fields={}){
  const f=(fields&&typeof fields==='object')?fields:{},name=logTplName(f.name);
  if(!name)return {ok:false,reason:'no-name'};
  const dup=logTemplateNamed(name,null);
  if(dup)return {ok:false,reason:'exists',template:dup};
  const L=ensureAdventurersLogState(),now=Date.now();
  const t=logTemplateShape({id:newStringId('lt',new Set(L.templates.map(x=>x.id))),name,category:f.category,durationMin:f.durationMin,usualTime:f.usualTime,notes:f.notes,pinned:f.pinned===true,createdAt:now,updatedAt:now});
  L.templates.push(t);
  save();
  return {ok:true,template:t};
}
/* {ok:true,template} | {ok:false,reason:'not-found'|'no-name'|'exists'|'bad-time'}. Everything is checked BEFORE anything changes, so a refusal changes nothing.
   Only name, category, durationMin, usualTime, notes and pinned can be patched (id, createdAt and lastUsedAt are not the caller's). */
function logUpdateTemplate(id,patch={}){
  const t=logTemplateById(id);
  if(!t)return {ok:false,reason:'not-found'};
  const p=(patch&&typeof patch==='object')?patch:{};
  let name=null;
  if('name' in p){
    name=logTplName(p.name);
    if(!name)return {ok:false,reason:'no-name'};
    const dup=logTemplateNamed(name,t.id);
    if(dup)return {ok:false,reason:'exists',template:dup};
  }
  if('usualTime' in p&&p.usualTime!=null&&p.usualTime!==''&&logTimeOrNull(p.usualTime)==null)return {ok:false,reason:'bad-time'};
  if('name' in p)t.name=name;
  if('category' in p)t.category=logText(p.category,60)||null;
  if('durationMin' in p)t.durationMin=logDur(p.durationMin);
  if('usualTime' in p)t.usualTime=logTimeOrNull(p.usualTime);
  if('notes' in p)t.notes=logText(p.notes,2000);
  if('pinned' in p)t.pinned=p.pinned===true;
  t.updatedAt=Date.now();
  save();
  return {ok:true,template:t};
}
/* returns a snapshot {template,index} that logRestoreTemplate() puts back (the undo for delete). Items already made from it keep their templateId, which simply no longer resolves. */
function logDeleteTemplate(id){
  const L=ensureAdventurersLogState(),i=L.templates.findIndex(t=>t.id===String(id));
  if(i<0)return null;
  const snap={template:JSON.parse(JSON.stringify(L.templates[i])),index:i};
  L.templates.splice(i,1);
  save();
  return snap;
}
/* refuses when the id or the name is taken again meanwhile (a new template may have reused the name) */
function logRestoreTemplate(snap){
  if(!snap||typeof snap!=='object'||!snap.template)return false;
  const t=logTemplateShape(snap.template);
  if(!t)return false;
  const L=ensureAdventurersLogState();
  if(L.templates.some(x=>x.id===t.id)||logTemplateNamed(t.name,null))return false;
  L.templates.splice(Math.min(Math.max(0,Number(snap.index)||0),L.templates.length),0,t);
  save();
  return true;
}
/* "Save as Template": the same result as logSaveTemplate (plus reason 'not-found' for an item that is not stored: a virtual occurrence has no item yet) */
function logTemplateFromItem(itemId){
  const it=logItemById(itemId);
  if(!it)return {ok:false,reason:'not-found'};
  return logSaveTemplate({name:it.title,category:it.category,durationMin:it.durationMin,usualTime:it.time,notes:it.notes});
}
/* Using a template stamps lastUsedAt, and is the ONLY thing it ever changes in the template. The stamp is strictly increasing across templates
   (Date.now() has millisecond steps, and two quick uses must still have a most-recent one) so the Recent list never has a tie. */
/* ... and never at or below the newest stamp this session has issued: the template that holds the highest stamp may have been deleted (and may come back by
   undo), so reading the highest stamp from the templates that exist is not enough. */
let logTemplateLastStamp=0;
function logTemplateStamp(t){
  const top=ensureAdventurersLogState().templates.reduce((m,x)=>Math.max(m,x.lastUsedAt||0),0);
  t.lastUsedAt=logTemplateLastStamp=Math.max(Date.now(),top+1,logTemplateLastStamp+1);
}
function logTemplateTouch(id){
  const t=logTemplateById(id);
  if(!t)return false;
  logTemplateStamp(t);
  save();
  return true;
}
/* The templates that have been used, most recently used first (derived: nothing is stored for "Recent" beyond lastUsedAt). */
function logRecentTemplates(n=LOG_RECENT_TEMPLATES){
  const k=Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):LOG_RECENT_TEMPLATES;
  return ensureAdventurersLogState().templates.filter(t=>t.lastUsedAt).sort((a,b)=>b.lastUsedAt-a.lastUsedAt).slice(0,k);
}
/* A new open item from a template. title = the template's name; notes, category and length are copied; the time is the given one, else the
   template's usual time, and only when a day is given (an item with no day has no time). null = nothing created (unknown template, or a day or
   time that was given but is not real). The template itself is never modified, except for lastUsedAt. */
function logAddItemFromTemplate(templateId,when={}){
  const t=logTemplateById(templateId);
  if(!t)return null;
  const r=logResolveWhen(when,{date:null,time:null,bucket:'unscheduled'});
  if(!r)return null;
  if(r.date&&!r.time)r.time=t.usualTime;
  const L=ensureAdventurersLogState(),now=Date.now();
  const item=logItemShape({id:newStringId('li',new Set(L.items.map(x=>x.id))),title:t.name,notes:t.notes,category:t.category,durationMin:t.durationMin,date:r.date,time:r.time,bucket:r.bucket,status:'open',origin:'template',templateId:t.id,createdAt:now,updatedAt:now});
  L.items.push(item);
  logTemplateStamp(t);
  save();
  return item;
}

/* ---------- Duplicate ---------- */
/* A brand-new open item that has the same title, notes, category and length. date / time / bucket come from `when` for each key that is
   present, else they are copied. It is origin 'manual' and carries NOTHING that links it to the source: no templateId, recurrenceId,
   occurrenceKey or legacy, and it is not in Top 3. null = nothing created (unknown id, or a day or time that was given but is not real). */
function logDuplicateItem(id,when={}){
  const src=logItemById(id);
  if(!src)return null;
  const r=logResolveWhen(when,{date:src.date,time:src.time,bucket:src.bucket});
  if(!r)return null;
  const L=ensureAdventurersLogState(),now=Date.now();
  const item=logItemShape({id:newStringId('li',new Set(L.items.map(x=>x.id))),title:src.title,notes:src.notes,category:src.category,durationMin:src.durationMin,date:r.date,time:r.time,bucket:r.bucket,status:'open',origin:'manual',createdAt:now,updatedAt:now});
  L.items.push(item);
  save();
  return item;
}

/* ---------- recurring rules (weekly and daily only) ---------- */
function logRecurring(){return ensureAdventurersLogState().recurring.slice()}
function logRecurringById(id){return ensureAdventurersLogState().recurring.find(r=>r.id===String(id))||null}
/* {ok:true,rule} | {ok:false,reason:'no-title'|'bad-freq'|'no-weekday'|'bad-start'} (checked in that order). Any freq but daily / weekly is refused.
   A time that is not valid, or an until before the start, is simply left out. */
function logAddRecurring(fields={}){
  const f=(fields&&typeof fields==='object')?fields:{};
  if(!logText(f.title,160))return {ok:false,reason:'no-title'};
  if(!LOG_RC_FREQS.includes(f.freq))return {ok:false,reason:'bad-freq'};
  if(f.freq==='weekly'&&!logWeekdays(f.byWeekday).length)return {ok:false,reason:'no-weekday'};
  if(!logDateOrNull(f.startDate))return {ok:false,reason:'bad-start'};
  const L=ensureAdventurersLogState(),now=Date.now();
  const rule=logRecurringShape({...f,id:newStringId('rc',new Set(L.recurring.map(x=>x.id))),createdAt:now,updatedAt:now});
  if(!rule)return {ok:false,reason:'bad-start'};
  L.recurring.push(rule);
  save();
  return {ok:true,rule};
}
/* {ok:true,rule} | {ok:false,reason:'not-found'|'no-title'|'bad-freq'|'no-weekday'|'bad-start'|'bad-until'|'bad-time'}. The WHOLE result is checked before anything
   changes. Moving startDate / until or changing the weekdays never touches an occurrence that is already stored (those are items now); the
   skipped days (exceptions) are not patchable: they change only through logDeleteRecurring, logDeleteItem and moving an occurrence.
   An until that falls before the start is refused rather than cleared, so a bounded rule can never silently become endless. */
function logUpdateRecurring(id,patch={}){
  const r=logRecurringById(id);
  if(!r)return {ok:false,reason:'not-found'};
  const p=(patch&&typeof patch==='object')?patch:{},has=k=>k in p;
  if(has('title')&&!logText(p.title,160))return {ok:false,reason:'no-title'};
  const freq=has('freq')?p.freq:r.freq;
  if(!LOG_RC_FREQS.includes(freq))return {ok:false,reason:'bad-freq'};
  const days=freq==='weekly'?(has('byWeekday')?logWeekdays(p.byWeekday):r.byWeekday):[];
  if(freq==='weekly'&&!days.length)return {ok:false,reason:'no-weekday'};
  const start=has('startDate')?logDateOrNull(p.startDate):r.startDate;
  if(!start)return {ok:false,reason:'bad-start'};
  let until=r.until;
  if(has('until')){
    if(p.until==null||p.until==='')until=null;
    else{until=logDateOrNull(p.until);if(!until)return {ok:false,reason:'bad-until'}}
  }
  if(until&&until<start)return {ok:false,reason:'bad-until'};
  if(has('time')&&p.time!=null&&p.time!==''&&logTimeOrNull(p.time)==null)return {ok:false,reason:'bad-time'};
  if(has('title'))r.title=logText(p.title,160);
  if(has('notes'))r.notes=logText(p.notes,2000);
  if(has('category'))r.category=logText(p.category,60)||null;
  if(has('time'))r.time=logTimeOrNull(p.time);
  if(has('durationMin'))r.durationMin=logDur(p.durationMin);
  r.freq=freq;r.byWeekday=days;r.startDate=start;r.until=until;
  r.updatedAt=Date.now();
  save();
  return {ok:true,rule:r};
}
/* skipped days: sorted, unique, capped (the date just added is never the one the cap drops). Both return whether anything changed; neither saves. */
function logAddException(rule,date){
  if(rule.exceptions.includes(date))return false;
  rule.exceptions.push(date);rule.exceptions.sort();
  while(rule.exceptions.length>LOG_RC_EXCEPTIONS_MAX)rule.exceptions.splice(rule.exceptions[0]===date?1:0,1);
  return true;
}
function logRemoveException(rule,date){
  const i=rule.exceptions.indexOf(date);
  if(i<0)return false;
  rule.exceptions.splice(i,1);
  return true;
}
/* Does the rule itself fall on this (valid) day? Skipped days and stored occurrences are NOT considered here. dow = the day's weekday when the caller already has it. */
function logWeekdayOf(date){return (dateFromISO(date).getDay()+6)%7}          /* 0=Monday ... 6=Sunday, the same as weekDates() */
function logRuleOccursOn(rule,date,dow){
  if(date<rule.startDate||(rule.until&&date>rule.until))return false;
  return rule.freq==='daily'||rule.byWeekday.includes(dow==null?logWeekdayOf(date):dow);
}
/* scope 'occurrence': the day goes into the rule's exceptions, but only when the rule really occurs on it and it is not skipped already. Returns
   {scope:'occurrence',ruleId,date}. scope 'all': the rule is removed and every occurrence already stored as an item is left exactly as it is.
   Returns {scope:'all',rule,index}. null = nothing changed. (A STORED occurrence is an item: delete it with logDeleteItem, which records its day.) */
function logDeleteRecurring(id,scope,date){
  const L=ensureAdventurersLogState(),i=L.recurring.findIndex(r=>r.id===String(id));
  if(i<0)return null;
  const rule=L.recurring[i];
  if(scope==='all'){
    const snap={scope:'all',rule:JSON.parse(JSON.stringify(rule)),index:i};
    L.recurring.splice(i,1);
    save();
    return snap;
  }
  if(scope==='occurrence'){
    if(!logDateOrNull(date)||!logRuleOccursOn(rule,date)||rule.exceptions.includes(date))return null;
    logAddException(rule,date);
    save();
    return {scope:'occurrence',ruleId:rule.id,date};
  }
  return null;
}
/* the undo of either scope: 'occurrence' takes the skipped day off the rule again; 'all' puts the rule back where it was (refused when its id is taken) */
function logRestoreRecurring(snap){
  if(!snap||typeof snap!=='object')return false;
  if(snap.scope==='occurrence'||(!snap.rule&&snap.ruleId!=null)){
    const r=logRecurringById(snap.ruleId);
    if(!r||!logRemoveException(r,snap.date))return false;
    save();
    return true;
  }
  const rule=snap.rule?logRecurringShape(snap.rule):null;
  if(!rule)return false;
  const L=ensureAdventurersLogState();
  if(L.recurring.some(x=>x.id===rule.id))return false;
  L.recurring.splice(Math.min(Math.max(0,Number(snap.index)||0),L.recurring.length),0,rule);
  save();
  return true;
}

/* ---------- occurrences: VIRTUAL, computed on read, never written ---------- */
/* occurrenceKey = recurrenceId + '@' + date. A stored occurrence (an item) carries it, which is what keeps the virtual one from showing twice. */
function logOccurrenceKey(ruleId,date){return ruleId+'@'+date}
function logStoredOccurrenceKeys(L){const s=new Set();L.items.forEach(x=>{if(x.occurrenceKey)s.add(x.occurrenceKey)});return s}
/* the day an occurrence belongs to by its key (not where the item sits now, if it was moved); null when the item is not a well-formed occurrence */
function logOccurrenceOwnDate(item){
  const rid=item.recurrenceId,key=item.occurrenceKey;
  if(!rid||!key||!key.startsWith(rid+'@'))return null;
  return logDateOrNull(key.slice(rid.length+1));
}
function logVirtualOccurrence(rule,date,key){
  return {id:key,title:rule.title,notes:rule.notes,status:'open',date,time:rule.time,durationMin:rule.durationMin,bucket:'unscheduled',category:rule.category,reminder:null,createdAt:rule.createdAt,updatedAt:rule.updatedAt,completedAt:null,origin:'recurrence',legacy:null,templateId:null,recurrenceId:rule.id,occurrenceKey:key,virtual:true};
}
/* timed ones first by time, then untimed (the Log's own Today order), ties by title then id so the order is stable */
function logCompareOcc(a,b){
  const ta=a.time!=null,tb=b.time!=null;
  if(ta!==tb)return ta?-1:1;
  return String(a.time||'').localeCompare(String(b.time||''))||a.title.localeCompare(b.title)||(a.id<b.id?-1:a.id>b.id?1:0);
}
/* one day of the given rules, minus skipped days and minus any occurrence that is already stored */
function logOccurrencesForDate(rules,date,keys,dow){
  const out=[];
  rules.forEach(r=>{
    if(!logRuleOccursOn(r,date,dow)||r.exceptions.includes(date))return;
    const key=logOccurrenceKey(r.id,date);
    if(!keys.has(key))out.push(logVirtualOccurrence(r,date,key));
  });
  return out.sort(logCompareOcc);
}
/* The occurrences of every rule on one day. Pure: reads state, writes nothing (no ensure-time save, no materialising). A day that is not a real date has none. */
function recurringOccurrencesOn(date){
  const L=ensureAdventurersLogState();
  if(!L.recurring.length||!logIsDate(date))return [];
  return logOccurrencesForDate(L.recurring,date,logStoredOccurrenceKeys(L),logWeekdayOf(date));
}
/* A flat list over from..to (inclusive), earliest day first (timed before untimed within a day), at most max (default 200, never more than 2000), and only
   inside the calendar horizon: six calendar months either side of opts.today (default: today). Dates are stepped one calendar day at a time. */
function recurringOccurrencesBetween(from,to,opts={}){
  const o=(opts&&typeof opts==='object')?opts:{},L=ensureAdventurersLogState();
  if(!L.recurring.length||!logIsDate(from)||!logIsDate(to))return [];
  const b=logCalendarBounds(logDateOrNull(o.today)||todayISO());
  const a=from<b.min?b.min:from,z=to>b.max?b.max:to;
  const max=Number.isFinite(o.max)&&o.max>=0?Math.min(Math.floor(o.max),LOG_OCC_HARD_MAX):LOG_OCC_MAX;
  if(a>z||!max)return [];
  const keys=logStoredOccurrenceKeys(L),rules=L.recurring.filter(r=>r.startDate<=z&&(!r.until||r.until>=a)),out=[];
  let dow=logWeekdayOf(a);
  for(let d=a;d<=z&&out.length<max;d=addDays(d,1),dow=(dow+1)%7){
    for(const x of logOccurrencesForDate(rules,d,keys,dow)){if(out.length>=max)break;out.push(x)}
  }
  return out;
}
/* The one place an occurrence becomes an item (the player touched it). The id is deterministic, 'li_r_<rule id>_<day>' (the day is always the
   last ten characters, so two different occurrences can never share one), and the call is idempotent: an item that already holds the key is
   returned as it is. Created only when the rule really occurs that day and the day is not skipped; null otherwise. Saves when it creates. */
function logMaterialiseOccurrence(recurrenceId,date){
  const L=ensureAdventurersLogState(),rid=String(recurrenceId==null?'':recurrenceId);
  if(!logIsDate(date))return null;
  const key=logOccurrenceKey(rid,date),have=L.items.find(x=>x.occurrenceKey===key);
  if(have)return have;
  const rule=logRecurringById(rid);
  if(!rule||!logRuleOccursOn(rule,date)||rule.exceptions.includes(date))return null;
  let id='li_r_'+rid+'_'+date;
  if(L.items.some(x=>x.id===id))id=newStringId('li_r',new Set(L.items.map(x=>x.id)));   /* an unrelated item already has that id (damaged data): fall back to a fresh one */
  const now=Date.now();
  const item=logItemShape({id,title:rule.title,notes:rule.notes,category:rule.category,durationMin:rule.durationMin,date,time:rule.time,status:'open',origin:'recurrence',recurrenceId:rule.id,occurrenceKey:key,createdAt:now,updatedAt:now});
  L.items.push(item);
  save();
  return item;
}
/* Deleting a STORED occurrence must not let the virtual one come back: its own day goes into the rule's exceptions. Returns {ruleId,date,added}
   (added=false when that day was already skipped, which an undo must then leave alone) or null when there is nothing to record. Does not save. */
function logOccurrenceTombstone(L,item){
  const own=logOccurrenceOwnDate(item),rule=own?L.recurring.find(r=>r.id===item.recurrenceId):null;
  return rule?{ruleId:rule.id,date:own,added:logAddException(rule,own)}:null;
}
/* A stored occurrence that leaves its own day keeps that day suppressed, so the virtual one does not appear behind it. Only the move OFF the rule's
   own day counts: a second move, or a time-only edit, changes nothing. (Moving it back leaves the exception: the item holds the key anyway.) */
function logOccurrenceMoved(it,wasDate){
  if(it.date===wasDate)return;
  const own=logOccurrenceOwnDate(it);
  if(!own||wasDate!==own)return;
  const rule=ensureAdventurersLogState().recurring.find(r=>r.id===it.recurrenceId);
  if(rule)logAddException(rule,own);
}

/* ---------- calendar helpers (pure: they read the date and, for logDaySummary, the shared feed, and write nothing) ---------- */
/* date -/+ n calendar months: the SAME day of the month, clamped to the last day of the target month (31 Aug - 6 months = 28 Feb, or 29 in a leap
   year; 29 Feb + 12 months = 28 Feb). Plain month arithmetic at noon, so a clock change can never move the day. A clamped day does not "remember"
   its old day: 31 Jan + 1 month = 28 Feb, and + 1 more = 28 Mar. */
function logAddMonths(date,n){
  const d=dateFromISO(date),y=d.getFullYear(),m=d.getMonth()+n,last=new Date(y,m+1,0,12).getDate();
  return localISO(new Date(y,m,Math.min(d.getDate(),last),12));
}
/* {min,max} = today -/+ six calendar months by the rule above. A today that is not a real date means the real today. */
function logCalendarBounds(today=todayISO()){
  const t=logDateOrNull(today)||todayISO();
  return {min:logAddMonths(t,-LOG_HORIZON_MONTHS),max:logAddMonths(t,LOG_HORIZON_MONTHS)};
}
/* the date moved inside the bounds; a date that is not real becomes today */
function logClampDate(date,today=todayISO()){
  const t=logDateOrNull(today)||todayISO(),b=logCalendarBounds(t),d=logDateOrNull(date);
  return !d?t:d<b.min?b.min:d>b.max?b.max:d;
}
/* the seven days, Monday to Sunday, of the week that holds the date (not real = this week) */
function logWeekDates(date){
  const d=logDateOrNull(date)||todayISO(),start=addDays(d,-logWeekdayOf(d));
  return Array.from({length:7},(_,i)=>addDays(start,i));
}
/* The month the date is in as a Monday-first grid: {year, month (1 to 12), weeks:[[{date,inMonth} x7] x5 or 6]}. The weeks run from the Monday on or before
   the 1st to the Sunday on or after the last day; a month that fits in four weeks (a February that starts on a Monday) gets a fifth, all outside it. */
function logMonthGrid(date){
  const d=logDateOrNull(date)||todayISO(),y=Number(d.slice(0,4)),m=Number(d.slice(5,7)),prefix=d.slice(0,7);
  const first=prefix+'-01',last=prefix+'-'+String(new Date(y,m,0,12).getDate()).padStart(2,'0');
  const end=addDays(last,6-logWeekdayOf(last)),weeks=[];
  let cur=addDays(first,-logWeekdayOf(first));
  while(cur<=end||weeks.length<5){
    const row=[];
    for(let i=0;i<7;i++){row.push({date:cur,inMonth:cur.slice(0,7)===prefix});cur=addDays(cur,1)}
    weeks.push(row);
  }
  return {year:y,month:m,weeks};
}
/* the date one day / week / month earlier (dir<0) or later (dir>0), then kept inside the bounds. view is 'day', 'week' or 'month' (anything else does not move it). */
function logShiftDate(date,view,dir,today=todayISO()){
  const t=logDateOrNull(today)||todayISO(),d=logDateOrNull(date)||t,n=dir<0?-1:dir>0?1:0;
  const r=view==='day'?addDays(d,n):view==='week'?addDays(d,7*n):view==='month'?logAddMonths(d,n):d;
  return logClampDate(r,t);
}
/* What a calendar day holds, from the shared feed ONLY: {total, timed, hasQuestRef, hasTraining, hasLog}. total counts the Training, Log, quest-reference and
   Main Quest rows (a Personal Growth habit is not counted); timed is how many of those have a strict HH:MM time. A date that is not real holds nothing. */
function logDaySummary(date){
  const rows=(logIsDate(date)?sharedScheduleItemsForDate(date):[]).filter(r=>LOG_DAY_KINDS.includes(r.kind));
  return {total:rows.length,timed:rows.filter(r=>logTimeToMin(r.time)!=null).length,hasQuestRef:rows.some(r=>r.kind==='questRef'),hasTraining:rows.some(r=>r.kind==='activity'),hasLog:rows.some(r=>r.kind==='logItem')};
}

/* The Log's migrations run once at load, so a migration happens even if the player never opens the Log. A failure here must never stop the app. */
try{ensureAdventurersLogState()}catch(e){try{window.__errs.push({at:Date.now(),k:'log-load',m:String(e&&e.message||e).slice(0,200)})}catch(x){}}
