/* RPG v0.02.4.4 — Home Player Box Variant 8 cleanup hotfix
   Visual/polish only. Reversible by setting HOME_PLAYER_V8_CLEANUP=false.
   Does not own progression, Character calculations, persistence, navigation, or other Home panels. */
const HOME_PLAYER_V8_CLEANUP=true;

function v0244NormalizeIdentity(){
  if(!HOME_PLAYER_V8_CLEANUP||page!=='home')return;
  const panel=document.querySelector('.player-status-panel.v8-player-box');
  if(!panel)return;
  panel.classList.toggle('v8-cleanup-active',true);
  const rank=panel.querySelector('.v8-player-rank');
  const cls=panel.querySelector('.v8-player-class');
  if(rank&&cls){
    const norm=s=>String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
    /* Do not repeat NOVICE/Novice when they represent the same live value. */
    cls.hidden=Boolean(norm(rank.textContent)&&norm(rank.textContent)===norm(cls.textContent));
  }
  const level=panel.querySelector('.v8-level-badge');
  if(level)level.setAttribute('aria-label',`Level ${level.querySelector('b')?.textContent||''}`.trim());
}
const v0244PreviousRenderHome=renderHome;
renderHome=function(){v0244PreviousRenderHome();v0244NormalizeIdentity()};
if(page==='home')v0244NormalizeIdentity();
