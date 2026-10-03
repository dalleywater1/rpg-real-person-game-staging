/* RPG v0.02.4.10 — Home radial navigation redesign (Phase 2D).
   SUPERSEDED 2026-09-10 by the Home V3 Global Navigation rebuild
   (configurable 4-slot dock + fixed Home + transparent 6-item wheel,
   see RADIAL_NAV_ITEMS/renderGlobalNavigation in app.js). This file's
   entire job was patching the old single-ring system's centre trigger
   button to also double as a Home destination — that's now native:
   `.nav-home-compass` is a real, permanent dock member in the new
   markup, no patch needed. HOME_NAV_V2_HOTFIX is forced false so this
   file's own renderGlobalNavigation/nav wrappers become harmless no-ops
   — kept in place (not deleted) only so this history stays legible, and
   so the wrapper chain (v0250PreviousRenderGlobalNavigation etc.) keeps
   loading without error for anything else that might reference it.
   Leaving HOME_NAV_V2_HOTFIX=true here would actively break the new
   navigation: v0250ApplyHomeHub() unconditionally overwrites `host.
   onclick` on every render with a handler that only knows the old
   `.radial-nav-trigger`/`.radial-destination` selectors, which no
   longer exist — every dock/wheel click would silently stop
   navigating. */
const HOME_NAV_V2_HOTFIX=false;

function v0250EnsureHubLabel(host){
  const trigger=host.querySelector('.radial-nav-trigger');
  if(!trigger||trigger.querySelector('.nav-hub-label'))return;
  const label=document.createElement('small');
  label.className='nav-hub-label';
  label.textContent='HOME';
  trigger.appendChild(label);
}

function v0250ApplyHomeHub(){
  if(!HOME_NAV_V2_HOTFIX)return;
  const host=document.querySelector('.global-radial-nav');
  if(!host)return;
  v0250EnsureHubLabel(host);
  const trigger=host.querySelector('.radial-nav-trigger');
  if(trigger)trigger.classList.toggle('active',page==='home');
  host.onclick=e=>{
    const triggerBtn=e.target.closest('.radial-nav-trigger');
    if(triggerBtn){
      if(host.classList.contains('open')){setRadialNavOpen(false);setPage('home')}
      else setRadialNavOpen(true);
      return;
    }
    if(e.target.closest('.radial-backdrop')){setRadialNavOpen(false);return}
    const b=e.target.closest('.radial-destination');
    if(!b||b.disabled||!b.dataset.page)return;
    setRadialNavOpen(false);setPage(b.dataset.page);
  };
}

const v0250PreviousRenderGlobalNavigation=renderGlobalNavigation;
renderGlobalNavigation=function(){v0250PreviousRenderGlobalNavigation();v0250ApplyHomeHub()};
v0250ApplyHomeHub();

const v0250PreviousNav=nav;
nav=function(){v0250PreviousNav();v0250ApplyHomeHub()};
