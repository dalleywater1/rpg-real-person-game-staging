/* Hidden Sleep achievements — privacy isolation (Self Care & Habits V1,
   "NOW" item; Lyra's handover §7, Tally §8; Astra 2026-09-25, RPG-0094).

   THE RULE (Lyra §7, the strictest in that handover): the Sleep pop-up's
   free "Other" text may be used for TRANSIENT LOCAL DETECTION ONLY.

       typed text -> in-memory match -> increment only opaque achievement
       progress -> discard the text and the match immediately

   This file is the ONLY place that ever sees that text. What it may keep,
   and where:
     - a running count for the Sex series and one for the Masturbation
       series, and a set of "this achievement's phrase list has matched"
       flags for the 15 SLP-HID achievements -- i.e. exactly the minimum the
       existing Achievement engine needs to evaluate a threshold;
     - a single `lastNight` date so re-saving the same night cannot count it
       twice.
   All of it lives in a SEPARATE, LOCAL-ONLY localStorage key
   (SLEEP_HIDDEN_STORE_KEY), deliberately NOT inside `state`: `state` is the
   object that is saved, exported and (later) synced, and the handover says
   these counters must not automatically join a future cloud sync.

   What is never persisted, synced, logged or transmitted, anywhere: the
   text, a sex/masturbation reason flag, the matched keyword, the inferred
   category, the classification result, or an event saying why progress
   moved. sleepHiddenIngest() returns nothing so no caller can even hold the
   result; nothing here calls console, toast, fetch or beacon; the text
   parameter is overwritten before the function returns.

   Legacy saves: earlier builds DID store `otherText` and 'sex' /
   'masturbation' reason flags in the sleep ledger, `state.daily` and the
   shared-event log. sleepHiddenMigrateLegacy() reads those ONCE to carry the
   player's existing progress across into the local-only store, then scrubs
   every trace of them from `state`. Achievements already unlocked stay
   unlocked; only the unlock record (id + time) remains in `state`, which the
   engine needs. */

const SLEEP_HIDDEN_STORE_KEY='rpg_local_only_sleep_hidden_v1';

/* Internal constant, never rendered in any UI (Tally §8 item 6). Words that
   were left out on purpose because they fire on innocent nights: "fucked"
   (as in "sleep was fucked"), "kos" / "hygget oss", "busy", "solo" on its
   own, "elsker". */
const SLEEP_HIDDEN_KEYWORDS={
  sex:[
    'sex','had sex','having sex','sexy time','sexytime','made love','making love','make love','lovemaking',
    'intimate','intimacy','shag','shagged','shagging','bonk','bonked','bonking','boink','boinked','nookie',
    'whoopee','quickie','got lucky','getting lucky','hooked up','hook up','netflix and chill','round two',
    'horizontal tango','bedroom fun','the deed','coitus',
    'hadde sex','knulle','knulla','knullet','knulling','pule','pulte','pulet','puling','elsket med',
    'ligget med','lå med','ligge med','hyrdestund','et nummer','voksenkos','sengekos'
  ],
  masturbation:[
    'masturbation','masturbate','masturbated','masturbating','wank','wanked','wanking','jerk off','jerked off',
    'jerking off','jack off','jacked off','beat off','fap','fapped','fapping','touched myself','self-love',
    'self love','solo session','rubbed one out','flicked the bean','spanked the monkey','choked the chicken',
    'onani','onanere','onanerte','onanert','runke','runka','runket','runking','tok meg en runk',
    'fingret meg','selvkjærlighet','kose med meg selv'
  ]
};
/* "no / not / didn't / ikke / ingen" within the two words before a match
   cancels that match (apostrophes are stripped before comparing). */
const SLEEP_HIDDEN_NEGATIONS=new Set(['no','not','didnt','ikke','ingen']);

/* ------------------------------------------------------------------ */
/* Matching (pure, in memory)                                          */
/* ------------------------------------------------------------------ */

function sleepHiddenNormalize(s){
  return String(s||'').toLowerCase()
    .replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a')
    .replace(/['’`´]/g,'')
    .replace(/\s+/g,' ');
}
const __sleepHiddenRegexCache=new Map();
function sleepHiddenPhraseRegex(phrase){
  const key=String(phrase);
  let re=__sleepHiddenRegexCache.get(key);
  if(!re){
    const p=sleepHiddenNormalize(phrase).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+');
    re=new RegExp(`(^|[^a-z0-9])(${p})(?=[^a-z0-9]|$)`,'g');
    __sleepHiddenRegexCache.set(key,re);
  }
  re.lastIndex=0;
  return re;
}
/* True if `phrase` occurs as a whole word/phrase in the already-normalised
   text at least once WITHOUT a negation in the two words before it. */
function sleepHiddenHas(normText,phrase){
  const re=sleepHiddenPhraseRegex(phrase);
  let m;
  while((m=re.exec(normText))){
    const start=m.index+m[1].length;
    const before=normText.slice(0,start).split(/[^a-z0-9]+/).filter(Boolean).slice(-2);
    if(!before.some(w=>SLEEP_HIDDEN_NEGATIONS.has(w)))return true;
    if(m[0].length===0)re.lastIndex++;
  }
  return false;
}
function sleepHiddenAny(normText,list){return list.some(p=>sleepHiddenHas(normText,p))}
/* -> {sex:boolean, mas:boolean, hid:[achievementId,...]}. Both series can
   match the same night; each SLP-HID definition matches on its own words. */
function sleepHiddenMatch(text){
  const t=sleepHiddenNormalize(text);
  const hidDefs=(typeof V023_SLEEP_HIDDEN_DEFINITIONS!=='undefined')?V023_SLEEP_HIDDEN_DEFINITIONS:[];
  return {
    sex:sleepHiddenAny(t,SLEEP_HIDDEN_KEYWORDS.sex),
    mas:sleepHiddenAny(t,SLEEP_HIDDEN_KEYWORDS.masturbation),
    hid:hidDefs.filter(d=>sleepHiddenAny(t,d.triggerWords||[])).map(d=>d.achievementId)
  };
}

/* ------------------------------------------------------------------ */
/* Local-only store                                                    */
/* ------------------------------------------------------------------ */

function sleepHiddenStoreRead(){
  let s=null;
  try{s=JSON.parse(localStorage.getItem(SLEEP_HIDDEN_STORE_KEY)||'null')}catch(e){s=null}
  if(!s||typeof s!=='object')s={};
  return {
    v:1,
    sex:Math.max(0,Number(s.sex||0)),
    mas:Math.max(0,Number(s.mas||0)),
    hid:(s.hid&&typeof s.hid==='object'&&!Array.isArray(s.hid))?s.hid:{},
    lastNight:typeof s.lastNight==='string'?s.lastNight:'',
    migrated:Boolean(s.migrated)
  };
}
function sleepHiddenStoreWrite(s){
  try{localStorage.setItem(SLEEP_HIDDEN_STORE_KEY,JSON.stringify(s))}catch(e){/* storage unavailable: progress simply does not persist; never surfaced */}
}
/* Read side, used by the Achievement engine's evaluators. */
function sleepHiddenCounter(kind){const s=sleepHiddenStoreRead();return kind==='sex'?s.sex:kind==='mas'?s.mas:0}
function sleepHiddenMatched(achievementId){return Boolean(sleepHiddenStoreRead().hid[achievementId])}

/* ------------------------------------------------------------------ */
/* Ingest -- the only entry point for the typed text                   */
/* ------------------------------------------------------------------ */

/* rawText -> transient match -> opaque progress -> discard. Only a night of
   INSUFFICIENT sleep can count. `hours` must be the AGGREGATED non-nap night
   total for the wake day (a split night is one night -- the caller passes the
   total, never the length of the one session that opened the dialog) and
   `target` the night's frozen minimum. Returns nothing on purpose. */
function sleepHiddenIngest(rawText,{date,hours,target}={}){
  let text=rawText;rawText=null;
  let match=null;
  try{
    if(!String(text||'').trim()||!date)return;
    /* DIRECTIONAL (Lyra 2026-09-25): this series is about INSUFFICIENT sleep.
       night total < frozen minimum -> may evaluate; over the range's max or
       inside the range -> never increments it. Deliberately NOT the generic
       "!targetMet", which now also means "slept too long". Missing/invalid
       numbers never count. */
    if(!(Number(hours)<Number(target)))return;
    const store=sleepHiddenStoreRead();
    if(store.lastNight===date)return;/* this night was already counted */
    match=sleepHiddenMatch(text);
    if(!match.sex&&!match.mas&&!match.hid.length)return;
    if(match.sex)store.sex+=1;
    if(match.mas)store.mas+=1;
    match.hid.forEach(id=>{store.hid[id]=true});
    store.lastNight=date;
    sleepHiddenStoreWrite(store);
  }finally{
    text=null;match=null;/* discard the text and the inferred match */
  }
}

/* ------------------------------------------------------------------ */
/* One-time migration + scrub of pre-existing data                     */
/* ------------------------------------------------------------------ */

const SLEEP_HIDDEN_SAFE_REASONS=['children','other'];
function sleepHiddenSanitizeReasons(reasons){
  return (Array.isArray(reasons)?reasons:[]).filter(r=>SLEEP_HIDDEN_SAFE_REASONS.includes(r));
}
/* Idempotent. First run (per device) folds legacy progress into the local
   store; every run removes any sensitive residue from `state`. */
function sleepHiddenMigrateLegacy(){
  if(typeof state==='undefined'||!state)return false;
  let changed=false;
  const store=sleepHiddenStoreRead();
  const ledger=state.sleep&&state.sleep.ledger&&typeof state.sleep.ledger==='object'?state.sleep.ledger:{};
  if(!store.migrated){
    let sexNights=0,masNights=0;
    Object.values(ledger).forEach(r=>{
      if(!r||!r.date)return;
      /* directional: only a night BELOW its frozen minimum was an insufficient-sleep night
         (a row with no usable hours/target falls back to its legacy min-based flag) */
      const rh=Number(r.hours),rt=Number(r.targetAtFinalization);
      const insufficient=(Number.isFinite(rh)&&Number.isFinite(rt)&&rt>0)?rh<rt:!r.targetMet;
      const missed=insufficient&&(r.finalized||r.date<todayISO());
      if(!missed)return;
      const flags=Array.isArray(r.reasons)?r.reasons:[];
      let sex=flags.includes('sex'),mas=flags.includes('masturbation');
      if(r.otherText){
        const m=sleepHiddenMatch(r.otherText);
        sex=sex||m.sex;mas=mas||m.mas;
        m.hid.forEach(id=>{store.hid[id]=true});
      }
      if(sex)sexNights++;
      if(mas)masNights++;
    });
    /* Never lower progress a device already holds. */
    store.sex=Math.max(store.sex,sexNights);
    store.mas=Math.max(store.mas,masNights);
    /* Tonight's not-yet-finalised entry, typed before this upgrade. */
    const d=state.daily||{};
    const todayTarget=Number(state.profile&&state.profile.sleepTarget||8);
    if(String(d.sleepReasonOtherText||'').trim()||(Array.isArray(d.sleepReasons)&&(d.sleepReasons.includes('sex')||d.sleepReasons.includes('masturbation')))){
      if(Number(d.sleep||0)<todayTarget){
        const m=sleepHiddenMatch(d.sleepReasonOtherText||'');
        const flags=Array.isArray(d.sleepReasons)?d.sleepReasons:[];
        if(m.sex||flags.includes('sex'))store.sex+=1;
        if(m.mas||flags.includes('masturbation'))store.mas+=1;
        m.hid.forEach(id=>{store.hid[id]=true});
        store.lastNight=todayISO();
      }
    }
    store.migrated=true;
    sleepHiddenStoreWrite(store);
  }
  /* ---- scrub `state` (runs every time; harmless when already clean) ---- */
  Object.values(ledger).forEach(r=>{
    if(!r)return;
    if('otherText' in r){delete r.otherText;changed=true}
    if(Array.isArray(r.reasons)){
      const safe=sleepHiddenSanitizeReasons(r.reasons);
      if(safe.length!==r.reasons.length){r.reasons=safe;changed=true}
    }
  });
  if(state.sleep){
    ['sexReasonCount','masReasonCount'].forEach(k=>{if(k in state.sleep){delete state.sleep[k];changed=true}});
  }
  if(state.daily){
    if(state.daily.sleepReasonOtherText){state.daily.sleepReasonOtherText='';changed=true}
    if(Array.isArray(state.daily.sleepReasons)){
      const safe=sleepHiddenSanitizeReasons(state.daily.sleepReasons);
      if(safe.length!==state.daily.sleepReasons.length){state.daily.sleepReasons=safe;changed=true}
    }
  }
  if(Array.isArray(state.sharedEvents)){
    const before=state.sharedEvents.length;
    state.sharedEvents=state.sharedEvents.filter(e=>!(e&&e.type==='sleepDailyUpdated'));
    if(state.sharedEvents.length!==before)changed=true;
    /* RPG-0056: the achievement engine keeps its own processed-event list; old sleep ids there are hashes of
       hours/quality/reasons that once included the sensitive flags (brute-forceable), so they go too */
    if(state.achievementEngine&&Array.isArray(state.achievementEngine.processedAchievementEvents)){
      const b3=state.achievementEngine.processedAchievementEvents.length;
      state.achievementEngine.processedAchievementEvents=state.achievementEngine.processedAchievementEvents.filter(k=>!String(k).includes('sleepDaily_'));
      if(state.achievementEngine.processedAchievementEvents.length!==b3)changed=true;
    }
    if(Array.isArray(state.processedEventIds)){
      const b2=state.processedEventIds.length;
      state.processedEventIds=state.processedEventIds.filter(k=>!String(k).includes('sleepDaily_'));
      if(state.processedEventIds.length!==b2)changed=true;
    }
  }
  /* Unlock records keep only what the engine needs (id + time); drop the
     source-event reference, which was derived from the text. */
  const ae=state.achievementEngine;
  if(ae&&Array.isArray(ae.unlockedAchievements)){
    ae.unlockedAchievements.forEach(u=>{
      if(u&&/^SLP-(SEX|MAS|HID)-/.test(String(u.achievementId))&&u.sourceEventId){u.sourceEventId=null;changed=true}
    });
  }
  return changed;
}
/* Run at load, before anything renders, and persist the scrub. */
if(sleepHiddenMigrateLegacy()&&typeof save==='function')save();
