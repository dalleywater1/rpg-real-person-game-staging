/* RPG v0.02.4.3 — Home Player Box Variant 8
   Home Player Box only. Reversible by setting HOME_PLAYER_VARIANT_8=false.
   No persistence, XP, Level, Streak, Today, Reward, Class assignment, Weather,
   Quest, Resource, Development, or navigation logic is owned here.

   RETIRED FROM THE V3 LIVE RENDER PATH (2026-09-07, Aurelia's V3
   Geometry Finalization order) — playerStatusHTML() has been fully
   reassigned to the open-scene widget (v0.02.15) since the Home UI
   Fidelity Correction pass; this file's OWN playerStatusHTML()/
   v0243ApplyPlayerVariant() already only ever ran against a
   .v8-player-box element that hasn't existed in the live DOM since
   then (confirmed dead this pass, not newly broken by this flag).
   V0243_V8_ROOT/v0243V8Asset() below are NOT gated by this flag and
   stay fully active — the current Hero/Character-Stats icons
   (Streak/Today/Next-Reward/HP/Stamina/etc.) still load from
   assets/Home/Variant 8/ through that helper; only the flag governing
   THIS file's own superseded layout/markup is disabled. */
const HOME_PLAYER_VARIANT_8=false;
const V0243_V8_ROOT='Home/Variant 8/';
const v0243V8Asset=file=>asset(`${V0243_V8_ROOT}${file}`);

function v0243CharacterSummary(){
  if(typeof window.RPGCharacterSummary==='function')return window.RPGCharacterSummary();
  const cost=nextLevelCost(),className=resolvedCharacterClass();
  return {playerName:state.profile?.name||'Player',primaryClass:className,primaryClassBadge:characterClassAsset(),level:Number(state.level||1),xp:Number(state.xp||0),xpRequired:Number(cost||1),xpPercent:pct(Number(state.xp||0),Number(cost||1)),gold:Number(state.gold||0),stats:{}};
}
function v0243FirstObject(...values){return values.find(v=>v&&typeof v==='object'&&!Array.isArray(v))||{}}
function v0243ReadStat(pool,names,fallback){
  let raw;
  for(const name of names){if(Object.prototype.hasOwnProperty.call(pool,name)){raw=pool[name];break}}
  if(raw===undefined||raw===null)return {...fallback,source:'fallback'};
  if(typeof raw==='number'&&Number.isFinite(raw))return fallback.max!==undefined?{current:raw,max:raw,source:'character'}:{value:raw,source:'character'};
  if(typeof raw==='object'){
    if(fallback.max!==undefined){
      const current=Number(raw.current??raw.value??raw.now??raw.max??fallback.current),max=Number(raw.max??raw.maximum??fallback.max);
      return {current:Number.isFinite(current)?current:fallback.current,max:Number.isFinite(max)&&max>0?max:fallback.max,source:'character'};
    }
    const value=Number(raw.value??raw.current??raw.total??fallback.value);return {value:Number.isFinite(value)?value:fallback.value,source:'character'};
  }
  return {...fallback,source:'fallback'};
}
function v0243CombatSummary(character){
  const pool=v0243FirstObject(
    character?.combat,character?.derivedStats,character?.gameStats,
    state.character?.derivedStats,state.character?.combatStats,state.character?.gameStats,
    state.characterDerived,state.characterStats,state.derivedStats
  );
  /* Temporary display defaults are intentionally read-only. They are never persisted.
     When Character exposes these values, the same reader automatically prefers them. */
  return {
    hp:v0243ReadStat(pool,['hp','HP'],{current:100,max:100}),
    stamina:v0243ReadStat(pool,['stamina','Stamina'],{current:72,max:100}),
    damage:v0243WithGear(v0243ReadStat(pool,['damage','Damage','physicalDamage'],{value:18}),'damage'),
    defence:v0243WithGear(v0243ReadStat(pool,['defence','defense','Defence','Defense'],{value:14}),'defence'),
    focus:v0243ReadStat(pool,['focus','Focus'],{current:80,max:100})
  };
}
/* RPG-0022 (2026-09-25): Damage and Defence now consume the approved equipment pipeline. The BASE stays the display
   placeholder it always was (combat is a later phase, Phase D: nothing is invented here); what changes is that the
   flat Damage / Defence of the gear the player has EQUIPPED (state.equipment.statModifiers, derived from the one slot
   authority) is added on top. Flat gear damage/defence pass through uncapped (Assay: the gear cap applies to the six
   core stats). When Character itself exposes real values (source 'character') they are used untouched: they already
   are the answer and adding gear again would double count. */
function v0243WithGear(stat,key){
  if(!stat||stat.source!=='fallback'||typeof ensureEquipmentState!=='function')return stat;
  let gear=0;
  try{gear=Number((ensureEquipmentState().statModifiers||{})[key])||0}catch(e){gear=0}
  if(!gear)return stat;
  return {...stat,base:stat.value,gear,value:stat.value+gear,source:'fallback+gear'};
}
function v0243PlayerRank(character){
  const value=state.character?.rank||state.character?.title||state.profile?.characterRank||state.profile?.characterTitle;
  return String(value||'NOVICE').trim().toUpperCase();
}
function v0243NextReward(){
  return state.quest?.lootBox||(!state.quest?.rewarded&&Number(state.quest?.rewardGold||0)>0?`${state.quest.rewardGold} Gold`:'—');
}
function v0243VitalHTML(key,label,file,data){
  const value=data.value!==undefined?Math.round(Number(data.value||0)):`${Math.round(Number(data.current||0))}/${Math.round(Number(data.max||0))}`;
  return `<div class="v8-vital" data-v8-stat="${key}" data-source="${esc(data.source||'fallback')}"><img src="${v0243V8Asset(file)}" alt=""><div><span>${esc(label)}</span><b>${esc(value)}</b></div></div>`;
}
function v0243ProgressHTML(label,file,value){
  return `<div class="v8-progress-item"><img src="${v0243V8Asset(file)}" alt=""><div><span>${esc(label)}</span><b>${esc(value)}</b></div></div>`;
}
const v0243PreviousPlayerStatusHTML=playerStatusHTML;
playerStatusHTML=function(){
  if(!HOME_PLAYER_VARIANT_8)return v0243PreviousPlayerStatusHTML();
  const character=v0243CharacterSummary(),combat=v0243CombatSummary(character),today=todayStatusSummary(),ps=state.playerStatus||{streak:0};
  const badge=character.primaryClassBadge||characterClassAsset(),className=character.primaryClass||resolvedCharacterClass(),rank=v0243PlayerRank(character);
  const xpRequired=Math.max(1,Number(character.xpRequired||nextLevelCost()||1)),xp=Number(character.xp||0),xpPercent=pct(xp,xpRequired);
  return `<section class="player-status-panel v8-player-box" data-player-variant="8">
    <img class="v8-player-frame-overlay" src="${v0243V8Asset('Variant 8 - Player Panel Overlay.png')}" alt="" aria-hidden="true">
    <div class="v8-player-tools"><button class="v8-tool" id="helpButton" aria-label="Help"><img src="${v0243V8Asset('Variant 8 - Help.png')}" alt=""></button><button class="v8-tool" id="settingsButton" aria-label="Settings"><img src="${v0243V8Asset('Variant 8 - Settings.png')}" alt=""></button></div>
    <div class="v8-player-main">
      <div class="v8-class-stack">
        <div class="v8-class-frame"><img class="v8-class-frame-art" src="${v0243V8Asset('Variant 8 - Class Icon Frame.png')}" alt="" aria-hidden="true"><img class="v8-class-art" src="${badge}" alt="${esc(className)}"></div>
        <div class="v8-level-badge"><img src="${v0243V8Asset('Variant 8 - Level Badge.png')}" alt="" aria-hidden="true"><span><small>LEVEL</small><b>${Math.round(Number(character.level||1))}</b></span></div>
        <div class="v8-buffs-slot" aria-hidden="true"></div>
      </div>
      <div class="v8-player-identity">
        <div class="v8-player-name">${esc(character.playerName||state.profile?.name||'Player')}</div>
        <div class="v8-player-rank">${esc(rank)}</div>
        <div class="v8-player-class">${esc(className)}</div>
        <div class="v8-xp-copy"><span>XP</span><b>${Math.round(xp)} / ${Math.round(xpRequired)}</b></div>
        <div class="v8-xp-bar" style="--p:${xpPercent}" role="progressbar" aria-label="XP" aria-valuemin="0" aria-valuemax="${Math.round(xpRequired)}" aria-valuenow="${Math.round(xp)}"><img src="${v0243V8Asset('Variant 8 - XP Bar.png')}" alt="" aria-hidden="true"><span class="v8-xp-track"><i></i></span></div>
        <div class="v8-vitals">
          ${v0243VitalHTML('hp','HP','Variant 8 - HP.png',combat.hp)}
          ${v0243VitalHTML('stamina','STAMINA','Variant 8 - Stamina.png',combat.stamina)}
          ${v0243VitalHTML('damage','DAMAGE','Variant 8 - Damage.png',combat.damage)}
          ${v0243VitalHTML('defence','DEFENCE','Variant 8 - Defence.png',combat.defence)}
          ${v0243VitalHTML('focus','FOCUS','Variant 8 - Focus.png',combat.focus)}
        </div>
      </div>
    </div>
    <img class="v8-player-divider" src="${v0243V8Asset('Variant 8 - Divider.png')}" alt="" aria-hidden="true">
    <div class="v8-player-progression">
      ${v0243ProgressHTML('STREAK','Variant 8 - Streak.png',`${Math.max(0,Number(ps.streak||0))} day${Number(ps.streak||0)===1?'':'s'}`)}
      ${v0243ProgressHTML('TODAY','Variant 8 - Today.png',`${today.done} / ${today.total}`)}
      ${v0243ProgressHTML('NEXT REWARD','Variant 8 - Next Reward.png',v0243NextReward())}
    </div>
    <div class="v8-player-quip">${esc(systemQuip())}</div>
  </section>`;
};
function v0243ApplyPlayerVariant(){
  const enabled=Boolean(HOME_PLAYER_VARIANT_8&&page==='home');
  view.classList.toggle('home-player-v8',enabled);
  if(!enabled)return;
  const panel=document.querySelector('.player-status-panel.v8-player-box');if(!panel)return;
  /* Variant 2 runs earlier in the render chain; remove only its Player title/control treatment. */
  panel.querySelectorAll(':scope > .home-v2-title,:scope > .home-variant-plaque').forEach(x=>x.remove());
  panel.classList.add('v8-player-active');
  const help=panel.querySelector('#helpButton'),settings=panel.querySelector('#settingsButton');
  if(help){help.className='v8-tool';help.innerHTML=`<img src="${v0243V8Asset('Variant 8 - Help.png')}" alt="">`}
  if(settings){settings.className='v8-tool';settings.innerHTML=`<img src="${v0243V8Asset('Variant 8 - Settings.png')}" alt="">`}
}
const v0243PreviousRenderHome=renderHome;
renderHome=function(){v0243PreviousRenderHome();v0243ApplyPlayerVariant()};
if(page==='home')renderHome();
