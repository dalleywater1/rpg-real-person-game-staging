/* v0.02.4.2 — Character Master Integration
   Character-only presentation/data-reader layer. No XP award paths are added here. */

const V0242_STARTER_CLASSES=['Novice','Warrior','Scout','Scholar','Artisan','Steward','Diplomat','Adventurer'];
const V0242_HIDDEN_CLASSES=['Savant','Paragon','Ascendant'];

function v0242UniqueClasses(values){
  const out=[];
  (Array.isArray(values)?values:[]).forEach(v=>{const s=String(v||'').trim();if(!s)return;if(!out.some(x=>x.toLowerCase()===s.toLowerCase()))out.push(s)});
  return out;
}
function v0242ClassState(){
  const cs=state.classSystem||{},c=state.character||{},p=state.profile||{};
  const selected=v0242UniqueClasses(cs.selectedClasses||c.selectedClasses||state.selectedClasses||[]);
  const unlocked=v0242UniqueClasses(cs.unlockedClasses||c.unlockedClasses||state.unlockedClasses||[]);
  const unlockedLower=new Set(unlocked.map(x=>x.toLowerCase()));
  const pick=[cs.primaryClass,c.primaryClass,p.primaryClass,cs.activeClass,c.activeClass,p.activeClass,p.className,state.activeClass]
    .find(v=>typeof v==='string'&&v.trim());
  let primary=String(pick||'Novice').trim();
  const starter=V0242_STARTER_CLASSES.find(x=>x.toLowerCase()===primary.toLowerCase());
  if(starter)primary=starter;
  else {
    const hidden=V0242_HIDDEN_CLASSES.find(x=>x.toLowerCase()===primary.toLowerCase());
    if(hidden&&!unlockedLower.has(hidden.toLowerCase()))primary='Novice';
  }
  return {primary,selected,unlocked};
}
resolvedCharacterClass=function(){return v0242ClassState().primary};
function v0242ClassBadge(name){
  const cs=state.classSystem||{};
  const configured=cs.classAssets?.[name]||cs.classIcons?.[name]||cs.assets?.[name];
  if(typeof configured==='string'&&configured.trim())return configured.startsWith('assets/')?configured:asset(configured);
  const starter=V0242_STARTER_CLASSES.find(x=>x.toLowerCase()===String(name).toLowerCase());
  return starter?classSystemAsset(`${starter.toLowerCase()}_icon.png`):null;
}
characterClassAsset=function(){return v0242ClassBadge(resolvedCharacterClass())||classSystemAsset('novice_icon.png')};

function v0242CharacterSummary(){
  const classState=v0242ClassState(),cost=nextLevelCost();
  const stats={};
  Object.keys(STAT_NAMES).forEach(key=>{const base=v023BaseStat(key),effective=displayedStat(key);stats[key]={base,effective,modifier:modifier(effective),xp:Number(state.stats?.[key]?.xp||0),xpRequired:statCost(base)}});
  return {
    playerName:state.profile?.name||'Player',
    primaryClass:classState.primary,
    primaryClassBadge:v0242ClassBadge(classState.primary),
    level:Number(state.level||1),
    xp:Number(state.xp||0),
    xpRequired:Number(cost||0),
    xpPercent:pct(Number(state.xp||0),Number(cost||1)),
    gold:Number(state.gold||0),
    stats
  };
}
window.RPGCharacterSummary=v0242CharacterSummary;

function v0242ClassListHTML(label,items,primary){
  if(!items.length)return `<div class="v0242-class-empty"><span>${esc(label)}</span><b>Not recorded in Class System</b></div>`;
  return `<div class="v0242-class-group"><h3>${esc(label)}</h3>${items.map(name=>{const badge=v0242ClassBadge(name);return `<div class="character-class-row ${String(name).toLowerCase()===String(primary).toLowerCase()?'active':''}">${badge?`<img src="${badge}" alt="${esc(name)}">`:`<div class="v0242-class-no-art">${esc(String(name).slice(0,2).toUpperCase())}</div>`}<div><strong>${esc(name)}</strong><small>${String(name).toLowerCase()===String(primary).toLowerCase()?'PRIMARY CLASS':'CLASS SYSTEM'}</small></div></div>`}).join('')}</div>`;
}
characterClassesModal=function(){
  const cs=v0242ClassState(),allowed=x=>V0242_STARTER_CLASSES.some(s=>s.toLowerCase()===String(x).toLowerCase())||cs.unlocked.some(u=>u.toLowerCase()===String(x).toLowerCase());
  const selected=cs.selected.filter(allowed),unlocked=cs.unlocked.filter(allowed);
  modal(`<h2>Classes</h2><p class="helper">Character is the display/entry layer. The shared Class System owns unlocked, selected and Primary Class state.</p><div class="v0242-class-summary"><div><span>PRIMARY CLASS</span><b>${esc(cs.primary)}</b></div><div><span>SELECTED</span><b>${selected.length}</b></div><div><span>UNLOCKED</span><b>${unlocked.length}</b></div></div>${v0242ClassListHTML('Selected Classes',selected,cs.primary)}${v0242ClassListHTML('Unlocked Classes',unlocked,cs.primary)}`);
};

function v0242StatCard(key){
  const s=state.stats?.[key]||{},base=v023BaseStat(key),total=displayedStat(key),cost=statCost(base),xp=Number(s.xp||0),progress=pct(xp,cost),mod=modifier(total),external=total-base;
  /* RPG-0008 (2026-09-22 audit item): mod comes from modifier() (app.js),
     which already returns a signed string ("+3"/"+0"/"-1") -- this used
     to re-sign it with ${mod>=0?'+':''} on top, doubling the plus for
     every zero-or-positive modifier ("++3 MOD"). external is a different,
     unsigned raw number (total-base), so its own sign wrapper below is
     correct and untouched. */
  return `<button type="button" class="character-stat-card v0242-stat-card" data-stat="${key}" aria-label="Open ${esc(STAT_LONG[key])} breakdown"><div class="v0242-stat-head"><img src="${characterStatAsset(key)}" alt=""><div><span>${STAT_NAMES[key]}</span><strong>${esc(STAT_LONG[key])}</strong></div></div><div class="v0242-stat-number"><b>${total}</b><span>${mod} MOD</span></div><div class="v0242-stat-base"><span>BASE ${base}</span><span>${external>=0?'+':''}${external} SOURCES</span></div><div class="character-stat-xp"><span>${Math.round(xp)} / ${cost} XP</span><div class="character-stat-progress"><i style="--p:${progress}"></i></div></div></button>`;
}
statBreakdownModal=function(key){
  if(!STAT_NAMES[key])return;
  const s=state.stats?.[key]||{},src=statSources(key),base=v023BaseStat(key),total=displayedStat(key),cost=statCost(base),records=src.records||[];
  const grouped=[];
  const order=['Permanent Bonus','Items','Equipment','Skills','Potions','Buffs','Other'];
  order.forEach(type=>{const value=records.filter(r=>r.sourceType===type).reduce((n,r)=>n+Number(r.amount||0),0);if(value)grouped.push([type,value])});
  // RPG-0008: same double-sign bug as v0242StatCard above, fixed the same way -- modifier() already returns a signed string.
  modal(`<div class="stat-breakdown v0242-stat-breakdown"><div class="stat-breakdown-title"><img src="${characterStatAsset(key)}" alt=""><div><span>${esc(STAT_LONG[key]).toUpperCase()}</span><b>TOTAL ${total}</b><small>Base ${base} · Modifier ${modifier(total)}</small></div></div><div class="stat-source-list"><div class="stat-source-row earned"><div><b>Earned / Base</b><small>Permanent progression</small></div><strong>${base}</strong></div>${grouped.map(([label,value])=>`<div class="stat-source-row"><div><b>${esc(label)}</b><small>${label==='Potions'||label==='Buffs'?'Temporary effect':'Current valid source'}</small></div><strong>${value>=0?'+':''}${Math.round(value)}</strong></div>`).join('')}${!grouped.length?'<div class="stat-source-row"><div><b>No active modifiers</b><small>Total currently equals Base</small></div><strong>+0</strong></div>':''}</div><div class="stat-breakdown-xp"><span>Stat XP</span><b>${Math.round(Number(s.xp||0))} / ${cost}</b><div class="character-stat-progress"><i style="--p:${pct(Number(s.xp||0),cost)}"></i></div></div></div>`);
};

function v0242SeverityLabel(n){n=Number(n||1);return n>=5?'CRITICAL':n>=4?'SEVERE':n>=3?'MODERATE':'MILD'}
function v0242AilmentCards(active){
  if(!active.length)return '<div class="empty">No active ailments.</div>';
  return active.map(a=>`<article class="v0242-ailment-card"><img src="${characterAsset(ailmentAssetName(a.name))}" alt=""><div><strong>${esc(String(a.name||'Ailment').toUpperCase())}</strong><span>${v0242SeverityLabel(a.severity)}</span><small>Started: ${fmtShort(a.startDate)}${a.notes?` · ${esc(a.notes)}`:''}</small></div><button class="text-btn accent" data-recover="${a.id}">Recovered</button></article>`).join('');
}
function v0242LifetimeMetrics(){
  const acts=Array.isArray(state.activities)?state.activities.filter(a=>a.completed):[];
  const runKm=acts.filter(a=>/run/i.test(`${a.type||''} ${a.name||''}`)).reduce((n,a)=>n+Number(a.distance||0),0);
  const metrics=[];
  if(runKm>0)metrics.push(['RUN',`${runKm.toFixed(1)} km`,'Running Distance']);
  if(acts.length>0)metrics.push(['ACT',String(acts.length),'Workouts']);
  if(Number(state.totals?.readingMinutes||0)>0)metrics.push(['READ',`${Math.round(state.totals.readingMinutes)} min`,'Reading / Learning']);
  if(Number(state.totals?.waterMl||0)>0)metrics.push(['H2O',`${Math.round(state.totals.waterMl).toLocaleString()} ml`,'Hydration']);
  if(Number(state.totals?.socialCheckins||0)>0)metrics.push(['SOC',String(Math.round(state.totals.socialCheckins)),'Social Activity']);
  const quests=Number(state.totals?.questsCompleted||0)+(Array.isArray(state.sideQuestHistory)?state.sideQuestHistory.length:0);
  if(quests>0)metrics.push(['QST',String(quests),'Quests Completed']);
  return metrics;
}
function v0242LifetimeHTML(){
  const metrics=v0242LifetimeMetrics();
  if(!metrics.length)return '<div class="empty">No supported lifetime totals recorded yet.</div>';
  return `<div class="v0242-lifetime-grid">${metrics.map(([mark,value,label])=>`<div class="v0242-lifetime-card"><span class="v0242-lifetime-mark">${esc(mark)}</span><div><b>${esc(value)}</b><small>${esc(label)}</small></div></div>`).join('')}</div>`;
}
function v0242ProfileSummary(){
  const p=state.profile||{},items=[];
  const add=(label,value)=>{if(value!==null&&value!==undefined&&String(value)!=='')items.push([label,String(value)])};
  add('Player',p.name||'Player');if(p.age)add('Age',p.age);if(p.height)add('Height',`${p.height} cm`);if(p.weight)add('Weight',`${p.weight} kg`);if(p.calTarget)add('Calories',`${Math.round(p.calTarget)} kcal`);if(p.proteinTarget)add('Protein',`${Math.round(p.proteinTarget)} g`);if(p.location)add('Location',p.location);
  if(p.metabolicFormula)add('Formula',p.metabolicFormula==='male'||p.metabolicFormula==='female'?'Mifflin–St Jeor':'Manual');
  return items;
}
function v0242ProfileHTML(){return v0242ProfileSummary().map(([l,v])=>`<div class="v0242-profile-chip"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}

function v0242SkillsModal(){
  const pending=typeof v023UnclaimedMilestones==='function'?v023UnclaimedMilestones():[];
  modal(`<h2>Skills</h2><p class="helper">Character owns the Skills display and milestone hooks. Full skill mechanics remain deferred.</p>${pending.length?`<div class="v023-milestone-list">${pending.map(m=>`<div class="list-item"><div>✦</div><div><h3>${STAT_NAMES[m.stat]} ${m.threshold}</h3><p>Base ${STAT_LONG[m.stat]} milestone reached. Choice catalogue remains deferred.</p></div><span class="tag quest">Unclaimed</span></div>`).join('')}</div>`:'<div class="empty">No unclaimed stat milestones.</div>'}`);
}

renderCharacter=function(){
  if(typeof v023EnsureState==='function')v023EnsureState();
  const summary=v0242CharacterSummary(),active=activeAilments(),pending=typeof v023UnclaimedMilestones==='function'?v023UnclaimedMilestones():[];
  const classArt=v0242ClassBadge(summary.primaryClass);
  view.innerHTML=pageHeader('Character','Master Build')+`
    <section class="rpg-frame primary v0242-character-identity"><div class="v0242-identity-main"><div class="character-portrait-stack">${classArt?`<img class="v0242-primary-badge character-class-art" src="${classArt}" alt="${esc(summary.primaryClass)}">`:'<div class="v0242-primary-badge v0242-missing-badge character-class-art">CLASS</div>'}<div class="character-level-badge"><small>LEVEL</small><b>${summary.level}</b></div><div class="character-buffs-slot" aria-hidden="true"></div></div><div class="v0242-identity-copy"><span>PRIMARY CLASS</span><h2>${esc(summary.playerName)}</h2><strong>${esc(summary.primaryClass)}</strong><div class="v0242-identity-meta"><span>GOLD <b>${summary.gold.toLocaleString()}</b></span></div><button class="text-btn character-view-classes" id="viewClassesBtn">View Classes</button></div></div><div class="v0242-overall-xp"><div><span>OVERALL XP</span><b>${Math.round(summary.xp)} / ${summary.xpRequired}</b></div><div class="v0242-xp-track"><i style="--p:${summary.xpPercent}"></i></div><small>${Math.max(0,summary.xpRequired-summary.xp)} XP to next Level</small></div></section>
    <section class="character-menu v0242-character-menu" aria-label="Character actions"><button type="button" class="character-menu-button" id="skillsBtn"><img src="${characterAsset('menu_skills.png')}" alt=""><span>Skills</span></button><button type="button" class="character-menu-button" id="equipmentBtn"><img src="${characterAsset('menu_equipment.png')}" alt=""><span>Equipment</span></button><button type="button" class="character-menu-button" id="rewardsBtn"><img src="${characterAsset('menu_rewards.png')}" alt=""><span>Rewards</span></button></section>
    ${pending.length?`<button class="v023-milestone-notice" id="v0242MilestoneNotice"><b>${pending.length} STAT MILESTONE${pending.length===1?'':'S'} READY</b><span>Open Skills to review Base-stat thresholds.</span></button>`:''}
    <h2 class="section-title character-section-title">Attributes</h2><section class="character-stat-grid v0242-stat-grid">${Object.keys(STAT_NAMES).map(v0242StatCard).join('')}</section>
    <div class="character-lower-grid v0242-lower-grid"><div><h2 class="section-title character-section-title">Status & Ailments</h2><section class="rpg-frame standard v0242-status-panel"><div class="v0242-panel-tools"><button class="rpg-btn small accent" id="addAilment">Add / Custom Ailment</button><button class="text-btn" id="ailmentHistory">View Ailment History</button></div>${v0242AilmentCards(active)}</section></div><div><h2 class="section-title character-section-title">Lifetime Totals</h2><section class="rpg-frame standard v0242-lifetime-panel">${v0242LifetimeHTML()}</section></div></div>
    <h2 class="section-title character-section-title">Profile & Setup</h2><section class="rpg-frame minor v0242-profile-panel"><img src="${characterAsset('menu_profile_setup.png')}" alt=""><div class="v0242-profile-grid">${v0242ProfileHTML()}</div><button class="rpg-btn accent" id="profileSetup">Open Setup</button></section>`;
  bindCharacter();
};

bindCharacter=function(){
  const profile=document.querySelector('#profileSetup');if(profile)profile.onclick=profileModal;
  const classes=document.querySelector('#viewClassesBtn');if(classes)classes.onclick=characterClassesModal;
  const equipment=document.querySelector('#equipmentBtn');if(equipment)equipment.onclick=characterEquipmentModal;
  const skills=document.querySelector('#skillsBtn');if(skills)skills.onclick=v0242SkillsModal;
  const rewards=document.querySelector('#rewardsBtn');if(rewards)rewards.onclick=()=>setPage('rewards');
  const add=document.querySelector('#addAilment');if(add)add.onclick=ailmentModal;
  const history=document.querySelector('#ailmentHistory');if(history)history.onclick=ailmentHistoryModal;
  const notice=document.querySelector('#v0242MilestoneNotice');if(notice)notice.onclick=v0242SkillsModal;
  document.querySelectorAll('[data-stat]').forEach(b=>b.onclick=()=>statBreakdownModal(b.dataset.stat));
  document.querySelectorAll('[data-recover]').forEach(b=>b.onclick=()=>{const a=state.ailments.find(x=>String(x.id)===String(b.dataset.recover));if(a){a.recoveredDate=todayISO();save();toast('Ailment moved to history.');renderCharacter()}});
};

// Re-render Character if this layer loads while Character is already active.
if(typeof page!=='undefined'&&page==='character')renderCharacter();
