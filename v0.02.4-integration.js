/* RPG v0.02.4 Home marble correction hotfix layer
 * Actual runtime changes staged over the last complete v0.01.8.7.3 executable.
 * HOME_VISUAL_MARBLE is deliberately non-persistent and reversible.
 *
 * RETIRED FROM THE V3 LIVE RENDER PATH (2026-09-07, Aurelia's V3
 * Geometry Finalization order): HOME_VISUAL_MODE/HOME_VISUAL_MARBLE
 * flipped to inert. Concrete evidence this was still reaching current
 * markup: an un-important min-width:62px on .resource-row-icon (see the
 * Home V3 Widget Geometry Report) silently clamped the new Resources
 * grid's icon width. Archived, not deleted — every function/rule below
 * is untouched and still reachable by flipping HOME_VISUAL_MODE back to
 * 'all-variants' if ever needed; see ASTRA_CURRENT_STATE.md for the
 * regression findings from retiring it (the Hero's open-scene look and
 * several Today/Main-Quest text colors turned out to depend on this
 * layer's CSS-class side effects — now ported forward as unconditional
 * V3-native rules in v0.02.16-home-parchment-modules.css instead). */
const V023_SCHEMA_VERSION=2;
const HOME_VISUAL_MODE='off';
const HOME_VISUAL_MARBLE=HOME_VISUAL_MODE==='all-variants';
/* v0.02.1.3 Home Visual Asset Pack — peaked six-sided crest badges supersede
   the old thick circular medallions for these Home roles only (see
   CLAUDE_IMPLEMENTATION_HANDOFF.md / asset-map-v0.02.1.3.json). Old files
   kept on disk for rollback. */
/* NOTE (2026-09-05, superseded 2026-09-06): RPG_VISUAL_ASSETS_V1's
   ICON_RESOURCE_* files were mislabeled at the time (each file's real
   content was the NEXT icon in the set) and were left un-wired. The
   Home v2 Fidelity Rebuild package (RPG_HOME_V2_UPDATED_ARTWORK_ONLY_
   2026-09-06.zip, verified against HOME_V2_FIDELITY_MANIFEST.csv by
   SHA-256 and by direct pixel inspection of every file) re-delivers all
   6 correctly labeled — wired below. */
const V023_HOME_RESOURCE_ICONS={
  water:'icons/resources/ICON_RESOURCE_WATER.png',food:'icons/resources/ICON_RESOURCE_FOOD.png',sleep:'icons/resources/ICON_RESOURCE_SLEEP.png',mind:'icons/resources/ICON_RESOURCE_MIND.png',steps:'icons/resources/ICON_RESOURCE_STEPS.png',social:'icons/resources/ICON_RESOURCE_SOCIAL.png'
};
const V0231_HOME_UTILITY_ICONS={
  bonus:'development/home_development_bonus_badge_variant_b_v1.png',archive:'development/home_development_archive_badge_variant_b_v1.png',tracker:'resources/home_resources_tracker_badge_variant_b_v1.png',history:'resources/home_resources_history_badge_variant_b_v1.png',acceptChallenge:'Variant accept challenge.png'
};
const V023_HYDRATION_ICON_ROOT='Achievements/Hydration/Positive/';
const V023_FRAME_ROOT='Achievements/Frames/';

function v023Hash(input){
  let h=2166136261;for(const ch of String(input)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
}
function v023StableId(prefix,...parts){return `${prefix}_${v023Hash(parts.map(x=>String(x??'')).join('|'))}`}
function v023Now(){return new Date().toISOString()}
function v023BaseStat(key){return clamp(Number(state.stats?.[key]?.baseValue??state.stats?.[key]?.score??10),1,300)}
function v023MilestoneDefault(){return {status:'unclaimed',unlockedAt:null,selectedSkillId:null}}
function v023EnsureStatMilestones(){
  state.statMilestones=state.statMilestones&&typeof state.statMilestones==='object'?state.statMilestones:{};
  Object.keys(STAT_NAMES).forEach(key=>{
    state.statMilestones[key]=state.statMilestones[key]&&typeof state.statMilestones[key]==='object'?state.statMilestones[key]:{};
    const base=v023BaseStat(key);
    [100,200,300].forEach(threshold=>{
      const existing=state.statMilestones[key][threshold];
      if(base>=threshold&&!existing)state.statMilestones[key][threshold]={...v023MilestoneDefault(),unlockedAt:v023Now()};
      else if(existing&&typeof existing==='object')state.statMilestones[key][threshold]={...v023MilestoneDefault(),...existing};
    });
  });
}
function v023UnclaimedMilestones(){
  v023EnsureStatMilestones();const out=[];
  Object.keys(STAT_NAMES).forEach(key=>[100,200,300].forEach(th=>{const m=state.statMilestones[key]?.[th];if(m?.status==='unclaimed')out.push({stat:key,threshold:th,...m})}));
  return out;
}
function v023ActivityFingerprint(a={}){
  if(a.importFingerprint)return String(a.importFingerprint);
  if(a.sourceActivityId)return `${String(a.source||'External').toLowerCase()}:${String(a.sourceActivityId)}`;
  return null;
}
function v023EnsureActivityIdentity(a){
  if(!a||typeof a!=='object')return a;
  a.source=a.source||'Manual';
  a.sourceActivityId=a.sourceActivityId??null;
  a.importFingerprint=v023ActivityFingerprint(a);
  a.canonicalActivityId=a.canonicalActivityId||`activity_${String(a.id??v023StableId('legacy',a.name,a.date,a.time))}`;
  a.updatedAt=a.updatedAt||a.createdAt||v023Now();
  return a;
}
function v023EnsureAchievementState(){
  state.achievementEngine=state.achievementEngine&&typeof state.achievementEngine==='object'?state.achievementEngine:{};
  const ae=state.achievementEngine;
  ae.unlockedAchievements=Array.isArray(ae.unlockedAchievements)?ae.unlockedAchievements:[];
  ae.processedAchievementEvents=Array.isArray(ae.processedAchievementEvents)?ae.processedAchievementEvents:[];
  ae.popupQueue=Array.isArray(ae.popupQueue)?ae.popupQueue:[];
  ae.secretConfig={percent:120,days:3,...(ae.secretConfig||{})};
  state.hydration=state.hydration&&typeof state.hydration==='object'?state.hydration:{};
  state.hydration.ledger=state.hydration.ledger&&typeof state.hydration.ledger==='object'?state.hydration.ledger:{};
  state.hydration.currentTargetStreak=Number(state.hydration.currentTargetStreak||0);
  state.hydration.targetDaysTotal=Number(state.hydration.targetDaysTotal||0);
  state.hydration.overTargetStreak=Number(state.hydration.overTargetStreak||0);
  state.hydration.over100Total=Number(state.hydration.over100Total||0);
  state.hydration.over100Streak=Number(state.hydration.over100Streak||0);
  state.hydration.over200Total=Number(state.hydration.over200Total||0);
  state.hydration.recoveryEvents=Array.isArray(state.hydration.recoveryEvents)?state.hydration.recoveryEvents:[];
  state.hydration.zeroToDoubleEver=Boolean(state.hydration.zeroToDoubleEver);
  /* ASTRA All-Approved Achievements install (2026-09-05) — additional
     Hydration counters, all derived from the SAME finalized ledger rows
     as the fields above; nothing here introduces a second day/calendar
     concept. See v023RebuildHydrationTestBatchCounters. */
  state.hydration.zeroStreak=Number(state.hydration.zeroStreak||0);
  state.hydration.hydrationOscillation4Ever=Boolean(state.hydration.hydrationOscillation4Ever);
  state.hydration.maxDailyPercentEver=Number(state.hydration.maxDailyPercentEver||0);
  state.hydration.exactAmountsEverLogged=Array.isArray(state.hydration.exactAmountsEverLogged)?state.hydration.exactAmountsEverLogged:[];
  state.hydration.manualResetCount=Number(state.hydration.manualResetCount||0);
  /* Sleep ledger — mirrors state.hydration.ledger exactly: a permanent,
     never-trimmed date-keyed record populated once per day from
     state.daily.sleep* and finalized once that date is in the past.
     resourceHistory is NOT reused here as the source of truth because
     it is capped at 90 rows (see dailyReset) and several approved Sleep
     achievements require cumulative counts up to 365 — a bounded window
     would silently lose progress. */
  state.sleep=state.sleep&&typeof state.sleep==='object'?state.sleep:{};
  state.sleep.ledger=state.sleep.ledger&&typeof state.sleep.ledger==='object'?state.sleep.ledger:{};
  state.sleep.goodCount=Number(state.sleep.goodCount||0);
  state.sleep.poorCount=Number(state.sleep.poorCount||0);
  state.sleep.targetMetCount=Number(state.sleep.targetMetCount||0);
  state.sleep.targetMetPoorCount=Number(state.sleep.targetMetPoorCount||0);
  state.sleep.missTargetGoodCount=Number(state.sleep.missTargetGoodCount||0);
  state.sleep.exceedTargetPoorCount=Number(state.sleep.exceedTargetPoorCount||0);
  state.sleep.under75PercentGoodCount=Number(state.sleep.under75PercentGoodCount||0);
  state.sleep.over125PercentPoorCount=Number(state.sleep.over125PercentPoorCount||0);
  state.sleep.exactTargetOkayCount=Number(state.sleep.exactTargetOkayCount||0);
  state.sleep.sexReasonCount=Number(state.sleep.sexReasonCount||0);
  state.sleep.masReasonCount=Number(state.sleep.masReasonCount||0);
  /* Training (Running / Gym & Strength) night-achievement counters —
     derived fresh from state.activities on every save, exactly like the
     Hydration counters are derived fresh from the ledger. No separate
     event log is kept; recomputation from completed activities is
     idempotent so nothing can double-count. */
  const trn=(typeof ensureTrainingState==='function')?ensureTrainingState():(state.training=state.training&&typeof state.training==='object'?state.training:{});
  trn.lateNightRunTotal=Number(trn.lateNightRunTotal||0);
  trn.midnightRunTotal=Number(trn.midnightRunTotal||0);
  trn.midnight5kEver=Boolean(trn.midnight5kEver);
  trn.midnight10kBetween0And4Ever=Boolean(trn.midnight10kBetween0And4Ever);
  trn.gymAfterHoursTotal=Number(trn.gymAfterHoursTotal||0);
  trn.gymMidnightTotal=Number(trn.gymMidnightTotal||0);
  return ae;
}
function v023EnsureState(){
  state.schemaVersion=Math.max(Number(state.schemaVersion||0),V023_SCHEMA_VERSION);
  state.sharedEvents=Array.isArray(state.sharedEvents)?state.sharedEvents.slice(-300):[];
  state.processedEventIds=Array.isArray(state.processedEventIds)?state.processedEventIds.slice(-500):[];
  state.stats=state.stats||{};
  Object.keys(STAT_NAMES).forEach(key=>{
    const s=state.stats[key]&&typeof state.stats[key]==='object'?state.stats[key]:(state.stats[key]={});
    const base=clamp(Number(s.baseValue??s.score??10),1,300);
    s.baseValue=base;
    // score is retained as a compatibility mirror only; all v0.02.4 progression reads/writes baseValue.
    s.score=base;
    s.xp=Math.max(0,Number(s.xp||0));
  });
  v023EnsureStatMilestones();
  state.activities=Array.isArray(state.activities)?state.activities.map(v023EnsureActivityIdentity):[];
  const t=ensureTrainingState();
  t.events=Array.isArray(t.events)?t.events.map(e=>{
    const activityId=e.activityId??null,metric=e.metric??'',date=e.date||todayISO(),source=e.source||'Manual';
    return {...e,eventId:e.eventId||e.id||v023StableId('trainingEvent',e.type,activityId,metric,e.newValue,date,source),id:e.id||e.eventId||v023StableId('trainingEvent',e.type,activityId,metric,e.newValue,date,source)};
  }).slice(-150):[];
  v023EnsureAchievementState();
  // Preserve legacy achievement data exactly; normalized engine history is additive.
  if(!Array.isArray(state.achievements))state.achievements=[];
  v023FinalizePriorHydrationRows();
  v023BackfillHydrationFromAuthoritativeHistory();
  v023RebuildHydrationCounters();
  v023FinalizePriorSleepRows();
  v023RebuildSleepCounters();
  state.version='0.02.4';
  return state;
}
function v023EventEnvelope(type,sourcePage,sourceItemId,payload={},eventId=null){
  const occurredAt=v023Now(),localDate=payload.date||todayISO();
  return {eventId:eventId||v023StableId('event',type,sourcePage,sourceItemId,localDate,JSON.stringify(payload)),type,occurredAt,localDate,sourcePage,sourceItemId,payload};
}
function v023RecordSharedEvent(event){
  if(!event?.eventId)return event;
  if(!state.sharedEvents.some(e=>e.eventId===event.eventId))state.sharedEvents.push(event);
  state.sharedEvents=state.sharedEvents.slice(-300);return event;
}
function v023ProcessOnce(consumer,eventId,fn){
  const key=`${consumer}:${eventId}`;
  state.processedEventIds=Array.isArray(state.processedEventIds)?state.processedEventIds:[];
  if(state.processedEventIds.includes(key))return false;
  fn();state.processedEventIds.push(key);state.processedEventIds=state.processedEventIds.slice(-500);return true;
}

/* ---------- Character Base / Effective ---------- */
function v023ModifierRecords(key){
  const c=state.character||{},mods=c.statModifiers||{};
  const records=[];
  const push=(sourceType,sourceId,amount,permanence='temporary')=>{amount=Number(amount||0);if(!Number.isFinite(amount)||amount===0)return;records.push({modifierId:v023StableId('mod',key,sourceType,sourceId),statId:key,amount,sourceType,sourceId:String(sourceId||sourceType),permanence,expiresAt:null})};
  const read=(value,sourceType,sourceId,permanence)=>{const n=numericSourceValue(value,key);if(n)push(sourceType,sourceId,n,permanence)};
  read(mods.equipment,'Equipment','character.equipment');read(state.equipment?.statModifiers,'Equipment','equipment.statModifiers');read(state.equipment?.modifiers,'Equipment','equipment.modifiers');
  read(mods.items,'Items','character.items','permanent');read(mods.permanent,'Permanent Bonus','character.permanent','permanent');read(state.items?.statModifiers,'Items','items.statModifiers','permanent');read(state.permanentBonuses,'Permanent Bonus','permanentBonuses','permanent');
  read(mods.skills,'Skills','character.skills');read(state.skills?.statModifiers,'Skills','skills.statModifiers');
  read(mods.potions,'Potions','character.potions');read(state.potions?.statModifiers,'Potions','potions.statModifiers');read(state.consumables?.statModifiers,'Potions','consumables.statModifiers');
  read(mods.buffs,'Buffs','character.buffs');read(state.buffs?.statModifiers,'Buffs','buffs.statModifiers');read(state.activeBuffs,'Buffs','activeBuffs');
  read(mods.other,'Other','character.other');read(state.statModifiers?.other,'Other','statModifiers.other');
  return records;
}
statSources=function(key){
  const base=v023BaseStat(key),records=v023ModifierRecords(key),sum=type=>records.filter(r=>r.sourceType===type).reduce((n,r)=>n+r.amount,0);
  return {base,earned:base,equipment:sum('Equipment'),items:sum('Items')+sum('Permanent Bonus'),skills:sum('Skills'),potions:sum('Potions'),buffs:sum('Buffs'),other:sum('Other'),records};
};
displayedStat=function(key){const src=statSources(key);return Math.max(1,Math.round(src.base+src.records.reduce((n,r)=>n+r.amount,0)))};
addStatXP=function(key,amount){
  const s=state.stats?.[key];if(!s)return;
  s.baseValue=v023BaseStat(key);
  if(s.baseValue>=300){s.baseValue=300;s.score=300;s.xp=0;v023EnsureStatMilestones();return}
  s.xp=Math.max(0,Number(s.xp||0))+Math.max(0,Number(amount||0));
  let cost=statCost(s.baseValue);
  while(s.baseValue<300&&s.xp>=cost){s.xp-=cost;s.baseValue+=1;cost=statCost(s.baseValue)}
  if(s.baseValue>=300){s.baseValue=300;s.xp=0}
  s.score=s.baseValue;v023EnsureStatMilestones();
};
statCardHTML=function(key){
  const s=state.stats[key]||{baseValue:10,xp:0},base=v023BaseStat(key),effective=displayedStat(key),modTotal=effective-base,cost=statCost(base),progress=pct(s.xp,cost),next=[100,200,300].find(x=>x>base)||300,milePct=base>=300?100:Math.round((base/(next||300))*100);
  return `<button type="button" class="character-stat-card v023-stat-card" data-stat="${key}" aria-label="Open ${esc(STAT_LONG[key])} breakdown"><div class="character-stat-top"><img src="${characterStatAsset(key)}" alt=""><div><span>${STAT_NAMES[key]}</span><b>${effective}</b></div><strong>${modifier(effective)}</strong></div><div class="character-stat-name">${esc(STAT_LONG[key])}</div><div class="v023-stat-values"><span>BASE <b>${base}</b></span><span>EFFECTIVE <b>${effective}</b></span><span>MOD <b>${modTotal>=0?'+':''}${modTotal}</b></span></div><div class="character-stat-xp"><span>${Math.round(s.xp)} / ${cost} XP</span><div class="character-stat-progress"><i style="--p:${progress}"></i></div></div><div class="v023-milestone-progress"><span>NEXT BASE MILESTONE ${base>=300?'MAX':next}</span><div class="character-stat-progress"><i style="--p:${milePct}"></i></div></div></button>`;
};
statBreakdownModal=function(key){
  if(!STAT_NAMES[key])return;const s=state.stats[key]||{xp:0},src=statSources(key),base=v023BaseStat(key),effective=displayedStat(key),cost=statCost(base),records=src.records;
  modal(`<div class="stat-breakdown v023-stat-breakdown"><div class="stat-breakdown-title"><img src="${characterStatAsset(key)}" alt=""><div><span>${esc(STAT_LONG[key]).toUpperCase()}</span><b>BASE ${base} · EFFECTIVE ${effective}</b><small>Total modifier ${effective-base>=0?'+':''}${effective-base}</small></div></div><div class="stat-source-list"><div class="stat-source-row earned"><div><b>Earned / Base</b><small>Permanent progression</small></div><strong>${base}</strong></div>${records.length?records.map(r=>`<div class="stat-source-row"><div><b>${esc(r.sourceType)}</b><small>${esc(r.sourceId)} · ${esc(r.permanence||'temporary')}</small></div><strong>${r.amount>=0?'+':''}${Math.round(r.amount)}</strong></div>`).join(''):'<div class="stat-source-row"><div><b>No active modifiers</b><small>Effective equals Base</small></div><strong>+0</strong></div>'}</div><div class="stat-breakdown-xp"><span>Current Base Stat XP</span><b>${Math.round(s.xp)} / ${cost}</b><div class="character-stat-progress"><i style="--p:${pct(s.xp,cost)}"></i></div></div></div>`);
};
const v023OriginalBindCharacter=bindCharacter;
bindCharacter=function(){
  v023OriginalBindCharacter();
  const skills=document.querySelector('#skillsBtn');if(skills)skills.onclick=()=>{
    const pending=v023UnclaimedMilestones();
    modal(`<h2>Skills</h2><p class="helper"><b>Character owns milestone Skills progression.</b> The 100/200/300 choice catalogue is intentionally deferred.</p>${pending.length?`<div class="v023-milestone-list">${pending.map(m=>`<div class="list-item"><div>✦</div><div><h3>${STAT_NAMES[m.stat]} ${m.threshold}</h3><p>Milestone reached with Base ${STAT_LONG[m.stat]}. Three approved choices are still required before a claim can be made.</p></div><span class="tag quest">Unclaimed</span></div>`).join('')}</div>`:'<div class="empty">No unclaimed stat milestones.</div>'}`);
  };
};
const v023OriginalRenderCharacter=renderCharacter;
renderCharacter=function(){
  v023EnsureState();v023OriginalRenderCharacter();
  const pending=v023UnclaimedMilestones();const title=document.querySelector('.character-section-title');
  if(pending.length&&title&&!document.querySelector('.v023-milestone-notice'))title.insertAdjacentHTML('beforebegin',`<button class="v023-milestone-notice" id="v023MilestoneNotice"><b>${pending.length} STAT MILESTONE${pending.length===1?'':'S'} READY</b><span>Open Skills to review unclaimed 100/200/300 thresholds.</span></button>`);
  const notice=document.querySelector('#v023MilestoneNotice');if(notice)notice.onclick=()=>document.querySelector('#skillsBtn')?.click();
};

/* ---------- Canonical Training identity + normalized events ---------- */
function v023IngestActivity(input={}){
  v023EnsureState();const fingerprint=v023ActivityFingerprint(input);
  if(fingerprint){const existing=state.activities.find(a=>a.importFingerprint===fingerprint||(input.sourceActivityId&&a.source===input.source&&String(a.sourceActivityId)===String(input.sourceActivityId)));if(existing){const protectedState={id:existing.id,canonicalActivityId:existing.canonicalActivityId,completed:existing.completed,xpAwarded:existing.xpAwarded};Object.assign(existing,input,protectedState,{importFingerprint:fingerprint,updatedAt:v023Now()});return {created:false,activity:existing}}}
  const activity=v023EnsureActivityIdentity({id:input.id||uid(),source:'Manual',completed:false,xpAwarded:false,startedAt:null,sportData:{},...input});state.activities.push(activity);return {created:true,activity};
}
bindAddActivity=function(){modalRoot.querySelector('#saveActivity').onclick=()=>{const v=readActivityEditor();if(!v.name){toast('Give the activity a name.');return}v023IngestActivity({...v,source:'Manual'});save();closeModal();toast('Activity added.');render()}};
handleTrainingAchievementEvent=function(){return false};
unlockTrainingAchievement=function(){return false};
emitTrainingEvent=function(type,detail={}){
  const t=ensureTrainingState(),activityId=detail.activityId??null,date=detail.date||todayISO(),source=detail.source||'Manual',eventId=detail.eventId||v023StableId('trainingEvent',type,activityId,detail.metric||'',detail.previousValue,detail.newValue,date,source);
  const existing=t.events.find(e=>(e.eventId||e.id)===eventId);if(existing)return existing;
  const event={id:eventId,eventId,type,date,activityId,activityType:detail.activityType||'Other',metric:detail.metric||'',previousValue:detail.previousValue??null,newValue:detail.newValue??null,source,...detail};
  t.events.push(event);t.events=t.events.slice(-150);
  v023RecordSharedEvent(v023EventEnvelope(type,'training',activityId,event,eventId));
  return event;
};

/* ---------- Shared source-linked schedule projections ---------- */
function v023ScheduleProjection(a){
  v023EnsureActivityIdentity(a);const occurrenceId=a.recurrenceOccurrenceId||a.date||todayISO();
  return {eventId:`schedule_training_${a.canonicalActivityId}_${occurrenceId}`,sourcePage:'training',sourceItemId:a.canonicalActivityId,legacyActivityId:a.id,title:a.name,date:a.date,startTime:a.time||'',duration:Number(a.duration||0),recurrence:a.recurrence||null,occurrenceId,status:a.completed?'complete':'planned',category:a.type||'Training'};
}
function v023ScheduleProjections(date=null){return state.activities.filter(a=>!date||a.date===date).map(v023ScheduleProjection)}
/* Refactored onto sharedScheduleItemsForDate (Phase 3B.3, app.js) —
   these two overrides were the ACTUALLY ACTIVE implementations at
   runtime (this file loads after app.js and reassigns both globals),
   so this is the genuine behavior change, not a cosmetic edit of dead
   originals. v023ScheduleProjections itself is untouched and stays in
   use by v023AppendLinkedSchedule/v023ActivityForProjection below — that
   bespoke editable "Linked Training Schedule" list (with its own per-
   item edit/move/complete/delete actions keyed by eventId) is a
   genuinely different, interactive feature from the read-only schedule
   feed family and is out of scope for this refactor. This also fixes a
   real pre-existing bug: this scheduleItems override ignored its date
   argument entirely and always read today(); the shared aggregator is
   correctly parameterized, so an arbitrary date now actually works. */
/* Bucketing fix (Phase 3B.7 QA) — this is the actually-live override
   (app.js's own calendarEventsFor is shadowed by this reassignment), so
   the same fix has to land here. Only recognized 'task'/'activity'/
   'quest' kinds; the 'personalGrowth' and 'mainQuest' kinds
   sharedScheduleItemsForDate started emitting in Phase 3B.3 were
   silently dropped, so neither ever produced a dot on the Adventurer's
   Log week/month calendar even though every other consumer
   (scheduleItems/scheduleHTML, the Home Today panel) already showed
   them correctly. Folded into the existing 'activities' dot bucket
   rather than inventing a new dot style/color. */
calendarEventsFor=function(date){
  const items=sharedScheduleItemsForDate(date);
  return {tasks:items.filter(i=>i.kind==='task'),activities:items.filter(i=>['activity','mainQuest','personalGrowth'].includes(i.kind)),quest:items.some(i=>i.kind==='quest')?1:0};
};
scheduleItems=function(t=todayISO()){return sharedScheduleItemsForDate(t)};
function v023ActivityForProjection(eventId){const p=v023ScheduleProjections().find(x=>x.eventId===eventId);return p?state.activities.find(a=>a.id===p.legacyActivityId):null}
function v023AppendLinkedSchedule(){
  if(page!=='adventurers-log'||document.querySelector('.v023-linked-training'))return;const anchor=document.querySelector('.priority-grid');if(!anchor)return;const projections=v023ScheduleProjections().sort((a,b)=>String(a.date+a.startTime).localeCompare(String(b.date+b.startTime)));
  anchor.insertAdjacentHTML('beforebegin',`<h2 class="section-title v023-linked-title">Linked Training Schedule</h2><section class="rpg-frame minor v023-linked-training">${projections.length?projections.slice(0,12).map(p=>`<div class="list-item"><div class="v023-source-pill">TRAINING</div><div><h3>${esc(p.title)}</h3><p>${fmtShort(p.date)} · ${esc(p.startTime||'Any time')} · ${esc(p.category)} · ${p.status}</p></div><div class="list-actions"><button class="text-btn" data-v023-edit="${esc(p.eventId)}">Edit</button><button class="text-btn" data-v023-move="${esc(p.eventId)}">Move</button><button class="text-btn accent" data-v023-complete="${esc(p.eventId)}">${p.status==='complete'?'Reopen':'Complete'}</button><button class="text-btn danger" data-v023-delete="${esc(p.eventId)}">Delete</button></div></div>`).join(''):'<div class="empty">No Training sessions scheduled.</div>'}</section>`);
  document.querySelectorAll('[data-v023-edit]').forEach(b=>b.onclick=()=>{const a=v023ActivityForProjection(b.dataset.v023Edit);if(a)editActivityModal(a.id)});
  document.querySelectorAll('[data-v023-move]').forEach(b=>b.onclick=()=>{const a=v023ActivityForProjection(b.dataset.v023Move);if(a)moveActivityModal(a.id)});
  document.querySelectorAll('[data-v023-complete]').forEach(b=>b.onclick=()=>{const a=v023ActivityForProjection(b.dataset.v023Complete);if(a)toggleActivity(a.id)});
  document.querySelectorAll('[data-v023-delete]').forEach(b=>b.onclick=()=>{const a=v023ActivityForProjection(b.dataset.v023Delete);if(!a)return;if(confirm(`Delete ${a.name}?`)){state.activities=state.activities.filter(x=>x.id!==a.id);save();renderTasks()}});
}
const v023OriginalRenderTasks=renderTasks;
renderTasks=function(){v023OriginalRenderTasks();v023AppendLinkedSchedule()};

/* Main Quest achievement content (Phase 3B.6 — infrastructure only,
   2026-09-12). Deliberately empty: this phase wires the trigger/event
   plumbing (see v023UpdateMainQuestAchievementsFromDaily and the
   mainQuest* triggerType branches in v023DefinitionSatisfied below) so
   future definitions can be added here and picked up by the existing
   evaluator with zero further wiring — same shape as
   V023_ACHIEVEMENT_DEFINITIONS entries (achievementId/category/type/
   rarity/name/description/triggerType/triggerValue/...). Kept as its
   own array rather than pushed into V023_ACHIEVEMENT_DEFINITIONS so
   choosing a `category` value never has to touch the open "Quests" vs
   "Adventure" achievement-category naming question — that stays
   unresolved on purpose. No rarity/title/description/reward content
   decided here. */
const V023_MAINQUEST_DEFINITIONS=[];

/* ---------- Generic Achievement engine + Hydration pilot ---------- */
const V023_ACHIEVEMENT_DEFINITIONS=[
  {achievementId:'hydration_first_sip',category:'hydration',type:'positive',rarity:'Common',name:'First Sip',description:'Hit your Water target for one day.',triggerType:'targetDaysTotal',triggerValue:1,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Common_First_Sip.png`,frameAsset:null,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_well_watered',category:'hydration',type:'positive',rarity:'Uncommon',name:'Well Watered',description:'Hit your Water target for 3 consecutive days.',triggerType:'targetStreak',triggerValue:3,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Uncommon_Well_Watered.png`,frameAsset:null,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_hydration_habit',category:'hydration',type:'positive',rarity:'Rare',name:'Hydration Habit',description:'Hit your Water target for 7 consecutive days.',triggerType:'targetStreak',triggerValue:7,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Rare_Hydration_Habit.png`,frameAsset:null,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_river_runner',category:'hydration',type:'positive',rarity:'Epic',name:'River Runner',description:'Hit your Water target on 30 total days.',triggerType:'targetDaysTotal',triggerValue:30,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Epic_River_Runner.png`,frameAsset:null,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_the_human_reservoir',category:'hydration',type:'positive',rarity:'Legendary',name:'The Human Reservoir',description:'Hit your Water target on 100 total days.',triggerType:'targetDaysTotal',triggerValue:100,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Legendary_The_Human_Reservoir.png`,frameAsset:null,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_ocean_in_mortal_form',category:'hydration',type:'positive',rarity:'Mythic',name:'Ocean in Mortal Form',description:'Hit your Water target on 365 total days.',triggerType:'targetDaysTotal',triggerValue:365,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Mythic_Ocean_in_Mortal_Form.png`,frameAsset:null,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_is_this_mostly_water_now',category:'hydration',type:'positive',rarity:'Secret',name:'Is This Mostly Water Now?',description:'Reach the configured over-target threshold for the configured consecutive-day requirement.',triggerType:'overTargetStreak',triggerValue:3,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Secret_Is_This_Mostly_Water_Now.png`,frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,isSecret:true,revealAnimation:null}
];
/* Hydration Achievement Live Test Batch (2026-09-05) — the exact 8
   permanent IDs from ACHIEVEMENT_TEST_BATCH.json, appended (not
   inlined above) so the original 7-entry literal stays byte-for-byte
   untouched. Placeholder badge for all 8 per the batch's asset
   manifest — no final art exists for these yet, none should be
   generated in this pass. Hidden ones reuse the existing Secret frame
   asset (same visual treatment as hydration_is_this_mostly_water_now),
   consistent with the pre-existing convention rather than a new one. */
const V023_ACHIEVEMENT_PLACEHOLDER_ICON='Achievements/achievement_placeholder_not_ready_yet.png';
const V023_HYDRATION_TEST_BATCH_DEFINITIONS=[
  {achievementId:'HYD-HID-001',category:'hydration',type:'positive',rarity:'Uncommon',name:'Bonus Moisture',description:'Exceed the daily hydration target once.',systemMessage:'You have exceeded the recommended amount. Efficient.',series:'Over-Hydration',triggerType:'over100Total',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-HID-001-bonus-moisture.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-HID-002',category:'hydration',type:'positive',rarity:'Rare',name:'Well Watered',description:'Exceed the hydration target three completed days in a row.',systemMessage:'Hydration reserves are now suspiciously healthy.',series:'Over-Hydration',triggerType:'over100Streak',triggerValue:3,iconAsset:'Achievements/Hydration/Positive/HYD-HID-002-well-watered.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-HID-005',category:'hydration',type:'positive',rarity:'Celestial',name:'Are You Sure You’re Not Drowning?!?',description:'Reach 200% of the daily hydration target in one completed day.',systemMessage:'Two hundred percent. Are you sure you’re not drowning?!?',series:'Over-Hydration',triggerType:'over200Total',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-HID-005-are-you-sure-you-re-not-drowning.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-COM-001',category:'hydration',type:'positive',rarity:'Legendary',name:'Hydration Whiplash',description:'Go from no hydration logged to double the hydration target on consecutive completed days.',systemMessage:'Yesterday: desert. Today: flood. Pick a biome.',series:'Hydration Reversal',triggerType:'crossDayZeroToDouble',triggerValue:1,iconAsset:'Achievements/Hydration/Combination/HYD-COM-001-hydration-whiplash.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RES-001',category:'hydration',type:'positive',rarity:'Common',name:'Oh, So NOW You Remember Water',description:'Recover immediately after missing the hydration target for one completed day.',systemMessage:'Congratulations. The basic survival mechanic has been rediscovered.',series:'Hydration Recovery',triggerType:'recoveryMissedStreak',triggerValue:1,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-001-oh-so-now-you-remember-water.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-RES-002',category:'hydration',type:'positive',rarity:'Uncommon',name:'Emergency Moisture Deployment',description:'Restore the hydration target after at least two consecutive missed completed days.',systemMessage:'Critical systems restored. Mammal status temporarily retained.',series:'Hydration Recovery',triggerType:'recoveryMissedStreak',triggerValue:2,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-002-emergency-moisture-deployment.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-RES-003',category:'hydration',type:'positive',rarity:'Rare',name:'The Drought Has Been Cancelled',description:'End a hydration drought of at least three consecutive completed days.',systemMessage:'Local authorities report the return of fluids.',series:'Hydration Recovery',triggerType:'recoveryMissedStreak',triggerValue:3,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-003-the-drought-has-been-cancelled.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-RES-004',category:'hydration',type:'positive',rarity:'Epic',name:'Revenge of the Moist',description:'Return to full hydration after a missed-target streak of at least seven completed days.',systemMessage:'You were dry. You were crusty. You have chosen vengeance.',series:'Hydration Recovery',triggerType:'recoveryMissedStreak',triggerValue:7,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-004-revenge-of-the-moist.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_HYDRATION_TEST_BATCH_DEFINITIONS);
/* ASTRA "All Approved Achievements" install (2026-09-05) — Hydration
   rows from RPG - Achievement Design Register with Design Status ===
   Approved that were not already covered by the Live Test Batch above.
   Same registry, same engine, same placeholder-art convention (no final
   art exists yet for any of these — Art Status is "Not Started" for
   every row in the source register). Exact IDs/names/rarities/messages
   copied verbatim from cat_Hydration.json. */
const V023_HYDRATION_ALL_APPROVED_DEFINITIONS=[
  {achievementId:'HYD-NEG-001',category:'hydration',type:'negative',rarity:'Uncommon',name:'It’s Thick… Like Syrup',description:'Finish a completed day with no water logged.',systemMessage:'You logged no water today. Certain fluids are beginning to concern us.',series:'Zero-Water Streak',triggerType:'zeroStreak',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-001-it-s-thick-like-syrup.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-002',category:'hydration',type:'negative',rarity:'Rare',name:'Human Jerky',description:'Complete three consecutive days with no water logged.',systemMessage:'Moisture content has dropped below recommended mammal levels.',series:'Zero-Water Streak',triggerType:'zeroStreak',triggerValue:3,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-002-human-jerky.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-003',category:'hydration',type:'negative',rarity:'Epic',name:'Are You Just Pissing Sand?!',description:'Complete five consecutive days with no water logged.',systemMessage:'Five days. No water. Are you just pissing sand?!',series:'Zero-Water Streak',triggerType:'zeroStreak',triggerValue:5,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-003-are-you-just-pissing-sand.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-004',category:'hydration',type:'negative',rarity:'Legendary',name:'Mummification Is Setting In',description:'Complete ten consecutive days with no water logged.',systemMessage:'Ten days. The preservation process appears to have begun.',series:'Zero-Water Streak',triggerType:'zeroStreak',triggerValue:10,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-004-mummification-is-setting-in.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-005',category:'hydration',type:'negative',rarity:'Legendary',name:'Dust in the Wind',description:'Complete thirty consecutive days with no water logged.',systemMessage:'All we are is dust in the wind. You appear to be proving the point.',series:'Zero-Water Streak',triggerType:'zeroStreak',triggerValue:30,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-005-dust-in-the-wind.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-HID-003',category:'hydration',type:'positive',rarity:'Epic',name:'Aquatic Tendencies',description:'Exceed the hydration target seven completed days in a row.',systemMessage:'The distinction between mammal and amphibian is narrowing.',series:'Over-Hydration',triggerType:'over100Streak',triggerValue:7,iconAsset:'Achievements/Hydration/Positive/HYD-HID-003-aquatic-tendencies.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-HID-004',category:'hydration',type:'positive',rarity:'Legendary',name:'Internal Reservoir',description:'Exceed the hydration target fourteen completed days in a row.',systemMessage:'At this point you may contain your own watershed.',series:'Over-Hydration',triggerType:'over100Streak',triggerValue:14,iconAsset:'Achievements/Hydration/Positive/HYD-HID-004-internal-reservoir.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RES-005',category:'hydration',type:'positive',rarity:'Legendary',name:'Somehow, Still a Mammal',description:'Recover from a major hydration slump and sustain the comeback for three completed days.',systemMessage:'Against medical, biological, and administrative expectations, hydration has resumed.',series:'Hydration Recovery',triggerType:'recoverySustained',missedThreshold:10,triggerValue:3,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-005-somehow-still-a-mammal.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-RES-006',category:'hydration',type:'positive',rarity:'Celestial',name:'Unwrap Me, I’m Moist',description:'Return from an extreme hydration slump and sustain full hydration for seven completed days.',systemMessage:'Preservation status revoked. Please stop dripping on the sarcophagus.',series:'Hydration Recovery',triggerType:'recoverySustained',missedThreshold:30,triggerValue:7,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-006-unwrap-me-i-m-moist.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-COM-002',category:'hydration',type:'positive',rarity:'Epic',name:'Human Cactus',description:'Alternate between no hydration logged and hitting the hydration target across four completed days.',systemMessage:'Water storage appears intermittent. Photosynthesis remains unconfirmed.',series:'Hydration Oscillation',triggerType:'hydrationOscillation4',triggerValue:1,iconAsset:'Achievements/Hydration/Combination/HYD-COM-002-human-cactus.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-001',category:'hydration',type:'positive',rarity:'Rare',name:'Sure You Did',description:'Log a suspiciously high hydration total in a single completed day.',systemMessage:'Absolutely. Completely believable. The System has no further questions.',series:'Suspicious Logging',triggerType:'maxDailyPercentEver',triggerValue:250,iconAsset:'Achievements/Hydration/Random/HYD-RND-001-sure-you-did.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-002',category:'hydration',type:'positive',rarity:'Epic',name:'Waterboarded by Statistics',description:'Log an absurdly high hydration total in a single completed day.',systemMessage:'Either you are cheating or we need to notify the coast guard.',series:'Suspicious Logging',triggerType:'maxDailyPercentEver',triggerValue:400,iconAsset:'Achievements/Hydration/Random/HYD-RND-002-waterboarded-by-statistics.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-003',category:'hydration',type:'positive',rarity:'Legendary',name:'Ocean in a Bottle',description:'Log a hydration amount that has stopped pretending to be plausible.',systemMessage:'You did not drink this. You imported a small inland sea.',series:'Suspicious Logging',triggerType:'maxDailyPercentEver',triggerValue:600,iconAsset:'Achievements/Hydration/Random/HYD-RND-003-ocean-in-a-bottle.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-004',category:'hydration',type:'positive',rarity:'Celestial',name:'Nice Try, Aquaman',description:'Enter a hydration total so extreme that the System openly questions the data.',systemMessage:'Achievement denied by biology. Comedy achievement granted instead.',series:'Suspicious Logging',triggerType:'maxDailyPercentEver',triggerValue:1000,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-005',category:'hydration',type:'positive',rarity:'Rare',name:'Hydration of the Beast',description:'Finish a day on the most ominous possible hydration number.',systemMessage:'The number is concerning. The amount of water is less so.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:666,iconAsset:'Achievements/Hydration/Random/HYD-RND-005-hydration-of-the-beast.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-006',category:'hydration',type:'positive',rarity:'Common',name:'One Litre Later',description:'Finish a completed day on a perfectly round one-litre total.',systemMessage:'A suspiciously round number. The System approves.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:1000,iconAsset:'Achievements/Hydration/Random/HYD-RND-006-one-litre-later.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-007',category:'hydration',type:'positive',rarity:'Rare',name:'L33T Hydration',description:'Finish the day on a classic internet-number hydration total.',systemMessage:'Ancient internet magic has entered the bloodstream.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:1337,iconAsset:'Achievements/Hydration/Random/HYD-RND-007-l33t-hydration.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-008',category:'hydration',type:'positive',rarity:'Uncommon',name:'Perfectly Balanced',description:'Finish the day on an exact two-litre hydration total.',systemMessage:'Two litres. Clean. Predictable. Disturbingly responsible.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:2000,iconAsset:'Achievements/Hydration/Random/HYD-RND-008-perfectly-balanced.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-009',category:'hydration',type:'positive',rarity:'Rare',name:'Water Not Found',description:'Finish the day on a hydration total that looks like an error code.',systemMessage:'Hydration request returned an error.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:404,iconAsset:'Achievements/Hydration/Random/HYD-RND-009-water-not-found.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-010',category:'hydration',type:'positive',rarity:'Rare',name:'Highly Hydrated',description:'Finish the day on exactly 420 ml.',systemMessage:'The System refuses to elaborate.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:420,iconAsset:'Achievements/Hydration/Random/HYD-RND-010-highly-hydrated.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-011',category:'hydration',type:'positive',rarity:'Epic',name:'Nice.',description:'Finish the day on exactly 69 ml for reasons the System will not dignify.',systemMessage:'Nice.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:69,iconAsset:'Achievements/Hydration/Random/HYD-RND-011-nice.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-012',category:'hydration',type:'positive',rarity:'Uncommon',name:'So Close',description:'Finish the day exactly one millilitre short of a litre.',systemMessage:'One millilitre away. This was a choice.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:999,iconAsset:'Achievements/Hydration/Random/HYD-RND-012-so-close.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-013',category:'hydration',type:'positive',rarity:'Rare',name:'Hydration Sequence',description:'Finish a completed day on the sequential total 1234 ml.',systemMessage:'Order has been imposed upon the fluids.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:1234,iconAsset:'Achievements/Hydration/Random/HYD-RND-013-hydration-sequence.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-014',category:'hydration',type:'positive',rarity:'Epic',name:'I Love You 3000',description:'Finish the day on exactly three litres.',systemMessage:'Three thousand millilitres. The System loves you 3000. Please do not make this emotional.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:3000,iconAsset:'Achievements/Hydration/Random/HYD-RND-014-i-love-you-3000.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-015',category:'hydration',type:'positive',rarity:'Uncommon',name:'Ctrl+Alt+Dehydrate',description:'Manually reset the Hydration resource tracker.',systemMessage:'Hydration process terminated. Please restart the mammal.',series:'Resource Reset',triggerType:'manualResetCount',triggerValue:1,iconAsset:'Achievements/Hydration/Random/HYD-RND-015-ctrl-alt-dehydrate.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_HYDRATION_ALL_APPROVED_DEFINITIONS);
/* Hydration Consistency + Neglect series (Achievement Design Register,
   approved 2026-09-08). The register's own "Technical Hydration"
   sub-series, HYD-POS-011..015 and HYD-NEG-016..020, is defined
   separately below (V023_HYDRATION_TECHNICAL_DEFINITIONS) — it was
   flagged back rather than implemented here originally, since it needs
   fluid-source data state.daily.water (a single opaque ml total) could
   not provide; that gap was closed by the fluid-source logging feature
   added 8 September 2026. Consistency (POS-001..010) reuses the
   existing targetDaysTotal/targetStreak triggers unchanged (same ones
   the original 7 hand-illustrated achievements already use); Neglect
   (NEG-006..015) uses the new missedTotal/missedStreak/
   missedFiveInSevenEver/under50PercentEver triggers added above,
   derived from the existing hydration ledger — no new raw tracking. */
const V023_HYDRATION_CONSISTENCY_NEGLECT_DEFINITIONS=[
  {achievementId:'HYD-POS-001',category:'hydration',type:'positive',rarity:'Common',name:'A Sip Counts',description:'Meet the hydration target for the first time.',systemMessage:'The organism has discovered water.',series:'Consistency',triggerType:'targetDaysTotal',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-002',category:'hydration',type:'positive',rarity:'Common',name:'Still Moist',description:'Maintain the hydration target for three days.',systemMessage:'Unexpectedly, you remain moist.',series:'Consistency',triggerType:'targetStreak',triggerValue:3,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-003',category:'hydration',type:'positive',rarity:'Uncommon',name:'Basic Irrigation',description:'Maintain the hydration target for seven days.',systemMessage:'Basic irrigation procedures successful.',series:'Consistency',triggerType:'targetStreak',triggerValue:7,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-004',category:'hydration',type:'positive',rarity:'Uncommon',name:'Watered Regularly',description:'Maintain the hydration target for fourteen days.',systemMessage:'Routine watering appears effective.',series:'Consistency',triggerType:'targetStreak',triggerValue:14,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-005',category:'hydration',type:'positive',rarity:'Rare',name:'Thriving, Disturbingly',description:'Maintain the hydration target for thirty days.',systemMessage:'This is becoming suspiciously competent.',series:'Consistency',triggerType:'targetStreak',triggerValue:30,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-006',category:'hydration',type:'positive',rarity:'Rare',name:'Hydration Habit',description:'Maintain the hydration target for sixty days.',systemMessage:'The water thing may actually have stuck.',series:'Consistency',triggerType:'targetStreak',triggerValue:60,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-007',category:'hydration',type:'positive',rarity:'Epic',name:'Self-Watering Mammal',description:'Maintain the hydration target for one hundred days.',systemMessage:'Autonomous hydration system online.',series:'Consistency',triggerType:'targetStreak',triggerValue:100,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-008',category:'hydration',type:'positive',rarity:'Legendary',name:'Industrial Irrigation',description:'Maintain the hydration target for one hundred eighty days.',systemMessage:'Domestic hydration has entered industrial scale.',series:'Consistency',triggerType:'targetStreak',triggerValue:180,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-009',category:'hydration',type:'positive',rarity:'Legendary',name:'Aquatic Discipline',description:'Maintain the hydration target for two hundred seventy days.',systemMessage:'At this point, dehydration would require planning.',series:'Consistency',triggerType:'targetStreak',triggerValue:270,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-010',category:'hydration',type:'positive',rarity:'Celestial',name:'Human Houseplant',description:'Maintain the hydration target for a full year.',systemMessage:'One year of successful mammalian irrigation.',series:'Consistency',triggerType:'targetStreak',triggerValue:365,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-006',category:'hydration',type:'negative',rarity:'Common',name:'Dry Spell',description:'Miss the hydration target for a completed day.',systemMessage:'Water remains technically available.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-006-dry-spell.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-007',category:'hydration',type:'negative',rarity:'Common',name:'Thirst Trap',description:'Miss the hydration target for two consecutive completed days.',systemMessage:'This is not what that phrase means.',series:'Hydration Neglect',triggerType:'missedStreak',triggerValue:2,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-007-thirst-trap.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-008',category:'hydration',type:'negative',rarity:'Common',name:'Human Raisin',description:'Miss the hydration target for three consecutive completed days.',systemMessage:'Moisture levels are becoming theoretical.',series:'Hydration Neglect',triggerType:'missedStreak',triggerValue:3,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-008-human-raisin.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-009',category:'hydration',type:'negative',rarity:'Uncommon',name:'The Sahara Calls',description:'Miss the hydration target on five completed days within a seven-day window.',systemMessage:'It would like its climate back.',series:'Hydration Neglect',triggerType:'missedFiveInSevenEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-009-the-sahara-calls.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-010',category:'hydration',type:'negative',rarity:'Uncommon',name:'Water Is Apparently Optional',description:'Finish a completed day below 50% of the hydration target.',systemMessage:'Bold biological strategy.',series:'Hydration Neglect',triggerType:'under50PercentEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-010-water-is-apparently-optional.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-011',category:'hydration',type:'negative',rarity:'Rare',name:'Dehydration Enthusiast',description:'Miss the hydration target on ten completed days in total.',systemMessage:'Consistency has been achieved. Unfortunately.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:10,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-011-dehydration-enthusiast.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-012',category:'hydration',type:'negative',rarity:'Rare',name:'Moisture Resistant',description:'Miss the hydration target on twenty-five completed days in total.',systemMessage:'Your commitment to dryness is impressive.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:25,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-012-moisture-resistant.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-013',category:'hydration',type:'negative',rarity:'Epic',name:'Certified Dust Person',description:'Miss the hydration target on fifty completed days in total.',systemMessage:'Please stop shedding sand indoors.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:50,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-013-certified-dust-person.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-014',category:'hydration',type:'negative',rarity:'Epic',name:'Hydrophobic Mammal',description:'Miss the hydration target on one hundred completed days in total.',systemMessage:'Evolution is reviewing your paperwork.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:100,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-014-hydrophobic-mammal.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-015',category:'hydration',type:'negative',rarity:'Legendary',name:'Enemy of Water',description:'Miss the hydration target on two hundred fifty completed days in total.',systemMessage:'The oceans have been informed.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:250,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-015-enemy-of-water.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_HYDRATION_CONSISTENCY_NEGLECT_DEFINITIONS);
/* Technical Hydration series (HYD-POS-011..015, HYD-NEG-016..020) —
   ASTRA handover from Nox, 8 September 2026: approved rule is 1 ml of
   any listed non-alcoholic fluid = 1 ml hydration credit, no
   physiological weighting. Triggers read the *Ever boolean flags
   computed per finalized day in v023RebuildHydrationTestBatchCounters
   from the fluid-source fields on each ledger row (see
   v023UpdateHydrationFromDaily and resourceModal('water') in app.js).
   All ten rows are Hidden per the register's own Hidden? column. */
const V023_HYDRATION_TECHNICAL_DEFINITIONS=[
  {achievementId:'HYD-POS-011',category:'hydration',type:'positive',rarity:'Common',name:'Coffee Is Mostly Water',description:'Reach the hydration target on a day that includes coffee as part of valid fluid intake.',systemMessage:'Technically, coffee contains water. The System hates that you are correct.',series:'Technical Hydration',triggerType:'coffeeTargetMetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-011-coffee-is-mostly-water.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-POS-012',category:'hydration',type:'positive',rarity:'Uncommon',name:'Hydration With Benefits',description:'Meet the daily hydration target while at least a quarter comes from valid alternative fluids.',systemMessage:'Water acquired. Other beverages were smuggled in alongside it.',series:'Technical Hydration',triggerType:'nonWater25PlusTargetMetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-012-hydration-with-benefits.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-POS-013',category:'hydration',type:'positive',rarity:'Rare',name:'Technically Hydrated',description:'Reach the daily target with the majority supplied by other valid fluids.',systemMessage:'The hydration requirement has been met through technical compliance. Annoyingly, this is valid.',series:'Technical Hydration',triggerType:'plainWaterUnder50TargetMetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-013-technically-hydrated.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-POS-014',category:'hydration',type:'positive',rarity:'Epic',name:'Suspiciously Legal Hydration',description:'Meet the hydration target while plain water contributes no more than one quarter.',systemMessage:'The hydration requirement has been met through an alarming amount of technicality.',series:'Technical Hydration',triggerType:'plainWaterUnder25TargetMetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-014-suspiciously-legal-hydration.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-POS-015',category:'hydration',type:'positive',rarity:'Legendary',name:'Water Is a Technicality',description:'Meet the full daily hydration target entirely through other valid fluids.',systemMessage:'No plain water. Full hydration. The System reviewed the rules and is deeply annoyed.',series:'Technical Hydration',triggerType:'zeroPlainWaterTargetMetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-015-water-is-a-technicality.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-016',category:'hydration',type:'negative',rarity:'Common',name:'Beverage Evidence',description:'Present alternative beverages as evidence while still missing the hydration target.',systemMessage:'A beverage was present. Hydration was not.',series:'Technical Hydration',triggerType:'nonWaterBelowTargetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-016-beverage-evidence.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-017',category:'hydration',type:'negative',rarity:'Uncommon',name:'You Had Drinks',description:'Consume a respectable amount of alternative fluids and still fail to finish the hydration objective.',systemMessage:'You consumed several liquids. None appear to have completed the assignment.',series:'Technical Hydration',triggerType:'midRangeMajorityNonWaterEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-017-you-had-drinks.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-018',category:'hydration',type:'negative',rarity:'Rare',name:'Technically… No',description:'Rely overwhelmingly on alternative fluids and still fail the daily hydration target.',systemMessage:'You have presented several beverages as evidence. The System remains unconvinced.',series:'Technical Hydration',triggerType:'nonWater75PlusBelowTargetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-018-technically-no.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-019',category:'hydration',type:'negative',rarity:'Epic',name:'Liquid Adjacent',description:'Come painfully close to the hydration target using mostly alternative fluids, then stop.',systemMessage:'An impressive collection of beverages, and somehow still not enough. Remarkable.',series:'Technical Hydration',triggerType:'nearTargetMajorityNonWaterEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-019-liquid-adjacent.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-020',category:'hydration',type:'negative',rarity:'Legendary',name:'Hydration by Legal Argument',description:'Attempt to satisfy hydration entirely through a committee of alternative beverages and still fail.',systemMessage:'The defense has presented coffee, tea, milk, and vibes. The hydration target remains unmet.',series:'Technical Hydration',triggerType:'zeroPlainWaterThreeTypesBelowTargetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-020-hydration-by-legal-argument.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_HYDRATION_TECHNICAL_DEFINITIONS);
/* Night Running (Training) — qualifying activity = state.activities entry
   with type in RUNNING_ACTIVITY_TYPES, complete===true, and a parsed
   #actTime hour. A blank/unparseable time never qualifies (never faking
   a time-of-day condition from missing data). "Late-night" (>=22:00 or
   <06:00) is the broad Night Running window shared by HID-001/HID-004;
   "after midnight" (00:00–05:59) and the explicit 00:00–04:00 window used
   by HID-005 are the stricter subsets the other rows call for. */
const V023_RUNNING_NIGHT_DEFINITIONS=[
  {achievementId:'RUN-HID-001',category:'running',type:'positive',rarity:'Common',name:'Night Runner',description:'Complete a training run late at night.',systemMessage:'The sun went home. Apparently you did not.',series:'Night Running',triggerType:'lateNightRunTotal',triggerValue:1,iconAsset:'Achievements/Running/RUN-HID-001-night-runner.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'RUN-HID-002',category:'running',type:'positive',rarity:'Uncommon',name:'Things That Go Jog in the Night',description:'Complete a run after midnight.',systemMessage:'Something is moving in the darkness. Unfortunately, it’s cardio.',series:'Night Running',triggerType:'midnightRunTotal',triggerValue:1,iconAsset:'Achievements/Running/RUN-HID-002-things-that-go-jog-in-the-night.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'RUN-HID-003',category:'running',type:'positive',rarity:'Rare',name:'Running From Your Problems',description:'Complete at least 5 km after midnight.',systemMessage:'Your problems remain. They are, however, several kilometres behind you.',series:'Night Running',triggerType:'midnight5kEver',triggerValue:1,iconAsset:'Achievements/Running/RUN-HID-003-running-from-your-problems.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'RUN-HID-004',category:'running',type:'positive',rarity:'Epic',name:'Local Cryptid',description:'Become a recurring late-night running sighting.',systemMessage:'Multiple sightings reported. Reflective clothing. Heavy breathing. Surprisingly fast.',series:'Night Running',triggerType:'lateNightRunTotal',triggerValue:5,iconAsset:'Achievements/Running/RUN-HID-004-local-cryptid.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'RUN-HID-005',category:'running',type:'positive',rarity:'Legendary',name:'The Night Is Dark and Full of Cardio',description:'Complete a major endurance run in the middle of the night.',systemMessage:'Everyone else chose sleep. You chose violence against your knees.',series:'Night Running',triggerType:'midnight10kBetween0And4Ever',triggerValue:1,iconAsset:'Achievements/Running/RUN-HID-005-the-night-is-dark-and-full-of-cardio.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_RUNNING_NIGHT_DEFINITIONS);
/* Night Training (Gym & Strength) — qualifying activity = type exactly
   'Gym / Strength', complete===true, parsed #actTime hour. Same
   blank-time-never-qualifies rule as Night Running. */
const V023_GYM_NIGHT_DEFINITIONS=[
  {achievementId:'GYM-HID-001',category:'gym',type:'positive',rarity:'Common',name:'After Hours',description:'Complete a strength session late at night.',systemMessage:'Gym closed emotionally several hours ago.',series:'Night Training',triggerType:'gymAfterHoursTotal',triggerValue:1,iconAsset:'Achievements/Gym & Strength/GYM-HID-001-after-hours.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-HID-002',category:'gym',type:'positive',rarity:'Uncommon',name:'Midnight Reps',description:'Complete a strength session after midnight.',systemMessage:'Nothing good begins with ‘one more set’ at this hour.',series:'Night Training',triggerType:'gymMidnightTotal',triggerValue:1,iconAsset:'Achievements/Gym & Strength/GYM-HID-002-midnight-reps.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-HID-003',category:'gym',type:'positive',rarity:'Rare',name:'Sleep Is for Rest Days',description:'Accumulate three midnight strength sessions.',systemMessage:'Recovery has submitted a formal complaint.',series:'Night Training',triggerType:'gymMidnightTotal',triggerValue:3,iconAsset:'Achievements/Gym & Strength/GYM-HID-003-sleep-is-for-rest-days.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-HID-004',category:'gym',type:'positive',rarity:'Epic',name:'No Witnesses',description:'Accumulate seven midnight strength sessions.',systemMessage:'Nobody saw the lift. The System did.',series:'Night Training',triggerType:'gymMidnightTotal',triggerValue:7,iconAsset:'Achievements/Gym & Strength/GYM-HID-004-no-witnesses.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-HID-005',category:'gym',type:'positive',rarity:'Legendary',name:'What the Fuck Are You Training For?',description:'Accumulate fifteen midnight strength sessions.',systemMessage:'Seriously. Is there an invasion scheduled?',series:'Night Training',triggerType:'gymMidnightTotal',triggerValue:15,iconAsset:'Achievements/Gym & Strength/GYM-HID-005-what-the-fuck-are-you-training-for.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_GYM_NIGHT_DEFINITIONS);
/* Running Distance Milestones (RUN-POS-001..007, Achievement Design
   Register, approved 2026-09-08). name/rarity/systemMessage are
   literally "TBD" in the register itself for every row in this
   series — per explicit instruction, an approved-with-unfinished-
   fields achievement is implemented with real trigger logic now,
   not held back, and not given an invented name/rarity Nox hasn't
   written yet. They will display "TBD" until the register's own
   fields are filled in and this file is updated to match — that's
   expected, not a bug. RUN-POS-008 ("Ironman-distance triathlon") is
   excluded — no triathlon/combined-discipline-event concept exists
   anywhere in this app to detect it from; flagged in the return
   report rather than guessed at. */
const V023_RUNNING_DISTANCE_MILESTONE_DEFINITIONS=[
  {achievementId:'RUN-POS-001',category:'running',type:'positive',rarity:'TBD',name:'TBD',description:'First distance milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-002',category:'running',type:'positive',rarity:'TBD',name:'TBD',description:'Three kilometre milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:3,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-003',category:'running',type:'positive',rarity:'TBD',name:'TBD',description:'Five kilometre milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-004',category:'running',type:'positive',rarity:'TBD',name:'TBD',description:'Ten kilometre milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-005',category:'running',type:'positive',rarity:'TBD',name:'TBD',description:'Fifteen kilometre milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:15,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-006',category:'running',type:'positive',rarity:'TBD',name:'TBD',description:'Half Marathon milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:21.1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-007',category:'running',type:'positive',rarity:'TBD',name:'TBD',description:'Full Marathon milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:42.2,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_RUNNING_DISTANCE_MILESTONE_DEFINITIONS);
/* Training Sport session-count milestones (Achievement Design Register
   TRN-* rows, 8 of the 10 registered families — see the comment above
   v023RebuildTrainingSessionMilestoneCounters for why TRN-TMS/TRN-DAN
   are excluded). Names/descriptions/system messages/rarities copied
   verbatim from the register; none of it invented here. */
const V023_TRAINING_SESSION_DEFINITIONS=[
  {achievementId:'TRN-RUN-001',category:'training',type:'positive',rarity:'Common',name:'First Steps',description:'Complete your first Running session.',systemMessage:'The first step has been taken.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-002',category:'training',type:'positive',rarity:'Common',name:'Finding Your Feet',description:'Complete five Running sessions.',systemMessage:'Apparently this is becoming a thing.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-003',category:'training',type:'positive',rarity:'Uncommon',name:'Double Digits',description:'Complete ten Running sessions.',systemMessage:'Ten runs. The road is beginning to recognise you.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-004',category:'training',type:'positive',rarity:'Rare',name:'Road Regular',description:'Complete twenty-five Running sessions.',systemMessage:'You are now a recurring road event.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:25,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty on Foot',description:'Complete fifty Running sessions.',systemMessage:'Fifty runs completed. Knees remain under observation.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:50,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Runner',description:'Complete one hundred Running sessions.',systemMessage:'One hundred runs. This is no longer accidental.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:100,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-007',category:'training',type:'positive',rarity:'Legendary',name:'Road Veteran',description:'Complete two hundred fifty Running sessions.',systemMessage:'The road has filed you under permanent fixtures.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:250,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-008',category:'training',type:'positive',rarity:'Celestial',name:'Born to Run',description:'Complete five hundred Running sessions.',systemMessage:'Five hundred runs. Walking now appears to be a temporary state.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:500,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-001',category:'training',type:'positive',rarity:'Common',name:'On Your Bike',description:'Complete your first Cycling session.',systemMessage:'Two wheels. Forward motion. Acceptable.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-002',category:'training',type:'positive',rarity:'Common',name:'Finding Your Gears',description:'Complete five Cycling sessions.',systemMessage:'The gears have stopped being decorative.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten in the Saddle',description:'Complete ten Cycling sessions.',systemMessage:'Ten rides completed. Saddle diplomacy continues.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-004',category:'training',type:'positive',rarity:'Rare',name:'Chain Reaction',description:'Complete twenty-five Cycling sessions.',systemMessage:'Repeated pedalling has produced consequences.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:25,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Rides Later',description:'Complete fifty Cycling sessions.',systemMessage:'Fifty rides. The bicycle is now a colleague.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:50,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Cyclist',description:'Complete one hundred Cycling sessions.',systemMessage:'One hundred rides. Chain maintenance is now a lifestyle.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:100,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-007',category:'training',type:'positive',rarity:'Legendary',name:'Road-Worn',description:'Complete two hundred fifty Cycling sessions.',systemMessage:'The road and your backside have both kept records.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:250,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-008',category:'training',type:'positive',rarity:'Celestial',name:'Pedal Forever',description:'Complete five hundred Cycling sessions.',systemMessage:'Five hundred rides. The System suspects you may generate electricity.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:500,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-001',category:'training',type:'positive',rarity:'Common',name:'Making a Splash',description:'Complete your first Swimming session.',systemMessage:'Aquatic locomotion confirmed.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-002',category:'training',type:'positive',rarity:'Common',name:'Finding Your Stroke',description:'Complete five Swimming sessions.',systemMessage:'Drowning has been successfully reclassified as swimming.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Laps Later',description:'Complete ten Swimming sessions.',systemMessage:'Water resistance remains stubbornly present.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-004',category:'training',type:'positive',rarity:'Rare',name:'Waterborne',description:'Complete twenty-five Swimming sessions.',systemMessage:'Dry land is becoming optional.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:25,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Dips',description:'Complete fifty Swimming sessions.',systemMessage:'Fifty successful returns from the water.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:50,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Swimmer',description:'Complete one hundred Swimming sessions.',systemMessage:'One hundred swims. Gills remain unconfirmed.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:100,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-007',category:'training',type:'positive',rarity:'Legendary',name:'Human Torpedo',description:'Complete two hundred fifty Swimming sessions.',systemMessage:'Hydrodynamic concerns have been raised.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:250,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-008',category:'training',type:'positive',rarity:'Celestial',name:'Part-Time Fish',description:'Complete five hundred Swimming sessions.',systemMessage:'Five hundred swims. Species classification is under review.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:500,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-001',category:'training',type:'positive',rarity:'Common',name:'Pick Things Up',description:'Complete your first Strength Training session.',systemMessage:'Object lifted. Gravity disappointed.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-002',category:'training',type:'positive',rarity:'Common',name:'Finding Your Form',description:'Complete five Strength Training sessions.',systemMessage:'Repeated lifting detected.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Sessions Strong',description:'Complete ten Strength Training sessions.',systemMessage:'Ten sessions. The iron is beginning to remember you.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-004',category:'training',type:'positive',rarity:'Rare',name:'Iron Habit',description:'Complete twenty-five Strength Training sessions.',systemMessage:'The weights are no longer surprised to see you.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:25,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Strong',description:'Complete fifty Strength Training sessions.',systemMessage:'Fifty sessions of negotiated gravity.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:50,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-006',category:'training',type:'positive',rarity:'Legendary',name:'Century of Iron',description:'Complete one hundred Strength Training sessions.',systemMessage:'One hundred sessions. The iron has accepted you.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:100,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-007',category:'training',type:'positive',rarity:'Legendary',name:'Built Different',description:'Complete two hundred fifty Strength Training sessions.',systemMessage:'At this point the furniture is probably safer around you.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:250,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-008',category:'training',type:'positive',rarity:'Celestial',name:'Forged in Repetition',description:'Complete five hundred Strength Training sessions.',systemMessage:'Five hundred sessions. Repetition has become metallurgy.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:500,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-001',category:'training',type:'positive',rarity:'Common',name:'Touch Your Toes',description:'Complete your first Yoga session.',systemMessage:'Flexibility protocol initiated.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-002',category:'training',type:'positive',rarity:'Common',name:'Finding Balance',description:'Complete five Yoga sessions.',systemMessage:'Balance remains technically possible.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Breaths Deeper',description:'Complete ten Yoga sessions.',systemMessage:'Breathing has become suspiciously organised.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-004',category:'training',type:'positive',rarity:'Rare',name:'Bend, Don’t Break',description:'Complete twenty-five Yoga sessions.',systemMessage:'Structural integrity maintained.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:25,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Flows',description:'Complete fifty Yoga sessions.',systemMessage:'Fifty sessions of weaponised calm.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:50,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-006',category:'training',type:'positive',rarity:'Legendary',name:'Century of Calm',description:'Complete one hundred Yoga sessions.',systemMessage:'One hundred sessions. Inner peace remains annoyingly plausible.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:100,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-007',category:'training',type:'positive',rarity:'Legendary',name:'Unreasonably Flexible',description:'Complete two hundred fifty Yoga sessions.',systemMessage:'The skeleton has submitted a flexibility amendment.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:250,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-008',category:'training',type:'positive',rarity:'Celestial',name:'Human Pretzel',description:'Complete five hundred Yoga sessions.',systemMessage:'Five hundred sessions. Conventional geometry no longer applies.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:500,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-001',category:'training',type:'positive',rarity:'Common',name:'Enter the Dojo',description:'Complete your first Martial Arts session.',systemMessage:'Combat training registered. Please remain civil.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-002',category:'training',type:'positive',rarity:'Common',name:'White Belt Energy',description:'Complete five Martial Arts sessions.',systemMessage:'Enthusiasm exceeds technique. This is normal.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Bouts In',description:'Complete ten Martial Arts sessions.',systemMessage:'Ten sessions. Falling down now has educational value.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-004',category:'training',type:'positive',rarity:'Rare',name:'Discipline',description:'Complete twenty-five Martial Arts sessions.',systemMessage:'Repetition has begun turning into technique.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:25,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Sessions of Violence',description:'Complete fifty Martial Arts sessions.',systemMessage:'The System has been assured this is consensual training.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:50,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Fighter',description:'Complete one hundred Martial Arts sessions.',systemMessage:'One hundred sessions. You may now bow dramatically.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:100,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-007',category:'training',type:'positive',rarity:'Legendary',name:'Warrior Scholar',description:'Complete two hundred fifty Martial Arts sessions.',systemMessage:'Violence and education have reached an understanding.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:250,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-008',category:'training',type:'positive',rarity:'Celestial',name:'Still Not a Ninja',description:'Complete five hundred Martial Arts sessions.',systemMessage:'Five hundred sessions. Ninja status remains legally unverified.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:500,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-001',category:'training',type:'positive',rarity:'Common',name:'Off the Ground',description:'Complete your first Climbing session.',systemMessage:'Gravity has been challenged.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-002',category:'training',type:'positive',rarity:'Common',name:'Finding a Hold',description:'Complete five Climbing sessions.',systemMessage:'Handholds are becoming less theoretical.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Ascents',description:'Complete ten Climbing sessions.',systemMessage:'Ten sessions above where good sense suggested staying.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-004',category:'training',type:'positive',rarity:'Rare',name:'Chalk Addict',description:'Complete twenty-five Climbing sessions.',systemMessage:'Chalk consumption remains indirect but substantial.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:25,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Climbs',description:'Complete fifty Climbing sessions.',systemMessage:'Fifty sessions. Gravity remains undefeated but irritated.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:50,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Climber',description:'Complete one hundred Climbing sessions.',systemMessage:'One hundred climbs. Down remains easier.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:100,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-007',category:'training',type:'positive',rarity:'Legendary',name:'Gravity Negotiator',description:'Complete two hundred fifty Climbing sessions.',systemMessage:'Gravity has agreed to continued talks.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:250,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-008',category:'training',type:'positive',rarity:'Celestial',name:'Apparently a Mountain Goat',description:'Complete five hundred Climbing sessions.',systemMessage:'Five hundred sessions. Hooves remain optional.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:500,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-001',category:'training',type:'positive',rarity:'Common',name:'What Counts as Training?',description:'Complete your first training session classified as Other.',systemMessage:'The System has accepted your interpretation of exercise.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-002',category:'training',type:'positive',rarity:'Common',name:'Apparently This Counts',description:'Complete five training sessions classified as Other.',systemMessage:'Repeated ambiguity detected.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten of Whatever This Is',description:'Complete ten training sessions classified as Other.',systemMessage:'Ten sessions completed. Classification remains unresolved.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-004',category:'training',type:'positive',rarity:'Rare',name:'Unclassified Activity',description:'Complete twenty-five training sessions classified as Other.',systemMessage:'The System has stopped pretending it knows what you are doing.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:25,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Mystery Sessions',description:'Complete fifty training sessions classified as Other.',systemMessage:'Fifty entries later. Still no category.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:50,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-006',category:'training',type:'positive',rarity:'Legendary',name:'Century of Miscellaneous',description:'Complete one hundred training sessions classified as Other.',systemMessage:'One hundred sessions of taxonomical failure.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:100,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-007',category:'training',type:'positive',rarity:'Legendary',name:'The System Gives Up',description:'Complete two hundred fifty training sessions classified as Other.',systemMessage:'Fine. It is exercise. Stop asking.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:250,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-008',category:'training',type:'positive',rarity:'Celestial',name:'Otherworldly',description:'Complete five hundred training sessions classified as Other.',systemMessage:'Five hundred uncategorised sessions. You have transcended taxonomy.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:500,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_TRAINING_SESSION_DEFINITIONS);
/* Ash handoff (2026-09-08, ASTRA — ASH ACHIEVEMENT IMPLEMENTATION
   HANDOFF, Nox authority) — "Slow and Steady" / "Tortoise and Hare".
   Trigger logic is fully implemented and live-tested (see
   walkSingleSession5kEver/10kEver in v023RebuildTrainingNightCounters
   and v023DefinitionSatisfied above) — a completed state.activities
   entry with type==='Walking' and distance>=5 or >=10, exactly per the
   handoff's instruction to use walking-DISTANCE data, not Training
   session count.

   DELIBERATELY NOT pushed into V023_ACHIEVEMENT_DEFINITIONS. Per the
   handoff's own explicit rule ("Do not invent permanent Achievement
   IDs... Astra must never reuse or independently allocate an existing
   achievement ID" — this project already had one real ID collision
   from implementation assigning IDs independently), these can't go
   live without Nox-assigned permanent IDs from the Achievement Design
   Register. rarity/hidden/xpReward/lootReward are Nox's authority too
   (per the Register's own Astra/Nox/Thimble split) and are left as
   explicit non-values below rather than guessed defaults.

   To activate once Nox assigns IDs: replace each achievementId below
   with the real one, fill in rarity/hidden/isSecret/xpReward/lootReward
   per the Register, then add one line: V023_ACHIEVEMENT_DEFINITIONS.push(...V023_ASH_WALKING_DEFINITIONS_PENDING_ID);
   Nothing else needs to change — trigger/progress/artwork wiring is
   already correct and won't need touching. */
const V023_ASH_WALKING_DEFINITIONS_PENDING_ID=[
  {achievementId:'ID PENDING - Slow and Steady',category:'walking',type:'positive',rarity:'PENDING',name:'Slow and Steady',description:'Walk 5 km in a single session.',triggerType:'walkSingleSession5kEver',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ID PENDING - Tortoise and Hare',category:'walking',type:'positive',rarity:'PENDING',name:'Tortoise and Hare',description:'Walk 10 km in a single session.',triggerType:'walkSingleSession10kEver',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
/* Sleep — 31 Approved rows from the Sleep category sheet. All read from
   the finalized Sleep ledger only (see v023RebuildSleepCounters), never
   from state.daily directly. The three-state Sleep Quality already
   built for the Home Sleep entry (Good/Mixed(Okay)/Poor, stored as
   positive/neutral/negative) is normalized to Good/Okay/Poor for these
   checks — see v023NormalizeSleepQuality. SLP-SEX and SLP-MAS require a
   qualifying manual Sleep reason; 'sex' and 'masturbation' are new
   reason values added to the existing Sleep reason checklist (the
   smallest reusable extension of a taxonomy that already supports
   adding values, per the handoff's own "smallest reusable hook" rule —
   'children' and 'other' already worked exactly this way). */
const V023_SLEEP_ALL_APPROVED_DEFINITIONS=[
  {achievementId:'SLP-SEX-001',category:'sleep',type:'positive',rarity:'Common',name:'Well, That Explains It',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'Sleep target missed. Morale appears unaffected.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-SEX-001-well-that-explains-it.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-SEX-002',category:'sleep',type:'positive',rarity:'Uncommon',name:'Worth It',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'The System has reviewed the circumstances and withdrawn its complaint.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:3,iconAsset:'Achievements/Sleep/SLP-SEX-002-worth-it.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-SEX-003',category:'sleep',type:'positive',rarity:'Rare',name:'Cardio After Dark',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'Additional activity detected. Sleep was apparently the secondary objective.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:10,iconAsset:'Achievements/Sleep/SLP-SEX-003-cardio-after-dark.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-SEX-004',category:'sleep',type:'positive',rarity:'Epic',name:'No Rest for the Wicked',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'Sleep deficit confirmed. Cause identified. No further questions.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:25,iconAsset:'Achievements/Sleep/SLP-SEX-004-no-rest-for-the-wicked.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-SEX-005',category:'sleep',type:'positive',rarity:'Legendary',name:'Death by Snu Snu',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'Cause of exhaustion identified. The System considers this self-inflicted.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:50,iconAsset:'Achievements/Sleep/SLP-SEX-005-death-by-snu-snu.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-SEX-006',category:'sleep',type:'positive',rarity:'Celestial',name:'The Flesh Is Willing',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'One hundred sleep targets sacrificed. Priorities have been thoroughly documented.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:100,iconAsset:'Achievements/Sleep/SLP-SEX-006-the-flesh-is-willing.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-001',category:'sleep',type:'positive',rarity:'Common',name:'TMI',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'You could have just selected ‘Other.’',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-MAS-001-tmi.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-002',category:'sleep',type:'positive',rarity:'Uncommon',name:'Again?',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'The System did not require this level of disclosure.',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:3,iconAsset:'Achievements/Sleep/SLP-MAS-002-again.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-003',category:'sleep',type:'positive',rarity:'Rare',name:'Solo Queue',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'Multiplayer remains unavailable. Apparently this has not slowed progression.',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:10,iconAsset:'Achievements/Sleep/SLP-MAS-003-solo-queue.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-004',category:'sleep',type:'positive',rarity:'Epic',name:'A Handful of Regrets',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'Twenty-five sleep targets lost. At least the culprit has been identified.',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:25,iconAsset:'Achievements/Sleep/SLP-MAS-004-a-handful-of-regrets.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-005',category:'sleep',type:'positive',rarity:'Legendary',name:'Master of Your Domain',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'The System has stopped asking why you are tired.',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:50,iconAsset:'Achievements/Sleep/SLP-MAS-005-master-of-your-domain.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-006',category:'sleep',type:'positive',rarity:'Celestial',name:'Self Made',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'One hundred documented incidents. This statistic exists because you insisted on creating it.',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:100,iconAsset:'Achievements/Sleep/SLP-MAS-006-self-made.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-POS-006',category:'sleep',type:'positive',rarity:'Celestial',name:'Sleep Like the Dead',description:'Maintain an extraordinary long-term sleep record.',systemMessage:'One full year of successful nightly shutdowns. Resurrection continues to occur each morning.',series:'Positive Sleep',triggerType:'sleepTargetMetCount',triggerValue:365,iconAsset:'Achievements/Sleep/SLP-POS-006-sleep-like-the-dead.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-QLP-001',category:'sleep',type:'positive',rarity:'Common',name:'Actually Rested',description:'Reward restorative sleep quality.',systemMessage:'Sleep quality acceptable. Miracles remain possible.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLP-001-actually-rested.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLP-002',category:'sleep',type:'positive',rarity:'Uncommon',name:'Good Night, Literally',description:'Reward restorative sleep quality.',systemMessage:'Repeated restorative sleep detected. Suspicious.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:3,iconAsset:'Achievements/Sleep/SLP-QLP-002-good-night-literally.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLP-003',category:'sleep',type:'positive',rarity:'Rare',name:'Premium Unconsciousness',description:'Reward restorative sleep quality.',systemMessage:'You appear to have upgraded your sleeping subscription.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:7,iconAsset:'Achievements/Sleep/SLP-QLP-003-premium-unconsciousness.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLP-004',category:'sleep',type:'positive',rarity:'Epic',name:'Restoration Protocol',description:'Reward restorative sleep quality.',systemMessage:'Recovery systems are operating at unreasonable efficiency.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:30,iconAsset:'Achievements/Sleep/SLP-QLP-004-restoration-protocol.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLP-005',category:'sleep',type:'positive',rarity:'Legendary',name:'Professionally Rested',description:'Reward restorative sleep quality.',systemMessage:'Rest is no longer accidental. This appears deliberate.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:100,iconAsset:'Achievements/Sleep/SLP-QLP-005-professionally-rested.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLP-006',category:'sleep',type:'positive',rarity:'Celestial',name:'Touched by the Sandman',description:'Reward restorative sleep quality.',systemMessage:'One year of quality sleep. The System assumes witchcraft.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:365,iconAsset:'Achievements/Sleep/SLP-QLP-006-touched-by-the-sandman.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-001',category:'sleep',type:'negative',rarity:'Common',name:'That Was Sleep?',description:'Comedic achievement for poor sleep quality.',systemMessage:'The System acknowledges that you were technically horizontal.',series:'Sleep Quality — Negative',triggerType:'sleepPoorCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLN-001-that-was-sleep.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-002',category:'sleep',type:'negative',rarity:'Uncommon',name:'Eight Hours of Lies',description:'Comedic contradictory sleep result.',systemMessage:'Duration claims success. Every other metric has objected.',series:'Sleep Quality — Negative',triggerType:'sleepTargetMetPoorCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLN-002-eight-hours-of-lies.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-003',category:'sleep',type:'negative',rarity:'Rare',name:'Human Loading Screen',description:'Comedic achievement for repeated poor sleep quality.',systemMessage:'You have completed several rest cycles without visibly resting.',series:'Sleep Quality — Negative',triggerType:'sleepPoorCount',triggerValue:7,iconAsset:'Achievements/Sleep/SLP-QLN-003-human-loading-screen.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-004',category:'sleep',type:'negative',rarity:'Epic',name:'Sleep Without the Benefits',description:'Comedic achievement for repeated poor sleep quality.',systemMessage:'You continue to perform the ritual. Results remain disappointing.',series:'Sleep Quality — Negative',triggerType:'sleepPoorCount',triggerValue:30,iconAsset:'Achievements/Sleep/SLP-QLN-004-sleep-without-the-benefits.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-005',category:'sleep',type:'negative',rarity:'Legendary',name:'Resting Is Apparently Decorative',description:'Comedic achievement for repeated poor sleep quality.',systemMessage:'One hundred attempts at sleep. Recovery remains theoretical.',series:'Sleep Quality — Negative',triggerType:'sleepPoorCount',triggerValue:100,iconAsset:'Achievements/Sleep/SLP-QLN-005-resting-is-apparently-decorative.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-006',category:'sleep',type:'negative',rarity:'Celestial',name:'The Mattress Has Failed You',description:'Comedic achievement for repeated poor sleep quality.',systemMessage:'The bed has had a full year to explain itself. It has declined.',series:'Sleep Quality — Negative',triggerType:'sleepPoorCount',triggerValue:365,iconAsset:'Achievements/Sleep/SLP-QLN-006-the-mattress-has-failed-you.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-001',category:'sleep',type:'positive',rarity:'Uncommon',name:'Against All Odds',description:'Mixed sleep-duration and quality achievement.',systemMessage:'Insufficient quantity. Irritatingly excellent quality.',series:'Sleep Quality — Mixed',triggerType:'sleepMissTargetGoodCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLM-001-against-all-odds.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-002',category:'sleep',type:'negative',rarity:'Rare',name:'Quantity Over Quality',description:'Mixed sleep-duration and quality achievement.',systemMessage:'You slept longer. This did not help.',series:'Sleep Quality — Mixed',triggerType:'sleepExceedTargetPoorCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLM-002-quantity-over-quality.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-003',category:'sleep',type:'positive',rarity:'Rare',name:'Short but Effective',description:'Mixed sleep-duration and quality achievement.',systemMessage:'Minimal runtime. Surprisingly efficient maintenance.',series:'Sleep Quality — Mixed',triggerType:'sleepUnder75PercentGoodCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLM-003-short-but-effective.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-004',category:'sleep',type:'negative',rarity:'Epic',name:'Long and Pointless',description:'Mixed sleep-duration and quality achievement.',systemMessage:'Extended shutdown completed. Benefits not located.',series:'Sleep Quality — Mixed',triggerType:'sleepOver125PercentPoorCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLM-004-long-and-pointless.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-005',category:'sleep',type:'positive',rarity:'Epic',name:'Schrödinger’s Sleep',description:'Mixed sleep-duration and quality achievement.',systemMessage:'Sleep was neither good nor bad until you opened the tracker.',series:'Sleep Quality — Mixed',triggerType:'sleepExactTargetOkayCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLM-005-schr-dinger-s-sleep.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-006',category:'sleep',type:'negative',rarity:'Legendary',name:'The Numbers Are Lying',description:'Mixed sleep-duration and quality achievement.',systemMessage:'The statistics insist everything is fine. You appear unconvinced.',series:'Sleep Quality — Mixed',triggerType:'sleepTargetMetPoorCount',triggerValue:7,iconAsset:'Achievements/Sleep/SLP-QLM-006-the-numbers-are-lying.png',frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_SLEEP_ALL_APPROVED_DEFINITIONS);
/* Quests Hub — the one real quest-defined achievement today, wired
   through the generic questFirstCompletion trigger above rather than a
   separate quest achievement system (handoff §14). category:'quest'
   maps to the pre-existing, previously-unused 'Quests' achievement
   filter bucket in app.js's ACHIEVEMENT_CATEGORY_LIST. */
const V023_QUEST_DEFINITIONS=[
  {achievementId:'QUEST-LOST-FORTRESS-001',category:'quest',type:'positive',rarity:'Rare',name:'The Pinnacle Spire',description:'Complete the Call to the Lost Fortress campaign for the first time.',systemMessage:'The Pinnacle Spire has been reached at last.',series:null,triggerType:'questFirstCompletion',triggerValue:'lost-fortress',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  /* Journeys (ASTRA Update Package 1 §13) — the one Journey achievement
     the Local Test Trail's own short route can actually validate; real
     Cape Town -> Magadan achievements (Halfway, Four Digits, etc.) wait
     on that Tour's real route data per §36. */
  {achievementId:'JOURNEY-LOCAL-TEST-TRAIL-001',category:'quest',type:'positive',rarity:'Common',name:'First Steps, Literally',description:'Complete the Local Test Trail for the first time.',systemMessage:'Ten kilometres down. A slightly longer one is still waiting.',series:null,triggerType:'questFirstCompletion',triggerValue:'local-test-trail',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_QUEST_DEFINITIONS);
/* SLP-HID-001..015 — activated (ASTRA Update Package 1 §31, 2026-09-06).
   Previously staged/inert (SCHEMA_CONFLICTS.md) because their source
   Rarity column literally read "Hidden" — not a rarity, a visibility
   state. Package 1 approves Rare for all 15 and explicitly keeps
   "Hidden" as their visibility behaviour, not their rarity. Same IDs,
   names, descriptions, trigger words and system messages as staged;
   only the rarity + registry membership changed. Evaluated via the
   generic sleepOtherTextTrigger triggerType (added above), which reads
   state.sleep.ledger[...].otherText — a whole-word/phrase, case-
   insensitive match against triggerWords on any finalized night that
   both missed the sleep target and classified to 'other'. */
const V023_SLEEP_HIDDEN_DEFINITIONS=[
  {achievementId:'SLP-HID-001',category:'sleep',type:'positive',rarity:'Rare',name:'One More Turn',description:'Log a missed-sleep reason mentioning “game”, “gaming”, “turn”, or “match”.',systemMessage:'The kingdom was apparently more important than REM sleep.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['game','gaming','turn','match'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-001-one-more-turn.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-002',category:'sleep',type:'positive',rarity:'Rare',name:'Just One More Chapter',description:'Log a missed-sleep reason mentioning “book”, “reading”, or “chapter”.',systemMessage:'Literacy has claimed another victim.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['book','reading','chapter'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-002-just-one-more-chapter.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-003',category:'sleep',type:'positive',rarity:'Rare',name:'The Bug Can Smell Fear',description:'Log a missed-sleep reason mentioning “coding”, “bug”, “debug”, or “programming”.',systemMessage:'You defeated the bug. The bug defeated your bedtime.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['coding','bug','debug','programming'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-003-the-bug-can-smell-fear.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-004',category:'sleep',type:'positive',rarity:'Rare',name:'Streaming Until Morale Improves',description:'Log a missed-sleep reason mentioning “netflix”, “series”, “episode”, or “streaming”.',systemMessage:'Autoplay remains undefeated.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['netflix','series','episode','streaming'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-004-streaming-until-morale-improves.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-005',category:'sleep',type:'positive',rarity:'Rare',name:'Social Encounter: Extended Cut',description:'Log a missed-sleep reason mentioning “party”, “friends”, “pub”, or “social”.',systemMessage:'The side quest lasted significantly longer than advertised.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['party','friends','pub','social'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-005-social-encounter-extended-cut.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-006',category:'sleep',type:'positive',rarity:'Rare',name:'Doomscroll Adept',description:'Log a missed-sleep reason mentioning “phone”, “scrolling”, “reddit”, “tiktok”, or “youtube”.',systemMessage:'You have consumed the entire internet. It will respawn tomorrow.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['phone','scrolling','reddit','tiktok','youtube'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-006-doomscroll-adept.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-007',category:'sleep',type:'positive',rarity:'Rare',name:'The Midnight Snack Raid',description:'Log a missed-sleep reason mentioning “food”, “snack”, “hungry”, or “kitchen”.',systemMessage:'Loot acquired. Sleep schedule lost.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['food','snack','hungry','kitchen'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-007-the-midnight-snack-raid.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-008',category:'sleep',type:'positive',rarity:'Rare',name:'Quest Accepted at 23:47',description:'Log a missed-sleep reason mentioning “work”, “project”, “deadline”, or “email”.',systemMessage:'An excellent time to begin something completely unnecessary.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['work','project','deadline','email'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-008-quest-accepted-at-23-47.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-009',category:'sleep',type:'positive',rarity:'Rare',name:'The Brain Has Declined Shutdown',description:'Log a missed-sleep reason mentioning “thinking”, “overthinking”, “brain”, or “thoughts”.',systemMessage:'System shutdown requested. Request denied.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['thinking','overthinking','brain','thoughts'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-009-the-brain-has-declined-shutdown.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-010',category:'sleep',type:'positive',rarity:'Rare',name:'Furniture Assembly: Nightmare Difficulty',description:'Log a missed-sleep reason mentioning “ikea”, “furniture”, or “assembly”.',systemMessage:'Three screws remained. So did you.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['ikea','furniture','assembly'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-010-furniture-assembly-nightmare-difficulty.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-011',category:'sleep',type:'positive',rarity:'Rare',name:'Dungeon Master’s Curse',description:'Log a missed-sleep reason mentioning “dnd”, “d&d”, “campaign”, “session”, or “warhammer”.',systemMessage:'The session ended hours ago. The lore discussion did not.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['dnd','d&d','campaign','session','warhammer'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-011-dungeon-master-s-curse.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-012',category:'sleep',type:'positive',rarity:'Rare',name:'Patch Notes at Midnight',description:'Log a missed-sleep reason mentioning “update”, “patch”, “install”, or “download”.',systemMessage:'Sleep postponed due to critical balance changes.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['update','patch','install','download'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-012-patch-notes-at-midnight.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-013',category:'sleep',type:'positive',rarity:'Rare',name:'Domestic Raid Boss',description:'Log a missed-sleep reason mentioning “cleaning”, “laundry”, “dishes”, or “housework”.',systemMessage:'The chores had enrage mechanics.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['cleaning','laundry','dishes','housework'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-013-domestic-raid-boss.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-014',category:'sleep',type:'positive',rarity:'Rare',name:'Unexpected Lore Drop',description:'Log a missed-sleep reason mentioning “wikipedia”, “research”, “rabbit hole”, or “documentary”.',systemMessage:'You only wanted to know one thing.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['wikipedia','research','rabbit hole','documentary'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-014-unexpected-lore-drop.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-015',category:'sleep',type:'positive',rarity:'Rare',name:'Bedtime Side Quest Failed',description:'Log a missed-sleep reason mentioning “forgot”, “lost track”, “time”, or “late”.',systemMessage:'Time remains an optional mechanic.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['forgot','lost track','time','late'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-015-bedtime-side-quest-failed.png',frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_SLEEP_HIDDEN_DEFINITIONS);
/* Daily Quest Minimum achievements (ASTRA Update Package 1 §28-30). */
const V023_DAILY_QUEST_DEFINITIONS=[
  {achievementId:'DQ-POS-001',category:'quest',type:'positive',rarity:'Legendary',name:'You Are Now the Adultiest Adult',description:'Maintain a full month of complete Daily Quest clears without misses or carry-overs.',systemMessage:'When all others need an adult, they look to you. Sucks to be them.',series:'Daily Quest Full Clear',triggerType:'dailyQuestStreak',triggerValue:30,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-POS-007',category:'quest',type:'positive',rarity:'Uncommon',name:'There’s Still Room for More',description:'Raise your configured Daily Quest Minimum for the first time.',systemMessage:'Ambition noted. Proceed accordingly.',series:'Daily Quest Goal Adjustment',triggerType:'dailyQuestMinimumFirstIncrease',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-POS-008',category:'quest',type:'positive',rarity:'Uncommon',name:'Do What You Can',description:'The best plan is the one that still fits your life.',systemMessage:'Adjusted, not defeated.',series:'Daily Quest Goal Adjustment',triggerType:'dailyQuestMinimumFirstDecrease',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-RND-005',category:'quest',type:'positive',rarity:'Rare',name:'The Goalposts Have Wheels',description:'Change your Daily Quest Minimum 3 or more times within a 7-day window.',systemMessage:'Pick a number. Any number. Preferably the same one twice.',series:'Quest Goal Adjustment',triggerType:'dailyQuestMinimumChangeBurst',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_DAILY_QUEST_DEFINITIONS);
/* Daily Quest — cumulative + single-day volume (DQ-POS-004/005/006,
   approved 2026-09-08). Only 3 of the 25 newly-approved Daily Quest
   rows are implemented here — see the return report for the other 22
   (DQ-POS-002/003, all 15 DQ-NEG, all 4 DQ-RND, DQ-RES-001). Those all
   assume a "Daily Quest" is an individually tracked item with its own
   assigned/incomplete/overdue/edited/deleted state, plus page-open and
   quest-management-interaction counts. This app's actual "Daily Quest"
   concept (see ensureDailyQuestsState/v023UpdateDailyQuestFromDaily
   above) is a single daily completed-Side-Quest count checked against
   a configurable minimum — no per-quest identity, no assigned set, no
   overdue/edit/delete history, no interaction counters. That's a real
   design-model mismatch between the register and the implementation,
   not a missing counter — flagged back rather than papered over with
   22 new invented tracking systems. */
const V023_DAILY_QUEST_VOLUME_DEFINITIONS=[
  {achievementId:'DQ-POS-004',category:'quest',type:'positive',rarity:'Rare',name:'Quest Goblin',description:'Complete twenty-five Daily Quests over time.',systemMessage:'You appear to be hoarding completed objectives.',series:'Cumulative Completion',triggerType:'dailyQuestCumulativeTotal',triggerValue:25,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:null,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-POS-005',category:'quest',type:'positive',rarity:'Epic',name:'Touch Grass, Hero',description:'Complete an unusually large number of Daily Quests in one day.',systemMessage:'The village is safe. Please go outside.',series:'Daily Quest Overload',triggerType:'dailyQuestMaxSingleDay',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-POS-006',category:'quest',type:'positive',rarity:'Legendary',name:'The System Is Concerned',description:'Complete a frankly unreasonable number of Daily Quests in a single day.',systemMessage:'This stopped being productivity several quests ago.',series:'Daily Quest Overload',triggerType:'dailyQuestMaxSingleDay',triggerValue:20,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,frameAsset:`${V023_FRAME_ROOT}Achievement_Frame_Secret_Hidden.png`,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_DAILY_QUEST_VOLUME_DEFINITIONS);
function v023AchievementUnlocked(id){return v023EnsureAchievementState().unlockedAchievements.some(x=>x.achievementId===id)}
/* Achievement schema additions (Astra "Safe Overnight Handoff" §4):
   def.hidden (falls back to the existing def.isSecret so nothing here
   needs to change), def.classUnlocker (metadata only), def.unlocksClass
   (id or array of ids — made ELIGIBLE via grantClassUnlock, never
   auto-equipped), def.integrityEvent (optional payload recorded via the
   generic recordIntegrityEvent hook, no consequence applied). None of
   the existing hydration definitions set any of these, so this is a
   pure addition — current unlock behavior for them is unchanged. */
function v023DefinitionHidden(def){return Boolean(def.hidden??def.isSecret)}
function v023ApplyAchievementExtras(def){
  if(def.unlocksClass&&typeof grantClassUnlock==='function'){
    const ids=Array.isArray(def.unlocksClass)?def.unlocksClass:[def.unlocksClass];
    ids.forEach(id=>grantClassUnlock(id,`achievement:${def.achievementId}`));
  }
  if(def.integrityEvent&&typeof recordIntegrityEvent==='function'){
    recordIntegrityEvent('achievement','achievementUnlocked',{achievementId:def.achievementId,payload:def.integrityEvent});
  }
}
function v023UnlockAchievement(def,event){
  const ae=v023EnsureAchievementState();if(v023AchievementUnlocked(def.achievementId))return false;
  const rec={achievementId:def.achievementId,unlockedAt:v023Now(),sourceEventId:event?.eventId||null};ae.unlockedAchievements.push(rec);ae.popupQueue.push({achievementId:def.achievementId,queuedAt:v023Now()});v023ApplyAchievementExtras(def);v023PumpAchievementQueue();return true;
}
function v023DefinitionSatisfied(def){
  const h=state.hydration||{},cfg=v023EnsureAchievementState().secretConfig;
  if(def.triggerType==='targetDaysTotal')return Number(h.targetDaysTotal||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='targetStreak')return Number(h.currentTargetStreak||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='overTargetStreak')return Number(h.overTargetStreak||0)>=Number(cfg.days||def.triggerValue||3);
  /* Hydration Achievement Live Test Batch triggers — all read from
     COMPLETED (finalized) days only, computed in
     v023RebuildHydrationTestBatchCounters. "over 100%" here is a
     distinct, literal threshold from the pre-existing configurable
     overTargetStreak convention above (currently 120%) — the batch's
     own thresholds (100%, 200%) don't alias it, so that existing
     convention is preserved untouched and not reused here. */
  if(def.triggerType==='over100Total')return Number(h.over100Total||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='over100Streak')return Number(h.over100Streak||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='over200Total')return Number(h.over200Total||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='crossDayZeroToDouble')return Boolean(h.zeroToDoubleEver);
  if(def.triggerType==='recoveryMissedStreak')return (h.recoveryEvents||[]).some(e=>e.missedStreakLength>=Number(def.triggerValue||0));
  /* ASTRA All-Approved Achievements install — additional Hydration
     triggers, all derived in v023RebuildHydrationTestBatchCounters. */
  if(def.triggerType==='zeroStreak')return Number(h.zeroStreak||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='recoverySustained')return (h.recoveryEvents||[]).some(e=>e.missedStreakLength>=Number(def.missedThreshold||0)&&Number(e.sustainedRunLength||0)>=Number(def.triggerValue||0));
  if(def.triggerType==='hydrationOscillation4')return Boolean(h.hydrationOscillation4Ever);
  if(def.triggerType==='maxDailyPercentEver')return Number(h.maxDailyPercentEver||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='exactAmountEver')return (h.exactAmountsEverLogged||[]).includes(Number(def.triggerValue));
  if(def.triggerType==='manualResetCount')return Number(h.manualResetCount||0)>=Number(def.triggerValue||0);
  /* Hydration Neglect series (HYD-NEG-006..015, approved 2026-09-08). */
  if(def.triggerType==='missedTotal')return Number(h.missedTotal||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='missedStreak')return Number(h.missedStreak||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='missedFiveInSevenEver')return Boolean(h.missedFiveInSevenEver);
  if(def.triggerType==='under50PercentEver')return Boolean(h.under50PercentEver);
  /* Technical Hydration series (HYD-POS-011..015, HYD-NEG-016..020,
     ASTRA handover from Nox, 8 September 2026). */
  if(def.triggerType==='coffeeTargetMetEver')return Boolean(h.coffeeTargetMetEver);
  if(def.triggerType==='nonWater25PlusTargetMetEver')return Boolean(h.nonWater25PlusTargetMetEver);
  if(def.triggerType==='plainWaterUnder50TargetMetEver')return Boolean(h.plainWaterUnder50TargetMetEver);
  if(def.triggerType==='plainWaterUnder25TargetMetEver')return Boolean(h.plainWaterUnder25TargetMetEver);
  if(def.triggerType==='zeroPlainWaterTargetMetEver')return Boolean(h.zeroPlainWaterTargetMetEver);
  if(def.triggerType==='nonWaterBelowTargetEver')return Boolean(h.nonWaterBelowTargetEver);
  if(def.triggerType==='midRangeMajorityNonWaterEver')return Boolean(h.midRangeMajorityNonWaterEver);
  if(def.triggerType==='nonWater75PlusBelowTargetEver')return Boolean(h.nonWater75PlusBelowTargetEver);
  if(def.triggerType==='nearTargetMajorityNonWaterEver')return Boolean(h.nearTargetMajorityNonWaterEver);
  if(def.triggerType==='zeroPlainWaterThreeTypesBelowTargetEver')return Boolean(h.zeroPlainWaterThreeTypesBelowTargetEver);
  /* Night Running / Night Training (Gym & Strength) — counters derived
     fresh from state.activities in v023RebuildTrainingNightCounters. */
  const t=state.training||{};
  if(def.triggerType==='lateNightRunTotal')return Number(t.lateNightRunTotal||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='midnightRunTotal')return Number(t.midnightRunTotal||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='midnight5kEver')return Boolean(t.midnight5kEver);
  if(def.triggerType==='midnight10kBetween0And4Ever')return Boolean(t.midnight10kBetween0And4Ever);
  if(def.triggerType==='gymAfterHoursTotal')return Number(t.gymAfterHoursTotal||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='gymMidnightTotal')return Number(t.gymMidnightTotal||0)>=Number(def.triggerValue||0);
  /* Ash handoff — Walking & Activity, single-session distance. */
  if(def.triggerType==='walkSingleSession5kEver')return Boolean(t.walkSingleSession5kEver);
  if(def.triggerType==='walkSingleSession10kEver')return Boolean(t.walkSingleSession10kEver);
  /* RUN-POS-001..007 (Distance Milestones, approved 2026-09-08). */
  if(def.triggerType==='longestRunDistanceEver')return Number(t.longestRunDistanceEver||0)>=Number(def.triggerValue||0);
  /* Training Sport session-count milestones (TRN-*, register-approved
     2026-09-08). def.sessionFamily is a key into
     V023_TRAINING_SESSION_FAMILIES / t.sessionMilestoneCounts. */
  if(def.triggerType==='trainingSessionCount')return Number((t.sessionMilestoneCounts||{})[def.sessionFamily]||0)>=Number(def.triggerValue||0);
  /* Sleep — counters derived fresh from the finalized Sleep ledger in
     v023RebuildSleepCounters. */
  const s=state.sleep||{};
  if(def.triggerType==='sleepGoodCount')return Number(s.goodCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepPoorCount')return Number(s.poorCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepTargetMetCount')return Number(s.targetMetCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepTargetMetPoorCount')return Number(s.targetMetPoorCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepMissTargetGoodCount')return Number(s.missTargetGoodCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepExceedTargetPoorCount')return Number(s.exceedTargetPoorCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepUnder75PercentGoodCount')return Number(s.under75PercentGoodCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepOver125PercentPoorCount')return Number(s.over125PercentPoorCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepExactTargetOkayCount')return Number(s.exactTargetOkayCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepSexReasonCount')return Number(s.sexReasonCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepMasReasonCount')return Number(s.masReasonCount||0)>=Number(def.triggerValue||0);
  /* Quests Hub (Lyra -> Astra handoff, 2026-09-06) — generic hooks into
     the universal quest registry owned by app.js. Per that handoff's
     §14 explicit rule, individual quests do NOT get their own
     achievement system; they just declare which of these generic
     triggers apply, and the achievement lives here in the one shared
     registry like everything else. */
  if(def.triggerType==='questFirstCompletion')return Boolean(state.quests?.registry?.[def.triggerValue]?.firstCompletionAt);
  if(def.triggerType==='questDiscoveryPercent')return typeof questDiscoveryPercent==='function'&&questDiscoveryPercent(def.questId)>=Number(def.triggerValue||100);
  /* Daily Quest Minimum (ASTRA Update Package 1 §24-30). */
  const dq=state.dailyQuests||{};
  if(def.triggerType==='dailyQuestStreak')return Number(dq.currentStreak||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='dailyQuestCumulativeTotal')return Number(dq.cumulativeTotal||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='dailyQuestMaxSingleDay')return Number(dq.maxSingleDayCompletedCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='dailyQuestMinimumFirstIncrease')return (dq.changeLog||[]).some(c=>Number(c.to)>Number(c.from));
  if(def.triggerType==='dailyQuestMinimumFirstDecrease')return (dq.changeLog||[]).some(c=>Number(c.to)<Number(c.from));
  if(def.triggerType==='dailyQuestMinimumChangeBurst'){
    const log=(dq.changeLog||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    for(let i=0;i<log.length;i++){
      const windowEndDate=addDays(log[i].date,6);
      const count=log.filter(c=>c.date>=log[i].date&&c.date<=windowEndDate).length;
      if(count>=3)return true;
    }
    return false;
  }
  /* Sleep Other-Text Triggers (SLP-HID-001..015, ASTRA Update Package 1
     §31) — case-insensitive whole-word/phrase match against a finalized
     night's free-text "Other" reason, only when that night both missed
     the sleep target and classified to 'other'. One-time unlock, so a
     simple "has any finalized night ever matched" check is sufficient. */
  if(def.triggerType==='sleepOtherTextTrigger'){
    const rows=Object.values(state.sleep?.ledger||{}).filter(r=>r&&r.finalized&&!r.targetMet&&Array.isArray(r.reasons)&&r.reasons.includes('other')&&r.otherText);
    const words=(def.triggerWords||[]).map(w=>String(w).toLowerCase());
    return rows.some(r=>{
      const text=String(r.otherText).toLowerCase();
      return words.some(w=>new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z0-9]|$)`,'i').test(text));
    });
  }
  /* Main Quest (Phase 3B.6 — infrastructure only) — reads the read-model
     counters app.js's mainQuestComplete/mainQuestAbandon/
     mainQuestSetMilestoneStatus already maintain atomically at their
     own transition points (state.questHub.completionStats). No content
     uses these triggerTypes yet (V023_MAINQUEST_DEFINITIONS is empty);
     this only makes them dispatchable once something does. */
  const mqStats=state.questHub?.completionStats||{};
  if(def.triggerType==='mainQuestCumulativeCompleted')return Number(mqStats.totalCompleted||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='mainQuestCumulativeAbandoned')return Number(mqStats.totalAbandoned||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='mainQuestAreaOfLifeCompletions')return Number((mqStats.byAreaOfLife||{})[def.areaOfLife]||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='mainQuestMilestonesCompletedTotal')return Number(mqStats.totalMilestonesCompleted||0)>=Number(def.triggerValue||0);
  return false;
}
function v023EvaluateDefinitions(definitions,event){
  const ae=v023EnsureAchievementState(),eventId=event?.eventId||v023StableId('achievementEval',todayISO(),state.daily?.water,state.profile?.waterTarget);
  if(ae.processedAchievementEvents.includes(eventId))return [];
  const unlocked=[];definitions.forEach(def=>{if(v023DefinitionSatisfied(def)&&v023UnlockAchievement(def,event))unlocked.push(def.achievementId)});ae.processedAchievementEvents.push(eventId);ae.processedAchievementEvents=ae.processedAchievementEvents.slice(-500);return unlocked;
}
function v023EnsureAchievementHost(){let host=document.querySelector('#achievementPopupHost');if(!host){host=document.createElement('div');host.id='achievementPopupHost';host.className='achievement-popup-host';host.setAttribute('aria-live','polite');document.body.appendChild(host)}return host}
let v023AchievementPopupTimer=null;
function v023PumpAchievementQueue(){
  const ae=v023EnsureAchievementState(),host=v023EnsureAchievementHost();if(host.dataset.busy==='1'||!ae.popupQueue.length)return;
  const item=ae.popupQueue.shift(),def=V023_ACHIEVEMENT_DEFINITIONS.find(d=>d.achievementId===item.achievementId);if(!def)return v023PumpAchievementQueue();host.dataset.busy='1';
  const frame=def.frameAsset?`<img class="achievement-frame-art" src="${asset(def.frameAsset)}" alt="">`:'<div class="achievement-frame-pending">RARITY FRAME ASSET PENDING</div>';
  const tagline=def.systemMessage?`<p class="achievement-popup-tagline">“${esc(def.systemMessage)}”</p>`:'';
  host.innerHTML=`<div class="achievement-popup-backdrop"><article class="achievement-popup rarity-${def.rarity.toLowerCase()}">${frame}<button class="achievement-popup-close" aria-label="Dismiss achievement">×</button><span class="achievement-popup-kicker">ACHIEVEMENT UNLOCKED · ${esc(def.rarity.toUpperCase())}</span><img class="achievement-popup-icon" src="${asset(def.iconAsset)}" alt="${esc(def.name)}"><h2>${esc(def.name)}</h2>${tagline}<p>${esc(def.description)}</p><small>No reward policy assigned yet.</small></article></div>`;
  requestAnimationFrame(()=>host.querySelector('.achievement-popup')?.classList.add('shown'));
  const finish=()=>{clearTimeout(v023AchievementPopupTimer);const p=host.querySelector('.achievement-popup');if(p)p.classList.remove('shown');setTimeout(()=>{host.innerHTML='';host.dataset.busy='0';v023PumpAchievementQueue()},300)};
  host.querySelector('.achievement-popup-close').onclick=finish;v023AchievementPopupTimer=setTimeout(finish,9000);
  const popup=host.querySelector('.achievement-popup');popup.onpointerenter=()=>clearTimeout(v023AchievementPopupTimer);popup.onpointerleave=()=>{v023AchievementPopupTimer=setTimeout(finish,3500)};
}
function v023FinalizePriorHydrationRows(){
  if(!state.hydration?.ledger)return;Object.values(state.hydration.ledger).forEach(row=>{if(row?.date&&row.date<todayISO())row.finalized=true});
}
function v023BackfillHydrationFromAuthoritativeHistory(){
  const h=v023EnsureAchievementState()&&state.hydration;for(const row of (state.resourceHistory||[])){if(!row?.date||h.ledger[row.date])continue;const target=Number(row.waterTarget||row.targetWater||0);if(!(target>0))continue;const water=Number(row.water||0);h.ledger[row.date]={date:row.date,waterAmount:water,targetAtFinalization:target,targetMet:water>=target,overTargetPercent:target?water/target*100:0,finalized:true,source:'resourceHistory',plainWaterMl:water,nonWaterMl:0,nonWaterTypesCount:0,coffeePresent:false}}
}
function v023RebuildHydrationCounters(){
  const h=state.hydration;const rows=Object.values(h.ledger||{}).filter(r=>r&&r.date).sort((a,b)=>a.date.localeCompare(b.date));h.targetDaysTotal=rows.filter(r=>r.targetMet).length;
  let targetStreak=0,overStreak=0,prev=null;const overThreshold=Number(v023EnsureAchievementState().secretConfig.percent||120);
  for(const r of rows){const contiguous=prev&&addDays(prev.date,1)===r.date;if(r.targetMet)targetStreak=contiguous?targetStreak+1:1;else targetStreak=0;if(Number(r.overTargetPercent||0)>=overThreshold)overStreak=contiguous?overStreak+1:1;else overStreak=0;prev=r}
  h.currentTargetStreak=targetStreak;h.overTargetStreak=overStreak;
  v023RebuildHydrationTestBatchCounters(rows);
  return h;
}
/* Hydration Achievement Live Test Batch (2026-09-05) — "completed day"
   hook. There was no existing formal completed-day concept to reuse
   directly, so this reuses the SMALLEST thing that already qualifies:
   the hydration ledger's own `finalized` flag (set by
   v023FinalizePriorHydrationRows once a row's date is in the past),
   which is already how this file distinguishes "today, still live" from
   "a day that's actually done" for hydration data specifically. No new
   calendar/day system is introduced. Only finalized rows are read here
   — today's still-open, non-finalized row is deliberately excluded so
   these achievements never fire off a live/in-progress percentage. */
function v023RebuildHydrationTestBatchCounters(allRows){
  const rows=allRows.filter(r=>r.finalized).sort((a,b)=>a.date.localeCompare(b.date));
  let over100Total=0,over100Streak=0,over200Total=0,missRun=0,zeroStreak=0,maxDailyPercentEver=0,prev=null;
  const recoveryEvents=[],exactAmountsSet=new Set();
  /* Hydration Neglect series (HYD-NEG-006..015, Achievement Design
     Register, approved 2026-09-08) — "missed target" is a broader
     condition than the existing zeroStreak (0ml specifically): any
     finalized day where !r.targetMet, regardless of how much water was
     actually logged. Computed in this same pass over `rows` rather than
     a second loop over the ledger. missedStreak mirrors the existing
     currentTargetStreak convention (current/most-recent run, not a
     historical max) so it behaves the same way targetStreak-based
     achievements already do. */
  let missedTotal=0,missedStreak=0,under50PercentEver=false;
  /* Technical Hydration series (HYD-POS-011..015, HYD-NEG-016..020,
     ASTRA handover from Nox, 8 September 2026) — ten one-shot "ever"
     conditions evaluated per finalized day from the fluid-source fields
     v023UpdateHydrationFromDaily/v023BackfillHydrationFromAuthoritativeHistory
     already write onto each ledger row. "Majority non-water" reuses the
     approved register wording literally (>=50% of what was actually
     logged that day, not of the target) via nonWaterMl>=amount*0.5. */
  let coffeeTargetMetEver=false,nonWater25PlusTargetMetEver=false,plainWaterUnder50TargetMetEver=false,plainWaterUnder25TargetMetEver=false,zeroPlainWaterTargetMetEver=false,nonWaterBelowTargetEver=false,midRangeMajorityNonWaterEver=false,nonWater75PlusBelowTargetEver=false,nearTargetMajorityNonWaterEver=false,zeroPlainWaterThreeTypesBelowTargetEver=false;
  rows.forEach((r,i)=>{
    const pct=Number(r.overTargetPercent||0),contiguous=Boolean(prev&&addDays(prev.date,1)===r.date),amount=Number(r.waterAmount||0);
    if(pct>100)over100Total++;
    over100Streak=(pct>100)?(contiguous?over100Streak+1:1):0;
    if(pct>=200)over200Total++;
    if(pct>maxDailyPercentEver)maxDailyPercentEver=pct;
    exactAmountsSet.add(amount);
    zeroStreak=(amount===0)?(contiguous?zeroStreak+1:1):0;
    if(!r.targetMet){missedTotal++;missedStreak=contiguous?missedStreak+1:1}else missedStreak=0;
    if(pct<50)under50PercentEver=true;
    if(r.targetMet){if(missRun>0)recoveryEvents.push({date:r.date,missedStreakLength:missRun,recoveryIndex:i});missRun=0}
    else missRun=contiguous?missRun+1:1;
    const plainWaterMl=r.plainWaterMl!=null?Number(r.plainWaterMl):amount,nonWaterMl=Number(r.nonWaterMl||0),nonWaterTypesCount=Number(r.nonWaterTypesCount||0),coffeePresent=Boolean(r.coffeePresent),majorityNonWater=amount>0&&nonWaterMl>=amount*0.5;
    if(r.targetMet&&coffeePresent)coffeeTargetMetEver=true;
    if(r.targetMet&&amount>0&&nonWaterMl>=amount*0.25)nonWater25PlusTargetMetEver=true;
    if(r.targetMet&&amount>0&&plainWaterMl<amount*0.5)plainWaterUnder50TargetMetEver=true;
    if(r.targetMet&&amount>0&&plainWaterMl<=amount*0.25)plainWaterUnder25TargetMetEver=true;
    if(r.targetMet&&amount>0&&plainWaterMl===0)zeroPlainWaterTargetMetEver=true;
    if(!r.targetMet&&nonWaterMl>0)nonWaterBelowTargetEver=true;
    if(!r.targetMet&&pct>=50&&pct<100&&majorityNonWater)midRangeMajorityNonWaterEver=true;
    if(!r.targetMet&&amount>0&&nonWaterMl>=amount*0.75)nonWater75PlusBelowTargetEver=true;
    if(!r.targetMet&&pct>=90&&pct<100&&majorityNonWater)nearTargetMajorityNonWaterEver=true;
    if(!r.targetMet&&amount>0&&plainWaterMl===0&&nonWaterTypesCount>=3)zeroPlainWaterThreeTypesBelowTargetEver=true;
    prev=r;
  });
  /* HYD-NEG-009 — 5 missed (not-target-met) days within any rolling
     7-calendar-day window, checked across every finalized row's own
     trailing window (not just contiguous runs — the window can include
     non-consecutive missed days). */
  let missedFiveInSevenEver=false;
  for(const r of rows){
    const windowStart=addDays(r.date,-6);
    const count=rows.filter(x=>!x.targetMet&&x.date>=windowStart&&x.date<=r.date).length;
    if(count>=5){missedFiveInSevenEver=true;break}
  }
  /* HYD-RES-005/006 (recoverySustained) — for each recovery event, the
     forward-looking run of consecutive completed days (starting on the
     recovery day itself) that stayed target-met. Computed once here
     alongside the existing missedStreakLength so no second pass over
     the ledger is needed elsewhere. */
  recoveryEvents.forEach(e=>{
    let run=0,p=null;
    for(let i=e.recoveryIndex;i<rows.length;i++){
      const r=rows[i],cont=Boolean(p&&addDays(p.date,1)===r.date);
      if(i>e.recoveryIndex&&!cont)break;
      if(!r.targetMet)break;
      run++;p=r;
    }
    e.sustainedRunLength=run;
    delete e.recoveryIndex;
  });
  let zeroToDoubleEver=false;
  for(let i=1;i<rows.length;i++){
    if(addDays(rows[i-1].date,1)!==rows[i].date)continue;
    if(Number(rows[i-1].waterAmount||0)===0&&Number(rows[i].overTargetPercent||0)>=200){zeroToDoubleEver=true;break}
  }
  /* HYD-COM-002 (hydrationOscillation4) — any 4 contiguous finalized
     days whose classification (Z = 0%, O = over 100%) strictly
     alternates, in either starting phase. Days that are neither 0% nor
     over 100% break the window. */
  let hydrationOscillation4Ever=false;
  const classifyZO=r=>Number(r.waterAmount||0)===0?'Z':(Number(r.overTargetPercent||0)>100?'O':null);
  for(let i=0;i+3<rows.length&&!hydrationOscillation4Ever;i++){
    const win=rows.slice(i,i+4);
    let contiguousWindow=true;
    for(let k=1;k<4;k++)if(addDays(win[k-1].date,1)!==win[k].date){contiguousWindow=false;break}
    if(!contiguousWindow)continue;
    const classes=win.map(classifyZO);
    if(classes.some(c=>!c))continue;
    if(classes.every((c,idx)=>idx===0||c!==classes[idx-1]))hydrationOscillation4Ever=true;
  }
  state.hydration.over100Total=over100Total;
  state.hydration.over100Streak=over100Streak;
  state.hydration.over200Total=over200Total;
  state.hydration.recoveryEvents=recoveryEvents.slice(-50);
  state.hydration.zeroToDoubleEver=zeroToDoubleEver;
  state.hydration.zeroStreak=zeroStreak;
  state.hydration.maxDailyPercentEver=maxDailyPercentEver;
  state.hydration.exactAmountsEverLogged=[...exactAmountsSet];
  state.hydration.hydrationOscillation4Ever=hydrationOscillation4Ever;
  state.hydration.missedTotal=missedTotal;
  state.hydration.missedStreak=missedStreak;
  state.hydration.missedFiveInSevenEver=missedFiveInSevenEver;
  state.hydration.under50PercentEver=under50PercentEver;
  state.hydration.coffeeTargetMetEver=coffeeTargetMetEver;
  state.hydration.nonWater25PlusTargetMetEver=nonWater25PlusTargetMetEver;
  state.hydration.plainWaterUnder50TargetMetEver=plainWaterUnder50TargetMetEver;
  state.hydration.plainWaterUnder25TargetMetEver=plainWaterUnder25TargetMetEver;
  state.hydration.zeroPlainWaterTargetMetEver=zeroPlainWaterTargetMetEver;
  state.hydration.nonWaterBelowTargetEver=nonWaterBelowTargetEver;
  state.hydration.midRangeMajorityNonWaterEver=midRangeMajorityNonWaterEver;
  state.hydration.nonWater75PlusBelowTargetEver=nonWater75PlusBelowTargetEver;
  state.hydration.nearTargetMajorityNonWaterEver=nearTargetMajorityNonWaterEver;
  state.hydration.zeroPlainWaterThreeTypesBelowTargetEver=zeroPlainWaterThreeTypesBelowTargetEver;
}
function v023UpdateHydrationFromDaily(){
  if(!state.daily||!state.profile)return null;v023EnsureAchievementState();const date=todayISO(),target=Math.max(1,Number(state.profile.waterTarget||2500)),water=Math.max(0,Number(state.daily.water||0)),row=state.hydration.ledger[date]||{date,finalized:false,source:'daily'};
  /* Technical Hydration fluid-source composition (ASTRA handover from
     Nox, 8 September 2026). state.daily.hydrationLog is the source of
     truth for today; hydrationLogTotals() is the same function
     resourceModal('water') in app.js uses to keep d.water in sync, so
     there is exactly one place this arithmetic lives. A day with no log
     entries at all (legacy save, or a blind "adjust total" correction)
     is treated as 100% plain water per the approved migration rule —
     it can never retroactively satisfy a non-water condition. */
  const log=Array.isArray(state.daily.hydrationLog)?state.daily.hydrationLog:[];
  const composition=log.length?hydrationLogTotals(log):{plainWaterMl:water,nonWaterMl:0,nonWaterTypesCount:0,coffeePresent:false};
  if(!row.finalized)Object.assign(row,{waterAmount:water,targetAtFinalization:target,targetMet:water>=target,overTargetPercent:water/target*100,plainWaterMl:composition.plainWaterMl,nonWaterMl:composition.nonWaterMl,nonWaterTypesCount:composition.nonWaterTypesCount,coffeePresent:composition.coffeePresent});state.hydration.ledger[date]=row;v023FinalizePriorHydrationRows();v023RebuildHydrationCounters();
  const cfg=v023EnsureAchievementState().secretConfig;
  /* manualResetCount (HYD-RND-015) changes independently of water/date,
     so it must be part of this event's identity — otherwise a reset
     that doesn't also change today's water total would hash-collide
     with the immediately preceding hydrationDaily event and the
     achievement pass would be silently skipped by the dedup guard. The
     same reasoning applies to the new composition fields: two different
     fluid mixes can total the same water amount, so they must be in the
     hash too or a composition-only change gets silently skipped. */
  const eventId=v023StableId('hydrationDaily',date,Math.round(water),Math.round(target),state.hydration.targetDaysTotal,state.hydration.currentTargetStreak,state.hydration.overTargetStreak,cfg.percent,cfg.days,state.hydration.manualResetCount,Math.round(row.plainWaterMl||0),Math.round(row.nonWaterMl||0),row.nonWaterTypesCount||0,row.coffeePresent?1:0);const event=v023RecordSharedEvent(v023EventEnvelope('hydrationDailyUpdated','home','water',{date,waterAmount:water,target,targetMet:row.targetMet,overTargetPercent:row.overTargetPercent},eventId));v023EvaluateDefinitions(V023_ACHIEVEMENT_DEFINITIONS,event);return event;
}
/* ---------- Sleep achievement ledger (mirrors Hydration exactly) ---------- */
function v023NormalizeSleepQuality(raw){
  if(raw==='positive')return 'Good';
  if(raw==='neutral')return 'Okay';
  if(raw==='negative')return 'Poor';
  return '';
}
function v023FinalizePriorSleepRows(){
  if(!state.sleep?.ledger)return;Object.values(state.sleep.ledger).forEach(row=>{if(row?.date&&row.date<todayISO())row.finalized=true});
}
function v023RebuildSleepCounters(){
  v023EnsureAchievementState();
  const rows=Object.values(state.sleep.ledger||{}).filter(r=>r&&r.date&&r.finalized).sort((a,b)=>a.date.localeCompare(b.date));
  let goodCount=0,poorCount=0,targetMetCount=0,targetMetPoorCount=0,missTargetGoodCount=0,exceedTargetPoorCount=0,under75PercentGoodCount=0,over125PercentPoorCount=0,exactTargetOkayCount=0,sexReasonCount=0,masReasonCount=0;
  rows.forEach(r=>{
    const quality=r.quality||'',hours=Number(r.hours||0),target=Number(r.targetAtFinalization||0),targetMet=Boolean(r.targetMet),reasons=Array.isArray(r.reasons)?r.reasons:[];
    if(quality==='Good')goodCount++;
    if(quality==='Poor')poorCount++;
    if(targetMet)targetMetCount++;
    if(targetMet&&quality==='Poor')targetMetPoorCount++;
    if(!targetMet&&quality==='Good')missTargetGoodCount++;
    if(target>0&&hours>target&&quality==='Poor')exceedTargetPoorCount++;
    if(target>0&&hours<target*0.75&&quality==='Good')under75PercentGoodCount++;
    if(target>0&&hours>target*1.25&&quality==='Poor')over125PercentPoorCount++;
    if(target>0&&Number(hours.toFixed(2))===Number(target.toFixed(2))&&quality==='Okay')exactTargetOkayCount++;
    if(!targetMet&&reasons.includes('sex'))sexReasonCount++;
    if(!targetMet&&reasons.includes('masturbation'))masReasonCount++;
  });
  Object.assign(state.sleep,{goodCount,poorCount,targetMetCount,targetMetPoorCount,missTargetGoodCount,exceedTargetPoorCount,under75PercentGoodCount,over125PercentPoorCount,exactTargetOkayCount,sexReasonCount,masReasonCount});
}
function v023UpdateSleepFromDaily(){
  if(!state.daily||!state.profile)return null;
  v023EnsureAchievementState();
  const date=todayISO(),target=Math.max(0.1,Number(state.profile.sleepTarget||8)),hours=Math.max(0,Number(state.daily.sleep||0)),quality=v023NormalizeSleepQuality(state.daily.sleepQuality),reasons=Array.isArray(state.daily.sleepReasons)?state.daily.sleepReasons.slice():[],otherText=String(state.daily.sleepReasonOtherText||'').trim();
  const row=state.sleep.ledger[date]||{date,finalized:false,source:'daily'};
  if(!row.finalized)Object.assign(row,{hours,targetAtFinalization:target,targetMet:hours>=target,quality,reasons,otherText});
  state.sleep.ledger[date]=row;
  v023FinalizePriorSleepRows();v023RebuildSleepCounters();
  const eventId=v023StableId('sleepDaily',date,Math.round(hours*60),Math.round(target*60),quality,reasons.join(','),otherText);
  const event=v023RecordSharedEvent(v023EventEnvelope('sleepDailyUpdated','home','sleep',{date,hours,target,quality,reasons,otherText},eventId));
  v023EvaluateDefinitions(V023_ACHIEVEMENT_DEFINITIONS,event);
  return event;
}
/* ---------- Night Running / Night Training achievement counters ----------
   Recomputed fresh from state.activities on every save, exactly like
   Hydration/Sleep are recomputed fresh from their ledgers — recomputing
   from scratch each time is idempotent, so nothing can double-count
   from repeated save() calls. A blank/unparseable #actTime never
   qualifies (never faking a time-of-day condition from missing data). */
function v023TimeHour(t){
  const m=/^(\d{1,2}):(\d{2})$/.exec(String(t||'').trim());
  if(!m)return null;
  const h=Number(m[1]);
  return (h>=0&&h<24)?h:null;
}
function v023RebuildTrainingNightCounters(){
  const trn=ensureTrainingState();
  const RUN_TYPES=['Running','Long Run','Interval Run'];
  let lateNightRunTotal=0,midnightRunTotal=0,midnight5kEver=false,midnight10kBetween0And4Ever=false,gymAfterHoursTotal=0,gymMidnightTotal=0;
  /* Ash handoff (2026-09-08, "Slow and Steady" / "Tortoise and Hare") —
     single-session Walking distance, time-of-day irrelevant. Per the
     handoff's own explicit instruction: "Use walking-distance data
     rather than Training session count" — so this reads a.distance on
     a completed type==='Walking' activity, same idempotent
     recompute-from-scratch pattern as the rest of this function, not a
     new counter store. */
  let walkSingleSession5kEver=false,walkSingleSession10kEver=false;
  /* RUN-POS-001..007 (Distance Milestones, approved 2026-09-08) — longest
     single completed Running-family session distance ever, matching the
     register's own Progress Metric field ("Longest completed run
     distance") exactly. Same RUN_TYPES family as Night Running, all
     time (not just today), idempotent recompute like everything else
     here. RUN-POS-008 ("Ironman-distance triathlon") is deliberately
     NOT covered — there is no triathlon/multi-discipline event concept
     anywhere in this app to detect it from. */
  let longestRunDistanceEver=0;
  (state.activities||[]).forEach(a=>{
    if(!a||!a.completed)return;
    const distance=Number(a.distance||0);
    if(a.type==='Walking'){
      if(distance>=5)walkSingleSession5kEver=true;
      if(distance>=10)walkSingleSession10kEver=true;
    }
    if(RUN_TYPES.includes(a.type)&&distance>longestRunDistanceEver)longestRunDistanceEver=distance;
    const hour=v023TimeHour(a.time);
    if(hour===null)return;
    const lateNight=hour>=22||hour<6,midnight=hour>=0&&hour<6,midnight0to4=hour>=0&&hour<4;
    if(RUN_TYPES.includes(a.type)){
      if(lateNight)lateNightRunTotal++;
      if(midnight){midnightRunTotal++;if(distance>=5)midnight5kEver=true}
      if(midnight0to4&&distance>=10)midnight10kBetween0And4Ever=true;
    }else if(a.type==='Gym / Strength'){
      if(lateNight)gymAfterHoursTotal++;
      if(midnight)gymMidnightTotal++;
    }
  });
  Object.assign(trn,{lateNightRunTotal,midnightRunTotal,midnight5kEver,midnight10kBetween0And4Ever,gymAfterHoursTotal,gymMidnightTotal,walkSingleSession5kEver,walkSingleSession10kEver,longestRunDistanceEver});
}
/* Training Sport session-count milestones (Achievement Design Register,
   TRN-* rows, Design Status Approved 2026-09-08 — user confirmed the
   per-row status over the Master Index tab's stale "Concept" summary
   for this exact question). Cumulative COMPLETED sessions per activity
   family, idempotent recompute from state.activities every save, same
   pattern as every other counter in this file. Only families with an
   unambiguous 1:1 (or established-precedent) mapping to an existing
   ACTIVITY_TYPES value are implemented here — TRN-TMS ("Team Sports")
   and TRN-DAN ("Dancing") are deliberately NOT included: the register
   never enumerates which ACTIVITY_TYPES count as "Team Sports", and
   there is no "Dancing"/"Dance" value in ACTIVITY_TYPES at all (app.js)
   for TRN-DAN to ever trigger against. Flagged back rather than
   guessed — see the return report. Running groups the same three types
   ('Running','Long Run','Interval Run') the existing Night Running
   achievements already treat as one family, not a new invented rule. */
const V023_TRAINING_SESSION_FAMILIES={
  Running:['Running','Long Run','Interval Run'],
  Cycling:['Cycling'],
  Swimming:['Swimming'],
  Strength:['Gym / Strength'],
  Yoga:['Yoga'],
  MartialArts:['Martial Arts'],
  Climbing:['Climbing'],
  Other:['Other']
};
function v023RebuildTrainingSessionMilestoneCounters(){
  const trn=ensureTrainingState();
  const counts={};
  Object.keys(V023_TRAINING_SESSION_FAMILIES).forEach(k=>counts[k]=0);
  (state.activities||[]).forEach(a=>{
    if(!a||!a.completed)return;
    for(const key of Object.keys(V023_TRAINING_SESSION_FAMILIES)){
      if(V023_TRAINING_SESSION_FAMILIES[key].includes(a.type)){counts[key]++;break}
    }
  });
  trn.sessionMilestoneCounts=counts;
}
function v023UpdateTrainingAchievementsFromDaily(){
  v023EnsureAchievementState();v023RebuildTrainingNightCounters();v023RebuildTrainingSessionMilestoneCounters();
  const trn=state.training;
  const smc=trn.sessionMilestoneCounts||{};
  const eventId=v023StableId('trainingNightDaily',trn.lateNightRunTotal,trn.midnightRunTotal,trn.midnight5kEver,trn.midnight10kBetween0And4Ever,trn.gymAfterHoursTotal,trn.gymMidnightTotal,trn.walkSingleSession5kEver,trn.walkSingleSession10kEver,trn.longestRunDistanceEver,smc.Running,smc.Cycling,smc.Swimming,smc.Strength,smc.Yoga,smc.MartialArts,smc.Climbing,smc.Other);
  const event=v023RecordSharedEvent(v023EventEnvelope('trainingNightAchievementsUpdated','training',null,{lateNightRunTotal:trn.lateNightRunTotal,midnightRunTotal:trn.midnightRunTotal,midnight5kEver:trn.midnight5kEver,midnight10kBetween0And4Ever:trn.midnight10kBetween0And4Ever,gymAfterHoursTotal:trn.gymAfterHoursTotal,gymMidnightTotal:trn.gymMidnightTotal,walkSingleSession5kEver:trn.walkSingleSession5kEver,walkSingleSession10kEver:trn.walkSingleSession10kEver,longestRunDistanceEver:trn.longestRunDistanceEver,sessionMilestoneCounts:smc},eventId));
  v023EvaluateDefinitions(V023_ACHIEVEMENT_DEFINITIONS,event);
  return event;
}
const v023OriginalSave=save;let v023SaveGuard=false;
/* Quests Hub achievement hook — same reason manualResetCount needed one:
   the other three daily-update functions build their dedup eventId only
   from hydration/sleep/training fields, so a save() triggered purely by
   quest-registry changes (completion, discovery) would hash-collide
   with the previous event and get silently skipped. Evaluates the full
   shared registry (all categories), exactly like the other three. */
function v023UpdateQuestAchievementsFromDaily(){
  if(typeof state.quests!=='object'||!state.quests)return null;
  v023EnsureAchievementState();
  const reg=state.quests.registry||{};
  const fingerprint=Object.keys(reg).sort().map(id=>{
    const r=reg[id];
    return `${id}:${r.firstCompletionAt||0}:${r.runsCompleted||0}:${Object.keys(r.discovery?.items||{}).sort().map(k=>`${k}=${r.discovery.items[k].discovered?1:0}${r.discovery.items[k].revealed?1:0}`).join(',')}`;
  }).join('|');
  const eventId=v023StableId('questsDaily',fingerprint);
  const event=v023RecordSharedEvent(v023EventEnvelope('questsUpdated','quests',null,{fingerprint},eventId));
  v023EvaluateDefinitions(V023_ACHIEVEMENT_DEFINITIONS,event);
  return event;
}
/* ---------- Daily Quest Minimum (ASTRA Update Package 1, 2026-09-06) ----------
   Mirrors the Hydration ledger pattern exactly: a permanent, never-
   trimmed date-keyed ledger, today's row updated in place until the
   date passes, then finalized forever. Each row keeps the minimum that
   was active when IT finalized, so a later confirmed target change
   never reinterprets past days. state.sideQuestHistory (Quest Board /
   Side Quest completions) is the existing "qualifying action" source —
   no new completion-tracking mechanism was introduced. */
function ensureDailyQuestsState(){
  state.dailyQuests=state.dailyQuests&&typeof state.dailyQuests==='object'?state.dailyQuests:{minimum:3,streakResetAt:null,ledger:{},changeLog:[]};
  const dq=state.dailyQuests;
  dq.minimum=Number(dq.minimum||3);
  dq.streakResetAt=dq.streakResetAt||null;
  dq.ledger=dq.ledger&&typeof dq.ledger==='object'?dq.ledger:{};
  dq.changeLog=Array.isArray(dq.changeLog)?dq.changeLog:[];
  dq.currentStreak=Number(dq.currentStreak||0);
  dq.longestStreak=Number(dq.longestStreak||0);
  return dq;
}
function v023FinalizePriorDailyQuestRows(){
  const dq=state.dailyQuests;if(!dq?.ledger)return;
  Object.values(dq.ledger).forEach(row=>{if(row?.date&&row.date<todayISO())row.finalized=true});
}
function v023RebuildDailyQuestCounters(){
  const dq=ensureDailyQuestsState();
  const rows=Object.values(dq.ledger).filter(r=>r&&r.date&&r.finalized).sort((a,b)=>a.date.localeCompare(b.date));
  let streak=0,prevDate=null;
  for(const r of rows){
    const contiguous=Boolean(prevDate&&addDays(prevDate,1)===r.date);
    const afterReset=!dq.streakResetAt||r.date>dq.streakResetAt;
    streak=(r.qualified&&afterReset)?(contiguous?streak+1:1):0;
    prevDate=r.date;
  }
  dq.currentStreak=streak;
  dq.longestStreak=Math.max(Number(dq.longestStreak||0),streak);
  /* DQ-POS-004/005/006 (approved 2026-09-08) — "Daily Quest" in this
     app's actual data model is a completed-Side-Quest count checked
     against a configurable daily minimum (see the block comment above
     ensureDailyQuestsState/v023UpdateDailyQuestFromDaily), NOT an
     individually-tracked quest-item system. cumulativeTotal reuses the
     existing state.sideQuestHistory record directly (the same
     "qualifying action" source already established for this whole
     category) rather than summing ledger rows. maxSingleDayCompletedCount
     includes today's own live (not-yet-finalized) row so a big single
     day counts immediately rather than waiting for tomorrow's rollover
     — every other value read here is finalized-only, but a same-day
     count doesn't have the "could still change before day-end" problem
     the finalized-only convention exists to avoid: completedCount can
     only go up during the day, never down. */
  dq.cumulativeTotal=(state.sideQuestHistory||[]).length;
  dq.maxSingleDayCompletedCount=Object.values(dq.ledger).reduce((max,r)=>Math.max(max,Number(r?.completedCount||0)),0);
  return dq;
}
function v023UpdateDailyQuestFromDaily(){
  const dq=ensureDailyQuestsState(),date=todayISO(),minimum=Number(dq.minimum||3);
  const completedCount=(state.sideQuestHistory||[]).filter(x=>x.date===date).length;
  const row=dq.ledger[date]||{date,finalized:false};
  if(!row.finalized)Object.assign(row,{completedCount,minimumAtFinalization:minimum,qualified:completedCount>=minimum});
  dq.ledger[date]=row;
  v023FinalizePriorDailyQuestRows();
  v023RebuildDailyQuestCounters();
  /* Achievement fingerprint must include BOTH the streak-affecting
     ledger state AND the changeLog (target-change achievements read
     changeLog directly, not the streak) — ASTRA Update Package 1 §32's
     own explicit reminder to not repeat the manualResetCount/quest
     dedup bug a third time. */
  const fingerprint=`${dq.currentStreak}:${dq.minimum}:${dq.changeLog.length}:${dq.changeLog.map(c=>`${c.date}-${c.from}-${c.to}`).join(',')}:${dq.cumulativeTotal}:${dq.maxSingleDayCompletedCount}`;
  const eventId=v023StableId('dailyQuestDaily',fingerprint);
  const event=v023RecordSharedEvent(v023EventEnvelope('dailyQuestUpdated','quest-board',null,{fingerprint},eventId));
  v023EvaluateDefinitions(V023_ACHIEVEMENT_DEFINITIONS,event);
  return event;
}
/* Main Quest achievement update hook (Phase 3B.6 — infrastructure
   only). Same shape as every v023Update*FromDaily above: no counters
   are rebuilt here (unlike hydration/sleep/training, Main Quest's
   completionStats read-model is already maintained atomically at its
   own mutation points in app.js — mainQuestComplete/mainQuestAbandon/
   mainQuestSetMilestoneStatus — so this function only has to fingerprint
   the current values and hand them to the same evaluator every other
   domain already goes through). The fingerprint covers every counter a
   mainQuest* triggerType can read, so any real change to any of them
   produces a new eventId; an unchanged fingerprint reproduces the same
   eventId, which v023EvaluateDefinitions' processedAchievementEvents
   dedup (and v023RecordSharedEvent's own eventId dedup) both already
   treat as "already handled" — no separate idempotency mechanism
   needed here, same guarantee every other domain in this chain relies
   on. Evaluates V023_MAINQUEST_DEFINITIONS (currently empty) through
   the exact same v023EvaluateDefinitions/v023DefinitionSatisfied path
   as V023_ACHIEVEMENT_DEFINITIONS — real content can be added to that
   array later with zero further wiring. */
function v023UpdateMainQuestAchievementsFromDaily(){
  if(typeof ensureQuestHubState!=='function')return null;
  const stats=ensureQuestHubState().completionStats||{};
  const fingerprint=`${stats.totalCompleted||0}:${stats.totalAbandoned||0}:${stats.totalMilestonesCompleted||0}:${Object.keys(stats.byAreaOfLife||{}).sort().map(k=>`${k}=${stats.byAreaOfLife[k]}`).join(',')}`;
  const eventId=v023StableId('mainQuestDaily',fingerprint);
  const event=v023RecordSharedEvent(v023EventEnvelope('mainQuestUpdated','main-quest',null,{fingerprint},eventId));
  v023EvaluateDefinitions(V023_MAINQUEST_DEFINITIONS,event);
  return event;
}
save=function(){if(!v023SaveGuard){v023SaveGuard=true;try{v023UpdateHydrationFromDaily();v023UpdateSleepFromDaily();v023UpdateTrainingAchievementsFromDaily();v023UpdateQuestAchievementsFromDaily();v023UpdateDailyQuestFromDaily();v023UpdateMainQuestAchievementsFromDaily()}finally{v023SaveGuard=false}}return v023OriginalSave()};
achievementsModal=function(){
  v023EnsureState();const ae=v023EnsureAchievementState();const legacy=(state.achievements||[]).map(a=>typeof a==='string'?{id:a,title:a,description:'Legacy achievement record'}:a).filter(Boolean);
  modal(`<h2>Achievements</h2><p class="helper">Positive Hydration is the reusable Achievement-engine pilot. Character stat milestones and Training events are intentionally separate.</p><div class="v023-achievement-list">${V023_ACHIEVEMENT_DEFINITIONS.map(def=>{const unlocked=ae.unlockedAchievements.find(x=>x.achievementId===def.achievementId),secret=v023DefinitionHidden(def)&&!unlocked;return `<div class="v023-achievement-row rarity-${def.rarity.toLowerCase()}"><div class="v023-achievement-art">${secret?'<div class="secret-placeholder">?</div>':`<img src="${asset(def.iconAsset)}" alt="${esc(def.name)}">`}</div><div><span class="v023-rarity">${esc(def.rarity.toUpperCase())}</span><h3>${secret?'SECRET ACHIEVEMENT':esc(def.name)}</h3><p>${secret?'Requirement concealed until unlocked.':esc(def.description)}</p>${!def.frameAsset&&def.rarity!=='Secret'?'<small class="asset-blocked">Rarity frame asset pending approval.</small>':''}</div><span class="tag ${unlocked?'quest':''}">${unlocked?'Unlocked':'Locked'}</span></div>`}).join('')}</div>${legacy.length?`<h3 class="v023-legacy-heading">Legacy History</h3>${legacy.map(a=>`<div class="list-item"><div>🏆</div><div><h3>${esc(a.title||a.id||'Legacy achievement')}</h3><p>${esc(a.description||'Preserved historical record; no replayed reward.')}</p></div><span class="tag quest">Stored</span></div>`).join('')}`:''}`);
};


/* ---------- v0.02.4 Home correction pass ---------- */
const v0231BaselineResourcesHeaderHTML=resourcesHeaderHTML;
resourcesHeaderHTML=function(){
  if(!HOME_VISUAL_MARBLE)return v0231BaselineResourcesHeaderHTML();
  return `<div class="resources-section-header collapse-icon-row home-variant-utility-header ${homeResourcesOpen?'expanded':'collapsed'}"><button class="home-section-tool icon-tool home-variant-utility" id="resourceTrackerButton"><img src="${asset(V0231_HOME_UTILITY_ICONS.tracker)}" alt=""><span>Tracker</span></button><button class="home-section-art central-collapse-control" id="toggleResourcesSection" aria-expanded="${homeResourcesOpen}" aria-label="${homeResourcesOpen?'Collapse':'Expand'} Resources"><img src="${asset('Resources.png')}" alt="Resources"></button><button class="home-section-tool icon-tool home-variant-utility" id="resourceHistoryButton"><img src="${asset(V0231_HOME_UTILITY_ICONS.history)}" alt=""><span>History</span></button></div>`;
};
const v0231BaselineDevelopmentHeaderHTML=developmentHeaderHTML;
developmentHeaderHTML=function(){
  if(!HOME_VISUAL_MARBLE)return v0231BaselineDevelopmentHeaderHTML();
  return `<div class="resources-section-header development-section-header collapse-icon-row home-variant-utility-header ${homeDevelopmentOpen?'expanded':'collapsed'}"><button class="home-section-tool icon-tool home-variant-utility" id="bonusDevelopmentButton"><img src="${asset(V0231_HOME_UTILITY_ICONS.bonus)}" alt=""><span>Bonus</span></button><button class="home-section-art central-collapse-control" id="toggleDevelopmentSection" aria-expanded="${homeDevelopmentOpen}" aria-label="${homeDevelopmentOpen?'Collapse':'Expand'} Development"><img src="${asset('Development.png')}" alt="Development"></button><button class="home-section-tool icon-tool home-variant-utility" id="developmentArchiveButton"><img src="${asset(V0231_HOME_UTILITY_ICONS.archive)}" alt=""><span>Archive</span></button></div>`;
};
const v0231BaselineChallengeCardHTML=challengeCardHTML;
challengeCardHTML=function(){
  if(!HOME_VISUAL_MARBLE)return v0231BaselineChallengeCardHTML();
  const ch=dailyChallenge(),cs=challengeState(),locked=dailyChallengeLocked(),status=locked?'COMPLETE':cs.status;let action='';
  if(status==='AVAILABLE')action=`<button class="rpg-btn accent challenge-action variant-accept-challenge" id="acceptChallenge"><img src="${asset(V0231_HOME_UTILITY_ICONS.acceptChallenge)}" alt=""><span>ACCEPT CHALLENGE</span></button>`;
  else if(status==='ACTIVE')action=`<div class="challenge-actions"><button class="rpg-btn accent" id="completeChallenge">Complete</button><button class="text-btn danger" id="abandonChallenge">Abandon</button></div>`;
  else action=`<button class="rpg-btn" disabled>${status==='COMPLETE'?'Completed ✓':status}</button>`;
  return `<article class="development-card challenge-card"><div class="development-head challenge-head"><button class="development-icon-action" id="challengeTrackerIcon" aria-label="Open Daily Challenge Tracker"><img src="${asset('Daily_Challenge.png')}" alt=""></button><div><span>DAILY CHALLENGE</span><small>${esc(ch.category)} · ${status}</small></div></div><div class="challenge-content"><h3>${esc(ch.title)}</h3><p>${esc(ch.text)}</p>${ch.durationMin?`<small>Minimum duration: ${ch.durationMin} minutes · elapsed time verified, activity honor-based.</small>`:ch.verification==='steps'?'<small>Progress verified using the app’s tracked Steps value.</small>':'<small>Completion is honor-based.</small>'}<strong>+${ch.xp} XP · Minor Loot Box</strong>${action}</div></article>`;
};
function v0231SetVariantUtilityIcons(){
  const pairs=[
    ['#resourceTrackerButton',V0231_HOME_UTILITY_ICONS.tracker],['#resourceHistoryButton',V0231_HOME_UTILITY_ICONS.history],
    ['#bonusDevelopmentButton',V0231_HOME_UTILITY_ICONS.bonus],['#developmentArchiveButton',V0231_HOME_UTILITY_ICONS.archive]
  ];
  pairs.forEach(([sel,file])=>{const img=document.querySelector(`${sel} img`);if(img)img.src=asset(file)});
}
function v0231CorrectTodayRows(){
  const panel=document.querySelector('.home-command-panel');if(!panel)return;panel.classList.add('home-today-corrected');
  const rows=[...panel.querySelectorAll(':scope > .command-section')];
  const labels=['MAIN QUEST','SIDE QUEST','PRIMARY TASK','TODAY’S SCHEDULE'];
  rows.forEach((row,index)=>{
    row.classList.add('home-today-row');row.dataset.row=String(index+1);
    const trigger=row.querySelector(':scope > .command-icon-button');
    if(!trigger)return;
    const img=trigger.querySelector('img');
    if(img){const left=document.createElement('div');left.className='home-today-left-icon';left.innerHTML=`<img src="${img.src}" alt="">`;row.insertBefore(left,row.firstChild)}
    const right=document.createElement('div');right.className='home-today-row-actions';
    trigger.classList.add('home-today-row-trigger');
    if(trigger.id==='toggleMainQuest'||trigger.id==='toggleSideQuests')trigger.innerHTML=`<span>${trigger.getAttribute('aria-expanded')==='true'?'CLOSE':'OPEN'}</span>`;
    else if(trigger.id==='openPrimaryTask')trigger.innerHTML='<span>OPEN</span>';
    else if(trigger.id==='openCalendar')trigger.innerHTML='<span>VIEW</span>';
    right.appendChild(trigger);
    const tray=row.querySelector(':scope > .quest-action-tray');if(tray){tray.classList.add('home-today-extra-actions');right.appendChild(tray)}
    row.appendChild(right);
    const kicker=row.querySelector('.quest-kicker');if(kicker)kicker.textContent=labels[index]||kicker.textContent;
  });
}
function v0231AddWeatherForecastButton(){
  const panel=document.querySelector('.weather-panel');if(!panel||panel.querySelector('#weatherForecastButton'))return;
  const b=document.createElement('button');b.id='weatherForecastButton';b.className='home-weather-forecast-button';b.type='button';b.textContent='FORECAST';b.onclick=openWeatherForecast;panel.appendChild(b);
}
function v0231CorrectPlayerTools(){
  const panel=document.querySelector('.player-status-panel');const tools=panel?.querySelector('.player-status-tools');if(panel&&tools){panel.classList.add('player-tools-corrected');tools.classList.add('player-status-tools-corner')}
}
function v0231ApplyHomeCorrection(){
  if(!HOME_VISUAL_MARBLE)return;
  view.classList.add('home-marble-correction');
  v0231SetVariantUtilityIcons();v0231CorrectTodayRows();v0231AddWeatherForecastButton();v0231CorrectPlayerTools();
}

/* ---------- Reversible Home marble candidate ---------- */
function v023VariantResourceIcons(){
  if(!HOME_VISUAL_MARBLE)return;Object.entries(V023_HOME_RESOURCE_ICONS).forEach(([key,file])=>document.querySelectorAll(`.resource-row-icon[data-resource="${key}"] img`).forEach(img=>img.src=asset(file)));
}
function v023Plaque(target,label){if(!target||target.querySelector(':scope > .home-variant-plaque'))return;target.insertAdjacentHTML('afterbegin',`<div class="home-variant-plaque">${label}</div>`)}
function v023ApplyHomeVariant(){
  view.classList.toggle('home-visual-marble',HOME_VISUAL_MARBLE);view.classList.toggle('home-all-variants',HOME_VISUAL_MODE==='all-variants');if(!HOME_VISUAL_MARBLE)return;
  v023Plaque(document.querySelector('.player-status-panel'),'PLAYER STATUS');v023Plaque(document.querySelector('.weather-panel'),'WEATHER');
  const today=document.querySelector('.home-command-panel .today-label');if(today){today.classList.add('home-variant-plaque','home-variant-today');today.textContent='TODAY'}
  const res=document.querySelector('.resource-section-frame')||document.querySelector('.resources-section-header');if(res)v023Plaque(res,'RESOURCES');const dev=document.querySelector('.development-section-frame')||document.querySelector('.development-section-header');if(dev)v023Plaque(dev,'DEVELOPMENT');
  document.querySelector('.resources-section-header .central-collapse-control')?.classList.add('variant-title-art-hidden');document.querySelector('.development-section-header .central-collapse-control')?.classList.add('variant-title-art-hidden');v023VariantResourceIcons();v0231ApplyHomeCorrection();
}
const v023OriginalRenderHome=renderHome;
renderHome=function(){v023EnsureState();v023OriginalRenderHome();v023ApplyHomeVariant()};
const v023OriginalDecorateWeatherForecastModal=decorateWeatherForecastModal;
decorateWeatherForecastModal=function(){v023OriginalDecorateWeatherForecastModal();if(HOME_VISUAL_MARBLE)modalRoot.querySelector('.weather-forecast-modal')?.classList.add('home-marble-weather-modal')};

/* Initial upgrade runs after the legacy script boots; re-render immediately with the new runtime functions. */
v023EnsureState();v023UpdateHydrationFromDaily();v023UpdateSleepFromDaily();v023UpdateTrainingAchievementsFromDaily();v023UpdateQuestAchievementsFromDaily();v023UpdateDailyQuestFromDaily();v023OriginalSave();
if(page==='home')renderHome();else render();


/* ---------- v0.02.4 COMPLETE HOME VARIANT 2 VISUAL LAYER ----------
   RETIRED FROM THE V3 LIVE RENDER PATH (2026-09-07) alongside
   HOME_VISUAL_MARBLE above — same reasoning, see that comment. This
   also transitively disables v0.02.4.1-frame-hotfix.js's
   home-v2-modal-frame (already visually superseded on Home by
   body[data-theme="home"] .modal in v0.02.5-home-baseline.css, so no
   compensating CSS was needed for that one — confirmed by regression
   test). */
const HOME_VARIANT_2=false; // non-persistent, reversible visual/layout switch only
const V024={
 title:{player:'Variant 2 - Player Status.png',weather:'Variant 2 - Weather.png',today:'Variant 2 - Today.png',resources:'Variant 2 - Resources.png',development:'Variant 2 - Development.png'},
 controls:{help:'Variant 2 - Help.png',settings:'Variant 2 - Settings.png',forecast:'Variant 2 - Forecast.png',tracker:'Variant 2 - Tracker.png',history:'Variant 2 - History.png',bonus:'Variant 2 - Bonus.png',archive:'Variant 2 - Archive.png',openNext:'Variant 2 - Open Next.png'},
 today:['Variant 2 - Main Quest.png','Variant 2 - Side Quest.png','Variant 2 - Primary Task.png',"Variant 2 - Today's Schedule.png"],
 development:{word:'icons/development/ICON_DEV_WORD.png',wisdom:'icons/development/ICON_DEV_WISDOM.png',challenge:'icons/development/ICON_DEV_CHALLENGE.png',accept:'Variant accept challenge.png'},
 rewards:{xp:'Variant 2 - XP Reward.png',gold:'Variant 2 - Gold Reward.png',loot:'Variant 2 - Loot Box Reward.png'}
};
function v024Title(target,file,alt){
  if(!target)return;
  target.querySelectorAll(':scope > .home-variant-plaque').forEach(x=>x.remove());
  let el=target.querySelector(':scope > .home-v2-title');
  if(!el){el=document.createElement('div');el.className='home-v2-title';target.insertBefore(el,target.firstChild)}
  el.innerHTML=`<img src="${asset(file)}" alt="${esc(alt)}">`;
}
function v024ApplyPlayer(){
  const p=document.querySelector('.player-status-panel'); if(!p||p.classList.contains('widget-player-status'))return; v024Title(p,V024.title.player,'Player Status');
  const help=p.querySelector('#helpButton'),settings=p.querySelector('#settingsButton');
  if(help){help.classList.add('v2-icon-control');help.innerHTML=`<img src="${asset(V024.controls.help)}" alt="Help">`}
  if(settings){settings.classList.add('v2-icon-control');settings.innerHTML=`<img src="${asset(V024.controls.settings)}" alt="Settings">`}
}
function v024ApplyWeather(){
  const p=document.querySelector('.weather-panel');if(!p)return;v024Title(p,V024.title.weather,'Weather');
  const b=p.querySelector('#weatherForecastButton');if(b){b.classList.add('v2-forecast-control');b.innerHTML=`<img src="${asset(V024.controls.forecast)}" alt="Forecast">`;b.setAttribute('aria-label','Open forecast')}
}
function v024ApplyToday(){
  const p=document.querySelector('.home-command-panel');if(!p)return;
  const label=p.querySelector('.today-label');if(label){label.className='today-label home-v2-title home-v2-today-title';label.innerHTML=`<img src="${asset(V024.title.today)}" alt="Today">`}
  [...p.querySelectorAll('.home-today-row')].slice(0,4).forEach((row,i)=>{
    const left=row.querySelector('.home-today-left-icon img');if(left)left.src=asset(V024.today[i]);
    const trigger=row.querySelector('.home-today-row-trigger');if(trigger){trigger.classList.add('v2-open-next');trigger.innerHTML=`<img src="${asset(V024.controls.openNext)}" alt="Open next">`;trigger.setAttribute('aria-label','Open next')}
  });
}
const v024PrevResourcesHeaderHTML=resourcesHeaderHTML;
resourcesHeaderHTML=function(){
  if(!HOME_VARIANT_2)return v024PrevResourcesHeaderHTML();
  return `<div class="resources-section-header collapse-icon-row v2-section-header ${homeResourcesOpen?'expanded':'collapsed'}"><button class="home-section-tool v2-icon-control" id="resourceTrackerButton" aria-label="Tracker"><img src="${asset(V024.controls.tracker)}" alt="Tracker"></button><button class="home-section-art central-collapse-control v2-section-title-button" id="toggleResourcesSection" aria-expanded="${homeResourcesOpen}" aria-label="${homeResourcesOpen?'Collapse':'Expand'} Resources"><img src="${asset(V024.title.resources)}" alt="Resources"></button><button class="home-section-tool v2-icon-control" id="resourceHistoryButton" aria-label="History"><img src="${asset(V024.controls.history)}" alt="History"></button></div>`;
};
const v024PrevDevelopmentHeaderHTML=developmentHeaderHTML;
developmentHeaderHTML=function(){
  if(!HOME_VARIANT_2)return v024PrevDevelopmentHeaderHTML();
  return `<div class="resources-section-header development-section-header collapse-icon-row v2-section-header ${homeDevelopmentOpen?'expanded':'collapsed'}"><button class="home-section-tool v2-icon-control" id="bonusDevelopmentButton" aria-label="Bonus"><img src="${asset(V024.controls.bonus)}" alt="Bonus"></button><button class="home-section-art central-collapse-control v2-section-title-button" id="toggleDevelopmentSection" aria-expanded="${homeDevelopmentOpen}" aria-label="${homeDevelopmentOpen?'Collapse':'Expand'} Development"><img src="${asset(V024.title.development)}" alt="Development"></button><button class="home-section-tool v2-icon-control" id="developmentArchiveButton" aria-label="Archive"><img src="${asset(V024.controls.archive)}" alt="Archive"></button></div>`;
};
const v024PrevChallengeCardHTML=challengeCardHTML;
challengeCardHTML=function(){
  if(!HOME_VARIANT_2)return v024PrevChallengeCardHTML();
  const ch=dailyChallenge(),cs=challengeState(),locked=dailyChallengeLocked(),status=locked?'COMPLETE':cs.status;let action='';
  if(status==='AVAILABLE')action=`<button class="rpg-btn accent challenge-action variant-accept-challenge v2-accept" id="acceptChallenge"><img src="${asset(V024.development.accept)}" alt=""><span>ACCEPT CHALLENGE</span></button>`;
  else if(status==='ACTIVE')action=`<div class="challenge-actions"><button class="rpg-btn accent" id="completeChallenge">Complete</button><button class="text-btn danger" id="abandonChallenge">Abandon</button></div>`;
  else action=`<button class="rpg-btn" disabled>${status==='COMPLETE'?'Completed ✓':status}</button>`;
  return `<article class="development-card challenge-card"><div class="development-head challenge-head"><button class="development-icon-action v2-content-icon" id="challengeTrackerIcon" aria-label="Open Daily Challenge Tracker"><img src="${asset(V024.development.challenge)}" alt="Daily Challenge"></button><div><span>DAILY CHALLENGE</span><small>${esc(ch.category)} · ${status}</small></div></div><div class="challenge-content"><h3>${esc(ch.title)}</h3><p>${esc(ch.text)}</p>${ch.durationMin?`<small>Minimum duration: ${ch.durationMin} minutes · elapsed time verified, activity honor-based.</small>`:ch.verification==='steps'?'<small>Progress verified using the app’s tracked Steps value.</small>':'<small>Completion is honor-based.</small>'}<div class="v2-reward-preview"><span><img src="${asset(V024.rewards.xp)}" alt="XP reward"><b>+${ch.xp} XP</b></span><span><img src="${asset(V024.rewards.loot)}" alt="Loot box reward"><b>Minor Loot Box</b></span></div>${action}</div></article>`;
};
function v024ApplyDevelopment(){
  const frame=document.querySelector('.development-section-frame');if(!frame)return;
  const w=frame.querySelector('#dailyWordIcon img'),wi=frame.querySelector('#dailyWisdomIcon img'),ch=frame.querySelector('#challengeTrackerIcon img');
  if(w)w.src=asset(V024.development.word); if(wi)wi.src=asset(V024.development.wisdom); if(ch)ch.src=asset(V024.development.challenge);
}
function v024ApplyHome(){
  if(!HOME_VARIANT_2)return;
  view.classList.add('home-variant-2');view.classList.remove('home-all-variants');
  v024ApplyPlayer();v024ApplyWeather();v024ApplyToday();v024ApplyDevelopment();
  document.querySelectorAll('.resource-section-frame > .home-variant-plaque,.development-section-frame > .home-variant-plaque').forEach(x=>x.remove());
  document.querySelectorAll('.variant-title-art-hidden').forEach(x=>x.classList.remove('variant-title-art-hidden'));
}
const v024PrevRenderHome=renderHome;
renderHome=function(){v024PrevRenderHome();v024ApplyHome()};
if(page==='home')renderHome();
