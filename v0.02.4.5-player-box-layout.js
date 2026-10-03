/* RPG v0.02.4.5 — Home Player Box Variant 8 layout/frame-layering hotfix
   Visual/layout only. Reversible by setting HOME_PLAYER_V8_LAYOUT_HOTFIX=false.
   Reorders existing live Player Box nodes; owns no gameplay, Character calculations,
   persistence, routes, or other Home panels. */
const HOME_PLAYER_V8_LAYOUT_HOTFIX=true;

function v0245ApplyPlayerLayout(){
  if(!HOME_PLAYER_V8_LAYOUT_HOTFIX||page!=='home')return;
  const panel=document.querySelector('.player-status-panel.v8-player-box');
  if(!panel)return;
  panel.classList.add('v8-layout-hotfix-active');

  const main=panel.querySelector('.v8-player-main');
  const identity=panel.querySelector('.v8-player-identity');
  const xpBar=panel.querySelector('.v8-xp-bar');
  const progression=panel.querySelector('.v8-player-progression');
  const divider=panel.querySelector('.v8-player-divider');
  const vitals=panel.querySelector('.v8-vitals');
  const quip=panel.querySelector('.v8-player-quip');

  /* Move existing bound components only; do not recreate their data or handlers. */
  if(identity&&xpBar&&progression&&progression.parentElement!==identity){
    xpBar.insertAdjacentElement('afterend',progression);
  }
  if(main&&divider&&divider.previousElementSibling!==main){
    main.insertAdjacentElement('afterend',divider);
  }
  if(divider&&vitals&&vitals.previousElementSibling!==divider){
    divider.insertAdjacentElement('afterend',vitals);
  }
  if(vitals&&quip&&quip.previousElementSibling!==vitals){
    vitals.insertAdjacentElement('afterend',quip);
  }

  /* Confirm frame semantics for accessibility/testing without changing interaction. */
  const frame=panel.querySelector('.v8-player-frame-overlay');
  if(frame){frame.setAttribute('aria-hidden','true');frame.style.pointerEvents='none';}
}

const v0245PreviousRenderHome=renderHome;
renderHome=function(){v0245PreviousRenderHome();v0245ApplyPlayerLayout()};
if(page==='home')v0245ApplyPlayerLayout();
