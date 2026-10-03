/* RPG v0.02.62 -- "Update ready" bar (RPG-0109, IMP-002).
   When a new service worker takes over while a page is already open, the page keeps running the OLD scripts until it is reloaded, and
   nothing said so. This shows a persistent, dismissable bar: "Update ready - tap to reload". It NEVER reloads by itself (a reload in
   the middle of a workout or a form would lose what was typed). It also asks the browser to look for a new worker when the app comes
   back to the foreground and once a minute while it is visible, so a fresh deploy reaches an open app in about a minute instead of
   whenever the browser next gets round to it. The first ever install does not announce itself (there was no old page to replace).
   Colours are the existing toast's (#0a1420 / #c98d2f / #ffe6b1); no new palette. */
(function(){
  'use strict';
  if(!('serviceWorker' in navigator))return;
  const hadController=!!navigator.serviceWorker.controller;
  let shown=false;
  function showBar(){
    if(shown||document.getElementById('updateBar'))return;
    shown=true;
    const css=document.createElement('style');
    css.textContent='#updateBar{position:fixed;top:0;left:0;right:0;z-index:2020;display:flex;gap:6px;align-items:center;justify-content:center;padding:8px 10px;padding-top:calc(8px + env(safe-area-inset-top,0px));background:#0a1420;border-bottom:1px solid #c98d2f;color:#ffe6b1;font-size:11px;line-height:1.3}'
      +'#updateBar button{font:inherit;color:#ffe6b1;background:transparent;border:1px solid #c98d2f;border-radius:4px;padding:6px 12px;min-height:36px;cursor:pointer}'
      +'#updateBar .ub-x{border-color:transparent;font-size:18px;padding:2px 12px;min-width:44px}'
      +'#updateBar button:focus-visible{outline:2px solid #ffe6b1;outline-offset:2px}';
    document.head.appendChild(css);
    const bar=document.createElement('div');
    bar.id='updateBar';bar.setAttribute('role','status');
    bar.innerHTML='<button type="button" class="ub-go">Update ready — tap to reload</button><button type="button" class="ub-x" aria-label="Dismiss">×</button>';
    bar.querySelector('.ub-go').onclick=()=>location.reload();
    bar.querySelector('.ub-x').onclick=()=>{bar.remove();shown=false};/* dismissed for now; a LATER update shows it again */
    (document.body||document.documentElement).appendChild(bar);
  }
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController)showBar()});
  function check(){navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>{})}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
  setInterval(()=>{if(document.visibilityState==='visible')check()},60000);
  window.rpgUpdateBar={show:showBar,check};
})();
