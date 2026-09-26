/* Self Care core — Water · Meals · Sleep · Vigil, Character meters, Habits
   Home slots, and the Mind/Social -> Habits migration (Self Care & Habits V1,
   Phase A; Astra 2026-09-25, RPG-0094). Authority: Lyra's handover (wins) +
   Tally's brief. No UI in this file (v0.02.51-self-care-ui.js has it).

   HARD RULES this file is built around (Lyra §9-§11, §16):
     - Missing logging NEVER creates a gameplay penalty. Nothing here reads
       "nothing logged" as thirsty / hungry / tired. Meters are cosmetic at
       Home; there are no penalties, notifications or XP consequences.
     - A disabled part is NEUTRAL: its meter locks at 70, its Home module
       hides, and it is never counted as "completed" for anything.
     - Self Care grants NO Stat XP, NO Character XP, NO Gold, NO items and
       changes no class evaluator (Phase B/C are not authorised). The only
       XP-adjacent code touched is the retirement of the old Reading /
       Mindfulness / Social resource grants (Lyra §14: "do not leave duplicate
       writers active").
     - Inventory items never write into real intake. (No item hooks exist.)
     - Vigil: opt-in, off by default, hard cap 24 h, and NOTHING here scales
       with its length -- no XP, Gold, loot, buff, class credit or extra
       achievement; nothing accrues beyond the planned end; ending early is
       recorded neutrally.
   Real intake stays where it already lives (state.daily.water / hydrationLog /
   calories / protein / sleep and the existing hydration + sleep ledgers, so
   the 116 existing achievements keep working). This file adds the settings,
   the meal ticks, sleep sessions, vigils and meters around them. */

const SELF_CARE_METER_NEUTRAL=70;
const SELF_CARE_DRAIN={awake:-5,asleep:-2.5};/* per hour, Hydration and Satiety (Tally §3) */
const SELF_CARE_REFILL={mainMeal:35,snack:15,feast:15};
const SELF_CARE_SLEEP_RULES={cancelWindowMs:5*60000,stillAsleepPromptMs:12*3600000,autoCloseMs:16*3600000,maxSessionMs:24*3600000};
const SELF_CARE_VIGIL={presets:[12,14,16,18],maxHours:24,minHours:1};
const SELF_CARE_MEALS=['breakfast','lunch','dinner','snack'];
const SELF_CARE_MEAL_LABEL={breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner',snack:'Snack'};
const HABITS_HOME_SLOT_COUNT=9;
const HABITS_QUICK_DEFAULT_MIN=10;

/* ------------------------------------------------------------------ */
/* 1. State                                                            */
/* ------------------------------------------------------------------ */

function selfCareHasCalorieHistory(){
  const rows=[...(state.resourceHistory||[]).slice(-14),state.daily||{}];
  return rows.some(r=>Number(r&&r.calories||0)>0);
}
function ensureSelfCare(){
  if(!state.selfCare||typeof state.selfCare!=='object'||Array.isArray(state.selfCare))state.selfCare={};
  const s=state.selfCare,p=state.profile||{};
  s.version=1;
  if(!s.settings||typeof s.settings!=='object')s.settings={};
  const st=s.settings;
  if(!st.water)st.water={enabled:true,quickAdd:[250,500]};
  if(!Array.isArray(st.water.quickAdd)||st.water.quickAdd.length<2)st.water.quickAdd=[250,500];
  /* Meals is the default mode (Lyra §5). A player who already logs calories
     keeps that behaviour: they start in Macros mode with the range their old
     +/-5% window implied, now explicit and editable. */
  if(!st.food){
    const legacyMacros=selfCareHasCalorieHistory();
    const target=Number(p.calTarget||0);
    st.food={enabled:true,mode:legacyMacros?'macros':'meals',calMin:legacyMacros&&target?Math.round(Number(p.calLower||target*.95)):null,calMax:legacyMacros&&target?Math.round(Number(p.calUpper||target*1.05)):null,protein:legacyMacros&&Number(p.proteinTarget)>0?Math.round(Number(p.proteinTarget)):null};
  }
  if(!['meals','macros'].includes(st.food.mode))st.food.mode='meals';
  if(!st.sleep){const lo=Number(p.sleepTarget||8);st.sleep={enabled:true,targetMin:lo,targetMax:lo+2,bedtime:'23:00',wake:'07:00'}}
  if(!st.vigil)st.vigil={enabled:false};/* opt-in, off by default */
  if(!s.meals||typeof s.meals!=='object'||Array.isArray(s.meals))s.meals={};
  if(!s.sleep||typeof s.sleep!=='object')s.sleep={active:null,sessions:[]};
  if(!Array.isArray(s.sleep.sessions))s.sleep.sessions=[];
  if(s.sleep.active===undefined)s.sleep.active=null;
  if(!s.vigil||typeof s.vigil!=='object')s.vigil={active:null,history:[],feastPending:false};
  if(!Array.isArray(s.vigil.history))s.vigil.history=[];
  if(s.vigil.active===undefined)s.vigil.active=null;
  if(!s.meters||typeof s.meters!=='object'){const now=Date.now();s.meters={hydration:{v:SELF_CARE_METER_NEUTRAL,at:now},satiety:{v:SELF_CARE_METER_NEUTRAL,at:now},rest:{v:SELF_CARE_METER_NEUTRAL,at:now}}}
  if(!s.habits||typeof s.habits!=='object')s.habits={slots:[]};
  if(!Array.isArray(s.habits.slots))s.habits.slots=[];
  if(!s.migrations||typeof s.migrations!=='object')s.migrations={};
  return s;
}
function selfCareSettings(){return ensureSelfCare().settings}
function selfCareEnabled(part){const st=selfCareSettings();return Boolean(st[part]&&st[part].enabled)}
const selfCareRound=(n,d=2)=>{const f=Math.pow(10,d);return Math.round(Number(n||0)*f)/f};
const selfCareClamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function selfCareTimeToMinutes(hhmm){const m=/^(\d{1,2}):(\d{2})$/.exec(String(hhmm||''));return m?Number(m[1])*60+Number(m[2]):null}
function selfCareLocalDate(ms){return localISO(new Date(ms))}
/* Settings writes go through here so the legacy profile fields the hydration
   and sleep ledgers read stay in step (waterTarget, sleepTarget = range min). */
function selfCareSaveSettings(patch){
  const s=ensureSelfCare(),st=s.settings;
  const prevMin=Number(st.sleep.targetMin),prevMax=Number(st.sleep.targetMax);
  ['water','food','sleep','vigil'].forEach(k=>{if(patch&&patch[k])Object.assign(st[k],patch[k])});
  /* moving only the minimum (the legacy Profile "Sleep hours" field) past the
     maximum carries the maximum with it, keeping the range's width instead of
     collapsing it to a single value nothing could ever satisfy */
  if(patch&&patch.sleep&&patch.sleep.targetMin!=null&&patch.sleep.targetMax==null&&st.sleep.targetMin>prevMax)st.sleep.targetMax=Math.min(24,st.sleep.targetMin+Math.max(0,prevMax-prevMin));
  if(st.sleep.targetMax<st.sleep.targetMin)st.sleep.targetMax=st.sleep.targetMin;
  if(patch&&patch.waterTarget!=null)state.profile.waterTarget=Math.max(250,Math.round(Number(patch.waterTarget)));
  state.profile.sleepTarget=Number(st.sleep.targetMin);/* the ledger's minimum; its maximum is read straight from these settings by v023SleepTargetMax(), so the RANGE decides "target met" (Lyra 2026-09-25) */
  if(st.food.mode==='macros'&&st.food.calMin!=null)state.profile.calLower=st.food.calMin;
  if(st.food.mode==='macros'&&st.food.calMax!=null)state.profile.calUpper=st.food.calMax;
  if(st.food.mode==='macros'&&st.food.protein!=null)state.profile.proteinTarget=st.food.protein;
  save();
  return st;
}

/* ------------------------------------------------------------------ */
/* 2. Water (real intake stays in state.daily.hydrationLog)            */
/* ------------------------------------------------------------------ */

/* The ONE place a drink is logged (the Water pop-up and the Home quick-add
   both call this). Same rules as before: 1 ml of any listed fluid = 1 ml. */
function hydrationLogAdd(amountMl,type='water'){
  const d=state.daily,amt=Math.max(0,Number(amountMl||0));
  if(!amt)return false;
  d.hydrationLog=Array.isArray(d.hydrationLog)?d.hydrationLog:[];
  state.hydration=state.hydration&&typeof state.hydration==='object'?state.hydration:{};
  /* A day can already carry a total with no entries behind it (an old save,
     or a manual correction): seed it as plain water first so it survives. */
  if(!d.hydrationLog.length&&Number(d.water||0)>0)d.hydrationLog.push({type:'water',amountMl:Number(d.water),ts:Date.now()});
  d.hydrationLog.push({type,amountMl:amt,ts:Date.now()});
  d.water=hydrationLogTotals(d.hydrationLog).totalMl;
  creditResourceProgress('water',d.water);
  if(type!=='water'){
    const recent=(Array.isArray(state.hydration.recentTypes)?state.hydration.recentTypes:[]).filter(t=>t!=='water'&&t!==type);
    state.hydration.recentTypes=[type,...recent].slice(0,4);
  }
  if(selfCareEnabled('water'))selfCareMeterAdd('hydration',100*amt/Math.max(1,Number(state.profile.waterTarget||2500)));
  save();
  return true;
}
/* Undo for the quick-add toast: drops the last entry and takes its refill back. */
function hydrationLogUndoLast(){
  const d=state.daily,log=Array.isArray(d.hydrationLog)?d.hydrationLog:[];
  const last=log.pop();
  if(!last)return false;
  d.water=hydrationLogTotals(log).totalMl;
  if(selfCareEnabled('water'))selfCareMeterAdd('hydration',-100*Number(last.amountMl||0)/Math.max(1,Number(state.profile.waterTarget||2500)));
  save();
  return true;
}
function selfCareWaterView(){
  const ml=Math.round(Number(state.daily.water||0)),target=Math.max(1,Math.round(Number(state.profile.waterTarget||2500)));
  return {ml,target,met:ml>=target,pct:selfCareClamp(ml/target*100,0,100)};
}
function selfCareRecentDrink(){
  const r=(state.hydration&&Array.isArray(state.hydration.recentTypes)?state.hydration.recentTypes:[]).find(t=>t&&t!=='water');
  return r?{key:r,label:hydrationFluidLabel(r)}:null;
}

/* ------------------------------------------------------------------ */
/* 3. Meals + food status                                              */
/* ------------------------------------------------------------------ */

function selfCareMealsFor(date=todayISO()){
  const m=ensureSelfCare().meals[date]||{};
  return {breakfast:Boolean(m.breakfast),lunch:Boolean(m.lunch),dinner:Boolean(m.dinner),snack:Boolean(m.snack)};
}
/* Tick / untick a meal. Ticking today refills Satiety (+35 main, +15 snack)
   and, after a kept Vigil, adds the one-time Feast bonus. Unticking takes the
   tick back and refills nothing. Returns {on} or null. */
function selfCareToggleMeal(meal,date=todayISO()){
  if(!SELF_CARE_MEALS.includes(meal)||!selfCareEnabled('food'))return null;
  const s=ensureSelfCare(),cur=selfCareMealsFor(date),on=!cur[meal];
  s.meals[date]={...cur,[meal]:on};
  const keys=Object.keys(s.meals).sort();
  if(keys.length>400)keys.slice(0,keys.length-400).forEach(k=>delete s.meals[k]);
  if(on&&date===todayISO()){
    let gain=meal==='snack'?SELF_CARE_REFILL.snack:SELF_CARE_REFILL.mainMeal;
    if(s.vigil.feastPending){gain+=SELF_CARE_REFILL.feast;s.vigil.feastPending=false}
    selfCareMeterAdd('satiety',gain);
  }
  save();
  if(on&&date===todayISO()&&typeof vigilMealPrompt==='function')setTimeout(vigilMealPrompt,0);/* Compact Home Trackers V1 §8: never silently end a Vigil */
  return {on,meal};
}
function selfCareDayRow(date){
  if(date===todayISO())return state.daily;
  return (state.resourceHistory||[]).find(r=>r.date===date)||null;
}
/* -> {enabled, mode, met:true|false|null}. null = nothing logged: UNKNOWN,
   which is neutral -- never a miss. Being inside the player's own range is a
   win; eating less than their minimum never is; there is no +/-5% rule. */
function selfCareFoodStatus(date=todayISO()){
  const cfg=selfCareSettings().food;
  if(!cfg.enabled)return {enabled:false,mode:cfg.mode,met:null};
  if(cfg.mode==='meals'){
    const m=selfCareMealsFor(date),any=SELF_CARE_MEALS.some(k=>m[k]);
    return {enabled:true,mode:'meals',met:m.breakfast&&m.lunch&&m.dinner?true:(any?false:null),mains:[m.breakfast,m.lunch,m.dinner].filter(Boolean).length};
  }
  const row=selfCareDayRow(date),cal=Number(row&&row.calories||0),prot=Number(row&&row.protein||0);
  if(!row||!(cal>0))return {enabled:true,mode:'macros',met:null,calories:cal};
  const okMin=cfg.calMin==null||cal>=cfg.calMin,okMax=cfg.calMax==null||cal<=cfg.calMax,okProt=cfg.protein==null||prot>=cfg.protein;
  return {enabled:true,mode:'macros',met:okMin&&okMax&&okProt,calories:cal,protein:prot};
}
function selfCareCaloriesAdd(kcal,protein=0){
  const d=state.daily;
  d.calories=Math.max(0,Number(d.calories||0)+Number(kcal||0));
  d.protein=Math.max(0,Number(d.protein||0)+Number(protein||0));
  if(selfCareEnabled('food')&&Number(kcal||0)>0)selfCareMeterAdd('satiety',SELF_CARE_REFILL.mainMeal*Math.min(1,Number(kcal)/700));
  save();
  if(Number(kcal||0)>0&&typeof vigilMealPrompt==='function')setTimeout(vigilMealPrompt,0);
}

/* ------------------------------------------------------------------ */
/* 4. Sleep: tap-in / tap-out sessions                                 */
/* ------------------------------------------------------------------ */

function selfCareSleepTargetHours(){const t=selfCareSettings().sleep;return Math.max(4,(Number(t.targetMin)+Number(t.targetMax))/2)}
/* The range is the win condition; oversleeping past its top is not a win. */
function selfCareSleepWin(hours){const t=selfCareSettings().sleep;return Number(hours)>=Number(t.targetMin)&&Number(hours)<=Number(t.targetMax)}
function selfCareInWrappedHours(h,a,b){return a<=b?(h>=a&&h<=b):(h>=a||h<=b)}
/* A sleep is the NIGHT sleep unless its midpoint falls outside the player's
   usual sleeping window (bed-3h .. wake+3h): those are naps. Naps refill Rest
   but never count toward the night target or night achievements. */
function selfCareSleepKind(startMs,endMs){
  const st=selfCareSettings().sleep,bed=(selfCareTimeToMinutes(st.bedtime)??1380)/60,wake=(selfCareTimeToMinutes(st.wake)??420)/60;
  const mid=new Date((startMs+endMs)/2),h=mid.getHours()+mid.getMinutes()/60;
  const a=(bed-3+24)%24,b=(wake+3)%24;
  return selfCareInWrappedHours(h,a,b)?'night':'nap';
}
function selfCareSleepActive(){return ensureSelfCare().sleep.active}
function selfCareSleepStart(){
  const s=ensureSelfCare();
  if(!selfCareEnabled('sleep')||s.sleep.active)return false;
  selfCareMeterSettle('rest');
  s.sleep.active={id:uid(),startedAt:Date.now()};
  save();return true;
}
/* "Cancel, I'm not sleeping" -- only inside the first five minutes. */
function selfCareSleepCancelable(){const a=selfCareSleepActive();return Boolean(a&&Date.now()-a.startedAt<=SELF_CARE_SLEEP_RULES.cancelWindowMs)}
function selfCareSleepCancel(){
  if(!selfCareSleepCancelable())return false;
  ensureSelfCare().sleep.active=null;save();return true;
}
/* Sessions whose wake date is today or yesterday may be created/edited. */
function selfCareSleepDateEditable(date){return date===todayISO()||date===addDays(todayISO(),-1)}
function selfCareSleepPush(startMs,endMs,source){
  const s=ensureSelfCare();
  if(!(endMs>startMs)||endMs-startMs>SELF_CARE_SLEEP_RULES.maxSessionMs||endMs>Date.now()+60000)return null;
  const wakeDate=selfCareLocalDate(endMs);
  if(!selfCareSleepDateEditable(wakeDate))return null;
  const sess={id:uid(),startedAt:startMs,endedAt:endMs,hours:selfCareRound((endMs-startMs)/3600000),kind:selfCareSleepKind(startMs,endMs),wakeDate,source};
  s.sleep.sessions.push(sess);
  if(s.sleep.sessions.length>500)s.sleep.sessions=s.sleep.sessions.slice(-500);
  return sess;
}
/* "I'm awake": hours are saved automatically; the follow-up is optional. */
function selfCareSleepWake(atMs=Date.now()){
  const s=ensureSelfCare(),a=s.sleep.active;
  if(!a)return null;
  selfCareMeterSettle('rest');
  const sess=selfCareSleepPush(a.startedAt,Math.min(atMs,Date.now()),a.autoClosed?'auto':'tap');
  s.sleep.active=null;
  if(sess){selfCareRecomputeNight(sess.wakeDate)}
  save();
  return sess;
}
function selfCareSleepLog(startMs,endMs){
  const sess=selfCareSleepPush(startMs,endMs,'manual');
  if(!sess)return null;
  selfCareRecomputeNight(sess.wakeDate);
  save();
  return sess;
}
function selfCareSleepEdit(id,{startMs,endMs}){
  const s=ensureSelfCare(),sess=s.sleep.sessions.find(x=>x.id===id);
  if(!sess||!selfCareSleepDateEditable(sess.wakeDate))return null;
  const oldDate=sess.wakeDate;
  if(!(endMs>startMs)||endMs-startMs>SELF_CARE_SLEEP_RULES.maxSessionMs)return null;
  const newDate=selfCareLocalDate(endMs);
  if(!selfCareSleepDateEditable(newDate))return null;
  Object.assign(sess,{startedAt:startMs,endedAt:endMs,hours:selfCareRound((endMs-startMs)/3600000),kind:selfCareSleepKind(startMs,endMs),wakeDate:newDate,edited:true});
  selfCareRecomputeNight(oldDate);if(newDate!==oldDate)selfCareRecomputeNight(newDate);
  save();return sess;
}
function selfCareSleepDelete(id){
  const s=ensureSelfCare(),sess=s.sleep.sessions.find(x=>x.id===id);
  if(!sess||!selfCareSleepDateEditable(sess.wakeDate))return false;
  s.sleep.sessions=s.sleep.sessions.filter(x=>x.id!==id);
  selfCareRecomputeNight(sess.wakeDate);save();return true;
}
function selfCareNightHours(date){
  return selfCareRound(ensureSelfCare().sleep.sessions.filter(x=>x.wakeDate===date&&x.kind==='night').reduce((n,x)=>n+x.hours,0));
}
/* What the hidden Sleep series is evaluated against (Lyra 2026-09-25): the
   AGGREGATED non-nap night total for the wake day -- a split night is one night,
   however many sessions -- against the night's frozen minimum, never the length
   of the one session that opened the follow-up dialog. Computed on the spot in
   memory; nothing extra is stored to support a later recalculation. */
function selfCareSleepNightBasis(date){
  const has=ensureSelfCare().sleep.sessions.some(x=>x.wakeDate===date&&x.kind==='night');
  const row=state.sleep&&state.sleep.ledger?state.sleep.ledger[date]:null;
  const hours=has?selfCareNightHours(date):(date===todayISO()?Number(state.daily.sleep||0):Number(row&&row.hours||0));
  const frozen=Number(row&&row.targetAtFinalization);
  return {hours,target:frozen>0?frozen:Math.max(0.1,Number(state.profile.sleepTarget||8))};
}
/* Night sessions -> the day's sleep hours in the EXISTING authoritative places
   (state.daily.sleep today; the finalised ledger row + resourceHistory for
   yesterday), so the sleep ledger and every sleep achievement keep working. A
   day with no sessions is left exactly as it was (manual entries survive). */
function selfCareRecomputeNight(date){
  const s=ensureSelfCare(),has=s.sleep.sessions.some(x=>x.wakeDate===date&&x.kind==='night');
  if(!has)return;
  const hours=selfCareNightHours(date);
  if(date===todayISO()){state.daily.sleep=hours;return}
  const hist=(state.resourceHistory||[]).find(r=>r.date===date);
  if(hist)hist.sleep=hours;
  state.sleep=state.sleep&&typeof state.sleep==='object'?state.sleep:{};
  state.sleep.ledger=state.sleep.ledger&&typeof state.sleep.ledger==='object'?state.sleep.ledger:{};
  const row=state.sleep.ledger[date]||{date,finalized:true,source:'selfCare',quality:'',reasons:[]};
  /* the range is authoritative: a night outside [min,max] is not "met" (Lyra
     2026-09-25). A row already judged against a range keeps BOTH of its bounds
     (editing a night never re-judges it against a range that did not exist for
     it); a new row, or one finalised before ranges existed (no stored max), is
     judged against the live range -- never a min from one range and a max from
     another. */
  const frozen=Number.isFinite(Number(row.targetAtFinalization))&&Number(row.targetAtFinalization)>0&&Number.isFinite(Number(row.targetMaxAtFinalization));
  const rangeMin=frozen?Number(row.targetAtFinalization):Math.max(0.1,Number(state.profile.sleepTarget||8));
  const rangeMax=frozen?Number(row.targetMaxAtFinalization):(typeof v023SleepTargetMax==='function'?v023SleepTargetMax():null);
  Object.assign(row,{hours,targetAtFinalization:rangeMin,targetMaxAtFinalization:rangeMax,targetMet:typeof v023SleepTargetMet==='function'?v023SleepTargetMet(hours,rangeMin,rangeMax):hours>=rangeMin});
  state.sleep.ledger[date]=row;
  if(typeof v023RebuildSleepCounters==='function')v023RebuildSleepCounters();
}
/* Apply the optional follow-up (quality / medication) to the wake day. The
   free-text Other box is NOT handled here -- it goes straight to
   sleepHiddenIngest() from the dialog and is never stored. */
function selfCareSleepFollowUp(date,{quality,medication,children}={}){
  if(date===todayISO()){
    if(quality!==undefined)state.daily.sleepQuality=quality;
    if(medication!==undefined)state.daily.sleepMedicationUsed=Boolean(medication);
    if(children!==undefined){const r=(state.daily.sleepReasons||[]).filter(x=>x!=='children');state.daily.sleepReasons=children?[...r,'children']:r}
  }else{
    const row=(state.sleep&&state.sleep.ledger&&state.sleep.ledger[date])||null;
    if(row&&quality!==undefined)row.quality=typeof v023NormalizeSleepQuality==='function'?v023NormalizeSleepQuality(quality):row.quality;
  }
  save();
}
/* State shown by the Sleep module: awake | asleep | confirm (auto-closed or
   very long) so a forgotten "I'm awake" never silently corrupts a night. */
function selfCareSleepPhase(){
  const a=selfCareSleepActive();
  if(!a)return {phase:'awake'};
  const elapsed=Date.now()-a.startedAt;
  if(elapsed>=SELF_CARE_SLEEP_RULES.autoCloseMs)return {phase:'confirm',reason:'auto',elapsed,suggestWake:a.startedAt+SELF_CARE_SLEEP_RULES.autoCloseMs};
  if(elapsed>=SELF_CARE_SLEEP_RULES.stillAsleepPromptMs)return {phase:'confirm',reason:'long',elapsed,suggestWake:selfCareSuggestedWake(a.startedAt)};
  return {phase:'asleep',elapsed,cancelable:selfCareSleepCancelable()};
}
/* The next usual wake time after `startMs`. */
function selfCareSuggestedWake(startMs){
  const wake=selfCareTimeToMinutes(selfCareSettings().sleep.wake)??420,d=new Date(startMs);
  d.setHours(Math.floor(wake/60),wake%60,0,0);
  if(d.getTime()<=startMs)d.setDate(d.getDate()+1);
  return Math.min(d.getTime(),Date.now());
}
function selfCareLastNight(){
  const t=todayISO(),y=addDays(t,-1);
  const date=selfCareNightHours(t)>0||Number(state.daily.sleep||0)>0?t:y;
  const hours=date===t?Number(state.daily.sleep||0):Number((selfCareDayRow(y)||{}).sleep||0);
  const row=(state.sleep&&state.sleep.ledger&&state.sleep.ledger[date])||{};
  const quality=date===t?v023NormalizeSleepQuality(state.daily.sleepQuality):(row.quality||'');
  return {date,hours:hours>0?hours:null,quality};
}

/* ------------------------------------------------------------------ */
/* 5. Vigil (opt-in, timer only, no reward scaling)                    */
/* ------------------------------------------------------------------ */

/* Finalises an active Vigil whose planned end has passed. Nothing accrues
   beyond the planned end: the entry is closed AT the planned end. */
function selfCareVigilTick(){
  const v=ensureSelfCare().vigil,a=v.active;
  if(a&&!a.pausedAt&&Date.now()>=a.plannedEnd){
    v.history.push({id:a.id,startedAt:a.startedAt,endedAt:a.plannedEnd,plannedHours:a.plannedHours,keptHours:a.plannedHours,completed:true});
    v.active=null;v.feastPending=true;save();
  }
  return v.active;
}
function selfCareVigilStart(hours){
  const v=ensureSelfCare().vigil;
  if(!selfCareEnabled('vigil')||v.active)return false;
  hours=Number(hours);
  if(!Number.isFinite(hours)||hours<SELF_CARE_VIGIL.minHours||hours>SELF_CARE_VIGIL.maxHours)return false;/* hard cap 24 h */
  const now=Date.now();
  v.active={id:uid(),startedAt:now,plannedHours:hours,plannedEnd:now+hours*3600000};
  save();return true;
}
/* Ending early is recorded neutrally: "Vigil ended at 13 h". No penalty, no
   failure wording, nothing lost. */
function selfCareVigilEnd(){
  const v=ensureSelfCare().vigil;
  selfCareVigilTick();
  const a=v.active;
  if(!a)return null;
  const now=Date.now(),kept=selfCareClamp(((a.pausedAt||now)-a.startedAt-Number(a.pausedMs||0))/3600000,0,a.plannedHours);
  const entry={id:a.id,startedAt:a.startedAt,endedAt:now,plannedHours:a.plannedHours,keptHours:selfCareRound(kept,1),completed:false};
  v.history.push(entry);v.active=null;save();
  return entry;
}
/* Pause / Resume (Compact Home Trackers V1 §7). Pausing freezes the countdown; resuming pushes the planned end back by the
   time spent paused, so the remaining time is exactly what it was. Paused time never counts toward the kept hours. */
function selfCareVigilRemaining(a,now=Date.now()){return a?Math.max(0,a.plannedEnd-(a.pausedAt||now)):0}
function selfCareVigilPause(){
  const a=selfCareVigilTick();
  if(!a||a.pausedAt)return false;
  a.pausedAt=Date.now();save();return true;
}
function selfCareVigilResume(){
  const a=selfCareVigilTick();
  if(!a||!a.pausedAt)return false;
  const gap=Math.max(0,Date.now()-a.pausedAt);
  a.plannedEnd+=gap;a.pausedMs=Number(a.pausedMs||0)+gap;a.pausedAt=null;save();return true;
}
/* Manual entry of a Vigil that already happened. Whole hours or halves, 1-24 h, must have ended already, must not overlap the
   active one. A logged Vigil counts like any finished one (consistency counts completions, never length) but sets no Feast. */
function selfCareVigilLog(startMs,hours){
  const v=ensureSelfCare().vigil;
  hours=Number(hours);startMs=Number(startMs);
  if(!selfCareEnabled('vigil')||!Number.isFinite(startMs)||!Number.isFinite(hours)||hours<SELF_CARE_VIGIL.minHours||hours>SELF_CARE_VIGIL.maxHours)return null;
  const end=startMs+hours*3600000;
  if(end>Date.now())return null;
  if(v.active&&startMs<v.active.plannedEnd&&end>v.active.startedAt)return null;
  const entry={id:uid(),startedAt:startMs,endedAt:end,plannedHours:hours,keptHours:selfCareRound(hours,1),completed:true,manual:true};
  v.history.push(entry);
  v.history.sort((a,b)=>a.endedAt-b.endedAt);
  save();return entry;
}
function selfCareVigilLabel(entry){return entry.completed?'Vigil kept':`Vigil ended at ${Math.round(entry.keptHours)} h`}
/* Consistency counts completions, never length (Lyra §8). */
function selfCareVigilsKept(){return ensureSelfCare().vigil.history.filter(x=>x.completed).length}
/* Gentle reminder instead of any reward prompt (Tally §2.4). */
function selfCareCareNote(){
  const ln=selfCareLastNight(),food=selfCareSettings().food;
  const poorSleep=ln.quality==='Poor';
  const y=selfCareDayRow(addDays(todayISO(),-1));
  const lowFood=food.enabled&&food.mode==='macros'&&food.calMin!=null&&y&&Number(y.calories||0)>0&&Number(y.calories)<food.calMin;
  return poorSleep||lowFood?'Take care of yourself today.':'';
}

/* ------------------------------------------------------------------ */
/* 6. Meters (Hydration / Satiety / Rest, 0-100, cosmetic at Home)     */
/* ------------------------------------------------------------------ */

/* Merged asleep intervals inside [fromMs,toMs]: real sessions (naps included)
   plus the active one when the Sleep module is in use, otherwise the usual
   bedtime/wake window from Settings. */
function selfCareSleepInUse(){
  const s=ensureSelfCare(),cut=Date.now()-72*3600000;
  return selfCareEnabled('sleep')&&(Boolean(s.sleep.active)||s.sleep.sessions.some(x=>x.endedAt>=cut));
}
function selfCareAsleepIntervals(fromMs,toMs){
  const s=ensureSelfCare(),out=[];
  const add=(a,b)=>{a=Math.max(a,fromMs);b=Math.min(b,toMs);if(b>a)out.push([a,b])};
  if(selfCareSleepInUse()){
    s.sleep.sessions.forEach(x=>add(x.startedAt,x.endedAt));
    if(s.sleep.active)add(s.sleep.active.startedAt,toMs);
  }else{
    const st=s.settings.sleep,bed=selfCareTimeToMinutes(st.bedtime)??1380,wake=selfCareTimeToMinutes(st.wake)??420;
    const day=new Date(fromMs);day.setHours(0,0,0,0);day.setDate(day.getDate()-1);
    for(let i=0;i<40&&day.getTime()<=toMs;i++,day.setDate(day.getDate()+1)){
      const a=new Date(day);a.setHours(Math.floor(bed/60),bed%60,0,0);
      const b=new Date(day);b.setDate(b.getDate()+(wake<=bed?1:0));b.setHours(Math.floor(wake/60),wake%60,0,0);
      add(a.getTime(),b.getTime());
    }
  }
  out.sort((x,y)=>x[0]-y[0]);
  const merged=[];
  out.forEach(iv=>{const l=merged[merged.length-1];if(l&&iv[0]<=l[1])l[1]=Math.max(l[1],iv[1]);else merged.push(iv.slice())});
  return merged;
}
function selfCareVigilIntervals(fromMs,toMs){
  const v=ensureSelfCare().vigil,out=[];
  v.history.forEach(h=>{const a=Math.max(h.startedAt,fromMs),b=Math.min(h.endedAt,toMs);if(b>a)out.push([a,b])});
  if(v.active){const a=Math.max(v.active.startedAt,fromMs),b=Math.min(Math.min(v.active.plannedEnd,toMs),toMs);if(b>a)out.push([a,b])}
  return out;
}
const selfCareOverlap=(a,b,ivs)=>ivs.reduce((n,[x,y])=>n+Math.max(0,Math.min(b,y)-Math.max(a,x)),0);
/* Chronological integration with the 0..100 clamp applied per segment, so a
   full night's refill followed by a day awake behaves like the real thing. */
function selfCareMeterCompute(key,value,fromMs,toMs){
  if(toMs<=fromMs)return value;
  const asleep=selfCareAsleepIntervals(fromMs,toMs),vig=key==='satiety'?selfCareVigilIntervals(fromMs,toMs):[];
  const restPerHour=100/selfCareSleepTargetHours();
  const segs=[];let cur=fromMs;
  asleep.forEach(([a,b])=>{if(a>cur)segs.push([cur,a,false]);segs.push([a,b,true]);cur=b});
  if(cur<toMs)segs.push([cur,toMs,false]);
  let v=value;
  segs.forEach(([a,b,sl])=>{
    let hours=(b-a)/3600000;
    if(key==='satiety')hours-=selfCareOverlap(a,b,vig)/3600000;/* Satiety doesn't drain during a Vigil */
    if(key==='rest')v+=sl?hours*restPerHour:hours*SELF_CARE_DRAIN.awake;
    else v+=hours*(sl?SELF_CARE_DRAIN.asleep:SELF_CARE_DRAIN.awake);
    v=selfCareClamp(v,0,100);
  });
  return v;
}
const SELF_CARE_METER_PART={hydration:'water',satiety:'food',rest:'sleep'};
function selfCareMeterRead(key,nowMs=Date.now()){
  const part=SELF_CARE_METER_PART[key];
  if(!selfCareEnabled(part))return {key,value:SELF_CARE_METER_NEUTRAL,enabled:false};/* a disabled part is neutral: locked at 70, never drains */
  const m=ensureSelfCare().meters[key];
  return {key,value:selfCareRound(selfCareMeterCompute(key,m.v,m.at,nowMs),0),enabled:true};
}
function selfCareMeterSettle(key){
  const s=ensureSelfCare(),m=s.meters[key],now=Date.now();
  if(!selfCareEnabled(SELF_CARE_METER_PART[key])){m.v=SELF_CARE_METER_NEUTRAL;m.at=now;return m.v}
  m.v=selfCareMeterCompute(key,m.v,m.at,now);m.at=now;return m.v;
}
function selfCareMeterAdd(key,amount){
  const s=ensureSelfCare();
  if(!selfCareEnabled(SELF_CARE_METER_PART[key]))return;
  selfCareMeterSettle(key);
  s.meters[key].v=selfCareClamp(s.meters[key].v+Number(amount||0),0,100);/* capped at 100: more is never rewarded */
}

/* ------------------------------------------------------------------ */
/* 7. Habits Home module (3x3) -- canonical records are PG trackers    */
/* ------------------------------------------------------------------ */

function habitsAll(){return ensurePersonalGrowth().trackers}
function habitsById(id){return habitsAll().find(t=>String(t.id)===String(id))||null}
function habitsHomeSlots(){
  const s=ensureSelfCare(),ids=new Set(habitsAll().map(t=>String(t.id)));
  const slots=Array.from({length:HABITS_HOME_SLOT_COUNT},(_,i)=>{const v=s.habits.slots[i];return v!=null&&ids.has(String(v))?String(v):null});
  const seen=new Set();
  slots.forEach((v,i)=>{if(v!=null){if(seen.has(v))slots[i]=null;else seen.add(v)}});
  s.habits.slots=slots;
  return slots;
}
function habitsHomeAssign(index,trackerId){
  const slots=habitsHomeSlots();
  if(index<0||index>=HABITS_HOME_SLOT_COUNT||!habitsById(trackerId))return false;
  const dup=slots.indexOf(String(trackerId));if(dup!==-1)slots[dup]=null;
  slots[index]=String(trackerId);save();return true;
}
/* Removing from Home never deletes the habit. Returns what was there (undo). */
function habitsHomeRemove(index){
  const slots=habitsHomeSlots(),prev=slots[index]||null;
  if(prev==null)return null;
  slots[index]=null;save();return prev;
}
function habitsHomeMove(from,to){
  const slots=habitsHomeSlots();
  if(from===to||from<0||to<0||from>=HABITS_HOME_SLOT_COUNT||to>=HABITS_HOME_SLOT_COUNT)return false;
  [slots[from],slots[to]]=[slots[to],slots[from]];save();return true;
}
function habitsQuickAmount(t){
  const q=Number(t.quickAmount);
  if(q>0)return q;
  return t.method==='duration'?HABITS_QUICK_DEFAULT_MIN:1;
}
/* Per-tile numbers: everything is derived from the tracker's own entries and
   the existing PG streak/scheduling helpers -- no second copy of habit data. */
function habitsTileModel(t,date=todayISO()){
  const v=t.entries?t.entries[date]:undefined,goal=Number(t.goal)||0;
  const value=t.method==='completion'?(v?1:0):Number(v||0);
  const done=t.method==='completion'?Boolean(v):(goal>0?value>=goal:value>0);
  const ring=t.method==='completion'?(v?100:0):(goal>0?selfCareClamp(value/goal*100,0,100):(value>0?100:0));
  const cat=PERSONAL_GROWTH_CATEGORIES[t.category]||PERSONAL_GROWTH_CATEGORIES.personalGoals;
  return {id:String(t.id),name:t.name,glyph:cat.icon,catKey:PERSONAL_GROWTH_CATEGORIES[t.category]?t.category:'personalGoals',value,goal,unit:t.unit||'',method:t.method,done,ring,streak:pgTrackerStats(t).current,scheduled:pgScheduledOn(t,date),linked:t.link&&['training','movement'].includes(t.link.type)?t.link.type:null};
}
/* Tap: yes/no toggles today; timed/numeric adds the habit's quick amount; a
   linked habit opens Training or Movement instead. Returns an undo token. No
   XP of any kind is issued (Habit XP is Phase B, gated on G3). */
function habitsTap(id,date=todayISO()){
  const t=habitsById(id);
  if(!t)return null;
  if(t.link&&t.link.type==='training')return {action:'open',target:'training'};
  if(t.link&&t.link.type==='movement')return {action:'open',target:'movement'};
  t.entries=t.entries||{};
  const before=t.entries[date];
  if(t.method==='completion')t.entries[date]=!Boolean(before);
  else t.entries[date]=selfCareRound(Number(before||0)+habitsQuickAmount(t));
  save();
  return {action:'logged',id:String(t.id),date,before,after:t.entries[date]};
}
function habitsUndo(token){
  if(!token||token.action!=='logged')return false;
  const t=habitsById(token.id);
  if(!t)return false;
  if(token.before===undefined)delete t.entries[token.date];else t.entries[token.date]=token.before;
  save();return true;
}

/* ------------------------------------------------------------------ */
/* 8. Mind / Social -> Habits migration (one-time, idempotent)         */
/* ------------------------------------------------------------------ */

const SELF_CARE_MIND_MAP={
  mindfulness:{name:'Meditation',category:'wellbeing',goal:10,stat:'WIS'},
  reading:{name:'Reading',category:'learning',goal:30,stat:'INT'},
  writing:{name:'Writing',category:'learning',goal:20,stat:'INT'},
  puzzles:{name:'Puzzles',category:'learning',goal:15,stat:'INT'}
};
const SELF_CARE_SOCIAL_HABIT={name:'Quality Time',category:'social',goal:30,stat:'CHA'};
function selfCareHabitFor(spec,created){
  const pg=ensurePersonalGrowth();
  let t=pg.trackers.find(x=>x.migratedFrom===spec.name)||pg.trackers.find(x=>String(x.name).trim().toLowerCase()===spec.name.toLowerCase()&&x.method==='duration');
  if(!t){
    t={id:uid()+created.length,name:spec.name,category:spec.category,method:'duration',goal:spec.goal,unit:'min',frequency:'daily',scheduledDays:[0,1,2,3,4,5,6],favorite:false,entries:{},createdAt:todayISO(),migratedFrom:spec.name,statTag:spec.stat,quickAmount:10};
    pg.trackers.push(t);created.push(t.id);
  }
  return t;
}
/* Entries merge with max(existing, migrated) per date, so a habit the player
   already tracks by hand is never double-counted; each date is written once. */
function selfCareMergeEntry(t,date,minutes){
  minutes=selfCareRound(minutes);
  if(!(minutes>0))return false;
  t.entries=t.entries||{};
  const cur=Number(t.entries[date]||0);
  if(cur>=minutes)return false;
  t.entries[date]=minutes;return true;
}
function selfCareMigrateMindSocial(){
  const s=ensureSelfCare();
  if(s.migrations.mindSocial&&s.migrations.mindSocial.done)return {alreadyDone:true};
  const created=[],report={mind:0,social:0,walkSkipped:0,residual:0};
  const hist=Array.isArray(state.mindfulnessHistory)?state.mindfulnessHistory:[];
  const perDate={};/* date -> activity -> minutes */
  hist.forEach(h=>{
    if(!h||!h.date)return;
    if(h.activity==='walk'){report.walkSkipped++;return}/* walks belong to Movement, not Habits */
    const spec=SELF_CARE_MIND_MAP[h.activity]?h.activity:'mindfulness';
    perDate[h.date]=perDate[h.date]||{};perDate[h.date][spec]=(perDate[h.date][spec]||0)+Math.max(0,Number(h.minutes||0));
  });
  Object.keys(perDate).forEach(date=>Object.keys(perDate[date]).forEach(k=>{if(selfCareMergeEntry(selfCareHabitFor(SELF_CARE_MIND_MAP[k],created),date,perDate[date][k]))report.mind++}));
  /* Daily totals with no detailed history behind them become one Meditation entry. */
  const rows=[...(state.resourceHistory||[]),{date:todayISO(),...state.daily}];
  rows.forEach(r=>{
    const total=Number(r.mindfulness??((Number(r.reading||0)+Number(r.mindful||0))))||0;
    const covered=Object.values(perDate[r.date]||{}).reduce((n,x)=>n+x,0);
    const residual=total-covered;
    if(residual>0&&selfCareMergeEntry(selfCareHabitFor(SELF_CARE_MIND_MAP.mindfulness,created),r.date,residual)){report.residual++;report.mind++}
    const social=Number(r.socialMinutes??r.social??0)||0;
    if(social>0&&selfCareMergeEntry(selfCareHabitFor(SELF_CARE_SOCIAL_HABIT,created),r.date,social))report.social++;
  });
  s.migrations.mindSocial={done:true,at:new Date().toISOString(),createdHabitIds:created,report};
  /* Fill the empty Home 3x3 with the migrated habits so they stay visible. */
  const slots=habitsHomeSlots();
  created.forEach(id=>{const i=slots.indexOf(null);if(i!==-1)slots[i]=String(id)});
  save();
  return {done:true,created,report};
}

/* ------------------------------------------------------------------ */
/* 9. Summaries (Hub card line, History, Streaks & Records)            */
/* ------------------------------------------------------------------ */

function selfCareHubLine(){
  const bits=[];
  if(selfCareEnabled('water')){const w=selfCareWaterView();bits.push(w.met?'Hydrated':`${(w.ml/1000).toFixed(1)}/${(w.target/1000).toFixed(1)} L`)}
  if(selfCareEnabled('food')){const f=selfCareSettings().food;if(f.mode==='meals'){bits.push(`${selfCareFoodStatus().mains||0}/3 meals`)}else{const c=Math.round(Number(state.daily.calories||0));bits.push(`${c.toLocaleString()} kcal`)}}
  if(selfCareEnabled('sleep')){const ln=selfCareLastNight();bits.push(ln.hours!=null?`${ln.hours.toFixed(1)} h`:'no sleep logged')}
  return bits.length?bits.join(' · '):'All parts switched off';
}
/* Day-by-day rows, newest first, from the archives that already exist. */
function selfCareHistoryRows(limit=30){
  const s=ensureSelfCare(),today=todayISO();
  const dates=new Set([today,...(state.resourceHistory||[]).map(r=>r.date),...Object.keys(s.meals),...s.sleep.sessions.map(x=>x.wakeDate),...s.vigil.history.map(x=>selfCareLocalDate(x.endedAt))]);
  return [...dates].filter(d=>d<=today).sort().reverse().slice(0,limit).map(date=>{
    const row=selfCareDayRow(date)||{},waterTarget=Number(row.waterTarget||state.profile.waterTarget||2500);
    return {
      date,
      water:selfCareEnabled('water')?{ml:Math.round(Number(row.water||0)),met:Number(row.water||0)>=waterTarget}:null,
      food:selfCareEnabled('food')?{...selfCareFoodStatus(date),calories:Math.round(Number(row.calories||0)),meals:selfCareMealsFor(date)}:null,
      sleep:selfCareEnabled('sleep')?{hours:Number(row.sleep||0)>0?selfCareRound(Number(row.sleep)):null,win:Number(row.sleep||0)>0?selfCareSleepWin(Number(row.sleep)):null,sessions:s.sleep.sessions.filter(x=>x.wakeDate===date)}:null,
      vigils:selfCareEnabled('vigil')?s.vigil.history.filter(x=>selfCareLocalDate(x.endedAt)===date):[]
    };
  });
}
function selfCareStreak(rows,pred){
  /* rows newest-first; pred -> true | false | null. null = no data = UNKNOWN,
     which neither extends nor breaks a streak (missing logs are never a miss).
     current: consecutive true days from the newest known day back to the
     first known false. best/total run chronologically. */
  let best=0,run=0,total=0,current=0;
  rows.slice().reverse().forEach(r=>{const v=pred(r);if(v===true){run++;total++;best=Math.max(best,run)}else if(v===false)run=0});
  for(const r of rows){const v=pred(r);if(v===true)current++;else if(v===false)break}
  return {current,best,total};
}
function selfCareRecords(){
  const rows=selfCareHistoryRows(120);
  return {
    water:selfCareEnabled('water')?selfCareStreak(rows,r=>r.water?r.water.met:null):null,
    food:selfCareEnabled('food')?selfCareStreak(rows,r=>r.food&&r.food.met!==null?r.food.met:null):null,
    sleep:selfCareEnabled('sleep')?selfCareStreak(rows,r=>r.sleep&&r.sleep.win!==null?r.sleep.win:null):null,
    vigilsKept:selfCareEnabled('vigil')?selfCareVigilsKept():null
  };
}

/* Load-time: create defaults and run the one-time migration before the first
   render. Idempotent; the migration marker prevents any repeat. */
(function selfCareBoot(){
  ensureSelfCare();
  selfCareMigrateMindSocial();
  selfCareVigilTick();
  save();
})();
