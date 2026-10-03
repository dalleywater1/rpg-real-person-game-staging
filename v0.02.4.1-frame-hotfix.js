/* RPG v0.02.4.1 — Home Variant 2 frame-only hotfix
   Reversible: set HOME_VARIANT_2_FRAME_HOTFIX to false to restore v0.02.4 frame presentation.
   No persistence, layout ownership, icon mapping, calculations, or Home feature logic is changed here. */
const HOME_VARIANT_2_FRAME_HOTFIX=true;
function v0241FrameEnabled(){
  return Boolean(HOME_VARIANT_2_FRAME_HOTFIX && typeof HOME_VARIANT_2!=='undefined' && HOME_VARIANT_2 && page==='home');
}
function v0241ApplyHomeFrameClass(){
  view.classList.toggle('home-v2-frame-hotfix',v0241FrameEnabled());
}
const v0241PreviousRenderHome=renderHome;
renderHome=function(){
  v0241PreviousRenderHome();
  v0241ApplyHomeFrameClass();
};
const v0241PreviousModal=modal;
modal=function(html){
  v0241PreviousModal(html);
  if(v0241FrameEnabled()) modalRoot.querySelector('.modal')?.classList.add('home-v2-modal-frame');
};
if(page==='home') v0241ApplyHomeFrameClass();
