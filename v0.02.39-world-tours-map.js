/* RPG v0.02.39 — World Tours 5.2: interactive live map (Jay-approved
   scope, 2026-09-23) — "Use Rome — Four Basilicas again and replace/
   augment the current route display with the first genuine interactive
   map: MapLibre -> base map -> Rome route polyline -> completed portion
   -> future portion -> current player marker -> four Basilica markers
   -> Center on Me -> Full Route -> Next Stop. Nothing else."

   This file only DRAWS. The Journey Progress Engine in app.js
   (journeyPrecomputeRouteDistances/journeyInterpolatePosition) stays the
   single source of truth for position and distance — World Tours
   Architecture Rule §30: "the map is the presentation layer, Journey
   progression remains data-driven underneath it." Nothing here writes
   to state.journeys.

   Loads after app.js (needs its journey* globals) and after the
   MapLibre GL JS <script> tag (index.html) — plain classic script, not
   a module, matching this app's existing convention (Leaflet is used
   the same way for Running's route map). Pinned to MapLibre 4.7.1
   deliberately for its UMD bundle / SRI-pinning support — see the
   comment in index.html next to the CDN tags for why. */
(function(){
  'use strict';

  let journeyMap=null,journeyMapMarkers=[],journeyMapPlayerMarker=null;

  /* OSM raster tiles, same no-API-key posture as RPGMapService's own
     tileLayerUrl (app.js) — deliberately NOT reusing RPGMapService
     itself, since that object is Leaflet-shaped (L.tileLayer/L.map) and
     MapLibre's source/layer model is a different API entirely; the tile
     URL and attribution text are the only things actually shared, and
     both are copied here rather than cross-required to keep this file
     self-contained and Leaflet-independent (Aster §5: "do not hard-code
     World Tours to one map vendor" — this file shouldn't hard-depend on
     the OTHER vendor either). */
  const WORLD_TOUR_MAP_STYLE={
    version:8,
    sources:{
      osm:{
        type:'raster',
        tiles:[
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        tileSize:256,
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
      }
    },
    layers:[{id:'osm',type:'raster',source:'osm',minzoom:0,maxzoom:19}]
  };

  function journeyMapSupported(){return typeof maplibregl!=='undefined'}

  function lngLatBounds(coords){
    let minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity;
    coords.forEach(function(c){
      const lon=c[0],lat=c[1];
      if(lon<minLon)minLon=lon;if(lon>maxLon)maxLon=lon;
      if(lat<minLat)minLat=lat;if(lat>maxLat)maxLat=lat;
    });
    return [[minLon,minLat],[maxLon,maxLat]];
  }

  /* The "completed so far" sub-line: every full route vertex up to the
     player's distance, then the player's own interpolated point as the
     final vertex -- so the gold segment ends exactly at the marker
     instead of snapping back to the nearest earlier waypoint. */
  function journeyCompletedCoords(wt,journeyDistance){
    /* Scaled the same way journeyInterpolatePosition (app.js) scales its
       own cumulative distances (journeyRouteScale) -- a Tour that authors
       a canonical totalDistance different from its raw waypoint-geometry
       sum (Hadrian's Wall: 135km authored vs ~112km raw straight-line
       waypoint sum) needs BOTH to agree on where "d km along the route"
       actually falls, or the gold completed-line and the blue player
       marker would visibly disagree. */
    const scale=typeof journeyRouteScale==='function'?journeyRouteScale(wt):1;
    const cum=journeyPrecomputeRouteDistances(wt.routeGeometry).map(function(n){return n*scale});
    const total=Number(wt.totalDistance)||cum[cum.length-1];
    const d=Math.max(0,Math.min(total,Number(journeyDistance||0)));
    const coords=[];
    for(let i=0;i<wt.routeGeometry.length;i++){
      if(cum[i]<=d)coords.push(wt.routeGeometry[i]);
      else break;
    }
    const pos=journeyInterpolatePosition(wt,d);
    if(pos)coords.push([pos.lon,pos.lat]);
    return coords;
  }

  function journeyMapMarkerEl(kind){
    const el=document.createElement('div');
    el.className='journey-map-marker '+kind;
    return el;
  }

  function journeyMapDestroy(){
    if(journeyMap){journeyMap.remove();journeyMap=null}
    journeyMapMarkers=[];journeyMapPlayerMarker=null;
  }

  /* Called from app.js's bindQuestsArea() after every render of an
     active/paused Journey page for a Tour with routeGeometry (Rome
     only, today). Always recreates rather than patches an existing
     instance -- renderQuestsArea() innerHTMLs the whole view on every
     interaction, so the container div is a fresh DOM node each call
     regardless of what this file does; recreating cleanly (destroy then
     build) matches the exact pattern already established for Running's
     Leaflet map (see initRunningRouteMap in app.js) rather than
     inventing a different lifecycle just for this one view. Pan/zoom
     position is not preserved across an interaction (e.g. a landmark
     reveal Continue) -- an accepted, honestly-scoped tradeoff for this
     phase, not an oversight: see the World Tours 5.2 tracker entry. */
  function journeyMapInit(containerId,wt,prog){
    const el=document.getElementById(containerId);
    if(!el||!journeyMapSupported()||!wt.routeGeometry)return;
    journeyMapDestroy();
    const startPos=journeyInterpolatePosition(wt,prog.totalProgress)||{lat:wt.routeGeometry[0][1],lon:wt.routeGeometry[0][0]};
    journeyMap=new maplibregl.Map({
      container:el,
      style:WORLD_TOUR_MAP_STYLE,
      center:[startPos.lon,startPos.lat],
      zoom:13,
      dragRotate:false,
      pitchWithRotate:false,
      touchPitch:false,
      attributionControl:false
    });
    journeyMap.addControl(new maplibregl.AttributionControl({compact:true}));
    journeyMap.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    journeyMap.on('load',function(){
      if(!journeyMap)return; // destroyed before the style finished loading
      journeyMap.addSource('journey-full-route',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:wt.routeGeometry}}});
      journeyMap.addLayer({id:'journey-full-route-line',type:'line',source:'journey-full-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#3a4a56','line-width':4,'line-dasharray':[1,1.6]}});
      journeyMap.addSource('journey-completed-route',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:journeyCompletedCoords(wt,prog.totalProgress)}}});
      journeyMap.addLayer({id:'journey-completed-route-line',type:'line',source:'journey-completed-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#e7c676','line-width':5}});
      (wt.landmarks||[]).forEach(function(lm){
        if(!lm.coordinates)return;
        const found=prog.discoveredLandmarkOrder.includes(lm.id);
        /* World Tours 5.3 map spoiler rule (Jay's ruling, 2026-09-23):
           an undiscovered landmark may show as a muted marker if its
           existence is obvious from the route (major landmarks, and
           minor fact/minor_landmark/flavour events) -- but a
           type:'discovery' landmark is a hidden discovery and must not
           appear on the map at all until unlocked, not even muted. */
        if(!found&&lm.type==='discovery')return;
        const merged=journeyLandmarkMerged(wt.id,lm.id);
        const markerEl=journeyMapMarkerEl(found?'found':'unknown');
        const marker=new maplibregl.Marker({element:markerEl})
          .setLngLat(lm.coordinates)
          .setPopup(new maplibregl.Popup({offset:14,closeButton:false}).setText(found?merged.name:'???'))
          .addTo(journeyMap);
        journeyMapMarkers.push(marker);
      });
      const playerEl=journeyMapMarkerEl('player');
      journeyMapPlayerMarker=new maplibregl.Marker({element:playerEl}).setLngLat([startPos.lon,startPos.lat]).addTo(journeyMap);
    });
  }

  function journeyMapCenterOnMe(wt,prog){
    if(!journeyMap)return;
    const pos=journeyInterpolatePosition(wt,prog.totalProgress);
    if(pos)journeyMap.flyTo({center:[pos.lon,pos.lat],zoom:15});
  }
  function journeyMapFullRoute(wt){
    if(!journeyMap)return;
    journeyMap.fitBounds(lngLatBounds(wt.routeGeometry),{padding:36,duration:600});
  }
  function journeyMapNextStop(wt,prog){
    if(!journeyMap)return;
    const next=(wt.landmarks||[]).find(function(lm){return !prog.discoveredLandmarkOrder.includes(lm.id)});
    if(!next){toast('All landmarks discovered.');return}
    journeyMap.flyTo({center:next.coordinates,zoom:15});
  }

  window.journeyMapSupported=journeyMapSupported;
  window.journeyMapInit=journeyMapInit;
  window.journeyMapDestroy=journeyMapDestroy;
  window.journeyMapCenterOnMe=journeyMapCenterOnMe;
  window.journeyMapFullRoute=journeyMapFullRoute;
  window.journeyMapNextStop=journeyMapNextStop;
})();
