/* RPG v0.02.15 — Home Widget Family: Player Status + Character Stats
   (Phase D, revised under the "Home UI Fidelity Correction" pass).

   REWRITE HISTORY (kept for context, not for re-litigating): the first
   version of this file built Player Status as a boxed rectangular
   "Hero card" using FRAME_HOME_PLAYER_STATUS.png as a nine-slice/full
   background container, with HP/Stamina/Damage/Defence/Focus rendered
   inside it. Lyra flagged this as having drifted from the originally
   approved Home concept (five reference mockups: a full Home screen,
   a labelled asset sheet, an environment-variant sheet, a cross-page
   sheet, and a dynamic-backgrounds sheet) and supplied them directly.
   Comparing against those mockups: Home was always meant to read as
   one immersive scenic page — portrait, level badge, identity text,
   help/settings and (per the asset sheet) side banners floating
   directly on the already-live BG_HOME_DAY/SUNSET/NIGHT/RAIN scenery,
   NOT boxed into a standalone dashboard card — with a single unified
   stats strip beneath, and the five detailed combat stats were never
   part of the hero at all. This version corrects both things: the
   Hero frame boxing is removed, and the five combat stats move to
   their own Home v2 module (Character Stats, see characterStatsHTML
   below), leaving Player Status with only identity/progression info.

   Variant 8's own file (v0.02.4.3-player-box.js) is left completely
   intact and still loads — this file's reassignment simply wins
   because it loads later in index.html. That keeps a clean rollback
   path until Variant 8's runtime references are confirmed dead and
   archived, matching the "migrate references first, archive only
   after confirmed dead" rule already used for the Project Cleanup
   Pass. */

function v0215HeroProgressHTML(label,file,value){
  return `<div class="hero-progress-item"><img src="${v0243V8Asset(file)}" alt=""><div><span>${esc(label)}</span><b>${esc(value)}</b></div></div>`;
}

/* Compact Weather card, floated inside the hero scene next to Player
   identity — Aurelia's Home Hero direction lock (2026-09-07): "Weather
   should float within the scenic hero as a compact parchment card on
   the right... it should not become a full-width standalone section...
   should not visually connect into one giant enclosing Player panel."
   Deliberately its own distinct card (own class, own parchment surface,
   not .weather-panel) rather than reusing the existing full-size
   Weather module's markup/CSS — that class carries a long chain of
   legacy home-variant / home-marble-correction overrides (see
   styles.css) built for a full-width standalone section, none of which
   apply to a small card floating inside another module. Same data
   sourcing as the full Weather module (currentWeatherView/
   runningConditions, both base app.js) — nothing new fetched or
   computed, same #weatherForecastTrigger id so the existing forecast-
   modal binding (bindWeatherForecastTrigger, called unconditionally by
   bindHome) keeps working unchanged. */
/* Mobile-only expanded Weather layout (2026-09-13, direct instruction —
   bigger text, each metric on its own line, icon where real art exists):
   v0215HeroWeatherCardHTML() below renders a SECOND, parallel set of
   .hero-weather-mobile-* nodes alongside the original .hero-weather-*
   ones, rather than restyling the originals in place, so the desktop/580
   Weather card (locked in Aurelia's Player HUD review) stays byte-
   identical — v0.02.26 CSS shows only one set per breakpoint via
   display:none, no JS branching needed, matching this file's existing
   CSS-only-responsive convention.
   No dedicated High/Low icon exists in the asset library (checked
   assets/icons/weather/ and assets/Home/V3/Weather/Icons/ — only per-
   condition icons like RAIN/WIND/SUN, nothing for a High/Low readout) —
   flagged rather than invented; uses a plain ⇅ glyph placeholder, same
   precedent as Gold's own 🪙 standing in before HUD_GOLD.png existed.
   Rain and Wind DO have real icons — the existing assets/icons/weather/
   ICON_WEATHER_RAIN.png/_WIND.png masters were 1254px/~1MB each (found
   live via naturalWidth after first wiring them in at 18px display
   size); generated real 80px/2x runtime exports (*-40px.png, same
   folder) rather than shipping the master at icon size, same "compress
   a runtime export, keep the master unreferenced" precedent already
   used for every other icon family in this project. */
function v0215HeroWeatherCardHTML(){
  const w=currentWeatherView(),run=runningConditions(w),showRun=state.profile.showRunningConditions!==false;
  const high=w.high==='--'?'--':Math.round(w.high), low=w.low==='--'?'--':Math.round(w.low);
  const rain=w.rain==='--'?'--':Math.round(w.rain), wind=w.wind==='--'?'--':Math.round(w.wind);
  return `<div class="hero-weather-card">
    <div class="hero-weather-hero-row">
      <img class="hero-weather-icon weather-forecast-trigger" id="weatherForecastTrigger" role="button" tabindex="0" aria-label="Open 5-day weather forecast" title="Open 5-day forecast" src="${asset(w.icon)}" alt="${esc(w.condition)}">
      <div class="hero-weather-headcol">
        <div class="hero-weather-location">${esc(w.location||state.profile.location||'Horten')}</div>
        <div class="hero-weather-temp">${w.temp==='--'?'--':Math.round(w.temp)}°</div>
      </div>
    </div>
    <div class="hero-weather-condition">${esc(w.condition)}</div>
    <div class="hero-weather-highlow">H${high}° / L${low}°</div>
    <div class="hero-weather-rainwind">${rain}% - ${wind}km/h</div>
    <div class="hero-weather-mobile-location">${esc(w.location||state.profile.location||'Horten')}</div>
    <div class="hero-weather-mobile-temp-row">
      <img class="hero-weather-mobile-icon" src="${asset(w.icon)}" alt="${esc(w.condition)}">
      <span class="hero-weather-mobile-temp">${w.temp==='--'?'--':Math.round(w.temp)}°</span>
    </div>
    <div class="hero-weather-mobile-condition">${esc(w.condition)}</div>
    <div class="hero-weather-mobile-metric">
      <span class="hero-weather-mobile-metric-glyph" aria-hidden="true">⇅</span>
      <span>H${high}° / L${low}°</span>
    </div>
    <div class="hero-weather-mobile-metric">
      <img class="hero-weather-mobile-metric-icon" src="${asset('icons/weather/ICON_WEATHER_RAIN-40px.png')}" alt="">
      <span>${rain}% Rain</span>
    </div>
    <div class="hero-weather-mobile-metric">
      <img class="hero-weather-mobile-metric-icon" src="${asset('icons/weather/ICON_WEATHER_WIND-40px.png')}" alt="">
      <span>${wind} km/h Wind</span>
    </div>
    ${showRun?`<div class="hero-weather-run2 ${run.cls}" title="${esc(run.note)}"><span class="run-glyph" data-running-state="${run.cls}" aria-hidden="true"></span><span>${esc(run.label)}</span></div>`:''}
  </div>`;
}

/* EXPERIMENT B (2026-09-08, user's own live "let me try something" pass —
   separate from and on hold pending Aurelia's own notes on the same Hero).
   Easiest possible revert: flip this to false (or delete this const and
   the branch below it in playerStatusHTML) and the original, currently-
   approved Hero layout comes straight back with zero other changes
   needed anywhere else in the file/CSS. Left as a real, readable branch
   rather than editing the approved markup in place, specifically so
   comparing the two or reverting doesn't require reconstructing anything
   from git history. */
const HOME_HERO_EXPERIMENT_B=true;
/* HERO GRID COMPOSITION (2026-09-08, round 3 — the user's own explicit
   layout matrix, given after seeing round 2 render by accident with
   Weather occupying the wrong column):
     [ PORTRAIT ] [ PLAYER NAME / CLASS ------------- ] [ SETTINGS ][ HELP ]
     [ PORTRAIT ] [ identity / longer-name space                     ]
     [ PORTRAIT ] [ XP ======== ] [ WEATHER ------------------------ ]
     [ STREAK   ][ TODAY ][ REWARD ][ WEATHER ------------------------ ]
   Explicit instruction: treat this as a defined layout matrix, not
   freely-flowing flex content — the SAME named zones stay in the same
   relationship at every breakpoint; only the column/row track SIZES
   change (see the media queries below), never the grid-template-areas
   structure itself. Implemented as a real CSS Grid with named areas
   (.home-hero-grid) for exactly that reason — areas are declared once,
   sizes vary per breakpoint. Settings/Help are NOT a grid item here
   (they're a separate, structurally-independent sibling element for
   reachability — see homeToolsHTML()); they float visually over the
   grid's own top-right corner instead. */
/* Round 4 (2026-09-08, same live experiment) — Streak/Today/Next Reward
   removed from the Hero grid entirely (freed row, "not needed on the
   home page" in the user's own words) and moved into a popup opened by
   tapping the portrait instead. Reuses the exact same data/markup
   (v0215HeroProgressHTML, same ps.streak/today/v0243NextReward() reads)
   — nothing about the underlying streak/today/reward logic changed,
   only where it's presented.
   Round 6 (2026-09-08, Aurelia's ruling): Player Status is now
   permanently locked visible (HOME_MODULE_ALWAYS_VISIBLE in app.js), so
   "we can safely move Help + Settings into the portrait popup with no
   fallback control needed" — added here as two plain action buttons,
   reusing the exact same #helpButton/#settingsButton ids and
   helpModal()/profileModal('profile') handlers bindHome() already
   wires up (guarded lookups — no binding changes needed anywhere). */
/* Player Information popup (renamed from "Streak & Rewards", 2026-09-11,
   user-requested): Experience is now its own section, separate from
   Streak/Today/Next Reward, with current Level/XP values shown (the
   "no XP text" rulings elsewhere in this file were about the Hero card
   and its own popup bar specifically -- this is a different, explicitly
   requested spot, so the numbers come back here). Experience is a real
   button -- tapping it opens v0215XpOverviewHTML() (last-gained feed +
   source breakdown), reusing the same xpLog data app.js now writes at
   every XP award site (see logXpGain() there). */
/* Active Effects section, Player Information popup (2026-09-11) — the
   full name/effect/type description counterpart to the icon-only Hero
   row above. Same state.statusEffects data, just the detailed view;
   renders nothing (not even the section heading) when nothing's
   active, matching the Hero's own "stay empty" behaviour. */
function v0215ActiveEffectHTML(effect){
  const type=effect.type==='debuff'?'debuff':'buff';
  const iconAsset=heroStatusEffectIconAsset(effect);
  const style=iconAsset?` style="--buff-icon:url('${iconAsset}')"`:'';
  return `<div class="active-effect-row ${type}">
    <span class="hero-status-icon ${type}"${style} aria-hidden="true"></span>
    <div class="active-effect-text"><b>${esc(effect.name||'Status')}</b><span>${esc(heroStatusEffectDescription(effect).split(' — ')[1]||(type==='debuff'?'Debuff':'Buff'))}</span></div>
  </div>`;
}
function v0215ActiveEffectsSectionHTML(){
  const list=Array.isArray(state.statusEffects)?state.statusEffects:[];
  if(!list.length)return '';
  return `<section class="player-info-section">
    <h3 class="player-info-section-title">Currently Active Buffs</h3>
    <div class="active-effects-list">${list.map(v0215ActiveEffectHTML).join('')}</div>
  </section>`;
}
function v0215ProgressPopupHTML(){
  const today=todayStatusSummary(),ps=state.playerStatus||{streak:0};
  const character=v0243CharacterSummary();
  const xpRequired=Math.max(1,Number(character.xpRequired||nextLevelCost()||1)),xp=Number(character.xp||0),xpPercent=pct(xp,xpRequired);
  const level=Math.round(Number(character.level||1));
  return `<div class="hero-progress-popup">
    <h2>Player Information</h2>
    <section class="player-info-section">
      <h3 class="player-info-section-title">Experience</h3>
      <button type="button" class="player-info-xp-row" id="playerInfoXpRow" aria-label="View Experience overview">
        <div class="player-info-xp-headline"><span>Level ${level}</span><b>${Math.round(xp)} / ${Math.round(xpRequired)} XP</b></div>
        <div class="hero-xp-bar" style="--p:${xpPercent}" role="progressbar" aria-label="XP" aria-valuemin="0" aria-valuemax="${Math.round(xpRequired)}" aria-valuenow="${Math.round(xp)}"><i></i></div>
        <span class="player-info-xp-chevron" aria-hidden="true">›</span>
      </button>
    </section>
    ${v0215ActiveEffectsSectionHTML()}
    <section class="player-info-section">
      <h3 class="player-info-section-title">Streaks &amp; Rewards</h3>
      <div class="hero-progression">
        ${v0215HeroProgressHTML('STREAK','Variant 8 - Streak.png',`${Math.max(0,Number(ps.streak||0))} day${Number(ps.streak||0)===1?'':'s'}`)}
        ${v0215HeroProgressHTML('TODAY','Variant 8 - Today.png',`${today.done} / ${today.total}`)}
        ${v0215HeroProgressHTML('NEXT REWARD','Variant 8 - Next Reward.png',v0243NextReward())}
      </div>
    </section>
    <div class="hero-progress-popup-tools">
      <button type="button" class="rpg-btn" id="helpButton">Help</button>
      <button type="button" class="rpg-btn" id="settingsButton">Settings</button>
    </div>
  </div>`;
}
function v0215OpenProgressPopup(){
  modal(v0215ProgressPopupHTML());
  const helpBtn=modalRoot.querySelector('#helpButton'),settingsBtn=modalRoot.querySelector('#settingsButton'),xpRow=modalRoot.querySelector('#playerInfoXpRow');
  if(helpBtn)helpBtn.onclick=helpModal;
  if(settingsBtn)settingsBtn.onclick=()=>profileModal('profile');
  if(xpRow)xpRow.onclick=v0215OpenXpOverview;
}
/* Experience overview (2026-09-11, user-requested "last gained
   Experience" + "where most experience is coming from"): reads
   state.xpLog, written by logXpGain() in app.js at every addOverallXP()
   call site (Main Quest, Side Quest, Trial of Wisdom, Daily Challenge,
   Training, custom side quests -- verified by reading each call site
   directly, not guessed). No data before this XP-tuning pass shipped --
   existing players will see an empty/short list until new XP is earned
   under the new logging, flagged rather than backfilled (there's
   nothing to backfill from; the amounts were never recorded before). */
function v0215XpFmtWhen(entry){
  const d=new Date(Number(entry.ts)||Date.parse(entry.date)||Date.now());
  return d.toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
function v0215XpOverviewHTML(){
  const log=Array.isArray(state.xpLog)?state.xpLog:[];
  const recent=log.slice(-15).reverse();
  const recentRows=recent.length?recent.map(e=>`<div class="xp-overview-row"><div class="xp-overview-row-main"><b>+${Math.round(Number(e.amount||0))} XP</b><span>${esc(e.source||e.category||'Other')}</span></div><small>${esc(v0215XpFmtWhen(e))}</small></div>`).join(''):'<p class="helper">No Experience gained yet under the new log — this fills in as you earn XP.</p>';
  const byCategory={};
  log.forEach(e=>{const cat=e.category||'Other';byCategory[cat]=(byCategory[cat]||0)+Number(e.amount||0)});
  const total=Object.values(byCategory).reduce((a,b)=>a+b,0);
  const sorted=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]);
  const sourceRows=sorted.length?sorted.map(([cat,amt])=>{const p=total>0?Math.round(amt/total*100):0;return `<div class="xp-overview-source-row"><div class="xp-overview-source-head"><span>${esc(cat)}</span><b>${Math.round(amt)} XP · ${p}%</b></div><div class="mini-progress"><i style="--p:${p}"></i></div></div>`}).join(''):'<p class="helper">No Experience logged yet.</p>';
  return `<div class="hero-progress-popup xp-overview-popup">
    <button type="button" class="xp-overview-back" id="xpOverviewBack">‹ Player Information</button>
    <h2>Experience</h2>
    <h3 class="player-info-section-title">Last Gained Experience</h3>
    <div class="xp-overview-list">${recentRows}</div>
    <h3 class="player-info-section-title">Where Experience Is Coming From</h3>
    <div class="xp-overview-sources">${sourceRows}</div>
  </div>`;
}
function v0215OpenXpOverview(){
  modal(v0215XpOverviewHTML());
  const backBtn=modalRoot.querySelector('#xpOverviewBack');
  if(backBtn)backBtn.onclick=v0215OpenProgressPopup;
}
/* HOME V3 HERO COMPOSITION LOCK — round 6 (2026-09-08), Aurelia's
   ruling that Player Status is now permanently mandatory (see
   HOME_MODULE_ALWAYS_VISIBLE in app.js), which unlocks a cleaner Hero:
     [ PORTRAIT + LEVEL ][ PLAYER NAME ------------------------------- ]
     [ PORTRAIT         ] [ CLASS -------------------------------- ]
     [ PORTRAIT         ] [ identity / longer-name space ] [ WEATHER -- ]
     [ PORTRAIT         ] [ XP ========== ]                [ WEATHER -- ]
     [ GOLD             ]                                  [ WEATHER -- ]
   Portrait now sits BESIDE Name (not above it, round 5's arrangement)
   and spans 4 rows (Name/Class/Identity/XP, one more than round 5's 3)
   — Level stays its own overlay badge on the portrait art, unchanged.
   Weather now starts a row EARLIER, at Identity level instead of XP
   level, and spans Identity/XP/Gold (3 rows, same span-length as
   before, just shifted up one). Gold is still the lone zone below
   Portrait. Settings/Help are no longer a structurally-independent
   sibling — they're two plain buttons inside the portrait's own popup
   now (v0215ProgressPopupHTML), since Player Status can never be
   hidden anymore so the popup is always reachable. */
/* HOME V3 HERO RECOMPOSITION (Aurelia, 2026-09-10) — Name is now its own
   full-width row above Portrait; Class/Title/Gold are one shared icon+
   value row pattern beside Portrait (Gold moved out of its old
   standalone row below Portrait); XP gets a dedicated full-width row.
   "Title" reuses the existing rank data path (v0243PlayerRank) unchanged
   — presentation-only rename, no new gameplay/data logic. Function name
   kept from round 6 for continuity even though "Experiment B" no longer
   describes it — this has been the sole production Hero path since
   round 6 (HOME_HERO_EXPERIMENT_B is always true). */
/* Temporary Hero portrait art (user, 2026-09-10 — "use this as the
   temporary portrait picture until we get class pictures sorted"):
   stands in for the per-class badge (characterClassAsset()) on the Home
   Hero specifically, everywhere else that still shows the class icon
   (Training header, Character page, etc.) is untouched. Runtime file is
   a 256px re-export of the delivered 1254px source (2.26MB -> 152KB) —
   same masters/runtime split already used for Backgrounds/Weather this
   session; master kept at assets/Character/Portraits/masters/. Swap
   HOME_HERO_TEMP_PORTRAIT (or delete this override and go back to
   `badge`) once real per-class portrait art exists. */
const HOME_HERO_TEMP_PORTRAIT=characterAsset('Portraits/temp-portrait-placeholder.png');
/* Hero Stage 2 identity symbols (Aurelia, 2026-09-11 — class-symbol family
   + Title/Gold symbols approved for live integration). This supersedes
   the 2026-09-10 "remove the icons from Title and Class, they are not
   needed" ruling from Stage 1 — Stage 2's own brief explicitly restores
   an icon to all three rows using the new symbol set instead of the old
   ad-hoc emoji/no-icon treatment.
   CHARACTER_CLASSES (app.js) is the live 8-class roster (Novice/Warrior/
   Scout/Scholar/Artisan/Steward/Diplomat/Adventurer) -- it does not
   share names with the 10-symbol delivered family (Tank/Caster/Bard/
   Healer/Warrior/Ranger/Rogue/Paladin/Druid/Monk), so per the package's
   own instruction ("map actual base-class IDs explicitly in application
   code") this is Astra's judgment-call mapping, not a 1:1 delivered
   table -- flagged for review rather than presented as settled:
     Warrior -> warrior (exact name match)
     Scout -> ranger (bow/wilderness)
     Scholar -> caster (arcane/staff)
     Artisan -> druid (organic/craft)
     Steward -> healer (caretaking)
     Diplomat -> bard (social/charisma)
     Adventurer -> rogue (versatile explorer)
   Tank/Paladin/Monk are intentionally unused -- held in reserve, the
   package's own README notes "subclasses may inherit the base icon" so
   a richer future class/subclass system has somewhere to grow into.
   Novice gap closed 2026-09-11 (home-v3-novice-symbol package, a wooden
   practice sword) -- the flagged gap got a real answer instead of
   staying unmapped. */
const HERO_CLASS_SYMBOL_MAP={Novice:'CLASS_NOVICE.png',Warrior:'CLASS_WARRIOR.png',Scout:'CLASS_RANGER.png',Scholar:'CLASS_CASTER.png',Artisan:'CLASS_DRUID.png',Steward:'CLASS_HEALER.png',Diplomat:'CLASS_BARD.png',Adventurer:'CLASS_ROGUE.png'};
function heroClassSymbolAsset(className){const file=HERO_CLASS_SYMBOL_MAP[className];return file?asset(`Home/V3/Identity/Class/${file}`):null}
const HERO_TITLE_SYMBOL=asset('Home/V3/Identity/HUD_TITLE.png');
const HERO_GOLD_SYMBOL=asset('Home/V3/Identity/HUD_GOLD.png');
/* Level badge XP arc (Aurelia's approved architecture change,
   2026-09-11): replaces the linear XP trough -- Level becomes the XP
   anchor instead of its own separate Hero row, freeing two rows for a
   future status/buffs/debuffs socket (not filled with anything yet,
   deliberately left empty so the freed space itself can be judged).
   Pure SVG on a 0-100 viewBox, not JS-measured pixel geometry -- scales
   automatically with the badge's own clamp()'d responsive size with no
   extra wiring. Math: circle circumference at r=42 is 2*PI*42; a 60%-
   of-circle track centered on the bottom needs stroke-dasharray
   [trackLen, gap] and a rotate(90 - trackAngle/2) transform -- rotating
   by -trackAngle/2 alone (an earlier live-sandbox attempt) puts the arc
   in the wrong place entirely, since it skips the +90 needed to target
   the bottom (6 o'clock) rather than the default dash-start point (3
   o'clock); fixed and confirmed live before this was written to file. */
const HERO_XP_ARC_R=42,HERO_XP_ARC_CIRC=2*Math.PI*HERO_XP_ARC_R,HERO_XP_ARC_TRACK_FRACTION=.60;
const HERO_XP_ARC_TRACK_LEN=HERO_XP_ARC_CIRC*HERO_XP_ARC_TRACK_FRACTION,HERO_XP_ARC_TRACK_GAP=HERO_XP_ARC_CIRC-HERO_XP_ARC_TRACK_LEN;
const HERO_XP_ARC_ROTATE=90-(HERO_XP_ARC_TRACK_FRACTION*360/2);
const HERO_XP_ARC_TRACK_ANGLE=HERO_XP_ARC_TRACK_FRACTION*360;
/* Fill direction fix (2026-09-11, user report — "the bar is filling the
   wrong way"): confirmed live at a deliberately low percentage before
   touching any code, not assumed from the report alone. SVG dash always
   grows clockwise from its own rotated start point; giving track and
   fill the SAME rotation (as the first version did) makes the dash's
   natural start point -- which lands near 3 o'clock, the RIGHT side of
   this bottom-centered arc, not the left -- the fill's start too, so
   sapphire grew from the right and gold accumulated on the left as XP
   rose. Backwards from the linear bar's left-to-right convention. Fix:
   give the fill circle its OWN rotation, anchored to the track's END
   (left side) and growing backward from there as fill% rises, so it
   visually reads left-to-right like every other progress element in
   this app. Re-verified live at 15%/71% before writing this comment. */
function heroLevelXpArcHTML(xpPercent){
  const fillFrac=Math.max(0,Math.min(1,xpPercent/100));
  const fillLen=HERO_XP_ARC_TRACK_LEN*fillFrac,fillGap=HERO_XP_ARC_CIRC-fillLen;
  const fillRotate=HERO_XP_ARC_ROTATE+HERO_XP_ARC_TRACK_ANGLE*(1-fillFrac);
  return `<svg class="hero-level-xp-arc" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="hero-level-xp-arc-track" cx="50" cy="50" r="${HERO_XP_ARC_R}"
      stroke-dasharray="${HERO_XP_ARC_TRACK_LEN} ${HERO_XP_ARC_TRACK_GAP}"
      transform="rotate(${HERO_XP_ARC_ROTATE} 50 50)"/>
    <circle class="hero-level-xp-arc-fill" cx="50" cy="50" r="${HERO_XP_ARC_R}"
      stroke-dasharray="${fillLen} ${fillGap}"
      transform="rotate(${fillRotate} 50 50)"/>
  </svg>`;
}
/* Hero status effects (2026-09-11, user-requested test case for the
   rows freed by the XP-trough removal) -- real status objects from
   state.statusEffects (app.js), not hard-coded Hero markup, so this
   just renders whatever's active and renders nothing at all when the
   list is empty (deliberately not a placeholder/empty-state chip --
   Aurelia's own instruction was "stay empty when nothing is active").
   Split per direct instruction, same day: the HUD (Hero card) shows
   ICON ONLY (heroStatusEffectsHTML, below) -- the full name/effect text
   moved to the Player Information popup instead (heroStatusOverviewHTML
   near v0215ProgressPopupHTML). `title` keeps the name/effect reachable
   on hover even though it's icon-only on the HUD.
   Real icon art (2026-09-11, home-v3-buff-placeholders package, SHA-256
   verified 48/48 files against the package's own manifest before use):
   12 unframed gold/cream symbols -- explicitly PLACEHOLDER per the
   package's own README, not final buff art, kept in their own
   assets/Home/V3/Status/ namespace so they can be swapped cleanly later
   without touching anything else. Only the 48px export is copied into
   the repo (the README's own guidance: "use 48px export for a 24
   CSS-pixel slot") -- the 1024px masters (9.3MB) stay out of the
   runtime payload, same "compressed export only" precedent as the
   Home scenic backgrounds. HERO_BUFF_ICON_MAP keys match mapping.json's
   `id` field from the package. The icons themselves carry no buff/
   debuff color coding (the package's own instruction: "no permanent
   class-specific or stat-specific colour coding is introduced... active
   colour remain[s] live/code-driven") -- so buff vs debuff is
   communicated by the surrounding ring/backing colour in CSS (sapphire
   for buff, matching the "not green" instruction from before this art
   existed; warm red for debuff, not yet tuned against a real example),
   not by the icon art itself. */
const HERO_BUFF_ICON_MAP={strength:'BUFF_STRENGTH.png',defence:'BUFF_DEFENCE.png',speed:'BUFF_SPEED.png',focus:'BUFF_FOCUS.png',energy:'BUFF_ENERGY.png',regeneration:'BUFF_REGENERATION.png',experience:'BUFF_EXPERIENCE.png',gold:'BUFF_GOLD.png',luck:'BUFF_LUCK.png',wisdom:'BUFF_WISDOM.png',resistance:'BUFF_RESISTANCE.png',all_stats:'BUFF_ALL_STATS.png'};
function heroStatusEffectIconAsset(effect){
  const file=HERO_BUFF_ICON_MAP[effect.icon];
  return file?asset(`Home/V3/Status/${file}`):null;
}
/* Layout correction (2026-09-11, same day, user report -- "Weather cut
   off" / "buffs sitting on the frame"): the first version placed this
   row as a plain sibling AFTER .home-hero-grid, outside the grid
   entirely. That grew .home-hero-scene's (and so .home-hero-frame's)
   height correctly, but Weather's `height:100%` is 100% of the GRID's
   own height, not the scene's -- so Weather stayed the old (shorter)
   height while the Hero grew around it, reading as "cut off" short of
   the new bottom edge, and the status row (just a margin-top div, not
   part of the grid's own padding/row-gap rhythm) sat right against the
   frame's inner edge. Fixed by making status a REAL 5th grid row
   (.home-hero-grid.has-status, added only when there's something to
   show -- matches Aurelia's own "deliberately add a status socket...
   instead of inheriting spacing from a placeholder" instruction) with
   Portrait and Weather's row-spans extended to include it, so Weather's
   height:100% now correctly covers the full Hero including the status
   row, and the status content gets the grid's own row-gap clearance
   from the frame instead of an eyeballed margin. */
function heroStatusEffectDescription(effect){
  const pctLabel=effect.xpMultiplier?`${effect.xpMultiplier>1?'+':''}${Math.round((Number(effect.xpMultiplier)-1)*100)}% XP`:'';
  return pctLabel?`${effect.name||'Status'} — ${pctLabel}`:(effect.name||'Status');
}
function heroStatusIconHTML(effect){
  const type=effect.type==='debuff'?'debuff':'buff';
  const iconAsset=heroStatusEffectIconAsset(effect);
  const style=iconAsset?` style="--buff-icon:url('${iconAsset}')"`:'';
  return `<span class="hero-status-icon ${type}"${style} role="img" aria-label="${esc(heroStatusEffectDescription(effect))}" title="${esc(heroStatusEffectDescription(effect))}"></span>`;
}
function heroStatusEffectsHTML(){
  const list=Array.isArray(state.statusEffects)?state.statusEffects:[];
  if(!list.length)return '';
  return `<div class="hero-grid-status">${list.map(heroStatusIconHTML).join('')}</div>`;
}
/* ASTRA HANDOVER — HOME V3 PLAYER HUD REBUILD (2026-09-13, Jay/Aurelia,
   supersedes every previous Player HUD portrait/Level/XP/stat-layout
   instruction in this file). Character Stats' own data (HP/Stamina/
   Focus/Damage/Defence) moves INTO the Hero HUD, letting the standalone
   Character Stats widget be hidden from Home entirely (see app.js —
   removed from HOME_MODULE_DEFS, characterStatsHTML() itself untouched
   for future reference). Locked architecture (handover §25):
     Name / Title+Class / [tall Portrait+attached square Level | HP,
     Stamina, Focus bars + Damage, Defence] / XP bar / Status Effects
     (4 reserved sockets) / Weather+Running Conditions+Gold (right
     column, Gold beneath Weather).
   The circular ring portrait, the round Level badge and the Level XP
   arc are retired (heroLevelXpArcHTML/.rpg-widget-portrait-* CSS left
   defined but unused — same "not destructive" precedent as every other
   superseded branch in this file). New markup uses its own hero-hud-*
   classes (styled in v0.02.26-home-player-hud-rebuild.css) rather than
   reworking .home-hero-grid in place, so the old grid/breakpoint rules
   stay intact and inspectable if this is ever rolled back.
   No new gameplay data: Damage/Defence render base values only
   (v0243CombatSummary has no bonus field, matching characterStatsHTML's
   own "no fake bonus" precedent above) and Status Effects render real
   state.statusEffects only, padded with empty sockets up to 4 — nothing
   invented per the handover's explicit §21. */
/* Stat row icons (2026-09-13, direct instruction) — reuses the SAME
   "New Character Stats icon family" (RPG_HOME_V3_CHARACTER_STAT_ICONS_
   20260911.zip, assets/Home/V3/Character/Stats/STAT_*.png) the retired
   Character Stats widget used for these exact five stats, rather than
   sourcing new art — the data moved into the HUD, so its icons move
   with it. */
const HERO_HUD_STAT_ICON={hp:'STAT_HP.png',stamina:'STAT_STAMINA.png',focus:'STAT_FOCUS.png',damage:'STAT_DAMAGE.png',defence:'STAT_DEFENCE.png'};
function heroHudStatRowHTML(key,label,data){
  const hasMax=data.max!==undefined;
  const barClass=STAT_WELL_BAR_CLASS[key]||'';
  const icon=`<img class="hero-hud-stat-icon" src="${asset('Home/V3/Character/Stats/'+HERO_HUD_STAT_ICON[key])}" alt="">`;
  if(hasMax){
    const pctVal=Math.max(0,Math.min(100,Math.round(Number(data.current||0)/Math.max(1,Number(data.max||1))*100)));
    return `<div class="hero-hud-stat-row" data-v8-stat="${key}">
      ${icon}
      <span class="hero-hud-stat-label">${esc(label)}</span>
      <span class="hero-hud-stat-bar ${barClass}"><i style="width:${pctVal}%"></i></span>
      <span class="hero-hud-stat-value">${Math.round(Number(data.current||0))}<span class="hero-hud-stat-max">/${Math.round(Number(data.max||0))}</span></span>
    </div>`;
  }
  return `<div class="hero-hud-stat-row hero-hud-stat-row-plain" data-v8-stat="${key}">
    ${icon}
    <span class="hero-hud-stat-label">${esc(label)}</span>
    <span class="hero-hud-stat-bar-spacer"></span>
    <span class="hero-hud-stat-value">${Math.round(Number(data.value||0))}</span>
  </div>`;
}
const HERO_HUD_STATUS_SLOTS=4;
function heroHudStatusSocketHTML(effect){
  if(!effect)return `<div class="hero-hud-status-slot empty" aria-hidden="true"></div>`;
  const type=effect.type==='debuff'?'debuff':'buff';
  const iconAsset=heroStatusEffectIconAsset(effect);
  const style=iconAsset?` style="--buff-icon:url('${iconAsset}')"`:'';
  return `<div class="hero-hud-status-slot filled ${type}"${style} role="img" aria-label="${esc(heroStatusEffectDescription(effect))}" title="${esc(heroStatusEffectDescription(effect))}"></div>`;
}
function heroHudStatusSocketsHTML(){
  const list=Array.isArray(state.statusEffects)?state.statusEffects:[];
  const slots=[];
  for(let i=0;i<HERO_HUD_STATUS_SLOTS;i++)slots.push(heroHudStatusSocketHTML(list[i]));
  return `<div class="hero-hud-status">
    <div class="hero-hud-status-label">Status Effects</div>
    <div class="hero-hud-status-row">${slots.join('')}</div>
  </div>`;
}
function v0215HeroExperimentBHTML(character,today,ps,badge,className,rank,xpRequired,xp,xpPercent,level,showWeather){
  const gold=Math.round(Number(state.gold||0));
  /* Consume the level-up flash flag exactly once here — this is the
     one place the badge markup that would show it gets built, so
     reading-then-clearing it in the same tick guarantees the flash
     plays on the render immediately after a level-up and never again
     until the next one, regardless of how many further re-renders
     happen afterward. */
  const justLeveledUp=heroLevelUpFlash;heroLevelUpFlash=false;
  const combat=v0243CombatSummary(character);
  return `<section class="player-status-panel widget-player-status home-hero-scene home-hero-experiment-b" data-player-variant="widget">
    <div class="hero-hud${showWeather?'':' no-weather'}">
      <div class="hero-hud-main">
        <div class="hero-hud-name hero-player-name">${esc(character.playerName||state.profile?.name||'Player')}</div>
        <div class="hero-hud-titles">
          <div class="hero-info-row hero-hud-title-item"><img class="hero-info-icon" src="${HERO_TITLE_SYMBOL}" alt=""><span class="hero-info-value hero-info-value-title">${esc(rank)}</span></div>
          <div class="hero-info-row hero-hud-title-item">${heroClassSymbolAsset(className)?`<img class="hero-info-icon" src="${heroClassSymbolAsset(className)}" alt="">`:''}<span class="hero-info-value">${esc(className)}</span></div>
        </div>
        <div class="hero-hud-body">
          <button type="button" class="hero-hud-portrait" data-open-progress-popup aria-label="Streak, Today, Next Reward, Help and Settings">
            <div class="hero-hud-portrait-art"><img src="${HOME_HERO_TEMP_PORTRAIT}" alt="${esc(className)}"></div>
            <div class="hero-hud-level-badge${justLeveledUp?' level-up-flash':''}" role="img" aria-label="Level ${level}"><span class="hero-hud-level-value">${level}</span></div>
          </button>
          <div class="hero-hud-stats">
            ${heroHudStatRowHTML('hp','HP',combat.hp)}
            ${heroHudStatRowHTML('stamina','Stamina',combat.stamina)}
            ${heroHudStatRowHTML('focus','Focus',combat.focus)}
            ${heroHudStatRowHTML('damage','Damage',combat.damage)}
            ${heroHudStatRowHTML('defence','Defence',combat.defence)}
          </div>
        </div>
        <div class="hero-hud-xp">
          <div class="hero-xp-bar" style="--p:${xpPercent}" role="progressbar" aria-label="XP" aria-valuemin="0" aria-valuemax="${Math.round(xpRequired)}" aria-valuenow="${Math.round(xp)}">
            <i></i>
            <span class="hero-hud-xp-text">${Math.round(xp)} / ${Math.round(xpRequired)} XP</span>
          </div>
        </div>
        ${heroHudStatusSocketsHTML()}
      </div>
      <div class="hero-hud-side">
        ${showWeather?v0215HeroWeatherCardHTML():''}
        <div class="hero-hud-gold hero-info-row"><img class="hero-info-icon" src="${HERO_GOLD_SYMBOL}" alt=""><span class="hero-info-value hero-info-value-gold">${gold.toLocaleString()}</span></div>
      </div>
    </div>
  </section>`;
}
playerStatusHTML=function(){
  const character=v0243CharacterSummary(),today=todayStatusSummary(),ps=state.playerStatus||{streak:0};
  const badge=character.primaryClassBadge||characterClassAsset(),className=character.primaryClass||resolvedCharacterClass(),rank=v0243PlayerRank(character);
  const xpRequired=Math.max(1,Number(character.xpRequired||nextLevelCost()||1)),xp=Number(character.xp||0),xpPercent=pct(xp,xpRequired);
  const level=Math.round(Number(character.level||1));
  const showWeather=isHomeModuleVisible('weather');
  if(HOME_HERO_EXPERIMENT_B)return v0215HeroExperimentBHTML(character,today,ps,badge,className,rank,xpRequired,xp,xpPercent,level,showWeather);
  return `<section class="player-status-panel widget-player-status home-hero-scene" data-player-variant="widget">
    <div class="home-hero-identity-row${showWeather?'':' no-weather'}">
      <div class="home-hero-player-zone">
        <div class="home-hero-portrait">
          <div class="rpg-widget-portrait">
            <div class="rpg-widget-portrait-art"><img src="${badge}" alt="${esc(className)}"></div>
            <div class="rpg-widget-portrait-frame"></div>
          </div>
          <div class="home-hero-level-badge"><div class="rpg-widget-level-badge-value">${level}</div></div>
        </div>
        <div class="home-hero-identity">
          <div class="hero-player-name">${esc(character.playerName||state.profile?.name||'Player')}</div>
          <div class="hero-player-rank">${esc(rank)}</div>
          <div class="hero-player-class">${esc(className)}</div>
          <div class="hero-xp-copy"><span>XP</span><b>${Math.round(xp)} / ${Math.round(xpRequired)}</b></div>
          <div class="hero-xp-bar" style="--p:${xpPercent}" role="progressbar" aria-label="XP" aria-valuemin="0" aria-valuemax="${Math.round(xpRequired)}" aria-valuenow="${Math.round(xp)}"><i></i></div>
        </div>
      </div>
      ${showWeather?v0215HeroWeatherCardHTML():''}
    </div>
    <div class="hero-reward-band rpg-widget rpg-widget-inset">
      <div class="hero-progression">
        ${v0215HeroProgressHTML('STREAK','Variant 8 - Streak.png',`${Math.max(0,Number(ps.streak||0))} day${Number(ps.streak||0)===1?'':'s'}`)}
        ${v0215HeroProgressHTML('TODAY','Variant 8 - Today.png',`${today.done} / ${today.total}`)}
        ${v0215HeroProgressHTML('NEXT REWARD','Variant 8 - Next Reward.png',v0243NextReward())}
      </div>
    </div>
    <div class="hero-quip">${esc(systemQuip())}</div>
  </section>`;
};

/* Character Stats — new Home v2 module (hotfix). Display-only: reads
   the exact same v0243CombatSummary() values the old boxed Player
   Status used to show, introduces no new stat logic/persistence, and
   defers to the real Character page for any detail — tapping the card
   opens Character (bound in app.js's bindHome via [data-open-character],
   matching the [data-resource] pattern already used for Resources).
   Shell: Standard Panel (v0.02.14 .rpg-widget-standard), per Aurelia's
   own tier mapping and the hotfix's explicit "visually subordinate to
   Player Status" instruction — a plain bordered card, not the open
   hero scene. */
/* Character Stats — Standard Data Module (Aurelia ruling, 2026-09-11):
   the second proven half of the Home V3 internal component language
   (Feature Module = Main Quest, Standard Data Module = this). Outer
   shell (.character-stats-module's background/border/::after frame
   overlay, the [data-open-character] click target) is UNCHANGED —
   only what renders inside it. Styling in
   v0.02.19-home-standard-module.css under a new .stat-well-* namespace;
   the old .char-stats-header/.char-stats-grid/.char-stat-cell rules in
   v0.02.16-home-parchment-modules.css are left alone (now unused, not
   removed, same precedent as Main Quest's old .quest-* classes).

   Value-first hierarchy per her ruling: value strongest, label
   secondary, percentage tertiary. Progress accent (thin bar + %) only
   renders where the stat data genuinely has a max (hp/stamina/focus) —
   damage/defence are plain values with no meaningful ceiling, so they
   stay numeric-only, never given a fake/implied progress bar.

   "New Character Stats icon family" from her brief — delivered
   2026-09-11 as RPG_HOME_V3_CHARACTER_STAT_ICONS_20260911.zip (circular
   navy/gold medallions, one per stat). Originals were 1254x1254 masters
   (~1.2-1.5MB each); a 128px compressed runtime export of each was
   made and committed at assets/Home/V3/Character/Stats/STAT_*.png,
   masters not committed, same precedent as every other art delivery
   this project. Replaces the old Variant 8 HP/Stamina/Damage/Defence/
   Focus icons for this module only — Variant 8's own icon set stays
   live elsewhere (the legacy Character-page Player Box). */
/* Semantic bar colour per stat KEY, not per parchment — brief's "colour
   belongs to the meaning" rule (2026-09-12 parchment rebuild): HP red,
   Stamina light blue, Focus purple. Damage/Defence never reach this
   (hasMax is false for them, no bar rendered at all). No buff/temporary-
   bonus overfill segment or Damage/Defence "+N" notation is built here:
   v0243CombatSummary() (v0.02.4.3-player-box.js) has no buff/bonus field
   anywhere in its {current,max}/{value} shape — there is no real data to
   drive that visual yet, and inventing one would be exactly the
   "invent gameplay data" the brief itself rules out. Flagged in the
   return report rather than silently building an always-empty hook. */
const STAT_WELL_BAR_CLASS={hp:'bar-hp',stamina:'bar-stamina',focus:'bar-focus'};
function v0215StatWellHTML(key,label,iconFile,data){
  const hasMax=data.max!==undefined;
  const value=hasMax?`${Math.round(Number(data.current||0))}/${Math.round(Number(data.max||0))}`:Math.round(Number(data.value||0));
  const pctVal=hasMax?Math.max(0,Math.min(100,Math.round(Number(data.current||0)/Math.max(1,Number(data.max||1))*100))):null;
  const barClass=STAT_WELL_BAR_CLASS[key]||'';
  return `<div class="stat-well" data-v8-stat="${key}" data-source="${esc(data.source||'fallback')}">
    <img class="stat-well-icon" src="${asset(`Home/V3/Character/Stats/${iconFile}`)}" alt="">
    <b class="stat-well-value">${esc(value)}</b>
    <span class="stat-well-label">${esc(label)}</span>
    <span class="stat-well-meta">${pctVal!=null?`<span class="stat-well-bar ${barClass}"><i style="--p:${pctVal}"></i></span><span class="stat-well-pct">${pctVal}%</span>`:''}</span>
  </div>`;
}
characterStatsHTML=function(){
  const character=v0243CharacterSummary(),combat=v0243CombatSummary(character);
  return `<section class="character-stats-module" data-open-character role="button" tabindex="0" aria-label="Open Character">
    <div class="hw-header"><span class="hw-header-title">Character Stats</span><span class="hw-header-action">View Character</span></div>
    <div class="stat-well-row">
      ${v0215StatWellHTML('hp','HP','STAT_HP.png',combat.hp)}
      ${v0215StatWellHTML('stamina','STAMINA','STAT_STAMINA.png',combat.stamina)}
      ${v0215StatWellHTML('damage','DAMAGE','STAT_DAMAGE.png',combat.damage)}
      ${v0215StatWellHTML('defence','DEFENCE','STAT_DEFENCE.png',combat.defence)}
      ${v0215StatWellHTML('focus','FOCUS','STAT_FOCUS.png',combat.focus)}
    </div>
  </section>`;
};

/* An earlier render layer (v0.02.4-integration.js's "HOME VARIANT 2"
   block) unconditionally injects a decorative title/plaque element as
   a sibling before the player-status-panel's own content, expecting
   Variant 8's own cleanup pass (v0243ApplyPlayerVariant, gated on
   finding .v8-player-box) to strip it afterward. Since this new
   markup doesn't carry that class, that cleanup never fires — so this
   layer does the same strip for its own markup instead. */
function v0215CleanWidgetPlayerStatus(){
  if(page!=='home')return;
  const panel=document.querySelector('.player-status-panel.widget-player-status');
  if(!panel)return;
  panel.querySelectorAll(':scope > .home-v2-title,:scope > .home-variant-plaque').forEach(x=>x.remove());
}
const v0215PreviousRenderHome=renderHome;
renderHome=function(){v0215PreviousRenderHome();v0215CleanWidgetPlayerStatus()};
/* Pre-existing bug found 2026-09-08 while taking clean resting-height
   measurements for Aurelia's geometry-freeze pass: this used to call
   only v0215CleanWidgetPlayerStatus() here, which no-ops unless
   .player-status-panel.widget-player-status already exists in the DOM.
   On the real first paint it never does — bootApp() (app.js) calls
   render() synchronously before this script has even loaded, using
   app.js's own base playerStatusHTML() stub, and v0.02.4.3-player-
   box.js repaints again with ITS OWN older markup at its own script
   tail (matching the sibling "if(page==='home')renderHome()" pattern
   this file should have followed too). Since this file loads last and
   never actually re-rendered Home with its own final playerStatusHTML,
   every fresh page load showed that stale pre-Hero markup until the
   user triggered any navigation. Fixed by calling the real renderHome()
   here, same as every other v0.02.4.x file's own bottom-of-file call. */
if(page==='home')renderHome();
