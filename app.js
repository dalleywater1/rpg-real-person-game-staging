const VERSION='0.1.2.5';
const KEY='rpg_real_person_game';

const localISO=(d=new Date())=>{
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const todayISO=()=>localISO();
const dateFromISO=iso=>{const [y,m,d]=String(iso).split('-').map(Number);return new Date(y,m-1,d,12,0,0)};
const addDays=(iso,n)=>{const d=dateFromISO(iso);d.setDate(d.getDate()+n);return localISO(d)};
/* Native Date.getDay() index (0=Sunday) -> lowercase abbreviation. Used
   by Main Quest Recurring Goals' selectedDays and Weekly Check-ins'
   weekday (Phase 3B.2/3B.3) — declared here, not near its actual
   callers further down the file, because ensureMainQuestShape (called
   from migrate() at script-parse time via `let state=load()` below)
   needs it already assigned. Unlike a `function` declaration, a `const`
   only hoists the binding, not the value — referencing it before this
   line actually runs throws a TDZ ReferenceError, so this can't just
   live next to the code that reads it the way the hoisted `function`
   declarations elsewhere in this file can. A string format, not
   Personal Growth's numeric Monday-based scheduledDays encoding
   (pgScheduledOn) — Main Quest's Recurring Goals are a distinct,
   later-added concept, and the string form is self-documenting where
   PG's numeric one already has years of its own callers depending on
   its exact encoding. */
const WEEKDAY_ABBR=['sun','mon','tue','wed','thu','fri','sat'];
/* Same reasoning as WEEKDAY_ABBR just above — ensureMainQuestShape reads
   this to validate mq.status, and ensureMainQuestShape runs during the
   very first migrate() call (`let state=load()` below) on any save that
   already has real Main Quest records in it, not just from code loaded
   after this file finishes executing. */
const MAIN_QUEST_STATUSES=['draft','active','paused','completed','abandoned'];
const fmtDate=iso=>dateFromISO(iso).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
const fmtShort=iso=>dateFromISO(iso).toLocaleDateString(undefined,{day:'numeric',month:'short'});
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pct=(v,t)=>t>0?clamp(Math.round(Number(v||0)/Number(t)*100),0,100):0;
const uid=()=>Date.now()+Math.floor(Math.random()*10000);

const STAT_NAMES={str:'STR',dex:'DEX',con:'CON',int:'INT',wis:'WIS',cha:'CHA'};
const STAT_LONG={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
const defaultStats=()=>({
  str:{score:10,xp:0},dex:{score:10,xp:0},con:{score:10,xp:0},int:{score:10,xp:0},wis:{score:10,xp:0},cha:{score:10,xp:0}
});
const defaults=()=>({
  version:VERSION,
  /* One-time persisted-state migration gate (Phase 2 Main Quest/Quests/
     Adventures migration, 2026-09-11; extended Phase 3B.1 Main Quest
     Foundation, 2026-09-12) — separate from `version` (app/build
     versioning) so a save-shape migration never gets confused with a
     release number. See migrate()'s dataSchemaVersion<1 and <2 blocks. */
  dataSchemaVersion:2,
  lastDailyDate:todayISO(),
  xp:2340,level:24,gold:12480,
  profile:{
    name:'Player',location:'Horten',lat:59.4172,lon:10.4834,units:'metric',mainGoal:'Build a better real-life character.',birthday:null,
    weight:null,height:null,age:null,metabolicFormula:'manual',activityLevel:'moderate',nutritionGoal:'maintain',
    autoNutrition:false,calTarget:2400,proteinTarget:150,waterTarget:2500,sleepTarget:8,readingTarget:30,mindfulTarget:10,mindfulnessTarget:30,stepsTarget:8000,socialTarget:2,socialMinutesTarget:30,wordLanguage:'no',showRunningConditions:true,
    navDockSlots:['adventurers-log','training','storage','character']
  },
  daily:{water:0,hydrationLog:[],calories:0,protein:0,sleep:0,sleepQuality:'',sleepReasons:[],sleepReasonOtherText:'',sleepMedicationUsed:false,reading:0,mindful:0,mindfulness:0,steps:0,social:0,socialMinutes:0,questDone:false,quoteReroll:0,resourceHigh:{water:0,reading:0,mindful:0,mindfulness:0,social:0,socialMinutes:0}},
  quest:{id:uid(),title:'',description:'',duration:'30–60 min',date:todayISO(),rewardXP:250,rewardGold:75,rewarded:false,completedDate:null,createdAt:Date.now()},
  questHistory:[],
  /* Overall-XP gain log (Player Information popup, 2026-09-11 — "last
     gained Experience" + "where most experience is coming from"). Every
     addOverallXP() award gets one entry here: {date,ts,amount,source,
     category}. Deliberately separate from questHistory/sideQuestHistory
     (which existed before this and cover only their own quest types) --
     this is the first log that covers EVERY source of Level XP in one
     place, including Training/Trial of Wisdom/Daily Challenge, which had
     no history at all before this. See logXpGain() below. */
  xpLog:[],
  /* Hero status effects (buffs/debuffs, 2026-09-11 — freed-rows test
     case). Real status objects, e.g. {id,name,type:'buff'|'debuff',
     xpMultiplier,source,temporary} -- see activeXpMultiplier() and
     heroStatusEffectsHTML() (v0.02.15-home-widget-player-status.js).
     Empty by default for every real save; the "Testing +10% XP" proof
     object is injected into THIS live session's state only, not into
     defaults(), since it's explicitly developer-test-only. */
  statusEffects:[],
  integrity:{mainQuest:{events:[]},general:{events:[]},escalationState:'none',previousClass:null},
  /* Class System foundation (Astra "Safe Overnight Handoff" §3) — an
     expandable eligibility model, not a fixed linear tree. The 8 starter
     classes are pre-existing/always eligible (matches current behavior
     exactly, nothing new equipped or unlocked). unlockedClasses is where
     achievement-driven unlocks land (see grantClassUnlock); hidden
     classes stay invisible until their id appears there. No thresholds
     or unlock conditions are populated here — see CLASS_UNLOCK_EVALUATORS. */
  classSystem:{eligibleClasses:['Novice','Warrior','Scout','Scholar','Artisan','Steward','Diplomat','Adventurer'],unlockedClasses:[],selectedClasses:[],activeClass:'Novice',classAssets:{}},
  /* Adventure campaign state shell (Astra "Safe Overnight Handoff" §2) —
     state preparation only, no Stage 1+ story/encounter logic. Route
     progress is kept strictly separate from total distance travelled per
     the handoff's explicit instruction: actual walking may exceed route
     progress (detours/false leads/navigation), and guides/decisions may
     later shortcut it, so nothing here ever derives one from the other. */
  adventure:{campaigns:{
    'lost-fortress':{
      started:false,startedAt:null,
      routeProgressKm:0,routeTargetKm:42,totalDistanceKm:0,
      currentStage:'not-started',
      activeGuide:null,guideDisposition:0,companions:[],
      rumours:[],routeModifiers:[],activeDetours:[],
      lordQuentinRivalry:{active:false,stage:0},
      pinnacleWager:{active:false,accepted:false,amountGold:100}
    }
  }},
  /* Universal Quest architecture (Lyra -> Astra Quests Hub handoff,
     2026-09-06) — the shared identity/status/tracking/completion/
     discovery layer described by that handoff's §5/§17. Specialist
     gameplay state (e.g. the Adventure campaign's route progress) stays
     in its own existing namespace (state.adventure); this registry only
     stores what's universal: lifetime run count, first-completion, and
     per-item discovery/hint state. Static quest content (title,
     discoverable item names/descriptions) lives in QUEST_DEFINITIONS,
     not here — matches the achievement engine's def/state split. */
  quests:{trackedMax:4,tracked:[],registry:{}},
  /* Daily Quest Minimum (ASTRA Update Package 1, 2026-09-06) — the
     player-configured qualifying count replaces a hardcoded universal
     full-clear requirement. streakResetAt marks the date a confirmed
     minimum change last broke the streak; ledger rows keep their own
     minimumAtFinalization forever so historical qualifying days are
     never silently reinterpreted under a later target (same pattern as
     state.hydration.ledger's targetAtFinalization). */
  dailyQuests:{minimum:3,streakResetAt:null,ledger:{},changeLog:[]},
  /* Main Quest Foundation domain container (Phase 2 scaffold, 2026-09-11;
     corrected shape Phase 3B.1, 2026-09-12) — deliberately a NEW, separate
     namespace from state.quests (Adventures-domain tracking, above),
     state.dailyQuests (streak-qualification/Daily Quest-minimum system,
     above) and state.quest (the existing single Daily Quest — labeled
     "Main Quest" in legacy UI text/internals, which stay untouched; the
     player-facing "Main Quest" name now belongs to THIS system). Only
     mainQuests (the single authoritative instance store — draft through
     completed/abandoned, no separate completed[] array; views filter by
     status) and templates (reusable designs) live here. Side Quests and
     Quick Quests already have their own authoritative storage
     (state.sideQuests/state.sideQuestHistory/QUICK_QUESTS) and never get
     a duplicate copy here merely because the Quests page presents all
     four quest types together. */
  questHub:{mainQuests:[],templates:[]},
  /* Journeys / World Tours (ASTRA Update Package 1 §2-23, 2026-09-06).
     progress is keyed by WORLD_TOUR_DEFINITIONS id, not by slot, so
     pausing/resuming/swapping a Journey between slots never touches its
     stored progress — the slot array only records which tourIds are
     CURRENTLY receiving credit. The mega Journey (megaJourneyId) never
     occupies a slot. Real map provider/library and the final Cape Town
     -> Magadan route/landmark dataset are explicitly out of scope for
     this pass (§36) — its WORLD_TOUR_DEFINITIONS entry ships with
     identity + movement rules only. */
  journeys:{megaJourneyId:'cape-town-magadan',slots:[null,null,null],progress:{},seenAsterIntro:false},
  activities:[],
  tasks:[
    {id:1,text:'Review today’s priorities',done:false,date:todayISO(),bucket:'Today',difficulty:'Easy',priority:true},
    {id:2,text:'Prepare tomorrow’s Main Quest',done:false,date:addDays(todayISO(),1),bucket:'Soon',difficulty:'Normal',priority:false}
  ],
  brainDump:[],
  sideQuests:[],
  sideQuestHistory:[],
  stats:defaultStats(),
  ailments:[],
  weatherCache:null,
  playerStatus:{streak:0,lastQuestDate:null},
  resourceHistory:[],
  totals:{questsCompleted:0,readingMinutes:0,mindfulMinutes:0,socialCheckins:0,waterMl:0},
  achievements:[],
  lootBoxes:{minor:0},
  challengeTracker:{currentStreak:0,bestStreak:0,totalCompleted:0,totalFailed:0,abandoned:0,earlyFailures:0,minorLootBoxesEarned:0,lastCompletedDate:null,history:[]},
  bonusDevelopment:{history:[]},
  personalGrowth:{filter:'all',favoritesOnly:false,trackers:[]},
  training:{selectedConnection:'RPG Manual',records:[],milestones:{},events:[]},
  /* Health Connect integration domain (Health Connect Phase 1 brief,
     2026-09-13, §6) — a dedicated namespace, not raw Health Connect
     records scattered through Movement/Training/Journeys. Per the
     brief's own architecture rule (§2/§4): Movement, Training, Journeys,
     Sleep, Achievements and Main Quests never query Health Connect or
     this state directly — they only ever consume what the resolvers in
     v0.02.27-health-connect-bridge.js derive from it (healthStepsToday(),
     healthDistanceMetersToday(), etc.), so this shape can change later
     without touching those systems' own code.
     records.movement holds BOTH imported Steps readings and imported
     Distance readings as separate entries sharing one array (a Steps
     record's own `steps` field and a Distance record's own
     `distanceMeters` field are never both present on the same entry —
     Health Connect returns them as two independent record streams with
     independent ids/time-windows, not a single paired reading, so this
     mirrors that rather than inventing a merge that could mis-pair
     them; see the resolvers, which sum whichever field is present and
     tolerate the other being absent, per §7's own "not every field must
     exist" instruction). records.exercise is normalized Exercise
     Session metadata only (§8) — deliberately NOT auto-inserted into
     state.activities (Training's real activity list) this phase; see
     healthExerciseToTrainingActivity() for the ready-but-unwired mapping
     (§14/HC1.9: "architecture preparation, not necessarily complete
     Training auto-import... do not auto-create permanent Training
     records until mapping and deduplication are proven"). records.sleep
     is an empty, unused array — architecture-ready per §3's P2 note,
     not activated this phase. */
  health:{
    connection:{provider:'health-connect',status:'disconnected',lastSyncAt:null,lastError:null},
    import:{syncedThroughAt:null},
    records:{movement:[],exercise:[],sleep:[]}
  }
});

function migrate(raw){
  const d=defaults();
  if(!raw||typeof raw!=='object') return d;
  const out={...d,...raw};
  // Visible terminology is current, while old saves remain readable.
  const legacyPG=(raw.personalGrowth&&typeof raw.personalGrowth==='object')?raw.personalGrowth:((raw.tracker&&typeof raw.tracker==='object')?raw.tracker:{});
  out.personalGrowth={...d.personalGrowth,...legacyPG};
  out.personalGrowth.trackers=Array.isArray(legacyPG.trackers)?legacyPG.trackers.map(t=>({...t,entries:(t.entries&&typeof t.entries==='object')?t.entries:{},favorite:Boolean(t.favorite)})):[];
  const legacyTraining=(raw.training&&typeof raw.training==='object')?raw.training:{};
  out.training={...d.training,...legacyTraining};
  out.training.records=Array.isArray(legacyTraining.records)?legacyTraining.records:[];
  out.training.events=Array.isArray(legacyTraining.events)?legacyTraining.events.slice(-100):[];
  out.training.milestones=(legacyTraining.milestones&&typeof legacyTraining.milestones==='object')?legacyTraining.milestones:{};
  /* Health Connect domain (§6) — defensive normalization, same pattern
     as training/personalGrowth above. The `{...d,...raw}` spread already
     backfills the full default shape for any save with no `health` key
     at all (the common case, every save before this phase); this only
     matters for a save whose `health` object exists but is malformed —
     harmless to run unconditionally either way. */
  const legacyHealth=(raw.health&&typeof raw.health==='object')?raw.health:{};
  out.health={...d.health,...legacyHealth};
  out.health.connection={...d.health.connection,...(legacyHealth.connection&&typeof legacyHealth.connection==='object'?legacyHealth.connection:{})};
  out.health.import={...d.health.import,...(legacyHealth.import&&typeof legacyHealth.import==='object'?legacyHealth.import:{})};
  const legacyHealthRecords=(legacyHealth.records&&typeof legacyHealth.records==='object')?legacyHealth.records:{};
  out.health.records={
    movement:Array.isArray(legacyHealthRecords.movement)?legacyHealthRecords.movement:[],
    exercise:Array.isArray(legacyHealthRecords.exercise)?legacyHealthRecords.exercise:[],
    sleep:Array.isArray(legacyHealthRecords.sleep)?legacyHealthRecords.sleep:[]
  };
  if(!raw.rewards&&raw.loot)out.rewards=raw.loot;
  if(!raw.adventurersLog&&raw.journal)out.adventurersLog=raw.journal;
  out.profile={...d.profile,...(raw.profile||{})};
  /* One-time save-shape migration (Phase 2 Main Quest/Quests/Adventures
     migration, 2026-09-11) — rewrites persisted nav-destination ids left
     over from before the route rename. Computed from raw.dataSchemaVersion
     directly (not out.dataSchemaVersion, which the {...d,...raw} spread
     above would have already defaulted to the CURRENT version for an old
     save that simply lacks this field) so an old save genuinely runs the
     rewrite once, while a save already at the current version — or a
     fresh one from defaults() — correctly skips it. */
  out.dataSchemaVersion=Number(raw.dataSchemaVersion||0);
  if(out.dataSchemaVersion<1){
    const NAV_ID_REWRITE={'quest-board':'quests','quests':'adventures'};
    if(Array.isArray(out.profile.navDockSlots)){
      out.profile.navDockSlots=out.profile.navDockSlots.map(id=>NAV_ID_REWRITE[id]||id);
    }
    out.dataSchemaVersion=1;
  }
  /* v2: Main Quest Foundation questHub scaffold correction (Phase 3B.1,
     2026-09-12) — the Phase 2 scaffold's sideQuests/quickQuests/completed
     fields never had a write path anywhere in the app (Side Quests/Quick
     Quests already own their real storage; a separate "completed" array
     would only have duplicated what status:'completed' on a mainQuests
     record already expresses) and are dropped here rather than carried
     forward as dead scaffold. Read from raw.questHub directly, same
     reasoning as the dataSchemaVersion<1 block above: an old save's
     already-empty scaffold gets cleaned up once; a fresh defaults() save
     or an already-v2 save has nothing to drop and skips straight
     through. ensureMainQuestShape/ensureMainQuestTemplateShape are
     `function` declarations defined later in this file (see the Main
     Quest Foundation section, after questPageHTML) — safe to call here
     because top-level function declarations are fully hoisted before
     any script code runs, migrate() included. */
  out.questHub=(raw.questHub&&typeof raw.questHub==='object')?raw.questHub:{mainQuests:[],templates:[]};
  if(out.dataSchemaVersion<2){
    delete out.questHub.sideQuests;
    delete out.questHub.quickQuests;
    delete out.questHub.completed;
    out.dataSchemaVersion=2;
  }
  out.questHub.mainQuests=Array.isArray(out.questHub.mainQuests)?out.questHub.mainQuests.map(ensureMainQuestShape):[];
  out.questHub.templates=Array.isArray(out.questHub.templates)?out.questHub.templates.map(ensureMainQuestTemplateShape):[];
  out.daily={...d.daily,...(raw.daily||{})};
  out.daily.resourceHigh=(raw.daily||{}).resourceHigh?{...d.daily.resourceHigh,...raw.daily.resourceHigh}:{water:Number(out.daily.water||0),reading:Number(out.daily.reading||0),mindful:Number(out.daily.mindful||0),mindfulness:Number(out.daily.mindfulness||0),social:Number(out.daily.social||0),socialMinutes:Number(out.daily.socialMinutes||0)};
  out.quest={...d.quest,...(raw.quest||{})};
  if(['Complete Today’s Main Quest','Complete Main Quest'].includes(String(out.quest.title||'').trim()))out.quest.title='';
  if(!out.quest.id)out.quest.id=uid();
  if(!out.quest.createdAt)out.quest.createdAt=Date.now();
  out.quest.rewarded=Boolean(out.quest.rewarded||(raw.daily||{}).questDone);
  out.quest.completedDate=out.quest.completedDate||(out.quest.rewarded?(raw.lastDailyDate||todayISO()):null);
  out.questHistory=Array.isArray(raw.questHistory)?raw.questHistory:[];
  out.xpLog=Array.isArray(raw.xpLog)?raw.xpLog:[];
  out.statusEffects=Array.isArray(raw.statusEffects)?raw.statusEffects:[];
  out.integrity=(raw.integrity&&typeof raw.integrity==='object')?raw.integrity:{mainQuest:{events:[]}};
  out.integrity.mainQuest=(out.integrity.mainQuest&&typeof out.integrity.mainQuest==='object')?out.integrity.mainQuest:{events:[]};
  out.integrity.mainQuest.events=Array.isArray(out.integrity.mainQuest.events)?out.integrity.mainQuest.events:[];
  out.integrity.general=(out.integrity.general&&typeof out.integrity.general==='object')?out.integrity.general:{events:[]};
  out.integrity.general.events=Array.isArray(out.integrity.general.events)?out.integrity.general.events:[];
  out.integrity.escalationState=out.integrity.escalationState||'none';
  out.integrity.previousClass=out.integrity.previousClass??null;
  out.classSystem={...d.classSystem,...(raw.classSystem||{})};
  out.classSystem.eligibleClasses=Array.isArray(out.classSystem.eligibleClasses)&&out.classSystem.eligibleClasses.length?out.classSystem.eligibleClasses:d.classSystem.eligibleClasses;
  out.classSystem.unlockedClasses=Array.isArray(out.classSystem.unlockedClasses)?out.classSystem.unlockedClasses:[];
  out.classSystem.selectedClasses=Array.isArray(out.classSystem.selectedClasses)?out.classSystem.selectedClasses:[];
  out.classSystem.classAssets=(out.classSystem.classAssets&&typeof out.classSystem.classAssets==='object')?out.classSystem.classAssets:{};
  out.adventure=(raw.adventure&&typeof raw.adventure==='object')?raw.adventure:{campaigns:{}};
  out.adventure.campaigns=(out.adventure.campaigns&&typeof out.adventure.campaigns==='object')?out.adventure.campaigns:{};
  Object.keys(d.adventure.campaigns).forEach(id=>{out.adventure.campaigns[id]={...d.adventure.campaigns[id],...(out.adventure.campaigns[id]||{})}});
  out.quests=(raw.quests&&typeof raw.quests==='object')?raw.quests:{trackedMax:4,tracked:[],registry:{}};
  out.quests.trackedMax=4; /* Adventures Hub handover (2026-09-12): the old 2-slot cap is retired in favour of a fixed 4, overriding any previously-saved value rather than just defaulting one in. */
  out.quests.tracked=Array.isArray(out.quests.tracked)?out.quests.tracked:[];
  out.quests.registry=(out.quests.registry&&typeof out.quests.registry==='object')?out.quests.registry:{};
  out.dailyQuests=(raw.dailyQuests&&typeof raw.dailyQuests==='object')?raw.dailyQuests:{minimum:3,streakResetAt:null,ledger:{},changeLog:[]};
  out.dailyQuests.minimum=Number(out.dailyQuests.minimum||3);
  out.dailyQuests.ledger=(out.dailyQuests.ledger&&typeof out.dailyQuests.ledger==='object')?out.dailyQuests.ledger:{};
  out.dailyQuests.changeLog=Array.isArray(out.dailyQuests.changeLog)?out.dailyQuests.changeLog:[];
  out.journeys=(raw.journeys&&typeof raw.journeys==='object')?raw.journeys:{megaJourneyId:'cape-town-magadan',slots:[null,null,null],progress:{},seenAsterIntro:false};
  out.journeys.megaJourneyId=out.journeys.megaJourneyId||'cape-town-magadan';
  out.journeys.slots=Array.isArray(out.journeys.slots)?out.journeys.slots.slice(0,3):[null,null,null];
  while(out.journeys.slots.length<3)out.journeys.slots.push(null);
  out.journeys.progress=(out.journeys.progress&&typeof out.journeys.progress==='object')?out.journeys.progress:{};
  out.journeys.seenAsterIntro=Boolean(out.journeys.seenAsterIntro);
  out.stats={...d.stats,...(raw.stats||{})};
  for(const k of Object.keys(d.stats)) out.stats[k]={...d.stats[k],...(out.stats[k]||{})};
  out.tasks=Array.isArray(raw.tasks)?raw.tasks.map(t=>({date:todayISO(),bucket:'Today',difficulty:'Normal',priority:false,...t})):d.tasks;
  /* Activity data-model normalization (Training Phase 1 Foundation,
     2026-09-11): canonical shape is {..., completed, sportData:{}} —
     `complete` (no -d) and top-level `strength` were the pre-normalization
     names. Migrated here at load time, once, so every already-saved
     activity in a real user's localStorage keeps working under the new
     names rather than silently losing its completion/strength-journal
     data the next time this runs. */
  out.activities=Array.isArray(raw.activities)?raw.activities.map(a=>{
    const m={duration:0,distance:0,source:'Manual',completed:false,xpAwarded:false,planText:'',startedAt:null,sportData:{},...a};
    if('complete' in m){m.completed=Boolean(m.completed||m.complete);delete m.complete}
    if(!m.sportData||typeof m.sportData!=='object')m.sportData={};
    if(m.strength){if(!m.sportData.strength)m.sportData.strength=m.strength;delete m.strength}
    return m;
  }):[];
  out.sideQuests=Array.isArray(raw.sideQuests)?raw.sideQuests.map(q=>({done:false,xpAwarded:Boolean(q.xpAwarded||q.done),completedDate:q.completedDate||(q.done?(raw.lastDailyDate||todayISO()):null),...q,xpAwarded:Boolean(q.xpAwarded||q.done),completedDate:q.completedDate||(q.done?(raw.lastDailyDate||todayISO()):null)})):[];
  out.sideQuestHistory=Array.isArray(raw.sideQuestHistory)?raw.sideQuestHistory:[];
  out.brainDump=Array.isArray(raw.brainDump)?raw.brainDump:[];
  out.ailments=Array.isArray(raw.ailments)?raw.ailments:[];
  out.playerStatus={...d.playerStatus,...(raw.playerStatus||{})};
  if(!(raw.playerStatus)&&out.quest.rewarded&&out.quest.completedDate){out.playerStatus.streak=1;out.playerStatus.lastQuestDate=out.quest.completedDate}
  out.resourceHistory=Array.isArray(raw.resourceHistory)?raw.resourceHistory:[];
  out.totals={...d.totals,...(raw.totals||{})};
  out.lootBoxes={...d.lootBoxes,...(raw.lootBoxes||{})};
  out.challengeTracker={...d.challengeTracker,...(raw.challengeTracker||{})};out.challengeTracker.history=Array.isArray((raw.challengeTracker||{}).history)?raw.challengeTracker.history:[];
  out.bonusDevelopment={...d.bonusDevelopment,...(raw.bonusDevelopment||{})};out.bonusDevelopment.history=Array.isArray((raw.bonusDevelopment||{}).history)?raw.bonusDevelopment.history:[];
  out.version=VERSION;
  return out;
}
function load(){
  let raw=null;
  try{raw=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
  if(!raw){
    for(const k of ['rpgData','rpg_data','realPersonGame','rpg-v0.01.7']){
      try{const v=JSON.parse(localStorage.getItem(k)||'null');if(v){raw=v;break}}catch(e){}
    }
  }
  return migrate(raw);
}
let state=load();
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function dailyReset(){
  const t=todayISO();
  if(state.lastDailyDate!==t){
    const previousDate=state.lastDailyDate;
    if(previousDate&&state.daily){
      state.resourceHistory=Array.isArray(state.resourceHistory)?state.resourceHistory:[];
      if(!state.resourceHistory.some(x=>x.date===previousDate)){
        state.resourceHistory.push({date:previousDate,water:Number(state.daily.water||0),waterTarget:Number(state.profile?.waterTarget||0),calories:Number(state.daily.calories||0),protein:Number(state.daily.protein||0),sleep:Number(state.daily.sleep||0),reading:Number(state.daily.reading||0),mindful:Number(state.daily.mindful||0),mindfulness:Number(state.daily.mindfulness||0),steps:Number(state.daily.steps||0),social:Number(state.daily.social||0),socialMinutes:Number(state.daily.socialMinutes||0)});
        state.resourceHistory=state.resourceHistory.slice(-90);
      }
    }
    state.lastDailyDate=t;
    state.daily={...defaults().daily};
    /* A completed Main Quest is a closed record, not a repeating daily
       template (Home Baseline Correction, item 22): the old behavior here
       silently reissued the SAME title/reward under a brand new quest id
       once its date passed, which defeated id-keyed duplicate-reward
       protection every single day. Once a quest's scheduled date has
       passed and it was rewarded, the slot goes back to an empty draft —
       the player must deliberately start their next Main Quest. */
    if(state.quest?.rewarded&&state.quest?.completedDate&&String(state.quest.date)<t){
      state.quest={...defaults().quest,id:uid(),date:t,createdAt:Date.now()};
    }
    /* Main Quest Weekly Check-in daily maintenance (Phase 3B.4) — same
       "once per calendar date, on next render after rollover" hook
       every other date-boundary concern in this function already uses;
       see mainQuestDailyCheckInMaintenance's own comment for why this
       is what gives the missed-check-in reminder its "next app open"
       timing rather than a separate boot hook. Safe to call despite
       being defined much further down the file — a `function`
       declaration, hoisted. */
    mainQuestDailyCheckInMaintenance();
    save();
  }
}
dailyReset();

let page='home';
let taskView='week';
let taskFilter='Open';
let randomQuestKey=null;
let homeMainOpen=true;
let homeSideOpen=false;
let homeResourcesOpen=true;
let homeDevelopmentOpen=true;
let focusSeconds=25*60;
let focusRunning=false;
let focusHandle=null;
const view=document.querySelector('#view');
const modalRoot=document.querySelector('#modalRoot');
const toastEl=document.querySelector('#toast');
const asset=n=>`assets/${n}`;

function toast(msg){
  toastEl.textContent=msg;toastEl.classList.add('show');
  clearTimeout(toast._t);toast._t=setTimeout(()=>toastEl.classList.remove('show'),1800);
}
function nextLevelCost(){return 1000+state.level*100}
/* Hero status effects (buffs/debuffs, 2026-09-11 — the freed-rows test
   case Aurelia asked for): real status objects in state.statusEffects,
   not hard-coded Hero markup, so the Hero can just render whatever's
   active. xpMultiplier is the only mechanical effect implemented so
   far (matches the one test case asked for, "Testing +10% XP") --
   other effect types (stat bonuses, etc.) aren't wired to anything yet
   and would need their own application point when they're actually
   needed, not speculatively built now. */
function activeXpMultiplier(){
  const list=Array.isArray(state.statusEffects)?state.statusEffects:[];
  return list.reduce((m,s)=>m*(Number(s.xpMultiplier)||1),1);
}
/* Level-up-ready glow trigger (Hero Stage 2 follow-up, 2026-09-11):
   direct instruction — glow through the last 10% of XP (>=90%,
   computed live from state.xp/nextLevelCost() at render time, see
   v0215HeroExperimentBHTML), flash once when a level-up actually
   fires, then reset. This flag is the flash half: set true the instant
   a level-up happens here, consumed (read once, cleared) by the very
   next Hero render so the flash plays exactly once per level-up, not
   on every subsequent re-render. */
let heroLevelUpFlash=false;
function addOverallXP(amount){
  if(state.level>=300){state.level=300;state.xp=0;return 0}
  const applied=Math.round(Math.max(0,Number(amount||0))*activeXpMultiplier());
  state.xp+=applied;
  while(state.level<300&&state.xp>=nextLevelCost()){
    state.xp-=nextLevelCost();state.level+=1;heroLevelUpFlash=true;toast(`LEVEL UP! You are now Level ${state.level}.`);
  }
  if(state.level>=300){state.level=300;state.xp=0}
  return applied;
}
/* XP source category map (Player Information popup, 2026-09-11) — every
   label ever passed to grantProtectedReward(), verified by reading each
   call site directly rather than guessed: MAIN QUEST COMPLETE (Main
   Quest), SIDE QUEST COMPLETE (completeQuick), TRIAL OF WISDOM (both
   Trial of Wisdom entry points), DAILY CHALLENGE COMPLETE. Training and
   custom side quests don't route through grantProtectedReward, so they
   pass their own category directly to logXpGain() instead of through
   this map. */
const XP_LABEL_CATEGORY={'MAIN QUEST COMPLETE':'Main Quest','SIDE QUEST COMPLETE':'Side Quest','TRIAL OF WISDOM':'Trial of Wisdom','DAILY CHALLENGE COMPLETE':'Daily Challenge'};
function logXpGain(amount,source,category){
  const amt=Number(amount||0);
  if(amt<=0)return;
  state.xpLog=Array.isArray(state.xpLog)?state.xpLog:[];
  state.xpLog.push({date:todayISO(),ts:Date.now(),amount:amt,source:String(source||'Other'),category:String(category||XP_LABEL_CATEGORY[source]||'Other')});
  state.xpLog=state.xpLog.slice(-200);
}
function statCost(score){return 500+Math.max(0,Number(score)-10)*150}
function addStatXP(key,amount){
  if(!state.stats[key]||state.stats[key].score>=300){if(state.stats[key]){state.stats[key].score=300;state.stats[key].xp=0}return}
  state.stats[key].xp+=Math.max(0,Number(amount||0));
  let cost=statCost(state.stats[key].score);
  while(state.stats[key].score<300&&state.stats[key].xp>=cost){
    state.stats[key].xp-=cost;state.stats[key].score+=1;cost=statCost(state.stats[key].score);
  }
  if(state.stats[key].score>=300){state.stats[key].score=300;state.stats[key].xp=0}
}
function modifier(score){const m=Math.floor((Number(score)-10)/2);return m>=0?`+${m}`:`${m}`}
/* Global Navigation — Home V3 configurable dock + transparent wheel
   (Aurelia, Home V3 Global Navigation production handover, 2026-09-10).
   Replaces the single 10-item ring (v0.02.4.10) with a two-tier system:
   a fixed 5-position dock (4 player-configurable shortcuts flanking a
   permanently-centred Home) and an open "wheel" holding whichever 6
   destinations aren't currently assigned to the dock. Storage's label
   stays "Inventory" (id/route unchanged, same allowance as before).
   Phase 2 Main Quest/Quests/Adventures migration (2026-09-11): former
   'quest-board' is now 'quests' (real-life Quests hub), former 'quests'
   is now 'adventures' (RPG Adventure/Journeys/Dungeons hub) — legacy
   aliases for both old ids live in setPage() below.
   This is the same 10-destination pool as the old ring, unchanged —
   only how they're split between "always visible" (dock) and "behind
   one tap" (wheel) is new. */
const RADIAL_NAV_ITEMS=[
  {id:'quests',label:'Quests',route:'quests',icon:'icons/navigation/NAV_QUESTS.png'},
  {id:'training',label:'Training',route:'training',icon:'icons/navigation/NAV_TRAINING.png'},
  {id:'character',label:'Character',route:'character',icon:'icons/navigation/NAV_CHARACTER.png'},
  {id:'library',label:'Library',route:'library',icon:'icons/navigation/NAV_LIBRARY.png'},
  {id:'adventures',label:'Adventures',route:'adventures',icon:'icons/navigation/NAV_ADVENTURES.png'},
  {id:'adventurers-log',label:"Adventurer's Log",dockLabel:'Log',route:'adventurers-log',icon:'icons/navigation/NAV_LOG.png'},
  {id:'personal-growth',label:'Growth',route:'personal-growth',icon:'icons/navigation/NAV_GROWTH.png'},
  {id:'storage',label:'Inventory',route:'storage',icon:'icons/navigation/NAV_INVENTORY.png'},
  {id:'social',label:'Social',route:'social',icon:'icons/navigation/NAV_SOCIAL.png'},
  {id:'rewards',label:'Rewards',route:'rewards',icon:'icons/navigation/NAV_REWARDS.png'}
];
/* Fixed circular sequence used only to order whichever 6 items land on
   the wheel (RADIAL_NAV_ITEMS above stays the canonical id/route/icon
   source) — chosen so the approved default dock assignment
   (adventurers-log/training/storage/character) reproduces the exact
   composition proof order clockwise from top: Quest Board, Rewards,
   Social, Growth, Library, Quests. Filtering a *different* dock
   assignment out of this same sequence still yields a stable, sensible
   order for whatever 6 remain. */
const NAV_WHEEL_ORDER=['quests','adventurers-log','rewards','training','social','character','personal-growth','storage','library','adventures'];
const NAV_DOCK_SLOT_COUNT=4;
const NAV_DOCK_DEFAULT=['adventurers-log','training','storage','character'];
/* Final Integration + Cleanup handover (2026-09-10): the approved
   production medallion family replaces whichever icons were live before
   (including the Home placeholder emoji) — real transparent-canvas art
   at a proper 256px runtime export, not the 1024px masters directly.
   Re-cropped to each icon's own alpha bounding box and re-centred at a
   uniform ~94% fill 2026-09-10 (same date, later pass) so the CSS
   medallion frame could be removed and let the art itself fill the
   slot — see v0.02.4.10-navigation.css. */
const RADIAL_NAV_ASSET_REV='0.01.8.7.6';
const radialNavAsset=n=>`${asset(n)}?v=${RADIAL_NAV_ASSET_REV}`;
function navDockSlotIds(){
  const validIds=new Set(RADIAL_NAV_ITEMS.map(i=>i.id));
  const saved=Array.isArray(state.profile?.navDockSlots)?state.profile.navDockSlots.filter(id=>validIds.has(id)):[];
  const out=[...new Set(saved)].slice(0,NAV_DOCK_SLOT_COUNT);
  for(const id of NAV_DOCK_DEFAULT){
    if(out.length>=NAV_DOCK_SLOT_COUNT)break;
    if(!out.includes(id))out.push(id);
  }
  return out;
}
function navDockItems(){
  const slots=navDockSlotIds();
  return slots.map(id=>RADIAL_NAV_ITEMS.find(i=>i.id===id)).filter(Boolean);
}
function navWheelItems(){
  const dock=new Set(navDockSlotIds());
  return NAV_WHEEL_ORDER.filter(id=>!dock.has(id)).map(id=>RADIAL_NAV_ITEMS.find(i=>i.id===id)).filter(Boolean);
}
/* Assign a destination to dock slot `index` (0-3). If that destination
   is already docked elsewhere, the two slots swap rather than leaving a
   duplicate — "each destination may occupy only one shortcut slot." */
function setNavDockSlot(index,destId){
  if(index<0||index>=NAV_DOCK_SLOT_COUNT)return;
  const validIds=new Set(RADIAL_NAV_ITEMS.map(i=>i.id));
  if(!validIds.has(destId))return;
  const slots=navDockSlotIds();
  const existingIndex=slots.indexOf(destId);
  if(existingIndex===index)return;
  if(existingIndex!==-1){const tmp=slots[index];slots[index]=destId;slots[existingIndex]=tmp}
  else slots[index]=destId;
  state.profile.navDockSlots=slots;
  save();
  if(document.querySelector('.global-radial-nav'))renderGlobalNavigation();
}
function globalNavHost(){
  let host=document.querySelector('.global-radial-nav');
  if(host)return host;
  host=document.createElement('nav');
  host.className='global-radial-nav';
  host.setAttribute('aria-label','Main navigation');
  (document.querySelector('#appShell')||document.body).appendChild(host);
  console.warn('[RPG Navigation] Global navigation host was missing and has been restored.');
  return host;
}
function setRadialNavOpen(open){
  const host=globalNavHost();
  const isOpen=Boolean(open);
  host.classList.toggle('open',isOpen);
  document.body.classList.toggle('radial-nav-open',isOpen);
  const home=host.querySelector('.nav-home-compass');
  if(home){home.setAttribute('aria-expanded',isOpen?'true':'false');home.setAttribute('aria-label',isOpen?'Close navigation and go Home':'Open navigation')}
  host.querySelectorAll('.nav-wheel-item').forEach(b=>b.tabIndex=isOpen&&!b.disabled?0:-1);
}
function renderGlobalNavigation(){
  const host=globalNavHost();
  const dockItems=navDockItems();
  const wheelItems=navWheelItems();
  /* slotIndex 0/1 sit left of Home, 2/3 sit right — side is which half,
     tier is whether it's the inner (adjacent to Home) or outer
     (adjacent to another slot) position. See the CSS's --nav-dock-
     inner-gap/--nav-dock-step for why these need two different
     distances rather than one uniform step (Home is bigger than a
     regular slot and needs more clearance than slot-to-slot spacing
     alone provides — 2026-09-10, fixed a live 97px overlap). */
  const dockSlotHTML=(item,slotIndex)=>{
    const side=slotIndex<2?-1:1,tier=(slotIndex===0||slotIndex===3)?1:0;
    return `<button type="button" class="nav-dock-slot" style="--dock-side:${side};--dock-tier:${tier}" data-page="${item.route}" data-nav-id="${item.id}" aria-label="${esc(item.label)}"><span class="nav-medallion"><img src="${radialNavAsset(item.icon)}" alt=""><span class="radial-icon-fallback" aria-hidden="true">${esc(item.label.charAt(0))}</span></span><small>${esc(item.dockLabel||item.label)}</small></button>`;
  };
  /* Home now uses the approved NAV_HOME production medallion (Final
     Integration + Cleanup handover, 2026-09-10) — replaces the interim
     🧭 placeholder from the Phase A pass. Same img+fallback pattern as
     every other medallion so asset-missing detection still applies.
     Still no <small> caption: "the compass itself represents Home." */
  host.innerHTML=`<button type="button" class="radial-backdrop" aria-label="Close navigation" tabindex="-1"></button>
    <div class="nav-dock-rail" aria-hidden="true">
      <div class="nav-dock-rail-fill" aria-hidden="true"></div>
      <div class="nav-dock-rail-outline" aria-hidden="true"></div>
    </div>
    <div class="nav-dock-rail-optionb" aria-hidden="true">
      <div class="nav-dock-rail-optionb-fill" aria-hidden="true"></div>
      <div class="nav-dock-rail-optionb-outline" aria-hidden="true"></div>
    </div>
    ${dockSlotHTML(dockItems[0],0)}
    ${dockSlotHTML(dockItems[1],1)}
    <button type="button" class="nav-home-compass" aria-label="Open navigation" aria-expanded="false">
      <span class="nav-medallion nav-medallion-home"><img src="${radialNavAsset('icons/navigation/NAV_HOME.png')}" alt=""><span class="radial-icon-fallback" aria-hidden="true">🧭</span></span>
      <small class="nav-home-label-spacer" aria-hidden="true">&nbsp;</small>
    </button>
    ${dockSlotHTML(dockItems[2],2)}
    ${dockSlotHTML(dockItems[3],3)}
    <div class="nav-wheel" aria-hidden="true">
      <div class="nav-wheel-backing" aria-hidden="true"></div>
      <div class="nav-wheel-spokes" aria-hidden="true"></div>
      <div class="nav-wheel-stylized" aria-hidden="true"></div>
      ${wheelItems.map((item,i)=>`<button type="button" class="nav-wheel-item" style="--angle:${i*60}deg" data-page="${item.route}" data-nav-id="${item.id}" tabindex="-1" aria-label="${esc(item.label)}"><span class="nav-medallion"><img src="${radialNavAsset(item.icon)}" alt=""><span class="radial-icon-fallback" aria-hidden="true">${esc(item.label.charAt(0))}</span></span><small>${esc(item.label)}</small></button>`).join('')}
    </div>`;
  host.querySelectorAll('.nav-medallion img').forEach(img=>{
    const markMissing=()=>{const button=img.closest('.nav-dock-slot,.nav-wheel-item,.nav-home-compass');if(!button||button.classList.contains('asset-missing'))return;button.classList.add('asset-missing');console.warn(`[RPG Navigation] Missing icon asset: ${img.getAttribute('src')}`)};
    img.addEventListener('error',markMissing,{once:true});
    if(img.complete&&!img.naturalWidth)markMissing();
  });
  host.onclick=e=>{
    const home=e.target.closest('.nav-home-compass');
    if(home){
      if(host.classList.contains('open')){setRadialNavOpen(false);setPage('home')}
      else setRadialNavOpen(true);
      return;
    }
    if(e.target.closest('.radial-backdrop')){setRadialNavOpen(false);return}
    const dockSlot=e.target.closest('.nav-dock-slot');
    if(dockSlot&&dockSlot.dataset.page){setRadialNavOpen(false);setPage(dockSlot.dataset.page);return}
    const wheelItem=e.target.closest('.nav-wheel-item');
    if(!wheelItem||wheelItem.disabled||!wheelItem.dataset.page)return;
    setRadialNavOpen(false);setPage(wheelItem.dataset.page);
  };
  nav();
}
function setPage(next){
  /* Phase 2 migration (2026-09-11): 'quest-board' and old 'quests' are
     retired page ids — 'quest-board' becomes 'quests' (real-life Quests
     hub), old 'quests' becomes 'adventures' (RPG hub). 'adventure' was
     itself a legacy alias from an earlier rename; it must now resolve to
     BOTH a page (adventures) and a division (campaigns) together, since
     campaigns is a division inside Adventures, not a top-level page —
     handled as a structured {page,division} legacy entry rather than a
     flat string alias. Deliberately no 'quests':'adventures' entry here:
     'quests' is now a legitimate new destination going forward, so any
     old persisted meaning of that string is handled once via the
     dataSchemaVersion-gated migrate() rewrite, not a permanent alias
     that would misinterpret future legitimate 'quests' values. */
  const legacy={tasks:'adventurers-log',sidequests:'quests','quest-board':'quests',journal:'adventurers-log',loot:'rewards',tracker:'personal-growth',adventure:{page:'adventures',division:'campaigns'}};
  const resolved=legacy[next];
  if(resolved&&typeof resolved==='object'){
    next=resolved.page;questsView='division';questsDivisionId=resolved.division;
  }else{
    next=resolved||next;
  }
  const allowed=new Set(['home','adventurers-log','quests','training','character','personal-growth','adventures','rewards','library','social','storage']);
  if(!allowed.has(next))return;
  setRadialNavOpen(false);page=next;document.body.dataset.theme=next;render();scrollTo(0,0)
}
function nav(){
  document.querySelectorAll('.nav-dock-slot,.nav-wheel-item').forEach(b=>b.classList.toggle('active',Boolean(b.dataset.page)&&b.dataset.page===page));
}
function render(){
  dailyReset();if(!document.querySelector('.global-radial-nav .nav-home-compass'))renderGlobalNavigation();nav();document.body.dataset.theme=page;
  const fn={home:renderHome,'adventurers-log':renderTasks,quests:renderSideQuests,training:renderTraining,character:renderCharacter,'personal-growth':renderPersonalGrowth,adventures:renderQuestsArea,rewards:renderRewards,library:renderLibrary,social:renderSocial,storage:renderStorage}[page]||renderHome;
  fn();
}
function pageHeader(title,sub){return `<div class="page-head"><h1 class="pixel-title">${title}</h1><span class="sub">${sub}</span></div><div class="accent-line"></div>`}

function shellCards(items){return `<div class="shell-grid">${items.map(x=>`<section class="rpg-frame minor shell-card"><img src="${asset(x.icon)}" alt=""><div><h2>${esc(x.title)}</h2><span class="shell-status ${x.live?'live':'future'}">${x.live?'CURRENT SYSTEM':'FUTURE SYSTEM'}</span><p class="helper">${esc(x.copy)}</p></div></section>`).join('')}</div>`}
/* ---------- Rewards -> Achievements page (Astra Achievements handoff)
   ----------
   Rewards becomes a page with Overview/Achievements/Rewards/Collection
   sub-navigation. Achievements reads the EXISTING achievement engine
   (V023_ACHIEVEMENT_DEFINITIONS + state.achievementEngine, both owned by
   v0.02.4-integration.js) plus the legacy state.achievements array —
   no second competing registry is created here. This file only adapts
   and presents that data; unlock evaluators/tracker logic stay where
   they are. */
let rewardsTab='overview',achievementsFilter='all',achievementsCategory='All',achievementsDetailId=null,achievementsSeriesView=null;
/* Canonical normal rarity ladder (ASTRA Visual Handoff Master v2 §9):
   Common -> Uncommon -> Rare -> Epic -> Legendary -> Celestial. Demonic
   is an approved SPECIAL frame/tier outside the normal ladder — the
   thematic counterpart/opposite to Celestial — and must only be used
   when explicitly assigned to an achievement, never inferred from a
   negative/comedic/hidden/failure theme. Mythic is NOT part of the
   current canonical system; it is kept here only because one pre-
   existing, already-approved achievement (hydration_ocean_in_mortal_form)
   uses it, and that data is not being altered. Secret is this engine's
   own pre-existing internal reveal-state marker, not a Register rarity. */
const ACHIEVEMENT_RARITY_ORDER=['Common','Uncommon','Rare','Epic','Legendary','Celestial','Demonic','Mythic','Secret'];
const ACHIEVEMENT_CATEGORY_LIST=['All','Training','Resources','Sleep','Quests','Character','Adventure','Social','Meta'];
function dateOnly(iso){return String(iso||'').slice(0,10)}
function achievementCategoryGroup(entry){
  if(entry.category==='hydration')return 'Resources';
  if(entry.category==='sleep')return 'Sleep';
  if(entry.category==='running'||entry.category==='gym'||entry.category==='walking'||entry.category==='training')return 'Training';
  if(entry.category==='quest')return 'Quests';
  if(entry.source==='Training')return 'Training';
  return 'Meta';
}
function achievementProgressFor(def){
  const h=state.hydration||{},t=state.training||{},s=state.sleep||{},dq=state.dailyQuests||{};
  if(def.triggerType==='targetDaysTotal')return {current:Number(h.targetDaysTotal||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='targetStreak')return {current:Number(h.currentTargetStreak||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='over100Total')return {current:Number(h.over100Total||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='over100Streak')return {current:Number(h.over100Streak||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='over200Total')return {current:Number(h.over200Total||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='zeroStreak')return {current:Number(h.zeroStreak||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='maxDailyPercentEver')return {current:Number(h.maxDailyPercentEver||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='manualResetCount')return {current:Number(h.manualResetCount||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='missedTotal')return {current:Number(h.missedTotal||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='missedStreak')return {current:Number(h.missedStreak||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='lateNightRunTotal')return {current:Number(t.lateNightRunTotal||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='midnightRunTotal')return {current:Number(t.midnightRunTotal||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='gymAfterHoursTotal')return {current:Number(t.gymAfterHoursTotal||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='gymMidnightTotal')return {current:Number(t.gymMidnightTotal||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='trainingSessionCount')return {current:Number((t.sessionMilestoneCounts||{})[def.sessionFamily]||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='longestRunDistanceEver')return {current:Number(t.longestRunDistanceEver||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='dailyQuestCumulativeTotal')return {current:Number(dq.cumulativeTotal||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='dailyQuestMaxSingleDay')return {current:Number(dq.maxSingleDayCompletedCount||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='sleepGoodCount')return {current:Number(s.goodCount||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='sleepPoorCount')return {current:Number(s.poorCount||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='sleepTargetMetCount')return {current:Number(s.targetMetCount||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='sleepSexReasonCount')return {current:Number(s.sexReasonCount||0),target:Number(def.triggerValue||0)};
  if(def.triggerType==='sleepMasReasonCount')return {current:Number(s.masReasonCount||0),target:Number(def.triggerValue||0)};
  /* Exact-number, oscillation, recovery-sustained, combination and
     one-shot-event triggers are not naturally expressible as a running
     current/target count — no progress bar for those, matching "do not
     fabricate progress metrics for achievements whose evaluator does
     not currently expose progress." */
  return null;
}
function achievementCatalog(){
  const ae=(typeof v023EnsureAchievementState==='function')?v023EnsureAchievementState():{unlockedAchievements:[]};
  const defs=(typeof V023_ACHIEVEMENT_DEFINITIONS!=='undefined')?V023_ACHIEVEMENT_DEFINITIONS:[];
  const fromRegistry=defs.map(def=>{
    const unlockRec=ae.unlockedAchievements.find(x=>x.achievementId===def.achievementId);
    const hidden=Boolean(def.hidden??def.isSecret);
    return {
      id:def.achievementId,name:def.name,description:def.description,
      rarity:def.rarity,category:achievementCategoryGroup(def),
      hidden,unlocked:Boolean(unlockRec),unlockedAt:unlockRec?unlockRec.unlockedAt:null,
      iconAsset:def.iconAsset,frameAsset:def.frameAsset,
      progress:(!hidden&&!unlockRec)?achievementProgressFor(def):null,
      classUnlocker:Boolean(def.classUnlocker),unlocksClass:def.unlocksClass||null,
      series:def.series||null,systemMessage:def.systemMessage||null,
      source:'registry'
    };
  });
  const legacy=(Array.isArray(state.achievements)?state.achievements:[]).filter(a=>a&&typeof a==='object').map(a=>({
    id:String(a.id),name:a.title||String(a.id),description:a.description||'Unlocked from a shared RPG milestone event.',
    rarity:'Common',category:achievementCategoryGroup(a),
    hidden:false,unlocked:true,unlockedAt:a.unlockedDate||null,
    iconAsset:null,frameAsset:null,progress:null,
    classUnlocker:false,unlocksClass:null,series:null,systemMessage:null,
    source:'legacy'
  }));
  return [...fromRegistry,...legacy];
}
/* The set a player is allowed to know exists: revealed (unlocked) items
   plus every non-hidden definition, locked or not. Truly hidden+locked
   entries never enter this list — that's what keeps the collection from
   being used to count undiscovered secrets. */
function achievementVisibleCatalog(){return achievementCatalog().filter(a=>!a.hidden||a.unlocked)}
function achievementsHeaderStatsHTML(){
  const catalog=achievementCatalog(),unlockedCount=catalog.filter(a=>a.unlocked).length;
  const known=achievementVisibleCatalog(),knownUnlocked=known.filter(a=>a.unlocked).length;
  const pct=known.length?Math.round(knownUnlocked/known.length*100):0;
  return `<div class="ach-header-stats"><span>${unlockedCount} Unlocked</span><span>${pct}% Known Collection Complete</span></div>`;
}
function achievementsFilterCatalog(){
  const visible=achievementVisibleCatalog();
  let filtered=visible;
  if(achievementsFilter==='recent')filtered=visible.filter(a=>a.unlocked).sort((a,b)=>String(b.unlockedAt||'').localeCompare(String(a.unlockedAt||'')));
  else if(achievementsFilter==='hidden')filtered=visible.filter(a=>a.hidden);
  if(achievementsCategory!=='All')filtered=filtered.filter(a=>a.category===achievementsCategory);
  return filtered;
}
function achievementTileHTML(a){
  if(a.unlocked){
    return `<button type="button" class="ach-tile ach-tile-unlocked rarity-${String(a.rarity||'common').toLowerCase()}" data-ach-id="${esc(a.id)}" aria-label="${esc(a.name)} — open details">
      <div class="ach-tile-badge">${a.iconAsset?`<img src="${asset(a.iconAsset)}" alt="">`:'<div class="ach-tile-badge-fallback">🏆</div>'}</div>
      <div class="ach-tile-name">${esc(a.name)}</div>
      <div class="ach-tile-rarity">${esc(a.rarity||'')}</div>
      <div class="ach-tile-date">${a.unlockedAt?`Unlocked ${fmtShort(dateOnly(a.unlockedAt))}`:'Unlocked'}</div>
    </button>`;
  }
  return `<button type="button" class="ach-tile ach-tile-locked" data-ach-id="${esc(a.id)}" aria-label="Locked achievement — open details">
    <div class="ach-tile-badge ach-tile-badge-locked">???</div>
    <div class="ach-tile-name">???</div>
    ${a.rarity?`<div class="ach-tile-rarity">${esc(a.rarity)}</div>`:''}
  </button>`;
}
function achievementFeaturedHTML(){
  const latest=achievementCatalog().filter(a=>a.unlocked).sort((a,b)=>String(b.unlockedAt||'').localeCompare(String(a.unlockedAt||'')))[0];
  if(!latest)return `<section class="rpg-frame standard ach-featured ach-featured-empty"><p class="helper">No achievement unlocked yet. Your first one will be featured here.</p></section>`;
  return `<section class="rpg-frame primary ach-featured">
    <div class="ach-featured-badge rarity-${String(latest.rarity||'common').toLowerCase()}">${latest.iconAsset?`<img src="${asset(latest.iconAsset)}" alt="">`:'<div class="ach-tile-badge-fallback">🏆</div>'}</div>
    <div class="ach-featured-copy">
      <span class="ach-featured-kicker">LATEST ACHIEVEMENT</span>
      <h2>${esc(latest.name)}</h2>
      ${latest.systemMessage?`<p class="ach-detail-tagline">“${esc(latest.systemMessage)}”</p>`:''}
      <span class="ach-featured-rarity">${esc(latest.rarity||'')}</span>
      <p class="helper">${esc(latest.description)}</p>
      <small>${latest.unlockedAt?`Unlocked ${fmtShort(dateOnly(latest.unlockedAt))}`:''}</small>
      <button type="button" class="text-btn accent" data-ach-id="${esc(latest.id)}">View Details</button>
    </div>
  </section>`;
}
function achievementDetailHTML(a){
  const reveal=a.unlocked;
  return `<button type="button" class="text-btn ach-back" id="achBackBtn">← Back to Achievements</button>
    <section class="rpg-frame primary ach-detail-panel">
      <div class="ach-detail-badge rarity-${String(a.rarity||'common').toLowerCase()}">${reveal&&a.iconAsset?`<img src="${asset(a.iconAsset)}" alt="">`:(reveal?'<div class="ach-tile-badge-fallback">🏆</div>':'<div class="ach-tile-badge-locked">???</div>')}</div>
      <h2>${reveal?esc(a.name):'???'}</h2>
      ${reveal&&a.systemMessage?`<p class="ach-detail-tagline">“${esc(a.systemMessage)}”</p>`:''}
      ${a.rarity?`<span class="ach-detail-rarity">${esc(a.rarity)}</span>`:''}
      <span class="ach-detail-status ${reveal?'unlocked':'locked'}">${reveal?'Unlocked':'Locked'}</span>
      ${reveal?`<p class="ach-detail-desc">${esc(a.description)}</p>`:''}
      ${reveal&&a.unlockedAt?`<div class="ach-detail-row"><span>Unlock date</span><b>${fmtShort(dateOnly(a.unlockedAt))}</b></div>`:''}
      <div class="ach-detail-row"><span>Category</span><b>${esc(a.category)}</b></div>
      ${a.series?`<div class="ach-detail-row"><span>Series</span><b>${esc(a.series)}</b></div>`:''}
      ${!reveal&&a.progress&&a.progress.target?`<div class="ach-detail-progress"><span>Progress: ${a.progress.current} / ${a.progress.target}</span><div class="character-stat-progress"><i style="--p:${pct(a.progress.current,a.progress.target)}"></i></div></div>`:''}
      ${reveal&&a.classUnlocker&&a.unlocksClass?`<div class="ach-class-marker">◆ CLASS UNLOCK<b>${esc(Array.isArray(a.unlocksClass)?a.unlocksClass.join(', '):a.unlocksClass)}</b></div>`:''}
      ${a.series?`<button type="button" class="text-btn accent ach-view-series" data-ach-series="${esc(a.series)}">View Series</button>`:''}
    </section>`;
}
/* Series view (Achievements handoff §8). Only ever lists achievements
   already in achievementVisibleCatalog() — a truly hidden, not-yet-
   unlocked entry never gets a slot here, matching the grid's own rule
   ("do not expose future hidden achievements merely because they share
   a series"). Ordered by rarity as the closest available progression
   signal; no explicit series-order field exists in the data. */
function achievementSeriesMembers(seriesName){
  return achievementVisibleCatalog().filter(a=>a.series===seriesName)
    .sort((a,b)=>ACHIEVEMENT_RARITY_ORDER.indexOf(a.rarity)-ACHIEVEMENT_RARITY_ORDER.indexOf(b.rarity));
}
function achievementSeriesHTML(seriesName){
  const members=achievementSeriesMembers(seriesName);
  return `<button type="button" class="text-btn ach-back" id="achBackFromSeries">← Back to Achievements</button>
    <section class="rpg-frame primary ach-series-panel">
      <h2>${esc(seriesName)}</h2>
      <div class="ach-series-list">${members.map(m=>`<button type="button" class="ach-series-row" data-ach-id="${esc(m.id)}"><span class="ach-series-status">${m.unlocked?'✓':'🔒'}</span><span class="ach-series-name">${m.unlocked?esc(m.name):'???'}</span><span class="ach-series-rarity">${esc(m.rarity||'')}</span></button>`).join('')||'<p class="helper">No visible entries in this series yet.</p>'}</div>
    </section>`;
}
function achievementsTabHTML(){
  if(achievementsSeriesView)return achievementSeriesHTML(achievementsSeriesView);
  if(achievementsDetailId){
    const a=achievementCatalog().find(x=>x.id===achievementsDetailId&&(!x.hidden||x.unlocked));
    if(a)return achievementDetailHTML(a);
    achievementsDetailId=null;
  }
  const filterBtn=(key,label)=>`<button type="button" class="ach-filter-chip ${achievementsFilter===key?'active':''}" data-ach-filter="${key}">${label}</button>`;
  const catBtn=cat=>`<button type="button" class="ach-category ${achievementsCategory===cat?'active':''}" data-ach-category="${esc(cat)}">${esc(cat)}</button>`;
  const tiles=achievementsFilterCatalog();
  return `${achievementsHeaderStatsHTML()}
    <div class="ach-filter-row">${filterBtn('all','All')}${filterBtn('recent','Recent')}${filterBtn('hidden','Hidden')}</div>
    ${achievementFeaturedHTML()}
    <div class="ach-categories">${ACHIEVEMENT_CATEGORY_LIST.map(catBtn).join('')}</div>
    <div class="ach-grid">${tiles.length?tiles.map(achievementTileHTML).join(''):'<p class="helper ach-empty">Nothing here yet.</p>'}</div>`;
}
function rewardsSubNavHTML(){
  const tabs=[['overview','Overview'],['achievements','Achievements'],['rewards','Rewards'],['collection','Collection']];
  return `<nav class="rewards-subnav" aria-label="Rewards sections">${tabs.map(([key,label])=>`<button type="button" class="rewards-subnav-btn ${rewardsTab===key?'active':''}" data-rewards-tab="${key}">${label}</button>`).join('')}</nav>`;
}
function rewardsOverviewHTML(){
  const minor=Math.max(0,Number(state.lootBoxes?.minor||0));
  return `<section class="rpg-frame primary loot-overview"><div class="loot-overview-icon"><img src="${asset('UI/nav_loot.png')}" alt="Loot Boxes"></div><div><span class="loot-kicker">MINOR LOOT BOXES</span><b class="loot-count">${minor}</b><p class="helper">Existing earned rewards remain safely stored. Opening and drop-table mechanics are a future system.</p></div></section>${shellCards([{title:'Achievements',icon:'UI/nav_achievements.png',live:true,copy:'View the achievement progress already tracked by your character.'},{title:'Loot Boxes',icon:'UI/nav_loot.png',live:true,copy:'Your current loot-box inventory is preserved above; opening mechanics arrive later.'}])}<div class="shell-actions"><button class="rpg-btn accent" id="rewardsAchievements">View Achievements</button></div>`;
}
function rewardsStubHTML(title,copy){return shellCards([{title,icon:'UI/nav_loot.png',copy}])}
function renderRewards(){
  const body=rewardsTab==='achievements'?achievementsTabHTML()
    :rewardsTab==='rewards'?rewardsStubHTML('Rewards','Equipment, cosmetics, titles and other unlockable rewards are reserved for a future system.')
    :rewardsTab==='collection'?rewardsStubHTML('Collection','A collectibles/badge showcase is reserved for a future system.')
    :rewardsOverviewHTML();
  view.innerHTML=`${pageHeader('Rewards','Achievements & Loot')}${rewardsSubNavHTML()}<div class="rewards-tab-body">${body}</div>`;
  bindRewardsPage();
}
function bindRewardsPage(){
  document.querySelectorAll('[data-rewards-tab]').forEach(b=>b.onclick=()=>{rewardsTab=b.dataset.rewardsTab;achievementsDetailId=null;achievementsSeriesView=null;renderRewards()});
  const openAch=document.querySelector('#rewardsAchievements');if(openAch)openAch.onclick=()=>{rewardsTab='achievements';renderRewards()};
  document.querySelectorAll('[data-ach-filter]').forEach(b=>b.onclick=()=>{achievementsFilter=b.dataset.achFilter;renderRewards()});
  document.querySelectorAll('[data-ach-category]').forEach(b=>b.onclick=()=>{achievementsCategory=b.dataset.achCategory;renderRewards()});
  document.querySelectorAll('[data-ach-id]').forEach(b=>b.onclick=()=>{achievementsSeriesView=null;achievementsDetailId=b.dataset.achId;renderRewards()});
  document.querySelectorAll('[data-ach-series]').forEach(b=>b.onclick=()=>{achievementsSeriesView=b.dataset.achSeries;renderRewards()});
  const back=document.querySelector('#achBackBtn');if(back)back.onclick=()=>{achievementsDetailId=null;renderRewards()};
  const backSeries=document.querySelector('#achBackFromSeries');if(backSeries)backSeries.onclick=()=>{achievementsSeriesView=null;renderRewards()};
}
const PERSONAL_GROWTH_CATEGORIES={
  wellbeing:{label:'Wellbeing',icon:'✦'},learning:{label:'Learning',icon:'▤'},hobbies:{label:'Hobbies',icon:'✣'},
  personalCare:{label:'Personal Care',icon:'◈'},homeRoutine:{label:'Home & Routine',icon:'⌂'},social:{label:'Social',icon:'♢'},personalGoals:{label:'Personal Goals',icon:'◎'}
};
const PERSONAL_GROWTH_PRESETS={
  wellbeing:[['Meditation','duration',10,'min'],['Journaling','completion',1,'entry'],['Gratitude','completion',1,'entry'],['Outdoor Time','duration',20,'min']],
  learning:[['Reading','duration',30,'min'],['Study','duration',30,'min'],['Language Practice','duration',15,'min'],['Skill Practice','duration',20,'min']],
  hobbies:[['Painting','duration',30,'min'],['Guitar / Music Practice','duration',20,'min'],['Miniature Painting','duration',30,'min'],['Gardening','duration',30,'min'],['Gaming','duration',60,'min'],['Crafting','duration',30,'min']],
  personalCare:[['Flossing','completion',1,'done'],['Skincare','completion',1,'done'],['Supplements','completion',1,'done'],['Medication','completion',1,'done']],
  homeRoutine:[['Tidy Room','duration',15,'min'],['Declutter','duration',15,'min'],['Laundry','completion',1,'done'],['Dishes','completion',1,'done'],['Morning Routine','completion',1,'done'],['Evening Routine','completion',1,'done']],
  social:[['Call a Friend','completion',1,'check-in'],['Contact Family','completion',1,'check-in'],['Quality Time','duration',30,'min'],['Social Activity','completion',1,'activity']],
  personalGoals:[['No-Spend Day','completion',1,'day'],['Screen-Free Time','duration',60,'min'],['Personal Challenge','completion',1,'done'],['Custom Goal','progress',100,'%']]
};
function ensurePersonalGrowth(){
  state.personalGrowth=state.personalGrowth&&typeof state.personalGrowth==='object'?state.personalGrowth:{filter:'all',favoritesOnly:false,trackers:[]};
  state.personalGrowth.trackers=Array.isArray(state.personalGrowth.trackers)?state.personalGrowth.trackers:[];
  return state.personalGrowth;
}
function pgWeekDays(){const d=dateFromISO(todayISO()),dow=(d.getDay()+6)%7;const monday=new Date(d);monday.setDate(d.getDate()-dow);return Array.from({length:7},(_,i)=>{const x=new Date(monday);x.setDate(monday.getDate()+i);return localISO(x)})}
function pgScheduledOn(t,iso){if(t.frequency==='selected'){const dow=(dateFromISO(iso).getDay()+6)%7;return Array.isArray(t.scheduledDays)?t.scheduledDays.includes(dow):true}return true}
function pgEntryComplete(t,iso){const v=t.entries?.[iso];if(v==null)return false;if(t.method==='completion')return Boolean(v);return Number(v)>0}
function pgTrackerStats(t){
  const dates=Object.keys(t.entries||{}).sort();let total=0,current=0,best=0,run=0;
  dates.forEach(d=>{if(pgEntryComplete(t,d)){total++;run++;best=Math.max(best,run)}else run=0});
  for(let d=todayISO(),i=0;i<366;i++,d=addDays(d,-1)){if(!pgScheduledOn(t,d))continue;if(pgEntryComplete(t,d))current++;else break}
  return {current,best,total};
}
function pgValueLabel(t,iso=todayISO()){
  const v=t.entries?.[iso];if(t.method==='completion')return pgEntryComplete(t,iso)?'Completed':'Tap to log';
  if(v==null)return t.goal?`0 / ${t.goal} ${t.unit||''}`:'Tap to log';
  return t.goal?`${v} / ${t.goal} ${t.unit||''}`:`${v} ${t.unit||''}`;
}
function pgCategoryButton(key,c,active){return `<button class="pg-filter ${active?'active':''}" data-pg-filter="${key}" aria-pressed="${active}"><span>${c.icon}</span><small>${esc(c.label)}</small></button>`}
function pgTrackerCard(t){
  const cat=PERSONAL_GROWTH_CATEGORIES[t.category]||PERSONAL_GROWTH_CATEGORIES.personalGoals,week=pgWeekDays(),stats=pgTrackerStats(t);
  const orbs=week.map((d,i)=>{const scheduled=pgScheduledOn(t,d),done=pgEntryComplete(t,d);return `<button class="pg-orb ${done?'filled':''} ${scheduled?'':'inactive'}" data-pg-orb="${t.id}" data-date="${d}" ${scheduled?'':'disabled'} aria-label="${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i]} ${done?'logged':'not logged'}"></button>`}).join('');
  return `<article class="pg-card pg-cat-${t.category} ${t.favorite?'favorite':''}" data-pg-id="${t.id}"><div class="pg-card-icon" aria-hidden="true">${cat.icon}</div><div class="pg-card-main"><div class="pg-card-title-row"><div><h2>${esc(t.name)}</h2><p>${esc(pgValueLabel(t))}</p></div><button class="pg-favorite" data-pg-favorite="${t.id}" aria-label="${t.favorite?'Remove from favorites':'Add to favorites'}" aria-pressed="${Boolean(t.favorite)}">★</button></div><div class="pg-week-labels"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div><div class="pg-orbs">${orbs}</div><div class="pg-records"><span>Streak <b>${stats.current}</b></span><span>Best <b>${stats.best}</b></span><span>Total <b>${stats.total}</b></span></div></div></article>`;
}
function renderPersonalGrowth(){
  const pg=ensurePersonalGrowth(),filter=pg.filter||'all';
  const filtered=pg.trackers.filter(t=>(filter==='all'||t.category===filter)&&(!pg.favoritesOnly||t.favorite));
  const filterRow=`<div class="pg-filters" aria-label="Personal Growth categories"><button class="pg-filter ${filter==='all'&&!pg.favoritesOnly?'active':''}" data-pg-filter="all"><span>✧</span><small>All</small></button>${Object.entries(PERSONAL_GROWTH_CATEGORIES).map(([k,c])=>pgCategoryButton(k,c,filter===k&&!pg.favoritesOnly)).join('')}<button class="pg-filter pg-favorites-filter ${pg.favoritesOnly?'active':''}" id="pgFavoritesFilter" aria-pressed="${Boolean(pg.favoritesOnly)}"><span>★</span><small>Favorites</small></button></div>`;
  const cards=filtered.length?filtered.map(pgTrackerCard).join(''):`<section class="pg-empty"><h2>${pg.trackers.length?'No trackers match this filter':'Begin your Personal Growth'}</h2><p>${pg.trackers.length?'Choose another category or turn off Favorites.':'Add a habit, hobby, routine or personal goal to begin tracking.'}</p></section>`;
  view.innerHTML=`${pageHeader('Personal Growth','Habits · Hobbies · Personal Records')}<section class="personal-growth-page">${filterRow}<div class="pg-list">${cards}</div><button class="pg-add-tracker" id="pgAddTracker">+ ADD TRACKER <span>⌄</span></button></section>`;
  document.querySelectorAll('[data-pg-filter]').forEach(b=>b.onclick=()=>{pg.filter=b.dataset.pgFilter;pg.favoritesOnly=false;save();renderPersonalGrowth()});
  const ff=document.querySelector('#pgFavoritesFilter');if(ff)ff.onclick=()=>{pg.favoritesOnly=!pg.favoritesOnly;save();renderPersonalGrowth()};
  document.querySelectorAll('[data-pg-favorite]').forEach(b=>b.onclick=e=>{e.stopPropagation();const t=pg.trackers.find(x=>String(x.id)===b.dataset.pgFavorite);if(t){t.favorite=!t.favorite;save();renderPersonalGrowth()}});
  document.querySelectorAll('[data-pg-orb]').forEach(b=>b.onclick=()=>pgLogTracker(b.dataset.pgOrb,b.dataset.date));
  document.querySelector('#pgAddTracker').onclick=pgAddTrackerModal;
}
function pgCreateTracker({name,category='personalGoals',method='completion',goal=1,unit='',frequency='daily',scheduledDays=[0,1,2,3,4,5,6]}){
  const pg=ensurePersonalGrowth();pg.trackers.push({id:uid(),name:String(name||'New Tracker').trim()||'New Tracker',category,method,goal:Number(goal||0),unit:String(unit||''),frequency,scheduledDays:Array.isArray(scheduledDays)?scheduledDays:[0,1,2,3,4,5,6],favorite:false,entries:{},createdAt:todayISO()});save();
}
function pgLogTracker(id,date){
  const pg=ensurePersonalGrowth(),t=pg.trackers.find(x=>String(x.id)===String(id));if(!t)return;
  t.entries=t.entries||{};
  if(t.method==='completion'){t.entries[date]=!Boolean(t.entries[date]);save();renderPersonalGrowth();return}
  const existing=t.entries[date]??'';
  modal(`<h2>Log ${esc(t.name)}</h2><p class="helper">${esc(PERSONAL_GROWTH_CATEGORIES[t.category]?.label||'Personal Growth')} · ${esc(date)}</p><label class="field"><span>Value${t.unit?` (${esc(t.unit)})`:''}</span><input id="pgLogValue" type="number" min="0" step="any" value="${esc(existing)}" inputmode="decimal"></label><button class="rpg-btn accent" id="pgSaveLog" style="width:100%">Save Entry</button>`);
  modalRoot.querySelector('#pgSaveLog').onclick=()=>{const v=Number(modalRoot.querySelector('#pgLogValue').value);if(!Number.isFinite(v)||v<0){toast('Enter a valid value.');return}t.entries[date]=v;save();closeModal();renderPersonalGrowth()};
}
function pgAddTrackerModal(){
  const groups=Object.entries(PERSONAL_GROWTH_PRESETS).map(([key,items])=>`<section class="pg-preset-group"><h3>${esc(PERSONAL_GROWTH_CATEGORIES[key].label)}</h3>${items.map((x,i)=>`<button class="pg-preset-item" data-pg-preset="${key}:${i}"><span>${esc(x[0])}</span><small>${esc(x[1])}</small><b>+</b></button>`).join('')}</section>`).join('');
  modal(`<h2>Add Tracker</h2><p class="helper">Choose a premade tracker or create your own. Trackers use shared category artwork rather than one icon per activity.</p><div class="pg-preset-scroll">${groups}</div><button class="rpg-btn accent" id="pgAddCustom" style="width:100%">+ ADD YOUR OWN</button>`);
  modalRoot.querySelectorAll('[data-pg-preset]').forEach(b=>b.onclick=()=>{const [cat,idx]=b.dataset.pgPreset.split(':'),x=PERSONAL_GROWTH_PRESETS[cat][Number(idx)];pgCreateTracker({name:x[0],category:cat,method:x[1],goal:x[2],unit:x[3]});closeModal();renderPersonalGrowth();toast(`${x[0]} added.`)});
  modalRoot.querySelector('#pgAddCustom').onclick=pgCustomTrackerModal;
}
function pgCustomTrackerModal(){
  const cats=Object.entries(PERSONAL_GROWTH_CATEGORIES).map(([k,c])=>`<option value="${k}">${esc(c.label)}</option>`).join('');
  modal(`<h2>Add Your Own</h2><div class="pg-custom-form"><label class="field"><span>Name</span><input id="pgCustomName" maxlength="60" placeholder="My tracker"></label><label class="field"><span>Category</span><select id="pgCustomCategory">${cats}</select></label><label class="field"><span>Tracking method</span><select id="pgCustomMethod"><option value="completion">Completion / yes-no</option><option value="number">Number</option><option value="quantity">Quantity</option><option value="duration">Duration</option><option value="rating">Rating</option><option value="progress">Progress toward goal</option></select></label><div class="pg-form-row"><label class="field"><span>Goal / value</span><input id="pgCustomGoal" type="number" min="0" step="any" value="1"></label><label class="field"><span>Unit</span><input id="pgCustomUnit" maxlength="16" placeholder="min, pages, etc"></label></div><label class="field"><span>Frequency</span><select id="pgCustomFrequency"><option value="daily">Daily</option><option value="selected">Selected days</option><option value="weekly">Weekly target</option><option value="monthly">Monthly target</option><option value="none">No schedule</option></select></label><fieldset class="pg-day-selector"><legend>Scheduled days</legend>${['M','T','W','T','F','S','S'].map((d,i)=>`<label><input type="checkbox" data-pg-day="${i}" checked><span>${d}</span></label>`).join('')}</fieldset><button class="rpg-btn accent" id="pgCreateCustom" style="width:100%">Create Tracker</button></div>`);
  modalRoot.querySelector('#pgCreateCustom').onclick=()=>{const name=modalRoot.querySelector('#pgCustomName').value.trim();if(!name){toast('Tracker name is required.');return}const days=[...modalRoot.querySelectorAll('[data-pg-day]:checked')].map(x=>Number(x.dataset.pgDay));pgCreateTracker({name,category:modalRoot.querySelector('#pgCustomCategory').value,method:modalRoot.querySelector('#pgCustomMethod').value,goal:Number(modalRoot.querySelector('#pgCustomGoal').value||0),unit:modalRoot.querySelector('#pgCustomUnit').value.trim(),frequency:modalRoot.querySelector('#pgCustomFrequency').value,scheduledDays:days});closeModal();renderPersonalGrowth();toast(`${name} added.`)};
}
/* Adventure — Call to the Lost Fortress specialist campaign data (Astra
   "Safe Overnight Handoff" §2, unchanged). This is the Adventure
   division's own gameplay layer — route/stage/guide/rumour state. The
   Quests Hub below treats it as one specialist system among six via the
   universal QUEST_DEFINITIONS registry; it never reaches into these
   fields directly except through questProgressFor/questStartOrContinue/
   questReplay. */
const CAMPAIGNS={
  'lost-fortress':{
    id:'lost-fortress',title:'Call to the Lost Fortress',type:'Walking Campaign',
    banner:'Adventure/lost_fortress_campaign_banner_v1.png',
    intro:'Strange magical treasures have begun appearing in a remote mountain village. Adventurers whisper that their source lies somewhere in the northern mountains, at a fortress thought lost to history:',
    introHighlight:'The Pinnacle Spire.'
  }
};
function ensureAdventureState(){
  state.adventure=state.adventure&&typeof state.adventure==='object'?state.adventure:{campaigns:{}};
  state.adventure.campaigns=state.adventure.campaigns&&typeof state.adventure.campaigns==='object'?state.adventure.campaigns:{};
  Object.keys(CAMPAIGNS).forEach(id=>{
    if(!state.adventure.campaigns[id])state.adventure.campaigns[id]=structuredClone?structuredClone(defaults().adventure.campaigns[id]):JSON.parse(JSON.stringify(defaults().adventure.campaigns[id]));
  });
  return state.adventure.campaigns;
}

/* ---------- Quests Hub — universal quest architecture ----------
   Lyra -> Astra handoff (2026-09-06). Six divisions, one shared quest
   shell/progress/tracking/discovery/completion layer, specialist
   gameplay left to each division's own system (only Adventure has one
   today — CAMPAIGNS above). Functionality/architecture only; artwork is
   Vesper's to supply later (per the handoff's own explicit scope). */
/* Division icon/background art (Orin/Seraphine "Adventures Handover
   Package", 2026-09-12) — division emblems + environmental background
   illustrations. Order/grouping/taglines below follow the "ASTRA
   HANDOVER — ADVENTURES FRONT PAGE" spec (2026-09-12, §10/§13), which
   supersedes the earlier Quests Hub spec's descriptive subtitles with
   these short canonical taglines: Campaigns is the lone full-width
   feature row, the other 6 divisions sit in a 2-column grid in this
   exact reading order (Expeditions/Journeys, Dungeons/Trials,
   Hunts/Raids). `description` holds the fuller §13 copy for future use
   on each division's own page — the hub card itself only shows
   `subtitle` (the tagline). Trials' background (trials_background.jpg)
   arrived later than the other six (2026-09-12, separate delivery),
   processed identically (900px wide JPEG q=84) and added once
   received — until then its card used the .no-bg dark-surface
   fallback divisionCardHTML still provides for any future division
   delivered icon-only. Campaigns additionally gets its own richer
   "feature" frame (see
   divisionCardHTML) — the other six share one standard frame, per the
   brief's own "one production-ready standard frame, not six decorative
   composites" instruction. */
const QUEST_DIVISIONS=[
  {id:'campaigns',label:'Campaigns',subtitle:'Story • Exploration • Choice',description:'Story-focused authored adventures: Walking Campaigns, branching narrative Campaigns, exploration Campaigns, mysteries, choice-driven story content.',icon:'campaigns_icon.png',bg:'campaigns_background.jpg',feature:true},
  {id:'expeditions',label:'Expeditions',subtitle:'Prepare • Endure • Survive',description:'Multi-day resource, survival and expedition gameplay.',icon:'expeditions_icon.png',bg:'expeditions_background.jpg'},
  {id:'journeys',label:'Journeys',subtitle:'Go Further',description:'Legendary Journeys and World Walks.',icon:'journeys_icon.png',bg:'journeys_background.jpg'},
  {id:'dungeons',label:'Dungeons',subtitle:'Face the Challenge',description:'Repeatable enclosed gameplay: dungeon runs, rooms, enemies, traps, bosses, roguelike structures.',icon:'dungeons_icon.png',bg:'dungeons_background.jpg'},
  {id:'trials',label:'Trials',subtitle:'Test • Improve • Master',description:'STR/DEX/CON/INT/WIS/CHA Trials, Class Trials, mastery and qualification challenges, special proving challenges.',icon:'trials_icon.png',bg:'trials_background.jpg'},
  {id:'hunts',label:'Hunts',subtitle:'Track • Discover • Find',description:'Scavenger Hunts, Boss Hunts, Treasure Hunts, Mystery Hunts, Collection Hunts, Nature/Urban/Explorer Hunts.',icon:'hunts_icon.png',bg:'hunts_background.jpg'},
  {id:'raids',label:'Raids',subtitle:'Stronger Together',description:'Party activities, community events, World Bosses, cooperative objectives.',icon:'raids_icon.png',bg:'raids_background.jpg'}
];
function adventuresAsset(n){return asset(`Home/V3/Adventures/${n}`)}
/* Universal Quest Definitions — static content (title/description/
   discoverable items), one per quest. "Call to the Lost Fortress" is
   the one real quest today, migrated onto this architecture as the
   Acceptance Criteria test case; it still reads/writes CAMPAIGNS'
   existing route-progress fields underneath. discoverables declare
   first-run-hidden content (§8/§9) — names are never rendered until
   .discovered or .revealed (via an Orin hint) is true. */
const QUEST_DEFINITIONS={
  'lost-fortress':{
    id:'lost-fortress',division:'campaigns',category:'Walking Campaign',
    title:'Call to the Lost Fortress',subtitle:'The Pinnacle Spire',
    description:'Strange magical treasures have begun appearing in a remote mountain village. Adventurers whisper that their source lies somewhere in the northern mountains, at a fortress thought lost to history: The Pinnacle Spire.',
    progressType:'distance',progressUnit:'km',
    imageAsset:'Adventure/lost_fortress_campaign_banner_v1.png',
    discoverables:[
      {id:'broken-caravan',category:'hiddenEvent',name:'The Broken Caravan',description:'A wrecked supply caravan hints at what came before you.'},
      {id:'northern-shrine',category:'hiddenEvent',name:'The Northern Shrine',description:'A quiet shrine overlooked by most travelers.'},
      {id:'quentin-blade',category:'rareLoot',name:'Lord Quentin’s Blade',description:'A blade lost generations ago, waiting to be found.'},
      {id:'hidden-pass',category:'secret',name:'The Hidden Mountain Pass',description:'A route through the mountains few know exists.'}
    ]
  },
  /* Journeys / World Tours (ASTRA Update Package 1 §2-23) — each World
     Tour is ALSO a universal quest (division:'journeys'), reusing the
     exact same tracking/progress/discovery/completion/achievement
     machinery Adventure already proved out. discoverables here are the
     route's landmarks; WORLD_TOUR_DEFINITIONS below holds the
     Journey-specialist route/region/movement data the universal layer
     never reaches into directly (mirrors CAMPAIGNS for Adventure). */
  'local-test-trail':{
    id:'local-test-trail',division:'journeys',category:'World Tour · Short',
    title:'Local Test Trail',subtitle:'A short, fully-mapped route for testing Journey mechanics',
    description:'A short test route used to validate Journey progression, regions and landmark discovery before longer World Tours go live.',
    progressType:'distance',progressUnit:'km',imageAsset:null,
    discoverables:[
      {id:'trailhead-overlook',category:'route',name:'Trailhead Overlook',description:'The start of the test route, with a wide valley view.'},
      {id:'old-stone-bridge',category:'route',name:'Old Stone Bridge',description:'A weathered footbridge marking the route’s halfway point.'},
      {id:'ridge-viewpoint',category:'route',name:'Ridge Viewpoint',description:'A high point offering a good look back at how far you’ve come.'},
      {id:'trail-end-marker',category:'route',name:'Trail End Marker',description:'The finish marker for the Local Test Trail.'}
    ]
  },
  'cape-town-magadan':{
    id:'cape-town-magadan',division:'journeys',category:'World Tour · Legendary',
    title:'Cape Town → Magadan',subtitle:'The permanent mega Journey',
    description:'A long-term background World Tour spanning from Cape Town to Magadan. It never occupies one of your 3 Journey slots and keeps receiving eligible movement in the background once started. Its full route, regions and landmark dataset are not yet finalized — see WORLD_TOUR_DEFINITIONS.',
    progressType:'distance',progressUnit:'km',imageAsset:null,
    discoverables:[] /* deliberately empty — final landmark dataset explicitly deferred (§36) */
  }
};
function ensureQuestsState(){
  state.quests=state.quests&&typeof state.quests==='object'?state.quests:{trackedMax:4,tracked:[],registry:{}};
  state.quests.trackedMax=4; /* Adventures Hub handover (2026-09-12): fixed 4-slot cap, retiring the old 2-slot limit outright rather than defaulting it in. */
  state.quests.tracked=Array.isArray(state.quests.tracked)?state.quests.tracked.filter(id=>QUEST_DEFINITIONS[id]):[];
  state.quests.registry=state.quests.registry&&typeof state.quests.registry==='object'?state.quests.registry:{};
  Object.keys(QUEST_DEFINITIONS).forEach(id=>{
    const r=state.quests.registry[id]||{};
    state.quests.registry[id]={
      startedAt:r.startedAt??null,updatedAt:r.updatedAt??null,completedAt:r.completedAt??null,
      firstCompletionAt:r.firstCompletionAt??null,runsCompleted:Number(r.runsCompleted||0),
      discovery:{items:(r.discovery&&typeof r.discovery.items==='object')?r.discovery.items:{}}
    };
  });
  return state.quests;
}
/* Specialist progress dispatch — keyed by division, not a giant quest-
   by-quest switch, so a future division can plug in its own resolver
   without touching the Hub/shell/tracking code (handoff §17). Only
   'adventure' has a real specialist system today. */
function questProgressFor(id){
  const def=QUEST_DEFINITIONS[id];if(!def)return null;
  if(def.division==='campaigns'&&CAMPAIGNS[id]){
    const c=ensureAdventureState()[id]||{};
    const target=Number(c.routeTargetKm||CAMPAIGNS[id].routeTargetKm||1),current=Number(c.routeProgressKm||0);
    const status=!c.started?'not_started':(current>=target?'completed':'active');
    return {current,target,unit:def.progressUnit,type:def.progressType,status,
      currentObjective:status==='not_started'?'Begin the campaign':status==='completed'?'Return in triumph':`Continue toward ${def.subtitle}`};
  }
  if(def.division==='journeys'&&WORLD_TOUR_DEFINITIONS[id]){
    const wt=WORLD_TOUR_DEFINITIONS[id],jp=ensureJourneyProgress(id);
    const current=Number(jp.totalProgress||0),target=Math.max(1,Number(wt.totalDistance||1));
    const status=jp.status==='not_started'?'not_started':(current>=target?'completed':'active');
    const region=(wt.regions||[]).find(r=>r.id===jp.currentRegionId);
    return {current,target,unit:def.progressUnit,type:def.progressType,status,
      currentObjective:status==='not_started'?'Choose movement rules and start this Journey':status==='completed'?'Journey complete':jp.status==='paused'?'Journey paused':`Currently in ${region?region.name:'transit'}`};
  }
  return {current:0,target:1,unit:def.progressUnit||'',type:def.progressType||'percentage',status:'not_started',currentObjective:''};
}
function questStartOrContinue(id){
  const def=QUEST_DEFINITIONS[id];if(!def)return;
  if(def.division==='campaigns'&&CAMPAIGNS[id]){
    const c=ensureAdventureState()[id];
    if(!c.started){c.started=true;c.startedAt=todayISO();c.currentStage='stage-1-mountain-village';toast('Adventure begun.')}
  }
  questTouch(id);
}
/* Replay (§16) — clears the specialist run's progress and the
   registry's completedAt so the quest reads as active again, but never
   touches firstCompletionAt/runsCompleted/discovery: lifetime discovery
   survives every replay. */
function questReplay(id){
  const def=QUEST_DEFINITIONS[id];if(!def)return;
  ensureQuestsState().registry[id].completedAt=null;
  if(def.division==='campaigns'&&CAMPAIGNS[id]){
    const c=ensureAdventureState()[id];
    c.started=false;c.startedAt=null;c.routeProgressKm=0;c.currentStage='not-started';
  }
  save();toast('Quest reset for a new run.');
}
function questTouch(id){
  const q=ensureQuestsState(),reg=q.registry[id];if(!reg)return;
  const prog=questProgressFor(id);
  reg.updatedAt=Date.now();
  if(prog.status==='completed'&&!reg.completedAt){
    reg.completedAt=Date.now();
    if(!reg.firstCompletionAt)reg.firstCompletionAt=Date.now();
    reg.runsCompleted=Number(reg.runsCompleted||0)+1;
  }
  save();
}
function isQuestTracked(id){return ensureQuestsState().tracked.includes(id)}
function toggleQuestTracked(id){
  const q=ensureQuestsState();
  if(q.tracked.includes(id)){q.tracked=q.tracked.filter(x=>x!==id);save();renderQuestsArea();return}
  if(q.tracked.length>=q.trackedMax){questTrackReplaceModal(id);return}
  q.tracked=[...q.tracked,id];save();renderQuestsArea();
}
function questTrackReplaceModal(newId){
  const q=ensureQuestsState(),newDef=QUEST_DEFINITIONS[newId];
  const rows=q.tracked.map(id=>{const def=QUEST_DEFINITIONS[id];return def?`<div class="list-item"><div>★</div><div><h3>${esc(def.title)}</h3></div><button type="button" class="text-btn" data-track-replace="${id}">Replace</button></div>`:''}).join('');
  modal(`<h2>Tracked Adventures Full</h2><p class="helper">Choose one to replace with "${esc(newDef.title)}":</p>${rows}<button type="button" class="text-btn" id="cancelTrackReplace">Cancel</button>`);
  modalRoot.querySelectorAll('[data-track-replace]').forEach(b=>b.onclick=()=>{
    q.tracked=q.tracked.map(x=>x===b.dataset.trackReplace?newId:x);save();closeModal();renderQuestsArea();
  });
  modalRoot.querySelector('#cancelTrackReplace').onclick=closeModal;
}
/* Discovery (§9/§12/§13) — merges the static discoverable definitions
   with per-save discovered/revealed/purchasedHintLevel state. A hint
   can set .revealed without ever setting .discovered (§20 hard rule). */
function questDiscoveryItems(id){
  const def=QUEST_DEFINITIONS[id];if(!def)return [];
  const items=ensureQuestsState().registry[id].discovery.items;
  return (def.discoverables||[]).map(d=>{
    const rec=items[d.id]||{};
    return {...d,discovered:Boolean(rec.discovered),revealed:Boolean(rec.revealed||rec.discovered),purchasedHintLevel:rec.purchasedHintLevel||null};
  });
}
function questDiscoveryPercent(id){
  const items=questDiscoveryItems(id);
  if(!items.length)return 100;
  return Math.round(items.filter(i=>i.discovered).length/items.length*100);
}
function questDiscoverItem(id,itemId){
  const items=ensureQuestsState().registry[id].discovery.items;
  items[itemId]={...(items[itemId]||{}),discovered:true,revealed:true};
  save();
}
/* Orin hint pricing (§20) — intentionally empty. Exact Gold prices and
   which secrets permit which hint tiers are game-design data the
   handoff explicitly says Astra must not invent. Populate per quest
   once Jay/design approves real numbers; until then every tier renders
   as "pending" in questOrinPanelHTML and cannot be purchased. */
const QUEST_HINT_PRICING={};
function questPurchaseHint(id,itemId,tier,goldCost){
  const items=ensureQuestsState().registry[id].discovery.items,existing=items[itemId]||{};
  if(existing.discovered){toast('Already discovered.');return false}
  if(existing.purchasedHintLevel===tier){toast('You already purchased this hint.');return false}
  if(Number(state.gold||0)<Number(goldCost||0)){toast('Not enough Gold.');return false}
  state.gold=Number(state.gold||0)-Number(goldCost||0);
  items[itemId]={...existing,purchasedHintLevel:tier,revealed:true};
  save();return true;
}
let questsView='hub',questsDivisionId=null,questsQuestId=null;
function questProgressLineText(prog){
  if(!prog)return '';
  if(prog.type==='percentage')return `${prog.current}%`;
  return `${prog.current} / ${prog.target}${prog.unit?' '+prog.unit:''}`;
}
function questProgressBarHTML(prog){
  if(!prog)return '';
  return `<div class="quest-progress-block"><div class="quest-progress-label">${esc(questProgressLineText(prog))}</div><div class="resource-bar"><i style="--p:${pct(prog.current,prog.target)}%"></i></div></div>`;
}
/* Universal tracked card — must not assume Campaign/distance content
   (Adventures Hub handover §7/§8): title/division/category and the
   progress line/bar all come from questProgressFor()/
   questProgressLineText(), which already dispatch per-division rather
   than hardcoding a distance model, so this same markup works for any
   future Dungeon/Trial/Hunt/Raid progress type without changes here.
   Root is a plain div, not a button, because it holds two independent
   controls (handover §26/§9): the whole card opens the activity
   directly (bypassing Division/Category), while the ★ is its own
   button that untracks without navigating — bindQuestsArea() stops the
   star's click from bubbling to the card's own open-quest handler. */
function trackedQuestCardHTML(id){
  const def=QUEST_DEFINITIONS[id];if(!def)return '';
  const prog=questProgressFor(id),div=QUEST_DIVISIONS.find(d=>d.id===def.division);
  return `<div class="tracked-quest-card" data-open-quest="${id}">
    <button type="button" class="tracked-quest-star" data-untrack="${id}" aria-label="Remove ${esc(def.title)} from tracked">★</button>
    <div class="tracked-quest-body">
      <h3>${esc(def.title)}</h3>
      <small>${esc(div?.label||'')}${def.category?' · '+esc(def.category):''}</small>
      ${questProgressBarHTML(prog)}
    </div>
  </div>`;
}
/* Wide frame construction (shield icon-slot left, transparent title
   area, circular arrow-slot right) matches the frame PNGs' own
   geometry exactly — see the Adventures Handover Package's 04_FRAMES.
   Background art fills the whole card box (cover) behind the frame,
   independent of the frame's own aspect ratio; the frame is a pure
   decorative overlay on top, same layering every other card family in
   this project already uses (background art, then a frame/border
   layer, never baked together). */
/* Frame overlay art (feature_campaigns_frame.png / standard_division_
   frame.png) and the circular arrow button both dropped from every
   division card, Campaigns included, per explicit direction
   (2026-09-12) — the frame read as too "finished"/heavy even on
   divisions with real content, and the arrow crowded the title/tagline
   in the narrower 2-column cards. The whole card is already clickable
   (data-open-division), so the arrow was a redundant affordance, not
   the only one. Cards now use the plain-keyline + scrim treatment (see
   .quest-division-row in CSS) with icon + copy only. Both asset
   families stay on disk, unreferenced, per this project's convention. */
function divisionCardHTML(div){
  const cls=`quest-division-row ${div.feature?'feature':''} ${div.bg?'':'no-bg'}`.trim();
  return `<button type="button" class="${cls}" data-open-division="${div.id}" ${div.bg?`style="background-image:url('${adventuresAsset(div.bg)}')"`:''}>
    <img class="division-row-icon" src="${adventuresAsset(div.icon)}" alt="">
    <span class="division-row-copy"><h3>${esc(div.label)}</h3><p class="helper">${esc(div.subtitle)}</p></span>
  </button>`;
}
/* Adventures Hero hook (Adventures Hub handover §2/§22/§28) — reserved
   slot for Seraphine's forthcoming scenic hero + compass artwork.
   Deliberately renders nothing while ADVENTURES_HERO_BG is unset,
   per the handover's explicit "provide asset hooks rather than
   embedding placeholder art" instruction. The live title/subtitle it
   will eventually sit alongside already render via pageHeader() above
   this — this slot is for the additional decorative hero art only. */
const ADVENTURES_HERO_BG=null;
function adventuresHeroHTML(){
  if(!ADVENTURES_HERO_BG)return '';
  return `<section class="adventures-hero" style="background-image:url('${adventuresAsset(ADVENTURES_HERO_BG)}')">
    <img class="adventures-hero-compass" src="${adventuresAsset('hero_compass.png')}" alt="">
  </section>`;
}
function questsHubHTML(){
  const tracked=ensureQuestsState().tracked.filter(id=>QUEST_DEFINITIONS[id]);
  const feature=QUEST_DIVISIONS.find(d=>d.feature);
  const standard=QUEST_DIVISIONS.filter(d=>!d.feature);
  return `${adventuresHeroHTML()}
    <h2 class="section-title">Tracked Adventures</h2>
    <div class="tracked-adventures-grid">${tracked.length?tracked.map(trackedQuestCardHTML).join(''):'<div class="empty">No adventures tracked yet.<br><small>Open any adventure and tap ★ to keep it here.</small></div>'}</div>
    <h2 class="section-title">Divisions</h2>
    <div class="quest-division-list">
      ${feature?divisionCardHTML(feature):''}
      <div class="quest-division-grid-2col">${standard.map(divisionCardHTML).join('')}</div>
    </div>`;
}
function questCardHTML(def){
  const prog=questProgressFor(def.id);
  return `<button type="button" class="campaign-banner-card ${def.imageAsset?'':'no-art'}" data-open-quest="${def.id}" ${def.imageAsset?`style="background-image:url('${asset(def.imageAsset)}')"`:''}>
    <div class="campaign-banner-overlay"></div>
    <div class="campaign-banner-copy"><span class="campaign-banner-type">${esc(def.category||'')}</span><h2>${esc(def.title)}</h2><span class="campaign-banner-progress">${esc(questProgressLineText(prog))}</span></div>
  </button>`;
}
function divisionPageHTML(divId){
  const div=QUEST_DIVISIONS.find(d=>d.id===divId);if(!div)return '';
  const defs=Object.values(QUEST_DEFINITIONS).filter(q=>q.division===divId);
  const back=`<button type="button" class="text-btn campaign-back" id="questDivisionBack">← Adventures</button>`;
  if(!defs.length)return back+`<h2 class="section-title">${esc(div.label)}</h2><p class="helper">${esc(div.description||div.subtitle)}</p>`+shellCards([{title:div.label,icon:'UI/nav_quest_board.png',copy:`${div.label} content will live here.`}]);
  return back+`<h2 class="section-title">${esc(div.label)}</h2><div class="campaign-list">${defs.map(questCardHTML).join('')}</div>`;
}
/* Individual quest page shell (§7) — universal head (division/category,
   star, title, progress, objective) on top, specialist body below,
   Full Status Board only once unlocked (§10/§11, after first
   completion). One shell serves all six divisions. */
function questSpecialistBodyHTML(id,prog){
  const def=QUEST_DEFINITIONS[id];
  if(def.division==='campaigns'&&CAMPAIGNS[id]){
    const c=ensureAdventureState()[id]||{};
    return `<div class="campaign-page-banner" style="background-image:url('${asset(def.imageAsset)}')"><div class="campaign-banner-overlay"></div></div>
      <section class="rpg-frame standard campaign-body">
      ${!c.started?`<p class="campaign-intro">${esc(def.description)}</p>`:''}
      ${prog.status==='completed'?`<button type="button" class="rpg-btn accent" id="questReplayBtn">Replay Quest</button>`:`<button type="button" class="rpg-btn accent" id="questPrimaryAction">${c.started?'Continue Adventure':'Begin Adventure'}</button>`}
      </section>`;
  }
  if(def.division==='journeys'&&WORLD_TOUR_DEFINITIONS[id])return journeySpecialistBodyHTML(id,prog);
  return '';
}

/* ---------- Journeys / World Tours specialist layer (ASTRA Update
   Package 1 §2-23, 2026-09-06) ----------
   Universal Quests (above) owns identity/tracking/completion/discovery/
   achievements/routing for each World Tour via QUEST_DEFINITIONS +
   state.quests.registry, exactly like Adventure. Everything below is
   the Journey-specialist layer §2 describes: route geometry, region/
   stage resolution, movement conversion, landmark reveal, and the
   3-slot + permanent-mega-Journey structure. The "live map" here is a
   simple stylized route track (fill + pins + position marker) — a real
   geographic map provider/library is explicitly out of scope (§36),
   and the doc itself separates presentation from the data-driven
   progression underneath (§4/§21). */
const JOURNEY_MOVEMENT_PROFILES={
  /* Conversion values are the handoff's own "Example only" figures
     (§14) — not invented, but also not confirmed final Journey-specific
     data; safe to use as the shared default until design supplies real
     per-Tour numbers. */
  foot:{label:'Foot Only',types:['Running','Long Run','Interval Run','Walking','Hiking'],conversion:{}},
  human_powered:{label:'Human Powered',types:['Running','Long Run','Interval Run','Walking','Hiking','Cycling','Rowing','Skiing'],conversion:{Cycling:0.5}},
  custom:{label:'Custom',types:null}
};
/* World Tour specialist data. Cape Town -> Magadan ships with identity
   + movement rules only — no regions/landmarks — because the handoff
   explicitly forbids inventing "the final Cape Town -> Magadan landmark
   dataset" (§36). Local Test Trail is the fully-realized short route
   §34 asks for, specifically so full-completion/region-transition/
   discovery flows can be validated without faking thousands of km. */
const WORLD_TOUR_DEFINITIONS={
  'local-test-trail':{
    id:'local-test-trail',totalDistance:10,isMegaJourney:false,
    regions:[
      {id:'lowlands',name:'The Lowlands',startDistance:0,endDistance:5},
      {id:'highlands',name:'The Highlands',startDistance:5,endDistance:10}
    ],
    landmarks:[
      {id:'trailhead-overlook',routeDistance:0.5,fact:'Most test trails begin exactly where you’re standing.',asterNote:'Astra picked a short one on purpose. You’re welcome.'},
      {id:'old-stone-bridge',routeDistance:4,fact:'A stone bridge is really just a very patient pile of rocks.',asterNote:'Still standing, unlike some training plans.'},
      {id:'ridge-viewpoint',routeDistance:7,fact:'Ridgelines mark the boundary between two watersheds.',asterNote:'Look back. That’s real distance, not a percentage bar.'},
      {id:'trail-end-marker',routeDistance:10,fact:'The end of a test route is the beginning of a real one.',asterNote:'Route complete. The next one won’t be this short.'}
    ]
  },
  'cape-town-magadan':{
    id:'cape-town-magadan',totalDistance:22387,isMegaJourney:true,
    regions:[],landmarks:[]
  }
};
function ensureJourneysState(){
  state.journeys=state.journeys&&typeof state.journeys==='object'?state.journeys:{megaJourneyId:'cape-town-magadan',slots:[null,null,null],progress:{},seenAsterIntro:false};
  const j=state.journeys;
  j.megaJourneyId=j.megaJourneyId||'cape-town-magadan';
  j.slots=Array.isArray(j.slots)?j.slots.slice(0,3):[null,null,null];
  while(j.slots.length<3)j.slots.push(null);
  j.progress=j.progress&&typeof j.progress==='object'?j.progress:{};
  j.seenAsterIntro=Boolean(j.seenAsterIntro);
  return j;
}
function ensureJourneyProgress(tourId){
  const j=ensureJourneysState();
  if(!j.progress[tourId])j.progress[tourId]={status:'not_started',startedAt:null,totalProgress:0,currentRegionId:null,movementRules:null,customMovementTypes:[],discoveredLandmarkOrder:[],pendingLandmarkReveals:[]};
  const p=j.progress[tourId];
  p.discoveredLandmarkOrder=Array.isArray(p.discoveredLandmarkOrder)?p.discoveredLandmarkOrder:[];
  p.pendingLandmarkReveals=Array.isArray(p.pendingLandmarkReveals)?p.pendingLandmarkReveals:[];
  p.customMovementTypes=Array.isArray(p.customMovementTypes)?p.customMovementTypes:[];
  return p;
}
function isMegaJourney(tourId){return tourId===ensureJourneysState().megaJourneyId}
function activeJourneyIds(){
  const j=ensureJourneysState(),ids=[];
  if(j.progress[j.megaJourneyId]?.status==='active')ids.push(j.megaJourneyId);
  j.slots.forEach(id=>{if(id&&j.progress[id]?.status==='active')ids.push(id)});
  return ids;
}
function journeyLandmarkMerged(tourId,landmarkId){
  const universal=(QUEST_DEFINITIONS[tourId]?.discoverables||[]).find(d=>d.id===landmarkId)||{};
  const specialist=(WORLD_TOUR_DEFINITIONS[tourId]?.landmarks||[]).find(l=>l.id===landmarkId)||{};
  return {...universal,...specialist};
}
/* Movement rules lock for the run once a Journey starts (§14). The mega
   Journey never occupies a slot (§15); normal Journeys need a free slot
   index — journeySlotFullModal handles the "no free slot" case. */
function startJourney(tourId,movementRules,customTypes,slotIndex){
  const j=ensureJourneysState(),prog=ensureJourneyProgress(tourId);
  if(prog.status!=='not_started')return false;
  if(!isMegaJourney(tourId)){
    if(slotIndex==null||j.slots[slotIndex])return false;
    j.slots[slotIndex]=tourId;
  }
  prog.status='active';prog.startedAt=todayISO();prog.movementRules=movementRules;prog.customMovementTypes=customTypes||[];
  save();return true;
}
function pauseJourney(tourId){
  const prog=ensureJourneyProgress(tourId);if(prog.status!=='active')return;
  prog.status='paused';save();
}
function resumeJourney(tourId){
  const prog=ensureJourneyProgress(tourId);if(prog.status!=='paused')return;
  prog.status='active';save();
}
/* Swap replaces whatever occupies a slot — the outgoing Journey (if any)
   pauses but keeps its progress; it isn't erased, just no longer in a
   slot until deliberately resumed into one again (§15's "paused,
   swapped, resumed later"). */
function swapJourneySlot(slotIndex,newTourId,movementRules,customTypes){
  const j=ensureJourneysState(),outgoingId=j.slots[slotIndex];
  if(outgoingId){const outgoing=ensureJourneyProgress(outgoingId);if(outgoing.status==='active')outgoing.status='paused'}
  j.slots[slotIndex]=newTourId;
  const incoming=ensureJourneyProgress(newTourId);
  if(incoming.status==='not_started'){incoming.status='active';incoming.startedAt=todayISO();incoming.movementRules=movementRules;incoming.customMovementTypes=customTypes||[]}
  else if(incoming.status==='paused')incoming.status='active';
  save();
}
/* Region/landmark resolution — landmark discovery reuses the EXISTING
   universal discovery system (questDiscoverItem) so the Full Status
   Board, discovery %, and Orin hints all work for Journeys with no
   extra code; pendingLandmarkReveals additionally queues the dedicated
   "Landmark Discovered" reveal card (§10), which the generic Full
   Status Board doesn't provide. */
function journeyResolveProgress(tourId){
  const wt=WORLD_TOUR_DEFINITIONS[tourId],prog=ensureJourneyProgress(tourId);if(!wt)return;
  const region=(wt.regions||[]).find(r=>prog.totalProgress>=r.startDistance&&prog.totalProgress<r.endDistance);
  prog.currentRegionId=region?region.id:((wt.regions||[])[wt.regions.length-1]?.id||null);
  (wt.landmarks||[]).forEach(lm=>{
    if(prog.totalProgress>=lm.routeDistance&&!prog.discoveredLandmarkOrder.includes(lm.id)){
      prog.discoveredLandmarkOrder.push(lm.id);
      prog.pendingLandmarkReveals.push(lm.id);
      questDiscoverItem(tourId,lm.id);
    }
  });
}
/* Movement conversion (§4/§14/§16) — the SAME completed activity credits
   every eligible active Journey, not just one (§16 "shared activity
   credit"). Called from processTrainingCompletion, alongside the
   existing running-milestone/strength-PB detection already there. */
function creditJourneyMovement(a){
  if(!(Number(a.distance)>0))return;
  activeJourneyIds().forEach(tourId=>{
    const wt=WORLD_TOUR_DEFINITIONS[tourId];if(!wt)return;
    const prog=ensureJourneyProgress(tourId);
    const profile=JOURNEY_MOVEMENT_PROFILES[prog.movementRules];
    const eligibleTypes=prog.movementRules==='custom'?prog.customMovementTypes:(profile?.types||[]);
    if(!eligibleTypes.includes(a.type))return;
    const factor=(profile?.conversion&&profile.conversion[a.type])||1;
    prog.totalProgress=Math.min(wt.totalDistance,Number(prog.totalProgress||0)+Number(a.distance)*factor);
    journeyResolveProgress(tourId);
    questTouch(tourId);
  });
}
function journeyRouteVizHTML(wt,prog){
  const pct=Math.min(100,(prog.totalProgress/wt.totalDistance)*100);
  const pins=(wt.landmarks||[]).map(lm=>{
    const lp=Math.min(100,(lm.routeDistance/wt.totalDistance)*100),found=prog.discoveredLandmarkOrder.includes(lm.id);
    return `<div class="journey-route-landmark ${found?'discovered':''}" style="left:${lp}%" title="${found?esc(journeyLandmarkMerged(wt.id,lm.id).name):'???'}"></div>`;
  }).join('');
  return `<div class="journey-route-track"><div class="journey-route-fill" style="width:${pct}%"></div>${pins}<div class="journey-route-position" style="left:${pct}%" title="You are here"></div></div>`;
}
function journeyRegionListHTML(wt,prog){
  if(!(wt.regions||[]).length)return '';
  return `<div class="journey-region-list">${wt.regions.map(r=>{
    const span=r.endDistance-r.startDistance;
    const within=Math.max(0,Math.min(span,prog.totalProgress-r.startDistance));
    const pct=span>0?Math.round((within/span)*100):0;
    /* Region ranges are [start,end) except the final region, which must
       include a landmark sitting exactly at the route's total distance
       (a natural "finish line" landmark) — otherwise it falls through
       every region's exclusive upper bound. */
    const isLastRegion=r.endDistance>=wt.totalDistance;
    const found=(wt.landmarks||[]).filter(lm=>lm.routeDistance>=r.startDistance&&(lm.routeDistance<r.endDistance||(isLastRegion&&lm.routeDistance<=r.endDistance)));
    const foundCount=found.filter(lm=>prog.discoveredLandmarkOrder.includes(lm.id)).length;
    return `<div class="journey-region-row ${r.id===prog.currentRegionId?'current':''}"><div class="journey-region-head"><b>${esc(r.name)}</b><span>${pct}%</span></div><div class="resource-bar"><i style="--p:${pct}%"></i></div>${found.length?`<small>${foundCount} / ${found.length} Landmarks</small>`:''}</div>`;
  }).join('')}</div>`;
}
function journeyLandmarkRowHTML(tourId,lm,prog){
  const found=prog.discoveredLandmarkOrder.includes(lm.id),merged=journeyLandmarkMerged(tourId,lm.id);
  return `<div class="journey-landmark-row ${found?'found':''}"><span>${found?'✓':'?'}</span><div><b>${found?esc(merged.name):'???'}</b>${found?`<small>${lm.routeDistance} km</small>`:''}</div></div>`;
}
function journeySpecialistBodyHTML(id,prog){
  const wt=WORLD_TOUR_DEFINITIONS[id];if(!wt)return '';
  const jp=ensureJourneyProgress(id);
  if(jp.status==='not_started'){
    return `<section class="rpg-frame standard journey-body">
      <p class="campaign-intro">${esc(QUEST_DEFINITIONS[id].description)}</p>
      <div class="journey-preview-stats"><div><span>Total Distance</span><b>${wt.totalDistance.toLocaleString()} km</b></div><div><span>Regions</span><b>${(wt.regions||[]).length}</b></div><div><span>Landmarks</span><b>${(wt.landmarks||[]).length}</b></div></div>
      ${isMegaJourney(id)?'<p class="helper">This is the permanent mega Journey — starting it never uses one of your 3 Journey slots.</p>':'<p class="helper">Uses one of your 3 active Journey slots.</p>'}
      <button type="button" class="rpg-btn accent" data-journey-start="${id}">Choose Movement Rules &amp; Start</button>
    </section>`;
  }
  const region=(wt.regions||[]).find(r=>r.id===jp.currentRegionId);
  const nextLandmark=(wt.landmarks||[]).find(lm=>!jp.discoveredLandmarkOrder.includes(lm.id));
  const pct=Math.round((jp.totalProgress/wt.totalDistance)*100);
  return `<section class="rpg-frame standard journey-body">
    ${journeyRouteVizHTML(wt,jp)}
    <div class="journey-position-card">
      <div class="journey-position-line"><b>${jp.totalProgress.toFixed(1)} / ${wt.totalDistance.toLocaleString()} km</b><span>${pct}% Complete</span></div>
      <div class="journey-position-meta">${region?`<span>Current Region: ${esc(region.name)}</span>`:''}${nextLandmark?`<span>Next Landmark: ${Math.max(0,nextLandmark.routeDistance-jp.totalProgress).toFixed(1)} km</span>`:'<span>All landmarks discovered</span>'}</div>
    </div>
    ${journeyRegionListHTML(wt,jp)}
    <div class="journey-controls">
      ${jp.status==='active'?`<button type="button" class="text-btn" data-journey-pause="${id}">Pause Journey</button>`:jp.status==='paused'?`<button type="button" class="text-btn accent" data-journey-resume="${id}">Resume Journey</button>`:''}
      <span class="journey-movement-rules-note">Movement: ${esc(JOURNEY_MOVEMENT_PROFILES[jp.movementRules]?.label||jp.movementRules||'—')}</span>
    </div>
    <div class="journey-landmark-list"><h4>Landmarks</h4>${(wt.landmarks||[]).length?wt.landmarks.map(lm=>journeyLandmarkRowHTML(id,lm,jp)).join(''):'<p class="helper">No landmarks defined for this route yet.</p>'}</div>
  </section>`;
}
function journeyMovementRuleModal(tourId){
  const profiles=Object.entries(JOURNEY_MOVEMENT_PROFILES);
  modal(`<h2>Choose Movement Rules</h2><p class="helper">This selection locks for the entire Journey run and cannot be changed casually once started.</p>
    ${profiles.map(([key,p],i)=>`<label class="list-item journey-movement-option"><input type="radio" name="journeyMovementRule" value="${key}" ${i===0?'checked':''}><div><h3>${esc(p.label)}</h3><p class="helper">${p.types?esc(p.types.join(', ')):'Choose which tracked activity types count.'}</p></div></label>`).join('')}
    <div id="journeyCustomTypesRow" class="journey-custom-type-grid" hidden>${ACTIVITY_TYPES.map(t=>`<label><input type="checkbox" data-journey-custom-type value="${esc(t)}"><span>${esc(t)}</span></label>`).join('')}</div>
    <button type="button" class="rpg-btn accent" id="confirmJourneyStart" style="width:100%">Start Journey</button>`);
  modalRoot.querySelectorAll('[name="journeyMovementRule"]').forEach(r=>r.onchange=()=>{modalRoot.querySelector('#journeyCustomTypesRow').hidden=r.value!=='custom'});
  modalRoot.querySelector('#confirmJourneyStart').onclick=()=>{
    const rule=modalRoot.querySelector('[name="journeyMovementRule"]:checked')?.value||'foot';
    const customTypes=rule==='custom'?[...modalRoot.querySelectorAll('[data-journey-custom-type]:checked')].map(x=>x.value):[];
    if(rule==='custom'&&!customTypes.length){toast('Choose at least one activity type.');return}
    if(isMegaJourney(tourId)){startJourney(tourId,rule,customTypes,null);closeModal();renderQuestsArea();return}
    const j=ensureJourneysState(),freeSlot=j.slots.findIndex(s=>!s);
    if(freeSlot<0){closeModal();journeySlotFullModal(tourId,rule,customTypes);return}
    startJourney(tourId,rule,customTypes,freeSlot);closeModal();renderQuestsArea();
  };
}
function journeySlotFullModal(tourId,rule,customTypes){
  const j=ensureJourneysState();
  const rows=j.slots.map((id,i)=>id?`<div class="list-item"><div>${i+1}</div><div><h3>${esc(QUEST_DEFINITIONS[id]?.title||id)}</h3><p>${esc(ensureJourneyProgress(id).status)}</p></div><button type="button" class="text-btn" data-swap-slot="${i}">Swap</button></div>`:'').join('');
  modal(`<h2>Journey Slots Full</h2><p class="helper">You have 3 active Journey slots in use. Choose one to swap for "${esc(QUEST_DEFINITIONS[tourId]?.title||tourId)}":</p>${rows}<button type="button" class="text-btn" id="cancelSlotSwap">Cancel</button>`);
  modalRoot.querySelectorAll('[data-swap-slot]').forEach(b=>b.onclick=()=>{swapJourneySlot(Number(b.dataset.swapSlot),tourId,rule,customTypes);closeModal();renderQuestsArea()});
  modalRoot.querySelector('#cancelSlotSwap').onclick=closeModal;
}
function journeyLandmarkRevealModal(tourId,landmarkId){
  const merged=journeyLandmarkMerged(tourId,landmarkId);
  modal(`<h2>Landmark Discovered</h2><h3>${esc(merged.name)}</h3>
    <p class="resource-entry-label">ABOUT THIS PLACE</p><p>${esc(merged.description||'')}</p>
    ${merged.fact?`<p class="resource-entry-label">FUN FACT</p><p>${esc(merged.fact)}</p>`:''}
    ${merged.asterNote?`<div class="journey-aster-note"><b>Aster</b> ${esc(merged.asterNote)}</div>`:''}
    <button type="button" class="rpg-btn accent" id="closeLandmarkReveal" style="width:100%">Continue</button>`);
  modalRoot.querySelector('#closeLandmarkReveal').onclick=()=>{
    const prog=ensureJourneyProgress(tourId);
    prog.pendingLandmarkReveals=prog.pendingLandmarkReveals.filter(id=>id!==landmarkId);
    save();closeModal();renderQuestsArea();
  };
}
/* Aster onboarding (§22) — one-time intro the first time the player
   opens Quests -> Journeys; no separate onboarding framework, just the
   existing modal() surface. */
function asterIntroModalIfNeeded(){
  const j=ensureJourneysState();if(j.seenAsterIntro)return false;
  modal(`<h2>Aster — Journeys Guide</h2><p class="helper">Real-world movement progresses your Journeys. Cape Town → Magadan is a permanent background Journey once started — it never takes one of your slots. You may run up to 3 other active Journeys at once, and can pause and swap them freely; paused progress is always kept.</p><p class="helper">Each Journey's movement rules lock once you start it. The route view shows your current position, region, and the next landmark ahead.</p><button type="button" class="rpg-btn accent" id="closeAsterIntro" style="width:100%">Got it</button>`);
  modalRoot.querySelector('#closeAsterIntro').onclick=()=>{j.seenAsterIntro=true;save();closeModal()};
  return true;
}
const QUEST_DISCOVERY_CATEGORY_LABEL={hiddenEvent:'HIDDEN EVENTS',rareLoot:'RARE LOOT',secret:'SECRETS',route:'ROUTES',npc:'NPCs / ENCOUNTERS'};
function questOrinPanelHTML(id){
  const items=questDiscoveryItems(id).filter(i=>!i.discovered);
  if(!items.length)return '';
  const pricing=QUEST_HINT_PRICING[id]||{};
  const rows=items.map(i=>{
    const p=pricing[i.id]||{};
    const tiers=['rumour','clue','revelation'].map(tier=>{
      const cost=p[tier];
      return cost!=null?`<button type="button" class="text-btn accent" data-orin-hint="${id}|${i.id}|${tier}|${cost}">${tier[0].toUpperCase()+tier.slice(1)} · ${cost}g</button>`:`<span class="tag">${tier[0].toUpperCase()+tier.slice(1)} · pending</span>`;
    }).join('');
    return `<div class="orin-hint-row"><span>${i.revealed?esc((i.purchasedHintLevel||'hinted')):'Undiscovered content'}</span><div class="orin-hint-tiers">${tiers}</div></div>`;
  }).join('');
  return `<div class="orin-panel"><h4>Orin — Guidance</h4><p class="helper">Spend Gold for guidance toward undiscovered content. Hints never complete objectives, mark content discovered, or grant loot.</p>${rows}</div>`;
}
function questFullStatusBoardHTML(id){
  const items=questDiscoveryItems(id),discPct=questDiscoveryPercent(id),reg=ensureQuestsState().registry[id];
  const byCategory={};items.forEach(i=>{(byCategory[i.category]=byCategory[i.category]||[]).push(i)});
  const sections=Object.entries(byCategory).map(([cat,list])=>{
    const found=list.filter(i=>i.discovered).length;
    return `<div class="status-board-module"><div class="status-board-module-head"><span>${esc(QUEST_DISCOVERY_CATEGORY_LABEL[cat]||cat.toUpperCase())}</span><b>${found} / ${list.length}</b></div>
      <div class="status-board-item-list">${list.map(i=>i.discovered?`<div class="status-board-item found">✓ ${esc(i.name)}</div>`:i.revealed?`<div class="status-board-item hinted">? ${esc(i.purchasedHintLevel||'Hinted')}</div>`:`<div class="status-board-item unknown">? ???</div>`).join('')}</div>
    </div>`;
  }).join('');
  return `<section class="rpg-frame standard quest-status-board"><h3 class="section-title">Full Status Board</h3>
    ${sections||'<p class="helper">No discoverable content declared for this quest.</p>'}
    <div class="status-board-module"><div class="status-board-module-head"><span>RUNS COMPLETED</span><b>${Number(reg.runsCompleted||0)}</b></div></div>
    <div class="status-board-module"><div class="status-board-module-head"><span>DISCOVERY</span><b>${discPct}%</b></div></div>
    ${questOrinPanelHTML(id)}
    </section>`;
}
function questPageHTML(id){
  const def=QUEST_DEFINITIONS[id];if(!def)return '';
  const prog=questProgressFor(id),tracked=isQuestTracked(id),div=QUEST_DIVISIONS.find(d=>d.id===def.division);
  const reg=ensureQuestsState().registry[id];
  const back=`<button type="button" class="text-btn campaign-back" id="questPageBack">← ${esc(div?.label||'Adventures')}</button>`;
  const header=`<div class="quest-page-head"><div><span class="quest-page-kicker">${esc(div?.label||'')}${def.category?' · '+esc(def.category):''}</span><h2>${esc(def.title)}</h2>${def.subtitle?`<p class="helper">${esc(def.subtitle)}</p>`:''}</div><button type="button" class="quest-star-toggle ${tracked?'active':''}" id="questStarToggle" aria-label="${tracked?'Untrack quest':'Track quest'}">${tracked?'★':'☆'}</button></div>`;
  const bodyProgress=questProgressBarHTML(prog)+(prog.currentObjective?`<p class="quest-objective">${esc(prog.currentObjective)}</p>`:'');
  const statusBoard=reg.firstCompletionAt?questFullStatusBoardHTML(id):'';
  return back+header+bodyProgress+questSpecialistBodyHTML(id,prog)+statusBoard;
}
/* ==========================================================================
   MAIN QUEST FOUNDATION (Phase 3B.1 — Quests domain, 2026-09-12)
   ==========================================================================
   Player-facing "Main Quest" now names THIS system (long-term, multi-week
   goals — up to 5 active at once). The legacy state.quest/completeMainQuest/
   integrity.mainQuest single-daily-quest system is untouched internally;
   its own UI text is a separate, later relabel to "Daily Quest" and is not
   part of this section.

   Quests owns this state exclusively. Training/Personal Growth/Calendar/
   Achievements/Home read from it or feed evidence into it — none of them
   ever write a Main Quest record.

   Goal vs Plan (write-layer enforced, not just a UI convention): `goal` is
   what the player committed to and freezes the moment status leaves
   'draft' — except `goal.targetDate`, which stays adjustable forever
   UNLESS `goal.fixedEventDate` was true at commitment time, in which case
   `commitment.fixedEventDateLockedAt` freezes it too. `plan` (sections/
   milestones/recurringGoals/scheduledActivities) stays editable for the
   quest's whole life — Journal-typed entries for plan changes are a 3B.4
   concern, not built here.

   Deliberately NOT built in this phase: progress-rule resolvers (3B.2),
   the shared schedule aggregator (3B.3), Journal/Check-in behavior beyond
   the bare field shape (3B.4), any Quests-page UI (3B.5), reward/
   achievement wiring (3B.6). This section is the domain model only —
   CRUD, state transitions, the goal-lock, the active cap, and the
   template/series split. */

const MAIN_QUEST_ACTIVE_CAP=5;

/* Minimum required set per Phase 3A audit correction #13 — Training and
   Personal Growth must exist; the full future list is an open product
   decision, not an engineering one, so this stays a plain extensible
   array rather than a baked-in enum. Icons reused from existing nav
   assets as placeholders, same "not a final icon decision" status as
   HOME_SCHEDULE_KIND_ICON already carries elsewhere. */
const MAIN_QUEST_AREAS_OF_LIFE=[
  {id:'training',label:'Training',icon:'icons/navigation/NAV_TRAINING.png'},
  {id:'personalGrowth',label:'Personal Growth',icon:'icons/navigation/NAV_GROWTH.png'},
];
/* Field + registry only — no reward multipliers attached yet (Phase 3A
   guardrail: integration points only, no invented economy numbers). */
const MAIN_QUEST_DIFFICULTY=[
  {id:'easy',label:'Easy'},
  {id:'standard',label:'Standard'},
  {id:'hard',label:'Hard'},
  {id:'epic',label:'Epic'},
];

/* `function` declarations (not const/arrow) — deliberately, so top-level
   hoisting makes them callable from migrate(), which runs synchronously
   at script-parse time via `let state=load()` near the top of this file,
   long before this section's physical position is reached. Also the
   shared normalizer for both migrate()'s defensive per-load guard and
   every CRUD function below that creates a fresh record — one shape
   definition, not two copies that can drift. */
function ensureMainQuestShape(mq){
  mq=(mq&&typeof mq==='object')?mq:{};
  mq.id=mq.id||uid();
  mq.status=MAIN_QUEST_STATUSES.includes(mq.status)?mq.status:'draft';
  const g=(mq.goal&&typeof mq.goal==='object')?mq.goal:{};
  mq.goal={
    title:String(g.title||''),
    description:String(g.description||''),
    areaOfLife:g.areaOfLife||null,
    difficultyId:g.difficultyId||null,
    priority:clamp(Number(g.priority)||3,1,5),
    successCriteria:String(g.successCriteria||''),
    targetDate:g.targetDate||null,
    fixedEventDate:Boolean(g.fixedEventDate),
  };
  const c=(mq.commitment&&typeof mq.commitment==='object')?mq.commitment:{};
  mq.commitment={
    committedAt:c.committedAt||null,
    fixedEventDateLockedAt:c.fixedEventDateLockedAt||null,
  };
  const p=(mq.plan&&typeof mq.plan==='object')?mq.plan:{};
  /* Per-element shape guaranteed here (Phase 3B.2 Sections/Milestones/
     RecurringGoals; scheduledActivities added Phase 3B.3 now that the
     shared schedule aggregator actually needs a real date/time shape
     to read). */
  mq.plan={
    sections:Array.isArray(p.sections)?p.sections.map(ensureMainQuestSectionShape):[],
    milestones:Array.isArray(p.milestones)?p.milestones.map(ensureMainQuestMilestoneShape):[],
    recurringGoals:Array.isArray(p.recurringGoals)?p.recurringGoals.map(ensureMainQuestRecurringGoalShape):[],
    scheduledActivities:Array.isArray(p.scheduledActivities)?p.scheduledActivities.map(ensureMainQuestScheduledActivityShape):[],
  };
  const pr=(mq.progress&&typeof mq.progress==='object')?mq.progress:{};
  mq.progress={
    progressRule:(pr.progressRule&&typeof pr.progressRule==='object')?pr.progressRule:null,
    mode:pr.mode||null,
    current:Number(pr.current||0),
    target:pr.target==null?null:Number(pr.target),
    unit:pr.unit||null,
    expected:pr.expected==null?null:Number(pr.expected),
    paceState:pr.paceState||null,
    updatedAt:pr.updatedAt||null,
  };
  mq.journal=Array.isArray(mq.journal)?mq.journal:[];
  const ci=(mq.checkIns&&typeof mq.checkIns==='object')?mq.checkIns:{};
  mq.checkIns={
    enabled:Boolean(ci.enabled),
    /* Same WEEKDAY_ABBR format as RecurringGoal.recurrence.selectedDays
       (Phase 3B.3) — needed so the schedule provider can match it
       against a date's day-of-week. */
    weekday:WEEKDAY_ABBR.includes(ci.weekday)?ci.weekday:null,
    time:ci.time||null,
    /* Full per-occurrence lifecycle shape as of Phase 3B.4 — see
       ensureMainQuestCheckInEntryShape further down this file. Safe to
       reference here despite the physical distance, unlike the
       WEEKDAY_ABBR/MAIN_QUEST_STATUSES situation above: this is a
       `function` declaration, which (unlike a `const`) hoists its full
       value, not just the binding — no TDZ risk regardless of where in
       the file it's defined. */
    entries:Array.isArray(ci.entries)?ci.entries.map(ensureMainQuestCheckInEntryShape):[],
  };
  mq.seriesId=mq.seriesId||null;
  mq.recurrenceRule=(mq.recurrenceRule&&typeof mq.recurrenceRule==='object')?mq.recurrenceRule:null;
  mq.previousInstanceId=mq.previousInstanceId||null;
  mq.nextInstanceId=mq.nextInstanceId||null;
  mq.templateId=mq.templateId||null;
  mq.createdAt=mq.createdAt||Date.now();
  mq.completedAt=mq.completedAt||null;
  /* Reward hook shape only (Phase 3B.6) — same "protected reward" record
     shape used elsewhere (state.rewardLocks entries), stored on the
     quest itself so a completed quest can show its own reward state
     once one exists. Stays {granted:false,...null} in production until
     MAIN_QUEST_REWARD_CONFIG (below) has real values — see
     mainQuestGrantReward. */
  const r=(mq.reward&&typeof mq.reward==='object')?mq.reward:{};
  mq.reward={granted:Boolean(r.granted),grantedAt:r.grantedAt||null,xp:r.xp==null?null:Number(r.xp),gold:r.gold==null?null:Number(r.gold)};
  return mq;
}
/* Reusable design only — no status/commitment/progress/journal/checkIns/
   series fields, since a template is never itself pursued. */
function ensureMainQuestTemplateShape(t){
  t=(t&&typeof t==='object')?t:{};
  t.id=t.id||uid();
  t.title=String(t.title||'');
  t.description=String(t.description||'');
  t.areaOfLife=t.areaOfLife||null;
  t.difficultyId=t.difficultyId||null;
  t.sections=Array.isArray(t.sections)?t.sections:[];
  t.milestones=Array.isArray(t.milestones)?t.milestones:[];
  t.recurringGoals=Array.isArray(t.recurringGoals)?t.recurringGoals:[];
  t.scheduledActivities=Array.isArray(t.scheduledActivities)?t.scheduledActivities:[];
  t.createdAt=t.createdAt||Date.now();
  return t;
}
/* completionStats is a plain read model, not a second source of truth:
   it is a running count derived from the exact same transition points
   (mainQuestComplete/mainQuestAbandon) that already journal those
   events, updated atomically alongside them (Phase 3B.6) — never
   recomputed by re-scanning mainQuests, so it stays cheap to read from
   an achievement triggerType later without adding one here. Same role
   as state.dailyQuests.cumulativeTotal already plays for the existing
   Daily Quest achievement triggers (see v0.02.4-integration.js) — this
   phase adds the equivalent read model for Main Quest, not new
   achievement definitions or evaluator wiring. */
function ensureQuestHubState(){
  if(!state.questHub||typeof state.questHub!=='object')state.questHub={mainQuests:[],templates:[]};
  if(!Array.isArray(state.questHub.mainQuests))state.questHub.mainQuests=[];
  state.questHub.mainQuests=state.questHub.mainQuests.map(ensureMainQuestShape);
  if(!Array.isArray(state.questHub.templates))state.questHub.templates=[];
  state.questHub.templates=state.questHub.templates.map(ensureMainQuestTemplateShape);
  const cs=(state.questHub.completionStats&&typeof state.questHub.completionStats==='object')?state.questHub.completionStats:{};
  state.questHub.completionStats={
    totalCompleted:Number(cs.totalCompleted||0),
    totalAbandoned:Number(cs.totalAbandoned||0),
    byAreaOfLife:(cs.byAreaOfLife&&typeof cs.byAreaOfLife==='object')?cs.byAreaOfLife:{},
    /* Monotonic "ever completed" count (Phase 3B.6 fixup) — increments
       on a real pending->completed Milestone transition, never
       decrements on reopen (same "achievement progress never regresses"
       convention as dailyQuests.cumulativeTotal and the hydration
       Total/Ever triggers elsewhere in this codebase), so a
       toggle-complete-reopen-complete cycle counts each completion
       event rather than reflecting a live "currently completed" tally. */
    totalMilestonesCompleted:Number(cs.totalMilestonesCompleted||0),
  };
  return state.questHub;
}
function mainQuestFindById(id){return ensureQuestHubState().mainQuests.find(mq=>mq.id===id)||null}
function mainQuestActiveCount(){return ensureQuestHubState().mainQuests.filter(mq=>mq.status==='active').length}

function mainQuestCreateDraft(goalPatch={}){
  const mq=ensureMainQuestShape({goal:{...goalPatch}});
  ensureQuestHubState().mainQuests.push(mq);
  save();
  return mq;
}
/* Write-layer commitment lock (Phase 3A corrections #2/#3) — enforced
   here so no future write path (UI, template instantiation, series
   recurrence) can bypass it by construction, not just by convention.
   Committed = status!=='draft'. Every goal field freezes on commitment
   EXCEPT targetDate, which only freezes if fixedEventDate was true at
   the moment of commitment (see mainQuestActivate below). A passed fixed
   date never changes `status` — that's a paceState/overdue concern for
   the progress engine (3B.2), not a lock/transition concern. */
function mainQuestUpdateGoal(mq,patch){
  if(!mq||!mq.goal)return {ok:false,reason:'not-found'};
  const committed=mq.status!=='draft';
  const dateLocked=Boolean(mq.commitment.fixedEventDateLockedAt);
  const rejectedFields=[];
  Object.keys(patch||{}).forEach(key=>{
    if(key==='targetDate'){
      if(dateLocked)rejectedFields.push(key);
      else mq.goal.targetDate=patch.targetDate;
      return;
    }
    if(committed){rejectedFields.push(key);return}
    mq.goal[key]=patch[key];
  });
  if(rejectedFields.length)return {ok:false,reason:'goal-locked',rejectedFields};
  save();
  return {ok:true};
}
/* Journal write-through (Phase 3B.4) — every automatic/manual Journal
   entry in this whole domain goes through this one function, called
   synchronously inside the SAME mutating function as the state change
   it describes (never a separate step afterward that could be skipped
   or double-fire), so the entry and the mutation are always persisted
   together in the caller's own save(). Does NOT call save() itself —
   callers already do.
   Untrimmed by design (3B.4 fixup) — a Main Quest may run for months or
   years, and the Journal is the permanent record of how it was pursued,
   not a transient log like XP events. If storage growth becomes a real
   problem, introduce an explicit archival policy rather than silently
   discarding history here. */
function mainQuestJournal(mq,type,text,metadata={}){
  mq.journal.push({id:uid(),type,text,createdAt:Date.now(),metadata});
}
function mainQuestAddManualJournalEntry(mq,text){
  if(!mq)return {ok:false,reason:'not-found'};
  const trimmed=String(text||'').trim();
  if(!trimmed)return {ok:false,reason:'empty'};
  mainQuestJournal(mq,'manual',trimmed,{});
  save();
  return {ok:true};
}
function mainQuestActivate(mq){
  if(!mq)return {ok:false,reason:'not-found'};
  if(mq.status!=='draft')return {ok:false,reason:'not-draft'};
  if(mainQuestActiveCount()>=MAIN_QUEST_ACTIVE_CAP)return {ok:false,reason:'active-cap-reached'};
  mq.status='active';
  mq.commitment.committedAt=Date.now();
  if(mq.goal.fixedEventDate)mq.commitment.fixedEventDateLockedAt=Date.now();
  mainQuestJournal(mq,'major-event','Main Quest committed.',{});
  save();
  return {ok:true};
}
function mainQuestPause(mq){
  if(!mq||mq.status!=='active')return {ok:false,reason:'not-active'};
  mq.status='paused';
  mainQuestJournal(mq,'major-event','Main Quest paused.',{});
  save();
  return {ok:true};
}
function mainQuestResume(mq){
  if(!mq||mq.status!=='paused')return {ok:false,reason:'not-paused'};
  if(mainQuestActiveCount()>=MAIN_QUEST_ACTIVE_CAP)return {ok:false,reason:'active-cap-reached'};
  mq.status='active';
  mainQuestJournal(mq,'major-event','Main Quest resumed.',{});
  save();
  return {ok:true};
}
/* ==========================================================================
   MAIN QUEST REWARD ENGINE (Phase 3B.6 — hooks only, 2026-09-12)
   ==========================================================================
   Same guardrail as MAIN_QUEST_PACE_CONFIG (3B.2): the mechanism is real
   and fully wired at the completion transition, but every actual amount
   stays null/undecided in production. A null config makes
   mainQuestResolveReward return {xp:null,gold:null}, which makes
   mainQuestGrantReward no-op entirely — no reward lock is created, no
   popup fires, mq.reward stays {granted:false}. Tests inject their own
   config (mainQuestResolveReward's second argument) to exercise the
   resolver without ever setting real numbers here, exactly like
   mainQuestDerivePaceState's config argument. Difficulty-keyed because
   MAIN_QUEST_DIFFICULTY's own comment already flagged "no reward
   multipliers attached yet" as the open decision this fills in later. */
const MAIN_QUEST_REWARD_CONFIG={
  xpByDifficulty:null,   // e.g. {easy:...,standard:...,hard:...,epic:...} once decided
  goldByDifficulty:null,
};
function mainQuestResolveReward(mq,config=MAIN_QUEST_REWARD_CONFIG){
  if(!config.xpByDifficulty||!config.goldByDifficulty)return {xp:null,gold:null};
  const diff=mq.goal.difficultyId||'standard';
  return {xp:Number(config.xpByDifficulty[diff]||0),gold:Number(config.goldByDifficulty[diff]||0)};
}
function mainQuestRewardLockKey(mq){return rewardLockKey('mainQuest',mq.id,todayISO())}
/* Reuses the SAME protected-reward idiom as every other reward path in
   this codebase (rewardLockKey+grantProtectedReward) rather than a
   bespoke Main Quest-only grant path, so "already rewarded" is
   idempotent by the same construction as Side/Quick Quests and the
   Daily Quest, not a new mechanism to keep in sync with theirs. Called
   from mainQuestComplete below; harmless no-op while config is null. */
function mainQuestGrantReward(mq){
  if(!mq||mq.status!=='completed')return {ok:false,reason:'not-completed'};
  if(mq.reward.granted)return {ok:false,reason:'already-granted'};
  const resolved=mainQuestResolveReward(mq);
  if(resolved.xp==null||resolved.gold==null)return {ok:false,reason:'reward-not-configured'};
  const granted=grantProtectedReward(mainQuestRewardLockKey(mq),{xp:resolved.xp,label:'MAIN QUEST COMPLETE',detail:mq.goal.title});
  if(!granted)return {ok:false,reason:'already-granted'};
  if(resolved.gold)state.gold=Number(state.gold||0)+resolved.gold;
  mq.reward={granted:true,grantedAt:Date.now(),xp:resolved.xp,gold:resolved.gold};
  save();
  return {ok:true};
}

function mainQuestComplete(mq){
  if(!mq||!['active','paused'].includes(mq.status))return {ok:false,reason:'not-active-or-paused'};
  mq.status='completed';
  mq.completedAt=Date.now();
  mainQuestJournal(mq,'completion','Main Quest completed.',{});
  const stats=ensureQuestHubState().completionStats;
  stats.totalCompleted+=1;
  if(mq.goal.areaOfLife)stats.byAreaOfLife[mq.goal.areaOfLife]=Number(stats.byAreaOfLife[mq.goal.areaOfLife]||0)+1;
  mainQuestGrantReward(mq);
  save();
  return {ok:true};
}
/* wasCommitted gate (3B.6 fixup) — Abandon Draft intentionally routes
   an uncommitted draft through this same 'abandoned' transition so it
   stays visible in History, but a draft was never a committed
   player-pursued Main Quest, so it must not count toward
   completionStats.totalAbandoned (that stat exists for future
   achievements like "abandoned N committed Main Quests," which a
   create-then-discard-drafts loop must not be able to inflate).
   Detectable from the historical record itself (status:'abandoned' +
   commitment.committedAt===null) without a separate counter. */
function mainQuestAbandon(mq){
  if(!mq||mq.status==='completed')return {ok:false,reason:'already-completed'};
  /* No-op guard (found by this fixup's own "increments exactly once"
     proof — a repeat call on an already-abandoned quest re-journaled a
     duplicate 'major-event' entry AND double-counted totalAbandoned,
     since only 'completed' was excluded above). Same idempotency-by-
     construction pattern as mainQuestSetMilestoneStatus's unchanged-
     status guard. */
  if(mq.status==='abandoned')return {ok:true,unchanged:true};
  const wasCommitted=Boolean(mq.commitment?.committedAt);
  mq.status='abandoned';
  mainQuestJournal(mq,'major-event','Main Quest abandoned.',{});
  if(wasCommitted)ensureQuestHubState().completionStats.totalAbandoned+=1;
  save();
  return {ok:true};
}

/* Template = reusable design. Series = recurring sequence (seriesId/
   recurrenceRule/previousInstanceId/nextInstanceId only — no separate
   series object). Instance = one real historical mainQuests[] record.
   All three are independent (Phase 3A correction #10): an instance can
   carry a templateId, a seriesId, both, or neither. */
function mainQuestSaveAsTemplate(mq){
  if(!mq)return {ok:false,reason:'not-found'};
  const tpl=ensureMainQuestTemplateShape({
    title:mq.goal.title,
    description:mq.goal.description,
    areaOfLife:mq.goal.areaOfLife,
    difficultyId:mq.goal.difficultyId,
    sections:JSON.parse(JSON.stringify(mq.plan.sections)),
    milestones:JSON.parse(JSON.stringify(mq.plan.milestones)),
    recurringGoals:JSON.parse(JSON.stringify(mq.plan.recurringGoals)),
    scheduledActivities:JSON.parse(JSON.stringify(mq.plan.scheduledActivities)),
  });
  ensureQuestHubState().templates.push(tpl);
  save();
  return {ok:true,template:tpl};
}
function mainQuestCreateFromTemplate(templateId,overrides={}){
  const tpl=ensureQuestHubState().templates.find(t=>t.id===templateId);
  if(!tpl)return {ok:false,reason:'template-not-found'};
  const mq=ensureMainQuestShape({
    goal:{
      title:overrides.title||tpl.title,
      description:overrides.description||tpl.description,
      areaOfLife:overrides.areaOfLife||tpl.areaOfLife,
      difficultyId:overrides.difficultyId||tpl.difficultyId,
      priority:overrides.priority,
      successCriteria:overrides.successCriteria,
      targetDate:overrides.targetDate||null,
      fixedEventDate:Boolean(overrides.fixedEventDate),
    },
    plan:{
      sections:JSON.parse(JSON.stringify(tpl.sections)),
      milestones:JSON.parse(JSON.stringify(tpl.milestones)),
      recurringGoals:JSON.parse(JSON.stringify(tpl.recurringGoals)),
      scheduledActivities:JSON.parse(JSON.stringify(tpl.scheduledActivities)),
    },
  });
  mq.templateId=tpl.id;
  ensureQuestHubState().mainQuests.push(mq);
  save();
  return {ok:true,mainQuest:mq};
}
function mainQuestDeleteTemplate(templateId){
  const hub=ensureQuestHubState();
  const idx=hub.templates.findIndex(t=>t.id===templateId);
  if(idx<0)return {ok:false,reason:'not-found'};
  hub.templates.splice(idx,1);
  save();
  return {ok:true};
}
/* Spawns the next historical instance in a recurring series. targetDate
   and scheduledActivities are NOT carried forward — a new occurrence
   starts as its own draft the player recommits (new dates, fresh
   milestone-completion state); recurrenceRule is snapshotted onto the
   new instance so a later edit to `mq`'s rule doesn't retroactively
   change an already-spawned occurrence. */
function mainQuestSpawnNextInSeries(mq){
  if(!mq)return {ok:false,reason:'not-found'};
  const seriesId=mq.seriesId||mq.id;
  if(!mq.seriesId)mq.seriesId=seriesId;
  const next=ensureMainQuestShape({
    goal:{...mq.goal,targetDate:null,fixedEventDate:false},
    plan:{
      sections:JSON.parse(JSON.stringify(mq.plan.sections)),
      milestones:JSON.parse(JSON.stringify(mq.plan.milestones)).map(m=>({...m,status:'pending',completedAt:null})),
      recurringGoals:JSON.parse(JSON.stringify(mq.plan.recurringGoals)),
      scheduledActivities:[],
    },
  });
  next.seriesId=seriesId;
  next.recurrenceRule=mq.recurrenceRule?{...mq.recurrenceRule}:null;
  next.previousInstanceId=mq.id;
  next.templateId=mq.templateId;
  mq.nextInstanceId=next.id;
  mainQuestJournal(mq,'major-event',`Next occurrence spawned: ${next.goal.title}`,{nextInstanceId:next.id});
  ensureQuestHubState().mainQuests.push(next);
  save();
  return {ok:true,mainQuest:next};
}

/* ==========================================================================
   MAIN QUEST PROGRESS ENGINE (Phase 3B.2 — Quests domain, 2026-09-12)
   ==========================================================================
   Reusable progressRule objects, resolved by the SAME dispatcher whether
   they live at quest level (mq.progress.progressRule), on a single
   Milestone, or on a single RecurringGoal — one shape definition, one
   resolver, no per-level duplication. Mirrors the division-dispatch
   pattern questProgressFor() already established for Adventures.

   Evidence types read Training/Personal Growth state directly and never
   copy it — resolveTrainingEvidence/resolvePersonalGrowthEvidence are
   pure reads. Nothing in this section writes into state.activities or
   state.personalGrowth.

   Deliberately NOT built here: the shared schedule aggregator (3B.3) —
   mainQuestRecurringGoalOccurrenceDates/mainQuestLogRecurringGoalOccurrence
   below are the pure day-selection/ledger logic only, no calendar
   surfacing. Journal auto-entries for plan changes (3B.4), any Quests-
   page UI (3B.5), and reward/achievement wiring (3B.6) are also out of
   scope. mainQuestSpawnNextInSeries (above, Phase 3B.1) is NOT extended
   here — recurrence-rule interpretation/auto-spawning stays exactly as
   linkage-only until a later phase actually needs more. */

/* Centralized pace-tolerance configuration (Phase 3A correction #4 /
   Phase 3B clarification #2) — bucketed by ratio = current/expected.
   Deliberately unset (Phase 3B.2 fixup, 2026-09-12): the real Ahead/On
   Track/At Risk/Behind bands are an explicit open decision, not made
   here, and even a comment-flagged placeholder number still produces a
   real classification the moment it's read — that's a design decision
   happening by accident, not a proof of mechanism. mainQuestDerivePaceState
   computes `expected` regardless, but returns paceState:null whenever
   any threshold here is null, rather than silently applying invented
   bands. Tests inject their own config object (see mainQuestDerivePaceState's
   second argument) to exercise all four branches without ever setting
   real numbers here. One object to edit once the real decision lands —
   never scatter threshold numbers through the resolver functions
   themselves. */
const MAIN_QUEST_PACE_CONFIG={
  aheadRatio:null,
  onTrackRatio:null,
  atRiskRatio:null,
  // ratio below atRiskRatio => 'behind' — also inert while thresholds are null.
};

function ensureMainQuestSectionShape(s){
  s=(s&&typeof s==='object')?s:{};
  s.id=s.id||uid();
  s.title=String(s.title||'');
  s.order=Number(s.order||0);
  /* Persisted transition-edge tracker (Phase 3B.4) — Sections have no
     status field of their own (completion is derived, see
     mainQuestSectionProgress), so this is the only way
     mainQuestRefreshProgress can tell "just reached 100%, journal it
     once" apart from "already was 100% last refresh, say nothing" on
     every subsequent call. */
  s.lastKnownComplete=Boolean(s.lastKnownComplete);
  return s;
}
function ensureMainQuestMilestoneShape(m){
  m=(m&&typeof m==='object')?m:{};
  m.id=m.id||uid();
  m.title=String(m.title||'');
  m.order=Number(m.order||0);
  m.sectionId=m.sectionId||null;
  m.status=['pending','completed'].includes(m.status)?m.status:'pending';
  m.completedAt=m.completedAt||null;
  m.progressRule=(m.progressRule&&typeof m.progressRule==='object')?m.progressRule:null;
  return m;
}
function ensureMainQuestRecurringGoalShape(rg){
  rg=(rg&&typeof rg==='object')?rg:{};
  rg.id=rg.id||uid();
  rg.title=String(rg.title||'');
  rg.sectionId=rg.sectionId||null;
  const rec=(rg.recurrence&&typeof rg.recurrence==='object')?rg.recurrence:{};
  rg.recurrence={
    frequency:['weekly','daily'].includes(rec.frequency)?rec.frequency:'weekly',
    targetCount:Number(rec.targetCount||1),
    /* May be empty — "any N days this week" (Phase 3A correction #7). */
    selectedDays:Array.isArray(rec.selectedDays)?rec.selectedDays.filter(d=>WEEKDAY_ABBR.includes(d)):[],
  };
  rg.progressRule=(rg.progressRule&&typeof rg.progressRule==='object')?rg.progressRule:null;
  rg.ledger=(rg.ledger&&typeof rg.ledger==='object')?rg.ledger:{};
  return rg;
}

/* Plan-mutating CRUD below journals a 'plan-change' entry atomically with
   the mutation itself (Phase 3B.4) — the journal push and the actual
   plan edit happen inside the same function call, so there is no
   window where one could persist without the other. */
function mainQuestAddSection(mq,patch={}){const s=ensureMainQuestSectionShape(patch);mq.plan.sections.push(s);mainQuestJournal(mq,'plan-change',`Section added: ${s.title}`,{sectionId:s.id});save();return s}
function mainQuestAddMilestone(mq,patch={}){const m=ensureMainQuestMilestoneShape(patch);mq.plan.milestones.push(m);mainQuestJournal(mq,'plan-change',`Milestone added: ${m.title}`,{milestoneId:m.id});save();return m}
function mainQuestAddRecurringGoal(mq,patch={}){const rg=ensureMainQuestRecurringGoalShape(patch);mq.plan.recurringGoals.push(rg);mainQuestJournal(mq,'plan-change',`Recurring Goal added: ${rg.title}`,{recurringGoalId:rg.id});save();return rg}
/* Signature changed from (milestone,status) to (mq,milestone,status)
   this phase — journaling needs the owning quest, and there is no
   cheap way to find "which quest owns this milestone" without an O(n)
   search across every quest, so the caller (which already has mq in
   scope either way) now passes it explicitly. The unchanged-status
   no-op guard is what makes this idempotent under repeated calls —
   mainQuestRefreshProgress's own auto-complete loop already only calls
   this when a real transition is happening, but the guard here means
   that's true by construction, not just by caller discipline. This is
   the SAME function both manual completion (a direct call) and
   evidence-driven completion (mainQuestRefreshProgress's auto-complete
   loop) go through — one transition point, one Journal event, by
   construction, never two separate code paths that could drift. */
function mainQuestSetMilestoneStatus(mq,milestone,status){
  if(!mq||!milestone)return {ok:false,reason:'not-found'};
  if(!['pending','completed'].includes(status))return {ok:false,reason:'invalid-status'};
  if(milestone.status===status)return {ok:true,unchanged:true};
  milestone.status=status;
  milestone.completedAt=status==='completed'?Date.now():null;
  if(status==='completed'){
    const stats=ensureQuestHubState().completionStats;
    stats.totalMilestonesCompleted=Number(stats.totalMilestonesCompleted||0)+1;
  }
  mainQuestJournal(mq,'milestone',status==='completed'?`Milestone completed: ${milestone.title}`:`Milestone reopened: ${milestone.title}`,{milestoneId:milestone.id});
  save();
  return {ok:true};
}

/* Monday-start week helpers — functionally identical to the existing
   weekDates()/pgWeekDays() (both already do the same Monday-based ISO
   week math); kept as Main-Quest-named copies rather than reused
   directly since those two return "the week containing today" with no
   parameter, while Recurring Goal compliance needs to compute an
   arbitrary week's bounds (ledger keys), not always the current one. */
function mainQuestWeekStart(iso=todayISO()){
  const d=dateFromISO(iso),dow=(d.getDay()+6)%7;
  d.setDate(d.getDate()-dow);
  return localISO(d);
}
function mainQuestWeekDates(weekStartIso){
  const start=dateFromISO(weekStartIso);
  return Array.from({length:7},(_,i)=>{const x=new Date(start);x.setDate(start.getDate()+i);return localISO(x)});
}
function mainQuestRecurringGoalScheduledOn(rg,iso){
  const days=rg.recurrence?.selectedDays;
  if(!Array.isArray(days)||!days.length)return true;
  return days.includes(WEEKDAY_ABBR[dateFromISO(iso).getDay()]);
}
function mainQuestRecurringGoalOccurrenceDates(rg,weekStartIso){
  return mainQuestWeekDates(weekStartIso).filter(iso=>mainQuestRecurringGoalScheduledOn(rg,iso));
}
/* Diagnostic-level occurrence logging only (Phase 3B.2 has no calendar
   UI to drive this from — that's 3B.3). Manually-logged dates are the
   fallback compliance source when a Recurring Goal has no progressRule
   of its own; see mainQuestRecurringGoalWeekCount below. */
function mainQuestLogRecurringGoalOccurrence(rg,iso,done=true){
  const week=mainQuestWeekStart(iso);
  if(!rg.ledger[week]||typeof rg.ledger[week]!=='object')rg.ledger[week]={dates:{}};
  rg.ledger[week].dates[iso]=Boolean(done);
  save();
  return {ok:true};
}
function mainQuestRecurringGoalWeekCount(rg,weekStartIso,mq){
  if(rg.progressRule){
    const weekDates=mainQuestWeekDates(weekStartIso);
    const scoped=resolveProgressRule(rg.progressRule,{mq,dateRange:{since:weekDates[0],until:weekDates[6]}});
    return Math.round(Number(scoped.current)||0);
  }
  const week=rg.ledger[weekStartIso];
  if(!week||!week.dates)return 0;
  return Object.values(week.dates).filter(Boolean).length;
}

/* ---- Resolver dispatch ---- */
function resolveTrainingEvidence(rule,context={}){
  const filters=rule.filters||{};
  const since=(context.dateRange&&context.dateRange.since)||filters.since||null;
  const until=(context.dateRange&&context.dateRange.until)||filters.until||null;
  const types=Array.isArray(filters.activityTypes)?filters.activityTypes:null;
  const matches=state.activities.filter(a=>{
    if(!a.completed)return false;
    if(types&&!types.includes(a.type))return false;
    if(since&&a.date<since)return false;
    if(until&&a.date>until)return false;
    return true;
  });
  const metric=rule.metric||'count';
  let current=0;
  if(metric==='distance')current=matches.reduce((s,a)=>s+Number(a.distance||0),0);
  else if(metric==='duration')current=matches.reduce((s,a)=>s+Number(a.duration||0),0);
  else current=matches.length;
  return {current,target:rule.target==null?null:Number(rule.target),unit:rule.unit||null};
}
function resolvePersonalGrowthEvidence(rule){
  const tracker=ensurePersonalGrowth().trackers.find(t=>t.id===rule.trackerId);
  if(!tracker)return {current:0,target:rule.target==null?null:Number(rule.target),unit:rule.unit||null};
  const stats=pgTrackerStats(tracker);
  const metric=['current','best','total'].includes(rule.metric)?rule.metric:'total';
  return {current:Number(stats[metric]||0),target:rule.target==null?null:Number(rule.target),unit:rule.unit||null};
}
function resolveMilestonesDerived(rule,mq){
  if(!mq)return {current:0,target:0,unit:'milestones'};
  const scoped=mq.plan.milestones.filter(m=>!rule.sectionId||m.sectionId===rule.sectionId);
  return {current:scoped.filter(m=>m.status==='completed').length,target:scoped.length,unit:'milestones'};
}
function resolveRecurringGoalCompliance(rule,mq){
  const fallback={current:0,target:rule.target==null?null:Number(rule.target),unit:rule.unit||'weeks'};
  if(!mq)return fallback;
  const rg=mq.plan.recurringGoals.find(x=>x.id===rule.recurringGoalId);
  if(!rg)return fallback;
  const weeks=Object.keys(rg.ledger);
  const target=Number(rg.recurrence.targetCount||1);
  const compliantWeeks=weeks.filter(w=>mainQuestRecurringGoalWeekCount(rg,w,mq)>=target).length;
  return {current:compliantWeeks,target:rule.target==null?null:Number(rule.target),unit:rule.unit||'weeks'};
}
function resolveHybridProgress(rule,context={}){
  const components=Array.isArray(rule.components)?rule.components:[];
  if(!components.length)return {current:0,target:100,unit:'%'};
  let weightedSum=0,weightTotal=0;
  components.forEach(c=>{
    const weight=Number(c.weight)>0?Number(c.weight):1;
    const r=resolveProgressRule(c.progressRule,context);
    const ratio=r.target?clamp(r.current/r.target,0,1):(r.current>0?1:0);
    weightedSum+=ratio*weight;
    weightTotal+=weight;
  });
  return {current:weightTotal?Math.round((weightedSum/weightTotal)*100):0,target:100,unit:'%'};
}
/* The single dispatcher every level (quest/Milestone/RecurringGoal/
   hybrid component) calls through — one shape, one place that knows how
   to read it. `context.mq` supplies the owning quest for the types that
   need to read its own plan; `context.dateRange` lets a caller (Recurring
   Goal weekly compliance) scope an otherwise-unbounded evidence rule to
   a specific window without mutating the rule object itself. */
function resolveProgressRule(rule,context={}){
  if(!rule)return {current:0,target:null,unit:null};
  switch(rule.type){
    case 'numeric':return {current:Number(rule.current||0),target:rule.target==null?null:Number(rule.target),unit:rule.unit||null};
    case 'manual':return {current:Number(rule.percent||0),target:100,unit:'%'};
    case 'training-evidence':return resolveTrainingEvidence(rule,context);
    case 'personalGrowth-evidence':return resolvePersonalGrowthEvidence(rule);
    case 'milestones-derived':return resolveMilestonesDerived(rule,context.mq);
    case 'recurringGoal-compliance':return resolveRecurringGoalCompliance(rule,context.mq);
    case 'hybrid':return resolveHybridProgress(rule,context);
    default:return {current:0,target:null,unit:null};
  }
}
function mainQuestSetNumericProgress(rule,value){
  if(!rule||rule.type!=='numeric')return {ok:false,reason:'not-numeric-rule'};
  rule.current=Number(value||0);save();return {ok:true};
}
function mainQuestSetManualProgress(rule,percent){
  if(!rule||rule.type!=='manual')return {ok:false,reason:'not-manual-rule'};
  rule.percent=clamp(Number(percent||0),0,100);save();return {ok:true};
}
function mainQuestSetProgressRule(mq,rule){
  if(!mq)return {ok:false,reason:'not-found'};
  mq.progress.progressRule=rule?{...rule}:null;
  return mainQuestRefreshProgress(mq);
}

/* ---- Per-item progress (used by Section aggregation and plan-derived
   quest-level progress when the quest has no top-level progressRule) ---- */
function mainQuestMilestoneProgress(milestone,mq){
  if(milestone.progressRule)return resolveProgressRule(milestone.progressRule,{mq});
  return {current:milestone.status==='completed'?1:0,target:1,unit:'milestone'};
}
function mainQuestRecurringGoalProgress(rg,mq){
  const weekStart=mainQuestWeekStart();
  return {current:mainQuestRecurringGoalWeekCount(rg,weekStart,mq),target:Number(rg.recurrence.targetCount||0),unit:'occurrences'};
}
function mainQuestItemRatio(current,target,fallbackDone){
  if(target)return clamp(current/target,0,1);
  return fallbackDone?1:0;
}
/* Equal weighting only (Phase 3A correction #6 / Phase 3B: custom
   weighting not approved) — every Milestone and RecurringGoal tagged to
   this Section counts once, regardless of type. */
function mainQuestSectionProgress(section,mq){
  const milestones=mq.plan.milestones.filter(m=>m.sectionId===section.id);
  const recurringGoals=mq.plan.recurringGoals.filter(rg=>rg.sectionId===section.id);
  const ratios=[
    ...milestones.map(m=>{const r=mainQuestMilestoneProgress(m,mq);return mainQuestItemRatio(r.current,r.target,m.status==='completed')}),
    ...recurringGoals.map(rg=>{const r=mainQuestRecurringGoalProgress(rg,mq);return mainQuestItemRatio(r.current,r.target,false)}),
  ];
  if(!ratios.length)return {current:0,target:100,unit:'%',itemCount:0};
  return {current:Math.round(ratios.reduce((s,x)=>s+x,0)/ratios.length*100),target:100,unit:'%',itemCount:ratios.length};
}
/* Same equal-weight ratio-averaging as Section progress, but flat across
   the WHOLE plan (sections are pure grouping — never double-counted).
   Used only when the quest has no top-level progress.progressRule. */
function mainQuestDerivedPlanProgress(mq){
  const ratios=[
    ...mq.plan.milestones.map(m=>{const r=mainQuestMilestoneProgress(m,mq);return mainQuestItemRatio(r.current,r.target,m.status==='completed')}),
    ...mq.plan.recurringGoals.map(rg=>{const r=mainQuestRecurringGoalProgress(rg,mq);return mainQuestItemRatio(r.current,r.target,false)}),
  ];
  if(!ratios.length)return {current:0,target:100,unit:'%'};
  return {current:Math.round(ratios.reduce((s,x)=>s+x,0)/ratios.length*100),target:100,unit:'%'};
}

/* ---- Pace derivation ---- */
/* Pure numeric derivation only — the 'paused' state is handled by the
   orchestrator below directly from mq.status, never computed here.
   `expected` is always computable once a quest has a targetDate and is
   committed, independent of whether real thresholds have been decided
   yet — so it's always returned when available. `paceState` is a
   DIFFERENT question (which band does the ratio fall in?) and stays
   null whenever config is missing any threshold (the production
   default, see MAIN_QUEST_PACE_CONFIG) rather than silently applying
   invented bands. Callers that need to prove all four branches pass
   their own config as the second argument — production code never
   does. */
function mainQuestDerivePaceState(mq,config=MAIN_QUEST_PACE_CONFIG){
  const {current,target}=mq.progress;
  if(target==null||!mq.goal.targetDate||!mq.commitment.committedAt)return null;
  const start=mq.commitment.committedAt;
  const end=dateFromISO(mq.goal.targetDate).getTime();
  const now=Date.now();
  const timeFraction=(end-start)>0?clamp((now-start)/(end-start),0,1):1;
  const expected=Number(target)*timeFraction;
  if(config.aheadRatio==null||config.onTrackRatio==null||config.atRiskRatio==null){
    return {expected,paceState:null};
  }
  const ratio=expected>0?current/expected:(current>0?2:1);
  let paceState;
  if(ratio>=config.aheadRatio)paceState='ahead';
  else if(ratio>=config.onTrackRatio)paceState='on_track';
  else if(ratio>=config.atRiskRatio)paceState='at_risk';
  else paceState='behind';
  return {expected,paceState};
}
/* The single entry point that ties the whole engine together: resolves
   quest-level current/target/unit (top-level progressRule if set, else
   derived equally from the whole plan), auto-completes any Milestone
   whose own progressRule has reached its target, and derives paceState
   (short-circuited to 'paused' directly from status, never computed
   numerically). Callers (tests, and later the Quests-page UI) call this
   after any change that could move the needle rather than re-deriving
   pieces of it themselves. */
function mainQuestRefreshProgress(mq){
  if(!mq)return {ok:false,reason:'not-found'};
  mq.plan.milestones.forEach(m=>{
    if(m.progressRule&&m.status!=='completed'){
      const r=resolveProgressRule(m.progressRule,{mq});
      if(r.target!=null&&r.current>=r.target)mainQuestSetMilestoneStatus(mq,m,'completed');
    }
  });
  /* Section completion journaling (Phase 3B.4) — fires exactly once per
     section, on the false->true edge of lastKnownComplete, never
     re-fires on subsequent refreshes once already complete (idempotent
     by construction, same edge-detection principle as the Milestone
     no-op guard above). itemCount>0 guard means an empty Section (no
     Milestones/Recurring Goals tagged to it yet) is never reported
     complete — mainQuestSectionProgress's own 0-item fallback is
     current:0, which would otherwise read as 0>=100 being false anyway,
     but the explicit guard makes the intent clear rather than relying
     on that coincidence. */
  mq.plan.sections.forEach(s=>{
    const prog=mainQuestSectionProgress(s,mq);
    const isComplete=prog.itemCount>0&&prog.current>=100;
    if(isComplete&&!s.lastKnownComplete)mainQuestJournal(mq,'section',`Section completed: ${s.title}`,{sectionId:s.id});
    s.lastKnownComplete=isComplete;
  });
  const rule=mq.progress.progressRule;
  const resolved=rule?resolveProgressRule(rule,{mq}):mainQuestDerivedPlanProgress(mq);
  mq.progress.mode=rule?rule.type:'derived-from-plan';
  mq.progress.current=resolved.current;
  mq.progress.target=resolved.target;
  mq.progress.unit=resolved.unit;
  if(mq.status==='paused'){
    mq.progress.paceState='paused';
    mq.progress.expected=null;
  }else{
    const paceResult=mainQuestDerivePaceState(mq);
    mq.progress.expected=paceResult?paceResult.expected:null;
    mq.progress.paceState=paceResult?paceResult.paceState:null;
  }
  mq.progress.updatedAt=Date.now();
  save();
  return {ok:true,progress:mq.progress};
}

function ensureMainQuestScheduledActivityShape(sa){
  sa=(sa&&typeof sa==='object')?sa:{};
  sa.id=sa.id||uid();
  sa.title=String(sa.title||'');
  sa.date=sa.date||null;
  sa.time=sa.time||'Any';
  sa.done=Boolean(sa.done);
  sa.sectionId=sa.sectionId||null;
  return sa;
}
function mainQuestAddScheduledActivity(mq,patch={}){const sa=ensureMainQuestScheduledActivityShape(patch);mq.plan.scheduledActivities.push(sa);mainQuestJournal(mq,'plan-change',`Scheduled Activity added: ${sa.title}`,{scheduledActivityId:sa.id});save();return sa}
/* Signature changed from (sa,done) to (mq,sa,done) this phase, same
   reasoning as mainQuestSetMilestoneStatus above — journaling needs the
   owning quest. */
/* Executing a Scheduled Activity is not a change to the plan (3B.4
   fixup) — it's carrying the plan out. Milestones, Sections, Check-ins
   and final completion already provide the meaningful progress record;
   no Journal entry here. A dedicated activity/event Journal type can be
   added later if per-task completion history is wanted. */
function mainQuestSetScheduledActivityDone(mq,sa,done){
  if(!mq||!sa)return {ok:false,reason:'not-found'};
  sa.done=Boolean(done);
  save();
  return {ok:true};
}

/* ==========================================================================
   SHARED SCHEDULE ARCHITECTURE (Phase 3B.3 — cross-domain, 2026-09-12)
   ==========================================================================
   sharedScheduleItemsForDate(date) is infrastructure, not a Main Quest
   helper: it composes one normalized row array from every domain's OWN
   provider function, none of which becomes authoritative storage in the
   process — a provider reads state.activities/state.personalGrowth/
   state.tasks/state.quest/state.questHub and returns plain read-only
   rows; nothing here writes back into any of those domains, and nothing
   here duplicates their data into a new store of its own.

   Normalized row shape — every provider returns objects shaped exactly
   like this (same shape homeScheduleItemsForDate/scheduleItems already
   used before this phase, now centralized in one place instead of
   copied across three-plus call sites):
     { time, title, sub, kind, done, sourceType?, sourceId? }
   `time` doubles as the sort key via the shared rank() below (unchanged
   from the pre-3B.3 behavior: 'Quest' first, real 'HH:MM' times in
   between, 'Task' last, everything else — 'Any' — sorts after real
   times, same as always). `kind` stays 'quest' for the EXISTING single
   Daily Quest (state.quest) — that internal string is untouched, per
   the standing "internals stay, only the new system gets new naming"
   rule — and 'activity'/'task' for Training/Tasks, both also unchanged.
   'personalGrowth' and 'mainQuest' are the two new kinds this phase
   adds. `sourceType`/`sourceId` are optional passthrough so a future
   consumer can look up the underlying record; today's consumers only
   read time/title/sub/kind/done, same as before this phase. */
function scheduleProviderDailyQuest(date){
  if(!(state.quest&&state.quest.title&&state.quest.date===date))return [];
  return [{time:'Quest',title:state.quest.title,sub:state.quest.rewarded?'Main Quest · complete':'Main Quest',kind:'quest',done:Boolean(state.quest.rewarded),sourceType:'dailyQuest',sourceId:state.quest.id}];
}
function scheduleProviderTraining(date){
  /* title/category/status fallbacks match homeScheduleItemsForDate's
     pre-3B.3 defensiveness (the stricter of the two prior
     implementations) rather than scheduleItems'/calendarEventsFor's
     plainer a.name/a.type/a.completed-only reads — consolidating onto
     one provider must not narrow the more defensive of the two. */
  return state.activities.filter(a=>a.date===date).map(a=>{
    const title=a.title||a.name,cat=a.category||a.type||'Training',done=a.status==='complete'||a.completed;
    return {time:a.startTime||a.time||'Any',title,sub:`${cat}${done?' · complete':''}`,kind:'activity',done,sourceType:'training',sourceId:a.id};
  });
}
/* New this phase — Personal Growth trackers were never in any schedule
   feed before 3B.3; a scheduled tracker now surfaces here every day
   pgScheduledOn() says it's due, same day-selection logic PG's own
   Overview already uses. */
function scheduleProviderPersonalGrowth(date){
  return ensurePersonalGrowth().trackers.filter(t=>pgScheduledOn(t,date)).map(t=>({
    time:'Any',title:t.name,sub:String(t.category||'Personal Growth'),
    kind:'personalGrowth',done:pgEntryComplete(t,date),sourceType:'personalGrowth',sourceId:t.id,
  }));
}
function scheduleProviderTasks(date){
  return state.tasks.filter(x=>x.date===date&&!x.done).map(x=>({
    time:'Task',title:x.text,sub:`${x.difficulty} · ${x.bucket}`,
    kind:'task',done:false,sourceType:'task',sourceId:x.id,
  }));
}
/* Scheduled Activities, selected-day Recurring Goal occurrences (surfaced
   as Main Quest Tasks — time:'Task', same sort bucket real Tasks use),
   Weekly Check-in rows, and target-date events — all read-only against
   state.questHub, never written here. Milestone date events are
   deliberately NOT emitted: the current Milestone shape (Phase 3B.2) has
   no date field at all, so there is nothing to surface — inventing one
   here would be building model, not aggregating it. Only active/paused
   quests contribute rows; a draft hasn't been committed to, and a
   completed/abandoned quest's schedule is history, not upcoming. */
function scheduleProviderMainQuest(date){
  const rows=[];
  ensureQuestHubState().mainQuests.filter(mq=>mq.status==='active'||mq.status==='paused').forEach(mq=>{
    mq.plan.scheduledActivities.filter(sa=>sa.date===date).forEach(sa=>{
      rows.push({time:sa.time||'Any',title:sa.title,sub:mq.goal.title,kind:'mainQuest',done:Boolean(sa.done),sourceType:'mainQuest',sourceId:mq.id});
    });
    mq.plan.recurringGoals.forEach(rg=>{
      if(!mainQuestRecurringGoalScheduledOn(rg,date))return;
      const weekStart=mainQuestWeekStart(date);
      const doneToday=Boolean(rg.ledger[weekStart]&&rg.ledger[weekStart].dates&&rg.ledger[weekStart].dates[date]);
      rows.push({time:'Task',title:rg.title,sub:`Main Quest Task · ${mq.goal.title}`,kind:'mainQuest',done:doneToday,sourceType:'mainQuest',sourceId:mq.id});
    });
    if(mq.checkIns.enabled&&mq.checkIns.weekday&&WEEKDAY_ABBR[dateFromISO(date).getDay()]===mq.checkIns.weekday){
      /* Reflects real occurrence state as of Phase 3B.4 — a read-only
         lookup (never creates the occurrence; that's
         mainQuestEnsureCheckInOccurrence's job, called from the daily
         maintenance pass, not from a provider). 'completed' and
         'acknowledged' both count as done for schedule-row purposes —
         either way nothing about that week's check-in still needs the
         player's attention. A 'pending' or 'missed' entry, or no entry
         yet at all, is not done. */
      const weekStart=mainQuestWeekStart(date);
      const entry=mq.checkIns.entries.find(e=>e.weekStart===weekStart);
      const checkInDone=Boolean(entry&&['completed','acknowledged'].includes(entry.status));
      rows.push({time:mq.checkIns.time||'Any',title:'Weekly Check-in',sub:mq.goal.title,kind:'mainQuest',done:checkInDone,sourceType:'mainQuest',sourceId:mq.id});
    }
    if(mq.goal.targetDate===date){
      rows.push({time:'Any',title:mq.goal.title,sub:'Main Quest target date',kind:'mainQuest',done:mq.status==='completed',sourceType:'mainQuest',sourceId:mq.id});
    }
  });
  return rows;
}
const SHARED_SCHEDULE_PROVIDERS=[scheduleProviderDailyQuest,scheduleProviderTraining,scheduleProviderPersonalGrowth,scheduleProviderTasks,scheduleProviderMainQuest];
/* The single entry point every consumer (Adventurer's Log's Calendar,
   Home's schedule column, the Today-panel Tomorrow preview) now calls
   through, instead of each re-implementing the same provider+sort logic
   independently. Providers are flattened, defensively de-duplicated
   (identical kind+sourceType+sourceId+time+title collapses to one row —
   guards against a provider bug or double-registration; no known path
   produces a real duplicate today, since each provider reads a disjoint
   state domain), then sorted by the same rank() every pre-3B.3 schedule
   function already used, unchanged. */
function sharedScheduleItemsForDate(date=todayISO()){
  const items=SHARED_SCHEDULE_PROVIDERS.flatMap(fn=>fn(date));
  const seen=new Set();
  const deduped=items.filter(item=>{
    const key=[item.kind,item.sourceType||'',item.sourceId??'',item.time,item.title].join('|');
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
  const rank=x=>x.time==='Quest'?'00:00':x.time==='Task'?'99:00':String(x.time);
  return deduped.sort((a,b)=>rank(a).localeCompare(rank(b)));
}

/* ==========================================================================
   MAIN QUEST WEEKLY CHECK-INS (Phase 3B.4 — Quests domain, 2026-09-12)
   ==========================================================================
   pending -> missed -> acknowledged/completed. An occurrence is created
   lazily (mainQuestEnsureCheckInOccurrence) rather than pre-populated for
   every future week, and finalized to 'missed' only by the daily
   maintenance pass below — never by a read path like the schedule
   provider, which stays read-only per the 3B.3 aggregator rule. */
function ensureMainQuestCheckInEntryShape(e){
  e=(e&&typeof e==='object')?e:{};
  e.id=e.id||uid();
  e.weekStart=e.weekStart||mainQuestWeekStart();
  e.status=['pending','missed','acknowledged','completed'].includes(e.status)?e.status:'pending';
  e.rating=e.rating==null?null:Number(e.rating);
  e.progressMatch=['yes','partly','no'].includes(e.progressMatch)?e.progressMatch:null;
  e.wentWell=String(e.wentWell||'');
  e.obstacles=String(e.obstacles||'');
  e.confidence=e.confidence==null?null:Number(e.confidence);
  e.intendedAdjustment=String(e.intendedAdjustment||'');
  e.createdAt=e.createdAt||Date.now();
  e.completedAt=e.completedAt||null;
  e.acknowledgedAt=e.acknowledgedAt||null;
  return e;
}
/* Idempotent upsert — an existing occurrence for weekStart is returned
   as-is; only a genuinely missing one gets created (as 'pending'). Safe
   to call repeatedly (e.g. once per day from the maintenance pass)
   without ever duplicating an occurrence. */
function mainQuestEnsureCheckInOccurrence(mq,weekStart){
  let entry=mq.checkIns.entries.find(e=>e.weekStart===weekStart);
  if(!entry){
    entry=ensureMainQuestCheckInEntryShape({weekStart});
    mq.checkIns.entries.push(entry);
  }
  return entry;
}
/* Completing works from either 'pending' (on time) or 'missed' (late) --
   both are genuine player-initiated resolution moments and both journal
   a 'check-in' entry; an already-resolved occurrence (already
   'completed' or 'acknowledged') is rejected rather than silently
   overwritten, which is what keeps repeated calls idempotent. */
function mainQuestCompleteCheckIn(mq,entry,fields={}){
  if(!mq||!entry)return {ok:false,reason:'not-found'};
  if(!['pending','missed'].includes(entry.status))return {ok:false,reason:'already-resolved'};
  entry.rating=fields.rating??entry.rating;
  entry.progressMatch=['yes','partly','no'].includes(fields.progressMatch)?fields.progressMatch:entry.progressMatch;
  entry.wentWell=fields.wentWell??entry.wentWell;
  entry.obstacles=fields.obstacles??entry.obstacles;
  entry.confidence=fields.confidence??entry.confidence;
  entry.intendedAdjustment=fields.intendedAdjustment??entry.intendedAdjustment;
  const wasLate=entry.status==='missed';
  entry.status='completed';
  entry.completedAt=Date.now();
  mainQuestJournal(mq,'check-in',wasLate?'Weekly Check-in completed (late).':'Weekly Check-in completed.',{entryId:entry.id,outcome:'completed'});
  save();
  return {ok:true};
}
/* Only valid from 'missed' — dismissing a check-in that's still on time
   isn't a real action (mainQuestCompleteCheckIn is what you do while
   it's pending); acknowledging is specifically "I know I missed this
   one, moving on." Once acknowledged (or completed), the occurrence no
   longer appears in mainQuestCheckInsNeedingReminder's output below —
   that IS the no-repeat-nag mechanism, not a separate flag. */
function mainQuestAcknowledgeCheckIn(mq,entry){
  if(!mq||!entry)return {ok:false,reason:'not-found'};
  if(entry.status!=='missed')return {ok:false,reason:'not-missed'};
  entry.status='acknowledged';
  entry.acknowledgedAt=Date.now();
  mainQuestJournal(mq,'check-in','Missed Weekly Check-in acknowledged.',{entryId:entry.id,outcome:'acknowledged'});
  save();
  return {ok:true};
}
/* Write-layer setter for Check-in schedule/settings (3B.5 fixup) — the
   UI previously mutated mq.checkIns.enabled/weekday/time directly and
   called save() itself, bypassing the same journal-atomically-with-the-
   mutation discipline every other plan-affecting write in this domain
   already follows. Patch semantics (only keys present in `patch` are
   considered) so a caller can flip just `enabled` without needing to
   resend weekday/time. No-ops (no journal, no save) when nothing about
   the resolved before/after settings actually differs — matches the
   idempotency-by-construction guard mainQuestSetMilestoneStatus already
   uses. */
function mainQuestFormatCheckInSchedule(ci){
  if(!ci.enabled)return 'disabled';
  return `${ci.weekday?ci.weekday.toUpperCase():'any day'} ${ci.time||'any time'}`;
}
function mainQuestUpdateCheckInSettings(mq,patch={}){
  if(!mq)return {ok:false,reason:'not-found'};
  const ci=mq.checkIns;
  const before={enabled:ci.enabled,weekday:ci.weekday,time:ci.time};
  const next={
    enabled:'enabled' in patch?Boolean(patch.enabled):ci.enabled,
    weekday:'weekday' in patch?(WEEKDAY_ABBR.includes(patch.weekday)?patch.weekday:null):ci.weekday,
    time:'time' in patch?(String(patch.time||'').trim()||null):ci.time,
  };
  const changed=before.enabled!==next.enabled||before.weekday!==next.weekday||before.time!==next.time;
  if(!changed)return {ok:true,unchanged:true};
  ci.enabled=next.enabled;ci.weekday=next.weekday;ci.time=next.time;
  mainQuestJournal(mq,'plan-change',`Check-in schedule updated: ${mainQuestFormatCheckInSchedule(before)} → ${mainQuestFormatCheckInSchedule(next)}`,{});
  save();
  return {ok:true};
}
function mainQuestCheckInsNeedingReminder(mq){
  return mq.checkIns.entries.filter(e=>e.status==='missed');
}
/* Runs once per calendar date, hooked into dailyReset() below (the
   existing "once per day, on next render after the date rolls over"
   convention this codebase already uses for everything else date-
   boundary-related) rather than inventing a parallel "on boot" hook —
   this is what gives the missed-check-in reminder its "next app open"
   timing. For every enabled active/paused quest: any 'pending'
   occurrence whose week has fully elapsed (weekStart + 7 days <= today)
   finalizes to 'missed' (no Journal entry for this step — it's
   bookkeeping, not a player action); then this week's occurrence is
   ensured to exist as 'pending' if it doesn't already. Both steps are
   naturally idempotent: a 'missed' entry no longer matches the pending
   guard, and mainQuestEnsureCheckInOccurrence is itself an idempotent
   upsert. */
function mainQuestDailyCheckInMaintenance(){
  const today=todayISO();
  ensureQuestHubState().mainQuests.filter(mq=>mq.status==='active'||mq.status==='paused').forEach(mq=>{
    if(!mq.checkIns.enabled)return;
    mq.checkIns.entries.forEach(entry=>{
      if(entry.status==='pending'&&addDays(entry.weekStart,7)<=today)entry.status='missed';
    });
    mainQuestEnsureCheckInOccurrence(mq,mainQuestWeekStart(today));
  });
}

/* ==========================================================================
   MAIN QUEST SURFACE (Phase 3B.5 — Quests-page UI, 2026-09-12)
   ==========================================================================
   Pure presentation over the domain model built in 3B.1-3B.4 — no new
   state shape, no new transitions. Every mutation here goes through an
   existing domain function (mainQuestActivate, mainQuestSetMilestoneStatus,
   etc.); this section only decides what to show and calls mainQuestRefreshProgress
   after any plan/evidence change so progress+pace stay current.

   View state lives in plain module-level variables, same pattern as the
   rest of this file (page/questsView/taskView etc.) — nothing here is
   persisted; reloading the page always returns to the hub. */
let qpMainView='hub'; // 'hub'|'active'|'drafts'|'templates'|'history'|'detail'
let qpMainQuestId=null;
let qpMainTab='overview'; // 'overview'|'plan'|'journal'|'checkins'

const MAIN_QUEST_PACE_LABELS={
  ahead:{label:'Ahead',cls:'mq-pace-ahead'},
  on_track:{label:'On Track',cls:'mq-pace-on-track'},
  at_risk:{label:'At Risk',cls:'mq-pace-at-risk'},
  behind:{label:'Behind',cls:'mq-pace-behind'},
  paused:{label:'Paused',cls:'mq-pace-paused'},
};
function mainQuestStatusLabel(status){return {draft:'Draft',active:'Active',paused:'Paused',completed:'Completed',abandoned:'Abandoned'}[status]||status}
function mainQuestJournalTypeLabel(type){return {manual:'Note','plan-change':'Plan Change',milestone:'Milestone',section:'Section','major-event':'Event',completion:'Completed','check-in':'Check-in'}[type]||type}
function mainQuestAreaLabel(id){return MAIN_QUEST_AREAS_OF_LIFE.find(a=>a.id===id)?.label||'—'}
function mainQuestDifficultyLabel(id){return MAIN_QUEST_DIFFICULTY.find(d=>d.id===id)?.label||'—'}
function mainQuestEpochDate(ms){return ms?fmtDate(localISO(new Date(ms))):'—'}

function mainQuestSurfaceHTML(){
  ensureQuestHubState();
  if(qpMainView==='detail'){
    const mq=mainQuestFindById(qpMainQuestId);
    if(mq)return mainQuestDetailHTML(mq);
    qpMainView='hub';
  }
  if(qpMainView==='active')return mainQuestListViewHTML('active');
  if(qpMainView==='drafts')return mainQuestListViewHTML('drafts');
  if(qpMainView==='history')return mainQuestListViewHTML('history');
  if(qpMainView==='templates')return mainQuestTemplatesViewHTML();
  qpMainView='hub';
  return mainQuestHubViewHTML();
}

function mainQuestCardHTML(mq){
  const paceInfo=MAIN_QUEST_PACE_LABELS[mq.progress.paceState];
  const progText=mq.status==='draft'?'Not committed yet':`${mq.progress.current}${mq.progress.unit==='%'?'%':` ${mq.progress.unit||''}`.replace(/\s+$/,'')}${mq.progress.target!=null&&mq.progress.unit!=='%'?` / ${mq.progress.target}`:''}`;
  return `<button type="button" class="mq-card" data-qp-open-quest="${mq.id}">
    <div class="mq-card-top"><span class="mq-status-tag mq-status-${mq.status}">${esc(mainQuestStatusLabel(mq.status))}</span>${paceInfo?`<span class="mq-pace-badge ${paceInfo.cls}">${esc(paceInfo.label)}</span>`:''}</div>
    <h3>${esc(mq.goal.title||'Untitled Main Quest')}</h3>
    <p>${esc(progText)}${mq.goal.targetDate?` · Target ${fmtShort(mq.goal.targetDate)}`:''}</p>
  </button>`;
}

function mainQuestHubViewHTML(){
  const hub=ensureQuestHubState();
  const activeCount=mainQuestActiveCount();
  const draftCount=hub.mainQuests.filter(mq=>mq.status==='draft').length;
  const historyCount=hub.mainQuests.filter(mq=>['completed','abandoned'].includes(mq.status)).length;
  const activePreview=hub.mainQuests.filter(mq=>mq.status==='active'||mq.status==='paused').slice(0,MAIN_QUEST_ACTIVE_CAP);
  const back=`<button type="button" class="text-btn campaign-back" data-qp-view="hub">← Quests</button>`;
  return back+`<div class="toolbar"><button type="button" class="rpg-btn accent" id="mqNewQuest">New Main Quest</button></div>
    ${activeCount>=MAIN_QUEST_ACTIVE_CAP?'<p class="helper">Maximum of 5 active Main Quests reached. Pause, complete or abandon one to commit another draft.</p>':''}
    <div class="mq-nav-grid">
      <button type="button" class="mq-nav-card" data-qp-main-view="active"><h3>Active</h3><span>${activeCount} / ${MAIN_QUEST_ACTIVE_CAP}</span></button>
      <button type="button" class="mq-nav-card" data-qp-main-view="drafts"><h3>Drafts</h3><span>${draftCount}</span></button>
      <button type="button" class="mq-nav-card" data-qp-main-view="templates"><h3>Templates</h3><span>${hub.templates.length}</span></button>
      <button type="button" class="mq-nav-card" data-qp-main-view="history"><h3>History</h3><span>${historyCount}</span></button>
    </div>
    <h2 class="section-title">Active Main Quests</h2>
    ${activePreview.length?activePreview.map(mainQuestCardHTML).join(''):'<div class="empty">No active Main Quests. Start one above.</div>'}`;
}

function mainQuestListViewHTML(viewName){
  const hub=ensureQuestHubState();
  const back=`<button type="button" class="text-btn campaign-back" data-qp-main-view="hub">← Main Quests</button>`;
  let quests,emptyText,title;
  if(viewName==='active'){quests=hub.mainQuests.filter(mq=>mq.status==='active'||mq.status==='paused');emptyText='No active Main Quests yet.';title='Active';}
  else if(viewName==='drafts'){quests=hub.mainQuests.filter(mq=>mq.status==='draft');emptyText='No drafts. Start a new Main Quest.';title='Drafts';}
  else{quests=hub.mainQuests.filter(mq=>['completed','abandoned'].includes(mq.status));emptyText='No completed or abandoned Main Quests yet.';title='History';}
  const list=quests.length?quests.map(mainQuestCardHTML).join(''):`<div class="empty">${emptyText}</div>`;
  return back+`<h2 class="section-title">${title} Main Quests</h2>${list}`;
}

function mainQuestTemplatesViewHTML(){
  const hub=ensureQuestHubState();
  const back=`<button type="button" class="text-btn campaign-back" data-qp-main-view="hub">← Main Quests</button>`;
  const list=hub.templates.length?hub.templates.map(t=>`<div class="list-item"><div>📄</div><div><h3>${esc(t.title)}</h3><p>${esc(mainQuestAreaLabel(t.areaOfLife))} · ${t.sections.length} section${t.sections.length===1?'':'s'}, ${t.milestones.length} milestone${t.milestones.length===1?'':'s'}</p></div><div class="list-actions"><button class="text-btn accent" data-qp-use-template="${t.id}">Use</button><button class="text-btn" data-qp-delete-template="${t.id}">Delete</button></div></div>`).join(''):'<div class="empty">No saved templates yet. Save a Main Quest as a template from its detail page.</div>';
  return back+`<h2 class="section-title">Templates</h2>${list}`;
}

function mainQuestActionButtonsHTML(mq){
  const btns=[];
  if(mq.status==='draft'){
    btns.push(`<button type="button" class="rpg-btn accent" id="mqCommit">Commit to this Main Quest</button>`);
    btns.push(`<button type="button" class="text-btn" id="mqDeleteDraft">Abandon Draft</button>`);
  }
  if(mq.status==='active'){
    btns.push(`<button type="button" class="rpg-btn" id="mqPause">Pause</button>`);
    btns.push(`<button type="button" class="rpg-btn accent" id="mqComplete">Complete</button>`);
    btns.push(`<button type="button" class="text-btn" id="mqAbandon">Abandon</button>`);
  }
  if(mq.status==='paused'){
    btns.push(`<button type="button" class="rpg-btn accent" id="mqResume">Resume</button>`);
    btns.push(`<button type="button" class="rpg-btn" id="mqComplete">Complete</button>`);
    btns.push(`<button type="button" class="text-btn" id="mqAbandon">Abandon</button>`);
  }
  if(['completed','abandoned'].includes(mq.status)){
    btns.push(`<button type="button" class="rpg-btn" id="mqSpawnNext">Start Next Occurrence</button>`);
  }
  btns.push(`<button type="button" class="text-btn" id="mqSaveTemplate">Save as Template</button>`);
  return `<div class="toolbar mq-action-toolbar">${btns.join('')}</div>`;
}

function mainQuestDetailHTML(mq){
  const prog=mq.progress;
  const paceInfo=MAIN_QUEST_PACE_LABELS[prog.paceState];
  const back=`<button type="button" class="text-btn campaign-back" data-qp-main-view="hub">← Main Quests</button>`;
  const dateLocked=Boolean(mq.commitment.fixedEventDateLockedAt);
  const canEditDate=!dateLocked&&mq.status!=='completed'&&mq.status!=='abandoned';
  const header=`<div class="mq-detail-head"><span class="mq-status-tag mq-status-${mq.status}">${esc(mainQuestStatusLabel(mq.status))}</span><h2>${esc(mq.goal.title||'Untitled Main Quest')}</h2>
    <div class="mq-meta-row"><span class="tag">${esc(mainQuestAreaLabel(mq.goal.areaOfLife))}</span><span class="tag">${esc(mainQuestDifficultyLabel(mq.goal.difficultyId))}</span><span class="tag">Priority ${mq.goal.priority}</span></div></div>`;
  const dateRow=`<div class="mq-date-row"><div><small>Target Date</small><b>${mq.goal.targetDate?fmtDate(mq.goal.targetDate):'Not set'}</b>${dateLocked?' <span class="mq-lock" title="Fixed event date — locked at commitment">🔒 Locked</span>':''}</div>
    ${canEditDate?`<button type="button" class="text-btn" id="mqEditDate">${mq.status==='draft'?'Edit Goal':'Change Date'}</button>`:''}</div>`;
  const progressBlock=mq.status==='draft'?'':`<div class="mq-progress-block"><div class="meter-label"><span>Progress</span><span>${prog.current}${prog.unit==='%'?'%':` / ${prog.target??'—'} ${prog.unit||''}`}</span></div><div class="meter"><i style="width:${prog.unit==='%'?clamp(prog.current,0,100):pct(prog.current,prog.target||0)}%"></i></div>${paceInfo?`<span class="mq-pace-badge ${paceInfo.cls}">${esc(paceInfo.label)}</span>`:'<span class="mq-pace-badge">Pace not set</span>'}</div>`;
  const tabs=`<div class="tabs tabs-4"><button type="button" data-qp-main-tab="overview" class="${qpMainTab==='overview'?'active':''}">Overview</button><button type="button" data-qp-main-tab="plan" class="${qpMainTab==='plan'?'active':''}">Plan</button><button type="button" data-qp-main-tab="journal" class="${qpMainTab==='journal'?'active':''}">Journal</button><button type="button" data-qp-main-tab="checkins" class="${qpMainTab==='checkins'?'active':''}">Check-ins</button></div>`;
  const tabFn={overview:mainQuestOverviewTabHTML,plan:mainQuestPlanTabHTML,journal:mainQuestJournalTabHTML,checkins:mainQuestCheckInsTabHTML}[qpMainTab]||mainQuestOverviewTabHTML;
  return back+header+dateRow+progressBlock+mainQuestActionButtonsHTML(mq)+tabs+tabFn(mq);
}

function mainQuestOverviewTabHTML(mq){
  return `<section class="rpg-frame minor mq-overview">
    ${mq.goal.description?`<p class="helper">${esc(mq.goal.description)}</p>`:'<p class="empty">No description yet.</p>'}
    ${mq.goal.successCriteria?`<div class="mq-field"><small>Success Criteria</small><p>${esc(mq.goal.successCriteria)}</p></div>`:''}
    <div class="mq-field-grid">
      <div><small>Committed</small><b>${mainQuestEpochDate(mq.commitment.committedAt)}</b></div>
      <div><small>Completed</small><b>${mainQuestEpochDate(mq.completedAt)}</b></div>
      <div><small>From Template</small><b>${mq.templateId?'Yes':'No'}</b></div>
      <div><small>Series</small><b>${mq.seriesId?'Linked':'No'}</b></div>
    </div>
  </section>`;
}

function mainQuestMilestoneRowHTML(m){
  const auto=Boolean(m.progressRule);
  return `<div class="list-item mq-milestone-row"><input type="checkbox" data-mq-milestone-toggle="${m.id}" ${m.status==='completed'?'checked':''} ${auto?'disabled':''} title="${auto?'Auto-tracked from evidence':''}"><div><h3>${esc(m.title)}</h3><p>${auto?'Auto-tracked':(m.status==='completed'?'Completed':'Pending')}${m.completedAt?` · ${mainQuestEpochDate(m.completedAt)}`:''}</p></div></div>`;
}
function mainQuestRecurringGoalRowHTML(rg,mq){
  const r=mainQuestRecurringGoalProgress(rg,mq);
  const days=rg.recurrence.selectedDays.length?rg.recurrence.selectedDays.map(d=>d.toUpperCase()).join(','):'Any days';
  return `<div class="list-item"><div>↻</div><div><h3>${esc(rg.title)}</h3><p>${r.current} / ${r.target} this week · ${esc(days)}</p></div>${rg.progressRule?'':`<button type="button" class="text-btn" data-mq-log-occurrence="${rg.id}">Log Today</button>`}</div>`;
}
function mainQuestScheduledActivityRowHTML(sa){
  return `<div class="list-item"><input type="checkbox" data-mq-activity-toggle="${sa.id}" ${sa.done?'checked':''}><div><h3>${esc(sa.title)}</h3><p>${sa.date?fmtShort(sa.date):'No date'} · ${esc(sa.time||'Any')}</p></div></div>`;
}
function mainQuestPlanGroupHTML(mq,sectionId,title,prog){
  const milestones=mq.plan.milestones.filter(m=>m.sectionId===sectionId);
  const rgs=mq.plan.recurringGoals.filter(rg=>rg.sectionId===sectionId);
  const sas=mq.plan.scheduledActivities.filter(sa=>sa.sectionId===sectionId);
  const rows=[...milestones.map(mainQuestMilestoneRowHTML),...rgs.map(rg=>mainQuestRecurringGoalRowHTML(rg,mq)),...sas.map(mainQuestScheduledActivityRowHTML)];
  const key=sectionId||'';
  return `<section class="rpg-frame minor mq-plan-section">
    <div class="mq-plan-section-head"><h3>${esc(title)}</h3>${prog?`<span class="mq-pace-badge">${prog.current}%</span>`:''}</div>
    ${rows.length?rows.join(''):'<div class="empty">Nothing here yet.</div>'}
    <div class="toolbar"><button type="button" class="text-btn" data-mq-add-milestone="${key}">+ Milestone</button><button type="button" class="text-btn" data-mq-add-recurring="${key}">+ Recurring Goal</button><button type="button" class="text-btn" data-mq-add-activity="${key}">+ Scheduled Activity</button></div>
  </section>`;
}
function mainQuestPlanTabHTML(mq){
  const sections=[...mq.plan.sections].sort((a,b)=>a.order-b.order);
  const sectionBlocks=sections.map(s=>mainQuestPlanGroupHTML(mq,s.id,s.title,mainQuestSectionProgress(s,mq))).join('');
  const hasUnsectioned=mq.plan.milestones.some(m=>!m.sectionId)||mq.plan.recurringGoals.some(rg=>!rg.sectionId)||mq.plan.scheduledActivities.some(sa=>!sa.sectionId);
  const unsectionedBlock=hasUnsectioned?mainQuestPlanGroupHTML(mq,null,'Unsectioned',null):'';
  return `<div class="toolbar"><button type="button" class="rpg-btn small" id="mqAddSection">+ Section</button></div>${sectionBlocks}${unsectionedBlock}`;
}

function mainQuestJournalTabHTML(mq){
  const entries=[...mq.journal].reverse();
  const list=entries.length?entries.map(j=>`<div class="mq-journal-entry mq-journal-${j.type}"><span class="mq-journal-type">${esc(mainQuestJournalTypeLabel(j.type))}</span><p>${esc(j.text)}</p><small>${mainQuestEpochDate(j.createdAt)}</small></div>`).join(''):'<div class="empty">No Journal entries yet.</div>';
  return `<div class="form-row mq-journal-add"><textarea id="mqJournalText" placeholder="Add a note about this Main Quest..." maxlength="500"></textarea><button type="button" class="rpg-btn small accent" id="mqAddJournal">Add Entry</button></div><div class="mq-journal-list">${list}</div>`;
}

function mainQuestCheckInRowHTML(e){
  const statusLabel={pending:'Pending',missed:'Missed',acknowledged:'Acknowledged',completed:'Completed'}[e.status]||e.status;
  let actions='';
  if(['pending','missed'].includes(e.status))actions+=`<button type="button" class="text-btn accent" data-mq-checkin-complete="${e.id}">Complete</button>`;
  if(e.status==='missed')actions+=`<button type="button" class="text-btn" data-mq-checkin-ack="${e.id}">Acknowledge</button>`;
  return `<div class="rpg-frame minor mq-checkin-card"><div class="mq-checkin-head"><b>Week of ${fmtShort(e.weekStart)}</b><span class="tag mq-checkin-${e.status}">${statusLabel}</span></div>
    ${e.status==='completed'?`<p class="helper">Rating ${e.rating??'—'}/5 · Progress match: ${esc(e.progressMatch||'—')}${e.wentWell?`<br>Went well: ${esc(e.wentWell)}`:''}${e.obstacles?`<br>Obstacles: ${esc(e.obstacles)}`:''}</p>`:''}
    ${actions?`<div class="toolbar">${actions}</div>`:''}</div>`;
}
function mainQuestCheckInsTabHTML(mq){
  const ci=mq.checkIns;
  const settingsForm=`<section class="rpg-frame minor">
    <div class="form-row"><label><input type="checkbox" id="mqCiEnabled" ${ci.enabled?'checked':''}> Enable Weekly Check-ins</label></div>
    <div class="two-col"><div class="form-row"><label>Day of week</label><select id="mqCiWeekday"><option value="">—</option>${WEEKDAY_ABBR.map(d=>`<option value="${d}" ${ci.weekday===d?'selected':''}>${d.toUpperCase()}</option>`).join('')}</select></div><div class="form-row"><label>Time</label><input id="mqCiTime" value="${esc(ci.time||'')}" placeholder="Any"></div></div>
    <button type="button" class="rpg-btn small accent" id="mqCiSave">Save Check-in Settings</button></section>`;
  const entries=[...ci.entries].sort((a,b)=>b.weekStart.localeCompare(a.weekStart));
  const rows=entries.length?entries.map(mainQuestCheckInRowHTML).join(''):'<div class="empty">No Check-in occurrences yet.</div>';
  return settingsForm+`<h2 class="section-title">Occurrences</h2>${rows}`;
}

/* ---- Modals ---- */
function mainQuestGoalModal(mq){
  const editing=Boolean(mq);
  const g=editing?mq.goal:{title:'',description:'',areaOfLife:null,difficultyId:null,priority:3,successCriteria:'',targetDate:'',fixedEventDate:false};
  modal(`<h2>${editing?'Edit':'New'} Main Quest</h2>
    <div class="form-row"><label>Title</label><input id="mqTitle" value="${esc(g.title)}" maxlength="120"></div>
    <div class="form-row"><label>Description</label><textarea id="mqDesc">${esc(g.description)}</textarea></div>
    <div class="two-col"><div class="form-row"><label>Area of Life</label><select id="mqArea"><option value="">—</option>${MAIN_QUEST_AREAS_OF_LIFE.map(a=>`<option value="${a.id}" ${g.areaOfLife===a.id?'selected':''}>${esc(a.label)}</option>`).join('')}</select></div>
    <div class="form-row"><label>Difficulty</label><select id="mqDiff"><option value="">—</option>${MAIN_QUEST_DIFFICULTY.map(d=>`<option value="${d.id}" ${g.difficultyId===d.id?'selected':''}>${esc(d.label)}</option>`).join('')}</select></div></div>
    <div class="two-col"><div class="form-row"><label>Priority (1-5)</label><input id="mqPriority" type="number" min="1" max="5" value="${g.priority||3}"></div>
    <div class="form-row"><label>Target date</label><input id="mqTargetDate" type="date" value="${g.targetDate||''}"></div></div>
    <div class="form-row"><label><input type="checkbox" id="mqFixedDate" ${g.fixedEventDate?'checked':''}> Fixed event date (locks permanently once committed)</label></div>
    <div class="form-row"><label>Success criteria</label><textarea id="mqCriteria">${esc(g.successCriteria)}</textarea></div>
    <button class="rpg-btn accent" id="mqSaveGoal" style="width:100%">${editing?'Save Changes':'Create Draft'}</button>`);
  modalRoot.querySelector('#mqSaveGoal').onclick=()=>{
    const title=modalRoot.querySelector('#mqTitle').value.trim();
    if(!title){toast('Give the Main Quest a title.');return}
    const patch={
      title,
      description:modalRoot.querySelector('#mqDesc').value.trim(),
      areaOfLife:modalRoot.querySelector('#mqArea').value||null,
      difficultyId:modalRoot.querySelector('#mqDiff').value||null,
      priority:clamp(Number(modalRoot.querySelector('#mqPriority').value||3),1,5),
      targetDate:modalRoot.querySelector('#mqTargetDate').value||null,
      fixedEventDate:modalRoot.querySelector('#mqFixedDate').checked,
      successCriteria:modalRoot.querySelector('#mqCriteria').value.trim(),
    };
    if(editing){
      mainQuestUpdateGoal(mq,patch);
      closeModal();qpMainView='detail';qpMainQuestId=mq.id;renderSideQuests();
    }else{
      const created=mainQuestCreateDraft(patch);
      closeModal();qpMainView='detail';qpMainQuestId=created.id;qpMainTab='overview';renderSideQuests();
      toast('Draft created. Commit when ready.');
    }
  };
}
function mainQuestTargetDateModal(mq){
  modal(`<h2>Change Target Date</h2><div class="form-row"><label>Target date</label><input id="mqNewDate" type="date" value="${mq.goal.targetDate||''}"></div><button class="rpg-btn accent" id="mqSaveDate" style="width:100%">Save</button>`);
  modalRoot.querySelector('#mqSaveDate').onclick=()=>{
    mainQuestUpdateGoal(mq,{targetDate:modalRoot.querySelector('#mqNewDate').value||null});
    mainQuestRefreshProgress(mq);
    closeModal();renderSideQuests();
  };
}
function mainQuestAddSectionModal(mq){
  modal(`<h2>Add Section</h2><div class="form-row"><label>Section title</label><input id="mqSecTitle"></div><button class="rpg-btn accent" id="mqSaveSection" style="width:100%">Add Section</button>`);
  modalRoot.querySelector('#mqSaveSection').onclick=()=>{
    const title=modalRoot.querySelector('#mqSecTitle').value.trim();
    if(!title){toast('Name the section.');return}
    mainQuestAddSection(mq,{title,order:mq.plan.sections.length});
    mainQuestRefreshProgress(mq);
    closeModal();renderSideQuests();
  };
}
function mainQuestAddMilestoneModal(mq,sectionId){
  modal(`<h2>Add Milestone</h2><div class="form-row"><label>Title</label><input id="mqMsTitle"></div><p class="helper">Auto-tracking from Training/Personal Growth evidence can be attached later; manual completion works immediately.</p><button class="rpg-btn accent" id="mqSaveMilestone" style="width:100%">Add Milestone</button>`);
  modalRoot.querySelector('#mqSaveMilestone').onclick=()=>{
    const title=modalRoot.querySelector('#mqMsTitle').value.trim();
    if(!title){toast('Name the milestone.');return}
    mainQuestAddMilestone(mq,{title,sectionId});
    mainQuestRefreshProgress(mq);
    closeModal();renderSideQuests();
  };
}
function mainQuestAddRecurringGoalModal(mq,sectionId){
  modal(`<h2>Add Recurring Goal</h2><div class="form-row"><label>Title</label><input id="mqRgTitle"></div><div class="two-col"><div class="form-row"><label>Times per week</label><input id="mqRgCount" type="number" min="1" value="3"></div><div class="form-row"><label>Frequency</label><select id="mqRgFreq"><option value="weekly" selected>Weekly</option><option value="daily">Daily</option></select></div></div><div class="form-row"><label>Selected days (optional — leave blank for any day)</label><div class="mq-weekday-picker">${WEEKDAY_ABBR.map(d=>`<label><input type="checkbox" value="${d}" class="mqRgDay"> ${d.toUpperCase()}</label>`).join('')}</div></div><button class="rpg-btn accent" id="mqSaveRecurring" style="width:100%">Add Recurring Goal</button>`);
  modalRoot.querySelector('#mqSaveRecurring').onclick=()=>{
    const title=modalRoot.querySelector('#mqRgTitle').value.trim();
    if(!title){toast('Name the recurring goal.');return}
    const selectedDays=Array.from(modalRoot.querySelectorAll('.mqRgDay:checked')).map(c=>c.value);
    mainQuestAddRecurringGoal(mq,{title,sectionId,recurrence:{frequency:modalRoot.querySelector('#mqRgFreq').value,targetCount:Math.max(1,Number(modalRoot.querySelector('#mqRgCount').value||1)),selectedDays}});
    mainQuestRefreshProgress(mq);
    closeModal();renderSideQuests();
  };
}
function mainQuestAddActivityModal(mq,sectionId){
  modal(`<h2>Add Scheduled Activity</h2><div class="form-row"><label>Title</label><input id="mqSaTitle"></div><div class="two-col"><div class="form-row"><label>Date</label><input id="mqSaDate" type="date" value="${todayISO()}"></div><div class="form-row"><label>Time</label><input id="mqSaTime" placeholder="Any"></div></div><button class="rpg-btn accent" id="mqSaveActivity" style="width:100%">Add Activity</button>`);
  modalRoot.querySelector('#mqSaveActivity').onclick=()=>{
    const title=modalRoot.querySelector('#mqSaTitle').value.trim();
    if(!title){toast('Name the activity.');return}
    mainQuestAddScheduledActivity(mq,{title,sectionId,date:modalRoot.querySelector('#mqSaDate').value||null,time:modalRoot.querySelector('#mqSaTime').value.trim()||'Any'});
    closeModal();renderSideQuests();
  };
}
function mainQuestCheckInCompleteModal(mq,entry){
  modal(`<h2>Weekly Check-in</h2><div class="form-row"><label>Rating (1-5)</label><input id="ciRating" type="number" min="1" max="5" value="${entry.rating??3}"></div><div class="form-row"><label>Did progress match the plan?</label><select id="ciMatch"><option value="yes">Yes</option><option value="partly" selected>Partly</option><option value="no">No</option></select></div><div class="form-row"><label>What went well?</label><textarea id="ciWell"></textarea></div><div class="form-row"><label>Obstacles?</label><textarea id="ciObstacles"></textarea></div><div class="form-row"><label>Confidence going forward (1-5)</label><input id="ciConfidence" type="number" min="1" max="5" value="3"></div><div class="form-row"><label>Intended adjustment</label><textarea id="ciAdjust"></textarea></div><button class="rpg-btn accent" id="ciSave" style="width:100%">Save Check-in</button>`);
  modalRoot.querySelector('#ciSave').onclick=()=>{
    mainQuestCompleteCheckIn(mq,entry,{
      rating:Number(modalRoot.querySelector('#ciRating').value||3),
      progressMatch:modalRoot.querySelector('#ciMatch').value,
      wentWell:modalRoot.querySelector('#ciWell').value.trim(),
      obstacles:modalRoot.querySelector('#ciObstacles').value.trim(),
      confidence:Number(modalRoot.querySelector('#ciConfidence').value||3),
      intendedAdjustment:modalRoot.querySelector('#ciAdjust').value.trim(),
    });
    closeModal();renderSideQuests();
  };
}

/* Every mainQuests/.../templates id is uid() — a NUMBER (Date.now()+
   random offset, see uid() near the top of this file). HTML data-*
   attributes only ever round-trip as strings, so every id read back off
   a dataset here is run through Number(...) before it's used in a
   strict-equality .find()/=== lookup or stored onto a new record's
   sectionId — passing the raw string through either would silently
   never match (found and fixed during 3B.5 QA: a Milestone added under
   a Section came back with a string sectionId that never matched the
   Section's own numeric id). */
function mainQuestIdFromDataset(raw){return raw?Number(raw):null}
function bindMainQuestSurface(){
  const q=s=>document.querySelector(s);
  document.querySelectorAll('[data-qp-main-view]').forEach(b=>b.onclick=()=>{qpMainView=b.dataset.qpMainView;renderSideQuests()});
  document.querySelectorAll('[data-qp-open-quest]').forEach(b=>b.onclick=()=>{qpMainView='detail';qpMainQuestId=Number(b.dataset.qpOpenQuest);qpMainTab='overview';renderSideQuests()});
  const newBtn=q('#mqNewQuest');if(newBtn)newBtn.onclick=()=>mainQuestGoalModal(null);
  document.querySelectorAll('[data-qp-main-tab]').forEach(b=>b.onclick=()=>{qpMainTab=b.dataset.qpMainTab;renderSideQuests()});
  document.querySelectorAll('[data-qp-use-template]').forEach(b=>b.onclick=()=>{
    const res=mainQuestCreateFromTemplate(Number(b.dataset.qpUseTemplate));
    if(res.ok){qpMainView='detail';qpMainQuestId=res.mainQuest.id;qpMainTab='overview';renderSideQuests();toast('Draft created from template.')}
  });
  document.querySelectorAll('[data-qp-delete-template]').forEach(b=>b.onclick=()=>{mainQuestDeleteTemplate(Number(b.dataset.qpDeleteTemplate));renderSideQuests()});

  const mq=qpMainQuestId?mainQuestFindById(qpMainQuestId):null;
  if(!mq)return;

  const commit=q('#mqCommit');if(commit)commit.onclick=()=>{
    const res=mainQuestActivate(mq);
    if(!res.ok){toast(res.reason==='active-cap-reached'?`Maximum of ${MAIN_QUEST_ACTIVE_CAP} active Main Quests reached.`:'Could not commit.');return}
    mainQuestRefreshProgress(mq);toast('Main Quest committed.');renderSideQuests();
  };
  const pause=q('#mqPause');if(pause)pause.onclick=()=>{mainQuestPause(mq);renderSideQuests()};
  const resume=q('#mqResume');if(resume)resume.onclick=()=>{
    const res=mainQuestResume(mq);
    if(!res.ok)toast(`Maximum of ${MAIN_QUEST_ACTIVE_CAP} active Main Quests reached.`);
    renderSideQuests();
  };
  const complete=q('#mqComplete');if(complete)complete.onclick=()=>{mainQuestComplete(mq);renderSideQuests()};
  const abandon=q('#mqAbandon');if(abandon)abandon.onclick=()=>{if(confirm('Abandon this Main Quest?')){mainQuestAbandon(mq);renderSideQuests()}};
  const deleteDraft=q('#mqDeleteDraft');if(deleteDraft)deleteDraft.onclick=()=>{if(confirm('Abandon this draft? It will be preserved in History as Abandoned.')){mainQuestAbandon(mq);qpMainView='drafts';renderSideQuests()}};
  const spawnNext=q('#mqSpawnNext');if(spawnNext)spawnNext.onclick=()=>{
    const res=mainQuestSpawnNextInSeries(mq);
    if(res.ok){qpMainQuestId=res.mainQuest.id;qpMainTab='overview';toast('Next occurrence created as a draft.');renderSideQuests()}
  };
  const saveTemplate=q('#mqSaveTemplate');if(saveTemplate)saveTemplate.onclick=()=>{mainQuestSaveAsTemplate(mq);toast('Saved as template.')};
  const editDate=q('#mqEditDate');if(editDate)editDate.onclick=()=>mq.status==='draft'?mainQuestGoalModal(mq):mainQuestTargetDateModal(mq);

  document.querySelectorAll('[data-mq-milestone-toggle]').forEach(c=>c.onchange=()=>{
    const m=mq.plan.milestones.find(x=>x.id===mainQuestIdFromDataset(c.dataset.mqMilestoneToggle));
    mainQuestSetMilestoneStatus(mq,m,c.checked?'completed':'pending');
    mainQuestRefreshProgress(mq);renderSideQuests();
  });
  document.querySelectorAll('[data-mq-activity-toggle]').forEach(c=>c.onchange=()=>{
    const sa=mq.plan.scheduledActivities.find(x=>x.id===mainQuestIdFromDataset(c.dataset.mqActivityToggle));
    mainQuestSetScheduledActivityDone(mq,sa,c.checked);
    renderSideQuests();
  });
  document.querySelectorAll('[data-mq-log-occurrence]').forEach(b=>b.onclick=()=>{
    const rg=mq.plan.recurringGoals.find(x=>x.id===mainQuestIdFromDataset(b.dataset.mqLogOccurrence));
    mainQuestLogRecurringGoalOccurrence(rg,todayISO(),true);
    mainQuestRefreshProgress(mq);renderSideQuests();
  });
  const addSection=q('#mqAddSection');if(addSection)addSection.onclick=()=>mainQuestAddSectionModal(mq);
  document.querySelectorAll('[data-mq-add-milestone]').forEach(b=>b.onclick=()=>mainQuestAddMilestoneModal(mq,mainQuestIdFromDataset(b.dataset.mqAddMilestone)));
  document.querySelectorAll('[data-mq-add-recurring]').forEach(b=>b.onclick=()=>mainQuestAddRecurringGoalModal(mq,mainQuestIdFromDataset(b.dataset.mqAddRecurring)));
  document.querySelectorAll('[data-mq-add-activity]').forEach(b=>b.onclick=()=>mainQuestAddActivityModal(mq,mainQuestIdFromDataset(b.dataset.mqAddActivity)));

  const addJournal=q('#mqAddJournal');if(addJournal)addJournal.onclick=()=>{
    const res=mainQuestAddManualJournalEntry(mq,q('#mqJournalText').value);
    if(res.ok)renderSideQuests();else toast('Write something first.');
  };

  const ciSave=q('#mqCiSave');if(ciSave)ciSave.onclick=()=>{
    mainQuestUpdateCheckInSettings(mq,{enabled:q('#mqCiEnabled').checked,weekday:q('#mqCiWeekday').value||null,time:q('#mqCiTime').value.trim()||null});
    toast('Check-in settings saved.');renderSideQuests();
  };
  document.querySelectorAll('[data-mq-checkin-complete]').forEach(b=>b.onclick=()=>{
    const e=mq.checkIns.entries.find(x=>x.id===mainQuestIdFromDataset(b.dataset.mqCheckinComplete));
    mainQuestCheckInCompleteModal(mq,e);
  });
  document.querySelectorAll('[data-mq-checkin-ack]').forEach(b=>b.onclick=()=>{
    const e=mq.checkIns.entries.find(x=>x.id===mainQuestIdFromDataset(b.dataset.mqCheckinAck));
    mainQuestAcknowledgeCheckIn(mq,e);renderSideQuests();
  });
}

function renderQuestsArea(){
  ensureQuestsState();
  let body;
  if(questsView==='quest'&&QUEST_DEFINITIONS[questsQuestId])body=questPageHTML(questsQuestId);
  else if(questsView==='division'&&QUEST_DIVISIONS.find(d=>d.id===questsDivisionId))body=divisionPageHTML(questsDivisionId);
  else{questsView='hub';body=questsHubHTML()}
  view.innerHTML=pageHeader('Adventures','Explore • Discover • Overcome')+body;
  bindQuestsArea();
}
function bindQuestsArea(){
  document.querySelectorAll('[data-open-division]').forEach(b=>b.onclick=()=>{
    questsView='division';questsDivisionId=b.dataset.openDivision;renderQuestsArea();
    if(questsDivisionId==='journeys')asterIntroModalIfNeeded();
  });
  document.querySelectorAll('[data-open-quest]').forEach(b=>b.onclick=()=>{questsView='quest';questsQuestId=b.dataset.openQuest;renderQuestsArea()});
  document.querySelectorAll('[data-untrack]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();toggleQuestTracked(b.dataset.untrack)});
  const divBack=document.querySelector('#questDivisionBack');if(divBack)divBack.onclick=()=>{questsView='hub';renderQuestsArea()};
  const qBack=document.querySelector('#questPageBack');if(qBack)qBack.onclick=()=>{questsView=QUEST_DEFINITIONS[questsQuestId]?'division':'hub';questsDivisionId=QUEST_DEFINITIONS[questsQuestId]?.division||questsDivisionId;renderQuestsArea()};
  const star=document.querySelector('#questStarToggle');if(star)star.onclick=()=>toggleQuestTracked(questsQuestId);
  const primary=document.querySelector('#questPrimaryAction');if(primary)primary.onclick=()=>{questStartOrContinue(questsQuestId);renderQuestsArea()};
  const replay=document.querySelector('#questReplayBtn');if(replay)replay.onclick=()=>{questReplay(questsQuestId);renderQuestsArea()};
  document.querySelectorAll('[data-orin-hint]').forEach(b=>b.onclick=()=>{
    const [qid,itemId,tier,cost]=b.dataset.orinHint.split('|');
    if(questPurchaseHint(qid,itemId,tier,Number(cost))){toast('Hint purchased.');renderQuestsArea()}
  });
  document.querySelectorAll('[data-journey-start]').forEach(b=>b.onclick=()=>journeyMovementRuleModal(b.dataset.journeyStart));
  document.querySelectorAll('[data-journey-pause]').forEach(b=>b.onclick=()=>{pauseJourney(b.dataset.journeyPause);renderQuestsArea()});
  document.querySelectorAll('[data-journey-resume]').forEach(b=>b.onclick=()=>{resumeJourney(b.dataset.journeyResume);renderQuestsArea()});
  if(questsView==='quest'&&WORLD_TOUR_DEFINITIONS[questsQuestId]){
    const pending=ensureJourneyProgress(questsQuestId).pendingLandmarkReveals;
    if(pending.length)journeyLandmarkRevealModal(questsQuestId,pending[0]);
  }
}
function renderLibrary(){view.innerHTML=pageHeader('Library','Knowledge Archive')+shellCards([{title:'Library',icon:'UI/nav_library.png',copy:'Collected references, lore and reusable knowledge will be organised here.'}])}
function renderStorage(){view.innerHTML=pageHeader('Inventory','Items & Companions')+shellCards([{title:'Inventory',icon:'UI/nav_storage.png',copy:'Items, pets and other held possessions will be organised here.'}])}
function renderSocial(){view.innerHTML=pageHeader('Social','Connections')+shellCards([{title:'Social',icon:'UI/nav_social.png',live:true,copy:'Manual social check-ins remain part of daily resource tracking.'},{title:'Connected Parties',icon:'UI/nav_social.png',copy:'Friends, parties and shared challenges require a future hosted account system.'}])}

/* ---------- HOME ---------- */
function greeting(){
  const h=new Date().getHours();return h<12?'GOOD MORNING':h<18?'GOOD AFTERNOON':'GOOD EVENING';
}
const SYSTEM_QUIPS=[
  'No catastrophic failures detected. Continue.',
  'Daily instance loaded. Try not to aggro reality.',
  'Character online. Objectives remain suspiciously achievable.',
  'System stable. Side effects may include progress.',
  'Save point unavailable. Make today count.'
];
function systemQuip(){return SYSTEM_QUIPS[baseDaySeed()%SYSTEM_QUIPS.length]}
function currentWeatherView(){
  const c=state.weatherCache;
  if(c&&c.data) return c.data;
  return {temp:'--',feels:'--',high:'--',low:'--',rain:'--',wind:'--',condition:'Loading weather…',icon:'icons/weather/ICON_WEATHER_CLOUDY.png',location:state.profile.location||'Horten'};
}
function runningConditions(w){
  if(w.temp==='--')return {label:'Mixed',cls:'mixed',note:'Weather data is still loading.'};
  const temp=Number(w.temp),rain=Number(w.rain||0),wind=Number(w.wind||0),cond=String(w.condition||'');
  if(/Thunder|Sleet|Snow/i.test(cond)||wind>=35||temp<=-10||temp>=30||rain>=70)return {label:'Poor',cls:'poor',note:'Conditions may make an outdoor run uncomfortable or unsafe. Use judgment.'};
  if(wind>=27||temp<0||temp>26||rain>=50||/Fog/i.test(cond))return {label:'Caution',cls:'caution',note:'Conditions need extra planning. Consider an indoor or shorter session.'};
  if(wind>=20||temp<4||temp>22||rain>=30||/Rain/i.test(cond))return {label:'Mixed',cls:'mixed',note:'Runnable for many people, but conditions deserve a little planning.'};
  if(temp>=7&&temp<=17&&rain<=10&&wind<=12&&!/Rain|Fog|Thunder|Sleet|Snow/i.test(cond))return {label:'Perfect',cls:'perfect',note:'Current temperature, rain and wind are especially favorable for an outdoor run.'};
  return {label:'Good',cls:'good',note:'Current conditions look broadly suitable for an outdoor run.'};
}
/* duplicate renderWeatherHTML implementation removed in v0.01.8.2.6.2 cleanup test */
/* Weather icon family (Aurelia/Velora, Home V3 Weather Icon Family,
   2026-09-10) — replaces the mixed-provenance RPG_VISUAL_ASSETS_V1 /
   Home v2 Fidelity Rebuild set (superseded note above kept for history)
   with one cohesive 12-icon family, single naming convention, single
   art pass. Old runtime icons (assets/icons/weather/ICON_WEATHER_*.png,
   assets/weather-sleet.png, assets/weather-clear-night.png) are LEFT ON
   DISK, archived and unreferenced — not deleted, per the handoff's own
   "archive when switching, rather than deleting" instruction.

   Canonical mapping contract (package README.md, 2026-09-10): explicit
   provider codes + a real day/night flag, precedence thunderstorm ->
   sleet -> snow -> heavy-rain -> light-rain -> fog -> explicit windy ->
   cloud cover -> clear day/night. Provider is Open-Meteo (confirmed by
   the WMO 0-99 `weather_code` values already flowing from refreshWeather
   below) - this is the first time that provider-code table has actually
   been written out; the mapping below is it, not a placeholder.

   WMO code -> canonical id (Open-Meteo's own weather_code table):
     0 clear sky; 1 mainly clear, 2 partly cloudy (few/scattered clouds);
     3 overcast; 45/48 fog/rime fog; 51/53 drizzle light/moderate,
     55 drizzle dense, 61 rain slight, 80 rain showers slight (all
     "light-rain" per the brief's own bucket definition); 63 rain
     moderate, 65 rain heavy, 81/82 rain showers moderate/violent (all
     "heavy-rain" - the brief explicitly buckets moderate with heavy);
     56/57 freezing drizzle light/dense, 66/67 freezing rain light/heavy
     (freezing rain -> sleet per the brief); 71/73/75 snowfall
     slight/moderate/heavy, 77 snow grains, 85/86 snow showers
     slight/heavy (all "snow"); 95 thunderstorm slight/moderate, 96/99
     thunderstorm with slight/heavy hail (all "thunderstorm" - hail-with-
     thunder maps to thunderstorm per the brief; Open-Meteo has no
     separate bare-hail-without-thunder code, so the brief's documented
     hail->sleet fallback for that case is noted here but not reachable
     through this provider). Any code outside this table falls through
     to the neutral `cloudy` art with a console.warn logging the actual
     unmapped code, per "log unmapped codes" in the brief. */
const V3_WEATHER_ICON_FAMILY={
  'clear-day':'Home/V3/Weather/Icons/76/weather-clear-day-76px.png',
  'clear-night':'Home/V3/Weather/Icons/76/weather-clear-night-76px.png',
  'partly-cloudy-day':'Home/V3/Weather/Icons/76/weather-partly-cloudy-day-76px.png',
  'partly-cloudy-night':'Home/V3/Weather/Icons/76/weather-partly-cloudy-night-76px.png',
  'cloudy':'Home/V3/Weather/Icons/76/weather-cloudy-76px.png',
  'light-rain':'Home/V3/Weather/Icons/76/weather-light-rain-76px.png',
  'heavy-rain':'Home/V3/Weather/Icons/76/weather-heavy-rain-76px.png',
  'thunderstorm':'Home/V3/Weather/Icons/76/weather-thunderstorm-76px.png',
  'snow':'Home/V3/Weather/Icons/76/weather-snow-76px.png',
  'sleet':'Home/V3/Weather/Icons/76/weather-sleet-76px.png',
  'fog':'Home/V3/Weather/Icons/76/weather-fog-76px.png',
  'windy':'Home/V3/Weather/Icons/76/weather-windy-76px.png'
};
const V3_WEATHER_CODE_MAP={
  95:'thunderstorm',96:'thunderstorm',99:'thunderstorm',
  56:'sleet',57:'sleet',66:'sleet',67:'sleet',
  71:'snow',73:'snow',75:'snow',77:'snow',85:'snow',86:'snow',
  63:'heavy-rain',65:'heavy-rain',81:'heavy-rain',82:'heavy-rain',
  51:'light-rain',53:'light-rain',55:'light-rain',61:'light-rain',80:'light-rain',
  45:'fog',48:'fog'
};
const V3_WEATHER_LABEL={
  'clear-day':'Sunny','clear-night':'Clear Night',
  'partly-cloudy-day':'Sunny with Clouds','partly-cloudy-night':'Partly Cloudy',
  'cloudy':'Cloudy','light-rain':'Light Rain','heavy-rain':'Rain',
  'thunderstorm':'Thunderstorm','snow':'Snow','sleet':'Sleet','fog':'Fog / Mist','windy':'Windy'
};
function weatherMapping(code,isDay,wind){
  code=Number(code);
  let id=V3_WEATHER_CODE_MAP[code];
  if(!id){
    if(Number(wind)>=30 && [0,1,2,3].includes(code)) id='windy';
    else if(code===3) id='cloudy';
    else if(code===1||code===2) id=isDay?'partly-cloudy-day':'partly-cloudy-night';
    else if(code===0) id=isDay?'clear-day':'clear-night';
    else{
      console.warn(`[RPG Weather] Unmapped provider weather_code: ${code} — falling back to cloudy art.`);
      id='cloudy';
    }
  }
  return [V3_WEATHER_LABEL[id],V3_WEATHER_ICON_FAMILY[id]];
}
async function refreshWeather(force=false){
  const cached=state.weatherCache;
  if(!force&&cached&&Date.now()-Number(cached.timestamp||0)<30*60*1000) return;
  const lat=Number(state.profile.lat||59.4172),lon=Number(state.profile.lon||10.4834);
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=5`;
    const r=await fetch(url);if(!r.ok) throw new Error('Weather request failed');const j=await r.json();
    const cur=j.current||{},daily=j.daily||{},hourly=j.hourly||{};const [condition,icon]=weatherMapping(Number(cur.weather_code),Number(cur.is_day)===1,Number(cur.wind_speed_10m));
    const currentData={
      temp:Number(cur.temperature_2m),feels:Number(cur.apparent_temperature),wind:Number(cur.wind_speed_10m),condition,icon,
      high:Number(daily.temperature_2m_max?.[0]),low:Number(daily.temperature_2m_min?.[0]),rain:Number(daily.precipitation_probability_max?.[0]??0),location:state.profile.location||'Horten'
    };
    const times=Array.isArray(hourly.time)?hourly.time:[];
    const periodAt=(date,hour,label)=>{
      const target=`${date}T${String(hour).padStart(2,'0')}:00`;let idx=times.indexOf(target);
      if(idx<0)idx=times.findIndex(t=>String(t).startsWith(`${date}T${String(hour).padStart(2,'0')}:`));
      if(idx<0)return {label,temp:'--',feels:'--',rain:'--',wind:'--',condition:'Forecast unavailable',icon:'icons/weather/ICON_WEATHER_CLOUDY.png'};
      const wind=Number(hourly.wind_speed_10m?.[idx]??0),code=Number(hourly.weather_code?.[idx]),isDay=hour<18;const [periodCondition,periodIcon]=weatherMapping(code,isDay,wind);
      return {label,temp:Number(hourly.temperature_2m?.[idx]),feels:Number(hourly.apparent_temperature?.[idx]),rain:Number(hourly.precipitation_probability?.[idx]??0),wind,condition:periodCondition,icon:periodIcon};
    };
    const dates=Array.isArray(daily.time)?daily.time.slice(0,5):[];
    const days=dates.map((date,i)=>{const wind=Number(daily.wind_speed_10m_max?.[i]??0),code=Number(daily.weather_code?.[i]),[dayCondition,dayIcon]=weatherMapping(code,true,wind),high=Number(daily.temperature_2m_max?.[i]),low=Number(daily.temperature_2m_min?.[i]),rain=Number(daily.precipitation_probability_max?.[i]??0);return {date,high,low,rain,wind,temp:(high+low)/2,condition:dayCondition,icon:dayIcon}});
    const today=dates[0]||todayISO();
    state.weatherCache={timestamp:Date.now(),error:false,data:currentData,forecast:{periods:[periodAt(today,9,'Morning'),periodAt(today,14,'Afternoon'),periodAt(today,19,'Evening')],days}};save();
  }catch(e){if(state.weatherCache)state.weatherCache.error=true;else state.weatherCache={timestamp:Date.now(),error:true,data:currentWeatherView(),forecast:{periods:[],days:[]}};save()}
  if(page==='home'){
    const el=document.querySelector('.weather-approved-v4');if(el){el.outerHTML=renderWeatherHTML();bindWeatherForecastTrigger()}
    /* Weather may instead be floating as v0.02.15's compact hero card
       (Aurelia's Home Hero direction lock) rather than the standalone
       .weather-approved-v4 section above — patch that too when present,
       so live weather data replaces the initial "Loading weather…"
       state there as well, not just in the standalone section. */
    const heroCard=document.querySelector('.hero-weather-card');if(heroCard&&typeof v0215HeroWeatherCardHTML==='function'){heroCard.outerHTML=v0215HeroWeatherCardHTML();bindWeatherForecastTrigger()}
    applyHomeBackgroundClass();
  }
}
function nutritionStatus(value,target,type){
  const ratio=target>0?value/target:0;
  if(type==='protein') return ratio>=1?'green':ratio>=.75?'yellow':'';
  if(ratio>1.15) return 'red';if(ratio>=.95&&ratio<=1.05)return 'green';if(ratio>1.05)return 'yellow';return '';
}
function meter(value,target,cls='',label=''){
  return `${label?`<div class="meter-label"><span>${esc(label)}</span><span>${Math.round(value)} / ${Math.round(target)}</span></div>`:''}<div class="meter ${cls}"><i style="width:${pct(value,target)}%"></i></div>`;
}
/* duplicate resourceCard implementation removed in v0.01.8.2.6.2 cleanup test */
/* duplicate resourceFood implementation removed in v0.01.8.2.6.2 cleanup test */
/* duplicate resourceMind implementation removed in v0.01.8.2.6.2 cleanup test */
/* duplicate scheduleItems implementation removed in v0.01.8.2.6.2 cleanup test */
function scheduleHTML(){
  const items=scheduleItems();
  if(!items.length)return `<div class="empty">No other schedule entries today. Open Calendar for the full plan.</div>`;
  return items.map(i=>`<div class="schedule-row"><span class="schedule-time">${esc(i.time)}</span><div><strong>${esc(i.title)}</strong><small>${esc(i.sub)}</small></div><span class="tag ${i.kind}">${i.kind}</span></div>`).join('');
}
function sharedHomeItemTitle(value,generic=[]){
  const title=String(value||'').trim();
  return title&&!generic.includes(title)?title:'';
}
function sharedQuestProgressText(q){
  if(!q||typeof q!=='object')return '';
  if(typeof q.progressText==='string'&&q.progressText.trim())return q.progressText.trim();
  const p=q.progress&&typeof q.progress==='object'?q.progress:null;
  const current=p?.current??p?.value??q.progressCurrent;
  const target=p?.target??p?.max??p?.goal??q.progressTarget;
  const unit=p?.unit??q.progressUnit??'';
  if(current!=null&&target!=null&&String(current)!==''&&String(target)!=='')return `Progress: ${current} / ${target}${unit?` ${unit}`:''}`;
  if(typeof q.progress==='string'&&q.progress.trim())return q.progress.trim();
  return '';
}
function relevantSideQuests(){
  const generic=['Active Side Quest','Complete Side Quest'];
  return state.sideQuests.filter(q=>!q.done && (!q.date||q.date===todayISO()) && sharedHomeItemTitle(q.title,generic));
}
function sideQuestSummaryHTML(){
  const quests=relevantSideQuests();
  if(!quests.length)return `<div class="empty">No relevant Side Quests are active today.</div>`;
  return quests.slice(0,4).map(q=>`<button class="side-summary-row" data-open-sidequests="1"><span>${esc(q.title)}</span><small>${esc(q.category||'Other')} · ${esc(q.difficulty||'Normal')} · +${q.xp||40} XP</small></button>`).join('')+`${quests.length>4?`<button class="text-btn accent" data-open-sidequests="1">+${quests.length-4} more</button>`:''}`;
}
const WORD_LANGS={no:'Norsk',en:'English',de:'Deutsch',fr:'Français',es:'Español'};
const WORD_TITLES={no:'Dagens Ord',en:'Word of the Day',de:'Wort des Tages',fr:'Mot du Jour',es:'Palabra del Día'};
const WORDS_BY_LANG={
  no:[
    ['Utholdenhet','Perseverance / endurance','The ability to keep going when something takes time or effort.','Utholdenhet bygges én økt om gangen.'],
    ['Mestring','Mastery / coping','The feeling of managing, learning or overcoming something.','Mestring kommer ofte etter at noe først føles vanskelig.'],
    ['Mot','Courage','Choosing to act even when something feels difficult or uncertain.','Det krever mot å begynne før du føler deg klar.'],
    ['Ro','Calm','A state of quiet, steadiness and reduced urgency.','Noen minutter med ro kan endre resten av dagen.'],
    ['Nysgjerrighet','Curiosity','A desire to explore, understand and learn.','Nysgjerrighet gjør et problem til noe som kan utforskes.'],
    ['Viljestyrke','Willpower','The ability to continue toward a choice or goal.','Viljestyrke er lettere når neste steg er tydelig.'],
    ['Glede','Joy','A feeling of happiness, pleasure or delight.','Glede kan finnes i små ting gjennom dagen.'],
    ['Fremgang','Progress','Movement toward a goal, even when the steps are small.','Fremgang trenger ikke være dramatisk for å telle.'],
    ['Tålmodighet','Patience','The ability to wait or continue without rushing.','Tålmodighet gjør langsiktig arbeid mulig.'],
    ['Fokus','Focus','Directing attention toward what matters now.','Fokus betyr å velge hva som får oppmerksomheten din nå.']
  ],
  en:[
    ['Momentum','Momentum','Forward movement that becomes easier to continue once it has started.','A small completed task can create momentum for the next one.'],
    ['Resilience','Resilience','The capacity to recover and continue after difficulty.','Resilience grows through recovery, not through never struggling.'],
    ['Intent','Intent','A clear purpose behind an action or decision.','Act with intent instead of waiting for perfect motivation.'],
    ['Steady','Steady','Consistent, controlled and not easily disrupted.','A steady pace often outlasts a dramatic sprint.'],
    ['Curiosity','Curiosity','A desire to learn, explore or understand.','Curiosity turns uncertainty into a question you can investigate.'],
    ['Progress','Progress','Movement toward a desired result.','Progress still counts when the step is small.'],
    ['Restore','Restore','To bring something back toward a better condition.','Rest can restore the energy needed for the next quest.'],
    ['Adapt','Adapt','To adjust effectively when circumstances change.','Adapt the plan without abandoning the goal.'],
    ['Practice','Practice','Repeated effort used to improve a skill.','Practice makes difficult actions increasingly familiar.'],
    ['Balance','Balance','A workable distribution of effort, rest and priorities.','Balance changes with the demands of the day.']
  ],
  de:[
    ['Ausdauer','Endurance','The ability to continue through effort or difficulty.','Ausdauer wächst mit jedem kleinen Schritt.'],
    ['Mut','Courage','The willingness to act despite uncertainty or fear.','Mut bedeutet nicht, dass etwas leicht ist.'],
    ['Ruhe','Calm','A state of quiet and steadiness.','Ein Moment Ruhe kann den ganzen Tag verändern.'],
    ['Fortschritt','Progress','Movement toward a goal.','Auch kleiner Fortschritt zählt.'],
    ['Neugier','Curiosity','A desire to understand or discover.','Neugier macht aus Problemen Fragen.']
  ],
  fr:[
    ['Courage','Courage','The willingness to act despite difficulty.','Le courage commence souvent par un petit pas.'],
    ['Progrès','Progress','Movement toward a goal or improvement.','Chaque petit progrès compte.'],
    ['Calme','Calm','A state of quiet and steadiness.','Quelques minutes de calme peuvent aider.'],
    ['Curiosité','Curiosity','A desire to learn or understand.','La curiosité transforme un obstacle en question.'],
    ['Patience','Patience','The ability to continue without rushing.','La patience soutient les objectifs à long terme.']
  ],
  es:[
    ['Constancia','Consistency','The quality of continuing steadily over time.','La constancia convierte pequeños pasos en progreso.'],
    ['Valor','Courage','The willingness to act despite difficulty.','El valor empieza con un paso pequeño.'],
    ['Calma','Calm','A state of quiet and steadiness.','Un momento de calma puede cambiar el día.'],
    ['Progreso','Progress','Movement toward a goal.','El progreso pequeño también cuenta.'],
    ['Curiosidad','Curiosity','A desire to learn or understand.','La curiosidad convierte un problema en una pregunta.']
  ]
};
const QUOTES=[
  'Small actions become large changes.',
  'Progress counts even when nobody sees it.',
  'A difficult day can still contain a completed quest.',
  'Consistency beats the dramatic restart.',
  'You do not need perfect conditions to gain experience.',
  'The next useful action is enough for now.',
  'Rest is part of progression, not the absence of it.',
  'A side quest completed is still progress.'
];
function baseDaySeed(){return Number(todayISO().replaceAll('-',''))}
function langSeed(lang){return [...String(lang)].reduce((n,c)=>n+c.charCodeAt(0),0)}
/* Daily Word language — a selectable eligible set (Lyra's Home Upgrade
   Handoff 4.2) rather than one fixed language: a quick control rotates
   through whichever languages are marked eligible, and a separate
   control edits which ones are eligible. */
function ensureWordLanguages(){
  /* Home Baseline Correction item 16: a fresh profile used to seed only
     the single configured wordLanguage, so the rotate control had
     nothing to cycle through and never appeared until someone found the
     eligibility settings gear first. Default to every language instead —
     users who've already narrowed their own set keep it (this branch
     only runs when wordLanguages has never been set). */
  if(!Array.isArray(state.profile.wordLanguages)||!state.profile.wordLanguages.length){
    state.profile.wordLanguages=Object.keys(WORD_LANGS);
  }
  state.profile.wordLanguages=state.profile.wordLanguages.filter(l=>WORD_LANGS[l]);
  if(!state.profile.wordLanguages.length)state.profile.wordLanguages=['no'];
  if(!Number.isInteger(state.profile.wordLanguageIndex))state.profile.wordLanguageIndex=0;
  state.profile.wordLanguageIndex=((state.profile.wordLanguageIndex%state.profile.wordLanguages.length)+state.profile.wordLanguages.length)%state.profile.wordLanguages.length;
  return state.profile.wordLanguages;
}
function activeWordLanguage(){const list=ensureWordLanguages();return list[state.profile.wordLanguageIndex]||'no'}
function rotateWordLanguage(){const list=ensureWordLanguages();if(list.length<2)return;state.profile.wordLanguageIndex=(state.profile.wordLanguageIndex+1)%list.length;save();renderHome()}
function wordOfDay(){const lang=activeWordLanguage(),list=WORDS_BY_LANG[lang]||WORDS_BY_LANG.no;return list[(baseDaySeed()+langSeed(lang))%list.length]}
function quoteOfDay(){const seed=baseDaySeed()+Number(state.daily.quoteReroll||0)*17;return QUOTES[(seed*7+3)%QUOTES.length]}
/* duplicate renderHome implementation removed in v0.01.8.2.6.2 cleanup test */
/* duplicate bindHome implementation removed in v0.01.8.2.6.2 cleanup test */
/* duplicate completeMainQuest implementation removed in v0.01.8.2.6.2 cleanup test */
/* Main Quest locking (Home Baseline Correction, item 21): a quest is
   "locked" the moment it has a real title — that single save is the
   deliberate "entering" act the spec describes, so no separate locked
   flag is needed. Once locked, this modal only reopens for a fresh draft
   (empty title); Delay/Cancel/Complete are the only permitted mutations. */
function editQuestModal(){
  const q=state.quest;
  const locked=Boolean(sharedHomeItemTitle(q.title,['Complete Today’s Main Quest','Complete Main Quest']));
  if(locked){toast('Main Quest is locked. Use Delay to move the date, or Cancel to close it.');return}
  modal(`<h2>New Main Quest</h2><div class="form-row"><label>Quest title</label><input id="qTitle" value="${esc(q.title)}"></div><div class="form-row"><label>Description</label><textarea id="qDesc">${esc(q.description)}</textarea></div><div class="two-col"><div class="form-row"><label>Duration</label><input id="qDuration" value="${esc(q.duration||'')}"></div><div class="form-row"><label>Date</label><input id="qDate" type="date" value="${q.date}"></div></div><div class="two-col"><div class="form-row"><label>XP reward</label><input id="qXP" type="number" value="${q.rewardXP}"></div><div class="form-row"><label>Gold reward</label><input id="qGold" type="number" value="${q.rewardGold}"></div></div><button class="rpg-btn accent" id="saveQuest" style="width:100%">Start Quest</button>`);
  modalRoot.querySelector('#saveQuest').onclick=()=>{
    const title=modalRoot.querySelector('#qTitle').value.trim();if(!title){toast('Main Quest needs a name.');return}
    q.title=title;q.description=modalRoot.querySelector('#qDesc').value.trim();q.duration=modalRoot.querySelector('#qDuration').value.trim();q.date=modalRoot.querySelector('#qDate').value||todayISO();q.rewardXP=Math.max(0,Number(modalRoot.querySelector('#qXP').value||0));q.rewardGold=Math.max(0,Number(modalRoot.querySelector('#qGold').value||0));q.createdAt=Date.now();
    state.questHistory=Array.isArray(state.questHistory)?state.questHistory:[];
    state.questHistory.push({date:todayISO(),questId:q.id,title,type:'created'});
    state.questHistory=state.questHistory.slice(-200);
    recordQuestIntegrityEvent('created',q);
    save();closeModal();renderHome();
  };
}
function delayModal(){
  const q=state.quest,title=sharedHomeItemTitle(q.title,['Complete Today’s Main Quest','Complete Main Quest']);
  if(!title){toast('No Main Quest to delay.');return}
  if(q.rewarded){toast('Completed quests cannot be delayed.');return}
  modal(`<h2>Delay Main Quest</h2><p class="helper">Move the quest without marking it failed. Recorded in Quest history.</p><div class="choice-grid"><button class="rpg-btn small" data-delay="1">Tomorrow</button><button class="rpg-btn small" data-delay="2">+2 Days</button></div><div class="form-row"><label>Choose date</label><input type="date" id="questDate" value="${q.date}"></div><button class="rpg-btn accent" id="saveQuestDate" style="width:100%">Change Date</button>`);
  const doDelay=newDate=>{
    if(!newDate)return;
    const oldDate=q.date;if(newDate===oldDate){closeModal();return}
    q.date=newDate;
    state.questHistory=Array.isArray(state.questHistory)?state.questHistory:[];
    state.questHistory.push({date:todayISO(),questId:q.id,title,type:'delayed',detail:`${oldDate} -> ${newDate}`});
    state.questHistory=state.questHistory.slice(-200);
    recordQuestIntegrityEvent('delayed',q,{fromDate:oldDate,toDate:newDate});
    save();closeModal();toast(`Quest moved to ${fmtDate(newDate)}`);render();
  };
  modalRoot.querySelectorAll('[data-delay]').forEach(b=>b.onclick=()=>doDelay(addDays(todayISO(),Number(b.dataset.delay))));
  modalRoot.querySelector('#saveQuestDate').onclick=()=>doDelay(modalRoot.querySelector('#questDate').value);
}
function cancelMainQuestModal(){
  const q=state.quest,title=sharedHomeItemTitle(q.title,['Complete Today’s Main Quest','Complete Main Quest']);
  if(!title){toast('No Main Quest to cancel.');return}
  if(q.rewarded){toast('Completed quests cannot be cancelled.');return}
  modal(`<h2>Cancel Main Quest</h2><p class="helper">This closes "${esc(title)}" with no completion reward. This cannot be undone.</p><button class="rpg-btn danger" id="confirmCancelQuest" style="width:100%">Cancel Main Quest</button>`);
  modalRoot.querySelector('#confirmCancelQuest').onclick=()=>{
    state.questHistory=Array.isArray(state.questHistory)?state.questHistory:[];
    state.questHistory.push({date:todayISO(),questId:q.id,title,type:'cancelled'});
    state.questHistory=state.questHistory.slice(-200);
    recordQuestIntegrityEvent('cancelled',q);
    state.quest={...defaults().quest,id:uid(),date:todayISO(),createdAt:Date.now()};
    save();closeModal();toast('Main Quest cancelled.');renderHome();
  };
}
function earlyCompleteQuestModal(){
  const q=state.quest;
  modal(`<h2>Complete Early</h2><p class="helper">"${esc(q.title)}" is scheduled for ${fmtDate(q.date)}. Completing it before then needs a short reason, recorded in Quest history.</p><div class="form-row"><label>Reason</label><textarea id="earlyReason" placeholder="Why finish this ahead of schedule?" maxlength="240"></textarea></div><button class="rpg-btn accent" id="confirmEarlyComplete" style="width:100%">Complete Early</button>`);
  modalRoot.querySelector('#confirmEarlyComplete').onclick=()=>{
    const reason=modalRoot.querySelector('#earlyReason').value.trim();
    if(!reason){toast('A short reason is required to complete early.');return}
    closeModal();completeMainQuest(reason);
  };
}
function creditResourceProgress(key,after){
  const d=state.daily,highs=d.resourceHigh||(d.resourceHigh={water:0,reading:0,mindful:0,mindfulness:0,social:0,socialMinutes:0});
  const oldHigh=Number(highs[key]||0),newHigh=Math.max(oldHigh,Number(after||0)),diff=newHigh-oldHigh;
  if(diff<=0)return 0;
  highs[key]=newHigh;
  if(key==='reading'){state.totals.readingMinutes+=diff;addStatXP('int',Math.floor(newHigh/5)-Math.floor(oldHigh/5))}
  if(key==='mindful'){state.totals.mindfulMinutes+=diff;addStatXP('wis',Math.floor(newHigh/5)-Math.floor(oldHigh/5))}
  if(key==='mindfulness'){state.totals.mindfulMinutes+=diff;addStatXP('wis',Math.floor(newHigh/5)-Math.floor(oldHigh/5))}
  if(key==='social'){state.totals.socialCheckins+=diff;addStatXP('cha',Math.round(diff*3))}
  if(key==='socialMinutes'){state.totals.socialCheckins+=diff;addStatXP('cha',Math.floor(newHigh/5)-Math.floor(oldHigh/5))}
  if(key==='water')state.totals.waterMl+=diff;
  return diff;
}
/* duplicate resourceModal implementation removed in v0.01.8.2.6.2 cleanup test */

/* ---------- ACTIVITIES / TRAINING ---------- */
const TRAINING_CONNECTIONS={
  'RPG Manual':{file:null,status:'Manual logging is available now.',detail:'Internal RPG entry; no external account required.',url:null},
  'Strava':{file:'connection_strava.png',status:'External source · not connected in this local build.',detail:'Intended automatic route for Garmin activities into RPG.',url:'https://www.strava.com/'},
  'Garmin':{file:'connection_garmin.png',status:'External source · upstream of Strava.',detail:'Intended flow: Garmin Connect → Strava → RPG.',url:'https://connect.garmin.com/modern/'},
  'FIT Import':{file:'connection_fit_import.png',status:'Parser not packaged yet.',detail:'Manual activity entry remains the fallback until a tested FIT parser is bundled.',url:null},
  'Apple Health':{file:'connection_apple_health.png',status:'Future connection.',detail:'No direct account sync is enabled in this build.',url:null},
  'Google Fit':{file:'connection_google_fit.png',status:'Future / legacy connection.',detail:'No direct account sync is enabled in this build.',url:null},
  'Health Connect':{file:'connection_health_connect.png',status:'Future connection.',detail:'No direct account sync is enabled in this build.',url:null},
  'COROS':{file:'connection_coros.png',status:'Future connection.',detail:'No direct account sync is enabled in this build.',url:'https://training.coros.com/'},
  'Polar':{file:'connection_polar.png',status:'Future connection.',detail:'No direct account sync is enabled in this build.',url:'https://flow.polar.com/'},
  'Zwift':{file:'connection_zwift.png',status:'Future connection.',detail:'No direct account sync is enabled in this build.',url:'https://www.zwift.com/'},
  'TrainingPeaks':{file:'connection_trainingpeaks.png',status:'Future connection.',detail:'No direct account sync is enabled in this build.',url:'https://www.trainingpeaks.com/'}
};
const TRAINING_RECORD_DEFS={
  fastest_1k:{label:'Fastest 1 km',activityType:'Running',unit:'min',better:'lower'},
  fastest_5k:{label:'Fastest 5 km',activityType:'Running',unit:'min',better:'lower'},
  fastest_10k:{label:'Fastest 10 km',activityType:'Running',unit:'min',better:'lower'},
  fastest_half:{label:'Fastest Half Marathon',activityType:'Running',unit:'min',better:'lower'},
  fastest_marathon:{label:'Fastest Marathon',activityType:'Running',unit:'min',better:'lower'},
  longest_run:{label:'Longest Run',activityType:'Running',unit:'km',better:'higher'},
  monthly_distance:{label:'Highest Monthly Distance',activityType:'Running',unit:'km',better:'higher'},
  squat_pb:{label:'Squat PB',activityType:'Strength',unit:'kg',better:'higher'},
  bench_pb:{label:'Bench Press PB',activityType:'Strength',unit:'kg',better:'higher'},
  deadlift_pb:{label:'Deadlift PB',activityType:'Strength',unit:'kg',better:'higher'},
  overhead_press_pb:{label:'Overhead Press PB',activityType:'Strength',unit:'kg',better:'higher'},
  longest_ride:{label:'Longest Ride',activityType:'Cycling',unit:'km',better:'higher'},
  longest_swim:{label:'Longest Swim',activityType:'Swimming',unit:'km',better:'higher'},
  longest_hike:{label:'Longest Hike',activityType:'Hiking',unit:'km',better:'higher'},
  longest_row:{label:'Longest Row',activityType:'Rowing',unit:'km',better:'higher'},
  longest_kayak:{label:'Longest Kayak',activityType:'Kayaking',unit:'km',better:'higher'},
  longest_ski:{label:'Longest Ski',activityType:'Skiing',unit:'km',better:'higher'},
  win_streak_football:{label:'Best Win Streak',activityType:'Football',unit:'wins',better:'higher'},
  win_streak_boxing:{label:'Best Win Streak',activityType:'Boxing',unit:'wins',better:'higher'},
  win_streak_martial_arts:{label:'Best Win Streak',activityType:'Martial Arts',unit:'wins',better:'higher'},
  win_streak_tennis:{label:'Best Win Streak',activityType:'Tennis',unit:'wins',better:'higher'},
  win_streak_basketball:{label:'Best Win Streak',activityType:'Basketball',unit:'wins',better:'higher'},
  win_streak_volleyball:{label:'Best Win Streak',activityType:'Volleyball',unit:'wins',better:'higher'},
  win_streak_table_tennis:{label:'Best Win Streak',activityType:'Table Tennis',unit:'wins',better:'higher'},
  win_streak_rugby:{label:'Best Win Streak',activityType:'Rugby',unit:'wins',better:'higher'}
};
/* Endurance family (Training Phase 5, 2026-09-11) — Running/Cycling/
   Swimming/Rowing/Hiking/Kayaking/Skiing share one foundation: the same
   generic distance/duration activity fields (no per-sport form), and now
   the same longest-distance PB mechanism via addTrainingRecord(), not a
   bespoke path per sport. Fixes a real gap found while auditing this
   phase: `longest_ride` already existed in TRAINING_RECORD_DEFS above but
   processTrainingCompletion() never actually wrote it -- Cycling had a
   dangling record definition with no code path feeding it, and Swimming/
   Hiking/Rowing/Kayaking/Skiing had no record definition at all despite
   being named as part of this family. */
const ENDURANCE_DISTANCE_RECORD_KEYS={Cycling:'longest_ride',Swimming:'longest_swim',Hiking:'longest_hike',Rowing:'longest_row',Kayaking:'longest_kayak',Skiing:'longest_ski'};
const TRAINING_SHIELDS=[
  [/long\s*run/i,'long_run.png'],[/interval|tempo|speed/i,'interval_run.png'],[/table\s*tennis|ping\s*pong/i,'table_tennis.png'],[/martial|karate|judo|taekwondo/i,'martial_arts.png'],[/gym|strength|weight|lift/i,'strength.png'],[/running|run|jog/i,'running.png'],[/cycl|bike/i,'cycling.png'],[/swim/i,'swimming.png'],[/climb/i,'climbing.png'],[/football|soccer/i,'football.png'],[/basket/i,'basketball.png'],[/tennis/i,'tennis.png'],[/box/i,'boxing.png'],[/ski/i,'skiing.png'],[/golf/i,'golf.png'],[/volley/i,'volleyball.png'],[/rugby/i,'rugby.png'],[/kayak/i,'kayaking.png'],[/horse|equestrian/i,'equestrian.png'],[/archer/i,'archery.png'],[/row/i,'rowing.png'],[/yoga/i,'yoga.png'],[/mobility|stretch|pilates/i,'mobility.png'],[/recover/i,'recovery.png'],[/rest/i,'rest.png'],[/walking|walk/i,'trail_hiking.png'],[/hike|trail/i,'hiking.png'],[/other|custom/i,'Variant Other 2.png'],[/dance/i,'dance.png']
];
function ensureTrainingState(){
  if(!state.training||typeof state.training!=='object')state.training={selectedConnection:'RPG Manual',records:[],milestones:{},events:[]};
  if(!Array.isArray(state.achievements))state.achievements=[];
  if(!TRAINING_CONNECTIONS[state.training.selectedConnection])state.training.selectedConnection='RPG Manual';
  if(!Array.isArray(state.training.records))state.training.records=[];
  if(!Array.isArray(state.training.events))state.training.events=[];
  if(!state.training.milestones||typeof state.training.milestones!=='object')state.training.milestones={};
  if(!Array.isArray(state.training.favouriteActivityTypes))state.training.favouriteActivityTypes=[null,null,null,null];
  while(state.training.favouriteActivityTypes.length<4)state.training.favouriteActivityTypes.push(null);
  /* Win/loss streaks (Training Phase 6, 2026-09-11) — live current-streak
     counters per sport, keyed by activity type. Separate from
     state.training.records (which only ever stores point-in-time BEST
     values via addTrainingRecord) since a current streak is a live
     running count, not a historical record entry. */
  if(!state.training.streaks||typeof state.training.streaks!=='object')state.training.streaks={};
  return state.training;
}
function trainingShieldFile(type='',name=''){
  const text=`${type} ${name}`;
  const found=TRAINING_SHIELDS.find(([re])=>re.test(text));
  return found?found[1]:'multi_sport.png';
}
function trainingShield(type,name='',cls=''){return `<img class="training-shield ${cls}" src="${asset(`Training/${trainingShieldFile(type,name)}`)}" alt="">`}
function activityIcon(type,name=''){return trainingShield(type,name,'activity-shield-mini')}
function connectionShield(name,cls=''){const c=TRAINING_CONNECTIONS[name]||TRAINING_CONNECTIONS['RPG Manual'];return c.file?`<img class="connection-shield ${cls}" src="${asset(`Training/${c.file}`)}" alt="${esc(name)}">`:`<img class="connection-shield internal ${cls}" src="${asset('UI/nav_training.png')}" alt="RPG Manual">`}
/* Character identity block removed from this header (2026-09-11, "we
   dont need the player ingformation on the training header") — it
   duplicated what Character's own page already shows and wasn't doing
   useful work here. Just the page title and the Training settings
   entrance now. */
function trainingHeaderHTML(){return `<header class="training-character-header rpg-frame primary"><h1 class="pixel-title">TRAINING</h1><button type="button" class="training-settings-btn" id="trainingSettingsBtn" aria-label="Training settings">⚙</button></header>`}
function trainingConnectionHTML(){const t=ensureTrainingState(),name=t.selectedConnection,c=TRAINING_CONNECTIONS[name];const options=Object.keys(TRAINING_CONNECTIONS).map(x=>`<option ${x===name?'selected':''}>${esc(x)}</option>`).join('');return `<section class="rpg-frame minor training-connections"><div class="training-connection-main"><div><span class="training-section-kicker">CONNECTIONS</span><select id="trainingConnectionSelect" aria-label="Selected Training connection">${options}</select><div class="connection-status"><i></i><span>${esc(c.status)}</span></div><p>${esc(c.detail)}</p></div><button class="connection-shield-button" id="trainingConnectionShield" aria-label="${c.url?`Open ${esc(name)}`:`${esc(name)} connection information`}">${connectionShield(name)}</button></div><button class="text-btn accent" id="trainingManageConnections">Manage Connections</button></section>`}
const ACTIVITY_TYPES=['Running','Long Run','Interval Run','Gym / Strength','Cycling','Swimming','Hiking','Climbing','Yoga','Rowing','Football','Boxing','Martial Arts','Skiing','Tennis','Basketball','Golf','Volleyball','Table Tennis','Rugby','Kayaking','Horse Riding','Archery','Recovery','Rest','Walking','Mobility','Other'];
/* Win/loss streak sports (Training Phase 6, 2026-09-11 direct ruling):
   these sports have no natural numeric "best" the way Endurance has
   distance or Strength has weight — Aurelia's call was to drop the PB
   idea for them entirely and track a win/loss streak instead. Yoga is
   deliberately excluded (no adversarial outcome to win or lose); Golf/
   Archery/Climbing are a separate, still-open score/grade question,
   not part of this list. */
const WIN_LOSS_SPORTS=['Football','Boxing','Martial Arts','Tennis','Basketball','Volleyball','Table Tennis','Rugby'];
const WIN_STREAK_RECORD_KEYS={Football:'win_streak_football',Boxing:'win_streak_boxing','Martial Arts':'win_streak_martial_arts',Tennis:'win_streak_tennis',Basketball:'win_streak_basketball',Volleyball:'win_streak_volleyball','Table Tennis':'win_streak_table_tennis',Rugby:'win_streak_rugby'};
function activityEditorForm(p={},mode='add'){
  const plan=esc(String(p.planText||p.notes||'')).replace(/\n/g,'&#10;');
  const outcomeVisible=WIN_LOSS_SPORTS.includes(p.type);
  return `<div class="form-row"><label>Activity</label><input id="actName" value="${esc(p.name||'')}" placeholder="e.g. Evening run"></div><div class="two-col"><div class="form-row"><label>Type</label><select id="actType">${ACTIVITY_TYPES.map(x=>`<option ${p.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="form-row"><label>Time</label><input id="actTime" type="time" value="${esc(p.time||'')}"></div></div><div class="three-col"><div class="form-row"><label>Date</label><input id="actDate" type="date" value="${p.date||todayISO()}"></div><div class="form-row"><label>Minutes</label><input id="actDuration" type="number" min="0" value="${p.duration||''}" placeholder="45"></div><div class="form-row"><label>Distance km</label><input id="actDistance" type="number" min="0" step="0.1" value="${p.distance||''}" placeholder="0"></div></div><div class="form-row" id="actOutcomeRow" ${outcomeVisible?'':'hidden'}><label>Result</label><select id="actOutcome"><option value="">—</option><option value="win" ${p.outcome==='win'?'selected':''}>Win</option><option value="loss" ${p.outcome==='loss'?'selected':''}>Loss</option><option value="draw" ${p.outcome==='draw'?'selected':''}>Draw</option></select></div><div class="form-row"><label>Workout details / notes</label><textarea id="actPlan" rows="5" placeholder="Warm-up, exercises, sets, zones, cooldown…">${plan}</textarea></div><button id="saveActivity" class="rpg-btn accent" style="width:100%">${mode==='edit'?'Save Workout':'Add Activity'}</button>`
}
function addActivityForm(p={}){return activityEditorForm(p,'add')}
/* Shows/hides the Result field as the Type select changes, instead of
   only setting its initial visibility once at render time — shared by
   both the Add and Edit paths so there's one toggle behaviour, not two. */
function bindActivityOutcomeToggle(){
  const typeSel=modalRoot.querySelector('#actType'),row=modalRoot.querySelector('#actOutcomeRow');
  if(!typeSel||!row)return;
  typeSel.onchange=()=>{row.hidden=!WIN_LOSS_SPORTS.includes(typeSel.value)};
}
function activityModal(tab='add',prefill={}){
  const moveRows=state.activities.length?state.activities.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(a=>`<div class="list-item training-modal-row"><div>${activityIcon(a.type,a.name)}</div><div><h3>${esc(a.name)}</h3><p>${fmtDate(a.date)} · ${esc(a.time||'Any time')} · ${esc(a.type)}</p></div><button class="text-btn" data-move="${a.id}">Move</button></div>`).join(''):'<div class="empty">No activities to reschedule yet.</div>';
  modal(`<h2>Activity</h2><div class="tabs"><button id="tabAdd" class="${tab==='add'?'active':''}">Add</button><button id="tabMove" class="${tab==='move'?'active':''}">Reschedule</button></div><div id="activityBody">${tab==='add'?activityEditorForm(prefill,'add'):moveRows}</div>`);
  modalRoot.querySelector('#tabAdd').onclick=()=>activityModal('add',prefill);modalRoot.querySelector('#tabMove').onclick=()=>activityModal('move');
  if(tab==='add'){bindAddActivity();bindActivityOutcomeToggle()}else modalRoot.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>moveActivityModal(Number(b.dataset.move)));
}
function readActivityEditor(){return {name:modalRoot.querySelector('#actName').value.trim(),type:modalRoot.querySelector('#actType').value,time:modalRoot.querySelector('#actTime').value,date:modalRoot.querySelector('#actDate').value||todayISO(),duration:Math.max(0,Number(modalRoot.querySelector('#actDuration').value||0)),distance:Math.max(0,Number(modalRoot.querySelector('#actDistance').value||0)),outcome:modalRoot.querySelector('#actOutcome')?.value||'',planText:modalRoot.querySelector('#actPlan').value.trim()}}
function bindAddActivity(){modalRoot.querySelector('#saveActivity').onclick=()=>{const v=readActivityEditor();if(!v.name){toast('Give the activity a name.');return}state.activities.push({id:uid(),...v,source:'Manual',completed:false,xpAwarded:false,startedAt:null,sportData:{}});save();closeModal();toast('Activity added.');render()}}
function editActivityModal(id){const a=state.activities.find(x=>x.id===id);if(!a)return;modal(`<h2>Edit Workout</h2>${activityEditorForm(a,'edit')}`);bindActivityOutcomeToggle();modalRoot.querySelector('#saveActivity').onclick=()=>{const v=readActivityEditor();if(!v.name)return toast('Give the activity a name.');Object.assign(a,v);save();closeModal();toast('Workout updated.');renderTraining()}}
function moveActivityModal(id){const a=state.activities.find(x=>x.id===id);if(!a)return;modal(`<h2>Reschedule Activity</h2><p>${esc(a.name)}</p><div class="form-row"><label>New date</label><input id="moveDate" type="date" value="${a.date}"></div><div class="form-row"><label>Time</label><input id="moveTime" type="time" value="${a.time||''}"></div><button id="saveMove" class="rpg-btn accent" style="width:100%">Move Activity</button>`);modalRoot.querySelector('#saveMove').onclick=()=>{a.date=modalRoot.querySelector('#moveDate').value||a.date;a.time=modalRoot.querySelector('#moveTime').value;save();closeModal();toast('Activity rescheduled.');render()}}
function weekDates(){const now=dateFromISO(todayISO());const day=(now.getDay()+6)%7;now.setDate(now.getDate()-day);return Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(now.getDate()+i);return localISO(d)})}
function renderWeekBoard(){return weekDates().map(date=>{const acts=state.activities.filter(a=>a.date===date);const first=acts[0],allDone=acts.length&&acts.every(a=>a.completed),today=date===todayISO();return `<button class="day-card ${today?'today':''} ${allDone?'complete':''}" data-day="${date}" aria-label="${esc(fmtDate(date))}${first?` ${esc(first.name)}`:' open'}"><span class="dow">${dateFromISO(date).toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()}</span><span class="training-day-shield">${first?trainingShield(first.type,first.name):trainingShield('Rest','Rest')}</span><small>${first?esc(first.type.replace(' / ',' ')):'Open'}</small><b>${allDone?'✓':today?'TODAY':first?'UPCOMING':'—'}</b></button>`}).join('')}
function nextActivity(){return state.activities.filter(a=>a.date>=todayISO()&&!a.completed).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')))[0]}
function latestCompletedActivity(){return state.activities.filter(a=>a.completed).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')))[0]||null}
function formatTrainingDuration(min){min=Number(min||0);if(!min)return '';if(min<60)return `${Math.round(min)} min`;const h=Math.floor(min/60),m=Math.round(min%60);return `${h}:${String(m).padStart(2,'0')}`}
function workoutPlanLines(a){const lines=String(a.planText||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);if(lines.length)return lines;if(/run/i.test(a.type)){const d=a.distance?`${a.distance} km`:'planned distance';return ['Warm-up · 5–10 min easy',`Main session · ${d}${a.duration?` · ${a.duration} min planned`:''}`,'Cooldown · easy walk / jog'];}return []}
function nextQuestHTML(next){if(!next)return `<section class="rpg-frame primary training-next"><div class="training-panel-title">NEXT TRAINING</div><div class="training-empty-quest">${trainingShield('Rest','Rest')}<div><h2>No workout scheduled</h2><p>Add a workout from the Library or choose a day above.</p></div></div></section>`;const lines=workoutPlanLines(next);return `<section class="rpg-frame primary training-next"><div class="training-panel-title">NEXT TRAINING</div><div class="training-next-grid"><div class="training-next-shield">${trainingShield(next.type,next.name)}</div><div class="training-next-copy"><h2>${esc(next.name)}</h2><div class="training-next-meta"><span>${next.date===todayISO()?'Today':fmtDate(next.date)}</span>${next.duration?`<span>${formatTrainingDuration(next.duration)}</span>`:''}${next.distance?`<span>${next.distance} km</span>`:''}<span>${esc(next.type)}</span></div>${lines.length?`<div class="training-plan-list">${lines.map(x=>`<div>${esc(x)}</div>`).join('')}</div>`:'<p class="helper">No detailed workout plan entered yet.</p>'}<div class="training-next-actions"><button class="rpg-btn accent" data-training-start="${next.id}">${next.startedAt?'COMPLETE WORKOUT':'START WORKOUT'}</button><button class="text-btn" data-training-edit="${next.id}">EDIT</button></div></div></div></section>`}
function activityAwardLabel(a){const text=`${a.type} ${a.name}`;if(/run/i.test(text))return 'DEX + CON XP AWARDED';if(/gym|strength|weight|lift/i.test(text))return 'STR XP AWARDED';if(/cycl/i.test(text))return 'DEX + CON XP AWARDED';if(/mobility|recover/i.test(text))return 'DEX + WIS XP AWARDED';if(/walk|hike/i.test(text))return 'CON XP AWARDED';return 'CHARACTER XP AWARDED'}
/* Recent Activity (Training Phase 2 Overview, 2026-09-11) — merged from
   the old separate "Latest Activity" + "Recent Training" panels per the
   approved Overview order's explicit hard rule: "never recreate as two
   separate panels." Same content as both (latest completed workout
   highlighted, short recent list, view-all link), now one <section>. */
function recentActivityHTML(){
  const latest=latestCompletedActivity();
  const recent=state.activities.slice().sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))).slice(0,4);
  return `<section class="rpg-frame minor training-recent">
    <div class="training-panel-title">RECENT ACTIVITY</div>
    ${latest?`<div class="training-latest-grid"><div>${trainingShield(latest.type,latest.name)}</div><div><h2>${esc(latest.name)}</h2><div class="training-latest-stats">${latest.distance?`<strong>${latest.distance} km</strong>`:''}${latest.duration?`<strong>${formatTrainingDuration(latest.duration)}</strong>`:''}<span>${fmtDate(latest.date)} · ${esc(latest.source||'Manual')}</span>${latest.xpAwarded?`<b>${activityAwardLabel(latest)}</b>`:''}</div></div></div>`:'<p class="helper">No completed workout yet.</p>'}
    ${recent.length?`<div class="training-history-list">${recent.map(a=>`<div class="training-history-row"><span class="history-shield">${trainingShield(a.type,a.name)}</span><strong>${esc(a.name)}</strong><span>${fmtShort(a.date)}</span><span>${a.duration?formatTrainingDuration(a.duration):a.distance?`${a.distance} km`:'—'}</span><b>${a.completed?'✓':'○'}</b></div>`).join('')}</div>`:'<p class="helper">No training logged yet.</p>'}
    <button class="text-btn accent" id="trainingHistory">VIEW ALL HISTORY</button>
  </section>`;
}
const TRAINING_TEMPLATES={
  run:{name:'Easy Run',type:'Running',duration:40,distance:5,planText:'Warm-up · 8 min easy\nMain session · Zone 2 / relaxed conversational pace\nCooldown · 5 min easy'},
  strength:{name:'Strength',type:'Gym / Strength',duration:58,planText:'Squat · 4 × 5\nBench Press · 4 × 5\nBent Over Row · 4 × 6\nOverhead Press · 3 × 6\nPlank · 3 × 45 sec'},
  recovery:{name:'Recovery',type:'Recovery',duration:30,planText:'Easy walk or mobility\nKeep intensity low\nFinish feeling better than you started'},
  cycling:{name:'Cycling',type:'Cycling',duration:60,planText:'Warm-up · 10 min\nSteady ride · comfortable aerobic effort\nCooldown · 5–10 min'},
  custom:{name:'Custom Workout',type:'Other',duration:45,planText:''}
};
function workoutLibraryHTML(){const cards=[['run','Easy Run'],['strength','Strength'],['recovery','Recovery'],['cycling','Cycling'],['custom','Custom']];return `<section class="rpg-frame primary training-library-section"><div class="training-panel-title">RPG TEMPLATES</div><div class="training-library-grid">${cards.map(([key,label])=>{const t=TRAINING_TEMPLATES[key];return `<article class="training-library-card">${trainingShield(t.type,t.name)}<strong>${esc(label)}</strong><button class="text-btn accent" data-template="${key}">SCHEDULE</button></article>`}).join('')}</div></section>`}
function trainingCurrentRecords(){const t=ensureTrainingState(),best=new Map();for(const r of t.records){const old=best.get(r.key);if(!old){best.set(r.key,r);continue}const better=(r.better||TRAINING_RECORD_DEFS[r.key]?.better||'higher')==='lower'?Number(r.value)<Number(old.value):Number(r.value)>Number(old.value);if(better)best.set(r.key,r)}return [...best.values()].sort((a,b)=>String(a.activityType||'').localeCompare(String(b.activityType||''))||String(a.label||'').localeCompare(String(b.label||'')))}
function emitTrainingEvent(type,detail={}){const t=ensureTrainingState(),event={id:uid(),type,date:detail.date||todayISO(),...detail};t.events.push(event);t.events=t.events.slice(-100);handleTrainingAchievementEvent(event);return event}
function achievementStored(id){return (state.achievements||[]).some(a=>(typeof a==='string'?a:a.id)===id)}
function unlockTrainingAchievement(id,title,description,event){if(achievementStored(id))return false;state.achievements.push({id,title,description,unlockedDate:event.date||todayISO(),source:'Training',eventType:event.type});return true}
function handleTrainingAchievementEvent(event){if(event.type==='trainingMilestoneReached'){const m={first_5k:['training_first_5k','First 5 km','Complete a 5 km training activity.'],first_10k:['training_first_10k','First 10 km','Complete a 10 km training activity.'],first_half:['training_first_half','First Half Marathon','Complete 21.1 km in a training activity.'],first_marathon:['training_first_marathon','First Marathon','Complete 42.195 km in a training activity.'],first_climbing:['training_first_climbing','First Climbing Session','Complete your first climbing session.']}[event.metric];if(m)unlockTrainingAchievement(...m,event)}if(event.type==='personalBestCreated'){const m={fastest_5k:['training_pb_5k','New 5 km PB','Set a new 5 km personal best.'],squat_pb:['training_pb_squat','New Squat PB','Set a new Squat personal best.'],bench_pb:['training_pb_bench','New Bench PB','Set a new Bench Press personal best.']}[event.metric];if(m)unlockTrainingAchievement(...m,event)}}
function addTrainingRecord(record,{silent=false}={}){const t=ensureTrainingState(),def=TRAINING_RECORD_DEFS[record.key]||{},same=t.records.filter(r=>r.key===record.key),previous=same.length?trainingCurrentRecords().find(r=>r.key===record.key):null,better=record.better||def.better||'higher';if(previous){const wins=better==='lower'?Number(record.value)<Number(previous.value):Number(record.value)>Number(previous.value);if(!wins&&!record.force)return {created:false,previous}}const entry={id:uid(),key:record.key,label:record.label||def.label||record.key,activityType:record.activityType||def.activityType||'Other',metric:record.key,value:Number(record.value),unit:record.unit||def.unit||'',better,date:record.date||todayISO(),activityId:record.activityId||null,source:record.source||'Manual',previousValue:previous?Number(previous.value):null,notes:record.notes||''};t.records.push(entry);emitTrainingEvent('personalBestCreated',{activityType:entry.activityType,metric:entry.key,previousValue:entry.previousValue,newValue:entry.value,date:entry.date,source:entry.source,activityId:entry.activityId});if(!silent)toast(`${entry.label} recorded.`);return {created:true,entry}}
function processTrainingCompletion(a){const t=ensureTrainingState(),text=`${a.type} ${a.name}`;if(/run/i.test(text)&&Number(a.distance||0)>0){for(const [km,key] of [[5,'first_5k'],[10,'first_10k'],[21.1,'first_half'],[42.195,'first_marathon']]){if(Number(a.distance)>=km&&!t.milestones[key]){t.milestones[key]=a.date||todayISO();emitTrainingEvent('trainingMilestoneReached',{activityType:'Running',metric:key,previousValue:null,newValue:km,date:a.date,source:a.source||'Manual',activityId:a.id})}}addTrainingRecord({key:'longest_run',value:Number(a.distance),date:a.date,source:a.source||'Manual',activityId:a.id},{silent:true})}
  const enduranceKey=ENDURANCE_DISTANCE_RECORD_KEYS[a.type];
  if(enduranceKey&&Number(a.distance||0)>0)addTrainingRecord({key:enduranceKey,value:Number(a.distance),date:a.date,source:a.source||'Manual',activityId:a.id},{silent:true});
  if(/climb/i.test(text)&&!t.milestones.first_climbing){t.milestones.first_climbing=a.date||todayISO();emitTrainingEvent('trainingMilestoneReached',{activityType:'Climbing',metric:'first_climbing',newValue:1,date:a.date,source:a.source||'Manual',activityId:a.id})}
  /* Strength Journal PBs (Lyra handover, 2026-09-06) — reuses the exact
     same addTrainingRecord() mechanism as running/climbing above, not a
     separate PB system. The heaviest COMPLETED set per exercise is the
     PB candidate; unmapped exercise names get an auto-generated record
     key (addTrainingRecord already tolerates a missing TRAINING_RECORD_DEFS
     entry). */
  if(a.sportData.strength&&Array.isArray(a.sportData.strength.exercises)){
    a.sportData.strength.exercises.forEach(ex=>{
      const heaviest=ex.sets.filter(s=>s.completed&&Number(s.weight)>0).reduce((max,s)=>!max||Number(s.weight)>Number(max.weight)?s:max,null);
      if(!heaviest)return;
      const key=strengthPbKeyForExercise(ex.name),def=TRAINING_RECORD_DEFS[key];
      addTrainingRecord({key,value:Number(heaviest.weight),date:a.date,source:a.source||'Manual',activityId:a.id,label:def?.label||`${ex.name} PB`,activityType:def?.activityType||'Strength',unit:def?.unit||'kg'});
    });
  }
  /* Win/loss streaks (Training Phase 6, 2026-09-11) — only for
     WIN_LOSS_SPORTS, only when the activity actually carries an
     outcome (older/other activities won't have one). Win increments
     the live current streak and, only on a genuine new high, records
     it via the same addTrainingRecord() mechanism every other PB in
     this function already uses — silent, since a streak record isn't
     the kind of one-off event that needs its own toast on top of
     normal activity-completion feedback. Loss resets the streak to 0.
     Draw deliberately does neither — an undefeated run isn't broken by
     a draw the way a loss breaks it, and a draw isn't a win either. */
  const streakKey=WIN_STREAK_RECORD_KEYS[a.type];
  if(streakKey&&a.outcome){
    t.streaks[a.type]=Number(t.streaks[a.type]||0);
    if(a.outcome==='win'){
      t.streaks[a.type]+=1;
      addTrainingRecord({key:streakKey,value:t.streaks[a.type],date:a.date,source:a.source||'Manual',activityId:a.id},{silent:true});
    }else if(a.outcome==='loss'){
      t.streaks[a.type]=0;
    }
  }
  /* Journeys movement conversion (ASTRA Update Package 1 §4/§16) — the
     same completed activity credits every eligible ACTIVE Journey. */
  creditJourneyMovement(a);
}
function startTrainingActivity(id){const a=state.activities.find(x=>x.id===id);if(!a)return;if(a.startedAt){if(!a.completed)toggleActivity(id);return}a.startedAt=Date.now();save();toast('Workout started.');renderTraining()}
/* trainingHistoryModal/trainingRecordsModal removed (2026-09-06) — both
   are now first-class Training tabs (trainingHistoryTabHTML/
   trainingRecordsTabHTML) instead of modals, per the Lyra Training
   internal-navigation handover. */
function trainingRecordEntryModal(){const options=Object.entries(TRAINING_RECORD_DEFS).map(([k,d])=>`<option value="${k}">${esc(d.label)}</option>`).join('');modal(`<h2>Add Training Record</h2><div class="form-row"><label>Record</label><select id="recordKey">${options}<option value="custom">Custom record</option></select></div><div id="customRecordFields"></div><div class="two-col"><div class="form-row"><label>Value</label><input id="recordValue" type="number" step="0.01" min="0"></div><div class="form-row"><label>Date</label><input id="recordDate" type="date" value="${todayISO()}"></div></div><div class="form-row"><label>Source</label><input id="recordSource" value="Manual" placeholder="Manual, Strava, Garmin…"></div><button class="rpg-btn accent" id="saveTrainingRecord" style="width:100%">Save Record</button>`);const sel=modalRoot.querySelector('#recordKey'),custom=modalRoot.querySelector('#customRecordFields');const draw=()=>{custom.innerHTML=sel.value==='custom'?`<div class="two-col"><div class="form-row"><label>Metric name</label><input id="customRecordLabel" placeholder="e.g. Pull-up max"></div><div class="form-row"><label>Activity</label><input id="customRecordActivity" placeholder="Strength"></div></div><div class="two-col"><div class="form-row"><label>Unit</label><input id="customRecordUnit" placeholder="kg, km, reps…"></div><div class="form-row"><label>Better result</label><select id="customRecordBetter"><option value="higher">Higher</option><option value="lower">Lower</option></select></div></div>`:''};sel.onchange=draw;draw();modalRoot.querySelector('#saveTrainingRecord').onclick=()=>{const value=Number(modalRoot.querySelector('#recordValue').value);if(!(value>0))return toast('Enter a record value.');let key=sel.value,extra={};if(key==='custom'){const label=modalRoot.querySelector('#customRecordLabel').value.trim();if(!label)return toast('Name the record.');key=`custom_${label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}`;extra={label,activityType:modalRoot.querySelector('#customRecordActivity').value.trim()||'Other',unit:modalRoot.querySelector('#customRecordUnit').value.trim(),better:modalRoot.querySelector('#customRecordBetter').value}}const result=addTrainingRecord({key,value,date:modalRoot.querySelector('#recordDate').value||todayISO(),source:modalRoot.querySelector('#recordSource').value.trim()||'Manual',...extra});if(!result.created){toast('That does not beat the current record.');return}save();closeModal();trainingTab='Records';renderTrainingArea()}}
function trainingManageConnections(){const current=ensureTrainingState().selectedConnection;const rows=Object.entries(TRAINING_CONNECTIONS).map(([name,c])=>`<button class="training-connection-row ${name===current?'selected':''}" data-training-connection="${esc(name)}"><span>${connectionShield(name)}</span><span><b>${esc(name)}</b><small>${esc(c.status)}</small></span><i>${name===current?'SELECTED':'SELECT'}</i></button>`).join('');modal(`<h2>Connections</h2><p class="helper"><b>Intended Garmin flow:</b> Garmin Connect → Strava → RPG. This build does not claim automatic account sync or FIT parsing.</p><div class="training-connection-list">${rows}</div>`);modalRoot.querySelectorAll('[data-training-connection]').forEach(b=>b.onclick=()=>{ensureTrainingState().selectedConnection=b.dataset.trainingConnection;save();closeModal();renderTraining()})}
function connectionsModal(){trainingManageConnections()}
/* ---------- Training internal navigation + Strength Journal ----------
   Lyra "Training Internal Pages & Strength Journal" handover
   (2026-09-06). Overview/History/Records/Workouts reuse the exact
   existing data and helpers (trainingCurrentRecords, addTrainingRecord,
   TRAINING_RECORD_DEFS, processTrainingCompletion, awardActivity) —
   nothing here duplicates XP, stats, records or the activity model.
   Journal is the one genuinely new surface; it writes activity.sportData.strength
   onto the existing state.activities entries per the handover's own
   "Suggested Data Extension", not a disconnected database. (Nested under
   sportData, not top-level, as of the Training Phase 1 Foundation
   normalization pass, 2026-09-11 — see load()'s migration comment.) */
const TRAINING_TABS=['Overview','Journal','History','Records','Workouts'];
let trainingTab='Overview',journalActivityId=null,trainingHistoryTypeFilter='All';
function ensureActivityStrength(a){
  if(!a.sportData||typeof a.sportData!=='object')a.sportData={};
  if(!a.sportData.strength||typeof a.sportData.strength!=='object')a.sportData.strength={exercises:[],sessionNotes:''};
  const s=a.sportData.strength;
  if(!Array.isArray(s.exercises))s.exercises=[];
  if(typeof s.sessionNotes!=='string')s.sessionNotes='';
  s.exercises.forEach(ex=>{
    ex.exerciseId=ex.exerciseId||uid();ex.name=ex.name||'Exercise';ex.notes=ex.notes||'';
    if(!Array.isArray(ex.sets))ex.sets=[];
    ex.sets.forEach(st=>{st.weight=Number(st.weight||0);st.reps=Number(st.reps||0);st.completed=Boolean(st.completed);st.warmup=Boolean(st.warmup);st.rpe=st.rpe===''||st.rpe==null?null:Number(st.rpe)});
  });
  return s;
}
function strengthPbKeyForExercise(name){
  const n=String(name||'').trim().toLowerCase();
  if(/squat/.test(n))return 'squat_pb';
  if(/bench/.test(n))return 'bench_pb';
  if(/deadlift/.test(n))return 'deadlift_pb';
  if(/overhead|shoulder\s*press|\bohp\b/.test(n))return 'overhead_press_pb';
  const slug=n.replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'exercise';
  return `strength_pb_${slug}`;
}
function currentTrainingRecordValue(key){const r=trainingCurrentRecords().find(x=>x.key===key);return r?Number(r.value):null}
function previousExerciseSets(name,excludeActivityId){
  const norm=String(name||'').trim().toLowerCase();if(!norm)return null;
  const candidates=state.activities.filter(a=>a.id!==excludeActivityId&&a.sportData&&a.sportData.strength&&Array.isArray(a.sportData.strength.exercises)).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
  for(const a of candidates){const ex=a.sportData.strength.exercises.find(e=>String(e.name||'').trim().toLowerCase()===norm);if(ex&&ex.sets.length)return ex.sets}
  return null;
}
function previousSetsSummary(sets){
  if(!sets||!sets.length)return '';
  const weights=[...new Set(sets.map(s=>Number(s.weight||0)))];
  return weights.length===1?`${weights[0]} kg × ${sets.map(s=>s.reps).join(', ')}`:sets.map(s=>`${s.weight}kg×${s.reps}`).join(', ');
}
function lastStrengthActivity(excludeId){
  return state.activities.filter(a=>a.id!==excludeId&&a.sportData&&a.sportData.strength&&Array.isArray(a.sportData.strength.exercises)&&a.sportData.strength.exercises.length).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')))[0]||null;
}
function currentJournalActivity(){
  ensureTrainingState();
  if(journalActivityId){const a=state.activities.find(x=>x.id===journalActivityId);if(a)return a}
  const upcoming=state.activities.filter(a=>a.type==='Gym / Strength'&&!a.completed).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')))[0];
  if(upcoming){journalActivityId=upcoming.id;return upcoming}
  return null;
}
function trainingTabsHTML(){return `<div class="tabs training-tabs">${TRAINING_TABS.map(t=>`<button type="button" class="${trainingTab===t?'active':''}" data-training-tab="${t}">${t.toUpperCase()}</button>`).join('')}</div>`}
function trainingTypesHTML(){
  const counts={};state.activities.forEach(a=>{counts[a.type]=(counts[a.type]||0)+1});
  const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(!rows.length)return '';
  return `<section class="rpg-frame minor training-categories"><div class="training-panel-title">TRAINING TYPES</div><div class="training-category-row">${rows.map(([type,n])=>`<div class="training-category-chip">${trainingShield(type,'')}<span>${esc(type)}</span><b>${n}</b></div>`).join('')}</div></section>`;
}
/* Favourite Activities — 4 configurable slots (bumped from 2, 2026-09-11
   direct request). Large shield icon with its title underneath (2026-09-11
   revision, replacing the earlier horizontal chip+"Change"-button layout).
   Configuration lives in one place, Training Settings (profileTrainingTab()),
   reachable from the gear icon in Training's own header, the main Profile
   & Setup modal, or an empty tile (jumps straight there) — a corner "+"
   here was considered and dropped per direct instruction ("ignore the +
   button it exists already"), since the header gear already covers that
   entry point even when every tile is filled. */
function favouriteActivitiesHTML(){
  const t=ensureTrainingState(),slots=t.favouriteActivityTypes;
  return `<section class="rpg-frame minor training-favourites"><div class="training-panel-title">FAVOURITE ACTIVITIES</div><div class="training-favourites-row">${slots.map((type,i)=>type?`<button type="button" class="training-favourite-tile" data-favourite-start="${i}">${trainingShield(type,'')}<span>${esc(type)}</span></button>`:`<button type="button" class="training-favourite-tile empty" data-open-training-settings="1">+ Choose Favourite</button>`).join('')}</div></section>`;
}
/* Overview section order is the approved one, not incidental: Next
   Training -> Favourite Activities -> This Week -> Training Types ->
   Recent Activity (one merged panel, see recentActivityHTML) -> Compact
   Connections. The old "Records" entry button isn't in that approved
   list -- Records is still reachable via its own tab, just not
   duplicated here. */
function trainingOverviewHTML(){
  const next=nextActivity();
  return `${nextQuestHTML(next)}${favouriteActivitiesHTML()}<section class="rpg-frame primary training-week"><div class="training-panel-title">THIS WEEK</div><div class="week-board">${renderWeekBoard()}</div><div class="training-week-actions"><button class="text-btn accent" id="addTraining">+ ADD ACTIVITY</button><button class="text-btn" id="fitInfo">FIT IMPORT</button></div></section>${trainingTypesHTML()}${recentActivityHTML()}${trainingConnectionHTML()}`;
}
function trainingHistoryTabHTML(){
  const types=['All',...new Set(state.activities.map(a=>a.type))];
  const rows=state.activities.filter(a=>trainingHistoryTypeFilter==='All'||a.type===trainingHistoryTypeFilter).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
  return `<section class="rpg-frame primary training-history-page">
    <div class="training-panel-title">TRAINING HISTORY</div>
    <div class="form-row"><label>Filter by type</label><select id="trainingHistoryFilter">${types.map(t=>`<option value="${esc(t)}" ${t===trainingHistoryTypeFilter?'selected':''}>${esc(t)}</option>`).join('')}</select></div>
    ${rows.length?rows.map(a=>`<div class="list-item training-modal-row" data-history-open="${a.id}"><div>${activityIcon(a.type,a.name)}</div><div><h3>${esc(a.name)}</h3><p>${fmtDate(a.date)} · ${esc(a.type)}${a.distance?` · ${a.distance} km`:''}${a.duration?` · ${formatTrainingDuration(a.duration)}`:''} · ${esc(a.source||'Manual')}</p></div><span class="tag ${a.completed?'quest':''}">${a.completed?'Complete':'Planned'}</span></div>`).join(''):'<p class="helper">No training history yet.</p>'}
  </section>`;
}
/* Win-streak rows show the LIVE current streak alongside the best-ever
   value the row already displays — a streak record is a snapshot of the
   best a running counter has ever reached, so without this the row would
   only ever show history and never today's actual streak. Every other
   record type keeps its existing "Previous X" line unchanged. */
function trainingRecordRowMetaHTML(r){
  if(r.key&&WIN_STREAK_RECORD_KEYS[r.activityType]===r.key){
    const current=Number(ensureTrainingState().streaks[r.activityType]||0);
    return `<small>Current streak ${current} ${current===1?'win':'wins'}</small>`;
  }
  return r.previousValue!==null&&r.previousValue!==undefined?`<small>Previous ${Number(r.previousValue).toLocaleString()} ${esc(r.unit)}</small>`:'';
}
function trainingRecordsTabHTML(){
  const rows=trainingCurrentRecords();
  return `<section class="rpg-frame primary training-records-page">
    <div class="training-panel-title">RECORDS &amp; PERSONAL BESTS</div>
    <p class="helper">Training owns these records — visually distinct from Achievements, no rarity frames. Achievement unlocks listen for record events rather than recalculating history.</p>
    ${rows.length?`<div class="training-record-list">${rows.map(r=>`<div class="training-record-row"><div><b>${esc(r.label)}</b><span>${esc(r.activityType)} · ${fmtDate(r.date)}</span></div><strong>${Number(r.value).toLocaleString()} ${esc(r.unit)}</strong>${trainingRecordRowMetaHTML(r)}</div>`).join('')}</div>`:'<p class="empty">No records yet.</p>'}
    <button class="rpg-btn accent" id="addTrainingRecord" style="width:100%">Add Record</button>
  </section>`;
}
function trainingWorkoutsTabHTML(){return workoutLibraryFullHTML()}
/* ---- Strength Journal ---- */
function journalSetRowHTML(ex,s,si,pbValue){
  const isPb=s.completed&&Number(s.weight)>0&&pbValue!=null&&Number(s.weight)>=pbValue;
  return `<div class="journal-set-row ${s.completed?'completed':''}">
    <span class="journal-set-num">${s.warmup?'W':si+1}</span>
    <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="kg" value="${s.weight||''}" data-set-field="weight" data-exercise-id="${ex.exerciseId}" data-set-index="${si}">
    <input type="number" inputmode="numeric" min="0" placeholder="reps" value="${s.reps||''}" data-set-field="reps" data-exercise-id="${ex.exerciseId}" data-set-index="${si}">
    <input type="number" inputmode="decimal" min="1" max="10" step="0.5" placeholder="RPE" value="${s.rpe??''}" data-set-field="rpe" data-exercise-id="${ex.exerciseId}" data-set-index="${si}">
    <button type="button" class="journal-set-complete ${s.completed?'active':''}" data-toggle-set="${ex.exerciseId}|${si}" aria-label="Mark set complete">✓</button>
    <button type="button" class="journal-set-delete" data-delete-set="${ex.exerciseId}|${si}" aria-label="Delete set">×</button>
    ${isPb?'<span class="journal-pb-tag">PB</span>':''}
  </div>`;
}
function journalExerciseHTML(a,ex){
  const prevSets=previousExerciseSets(ex.name,a.id),prevText=previousSetsSummary(prevSets);
  const pbValue=currentTrainingRecordValue(strengthPbKeyForExercise(ex.name));
  return `<div class="journal-exercise rpg-frame minor" data-exercise-id="${ex.exerciseId}">
    <div class="journal-exercise-head">
      ${trainingShield('Gym / Strength',ex.name,'journal-exercise-shield')}
      <input class="journal-exercise-name" data-exercise-name="${ex.exerciseId}" value="${esc(ex.name)}" placeholder="Exercise name">
      <button type="button" class="text-btn danger" data-delete-exercise="${ex.exerciseId}" aria-label="Remove exercise">Remove</button>
    </div>
    ${prevText?`<div class="journal-previous">Previous: ${esc(prevText)}</div>`:''}
    <div class="journal-set-list">
      <div class="journal-set-row journal-set-header"><span>SET</span><span>WEIGHT</span><span>REPS</span><span>RPE</span><span></span><span></span></div>
      ${ex.sets.map((s,si)=>journalSetRowHTML(ex,s,si,pbValue)).join('')}
    </div>
    <div class="journal-exercise-actions">
      <button type="button" class="text-btn accent" data-add-set="${ex.exerciseId}">+ Add Set</button>
      ${ex.sets.length?`<button type="button" class="text-btn" data-copy-last-set="${ex.exerciseId}">Copy Last Set</button>`:''}
    </div>
    <textarea class="journal-exercise-notes" data-exercise-notes="${ex.exerciseId}" placeholder="Exercise notes (optional)" rows="1">${esc(ex.notes)}</textarea>
  </div>`;
}
function journalTabHTML(){
  const a=currentJournalActivity();
  if(!a)return `<section class="rpg-frame primary training-journal-empty"><div class="training-panel-title">STRENGTH JOURNAL</div><p class="helper">No Gym / Strength session scheduled. Add one from the Workout Library or Overview, then open Journal to log it.</p><button type="button" class="rpg-btn accent" id="journalScheduleStrength">Schedule a Strength Session</button></section>`;
  const strength=ensureActivityStrength(a);
  const last=lastStrengthActivity(a.id);
  return `<section class="rpg-frame primary training-journal">
    <div class="journal-session-header">
      <input class="journal-session-name" id="journalSessionName" value="${esc(a.name)}" placeholder="Session name">
      <div class="journal-session-meta"><span>${fmtDate(a.date)}</span>${a.completed?'<span class="tag quest">Complete</span>':''}</div>
    </div>
    <div class="journal-session-actions">
      <button type="button" class="text-btn accent" id="journalAddExercise">+ Add Exercise</button>
      ${last?`<button type="button" class="text-btn" id="journalCopyLastSession">Copy Last Session</button>`:''}
      ${strength.exercises.length?`<button type="button" class="text-btn" id="journalSaveAsTemplate">Save as Template</button>`:''}
    </div>
    ${strength.exercises.length?strength.exercises.map(ex=>journalExerciseHTML(a,ex)).join(''):'<p class="helper">No exercises yet — add one to begin logging sets.</p>'}
    <div class="form-row journal-session-notes-field"><label>Session notes</label><textarea id="journalSessionNotes" rows="2" placeholder="How did it feel?">${esc(strength.sessionNotes)}</textarea></div>
    <div class="journal-finish-row">
      <button type="button" class="rpg-btn" id="journalSaveDraft">Save Draft</button>
      <button type="button" class="rpg-btn accent" id="journalFinishWorkout" ${a.completed?'disabled':''}>${a.completed?'Workout Complete':'Finish Workout'}</button>
    </div>
  </section>`;
}
/* Add Exercise now opens the full searchable Exercise Library
   (v0.02.17-exercise-library.js, Astra Strength Library handover
   2026-09-11) instead of a plain name prompt -- the picked exercise
   (built-in or custom) is pushed onto this activity's own Strength
   Journal exercise list exactly like the old plain-text flow did, so
   nothing downstream (previousExerciseSets name-matching, PB tracking)
   needed to change. */
function journalAddExerciseModal(a){
  exerciseLibraryModal(ex=>{
    ensureActivityStrength(a).exercises.push({exerciseId:uid(),name:ex.name,notes:'',sets:[]});
    save();renderTrainingArea();
  });
}
function renderTrainingArea(){
  ensureTrainingState();
  const body=trainingTab==='Journal'?journalTabHTML():trainingTab==='History'?trainingHistoryTabHTML():trainingTab==='Records'?trainingRecordsTabHTML():trainingTab==='Workouts'?trainingWorkoutsTabHTML():trainingOverviewHTML();
  view.innerHTML=`${trainingHeaderHTML()}${trainingTabsHTML()}${body}`;
  bindTraining();
}
const renderTraining=renderTrainingArea;
function bindJournal(){
  const a=currentJournalActivity();
  const scheduleBtn=document.querySelector('#journalScheduleStrength');if(scheduleBtn)scheduleBtn.onclick=()=>activityModal('add',{...TRAINING_TEMPLATES.strength,date:todayISO()});
  if(!a)return;
  const nameInput=document.querySelector('#journalSessionName');if(nameInput)nameInput.oninput=()=>{a.name=nameInput.value;save()};
  const notesInput=document.querySelector('#journalSessionNotes');if(notesInput)notesInput.oninput=()=>{ensureActivityStrength(a).sessionNotes=notesInput.value;save()};
  const addExercise=document.querySelector('#journalAddExercise');if(addExercise)addExercise.onclick=()=>journalAddExerciseModal(a);
  const copySession=document.querySelector('#journalCopyLastSession');if(copySession)copySession.onclick=()=>{
    const last=lastStrengthActivity(a.id);if(!last)return;
    ensureActivityStrength(a).exercises=ensureActivityStrength(last).exercises.map(ex=>({exerciseId:uid(),name:ex.name,notes:'',sets:ex.sets.map(s=>({weight:s.weight,reps:s.reps,rpe:null,completed:false,warmup:Boolean(s.warmup)}))}));
    save();toast('Copied last session.');renderTrainingArea();
  };
  const saveTemplate=document.querySelector('#journalSaveAsTemplate');if(saveTemplate)saveTemplate.onclick=()=>saveJournalAsTemplateModal(a);
  document.querySelectorAll('[data-exercise-name]').forEach(inp=>inp.oninput=()=>{
    const ex=a.sportData.strength.exercises.find(e=>e.exerciseId===Number(inp.dataset.exerciseName));if(ex){ex.name=inp.value;save()}
  });
  document.querySelectorAll('[data-exercise-notes]').forEach(inp=>inp.oninput=()=>{
    const ex=a.sportData.strength.exercises.find(e=>e.exerciseId===Number(inp.dataset.exerciseNotes));if(ex){ex.notes=inp.value;save()}
  });
  document.querySelectorAll('[data-delete-exercise]').forEach(b=>b.onclick=()=>{
    a.sportData.strength.exercises=a.sportData.strength.exercises.filter(e=>e.exerciseId!==Number(b.dataset.deleteExercise));save();renderTrainingArea();
  });
  document.querySelectorAll('[data-add-set]').forEach(b=>b.onclick=()=>{
    const ex=a.sportData.strength.exercises.find(e=>e.exerciseId===Number(b.dataset.addSet));if(!ex)return;
    const lastSet=ex.sets[ex.sets.length-1];
    const prev=lastSet||previousExerciseSets(ex.name,a.id)?.[0];
    ex.sets.push({weight:prev?Number(prev.weight||0):0,reps:prev?Number(prev.reps||0):0,rpe:null,completed:false,warmup:false});
    save();renderTrainingArea();
  });
  document.querySelectorAll('[data-copy-last-set]').forEach(b=>b.onclick=()=>{
    const ex=a.sportData.strength.exercises.find(e=>e.exerciseId===Number(b.dataset.copyLastSet));if(!ex||!ex.sets.length)return;
    const last=ex.sets[ex.sets.length-1];
    ex.sets.push({weight:last.weight,reps:last.reps,rpe:null,completed:false,warmup:false});
    save();renderTrainingArea();
  });
  document.querySelectorAll('[data-delete-set]').forEach(b=>b.onclick=()=>{
    const [exId,idx]=b.dataset.deleteSet.split('|');const ex=a.sportData.strength.exercises.find(e=>e.exerciseId===Number(exId));if(!ex)return;
    ex.sets.splice(Number(idx),1);save();renderTrainingArea();
  });
  document.querySelectorAll('[data-toggle-set]').forEach(b=>b.onclick=()=>{
    const [exId,idx]=b.dataset.toggleSet.split('|');const ex=a.sportData.strength.exercises.find(e=>e.exerciseId===Number(exId));if(!ex)return;
    const s=ex.sets[Number(idx)];if(!s)return;s.completed=!s.completed;save();renderTrainingArea();
  });
  document.querySelectorAll('[data-set-field]').forEach(inp=>inp.oninput=()=>{
    const ex=a.sportData.strength.exercises.find(e=>e.exerciseId===Number(inp.dataset.exerciseId));if(!ex)return;
    const s=ex.sets[Number(inp.dataset.setIndex)];if(!s)return;
    const field=inp.dataset.setField;
    s[field]=field==='rpe'?(inp.value===''?null:Number(inp.value)):Number(inp.value||0);
    save();
  });
  const draft=document.querySelector('#journalSaveDraft');if(draft)draft.onclick=()=>{save();toast('Draft saved.')};
  const finish=document.querySelector('#journalFinishWorkout');if(finish)finish.onclick=()=>{
    if(a.completed)return;
    toggleActivity(a.id);
  };
}
function bindTraining(){
  document.querySelectorAll('[data-training-tab]').forEach(b=>b.onclick=()=>{trainingTab=b.dataset.trainingTab;renderTrainingArea()});
  const settingsBtn=document.querySelector('#trainingSettingsBtn');if(settingsBtn)settingsBtn.onclick=()=>profileModal('training');
  if(trainingTab==='Journal'){bindJournal();return}
  if(trainingTab==='History'){
    const filter=document.querySelector('#trainingHistoryFilter');if(filter)filter.onchange=()=>{trainingHistoryTypeFilter=filter.value;renderTrainingArea()};
    document.querySelectorAll('[data-history-open]').forEach(row=>row.onclick=()=>{const a=state.activities.find(x=>x.id===Number(row.dataset.historyOpen)||x.id===row.dataset.historyOpen);if(a&&a.type==='Gym / Strength'){journalActivityId=a.id;trainingTab='Journal';renderTrainingArea()}else if(a)editActivityModal(a.id)});
    return;
  }
  if(trainingTab==='Records'){const add=document.querySelector('#addTrainingRecord');if(add)add.onclick=trainingRecordEntryModal;return}
  if(trainingTab==='Workouts'){
    document.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>activityModal('add',{...TRAINING_TEMPLATES[b.dataset.template],date:todayISO()}));
    const newBtn=document.querySelector('#newWorkoutBuilder');if(newBtn)newBtn.onclick=()=>workoutBuilderModal();
    document.querySelectorAll('[data-start-workout]').forEach(b=>b.onclick=()=>startWorkoutTemplate(b.dataset.startWorkout));
    document.querySelectorAll('[data-edit-workout]').forEach(b=>b.onclick=()=>workoutBuilderModal(b.dataset.editWorkout));
    return;
  }
  // Overview
  const add=document.querySelector('#addTraining'),sel=document.querySelector('#trainingConnectionSelect'),shield=document.querySelector('#trainingConnectionShield'),manage=document.querySelector('#trainingManageConnections'),history=document.querySelector('#trainingHistory');
  if(add)add.onclick=()=>activityModal('add');if(sel)sel.onchange=()=>{ensureTrainingState().selectedConnection=sel.value;save();renderTrainingArea()};if(manage)manage.onclick=trainingManageConnections;if(history)history.onclick=()=>{trainingTab='History';renderTrainingArea()};
  document.querySelectorAll('[data-favourite-start]').forEach(b=>b.onclick=()=>{const t=ensureTrainingState(),type=t.favouriteActivityTypes[Number(b.dataset.favouriteStart)];if(type)activityModal('add',{type,date:todayISO()})});
  document.querySelectorAll('[data-open-training-settings]').forEach(b=>b.onclick=()=>profileModal('training'));
  if(shield)shield.onclick=()=>{const c=TRAINING_CONNECTIONS[ensureTrainingState().selectedConnection];if(c.url)window.open(c.url,'_blank','noopener');else trainingManageConnections()};
  const fit=document.querySelector('#fitInfo');if(fit)fit.onclick=()=>{modal(`<h2>FIT Import</h2><p class="helper">A genuine FIT parser is not packaged in this build. No file will be presented as imported. Manual entry remains available.</p><button class="rpg-btn accent" id="manualInstead" style="width:100%">Log Activity Manually</button>`);const b=modalRoot.querySelector('#manualInstead');if(b)b.onclick=()=>activityModal('add')};
  document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>activityModal('add',{date:b.dataset.day}));
  document.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>activityModal('add',{...TRAINING_TEMPLATES[b.dataset.template],date:todayISO()}));
  document.querySelectorAll('[data-training-start]').forEach(b=>b.onclick=()=>{
    const act=state.activities.find(x=>x.id===Number(b.dataset.trainingStart));
    startTrainingActivity(Number(b.dataset.trainingStart));
    if(act&&act.type==='Gym / Strength'){journalActivityId=act.id;trainingTab='Journal';renderTrainingArea()}
  });
  document.querySelectorAll('[data-training-edit]').forEach(b=>b.onclick=()=>editActivityModal(Number(b.dataset.trainingEdit)));
}

/* ---------- TASKS ---------- */
/* Refactored onto sharedScheduleItemsForDate (Phase 3B.3) — the counting
   buckets weekCalendarHTML/monthCalendarHTML read (.length/.slice() only,
   never individual item fields) are unaffected by the switch from raw
   state arrays to normalized rows. Main Quest/Personal Growth rows exist
   in the aggregator's output for this date but aren't bucketed into any
   of these three — the calendar dot-rendering functions have exactly
   three dot types today; adding a fourth is a UI decision, not made
   here. */
/* Bucketing fix (Phase 3B.7 QA) — this consumer only ever recognized
   'task'/'activity'/'quest' kinds, so the 'personalGrowth' and
   'mainQuest' kinds sharedScheduleItemsForDate started emitting in
   Phase 3B.3 were silently dropped here: they never produced a dot on
   the Adventurer's Log week/month calendar, even though every other
   consumer (scheduleItems/scheduleHTML, the Home Today panel) already
   showed them correctly. Folded into the existing 'activities' dot
   bucket rather than inventing a new dot style/color — that's a design
   decision this phase isn't making, just restoring the count this
   consumer already promised to show for every shared-schedule row. */
function calendarEventsFor(date){
  const items=sharedScheduleItemsForDate(date);
  return {tasks:items.filter(i=>i.kind==='task'),activities:items.filter(i=>['activity','mainQuest','personalGrowth'].includes(i.kind)),quest:items.some(i=>i.kind==='quest')?1:0};
}
function weekCalendarHTML(){return weekDates().map(date=>{const e=calendarEventsFor(date);return `<div class="cal-day ${date===todayISO()?'today':''}"><div class="num">${dateFromISO(date).getDate()}</div>${e.quest?'<div class="cal-dot quest"></div>':''}${e.activities.slice(0,2).map(()=>'<div class="cal-dot activity"></div>').join('')}${e.tasks.slice(0,3).map(()=>'<div class="cal-dot"></div>').join('')}</div>`}).join('')}
function monthCalendarHTML(){
  const now=dateFromISO(todayISO());const y=now.getFullYear(),m=now.getMonth();const first=new Date(y,m,1,12);const mondayOffset=(first.getDay()+6)%7;const start=new Date(y,m,1-mondayOffset,12);const cells=[];
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=localISO(d),e=calendarEventsFor(iso),count=e.tasks.length+e.activities.length+e.quest;cells.push(`<div class="month-day ${d.getMonth()!==m?'muted':''} ${iso===todayISO()?'today':''}">${d.getDate()}${count?`<span class="count">${count}</span>`:''}</div>`)}
  return `<div class="month-calendar">${['M','T','W','T','F','S','S'].map(x=>`<div class="month-label">${x}</div>`).join('')}${cells.join('')}</div>`;
}

function openPriorityCount(excludeId=null){return state.tasks.filter(t=>t.priority&&!t.done&&t.id!==excludeId).length}
function canAddPriority(excludeId=null){return openPriorityCount(excludeId)<3}
function taskList(){
  let arr=state.tasks.slice();if(taskFilter==='Open')arr=arr.filter(t=>!t.done);else if(taskFilter==='Today')arr=arr.filter(t=>t.date===todayISO()&&!t.done);else if(taskFilter==='Soon')arr=arr.filter(t=>t.date>todayISO()&&!t.done);else if(taskFilter==='Done')arr=arr.filter(t=>t.done);
  return arr.sort((a,b)=>(a.done-b.done)||String(a.date).localeCompare(String(b.date)));
}
function renderTasks(){
  const priorities=state.tasks.filter(t=>t.priority&&!t.done).slice(0,3);const tasks=taskList();
  view.innerHTML=pageHeader("Adventurer's Log",'Journal & Calendar')+`
    <div class="section-tabs" aria-label="Adventurer's Log sections"><span class="active">Journal</span><span>Calendar</span></div>
    <section class="rpg-frame primary"><div class="calendar-controls"><div><div class="quest-kicker">Calendar Overview</div><b style="font-size:12px">${dateFromISO(todayISO()).toLocaleDateString(undefined,{month:'long',year:'numeric'})}</b></div><div class="segmented"><button data-calview="week" class="${taskView==='week'?'active':''}">Week</button><button data-calview="month" class="${taskView==='month'?'active':''}">Month</button></div></div>${taskView==='week'?`<div class="week-calendar">${weekCalendarHTML()}</div>`:monthCalendarHTML()}<div class="toolbar"><button class="rpg-btn accent" id="addTaskButton">Add Task</button><button class="text-btn" id="addCalendarActivity">Add Activity</button></div></section>
    <h2 class="section-title">Top 3 Priorities</h2><section class="priority-grid">${[0,1,2].map(i=>`<div class="priority-slot"><b>#${i+1}</b><span>${priorities[i]?esc(priorities[i].text):'Open slot'}</span></div>`).join('')}</section>
    <h2 class="section-title">Tasks</h2><div class="task-filter">${['Open','Today','Soon','Done','All'].map(x=>`<button class="text-btn ${taskFilter===x?'active':''}" data-filter="${x}">${x}</button>`).join('')}</div><section class="rpg-frame minor">${tasks.length?tasks.map(t=>`<div class="list-item"><input type="checkbox" data-task-check="${t.id}" ${t.done?'checked':''}><div><h3>${esc(t.text)}</h3><p>${fmtShort(t.date)} · ${esc(t.bucket)} · ${esc(t.difficulty)}${t.priority?' · Priority':''}</p></div><div class="list-actions"><button class="text-btn" data-pin="${t.id}">${t.priority?'★':'☆'}</button><button class="text-btn" data-task-edit="${t.id}">Edit</button></div></div>`).join(''):'<div class="empty">No tasks in this view.</div>'}</section>
    <h2 class="section-title">Brain Dump</h2><section class="rpg-frame minor"><div class="brain-row"><input id="brainInput" placeholder="Get it out of your head…"><button class="rpg-btn small" id="brainAdd">Capture</button></div>${state.brainDump.slice(-4).reverse().map(x=>`<div class="list-item"><div>✦</div><div><h3>${esc(x.text)}</h3><p>Captured</p></div><button class="text-btn accent" data-brain-task="${x.id}">→ Task</button></div>`).join('')}</section>
    <h2 class="section-title">Focus Tools</h2><section class="rpg-frame standard focus-box"><div class="timer" id="focusTimer">${formatTimer(focusSeconds)}</div><div class="toolbar"><button class="rpg-btn accent" id="focusStart">${focusRunning?'Pause':'Start'}</button><button class="text-btn" id="focusReset">Reset</button><button class="text-btn" id="randomTask">Random Task</button><button class="text-btn" id="lowEnergy">Low Energy</button></div><div class="random-task" id="randomTaskDisplay">Choose a tool when your brain refuses to cooperate.</div></section>`;
  bindTasks();
}
function taskModal(existing=null){
  const t=existing||{text:'',date:todayISO(),bucket:'Today',difficulty:'Normal',priority:false};
  modal(`<h2>${existing?'Edit':'Add'} Task</h2><div class="form-row"><label>Task</label><input id="taskText" value="${esc(t.text)}" placeholder="What needs doing?"></div><div class="two-col"><div class="form-row"><label>Date</label><input id="taskDate" type="date" value="${t.date||todayISO()}"></div><div class="form-row"><label>Bucket</label><select id="taskBucket">${['Today','Soon','Later'].map(x=>`<option ${t.bucket===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="two-col"><div class="form-row"><label>Difficulty</label><select id="taskDifficulty">${['Tiny','Easy','Normal','Hard','Boss Fight'].map(x=>`<option ${t.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="form-row"><label>Priority</label><select id="taskPriority"><option value="no" ${!t.priority?'selected':''}>Normal</option><option value="yes" ${t.priority?'selected':''}>Top Priority</option></select></div></div><button class="rpg-btn accent" id="saveTask" style="width:100%">Save Task</button>${existing?'<button class="text-btn" id="deleteTask" style="width:100%;margin-top:6px">Delete Task</button>':''}`);
  modalRoot.querySelector('#saveTask').onclick=()=>{const text=modalRoot.querySelector('#taskText').value.trim();if(!text){toast('Task needs a name.');return}const obj=existing||{id:uid(),done:false};const wantsPriority=modalRoot.querySelector('#taskPriority').value==='yes';if(wantsPriority&&!canAddPriority(obj.id)){toast('Top 3 Priorities is already full.');return}Object.assign(obj,{text,date:modalRoot.querySelector('#taskDate').value||todayISO(),bucket:modalRoot.querySelector('#taskBucket').value,difficulty:modalRoot.querySelector('#taskDifficulty').value,priority:wantsPriority});if(!existing)state.tasks.push(obj);save();closeModal();renderTasks()};
  if(existing)modalRoot.querySelector('#deleteTask').onclick=()=>{state.tasks=state.tasks.filter(x=>x.id!==existing.id);save();closeModal();renderTasks()};
}
function bindTasks(){
  document.querySelectorAll('[data-calview]').forEach(b=>b.onclick=()=>{taskView=b.dataset.calview;renderTasks()});document.querySelector('#addTaskButton').onclick=()=>taskModal();document.querySelector('#addCalendarActivity').onclick=()=>activityModal('add');
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{taskFilter=b.dataset.filter;renderTasks()});
  document.querySelectorAll('[data-task-check]').forEach(c=>c.onchange=()=>{const t=state.tasks.find(x=>x.id===Number(c.dataset.taskCheck));if(!t)return;t.done=c.checked;if(!t.done&&t.priority&&!canAddPriority(t.id)){t.priority=false;toast('Priority removed because the Top 3 is full.')}save();renderTasks()});
  document.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>{const t=state.tasks.find(x=>x.id===Number(b.dataset.pin));if(!t)return;if(!t.priority&&!canAddPriority(t.id)){toast('Top 3 Priorities is already full.');return}t.priority=!t.priority;save();renderTasks()});document.querySelectorAll('[data-task-edit]').forEach(b=>b.onclick=()=>taskModal(state.tasks.find(x=>x.id===Number(b.dataset.taskEdit))));
  document.querySelector('#brainAdd').onclick=()=>{const el=document.querySelector('#brainInput'),text=el.value.trim();if(text){state.brainDump.push({id:uid(),text});save();renderTasks()}};document.querySelectorAll('[data-brain-task]').forEach(b=>b.onclick=()=>{const x=state.brainDump.find(q=>q.id===Number(b.dataset.brainTask));if(x){state.tasks.push({id:uid(),text:x.text,done:false,date:todayISO(),bucket:'Today',difficulty:'Normal',priority:false});state.brainDump=state.brainDump.filter(q=>q.id!==x.id);save();renderTasks()}});
  document.querySelector('#focusStart').onclick=toggleFocus;document.querySelector('#focusReset').onclick=()=>{stopFocus();focusSeconds=25*60;renderTasks()};document.querySelector('#randomTask').onclick=()=>showRandomTask(false);document.querySelector('#lowEnergy').onclick=()=>showRandomTask(true);
}
function formatTimer(s){const m=Math.floor(s/60),sec=s%60;return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}
function toggleFocus(){if(focusRunning){stopFocus();renderTasks();return}if(focusSeconds<=0)focusSeconds=25*60;focusRunning=true;focusHandle=setInterval(()=>{focusSeconds--;const el=document.querySelector('#focusTimer');if(el)el.textContent=formatTimer(Math.max(0,focusSeconds));if(focusSeconds<=0){stopFocus();toast('Focus quest complete.');addStatXP('wis',10);focusSeconds=25*60;save();renderTasks()}},1000);renderTasks()}
function stopFocus(){focusRunning=false;if(focusHandle){clearInterval(focusHandle);focusHandle=null}}
function showRandomTask(low){const open=state.tasks.filter(t=>!t.done&&(low?['Tiny','Easy'].includes(t.difficulty):true));const el=document.querySelector('#randomTaskDisplay');if(!el)return;el.textContent=open.length?open[Math.floor(Math.random()*open.length)].text:(low?'No Tiny/Easy tasks available.':'No open tasks available.')}

/* ---------- SIDE QUESTS ---------- */
const QUICK_QUESTS={
  cleanCar:{title:'Clean the Car',category:'Cleaning',xp:45,stat:'wis',statXp:5,difficulty:'Easy'},
  hoover:{title:'Hoover the House',category:'Cleaning',xp:40,stat:'con',statXp:5,difficulty:'Easy'},
  cupboard:{title:'Sort a Cupboard',category:'Organising',xp:45,stat:'wis',statXp:7,difficulty:'Normal'},
  laundry:{title:'Laundry',category:'Cleaning',xp:30,stat:'wis',statXp:4,difficulty:'Tiny'},
  diy:{title:'DIY Job',category:'DIY',xp:60,stat:'str',statXp:8,difficulty:'Normal'},
  garden:{title:'Garden Quest',category:'Garden',xp:50,stat:'con',statXp:7,difficulty:'Normal'},
  admin:{title:'Life Admin',category:'Admin',xp:40,stat:'int',statXp:6,difficulty:'Easy'},
  meal:{title:'Meal Prep',category:'Cooking',xp:45,stat:'wis',statXp:6,difficulty:'Easy'}
};
function completedSideToday(){return state.sideQuestHistory.filter(x=>x.date===todayISO())}
function randomQuick(){const keys=Object.keys(QUICK_QUESTS);if(!randomQuestKey)randomQuestKey=keys[Math.floor(Math.random()*keys.length)];return [randomQuestKey,QUICK_QUESTS[randomQuestKey]]}
/* duplicate completeQuick implementation removed in v0.01.8.2.6.2 cleanup test */
/* duplicate setCustomSideCompletion implementation removed in v0.01.8.2.6.2 cleanup test */
/* ---------- QUESTS PAGE HUB (Phase 3B.5) ----------
   Locked structure: MAIN QUESTS | SIDE QUESTS / DAILY QUESTS | QUICK
   QUESTS. renderSideQuests keeps its original name (page dispatch table
   above still points 'quests' at it) but is now a router over four
   sub-views instead of one fixed body — Side/Quick Quests content below
   is the exact pre-3B.5 markup, just split out of the always-on page
   into its own tile; nothing about either system's data or behavior
   changed. Daily Quests is new surface for the existing singular
   state.quest/state.dailyQuests systems, which stay untouched — full
   editing (New/Delay/Cancel/Complete) remains on Home, where those
   modals' own renderHome() calls already live; this tile is a read
   summary with a link across. */
let qpView='hub'; // 'hub'|'main'|'side'|'daily'|'quick'
function qpSubtitle(){return {hub:'Quest Board',main:'Main Quests',side:'Side Quests',daily:'Daily Quests',quick:'Quick Quests'}[qpView]||'Quest Board'}

/* ---------- QUESTS FRONT PAGE — rich hub tiles (ASTRA — QUESTS FRONT
   PAGE IMPLEMENTATION HANDOVER, 2026-09-13)
   Rebuilds questsHubTileGridHTML() only — the qpView routing above it,
   and every sub-page (mainQuestSurfaceHTML/questsSideQuestsPageHTML/
   questsDailyQuestsPageHTML/questsQuickQuestsPageHTML), are untouched;
   this handover is explicitly "front-page hub only" (§1/§17). Every
   number/title/state below reads real state through the exact same
   helpers the rest of the app already uses (mainQuestActiveCount(),
   relevantSideQuests(), completedSideToday(), state.playerStatus.streak,
   etc.) — nothing here is a new data source, and nothing is invented
   when the real data doesn't support a label (§9's "do not infer or
   fake state", enforced per-tile below). */

/* Bug found during the pre-implementation audit, fixed here (in scope
   — this handover's own §9 "Daily Quests" example explicitly wants a
   real Daily Quest streak): the OLD hub tile showed
   ensureDailyQuestsState().currentStreak, which is the Quest-Board
   "minimum N actions/day" streak — a genuinely different mechanic from
   the singular Daily Quest (state.quest) this tile is actually about.
   The correct source for "how many days running has today's Daily
   Quest been completed" is state.playerStatus.streak (updated by
   updateQuestStreak(), called only from completeMainQuest() — the
   function that completes state.quest, despite its historical name).
   Fixed in both this tile and questsDailyQuestsPageHTML() below, so
   the hub and its own detail page never disagree about which streak
   they mean. */
function dailyQuestStreak(){return Number(state.playerStatus?.streak||0)}

function mainQuestPrimaryActive(){
  return ensureQuestHubState().mainQuests.find(mq=>mq.status==='active')||null;
}
const MAIN_QUEST_PACE_LABEL={ahead:'AHEAD',on_track:'ON TRACK',at_risk:'AT RISK',behind:'BEHIND'};
function mainQuestNextMilestoneTitle(mq){
  const pending=(mq.plan?.milestones||[]).filter(m=>m.status!=='completed').sort((a,b)=>Number(a.order||0)-Number(b.order||0));
  return pending.length?pending[0].title:null;
}

const QUEST_HUB_TILE_ART={
  main:{icon:'Quests/V3/Icons/QUESTS_MAIN_ICON-160px.png',scene:'Quests/V3/Scenes/QUESTS_MAIN_SCENE-960px.jpg'},
  side:{icon:'Quests/V3/Icons/QUESTS_SIDE_ICON-160px.png',scene:'Quests/V3/Scenes/QUESTS_SIDE_SCENE-960px.jpg'},
  daily:{icon:'Quests/V3/Icons/QUESTS_DAILY_ICON-160px.png',scene:'Quests/V3/Scenes/QUESTS_DAILY_SCENE-960px.jpg'},
  quick:{icon:'Quests/V3/Icons/QUESTS_QUICK_ICON-160px.png',scene:'Quests/V3/Scenes/QUESTS_QUICK_SCENE-960px.jpg'}
};
/* §3's shared tile shell — header (icon+title+descriptor), artwork
   region, live-data region (system-specific, passed in), arrow — kept
   as one function so all four tiles genuinely share one component
   family (§3/§19) rather than four independent near-duplicates. */
function questHubTileHTML(system,title,descriptor,dataHTML,ariaState){
  const art=QUEST_HUB_TILE_ART[system];
  return `<button type="button" class="quest-hub-tile quest-hub-tile--${system}" data-qp-view="${system}" aria-label="${esc(title)} — ${esc(ariaState)}">
    <div class="qht-header">
      <img class="qht-icon" src="${asset(art.icon)}" alt="">
      <div class="qht-heading"><h2>${esc(title)}</h2><span class="qht-descriptor">${esc(descriptor)}</span></div>
    </div>
    <div class="qht-art"><img src="${asset(art.scene)}" alt="" loading="lazy"></div>
    <div class="qht-data">${dataHTML}</div>
    <span class="qht-arrow" aria-hidden="true">›</span>
  </button>`;
}

function mainQuestTileDataHTML(){
  const activeCount=mainQuestActiveCount();
  const primary=mainQuestPrimaryActive();
  if(!primary){
    return {html:`<div class="qht-count">${activeCount} / ${MAIN_QUEST_ACTIVE_CAP} ACTIVE</div><div class="qht-empty"><p>No active Main Quests</p><span class="qht-empty-link">Create or choose a long-term goal ›</span></div>`,aria:'no active Main Quests'};
  }
  const pctVal=clamp(Math.round(Number(primary.progress?.current||0)),0,100);
  const paceLabel=MAIN_QUEST_PACE_LABEL[primary.progress?.paceState]||null;
  const nextMilestone=mainQuestNextMilestoneTitle(primary);
  const title=primary.goal?.title||'Main Quest';
  return {html:`
    <div class="qht-count">${activeCount} / ${MAIN_QUEST_ACTIVE_CAP} ACTIVE</div>
    <div class="qht-title">${esc(title)}</div>
    <div class="qht-progress-row"><div class="qht-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pctVal}"><i style="width:${pctVal}%"></i></div><span class="qht-percent">${pctVal}%</span></div>
    ${paceLabel?`<div class="qht-state qht-state--${primary.progress.paceState}">${paceLabel}</div>`:''}
    ${nextMilestone?`<div class="qht-milestone"><small>NEXT MILESTONE</small><span>${esc(nextMilestone)}</span></div>`:''}
  `,aria:`${activeCount} of ${MAIN_QUEST_ACTIVE_CAP} active, ${title}, ${pctVal}% complete${paceLabel?', '+paceLabel.toLowerCase():''}`};
}

function sideQuestTileDataHTML(){
  const open=state.sideQuests.filter(q=>!q.done).length;
  const featured=relevantSideQuests()[0]||null;
  const completedToday=completedSideToday().length;
  if(!featured){
    return {html:`<div class="qht-empty"><p>No active Side Quests</p><span class="qht-empty-link">Find a Side Quest ›</span></div>`,aria:'no active Side Quests'};
  }
  return {html:`
    <div class="qht-count">${open} ACTIVE</div>
    <div class="qht-title">${esc(featured.title)}</div>
    <div class="qht-meta">${esc(featured.category||'Other')} · ${esc(featured.difficulty||'Normal')} · +${Number(featured.xp||40)} XP</div>
    <div class="qht-substat">Completed Today: ${completedToday}</div>
  `,aria:`${open} active, featuring ${featured.title}, ${completedToday} completed today`};
}

function dailyQuestTileDataHTML(){
  const q=state.quest||{};
  const title=sharedHomeItemTitle(q.title,['Complete Today’s Main Quest','Complete Main Quest']);
  const streak=dailyQuestStreak();
  if(!title){
    return {html:`<div class="qht-empty"><p>No Daily Quest assigned</p></div>`,aria:'no Daily Quest assigned'};
  }
  return {html:`
    <div class="qht-count">TODAY'S QUEST</div>
    <div class="qht-title">${esc(title)}</div>
    <div class="qht-meta">+${Number(q.rewardXP||0)} XP · +${Number(q.rewardGold||0)} Gold</div>
    ${q.rewarded?`<div class="qht-state qht-state--completed">COMPLETED</div>`:''}
    ${streak>0?`<div class="qht-substat">${streak} DAY STREAK</div>`:''}
  `,aria:`today's Daily Quest, ${title}${q.rewarded?', completed':''}${streak>0?`, ${streak} day streak`:''}`};
}

function quickQuestTileDataHTML(){
  const keys=Object.keys(QUICK_QUESTS);
  if(!keys.length){
    return {html:`<div class="qht-empty"><p>No Quick Quests available</p></div>`,aria:'no Quick Quests available'};
  }
  const today=completedSideToday();
  const preview=keys.slice(0,3).map(k=>{
    const done=today.some(x=>x.quickKey===k);
    return `<div class="qht-checklist-row${done?' done':''}"><span class="qht-checkbox" aria-hidden="true">${done?'✓':''}</span><span>${esc(QUICK_QUESTS[k].title)}</span></div>`;
  }).join('');
  return {html:`<div class="qht-count">${keys.length} AVAILABLE</div><div class="qht-checklist">${preview}</div>`,aria:`${keys.length} available`};
}

function questsHubTileGridHTML(){
  const main=mainQuestTileDataHTML(),side=sideQuestTileDataHTML(),daily=dailyQuestTileDataHTML(),quick=quickQuestTileDataHTML();
  return `<div class="qp-tile-grid">
    ${questHubTileHTML('main','Main Quests','Where am I going?',main.html,main.aria)}
    ${questHubTileHTML('side','Side Quests','What else could I accomplish?',side.html,side.aria)}
    ${questHubTileHTML('daily','Daily Quests','What matters today?',daily.html,daily.aria)}
    ${questHubTileHTML('quick','Quick Quests','What can I knock out right now?',quick.html,quick.aria)}
  </div>`;
}
function questsSideQuestsPageHTML(){
  const today=completedSideToday(),total=state.sideQuestHistory.length;
  const back=`<button type="button" class="text-btn campaign-back" data-qp-view="hub">← Quests</button>`;
  return back+`
    <h2 class="section-title">Today</h2><section class="rpg-frame minor side-history">${today.length?today.slice().reverse().map(x=>`<div class="list-item"><div>✓</div><div><h3>${esc(x.title)}</h3><p>${esc(x.category)}</p></div><span class="tag quest">+${x.xp} XP</span></div>`).join(''):'<div class="empty">No Side Quests completed today.</div>'}</section>
    <h2 class="section-title">Quest Chain</h2><section class="rpg-frame standard chain"><div><strong>Domestic Adventurer</strong><div class="helper">Complete 25 household Side Quests.</div>${meter(Math.min(total,25),25,total>=25?'green':'')}</div><b>${Math.min(total,25)} / 25</b></section>
    <h2 class="section-title">Custom Side Quests</h2><section class="rpg-frame minor"><div class="toolbar"><button class="rpg-btn accent" id="addCustomSide">Custom Side Quest</button></div>${state.sideQuests.length?state.sideQuests.map(q=>`<div class="list-item"><input type="checkbox" data-custom-side="${q.id}" ${q.done?'checked':''}><div><h3>${esc(q.title)}</h3><p>${esc(q.category||'Other')} · +${q.xp||40} XP</p></div><button class="text-btn" data-delete-side="${q.id}">Delete</button></div>`).join(''):'<div class="empty">No custom quests yet.</div>'}</section>`;
}
function questsQuickQuestsPageHTML(){
  const [rk,rq]=randomQuick();
  const back=`<button type="button" class="text-btn campaign-back" data-qp-view="hub">← Quests</button>`;
  return back+`
    <section class="rpg-frame primary random-quest"><div class="quest-kicker">Random Quest</div><div class="big-title">${esc(rq.title)}</div><p class="helper">${esc(rq.category)} · ${rq.difficulty} · +${rq.xp} XP</p><div class="toolbar"><button class="rpg-btn accent" data-quick="${rk}">Complete</button><button class="text-btn" id="rerollSide">Reroll</button></div></section>
    <h2 class="section-title">Quick Quests</h2><section class="quick-grid">${Object.entries(QUICK_QUESTS).map(([k,q])=>`<button class="quick-quest" data-quick="${k}"><b>${esc(q.title)}</b><small>${esc(q.category)} · +${q.xp} XP</small></button>`).join('')}</section>`;
}
function questsDailyQuestsPageHTML(){
  const q=state.quest||{};
  const back=`<button type="button" class="text-btn campaign-back" data-qp-view="hub">← Quests</button>`;
  const title=sharedHomeItemTitle(q.title,['Complete Today’s Main Quest','Complete Main Quest']);
  /* Streak source fixed alongside the hub tile (see dailyQuestStreak()'s
     own comment above) — was ensureDailyQuestsState().currentStreak,
     the unrelated Quest-Board-minimum streak; this page is about the
     singular Daily Quest (state.quest), so its streak is
     state.playerStatus.streak. */
  const streak=dailyQuestStreak();
  return back+`
    <h2 class="section-title">Today's Daily Quest</h2>
    <section class="rpg-frame primary">${title?`<h3>${esc(title)}</h3><p class="helper">${q.rewarded?'Complete for today.':`+${Number(q.rewardXP||0)} XP · +${Number(q.rewardGold||0)} Gold`}</p>`:'<div class="empty">No Daily Quest set for today.</div>'}
      <div class="toolbar"><button type="button" class="rpg-btn accent" id="qpGoHome">Manage on Home</button></div></section>
    <h2 class="section-title">Daily Quest Streak</h2>
    <section class="rpg-frame standard"><div><strong>Current Streak</strong><div class="helper">Consecutive days with today's Daily Quest completed.</div></div><b>${streak} day${streak===1?'':'s'}</b></section>`;
}
function renderSideQuests(){
  ensureQuestHubState();
  let body;
  let header;
  if(qpView==='main'){body=mainQuestSurfaceHTML();header=pageHeader('Quests',qpSubtitle());}
  else if(qpView==='side'){body=questsSideQuestsPageHTML();header=pageHeader('Quests',qpSubtitle());}
  else if(qpView==='daily'){body=questsDailyQuestsPageHTML();header=pageHeader('Quests',qpSubtitle());}
  else if(qpView==='quick'){body=questsQuickQuestsPageHTML();header=pageHeader('Quests',qpSubtitle());}
  else{
    qpView='hub';body=questsHubTileGridHTML();
    /* Bespoke hub-only header (handover §16) — a fixed three-line
       structure (title / descriptor / tagline), distinct from the
       generic two-line pageHeader() every other page (and this page's
       own sub-views, above) shares, so pageHeader() itself is left
       untouched. */
    header=`<div class="page-head qp-hub-head"><h1 class="pixel-title">Quests</h1><span class="sub">Real-life goals, tasks and quests</span><span class="qp-hub-tagline">Small steps. Epic progress.</span></div><div class="accent-line"></div>`;
  }
  view.innerHTML=header+body;
  bindSideQuests();
}
function bindSideQuests(){
  document.querySelectorAll('[data-qp-view]').forEach(b=>b.onclick=()=>{qpView=b.dataset.qpView;renderSideQuests()});
  if(qpView==='side'){
    document.querySelector('#addCustomSide').onclick=customSideModal;
    document.querySelectorAll('[data-custom-side]').forEach(c=>c.onchange=()=>{const q=state.sideQuests.find(x=>x.id===Number(c.dataset.customSide));setCustomSideCompletion(q,c.checked);save();renderSideQuests()});
    document.querySelectorAll('[data-delete-side]').forEach(b=>b.onclick=()=>{state.sideQuests=state.sideQuests.filter(x=>x.id!==Number(b.dataset.deleteSide));save();renderSideQuests()});
  }
  if(qpView==='quick'){
    document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>completeQuick(b.dataset.quick));
    const reroll=document.querySelector('#rerollSide');if(reroll)reroll.onclick=()=>{const keys=Object.keys(QUICK_QUESTS).filter(k=>k!==randomQuestKey);randomQuestKey=keys[Math.floor(Math.random()*keys.length)];renderSideQuests()};
  }
  if(qpView==='daily'){
    const goHome=document.querySelector('#qpGoHome');if(goHome)goHome.onclick=()=>setPage('home');
  }
  if(qpView==='main')bindMainQuestSurface();
}
function customSideModal(){modal(`<h2>Custom Side Quest</h2><div class="form-row"><label>Quest</label><input id="sideTitle" placeholder="e.g. Clear the garage shelf"></div><div class="two-col"><div class="form-row"><label>Category</label><select id="sideCat">${['Cleaning','Organising','DIY','Garden','Admin','Cooking','Family','Other'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="form-row"><label>Difficulty</label><select id="sideDiff"><option>Tiny</option><option>Easy</option><option selected>Normal</option><option>Hard</option><option>Boss Fight</option></select></div></div><button class="rpg-btn accent" id="saveSide" style="width:100%">Add Quest</button>`);modalRoot.querySelector('#saveSide').onclick=()=>{const title=modalRoot.querySelector('#sideTitle').value.trim();if(!title)return toast('Give the Side Quest a name.');const diff=modalRoot.querySelector('#sideDiff').value,xp={Tiny:25,Easy:40,Normal:55,Hard:80,'Boss Fight':120}[diff];state.sideQuests.push({id:uid(),title,category:modalRoot.querySelector('#sideCat').value,difficulty:diff,xp,stat:'wis',statXp:5,done:false,xpAwarded:false,completedDate:null});save();closeModal();renderSideQuests()}}

/* ---------- CHARACTER ---------- */
function lifetimeTotals(){
  const doneActs=state.activities.filter(a=>a.completed);return {activities:doneActs.length,distance:doneActs.reduce((s,a)=>s+Number(a.distance||0),0),side:state.sideQuestHistory.length,quests:state.totals.questsCompleted||0};
}
const CHARACTER_CLASSES=['Novice','Warrior','Scout','Scholar','Artisan','Steward','Diplomat','Adventurer'];
function resolvedCharacterClass(){
  const candidates=[state.character?.activeClass,state.classSystem?.activeClass,state.profile?.activeClass,state.profile?.className,state.activeClass];
  const raw=String(candidates.find(v=>typeof v==='string'&&v.trim())||'Novice').trim();
  return CHARACTER_CLASSES.find(x=>x.toLowerCase()===raw.toLowerCase())||'Novice';
}
function characterAsset(name){return asset(`Character/${name}`)}
function classSystemAsset(name){return asset(`Class System/Icons/Starter Classes/${name}`)}
function characterStatAsset(key){return asset(`Character/Stats/stat_${key}.png`)}
function characterClassAsset(){return classSystemAsset(`${resolvedCharacterClass().toLowerCase()}_icon.png`)}
function numericSourceValue(value,key){
  if(value==null)return 0;
  if(typeof value==='number')return Number.isFinite(value)?value:0;
  if(typeof value==='object'){
    const direct=value[key];
    if(typeof direct==='number')return Number.isFinite(direct)?direct:0;
    if(direct&&typeof direct==='object')return Number(direct.value??direct.amount??direct.bonus??0)||0;
  }
  return 0;
}
function statSources(key){
  const c=state.character||{},mods=c.statModifiers||{};
  const first=(...vals)=>{for(const v of vals){const n=numericSourceValue(v,key);if(n)return n}return 0};
  const earned=clamp(Number(state.stats?.[key]?.score??10),1,300);
  return {
    earned,
    equipment:first(mods.equipment,state.equipment?.statModifiers,state.equipment?.modifiers),
    items:first(mods.items,mods.permanent,state.items?.statModifiers,state.permanentBonuses),
    potions:first(mods.potions,state.potions?.statModifiers,state.consumables?.statModifiers),
    buffs:first(mods.buffs,state.buffs?.statModifiers,state.activeBuffs),
    other:first(mods.other,state.statModifiers?.other)
  };
}
function displayedStat(key){const src=statSources(key);return clamp(Math.round(Object.values(src).reduce((a,b)=>a+Number(b||0),0)),1,300)}
function statCardHTML(key){
  const s=state.stats[key]||{score:10,xp:0},total=displayedStat(key),cost=statCost(s.score),progress=pct(s.xp,cost);
  return `<button type="button" class="character-stat-card" data-stat="${key}" aria-label="Open ${esc(STAT_LONG[key])} breakdown"><div class="character-stat-top"><img src="${characterStatAsset(key)}" alt=""><div><span>${STAT_NAMES[key]}</span><b>${total}</b></div><strong>${modifier(total)}</strong></div><div class="character-stat-name">${esc(STAT_LONG[key])}</div><div class="character-stat-xp"><span>${Math.round(s.xp)} / ${cost} XP</span><div class="character-stat-progress"><i style="--p:${progress}"></i></div></div></button>`;
}
function statBreakdownModal(key){
  if(!STAT_NAMES[key])return;
  const s=state.stats[key]||{score:10,xp:0},src=statSources(key),rawTotal=Object.values(src).reduce((a,b)=>a+Number(b||0),0),total=displayedStat(key),cost=statCost(s.score);
  const rows=[['Earned through XP',src.earned,'Permanent progression'],['Equipment',src.equipment,'Equipped gear modifiers'],['Items / Permanent Bonuses',src.items,'Permanent item modifiers'],['Potions / Consumables',src.potions,'Temporary effects'],['Active Buffs',src.buffs,'Temporary effects'],['Other',src.other,'Reserved modifiers']];
  modal(`<div class="stat-breakdown"><div class="stat-breakdown-title"><img src="${characterStatAsset(key)}" alt=""><div><span>${esc(STAT_LONG[key]).toUpperCase()}</span><b>TOTAL ${total}</b>${rawTotal!==total?'<small>300-point display cap applied</small>':''}</div></div><div class="stat-source-list">${rows.map(([label,value,note],i)=>`<div class="stat-source-row ${i===0?'earned':''}"><div><b>${esc(label)}</b><small>${esc(note)}</small></div><strong>${i===0?Math.round(value):`${value>=0?'+':''}${Math.round(value)}`}</strong></div>`).join('')}</div><div class="stat-breakdown-xp"><span>Current Stat XP</span><b>${Math.round(s.xp)} / ${cost}</b><div class="character-stat-progress"><i style="--p:${pct(s.xp,cost)}"></i></div></div></div>`);
}
function activeAilments(){return state.ailments.filter(a=>!a.recoveredDate)}
function recoveredAilments(){return state.ailments.filter(a=>a.recoveredDate).sort((a,b)=>String(b.recoveredDate).localeCompare(String(a.recoveredDate)))}
function ailmentDuration(a){const start=dateFromISO(a.startDate),end=dateFromISO(a.recoveredDate||todayISO());return Math.max(1,Math.round((end-start)/86400000)+1)}
function ailmentAssetName(name){
  const n=String(name||'').toLowerCase();
  if(n.includes('stomach'))return 'ailment_stomach_bug.png';
  if(n.includes('knee'))return 'ailment_knee_pain.png';
  if(n.includes('sleep'))return 'ailment_sleep_deprived.png';
  if(n.includes('sore')&&n.includes('leg'))return 'ailment_sore_legs.png';
  if(n.includes('head'))return 'ailment_headache.png';
  if(n.includes('fever'))return 'ailment_fever.png';
  if(n.includes('cold'))return 'ailment_cold.png';
  if(n.includes('dehydrat'))return 'ailment_dehydrated.png';
  if(n.includes('fatig')||n.includes('tired'))return 'ailment_fatigued.png';
  if(n.includes('injur'))return 'ailment_injury.png';
  return 'ailment_custom.png';
}
function ailmentHistoryModal(){
  const history=recoveredAilments();
  modal(`<h2>Ailment History</h2><p class="helper">Recovered conditions remain stored for history and future Rewards calculations.</p><div class="ailment-history-modal">${history.length?history.map(a=>`<div class="ailment-history-row"><img src="${characterAsset(ailmentAssetName(a.name))}" alt=""><div><strong>${esc(a.name)}</strong><small>${fmtShort(a.startDate)} → ${fmtShort(a.recoveredDate)} · ${ailmentDuration(a)} day${ailmentDuration(a)===1?'':'s'} · Severity ${a.severity}/5${a.notes?` · ${esc(a.notes)}`:''}</small></div><span class="tag">Recovered</span></div>`).join(''):'<div class="empty">No recovered ailments logged yet.</div>'}</div>`);
}
function characterClassesModal(){
  const current=resolvedCharacterClass();
  modal(`<h2>Classes</h2><p class="helper">Primary Class is owned by the shared Class System. Character displays that shared state and does not maintain a second class selection.</p><div class="character-class-list">${CHARACTER_CLASSES.map(name=>`<div class="character-class-row ${name===current?'active':''}"><img src="${classSystemAsset(`${name.toLowerCase()}_icon.png`)}" alt="${esc(name)}"><div><strong>${esc(name)}</strong><small>${name===current?'CURRENT PRIMARY CLASS':'Class System'}</small></div></div>`).join('')}</div>`);
}
function renderCharacter(){
  const total=lifetimeTotals(),active=activeAilments(),className=resolvedCharacterClass(),cost=nextLevelCost();
  view.innerHTML=pageHeader('Character','Gold Path')+`
    <section class="rpg-frame primary character-identity-panel"><div class="character-identity"><div class="character-portrait-stack"><img class="character-class-art" src="${characterClassAsset()}" alt="${esc(className)}"><div class="character-level-badge"><small>LEVEL</small><b>${state.level}</b></div><div class="character-buffs-slot" aria-hidden="true"></div></div><div class="character-identity-copy"><span class="character-kicker">CURRENT CLASS</span><h2>${esc(state.profile.name||'Player')}</h2><strong>${esc(className)}</strong><div class="character-level-meta"><span>${Number(state.gold||0).toLocaleString()} GOLD</span></div><button type="button" class="text-btn character-view-classes" id="viewClassesBtn">View Classes</button></div></div><div class="character-overall-xp"><div><span>OVERALL XP</span><b>${Math.round(state.xp)} / ${cost}</b></div>${meter(state.xp,cost,'yellow')}</div></section>
    <section class="character-menu" aria-label="Character menu"><button type="button" class="character-menu-button" id="skillsBtn"><img src="${characterAsset('menu_skills.png')}" alt=""><span>Skills</span></button><button type="button" class="character-menu-button" id="equipmentBtn"><img src="${characterAsset('menu_equipment.png')}" alt=""><span>Equipment</span></button><button type="button" class="character-menu-button" id="rewardsBtn"><img src="${characterAsset('menu_rewards.png')}" alt=""><span>Rewards</span></button></section>
    <h2 class="section-title character-section-title">Attributes</h2><section class="character-stat-grid">${Object.keys(STAT_NAMES).map(statCardHTML).join('')}</section>
    <div class="character-lower-grid"><div><h2 class="section-title character-section-title">Status & Ailments</h2><section class="rpg-frame standard character-status-panel"><div class="toolbar"><button class="rpg-btn small accent" id="addAilment">Add Ailment</button><button class="text-btn" id="ailmentHistory">Ailment History</button><span class="helper">${active.length?`${active.length} active`:'No active ailments'}</span></div>${active.length?active.map(a=>`<div class="ailment character-ailment"><img src="${characterAsset(ailmentAssetName(a.name))}" alt=""><div><strong>${esc(a.name)}</strong><small>Since ${fmtShort(a.startDate)} · Severity ${a.severity}/5${a.notes?` · ${esc(a.notes)}`:''}</small></div><button class="text-btn accent" data-recover="${a.id}">Recovered</button></div>`).join(''):'<div class="empty">Status clear. Your immune system has not filed a complaint.</div>'}</section></div>
    <div><h2 class="section-title character-section-title">Lifetime Totals</h2><section class="lifetime-grid character-lifetime-grid"><div class="lifetime"><b>${total.activities}</b><span>Activities</span></div><div class="lifetime"><b>${total.distance.toFixed(1)} km</b><span>Distance</span></div><div class="lifetime"><b>${total.side}</b><span>Side Quests</span></div><div class="lifetime"><b>${total.quests}</b><span>Main Quests</span></div></section></div></div>
    <h2 class="section-title character-section-title">Profile & Setup</h2><section class="rpg-frame minor character-profile-panel"><img src="${characterAsset('menu_profile_setup.png')}" alt=""><div><h3>Profile & Setup</h3><p class="helper">Display name, nutrition targets, weather location and related setup remain in the existing shared profile system.</p></div><button class="rpg-btn accent" id="profileSetup">Open</button></section>`;
  bindCharacter();
}
function bindCharacter(){
  document.querySelector('#profileSetup').onclick=()=>profileModal('profile');
  const viewClasses=document.querySelector('#viewClassesBtn');if(viewClasses)viewClasses.onclick=characterClassesModal;
  document.querySelector('#equipmentBtn').onclick=()=>modal(`<h2>Equipment</h2><p class="helper"><b>Character owns equipped state.</b> Detailed loadout mechanics remain future scope; existing reward and equipment data are not duplicated here.</p>`);
  document.querySelector('#skillsBtn').onclick=()=>modal(`<h2>Skills</h2><p class="helper"><b>Character owns Skills progression display.</b> Detailed skill-tree mechanics remain future scope.</p>`);
  document.querySelector('#rewardsBtn').onclick=()=>setPage('rewards');
  document.querySelector('#addAilment').onclick=ailmentModal;
  document.querySelector('#ailmentHistory').onclick=ailmentHistoryModal;
  document.querySelectorAll('[data-stat]').forEach(b=>b.onclick=()=>statBreakdownModal(b.dataset.stat));
  document.querySelectorAll('[data-recover]').forEach(b=>b.onclick=()=>{const a=state.ailments.find(x=>x.id===Number(b.dataset.recover));if(a){a.recoveredDate=todayISO();save();toast('Ailment moved to history.');renderCharacter()}});
}
function ailmentModal(){modal(`<h2>Add Ailment</h2><div class="form-row"><label>Ailment</label><input id="ailName" placeholder="Cold, headache, sore legs…"></div><div class="two-col"><div class="form-row"><label>Start date</label><input id="ailDate" type="date" value="${todayISO()}"></div><div class="form-row"><label>Severity 1–5</label><input id="ailSeverity" type="number" min="1" max="5" value="2"></div></div><div class="form-row"><label>Notes (optional)</label><input id="ailNotes"></div><button class="rpg-btn accent" id="saveAil" style="width:100%">Add Ailment</button>`);modalRoot.querySelector('#saveAil').onclick=()=>{const name=modalRoot.querySelector('#ailName').value.trim();if(!name)return toast('Name the ailment.');state.ailments.push({id:uid(),name,startDate:modalRoot.querySelector('#ailDate').value||todayISO(),severity:clamp(Number(modalRoot.querySelector('#ailSeverity').value||1),1,5),notes:modalRoot.querySelector('#ailNotes').value.trim(),recoveredDate:null});save();closeModal();renderCharacter()}}

function achievementsModal(){
  const total=lifetimeTotals(),illRecovered=state.ailments.filter(a=>a.recoveredDate).length;const ach=[
    ['First Steps',state.activities.some(a=>a.completed),'Complete your first activity.'],['Dungeon Sweeper',state.sideQuestHistory.filter(x=>/Hoover/i.test(x.title)).length>=10,'Hoover the house 10 times.'],['Domestic Adventurer',total.side>=25,'Complete 25 Side Quests.'],['Patient Zero',state.ailments.length>=1,'Log your first ailment. Your immune system has unlocked downloadable content.'],['Kindergarten Bioweapon Survivor',illRecovered>=5,'Recover from 5 ailments.'],['Level 25',state.level>=25,'Reach overall Level 25.']
  ];
  const eventAchievements=(state.achievements||[]).filter(a=>a&&typeof a==='object').map(a=>`<div class="list-item"><div>🏆</div><div><h3>${esc(a.title||a.id)}</h3><p>${esc(a.description||'Unlocked from a shared RPG milestone event.')}</p></div><span class="tag quest">Unlocked</span></div>`).join('');
  modal(`<h2>Achievements</h2>${ach.map(a=>`<div class="list-item"><div>${a[1]?'🏆':'🔒'}</div><div><h3>${a[0]}</h3><p>${a[2]}</p></div><span class="tag ${a[1]?'quest':''}">${a[1]?'Unlocked':'Locked'}</span></div>`).join('')}${eventAchievements}`);
}
function profileModal(tab='profile'){
  if(tab==='home'){profileHomeTab();return}
  if(tab==='nav'){profileNavTab();return}
  if(tab==='training'){profileTrainingTab();return}
  const p=state.profile;
  modal(`<h2>Profile & Setup</h2><div class="tabs tabs-4"><button id="tabProfile" class="active">Profile</button><button id="tabHome">Home</button><button id="tabNav">Navigation</button><button id="tabTraining">Training</button></div><p class="helper">Only your display name is needed. Nutrition calculations are optional estimates and every target stays manually editable.</p><div class="two-col"><div class="form-row"><label>Display name</label><input id="pName" value="${esc(p.name||'')}"></div><div class="form-row"><label>Location label</label><input id="pLocation" value="${esc(p.location||'')}"></div></div><div class="two-col"><div class="form-row"><label>Birthday <small>(optional — shows the Home birthday scene on the day)</small></label><input id="pBirthday" type="date" value="${esc(p.birthday||'')}"></div></div><div class="two-col"><div class="form-row"><label>Latitude</label><input id="pLat" type="number" step="0.0001" value="${p.lat??''}"></div><div class="form-row"><label>Longitude</label><input id="pLon" type="number" step="0.0001" value="${p.lon??''}"></div></div><button class="text-btn" id="useGeo">Use Device Location</button><div class="modal-section"><h3>Home Preferences</h3><div class="two-col"><div class="form-row"><label>Word of the Day language</label><select id="pWordLanguage">${Object.entries(WORD_LANGS).map(([v,l])=>`<option value="${v}" ${p.wordLanguage===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="form-row"><label>Running Conditions note</label><select id="pRunning"><option value="yes" ${p.showRunningConditions!==false?'selected':''}>Show</option><option value="no" ${p.showRunningConditions===false?'selected':''}>Hide</option></select></div></div></div><div class="modal-section"><h3>Optional Food Target Calculation</h3><div class="three-col"><div class="form-row"><label>Weight kg</label><input id="pWeight" type="number" step="0.1" value="${p.weight??''}"></div><div class="form-row"><label>Height cm</label><input id="pHeight" type="number" value="${p.height??''}"></div><div class="form-row"><label>Age</label><input id="pAge" type="number" value="${p.age??''}"></div></div><div class="two-col"><div class="form-row"><label>Metabolic formula</label><select id="pFormula"><option value="manual" ${p.metabolicFormula==='manual'?'selected':''}>Manual targets</option><option value="male" ${p.metabolicFormula==='male'?'selected':''}>Mifflin–St Jeor: male formula</option><option value="female" ${p.metabolicFormula==='female'?'selected':''}>Mifflin–St Jeor: female formula</option></select></div><div class="form-row"><label>Activity level</label><select id="pActivity">${[['sedentary','Low'],['light','Light'],['moderate','Moderate'],['high','High']].map(([v,l])=>`<option value="${v}" ${p.activityLevel===v?'selected':''}>${l}</option>`).join('')}</select></div></div><div class="form-row"><label>Goal</label><select id="pGoal"><option value="lose" ${p.nutritionGoal==='lose'?'selected':''}>Lose weight gradually</option><option value="maintain" ${p.nutritionGoal==='maintain'?'selected':''}>Maintain</option><option value="gain" ${p.nutritionGoal==='gain'?'selected':''}>Gain weight / muscle</option></select></div><button class="text-btn accent" id="calcTargets">Calculate Estimated Targets</button><p class="helper warning" id="calcNote">Formulas are estimates, not medical advice. Adjust targets to suit your own plan.</p></div><div class="modal-section"><h3>Daily Targets</h3><div class="two-col"><div class="form-row"><label>Calories</label><input id="pCalories" type="number" value="${p.calTarget}"></div><div class="form-row"><label>Protein g</label><input id="pProtein" type="number" value="${p.proteinTarget}"></div></div><div class="two-col"><div class="form-row"><label>Water ml</label><input id="pWater" type="number" value="${p.waterTarget}"></div><div class="form-row"><label>Sleep hours</label><input id="pSleep" type="number" step="0.1" value="${p.sleepTarget}"></div></div><div class="two-col"><div class="form-row"><label>Reading minutes</label><input id="pReading" type="number" value="${p.readingTarget||30}"></div><div class="form-row"><label>Mindful minutes</label><input id="pMindful" type="number" value="${p.mindfulTarget||10}"></div></div><div class="two-col"><div class="form-row"><label>Steps</label><input id="pSteps" type="number" value="${p.stepsTarget||8000}"></div><div class="form-row"><label>Social check-ins</label><input id="pSocial" type="number" value="${p.socialTarget||2}"></div></div></div><div class="modal-section daily-quest-minimum-section"><h3>Daily Quest Minimum</h3><p class="helper">How many Quest Board actions count as a full-clear day. Current streak: <b>${Number(ensureDailyQuestsState().currentStreak||0)}</b> day${Number(ensureDailyQuestsState().currentStreak||0)===1?'':'s'} at a minimum of ${Number(state.dailyQuests.minimum||3)}.</p><div class="two-col"><div class="form-row"><label>New minimum</label><select id="pDailyQuestMinimum">${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(state.dailyQuests.minimum||3)===n?'selected':''}>${n}</option>`).join('')}<option value="custom">Custom…</option></select></div><div class="form-row" id="pDailyQuestMinimumCustomRow" hidden><label>Custom minimum</label><input id="pDailyQuestMinimumCustom" type="number" min="1" step="1"></div></div><button type="button" class="text-btn accent" id="changeDailyQuestMinimum">Change Target</button></div><div class="modal-section character-management"><h3>Character Management</h3><p class="helper">Character Reset returns Player Level and all six core stats to their baseline. App preferences, targets, history and connections are kept.</p><button class="text-btn danger" id="characterReset">Character Reset</button><button class="text-btn" id="characterPlus" disabled title="Reserved for future Character+ progression">Character+ · Future</button></div><button class="rpg-btn accent" id="saveProfile" style="width:100%">Save Setup</button>`);
  modalRoot.querySelector('#useGeo').onclick=()=>{if(!navigator.geolocation)return toast('Location is not available.');navigator.geolocation.getCurrentPosition(pos=>{modalRoot.querySelector('#pLat').value=pos.coords.latitude.toFixed(4);modalRoot.querySelector('#pLon').value=pos.coords.longitude.toFixed(4);toast('Coordinates added.');},()=>toast('Location permission was not granted.'))};
  const dqSel=modalRoot.querySelector('#pDailyQuestMinimum'),dqCustomRow=modalRoot.querySelector('#pDailyQuestMinimumCustomRow');
  dqSel.onchange=()=>{dqCustomRow.hidden=dqSel.value!=='custom'};
  modalRoot.querySelector('#changeDailyQuestMinimum').onclick=()=>{
    const raw=dqSel.value==='custom'?modalRoot.querySelector('#pDailyQuestMinimumCustom').value:dqSel.value;
    const next=Math.max(1,Math.round(Number(raw||0)));
    if(!(next>=1)){toast('Enter a minimum of at least 1.');return}
    dailyQuestMinimumChangeModal(next);
  };
  modalRoot.querySelector('#tabProfile').onclick=()=>profileModal('profile');
  modalRoot.querySelector('#tabHome').onclick=()=>profileModal('home');
  modalRoot.querySelector('#tabNav').onclick=()=>profileModal('nav');
  modalRoot.querySelector('#tabTraining').onclick=()=>profileModal('training');
  modalRoot.querySelector('#calcTargets').onclick=()=>calculateProfileTargets();
  modalRoot.querySelector('#characterReset').onclick=()=>{if(!confirm('Reset character progression? Player Level and all six stats will return to baseline 10. Targets, history and app preferences will be kept.'))return;state.level=1;state.xp=0;state.stats=defaultStats();save();closeModal();toast('Character progression reset to baseline.');render()};
  modalRoot.querySelector('#saveProfile').onclick=()=>{
    p.name=modalRoot.querySelector('#pName').value.trim()||'Player';p.location=modalRoot.querySelector('#pLocation').value.trim()||'Horten';p.birthday=modalRoot.querySelector('#pBirthday').value||null;p.lat=Number(modalRoot.querySelector('#pLat').value||59.4172);p.lon=Number(modalRoot.querySelector('#pLon').value||10.4834);p.weight=numberOrNull(modalRoot.querySelector('#pWeight').value);p.height=numberOrNull(modalRoot.querySelector('#pHeight').value);p.age=numberOrNull(modalRoot.querySelector('#pAge').value);p.metabolicFormula=modalRoot.querySelector('#pFormula').value;p.activityLevel=modalRoot.querySelector('#pActivity').value;p.nutritionGoal=modalRoot.querySelector('#pGoal').value;p.wordLanguage=modalRoot.querySelector('#pWordLanguage').value;p.showRunningConditions=modalRoot.querySelector('#pRunning').value==='yes';p.calTarget=Math.max(1,Number(modalRoot.querySelector('#pCalories').value||p.calTarget));p.proteinTarget=Math.max(1,Number(modalRoot.querySelector('#pProtein').value||p.proteinTarget));p.waterTarget=Math.max(1,Number(modalRoot.querySelector('#pWater').value||p.waterTarget));p.sleepTarget=Math.max(1,Number(modalRoot.querySelector('#pSleep').value||p.sleepTarget));p.readingTarget=Math.max(1,Number(modalRoot.querySelector('#pReading').value||p.readingTarget||30));p.mindfulTarget=Math.max(1,Number(modalRoot.querySelector('#pMindful').value||p.mindfulTarget||10));p.stepsTarget=Math.max(1,Number(modalRoot.querySelector('#pSteps').value||p.stepsTarget||8000));p.socialTarget=Math.max(1,Number(modalRoot.querySelector('#pSocial').value||p.socialTarget||2));state.weatherCache=null;save();closeModal();toast('Setup saved.');renderGlobalNavigation();render()};
}
/* Daily Quest Minimum change flow (ASTRA Update Package 1 §26-27) — a
   confirmed change resets the CURRENT streak to 0 but never rewrites
   history: each finalized ledger day keeps its own
   minimumAtFinalization forever, so past qualifying days stay correct
   under whatever target was active then. */
function dailyQuestMinimumChangeModal(next){
  const dq=ensureDailyQuestsState(),current=Number(dq.minimum||3),streak=Number(dq.currentStreak||0);
  if(next===current){toast('That is already the current minimum.');return}
  modal(`<h2>Change Daily Quest Minimum?</h2><p class="helper">Your current Daily Quest streak is based on a minimum of <b>${current}</b> completed Quest Board action${current===1?'':'s'} per day.</p><p class="helper">Changing this target to <b>${next}</b> will reset your current Daily Quest streak (${streak} day${streak===1?'':'s'}) to 0.</p><p class="helper">Past completed days will remain in your history.</p><div class="two-col"><button type="button" class="rpg-btn" id="cancelDailyQuestMinimum">Cancel</button><button type="button" class="rpg-btn accent" id="confirmDailyQuestMinimum">Change &amp; Reset Streak</button></div>`);
  modalRoot.querySelector('#cancelDailyQuestMinimum').onclick=closeModal;
  modalRoot.querySelector('#confirmDailyQuestMinimum').onclick=()=>{
    dq.changeLog.push({date:todayISO(),from:current,to:next,confirmedAt:Date.now()});
    dq.changeLog=dq.changeLog.slice(-200);
    dq.minimum=next;
    dq.streakResetAt=todayISO();
    save();closeModal();toast('Daily Quest Minimum updated. Streak reset.');profileModal();
  };
}
function numberOrNull(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null}
function calculateNutritionTargets(){
  const weight=Number(modalRoot.querySelector('#pWeight').value),height=Number(modalRoot.querySelector('#pHeight').value),age=Number(modalRoot.querySelector('#pAge').value),formula=modalRoot.querySelector('#pFormula').value,activity=modalRoot.querySelector('#pActivity').value,goal=modalRoot.querySelector('#pGoal').value,note=modalRoot.querySelector('#calcNote');
  if(formula==='manual'){note.textContent='Choose one of the Mifflin–St Jeor formula options to calculate, or enter targets manually.';return}
  if(!(weight>=30&&weight<=300&&height>=120&&height<=230&&age>=16&&age<=100)){note.textContent='Enter weight, height and age in the expected ranges before calculating.';return}
  const bmr=10*weight+6.25*height-5*age+(formula==='male'?5:-161);const factor={sedentary:1.2,light:1.375,moderate:1.55,high:1.725}[activity]||1.55;const adjustment={lose:-400,maintain:0,gain:300}[goal]||0;const calories=Math.round((bmr*factor+adjustment)/10)*10;const protein=Math.round(weight*(goal==='maintain'?1.6:1.8));modalRoot.querySelector('#pCalories').value=Math.max(1,calories);modalRoot.querySelector('#pProtein').value=Math.max(1,protein);note.textContent=`Estimated maintenance: ${Math.round(bmr*factor)} kcal/day. Suggested target inserted below; edit it if your own plan differs.`;
}

/* ---------- HELP / MODALS ---------- */
function helpModal(){modal(`<h2>Help & Connections</h2><div class="list-item"><div>⚙</div><div><h3>Profile & Setup</h3><p>Name, location, Home preferences and daily targets.</p></div><button class="text-btn accent" id="helpSetup">Open</button></div><div class="list-item"><div>↔</div><div><h3>Activity Connections</h3><p>Garmin → Strava architecture and manual fallback.</p></div><button class="text-btn accent" id="helpConnections">Open</button></div><div class="list-item"><div>▣</div><div><h3>PWA / Data</h3><p>Daily values reset each local day. Long-term progress stays in browser storage.</p></div></div><div class="modal-section"><button class="text-btn" id="refreshWeather">Refresh Weather</button></div>`);modalRoot.querySelector('#helpSetup').onclick=()=>profileModal('profile');modalRoot.querySelector('#helpConnections').onclick=connectionsModal;modalRoot.querySelector('#refreshWeather').onclick=()=>{state.weatherCache=null;save();closeModal();refreshWeather(true);toast('Weather refresh requested.')}}

let modalViewportCleanup=null;
function syncModalViewport(){
  const backdrop=modalRoot.querySelector('.modal-backdrop'),box=modalRoot.querySelector('.modal');
  if(!backdrop||!box)return;
  const vv=window.visualViewport;
  if(vv){
    const keyboardOpen=vv.height<window.innerHeight*.82;
    const padTop=keyboardOpen?12:Math.min(76,Math.max(18,Math.round(vv.height*.11)));
    backdrop.style.top=`${Math.max(0,vv.offsetTop)}px`;
    backdrop.style.height=`${Math.max(180,vv.height)}px`;
    backdrop.style.bottom='auto';
    backdrop.style.setProperty('--modal-pad-top',`${padTop}px`);
    box.style.maxHeight=`${Math.max(170,vv.height-padTop-12)}px`;
  }else{
    backdrop.style.top='0';backdrop.style.height='100dvh';backdrop.style.bottom='auto';
    backdrop.style.setProperty('--modal-pad-top','clamp(18px,10vh,76px)');box.style.maxHeight='calc(100dvh - 36px)';
  }
}
function bindModalViewport(){
  if(modalViewportCleanup)modalViewportCleanup();
  const vv=window.visualViewport;
  const sync=()=>syncModalViewport();
  if(vv){vv.addEventListener('resize',sync);vv.addEventListener('scroll',sync)}
  const focus=e=>{if(!e.target.matches('input,textarea,select'))return;setTimeout(()=>{syncModalViewport();try{e.target.scrollIntoView({block:'center',inline:'nearest'})}catch(_){}},80)};
  modalRoot.addEventListener('focusin',focus);
  modalViewportCleanup=()=>{if(vv){vv.removeEventListener('resize',sync);vv.removeEventListener('scroll',sync)}modalRoot.removeEventListener('focusin',focus);modalViewportCleanup=null};
  sync();
}
function modal(html){
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><button class="close" aria-label="Close">×</button>${html}</div></div>`;
  const backdrop=modalRoot.querySelector('.modal-backdrop');
  if(modalRoot.querySelector('input,textarea,select'))backdrop.classList.add('keyboard-aware');
  modalRoot.querySelector('.close').onclick=closeModal;
  backdrop.onclick=e=>{if(e.target===e.currentTarget)closeModal()};
  bindModalViewport();
}
function closeModal(){if(modalViewportCleanup)modalViewportCleanup();modalRoot.innerHTML=''}


/* ---------- v0.01.7.9.1 MOBILE INPUT + RESOURCE MODAL HOTFIX ---------- */
state.rewardLocks=state.rewardLocks&&typeof state.rewardLocks==='object'?state.rewardLocks:{};
state.daily.wisdomReroll=Number(state.daily.wisdomReroll??state.daily.quoteReroll??0);
state.daily.challengeCompleted=Boolean(state.daily.challengeCompleted);
save();

let homeActionOpen=null;
const SYSTEM_REWARD_COLORS={str:'stat-str',dex:'stat-dex',con:'stat-con',int:'stat-int',wis:'stat-wis',cha:'stat-cha'};
const systemRewardQueue=[];
let systemRewardShowing=false;
function showSystemReward({xp=0,label='SYSTEM REWARD',stats={},detail=''}){
  const cleanStats=Object.fromEntries(Object.entries(stats||{}).filter(([k,v])=>STAT_NAMES[k]&&Number(v)>0));
  if(Number(xp)<=0&&!Object.keys(cleanStats).length)return;
  systemRewardQueue.push({xp:Math.max(0,Number(xp||0)),label:String(label||'SYSTEM REWARD'),stats:cleanStats,detail:String(detail||'')});
  pumpSystemRewardQueue();
}
function pumpSystemRewardQueue(){
  if(systemRewardShowing||!systemRewardQueue.length)return;
  const host=document.querySelector('#systemRewardHost');if(!host)return;
  systemRewardShowing=true;const r=systemRewardQueue.shift();
  const statLine=Object.entries(r.stats).map(([k,v])=>`<span class="${SYSTEM_REWARD_COLORS[k]||''}">+${Math.round(v)} ${STAT_NAMES[k]}</span>`).join('<i>◆</i>');
  const headline=r.xp>0?`+${Math.round(r.xp)} XP`:(Object.entries(r.stats)[0]?`+${Math.round(Object.entries(r.stats)[0][1])} ${STAT_NAMES[Object.entries(r.stats)[0][0]]}`:'REWARD');
  host.innerHTML=`<section class="system-reward-card" role="status" aria-live="polite"><div class="system-reward-gem" aria-hidden="true"></div><div class="system-reward-kicker">SYSTEM REWARD</div><div class="system-reward-xp">${esc(headline)}</div><div class="system-reward-label">${esc(r.label)}</div>${r.detail?`<div class="system-reward-detail">${esc(r.detail)}</div>`:''}${statLine?`<div class="system-reward-stats">${statLine}</div>`:''}</section>`;
  const card=host.firstElementChild;requestAnimationFrame(()=>card&&card.classList.add('show'));
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(()=>{if(card){card.classList.add('leaving');card.classList.remove('show')}setTimeout(()=>{host.innerHTML='';systemRewardShowing=false;pumpSystemRewardQueue()},reduce?50:280)},reduce?2600:3900);
}
function rewardLockKey(type,id,date=todayISO()){return `${type}:${date}:${id}`}
function grantProtectedReward(lockKey,{xp=0,label='REWARD COMPLETE',stats={},detail=''}){
  if(state.rewardLocks[lockKey])return false;
  state.rewardLocks[lockKey]={awardedAt:new Date().toISOString(),xp:Number(xp||0),stats:{...stats}};
  if(Number(xp)>0){const applied=addOverallXP(Number(xp));logXpGain(applied,label,XP_LABEL_CATEGORY[label]);}
  Object.entries(stats||{}).forEach(([k,v])=>addStatXP(k,Number(v||0)));
  save();showSystemReward({xp,label,stats,detail});return true;
}

/* ---------- Quest integrity / anti-cheat foundation (Home Baseline
   Correction, item 23) ----------
   A reusable signal-tracking layer for reward-generating systems, starting
   with Main Quest. It only RECORDS events and computes same-day/interval
   signals — it never touches Base Stats and applies no penalty yet.
   QUEST_INTEGRITY_CONFIG is the single place a future session wires in an
   approved diminishing-return curve; exact thresholds/percentages are not
   approved, so applyIntegrityAdjustedXP is currently a passthrough. */
function ensureQuestIntegrity(){
  state.integrity=state.integrity&&typeof state.integrity==='object'?state.integrity:{};
  state.integrity.mainQuest=state.integrity.mainQuest&&typeof state.integrity.mainQuest==='object'?state.integrity.mainQuest:{events:[]};
  state.integrity.mainQuest.events=Array.isArray(state.integrity.mainQuest.events)?state.integrity.mainQuest.events:[];
  return state.integrity.mainQuest;
}
function recordQuestIntegrityEvent(type,q,extra={}){
  const integ=ensureQuestIntegrity(),now=Date.now(),createdAt=Number(q?.createdAt||now);
  integ.events.push({
    date:todayISO(),ts:now,questId:q?.id,type,
    createdSameDay:localISO(new Date(createdAt))===todayISO(),
    msSinceCreated:Math.max(0,now-createdAt),
    ...extra
  });
  integ.events=integ.events.slice(-200);
}
function questIntegritySignals(){
  const integ=ensureQuestIntegrity(),today=todayISO(),todays=integ.events.filter(e=>e.date===today);
  return {
    completionsToday:todays.filter(e=>e.type==='completed'||e.type==='completed-early').length,
    sameDayCreateCompleteToday:todays.filter(e=>e.createdSameDay&&(e.type==='completed'||e.type==='completed-early')).length,
    earlyCompletionsToday:todays.filter(e=>e.type==='completed-early').length,
    cancelledToday:todays.filter(e=>e.type==='cancelled').length
  };
}
const QUEST_INTEGRITY_CONFIG={diminishingReturns:{enabled:false}};
function applyIntegrityAdjustedXP(baseXP,source){
  if(!QUEST_INTEGRITY_CONFIG.diminishingReturns.enabled)return baseXP;
  return baseXP;
}

/* ---------- Generic Integrity scaffolding (Astra "Safe Overnight
   Handoff" §5) ----------
   Dormant architecture only. ensureQuestIntegrity/recordQuestIntegrityEvent
   above stay exactly as they were (Main Quest is one participant);
   recordIntegrityEvent is the same pattern generalised for any other
   source (achievements, side quests, etc. — nothing currently calls it
   except the achievement-engine hook in v0.02.4-integration.js).
   escalationState and previousClass are storage only: no strike counts,
   rolling window, evidence rules, or restoration logic exist yet, and
   nothing reads escalationState to change behavior. applyIntegrityAdjustedXP
   above is already the one central EXP-modifier hook — it now also
   backs recordIntegrityEvent-driven sources, still a neutral passthrough
   until QUEST_INTEGRITY_CONFIG.diminishingReturns.enabled is turned on by
   an approved future change. */
function ensureGeneralIntegrity(){
  state.integrity=state.integrity&&typeof state.integrity==='object'?state.integrity:{};
  state.integrity.general=state.integrity.general&&typeof state.integrity.general==='object'?state.integrity.general:{events:[]};
  state.integrity.general.events=Array.isArray(state.integrity.general.events)?state.integrity.general.events:[];
  if(!state.integrity.escalationState)state.integrity.escalationState='none';
  if(state.integrity.previousClass===undefined)state.integrity.previousClass=null;
  return state.integrity.general;
}
function recordIntegrityEvent(source,type,extra={}){
  const integ=ensureGeneralIntegrity();
  integ.events.push({date:todayISO(),ts:Date.now(),source,type,...extra});
  integ.events=integ.events.slice(-300);
}

/* ---------- Class System foundation (Astra "Safe Overnight Handoff"
   §3) ----------
   Expandable eligibility model: player data/events/achievements -> unlock
   evaluators -> eligible class library -> player selects active class.
   CLASS_UNLOCK_EVALUATORS is deliberately empty — no thresholds, perks,
   or unlock conditions are defined in this pass. grantClassUnlock only
   ever ADDS a class id to unlockedClasses; it never sets activeClass, so
   eligibility never auto-equips. Hidden classes (see
   v0.02.4.2-character.js's V0242_HIDDEN_CLASSES) stay invisible to any
   UI that only lists state.classSystem.unlockedClasses/selectedClasses,
   which is empty for them by default. */
const CLASS_UNLOCK_EVALUATORS={};
function ensureClassSystem(){
  state.classSystem=state.classSystem&&typeof state.classSystem==='object'?state.classSystem:{eligibleClasses:[],unlockedClasses:[],selectedClasses:[],activeClass:'Novice',classAssets:{}};
  state.classSystem.unlockedClasses=Array.isArray(state.classSystem.unlockedClasses)?state.classSystem.unlockedClasses:[];
  return state.classSystem;
}
function grantClassUnlock(classId,reason='unlock'){
  const cs=ensureClassSystem();
  if(!classId||cs.unlockedClasses.includes(classId))return false;
  cs.unlockedClasses.push(classId);
  recordIntegrityEvent('classSystem','classUnlocked',{classId,reason});
  save();
  return true;
}
function evaluateClassEligibility(){
  const cs=ensureClassSystem();
  Object.entries(CLASS_UNLOCK_EVALUATORS).forEach(([classId,evaluator])=>{
    if(cs.unlockedClasses.includes(classId))return;
    try{if(typeof evaluator==='function'&&evaluator(state))grantClassUnlock(classId,'evaluator')}catch(e){}
  });
}

/* ---------- Achievement schema additions (Astra "Safe Overnight
   Handoff" §4) ----------
   ACHIEVEMENT_RARITIES documents the supported rarity set (adds Celestial
   to what the existing V023_ACHIEVEMENT_DEFINITIONS registry in
   v0.02.4-integration.js already uses). The optional per-definition
   fields (hidden, classUnlocker, unlocksClass, integrityEvent) are read
   defensively wherever achievements are defined/unlocked — see
   v023UnlockAchievement — so existing definitions that omit them are
   unaffected. */
const ACHIEVEMENT_RARITIES=['Common','Uncommon','Rare','Epic','Legendary','Celestial'];

const DAILY_WISDOM=[
  {type:'Perspective',text:'A plan that survives an imperfect day is more useful than a perfect plan you cannot maintain.'},
  {type:'System Tip',text:'Reduce the next action until it is easy to start. Momentum can scale it afterward.'},
  {type:'Proverb',text:'A smooth sea never made a skilled sailor.'},
  {type:'Micro-Lesson',text:'Consistency is less about never missing and more about shortening the time between restarting.'},
  {type:'Reflection',text:'What would make today feel meaningfully complete, even if nothing else gets done?'},
  {type:'Perspective',text:'Rest and effort are not opposites. Recovery is part of the process that makes effort repeatable.'},
  {type:'System Tip',text:'When priorities compete, choose the action that removes the most friction from the rest of the day.'},
  {type:'Micro-Lesson',text:'Attention is a limited resource. Deciding what not to do is part of focusing.'},
  {type:'Proverb',text:'Little strokes fell great oaks.'},
  {type:'Reflection',text:'Progress can be measured by what became easier, not only by what became finished.'}
];
const DAILY_CHALLENGES=[
  {id:'digital-exile',title:'DIGITAL EXILE',category:'behavioral',text:'Stay off your phone for 30 minutes.',xp:35,durationMin:30,verification:'honor'},
  {id:'deep-reading',title:'DEEP READING',category:'mental',text:'Read continuously for 30 minutes.',xp:35,durationMin:30,verification:'honor'},
  {id:'mobility-twenty',title:'MOBILITY PROTOCOL',category:'physical',text:'Complete a 20-minute mobility session.',xp:40,durationMin:20,verification:'honor'},
  {id:'step-surge',title:'STEP SURGE',category:'resource-linked',text:'Add 2,000 steps beyond your step count when you accept this challenge.',xp:40,durationMin:0,verification:'steps'},
  {id:'old-task',title:'CLEAR THE BACKLOG',category:'behavioral',text:'Finish something you have postponed for at least a week.',xp:45,durationMin:0,verification:'honor'},
  {id:'reconnect',title:'REOPEN THE CHANNEL',category:'social',text:'Contact someone you have not spoken to recently and have a genuine exchange.',xp:40,durationMin:0,verification:'honor'},
  {id:'focus-sprint',title:'FOCUS SPRINT',category:'timed',text:'Work on one meaningful task for 25 uninterrupted minutes.',xp:35,durationMin:25,verification:'honor'}
];
function dailyWisdom(){const seed=baseDaySeed()+Number(state.daily.wisdomReroll||0)*19;return DAILY_WISDOM[(seed*11+7)%DAILY_WISDOM.length]}
function dailyChallengeForDate(date=todayISO()){const seed=Number(String(date).replaceAll('-',''));return DAILY_CHALLENGES[(seed*13+5)%DAILY_CHALLENGES.length]}
function dailyChallenge(){return dailyChallengeForDate(todayISO())}
function dailyChallengeLockKey(date=todayISO()){return `dailyChallenge:${date}`}
function dailyChallengeLocked(){return Boolean(state.rewardLocks[dailyChallengeLockKey()])}
function challengeState(){state.daily.challengeState=state.daily.challengeState||{status:'AVAILABLE',date:todayISO(),challengeId:dailyChallenge().id};const c=state.daily.challengeState;if(c.date!==todayISO()||c.challengeId!==dailyChallenge().id)state.daily.challengeState={status:'AVAILABLE',date:todayISO(),challengeId:dailyChallenge().id};return state.daily.challengeState}
function ensureChallengeTracker(){state.challengeTracker=state.challengeTracker||{currentStreak:0,bestStreak:0,totalCompleted:0,totalFailed:0,abandoned:0,earlyFailures:0,minorLootBoxesEarned:0,lastCompletedDate:null,history:[]};state.challengeTracker.history=Array.isArray(state.challengeTracker.history)?state.challengeTracker.history:[];state.lootBoxes=state.lootBoxes||{minor:0};return state.challengeTracker}
function acceptDailyChallenge(){const ch=dailyChallenge(),cs=challengeState();if(cs.status!=='AVAILABLE'){toast('Challenge is already active or resolved.');return}cs.status='ACTIVE';cs.startTime=Date.now();cs.minimumValidCompletionTime=cs.startTime+Number(ch.durationMin||0)*60000;cs.startSteps=Number(state.daily.steps||0);save();renderHome()}
function recordChallengeFailure(reason){const ch=dailyChallenge(),cs=challengeState(),tr=ensureChallengeTracker();if(['COMPLETE','FAIL','ABANDONED'].includes(cs.status))return;cs.status=reason==='abandoned'?'ABANDONED':'FAIL';cs.resultReason=reason;cs.finishedAt=Date.now();tr.currentStreak=0;if(reason==='abandoned')tr.abandoned++;else tr.totalFailed++;if(reason==='early')tr.earlyFailures++;tr.history.push({date:todayISO(),id:ch.id,title:ch.title,category:ch.category,result:cs.status,reason});tr.history=tr.history.slice(-365);save();toast(reason==='early'?'CHALLENGE FAILED · Attention Span: Goldfish trigger recorded.':'Challenge recorded.');renderHome()}
function completeDailyChallenge(){const ch=dailyChallenge(),cs=challengeState(),tr=ensureChallengeTracker();if(dailyChallengeLocked()||cs.status==='COMPLETE'){toast('Daily Challenge reward already claimed.');return}if(cs.status!=='ACTIVE'){toast('Accept the challenge first.');return}if(Number(ch.durationMin||0)>0&&Date.now()<Number(cs.minimumValidCompletionTime||0)){recordChallengeFailure('early');return}if(ch.verification==='steps'&&Number(state.daily.steps||0)<Number(cs.startSteps||0)+2000){toast('Tracked step requirement has not been reached yet.');return}const key=dailyChallengeLockKey();if(!grantProtectedReward(key,{xp:ch.xp,label:'DAILY CHALLENGE COMPLETE',detail:'Minor Loot Box'})){toast('Reward already protected.');return}cs.status='COMPLETE';cs.finishedAt=Date.now();state.daily.challengeCompleted=true;state.lootBoxes.minor=Number(state.lootBoxes.minor||0)+1;tr.totalCompleted++;tr.minorLootBoxesEarned++;const yesterday=addDays(todayISO(),-1);tr.currentStreak=tr.lastCompletedDate===yesterday?Number(tr.currentStreak||0)+1:1;tr.bestStreak=Math.max(Number(tr.bestStreak||0),tr.currentStreak);tr.lastCompletedDate=todayISO();tr.history.push({date:todayISO(),id:ch.id,title:ch.title,category:ch.category,result:'COMPLETE',xp:ch.xp,loot:'Minor Loot Box'});tr.history=tr.history.slice(-365);save();showSystemReward({xp:ch.xp,label:'DAILY CHALLENGE COMPLETE',detail:'Minor Loot Box earned'});renderHome()}
function challengeTrackerModal(){const tr=ensureChallengeTracker(),next=10,p=Math.min(100,Math.round((tr.currentStreak%next)/next*100));const recent=tr.history.slice(-10).reverse().map(x=>`<div class="challenge-history-row"><b>${fmtDate(x.date)}</b><span>${esc(x.title||x.id)} · ${esc(x.category||'')}</span><small>${esc(x.result||'')}</small></div>`).join('')||'<p class="helper">No challenge history yet.</p>';modal(`<h2>Daily Challenge Tracker</h2><div class="challenge-tracker-stats"><div><span>Current Streak</span><b>${tr.currentStreak}</b></div><div><span>Best Streak</span><b>${tr.bestStreak}</b></div><div><span>Completed</span><b>${tr.totalCompleted}</b></div><div><span>Failed</span><b>${tr.totalFailed}</b></div><div><span>Abandoned</span><b>${tr.abandoned}</b></div><div><span>Early Failures</span><b>${tr.earlyFailures}</b></div><div><span>Minor Loot Boxes</span><b>${tr.minorLootBoxesEarned}</b></div></div><div class="tracker-milestone"><small>Next Achievement · 10 consecutive challenge completions</small><strong>${tr.currentStreak} / 10</strong><div class="mini-progress"><i style="--p:${p}"></i></div></div><div class="challenge-history-list">${recent}</div>`)}
function challengeCardHTML(){
  const ch=dailyChallenge(),cs=challengeState(),locked=dailyChallengeLocked(),status=locked?'COMPLETE':cs.status;let action='';
  if(status==='AVAILABLE')action=`<button class="rpg-btn accent challenge-action" id="acceptChallenge">ACCEPT CHALLENGE</button>`;
  else if(status==='ACTIVE')action=`<div class="challenge-actions"><button class="rpg-btn accent" id="completeChallenge">Complete</button><button class="text-btn danger" id="abandonChallenge">Abandon</button></div>`;
  else action=`<button class="rpg-btn" disabled>${status==='COMPLETE'?'Completed ✓':status}</button>`;
  return `<article class="development-card challenge-card"><div class="development-head challenge-head"><button class="development-icon-action" id="challengeTrackerIcon" aria-label="Open Daily Challenge Tracker"><img src="${asset('Daily_Challenge.png')}" alt=""></button><div><span>DAILY CHALLENGE</span><small>${esc(ch.category)} · ${status}</small></div></div><div class="challenge-content"><h3>${esc(ch.title)}</h3><p>${esc(ch.text)}</p>${ch.durationMin?`<small>Minimum duration: ${ch.durationMin} minutes · elapsed time verified, activity honor-based.</small>`:ch.verification==='steps'?'<small>Progress verified using the app’s tracked Steps value.</small>':'<small>Completion is honor-based.</small>'}<strong>+${ch.xp} XP · Minor Loot Box</strong>${action}</div></article>`;
}


const WORD_EXAMPLE_EN={
  no:{'Utholdenhet':'Endurance is built one session at a time.','Mestring':'A sense of mastery often comes after something first feels difficult.','Mot':'It takes courage to begin before you feel ready.','Ro':'A few minutes of calm can change the rest of the day.','Nysgjerrighet':'Curiosity turns a problem into something that can be explored.','Viljestyrke':'Willpower is easier when the next step is clear.','Glede':'Joy can be found in small things throughout the day.','Fremgang':'Progress does not need to be dramatic to count.','Tålmodighet':'Patience makes long-term work possible.','Fokus':'Focus means choosing what gets your attention right now.'},
  de:{'Ausdauer':'Endurance grows with every small step.','Mut':'Courage does not mean something is easy.','Ruhe':'A moment of calm can change the whole day.','Fortschritt':'Small progress counts too.','Neugier':'Curiosity turns problems into questions.'},
  fr:{'Courage':'Courage often begins with a small step.','Progrès':'Every small piece of progress counts.','Calme':'A few minutes of calm can help.','Curiosité':'Curiosity turns an obstacle into a question.','Patience':'Patience supports long-term goals.'},
  es:{'Constancia':'Consistency turns small steps into progress.','Valor':'Courage begins with a small step.','Calma':'A moment of calm can change the day.','Progreso':'Small progress also counts.','Curiosidad':'Curiosity turns a problem into a question.'}
};
function englishExample(word,lang){return lang==='en'?word[3]:(WORD_EXAMPLE_EN[lang]?.[word[0]]||'')}

/* duplicate renderWeatherHTML implementation removed in v0.01.8.2.6.2 cleanup test */
function radialMeter(value,target,extra=''){
  const n=pct(value,target);return `<div class="resource-ring ${extra}" style="--p:${n}"><span>${n}%</span></div>`
}
function waterRingClass(value,target){const ratio=Number(target)>0?Number(value)/Number(target):0;return ratio>=1.2?'water-over':ratio>=1?'water-target':'water-below'}
/* duplicate resourceCard implementation removed in v0.01.8.2.6.2 cleanup test */
/* duplicate resourceFood implementation removed in v0.01.8.2.6.2 cleanup test */
/* duplicate resourceMind implementation removed in v0.01.8.2.6.2 cleanup test */
/* Refactored onto sharedScheduleItemsForDate (Phase 3B.3) — this also
   fixes a real pre-existing bug: v0.02.4-integration.js's monkey-patched
   override of this function (the one actually active at runtime) ignored
   its `t` argument entirely and always read today's date; the shared
   aggregator is correctly date-parameterized, so that override (also
   refactored this phase) now genuinely respects an arbitrary date. This
   function's own only consumer, scheduleHTML(), is unreferenced dead
   code (confirmed via repo-wide search) — kept working correctly anyway
   rather than left to silently diverge from the now-shared behavior. */
function scheduleItems(t=todayISO()){
  return sharedScheduleItemsForDate(t);
}
function sectionArtwork(name,alt){return `<div class="home-section-art"><img src="${asset(name)}" alt="${esc(alt)}"></div>`}
function todayStatusSummary(){
  const tasks=state.tasks.filter(x=>x.date===todayISO()),activities=state.activities.filter(x=>x.date===todayISO()),challengeDone=dailyChallengeLocked()||state.daily.challengeCompleted;
  const total=2+tasks.length+activities.length,done=(state.quest.rewarded||state.daily.questDone?1:0)+(challengeDone?1:0)+tasks.filter(x=>x.done).length+activities.filter(x=>x.completed).length;
  return {done,total,pct:total?Math.round(done/total*100):0};
}
/* duplicate playerStatusHTML implementation removed in v0.01.8.2.6.2 cleanup test */
function updateQuestStreak(date){
  state.playerStatus=state.playerStatus||{streak:0,lastQuestDate:null};
  if(state.playerStatus.lastQuestDate===date)return;
  const yesterday=addDays(date,-1);
  state.playerStatus.streak=state.playerStatus.lastQuestDate===yesterday?Math.max(1,Number(state.playerStatus.streak||0)+1):1;
  state.playerStatus.lastQuestDate=date;
}
/* duplicate resourceHistoryModal implementation removed in v0.01.8.2.6.2 cleanup test */
function resourceGoalMet(row,key,p){
  if(key==='water')return Number(row.water||0)>=Number(p.waterTarget||2500);
  if(key==='food'){const low=Number(p.calTarget||2200)*.95,high=Number(p.calTarget||2200)*1.05;return Number(row.calories||0)>=low&&Number(row.calories||0)<=high&&Number(row.protein||0)>=Number(p.proteinTarget||120)}
  if(key==='sleep')return Number(row.sleep||0)>=Number(p.sleepTarget||8);
  if(key==='mind')return Number(row.mindfulness||0)>=Number(p.mindfulnessTarget||30);
  if(key==='steps')return Number(row.steps||0)>=Number(p.stepsTarget||8000);
  if(key==='social')return Number(row.socialMinutes||0)>=Number(p.socialMinutesTarget||30);return false;
}
function resourceStreakStats(key){
  const p=state.profile,rows=[...(state.resourceHistory||[]),{date:todayISO(),...state.daily}].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  let best=0,run=0;for(const r of rows){if(resourceGoalMet(r,key,p)){run++;best=Math.max(best,run)}else run=0}
  let current=0;for(let i=rows.length-1;i>=0;i--){if(resourceGoalMet(rows[i],key,p))current++;else break}
  const milestones=[3,7,14,30,60,100,180,365],next=milestones.find(m=>m>current)||365;
  return {current,best,next,progress:Math.min(current,next)};
}
function resourceTrackerModal(){
  const labels={water:'Water',food:'Food',sleep:'Sleep',mind:'Mindfulness',steps:'Steps',social:'Social'};
  const rows=Object.entries(labels).map(([key,label])=>{const st=resourceStreakStats(key);return `<div class="resource-tracker-row"><div><b>${label}</b><span>Current streak ${st.current} day${st.current===1?'':'s'} · Best ${st.best}</span></div><div class="tracker-milestone"><small>Next milestone</small><strong>${st.next} days</strong><div class="mini-progress"><i style="--p:${Math.round(st.progress/st.next*100)}"></i></div></div><small class="tracker-hidden">Staged and hidden Resource achievements use this same protected history/streak data.</small></div>`}).join('');
  modal(`<h2>Resource Tracker</h2><p class="helper">Progression, achievement milestones and goal streaks for Resources only. This tracker is separate from Tasks and Side Quests.</p><div class="resource-tracker-list">${rows}</div>`);
}
function resourceHistoryModal(){
  const rows=[...(state.resourceHistory||[]),{date:todayISO(),...state.daily}].slice(-30).reverse();
  const body=rows.length?rows.map(r=>`<div class="resource-history-row"><b>${fmtDate(r.date)}</b><span>Water ${Math.round(r.water||0)}ml</span><span>Food ${Math.round(r.calories||0)}cal / ${Math.round(r.protein||0)}g</span><span>Sleep ${Number(r.sleep||0).toFixed(1)}h</span><span>Mindfulness ${Math.round(r.mindfulness??((r.reading||0)+(r.mindful||0)))}m</span><span>Steps ${Math.round(r.steps||0).toLocaleString()}</span><span>Social ${Math.round(r.socialMinutes??r.social??0)}m</span></div>`).join(''):'<p class="helper">No resource history yet.</p>';
  modal(`<h2>Resource History</h2><p class="helper">Previous daily values and historical records. Tracker handles streaks and achievement progression; History handles recorded data.</p><div class="resource-history-list">${body}</div>`);
}
function resourcesHeaderHTML(){return `<div class="resources-section-header collapse-icon-row ${homeResourcesOpen?'expanded':'collapsed'}"><button class="home-section-tool" id="resourceTrackerButton"><span>Tracker</span></button><button class="home-section-art central-collapse-control" id="toggleResourcesSection" aria-expanded="${homeResourcesOpen}" aria-label="${homeResourcesOpen?'Collapse':'Expand'} Resources"><img src="${asset('Resources.png')}" alt="Resources"></button><button class="home-section-tool" id="resourceHistoryButton"><span>History</span></button></div>`}
const BONUS_DEV=[
  {type:'Codebreaker',text:'Decode this: 3-1-20 = ?',answer:'CAT'},
  {type:'Number Sequence',text:'What comes next: 2, 4, 8, 16, ?',answer:'32'},
  {type:'Logic',text:'If all runes glow and this rune is dark, is the set complete?',answer:'NO'},
  {type:'Pattern',text:'Continue: ▲ ● ▲ ● ▲ ?',answer:'●'},
  {type:'Word Puzzle',text:'Unscramble this word: GORPESRS',answer:'PROGRESS'}
];
function bonusDevelopmentModal(){
  const item=BONUS_DEV[baseDaySeed()%BONUS_DEV.length],key=`bonusDevelopment:${todayISO()}`,claimed=Boolean(state.rewardLocks[key]);
  const diff=['Easy','Normal','Tricky'][baseDaySeed()%3],history=state.bonusDevelopment?.history||[],prev=history.filter(x=>x.success).sort((a,b)=>(a.ms||9e9)-(b.ms||9e9))[0];
  modal(`<div class="trial-screen"><h2>TRIAL OF WISDOM</h2><p class="helper">Today’s puzzle is predetermined for ${fmtDate(todayISO())}. Replays are allowed; only the first successful completion can award XP.</p><div class="trial-summary"><div><span>TODAY'S PUZZLE</span><b>${esc(item.type)}</b></div><div><span>DIFFICULTY</span><b>${diff}</b></div><div><span>REWARD</span><b>${claimed?'Claimed':'+10 XP'}</b></div>${prev?`<div><span>BEST</span><b>${Math.max(1,Math.round(prev.ms/1000))}s</b></div>`:''}</div><button class="rpg-btn accent" id="startBonusTrial">Start Puzzle</button><div id="bonusTrialStage"></div></div>`);
  modalRoot.querySelector('#startBonusTrial').onclick=()=>startBonusTrial(item,key,claimed);
}
function startBonusTrial(item,key,wasClaimed){
  const stage=modalRoot.querySelector('#bonusTrialStage'),started=Date.now();
  stage.innerHTML=`<div class="bonus-game"><b>${esc(item.type)}</b><p>${esc(item.text)}</p><div class="form-row"><label>Your answer</label><input id="bonusAnswer" autocomplete="off"></div><button class="rpg-btn accent" id="submitBonusTrial">Submit</button></div>`;
  modalRoot.querySelector('#bonusAnswer').focus();
  modalRoot.querySelector('#submitBonusTrial').onclick=()=>{const ans=String(modalRoot.querySelector('#bonusAnswer').value||'').trim().toUpperCase(),ok=ans===String(item.answer).trim().toUpperCase(),ms=Date.now()-started;state.bonusDevelopment=state.bonusDevelopment||{history:[]};state.bonusDevelopment.history=Array.isArray(state.bonusDevelopment.history)?state.bonusDevelopment.history:[];state.bonusDevelopment.history.push({date:todayISO(),type:item.type,success:ok,ms});state.bonusDevelopment.history=state.bonusDevelopment.history.slice(-100);if(ok){const rewarded=grantProtectedReward(key,{xp:10,label:'TRIAL OF WISDOM'});save();stage.innerHTML=`<div class="trial-result success"><b>TRIAL COMPLETE</b><p>${rewarded?'+10 XP awarded.':'Replay complete · no additional XP.'}</p></div>`}else{save();stage.insertAdjacentHTML('beforeend','<p class="trial-error">Not quite. Try again.</p>')}};
}
function developmentArchiveModal(){
  const lang=state.profile.wordLanguage||'no';
  const rows=Array.from({length:14},(_,i)=>addDays(todayISO(),-(i+1))).map(date=>{
    const seed=Number(date.replaceAll('-','')),list=WORDS_BY_LANG[lang]||WORDS_BY_LANG.no,w=list[(seed+langSeed(lang))%list.length],wis=DAILY_WISDOM[(seed*11+7)%DAILY_WISDOM.length],ch=dailyChallengeForDate(date);
    const result=(state.challengeTracker?.history||[]).find(x=>x.date===date);return `<div class="development-archive-row"><b>${fmtDate(date)}</b><span><strong>${esc(w[0])}</strong> · ${esc(w[1])}</span><small>${esc(wis.text)}</small><small>Challenge: ${esc(ch.title||ch.text)}${result?` · ${esc(result.result||'')}`:''}</small></div>`;
  }).join('');
  modal(`<h2>Development Archive</h2><p class="helper">Previous Daily Words, Daily Wisdom and Daily Challenges.</p><div class="development-archive-list">${rows}</div>`);
}
function dailyWordLanguageModal(){
  const eligible=ensureWordLanguages();
  const rows=Object.entries(WORD_LANGS).map(([code,label])=>`<label class="home-settings-row"><span>${esc(label)}</span><input type="checkbox" data-word-lang-toggle="${code}" ${eligible.includes(code)?'checked':''}></label>`).join('');
  modal(`<h2>Daily Word Languages</h2><p class="helper">Choose which languages are eligible to appear — the rotate button on Home cycles through them. Today’s word stays deterministic for whichever language is active.</p><div class="home-settings-list">${rows}</div>`);
  modalRoot.querySelectorAll('[data-word-lang-toggle]').forEach(cb=>{cb.onchange=()=>{
    const code=cb.dataset.wordLangToggle,list=ensureWordLanguages();
    if(cb.checked){if(!list.includes(code))list.push(code)}
    else{
      if(list.length<=1){cb.checked=true;toast('At least one language must stay eligible.');return}
      state.profile.wordLanguages=list.filter(l=>l!==code);
    }
    ensureWordLanguages();save();renderHome();
  }});
}
function developmentHeaderHTML(){return `<div class="resources-section-header development-section-header collapse-icon-row ${homeDevelopmentOpen?'expanded':'collapsed'}"><button class="home-section-tool icon-tool" id="bonusDevelopmentButton"><img src="${asset('bonus_icon.png')}" alt=""><span>Bonus</span></button><button class="home-section-art central-collapse-control" id="toggleDevelopmentSection" aria-expanded="${homeDevelopmentOpen}" aria-label="${homeDevelopmentOpen?'Collapse':'Expand'} Development"><img src="${asset('Development.png')}" alt="Development"></button><button class="home-section-tool icon-tool" id="developmentArchiveButton"><img src="${asset('archive_icon.png')}" alt=""><span>Archive</span></button></div>`}
function sharedPrimaryTask(){
  return state.tasks.map((task,index)=>({task,index})).filter(x=>!x.task.done&&sharedHomeItemTitle(x.task.text,['Complete Task'])).sort((a,b)=>{
    const priority=Number(Boolean(b.task.priority))-Number(Boolean(a.task.priority));
    if(priority)return priority;
    const due=String(a.task.date||'9999-12-31').localeCompare(String(b.task.date||'9999-12-31'));
    return due||a.index-b.index;
  })[0]?.task||null;
}
/* ---------- HOME: Today panel restructure (2026-09-04) ----------
   Today is split into separate stacked panels (not a grid) instead of one
   tall command panel, each independently shown/hidden via Home Settings.
   Daily Word / Daily Wisdom / Bonus Puzzle are back on Home (moved off
   Personal Growth). Panels are frameless, matching the rest of Home. */
const HOME_PANEL_KEYS=['mainquest','quests','priorities','calendar'];
const HOME_PANEL_LABELS={mainquest:'Main Quest',quests:'Side Quests',priorities:'To Do',calendar:'Calendar'};
function ensureHomePanels(){
  state.homePanels=state.homePanels||{};
  HOME_PANEL_KEYS.forEach(k=>{if(state.homePanels[k]===undefined)state.homePanels[k]=true});
  return state.homePanels;
}
/* Home Settings (module show/hide/reorder, Today-panel toggles) lives
   as the "Home" tab of Profile & Setup rather than its own standalone
   modal/icon — there is one settings entry point (the existing Profile
   & Setup gear, already reachable from Home/Character/Help), not a
   second independent Home-only icon. Was: homeSettingsModal(), opened
   via its own #homeSettingsButton (Today header) and #homeSettingsFallback
   (footer) icons — both removed; this content moved here instead. */
function profileHomeTab(){
  const panels=ensureHomePanels();
  const rows=HOME_PANEL_KEYS.map(k=>`<label class="home-settings-row"><span>${esc(HOME_PANEL_LABELS[k])}</span><input type="checkbox" data-home-panel-toggle="${k}" ${panels[k]!==false?'checked':''}></label>`).join('');
  const h=ensureHomeModules();
  const moduleRows=h.order.map(id=>{
    const def=HOME_MODULE_DEFS.find(m=>m.id===id);if(!def)return'';
    const group=homeModuleGroup(id),groupIds=h.order.filter(x=>homeModuleGroup(x)===group),idx=groupIds.indexOf(id);
    const canUp=group!=='fixed'&&idx>0,canDown=group!=='fixed'&&idx<groupIds.length-1;
    const locked=HOME_MODULE_ALWAYS_VISIBLE.includes(id);
    return `<div class="home-settings-row home-module-row"><span>${esc(def.label)}${locked?' <small>(always on)</small>':''}</span><div class="home-module-row-controls"><button class="text-btn home-module-move" data-home-module-up="${id}" ${canUp?'':'disabled'} aria-label="Move ${esc(def.label)} up">↑</button><button class="text-btn home-module-move" data-home-module-down="${id}" ${canDown?'':'disabled'} aria-label="Move ${esc(def.label)} down">↓</button><input type="checkbox" data-home-module-toggle="${id}" ${isHomeModuleVisible(id)?'checked':''} ${locked?'disabled':''}></div></div>`;
  }).join('');
  modal(`<h2>Profile & Setup</h2><div class="tabs tabs-4"><button id="tabProfile">Profile</button><button id="tabHome" class="active">Home</button><button id="tabNav">Navigation</button><button id="tabTraining">Training</button></div><p class="helper">Choose which Home modules are shown, and reorder them.</p><div class="home-settings-list">${moduleRows}</div><p class="helper">Choose which Quest Pane / Today panels show on Home.</p><div class="home-settings-list">${rows}</div>`);
  modalRoot.querySelector('#tabProfile').onclick=()=>profileModal('profile');
  modalRoot.querySelector('#tabHome').onclick=()=>profileModal('home');
  modalRoot.querySelector('#tabNav').onclick=()=>profileModal('nav');
  modalRoot.querySelector('#tabTraining').onclick=()=>profileModal('training');
  modalRoot.querySelectorAll('[data-home-panel-toggle]').forEach(cb=>{cb.onchange=()=>{panels[cb.dataset.homePanelToggle]=cb.checked;save();renderHome()}});
  modalRoot.querySelectorAll('[data-home-module-toggle]').forEach(cb=>{cb.onchange=()=>{toggleHomeModuleVisible(cb.dataset.homeModuleToggle);profileModal('home')}});
  modalRoot.querySelectorAll('[data-home-module-up]').forEach(btn=>{btn.onclick=()=>{moveHomeModule(btn.dataset.homeModuleUp,-1);profileModal('home')}});
  modalRoot.querySelectorAll('[data-home-module-down]').forEach(btn=>{btn.onclick=()=>{moveHomeModule(btn.dataset.homeModuleDown,1);profileModal('home')}});
}
/* Navigation Dock icon selection — its own Settings tab (2026-09-10,
   "add the nav icon selection to the settings page, it can have a new
   tab"). Was previously a section inside the Profile tab; moved out
   wholesale (same navDockSlotIds()/RADIAL_NAV_ITEMS source of truth,
   same duplicate-slot validation) rather than duplicated, so there's
   still exactly one place dock-slot assignment is saved. Each row now
   also shows the assigned destination's actual medallion art, updated
   live as the select changes, so this reads as real icon selection
   rather than a plain text dropdown. */
function profileNavTab(){
  const p=state.profile;
  const rows=navDockSlotIds().map((id,i)=>{
    const item=RADIAL_NAV_ITEMS.find(x=>x.id===id)||RADIAL_NAV_ITEMS[0];
    return `<div class="nav-icon-select-row">
      <span class="nav-icon-select-preview"><img id="pNavPreview${i}" src="${radialNavAsset(item.icon)}" alt=""></span>
      <div class="form-row"><label>Shortcut ${i+1}</label><select id="pNavSlot${i}">${RADIAL_NAV_ITEMS.map(x=>`<option value="${x.id}" ${x.id===id?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div>
    </div>`;
  }).join('');
  modal(`<h2>Profile & Setup</h2><div class="tabs tabs-4"><button id="tabProfile">Profile</button><button id="tabHome">Home</button><button id="tabNav" class="active">Navigation</button><button id="tabTraining">Training</button></div><div class="modal-section"><h3>Navigation Dock</h3><p class="helper">Choose the four destinations that stay one tap away in the bottom dock, and see their icon before you save. Everything else lives on the navigation wheel — tap the Home compass to open it. Each destination can only occupy one slot.</p><div class="nav-icon-select-grid">${rows}</div><button class="rpg-btn accent" id="saveNavDock" style="width:100%">Save Navigation</button></div>`);
  modalRoot.querySelector('#tabProfile').onclick=()=>profileModal('profile');
  modalRoot.querySelector('#tabHome').onclick=()=>profileModal('home');
  modalRoot.querySelector('#tabNav').onclick=()=>profileModal('nav');
  modalRoot.querySelector('#tabTraining').onclick=()=>profileModal('training');
  [0,1,2,3].forEach(i=>{
    const sel=modalRoot.querySelector(`#pNavSlot${i}`),preview=modalRoot.querySelector(`#pNavPreview${i}`);
    sel.onchange=()=>{
      const item=RADIAL_NAV_ITEMS.find(x=>x.id===sel.value);
      if(item)preview.src=radialNavAsset(item.icon);
    };
  });
  modalRoot.querySelector('#saveNavDock').onclick=()=>{
    const navSlots=[0,1,2,3].map(i=>modalRoot.querySelector(`#pNavSlot${i}`)?.value).filter(Boolean);
    if(navSlots.length===4&&new Set(navSlots).size===4){
      p.navDockSlots=navSlots;save();closeModal();toast('Navigation Dock saved.');renderGlobalNavigation();render();
    }else{
      toast('Navigation Dock: each destination can only be assigned once — dock left unchanged.');
    }
  };
}
/* Training Favourite Activities — its own Settings tab (2026-09-11, "a
   setting menu in the top corner where favoured can be set... this will
   also have a page on the main settings page too"). One implementation,
   two entry points: Training's own gear icon (trainingHeaderHTML) and
   this tab both open exactly this function, same pattern already
   established for Navigation Dock above -- not two separate configuration
   UIs to keep in sync. */
function profileTrainingTab(){
  const t=ensureTrainingState();
  const rows=t.favouriteActivityTypes.map((type,i)=>`<div class="nav-icon-select-row">
      <span class="nav-icon-select-preview" id="pFavouritePreview${i}">${type?trainingShield(type,''):'<span class="training-favourite-preview-empty">—</span>'}</span>
      <div class="form-row"><label>Favourite ${i+1}</label><select id="pFavourite${i}"><option value="">None</option>${ACTIVITY_TYPES.map(x=>`<option value="${esc(x)}" ${x===type?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
    </div>`).join('');
  modal(`<h2>Profile & Setup</h2><div class="tabs tabs-4"><button id="tabProfile">Profile</button><button id="tabHome">Home</button><button id="tabNav">Navigation</button><button id="tabTraining" class="active">Training</button></div><div class="modal-section"><h3>Favourite Activities</h3><p class="helper">Choose up to four activity types to quick-start from the Training Overview.</p><div class="nav-icon-select-grid">${rows}</div><button class="rpg-btn accent" id="saveTrainingFavourites" style="width:100%">Save Favourites</button></div>`);
  modalRoot.querySelector('#tabProfile').onclick=()=>profileModal('profile');
  modalRoot.querySelector('#tabHome').onclick=()=>profileModal('home');
  modalRoot.querySelector('#tabNav').onclick=()=>profileModal('nav');
  modalRoot.querySelector('#tabTraining').onclick=()=>profileModal('training');
  [0,1,2,3].forEach(i=>{
    const sel=modalRoot.querySelector(`#pFavourite${i}`),preview=modalRoot.querySelector(`#pFavouritePreview${i}`);
    sel.onchange=()=>{preview.innerHTML=sel.value?trainingShield(sel.value,''):'<span class="training-favourite-preview-empty">—</span>'};
  });
  modalRoot.querySelector('#saveTrainingFavourites').onclick=()=>{
    t.favouriteActivityTypes=[0,1,2,3].map(i=>modalRoot.querySelector(`#pFavourite${i}`).value||null);
    save();closeModal();toast('Favourite Activities saved.');render();
  };
}

/* ---------- Home v2: module registry (architecture upgrade, not a
   redesign — see ASTRA_CURRENT_STATE.md "Home v2"). Wraps the EXISTING
   Home render output (unchanged markup/behavior per module) in a
   configurable order/visibility layer. Defaults reproduce the current
   approved layout exactly, so existing saves render identically until a
   player opens Home Settings and changes something.
   Reorder is scoped to two natural existing layout groups rather than
   flattened across the whole page: the header's Player Status/Weather
   pair (group 'shell', a fixed 2-column grid), and the Today-stack's
   Side Quests/Development/Daily Puzzle trio (group 'stack2', an
   existing flex column). 'today' (Main Quest/Priorities/Calendar) and
   'resources' stay positional anchors (group 'fixed') since they sit
   before and after the stack in the DOM — moving them relative to the
   stack would restructure layout, not just reorder within it. */
const HOME_MODULE_DEFS=[
  {id:'playerStatus',label:'Player Status'},
  {id:'weather',label:'Weather'},
  {id:'questPane',label:'Quest Pane (Main Quest / Side Quests)'},
  {id:'today',label:'Today'},
  {id:'dailyActivities',label:'Daily Activities'},
  /* Movement (ASTRA Home Resources / Movement Rework, 2026-09-08) — Steps
     moved out of Resources into its own reorderable widget. 'stack2' is
     the only reorderable group this architecture currently has; 'resources'
     itself is a fixed positional anchor (see the block comment above
     homeModuleGroup), so a true "always immediately after Resources"
     placement isn't available without restructuring that anchor for
     every stack2 member. Placed last in stack2's default order instead,
     which puts it directly adjacent to Resources in the rendered stack
     — closest available placement under the existing architecture,
     while still getting full show/hide/reorder support for free. */
  {id:'movement',label:'Movement'},
  {id:'resources',label:'Resources'}
];
const HOME_MODULE_GROUPS={playerStatus:'shell',weather:'shell',dailyActivities:'stack2',movement:'stack2'};
function homeModuleGroup(id){return HOME_MODULE_GROUPS[id]||'fixed'}
function ensureHomeModules(){
  state.home=state.home&&typeof state.home==='object'?state.home:{};
  const known=HOME_MODULE_DEFS.map(m=>m.id);
  if(!Array.isArray(state.home.order)||!state.home.order.length)state.home.order=known.slice();
  state.home.order=state.home.order.filter(id=>known.includes(id));
  known.forEach(id=>{if(!state.home.order.includes(id))state.home.order.push(id)});
  state.home.visible=state.home.visible&&typeof state.home.visible==='object'?state.home.visible:{};
  known.forEach(id=>{if(state.home.visible[id]===undefined)state.home.visible[id]=true});
  return state.home;
}
/* Player Status locked permanent (2026-09-08, Aurelia's ruling): "Player
   widget = mandatory Home component. It cannot be hidden... That means
   we can safely move Help + Settings into the portrait popup with no
   fallback control needed." The standalone-Weather fallback path in
   renderHome()'s shell mapping (used when Player Status used to be
   hideable) is now permanently unreachable rather than removed outright
   — safe to leave, costs nothing, and keeps a rollback path if this
   lock is ever revisited. */
const HOME_MODULE_ALWAYS_VISIBLE=['playerStatus'];
/* Character Stats — Home Player HUD Rebuild handover (2026-09-13):
   Character Stats' own data (HP/Stamina/Focus/Damage/Defence) moved
   into the Player HUD itself (playerStatusHTML, v0.02.15/26), so the
   standalone widget no longer renders on Home at all — removed from
   HOME_MODULE_DEFS entirely (same precedent as the earlier Side Quests
   → Quest Pane migration: ensureHomeModules() auto-heals state.home.
   order/visible for a dropped id, no migration code needed). This is a
   render decision only — characterStatsHTML() and its CSS/assets stay
   intact and unreferenced for future redesign/Character-page use, per
   the handover's explicit "not destructive removal" instruction. */
function isHomeModuleVisible(id){if(HOME_MODULE_ALWAYS_VISIBLE.includes(id))return true;return ensureHomeModules().visible[id]!==false}
function toggleHomeModuleVisible(id){if(HOME_MODULE_ALWAYS_VISIBLE.includes(id))return;const h=ensureHomeModules();h.visible[id]=!isHomeModuleVisible(id);save();renderHome()}
function moveHomeModule(id,dir){
  const h=ensureHomeModules(),group=homeModuleGroup(id);
  if(group==='fixed')return;
  const groupIds=h.order.filter(x=>homeModuleGroup(x)===group),idx=groupIds.indexOf(id),swapWith=idx+dir;
  if(swapWith<0||swapWith>=groupIds.length)return;
  const otherId=groupIds[swapWith],ia=h.order.indexOf(id),ib=h.order.indexOf(otherId);
  [h.order[ia],h.order[ib]]=[h.order[ib],h.order[ia]];
  save();renderHome();
}

/* Refactored onto sharedScheduleItemsForDate (Phase 3B.3) — was
   previously kept independent of the global scheduleItems() specifically
   because that one ignored its date argument; now that both go through
   the same correctly-parameterized aggregator, there's no longer a
   reason for two separate implementations of the same logic. */
function homeScheduleItemsForDate(t=todayISO()){
  return sharedScheduleItemsForDate(t);
}
/* ---------- V3 Widget Geometry / Interaction Pass — Today's Schedule ----------
   ASTRA — Home V3 Widget Geometry / Interaction Pass (2026-09-07), §2.
   Compact schedule card: time + a small kind icon + title/subtitle + a
   status/accent tag + a chevron tap affordance (routes into the full
   Calendar, same destination the block's own header arrow already
   opens — Home stays a summary, Calendar remains the owner). No
   dedicated per-kind (quest/activity/task) icon set exists yet, so this
   reuses three already-approved Today icons that are the closest
   existing match for each kind rather than inventing new art — flagged
   as a temporary reuse, not a final icon decision, in the geometry
   report. Cards flow in a wrapping flex row (desktop: several cards per
   row when they fit; narrow: one per row) and the list grows vertically
   with however many items exist that day — no fixed height, no scroll. */
/* personalGrowth/mainQuest added Phase 3B.3 — same "temporary reuse, not
   a final icon decision" status as the original three; homeScheduleCardHTML's
   existing fallback (HOME_SCHEDULE_KIND_ICON[i.kind]||HOME_SCHEDULE_KIND_ICON.task)
   already handled an unmapped kind safely, so these are a data
   completeness fix, not a behavior dependency. */
const HOME_SCHEDULE_KIND_ICON={quest:'Home/V3/Widgets/HOMEV3_ICON_MAIN_QUEST.png',activity:'icons/navigation/NAV_TRAINING.png',task:'Home/V3/Widgets/HOMEV3_ICON_PRIORITIES.png',personalGrowth:'icons/navigation/NAV_GROWTH.png',mainQuest:'icons/navigation/NAV_ADVENTURES.png'};
/* Internal Component Normalization pass (Aurelia, 2026-09-11): schedule
   cards move onto the shared .hw-row material/sizing — .schedule-card
   and the kind-specific .tag colour classes stay (click wiring in
   bindHome is class-based on .schedule-card, and .home-todaygroup-
   calendar .tag.quest/task/activity's colour-coding is still wanted),
   just layered under the shared row look instead of the old bespoke one. */
function homeScheduleCardHTML(i){
  return `<div class="schedule-card schedule-card-${esc(i.kind)}${i.done?' done':''} hw-row">
    <span class="hw-row-time">${esc(i.time)}</span>
    <img class="hw-row-icon" src="${asset(HOME_SCHEDULE_KIND_ICON[i.kind]||HOME_SCHEDULE_KIND_ICON.task)}" alt="">
    <div class="hw-row-body"><span class="hw-row-title">${esc(i.title)}</span><small class="hw-row-sub">${esc(i.sub)}</small></div>
    <span class="hw-row-tag tag ${esc(i.kind)}">${i.done?'✓':esc(i.kind)}</span>
    <span class="hw-row-chevron" aria-hidden="true">›</span>
  </div>`;
}
function homeScheduleColumnHTML(date,emptyText){
  const items=homeScheduleItemsForDate(date);
  if(!items.length)return `<div class="empty">${esc(emptyText)}</div>`;
  return `<div class="hw-row-list">${items.map(homeScheduleCardHTML).join('')}</div>`;
}

/* Daily Challenge preview rotation — "Next Challenge" cycles which
   challenge definition is being VIEWED/previewed. The action buttons
   (Accept/Complete/Abandon) always operate on TODAY's real challenge
   regardless of what is being previewed — see challengePanelHTML. */
const DAILY_CHALLENGE_ICON='today/home_today_daily_challenge_identity_icon_v1.png';
let homeChallengeRotationIndex=null;
function homeChallengeTodayIndex(){const today=dailyChallenge();const i=DAILY_CHALLENGES.findIndex(c=>c.id===today.id);return i<0?0:i}
function homeChallengeViewed(){if(homeChallengeRotationIndex==null)homeChallengeRotationIndex=homeChallengeTodayIndex();return DAILY_CHALLENGES[homeChallengeRotationIndex]}
function homeChallengeRotate(){const len=DAILY_CHALLENGES.length;if(len<2)return;if(homeChallengeRotationIndex==null)homeChallengeRotationIndex=homeChallengeTodayIndex();homeChallengeRotationIndex=(homeChallengeRotationIndex+1)%len;renderHome()}

/* ---------- Today panel builders ---------- */
function homeTodayHeaderHTML(){
  const summary=todayStatusSummary();
  return `<div class="home-section-header-v2">
    <span></span>
    <span class="home-section-title">Today</span>
    <div class="home-section-controls"><span class="home-today-count">${summary.done} / ${summary.total} complete</span></div>
  </div>`;
}
const HOME_PANEL_ARROW='<span class="home-panel-arrow" aria-hidden="true">→</span>';
/* Main Quest + Priorities + Calendar share one grouped container per
   Lyra's Home Upgrade Handoff (3.3): "Today should feel like one coherent
   grouped system... do not over-box every child element if the main
   Today container can provide the visual grouping." Side Quests stays
   its own separate box with its own header and a larger icon.
   Home Baseline Correction item 3: the "Today" section header used to sit
   OUTSIDE this box, floating over the dark page background above a
   disconnected cream panel — the one thing actually missing was the
   header itself being part of the same surface, exactly like Resources'
   header already sits inside resource-section-frame. The header is now
   rendered as the first row of this same .home-panel, always present
   (so Home Settings stays reachable even if every child panel below it
   is toggled off) rather than living in a sibling element. */
function todayGroupPanelHTML(panels){
  const blocks=[];
  if(panels.calendar!==false)blocks.push(calendarBlockHTML());
  if(panels.priorities!==false)blocks.push(priorityBlockHTML());
  const inner=blocks.length?`<div class="home-panel-inner-divider"></div>${blocks.join('<div class="home-panel-inner-divider"></div>')}`:'';
  return `<section class="home-panel home-today-outer">${homeTodayHeaderHTML()}${inner}</section>`;
}
/* Quest Pane (2026-09-13, explicit direction): Main Quest moves out of
   Today into its own dedicated widget, with Side Quests moved under it
   — same grouped-container pattern Today already uses for Priorities/
   Calendar (one shared .home-panel shell, .home-panel-inner-divider
   between sub-blocks), not a new architecture. Today's own "X/Y
   complete" counter (todayStatusSummary/homeTodayHeaderHTML) is driven
   by the Daily Quest/Daily Challenge/Tasks/Activities system, not Main
   Quest, so it needed no change from this move. */
function questPaneHeaderHTML(){
  return `<div class="home-section-header-v2">
    <span></span>
    <span class="home-section-title">Quests</span>
    <div class="home-section-controls"></div>
  </div>`;
}
function questPaneHTML(panels){
  const blocks=[];
  if(panels.mainquest!==false)blocks.push(mainQuestBlockHTML());
  if(panels.quests!==false)blocks.push(sideQuestPanelHTML());
  const inner=blocks.length?`<div class="home-panel-inner-divider"></div>${blocks.join('<div class="home-panel-inner-divider"></div>')}`:'';
  return `<section class="home-panel home-quest-pane">${questPaneHeaderHTML()}${inner}</section>`;
}
/* ---------- Home internal redesign: Feature Module (Main Quest) ----------
   Aurelia ruling (2026-09-11): three-material internal language for Home
   widget contents — Parchment (information), Navy Inset (actions/
   progress), Gold+Icon (hierarchy/emphasis). Main Quest becomes the first
   "Feature Module" (styling in v0.02.18-home-feature-module.css): navy
   header, parchment body, CSS-drawn shield crest, title+primary action
   row, data-driven progress, muted metadata, lighter secondary actions.

   Mechanics check Aurelia asked for before restructuring the DOM: today's
   quest data (defaults().quest) has no "started"/activity-logged flag, so
   there's no honest way to distinguish a real "Not Started" state from
   "Active" — only Active / Completed / Empty are backed by real data.
   The fallback structure she specified for that case is used as-is:
   primary = Log Activity, secondary = Delay • Complete, all three kept
   as independent actions exactly like before, just re-weighted.

   Progress stays data-driven per her "must be dynamic, not structural"
   note: discrete nodes when q.progress.current/target exist and target
   is small enough to read as steps (<=8), a thin percentage bar for a
   larger target, or nothing at all when the quest carries no progress
   data — never a fixed node count baked into markup. */
function featureModuleProgressHTML(q){
  const p=q.progress&&typeof q.progress==='object'?q.progress:null;
  const current=p?.current??p?.value??q.progressCurrent;
  const target=p?.target??p?.max??p?.goal??q.progressTarget;
  if(current!=null&&target!=null&&Number(target)>0){
    const cur=Math.max(0,Number(current)),tgt=Math.max(1,Number(target));
    if(tgt<=8){
      const nodes=Array.from({length:tgt},(_,i)=>`<span class="feature-progress-node${i<cur?' filled':''}"></span>`).join('');
      return `<div class="feature-progress-nodes" role="progressbar" aria-valuemin="0" aria-valuemax="${tgt}" aria-valuenow="${Math.min(cur,tgt)}">${nodes}</div>`;
    }
    const pct=Math.max(0,Math.min(100,Math.round(cur/tgt*100)));
    return `<div class="feature-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" style="--p:${pct}"><i></i></div>`;
  }
  if(typeof q.progressText==='string'&&q.progressText.trim())return `<div class="feature-progress-text">${esc(q.progressText.trim())}</div>`;
  return '';
}
function mainQuestBlockHTML(){
  const q=state.quest,mainQuestTitle=sharedHomeItemTitle(q?.title,['Complete Today’s Main Quest','Complete Main Quest']);
  const locked=Boolean(mainQuestTitle)&&!q.rewarded;
  const questState=!mainQuestTitle?'empty':(q.rewarded?'completed':'active');
  const crestIcon=asset('Home/V3/Widgets/HOMEV3_ICON_MAIN_QUEST.png');
  /* Layout unified with Side Quests (explicit direction, 2026-09-13):
     same .home-panel-header(-lg) icon+title header, same .hw-row
     icon-left/body-right row shape for content instead of the old
     bespoke .feature-crest shield + .feature-content grid. "Find a
     Quest"/"Log Activity" stay .feature-action-primary (the estab-
     lished pill CTA family — Side Quests' own inline action is plain
     text because it's a secondary "browse more" link, not a primary
     CTA, so that specific difference is intentional, not a miss).
     #mainQuestBody keeps its id on the row div — bindHome()'s existing
     guarded click handler (skips nested-button clicks, navigates
     otherwise) needed no change. The old #openMainQuestIcon
     crest-button and its checkmark overlay are dropped: the icon is
     now a plain part of the same clickable row, matching how Side
     Quests' own row icon isn't separately interactive either, and
     "Completed" already reads via the status badge without needing a
     duplicate checkmark. */
  const header=`<div class="home-panel-header home-panel-header-lg"><img class="home-panel-icon" src="${crestIcon}" alt=""><span>Main Quest</span></div>`;
  if(questState==='empty'){
    return `<div class="home-todaygroup-block home-todaygroup-mainquest main-quest-module state-empty">
      ${header}
      <div class="hw-row">
        <img class="hw-row-icon" src="${crestIcon}" alt="">
        <div class="hw-row-body">
          <span class="hw-row-title muted">No Main Quest Set</span>
          <small class="hw-row-sub">Take on today's defining objective.</small>
        </div>
        <button type="button" class="feature-action-primary" id="editQuest">Find a Quest</button>
      </div>
    </div>`;
  }
  const questProgress=featureModuleProgressHTML(q);
  const metaBits=[q.duration,q.date?fmtDate(q.date):'',`+${q.rewardXP} XP`,q.lootBox?q.lootBox:`+${q.rewardGold} Gold`].filter(Boolean);
  return `<div class="home-todaygroup-block home-todaygroup-mainquest main-quest-module state-${questState}">
    ${header}
    <div class="hw-row" id="mainQuestBody">
      <img class="hw-row-icon" src="${crestIcon}" alt="">
      <div class="hw-row-body">
        <span class="hw-row-title">${esc(mainQuestTitle)}</span>
        ${q.description?`<small class="hw-row-sub">${esc(q.description)}</small>`:''}
        ${metaBits.length?`<div class="feature-meta">${metaBits.map(m=>`<span>${esc(m)}</span>`).join('')}</div>`:''}
        ${questProgress||(questState==='completed'?'<div class="feature-progress-text success">Quest complete</div>':'')}
      </div>
      ${questState==='completed'?'<span class="feature-status-badge">Completed</span>':`<button type="button" class="feature-action-primary" id="activityButton">Log Activity</button>`}
    </div>
    ${questState==='active'?'<div class="feature-actions-secondary"><button type="button" id="delayQuest">Delay</button><span aria-hidden="true">•</span><button type="button" id="questComplete">Complete</button></div>':''}
    ${locked?'<button type="button" class="feature-cancel-mini" id="cancelQuest">Cancel Main Quest</button>':''}
  </div>`;
}
/* Internal Component Normalization pass (Aurelia, 2026-09-11): Priorities
   moves off the old dark-scene .quest-title-link/.collapsed-hint classes
   (white text, sized for a navy background it no longer sits on) onto a
   real Standard Row — same icon/title/metadata/chevron shape and
   darker-parchment material as Calendar and Side Quests. Both click
   targets (header chevron + the row itself) still call the same openCal
   handler they always did — see bindHome — nothing about the mechanic
   changed, only the markup/classes generating it. */
function priorityBlockHTML(){
  const primaryTask=sharedPrimaryTask(),primaryTaskTitle=sharedHomeItemTitle(primaryTask?.text,['Complete Task']);
  return `<div class="home-todaygroup-block home-todaygroup-priority">
    <div class="home-panel-header"><img class="home-panel-icon" src="${asset('Home/V3/Widgets/HOMEV3_ICON_PRIORITIES.png')}" alt=""><span>To Do</span><button class="home-panel-open" id="openPrimaryTask" aria-label="Open Adventurer's Log">${HOME_PANEL_ARROW}</button></div>
    <button type="button" class="hw-row" id="openPrimaryTaskText">
      <img class="hw-row-icon" src="${asset('Home/V3/Widgets/HOMEV3_ICON_PRIORITIES.png')}" alt="">
      <div class="hw-row-body">
        <span class="hw-row-title${primaryTaskTitle?'':' muted'}">${primaryTaskTitle?esc(primaryTaskTitle):'No Active Task'}</span>
        ${primaryTaskTitle?`<small class="hw-row-sub">Priority: ${primaryTask.priority?'Top Priority':'Normal'} · Due ${fmtShort(primaryTask.date||todayISO())}</small>`:''}
      </div>
      <span class="hw-row-chevron" aria-hidden="true">›</span>
    </button>
  </div>`;
}
function calendarBlockHTML(){
  return `<div class="home-todaygroup-block home-todaygroup-calendar">
    <div class="home-panel-header"><img class="home-panel-icon" src="${asset('Home/V3/Widgets/HOMEV3_ICON_CALENDAR.png')}" alt=""><span>Calendar</span><button class="home-panel-open" id="openCalendar" aria-label="Open Tasks Calendar">${HOME_PANEL_ARROW}</button></div>
    <div class="today-v2-schedule-stack">
      <div class="today-v2-schedule-block"><div class="today-v2-schedule-col-label">Today</div>${homeScheduleColumnHTML(todayISO(),'Nothing scheduled today.')}</div>
      <div class="today-v2-schedule-block muted"><div class="today-v2-schedule-col-label">Tomorrow</div>${homeScheduleColumnHTML(addDays(todayISO(),1),'Nothing scheduled tomorrow yet.')}</div>
    </div>
  </div>`;
}
/* ---------- V3 Widget Geometry / Interaction Pass — Side Quests ----------
   ASTRA — Home V3 Widget Geometry / Interaction Pass (2026-09-07), §1.
   Compact quest-row pattern: icon + title/subtitle + a thin horizontal
   bar on the left, a circular progress ring on the right. Rows stack in
   a plain flex column with no fixed height, so the widget grows with the
   list instead of clipping/scrolling.
   Ring data model: reads q.progress.current/target when present (the
   same generic shape sharedQuestProgressText() already reads for Main
   Quest) so a future multi-step Side Quest ("3/5") lights the ring up
   correctly with zero further changes — but today's actual Side Quest
   data (state.sideQuests) is single-step/boolean only, and
   relevantSideQuests() only ever returns NOT-done quests to this list
   (a done quest is filtered out and simply disappears on the next
   render, via the existing [data-today-side] checkbox → renderHome()
   flow, unchanged here), so in practice every ring on Home currently
   reads "0/1" until the moment it's checked off. Multi-step rings are a
   real, tested code path (see homeSideQuestProgress), just not something
   the current data ever populates — flagged in the geometry report, not
   silently faked with placeholder numbers. */
function homeSideQuestProgress(q){
  const p=q.progress&&typeof q.progress==='object'?q.progress:null;
  const target=Math.max(1,Number(p?.target??p?.max??p?.goal??1));
  const current=Math.max(0,Math.min(target,Number(p?.current??p?.value??0)));
  return {current,target,percent:Math.round(current/target*100),label:`${current}/${target}`};
}
/* Internal Component Normalization pass (Aurelia, 2026-09-11): rows now
   sit on the shared .hw-row material (same darker-parchment well as
   every other Standard Row) instead of a transparent background, and
   the empty state moves onto a real Standard Row (icon + text +
   integrated action) instead of a flat line of text plus a full-width
   filled button — same row language whether the widget has content or
   not, per "give its empty/action row the same Standard Row language". */
function sideQuestPanelHTML(){
  const relevantSides=relevantSideQuests();
  const list=relevantSides.length
    ?relevantSides.slice(0,4).map(q=>{
      const pr=homeSideQuestProgress(q);
      return `<label class="side-quest-row hw-row">
        <input type="checkbox" class="today-v2-side-check" data-today-side="${q.id}">
        <img class="hw-row-icon" src="${asset('Home/V3/Widgets/HOMEV3_ICON_SIDE_QUEST.png')}" alt="">
        <div class="hw-row-body">
          <span class="hw-row-title">${esc(q.title)}</span>
          <small class="hw-row-sub">${esc(q.category||'Other')} · ${esc(q.difficulty||'Normal')} · +${q.xp||40} XP</small>
          <div class="side-quest-row-bar"><i style="width:${pr.percent}%"></i></div>
        </div>
        <div class="side-quest-ring" style="--p:${pr.percent}"><span>${esc(pr.label)}</span></div>
      </label>`;
    }).join('')
    :`<div class="hw-row">
        <img class="hw-row-icon" src="${asset('Home/V3/Widgets/HOMEV3_ICON_SIDE_QUEST.png')}" alt="">
        <span class="hw-row-title muted">No active Side Quests today.</span>
        <button type="button" class="feature-action-primary" id="findSideQuest">Find a Side Quest</button>
      </div>`;
  return `<div class="home-todaygroup-block home-todaygroup-sidequests">
    <div class="home-panel-header home-panel-header-lg"><img class="home-panel-icon" src="${asset('Home/V3/Widgets/HOMEV3_ICON_SIDE_QUEST.png')}" alt=""><span>Side Quests</span>${relevantSides.length?`<b class="home-panel-count">${relevantSides.length}</b>`:''}</div>
    <div class="hw-row-list">${list}</div>
  </div>`;
}
/* Daily Challenge layout (Home Baseline Correction, item 12) — identity
   icon + title on the left, a dedicated Tracker action on the right;
   actions live in a lower-right row ("Next Challenge" + the primary
   accept/complete action), Accept staying visually the stronger of the
   two.
   Item 13 fix: the action buttons used to be gated on `isToday` (only
   shown while previewing today's own challenge), so a single "Next
   Challenge" click during a session permanently hid Accept until a full
   page reload — reads exactly like "Accept only appears on the first
   challenge". Actions now always reflect TODAY's real challenge state
   regardless of what is being previewed; only the descriptive content
   (title/text/xp) changes while browsing. */
/* ---------- Daily Activities: consolidated launcher widget ----------
   ASTRA — Home Daily Activities Widget Change (2026-09-07). Daily Word,
   Daily Wisdom, Daily Challenge and Daily Puzzle used to render as four
   separate full-size Home panels (challengePanelHTML/wordPanelHTML/
   wisdomPanelHTML/puzzlePanelHTML, removed here) — each duplicating the
   full interaction UI for a feature that Home doesn't otherwise own.
   Home now only launches these: one compact icon-button grid opens one
   shared popup shell (openDailyActivityPopup) whose inner content swaps
   per feature. All feature logic (challenge accept/complete/abandon,
   word language rotation, puzzle scoring, wisdom selection) is the exact
   same functions as before, just now targeting the popup's modalRoot
   instead of a standalone Home panel — nothing about the underlying
   systems moved or duplicated, and there is no separate specialist PAGE
   for any of these four to deep-link to (they have always lived only in
   Home/these functions), so no "Open Full Page" action applies here —
   see ASTRA_CURRENT_STATE.md for that note.
   DAILY_ACTIVITY_DEFS is a plain data array specifically so up to four
   more buttons can be added later without touching dailyActivitiesPanelHTML
   or openDailyActivityPopup. */
let puzzleInlineStartedAt=null;
function puzzleInlineSubmit(){
  const item=BONUS_DEV[baseDaySeed()%BONUS_DEV.length];
  const key=`bonusDevelopment:${todayISO()}`;
  const input=modalRoot.querySelector('#puzzleInlineAnswer');
  const ans=String(input?.value||'').trim().toUpperCase();
  const ok=ans===String(item.answer).trim().toUpperCase();
  const ms=puzzleInlineStartedAt?Date.now()-puzzleInlineStartedAt:0;
  state.bonusDevelopment=state.bonusDevelopment||{history:[]};
  state.bonusDevelopment.history=Array.isArray(state.bonusDevelopment.history)?state.bonusDevelopment.history:[];
  state.bonusDevelopment.history.push({date:todayISO(),type:item.type,success:ok,ms});
  state.bonusDevelopment.history=state.bonusDevelopment.history.slice(-100);
  if(ok){
    const rewarded=grantProtectedReward(key,{xp:10,label:'TRIAL OF WISDOM'});
    save();
    if(rewarded)showSystemReward({xp:10,label:'TRIAL OF WISDOM'});
    openDailyActivityPopup('puzzle');
  }else{
    save();
    const result=modalRoot.querySelector('#puzzleInlineResult');
    if(result)result.innerHTML='<p class="trial-error">Not quite. Try again.</p>';
  }
}
function dailyActivityBodyWord(){
  const lang=activeWordLanguage(),langs=ensureWordLanguages(),w=wordOfDay();
  const rotate=langs.length>1?`<button type="button" class="rpg-btn" id="popupWordRotateBtn">⟳ Next Language</button>`:'';
  return {subtitle:WORD_LANGS[lang]||WORD_LANGS.no,html:`<div class="word-detail"><p class="word">${esc(w[0])}</p><p class="translation">${esc(w[1])}</p><p class="definition">${esc(w[2])}</p><p class="example"><b>Example:</b> ${esc(w[3])}</p><p class="example-translation"><b>English:</b> ${esc(englishExample(w,lang))}</p></div><div class="daily-activity-popup-controls">${rotate}<button type="button" class="rpg-btn" id="popupWordLanguageSettingsBtn">Languages…</button></div>`};
}
function dailyActivityBodyWisdom(){
  const wisdom=dailyWisdom();
  return {subtitle:wisdom.type,html:`<p class="wisdom-text">${esc(wisdom.text)}</p>`};
}
function dailyActivityBodyChallenge(){
  const today=dailyChallenge(),cs=challengeState(),locked=dailyChallengeLocked(),status=locked?'COMPLETE':cs.status;
  const viewed=homeChallengeViewed(),isToday=viewed.id===today.id;
  let action='';
  if(status==='AVAILABLE')action=`<button class="rpg-btn accent challenge-action" id="popupAcceptChallenge">ACCEPT CHALLENGE</button>`;
  else if(status==='ACTIVE')action=`<div class="challenge-actions"><button class="rpg-btn accent" id="popupCompleteChallenge">Complete</button><button class="text-btn danger" id="popupAbandonChallenge">Abandon</button></div>`;
  else action=`<button class="rpg-btn" disabled>${status==='COMPLETE'?'Completed ✓':status}</button>`;
  const durationNote=viewed.durationMin?`Minimum duration: ${viewed.durationMin} minutes · elapsed time verified, activity honor-based.`:viewed.verification==='steps'?'Progress verified using the app’s tracked Steps value.':'Completion is honor-based.';
  const nextBtn=DAILY_CHALLENGES.length>1?`<button type="button" class="rpg-btn challenge-next-btn" id="popupChallengeRotationBtn">Next Challenge</button>`:'';
  return {subtitle:`${viewed.category}${isToday?` · ${status}`:' · PREVIEW'}`,html:`<div class="challenge-content challenge-content-v2"><img class="challenge-category-icon-lg" src="${asset(DAILY_CHALLENGE_ICON)}" alt=""><div class="challenge-content-copy"><h3>${esc(viewed.title)}</h3><p>${esc(viewed.text)}</p><small>${esc(durationNote)}</small><strong>+${viewed.xp} XP · Minor Loot Box</strong>${!isToday?`<div class="today-v2-rotation-note">Previewing "${esc(viewed.title)}" — the action below still applies to today’s active challenge, "${esc(today.title)}".</div>`:''}</div></div><div class="daily-activity-popup-controls">${nextBtn}${action}<button type="button" class="rpg-btn" id="popupChallengeTrackerBtn">Tracker</button></div>`};
}
function dailyActivityBodyPuzzle(){
  const item=BONUS_DEV[baseDaySeed()%BONUS_DEV.length];
  const key=`bonusDevelopment:${todayISO()}`,claimed=Boolean(state.rewardLocks[key]);
  if(!puzzleInlineStartedAt)puzzleInlineStartedAt=Date.now();
  return {subtitle:item.type,html:`<p class="puzzle-inline-prompt">${esc(item.text)}</p>${claimed?'<div class="trial-result success"><b>Solved today ✓</b></div>':`<div class="puzzle-inline-row"><input id="puzzleInlineAnswer" autocomplete="off" placeholder="Your answer"><button class="rpg-btn accent" id="puzzleInlineSubmit">Submit</button></div><div id="puzzleInlineResult"></div>`}<div class="daily-activity-popup-controls"><button type="button" class="rpg-btn" id="popupDevelopmentArchiveBtn">Archive</button></div>`};
}
function bindDailyActivityWordPopup(){
  const rotate=modalRoot.querySelector('#popupWordRotateBtn');if(rotate)rotate.onclick=()=>{rotateWordLanguage();openDailyActivityPopup('word')};
  const settings=modalRoot.querySelector('#popupWordLanguageSettingsBtn');if(settings)settings.onclick=dailyWordLanguageModal;
}
function bindDailyActivityChallengePopup(){
  const rotate=modalRoot.querySelector('#popupChallengeRotationBtn');if(rotate)rotate.onclick=()=>{homeChallengeRotate();openDailyActivityPopup('challenge')};
  const accept=modalRoot.querySelector('#popupAcceptChallenge');if(accept)accept.onclick=()=>{acceptDailyChallenge();openDailyActivityPopup('challenge')};
  const complete=modalRoot.querySelector('#popupCompleteChallenge');if(complete)complete.onclick=()=>{completeDailyChallenge();openDailyActivityPopup('challenge')};
  const abandon=modalRoot.querySelector('#popupAbandonChallenge');if(abandon)abandon.onclick=()=>{recordChallengeFailure('abandoned');openDailyActivityPopup('challenge')};
  const tracker=modalRoot.querySelector('#popupChallengeTrackerBtn');if(tracker)tracker.onclick=challengeTrackerModal;
}
function bindDailyActivityPuzzlePopup(){
  const submit=modalRoot.querySelector('#puzzleInlineSubmit');if(submit)submit.onclick=puzzleInlineSubmit;
  const archive=modalRoot.querySelector('#popupDevelopmentArchiveBtn');if(archive)archive.onclick=developmentArchiveModal;
}
const DAILY_ACTIVITY_DEFS=[
  {id:'word',label:'Daily Word',icon:'Home/V3/Widgets/HOMEV3_ICON_DAILY_WORD.png',body:dailyActivityBodyWord,bind:bindDailyActivityWordPopup},
  {id:'wisdom',label:'Daily Wisdom',icon:'Home/V3/Widgets/HOMEV3_ICON_DAILY_WISDOM.png',body:dailyActivityBodyWisdom,bind:null},
  {id:'challenge',label:'Daily Challenge',icon:'Home/V3/Widgets/HOMEV3_ICON_DAILY_CHALLENGE.png',body:dailyActivityBodyChallenge,bind:bindDailyActivityChallengePopup},
  {id:'puzzle',label:'Daily Puzzle',icon:'Home/V3/Widgets/HOMEV3_ICON_DAILY_PUZZLE.png',body:dailyActivityBodyPuzzle,bind:bindDailyActivityPuzzlePopup}
];
function openDailyActivityPopup(id){
  const def=DAILY_ACTIVITY_DEFS.find(x=>x.id===id);if(!def)return;
  const{subtitle,html}=def.body();
  modal(`<div class="daily-activity-popup">
    <div class="daily-activity-popup-head"><img src="${asset(def.icon)}" alt=""><div><span>${esc(def.label)}</span>${subtitle?`<small>${esc(subtitle)}</small>`:''}</div></div>
    <div class="daily-activity-popup-body">${html}</div>
  </div>`);
  if(def.bind)def.bind();
}
function dailyActivitiesPanelHTML(){
  const buttons=DAILY_ACTIVITY_DEFS.map(def=>`<button type="button" class="daily-activity-btn" data-daily-activity="${def.id}"><img src="${asset(def.icon)}" alt=""><span>${esc(def.label)}</span></button>`).join('');
  return `<section class="home-panel home-panel-daily-activities">
    <div class="home-panel-header"><img class="home-panel-icon" src="${asset('Home/V3/Widgets/HOMEV3_ICON_DAILY_ACTIVITIES.png')}" alt=""><span>Daily Activities</span></div>
    <div class="daily-activities-grid">${buttons}</div>
  </section>`;
}

/* Home v2 scenic environment (Home v2 Fidelity Rebuild, §4/§18): four
   approved backgrounds — Day/Sunset/Night/Rain — selected by time of
   day, with Rain overriding on a matching live weather condition.
   Purely a background-image swap (see .home-env-* rules in
   v0.02.12-home-modules.css); it never touches module layout/DOM. */
function homeEnvironmentKey(){
  const condition=String(currentWeatherView().condition||'');
  if(/Rain|Thunder|Sleet/i.test(condition))return 'rain';
  const hour=new Date().getHours();
  if(hour>=6&&hour<17)return 'day';
  if(hour>=17&&hour<20)return 'sunset';
  return 'night';
}
/* Help/Settings — deliberately independent of Player Status (2026-09-07,
   user report): these used to live inside playerStatusHTML()'s own
   markup, so hiding the Player Status module via Home Settings removed
   the only way to reach Help/Settings from Home directly — the sole
   remaining path was navigating away to Character's Profile & Setup
   section. Rendered here instead, at the top of every Home render
   regardless of which modules are visible, so Help/Settings always
   stay reachable from Home itself. Same #helpButton/#settingsButton
   ids as before — bindHome()'s existing guarded lookups pick them up
   wherever they render, no binding changes needed. */
function homeToolsHTML(){
  /* EXPERIMENT B follow-up (2026-09-08, Aurelia's ruling): Player Status
     is now permanently locked visible (HOME_MODULE_ALWAYS_VISIBLE), so
     the whole reason this bar had to be structurally independent of
     playerStatusHTML() no longer applies — "we can safely move Help +
     Settings into the portrait popup with no fallback control needed."
     Suppressed entirely here; both buttons are rendered inside
     v0215ProgressPopupHTML() instead (see the JS file), reusing the
     same #helpButton/#settingsButton ids so bindHome()'s existing
     guarded lookups still pick them up wherever they render.
     Easy revert: this early-return is the only thing suppressing it —
     remove it (or the whole experiment) to restore the independent bar. */
  if(typeof HOME_HERO_EXPERIMENT_B!=='undefined'&&HOME_HERO_EXPERIMENT_B)return'';
  return `<div class="home-tools-bar">
    <button class="home-tool-btn" id="helpButton" aria-label="Help"><img src="${asset('icons/home-utility/ICON_HOME_HELP.png')}" alt=""></button>
    <button class="home-tool-btn" id="settingsButton" aria-label="Settings"><img src="${asset('icons/home-utility/ICON_HOME_SETTINGS.png')}" alt=""></button>
  </div>`;
}
function renderHome(){
  const d=state.daily,p=state.profile,panels=ensureHomePanels();
  const h=ensureHomeModules();
  applyHomeBackgroundClass();
  /* Aurelia's Home Hero direction lock (2026-09-07): Weather floats as a
     compact card INSIDE the same scenic Player Status composition rather
     than rendering as its own separate shell-group section — so when
     both are visible, playerStatusHTML() itself absorbs Weather's card
     (via v0215HeroWeatherCardHTML(), gated on isHomeModuleVisible('weather')
     internally) and this mapping contributes '' for 'weather' to avoid
     rendering it twice. If Player Status is hidden, Weather still needs
     to render on its own (there's no hero scene for it to float inside),
     so the original standalone section is kept as the fallback. */
  const shellParts=h.order.filter(id=>homeModuleGroup(id)==='shell'&&isHomeModuleVisible(id)).map(id=>{
    if(id==='playerStatus')return playerStatusHTML();
    if(id==='weather'){
      if(isHomeModuleVisible('playerStatus'))return'';
      return `<section class="weather-panel">${renderWeatherHTML()}</section>`;
    }
    return '';
  }).filter(Boolean);
  const shellHTML=shellParts.join('');
  const shellCount=shellParts.length;
  const blocks=[];
  h.order.filter(id=>homeModuleGroup(id)==='stack2').forEach(id=>{
    if(!isHomeModuleVisible(id))return;
    if(id==='dailyActivities')blocks.push(dailyActivitiesPanelHTML());
    else if(id==='movement')blocks.push(movementPanelHTML());
  });
  const showToday=isHomeModuleVisible('today'),showResources=isHomeModuleVisible('resources'),showQuestPane=isHomeModuleVisible('questPane');
  view.innerHTML=`
    ${homeToolsHTML()}
    <header class="home-top-panel rpg-frame standard${shellCount===1?' home-top-panel-solo':''}">
      ${shellHTML}
    </header>

    ${showQuestPane?questPaneHTML(panels):''}

    ${showToday?todayGroupPanelHTML(panels):''}
    ${blocks.length?`<div class="home-today-divider"></div><div class="home-today-stack">${blocks.join('<div class="home-today-divider"></div>')}</div>`:''}

    ${showResources?(homeResourcesOpen?`<section class="rpg-frame standard matched-section-frame resource-section-frame">${resourcesHeaderHTML()}<div class="resource-vertical-list resource-grid-v3">${resourceCard('Home/V3/Resources/home-v3-resource-water-2x.png','Water',`${Math.round(d.water)} / ${p.waterTarget} ml`,{value:d.water,target:p.waterTarget},'water','','positive')}${resourceCalories(d,p)}${resourceCard('Home/V3/Resources/home-v3-resource-sleep-2x.png','Sleep',`${Number(d.sleep).toFixed(1)} / ${p.sleepTarget} h`,{value:d.sleep,target:p.sleepTarget},'sleep')}${resourceMind(d,p)}${resourceProtein(d,p)}${resourceCard('Home/V3/Resources/home-v3-resource-social-2x.png','Social',`${Math.round(d.socialMinutes||0)} / ${Math.round(p.socialMinutesTarget||30)}m`,{value:d.socialMinutes||0,target:p.socialMinutesTarget||30},'social','','positive')}</div></section>`:resourcesHeaderHTML()):''}

    <div class="version">v${VERSION} · Navigation + Home integration</div>`;
  bindHome();refreshWeather();
}
function bindHome(){
  const helpBtn=document.querySelector('#helpButton'),settingsBtn=document.querySelector('#settingsButton');if(helpBtn)helpBtn.onclick=helpModal;if(settingsBtn)settingsBtn.onclick=()=>profileModal('profile');bindWeatherForecastTrigger();
  const openMovement=document.querySelector('#openMovementPopup');if(openMovement)openMovement.onclick=()=>movementModal('overview');
  const edit=document.querySelector('#editQuest');if(edit)edit.onclick=e=>{e.stopPropagation();editQuestModal()};
  const body=document.querySelector('#mainQuestBody');if(body)body.onclick=e=>{if(e.target.closest('button,[role="button"]'))return;setPage('quests')};
  const complete=document.querySelector('#questComplete'),delay=document.querySelector('#delayQuest'),activity=document.querySelector('#activityButton'),cancelQuest=document.querySelector('#cancelQuest');if(complete)complete.onclick=()=>completeMainQuest();if(delay)delay.onclick=delayModal;if(activity)activity.onclick=()=>activityModal('add');if(cancelQuest)cancelQuest.onclick=cancelMainQuestModal;
  document.querySelectorAll('[data-today-side]').forEach(cb=>{cb.onchange=()=>{const q=state.sideQuests.find(x=>x.id===Number(cb.dataset.todaySide));if(!q)return;setCustomSideCompletion(q,cb.checked);save();renderHome()}});
  const findSide=document.querySelector('#findSideQuest');if(findSide)findSide.onclick=()=>setPage('quests');
  const openCal=()=>{taskView='week';setPage('adventurers-log')};const openCalBtn=document.querySelector('#openCalendar');if(openCalBtn)openCalBtn.onclick=openCal;const openPT=document.querySelector('#openPrimaryTask'),openPTText=document.querySelector('#openPrimaryTaskText');if(openPT)openPT.onclick=openCal;if(openPTText)openPTText.onclick=openCal;
  document.querySelectorAll('.schedule-card').forEach(el=>{el.onclick=openCal});
  document.querySelectorAll('[data-daily-activity]').forEach(b=>{b.onclick=()=>openDailyActivityPopup(b.dataset.dailyActivity)});
  document.querySelectorAll('[data-resource]').forEach(b=>b.onclick=()=>resourceModal(b.dataset.resource));
  const history=document.querySelector('#resourceHistoryButton'),tracker=document.querySelector('#resourceTrackerButton'),toggleResources=document.querySelector('#toggleResourcesSection');if(history)history.onclick=resourceHistoryModal;if(tracker)tracker.onclick=resourceTrackerModal;if(toggleResources)toggleResources.onclick=()=>{homeResourcesOpen=!homeResourcesOpen;renderHome()};
  document.querySelectorAll('[data-open-character]').forEach(el=>el.onclick=()=>setPage('character'));
  document.querySelectorAll('[data-open-progress-popup]').forEach(el=>{el.onclick=()=>{if(typeof v0215OpenProgressPopup==='function')v0215OpenProgressPopup()}});
}
/* Main Quest completion (Home Baseline Correction, items 20-23):
   - Refuses to award anything when no real quest exists (item 20) — this
     is the handler-level guard the UI's disabled state alone cannot
     substitute for, since UI can always be bypassed.
   - Rewards are permanently protected by the quest's own id via
     grantProtectedReward/state.rewardLocks (item 22), not by the
     transient state.daily.questDone flag alone — immune to reload,
     midnight resets and (now that dailyReset no longer silently reissues
     a completed quest under a new id) id recreation.
   - Completing before the scheduled date requires an explicit reason,
     routed through earlyCompleteQuestModal (item 21).
   - Every completion is logged to questHistory and to the integrity
     tracker (item 23); applyIntegrityAdjustedXP is the reserved hook for
     an eventual (not yet approved) diminishing-returns curve. */
function completeMainQuest(reason){
  const q=state.quest,title=sharedHomeItemTitle(q.title,['Complete Today’s Main Quest','Complete Main Quest']);
  if(!title){toast('No Main Quest to complete.');return}
  if(q.rewarded||state.daily.questDone){toast('Main Quest already completed.');return}
  const isEarly=String(q.date)>todayISO();
  if(isEarly&&typeof reason!=='string'){earlyCompleteQuestModal();return}
  const lockKey=rewardLockKey('mainQuest',q.id);
  if(state.rewardLocks[lockKey]){toast('Main Quest reward already protected.');q.rewarded=true;save();return}
  const awardedXP=applyIntegrityAdjustedXP(Number(q.rewardXP||0),'mainQuest');
  const granted=grantProtectedReward(lockKey,{xp:awardedXP,label:'MAIN QUEST COMPLETE',stats:{wis:15},detail:q.lootBox||`+${q.rewardGold} Gold`});
  if(!granted){toast('Main Quest reward already protected.');return}
  state.daily.questDone=true;q.rewarded=true;q.completedDate=todayISO();updateQuestStreak(q.completedDate);state.gold+=Number(q.rewardGold||0);state.totals.questsCompleted+=1;
  state.questHistory=Array.isArray(state.questHistory)?state.questHistory:[];
  state.questHistory.push({date:todayISO(),questId:q.id,title,type:isEarly?'completed-early':'completed',reason:isEarly?reason:undefined,xp:awardedXP,gold:Number(q.rewardGold||0)});
  state.questHistory=state.questHistory.slice(-200);
  recordQuestIntegrityEvent(isEarly?'completed-early':'completed',q,{reason:isEarly?reason:undefined});
  save();homeActionOpen=null;renderHome();
}
function awardActivity(a){
  if(a.xpAwarded)return null;a.xpAwarded=true;const appliedXp=addOverallXP(75);logXpGain(appliedXp,a.name||a.type||'Training','Training');let stats={};
  if(/run/i.test(a.type)){addStatXP('dex',20);addStatXP('con',15);stats={dex:20,con:15}}else if(/gym|strength/i.test(a.type)){addStatXP('str',25);stats={str:25}}else if(/walk|hike/i.test(a.type)){addStatXP('con',8);stats={con:8}}else if(/cycl/i.test(a.type)){addStatXP('con',12);addStatXP('dex',8);stats={con:12,dex:8}}else if(/mobility|recover/i.test(a.type)){addStatXP('dex',8);addStatXP('wis',4);stats={dex:8,wis:4}}else{addStatXP('con',5);stats={con:5}}processTrainingCompletion(a);return {xp:75,stats};
}
function toggleActivity(id){const a=state.activities.find(x=>x.id===id);if(!a)return;a.completed=!a.completed;let reward=null;if(a.completed)reward=awardActivity(a);save();if(reward)showSystemReward({xp:reward.xp,label:'TRAINING COMPLETE',stats:reward.stats,detail:a.name});render()}
function completeQuick(key){const q=QUICK_QUESTS[key];if(!q)return;const lock=rewardLockKey('quickSideQuest',key);if(state.rewardLocks&&state.rewardLocks[lock]){toast(`${q.title} already rewarded today.`);return}state.sideQuestHistory.push({id:uid(),date:todayISO(),quickKey:key,title:q.title,category:q.category,xp:q.xp});if(!grantProtectedReward(lock,{xp:q.xp,label:'SIDE QUEST COMPLETE',stats:{[q.stat]:q.statXp},detail:q.title})){state.sideQuestHistory.pop();toast(`${q.title} already rewarded today.`);return}save();renderSideQuests()}
function setCustomSideCompletion(q,checked){if(!q)return false;if(checked&&!q.done){q.done=true;q.completedDate=q.completedDate||todayISO();if(!q.xpAwarded){q.xpAwarded=true;state.sideQuestHistory.push({id:uid(),sourceId:q.id,date:q.completedDate,title:q.title,category:q.category||'Other',xp:q.xp||40});const appliedXp=addOverallXP(q.xp||40);logXpGain(appliedXp,q.title||'Side Quest','Side Quest');addStatXP(q.stat||'wis',q.statXp||5);showSystemReward({xp:q.xp||40,label:'SIDE QUEST COMPLETE',stats:{[q.stat||'wis']:q.statXp||5},detail:q.title});return true}}else if(!checked)q.done=false;return false}
const MINDFULNESS_ACTIVITIES=[
  {key:'mindfulness',label:'Mindfulness'},
  {key:'reading',label:'Reading'},
  {key:'writing',label:'Writing'},
  {key:'puzzles',label:'Puzzles'},
  {key:'walk',label:'Went for a walk'}
];
/* Technical Hydration fluid-source logging (ASTRA handover from Nox,
   8 September 2026). Approved rule: 1 ml of any listed non-alcoholic
   fluid = 1 ml hydration credit, no physiological weighting. */
const HYDRATION_FLUID_TYPES=[
  {key:'water',label:'Water'},
  {key:'coffee',label:'Coffee'},
  {key:'tea',label:'Tea'},
  {key:'milk',label:'Milk'},
  {key:'juice',label:'Juice'},
  {key:'sports',label:'Sports Drink'},
  {key:'energy',label:'Energy Drink'},
  {key:'soda',label:'Soft Drink / Soda'},
  {key:'soup',label:'Soup / Broth'},
  {key:'smoothie',label:'Smoothie'},
  {key:'other',label:'Other Drink'}
];
const HYDRATION_QUICK_AMOUNTS=[250,330,500,750,1000];
function hydrationFluidLabel(key){return HYDRATION_FLUID_TYPES.find(t=>t.key===key)?.label||'Water'}
function hydrationLogTotals(log){
  const entries=Array.isArray(log)?log:[];
  let plainWaterMl=0,nonWaterMl=0,coffeePresent=false;const nonWaterTypes=new Set();
  entries.forEach(e=>{
    const amt=Math.max(0,Number(e?.amountMl||0));
    if(!amt)return;
    if(e.type==='water')plainWaterMl+=amt;
    else{nonWaterMl+=amt;nonWaterTypes.add(e.type);if(e.type==='coffee')coffeePresent=true}
  });
  return {totalMl:plainWaterMl+nonWaterMl,plainWaterMl,nonWaterMl,nonWaterTypesCount:nonWaterTypes.size,coffeePresent};
}
function resourceModal(key){
  const d=state.daily,p=state.profile;
  const resetControl=label=>`<div class="resource-reset-zone"><button class="text-btn danger resource-reset" id="resetResourceToday">Reset Today</button><small>Clears today's ${label} entry only. Protected progression stays locked.</small></div>`;
  const bindReset=(label,clear)=>{const b=modalRoot.querySelector('#resetResourceToday');if(!b)return;b.onclick=()=>{if(!confirm(`Reset today's ${label}? This clears the current entry but does not reset XP/stat high-water protection.`))return;clear();save();closeModal();toast(`${label} reset for today.`);renderHome()}};
  const current=(label,value,target,unit='')=>`<div class="resource-entry-current"><span>${label}</span><b>${value}${unit}${target!==undefined?` / ${target}${unit}`:''}</b></div>`;
  const adjust=(label,inputId,value,unit='',step='1')=>`<details class="resource-adjust"><summary>Adjust today's total</summary><p class="helper">Use this only to correct today's recorded total.</p><div class="form-row"><label>${label}</label><input id="${inputId}" type="number" inputmode="decimal" step="${step}" min="0" value="${value}"></div><button class="text-btn accent resource-adjust-save" data-adjust-save="${inputId}">Save corrected total</button></details>`;
  const finish=()=>{save();closeModal();renderHome()};
  if(key==='water'){
    d.hydrationLog=Array.isArray(d.hydrationLog)?d.hydrationLog:[];
    const totals=hydrationLogTotals(d.hydrationLog);
    state.hydration=state.hydration&&typeof state.hydration==='object'?state.hydration:{};
    const recentTypes=(Array.isArray(state.hydration.recentTypes)?state.hydration.recentTypes:[]).filter(t=>t!=='water');
    let selectedType=recentTypes[0]||'water';
    const compositionLine=totals.nonWaterMl>0?`<p class="hydration-composition helper">${Math.round(totals.plainWaterMl)} ml water · ${Math.round(totals.nonWaterMl)} ml other (${totals.nonWaterTypesCount} type${totals.nonWaterTypesCount===1?'':'s'})</p>`:'';
    const typeBtn=(t,extraClass='')=>`<button type="button" class="hydration-type-btn ${extraClass} ${t.key===selectedType?'active':''}" data-fluid-type="${t.key}">${esc(t.label)}</button>`;
    const recentRow=recentTypes.length?`<div class="hydration-recent-row">${recentTypes.slice(0,4).map(k=>typeBtn({key:k,label:hydrationFluidLabel(k)},'recent')).join('')}</div>`:'';
    modal(`<div class="resource-entry"><h2>Water</h2>${current('Today',Math.round(d.water),p.waterTarget,' ml')}${compositionLine}<p class="resource-entry-label">FLUID TYPE</p>${recentRow}<div class="hydration-type-grid">${HYDRATION_FLUID_TYPES.map(t=>typeBtn(t)).join('')}</div><p class="resource-entry-label">LOG PROGRESS</p><div class="resource-quick-grid">${HYDRATION_QUICK_AMOUNTS.map(a=>`<button class="rpg-btn small" data-water-add="${a}">+${a} ml</button>`).join('')}</div><div class="resource-custom-row"><div class="form-row"><label>Custom amount</label><input id="waterCustom" type="number" inputmode="numeric" min="0" placeholder="350"></div><button class="rpg-btn accent" id="waterCustomAdd">Add</button></div>${adjust('Water today','waterSet',Math.round(d.water),' ml')}${resetControl('Water')}`);
    modalRoot.querySelectorAll('[data-fluid-type]').forEach(b=>b.onclick=()=>{selectedType=b.dataset.fluidType;modalRoot.querySelectorAll('[data-fluid-type]').forEach(x=>x.classList.toggle('active',x.dataset.fluidType===selectedType))});
    const logEntry=amount=>{
      const amt=Math.max(0,Number(amount||0));
      if(!amt)return;
      /* A day can already carry a water total with no log entries behind
         it — a save from before this feature existed, or today's own
         "Adjust today's total" correction. Seed that amount as a plain-
         water entry (approved migration rule) before adding the new
         entry, or it would silently vanish from the derived total. */
      if(!d.hydrationLog.length&&Number(d.water||0)>0)d.hydrationLog.push({type:'water',amountMl:Number(d.water),ts:Date.now()});
      d.hydrationLog.push({type:selectedType,amountMl:amt,ts:Date.now()});
      d.water=hydrationLogTotals(d.hydrationLog).totalMl;
      creditResourceProgress('water',d.water);
      if(selectedType!=='water')state.hydration.recentTypes=[selectedType,...recentTypes.filter(t=>t!==selectedType)].slice(0,4);
      finish();
    };
    modalRoot.querySelectorAll('[data-water-add]').forEach(b=>b.onclick=()=>logEntry(b.dataset.waterAdd));
    modalRoot.querySelector('#waterCustomAdd').onclick=()=>logEntry(modalRoot.querySelector('#waterCustom').value);
    modalRoot.querySelector('[data-adjust-save="waterSet"]').onclick=()=>{const after=Math.max(0,Number(modalRoot.querySelector('#waterSet').value||0));d.hydrationLog=after>0?[{type:'water',amountMl:after,ts:Date.now()}]:[];creditResourceProgress('water',after);d.water=after;finish()};
    bindReset('Water',()=>{d.water=0;d.hydrationLog=[];state.hydration=state.hydration&&typeof state.hydration==='object'?state.hydration:{};state.hydration.manualResetCount=Number(state.hydration.manualResetCount||0)+1});
    return;
  }
  if(key==='food'){
    const low=Math.round(p.calTarget*.95),high=Math.round(p.calTarget*1.05);
    modal(`<div class="resource-entry"><h2>Food</h2><div class="resource-current-stack">${current('Calories',Math.round(d.calories),Math.round(p.calTarget),'')}${current('Protein',Math.round(d.protein),Math.round(p.proteinTarget),' g')}</div><p class="helper">Calorie target zone ${low}–${high}. Protein fills toward its minimum target.</p><p class="resource-entry-label">ADD FOOD</p><div class="two-col resource-food-fields"><div class="form-row"><label>Calories</label><input id="calAdd" type="number" inputmode="numeric" min="0" placeholder="450"></div><div class="form-row"><label>Protein (g)</label><input id="proteinAdd" type="number" inputmode="numeric" min="0" placeholder="35"></div></div><button class="rpg-btn accent resource-primary" id="saveFood">Add Food</button><details class="resource-adjust"><summary>Adjust today's totals</summary><p class="helper">Use this only to correct today's recorded totals.</p><div class="two-col"><div class="form-row"><label>Calories today</label><input id="calSet" type="number" inputmode="numeric" min="0" value="${d.calories}"></div><div class="form-row"><label>Protein today</label><input id="proteinSet" type="number" inputmode="numeric" min="0" value="${d.protein}"></div></div><button class="text-btn accent" id="setFood">Save corrected totals</button></details>${resetControl('Food')}</div>`);
    modalRoot.querySelector('#saveFood').onclick=()=>{d.calories=Math.max(0,Number(d.calories||0)+Number(modalRoot.querySelector('#calAdd').value||0));d.protein=Math.max(0,Number(d.protein||0)+Number(modalRoot.querySelector('#proteinAdd').value||0));finish()};
    modalRoot.querySelector('#setFood').onclick=()=>{d.calories=Math.max(0,Number(modalRoot.querySelector('#calSet').value||0));d.protein=Math.max(0,Number(modalRoot.querySelector('#proteinSet').value||0));finish()};bindReset('Food',()=>{d.calories=0;d.protein=0});return;
  }
  if(key==='sleep'){
    /* Sleep reason/quality flow (Home Baseline Correction item 6). No
       prior implementation of this exists anywhere in this repo's history
       — a "Sleep reason-code popup" was explicitly deferred (never built)
       in an earlier session's own commit notes, so this is new work, not
       a restore of removed code. Only the concepts named directly in the
       correction brief are implemented: selectable reason(s) for missing
       the target (Children Interruption / Other with free text), a
       medication-used toggle, and a separate Sleep Quality selector using
       the same positive/neutral/negative style pattern used elsewhere in
       this app (e.g. running conditions' good/mixed/poor). */
    const hours=Math.floor(Number(d.sleep||0)),minutes=Math.round((Number(d.sleep||0)-hours)*60);
    const quality=d.sleepQuality||'';
    const reasons=Array.isArray(d.sleepReasons)?d.sleepReasons:[];
    const qualityBtn=(val,label)=>`<button type="button" class="sleep-quality-btn ${val} ${quality===val?'active':''}" data-sleep-quality="${val}">${label}</button>`;
    modal(`<div class="resource-entry"><h2>Sleep</h2>${current('Last night',Number(d.sleep||0).toFixed(1),p.sleepTarget,' h')}<p class="resource-entry-label">LOG LAST NIGHT'S SLEEP</p><div class="two-col"><div class="form-row"><label>Hours</label><input id="sleepHours" type="number" inputmode="numeric" min="0" max="24" value="${hours}"></div><div class="form-row"><label>Minutes</label><input id="sleepMinutes" type="number" inputmode="numeric" min="0" max="59" value="${minutes}"></div></div>
    <p class="resource-entry-label">SLEEP QUALITY</p>
    <div class="sleep-quality-row">${qualityBtn('positive','Good')}${qualityBtn('neutral','Mixed')}${qualityBtn('negative','Poor')}</div>
    <p class="resource-entry-label">REASON FOR MISSED / BAD SLEEP <small>(optional)</small></p>
    <div class="sleep-reason-list">
      <label class="sleep-reason-row"><input type="checkbox" data-sleep-reason="children" ${reasons.includes('children')?'checked':''}><span>Children Interruption</span></label>
      <label class="sleep-reason-row"><input type="checkbox" data-sleep-reason="sex" ${reasons.includes('sex')?'checked':''}><span>Sex</span></label>
      <label class="sleep-reason-row"><input type="checkbox" data-sleep-reason="masturbation" ${reasons.includes('masturbation')?'checked':''}><span>Masturbation</span></label>
      <label class="sleep-reason-row"><input type="checkbox" data-sleep-reason="other" ${reasons.includes('other')?'checked':''}><span>Other</span></label>
    </div>
    <div class="form-row sleep-reason-other-row" ${reasons.includes('other')?'':'hidden'}><label>Other — describe</label><input id="sleepReasonOtherText" maxlength="120" value="${esc(d.sleepReasonOtherText||'')}" placeholder="What kept you from sleeping?"></div>
    <label class="sleep-medication-row"><input type="checkbox" id="sleepMedicationUsed" ${d.sleepMedicationUsed?'checked':''}><span>Was medication used?</span></label>
    <button class="rpg-btn accent resource-primary" id="saveSleep">Save Sleep</button>${resetControl('Sleep')}</div>`);
    let selectedQuality=quality,selectedReasons=[...reasons];
    modalRoot.querySelectorAll('[data-sleep-quality]').forEach(b=>b.onclick=()=>{selectedQuality=selectedQuality===b.dataset.sleepQuality?'':b.dataset.sleepQuality;modalRoot.querySelectorAll('[data-sleep-quality]').forEach(x=>x.classList.toggle('active',x.dataset.sleepQuality===selectedQuality))});
    modalRoot.querySelectorAll('[data-sleep-reason]').forEach(cb=>cb.onchange=()=>{
      const key=cb.dataset.sleepReason;
      selectedReasons=cb.checked?[...new Set([...selectedReasons,key])]:selectedReasons.filter(r=>r!==key);
      const otherRow=modalRoot.querySelector('.sleep-reason-other-row');
      if(otherRow)otherRow.hidden=!selectedReasons.includes('other');
    });
    modalRoot.querySelector('#saveSleep').onclick=()=>{
      const h=Math.max(0,Number(modalRoot.querySelector('#sleepHours').value||0)),m=Math.min(59,Math.max(0,Number(modalRoot.querySelector('#sleepMinutes').value||0)));
      d.sleep=Math.min(24,h+m/60);
      d.sleepQuality=selectedQuality;
      d.sleepReasons=selectedReasons;
      d.sleepReasonOtherText=selectedReasons.includes('other')?modalRoot.querySelector('#sleepReasonOtherText').value.trim():'';
      d.sleepMedicationUsed=Boolean(modalRoot.querySelector('#sleepMedicationUsed').checked);
      finish();
    };
    bindReset('Sleep',()=>{d.sleep=0;d.sleepQuality='';d.sleepReasons=[];d.sleepReasonOtherText='';d.sleepMedicationUsed=false});return;
  }
  if(key==='mind'){
    const target=Math.round(p.mindfulnessTarget||30);
    const activityOptions=MINDFULNESS_ACTIVITIES.map(a=>`<option value="${a.key}">${esc(a.label)}</option>`).join('');
    modal(`<div class="resource-entry"><h2>Mindfulness</h2>${current('Today',Math.round(d.mindfulness||0),target,' min')}<p class="helper">Reading, writing, puzzles and similar mindful activities all add to this same total. Detailed activity history is meant for Personal Growth — Home just shows the daily summary.</p><p class="resource-entry-label">LOG TIME</p><div class="form-row"><label>Activity</label><select id="mindfulnessActivity">${activityOptions}</select></div><div class="resource-quick-grid"><button class="rpg-btn small" data-mindfulness-preset="5">+5</button><button class="rpg-btn small" data-mindfulness-preset="10">+10</button><button class="rpg-btn small" data-mindfulness-preset="20">+20</button></div><div class="resource-custom-row"><div class="form-row"><label>Custom minutes</label><input id="mindfulnessCustom" type="number" inputmode="numeric" min="0" placeholder="15"></div><button class="rpg-btn" id="mindfulnessCustomAdd">Add</button></div>${adjust('Mindfulness total','mindfulnessSet',Math.round(d.mindfulness||0),' min')}${resetControl('Mindfulness')}</div>`);
    const logMinutes=mins=>{
      mins=Math.max(0,Number(mins||0));if(!mins)return;
      const activity=modalRoot.querySelector('#mindfulnessActivity')?.value||'mindfulness';
      const after=Number(d.mindfulness||0)+mins;
      const high=Number((d.resourceHigh||{}).mindfulness||0),wi=Math.max(0,Math.floor(Math.max(high,after)/5)-Math.floor(high/5));
      creditResourceProgress('mindfulness',after);d.mindfulness=after;
      state.mindfulnessHistory=Array.isArray(state.mindfulnessHistory)?state.mindfulnessHistory:[];
      state.mindfulnessHistory.push({date:todayISO(),activity,minutes:mins});
      state.mindfulnessHistory=state.mindfulnessHistory.slice(-200);
      save();closeModal();if(wi)showSystemReward({label:'RESOURCE PROGRESS',stats:{wis:wi}});renderHome();
    };
    modalRoot.querySelectorAll('[data-mindfulness-preset]').forEach(b=>b.onclick=()=>logMinutes(b.dataset.mindfulnessPreset));
    modalRoot.querySelector('#mindfulnessCustomAdd').onclick=()=>logMinutes(modalRoot.querySelector('#mindfulnessCustom').value);
    modalRoot.querySelector('[data-adjust-save="mindfulnessSet"]').onclick=()=>{
      const total=Math.max(0,Number(modalRoot.querySelector('#mindfulnessSet').value||0));
      const high=Number((d.resourceHigh||{}).mindfulness||0),wi=Math.max(0,Math.floor(Math.max(high,total)/5)-Math.floor(high/5));
      creditResourceProgress('mindfulness',total);d.mindfulness=total;save();closeModal();if(wi)showSystemReward({label:'RESOURCE PROGRESS',stats:{wis:wi}});renderHome();
    };
    bindReset('Mindfulness',()=>{d.mindfulness=0});return;
  }
  if(key==='steps'){
    modal(`<div class="resource-entry"><h2>Steps</h2>${current('Current steps',Math.round(d.steps||0).toLocaleString(),Math.round(p.stepsTarget||8000).toLocaleString(),'')}<p class="helper">Manual fallback is active. Automatic health/step sync can connect to this same value later.</p><div class="form-row"><label>Current step count</label><input id="stepsSet" type="number" inputmode="numeric" min="0" value="${Math.round(d.steps||0)}"></div><button class="rpg-btn accent resource-primary" id="saveSteps">Save Steps</button>${resetControl('Steps')}</div>`);
    modalRoot.querySelector('#saveSteps').onclick=()=>{d.steps=Math.max(0,Number(modalRoot.querySelector('#stepsSet').value||0));finish()};bindReset('Steps',()=>{d.steps=0});return;
  }
  if(key==='social'){
    const target=Math.round(p.socialMinutesTarget||30);
    modal(`<div class="resource-entry"><h2>Social</h2>${current('Today',Math.round(d.socialMinutes||0),target,' min')}<p class="resource-entry-label">LOG TIME</p><div class="resource-quick-grid"><button class="rpg-btn small" data-social-preset="10">+10</button><button class="rpg-btn small" data-social-preset="20">+20</button><button class="rpg-btn small" data-social-preset="30">+30</button></div><div class="resource-custom-row"><div class="form-row"><label>Custom minutes to add</label><input id="socialCustom" type="number" inputmode="numeric" min="0" placeholder="15"></div><button class="rpg-btn" id="socialCustomAdd">Add</button></div>${adjust('Social total','socialSet',Math.round(d.socialMinutes||0),' min')}${resetControl('Social')}`);
    const apply=after=>{after=Math.max(0,Number(after||0));const high=Number((d.resourceHigh||{}).socialMinutes||0),statGain=Math.max(0,Math.floor(Math.max(high,after)/5)-Math.floor(high/5));creditResourceProgress('socialMinutes',after);d.socialMinutes=after;save();closeModal();if(statGain)showSystemReward({label:'RESOURCE PROGRESS',stats:{cha:statGain}});renderHome()};
    modalRoot.querySelectorAll('[data-social-preset]').forEach(b=>b.onclick=()=>apply(Number(d.socialMinutes||0)+Number(b.dataset.socialPreset)));
    modalRoot.querySelector('#socialCustomAdd').onclick=()=>apply(Number(d.socialMinutes||0)+Number(modalRoot.querySelector('#socialCustom').value||0));
    modalRoot.querySelector('[data-adjust-save="socialSet"]').onclick=()=>apply(modalRoot.querySelector('#socialSet').value);bindReset('Social',()=>{d.socialMinutes=0});return;
  }
}

/* ---------- BOOT ---------- */
function bootApp(){
  const splash=document.querySelector('#startupScreen'),name=document.querySelector('#startupPlayerName'),status=document.querySelector('#startupStatus'),finalLine=document.querySelector('#startupFinal');
  if(name)name.textContent=`GREETINGS, ${(state.profile.name||'Player').toUpperCase()}`;
  const started=performance.now();
  if(status)status.textContent='RESTORING PLAYER DATA';
  renderGlobalNavigation();
  render();
  requestAnimationFrame(()=>{if(status)status.textContent='PREPARING DAILY SYSTEMS'});
  setTimeout(()=>{if(status)status.textContent='LOADING QUESTS'},260);
  const finish=()=>{if(status)status.textContent='PLAYER SYSTEM READY';if(finalLine)finalLine.textContent='SYSTEM ONLINE';setTimeout(()=>{if(splash){splash.classList.add('startup-leaving');setTimeout(()=>splash.remove(),260)}},180)};
  setTimeout(finish,Math.max(0,900-(performance.now()-started)));
}
/* Home V3 background-selection resolver (Aurelia handover, 2026-09-09).
   Wraps the existing homeEnvironmentKey() (Day/Sunset/Night/Rain — reused
   completely unchanged, per "reuse existing time-of-day and weather
   logic rather than introducing a competing resolver") with a
   birthday/holiday precedence layer on top. This app has no "manual
   theme preference" field anywhere today, so that tier of the proposed
   precedence (manual choice > birthday > holiday > automatic) is
   currently a no-op — the chain is written so one slots in cleanly if
   ever added, without needing to revisit this function.
   Holiday auto-activation is deliberately OFF (HOME_HOLIDAY_AUTO_ENABLED
   = false): the handover explicitly asks for a proposed calendar policy
   to be returned for review before any automatic holiday switching is
   enabled, not for one to be silently turned on. The windows below are
   that proposal — available for manual testing via home-env-<key> body
   classes today, not a locked/live schedule. Easter has no window at
   all: it's a movable feast with no date-computation implemented here,
   flagged back rather than guessed at. */
const HOME_BACKGROUND_KEYS=['day','sunset','night','rain','birthday','christmas','newyear','valentine','easter','norway17may','midsummer','halloween'];
const HOME_HOLIDAY_AUTO_ENABLED=false;
const HOME_HOLIDAY_PROPOSED_WINDOWS={
  christmas:{startMonth:12,startDay:1,endMonth:12,endDay:31},
  newyear:{startMonth:1,startDay:1,endMonth:1,endDay:2},
  valentine:{startMonth:2,startDay:14,endMonth:2,endDay:14},
  norway17may:{startMonth:5,startDay:17,endMonth:5,endDay:17},
  midsummer:{startMonth:6,startDay:23,endMonth:6,endDay:24},
  halloween:{startMonth:10,startDay:31,endMonth:10,endDay:31},
  easter:null
};
/* Month/day match only (no year, no age inferred) against local device
   time — this app has no separate "configured timezone" field to read,
   so device timezone (the handover's explicit fallback) is what's
   actually used. Deliberately NOT `new Date(b)`: that parses a
   date-only 'YYYY-MM-DD' string as UTC midnight, which can land on the
   wrong local calendar day in negative-UTC-offset zones — the regex +
   Number() extraction below reads the stored digits directly instead. */
function homeBirthdayActive(){
  const b=state.profile?.birthday;
  if(!b||typeof b!=='string')return false;
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if(!m)return false;
  const bMonth=Number(m[2]),bDay=Number(m[3]);
  if(!(bMonth>=1&&bMonth<=12&&bDay>=1&&bDay<=31))return false;
  const now=new Date();
  return now.getMonth()+1===bMonth&&now.getDate()===bDay;
}
function homeHolidayActive(){
  if(!HOME_HOLIDAY_AUTO_ENABLED)return null;
  const now=new Date(),month=now.getMonth()+1,day=now.getDate();
  for(const key of Object.keys(HOME_HOLIDAY_PROPOSED_WINDOWS)){
    const w=HOME_HOLIDAY_PROPOSED_WINDOWS[key];
    if(!w)continue;
    const afterStart=(month>w.startMonth)||(month===w.startMonth&&day>=w.startDay);
    const beforeEnd=(month<w.endMonth)||(month===w.endMonth&&day<=w.endDay);
    if(afterStart&&beforeEnd)return key;
  }
  return null;
}
function homeBackgroundKey(){
  if(homeBirthdayActive())return 'birthday';
  const holiday=homeHolidayActive();
  if(holiday)return holiday;
  return homeEnvironmentKey();
}
function applyHomeBackgroundClass(){
  document.body.classList.remove(...HOME_BACKGROUND_KEYS.map(k=>`home-env-${k}`));
  document.body.classList.add(`home-env-${homeBackgroundKey()}`);
}
/* Re-evaluation beyond the natural "renderHome() runs on every normal
   render" path: app resume (visibilitychange) and local midnight (a
   self-rescheduling timer). Both only matter when nothing else would
   re-render Home first — e.g. the app left open on Home, backgrounded,
   overnight, with no other state change to trigger a render. Neither
   writes anything to state — this is display-only, never persisted as
   a permanent theme choice. */
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&page==='home')applyHomeBackgroundClass();
});
function scheduleHomeMidnightRecheck(){
  const now=new Date();
  const nextMidnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,5);
  setTimeout(()=>{if(page==='home')applyHomeBackgroundClass();scheduleHomeMidnightRecheck()},Math.max(1000,nextMidnight-now));
}
scheduleHomeMidnightRecheck();
if('serviceWorker' in navigator){navigator.serviceWorker.register('service-worker.js').catch(()=>{})}
bootApp();


/* v0.01.8.2 approved Home bar-resource + class/weather integration overrides */
/* Character Stats (Home v2 module) — real implementation lives in
   v0.02.15-home-widget-player-status.js, which depends on the combat-
   stat reader functions from v0.02.4.3-player-box.js (both load after
   this file). This stub only exists so renderHome()'s own initial
   pre-v0.02.x-load render (the "if(page==='home')renderHome()" calls
   that fire as each later script finishes loading, before the whole
   chain is up) has something safe to call instead of throwing on a
   not-yet-defined function — same reason playerStatusHTML() itself is
   a real base function that later files reassign, not the other way
   around. */
function characterStatsHTML(){return ''}
function playerStatusHTML(){
  const p=state.profile,summary=todayStatusSummary(),cost=nextLevelCost(),xpPct=pct(state.xp,cost),ps=state.playerStatus||{streak:0},className=resolvedCharacterClass();
  const reward=state.quest?.lootBox||(!state.quest?.rewarded&&Number(state.quest?.rewardGold||0)>0?`${state.quest.rewardGold} Gold`:'—');
  return `<section class="player-status-panel"><div class="player-status-top"><div class="player-class-block"><div class="player-class-icon" aria-label="${esc(className)} class icon"><img src="${characterClassAsset()}" alt="${esc(className)}"></div><div><span class="player-status-kicker">PLAYER STATUS</span><div class="player-name-line">${esc(p.name||'Player')}</div><div class="player-class-line"><b>${esc(className.toUpperCase())}</b></div></div></div><div class="player-status-tools"><button class="utility-btn" id="helpButton"><span>?</span><small>Help</small></button><button class="utility-btn" id="settingsButton"><span>⚙</span><small>Settings</small></button></div></div><div class="player-level-line"><b>LEVEL ${state.level}</b><span>${Math.round(state.xp)} / ${cost} XP</span></div><div class="player-xp-bar"><i style="--p:${xpPct}"></i></div><div class="player-status-metrics"><div><span>STREAK</span><b>${Math.max(0,Number(ps.streak||0))} day${Number(ps.streak||0)===1?'':'s'}</b></div><div><span>TODAY</span><b>${summary.pct}% · ${summary.done}/${summary.total}</b></div></div><div class="player-status-reward"><span>NEXT REWARD</span><b>${esc(reward)}</b></div><div class="player-status-quip">${esc(systemQuip())}</div></section>`;
}
function renderWeatherHTML(){
  const w=currentWeatherView(),run=runningConditions(w),showRun=state.profile.showRunningConditions!==false;
  return `<div class="weather-approved-v4"><div class="weather-primary-row"><img class="weather-art weather-forecast-trigger" id="weatherForecastTrigger" role="button" tabindex="0" aria-label="Open 5-day weather forecast" title="Open 5-day forecast" src="${asset(w.icon)}" alt="${esc(w.condition)}"><span class="weather-temp">${w.temp==='--'?'--':Math.round(w.temp)}°C</span></div><div class="weather-condition weather-title">${esc(w.condition)}</div><div class="weather-secondary-row"><span>Feels ${w.feels==='--'?'--':Math.round(w.feels)}°</span><span>High ${w.high==='--'?'--':Math.round(w.high)}° / Low ${w.low==='--'?'--':Math.round(w.low)}°</span><span>Rain ${w.rain==='--'?'--':Math.round(w.rain)}%</span><span>Wind ${w.wind==='--'?'--':Math.round(w.wind)} km/h</span></div><div class="weather-footer"><small class="weather-attribution">Weather data: Open-Meteo</small>${showRun?`<div class="running-bottom ${run.cls}" title="${esc(run.note)}"><span>RUNNING CONDITIONS</span><b>${esc(String(run.label).toUpperCase())}</b></div>`:''}</div></div>`;
}
function bindWeatherForecastTrigger(){const weatherTrigger=document.querySelector('#weatherForecastTrigger');if(weatherTrigger){weatherTrigger.onclick=openWeatherForecast;weatherTrigger.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openWeatherForecast()}}}}
function weatherRunBadge(run){return `<span class="forecast-run-state ${run.cls}" title="${esc(run.note)}">${esc(String(run.label).toUpperCase())}</span>`}
/* forecast-current-details icons (2026-09-13, direct instruction, "make
   the same changes to the other weather panes" — following the same
   bigger-text/per-metric-icon mobile treatment built for the Hero HUD's
   own compact weather card): Rain/Wind get the same real, compressed
   -40px runtime icons as the Hero card (assets/icons/weather/ICON_
   WEATHER_RAIN-40px.png / _WIND-40px.png); High/Low has no dedicated
   icon in the asset library (same gap flagged there) so it reuses the
   same ⇅ glyph placeholder. Hidden by default, shown + enlarged only at
   the existing ≤390px tier (v0.02.25 CSS) — this modal's desktop 2x2
   grid is unchanged, "we have space for it" was specifically about the
   stacked single-column mobile layout this breakpoint already uses. */
function renderWeatherForecastHTML(){
  const w=currentWeatherView(),forecast=state.weatherCache?.forecast||{},periods=Array.isArray(forecast.periods)?forecast.periods:[],days=Array.isArray(forecast.days)?forecast.days:[];
  const periodsHTML=periods.length?periods.map(period=>{const run=runningConditions(period);return `<article class="forecast-period"><span class="forecast-period-name">${esc(period.label)}</span><img src="${asset(period.icon)}" alt="${esc(period.condition)}"><b>${period.temp==='--'?'--':Math.round(period.temp)}°</b><small>Rain ${period.rain==='--'?'--':Math.round(period.rain)}%</small>${weatherRunBadge(run)}</article>`}).join(''):'<div class="forecast-empty">Today’s period forecast is temporarily unavailable.</div>';
  const daysHTML=days.slice(1,5).map(day=>{const run=runningConditions(day),label=dateFromISO(day.date).toLocaleDateString(undefined,{weekday:'short'}).toUpperCase();return `<div class="forecast-day-row"><strong>${esc(label)}</strong><img src="${asset(day.icon)}" alt="${esc(day.condition)}"><span>${Math.round(day.high)}° / ${Math.round(day.low)}°</span><span>Rain ${Math.round(day.rain)}%</span>${weatherRunBadge(run)}</div>`}).join('')||'<div class="forecast-empty">Extended forecast is temporarily unavailable.</div>';
  return `<div class="weather-forecast-shell"><div class="forecast-heading"><h2>Forecast</h2></div><section class="forecast-current"><img src="${asset(w.icon)}" alt="${esc(w.condition)}"><div class="forecast-current-main"><b>${w.temp==='--'?'--':Math.round(w.temp)}°C</b><strong>${esc(w.condition)}</strong><small>${esc(w.location||state.profile.location||'Horten')}</small></div><div class="forecast-current-details"><span>Feels <b>${w.feels==='--'?'--':Math.round(w.feels)}°</b></span><span><span class="forecast-detail-icon forecast-detail-icon-glyph" aria-hidden="true">⇅</span>High / Low <b>${w.high==='--'?'--':Math.round(w.high)}° / ${w.low==='--'?'--':Math.round(w.low)}°</b></span><span><img class="forecast-detail-icon" src="${asset('icons/weather/ICON_WEATHER_RAIN-40px.png')}" alt="">Rain <b>${w.rain==='--'?'--':Math.round(w.rain)}%</b></span><span><img class="forecast-detail-icon" src="${asset('icons/weather/ICON_WEATHER_WIND-40px.png')}" alt="">Wind <b>${w.wind==='--'?'--':Math.round(w.wind)} km/h</b></span></div></section><section class="forecast-today"><div class="forecast-section-title"><span>TODAY</span><small>Morning · Afternoon · Evening</small></div><div class="forecast-period-grid">${periodsHTML}</div></section><section class="forecast-next-days"><div class="forecast-section-title"><span>NEXT DAYS</span><small>High / Low · Rain · Running Conditions</small></div><div class="forecast-day-list">${daysHTML}</div></section><footer class="forecast-source">Weather data: Open-Meteo</footer></div>`;
}
let weatherForecastKeyHandler=null;
function closeWeatherForecast(){if(weatherForecastKeyHandler){document.removeEventListener('keydown',weatherForecastKeyHandler);weatherForecastKeyHandler=null}closeModal()}
function decorateWeatherForecastModal(){
  const backdrop=modalRoot.querySelector('.modal-backdrop'),box=modalRoot.querySelector('.modal');if(!backdrop||!box)return;
  backdrop.classList.add('weather-forecast-backdrop');box.classList.add('weather-forecast-modal');
  const close=box.querySelector('.close');if(close)close.onclick=closeWeatherForecast;
  backdrop.onclick=e=>{if(e.target===backdrop)closeWeatherForecast()};
  if(weatherForecastKeyHandler)document.removeEventListener('keydown',weatherForecastKeyHandler);
  weatherForecastKeyHandler=e=>{if(e.key==='Escape')closeWeatherForecast()};document.addEventListener('keydown',weatherForecastKeyHandler);
}
async function openWeatherForecast(){
  const hasForecast=Array.isArray(state.weatherCache?.forecast?.days)&&state.weatherCache.forecast.days.length>=5;
  if(!hasForecast){modal(`<div class="weather-forecast-shell forecast-loading"><div class="forecast-heading"><h2>Forecast</h2></div><div class="forecast-loading-state"><img src="${asset(currentWeatherView().icon)}" alt=""><b>Loading forecast…</b><small>Weather data: Open-Meteo</small></div></div>`);decorateWeatherForecastModal();await refreshWeather(true);if(!modalRoot.querySelector('.weather-forecast-shell'))return;const shell=modalRoot.querySelector('.weather-forecast-shell');if(shell)shell.outerHTML=renderWeatherForecastHTML();return}
  modal(renderWeatherForecastHTML());decorateWeatherForecastModal();
}
function resourceBarLayers(base,overflow=0,cls='',overlayHTML=''){
  return `<div class="segmented-resource-bar css-resource-bar${cls}" style="--base:${base};--over:${overflow}"><div class="resource-empty-track"><div class="segment-fill base-fill"></div>${overflow>0?'<div class="segment-fill overflow-fill"></div>':''}<div class="segment-grid" aria-hidden="true"></div></div>${overlayHTML}</div>`;
}
function segmentedBar(value,target,mode='normal',overlayHTML=''){
  const v=Math.max(0,Number(value||0)),t=Math.max(1,Number(target||1)),ratio=v/t;
  let base=Math.min(100,ratio*100),overflow=0,cls='';
  if(mode==='positive'&&ratio>1){base=100;overflow=Math.min(100,(ratio-1)*100);cls=' positive-overflow'}
  return resourceBarLayers(base,overflow,cls,overlayHTML);
}
/* Calories are a consumption limit, not a completion target (Home Baseline
   Correction item 10): the bar fills 0->100% as usual on the way to the
   healthy floor (`low`), but its COLOR instead tracks how close the value
   is to the upper limit (`high`) — green while there's plenty of room,
   warming through amber/orange as it approaches the limit, then purple
   (not the shared blue->gold "achievement" language) once it's actually
   exceeded. This stays Calories-specific; Protein keeps the normal
   blue->gold generic-resource treatment. */
function calorieSegmentedBar(value,low,high,overlayHTML=''){
  const v=Math.max(0,Number(value||0)),lo=Math.max(1,Number(low||1)),hi=Math.max(lo,Number(high||lo));
  const ratio=hi>0?v/hi:0;
  let cls;
  if(v>hi)cls=' calorie-over';
  else if(ratio>=.85)cls=' calorie-hot';
  else if(ratio>=.6)cls=' calorie-warm';
  else cls=' calorie-safe';
  const fill=v>=lo?100:Math.min(100,(v/lo)*100);
  /* Wrapped in .resource-bar-wrap to match barMeter()'s structure exactly
     — that wrapper carries its own min-height:34px (resources-panel
     hotfix CSS), which barMeter()'s bars pick up automatically. Without
     it here, Calories' bar sat inside a shorter box than Water/Sleep and
     rendered a few pixels lower/shorter than the other resource bars. */
  return `<div class="resource-bar-wrap">${resourceBarLayers(fill,0,cls,overlayHTML)}</div>`;
}
function barMeter(value,target,cls='',label='',mode='normal',overlayHTML=''){
  return `<div class="resource-bar-wrap">${label?`<small>${esc(label)}</small>`:''}${segmentedBar(value,target,mode,overlayHTML)}</div>`;
}
/* Home V3 Internal Component Normalization Pass (Aurelia, 2026-09-11):
   Resources tiles move onto the shared .hw-inset "Inset cell" primitive
   (v0.02.22) instead of their own bespoke resource-row-head/segmented-
   bar treatment — same material/radius/shadow/progress language as
   Character Stats' stat wells, just sized for the Resources grid. The
   heavy segmented bar (segmentedBar/resourceBarLayers, still used
   elsewhere) is intentionally NOT reused here — hwProgressBarHTML/
   hwCalorieProgressBarHTML below compute the identical value/target/
   state logic but render the thin shared bar instead, so semantic
   colour (calorie safe/warm/hot/over, positive-overflow) survives the
   visual slimdown rather than being lost with the heavy component. */
function hwProgressBarHTML(value,target,mode='normal'){
  const v=Math.max(0,Number(value||0)),t=Math.max(1,Number(target||1)),ratio=v/t;
  const over=mode==='positive'&&ratio>1;
  const pct=over?100:Math.min(100,ratio*100);
  return `<span class="hw-progress-bar${over?' hw-progress-over':''}"><i style="--p:${pct}"></i></span>`;
}
function hwCalorieProgressBarHTML(value,low,high){
  const v=Math.max(0,Number(value||0)),lo=Math.max(1,Number(low||1)),hi=Math.max(lo,Number(high||lo));
  const ratio=hi>0?v/hi:0;
  let cls='hw-progress-cal-safe';
  if(v>hi)cls='hw-progress-cal-over';else if(ratio>=.85)cls='hw-progress-cal-hot';else if(ratio>=.6)cls='hw-progress-cal-warm';
  const fill=v>=lo?100:Math.min(100,(v/lo)*100);
  return `<span class="hw-progress-bar ${cls}"><i style="--p:${fill}"></i></span>`;
}
function resourceCard(img,name,value,progress,key,cls='',mode='normal'){
  return `<div class="resource-list-row ${key} hw-inset hw-inset-stack">
    <button class="hw-inset-icon-btn" data-resource="${key}" aria-label="Log ${esc(name)}"><img class="hw-inset-icon" src="${asset(img)}" alt=""></button>
    <button class="hw-inset-body-btn" data-resource="${key}" aria-label="Log ${esc(name)}">
      <span class="hw-inset-value">${value}</span>
      <span class="hw-inset-label">${esc(name).toUpperCase()}</span>
      ${hwProgressBarHTML(progress.value,progress.target,mode)}
    </button>
  </div>`;
}
/* Calories and Protein — split into two independent Resources tiles
   (ASTRA Home Resources / Movement Rework, 2026-09-08), stacked in the
   locked 3×2 grid's middle column (Water|Calories|Sleep over
   Mind|Protein|Social). Previously one dual-track "Food" card; the
   underlying data/edit flow is unchanged (resourceModal('food') still
   edits both together, same as before) — this is a presentation split
   only, per that handoff's explicit "do not recombine into a single
   Food resource" / "do not change Calories logic, Protein logic". Each
   tile uses the exact same resource-list-row shape as every other
   Resources tile (Water/Sleep/etc.) so it inherits the same V3 grid
   text-above-bar treatment automatically, no special-casing needed. */
function resourceCalories(d,p){
  const low=Math.round((p.calLower||p.calTarget*.95)),high=Math.round((p.calUpper||p.calTarget*1.05));
  return `<div class="resource-list-row calories hw-inset hw-inset-stack">
    <button class="hw-inset-icon-btn" data-resource="food" aria-label="Log Food calories"><img class="hw-inset-icon" src="${asset('Home/V3/Resources/home-v3-resource-calories-2x.png')}" alt=""></button>
    <button class="hw-inset-body-btn" data-resource="food" aria-label="Log Food calories">
      <span class="hw-inset-value">${Math.round(d.calories)} / ${low}–${high}</span>
      <span class="hw-inset-label">CALORIES</span>
      ${hwCalorieProgressBarHTML(d.calories,low,high)}
    </button>
  </div>`;
}
function resourceProtein(d,p){
  return `<div class="resource-list-row protein hw-inset hw-inset-stack">
    <button class="hw-inset-icon-btn" data-resource="food" aria-label="Log Food protein"><img class="hw-inset-icon" src="${asset('Home/V3/Resources/home-v3-resource-protein-2x.png')}" alt=""></button>
    <button class="hw-inset-body-btn" data-resource="food" aria-label="Log Food protein">
      <span class="hw-inset-value">${Math.round(d.protein)} / ${Math.round(p.proteinTarget)} g</span>
      <span class="hw-inset-label">PROTEIN</span>
      ${hwProgressBarHTML(d.protein,p.proteinTarget,'positive')}
    </button>
  </div>`;
}
/* Mind -> Mindfulness (5.3): one minutes-based bar instead of separate
   Reading/Mindfulness bars. Logging opens an activity-type picker (see
   resourceModal 'mind'); every type adds to the same total. Per-activity
   detail lives in state.mindfulnessHistory for a future Personal Growth
   view — Home only shows the daily summary. */
function resourceMind(d,p){
  const target=Math.round(p.mindfulnessTarget||30);
  return `<div class="resource-list-row mindfulness hw-inset hw-inset-stack">
    <button class="hw-inset-icon-btn" data-resource="mind" aria-label="Log Mindfulness"><img class="hw-inset-icon" src="${asset('Home/V3/Resources/home-v3-resource-mind-2x.png')}" alt=""></button>
    <button class="hw-inset-body-btn" data-resource="mind" aria-label="Log Mindfulness">
      <span class="hw-inset-value">${Math.round(d.mindfulness||0)} / ${target}m</span>
      <span class="hw-inset-label">MINDFULNESS</span>
      ${hwProgressBarHTML(d.mindfulness||0,target,'positive')}
    </button>
  </div>`;
}

/* ---------- Movement (ASTRA Home Resources / Movement Rework, 2026-09-08)
   ----------
   Standalone Home widget, split out of Resources. Reuses existing data
   only: state.daily.steps / state.profile.stepsTarget (same fields
   resourceModal('steps') already reads/writes, untouched below), walking
   distance from state.activities (type==='Walking', same field Training
   and the Journey system already read), and day-by-day step history from
   state.resourceHistory (the existing 90-day daily-rollover archive
   dailyReset() already writes every field into — no second history store
   created). Editing today's step count still goes through the existing,
   unmodified resourceModal('steps') entry flow. */
/* Health Connect Phase 1 (brief §12/§13) — Movement/Journeys never
   query Health Connect directly, they read already-normalized evidence
   through healthImportedStepsForDate()/healthImportedDistanceMetersForDate()
   (v0.02.27-health-connect-bridge.js, guarded here since that file may
   not have loaded yet in a context that doesn't include it). Manual
   entry (state.daily.steps, Training's own Walking activities below)
   is completely untouched — this only ADDS imported evidence on top,
   so both coexist per §12/§18 without either overwriting the other. */
function healthImportedStepsTodayOrZero(){
  return typeof healthImportedStepsForDate==='function'?healthImportedStepsForDate(todayISO()):0;
}
function walkingDistanceToday(){
  const t=todayISO();
  const manual=state.activities.filter(a=>a&&a.date===t&&a.completed&&a.type==='Walking').reduce((s,a)=>s+Number(a.distance||0),0);
  const importedMeters=typeof healthImportedDistanceMetersForDate==='function'?healthImportedDistanceMetersForDate(t):0;
  return manual+importedMeters/1000;
}
/* Internal Component Normalization pass (Aurelia, 2026-09-11): Movement's
   content zone moves onto the shared .hw-inset(.hw-inset-wide) primitive
   — same shallow-well material as Character Stats/Resources — instead
   of the old one-off .movement-inset box, and its progress bar switches
   from the heavy segmented barMeter() to the shared thin hwProgressBarHTML,
   matching every other widget's bar weight. */
function movementPanelHTML(){
  const d=state.daily,p=state.profile;
  const steps=Math.round(d.steps||0)+healthImportedStepsTodayOrZero(),target=Math.round(p.stepsTarget||8000);
  const dist=walkingDistanceToday();
  return `<section class="home-panel home-panel-movement">
    <div class="home-panel-header"><img class="home-panel-icon" src="${asset('Home/V3/Widgets/HOMEV3_ICON_MOVEMENT.png')}" alt=""><span>Movement</span></div>
    <button type="button" class="movement-summary" id="openMovementPopup" aria-label="Open Movement details">
      <div class="hw-inset hw-inset-wide">
        <img class="hw-inset-icon" src="${asset('Home/V3/Widgets/HOMEV3_ICON_MOVEMENT.png')}" alt="">
        <div class="hw-inset-wide-body">
          <div class="hw-inset-wide-row"><span class="hw-inset-value">${steps.toLocaleString()}</span><span class="hw-inset-label">/ ${target.toLocaleString()} steps</span></div>
          ${hwProgressBarHTML(steps,target,'positive')}
          ${dist>0?`<div class="hw-inset-meta-line">${dist.toFixed(1)} km walked today</div>`:''}
        </div>
      </div>
    </button>
  </section>`;
}
let movementHistoryRange=7;
function movementOverviewHTML(){
  const d=state.daily,p=state.profile;
  const steps=Math.round(d.steps||0)+healthImportedStepsTodayOrZero(),target=Math.round(p.stepsTarget||8000);
  const pct=target>0?Math.round((steps/target)*100):0;
  const dist=walkingDistanceToday();
  return `<div class="movement-overview">
    <div class="resource-entry-current"><span>Today</span><b>${steps.toLocaleString()} / ${target.toLocaleString()} steps</b></div>
    <div class="movement-overview-bar">${barMeter(steps,target,'','','positive')}</div>
    <div class="movement-overview-row"><span>Progress</span><b>${pct}%</b></div>
    ${dist>0?`<div class="movement-overview-row"><span>Walking distance today</span><b>${dist.toFixed(1)} km</b></div>`:''}
    <button type="button" class="rpg-btn accent" id="movementEditSteps">Update Steps</button>
  </div>`;
}
/* History reads the existing resourceHistory archive (already carries
   .steps per date, written once per day at rollover — see dailyReset())
   plus today's own live value, since today never gets an archive row
   until the next rollover. Nothing here writes to resourceHistory or
   creates any new store. */
function movementHistorySeries(days){
  const t=todayISO();
  const past=(Array.isArray(state.resourceHistory)?state.resourceHistory:[])
    .filter(r=>r&&r.date&&r.date!==t)
    .map(r=>({date:r.date,steps:Number(r.steps||0)}));
  const series=[...past,{date:t,steps:Math.round(state.daily.steps||0)+healthImportedStepsTodayOrZero()}]
    .sort((a,b)=>a.date.localeCompare(b.date));
  return series.slice(-days);
}
function movementHistoryHTML(){
  const series=movementHistorySeries(movementHistoryRange);
  const target=Math.round(state.profile.stepsTarget||8000);
  const hasData=series.some(s=>s.steps>0);
  const rangeToggle=`<div class="tabs movement-range-toggle">
    <button type="button" data-movement-range="7" class="${movementHistoryRange===7?'active':''}">7 days</button>
    <button type="button" data-movement-range="30" class="${movementHistoryRange===30?'active':''}">30 days</button>
  </div>`;
  if(!hasData){
    return `${rangeToggle}<p class="helper movement-empty">No step history yet. Log a few days of steps and they’ll show up here.</p>`;
  }
  const max=Math.max(target,...series.map(s=>s.steps),1);
  const targetH=Math.max(0,Math.min(100,Math.round((target/max)*100)));
  const t=todayISO();
  const bars=series.map(s=>{
    const h=s.steps>0?Math.max(3,Math.round((s.steps/max)*100)):0;
    const met=s.steps>=target;
    const label=s.date===t?'Today':fmtShort(s.date);
    return `<button type="button" class="movement-bar" data-movement-date="${esc(s.date)}" data-movement-steps="${s.steps}" aria-label="${esc(label)}: ${s.steps.toLocaleString()} steps">
      <span class="movement-bar-track"><span class="movement-bar-fill${met?' met':''}" style="height:${h}%"></span></span>
      <small>${esc(label)}</small>
    </button>`;
  }).join('');
  return `${rangeToggle}<div class="movement-readout" id="movementChartReadout">Tap a day for details</div><div class="movement-chart" style="--movement-target-h:${targetH}%">${bars}</div>`;
}
function movementModal(tab){
  tab=tab==='history'?'history':'overview';
  const body=tab==='history'?movementHistoryHTML():movementOverviewHTML();
  modal(`<h2>Movement</h2><div class="tabs">
    <button id="movementTabOverview" class="${tab==='overview'?'active':''}">Overview</button>
    <button id="movementTabHistory" class="${tab==='history'?'active':''}">History</button>
  </div>${body}`);
  modalRoot.querySelector('#movementTabOverview').onclick=()=>movementModal('overview');
  modalRoot.querySelector('#movementTabHistory').onclick=()=>movementModal('history');
  if(tab==='overview'){
    const editBtn=modalRoot.querySelector('#movementEditSteps');
    if(editBtn)editBtn.onclick=()=>resourceModal('steps');
  }else{
    modalRoot.querySelectorAll('[data-movement-range]').forEach(b=>{
      b.onclick=()=>{movementHistoryRange=Number(b.dataset.movementRange);movementModal('history')};
    });
    const readout=modalRoot.querySelector('#movementChartReadout');
    modalRoot.querySelectorAll('[data-movement-date]').forEach(b=>{
      b.onclick=()=>{if(readout)readout.textContent=`${fmtDate(b.dataset.movementDate)} — ${Number(b.dataset.movementSteps).toLocaleString()} steps`};
    });
  }
}
