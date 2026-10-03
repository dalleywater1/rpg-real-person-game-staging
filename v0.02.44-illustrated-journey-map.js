/* RPG v0.02.44 — World Tours: generic illustrated Journey map engine.

   Generalizes the Hadrian's Wall-only renderer (v0.02.40, World Tours
   5.3.1) into a data-driven one any Journey can register into, per
   Vesper's calibration pipeline handover (2026-09-24): every calibrated
   Journey produces the same package shape -- base_map.png +
   control-points.json ({km,x%,y%}) + anchors (from mapping.csv) -- so
   one engine can draw any of them.

   Scope discipline (Vesper's own framing, quoted): "Build the renderer
   against these; don't ship the numbers." This file is the renderer --
   pure presentation, reads whatever progress/discovery data a caller's
   package points it at, never advances progress, queues a discovery,
   or grants a reward itself, exactly like v0.02.40's own integration
   contract. It ships. The 13 CALIBRATED fixture packages used to build
   and test it do NOT: they live under dev/journeys/fixtures/, outside
   the staging deploy allowlist (.github/workflows/deploy-staging.yml
   only copies index.html/*.css/*.js/assets//styles/), and none of
   their draft km or approximate/needs_spot_check coordinates are
   written into WORLD_TOUR_DEFINITIONS. See dev/journeys/fixtures/
   illustrated-map-harness.html for the fixture test harness.

   Two consumption modes, same code path:
   - LIVE (pkg.tourId set): position/discovery read from the real
     engine (ensureJourneyProgress/WORLD_TOUR_DEFINITIONS), same as
     Hadrian's Wall today. v0.02.40 is rewritten onto this file as a
     thin registration of Hadrian's Wall's own real, locked (135km,
     approved anchors) data -- its public hw* functions are unchanged
     wrappers, so app.js's existing calls need no changes.
   - PREVIEW (pkg.tourId absent): no real save-backed progress exists,
     so there is nothing to gate discovery on. Majors/minors all render
     in one neutral 'preview' state and the player marker is driven by
     a synthetic km value the caller sets directly (illMapSetPreviewKm)
     -- enough to prove the map/camera/zoom/marker code works, nothing
     about real gameplay is simulated or implied. */
(function(){
  'use strict';

  const ILLUSTRATED_MAP_PACKAGES={};
  /* pkg shape: {
       imgW, imgH, assetBase,                 // canvas + where base_map.png/route.png/major_markers.png live
       majors:[{id,name?,order,x,y,popup}],   // x/y in % of canvas, popup: top|bottom|left|right|bottom-right
       minors:[{id,x,y}]?,                    // optional; only meaningful in LIVE mode (needs real landmark data for fact/asterNote)
       route:[{km,x,y}],                      // control-points.json, in km/route order
       totalDistance,                         // km the route array's own km values are already expressed in
       circuit:false,                         // true = route loops back to its own start; getIllustratedPosition wraps
       futureOpacity:1,                       // optional: opacity of the not-yet-walked route layer (CSS default .4); a package with its own bold route layer uses 1
       regions:[{id,name,startDistance,endDistance}]?, // optional -- powers the regional camera fit
       tourId:null                            // real WORLD_TOUR_DEFINITIONS id for LIVE mode; absent = PREVIEW
     } */
  function illMapRegister(journeyId,pkg){ILLUSTRATED_MAP_PACKAGES[journeyId]=pkg}
  function illMapPkg(journeyId){return ILLUSTRATED_MAP_PACKAGES[journeyId]}
  /* LIVE = registered against a real Tour id (pkg.tourId); PREVIEW fixtures have none. app.js asks this instead of naming a Tour. */
  function illMapHasLive(journeyId){const p=ILLUSTRATED_MAP_PACKAGES[journeyId];return !!(p&&p.tourId&&p.tourId===journeyId)}

  /* ---------- position on the route ----------
     Same reference algorithm as v0.02.40's own getIllustratedPosition
     (Aster's handover algorithm), generalized to any total/route array
     and circuit routes (wraps past the last point back to the first
     instead of clamping). */
  function illMapPosition(journeyId,progressKm){
    const pkg=illMapPkg(journeyId);if(!pkg)return {x:0,y:0};
    const route=pkg.route;
    if(typeof progressKm!=='number'||!isFinite(progressKm))progressKm=0;
    let km=Math.max(0,Math.min(pkg.totalDistance,progressKm));
    if(pkg.circuit&&progressKm>pkg.totalDistance)km=progressKm%pkg.totalDistance;
    let nextIndex=-1;
    for(let i=0;i<route.length;i++){if(route[i].km>=km){nextIndex=i;break}}
    if(nextIndex<=0)return {x:route[0].x,y:route[0].y};
    const a=route[nextIndex-1],b=route[nextIndex];
    const t=(b.km-a.km)>0?(km-a.km)/(b.km-a.km):0;
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  }
  function illMapToPx(journeyId,pt){const pkg=illMapPkg(journeyId);return {x:pt.x/100*pkg.imgW,y:pt.y/100*pkg.imgH}}

  /* ---------- progress/discovery read -- LIVE reads the real engine,
     PREVIEW uses the synthetic per-journeyId km set via
     illMapSetPreviewKm. Neither path ever writes anything. ---------- */
  const illMapPreviewKm={};
  function illMapSetPreviewKm(journeyId,km){illMapPreviewKm[journeyId]=km;renderIllMapHost(journeyId)}
  function illMapMode(journeyId){return illMapPkg(journeyId).tourId?'live':'preview'}
  function illMapCurrentKm(journeyId){
    const pkg=illMapPkg(journeyId);
    if(pkg.tourId)return ensureJourneyProgress(pkg.tourId).totalProgress;
    return Number(illMapPreviewKm[journeyId]||0);
  }
  function illMapDiscovered(journeyId,id){
    const pkg=illMapPkg(journeyId);
    if(!pkg.tourId)return null; // preview: no discovery concept
    return ensureJourneyProgress(pkg.tourId).discoveredLandmarkOrder.includes(id);
  }
  function illMapNextMajorId(journeyId){
    const pkg=illMapPkg(journeyId);
    if(!pkg.tourId)return null;
    const prog=ensureJourneyProgress(pkg.tourId);
    const wt=WORLD_TOUR_DEFINITIONS[pkg.tourId];
    const next=(wt.landmarks||[]).find(lm=>!lm.type&&!prog.discoveredLandmarkOrder.includes(lm.id));
    return next?next.id:null;
  }
  function illMapMajorState(journeyId,id){
    if(illMapMode(journeyId)==='preview')return 'preview';
    const discovered=illMapDiscovered(journeyId,id);
    if(discovered)return 'completed';
    return id===illMapNextMajorId(journeyId)?'current':'locked';
  }

  /* ---------- view state (presentation-only, per journeyId, not
     persisted -- same low-risk tradeoff v0.02.40 already made) ---------- */
  const illMapView={},illMapCamera={};
  let illMapPointerDrag=null;
  function illMapSetView(journeyId,view){illMapView[journeyId]=view;renderIllMapHost(journeyId)}
  function illMapIsIllustrated(journeyId){return (illMapView[journeyId]||'illustrated')==='illustrated'}

  function illMapBreakpoint(){
    const w=window.innerWidth||1024;
    if(w<=340)return '320';
    if(w<=400)return '375';
    if(w<=620)return '580';
    return 'desktop';
  }

  /* Regional camera fit -- generalizes v0.02.40's flat "zoom on player
     position by breakpoint" into "zoom to fit the CURRENT region's own
     route points" when the package declares regions, falling back to
     the same flat behavior when it doesn't (every package today,
     including Hadrian's Wall's). This is the camera-side half of
     "regional sheets" -- the ready-for-when-it-exists half is
     illMapSheetFor() below, which picks a per-region base image once
     Aster delivers one; until then every region fit still draws on the
     one full base_map.png, just framed tighter. */
  function illMapRegionFor(journeyId,km){
    const pkg=illMapPkg(journeyId);
    return (pkg.regions||[]).find(r=>km>=r.startDistance&&km<r.endDistance)||null;
  }
  function illMapRegionBoundsPct(journeyId,region){
    const pkg=illMapPkg(journeyId);
    const pts=pkg.route.filter(p=>p.km>=region.startDistance&&p.km<=region.endDistance);
    if(pts.length<2)return null;
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
    return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
  }
  function illMapDefaultCamera(journeyId,bp){
    const pkg=illMapPkg(journeyId);
    if(bp==='desktop'||bp==='580')return {cx:50,cy:50,zoom:1};
    const km=illMapCurrentKm(journeyId);
    const pos=illMapPosition(journeyId,km);
    const flatZoom=bp==='320'?1.85:1.4;
    const region=illMapRegionFor(journeyId,km);
    if(!region)return {cx:pos.x,cy:pos.y,zoom:flatZoom};
    const bounds=illMapRegionBoundsPct(journeyId,region);
    if(!bounds)return {cx:pos.x,cy:pos.y,zoom:flatZoom};
    const pad=8; // percent-space padding so route points aren't flush against the viewport edge
    const spanX=Math.max(10,bounds.maxX-bounds.minX+pad*2),spanY=Math.max(10,bounds.maxY-bounds.minY+pad*2);
    const zoom=Math.max(1,Math.min(flatZoom,Math.min(100/spanX,100/spanY)));
    return {cx:(bounds.minX+bounds.maxX)/2,cy:(bounds.minY+bounds.maxY)/2,zoom};
  }

  /* Per-region base image, once Aster delivers real regional-sheet art
     (pkg.sheets:[{id,name,imgUrl,startDistance,endDistance}]). No
     package has this yet -- every path below falls through to the one
     full base_map.png, same as today -- but the selection logic is
     real so wiring a sheet in later is a data change, not a code one. */
  function illMapSheetFor(journeyId,km){
    const pkg=illMapPkg(journeyId);
    return (pkg.sheets||[]).find(s=>km>=s.startDistance&&km<s.endDistance)||null;
  }
  function illMapBaseImageUrl(journeyId,km){
    const pkg=illMapPkg(journeyId);
    const sheet=illMapSheetFor(journeyId,km);
    return sheet?sheet.imgUrl:`${pkg.assetBase}base_map.png`;
  }

  /* ---------- camera -> SVG viewBox ---------- */
  function illMapViewBoxFor(journeyId,camera){
    const pkg=illMapPkg(journeyId);
    const vw=pkg.imgW/camera.zoom,vh=pkg.imgH/camera.zoom;
    let cx=camera.cx/100*pkg.imgW,cy=camera.cy/100*pkg.imgH;
    let minX=cx-vw/2,minY=cy-vh/2;
    minX=Math.max(0,Math.min(pkg.imgW-vw,minX));
    minY=Math.max(0,Math.min(pkg.imgH-vh,minY));
    return `${minX.toFixed(1)} ${minY.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`;
  }

  /* ---------- markup ---------- Every marker group carries a
     scale(1/zoom) counter-transform so its fixed local radius always
     renders at the same ON-SCREEN pixel size no matter how far the
     viewBox has zoomed in -- v0.02.40's markers scaled up with zoom
     (a plain SVG circle's radius is in viewBox units), which is the
     "constant-size markers under zoom" gap this file closes. */
  function illMapMinorIconHTML(journeyId,id,pos,zoom){
    const px=illMapToPx(journeyId,pos);
    const s=(1/zoom).toFixed(4);
    return `<g class="ill-minor-marker" data-ill-minor="${id}" transform="translate(${px.x.toFixed(1)},${px.y.toFixed(1)}) scale(${s})">
      <circle r="6" class="ill-minor-dot"></circle>
    </g>`;
  }
  function illMapMajorMarkerHTML(journeyId,pt,state,zoom,label){
    const px=illMapToPx(journeyId,pt);
    const s=(1/zoom).toFixed(4);
    return `<g class="ill-major-marker ill-major-${state}" data-ill-major="${pt.id}" transform="translate(${px.x.toFixed(1)},${px.y.toFixed(1)}) scale(${s})" tabindex="0" role="button" aria-label="${esc(label||pt.id)}">
      ${state==='current'?'<circle r="20" class="ill-major-pulse"></circle>':''}
      <circle r="22" class="ill-hit" fill="transparent"></circle>
      <circle r="14" class="ill-major-ring"></circle>
      <circle r="9" class="ill-major-dot"></circle>
      ${pt.order?`<text class="ill-major-number" y="1">${pt.order}</text>`:''}
    </g>`;
  }
  function illMapPlayerMarkerHTML(journeyId,pos,zoom){
    const px=illMapToPx(journeyId,pos);
    const s=(1/zoom).toFixed(4);
    return `<g class="ill-player-marker" transform="translate(${px.x.toFixed(1)},${px.y.toFixed(1)}) scale(${s})" data-ill-player="1" tabindex="0" role="button" aria-label="You are here">
      <circle r="22" class="ill-hit" fill="transparent"></circle>
      <path class="ill-player-pointer" d="M0,26 L-8,10 A10,10 0 1 1 8,10 Z"></path>
      <circle r="11" class="ill-player-ring"></circle>
      <circle r="8" class="ill-player-dot"></circle>
    </g>`;
  }

  function illMapRouteOverlayHTML(journeyId,km){
    const pkg=illMapPkg(journeyId);
    const completed=[];
    for(const pt of pkg.route){
      if(pt.km<=km)completed.push(illMapToPx(journeyId,pt));
      else break;
    }
    const playerPx=illMapToPx(journeyId,illMapPosition(journeyId,km));
    if(!completed.length||completed[completed.length-1].x!==playerPx.x||completed[completed.length-1].y!==playerPx.y)completed.push(playerPx);
    const pts=completed.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return `<polyline class="ill-route-completed" points="${pts}"></polyline>`;
  }

  function illMapSVG(journeyId){
    const pkg=illMapPkg(journeyId);
    const bp=illMapBreakpoint();
    /* default camera per breakpoint. A window that changes breakpoint mid-session (rotating a phone, resizing) gets the new
       breakpoint's default (player-centred on phones, full map on desktop) UNLESS the player has already moved the camera
       themselves (Center on Me / Full Map / Next Stop / drag set _user). */
    const cam0=illMapCamera[journeyId];
    if(!cam0||!cam0._init||(cam0._bp!==bp&&!cam0._user))illMapCamera[journeyId]={...illMapDefaultCamera(journeyId,bp),_init:true,_bp:bp};
    const camera=illMapCamera[journeyId];
    const km=illMapCurrentKm(journeyId);
    const mode=illMapMode(journeyId);
    const majors=pkg.majors.map(pt=>{
      const state=illMapMajorState(journeyId,pt.id);
      const label=mode==='live'?journeyLandmarkMerged(pkg.tourId,pt.id).name:pt.name;
      return illMapMajorMarkerHTML(journeyId,pt,state,camera.zoom,label);
    }).join('');
    const minors=mode==='live'?(WORLD_TOUR_DEFINITIONS[pkg.tourId].landmarks||[]).filter(lm=>lm.type&&ensureJourneyProgress(pkg.tourId).discoveredLandmarkOrder.includes(lm.id)).map(lm=>illMapMinorIconHTML(journeyId,lm.id,illMapPosition(journeyId,lm.routeDistance),camera.zoom)).join('')
      :(pkg.minors||[]).map(m=>illMapMinorIconHTML(journeyId,m.id,m,camera.zoom)).join('');
    const playerPos=illMapPosition(journeyId,km);
    const baseUrl=illMapBaseImageUrl(journeyId,km);
    return `<svg class="ill-map-svg" viewBox="${illMapViewBoxFor(journeyId,camera)}" preserveAspectRatio="xMidYMid meet" id="illMapSvg-${journeyId}" data-ill-journey="${journeyId}">
      <image href="${baseUrl}" x="0" y="0" width="${pkg.imgW}" height="${pkg.imgH}"></image>
      <image href="${pkg.assetBase}route.png" x="0" y="0" width="${pkg.imgW}" height="${pkg.imgH}" class="ill-route-future"${pkg.futureOpacity!=null?` style="opacity:${Number(pkg.futureOpacity)}"`:''}></image>
      ${illMapRouteOverlayHTML(journeyId,km)}
      ${minors}
      ${majors}
      ${illMapPlayerMarkerHTML(journeyId,playerPos,camera.zoom)}
    </svg>`;
  }

  function illMapHTML(journeyId){
    const mode=illMapMode(journeyId);
    return `<div class="ill-illustrated-wrap">
      <div class="ill-map-viewport" id="illMapViewport-${journeyId}" data-ill-journey="${journeyId}">${illMapSVG(journeyId)}</div>
      <div class="ill-map-controls">
        <button type="button" data-ill-center="${journeyId}">Center on Me</button>
        <button type="button" data-ill-full="${journeyId}">Full Map</button>
        <button type="button" data-ill-next="${journeyId}">Next Stop</button>
        ${mode==='live'?`<button type="button" data-ill-view-toggle="${journeyId}">View Real Route</button>`:''}
      </div>
    </div>`;
  }

  /* ---------- popups -- same getScreenCTM() technique v0.02.40
     established (accounts for the current viewBox pan/zoom AND any CSS
     scaling with zero manual arithmetic); generalized to read
     LIVE content (journeyLandmarkMerged against the real Tour) or a
     minimal PREVIEW card (name only -- there is no fact/asterNote
     without a real landmark record). ---------- */
  /* restoreFocus: put keyboard focus back on the marker the popup was opened from (Escape / close button); every other caller
     (opening another popup, a view switch) passes nothing and just removes it. */
  function illMapClosePopup(restoreFocus){
    const el=document.getElementById('illMapPopup');if(!el)return;
    const from=el._illReturnFocus;el.remove();
    /* look the marker up again: the page may have re-rendered (and replaced the marker) while the popup was open */
    if(restoreFocus===true&&from){const svg=document.getElementById(`illMapSvg-${from.journeyId}`),m=svg&&svg.querySelector(`[data-ill-major="${from.id}"]`);if(m&&m.focus)m.focus()}
  }
  function illMapOpenMajorPopup(journeyId,id){
    illMapClosePopup();
    const pkg=illMapPkg(journeyId),mode=illMapMode(journeyId);
    const svg=document.getElementById(`illMapSvg-${journeyId}`);
    const marker=svg&&svg.querySelector(`[data-ill-major="${id}"]`);
    if(!svg||!marker)return;
    const m=marker.getScreenCTM();if(!m)return;
    const origin=new DOMPoint(0,0).matrixTransform(m);
    const pt=pkg.majors.find(p=>p.id===id);
    const anchor=(pt&&pt.popup)||'top';
    const card=document.createElement('div');
    card.id='illMapPopup';
    card.className='ill-popup ill-popup-'+anchor;
    if(mode==='live'){
      const discovered=illMapDiscovered(journeyId,id);
      const merged=journeyLandmarkMerged(pkg.tourId,id);
      card.innerHTML=discovered?
        `<button type="button" class="ill-popup-close" data-ill-popup-close="1">×</button>
         <h3>${esc(merged.name)}</h3>
         <p class="resource-entry-label">ABOUT THIS PLACE</p><p>${esc(merged.description||'')}</p>
         ${merged.fact?`<p class="resource-entry-label">FUN FACT</p><p>${esc(merged.fact)}</p>`:''}
         ${merged.asterNote?`<div class="journey-aster-note"><b>Aster</b> ${esc(merged.asterNote)}</div>`:''}`
        :
        `<button type="button" class="ill-popup-close" data-ill-popup-close="1">×</button>
         <h3>???</h3><p class="helper">Not yet discovered. Keep walking to reveal this landmark.</p>`;
    }else{
      card.innerHTML=`<button type="button" class="ill-popup-close" data-ill-popup-close="1">×</button>
        <h3>${esc(pt?pt.name:id)}</h3><p class="helper">Fixture preview — km ${pt?pt.engineKm?.toFixed?.(1)??'?':'?'} (draft, not canonical).</p>`;
    }
    document.body.appendChild(card);
    const cw=card.offsetWidth||220,ch=card.offsetHeight||120;
    let left=origin.x,top=origin.y;
    if(anchor==='left')left=origin.x-cw-14;
    else if(anchor==='right')left=origin.x+14;
    else if(anchor==='top'){left=origin.x-cw/2;top=origin.y-ch-14}
    else if(anchor==='bottom'){left=origin.x-cw/2;top=origin.y+14}
    else if(anchor==='bottom-right'){left=origin.x+14;top=origin.y+14}
    left=Math.max(8,Math.min(window.innerWidth-cw-8,left));
    top=Math.max(8,Math.min(window.innerHeight-ch-8,top));
    card.style.left=left+'px';card.style.top=top+'px';
    /* keyboard: the popup is a dialog, focus moves into it, Escape or the close button closes it and returns focus to the marker */
    card._illReturnFocus={journeyId,id};
    card.setAttribute('role','dialog');
    card.setAttribute('aria-label',(mode==='live'&&illMapDiscovered(journeyId,id))?journeyLandmarkMerged(pkg.tourId,id).name:'Landmark');
    const closeBtn=card.querySelector('[data-ill-popup-close]');
    closeBtn.setAttribute('aria-label','Close');
    closeBtn.onclick=()=>illMapClosePopup(true);
    card.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();illMapClosePopup(true)}});
    closeBtn.focus();
  }

  /* ---------- controls ---------- */
  function illMapCenterOnMe(journeyId){
    const bp=illMapBreakpoint();
    const km=illMapCurrentKm(journeyId);
    const pos=illMapPosition(journeyId,km);
    illMapCamera[journeyId]={cx:pos.x,cy:pos.y,zoom:bp==='320'?1.85:bp==='375'?1.4:1.3,_init:true,_user:true,_bp:bp};
    renderIllMapHost(journeyId);
  }
  function illMapFullMap(journeyId){
    illMapCamera[journeyId]={cx:50,cy:50,zoom:1,_init:true,_user:true,_bp:illMapBreakpoint()};
    renderIllMapHost(journeyId);
  }
  function illMapNextStop(journeyId){
    const pkg=illMapPkg(journeyId);
    if(illMapMode(journeyId)==='live'){
      const nextId=illMapNextMajorId(journeyId);
      if(!nextId){toast('Journey complete — no next stop.');return}
      const pt=pkg.majors.find(p=>p.id===nextId);
      illMapCamera[journeyId]={cx:pt.x,cy:pt.y,zoom:1.3,_init:true,_user:true,_bp:illMapBreakpoint()};
    }else{
      const km=illMapCurrentKm(journeyId);
      const next=pkg.majors.find(p=>p.engineKm>km)||pkg.majors[pkg.majors.length-1];
      illMapCamera[journeyId]={cx:next.x,cy:next.y,zoom:1.3,_init:true,_user:true,_bp:illMapBreakpoint()};
    }
    renderIllMapHost(journeyId);
  }

  /* ---------- bind ---------- Hosts differ by consumer (app.js's
     questsArea re-render for LIVE, the fixture harness's own re-render
     for PREVIEW) -- illMapSetHostRenderer lets each register its own,
     defaulting to a no-op so a stray call before registration never
     throws. */
  const illMapHostRenderers={};
  function illMapSetHostRenderer(journeyId,fn){illMapHostRenderers[journeyId]=fn}
  /* a LIVE package with no host renderer of its own re-renders the Quests area (what every live Tour wants) */
  function renderIllMapHost(journeyId){(illMapHostRenderers[journeyId]||(illMapHasLive(journeyId)&&typeof renderQuestsArea==='function'?renderQuestsArea:function(){}))()}

  /* MARKER SIZE. The marker groups are authored in "screen pixels" (ring r 14 = a 28 px ring, hit circle r 22 = a 44 px touch
     target), but they live inside an SVG whose viewBox is the whole 1448 px painting squeezed into a phone (0.2 - 0.7 px per unit).
     The render-time scale(1/zoom) only cancels the zoom, so on a 375 px phone the rings came out 6 px wide and effectively
     invisible. Once the SVG is in the page we know how many screen px one viewBox unit is, so scale every marker by exactly the
     inverse: one marker unit = one CSS px, at any width, zoom or camera. Runs on every bind and on window resize. */
  function illMapFitMarkers(svg){
    const vb=svg&&svg.viewBox&&svg.viewBox.baseVal;if(!vb||!vb.width||!vb.height)return;
    const r=svg.getBoundingClientRect();if(!r.width||!r.height)return;
    const k=Math.min(r.width/vb.width,r.height/vb.height);if(!(k>0))return;
    const s=(1/k).toFixed(4);
    svg.querySelectorAll('[data-ill-major],[data-ill-minor],[data-ill-player]').forEach(g=>{
      const m=(g.getAttribute('transform')||'').match(/translate\(([^)]+)\)/);
      if(m)g.setAttribute('transform',`translate(${m[1]}) scale(${s})`);
    });
  }
  let illMapFitFrame=0;
  /* a timer, not requestAnimationFrame: a hidden/backgrounded page never fires rAF, and this must still be right when it comes back */
  window.addEventListener('resize',()=>{clearTimeout(illMapFitFrame);illMapFitFrame=setTimeout(()=>document.querySelectorAll('.ill-map-svg').forEach(illMapFitMarkers),40)});

  function illMapBind(journeyId){
    const svg=document.getElementById(`illMapSvg-${journeyId}`);
    if(!svg)return;
    illMapFitMarkers(svg);
    svg.querySelectorAll('[data-ill-major]').forEach(el=>{
      el.addEventListener('click',()=>illMapOpenMajorPopup(journeyId,el.dataset.illMajor));
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();illMapOpenMajorPopup(journeyId,el.dataset.illMajor)}});
    });
    svg.querySelector('[data-ill-player]')?.addEventListener('click',()=>{illMapClosePopup();toast(illMapPositionText(journeyId))});
    const viewport=document.getElementById(`illMapViewport-${journeyId}`);
    if(viewport){
      viewport.addEventListener('pointerdown',e=>{
        illMapPointerDrag={journeyId,startX:e.clientX,startY:e.clientY,cam:{...illMapCamera[journeyId]}};
        viewport.setPointerCapture(e.pointerId);
      });
      viewport.addEventListener('pointermove',e=>{
        if(!illMapPointerDrag||illMapPointerDrag.journeyId!==journeyId)return;
        const rect=viewport.getBoundingClientRect();
        const dxPct=(e.clientX-illMapPointerDrag.startX)/rect.width*(100/illMapPointerDrag.cam.zoom);
        const dyPct=(e.clientY-illMapPointerDrag.startY)/rect.height*(100/illMapPointerDrag.cam.zoom);
        illMapCamera[journeyId]={...illMapPointerDrag.cam,cx:illMapPointerDrag.cam.cx-dxPct,cy:illMapPointerDrag.cam.cy-dyPct,_init:true,_user:true};
        const svgEl=document.getElementById(`illMapSvg-${journeyId}`);
        if(svgEl)svgEl.setAttribute('viewBox',illMapViewBoxFor(journeyId,illMapCamera[journeyId]));
      });
      ['pointerup','pointercancel','pointerleave'].forEach(evt=>viewport.addEventListener(evt,()=>{illMapPointerDrag=null}));
    }
    document.querySelectorAll(`[data-ill-center="${journeyId}"]`).forEach(b=>b.onclick=()=>illMapCenterOnMe(journeyId));
    document.querySelectorAll(`[data-ill-full="${journeyId}"]`).forEach(b=>b.onclick=()=>illMapFullMap(journeyId));
    document.querySelectorAll(`[data-ill-next="${journeyId}"]`).forEach(b=>b.onclick=()=>illMapNextStop(journeyId));
    document.querySelectorAll(`[data-ill-view-toggle="${journeyId}"]`).forEach(b=>b.onclick=()=>{illMapClosePopup();illMapSetView(journeyId,'geographic')});
  }

  function illMapPositionText(journeyId){
    const pkg=illMapPkg(journeyId),km=illMapCurrentKm(journeyId);
    let line=`${km.toFixed(1)} / ${pkg.totalDistance} km`;
    const region=illMapRegionFor(journeyId,km);
    if(region)line+=` — ${region.name}`;
    return line;
  }

  window.illMapRegister=illMapRegister;
  window.illMapHasLive=illMapHasLive;
  window.illMapIsIllustrated=illMapIsIllustrated;
  window.illMapSetView=illMapSetView;
  window.illMapHTML=illMapHTML;
  window.illMapBind=illMapBind;
  window.illMapPosition=illMapPosition;
  window.illMapSetPreviewKm=illMapSetPreviewKm;
  window.illMapSetHostRenderer=illMapSetHostRenderer;
  window.illMapPositionText=illMapPositionText;
})();
