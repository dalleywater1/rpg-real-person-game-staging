/* RPG v0.02.4.13 — Today & Shared Controls Extension v1.1.
   Reversible by setting HOME_TODAY_CONTROLS_EXT_HOTFIX=false below.

   Scope (per CLAUDE_IMPLEMENTATION_PATCH.md 2026-09-04):
   - Today row icons: Side Quest, Top Priorities (Primary Task row),
     Task Calendar (Schedule row).
   - Daily Challenge Rotation control: cycles which challenge definition
     is being PREVIEWED. Does not accept/complete/reroll/regenerate
     anything — today's real active challenge (dailyChallenge()/
     challengeState()) is untouched. When the rotation lands back on
     today's real challenge, the full real card (with working Accept/
     Complete/Abandon) renders unchanged; any other entry renders as a
     read-only preview with no action buttons, so this can never
     accidentally accept/complete the wrong challenge.
   - Forward navigation arrow: replaces the "Open next" chevron used by
     the four Today rows. Single asset, no rotation needed here (all four
     are forward/"open" actions, not back/previous).
   - Help/Settings: swaps the CSS text-glyph buttons from v0.02.4.11 for
     the real glyph artwork inside the same shared button shell.

   No quest generation, completion, reward, tracking, navigation
   destination, or scheduling data changed anywhere in this file. */
const HOME_TODAY_CONTROLS_EXT_HOTFIX=true;

const V0413_ICON={
  sideQuest:'today/home_today_side_quest_button_icon_v1.png',
  topPriorities:'today/home_today_top_priorities_button_icon_v1.png',
  taskCalendar:'today/home_today_task_calendar_button_icon_v1.png',
  rotation:'today/home_today_daily_challenge_rotation_button_icon_v1.png',
  forwardArrow:'controls/home_shared_control_navigation_arrow_forward_v1.png',
  help:'controls/home_shared_control_help_glyph_v1.png',
  settings:'controls/home_shared_control_settings_glyph_v1.png'
};

/* ------------------------------------------------------------
   Today row icons + forward arrow
   ------------------------------------------------------------ */
function v0413RestyleRowIcons(panel){
  const rowIcon=(row,file)=>{const img=row?.querySelector('.home-today-left-icon img');if(img)img.src=asset(file)};
  rowIcon(panel.querySelector('[data-row="2"]'),V0413_ICON.sideQuest);
  rowIcon(panel.querySelector('[data-row="3"]'),V0413_ICON.topPriorities);
  rowIcon(panel.querySelector('[data-row="4"]'),V0413_ICON.taskCalendar);
  panel.querySelectorAll('.v2-open-next img').forEach(img=>{img.src=asset(V0413_ICON.forwardArrow)});
}

/* ------------------------------------------------------------
   Daily Challenge Rotation — view-only cycling, see file header.
   ------------------------------------------------------------ */
let v0413RotationIndex=null;

function v0413TodayIndex(){
  const today=dailyChallenge();
  const i=DAILY_CHALLENGES.findIndex(c=>c.id===today.id);
  return i<0?0:i;
}
function v0413ViewedChallenge(){
  if(v0413RotationIndex==null)v0413RotationIndex=v0413TodayIndex();
  return DAILY_CHALLENGES[v0413RotationIndex];
}
function v0413RotateChallenge(){
  const len=DAILY_CHALLENGES.length;
  if(len<2)return;
  if(v0413RotationIndex==null)v0413RotationIndex=v0413TodayIndex();
  v0413RotationIndex=(v0413RotationIndex+1)%len;
  renderHome();
}

function v0413RotationButtonHTML(){
  return `<button type="button" class="today-v2-rotation-btn" id="challengeRotationBtn" aria-label="Show next Daily Challenge"><img src="${asset(V0413_ICON.rotation)}" alt=""></button>`;
}

function v0413PreviewCardHTML(viewed,todayCh){
  const durationNote=viewed.durationMin?`Minimum duration: ${viewed.durationMin} minutes · elapsed time verified, activity honor-based.`:viewed.verification==='steps'?'Progress verified using the app’s tracked Steps value.':'Completion is honor-based.';
  return `<article class="development-card challenge-card today-v2-challenge-preview"><div class="development-head challenge-head"><button class="development-icon-action" id="challengeTrackerIcon" aria-label="Open Daily Challenge Tracker"><img src="${asset(V0248_CHALLENGE_ICON[viewed.category]||V0248_CHALLENGE_ICON.physical)}" alt=""></button><div><span>DAILY CHALLENGE</span><small>${esc(viewed.category)} · PREVIEW</small></div>${v0413RotationButtonHTML()}</div><div class="challenge-content"><h3>${esc(viewed.title)}</h3><p>${esc(viewed.text)}</p><small>${esc(durationNote)}</small><strong>+${viewed.xp} XP · Minor Loot Box</strong><div class="today-v2-rotation-note">Previewing only — today’s active challenge is "${esc(todayCh.title)}".</div></div></article>`;
}

function v0413RestyleChallengeRotation(panel){
  const card=panel.querySelector('.challenge-card');
  if(!card)return;
  const todayCh=dailyChallenge();
  const viewed=v0413ViewedChallenge();
  if(viewed.id!==todayCh.id){
    card.outerHTML=v0413PreviewCardHTML(viewed,todayCh);
  }else{
    const head=panel.querySelector('.challenge-card .challenge-head');
    if(head&&!head.querySelector('#challengeRotationBtn'))head.insertAdjacentHTML('beforeend',v0413RotationButtonHTML());
  }
  const rotateBtn=panel.querySelector('#challengeRotationBtn');
  if(rotateBtn){
    rotateBtn.hidden=DAILY_CHALLENGES.length<2;
    rotateBtn.onclick=v0413RotateChallenge;
  }
}

/* ------------------------------------------------------------
   Help / Settings — swap the v0.02.4.11 text glyph for real artwork,
   same shared button shell (.v8-tool-css-glyph).
   ------------------------------------------------------------ */
function v0413RestyleToolGlyphs(){
  if(document.querySelector('.player-status-panel.widget-player-status'))return;
  const map={helpButton:V0413_ICON.help,settingsButton:V0413_ICON.settings};
  Object.entries(map).forEach(([id,file])=>{
    const btn=document.getElementById(id);
    if(!btn)return;
    btn.classList.add('v8-tool-css-glyph','v8-tool-art-glyph');
    const textGlyph=btn.querySelector('.v8-tool-glyph');
    if(textGlyph)textGlyph.remove();
    let img=btn.querySelector('.v8-tool-glyph-img');
    if(!img){
      img=document.createElement('img');
      img.className='v8-tool-glyph-img';
      img.alt='';
      btn.appendChild(img);
    }
    img.src=asset(file);
  });
}

function v0413RestyleTodayExtension(){
  if(!HOME_TODAY_CONTROLS_EXT_HOTFIX||page!=='home')return;
  const panel=document.querySelector('.home-command-panel');
  if(panel){
    v0413RestyleRowIcons(panel);
    v0413RestyleChallengeRotation(panel);
  }
  v0413RestyleToolGlyphs();
}

const v0413PreviousRenderHome=renderHome;
renderHome=function(){v0413PreviousRenderHome();v0413RestyleTodayExtension()};
if(page==='home')v0413RestyleTodayExtension();
