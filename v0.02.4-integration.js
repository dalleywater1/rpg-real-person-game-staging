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
  /* Privacy (2026-09-25, Lyra §7): the Sex / Masturbation series counters and
     the SLP-HID phrase matches no longer live in `state` at all -- they are
     opaque, local-only progress in v0.02.49-sleep-hidden-progress.js. */
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
  /* Running V1 behaviour/records counters (RUN-V1-001..008 wiring,
     Vesper 2026-09-22) — same derive-fresh-on-save rule as the night
     counters above; see v023RebuildRunningV1Counters. */
  trn.runningStructuredTypesCompleted=Array.isArray(trn.runningStructuredTypesCompleted)?trn.runningStructuredTypesCompleted:[];
  trn.customRunCompletedEver=Boolean(trn.customRunCompletedEver);
  trn.runningScheduledRunCompletedEver=Boolean(trn.runningScheduledRunCompletedEver);
  trn.recordImprovedKeys=Array.isArray(trn.recordImprovedKeys)?trn.recordImprovedKeys:[];
  trn.runningWeeklyDistancePbAcrossWeeksEver=Boolean(trn.runningWeeklyDistancePbAcrossWeeksEver);
  trn.maxRunningRecordsImprovedBySingleRun=Number(trn.maxRunningRecordsImprovedBySingleRun||0);
  /* Gym & Strength V1 counters (GYM-V1 wiring, Vesper 2026-09-22) — see
     v023RebuildGymV1Counters. */
  trn.recordImprovedActivityTypes=Array.isArray(trn.recordImprovedActivityTypes)?trn.recordImprovedActivityTypes:[];
  trn.maxStrengthRecordsImprovedBySingleWorkout=Number(trn.maxStrengthRecordsImprovedBySingleWorkout||0);
  trn.gymUnplannedExtraSetEver=Boolean(trn.gymUnplannedExtraSetEver);
  trn.copiedSetsCompletedTotal=Number(trn.copiedSetsCompletedTotal||0);
  trn.workoutTemplateRepeatMax=Number(trn.workoutTemplateRepeatMax||0);
  trn.strengthFullBodyZoneSessionEver=Boolean(trn.strengthFullBodyZoneSessionEver);
  trn.strengthLegDayReturnStreak=Number(trn.strengthLegDayReturnStreak||0);
  trn.strengthRecordZones=Array.isArray(trn.strengthRecordZones)?trn.strengthRecordZones:[];
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
  state.version=VERSION;
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
  read(mods.equipment,'Equipment','character.equipment');/* Master Build Phase A (RPG-0093): gear reads through the per-stat gear cap floor(5+0.2xBase) (Assay §6.4); Base is only READ here, never written. */read(typeof economyGearFlatCapped==='function'?economyGearFlatCapped(key):state.equipment?.statModifiers,'Equipment','equipment.statModifiers');read(state.equipment?.modifiers,'Equipment','equipment.modifiers');
  read(mods.items,'Items','character.items','permanent');read(mods.permanent,'Permanent Bonus','character.permanent','permanent');read(state.items?.statModifiers,'Items','items.statModifiers','permanent');read(state.permanentBonuses,'Permanent Bonus','permanentBonuses','permanent');
  read(mods.skills,'Skills','character.skills');read(state.skills?.statModifiers,'Skills','skills.statModifiers');
  read(mods.potions,'Potions','character.potions');read(state.potions?.statModifiers,'Potions','potions.statModifiers');read(state.consumables?.statModifiers,'Potions','consumables.statModifiers');
  read(mods.buffs,'Buffs','character.buffs');read(state.buffs?.statModifiers,'Buffs','buffs.statModifiers');read(state.activeBuffs,'Buffs','activeBuffs');read(typeof economyBuffAmount==='function'?economyBuffAmount(key):0,'Buffs','economy.buffs');/* Phase A: timed elixir, max(minFlat, round(Base x pct/100)), one per stat */
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
  while(s.baseValue<300&&s.xp>=cost){s.xp-=cost;s.baseValue+=1;cost=statCost(s.baseValue);v023LogStatIncrease(key)}
  if(s.baseValue>=300){s.baseValue=300;s.xp=0}
  s.score=s.baseValue;v023EnsureStatMilestones();
};
/* STAT-* Purity (Vesper, 2026-09-22; Nox ruling same day): an append-only
   log of base-stat increase EVENTS is the only thing a "purity sequence"
   can be read from. Increments are buffered until the save() that ends
   the event and then flushed as one entry: {k,n} when every increment in
   the event hit the same stat, {x:true} when the event raised more than
   one Base Stat — an impure event breaks the sequence and its own
   increments count for nothing. Effective/equipment changes never call
   addStatXP, so they never participate. Capped at the last 2000 events;
   each stat's maximum streak is persisted in metaCounters.statPurityMax
   so a completed milestone is remembered after later resets. */
let v023StatIncreaseBuffer=[];
function v023LogStatIncrease(key){v023StatIncreaseBuffer.push(key)}
function v023FlushStatIncreases(){
  if(!v023StatIncreaseBuffer.length)return;
  const keys=new Set(v023StatIncreaseBuffer);
  state.statIncreaseLog=Array.isArray(state.statIncreaseLog)?state.statIncreaseLog:[];
  state.statIncreaseLog.push(keys.size===1?{k:v023StatIncreaseBuffer[0],n:v023StatIncreaseBuffer.length}:{x:true});
  if(state.statIncreaseLog.length>2000)state.statIncreaseLog=state.statIncreaseLog.slice(-2000);
  v023StatIncreaseBuffer=[];
}
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
  /* createdAt (RUN-V1-007 "Stick to the Plan", 2026-09-22): the only
     way to tell a run that was SCHEDULED for a later day from one logged
     on the day is when the record was created vs its date — nothing else
     on the activity carries that. Additive, defaulted here only, so
     already-saved activities simply lack it and never count as scheduled. */
  const activity=v023EnsureActivityIdentity({id:input.id||uid(),source:'Manual',completed:false,xpAwarded:false,startedAt:null,sportData:{},createdAt:v023Now(),...input});state.activities.push(activity);return {created:true,activity};
}
/* Carries a Workout Template's structured sportData/workoutTemplateId
   through this canonical-identity ingest path (Strength correction
   pass, 2026-09-17) -- readActivityEditor()'s plain form fields can't
   represent a real exercise plan, so scheduleWorkoutTemplateModal stages
   it on the module-level __activityPrefillExtra (set by activityModal,
   declared in app.js) instead. This is the LIVE bindAddActivity: it
   overwrites app.js's own copy, since this file loads after it. */
bindAddActivity=function(){modalRoot.querySelector('#saveActivity').onclick=()=>{const v=readActivityEditor();if(!v.name){toast('Give the activity a name.');return}const extra=__activityPrefillExtra||{};v023IngestActivity({...v,source:'Manual',sportData:extra.sportData||{},...(extra.workoutTemplateId?{workoutTemplateId:extra.workoutTemplateId}:{})});save();closeModal();toast('Activity added.');render()}};
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
/* Jay 2026-09-25: quests no longer populate the calendar. The Week/Month calendar shows Training activities, Personal
   Growth and Tasks only; Daily Quest, Main Quest and Quick Quest rows stay in the Today list and on Home, where they live. */
calendarEventsFor=function(date){
  const items=sharedScheduleItemsForDate(date);
  return {tasks:items.filter(i=>i.kind==='task'),activities:items.filter(i=>['activity','personalGrowth'].includes(i.kind)),quest:0};
};
scheduleItems=function(t=todayISO()){return sharedScheduleItemsForDate(t)};
function v023ActivityForProjection(eventId){const p=v023ScheduleProjections().find(x=>x.eventId===eventId);return p?state.activities.find(a=>a.id===p.legacyActivityId):null}
function v023AppendLinkedSchedule(){
  if(page!=='adventurers-log'||document.querySelector('.v023-linked-training'))return;const anchor=document.querySelector('.log-linked-anchor');if(!anchor)return;const projections=v023ScheduleProjections().sort((a,b)=>String(a.date+a.startTime).localeCompare(String(b.date+b.startTime)));
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
/* Quick Quests V1 (2026-09-20) — infrastructure only, same precedent as
   Main Quest above: the counter (state.quickQuests.stats.completedTotal,
   maintained at the completion point in v0.02.33-quick-quests.js), the
   'quickQuestCompletedTotal' trigger and the update hook below are wired;
   NO achievement content is defined here (Nox owns ids/names/rarity, e.g.
   the suggested 5/25/100 completions). Add definitions to this array with
   triggerType:'quickQuestCompletedTotal' and they work with no further
   wiring. */
const V023_QUICKQUEST_DEFINITIONS=[];

/* ---------- Generic Achievement engine + Hydration pilot ---------- */
const V023_ACHIEVEMENT_DEFINITIONS=[
  {achievementId:'hydration_first_sip',category:'hydration',type:'positive',rarity:'Common',name:'First Sip',description:'Hit your Water target for one day.',triggerType:'targetDaysTotal',triggerValue:1,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Common_First_Sip.webp`,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_well_watered',category:'hydration',type:'positive',rarity:'Uncommon',name:'Well Watered',description:'Hit your Water target for 3 consecutive days.',triggerType:'targetStreak',triggerValue:3,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Uncommon_Well_Watered.webp`,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_hydration_habit',category:'hydration',type:'positive',rarity:'Rare',name:'Hydration Habit',description:'Hit your Water target for 7 consecutive days.',triggerType:'targetStreak',triggerValue:7,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Rare_Hydration_Habit.webp`,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_river_runner',category:'hydration',type:'positive',rarity:'Epic',name:'River Runner',description:'Hit your Water target on 30 total days.',triggerType:'targetDaysTotal',triggerValue:30,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Epic_River_Runner.webp`,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_the_human_reservoir',category:'hydration',type:'positive',rarity:'Legendary',name:'The Human Reservoir',description:'Hit your Water target on 100 total days.',triggerType:'targetDaysTotal',triggerValue:100,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Legendary_The_Human_Reservoir.webp`,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_ocean_in_mortal_form',category:'hydration',type:'positive',rarity:'Mythic',name:'Ocean in Mortal Form',description:'Hit your Water target on 365 total days.',triggerType:'targetDaysTotal',triggerValue:365,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Mythic_Ocean_in_Mortal_Form.webp`,xpReward:null,lootReward:null,isSecret:false,revealAnimation:null},
  {achievementId:'hydration_is_this_mostly_water_now',category:'hydration',type:'positive',rarity:'Secret',name:'Is This Mostly Water Now?',description:'Reach the configured over-target threshold for the configured consecutive-day requirement.',triggerType:'overTargetStreak',triggerValue:3,iconAsset:`${V023_HYDRATION_ICON_ROOT}Hydration_Achievement_Secret_Is_This_Mostly_Water_Now.webp`,xpReward:null,lootReward:null,isSecret:true,revealAnimation:null}
];
/* RETIRED 2026-09-25 (Jay: an achievement "keeps popping up with outdated art").
   These seven first-generation Hydration achievements (the original engine pilot,
   cartoon-medallion art) were superseded by the approved HYD-POS / HYD-HID set
   (embroidered-patch art) that fires on the same milestones, so two popups -- one
   old, one new -- appeared for the same water day, and some names collide ("Hydration
   Habit", "Well Watered"). Retired = no NEW unlocks, no popups (including any already
   queued), and hidden from the catalogue unless the player already earned it (earned
   records are never touched or removed). */
const V023_RETIRED_ACHIEVEMENT_IDS=['JOURNEY-LOCAL-TEST-TRAIL-001'/* the Local Test Trail was removed (RPG-0089); it can never be completed (RPG-0056) */,'hydration_first_sip','hydration_well_watered','hydration_hydration_habit','hydration_river_runner','hydration_the_human_reservoir','hydration_ocean_in_mortal_form','hydration_is_this_mostly_water_now'];
V023_ACHIEVEMENT_DEFINITIONS.forEach(d=>{if(V023_RETIRED_ACHIEVEMENT_IDS.includes(d.achievementId))d.retired=true});
/* Hydration Achievement Live Test Batch (2026-09-05) — the exact 8
   permanent IDs from ACHIEVEMENT_TEST_BATCH.json, appended (not
   inlined above) so the original 7-entry literal stays byte-for-byte
   untouched. Placeholder badge for all 8 per the batch's asset
   manifest — no final art exists for these yet, none should be
   generated in this pass. Hidden ones reuse the existing Secret frame
   asset (same visual treatment as hydration_is_this_mostly_water_now),
   consistent with the pre-existing convention rather than a new one. */
const V023_ACHIEVEMENT_PLACEHOLDER_ICON='Achievements/achievement_placeholder_not_ready_yet.webp';
const V023_HYDRATION_TEST_BATCH_DEFINITIONS=[
  {achievementId:'HYD-HID-001',category:'hydration',type:'positive',rarity:'Uncommon',name:'Bonus Moisture',description:'Exceed the daily hydration target once.',systemMessage:'You have exceeded the recommended amount. Efficient.',series:'Over-Hydration',triggerType:'over100Total',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-HID-001-bonus-moisture.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-HID-002',category:'hydration',type:'positive',rarity:'Rare',name:'Well Watered',description:'Exceed the hydration target three completed days in a row.',systemMessage:'Hydration reserves are now suspiciously healthy.',series:'Over-Hydration',triggerType:'over100Streak',triggerValue:3,iconAsset:'Achievements/Hydration/Positive/HYD-HID-002-well-watered.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-HID-005',category:'hydration',type:'positive',rarity:'Celestial',name:'Are You Sure You’re Not Drowning?!?',description:'Reach 200% of the daily hydration target in one completed day.',systemMessage:'Two hundred percent. Are you sure you’re not drowning?!?',series:'Over-Hydration',triggerType:'over200Total',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-HID-005-are-you-sure-you-re-not-drowning.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-COM-001',category:'hydration',type:'positive',rarity:'Legendary',name:'Hydration Whiplash',description:'Go from no hydration logged to double the hydration target on consecutive completed days.',systemMessage:'Yesterday: desert. Today: flood. Pick a biome.',series:'Hydration Reversal',triggerType:'crossDayZeroToDouble',triggerValue:1,iconAsset:'Achievements/Hydration/Combination/HYD-COM-001-hydration-whiplash.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RES-001',category:'hydration',type:'positive',rarity:'Common',name:'Oh, So NOW You Remember Water',description:'Recover immediately after missing the hydration target for one completed day.',systemMessage:'Congratulations. The basic survival mechanic has been rediscovered.',series:'Hydration Recovery',triggerType:'recoveryMissedStreak',triggerValue:1,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-001-oh-so-now-you-remember-water.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-RES-002',category:'hydration',type:'positive',rarity:'Uncommon',name:'Emergency Moisture Deployment',description:'Restore the hydration target after at least two consecutive missed completed days.',systemMessage:'Critical systems restored. Mammal status temporarily retained.',series:'Hydration Recovery',triggerType:'recoveryMissedStreak',triggerValue:2,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-002-emergency-moisture-deployment.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-RES-003',category:'hydration',type:'positive',rarity:'Rare',name:'The Drought Has Been Cancelled',description:'End a hydration drought of at least three consecutive completed days.',systemMessage:'Local authorities report the return of fluids.',series:'Hydration Recovery',triggerType:'recoveryMissedStreak',triggerValue:3,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-003-the-drought-has-been-cancelled.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-RES-004',category:'hydration',type:'positive',rarity:'Epic',name:'Revenge of the Moist',description:'Return to full hydration after a missed-target streak of at least seven completed days.',systemMessage:'You were dry. You were crusty. You have chosen vengeance.',series:'Hydration Recovery',triggerType:'recoveryMissedStreak',triggerValue:7,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-004-revenge-of-the-moist.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
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
  {achievementId:'HYD-NEG-001',category:'hydration',type:'negative',rarity:'Uncommon',name:'It’s Thick… Like Syrup',description:'Finish a completed day with no water logged.',systemMessage:'You logged no water today. Certain fluids are beginning to concern us.',series:'Zero-Water Streak',triggerType:'zeroStreak',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-001-it-s-thick-like-syrup.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-002',category:'hydration',type:'negative',rarity:'Rare',name:'Human Jerky',description:'Complete three consecutive days with no water logged.',systemMessage:'Moisture content has dropped below recommended mammal levels.',series:'Zero-Water Streak',triggerType:'zeroStreak',triggerValue:3,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-002-human-jerky.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-003',category:'hydration',type:'negative',rarity:'Epic',name:'Are You Just Pissing Sand?!',description:'Complete five consecutive days with no water logged.',systemMessage:'Five days. No water. Are you just pissing sand?!',series:'Zero-Water Streak',triggerType:'zeroStreak',triggerValue:5,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-003-are-you-just-pissing-sand.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-004',category:'hydration',type:'negative',rarity:'Legendary',name:'Mummification Is Setting In',description:'Complete ten consecutive days with no water logged.',systemMessage:'Ten days. The preservation process appears to have begun.',series:'Zero-Water Streak',triggerType:'zeroStreak',triggerValue:10,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-004-mummification-is-setting-in.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-005',category:'hydration',type:'negative',rarity:'Legendary',name:'Dust in the Wind',description:'Complete thirty consecutive days with no water logged.',systemMessage:'All we are is dust in the wind. You appear to be proving the point.',series:'Zero-Water Streak',triggerType:'zeroStreak',triggerValue:30,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-005-dust-in-the-wind.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-HID-003',category:'hydration',type:'positive',rarity:'Epic',name:'Aquatic Tendencies',description:'Exceed the hydration target seven completed days in a row.',systemMessage:'The distinction between mammal and amphibian is narrowing.',series:'Over-Hydration',triggerType:'over100Streak',triggerValue:7,iconAsset:'Achievements/Hydration/Positive/HYD-HID-003-aquatic-tendencies.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-HID-004',category:'hydration',type:'positive',rarity:'Legendary',name:'Internal Reservoir',description:'Exceed the hydration target fourteen completed days in a row.',systemMessage:'At this point you may contain your own watershed.',series:'Over-Hydration',triggerType:'over100Streak',triggerValue:14,iconAsset:'Achievements/Hydration/Positive/HYD-HID-004-internal-reservoir.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RES-005',category:'hydration',type:'positive',rarity:'Legendary',name:'Somehow, Still a Mammal',description:'Recover from a major hydration slump and sustain the comeback for three completed days.',systemMessage:'Against medical, biological, and administrative expectations, hydration has resumed.',series:'Hydration Recovery',triggerType:'recoverySustained',missedThreshold:10,triggerValue:3,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-005-somehow-still-a-mammal.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-RES-006',category:'hydration',type:'positive',rarity:'Celestial',name:'Unwrap Me, I’m Moist',description:'Return from an extreme hydration slump and sustain full hydration for seven completed days.',systemMessage:'Preservation status revoked. Please stop dripping on the sarcophagus.',series:'Hydration Recovery',triggerType:'recoverySustained',missedThreshold:30,triggerValue:7,iconAsset:'Achievements/Hydration/Restarting/HYD-RES-006-unwrap-me-i-m-moist.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-COM-002',category:'hydration',type:'positive',rarity:'Epic',name:'Human Cactus',description:'Alternate between no hydration logged and hitting the hydration target across four completed days.',systemMessage:'Water storage appears intermittent. Photosynthesis remains unconfirmed.',series:'Hydration Oscillation',triggerType:'hydrationOscillation4',triggerValue:1,iconAsset:'Achievements/Hydration/Combination/HYD-COM-002-human-cactus.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-001',category:'hydration',type:'positive',rarity:'Rare',name:'Sure You Did',description:'Log a suspiciously high hydration total in a single completed day.',systemMessage:'Absolutely. Completely believable. The System has no further questions.',series:'Suspicious Logging',triggerType:'maxDailyPercentEver',triggerValue:250,iconAsset:'Achievements/Hydration/Random/HYD-RND-001-sure-you-did.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-002',category:'hydration',type:'positive',rarity:'Epic',name:'Waterboarded by Statistics',description:'Log an absurdly high hydration total in a single completed day.',systemMessage:'Either you are cheating or we need to notify the coast guard.',series:'Suspicious Logging',triggerType:'maxDailyPercentEver',triggerValue:400,iconAsset:'Achievements/Hydration/Random/HYD-RND-002-waterboarded-by-statistics.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-003',category:'hydration',type:'positive',rarity:'Legendary',name:'Ocean in a Bottle',description:'Log a hydration amount that has stopped pretending to be plausible.',systemMessage:'You did not drink this. You imported a small inland sea.',series:'Suspicious Logging',triggerType:'maxDailyPercentEver',triggerValue:600,iconAsset:'Achievements/Hydration/Random/HYD-RND-003-ocean-in-a-bottle.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-004',category:'hydration',type:'positive',rarity:'Celestial',name:'Nice Try, Aquaman',description:'Enter a hydration total so extreme that the System openly questions the data.',systemMessage:'Achievement denied by biology. Comedy achievement granted instead.',series:'Suspicious Logging',triggerType:'maxDailyPercentEver',triggerValue:1000,iconAsset:'Achievements/Hydration/Random/HYD-RND-004.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-005',category:'hydration',type:'positive',rarity:'Rare',name:'Hydration of the Beast',description:'Finish a day on the most ominous possible hydration number.',systemMessage:'The number is concerning. The amount of water is less so.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:666,iconAsset:'Achievements/Hydration/Random/HYD-RND-005-hydration-of-the-beast.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-006',category:'hydration',type:'positive',rarity:'Common',name:'One Litre Later',description:'Finish a completed day on a perfectly round one-litre total.',systemMessage:'A suspiciously round number. The System approves.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:1000,iconAsset:'Achievements/Hydration/Random/HYD-RND-006-one-litre-later.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-007',category:'hydration',type:'positive',rarity:'Rare',name:'L33T Hydration',description:'Finish the day on a classic internet-number hydration total.',systemMessage:'Ancient internet magic has entered the bloodstream.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:1337,iconAsset:'Achievements/Hydration/Random/HYD-RND-007-l33t-hydration.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-008',category:'hydration',type:'positive',rarity:'Uncommon',name:'Perfectly Balanced',description:'Finish the day on an exact two-litre hydration total.',systemMessage:'Two litres. Clean. Predictable. Disturbingly responsible.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:2000,iconAsset:'Achievements/Hydration/Random/HYD-RND-008-perfectly-balanced.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-009',category:'hydration',type:'positive',rarity:'Rare',name:'Water Not Found',description:'Finish the day on a hydration total that looks like an error code.',systemMessage:'Hydration request returned an error.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:404,iconAsset:'Achievements/Hydration/Random/HYD-RND-009-water-not-found.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-010',category:'hydration',type:'positive',rarity:'Rare',name:'Highly Hydrated',description:'Finish the day on exactly 420 ml.',systemMessage:'The System refuses to elaborate.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:420,iconAsset:'Achievements/Hydration/Random/HYD-RND-010-highly-hydrated.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-011',category:'hydration',type:'positive',rarity:'Epic',name:'Nice.',description:'Finish the day on exactly 69 ml for reasons the System will not dignify.',systemMessage:'Nice.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:69,iconAsset:'Achievements/Hydration/Random/HYD-RND-011-nice.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-012',category:'hydration',type:'positive',rarity:'Uncommon',name:'So Close',description:'Finish the day exactly one millilitre short of a litre.',systemMessage:'One millilitre away. This was a choice.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:999,iconAsset:'Achievements/Hydration/Random/HYD-RND-012-so-close.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-013',category:'hydration',type:'positive',rarity:'Rare',name:'Hydration Sequence',description:'Finish a completed day on the sequential total 1234 ml.',systemMessage:'Order has been imposed upon the fluids.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:1234,iconAsset:'Achievements/Hydration/Random/HYD-RND-013-hydration-sequence.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-014',category:'hydration',type:'positive',rarity:'Epic',name:'I Love You 3000',description:'Finish the day on exactly three litres.',systemMessage:'Three thousand millilitres. The System loves you 3000. Please do not make this emotional.',series:'Exact Number',triggerType:'exactAmountEver',triggerValue:3000,iconAsset:'Achievements/Hydration/Random/HYD-RND-014-i-love-you-3000.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-RND-015',category:'hydration',type:'positive',rarity:'Uncommon',name:'Ctrl+Alt+Dehydrate',description:'Manually reset the Hydration resource tracker.',systemMessage:'Hydration process terminated. Please restart the mammal.',series:'Resource Reset',triggerType:'manualResetCount',triggerValue:1,iconAsset:'Achievements/Hydration/Random/HYD-RND-015-ctrl-alt-dehydrate.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
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
  {achievementId:'HYD-POS-001',category:'hydration',type:'positive',rarity:'Common',name:'A Sip Counts',description:'Meet the hydration target for the first time.',systemMessage:'The organism has discovered water.',series:'Consistency',triggerType:'targetDaysTotal',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-002',category:'hydration',type:'positive',rarity:'Common',name:'Still Moist',description:'Maintain the hydration target for three days.',systemMessage:'Unexpectedly, you remain moist.',series:'Consistency',triggerType:'targetStreak',triggerValue:3,iconAsset:'Achievements/Hydration/Positive/HYD-POS-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-003',category:'hydration',type:'positive',rarity:'Uncommon',name:'Basic Irrigation',description:'Maintain the hydration target for seven days.',systemMessage:'Basic irrigation procedures successful.',series:'Consistency',triggerType:'targetStreak',triggerValue:7,iconAsset:'Achievements/Hydration/Positive/HYD-POS-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-004',category:'hydration',type:'positive',rarity:'Uncommon',name:'Watered Regularly',description:'Maintain the hydration target for fourteen days.',systemMessage:'Routine watering appears effective.',series:'Consistency',triggerType:'targetStreak',triggerValue:14,iconAsset:'Achievements/Hydration/Positive/HYD-POS-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-005',category:'hydration',type:'positive',rarity:'Rare',name:'Thriving, Disturbingly',description:'Maintain the hydration target for thirty days.',systemMessage:'This is becoming suspiciously competent.',series:'Consistency',triggerType:'targetStreak',triggerValue:30,iconAsset:'Achievements/Hydration/Positive/HYD-POS-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-006',category:'hydration',type:'positive',rarity:'Rare',name:'Hydration Habit',description:'Maintain the hydration target for sixty days.',systemMessage:'The water thing may actually have stuck.',series:'Consistency',triggerType:'targetStreak',triggerValue:60,iconAsset:'Achievements/Hydration/Positive/HYD-POS-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-007',category:'hydration',type:'positive',rarity:'Epic',name:'Self-Watering Mammal',description:'Maintain the hydration target for one hundred days.',systemMessage:'Autonomous hydration system online.',series:'Consistency',triggerType:'targetStreak',triggerValue:100,iconAsset:'Achievements/Hydration/Positive/HYD-POS-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-008',category:'hydration',type:'positive',rarity:'Legendary',name:'Industrial Irrigation',description:'Maintain the hydration target for one hundred eighty days.',systemMessage:'Domestic hydration has entered industrial scale.',series:'Consistency',triggerType:'targetStreak',triggerValue:180,iconAsset:'Achievements/Hydration/Positive/HYD-POS-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-009',category:'hydration',type:'positive',rarity:'Legendary',name:'Aquatic Discipline',description:'Maintain the hydration target for two hundred seventy days.',systemMessage:'At this point, dehydration would require planning.',series:'Consistency',triggerType:'targetStreak',triggerValue:270,iconAsset:'Achievements/Hydration/Positive/HYD-POS-009.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-POS-010',category:'hydration',type:'positive',rarity:'Celestial',name:'Human Houseplant',description:'Maintain the hydration target for a full year.',systemMessage:'One year of successful mammalian irrigation.',series:'Consistency',triggerType:'targetStreak',triggerValue:365,iconAsset:'Achievements/Hydration/Positive/HYD-POS-010.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-006',category:'hydration',type:'negative',rarity:'Common',name:'Dry Spell',description:'Miss the hydration target for a completed day.',systemMessage:'Water remains technically available.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-006-dry-spell.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-007',category:'hydration',type:'negative',rarity:'Common',name:'Thirst Trap',description:'Miss the hydration target for two consecutive completed days.',systemMessage:'This is not what that phrase means.',series:'Hydration Neglect',triggerType:'missedStreak',triggerValue:2,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-007-thirst-trap.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-008',category:'hydration',type:'negative',rarity:'Common',name:'Human Raisin',description:'Miss the hydration target for three consecutive completed days.',systemMessage:'Moisture levels are becoming theoretical.',series:'Hydration Neglect',triggerType:'missedStreak',triggerValue:3,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-008-human-raisin.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-009',category:'hydration',type:'negative',rarity:'Uncommon',name:'The Sahara Calls',description:'Miss the hydration target on five completed days within a seven-day window.',systemMessage:'It would like its climate back.',series:'Hydration Neglect',triggerType:'missedFiveInSevenEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-009-the-sahara-calls.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-010',category:'hydration',type:'negative',rarity:'Uncommon',name:'Water Is Apparently Optional',description:'Finish a completed day below 50% of the hydration target.',systemMessage:'Bold biological strategy.',series:'Hydration Neglect',triggerType:'under50PercentEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-010-water-is-apparently-optional.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-011',category:'hydration',type:'negative',rarity:'Rare',name:'Dehydration Enthusiast',description:'Miss the hydration target on ten completed days in total.',systemMessage:'Consistency has been achieved. Unfortunately.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:10,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-011-dehydration-enthusiast.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-012',category:'hydration',type:'negative',rarity:'Rare',name:'Moisture Resistant',description:'Miss the hydration target on twenty-five completed days in total.',systemMessage:'Your commitment to dryness is impressive.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:25,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-012-moisture-resistant.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-013',category:'hydration',type:'negative',rarity:'Epic',name:'Certified Dust Person',description:'Miss the hydration target on fifty completed days in total.',systemMessage:'Please stop shedding sand indoors.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:50,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-013-certified-dust-person.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-014',category:'hydration',type:'negative',rarity:'Epic',name:'Hydrophobic Mammal',description:'Miss the hydration target on one hundred completed days in total.',systemMessage:'Evolution is reviewing your paperwork.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:100,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-014-hydrophobic-mammal.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'HYD-NEG-015',category:'hydration',type:'negative',rarity:'Legendary',name:'Enemy of Water',description:'Miss the hydration target on two hundred fifty completed days in total.',systemMessage:'The oceans have been informed.',series:'Hydration Neglect',triggerType:'missedTotal',triggerValue:250,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-015-enemy-of-water.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
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
  {achievementId:'HYD-POS-011',category:'hydration',type:'positive',rarity:'Common',name:'Coffee Is Mostly Water',description:'Reach the hydration target on a day that includes coffee as part of valid fluid intake.',systemMessage:'Technically, coffee contains water. The System hates that you are correct.',series:'Technical Hydration',triggerType:'coffeeTargetMetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-011-coffee-is-mostly-water.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-POS-012',category:'hydration',type:'positive',rarity:'Uncommon',name:'Hydration With Benefits',description:'Meet the daily hydration target while at least a quarter comes from valid alternative fluids.',systemMessage:'Water acquired. Other beverages were smuggled in alongside it.',series:'Technical Hydration',triggerType:'nonWater25PlusTargetMetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-012-hydration-with-benefits.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-POS-013',category:'hydration',type:'positive',rarity:'Rare',name:'Technically Hydrated',description:'Reach the daily target with the majority supplied by other valid fluids.',systemMessage:'The hydration requirement has been met through technical compliance. Annoyingly, this is valid.',series:'Technical Hydration',triggerType:'plainWaterUnder50TargetMetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-013-technically-hydrated.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-POS-014',category:'hydration',type:'positive',rarity:'Epic',name:'Suspiciously Legal Hydration',description:'Meet the hydration target while plain water contributes no more than one quarter.',systemMessage:'The hydration requirement has been met through an alarming amount of technicality.',series:'Technical Hydration',triggerType:'plainWaterUnder25TargetMetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-014-suspiciously-legal-hydration.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-POS-015',category:'hydration',type:'positive',rarity:'Legendary',name:'Water Is a Technicality',description:'Meet the full daily hydration target entirely through other valid fluids.',systemMessage:'No plain water. Full hydration. The System reviewed the rules and is deeply annoyed.',series:'Technical Hydration',triggerType:'zeroPlainWaterTargetMetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Positive/HYD-POS-015-water-is-a-technicality.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-016',category:'hydration',type:'negative',rarity:'Common',name:'Beverage Evidence',description:'Present alternative beverages as evidence while still missing the hydration target.',systemMessage:'A beverage was present. Hydration was not.',series:'Technical Hydration',triggerType:'nonWaterBelowTargetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-016-beverage-evidence.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-017',category:'hydration',type:'negative',rarity:'Uncommon',name:'You Had Drinks',description:'Consume a respectable amount of alternative fluids and still fail to finish the hydration objective.',systemMessage:'You consumed several liquids. None appear to have completed the assignment.',series:'Technical Hydration',triggerType:'midRangeMajorityNonWaterEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-017-you-had-drinks.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-018',category:'hydration',type:'negative',rarity:'Rare',name:'Technically… No',description:'Rely overwhelmingly on alternative fluids and still fail the daily hydration target.',systemMessage:'You have presented several beverages as evidence. The System remains unconvinced.',series:'Technical Hydration',triggerType:'nonWater75PlusBelowTargetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-018-technically-no.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-019',category:'hydration',type:'negative',rarity:'Epic',name:'Liquid Adjacent',description:'Come painfully close to the hydration target using mostly alternative fluids, then stop.',systemMessage:'An impressive collection of beverages, and somehow still not enough. Remarkable.',series:'Technical Hydration',triggerType:'nearTargetMajorityNonWaterEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-019-liquid-adjacent.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'HYD-NEG-020',category:'hydration',type:'negative',rarity:'Legendary',name:'Hydration by Legal Argument',description:'Attempt to satisfy hydration entirely through a committee of alternative beverages and still fail.',systemMessage:'The defense has presented coffee, tea, milk, and vibes. The hydration target remains unmet.',series:'Technical Hydration',triggerType:'zeroPlainWaterThreeTypesBelowTargetEver',triggerValue:1,iconAsset:'Achievements/Hydration/Negative/HYD-NEG-020-hydration-by-legal-argument.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
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
  {achievementId:'RUN-HID-001',category:'running',type:'positive',rarity:'Common',name:'Night Runner',description:'Complete a training run late at night.',systemMessage:'The sun went home. Apparently you did not.',series:'Night Running',triggerType:'lateNightRunTotal',triggerValue:1,iconAsset:'Achievements/Running/RUN-HID-001-night-runner.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'RUN-HID-002',category:'running',type:'positive',rarity:'Uncommon',name:'Things That Go Jog in the Night',description:'Complete a run after midnight.',systemMessage:'Something is moving in the darkness. Unfortunately, it’s cardio.',series:'Night Running',triggerType:'midnightRunTotal',triggerValue:1,iconAsset:'Achievements/Running/RUN-HID-002-things-that-go-jog-in-the-night.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'RUN-HID-003',category:'running',type:'positive',rarity:'Rare',name:'Running From Your Problems',description:'Complete at least 5 km after midnight.',systemMessage:'Your problems remain. They are, however, several kilometres behind you.',series:'Night Running',triggerType:'midnight5kEver',triggerValue:1,iconAsset:'Achievements/Running/RUN-HID-003-running-from-your-problems.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'RUN-HID-004',category:'running',type:'positive',rarity:'Epic',name:'Local Cryptid',description:'Become a recurring late-night running sighting.',systemMessage:'Multiple sightings reported. Reflective clothing. Heavy breathing. Surprisingly fast.',series:'Night Running',triggerType:'lateNightRunTotal',triggerValue:5,iconAsset:'Achievements/Running/RUN-HID-004-local-cryptid.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'RUN-HID-005',category:'running',type:'positive',rarity:'Legendary',name:'The Night Is Dark and Full of Cardio',description:'Complete a major endurance run in the middle of the night.',systemMessage:'Everyone else chose sleep. You chose violence against your knees.',series:'Night Running',triggerType:'midnight10kBetween0And4Ever',triggerValue:1,iconAsset:'Achievements/Running/RUN-HID-005-the-night-is-dark-and-full-of-cardio.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_RUNNING_NIGHT_DEFINITIONS);
/* Night Training (Gym & Strength) — qualifying activity = type exactly
   'Gym / Strength', complete===true, parsed #actTime hour. Same
   blank-time-never-qualifies rule as Night Running. */
const V023_GYM_NIGHT_DEFINITIONS=[
  {achievementId:'GYM-HID-001',category:'gym',type:'positive',rarity:'Common',name:'After Hours',description:'Complete a strength session late at night.',systemMessage:'Gym closed emotionally several hours ago.',series:'Night Training',triggerType:'gymAfterHoursTotal',triggerValue:1,iconAsset:'Achievements/Gym & Strength/GYM-HID-001-after-hours.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-HID-002',category:'gym',type:'positive',rarity:'Uncommon',name:'Midnight Reps',description:'Complete a strength session after midnight.',systemMessage:'Nothing good begins with ‘one more set’ at this hour.',series:'Night Training',triggerType:'gymMidnightTotal',triggerValue:1,iconAsset:'Achievements/Gym & Strength/GYM-HID-002-midnight-reps.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-HID-003',category:'gym',type:'positive',rarity:'Rare',name:'Sleep Is for Rest Days',description:'Accumulate three midnight strength sessions.',systemMessage:'Recovery has submitted a formal complaint.',series:'Night Training',triggerType:'gymMidnightTotal',triggerValue:3,iconAsset:'Achievements/Gym & Strength/GYM-HID-003-sleep-is-for-rest-days.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-HID-004',category:'gym',type:'positive',rarity:'Epic',name:'No Witnesses',description:'Accumulate seven midnight strength sessions.',systemMessage:'Nobody saw the lift. The System did.',series:'Night Training',triggerType:'gymMidnightTotal',triggerValue:7,iconAsset:'Achievements/Gym & Strength/GYM-HID-004-no-witnesses.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-HID-005',category:'gym',type:'positive',rarity:'Legendary',name:'What the Fuck Are You Training For?',description:'Accumulate fifteen midnight strength sessions.',systemMessage:'Seriously. Is there an invasion scheduled?',series:'Night Training',triggerType:'gymMidnightTotal',triggerValue:15,iconAsset:'Achievements/Gym & Strength/GYM-HID-005-what-the-fuck-are-you-training-for.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_GYM_NIGHT_DEFINITIONS);
/* Running Distance Milestones (RUN-POS-001..007, Achievement Design
   Register, approved 2026-09-08). name/rarity/systemMessage were
   literally "TBD" in the register itself for every row in this
   series — per explicit instruction, an approved-with-unfinished-
   fields achievement was implemented with real trigger logic first,
   not held back, and not given an invented name/rarity Nox hadn't
   written yet.
   RPG-0006 (2026-09-22 audit item), partial fix: RUN-POS-006/007's
   `name` is now filled in — not invented, promoted verbatim from this
   same object's own already-approved `description` field ("Half
   Marathon milestone."/"Full Marathon milestone." already named the
   real distance; only the `name` field itself was left blank).
   RUN-POS-001..005 (1/3/5/10/15 km) have NO such existing precedent
   anywhere in this file or its docs for a real name, and `rarity` has
   none for any of the 7 — left as `'TBD'`, still intentional, not
   guessed at. RUN-POS-008 ("Ironman-distance triathlon") is excluded —
   no triathlon/combined-discipline-event concept exists anywhere in
   this app to detect it from; flagged in the return report rather than
   guessed at. */
const V023_RUNNING_DISTANCE_MILESTONE_DEFINITIONS=[
  /* RUN-POS-001..005 names/rarities: Nox sign-off 2026-09-22 (wording may
     be revisited later; 006/007 rarities still TBD from the register). */
  {achievementId:'RUN-POS-001',category:'running',type:'positive',rarity:'Common',name:'Off the Couch',description:'First distance milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-002',category:'running',type:'positive',rarity:'Common',name:'Getting Somewhere',description:'Three kilometre milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:3,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-003',category:'running',type:'positive',rarity:'Uncommon',name:'Five Alive',description:'Five kilometre milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-004',category:'running',type:'positive',rarity:'Rare',name:'Double Digits',description:'Ten kilometre milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:10,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-005',category:'running',type:'positive',rarity:'Rare',name:'This Was Supposed to Be a Short Run',description:'Fifteen kilometre milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:15,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-006',category:'running',type:'positive',rarity:'TBD',name:'Half Marathon',description:'Half Marathon milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:21.1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-POS-007',category:'running',type:'positive',rarity:'TBD',name:'Marathon',description:'Full Marathon milestone.',systemMessage:null,series:'Distance Milestones',triggerType:'longestRunDistanceEver',triggerValue:42.2,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_RUNNING_DISTANCE_MILESTONE_DEFINITIONS);
/* Training Sport session-count milestones (Achievement Design Register
   TRN-* rows, 8 of the 10 registered families — see the comment above
   v023RebuildTrainingSessionMilestoneCounters for why TRN-TMS/TRN-DAN
   are excluded). Names/descriptions/system messages/rarities copied
   verbatim from the register; none of it invented here. */
const V023_TRAINING_SESSION_DEFINITIONS=[
  {achievementId:'TRN-RUN-001',category:'training',type:'positive',rarity:'Common',name:'First Steps',description:'Complete your first Running session.',systemMessage:'The first step has been taken.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:1,iconAsset:'Achievements/TrainingSports/TRN-RUN-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-002',category:'training',type:'positive',rarity:'Common',name:'Finding Your Feet',description:'Complete five Running sessions.',systemMessage:'Apparently this is becoming a thing.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:5,iconAsset:'Achievements/TrainingSports/TRN-RUN-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-003',category:'training',type:'positive',rarity:'Uncommon',name:'Double Digits',description:'Complete ten Running sessions.',systemMessage:'Ten runs. The road is beginning to recognise you.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:10,iconAsset:'Achievements/TrainingSports/TRN-RUN-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-004',category:'training',type:'positive',rarity:'Rare',name:'Road Regular',description:'Complete twenty-five Running sessions.',systemMessage:'You are now a recurring road event.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:25,iconAsset:'Achievements/TrainingSports/TRN-RUN-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty on Foot',description:'Complete fifty Running sessions.',systemMessage:'Fifty runs completed. Knees remain under observation.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:50,iconAsset:'Achievements/TrainingSports/TRN-RUN-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Runner',description:'Complete one hundred Running sessions.',systemMessage:'One hundred runs. This is no longer accidental.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:100,iconAsset:'Achievements/TrainingSports/TRN-RUN-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-007',category:'training',type:'positive',rarity:'Legendary',name:'Road Veteran',description:'Complete two hundred fifty Running sessions.',systemMessage:'The road has filed you under permanent fixtures.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:250,iconAsset:'Achievements/TrainingSports/TRN-RUN-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-RUN-008',category:'training',type:'positive',rarity:'Celestial',name:'Born to Run',description:'Complete five hundred Running sessions.',systemMessage:'Five hundred runs. Walking now appears to be a temporary state.',series:'Running — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:500,iconAsset:'Achievements/TrainingSports/TRN-RUN-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-001',category:'training',type:'positive',rarity:'Common',name:'On Your Bike',description:'Complete your first Cycling session.',systemMessage:'Two wheels. Forward motion. Acceptable.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:1,iconAsset:'Achievements/TrainingSports/TRN-CYC-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-002',category:'training',type:'positive',rarity:'Common',name:'Finding Your Gears',description:'Complete five Cycling sessions.',systemMessage:'The gears have stopped being decorative.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:5,iconAsset:'Achievements/TrainingSports/TRN-CYC-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten in the Saddle',description:'Complete ten Cycling sessions.',systemMessage:'Ten rides completed. Saddle diplomacy continues.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:10,iconAsset:'Achievements/TrainingSports/TRN-CYC-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-004',category:'training',type:'positive',rarity:'Rare',name:'Chain Reaction',description:'Complete twenty-five Cycling sessions.',systemMessage:'Repeated pedalling has produced consequences.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:25,iconAsset:'Achievements/TrainingSports/TRN-CYC-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Rides Later',description:'Complete fifty Cycling sessions.',systemMessage:'Fifty rides. The bicycle is now a colleague.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:50,iconAsset:'Achievements/TrainingSports/TRN-CYC-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Cyclist',description:'Complete one hundred Cycling sessions.',systemMessage:'One hundred rides. Chain maintenance is now a lifestyle.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:100,iconAsset:'Achievements/TrainingSports/TRN-CYC-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-007',category:'training',type:'positive',rarity:'Legendary',name:'Road-Worn',description:'Complete two hundred fifty Cycling sessions.',systemMessage:'The road and your backside have both kept records.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:250,iconAsset:'Achievements/TrainingSports/TRN-CYC-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CYC-008',category:'training',type:'positive',rarity:'Celestial',name:'Pedal Forever',description:'Complete five hundred Cycling sessions.',systemMessage:'Five hundred rides. The System suspects you may generate electricity.',series:'Cycling — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Cycling',triggerValue:500,iconAsset:'Achievements/TrainingSports/TRN-CYC-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-001',category:'training',type:'positive',rarity:'Common',name:'Making a Splash',description:'Complete your first Swimming session.',systemMessage:'Aquatic locomotion confirmed.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:1,iconAsset:'Achievements/TrainingSports/TRN-SWM-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-002',category:'training',type:'positive',rarity:'Common',name:'Finding Your Stroke',description:'Complete five Swimming sessions.',systemMessage:'Drowning has been successfully reclassified as swimming.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:5,iconAsset:'Achievements/TrainingSports/TRN-SWM-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Laps Later',description:'Complete ten Swimming sessions.',systemMessage:'Water resistance remains stubbornly present.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:10,iconAsset:'Achievements/TrainingSports/TRN-SWM-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-004',category:'training',type:'positive',rarity:'Rare',name:'Waterborne',description:'Complete twenty-five Swimming sessions.',systemMessage:'Dry land is becoming optional.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:25,iconAsset:'Achievements/TrainingSports/TRN-SWM-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Dips',description:'Complete fifty Swimming sessions.',systemMessage:'Fifty successful returns from the water.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:50,iconAsset:'Achievements/TrainingSports/TRN-SWM-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Swimmer',description:'Complete one hundred Swimming sessions.',systemMessage:'One hundred swims. Gills remain unconfirmed.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:100,iconAsset:'Achievements/TrainingSports/TRN-SWM-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-007',category:'training',type:'positive',rarity:'Legendary',name:'Human Torpedo',description:'Complete two hundred fifty Swimming sessions.',systemMessage:'Hydrodynamic concerns have been raised.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:250,iconAsset:'Achievements/TrainingSports/TRN-SWM-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-SWM-008',category:'training',type:'positive',rarity:'Celestial',name:'Part-Time Fish',description:'Complete five hundred Swimming sessions.',systemMessage:'Five hundred swims. Species classification is under review.',series:'Swimming — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Swimming',triggerValue:500,iconAsset:'Achievements/TrainingSports/TRN-SWM-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-001',category:'training',type:'positive',rarity:'Common',name:'Pick Things Up',description:'Complete your first Strength Training session.',systemMessage:'Object lifted. Gravity disappointed.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:1,iconAsset:'Achievements/TrainingSports/TRN-STR-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-002',category:'training',type:'positive',rarity:'Common',name:'Finding Your Form',description:'Complete five Strength Training sessions.',systemMessage:'Repeated lifting detected.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:5,iconAsset:'Achievements/TrainingSports/TRN-STR-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Sessions Strong',description:'Complete ten Strength Training sessions.',systemMessage:'Ten sessions. The iron is beginning to remember you.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:10,iconAsset:'Achievements/TrainingSports/TRN-STR-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-004',category:'training',type:'positive',rarity:'Rare',name:'Iron Habit',description:'Complete twenty-five Strength Training sessions.',systemMessage:'The weights are no longer surprised to see you.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:25,iconAsset:'Achievements/TrainingSports/TRN-STR-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Strong',description:'Complete fifty Strength Training sessions.',systemMessage:'Fifty sessions of negotiated gravity.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:50,iconAsset:'Achievements/TrainingSports/TRN-STR-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-006',category:'training',type:'positive',rarity:'Legendary',name:'Century of Iron',description:'Complete one hundred Strength Training sessions.',systemMessage:'One hundred sessions. The iron has accepted you.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:100,iconAsset:'Achievements/TrainingSports/TRN-STR-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-007',category:'training',type:'positive',rarity:'Legendary',name:'Built Different',description:'Complete two hundred fifty Strength Training sessions.',systemMessage:'At this point the furniture is probably safer around you.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:250,iconAsset:'Achievements/TrainingSports/TRN-STR-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-STR-008',category:'training',type:'positive',rarity:'Celestial',name:'Forged in Repetition',description:'Complete five hundred Strength Training sessions.',systemMessage:'Five hundred sessions. Repetition has become metallurgy.',series:'Strength Training — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:500,iconAsset:'Achievements/TrainingSports/TRN-STR-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-001',category:'training',type:'positive',rarity:'Common',name:'Touch Your Toes',description:'Complete your first Yoga session.',systemMessage:'Flexibility protocol initiated.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:1,iconAsset:'Achievements/TrainingSports/TRN-YOG-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-002',category:'training',type:'positive',rarity:'Common',name:'Finding Balance',description:'Complete five Yoga sessions.',systemMessage:'Balance remains technically possible.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:5,iconAsset:'Achievements/TrainingSports/TRN-YOG-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Breaths Deeper',description:'Complete ten Yoga sessions.',systemMessage:'Breathing has become suspiciously organised.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:10,iconAsset:'Achievements/TrainingSports/TRN-YOG-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-004',category:'training',type:'positive',rarity:'Rare',name:'Bend, Don’t Break',description:'Complete twenty-five Yoga sessions.',systemMessage:'Structural integrity maintained.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:25,iconAsset:'Achievements/TrainingSports/TRN-YOG-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Flows',description:'Complete fifty Yoga sessions.',systemMessage:'Fifty sessions of weaponised calm.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:50,iconAsset:'Achievements/TrainingSports/TRN-YOG-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-006',category:'training',type:'positive',rarity:'Legendary',name:'Century of Calm',description:'Complete one hundred Yoga sessions.',systemMessage:'One hundred sessions. Inner peace remains annoyingly plausible.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:100,iconAsset:'Achievements/TrainingSports/TRN-YOG-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-007',category:'training',type:'positive',rarity:'Legendary',name:'Unreasonably Flexible',description:'Complete two hundred fifty Yoga sessions.',systemMessage:'The skeleton has submitted a flexibility amendment.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:250,iconAsset:'Achievements/TrainingSports/TRN-YOG-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-YOG-008',category:'training',type:'positive',rarity:'Celestial',name:'Human Pretzel',description:'Complete five hundred Yoga sessions.',systemMessage:'Five hundred sessions. Conventional geometry no longer applies.',series:'Yoga — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Yoga',triggerValue:500,iconAsset:'Achievements/TrainingSports/TRN-YOG-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-001',category:'training',type:'positive',rarity:'Common',name:'Enter the Dojo',description:'Complete your first Martial Arts session.',systemMessage:'Combat training registered. Please remain civil.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:1,iconAsset:'Achievements/TrainingSports/TRN-MAR-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-002',category:'training',type:'positive',rarity:'Common',name:'White Belt Energy',description:'Complete five Martial Arts sessions.',systemMessage:'Enthusiasm exceeds technique. This is normal.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:5,iconAsset:'Achievements/TrainingSports/TRN-MAR-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Bouts In',description:'Complete ten Martial Arts sessions.',systemMessage:'Ten sessions. Falling down now has educational value.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:10,iconAsset:'Achievements/TrainingSports/TRN-MAR-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-004',category:'training',type:'positive',rarity:'Rare',name:'Discipline',description:'Complete twenty-five Martial Arts sessions.',systemMessage:'Repetition has begun turning into technique.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:25,iconAsset:'Achievements/TrainingSports/TRN-MAR-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Sessions of Violence',description:'Complete fifty Martial Arts sessions.',systemMessage:'The System has been assured this is consensual training.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:50,iconAsset:'Achievements/TrainingSports/TRN-MAR-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Fighter',description:'Complete one hundred Martial Arts sessions.',systemMessage:'One hundred sessions. You may now bow dramatically.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:100,iconAsset:'Achievements/TrainingSports/TRN-MAR-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-007',category:'training',type:'positive',rarity:'Legendary',name:'Warrior Scholar',description:'Complete two hundred fifty Martial Arts sessions.',systemMessage:'Violence and education have reached an understanding.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:250,iconAsset:'Achievements/TrainingSports/TRN-MAR-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-MAR-008',category:'training',type:'positive',rarity:'Celestial',name:'Still Not a Ninja',description:'Complete five hundred Martial Arts sessions.',systemMessage:'Five hundred sessions. Ninja status remains legally unverified.',series:'Martial Arts — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'MartialArts',triggerValue:500,iconAsset:'Achievements/TrainingSports/TRN-MAR-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-001',category:'training',type:'positive',rarity:'Common',name:'Off the Ground',description:'Complete your first Climbing session.',systemMessage:'Gravity has been challenged.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:1,iconAsset:'Achievements/TrainingSports/TRN-CLM-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-002',category:'training',type:'positive',rarity:'Common',name:'Finding a Hold',description:'Complete five Climbing sessions.',systemMessage:'Handholds are becoming less theoretical.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:5,iconAsset:'Achievements/TrainingSports/TRN-CLM-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Ascents',description:'Complete ten Climbing sessions.',systemMessage:'Ten sessions above where good sense suggested staying.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:10,iconAsset:'Achievements/TrainingSports/TRN-CLM-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-004',category:'training',type:'positive',rarity:'Rare',name:'Chalk Addict',description:'Complete twenty-five Climbing sessions.',systemMessage:'Chalk consumption remains indirect but substantial.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:25,iconAsset:'Achievements/TrainingSports/TRN-CLM-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Climbs',description:'Complete fifty Climbing sessions.',systemMessage:'Fifty sessions. Gravity remains undefeated but irritated.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:50,iconAsset:'Achievements/TrainingSports/TRN-CLM-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Climber',description:'Complete one hundred Climbing sessions.',systemMessage:'One hundred climbs. Down remains easier.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:100,iconAsset:'Achievements/TrainingSports/TRN-CLM-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-007',category:'training',type:'positive',rarity:'Legendary',name:'Gravity Negotiator',description:'Complete two hundred fifty Climbing sessions.',systemMessage:'Gravity has agreed to continued talks.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:250,iconAsset:'Achievements/TrainingSports/TRN-CLM-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-CLM-008',category:'training',type:'positive',rarity:'Celestial',name:'Apparently a Mountain Goat',description:'Complete five hundred Climbing sessions.',systemMessage:'Five hundred sessions. Hooves remain optional.',series:'Climbing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Climbing',triggerValue:500,iconAsset:'Achievements/TrainingSports/TRN-CLM-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-001',category:'training',type:'positive',rarity:'Common',name:'What Counts as Training?',description:'Complete your first training session classified as Other.',systemMessage:'The System has accepted your interpretation of exercise.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:1,iconAsset:'Achievements/TrainingSports/TRN-OTH-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-002',category:'training',type:'positive',rarity:'Common',name:'Apparently This Counts',description:'Complete five training sessions classified as Other.',systemMessage:'Repeated ambiguity detected.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:5,iconAsset:'Achievements/TrainingSports/TRN-OTH-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten of Whatever This Is',description:'Complete ten training sessions classified as Other.',systemMessage:'Ten sessions completed. Classification remains unresolved.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:10,iconAsset:'Achievements/TrainingSports/TRN-OTH-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-004',category:'training',type:'positive',rarity:'Rare',name:'Unclassified Activity',description:'Complete twenty-five training sessions classified as Other.',systemMessage:'The System has stopped pretending it knows what you are doing.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:25,iconAsset:'Achievements/TrainingSports/TRN-OTH-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Mystery Sessions',description:'Complete fifty training sessions classified as Other.',systemMessage:'Fifty entries later. Still no category.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:50,iconAsset:'Achievements/TrainingSports/TRN-OTH-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-006',category:'training',type:'positive',rarity:'Legendary',name:'Century of Miscellaneous',description:'Complete one hundred training sessions classified as Other.',systemMessage:'One hundred sessions of taxonomical failure.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:100,iconAsset:'Achievements/TrainingSports/TRN-OTH-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-007',category:'training',type:'positive',rarity:'Legendary',name:'The System Gives Up',description:'Complete two hundred fifty training sessions classified as Other.',systemMessage:'Fine. It is exercise. Stop asking.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:250,iconAsset:'Achievements/TrainingSports/TRN-OTH-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-OTH-008',category:'training',type:'positive',rarity:'Celestial',name:'Otherworldly',description:'Complete five hundred training sessions classified as Other.',systemMessage:'Five hundred uncategorised sessions. You have transcended taxonomy.',series:'Other — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Other',triggerValue:500,iconAsset:'Achievements/TrainingSports/TRN-OTH-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
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
  {achievementId:'ID PENDING - Slow and Steady',category:'walking',type:'positive',rarity:'PENDING',name:'Slow and Steady',description:'Walk 5 km in a single session.',triggerType:'walkSingleSession5kEver',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ID PENDING - Tortoise and Hare',category:'walking',type:'positive',rarity:'PENDING',name:'Tortoise and Hare',description:'Walk 10 km in a single session.',triggerType:'walkSingleSession10kEver',triggerValue:1,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
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
  {achievementId:'SLP-SEX-001',category:'sleep',type:'positive',rarity:'Common',name:'Well, That Explains It',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'Sleep target missed. Morale appears unaffected.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-SEX-001-well-that-explains-it.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-SEX-002',category:'sleep',type:'positive',rarity:'Uncommon',name:'Worth It',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'The System has reviewed the circumstances and withdrawn its complaint.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:3,iconAsset:'Achievements/Sleep/SLP-SEX-002-worth-it.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-SEX-003',category:'sleep',type:'positive',rarity:'Rare',name:'Cardio After Dark',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'Additional activity detected. Sleep was apparently the secondary objective.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:10,iconAsset:'Achievements/Sleep/SLP-SEX-003-cardio-after-dark.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-SEX-004',category:'sleep',type:'positive',rarity:'Epic',name:'No Rest for the Wicked',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'Sleep deficit confirmed. Cause identified. No further questions.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:25,iconAsset:'Achievements/Sleep/SLP-SEX-004-no-rest-for-the-wicked.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-SEX-005',category:'sleep',type:'positive',rarity:'Legendary',name:'Death by Snu Snu',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'Cause of exhaustion identified. The System considers this self-inflicted.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:50,iconAsset:'Achievements/Sleep/SLP-SEX-005-death-by-snu-snu.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-SEX-006',category:'sleep',type:'positive',rarity:'Celestial',name:'The Flesh Is Willing',description:'Hidden comedic sleep achievement attributed to sex.',systemMessage:'One hundred sleep targets sacrificed. Priorities have been thoroughly documented.',series:'Sexies — Sex',triggerType:'sleepSexReasonCount',triggerValue:100,iconAsset:'Achievements/Sleep/SLP-SEX-006-the-flesh-is-willing.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-001',category:'sleep',type:'positive',rarity:'Common',name:'TMI',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'You could have just selected ‘Other.’',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-MAS-001-tmi.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-002',category:'sleep',type:'positive',rarity:'Uncommon',name:'Again?',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'The System did not require this level of disclosure.',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:3,iconAsset:'Achievements/Sleep/SLP-MAS-002-again.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-003',category:'sleep',type:'positive',rarity:'Rare',name:'Solo Queue',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'Multiplayer remains unavailable. Apparently this has not slowed progression.',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:10,iconAsset:'Achievements/Sleep/SLP-MAS-003-solo-queue.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-004',category:'sleep',type:'positive',rarity:'Epic',name:'A Handful of Regrets',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'Twenty-five sleep targets lost. At least the culprit has been identified.',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:25,iconAsset:'Achievements/Sleep/SLP-MAS-004-a-handful-of-regrets.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-005',category:'sleep',type:'positive',rarity:'Legendary',name:'Master of Your Domain',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'The System has stopped asking why you are tired.',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:50,iconAsset:'Achievements/Sleep/SLP-MAS-005-master-of-your-domain.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-MAS-006',category:'sleep',type:'positive',rarity:'Celestial',name:'Self Made',description:'Hidden comedic sleep achievement attributed to masturbation.',systemMessage:'One hundred documented incidents. This statistic exists because you insisted on creating it.',series:'Sexies — Masturbation',triggerType:'sleepMasReasonCount',triggerValue:100,iconAsset:'Achievements/Sleep/SLP-MAS-006-self-made.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-POS-006',category:'sleep',type:'positive',rarity:'Celestial',name:'Sleep Like the Dead',description:'Maintain an extraordinary long-term sleep record.',systemMessage:'One full year of successful nightly shutdowns. Resurrection continues to occur each morning.',series:'Positive Sleep',triggerType:'sleepTargetMetCount',triggerValue:365,iconAsset:'Achievements/Sleep/SLP-POS-006-sleep-like-the-dead.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-QLP-001',category:'sleep',type:'positive',rarity:'Common',name:'Actually Rested',description:'Reward restorative sleep quality.',systemMessage:'Sleep quality acceptable. Miracles remain possible.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLP-001-actually-rested.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLP-002',category:'sleep',type:'positive',rarity:'Uncommon',name:'Good Night, Literally',description:'Reward restorative sleep quality.',systemMessage:'Repeated restorative sleep detected. Suspicious.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:3,iconAsset:'Achievements/Sleep/SLP-QLP-002-good-night-literally.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLP-003',category:'sleep',type:'positive',rarity:'Rare',name:'Premium Unconsciousness',description:'Reward restorative sleep quality.',systemMessage:'You appear to have upgraded your sleeping subscription.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:7,iconAsset:'Achievements/Sleep/SLP-QLP-003-premium-unconsciousness.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLP-004',category:'sleep',type:'positive',rarity:'Epic',name:'Restoration Protocol',description:'Reward restorative sleep quality.',systemMessage:'Recovery systems are operating at unreasonable efficiency.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:30,iconAsset:'Achievements/Sleep/SLP-QLP-004-restoration-protocol.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLP-005',category:'sleep',type:'positive',rarity:'Legendary',name:'Professionally Rested',description:'Reward restorative sleep quality.',systemMessage:'Rest is no longer accidental. This appears deliberate.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:100,iconAsset:'Achievements/Sleep/SLP-QLP-005-professionally-rested.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLP-006',category:'sleep',type:'positive',rarity:'Celestial',name:'Touched by the Sandman',description:'Reward restorative sleep quality.',systemMessage:'One year of quality sleep. The System assumes witchcraft.',series:'Sleep Quality — Positive',triggerType:'sleepGoodCount',triggerValue:365,iconAsset:'Achievements/Sleep/SLP-QLP-006-touched-by-the-sandman.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-001',category:'sleep',type:'negative',rarity:'Common',name:'That Was Sleep?',description:'Comedic achievement for poor sleep quality.',systemMessage:'The System acknowledges that you were technically horizontal.',series:'Sleep Quality — Negative',triggerType:'sleepPoorCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLN-001-that-was-sleep.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-002',category:'sleep',type:'negative',rarity:'Uncommon',name:'Eight Hours of Lies',description:'Comedic contradictory sleep result.',systemMessage:'Duration claims success. Every other metric has objected.',series:'Sleep Quality — Negative',triggerType:'sleepTargetMetPoorCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLN-002-eight-hours-of-lies.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-003',category:'sleep',type:'negative',rarity:'Rare',name:'Human Loading Screen',description:'Comedic achievement for repeated poor sleep quality.',systemMessage:'You have completed several rest cycles without visibly resting.',series:'Sleep Quality — Negative',triggerType:'sleepPoorCount',triggerValue:7,iconAsset:'Achievements/Sleep/SLP-QLN-003-human-loading-screen.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-004',category:'sleep',type:'negative',rarity:'Epic',name:'Sleep Without the Benefits',description:'Comedic achievement for repeated poor sleep quality.',systemMessage:'You continue to perform the ritual. Results remain disappointing.',series:'Sleep Quality — Negative',triggerType:'sleepPoorCount',triggerValue:30,iconAsset:'Achievements/Sleep/SLP-QLN-004-sleep-without-the-benefits.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-005',category:'sleep',type:'negative',rarity:'Legendary',name:'Resting Is Apparently Decorative',description:'Comedic achievement for repeated poor sleep quality.',systemMessage:'One hundred attempts at sleep. Recovery remains theoretical.',series:'Sleep Quality — Negative',triggerType:'sleepPoorCount',triggerValue:100,iconAsset:'Achievements/Sleep/SLP-QLN-005-resting-is-apparently-decorative.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLN-006',category:'sleep',type:'negative',rarity:'Celestial',name:'The Mattress Has Failed You',description:'Comedic achievement for repeated poor sleep quality.',systemMessage:'The bed has had a full year to explain itself. It has declined.',series:'Sleep Quality — Negative',triggerType:'sleepPoorCount',triggerValue:365,iconAsset:'Achievements/Sleep/SLP-QLN-006-the-mattress-has-failed-you.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-001',category:'sleep',type:'positive',rarity:'Uncommon',name:'Against All Odds',description:'Mixed sleep-duration and quality achievement.',systemMessage:'Insufficient quantity. Irritatingly excellent quality.',series:'Sleep Quality — Mixed',triggerType:'sleepMissTargetGoodCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLM-001-against-all-odds.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-002',category:'sleep',type:'negative',rarity:'Rare',name:'Quantity Over Quality',description:'Mixed sleep-duration and quality achievement.',systemMessage:'You slept longer. This did not help.',series:'Sleep Quality — Mixed',triggerType:'sleepExceedTargetPoorCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLM-002-quantity-over-quality.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-003',category:'sleep',type:'positive',rarity:'Rare',name:'Short but Effective',description:'Mixed sleep-duration and quality achievement.',systemMessage:'Minimal runtime. Surprisingly efficient maintenance.',series:'Sleep Quality — Mixed',triggerType:'sleepUnder75PercentGoodCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLM-003-short-but-effective.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-004',category:'sleep',type:'negative',rarity:'Epic',name:'Long and Pointless',description:'Mixed sleep-duration and quality achievement.',systemMessage:'Extended shutdown completed. Benefits not located.',series:'Sleep Quality — Mixed',triggerType:'sleepOver125PercentPoorCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLM-004-long-and-pointless.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-005',category:'sleep',type:'positive',rarity:'Epic',name:'Schrödinger’s Sleep',description:'Mixed sleep-duration and quality achievement.',systemMessage:'Sleep was neither good nor bad until you opened the tracker.',series:'Sleep Quality — Mixed',triggerType:'sleepExactTargetOkayCount',triggerValue:1,iconAsset:'Achievements/Sleep/SLP-QLM-005-schr-dinger-s-sleep.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'SLP-QLM-006',category:'sleep',type:'negative',rarity:'Legendary',name:'The Numbers Are Lying',description:'Mixed sleep-duration and quality achievement.',systemMessage:'The statistics insist everything is fine. You appear unconvinced.',series:'Sleep Quality — Mixed',triggerType:'sleepTargetMetPoorCount',triggerValue:7,iconAsset:'Achievements/Sleep/SLP-QLM-006-the-numbers-are-lying.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_SLEEP_ALL_APPROVED_DEFINITIONS);
/* Quests Hub — the one real quest-defined achievement today, wired
   through the generic questFirstCompletion trigger above rather than a
   separate quest achievement system (handoff §14). category:'quest'
   maps to the pre-existing, previously-unused 'Quests' achievement
   filter bucket in app.js's ACHIEVEMENT_CATEGORY_LIST. */
const V023_QUEST_DEFINITIONS=[
  {achievementId:'QUEST-LOST-FORTRESS-001',category:'quest',type:'positive',rarity:'Rare',name:'The Pinnacle Spire',description:'Complete the Call to the Lost Fortress campaign for the first time.',systemMessage:'The Pinnacle Spire has been reached at last.',series:null,triggerType:'questFirstCompletion',triggerValue:'lost-fortress',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  /* Journeys (ASTRA Update Package 1 §13) — the one Journey achievement
     the Local Test Trail's own short route can actually validate; real
     Cape Town -> Magadan achievements (Halfway, Four Digits, etc.) wait
     on that Tour's real route data per §36. */
  {achievementId:'JOURNEY-LOCAL-TEST-TRAIL-001',category:'quest',type:'positive',rarity:'Common',name:'First Steps, Literally',description:'Complete the Local Test Trail for the first time.',systemMessage:'Ten kilometres down. A slightly longer one is still waiting.',series:null,triggerType:'questFirstCompletion',triggerValue:'local-test-trail',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_QUEST_DEFINITIONS);
/* World Tours 5.3 -- Hadrian's Wall, from Aster's production content pack
   (docs/handovers/world-tours-5.3/, 2026-09-23). Definitions (name/
   description/rarity/hidden) are Aster's own content verbatim; the
   triggerType/triggerValue wiring is Astra's, using the 5 new trigger
   types added to v023DefinitionSatisfied above -- each one a direct,
   unambiguous read of Aster's own plain-English trigger text, not an
   interpretation call. One rarity substitution, flagged rather than
   silent: hw_ach_change_of_plans was authored as rarity "Hidden", which
   isn't a real rarity tier in this engine (hidden-ness is the separate
   hidden/isSecret flags below) -- mapped to Rare. */
const V023_HADRIANS_WALL_DEFINITIONS=[
  {achievementId:'hw_ach_edge_of_empire',category:'quest',type:'positive',rarity:'Common',name:'Edge of Empire',description:'Begin the Hadrian’s Wall World Tour.',systemMessage:'The frontier awaits.',series:null,triggerType:'journeyStarted',triggerValue:'hadrians-wall',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'hw_ach_milecastle_minded',category:'quest',type:'positive',rarity:'Rare',name:'Milecastle Minded',description:'Discover three milecastle sites along Hadrian’s Wall.',systemMessage:'Every Roman mile, right on schedule.',series:null,triggerType:'journeyDiscoveredAllOf',tourId:'hadrians-wall',triggerValue:['hw_lm_cawfields','hw_evt_sewingshields','hw_evt_poltross'],iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'hw_ach_watchtower_watcher',category:'quest',type:'positive',rarity:'Rare',name:'Watchtower Watcher',description:'Discover Denton Hall Turret, Black Carts Turret, and Life on Watch.',systemMessage:'Every watch post accounted for.',series:null,triggerType:'journeyDiscoveredAllOf',tourId:'hadrians-wall',triggerValue:['hw_evt_denton_turret','hw_evt_black_carts','hw_evt_turret_life'],iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'hw_ach_three_legions',category:'quest',type:'positive',rarity:'Epic',name:'Three Legions',description:'Own all three legion cards: II Augusta, VI Victrix, and XX Valeria Victrix.',systemMessage:'The builders of the Wall, all accounted for.',series:null,triggerType:'inventoryOwnsAllOf',triggerValue:['hw_card_legion_ii_augusta','hw_card_legion_vi_victrix','hw_card_legion_xx_valeria_victrix'],iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'hw_ach_infrastructure',category:'quest',type:'positive',rarity:'Epic',name:'What Have the Romans Ever Done for Us?',description:'Complete the Infrastructure of the Frontier collection.',systemMessage:'Quite a lot, as it turns out.',series:null,triggerType:'inventoryCollectionComplete',triggerValue:'hw_collection_infrastructure',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'hw_ach_halfway',category:'quest',type:'positive',rarity:'Rare',name:'Across the Frontier',description:'Reach the halfway point of Hadrian’s Wall.',systemMessage:'67.5 kilometres down, exactly as many to go.',series:null,triggerType:'journeyDistanceReached',tourId:'hadrians-wall',triggerValue:67.5,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'hw_ach_change_of_plans',category:'quest',type:'positive',rarity:'Rare',name:'Change of Plans',description:'Discover Planetrees — Change of Plans.',systemMessage:'The foundation remembers what the wall forgot.',series:null,triggerType:'journeyDiscoveredAllOf',tourId:'hadrians-wall',triggerValue:['hw_evt_planetrees'],iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'hw_ach_guardian_of_britannia',category:'quest',type:'positive',rarity:'Epic',name:'Guardian of Britannia',description:'Complete the Hadrian’s Wall World Tour.',systemMessage:'The empire has run out of wall. You have run out of route.',series:null,triggerType:'questFirstCompletion',triggerValue:'hadrians-wall',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_HADRIANS_WALL_DEFINITIONS);
/* World Tours 5.4.x -- Camino Francés (RPG-0090 pipeline, 2026-09-24).
   Reuses all 6 of Hadrian's Wall's triggerTypes unchanged -- no new
   engine logic needed. Names/descriptions/systemMessages are Astra's
   own, written from Vesper's research (where the research itself
   supplied flavourCopy for a discovery, that line is reused verbatim in
   the systemMessage). cam_ach_travellers_trinkets deliberately excludes
   the secret wine-cork relic from its ownership list -- listing it there
   would spoil cam_ach_strength_and_vitality's hidden discovery. */
const V023_CAMINO_DE_SANTIAGO_DEFINITIONS=[
  {achievementId:'cam_ach_buen_camino',category:'quest',type:'positive',rarity:'Common',name:'Buen Camino',description:'Begin the Camino Francés World Tour.',systemMessage:'The Pyrenees are waiting.',series:null,triggerType:'journeyStarted',triggerValue:'camino-de-santiago',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'cam_ach_three_great_climbs',category:'quest',type:'positive',rarity:'Rare',name:'The Three Great Climbs',description:'Discover Roncesvalles, Cruz de Ferro, and O Cebreiro.',systemMessage:'Every pass earned the hard way.',series:null,triggerType:'journeyDiscoveredAllOf',tourId:'camino-de-santiago',triggerValue:['cam_lm_roncesvalles','cam_evt_cruz_de_ferro','cam_evt_o_cebreiro'],iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'cam_ach_travellers_trinkets',category:'quest',type:'positive',rarity:'Uncommon',name:'Traveller\'s Trinkets',description:'Own the Roland\'s Horn fragment, the Meseta Stone, and the Botafumeiro charm.',systemMessage:'A pilgrim\'s pockets, properly cluttered.',series:null,triggerType:'inventoryOwnsAllOf',triggerValue:['cam_relic_rolands_horn','cam_relic_meseta_stone','cam_relic_botafumeiro_charm'],iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'cam_ach_full_credencial',category:'quest',type:'positive',rarity:'Epic',name:'Full Credencial',description:'Complete the Pilgrim\'s Credencial -- a stamp from every major town on the Camino Francés.',systemMessage:'Nine stamps, one long walk.',series:null,triggerType:'inventoryCollectionComplete',triggerValue:'cam_collection_credencial',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'cam_ach_relics_of_the_way',category:'quest',type:'positive',rarity:'Epic',name:'Relics of the Way',description:'Complete the Relics of the Way collection.',systemMessage:'Every detour, remembered.',series:null,triggerType:'inventoryCollectionComplete',triggerValue:'cam_collection_relics',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'cam_ach_final_hundred',category:'quest',type:'positive',rarity:'Rare',name:'The Final Hundred',description:'Reach the final 100 kilometres of the Camino Francés.',systemMessage:'A crowd appears from nowhere with clean shoes.',series:null,triggerType:'journeyDistanceReached',tourId:'camino-de-santiago',triggerValue:691,iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'cam_ach_strength_and_vitality',category:'quest',type:'positive',rarity:'Rare',name:'Strength and Vitality',description:'Discover the Fuente del Vino.',systemMessage:'To reach Santiago with strength and vitality.',series:null,triggerType:'journeyDiscoveredAllOf',tourId:'camino-de-santiago',triggerValue:['cam_evt_wine_fountain'],iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'cam_ach_pilgrim_of_santiago',category:'quest',type:'positive',rarity:'Epic',name:'Pilgrim of Santiago',description:'Complete the Camino Francés World Tour.',systemMessage:'The Botafumeiro swings. The pilgrimage is complete.',series:null,triggerType:'questFirstCompletion',triggerValue:'camino-de-santiago',iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_CAMINO_DE_SANTIAGO_DEFINITIONS);
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
  {achievementId:'SLP-HID-001',category:'sleep',type:'positive',rarity:'Rare',name:'One More Turn',description:'Log a missed-sleep reason mentioning “game”, “gaming”, “turn”, or “match”.',systemMessage:'The kingdom was apparently more important than REM sleep.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['game','gaming','turn','match'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-001-one-more-turn.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-002',category:'sleep',type:'positive',rarity:'Rare',name:'Just One More Chapter',description:'Log a missed-sleep reason mentioning “book”, “reading”, or “chapter”.',systemMessage:'Literacy has claimed another victim.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['book','reading','chapter'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-002-just-one-more-chapter.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-003',category:'sleep',type:'positive',rarity:'Rare',name:'The Bug Can Smell Fear',description:'Log a missed-sleep reason mentioning “coding”, “bug”, “debug”, or “programming”.',systemMessage:'You defeated the bug. The bug defeated your bedtime.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['coding','bug','debug','programming'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-003-the-bug-can-smell-fear.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-004',category:'sleep',type:'positive',rarity:'Rare',name:'Streaming Until Morale Improves',description:'Log a missed-sleep reason mentioning “netflix”, “series”, “episode”, or “streaming”.',systemMessage:'Autoplay remains undefeated.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['netflix','series','episode','streaming'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-004-streaming-until-morale-improves.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-005',category:'sleep',type:'positive',rarity:'Rare',name:'Social Encounter: Extended Cut',description:'Log a missed-sleep reason mentioning “party”, “friends”, “pub”, or “social”.',systemMessage:'The side quest lasted significantly longer than advertised.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['party','friends','pub','social'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-005-social-encounter-extended-cut.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-006',category:'sleep',type:'positive',rarity:'Rare',name:'Doomscroll Adept',description:'Log a missed-sleep reason mentioning “phone”, “scrolling”, “reddit”, “tiktok”, or “youtube”.',systemMessage:'You have consumed the entire internet. It will respawn tomorrow.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['phone','scrolling','reddit','tiktok','youtube'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-006-doomscroll-adept.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-007',category:'sleep',type:'positive',rarity:'Rare',name:'The Midnight Snack Raid',description:'Log a missed-sleep reason mentioning “food”, “snack”, “hungry”, or “kitchen”.',systemMessage:'Loot acquired. Sleep schedule lost.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['food','snack','hungry','kitchen'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-007-the-midnight-snack-raid.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-008',category:'sleep',type:'positive',rarity:'Rare',name:'Quest Accepted at 23:47',description:'Log a missed-sleep reason mentioning “work”, “project”, “deadline”, or “email”.',systemMessage:'An excellent time to begin something completely unnecessary.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['work','project','deadline','email'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-008-quest-accepted-at-23-47.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-009',category:'sleep',type:'positive',rarity:'Rare',name:'The Brain Has Declined Shutdown',description:'Log a missed-sleep reason mentioning “thinking”, “overthinking”, “brain”, or “thoughts”.',systemMessage:'System shutdown requested. Request denied.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['thinking','overthinking','brain','thoughts'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-009-the-brain-has-declined-shutdown.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-010',category:'sleep',type:'positive',rarity:'Rare',name:'Furniture Assembly: Nightmare Difficulty',description:'Log a missed-sleep reason mentioning “ikea”, “furniture”, or “assembly”.',systemMessage:'Three screws remained. So did you.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['ikea','furniture','assembly'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-010-furniture-assembly-nightmare-difficulty.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-011',category:'sleep',type:'positive',rarity:'Rare',name:'Dungeon Master’s Curse',description:'Log a missed-sleep reason mentioning “dnd”, “d&d”, “campaign”, “session”, or “warhammer”.',systemMessage:'The session ended hours ago. The lore discussion did not.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['dnd','d&d','campaign','session','warhammer'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-011-dungeon-master-s-curse.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-012',category:'sleep',type:'positive',rarity:'Rare',name:'Patch Notes at Midnight',description:'Log a missed-sleep reason mentioning “update”, “patch”, “install”, or “download”.',systemMessage:'Sleep postponed due to critical balance changes.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['update','patch','install','download'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-012-patch-notes-at-midnight.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-013',category:'sleep',type:'positive',rarity:'Rare',name:'Domestic Raid Boss',description:'Log a missed-sleep reason mentioning “cleaning”, “laundry”, “dishes”, or “housework”.',systemMessage:'The chores had enrage mechanics.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['cleaning','laundry','dishes','housework'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-013-domestic-raid-boss.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-014',category:'sleep',type:'positive',rarity:'Rare',name:'Unexpected Lore Drop',description:'Log a missed-sleep reason mentioning “wikipedia”, “research”, “rabbit hole”, or “documentary”.',systemMessage:'You only wanted to know one thing.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['wikipedia','research','rabbit hole','documentary'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-014-unexpected-lore-drop.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'SLP-HID-015',category:'sleep',type:'positive',rarity:'Rare',name:'Bedtime Side Quest Failed',description:'Log a missed-sleep reason mentioning “forgot”, “lost track”, “time”, or “late”.',systemMessage:'Time remains an optional mechanic.',series:'Sleep Other-Text Triggers',triggerType:'sleepOtherTextTrigger',triggerWords:['forgot','lost track','time','late'],triggerValue:1,iconAsset:'Achievements/Sleep/SLP-HID-015-bedtime-side-quest-failed.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_SLEEP_HIDDEN_DEFINITIONS);
/* Daily Quest Minimum achievements (ASTRA Update Package 1 §28-30). */
const V023_DAILY_QUEST_DEFINITIONS=[
  {achievementId:'DQ-POS-001',category:'quest',type:'positive',rarity:'Legendary',name:'You Are Now the Adultiest Adult',description:'Maintain a full month of complete Daily Quest clears without misses or carry-overs.',systemMessage:'When all others need an adult, they look to you. Sucks to be them.',series:'Daily Quest Full Clear',triggerType:'dailyQuestStreak',triggerValue:30,iconAsset:'Achievements/DailyQuests/DQ-POS-001.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-POS-007',category:'quest',type:'positive',rarity:'Uncommon',name:'There’s Still Room for More',description:'Raise your configured Daily Quest Minimum for the first time.',systemMessage:'Ambition noted. Proceed accordingly.',series:'Daily Quest Goal Adjustment',triggerType:'dailyQuestMinimumFirstIncrease',triggerValue:1,iconAsset:'Achievements/DailyQuests/DQ-POS-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-POS-008',category:'quest',type:'positive',rarity:'Uncommon',name:'Do What You Can',description:'The best plan is the one that still fits your life.',systemMessage:'Adjusted, not defeated.',series:'Daily Quest Goal Adjustment',triggerType:'dailyQuestMinimumFirstDecrease',triggerValue:1,iconAsset:'Achievements/DailyQuests/DQ-POS-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-RND-005',category:'quest',type:'positive',rarity:'Rare',name:'The Goalposts Have Wheels',description:'Change your Daily Quest Minimum 3 or more times within a 7-day window.',systemMessage:'Pick a number. Any number. Preferably the same one twice.',series:'Quest Goal Adjustment',triggerType:'dailyQuestMinimumChangeBurst',triggerValue:1,iconAsset:'Achievements/DailyQuests/DQ-RND-005.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
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
  {achievementId:'DQ-POS-004',category:'quest',type:'positive',rarity:'Rare',name:'Quest Goblin',description:'Complete twenty-five Daily Quests over time.',systemMessage:'You appear to be hoarding completed objectives.',series:'Cumulative Completion',triggerType:'dailyQuestCumulativeTotal',triggerValue:25,iconAsset:'Achievements/DailyQuests/DQ-POS-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-POS-005',category:'quest',type:'positive',rarity:'Epic',name:'Touch Grass, Hero',description:'Complete an unusually large number of Daily Quests in one day.',systemMessage:'The village is safe. Please go outside.',series:'Daily Quest Overload',triggerType:'dailyQuestMaxSingleDay',triggerValue:10,iconAsset:'Achievements/DailyQuests/DQ-POS-005.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-POS-006',category:'quest',type:'positive',rarity:'Legendary',name:'The System Is Concerned',description:'Complete a frankly unreasonable number of Daily Quests in a single day.',systemMessage:'This stopped being productivity several quests ago.',series:'Daily Quest Overload',triggerType:'dailyQuestMaxSingleDay',triggerValue:20,iconAsset:'Achievements/DailyQuests/DQ-POS-006.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_DAILY_QUEST_VOLUME_DEFINITIONS);
/* Imported from the Achievement Design sheet (Google Sheet), 2026-09-18 --
   190 designs marked 'Approved' there that had no matching achievementId in
   this file yet (191 were new by ID; one, RUN-POS-008, is itself still a
   'TBD' placeholder row in the sheet and was skipped rather than imported
   as a fake achievement). Every field below (category/type/rarity/name/description/
   systemMessage/series/hidden) is real sheet content, not invented. triggerType
   is deliberately the shared sentinel 'pendingDesign' (triggerValue:null) rather
   than a fabricated per-achievement key that LOOKS wired up -- the sheet's own
   Implementation Status for every one of these is 'Not Started', and
   v023DefinitionSatisfied's final `return false` makes an unrecognized
   triggerType a safe no-op (same pattern already used for e.g. the empty
   V023_MAINQUEST_DEFINITIONS dispatch above). Wiring real counters/logic per
   achievement is a separate follow-up pass, not something to guess here.
   iconAsset uses the same 'not ready yet' placeholder HYD-POS-001 already uses
   for un-produced art (Art Status is not-started for all of these too) --
   never a fabricated path to an asset that doesn't exist on disk. */
const V023_SHEET_IMPORT_20260918_DEFINITIONS=[
  // -- Running (8 new) --
  /* RUN-V1-001..008 wired (Vesper, 2026-09-22) — counters derived in
     v023RebuildRunningV1Counters; evaluator cases sit with the other
     training triggers in v023DefinitionSatisfied. Two readings to note
     for the register: RUN-V1-006 counts records IMPROVED (previousValue
     beaten), not first-time established — a first run auto-establishes
     longest_run/longest_run_duration/weekly/monthly, so the literal
     "establish or improve" would hand out an Epic secret on run one.
     RUN-V1-005 requires beating the best from an EARLIER ISO week, so a
     second run inside the same week isn't a "weekly PB". */
  {achievementId:'RUN-V1-001',category:'running',type:'positive',rarity:'Common',name:'And We\'re Off',description:'Complete and record a Running activity.',systemMessage:'Movement detected. Voluntary movement, even.',series:'Running Behaviour',triggerType:'trainingSessionCount',sessionFamily:'Running',triggerValue:1,iconAsset:'Achievements/Running/RUN-V1-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-V1-002',category:'running',type:'positive',rarity:'Rare',name:'Variety Is the Spice of Cardio',description:'Complete each of the five structured Running V1 workout types at least once.',systemMessage:'Five different ways to discover that running is still running.',series:'Running Behaviour',triggerType:'runningStructuredTypesCompleted',triggerValue:5,iconAsset:'Achievements/Running/RUN-V1-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-V1-003',category:'running',type:'positive',rarity:'Uncommon',name:'Long Way Home',description:'Exceed your previous longest completed run.',systemMessage:'You could have turned around considerably earlier.',series:'Running Records',triggerType:'trainingRecordImprovedEver',recordKey:'longest_run',triggerValue:null,iconAsset:'Achievements/Running/RUN-V1-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-V1-004',category:'running',type:'positive',rarity:'Rare',name:'Where Did the Day Go?',description:'Exceed your previous longest-duration run.',systemMessage:'At some point this became a day trip.',series:'Running Records',triggerType:'trainingRecordImprovedEver',recordKey:'longest_run_duration',triggerValue:null,iconAsset:'Achievements/Running/RUN-V1-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-V1-005',category:'running',type:'positive',rarity:'Epic',name:'Mileage Goblin',description:'Establish a new personal best for total running distance in a week.',systemMessage:'Your weekly mileage has become mildly concerning.',series:'Running Records',triggerType:'runningWeeklyDistancePbAcrossWeeksEver',triggerValue:null,iconAsset:'Achievements/Running/RUN-V1-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-V1-006',category:'running',type:'positive',rarity:'Epic',name:'That Escalated Quickly',description:'Have a single run establish or improve at least three distinct Running Records.',systemMessage:'One run. Three records. Calm down.',series:'Running Records',triggerType:'runningRecordsImprovedBySingleRun',triggerValue:3,iconAsset:'Achievements/Running/RUN-V1-006.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'RUN-V1-007',category:'running',type:'positive',rarity:'Uncommon',name:'Stick to the Plan',description:'Finish the run you scheduled and match the planned Running workout type.',systemMessage:'You made a plan and then actually followed it. Disturbing.',series:'Running Behaviour',triggerType:'runningScheduledRunCompletedEver',triggerValue:null,iconAsset:'Achievements/Running/RUN-V1-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'RUN-V1-008',category:'running',type:'positive',rarity:'Common',name:'Freestyle',description:'Complete a run using the Custom Run session type.',systemMessage:'Instructions rejected. Cardio retained.',series:'Running Behaviour',triggerType:'customRunCompletedEver',triggerValue:null,iconAsset:'Achievements/Running/RUN-V1-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  // -- Gym & Strength (10 new) --
  /* GYM-V1-001..010 wired except 005 (Vesper, 2026-09-22) — counters in
     v023RebuildGymV1Counters. Readings for the register: 002 needs a
     template-based session (the template's targetSets IS the plan; an
     ad-hoc session has no plan to exceed). 003's threshold (10 completed
     copied sets, cumulative) is a proposal. 006 counts records IMPROVED,
     same ruling as RUN-V1-006. 008 covers a zone via primary OR
     secondary muscles. 009's "several" = 3 consecutive non-leg sessions.
     010 requires all 9 STRENGTH_BODY_ZONES incl. Full Body (Legendary).
     005 stays pendingDesign: Strength Records only track heaviest
     weight, no rep record exists for it to recognise. */
  {achievementId:'GYM-V1-001',category:'gym',type:'positive',rarity:'Common',name:'Do You Even Lift?',description:'Finish and record a Strength session.',systemMessage:'Apparently you do.',series:'Strength Behaviour',triggerType:'trainingSessionCount',sessionFamily:'Strength',triggerValue:1,iconAsset:'Achievements/Gym & Strength/GYM-V1-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'GYM-V1-002',category:'gym',type:'positive',rarity:'Common',name:'One More Set',description:'Add at least one unplanned extra set during a Strength session.',systemMessage:'The workout was finished. You disagreed.',series:'Strength Behaviour',triggerType:'gymUnplannedExtraSetEver',triggerValue:null,iconAsset:'Achievements/Gym & Strength/GYM-V1-002.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-V1-003',category:'gym',type:'positive',rarity:'Uncommon',name:'Copy/Paste Gains',description:'Lean heavily on the Strength Journal\'s Copy Last Set fast action.',systemMessage:'Ctrl+C. Ctrl+V. Ctrl+STR.',series:'Strength Behaviour',triggerType:'copiedSetsCompletedTotal',triggerValue:10,iconAsset:'Achievements/Gym & Strength/GYM-V1-003.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-V1-004',category:'gym',type:'positive',rarity:'Uncommon',name:'Again, But Heavier',description:'Exceed your previous heaviest recorded weight for an exercise under Strength\'s PB rules.',systemMessage:'Previous You has been defeated.',series:'Strength Records',triggerType:'trainingRecordImprovedEver',recordActivityType:'Strength',triggerValue:null,iconAsset:'Achievements/Gym & Strength/GYM-V1-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'GYM-V1-005',category:'gym',type:'positive',rarity:'Uncommon',name:'Rep Goblin',description:'Establish or improve a high-repetition performance recognised by Strength Records.',systemMessage:'You could have stopped several repetitions ago.',series:'Strength Records',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Gym & Strength/GYM-V1-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'GYM-V1-006',category:'gym',type:'positive',rarity:'Rare',name:'PB&J',description:'Earn multiple Strength Records during a single workout.',systemMessage:'Personal Bests and suffering. A classic pairing.',series:'Strength Records',triggerType:'strengthRecordsImprovedBySingleWorkout',triggerValue:2,iconAsset:'Achievements/Gym & Strength/GYM-V1-006.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-V1-007',category:'gym',type:'positive',rarity:'Rare',name:'Creature of Habit',description:'Repeat one saved Strength routine ten times.',systemMessage:'Ten repetitions of the workout itself. Very meta.',series:'Strength Behaviour',triggerType:'workoutTemplateRepeatMax',triggerValue:10,iconAsset:'Achievements/Gym & Strength/GYM-V1-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'GYM-V1-008',category:'gym',type:'positive',rarity:'Epic',name:'Full Body Problem',description:'Complete a session whose exercises cover Chest, Back, Shoulders, Arms, Forearms, Core, Glutes, Legs and Full Body.',systemMessage:'No muscle group escaped.',series:'Strength Behaviour',triggerType:'strengthFullBodyZoneSessionEver',triggerValue:null,iconAsset:'Achievements/Gym & Strength/GYM-V1-008.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-V1-009',category:'gym',type:'positive',rarity:'Rare',name:'No Skipping Leg Day',description:'Return to a Legs-focused workout after several consecutive non-leg Strength sessions.',systemMessage:'The investigation into the missing leg days has concluded.',series:'Strength Behaviour',triggerType:'strengthLegDayReturnStreak',triggerValue:3,iconAsset:'Achievements/Gym & Strength/GYM-V1-009.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'GYM-V1-010',category:'gym',type:'positive',rarity:'Legendary',name:'Built Different',description:'Build a record portfolio spanning the full Strength body-zone system.',systemMessage:'The character sheet is beginning to look suspicious.',series:'Strength Records',triggerType:'strengthRecordZoneCount',triggerValue:9,iconAsset:'Achievements/Gym & Strength/GYM-V1-010.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  // -- Daily Quests (22 new) --
  {achievementId:'DQ-POS-002',category:'quest',type:'positive',rarity:'Common',name:'Look Who’s Functional',description:'Clear every Daily Quest assigned for the day.',systemMessage:'All assigned tasks completed. The System was not prepared for this.',series:'Daily Quest Full Clear',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-POS-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-POS-003',category:'quest',type:'positive',rarity:'Uncommon',name:'Weaponised Competence',description:'Full-clear Daily Quests for three consecutive completed days.',systemMessage:'You have converted basic responsibility into a combat style.',series:'Daily Quest Full Clear',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-POS-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-NEG-001',category:'quest',type:'negative',rarity:'Common',name:'One Job',description:'Leave exactly one assigned Daily Quest incomplete at day end.',systemMessage:'You had one remaining objective. One.',series:'Quest Neglect',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-NEG-002',category:'quest',type:'negative',rarity:'Uncommon',name:'Quest Avoidance Specialist',description:'Leave three assigned Daily Quests incomplete in the same completed day.',systemMessage:'Three objectives successfully avoided. Efficiency remains questionable.',series:'Quest Neglect',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-NEG-003',category:'quest',type:'negative',rarity:'Rare',name:'Decorative Quest Log',description:'Repeatedly inspect the Daily Quest log without completing anything.',systemMessage:'Excellent quest log usage. Limited evidence of questing.',series:'Quest Neglect',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-003.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-NEG-004',category:'quest',type:'negative',rarity:'Epic',name:'Quest Debt',description:'Accumulate at least five overdue Daily Quests.',systemMessage:'Outstanding objectives have formed a small economy.',series:'Quest Neglect',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-NEG-005',category:'quest',type:'negative',rarity:'Legendary',name:'This Is Fine',description:'Accumulate ten or more overdue Daily Quests at the same time.',systemMessage:'No immediate action required. Everything is obviously excellent.',series:'Quest Neglect',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-005.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-NEG-006',category:'quest',type:'negative',rarity:'Uncommon',name:'Barely Counts, Still Counts',description:'Finish the final Daily Quest just before the day ends.',systemMessage:'A victory achieved entirely through technicality and panic.',series:'Procrastination',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-006.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-NEG-007',category:'quest',type:'negative',rarity:'Rare',name:'Procrastination Speedrun',description:'Delay starting the entire Daily Quest list until evening and still leave something undone.',systemMessage:'You waited until the last possible moment. Then somehow made it worse.',series:'Procrastination',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-007.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-NEG-008',category:'quest',type:'negative',rarity:'Uncommon',name:'Tomorrow’s Problem',description:'Reschedule the same Daily Quest three times instead of completing it.',systemMessage:'Quest successfully defeated through scheduling.',series:'Quest Delay',triggerType:'dailyQuestMaxDelaysSingleQuest',triggerValue:3,iconAsset:'Achievements/DailyQuests/DQ-NEG-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'DQ-NEG-009',category:'quest',type:'negative',rarity:'Epic',name:'Quest Necromancy',description:'Finally complete a Daily Quest after repeatedly postponing it.',systemMessage:'This objective has been dead for days. Somehow, it walks.',series:'Quest Delay',triggerType:'dailyQuestCompletedAfterDelaysEver',triggerValue:2,iconAsset:'Achievements/DailyQuests/DQ-NEG-009.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-NEG-010',category:'quest',type:'negative',rarity:'Rare',name:'Failure With Extra Steps',description:'Generate substantial activity around a Daily Quest without actually completing it.',systemMessage:'An impressive amount of activity occurred around not doing the thing.',series:'Quest Interaction',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-010.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-NEG-011',category:'quest',type:'negative',rarity:'Epic',name:'The Checkbox Was Right There',description:'Repeatedly inspect the same Daily Quest and leave it unchecked.',systemMessage:'You have inspected the objective thoroughly.',series:'Quest Interaction',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-011.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-NEG-012',category:'quest',type:'negative',rarity:'Epic',name:'Schrödinger’s Quest',description:'Keep a Daily Quest in a permanent state of planning without resolution.',systemMessage:'The quest currently exists in a state of both planned and absolutely not happening.',series:'Quest Interaction',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-012.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-NEG-013',category:'quest',type:'negative',rarity:'Rare',name:'Administrative Boss Fight',description:'Spend more effort managing Daily Quests than completing them.',systemMessage:'Productivity has been replaced by productivity management.',series:'Quest Interaction',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-013.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-NEG-014',category:'quest',type:'negative',rarity:'Rare',name:'Selective Heroism',description:'Complete the difficult objectives while leaving the simplest one untouched.',systemMessage:'Dragon slain. Laundry untouched.',series:'Selective Completion',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-014.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-NEG-015',category:'quest',type:'negative',rarity:'Legendary',name:'Quest Bankruptcy',description:'Build an extreme backlog of overdue Daily Quests.',systemMessage:'The objective economy has collapsed. Creditors are approaching.',series:'Backlog',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-NEG-015.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-RND-001',category:'quest',type:'positive',rarity:'Epic',name:'Goblin Mode Activated',description:'Suddenly attack a backlog and clear several overdue Daily Quests together.',systemMessage:'The backlog has been attacked by something feral.',series:'Backlog Recovery',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-RND-001.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-RND-002',category:'quest',type:'positive',rarity:'Uncommon',name:'Absolutely Not',description:'Reject a newly created Daily Quest almost immediately.',systemMessage:'Objective reviewed. Objective rejected.',series:'Quest Rejection',triggerType:'dailyQuestSameDayRejectEver',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-RND-002.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-RND-003',category:'quest',type:'positive',rarity:'Legendary',name:'I Reject Your Reality',description:'Erase the entire Daily Quest list for a day rather than complete it.',systemMessage:'The quest log has been cleansed. Responsibility cannot currently be located.',series:'Quest Rejection',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-RND-003.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-RND-004',category:'quest',type:'positive',rarity:'Legendary',name:'Absolutely Fucking Not',description:'Rapidly reject five newly created Daily Quests in a single day.',systemMessage:'Five objectives entered the system. Five objectives were executed without trial.',series:'Quest Rejection',triggerType:'dailyQuestMaxRejectionsSingleDay',triggerValue:5,iconAsset:'Achievements/DailyQuests/DQ-RND-004.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'DQ-RES-001',category:'quest',type:'positive',rarity:'Common',name:'I Meant To Do That',description:'Return to a missed Daily Quest and complete it the following day.',systemMessage:'Strategic postponement retroactively declared.',series:'Quest Recovery',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/DailyQuests/DQ-RES-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  // -- Productivity & Adulting (8 new) --
  {achievementId:'ADU-LOG-001',category:'productivity',type:'positive',rarity:'Common',name:'I Have a Plan',description:'Create the first schedule reference to a Quest, Training activity or other supported RPG source item.',systemMessage:'A plan has been created. Survival odds marginally improved.',series:'Adventurer\'s Log',triggerType:'scheduleReferencesTotal',triggerValue:1,iconAsset:'Achievements/Productivity/ADU-LOG-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADU-LOG-002',category:'productivity',type:'positive',rarity:'Uncommon',name:'Tomorrow Me\'s Problem',description:'Move scheduled responsibilities to tomorrow five times.',systemMessage:'Tomorrow You has filed a formal complaint.',series:'Adventurer\'s Log',triggerType:'movedToTomorrowTotal',triggerValue:5,iconAsset:'Achievements/Productivity/ADU-LOG-002.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADU-LOG-003',category:'productivity',type:'positive',rarity:'Rare',name:'Future Me Can Handle It',description:'Keep moving the same responsibility through the schedule.',systemMessage:'The problem has successfully travelled through time.',series:'Adventurer\'s Log',triggerType:'maxReschedulesSingleItem',triggerValue:3,iconAsset:'Achievements/Productivity/ADU-LOG-003.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADU-LOG-004',category:'productivity',type:'positive',rarity:'Common',name:'Top Three Problems',description:'Use all three available Top Priority positions.',systemMessage:'Congratulations. You have identified the fires.',series:'Adventurer\'s Log',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Productivity/ADU-LOG-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADU-LOG-005',category:'productivity',type:'positive',rarity:'Uncommon',name:'Look at Me Being Organised',description:'Build a week containing seven or more scheduled RPG references.',systemMessage:'This is suspiciously competent behaviour.',series:'Adventurer\'s Log',triggerType:'maxScheduledReferencesInWeek',triggerValue:7,iconAsset:'Achievements/Productivity/ADU-LOG-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADU-LOG-006',category:'productivity',type:'positive',rarity:'Rare',name:'The Great Migration',description:'Relocate several planned items together when bulk movement becomes available.',systemMessage:'The entire week has been relocated.',series:'Adventurer\'s Log',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Productivity/ADU-LOG-006.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADU-LOG-007',category:'productivity',type:'positive',rarity:'Common',name:'Déjà Vu',description:'Use Duplicate Event on a scheduled item.',systemMessage:'You liked that problem so much you made another one.',series:'Adventurer\'s Log',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Productivity/ADU-LOG-007.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADU-LOG-008',category:'productivity',type:'positive',rarity:'Common',name:'I\'ll Definitely Remember This',description:'Use the Log\'s lightweight planning notes/reminders for the first time.',systemMessage:'You outsourced remembering to the System. Sensible.',series:'Adventurer\'s Log',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Productivity/ADU-LOG-008.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  // -- Personal Development (31 new) --
  {achievementId:'STAT-STR-001',category:'personalGrowth',type:'positive',rarity:'Common',name:'Do You Even Stat?',description:'Begin specialising exclusively in Strength.',systemMessage:'Three Strength increases in a row. Subtlety remains available as an optional feature.',series:'STR Purity',triggerType:'statPurityStreak',statKey:'str',triggerValue:3,iconAsset:'Achievements/PersonalDevelopment/STAT-STR-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-STR-002',category:'personalGrowth',type:'positive',rarity:'Uncommon',name:'Strength Is the Answer',description:'Continue exclusive Strength development.',systemMessage:'Have you considered solving this with Strength? Of course you have.',series:'STR Purity',triggerType:'statPurityStreak',statKey:'str',triggerValue:5,iconAsset:'Achievements/PersonalDevelopment/STAT-STR-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-STR-003',category:'personalGrowth',type:'positive',rarity:'Rare',name:'Dump Stat? Never Heard of It',description:'Reach a ten-increase Strength purity sequence.',systemMessage:'Other stats exist. Allegedly.',series:'STR Purity',triggerType:'statPurityStreak',statKey:'str',triggerValue:10,iconAsset:'Achievements/PersonalDevelopment/STAT-STR-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-STR-004',category:'personalGrowth',type:'positive',rarity:'Epic',name:'All Points Into Strength',description:'Reach an extreme Strength specialisation sequence.',systemMessage:'Twenty-five consecutive Strength increases. The character sheet is beginning to smell like protein powder.',series:'STR Purity',triggerType:'statPurityStreak',statKey:'str',triggerValue:25,iconAsset:'Achievements/PersonalDevelopment/STAT-STR-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-STR-005',category:'personalGrowth',type:'positive',rarity:'Legendary',name:'Unga Bunga Ascendant',description:'Reach the Legendary Strength purity milestone.',systemMessage:'Fifty consecutive Strength increases. Thinking is now considered an optional action.',series:'STR Purity',triggerType:'statPurityStreak',statKey:'str',triggerValue:50,iconAsset:'Achievements/PersonalDevelopment/STAT-STR-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-DEX-001',category:'personalGrowth',type:'positive',rarity:'Common',name:'Quick Learner',description:'Begin specialising exclusively in Dexterity.',systemMessage:'Apparently standing still was never part of the build.',series:'DEX Purity',triggerType:'statPurityStreak',statKey:'dex',triggerValue:3,iconAsset:'Achievements/PersonalDevelopment/STAT-DEX-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-DEX-002',category:'personalGrowth',type:'positive',rarity:'Uncommon',name:'Can\'t Touch This',description:'Continue exclusive Dexterity development.',systemMessage:'Five Dexterity increases. Objects are beginning to miss you.',series:'DEX Purity',triggerType:'statPurityStreak',statKey:'dex',triggerValue:5,iconAsset:'Achievements/PersonalDevelopment/STAT-DEX-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-DEX-003',category:'personalGrowth',type:'positive',rarity:'Rare',name:'Reflexes Optional',description:'Reach a ten-increase Dexterity purity sequence.',systemMessage:'Ten increases. Reflexes have replaced planning.',series:'DEX Purity',triggerType:'statPurityStreak',statKey:'dex',triggerValue:10,iconAsset:'Achievements/PersonalDevelopment/STAT-DEX-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-DEX-004',category:'personalGrowth',type:'positive',rarity:'Epic',name:'Faster Than Good Judgement',description:'Reach an extreme Dexterity specialisation sequence.',systemMessage:'Twenty-five. Your body now reacts before you\'ve finished making the bad decision.',series:'DEX Purity',triggerType:'statPurityStreak',statKey:'dex',triggerValue:25,iconAsset:'Achievements/PersonalDevelopment/STAT-DEX-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-DEX-005',category:'personalGrowth',type:'positive',rarity:'Legendary',name:'Untouchable',description:'Reach the Legendary Dexterity purity milestone.',systemMessage:'Fifty consecutive Dexterity increases. Hitboxes are now merely suggestions.',series:'DEX Purity',triggerType:'statPurityStreak',statKey:'dex',triggerValue:50,iconAsset:'Achievements/PersonalDevelopment/STAT-DEX-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-CON-001',category:'personalGrowth',type:'positive',rarity:'Common',name:'Built to Last',description:'Begin specialising exclusively in Constitution.',systemMessage:'Three Constitution increases. Mild inconvenience resistance acquired.',series:'CON Purity',triggerType:'statPurityStreak',statKey:'con',triggerValue:3,iconAsset:'Achievements/PersonalDevelopment/STAT-CON-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-CON-002',category:'personalGrowth',type:'positive',rarity:'Uncommon',name:'Still Standing',description:'Continue exclusive Constitution development.',systemMessage:'Five increases. Damage has started taking this personally.',series:'CON Purity',triggerType:'statPurityStreak',statKey:'con',triggerValue:5,iconAsset:'Achievements/PersonalDevelopment/STAT-CON-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-CON-003',category:'personalGrowth',type:'positive',rarity:'Rare',name:'Apparently Immortal',description:'Reach a ten-increase Constitution purity sequence.',systemMessage:'Ten increases. The System has checked. You are annoyingly alive.',series:'CON Purity',triggerType:'statPurityStreak',statKey:'con',triggerValue:10,iconAsset:'Achievements/PersonalDevelopment/STAT-CON-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-CON-004',category:'personalGrowth',type:'positive',rarity:'Epic',name:'Too Stubborn to Die',description:'Reach an extreme Constitution specialisation sequence.',systemMessage:'Twenty-five. At this point dying would require paperwork.',series:'CON Purity',triggerType:'statPurityStreak',statKey:'con',triggerValue:25,iconAsset:'Achievements/PersonalDevelopment/STAT-CON-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-CON-005',category:'personalGrowth',type:'positive',rarity:'Legendary',name:'Death Has Given Up',description:'Reach the Legendary Constitution purity milestone.',systemMessage:'Fifty consecutive Constitution increases. Death has reviewed your file and decided to come back later.',series:'CON Purity',triggerType:'statPurityStreak',statKey:'con',triggerValue:50,iconAsset:'Achievements/PersonalDevelopment/STAT-CON-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-INT-001',category:'personalGrowth',type:'positive',rarity:'Common',name:'Big Brain Energy',description:'Begin specialising exclusively in Intelligence.',systemMessage:'Three Intelligence increases. You may now correct people with slightly more authority.',series:'INT Purity',triggerType:'statPurityStreak',statKey:'int',triggerValue:3,iconAsset:'Achievements/PersonalDevelopment/STAT-INT-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-INT-002',category:'personalGrowth',type:'positive',rarity:'Uncommon',name:'Actually, Technically…',description:'Continue exclusive Intelligence development.',systemMessage:'Five increases. You have begun sentences with ‘Actually’ at an alarming rate.',series:'INT Purity',triggerType:'statPurityStreak',statKey:'int',triggerValue:5,iconAsset:'Achievements/PersonalDevelopment/STAT-INT-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-INT-003',category:'personalGrowth',type:'positive',rarity:'Rare',name:'Walking Encyclopaedia',description:'Reach a ten-increase Intelligence purity sequence.',systemMessage:'Ten increases. The wiki is considering linking to you.',series:'INT Purity',triggerType:'statPurityStreak',statKey:'int',triggerValue:10,iconAsset:'Achievements/PersonalDevelopment/STAT-INT-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-INT-004',category:'personalGrowth',type:'positive',rarity:'Epic',name:'Knowledge Is Power',description:'Reach an extreme Intelligence specialisation sequence.',systemMessage:'Twenty-five. Knowledge has stopped being useful and become a competitive sport.',series:'INT Purity',triggerType:'statPurityStreak',statKey:'int',triggerValue:25,iconAsset:'Achievements/PersonalDevelopment/STAT-INT-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-INT-005',category:'personalGrowth',type:'positive',rarity:'Legendary',name:'Forbidden Knowledge',description:'Reach the Legendary Intelligence purity milestone.',systemMessage:'Fifty consecutive Intelligence increases. You now know several things the System would prefer you didn\'t.',series:'INT Purity',triggerType:'statPurityStreak',statKey:'int',triggerValue:50,iconAsset:'Achievements/PersonalDevelopment/STAT-INT-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-WIS-001',category:'personalGrowth',type:'positive',rarity:'Common',name:'A Moment of Clarity',description:'Begin specialising exclusively in Wisdom.',systemMessage:'Three Wisdom increases. You briefly considered the consequences.',series:'WIS Purity',triggerType:'statPurityStreak',statKey:'wis',triggerValue:3,iconAsset:'Achievements/PersonalDevelopment/STAT-WIS-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-WIS-002',category:'personalGrowth',type:'positive',rarity:'Uncommon',name:'I Have Seen Things',description:'Continue exclusive Wisdom development.',systemMessage:'Five increases. You have begun staring thoughtfully into the middle distance.',series:'WIS Purity',triggerType:'statPurityStreak',statKey:'wis',triggerValue:5,iconAsset:'Achievements/PersonalDevelopment/STAT-WIS-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-WIS-003',category:'personalGrowth',type:'positive',rarity:'Rare',name:'Unsolicited Wisdom',description:'Reach a ten-increase Wisdom purity sequence.',systemMessage:'Ten increases. People may soon start asking for advice. This is their mistake.',series:'WIS Purity',triggerType:'statPurityStreak',statKey:'wis',triggerValue:10,iconAsset:'Achievements/PersonalDevelopment/STAT-WIS-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-WIS-004',category:'personalGrowth',type:'positive',rarity:'Epic',name:'Enlightenment Intensifies',description:'Reach an extreme Wisdom specialisation sequence.',systemMessage:'Twenty-five. Enlightenment appears to be getting out of hand.',series:'WIS Purity',triggerType:'statPurityStreak',statKey:'wis',triggerValue:25,iconAsset:'Achievements/PersonalDevelopment/STAT-WIS-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-WIS-005',category:'personalGrowth',type:'positive',rarity:'Legendary',name:'The System Consults You Now',description:'Reach the Legendary Wisdom purity milestone.',systemMessage:'Fifty consecutive Wisdom increases. The System would like your opinion before proceeding.',series:'WIS Purity',triggerType:'statPurityStreak',statKey:'wis',triggerValue:50,iconAsset:'Achievements/PersonalDevelopment/STAT-WIS-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-CHA-001',category:'personalGrowth',type:'positive',rarity:'Common',name:'People Person',description:'Begin specialising exclusively in Charisma.',systemMessage:'Three Charisma increases. People are beginning to tolerate you professionally.',series:'CHA Purity',triggerType:'statPurityStreak',statKey:'cha',triggerValue:3,iconAsset:'Achievements/PersonalDevelopment/STAT-CHA-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-CHA-002',category:'personalGrowth',type:'positive',rarity:'Uncommon',name:'Smooth Talker',description:'Continue exclusive Charisma development.',systemMessage:'Five increases. You could probably talk your way out of this. Whatever this is.',series:'CHA Purity',triggerType:'statPurityStreak',statKey:'cha',triggerValue:5,iconAsset:'Achievements/PersonalDevelopment/STAT-CHA-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-CHA-003',category:'personalGrowth',type:'positive',rarity:'Rare',name:'Main Character Energy',description:'Reach a ten-increase Charisma purity sequence.',systemMessage:'Ten increases. Supporting characters have begun appearing spontaneously.',series:'CHA Purity',triggerType:'statPurityStreak',statKey:'cha',triggerValue:10,iconAsset:'Achievements/PersonalDevelopment/STAT-CHA-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-CHA-004',category:'personalGrowth',type:'positive',rarity:'Epic',name:'Weaponised Personality',description:'Reach an extreme Charisma specialisation sequence.',systemMessage:'Twenty-five. Personality is now classified as a weapon.',series:'CHA Purity',triggerType:'statPurityStreak',statKey:'cha',triggerValue:25,iconAsset:'Achievements/PersonalDevelopment/STAT-CHA-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-CHA-005',category:'personalGrowth',type:'positive',rarity:'Legendary',name:'Main Character Syndrome',description:'Reach the Legendary Charisma purity milestone.',systemMessage:'Fifty consecutive Charisma increases. Even the character sheet is listening to you.',series:'CHA Purity',triggerType:'statPurityStreak',statKey:'cha',triggerValue:50,iconAsset:'Achievements/PersonalDevelopment/STAT-CHA-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'STAT-META-001',category:'personalGrowth',type:'positive',rarity:'Legendary',name:'Jack of One Trade',description:'Demonstrate obsessive specialisation in every core Base Stat, just never all at once.',systemMessage:'You specialised in everything. Just never at the same time.',series:'Stat Obsession Meta',triggerType:'statPurityAllStats',triggerValue:10,iconAsset:'Achievements/PersonalDevelopment/STAT-META-001.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  // -- App & RPG Meta (23 new) --
  {achievementId:'APP-LOG-001',category:'meta',type:'positive',rarity:'Common',name:'Welcome, Adventurer',description:'Show up for the first time.',systemMessage:'The System has noticed you. This may have been a mistake.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:1,iconAsset:'Achievements/AppMeta/APP-LOG-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-LOG-002',category:'meta',type:'positive',rarity:'Common',name:'Back Again?',description:'Return on three separate days.',systemMessage:'Three visits. Either you like it here or you forgot where the exit is.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:3,iconAsset:'Achievements/AppMeta/APP-LOG-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-LOG-003',category:'meta',type:'positive',rarity:'Uncommon',name:'Regular Customer',description:'Accumulate seven separate login days.',systemMessage:'Seven days logged. The System is beginning to recognize your footsteps.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:7,iconAsset:'Achievements/AppMeta/APP-LOG-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-LOG-004',category:'meta',type:'positive',rarity:'Uncommon',name:'Unlucky for Some',description:'Hit the suspiciously unlucky thirteenth login day.',systemMessage:'Thirteen days. Nothing bad happened. Probably.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:13,iconAsset:'Achievements/AppMeta/APP-LOG-004.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'APP-LOG-005',category:'meta',type:'positive',rarity:'Rare',name:'Part of the Furniture',description:'Accumulate thirty separate login days.',systemMessage:'Thirty visits. You may now legally complain about changes to the furniture.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:30,iconAsset:'Achievements/AppMeta/APP-LOG-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-LOG-006',category:'meta',type:'positive',rarity:'Rare',name:'The Answer Was Logging In',description:'Reach the forty-second unique login day.',systemMessage:'Forty-two days. Apparently this was the answer after all.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:42,iconAsset:'Achievements/AppMeta/APP-LOG-006.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'APP-LOG-007',category:'meta',type:'positive',rarity:'Rare',name:'Nice.',description:'Reach sixty-nine unique login days.',systemMessage:'Nice.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:69,iconAsset:'Achievements/AppMeta/APP-LOG-007.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'APP-LOG-008',category:'meta',type:'positive',rarity:'Epic',name:'The System Knows Your Name',description:'Accumulate one hundred separate login days.',systemMessage:'One hundred days. Pretending this is casual seems dishonest.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:100,iconAsset:'Achievements/AppMeta/APP-LOG-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-LOG-009',category:'meta',type:'positive',rarity:'Epic',name:'Definitely Not a Cult',description:'Reach one hundred and eleven unique login days.',systemMessage:'One hundred and eleven days. The robes are optional. For now.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:111,iconAsset:'Achievements/AppMeta/APP-LOG-009.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'APP-LOG-010',category:'meta',type:'positive',rarity:'Epic',name:'Habit Formed',description:'Accumulate two hundred separate login days.',systemMessage:'Two hundred days. The System no longer considers this temporary behaviour.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:200,iconAsset:'Achievements/AppMeta/APP-LOG-010.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-LOG-011',category:'meta',type:'positive',rarity:'Legendary',name:'Still Here',description:'Accumulate a full year\'s worth of unique login days.',systemMessage:'A full year of showing up. Disturbingly consistent.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:365,iconAsset:'Achievements/AppMeta/APP-LOG-011.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-LOG-012',category:'meta',type:'positive',rarity:'Legendary',name:'User Not Found',description:'Reach four hundred and four unique login days.',systemMessage:'Error 404: sensible life choices not found.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:404,iconAsset:'Achievements/AppMeta/APP-LOG-012.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'APP-LOG-013',category:'meta',type:'positive',rarity:'Legendary',name:'Stockholm Syndrome',description:'Accumulate five hundred separate login days.',systemMessage:'Five hundred days. We are beginning to suspect emotional attachment.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:500,iconAsset:'Achievements/AppMeta/APP-LOG-013.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-LOG-014',category:'meta',type:'positive',rarity:'Legendary',name:'Terms and Conditions Accepted',description:'Reach six hundred and sixty-six unique login days.',systemMessage:'Six hundred and sixty-six days. You definitely should have read the fine print.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:666,iconAsset:'Achievements/AppMeta/APP-LOG-014.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'APP-LOG-015',category:'meta',type:'positive',rarity:'Legendary',name:'Lucky Bastard',description:'Reach seven hundred and seventy-seven unique login days.',systemMessage:'Seven hundred and seventy-seven days. Statistically impressive. Spiritually suspicious.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:777,iconAsset:'Achievements/AppMeta/APP-LOG-015.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'APP-LOG-016',category:'meta',type:'positive',rarity:'Celestial',name:'Persistent Little Bastard',description:'Accumulate one thousand separate login days.',systemMessage:'One thousand days. The System has stopped asking whether you are coming back.',series:'App Login',triggerType:'loginDaysTotal',triggerValue:1000,iconAsset:'Achievements/AppMeta/APP-LOG-016.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-ADV-001',category:'meta',type:'positive',rarity:'Uncommon',name:'Keeping Options Open',description:'Keep active tracking across three different Adventure divisions at once.',systemMessage:'Commitment is apparently a spectrum.',series:'Adventure Tracking',triggerType:'trackedDivisionsCount',triggerValue:3,iconAsset:'Achievements/AppMeta/APP-ADV-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-ADV-002',category:'meta',type:'positive',rarity:'Epic',name:'Too Many Adventures',description:'Maintain something tracked in Campaigns, Expeditions, Journeys, Dungeons, Trials, Hunts and Raids.',systemMessage:'Seven kinds of adventure. One dangerously optimistic calendar.',series:'Adventure Tracking',triggerType:'trackedDivisionsCount',triggerValue:7,iconAsset:'Achievements/AppMeta/APP-ADV-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-ADV-003',category:'meta',type:'positive',rarity:'Common',name:'Double Booked',description:'Use both available tracker slots within a single Adventure division.',systemMessage:'One adventure clearly wasn\'t enough.',series:'Adventure Tracking',triggerType:'trackedDivisionFullCount',triggerValue:1,iconAsset:'Achievements/AppMeta/APP-ADV-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-ADV-004',category:'meta',type:'positive',rarity:'Legendary',name:'I Can Explain',description:'Reach the maximum ecosystem tracking capacity: two tracked activities in each of seven divisions.',systemMessage:'Fourteen tracked adventures. The System would like to discuss your availability.',series:'Adventure Tracking',triggerType:'trackedDivisionFullCount',triggerValue:7,iconAsset:'Achievements/AppMeta/APP-ADV-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-ADV-005',category:'meta',type:'positive',rarity:'Common',name:'Make Room',description:'Try to track another activity when both slots in that division are already occupied.',systemMessage:'The adventure was full. You brought another adventure.',series:'Adventure Tracking',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/AppMeta/APP-ADV-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-XSYS-001',category:'meta',type:'positive',rarity:'Epic',name:'Plans Within Plans',description:'Plan a Training activity using the shared RPG schedule and then complete that same referenced activity.',systemMessage:'You planned the thing, remembered the thing, and actually did the thing. The System was not prepared for this.',series:'Planning + Training',triggerType:'scheduledActivityCompletedEver',triggerValue:null,iconAsset:'Achievements/AppMeta/APP-XSYS-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'APP-XSYS-002',category:'meta',type:'positive',rarity:'Legendary',name:'Life Is the Ultimate RPG',description:'Meaningfully engage with the RPG\'s questing, training and adventure systems within the same rolling week.',systemMessage:'Questing. Training. Adventuring. At some point you appear to have started playing the game properly.',series:'RPG Core Systems',triggerType:'crossSystemWeekEver',triggerValue:null,iconAsset:'Achievements/AppMeta/APP-XSYS-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  // -- Training Sports (16 new) --
  {achievementId:'TRN-TMS-001',category:'training',type:'positive',rarity:'Common',name:'Joined the Party',description:'Complete your first Team Sports session.',systemMessage:'Multiplayer activity detected.',series:'Team Sports — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'TeamSports',triggerValue:1,iconAsset:'Achievements/TrainingSports/TRN-TMS-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-TMS-002',category:'training',type:'positive',rarity:'Common',name:'Team Player',description:'Complete five Team Sports sessions.',systemMessage:'Cooperation has survived five encounters.',series:'Team Sports — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'TeamSports',triggerValue:5,iconAsset:'Achievements/TrainingSports/TRN-TMS-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-TMS-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten on the Team',description:'Complete ten Team Sports sessions.',systemMessage:'Ten sessions. Other humans remain involved.',series:'Team Sports — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'TeamSports',triggerValue:10,iconAsset:'Achievements/TrainingSports/TRN-TMS-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-TMS-004',category:'training',type:'positive',rarity:'Rare',name:'Regular Starter',description:'Complete twenty-five Team Sports sessions.',systemMessage:'Attendance has become predictable.',series:'Team Sports — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'TeamSports',triggerValue:25,iconAsset:'Achievements/TrainingSports/TRN-TMS-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-TMS-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Games In',description:'Complete fifty Team Sports sessions.',systemMessage:'Fifty sessions. The team may now notice when you are missing.',series:'Team Sports — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'TeamSports',triggerValue:50,iconAsset:'Achievements/TrainingSports/TRN-TMS-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-TMS-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Teammate',description:'Complete one hundred Team Sports sessions.',systemMessage:'One hundred sessions of organised cooperation.',series:'Team Sports — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'TeamSports',triggerValue:100,iconAsset:'Achievements/TrainingSports/TRN-TMS-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-TMS-007',category:'training',type:'positive',rarity:'Legendary',name:'Club Veteran',description:'Complete two hundred fifty Team Sports sessions.',systemMessage:'You have become part of the furniture, but faster.',series:'Team Sports — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'TeamSports',triggerValue:250,iconAsset:'Achievements/TrainingSports/TRN-TMS-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-TMS-008',category:'training',type:'positive',rarity:'Celestial',name:'Locker Room Legend',description:'Complete five hundred Team Sports sessions.',systemMessage:'Five hundred sessions. Someone should probably retire your towel.',series:'Team Sports — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'TeamSports',triggerValue:500,iconAsset:'Achievements/TrainingSports/TRN-TMS-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-DAN-001',category:'training',type:'positive',rarity:'Common',name:'Two Left Feet',description:'Complete your first Dancing session.',systemMessage:'Movement detected. Rhythm status pending.',series:'Dancing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Dancing',triggerValue:1,iconAsset:'Achievements/TrainingSports/TRN-DAN-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-DAN-002',category:'training',type:'positive',rarity:'Common',name:'Finding the Beat',description:'Complete five Dancing sessions.',systemMessage:'Rhythm may have been located.',series:'Dancing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Dancing',triggerValue:5,iconAsset:'Achievements/TrainingSports/TRN-DAN-002.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-DAN-003',category:'training',type:'positive',rarity:'Uncommon',name:'Ten Dances Later',description:'Complete ten Dancing sessions.',systemMessage:'Ten sessions. Furniture collision rate is improving.',series:'Dancing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Dancing',triggerValue:10,iconAsset:'Achievements/TrainingSports/TRN-DAN-003.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-DAN-004',category:'training',type:'positive',rarity:'Rare',name:'Rhythm Acquired',description:'Complete twenty-five Dancing sessions.',systemMessage:'Rhythm acquisition confirmed.',series:'Dancing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Dancing',triggerValue:25,iconAsset:'Achievements/TrainingSports/TRN-DAN-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-DAN-005',category:'training',type:'positive',rarity:'Epic',name:'Fifty Floors',description:'Complete fifty Dancing sessions.',systemMessage:'Fifty sessions. The floor knows your name.',series:'Dancing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Dancing',triggerValue:50,iconAsset:'Achievements/TrainingSports/TRN-DAN-005.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-DAN-006',category:'training',type:'positive',rarity:'Legendary',name:'Century Dancer',description:'Complete one hundred Dancing sessions.',systemMessage:'One hundred sessions. Standing still is now suspicious.',series:'Dancing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Dancing',triggerValue:100,iconAsset:'Achievements/TrainingSports/TRN-DAN-006.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-DAN-007',category:'training',type:'positive',rarity:'Legendary',name:'Can\'t Stop the Beat',description:'Complete two hundred fifty Dancing sessions.',systemMessage:'The beat has declined to release you.',series:'Dancing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Dancing',triggerValue:250,iconAsset:'Achievements/TrainingSports/TRN-DAN-007.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'TRN-DAN-008',category:'training',type:'positive',rarity:'Celestial',name:'Dancefloor Immortal',description:'Complete five hundred Dancing sessions.',systemMessage:'Five hundred sessions. The dancefloor has entered your legend.',series:'Dancing — Session Milestones',triggerType:'trainingSessionCount',sessionFamily:'Dancing',triggerValue:500,iconAsset:'Achievements/TrainingSports/TRN-DAN-008.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  // -- Adventure (72 new) --
  {achievementId:'ADV-LF-001',category:'adventure',type:'positive',rarity:'Uncommon',name:'Call Answered',description:'Complete the Walking Adventure for the first time.',systemMessage:'You found the Lost Fortress. Apparently “lost” was more of a suggestion.',series:'Lost Fortress',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-001.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-002',category:'adventure',type:'positive',rarity:'Epic',name:'The Blessed Healer',description:'Choose mercy and successfully heal the wounded Snow Yeti.',systemMessage:'The creature expected pain. You chose mercy. The System remembers.',series:'Snow Yeti',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-002.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-003',category:'adventure',type:'positive',rarity:'Rare',name:'All In',description:'Risk the player\'s entire starting fortune on Quentin’s wager.',systemMessage:'You wagered every coin you started with. Financial planning has left the party.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-003.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-004',category:'adventure',type:'positive',rarity:'Epic',name:'Put Your Money Where Your Boots Are',description:'Beat Quentin to the Pinnacle Spire after accepting his wager.',systemMessage:'You took the wager, won the race, and made Quentin pay for the privilege.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-004.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-005',category:'adventure',type:'positive',rarity:'Uncommon',name:'A Fool and His Gold',description:'Lose Quentin’s wager after betting everything.',systemMessage:'You bet everything. Quentin won. This is what experts call a learning experience.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-005.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-006',category:'adventure',type:'positive',rarity:'Uncommon',name:'Echoes in the Glade',description:'Discover Echo, the Dryad bound to the glade.',systemMessage:'You found someone the world had almost forgotten.',series:'Echo',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-006.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-007',category:'adventure',type:'positive',rarity:'Rare',name:'A Story That Refused to Die',description:'Uncover Echo’s history and open the path to her lost amulet.',systemMessage:'Some stories end. Some wait in the woods until somebody finally listens.',series:'Echo',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-007.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-008',category:'adventure',type:'positive',rarity:'Legendary',name:'Return to Sender',description:'Complete Echo’s connected Treasure Hunt and return the Leaf Amulet.',systemMessage:'After all these years, the Leaf Amulet came home. Echo no longer has to wait alone.',series:'Echo',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-008.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-009',category:'adventure',type:'positive',rarity:'Rare',name:'Nobody Looks Down Here',description:'Find the concealed lookout beneath the crumbled outpost.',systemMessage:'Buried, forgotten and completely missed by everyone less nosy than you.',series:'Crumbled Outpost',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-009.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-010',category:'adventure',type:'positive',rarity:'Rare',name:'Thanks, Quentin.',description:'Turn Quentin’s sabotage into an accidental shortcut.',systemMessage:'Quentin tried to ruin your day. He accidentally found you a shortcut. Excellent work, Quentin.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-010.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-011',category:'adventure',type:'positive',rarity:'Uncommon',name:'One Piece of a Bad Idea',description:'Recover the first fragment of the map hidden around the Pinnacle Spire.',systemMessage:'One fragment found. Three more pieces of poor decision-making remain.',series:'Pinnacle Glade Map',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-011.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-012',category:'adventure',type:'positive',rarity:'Rare',name:'Something Did This',description:'Realize the wounded Yeti was not the real danger.',systemMessage:'The Yeti was not the danger. Whatever hurt it might be.',series:'Snow Yeti',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-012.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-013',category:'adventure',type:'positive',rarity:'Rare',name:'The Door Is the Beginning',description:'Reach the Pinnacle Spire and unlock its Dungeon.',systemMessage:'You reached the fortress. Unfortunately, reaching the door was apparently the easy part.',series:'Pinnacle Spire',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-013.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-014',category:'adventure',type:'positive',rarity:'Epic',name:'Please Do Not Wake It',description:'Discover what the ancient fortress was really containing.',systemMessage:'Something is sleeping beneath the Spire. The recommended strategy is extremely obvious.',series:'Sleeper Beneath the Spire',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-014.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-015',category:'adventure',type:'positive',rarity:'Uncommon',name:'I Knew You Were a Dick',description:'Experience Quentin’s betrayal.',systemMessage:'Quentin betrayed you. The System would like to congratulate absolutely nobody on being surprised.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-015.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-016',category:'adventure',type:'positive',rarity:'Epic',name:'Still Helped Him',description:'Save a rival who has given you every reason not to.',systemMessage:'He was hostile. He was insufferable. You saved him anyway. Irritatingly noble.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-016.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-017',category:'adventure',type:'positive',rarity:'Rare',name:'Professional Courtesy',description:'Win the gate confrontation without killing Quentin.',systemMessage:'You defeated Quentin and let him live. Try not to regret the second part.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-017.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-018',category:'adventure',type:'positive',rarity:'Rare',name:'Well, That Escalated',description:'End the rivalry permanently at the fortress gates.',systemMessage:'The rivalry has been permanently resolved. Very permanently.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-018.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-019',category:'adventure',type:'positive',rarity:'Uncommon',name:'Skill Issue',description:'Lose the definitive confrontation with Quentin.',systemMessage:'Quentin won. The System has reviewed the footage and has no further comment.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-019.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-020',category:'adventure',type:'positive',rarity:'Rare',name:'Catch Me Later',description:'Quentin escapes the gate confrontation into the Dungeon.',systemMessage:'Quentin escaped into the Pinnacle Spire. Because apparently this relationship needed a sequel.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-020.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-021',category:'adventure',type:'positive',rarity:'Uncommon',name:'You Again?',description:'Complete the Adventure twice.',systemMessage:'The Fortress has now seen you twice. At this point it may start charging rent.',series:'Lost Fortress Completion',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-021.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-022',category:'adventure',type:'positive',rarity:'Rare',name:'Scenic Route Enthusiast',description:'Complete the Adventure five times.',systemMessage:'Five trips to the Lost Fortress. You are running out of excuses for calling it lost.',series:'Lost Fortress Completion',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-022.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-023',category:'adventure',type:'positive',rarity:'Epic',name:'Basically Local',description:'Complete the Adventure ten times.',systemMessage:'Ten completions. You probably know this road better than the people who built it.',series:'Lost Fortress Completion',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-023.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-024',category:'adventure',type:'positive',rarity:'Legendary',name:'The Fortress Has a Loyalty Scheme',description:'Complete the Adventure twenty-five times.',systemMessage:'Twenty-five completions. Your complimentary cursed goblet is in the mail.',series:'Lost Fortress Completion',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-024.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-025',category:'adventure',type:'positive',rarity:'Uncommon',name:'The Scenic Route',description:'Take enough detours, mistakes or exploration to travel at least 50 km.',systemMessage:'The Fortress was 45 km away. You have chosen interpretive navigation.',series:'Lost Fortress',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-025.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-026',category:'adventure',type:'positive',rarity:'Rare',name:'Are We There Yet?',description:'Turn a 45 km Campaign into a substantially longer expedition through bad navigation or obsessive exploration.',systemMessage:'At some point this stopped being a route and became a lifestyle choice.',series:'Lost Fortress',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-026.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-027',category:'adventure',type:'positive',rarity:'Rare',name:'Cartography Is Hard',description:'Add five or more kilometres through wrong routes, backtracking and false leads.',systemMessage:'The map was not upside down. You were.',series:'Lost Fortress',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-027.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-028',category:'adventure',type:'positive',rarity:'Rare',name:'Not Falling for That Again',description:'Use knowledge from an earlier run to avoid every false lead already discovered.',systemMessage:'Personal growth detected. Please remain calm.',series:'Lost Fortress',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-028.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-029',category:'adventure',type:'positive',rarity:'Epic',name:'I Know a Shortcut',description:'Stack enough discovered shortcuts to remove five or more kilometres from the route.',systemMessage:'For once, “I know a shortcut” did not end in disaster.',series:'Lost Fortress',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-029.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-030',category:'adventure',type:'positive',rarity:'Legendary',name:'Leave No Stone Unturned',description:'Find every hidden location currently defined for Call to the Lost Fortress.',systemMessage:'You checked under every rock. Some of them would like privacy.',series:'Lost Fortress',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-030.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-031',category:'adventure',type:'positive',rarity:'Epic',name:'Professional Nosy Bastard',description:'Perform the one meaningful Search available at every defined searchable location encountered.',systemMessage:'You searched everything that could reasonably be searched. And several things that objected.',series:'Search the Area',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-031.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-032',category:'adventure',type:'positive',rarity:'Common',name:'Nothing to See Here',description:'Search an area thoroughly and accomplish very little.',systemMessage:'You searched. Technically.',series:'Search the Area',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-032.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-033',category:'adventure',type:'positive',rarity:'Rare',name:'That Shouldn\'t Be Here',description:'Achieve the highest Search quality band.',systemMessage:'You found something the Campaign was hoping you would walk past.',series:'Search the Area',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-033.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-034',category:'adventure',type:'positive',rarity:'Uncommon',name:'Camp Goblin',description:'Use every action offered across all camps in a single run.',systemMessage:'Not one camp action wasted. The itinerary has become sentient.',series:'Camp Actions',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-034.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-035',category:'adventure',type:'positive',rarity:'Rare',name:'Waste Not, Want Not',description:'Complete the Campaign having used every camp action available.',systemMessage:'Every rest stop optimised. Somewhere, a project manager just felt a disturbance.',series:'Camp Actions',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-035.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-036',category:'adventure',type:'positive',rarity:'Rare',name:'Who Needs Preparation?',description:'Ignore five or more opportunities to rest, search, prepare or socialise.',systemMessage:'Preparation is for people who expect consequences.',series:'Camp Actions',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-036.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-037',category:'adventure',type:'positive',rarity:'Common',name:'I Know a Guy',description:'Hire any Campaign guide.',systemMessage:'You hired professional help. Suspiciously sensible.',series:'Guides',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-037.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-038',category:'adventure',type:'positive',rarity:'Uncommon',name:'Worth Every Coin',description:'Receive the strongest standard map/guide route reduction.',systemMessage:'Turns out paying someone who knows where they are going has advantages.',series:'Guides',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-038.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-039',category:'adventure',type:'positive',rarity:'Uncommon',name:'Friends in Low Places',description:'Turn a hired guide into a genuine friend.',systemMessage:'You paid for navigation and accidentally acquired a friend.',series:'Guides',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-039.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-040',category:'adventure',type:'positive',rarity:'Epic',name:'Ride or Die',description:'Earn a guide\'s highest positive disposition.',systemMessage:'They came for the gold. They\'re staying because apparently they actually like you.',series:'Guides',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-040.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-041',category:'adventure',type:'positive',rarity:'Rare',name:'Was It Something I Said?',description:'Make a hired guide actively hostile through player treatment.',systemMessage:'Your hired professional now actively dislikes you. Impressive management.',series:'Guides',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-041.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-042',category:'adventure',type:'positive',rarity:'Epic',name:'Employee Retention Problem',description:'Drive a hired guide far enough away that they leave or oppose you.',systemMessage:'You somehow failed a performance review conducted by your own employee.',series:'Guides',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-042.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-043',category:'adventure',type:'positive',rarity:'Rare',name:'Equal Opportunities Employer',description:'Experience the Campaign with each initial guide.',systemMessage:'Three guides hired. Your adventuring business now technically has a recruitment strategy.',series:'Guides',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-043.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-044',category:'adventure',type:'positive',rarity:'Uncommon',name:'Dryad.exe Has Stopped Responding',description:'Trigger Echo\'s magical enchantment encounter.',systemMessage:'A magical status effect has entered the chat.',series:'Echo',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-044.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-045',category:'adventure',type:'positive',rarity:'Rare',name:'Not Today, Tree Lady',description:'Resist Echo\'s magical influence.',systemMessage:'Magic resisted. Questionable flirting avoided.',series:'Echo',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-045.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-046',category:'adventure',type:'positive',rarity:'Rare',name:'Oh No, She\'s Hot',description:'Succumb to Echo\'s enchantment.',systemMessage:'The saving throw was temporary. The attraction was apparently not.',series:'Echo',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-046.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-047',category:'adventure',type:'positive',rarity:'Epic',name:'Muscles Have Entered the Conversation',description:'Discover Echo\'s hidden Strength-based attraction interaction.',systemMessage:'Apparently Strength was a dialogue option.',series:'Echo',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-047.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-048',category:'adventure',type:'positive',rarity:'Epic',name:'Trust Exercise',description:'Earn Echo\'s highest specified positive relationship state.',systemMessage:'For someone bound to a glade with trust issues, this is considerable progress.',series:'Echo',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-048.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-049',category:'adventure',type:'positive',rarity:'Epic',name:'How Do You Piss Off a Dryad?',description:'Drive Echo to her most negative specified relationship state.',systemMessage:'You found a lonely magical woman trapped in a forest for years and somehow made her hate you. Outstanding.',series:'Echo',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-049.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-050',category:'adventure',type:'positive',rarity:'Uncommon',name:'It\'s More Afraid of You',description:'Recognise that the wounded Yeti is frightened rather than simply aggressive.',systemMessage:'Large, wounded and terrified. Relatable.',series:'Snow Yeti',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-050.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-051',category:'adventure',type:'positive',rarity:'Rare',name:'Easy, Big Guy',description:'Successfully calm the frightened Yeti.',systemMessage:'Several hundred kilos of panic have been successfully de-escalated.',series:'Snow Yeti',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-051.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-052',category:'adventure',type:'positive',rarity:'Rare',name:'Maybe We\'re the Monsters',description:'Understand the Yeti\'s fear and deliberately choose violence anyway.',systemMessage:'You understood the situation perfectly and then made it worse.',series:'Snow Yeti',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-052.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-053',category:'adventure',type:'positive',rarity:'Epic',name:'You Monster',description:'Kill the wounded Yeti despite knowing it is frightened.',systemMessage:'It was wounded. It was frightened. You knew both of these things. The System is judging you.',series:'Snow Yeti',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-053.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-054',category:'adventure',type:'positive',rarity:'Uncommon',name:'Nope.',description:'Choose discretion and avoid the Yeti encounter.',systemMessage:'A tactical withdrawal is still tactical.',series:'Snow Yeti',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-054.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-055',category:'adventure',type:'positive',rarity:'Uncommon',name:'This Is Becoming a Thing',description:'Recover a second permanently registered map fragment.',systemMessage:'Two fragments. This has officially stopped being a coincidence.',series:'Pinnacle Glade Map',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-055.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-056',category:'adventure',type:'positive',rarity:'Rare',name:'Well Now We Have to Finish It',description:'Recover three permanently registered map fragments.',systemMessage:'Three fragments. Walking away now would be psychologically impossible.',series:'Pinnacle Glade Map',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-056.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-057',category:'adventure',type:'positive',rarity:'Epic',name:'X Marks the Poor Decision',description:'Complete the four-part Pinnacle treasure map.',systemMessage:'Four fragments. Congratulations. You have assembled a map telling you where your next problem is.',series:'Pinnacle Glade Map',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-057.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-058',category:'adventure',type:'positive',rarity:'Epic',name:'Treasure Hunter',description:'Turn the completed four-fragment map into a new Treasure Quest.',systemMessage:'Congratulations. The treasure map has successfully generated more work.',series:'Pinnacle Glade Map',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-058.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-059',category:'adventure',type:'positive',rarity:'Uncommon',name:'We\'re Not Friends',description:'Establish Quentin as a proper rival.',systemMessage:'Mutual dislike has matured into a structured relationship.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-059.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-060',category:'adventure',type:'positive',rarity:'Rare',name:'Are We Friends Now?',description:'Develop a genuinely positive relationship with Quentin.',systemMessage:'This was not how the rivalry was supposed to go.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-060.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-061',category:'adventure',type:'positive',rarity:'Epic',name:'Against All Good Judgement',description:'Turn Quentin into an ally.',systemMessage:'Against considerable evidence, you have decided to trust Quentin. Bold.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-061.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-062',category:'adventure',type:'positive',rarity:'Legendary',name:'Character Development',description:'Resolve the canonical Quentin relationship through reconciliation.',systemMessage:'Against considerable evidence, personal experience and basic common sense, you and Quentin worked things out.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-062.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-063',category:'adventure',type:'positive',rarity:'Rare',name:'Know When to Fold \'Em',description:'Force or persuade Quentin to surrender.',systemMessage:'Quentin has discovered the ancient tactical art of knowing when to stop.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-063.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-064',category:'adventure',type:'positive',rarity:'Rare',name:'Eat My Dust',description:'Overtake Quentin during the race.',systemMessage:'Quentin was ahead. Past tense.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-064.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-065',category:'adventure',type:'positive',rarity:'Rare',name:'This Is Awkward',description:'Arrive at the final gate confrontation dead even with Quentin.',systemMessage:'Forty-five kilometres later and neither of you has managed to win the argument.',series:'Lord Quentin',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-065.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-066',category:'adventure',type:'positive',rarity:'Rare',name:'A Different Road',description:'Complete two different Stage-3 routes across Campaign runs.',systemMessage:'A new road, containing an exciting selection of different problems.',series:'Three Roads',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-066.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-067',category:'adventure',type:'positive',rarity:'Epic',name:'All Roads Lead to Trouble',description:'Experience every primary route through Stage 3.',systemMessage:'Three roads explored. Somehow every one of them contained trouble.',series:'Three Roads',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-067.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-068',category:'adventure',type:'positive',rarity:'Uncommon',name:'What If I Do This?',description:'Begin and complete a replay using a previously unlocked Campaign Variant.',systemMessage:'Canon has left the building.',series:'Campaign Variants',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-068.webp',xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null},
  {achievementId:'ADV-LF-069',category:'adventure',type:'positive',rarity:'Epic',name:'Alternate Timeline Enjoyer',description:'Finish five meaningfully distinct replay Variant configurations.',systemMessage:'Five alternate timelines explored. Canon is starting to look nervous.',series:'Campaign Variants',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-069.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-070',category:'adventure',type:'positive',rarity:'Legendary',name:'Loose Ends',description:'Discover every major piece of connected content branching from Call to the Lost Fortress.',systemMessage:'Four loose ends found. Naturally, each one leads somewhere worse.',series:'Lost Fortress',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-070.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-071',category:'adventure',type:'positive',rarity:'Legendary',name:'Nothing Left to Find',description:'Exhaust the Campaign\'s registered hidden discovery structure across canonical play and replays.',systemMessage:'You found everything. Even the things that were hiding for a reason.',series:'Lost Fortress',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-071.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
  {achievementId:'ADV-LF-072',category:'adventure',type:'positive',rarity:'Celestial',name:'The Fortress Remembers',description:'Fully master Call to the Lost Fortress: every required road, secret, mistake, choice and outcome.',systemMessage:'Every road. Every secret. Every mistake. Every choice. There is nothing left for the Fortress to hide from you.',series:'Lost Fortress',triggerType:'pendingDesign',triggerValue:null,iconAsset:'Achievements/Adventure/ADV-LF-072.webp',xpReward:null,lootReward:null,hidden:true,isSecret:true,revealAnimation:null},
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_SHEET_IMPORT_20260918_DEFINITIONS);
/* Hadrian's Wall umbrella (RPG-0087 collections decision, Jay 2026-09-26,
   "option 2"): Aster authored one umbrella collection "Frontier of
   Britannia" with three subsets; Inventory V1's Collection model is flat,
   so the three shipped as top-level collections. Rather than add nesting
   to a shared Lyra-gated model, the umbrella is expressed as ONE
   achievement over all 12 cards via the existing ownership trigger
   (inventoryOwnsAllOf, defined with the 5.3 Hadrian's Wall set on main).
   Rarity/copy provisional pending Nox; ids are the 12 hw_card_* items in
   COLLECTION_DEFINITIONS_BUILTIN (v0.02.36-inventory.js). */
const V023_HADRIANS_WALL_UMBRELLA_DEFINITIONS=[
  {achievementId:'hw_ach_frontier_of_britannia',category:'quest',type:'positive',rarity:'Legendary',name:'Frontier of Britannia',description:'Complete every Hadrian’s Wall collection — the Forts, the Legions and the Infrastructure of the Frontier.',systemMessage:'Every fort, every legion, every stone. The frontier is yours.',series:null,triggerType:'inventoryOwnsAllOf',triggerValue:['hw_card_fort_segedunum','hw_card_fort_chesters','hw_card_fort_housesteads','hw_card_fort_birdoswald','hw_card_legion_ii_augusta','hw_card_legion_vi_victrix','hw_card_legion_xx_valeria_victrix','hw_card_infra_wall','hw_card_infra_milecastle','hw_card_infra_turret','hw_card_infra_vallum','hw_card_infra_bridge'],iconAsset:V023_ACHIEVEMENT_PLACEHOLDER_ICON,xpReward:null,lootReward:null,hidden:false,isSecret:false,revealAnimation:null}
];
V023_ACHIEVEMENT_DEFINITIONS.push(...V023_HADRIANS_WALL_UMBRELLA_DEFINITIONS);
/* every definition is registered by now: flag the retired ones that were pushed after the first pass */
V023_ACHIEVEMENT_DEFINITIONS.forEach(d=>{if(V023_RETIRED_ACHIEVEMENT_IDS.includes(d.achievementId))d.retired=true});
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
const V023_POPUP_BURST_LIMIT=3;let v023BurstAt=0,v023BurstCount=0,v023BurstTimer=null;
function v023UnlockAchievement(def,event){
  if(def&&def.retired)return false;/* retired achievements never unlock again (see V023_RETIRED_ACHIEVEMENT_IDS) */
  const ae=v023EnsureAchievementState();if(v023AchievementUnlocked(def.achievementId))return false;
  /* RPG-0056 audit: newly wired achievements can unlock 40+ at once on the first save after an update (history-derived
     counters). Past a small burst the earned records are kept but the popups are folded into ONE summary toast, so a
     player is not buried in nine-second popups. */
  const nowMs=Date.now();
  if(nowMs-v023BurstAt>4000){v023BurstAt=nowMs;v023BurstCount=0}
  v023BurstCount++;
  const quiet=v023BurstCount>V023_POPUP_BURST_LIMIT;
  if(quiet){clearTimeout(v023BurstTimer);v023BurstTimer=setTimeout(()=>{const n=v023BurstCount-V023_POPUP_BURST_LIMIT;if(n>0&&typeof toast==='function')toast(`${n} more achievement${n===1?'':'s'} earned from your history. See Achievements.`)},1800)}
  const rec={achievementId:def.achievementId,unlockedAt:v023Now(),sourceEventId:/^SLP-(SEX|MAS|HID)-/.test(String(def.achievementId))?null:(event?.eventId||null)};/* privacy (2026-09-25): a hidden-sleep unlock keeps only id + time, never a pointer to the night's event */ae.unlockedAchievements.push(rec);if(!quiet)ae.popupQueue.push({achievementId:def.achievementId,queuedAt:v023Now()});v023ApplyAchievementExtras(def);if(typeof economyOnAchievementUnlocked==='function')economyOnAchievementUnlocked(def);/* Phase A: creates the reward envelope ONCE, never pays (Lyra §8.1) */v023PumpAchievementQueue();return true;
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
  /* Running V1 behaviour/records (RUN-V1-001..008, Vesper 2026-09-22) —
     all derived in v023RebuildRunningV1Counters. trainingRecordImprovedEver
     is generic over def.recordKey (any TRAINING_RECORD_DEFS key) so the
     Gym/Swim "beat your previous X" designs can reuse it verbatim. */
  if(def.triggerType==='runningStructuredTypesCompleted')return (t.runningStructuredTypesCompleted||[]).length>=Number(def.triggerValue||0);
  if(def.triggerType==='trainingRecordImprovedEver')return def.recordActivityType?(t.recordImprovedActivityTypes||[]).includes(def.recordActivityType):(t.recordImprovedKeys||[]).includes(def.recordKey);
  /* Gym & Strength V1 (GYM-V1-002..010, Vesper 2026-09-22) — derived in
     v023RebuildGymV1Counters. */
  if(def.triggerType==='gymUnplannedExtraSetEver')return Boolean(t.gymUnplannedExtraSetEver);
  if(def.triggerType==='copiedSetsCompletedTotal')return Number(t.copiedSetsCompletedTotal||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='strengthRecordsImprovedBySingleWorkout')return Number(t.maxStrengthRecordsImprovedBySingleWorkout||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='workoutTemplateRepeatMax')return Number(t.workoutTemplateRepeatMax||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='strengthFullBodyZoneSessionEver')return Boolean(t.strengthFullBodyZoneSessionEver);
  if(def.triggerType==='strengthLegDayReturnStreak')return Number(t.strengthLegDayReturnStreak||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='strengthRecordZoneCount')return (t.strengthRecordZones||[]).length>=Number(def.triggerValue||0);
  /* Meta / Personal Growth / Productivity / Quest-delay counters (Vesper,
     2026-09-22) — all derived in v023RebuildMetaCounters into
     state.metaCounters; loginDays is the one persisted (not derived)
     value there, appended by v023RecordLoginDay. */
  const mc=state.metaCounters||{};
  if(def.triggerType==='loginDaysTotal')return (mc.loginDays||[]).length>=Number(def.triggerValue||0);
  if(def.triggerType==='statPurityStreak')return Number((mc.statPurityMax||{})[def.statKey]||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='statPurityAllStats')return Object.keys(STAT_NAMES).every(k=>Number((mc.statPurityMax||{})[k]||0)>=Number(def.triggerValue||0));
  if(def.triggerType==='trackedDivisionsCount')return Number(mc.trackedDivisionsCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='trackedDivisionFullCount')return Number(mc.trackedDivisionFullCount||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='scheduledActivityCompletedEver')return Boolean(mc.scheduledActivityCompletedEver);
  if(def.triggerType==='crossSystemWeekEver')return Boolean(mc.crossSystemWeekEver);
  if(def.triggerType==='scheduleReferencesTotal')return Number(mc.scheduleReferencesTotal||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='movedToTomorrowTotal')return Number(mc.movedToTomorrowTotal||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='maxReschedulesSingleItem')return Number(mc.maxReschedulesSingleItem||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='maxScheduledReferencesInWeek')return Number(mc.maxScheduledReferencesInWeek||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='dailyQuestMaxDelaysSingleQuest')return Number(mc.dailyQuestMaxDelaysSingleQuest||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='dailyQuestCompletedAfterDelaysEver')return Number(mc.dailyQuestMaxDelaysBeforeCompletion||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='dailyQuestSameDayRejectEver')return Boolean(mc.dailyQuestSameDayRejectEver);
  if(def.triggerType==='dailyQuestMaxRejectionsSingleDay')return Number(mc.dailyQuestMaxRejectionsSingleDay||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='runningWeeklyDistancePbAcrossWeeksEver')return Boolean(t.runningWeeklyDistancePbAcrossWeeksEver);
  if(def.triggerType==='runningRecordsImprovedBySingleRun')return Number(t.maxRunningRecordsImprovedBySingleRun||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='runningScheduledRunCompletedEver')return Boolean(t.runningScheduledRunCompletedEver);
  if(def.triggerType==='customRunCompletedEver')return Boolean(t.customRunCompletedEver);
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
  if(def.triggerType==='sleepSexReasonCount')return (typeof sleepHiddenCounter==='function'?sleepHiddenCounter('sex'):0)>=Number(def.triggerValue||0);
  if(def.triggerType==='sleepMasReasonCount')return (typeof sleepHiddenCounter==='function'?sleepHiddenCounter('mas'):0)>=Number(def.triggerValue||0);
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
    /* Privacy (2026-09-25, Lyra §7): the free text is never stored, so this
       can no longer re-read it. The match happens once, in memory, when the
       night is saved (sleepHiddenIngest); only "this achievement's phrases
       matched" persists, locally, as opaque progress. */
    return typeof sleepHiddenMatched==='function'&&sleepHiddenMatched(def.achievementId);
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
  if(def.triggerType==='quickQuestCompletedTotal')return (typeof quickQuestCompletedTotal==='function'?quickQuestCompletedTotal():0)>=Number(def.triggerValue||0);
  /* World Tours 5.3 content pack (Hadrian's Wall) -- five new trigger
     types, each a direct, unambiguous read of Aster's own plain-English
     trigger text (no register interpretation call needed, unlike the
     Nox-reviewed register elsewhere): journeyStarted (has this Tour ever
     been started), journeyDiscoveredAllOf (every id in a list has been
     discovered -- covers a single hidden item, or several named ones),
     journeyDistanceReached (totalProgress >= a km value), and two that
     read Inventory V1 state directly since these are ownership-based,
     not Journey-based: inventoryOwnsAllOf, inventoryCollectionComplete. */
  if(def.triggerType==='journeyStarted')return Boolean(state.journeys?.progress?.[def.triggerValue]?.startedAt);
  if(def.triggerType==='journeyDiscoveredAllOf'){
    const items=state.quests?.registry?.[def.tourId]?.discovery?.items||{};
    return (def.triggerValue||[]).every(id=>Boolean(items[id]?.discovered));
  }
  if(def.triggerType==='journeyDistanceReached')return Number(state.journeys?.progress?.[def.tourId]?.totalProgress||0)>=Number(def.triggerValue||0);
  if(def.triggerType==='inventoryOwnsAllOf'){
    const owned=new Set((state.inventory?.ownedItems||[]).map(o=>o.itemDefinitionId));
    return (def.triggerValue||[]).every(id=>owned.has(id));
  }
  if(def.triggerType==='inventoryCollectionComplete'){
    if(typeof collectionProgress!=='function')return false;
    const p=collectionProgress(def.triggerValue);
    return p.total>0&&p.owned>=p.total;
  }
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
  const item=ae.popupQueue.shift(),def=V023_ACHIEVEMENT_DEFINITIONS.find(d=>d.achievementId===item.achievementId);if(!def||def.retired)return v023PumpAchievementQueue();/* a retired achievement queued before its retirement is dropped silently */host.dataset.busy='1';
  const cardModel={name:def.name,description:def.description,rarity:def.rarity,category:achievementCategoryGroup(def),unlocked:true,unlockedAt:new Date().toISOString(),iconAsset:def.iconAsset,systemMessage:def.systemMessage||null};
  const rarityClass=String(def.rarity||'common').toLowerCase().replace(/[^a-z]/g,'')||'common';
  host.innerHTML=`<div class="achievement-popup-backdrop"><article class="achievement-popup rarity-${rarityClass}"><button class="achievement-popup-close" aria-label="Dismiss achievement">×</button>${achievementCardHTML(cardModel,{variant:'popup',kicker:'Achievement unlocked',extraHTML:'<small class="ach-card__note">No reward policy assigned yet.</small>'})}</article></div>`;
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
  let goodCount=0,poorCount=0,targetMetCount=0,targetMetPoorCount=0,missTargetGoodCount=0,exceedTargetPoorCount=0,under75PercentGoodCount=0,over125PercentPoorCount=0,exactTargetOkayCount=0;
  rows.forEach(r=>{
    const quality=r.quality||'',hours=Number(r.hours||0),target=Number(r.targetAtFinalization||0),targetMet=Boolean(r.targetMet);
    /* The sibling counters keep the MEANING their achievements have: "Against All
       Odds" is insufficient quantity, "Quantity Over Quality" / "Long and
       Pointless" are sleeping LONGER than the target. Now that "not met" also means
       "above the range", they must tell the two directions apart: a row judged
       against a range (targetMaxAtFinalization) is "over" only above its max; a row
       finalised before the range existed has no max and behaves exactly as before. */
    const rowMax=Number(r.targetMaxAtFinalization),hasRange=Number.isFinite(rowMax)&&rowMax>=target;
    const over=hasRange?hours>rowMax:hours>target;
    if(quality==='Good')goodCount++;
    if(quality==='Poor')poorCount++;
    if(targetMet)targetMetCount++;
    if(targetMet&&quality==='Poor')targetMetPoorCount++;
    /* insufficient quantity = the night total is BELOW the frozen minimum (read directly,
       never through the generic targetMet flag, which now also means "too long") */
    const below=target>0?hours<target:!targetMet;
    if(below&&quality==='Good')missTargetGoodCount++;
    if(target>0&&over&&quality==='Poor')exceedTargetPoorCount++;
    if(target>0&&hours<target*0.75&&quality==='Good')under75PercentGoodCount++;
    if(target>0&&over&&hours>target*1.25&&quality==='Poor')over125PercentPoorCount++;
    if(target>0&&Number(hours.toFixed(2))===Number(target.toFixed(2))&&quality==='Okay')exactTargetOkayCount++;
  });
  Object.assign(state.sleep,{goodCount,poorCount,targetMetCount,targetMetPoorCount,missTargetGoodCount,exceedTargetPoorCount,under75PercentGoodCount,over125PercentPoorCount,exactTargetOkayCount});
}
/* SLEEP TARGET IS A RANGE (Lyra correction, 2026-09-25). A night is "target
   met" only when its hours fall INSIDE the player's range [min, max] -- a
   10.5 h night is NOT a win against a 7-9 h target just because it exceeds
   the minimum. min is state.profile.sleepTarget (kept equal to the range's
   minimum by Self Care Settings); max comes from Self Care Settings. Ledger
   rows record the max they were judged against (targetMaxAtFinalization).
   Rows finalised BEFORE this correction have no max and keep their original
   meaning (hours >= target): history is never re-judged, so no earned
   achievement counter moves backwards. */
function v023SleepTargetMax(){
  /* Load order: this file runs before the Self Care files, so on the very first
     call of a page load selfCareSettings does not exist yet and the max is null
     (min-only). That stamp is transient: selfCareBoot() saves once in the same
     load, which re-stamps tonight's not-yet-finalised row with the real max. */
  const st=(typeof selfCareSettings==='function')?selfCareSettings().sleep:null;
  const max=st?Number(st.targetMax):NaN;
  return Number.isFinite(max)?max:null;
}
function v023SleepTargetMet(hours,min,max){
  hours=Number(hours);min=Number(min);
  /* a missing, non-numeric or inverted max (max < min) is not a range: fall back
     to the minimum-only rule instead of an impossible window nothing can satisfy */
  const cap=(max==null||max==='')?null:Number(max);
  return hours>=min&&(cap==null||!Number.isFinite(cap)||cap<min||hours<=cap);
}
function v023UpdateSleepFromDaily(){
  if(!state.daily||!state.profile)return null;
  v023EnsureAchievementState();
  const date=todayISO(),target=Math.max(0.1,Number(state.profile.sleepTarget||8)),hours=Math.max(0,Number(state.daily.sleep||0)),quality=v023NormalizeSleepQuality(state.daily.sleepQuality),reasons=(typeof sleepHiddenSanitizeReasons==='function'?sleepHiddenSanitizeReasons(state.daily.sleepReasons):(Array.isArray(state.daily.sleepReasons)?state.daily.sleepReasons.filter(r=>r==='children'||r==='other'):[]));
  /* Privacy (2026-09-25, Lyra §7): no free text and no sensitive reason
     ever enters the ledger row, the event payload or the event id. */
  const row=state.sleep.ledger[date]||{date,finalized:false,source:'daily'};
  if(!row.finalized){const max=v023SleepTargetMax();Object.assign(row,{hours,targetAtFinalization:target,targetMaxAtFinalization:max,targetMet:v023SleepTargetMet(hours,target,max),quality,reasons})}
  state.sleep.ledger[date]=row;
  v023FinalizePriorSleepRows();v023RebuildSleepCounters();
  const eventId=v023StableId('sleepDaily',date,Math.round(hours*60),Math.round(target*60),quality,reasons.join(','));
  const event=v023RecordSharedEvent(v023EventEnvelope('sleepDailyUpdated','home','sleep',{date,hours,target,quality,reasons},eventId));
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
  /* TRN-TMS / TRN-DAN (Vesper, 2026-09-22): TeamSports = the team half of
     WIN_LOSS_SPORTS (Football/Basketball/Volleyball/Rugby — Tennis, Table
     Tennis, Boxing and Martial Arts are individual). 'Dancing' is not an
     ACTIVITY_TYPES value yet, so the family also accepts a type 'Other'
     session whose name says dance (see the rebuild below) — the moment
     Astra adds a real Dancing type it counts here with no further change.
     Both are readings for the register, not register text. */
  TeamSports:['Football','Basketball','Volleyball','Rugby'],
  Dancing:['Dancing'],
  Other:['Other']
};
function v023RebuildTrainingSessionMilestoneCounters(){
  const trn=ensureTrainingState();
  const counts={};
  Object.keys(V023_TRAINING_SESSION_FAMILIES).forEach(k=>counts[k]=0);
  (state.activities||[]).forEach(a=>{
    if(!a||!a.completed)return;
    if(a.type==='Other'&&/\bdanc/i.test(String(a.name||''))){counts.Dancing++;counts.Other++;return}
    for(const key of Object.keys(V023_TRAINING_SESSION_FAMILIES)){
      if(V023_TRAINING_SESSION_FAMILIES[key].includes(a.type)){counts[key]++;break}
    }
  });
  trn.sessionMilestoneCounts=counts;
}
/* Running V1 behaviour + records counters (RUN-V1-001..008 wiring,
   Vesper 2026-09-22). Idempotent recompute from state.activities and
   state.training.records on every save, like every other counter here.
   Structured session types are recognised by the exact (type, name)
   pairs RUNNING_SESSION_TYPES in app.js defines: 'Long Run' and
   'Interval Run' are their own activity types; Easy/Tempo/Recovery/Custom
   are Activity Names under type 'Running'. A renamed run simply doesn't
   match — the name IS the session type in this data model. "Improved"
   means a record entry whose previousValue was beaten in the direction
   TRAINING_RECORD_DEFS says is better (addTrainingRecord only ever
   writes an entry when it beats the prior best, so previousValue!==null
   is the improvement marker). */
function v023RebuildRunningV1Counters(){
  const trn=ensureTrainingState();
  const sessionTypes=(typeof RUNNING_SESSION_TYPES!=='undefined')?RUNNING_SESSION_TYPES:[];
  const structuredLabels=sessionTypes.filter(s=>s.label!=='Custom').map(s=>s.label);
  const labelFor=a=>{const s=sessionTypes.find(s=>s.type===a.type&&(s.type!=='Running'||s.name===a.name));return s?s.label:null};
  const toISO=ms=>{const d=new Date(typeof ms==='number'?ms:(Number.isFinite(Number(ms))?Number(ms):Date.parse(ms)));return isNaN(d)?null:(typeof localISO==='function'?localISO(d):d.toISOString().slice(0,10))};/* createdAt is an ISO string: Number() made it NaN so RUN-V1-007 could never unlock (RPG-0056) */
  const structured=new Set();let customRunCompletedEver=false,runningScheduledRunCompletedEver=false;
  (state.activities||[]).forEach(a=>{
    if(!a||!a.completed||!(a.type==='Running'||a.type==='Long Run'||a.type==='Interval Run'))return;
    const label=labelFor(a);
    if(label==='Custom')customRunCompletedEver=true;
    else if(label&&structuredLabels.includes(label))structured.add(label);
    const created=a.createdAt?toISO(a.createdAt):null;
    if(created&&a.date&&created<a.date)runningScheduledRunCompletedEver=true;
  });
  const defs=(typeof TRAINING_RECORD_DEFS!=='undefined')?TRAINING_RECORD_DEFS:{};
  const improvedKeys=new Set(),byRun={};
  (trn.records||[]).forEach(r=>{
    if(!r||r.previousValue===null||r.previousValue===undefined)return;
    const better=r.better||defs[r.key]?.better||'higher';
    const improved=better==='lower'?Number(r.value)<Number(r.previousValue):Number(r.value)>Number(r.previousValue);
    if(!improved)return;
    improvedKeys.add(r.key);
    if((r.activityType||defs[r.key]?.activityType)==='Running'&&r.activityId){(byRun[r.activityId]||(byRun[r.activityId]=new Set())).add(r.key)}
  });
  const maxRunningRecordsImprovedBySingleRun=Object.values(byRun).reduce((m,s)=>Math.max(m,s.size),0);
  const weekStart=d=>(typeof weekDatesFor==='function')?weekDatesFor(d)[0]:String(d);
  let runningWeeklyDistancePbAcrossWeeksEver=false;
  const weekly=(trn.records||[]).filter(r=>r&&r.key==='weekly_distance'&&r.date);
  weekly.forEach(r=>{
    const ws=weekStart(r.date);
    const priorBest=weekly.filter(o=>weekStart(o.date)<ws).reduce((m,o)=>Math.max(m,Number(o.value||0)),0);
    if(priorBest>0&&Number(r.value)>priorBest)runningWeeklyDistancePbAcrossWeeksEver=true;
  });
  Object.assign(trn,{runningStructuredTypesCompleted:[...structured].sort(),customRunCompletedEver,runningScheduledRunCompletedEver,recordImprovedKeys:[...improvedKeys].sort(),runningWeeklyDistancePbAcrossWeeksEver,maxRunningRecordsImprovedBySingleRun});
}
/* Gym & Strength V1 counters (GYM-V1-002..010 wiring, Vesper 2026-09-22).
   Sessions are completed activities carrying a Strength journal; an
   exercise "counts" in a session once it has a completed non-warmup set.
   Body zones come from the Exercise Library taxonomy (exerciseById ->
   muscles.primary/secondary -> MUSCLE_TO_ZONE); journal rows without a
   resolvable exerciseId (pre-library free-text entries) have no zone and
   are skipped rather than guessed. Record->exercise attribution for the
   zone portfolio goes through the record's own activityId and
   strengthPbKeyForExercise, the same derivation processTrainingCompletion
   used to create it. */
function v023RebuildGymV1Counters(){
  const trn=ensureTrainingState();
  const defs=(typeof TRAINING_RECORD_DEFS!=='undefined')?TRAINING_RECORD_DEFS:{};
  const zoneMap=(typeof MUSCLE_TO_ZONE!=='undefined')?MUSCLE_TO_ZONE:{};
  const allZones=(typeof STRENGTH_BODY_ZONES!=='undefined')?STRENGTH_BODY_ZONES.map(z=>z.id):[];
  const libEx=id=>(id&&typeof exerciseById==='function')?exerciseById(id):null;
  const primaryZone=ex=>{const e=libEx(ex.exerciseId);const tag=e?.muscles?.primary?.[0];return tag?zoneMap[tag]||null:null};
  const allZonesOf=ex=>{const e=libEx(ex.exerciseId);if(!e?.muscles)return [];return [...(e.muscles.primary||[]),...(e.muscles.secondary||[])].map(tag=>zoneMap[tag]).filter(Boolean)};
  const worked=ex=>Array.isArray(ex.sets)&&ex.sets.some(s=>s&&s.completed&&!s.warmup);
  const sessions=(state.activities||[]).filter(a=>a&&a.completed&&a.sportData?.strength&&Array.isArray(a.sportData.strength.exercises)&&a.sportData.strength.exercises.length).sort((a,b)=>String(a.date+(a.time||'')).localeCompare(String(b.date+(b.time||''))));
  const templates=trn.workoutTemplates||[];
  let gymUnplannedExtraSetEver=false,copiedSetsCompletedTotal=0,strengthFullBodyZoneSessionEver=false,strengthLegDayReturnStreak=0,nonLegRun=0;
  const perTemplate={};
  sessions.forEach(a=>{
    const exercises=a.sportData.strength.exercises;
    const tpl=a.workoutTemplateId?templates.find(t=>t.id===a.workoutTemplateId):null;
    if(a.workoutTemplateId)perTemplate[a.workoutTemplateId]=(perTemplate[a.workoutTemplateId]||0)+1;
    const zones=new Set();let legFocus=0,counted=0;
    exercises.forEach(ex=>{
      (ex.sets||[]).forEach(s=>{if(s&&s.copied&&s.completed)copiedSetsCompletedTotal++});
      if(tpl){const te=tpl.exercises.find(t=>t.exerciseId===ex.exerciseId);const done=(ex.sets||[]).filter(s=>s&&s.completed&&!s.warmup).length;if(te&&Number(te.targetSets||0)>0&&done>Number(te.targetSets))gymUnplannedExtraSetEver=true}
      if(!worked(ex))return;
      allZonesOf(ex).forEach(z=>zones.add(z));
      const pz=primaryZone(ex);if(!pz)return;
      counted++;if(pz==='legs'||pz==='glutes')legFocus++;
    });
    if(allZones.length&&allZones.every(z=>zones.has(z)))strengthFullBodyZoneSessionEver=true;
    if(!counted)return;
    if(legFocus===0)nonLegRun++;
    else if(legFocus/counted>=0.5){strengthLegDayReturnStreak=Math.max(strengthLegDayReturnStreak,nonLegRun);nonLegRun=0}
    else nonLegRun=0;
  });
  const workoutTemplateRepeatMax=Object.values(perTemplate).reduce((m,n)=>Math.max(m,n),0);
  const improvedTypes=new Set(),byWorkout={};
  (trn.records||[]).forEach(r=>{
    if(!r||r.previousValue===null||r.previousValue===undefined)return;
    const better=r.better||defs[r.key]?.better||'higher';
    const improved=better==='lower'?Number(r.value)<Number(r.previousValue):Number(r.value)>Number(r.previousValue);
    if(!improved)return;
    const type=r.activityType||defs[r.key]?.activityType||'Other';
    improvedTypes.add(type);
    if(type==='Strength'&&r.activityId)(byWorkout[r.activityId]||(byWorkout[r.activityId]=new Set())).add(r.key);
  });
  const maxStrengthRecordsImprovedBySingleWorkout=Object.values(byWorkout).reduce((m,s)=>Math.max(m,s.size),0);
  const recordZones=new Set();
  if(typeof trainingCurrentRecords==='function'&&typeof strengthPbKeyForExercise==='function'){
    trainingCurrentRecords().filter(r=>(r.activityType||defs[r.key]?.activityType)==='Strength'&&r.activityId).forEach(r=>{
      const a=(state.activities||[]).find(x=>x.id===r.activityId);
      const ex=a?.sportData?.strength?.exercises?.find(e=>strengthPbKeyForExercise(e.name)===r.key);
      const z=ex?primaryZone(ex):null;if(z)recordZones.add(z);
    });
  }
  Object.assign(trn,{recordImprovedActivityTypes:[...improvedTypes].sort(),maxStrengthRecordsImprovedBySingleWorkout,gymUnplannedExtraSetEver,copiedSetsCompletedTotal,workoutTemplateRepeatMax,strengthFullBodyZoneSessionEver,strengthLegDayReturnStreak,strengthRecordZones:[...recordZones].sort()});
}
function v023UpdateTrainingAchievementsFromDaily(){
  v023EnsureAchievementState();v023RebuildTrainingNightCounters();v023RebuildTrainingSessionMilestoneCounters();v023RebuildRunningV1Counters();v023RebuildGymV1Counters();
  const trn=state.training;
  const smc=trn.sessionMilestoneCounts||{};
  const smcExtra=[smc.TeamSports,smc.Dancing];
  const runV1=[...smcExtra,trn.runningStructuredTypesCompleted.join('|'),trn.customRunCompletedEver,trn.runningScheduledRunCompletedEver,trn.recordImprovedKeys.join('|'),trn.runningWeeklyDistancePbAcrossWeeksEver,trn.maxRunningRecordsImprovedBySingleRun];
  const gymV1=[trn.recordImprovedActivityTypes.join('|'),trn.maxStrengthRecordsImprovedBySingleWorkout,trn.gymUnplannedExtraSetEver,trn.copiedSetsCompletedTotal,trn.workoutTemplateRepeatMax,trn.strengthFullBodyZoneSessionEver,trn.strengthLegDayReturnStreak,trn.strengthRecordZones.join('|')];
  const eventId=v023StableId('trainingNightDaily',trn.lateNightRunTotal,trn.midnightRunTotal,trn.midnight5kEver,trn.midnight10kBetween0And4Ever,trn.gymAfterHoursTotal,trn.gymMidnightTotal,trn.walkSingleSession5kEver,trn.walkSingleSession10kEver,trn.longestRunDistanceEver,smc.Running,smc.Cycling,smc.Swimming,smc.Strength,smc.Yoga,smc.MartialArts,smc.Climbing,smc.Other,...runV1,...gymV1);
  const event=v023RecordSharedEvent(v023EventEnvelope('trainingNightAchievementsUpdated','training',null,{lateNightRunTotal:trn.lateNightRunTotal,midnightRunTotal:trn.midnightRunTotal,midnight5kEver:trn.midnight5kEver,midnight10kBetween0And4Ever:trn.midnight10kBetween0And4Ever,gymAfterHoursTotal:trn.gymAfterHoursTotal,gymMidnightTotal:trn.gymMidnightTotal,walkSingleSession5kEver:trn.walkSingleSession5kEver,walkSingleSession10kEver:trn.walkSingleSession10kEver,longestRunDistanceEver:trn.longestRunDistanceEver,sessionMilestoneCounts:smc,runningStructuredTypesCompleted:trn.runningStructuredTypesCompleted,customRunCompletedEver:trn.customRunCompletedEver,runningScheduledRunCompletedEver:trn.runningScheduledRunCompletedEver,recordImprovedKeys:trn.recordImprovedKeys,runningWeeklyDistancePbAcrossWeeksEver:trn.runningWeeklyDistancePbAcrossWeeksEver,maxRunningRecordsImprovedBySingleRun:trn.maxRunningRecordsImprovedBySingleRun,recordImprovedActivityTypes:trn.recordImprovedActivityTypes,maxStrengthRecordsImprovedBySingleWorkout:trn.maxStrengthRecordsImprovedBySingleWorkout,gymUnplannedExtraSetEver:trn.gymUnplannedExtraSetEver,copiedSetsCompletedTotal:trn.copiedSetsCompletedTotal,workoutTemplateRepeatMax:trn.workoutTemplateRepeatMax,strengthFullBodyZoneSessionEver:trn.strengthFullBodyZoneSessionEver,strengthLegDayReturnStreak:trn.strengthLegDayReturnStreak,strengthRecordZones:trn.strengthRecordZones},eventId));
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
/* World Tours 5.3 -- a dedicated fingerprint for Journey-specific
   achievements. v023UpdateQuestAchievementsFromDaily's own fingerprint
   above only tracks state.quests.registry (completion + discovery
   items) -- it never changes when a Journey's totalProgress advances
   without a NEW discovery, or when Inventory ownership changes. Without
   this, journeyDistanceReached/journeyStarted/inventoryOwnsAllOf/
   inventoryCollectionComplete achievements would silently stop being
   re-evaluated once the quest-registry fingerprint stopped moving --
   exactly the "must be added to the eventId hash or the dedupe silently
   skips evaluation" trap this project's own convention already warns
   about (see the Running V1 counters). Evaluating the same full
   definition list again here is safe and by design, same as every
   other category's own Update*FromDaily function -- v023UnlockAchievement
   checks "already unlocked" first, so redundant passes never double-fire. */
function v023UpdateJourneyAchievementsFromDaily(){
  if(typeof state.journeys!=='object'||!state.journeys)return null;
  v023EnsureAchievementState();
  const jp=state.journeys.progress||{};
  const journeyFingerprint=Object.keys(jp).sort().map(id=>{
    const p=jp[id];
    return `${id}:${p.startedAt||0}:${Number(p.totalProgress||0).toFixed(2)}`;
  }).join('|');
  const owned=(state.inventory?.ownedItems||[]).map(o=>o.itemDefinitionId).sort().join(',');
  const eventId=v023StableId('journeysDaily',journeyFingerprint,owned);
  const event=v023RecordSharedEvent(v023EventEnvelope('journeysUpdated','journeys',null,{journeyFingerprint},eventId));
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
/* Quick Quests V1 — same shape as the Main Quest hook above: the counter is
   maintained atomically where a quest completes, so this only fingerprints
   it and hands the shared evaluator the (currently empty) definition list. */
function v023UpdateQuickQuestAchievementsFromDaily(){
  if(typeof quickQuestCompletedTotal!=='function')return null;
  const total=quickQuestCompletedTotal();
  const eventId=v023StableId('quickQuestDaily',String(total));
  const event=v023RecordSharedEvent(v023EventEnvelope('quickQuestUpdated','quick-quest',null,{completedTotal:total},eventId));
  v023EvaluateDefinitions(V023_QUICKQUEST_DEFINITIONS,event);
  return event;
}
/* Meta / Personal Growth / Productivity / Quest-delay counters (Vesper,
   2026-09-22). One rebuild, one fingerprint, one evaluation of the full
   shared registry — the same shape as the training hook. Everything but
   loginDays is recomputed from existing state (statIncreaseLog,
   quests.tracked, activities incl. createdAt/rescheduleLog, questHistory,
   sideQuestHistory, quickQuests, quests.registry.updatedAt). */
function v023RecordLoginDay(){
  state.metaCounters=state.metaCounters&&typeof state.metaCounters==='object'?state.metaCounters:{};
  const mc=state.metaCounters;mc.loginDays=Array.isArray(mc.loginDays)?mc.loginDays:[];
  const d=todayISO();if(!mc.loginDays.includes(d))mc.loginDays.push(d);
}
function v023RebuildMetaCounters(){
  v023RecordLoginDay();
  const mc=state.metaCounters;
  const isoOf=ms=>{const d=new Date(typeof ms==='number'?ms:(Number.isFinite(Number(ms))?Number(ms):Date.parse(ms)));return isNaN(d)?null:(typeof localISO==='function'?localISO(d):d.toISOString().slice(0,10))};/* same ISO-string fix: APP-XSYS-001 could never unlock (RPG-0056) */
  const weekStart=d=>(typeof weekDatesFor==='function')?weekDatesFor(d)[0]:String(d);
  /* Stat purity */
  v023FlushStatIncreases();
  const log=Array.isArray(state.statIncreaseLog)?state.statIncreaseLog:[];
  const runMax={};let run=0,prev=null;
  log.forEach(e=>{
    if(!e||e.x||!e.k){run=0;prev=null;return}
    run=e.k===prev?run+Number(e.n||1):Number(e.n||1);prev=e.k;runMax[e.k]=Math.max(runMax[e.k]||0,run);
  });
  const statPurityMax={...(mc.statPurityMax||{})};
  Object.keys(runMax).forEach(k=>statPurityMax[k]=Math.max(Number(statPurityMax[k]||0),runMax[k]));
  /* Adventure tracking slots */
  const tracked=state.quests?.tracked&&typeof state.quests.tracked==='object'&&!Array.isArray(state.quests.tracked)?state.quests.tracked:{};
  const buckets=Object.values(tracked).map(b=>Array.isArray(b)?b.length:0);
  const trackedDivisionsCount=buckets.filter(n=>n>=1).length,trackedDivisionFullCount=buckets.filter(n=>n>=2).length;
  /* Schedule / Adventurer's Log */
  const acts=state.activities||[],qh=Array.isArray(state.questHistory)?state.questHistory:[];
  let scheduledActivityCompletedEver=false,movedToTomorrowTotal=0,maxReschedulesSingleItem=0;
  const perWeek={};
  acts.forEach(a=>{
    if(!a)return;
    const created=a.createdAt?isoOf(a.createdAt):null;
    if(a.completed&&created&&a.date&&created<a.date)scheduledActivityCompletedEver=true;
    if(a.date){const w=weekStart(a.date);perWeek[w]=(perWeek[w]||0)+1}
    const moves=Array.isArray(a.rescheduleLog)?a.rescheduleLog:[];
    moves.forEach(m=>{if(m&&m.at&&m.to===addDays(m.at,1))movedToTomorrowTotal++});
    maxReschedulesSingleItem=Math.max(maxReschedulesSingleItem,moves.length);
  });
  const delaysByQuest={},cancelsByDay={},createdByQuestDay={};let dailyQuestSameDayRejectEver=false,dailyQuestMaxDelaysBeforeCompletion=0,createdCount=0;
  qh.forEach(e=>{
    if(!e)return;
    if(e.type==='created'){createdCount++;createdByQuestDay[`${e.questId}|${e.date}`]=true;if(e.date){const w=weekStart(e.date);perWeek[w]=(perWeek[w]||0)+1}}
    if(e.type==='delayed'){
      delaysByQuest[e.questId]=(delaysByQuest[e.questId]||0)+1;
      const to=String(e.detail||'').split('->').pop().trim();
      if(e.date&&to===addDays(e.date,1))movedToTomorrowTotal++;
    }
    if(e.type==='completed'||e.type==='completed-early')dailyQuestMaxDelaysBeforeCompletion=Math.max(dailyQuestMaxDelaysBeforeCompletion,delaysByQuest[e.questId]||0);
    if(e.type==='cancelled'){cancelsByDay[e.date]=(cancelsByDay[e.date]||0)+1;if(createdByQuestDay[`${e.questId}|${e.date}`])dailyQuestSameDayRejectEver=true}
  });
  const dailyQuestMaxDelaysSingleQuest=Object.values(delaysByQuest).reduce((m,n)=>Math.max(m,n),0);
  maxReschedulesSingleItem=Math.max(maxReschedulesSingleItem,dailyQuestMaxDelaysSingleQuest);
  const dailyQuestMaxRejectionsSingleDay=Object.values(cancelsByDay).reduce((m,n)=>Math.max(m,n),0);
  const scheduleReferencesTotal=acts.length+createdCount;
  const maxScheduledReferencesInWeek=Object.values(perWeek).reduce((m,n)=>Math.max(m,n),0);
  /* Cross-system rolling week: a quest completion, a completed training
     activity and an Adventure touch (registry updatedAt/completedAt)
     all inside one 7-day window, ever. */
  const questDates=new Set([...qh.filter(e=>e&&(e.type==='completed'||e.type==='completed-early')).map(e=>e.date),...(state.sideQuestHistory||[]).map(x=>x&&x.date),...((state.quickQuests?.items)||[]).filter(x=>x&&x.status==='completed'&&x.completedAt).map(x=>isoOf(x.completedAt))].filter(Boolean));
  const trainDates=new Set(acts.filter(a=>a&&a.completed&&a.date).map(a=>a.date));
  const advDates=new Set(Object.values(state.quests?.registry||{}).flatMap(r=>[r&&r.updatedAt?isoOf(r.updatedAt):null,r&&r.completedAt?isoOf(r.completedAt):null]).filter(Boolean));
  let crossSystemWeekEver=false;
  const within=(set,s)=>{const e=addDays(s,6);return [...set].some(d=>d>=s&&d<=e)};
  new Set([...questDates,...trainDates,...advDates]).forEach(s=>{if(!crossSystemWeekEver&&within(questDates,s)&&within(trainDates,s)&&within(advDates,s))crossSystemWeekEver=true});
  Object.assign(mc,{statPurityMax,trackedDivisionsCount,trackedDivisionFullCount,scheduledActivityCompletedEver,scheduleReferencesTotal,movedToTomorrowTotal,maxReschedulesSingleItem,maxScheduledReferencesInWeek,dailyQuestMaxDelaysSingleQuest,dailyQuestMaxDelaysBeforeCompletion,dailyQuestSameDayRejectEver,dailyQuestMaxRejectionsSingleDay,crossSystemWeekEver});
  return mc;
}
function v023UpdateMetaAchievementsFromDaily(){
  v023EnsureAchievementState();
  const mc=v023RebuildMetaCounters();
  const fingerprint=JSON.stringify({l:mc.loginDays.length,p:mc.statPurityMax,t:[mc.trackedDivisionsCount,mc.trackedDivisionFullCount],s:[mc.scheduledActivityCompletedEver,mc.scheduleReferencesTotal,mc.movedToTomorrowTotal,mc.maxReschedulesSingleItem,mc.maxScheduledReferencesInWeek],q:[mc.dailyQuestMaxDelaysSingleQuest,mc.dailyQuestMaxDelaysBeforeCompletion,mc.dailyQuestSameDayRejectEver,mc.dailyQuestMaxRejectionsSingleDay],x:mc.crossSystemWeekEver});
  const eventId=v023StableId('metaDaily',fingerprint);
  const event=v023RecordSharedEvent(v023EventEnvelope('metaAchievementsUpdated','meta',null,{fingerprint},eventId));
  v023EvaluateDefinitions(V023_ACHIEVEMENT_DEFINITIONS,event);
  return event;
}
/* RPG-0056 audit fix (2026-09-25): every updater runs in its own try/catch and the ORIGINAL save ALWAYS runs. One
   throwing updater (a malformed template, a null registry entry) used to abort the whole save, so nothing was ever
   written to localStorage. A failure is logged once per updater and skipped. */
const v023SaveUpdaters=[v023UpdateHydrationFromDaily,v023UpdateSleepFromDaily,v023UpdateTrainingAchievementsFromDaily,v023UpdateQuestAchievementsFromDaily,v023UpdateJourneyAchievementsFromDaily,v023UpdateDailyQuestFromDaily,v023UpdateMainQuestAchievementsFromDaily,v023UpdateQuickQuestAchievementsFromDaily,v023UpdateMetaAchievementsFromDaily],v023SaveUpdaterFailed={};
save=function(){if(!v023SaveGuard){v023SaveGuard=true;try{v023SaveUpdaters.forEach(fn=>{try{fn()}catch(e){if(!v023SaveUpdaterFailed[fn.name]){v023SaveUpdaterFailed[fn.name]=true;console.warn('achievement updater failed (skipped):',fn.name,e)}}})}finally{v023SaveGuard=false}}return v023OriginalSave()};
achievementsModal=function(){
  v023EnsureState();const ae=v023EnsureAchievementState();const legacy=(state.achievements||[]).map(a=>typeof a==='string'?{id:a,title:a,description:'Legacy achievement record'}:a).filter(Boolean);
  modal(`<h2>Achievements</h2><p class="helper">Positive Hydration is the reusable Achievement-engine pilot. Character stat milestones and Training events are intentionally separate.</p><div class="v023-achievement-list">${V023_ACHIEVEMENT_DEFINITIONS.filter(d=>!d.retired||ae.unlockedAchievements.some(x=>x.achievementId===d.achievementId)).map(def=>{const unlocked=ae.unlockedAchievements.find(x=>x.achievementId===def.achievementId),secret=v023DefinitionHidden(def)&&!unlocked;return `<div class="v023-achievement-row rarity-${def.rarity.toLowerCase()}"><div class="v023-achievement-art">${secret?'<div class="secret-placeholder">?</div>':`<img src="${asset(def.iconAsset)}" alt="${esc(def.name)}">`}</div><div><span class="v023-rarity">${esc(def.rarity.toUpperCase())}</span><h3>${secret?'SECRET ACHIEVEMENT':esc(def.name)}</h3><p>${secret?'Requirement concealed until unlocked.':esc(def.description)}</p></div><span class="tag ${unlocked?'quest':''}">${unlocked?'Unlocked':'Locked'}</span></div>`}).join('')}</div>${legacy.length?`<h3 class="v023-legacy-heading">Legacy History</h3>${legacy.map(a=>`<div class="list-item"><div>🏆</div><div><h3>${esc(a.title||a.id||'Legacy achievement')}</h3><p>${esc(a.description||'Preserved historical record; no replayed reward.')}</p></div><span class="tag quest">Stored</span></div>`).join('')}`:''}`);
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
v023EnsureState();v023UpdateHydrationFromDaily();v023UpdateSleepFromDaily();v023UpdateTrainingAchievementsFromDaily();v023UpdateQuestAchievementsFromDaily();v023UpdateDailyQuestFromDaily();v023UpdateMetaAchievementsFromDaily();v023OriginalSave();
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
/* RPG-0056 audit: popups persisted in the queue but never pumped at boot stayed stranded until the next unlock. */
setTimeout(()=>{try{v023PumpAchievementQueue()}catch(e){}},1500);
const v024PrevRenderHome=renderHome;
renderHome=function(){v024PrevRenderHome();v024ApplyHome()};
if(page==='home')renderHome();
