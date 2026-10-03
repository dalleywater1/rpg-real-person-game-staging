/* RPG v0.02.64 -- Route 66 illustrated live map (RPG-0102 batch, Aster ROUTE LOCKED 2026-10-01).

   Registered into the SAME generic engine v0.02.44-illustrated-journey-map.js already runs Rome
   (v0.02.61), Hadrian's Wall (v0.02.40) and Camino Francés (v0.02.63) through: NO Route-66-specific
   renderer code. The Journey engine (WORLD_TOUR_DEFINITIONS['route-66'], app.js) stays authoritative --
   landmark km, discovery state and rewards are never read from this file or from the calibration package.

   Source: docs/journeys/calibration/journey_route_66/ (manifest.json, control-points.json,
   route-control-points.csv). Coordinates are percent of the 1448 x 1086 canvas (the calibration's own
   pixel coordinates / canvas size), matching manifest.json's own canvas field.

   Only 16 route points (one per real stop) are used, not a dense interpolation like Camino's 1069
   samples -- the calibration's own manifest flags this route as calibration_placeholder/straight
   stop-to-stop segments ("not the real trail/road shape"), i.e. the painted route.png is ITSELF drawn
   as 16 straight segments between the projected stops, so a sparse 16-point engine route matches the
   art exactly; a denser interpolation would add nothing here. needsRegionalSheets is true in the
   calibration manifest (7 recommended per-stage sheets, not yet delivered) -- this registration uses
   the single full base_map.png for every region's camera fit, same as Rome/Hadrian's Wall did before
   any regional art existed; upgrading to real per-region sheets later needs no WORLD_TOUR_DEFINITIONS
   change, only a new pkg.sheets map here.

   Deliberately not wired here: per-stop marker atlas crops (locked/current/discovered/glow) -- the
   engine draws every Journey's markers as a generic ring/dot, matching Camino/Rome/Hadrian's Wall
   today; using real marker art for any Journey is RPG-0104, not this install. major_markers.png is
   already copied into assets/Journeys/Route66/ for that future task. */
(function(){
  'use strict';

  const ROUTE_66_TOUR_ID='route-66';

  /* the 7 major-town anchors, in km order (order 1-7 shown as the marker number) */
  const ROUTE_66_MAP_POINTS=[
    {id:'rt66_lm_chicago',order:1,x:67.127,y:36.096,popup:'bottom'},
    {id:'rt66_lm_st_louis',order:2,x:62.983,y:44.659,popup:'bottom'},
    {id:'rt66_lm_oklahoma_city',order:3,x:49.793,y:54.42,popup:'top'},
    {id:'rt66_lm_adrian',order:4,x:40.331,y:54.788,popup:'top'},
    {id:'rt66_lm_albuquerque',order:5,x:32.804,y:55.157,popup:'top'},
    {id:'rt66_lm_flagstaff',order:6,x:23.412,y:54.512,popup:'top'},
    {id:'rt66_lm_santa_monica',order:7,x:9.738,y:58.103,popup:'top'}
  ];

  /* 16 route points, one per real stop -- see header comment on why this isn't densified */
  const ROUTE_66_ROUTE=[
    {km:0,x:67.127,y:36.096},
    {km:322,x:63.95,y:41.713},
    {km:484,x:62.983,y:44.659},
    {km:821,x:57.528,y:49.171},
    {km:974,x:55.387,y:49.448},
    {km:1183,x:52.624,y:52.302},
    {km:1352,x:49.793,y:54.42},
    {km:1730,x:41.575,y:55.064},
    {km:1833,x:40.331,y:54.788},
    {km:2036,x:38.329,y:55.064},
    {km:2317,x:32.804,y:55.157},
    {km:2543,x:29.075,y:53.683},
    {km:2897,x:23.412,y:54.512},
    {km:3162,x:18.854,y:54.512},
    {km:3621,x:12.983,y:55.341},
    {km:3940,x:9.738,y:58.103}
  ];

  /* camera-fit regions -- copied verbatim from WORLD_TOUR_DEFINITIONS['route-66'].regions (app.js)
     so this package can never drift from the installed engine's own stage boundaries */
  const ROUTE_66_REGIONS=[
    {id:'rt66_stage_01',name:'Illinois: Chicago to the Mississippi',startDistance:0,endDistance:484},
    {id:'rt66_stage_02',name:'Missouri Ozarks and the Kansas Corner',startDistance:484,endDistance:974},
    {id:'rt66_stage_03',name:'Oklahoma: Heart of the Mother Road',startDistance:974,endDistance:1352},
    {id:'rt66_stage_04',name:'Texas Panhandle to the Midpoint',startDistance:1352,endDistance:1833},
    {id:'rt66_stage_05',name:'New Mexico: Land of Enchantment',startDistance:1833,endDistance:2543},
    {id:'rt66_stage_06',name:'Arizona High Country',startDistance:2543,endDistance:3162},
    {id:'rt66_stage_07',name:'Mojave to the Pacific',startDistance:3162,endDistance:3940}
  ];

  illMapRegister(ROUTE_66_TOUR_ID,{
    imgW:1448,imgH:1086,assetBase:'assets/Journeys/Route66/',
    majors:ROUTE_66_MAP_POINTS,route:ROUTE_66_ROUTE,regions:ROUTE_66_REGIONS,
    totalDistance:3940,circuit:false,tourId:ROUTE_66_TOUR_ID
  });

  window.ROUTE_66_MAP_POINTS=ROUTE_66_MAP_POINTS;
  window.ROUTE_66_ROUTE=ROUTE_66_ROUTE;
  window.ROUTE_66_REGIONS=ROUTE_66_REGIONS;
})();
