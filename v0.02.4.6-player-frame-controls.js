/* RPG v0.02.4.6 — Home Player Box frame/control corrective hotfix.
   Reversible by setting HOME_PLAYER_V8_FRAME_CONTROL_HOTFIX=false.
   It adds visual layers and swaps only reversible helper artwork; no data, calculation,
   route, Character, progression/stat ordering, persistence, or other Home logic changes. */
const HOME_PLAYER_V8_FRAME_CONTROL_HOTFIX=true;

function v0246ApplyPlayerFrameControls(){
  if(!HOME_PLAYER_V8_FRAME_CONTROL_HOTFIX||page!=='home')return;
  const panel=document.querySelector('.player-status-panel.v8-player-box');
  if(!panel)return;
  panel.classList.add('v8-frame-control-hotfix-active');

  /* Dedicated rear surface: the panel itself no longer paints marble. */
  let surface=panel.querySelector(':scope > .v8-player-surface');
  if(!surface){
    surface=document.createElement('div');
    surface.className='v8-player-surface';
    surface.setAttribute('aria-hidden','true');
    panel.prepend(surface);
  }

  /* Existing bound nodes remain unchanged; only mark their shared middle layer. */
  panel.querySelectorAll(':scope > .v8-player-tools,:scope > .v8-player-main,:scope > .v8-player-progression,:scope > .v8-player-divider,:scope > .v8-vitals,:scope > .v8-player-quip')
    .forEach(el=>el.classList.add('v8-player-content-layer'));

  /* Transparent-centre foreground derivative of the approved V8 panel.
     Original Player Panel / prior Overlay remain packaged for instant rollback. */
  let border=panel.querySelector(':scope > .v8-player-frame-border');
  if(!border){border=document.createElement('div');border.className='v8-player-frame-border';border.setAttribute('aria-hidden','true');panel.append(border);}

  const frame=panel.querySelector(':scope > .v8-player-frame-overlay');
  if(frame){
    if(!frame.dataset.previousSrc)frame.dataset.previousSrc=frame.getAttribute('src')||'';
    frame.src=v0243V8Asset('Variant 8 - Player Panel Frame Only.png');
    frame.setAttribute('aria-hidden','true');
    frame.style.pointerEvents='none';
  }

  /* The source Settings PNG has a narrower/cropped frame. Use an additive V8-matched
     derivative with the same canvas dimensions as Help; button IDs/handlers stay intact. */
  const settings=panel.querySelector('#settingsButton img');
  if(settings){
    if(!settings.dataset.previousSrc)settings.dataset.previousSrc=settings.getAttribute('src')||'';
    settings.src=v0243V8Asset('Variant 8 - Settings Control Fix.png');
  }
}

const v0246PreviousRenderHome=renderHome;
renderHome=function(){v0246PreviousRenderHome();v0246ApplyPlayerFrameControls()};
if(page==='home')v0246ApplyPlayerFrameControls();
