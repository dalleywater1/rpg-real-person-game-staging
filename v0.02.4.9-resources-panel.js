/* RPG v0.02.4.9 — Home Resources panel content redesign (Phase 2C).
   Reversible by setting HOME_RESOURCES_V2_HOTFIX=false below.
   The real Resources panel already matches the spec functionally (single
   column, icon-as-quick-add-trigger via resourceModal(), Food/Mind split
   into two metrics, gold overflow / red calorie-danger fill logic) — this
   only moves each row's label/value text into an overlay on top of its own
   (now thicker) bar, and adds a live "resets at local midnight" countdown.
   No target, modal, or reward logic touched. */
const HOME_RESOURCES_V2_HOTFIX=true;

function v0249OverlayContainer(container){
  const head=container.querySelector(':scope > .resource-row-head');
  const barBtn=container.querySelector(':scope > .resource-bar-button');
  if(!head||!barBtn)return;
  const bar=barBtn.querySelector('.segmented-resource-bar');
  if(!bar)return;
  const label=head.children[0]?.textContent||'';
  const value=head.children[1]?.textContent||'';
  const overlay=document.createElement('div');
  overlay.className='resources-v2-bar-overlay';
  overlay.innerHTML=`<span>${esc(label)}</span><span>${esc(value)}</span>`;
  bar.appendChild(overlay);
  head.classList.add('resources-v2-head-hidden');
}

function v0249ResetCountdownText(){
  const now=new Date();
  const midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,0);
  const diffMs=midnight-now;
  const hours=Math.floor(diffMs/3600000),minutes=Math.floor((diffMs%3600000)/60000);
  return `Resets in ${hours}h ${minutes}m`;
}

function v0249RestyleResourceIcons(section){
  const trophy=section.querySelector('#resourceTrackerButton img');
  if(trophy)trophy.src=asset('resources/home_resources_tracker_badge_variant_b_v1.png');
  const history=section.querySelector('#resourceHistoryButton img');
  if(history)history.src=asset('resources/home_resources_history_badge_variant_b_v1.png');
}

function v0249RestyleResourcePanel(){
  if(!HOME_RESOURCES_V2_HOTFIX||page!=='home')return;
  const section=document.querySelector('.resource-section-frame');
  if(!section)return;
  section.classList.add('resources-v2-active');
  section.querySelectorAll('.resource-row-main, .resource-submetric').forEach(v0249OverlayContainer);
  v0249RestyleResourceIcons(section);
  const header=section.querySelector('.resources-section-header');
  if(header&&!header.querySelector('.resources-v2-reset')){
    const el=document.createElement('span');
    el.className='resources-v2-reset';
    el.id='resourcesResetCountdown';
    el.textContent=v0249ResetCountdownText();
    header.appendChild(el);
  }
}

const v0249PreviousRenderHome=renderHome;
renderHome=function(){v0249PreviousRenderHome();v0249RestyleResourcePanel()};
if(page==='home')v0249RestyleResourcePanel();

setInterval(()=>{
  const el=document.getElementById('resourcesResetCountdown');
  if(el)el.textContent=v0249ResetCountdownText();
},60000);
