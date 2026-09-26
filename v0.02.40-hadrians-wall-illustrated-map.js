/* RPG v0.02.40 — World Tours 5.3.1: Hadrian's Wall illustrated live map
   (Aster's handover, docs/handovers/world-tours-5.3/
   RPG-5.3.1-Hadrians-Wall-Illustrated-Live-Map-Handover.md).

   Rewritten (World Tours 5.4.x, 2026-09-24) onto the generic engine in
   v0.02.44-illustrated-journey-map.js -- this file is now just Hadrian's
   Wall's own real, locked data (approved anchors, 135km canonical,
   reconciled route) registered into that engine as its one LIVE
   package. Every hw* function below is an unchanged-signature wrapper,
   so app.js's existing calls (hwIsIllustrated(), hwSetView('geographic'),
   hwMapHTML(id), hwBindMap()) needed zero changes. Every other Tour
   keeps the 5.2 MapLibre/stylized-track behaviour untouched.

   Integration contract (handover's own words, still true): "the
   existing 135 km Journey engine is the source of truth... illustration
   coordinates and drawn path length are presentation geometry only."
   This file only draws and reads existing state.

   Calibration note (see docs/handovers/world-tours-5.3/ for the full
   analysis): Aster's approved illustration km (round numbers matching
   her stage boundaries) diverge from the installed engine
   journeyDistance values by up to 8.6km on 2 of 10 majors -- expected,
   since RPG-0087 derived engine distances from real geocoded
   coordinates scaled to the canonical 135km, not from these round
   illustration figures. Per the handover's explicit rule ("retain the
   approved x/y anchors, reconcile the renderer's km calibration to
   those engine distances... preserve each intermediate point's
   fractional position within the interval"), the route below stores
   every control point's approved x/y with its km RECONCILED to the
   real installed distances -- engine distances were never overwritten,
   only this renderer's own km<->position mapping shifted.

   Re-calibrated 2026-09-26 (RPG-0087): the installed engine km of the ten
   majors moved when the real OSM trail geometry replaced the straight-line
   placeholder (Heddon 20.03 -> 24.01, Chesters 47.18 -> 49.83, ...), so
   every control point's km below was re-mapped through the same rule: keep
   its fractional position inside its major-to-major interval, move the
   interval to the new engine km. x/y are untouched. */
(function(){
  'use strict';

  const HW_TOUR_ID='hadrians-wall';

  /* Approved major-anchor x/y (handover table), verbatim. km is NOT
     duplicated here -- the real km comes from
     WORLD_TOUR_DEFINITIONS['hadrians-wall'].landmarks at render time, so
     this can never drift out of sync with the installed engine data. */
  const HADRIANS_WALL_MAP_POINTS=[
    {id:'hw_lm_segedunum',   order:1,  x:90.75, y:55.52, popup:'left'},
    {id:'hw_lm_heddon',      order:2,  x:79.14, y:51.20, popup:'top'},
    {id:'hw_lm_chesters',    order:3,  x:69.75, y:47.42, popup:'bottom'},
    {id:'hw_lm_housesteads', order:4,  x:60.50, y:45.67, popup:'bottom'},
    {id:'hw_lm_steel_rigg',  order:5,  x:51.66, y:41.80, popup:'top'},
    {id:'hw_lm_cawfields',   order:6,  x:42.61, y:44.66, popup:'bottom'},
    {id:'hw_lm_walltown',    order:7,  x:34.25, y:47.42, popup:'bottom'},
    {id:'hw_lm_birdoswald',  order:8,  x:26.38, y:45.12, popup:'top'},
    {id:'hw_lm_carlisle',    order:9,  x:16.51, y:44.01, popup:'bottom-right'},
    {id:'hw_lm_bowness',     order:10, x:6.49,  y:38.49, popup:'right'}
  ];

  /* Reconciled illustrated route: approved x/y unchanged, km remapped
     from the handover's illustration scale onto the installed engine
     scale by preserving each point's fractional position within its
     major-to-major interval (documented computation, not hand-tuned). */
  const HADRIANS_WALL_ROUTE=[
    {km:0.00,  x:90.75,y:55.52},{km:6.27,  x:87.71,y:54.33},{km:12.53, x:84.94,y:53.59},
    {km:18.80, x:82.18,y:52.67},{km:24.01, x:79.14,y:51.20},{km:31.24, x:76.66,y:50.50},
    {km:38.47, x:73.90,y:49.10},{km:44.67, x:71.13,y:48.40},{km:49.83, x:69.75,y:47.42},
    {km:54.89, x:66.30,y:46.90},{km:59.95, x:63.54,y:46.40},{km:63.75, x:60.50,y:45.67},
    {km:65.66, x:57.73,y:43.90},{km:66.93, x:54.97,y:42.70},{km:68.20, x:51.66,y:41.80},
    {km:69.44, x:48.90,y:42.60},{km:70.69, x:45.86,y:43.70},{km:71.93, x:42.61,y:44.66},
    {km:73.36, x:39.50,y:45.70},{km:74.79, x:36.74,y:46.60},{km:76.22, x:34.25,y:47.42},
    {km:79.09, x:31.10,y:46.80},{km:81.94, x:28.35,y:45.90},{km:83.85, x:26.38,y:45.12},
    {km:92.18, x:23.20,y:45.60},{km:100.51,x:20.20,y:45.20},{km:107.18,x:18.00,y:44.70},
    {km:112.17,x:16.51,y:44.01},{km:118.32,x:13.12,y:41.85},{km:124.46,x:10.36,y:40.24},
    {km:130.61,x:7.60,y:39.50},{km:135.00,x:6.49,y:38.49}
  ];

  /* Registration happens at load time, before any render can occur --
     v0.02.44 loads first (see index.html/service-worker.js order). */
  illMapRegister(HW_TOUR_ID,{
    imgW:1448,imgH:1086,assetBase:'assets/Journeys/HadriansWall/',
    majors:HADRIANS_WALL_MAP_POINTS,route:HADRIANS_WALL_ROUTE,
    totalDistance:135,circuit:false,tourId:HW_TOUR_ID
  });
  illMapSetHostRenderer(HW_TOUR_ID,()=>{if(typeof renderQuestsArea==='function')renderQuestsArea()});

  /* ---------- unchanged-signature wrappers -- app.js calls these exact
     names (journeySpecialistBodyHTML, bindQuestsArea), so nothing
     outside this file needed to change. ---------- */
  function hwIsIllustrated(){return illMapIsIllustrated(HW_TOUR_ID)}
  function hwSetView(view){illMapSetView(HW_TOUR_ID,view)}
  function hwMapHTML(){return illMapHTML(HW_TOUR_ID)}
  function hwBindMap(){illMapBind(HW_TOUR_ID)}
  function getIllustratedPosition(progressKm){return illMapPosition(HW_TOUR_ID,progressKm)}

  window.hwIsIllustrated=hwIsIllustrated;
  window.hwSetView=hwSetView;
  window.hwMapHTML=hwMapHTML;
  window.hwBindMap=hwBindMap;
  window.getIllustratedPosition=getIllustratedPosition;
  window.HADRIANS_WALL_ROUTE=HADRIANS_WALL_ROUTE;
  window.HADRIANS_WALL_MAP_POINTS=HADRIANS_WALL_MAP_POINTS;
})();
