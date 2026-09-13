/* RPG v0.02.4.8 — Home Today panel content redesign (Phase 2B).
   Reversible by setting HOME_TODAY_V2_HOTFIX=false below.
   Restructures the existing .home-command-panel rows in place after each
   render (same pattern as v0.02.4.6/v0.02.4.7): every interactive element
   keeps its original id/handler, this only repositions/restyles content
   and adds new inline Side Quest checkboxes + a Today/Tomorrow schedule
   split, both backed by the real existing data functions. */
const HOME_TODAY_V2_HOTFIX=true;

/* Real DAILY_CHALLENGES categories are behavioral/mental/physical/
   resource-linked/social/timed, but the delivered art only covers
   physical/mental/social/random/insanity (the reference demo's simplified
   5-category rotator). Nearest-fit mapping until dedicated icons exist for
   behavioral/resource-linked/timed. */
const V0248_CHALLENGE_ICON={
  physical:'today/home_today_daily_challenge_physical_icon_v1.png',
  mental:'today/home_today_daily_challenge_mental_icon_v1.png',
  social:'today/home_today_daily_challenge_social_icon_v1.png',
  behavioral:'today/home_today_daily_challenge_random_icon_v1.png',
  'resource-linked':'today/home_today_daily_challenge_physical_icon_v1.png',
  timed:'today/home_today_daily_challenge_mental_icon_v1.png'
};

function v0248MainQuestProgressPct(q){
  if(!q)return null;
  if(q.rewarded)return 100;
  const p=q.progress&&typeof q.progress==='object'?q.progress:null;
  const current=Number(p?.current??p?.value??q.progressCurrent);
  const target=Number(p?.target??p?.max??p?.goal??q.progressTarget);
  if(Number.isFinite(current)&&Number.isFinite(target)&&target>0)return Math.max(0,Math.min(100,Math.round(current/target*100)));
  return null;
}

/* Refactored onto sharedScheduleItemsForDate (Phase 3B.3, app.js) — the
   scheduleItems() shadowing this comment used to work around no longer
   exists as a problem: that override is itself now correctly
   date-parameterized (see v0.02.4-integration.js), so this file no
   longer needs its own copy of the same quest+activities+tasks reading
   logic at all. v0248ScheduleColumnHTML's rendering (time/title/sub/
   kind only) is unaffected by rows now also carrying done/sourceType/
   sourceId, and by Personal Growth/Main Quest rows potentially
   appearing here too, same as any other shared-aggregator consumer. */
function v0248ScheduleItemsForDate(date){
  return sharedScheduleItemsForDate(date);
}

function v0248ScheduleColumnHTML(date,emptyText){
  const items=v0248ScheduleItemsForDate(date);
  if(!items.length)return `<div class="empty">${esc(emptyText)}</div>`;
  return items.map(i=>`<div class="schedule-row"><span class="schedule-time">${esc(i.time)}</span><div><strong>${esc(i.title)}</strong><small>${esc(i.sub)}</small></div><span class="tag ${i.kind}">${i.kind}</span></div>`).join('');
}

function v0248RestyleMainQuestRow(row){
  if(!row)return;
  const q=state.quest||{};
  const mainQuestTitle=sharedHomeItemTitle(q.title,['Complete Today’s Main Quest','Complete Main Quest']);
  const icon=row.querySelector('.home-today-left-icon img');
  if(icon)icon.src=asset('today/home_today_main_quest_icon_v1.png');
  const copy=row.querySelector('.command-copy');
  if(copy&&mainQuestTitle){
    const pct=v0248MainQuestProgressPct(q);
    if(pct!=null){
      const bar=document.createElement('div');
      bar.className='today-v2-progress';
      bar.innerHTML=`<i style="width:${pct}%"></i>`;
      copy.appendChild(bar);
    }
  }
  row.onclick=e=>{
    if(e.target.closest('button, [role="button"]'))return;
    setPage('quests');
  };
  const openNext=row.querySelector('#toggleMainQuest');
  if(openNext)openNext.onclick=()=>setPage('quests');
}

function v0248RestyleSideQuestsRow(row){
  if(!row)return;
  const copy=row.querySelector('.command-copy');
  if(!copy)return;
  const kicker=copy.querySelector('.quest-kicker');
  if(kicker)kicker.textContent='SIDE QUESTS';
  copy.querySelector('.side-summary')?.remove();
  copy.querySelector('.today-v2-side-list')?.remove();
  const quests=relevantSideQuests().slice(0,4);
  const list=document.createElement('div');
  list.className='today-v2-side-list';
  list.innerHTML=quests.length
    ?quests.map(q=>`<label class="today-v2-side-row"><input type="checkbox" class="today-v2-side-check" data-today-side="${q.id}"><span class="today-v2-side-title">${esc(q.title)}</span><span class="today-v2-side-xp">+${q.xp||40} XP</span></label>`).join('')
    :'<div class="today-v2-side-empty">No active Side Quests today.</div>';
  copy.appendChild(list);
  list.querySelectorAll('[data-today-side]').forEach(cb=>{
    cb.onchange=()=>{
      const q=state.sideQuests.find(x=>x.id===Number(cb.dataset.todaySide));
      if(!q)return;
      setCustomSideCompletion(q,cb.checked);
      save();
      renderHome();
    };
  });
}

function v0248RestyleScheduleRow(row){
  if(!row)return;
  const inline=row.querySelector('.schedule-inline');
  if(!inline||inline.classList.contains('today-v2-schedule-cols'))return;
  const todayHTML=inline.innerHTML;
  inline.classList.add('today-v2-schedule-cols');
  inline.innerHTML=`<div class="today-v2-schedule-col"><div class="today-v2-schedule-col-label">Today</div>${todayHTML}</div>
    <div class="today-v2-schedule-col muted"><div class="today-v2-schedule-col-label">Tomorrow</div>${v0248ScheduleColumnHTML(addDays(todayISO(),1),'Nothing scheduled tomorrow yet.')}</div>`;
}

function v0248RestyleChallengeCard(panel){
  const icon=panel.querySelector('.challenge-card .development-icon-action img');
  if(!icon)return;
  const category=(typeof dailyChallenge==='function'?dailyChallenge().category:null)||'physical';
  icon.src=asset(V0248_CHALLENGE_ICON[category]||V0248_CHALLENGE_ICON.physical);
}

function v0248RestyleHeaderTitle(panel){
  if(panel.querySelector(':scope > .today-v2-header-title'))return;
  const oldTitle=panel.querySelector(':scope > .today-label.home-v2-title');
  const heading=document.createElement('div');
  heading.className='today-v2-header-title';
  heading.textContent='Today';
  if(oldTitle)oldTitle.insertAdjacentElement('afterend',heading);
  else panel.prepend(heading);
}

function v0248RestyleToday(){
  if(!HOME_TODAY_V2_HOTFIX||page!=='home')return;
  const panel=document.querySelector('.home-command-panel');
  if(!panel)return;
  panel.classList.add('today-v2-active');
  v0248RestyleHeaderTitle(panel);
  v0248RestyleMainQuestRow(panel.querySelector('[data-row="1"]')||panel.querySelector('.main-command'));
  v0248RestyleSideQuestsRow(panel.querySelector('[data-row="2"]')||panel.querySelector('.side-command'));
  v0248RestyleScheduleRow(panel.querySelector('[data-row="4"]')||panel.querySelector('.schedule-command'));
  v0248RestyleChallengeCard(panel);
}

const v0248PreviousRenderHome=renderHome;
renderHome=function(){v0248PreviousRenderHome();v0248RestyleToday()};
if(page==='home')v0248RestyleToday();
