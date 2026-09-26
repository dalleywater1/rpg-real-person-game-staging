/* RPG v0.02.42 — World Tours 5.4: Journey Catalogue (Aster's structure,
   2026-09-23 — "seed it now with placeholders for every planned route
   so the UI is being designed against the real eventual scale rather
   than a handful of test Journeys"). Replaces the Journeys division's
   generic flat quest list with a browsable Hub -> Category -> card
   structure. Every card is one of two kinds:
     - REAL: id matches a real WORLD_TOUR_DEFINITIONS/QUEST_DEFINITIONS
       entry (today: hadrians-wall, rome-four-basilicas). Distance/
       status/progress are read LIVE from that real data, never
       duplicated here, so they can never drift. Tapping navigates into
       the existing, already-built quest page.
     - PLACEHOLDER: everything else. No real distance/reward/modifier/
       route geometry exists and none is invented here (Aster's explicit
       instruction) -- distance shows its qualitative `scale` (a
       planning-scale hint, e.g. "Epic" or "Short / Long", never a
       fabricated km number), status is a badge, tapping shows a toast
       rather than navigating anywhere. cape-town-magadan is deliberately
       treated as a placeholder in THIS catalogue (shown "Coming Soon —
       Prestige" per Aster's card list) even though its real
       WORLD_TOUR_DEFINITIONS entry already exists and is technically
       startable via the pre-5.4 flat list / an existing save's slot --
       this file only changes how NEW Journeys are discovered, not the
       underlying mega-Journey mechanism.

   2026-09-23 addendum (Aster, "Journey Master Catalogue v0.1"): every
   entry additionally carries `journeyStructure` (route|circuit|river|
   vertical|network|meta -- a mechanical/renderer classification, kept
   independent of the `category`/`subcategory` browsing taxonomy per
   Aster's explicit instruction to keep those two concerns separate),
   `scale` (her qualitative planning-scale text, shown on placeholder
   cards in place of a fabricated km figure), and `concept` (her one-line
   "basic route/concept" description, real authored content). Also moved
   3 entries to the categories her master table assigns them to
   (via-alpina, tour-du-mont-blanc: world-tours -> mountain; around-
   mediterranean: world-tours -> special), since a plain coastal-tour/
   long-trail categorization undersold what they actually are (Alpine
   circuits, a multi-country network tour). */
(function(){
  'use strict';

  const JC_REAL_IDS=new Set(['hadrians-wall','rome-four-basilicas','camino-de-santiago']);

  const JC_CATEGORIES=[
    {id:'world-tours',label:'World Tours',subtitle:'Real-world traversal and touring routes'},
    {id:'legendary',label:'Legendary Journeys',subtitle:'RPG-original distance adventures'},
    {id:'mountain',label:'Mountain & Vertical',subtitle:'Elevation-based climbs'},
    {id:'river',label:'River & Water',subtitle:'Rivers and waterways'},
    {id:'special',label:'Special Tours',subtitle:'Journeys that don’t fit a conventional route'},
    {id:'historical',label:'Historical',subtitle:'Ruins, empires, ancient roads, pilgrimage history and heritage'}
  ];

  /* FIRST WAVE (Jay, 2026-09-26: "too much to add 23 at once"): of the 23 World Tours, one per size is now
     'in_development' (Mini: Monaco Grand Loop, Short: Singapore Coast-to-Coast, Long: Isle of Wight Coastal Tour,
     Epic: Appalachian Trail -- picked because their painted maps are already calibrated, Monaco being the only Mini
     there is); the other 19 stay 'coming_soon'. Finished Journeys keep their own status. Swapping a pick is a
     one-word status change on the two entries.
     status: 'available' | 'prototype' | 'in_development' | 'coming_soon' | 'coming_soon_prestige' | 'coming_soon_meta'
     journeyStructure (Aster's mechanical taxonomy, independent of
     category): 'route' (start, end, continuous path) | 'circuit'
     (loop back to start) | 'river' (a route structure, tagged
     separately since river renderers/theming differ) | 'vertical'
     (elevation/altitude-band progression, not horizontal km) |
     'network' (node-to-node destinations, never forced into one fake
     polyline) | 'meta' (progress against a global concept -- the
     player is not literally walking an accessible road along it).
     null for the 3 Legendary Journey placeholders -- genuinely TBD,
     not guessed.
     scale: Aster's qualitative planning-scale text (Mini/Short/Long/
     Epic and combinations/qualifiers) -- a planning hint, NEVER a
     locked distance, shown only on placeholder cards. Real entries
     (hadrians-wall, rome-four-basilicas) read live km instead; their
     `scale` field is reference-only and unused by any render path.
     concept: Aster's one-line "basic route / concept" description --
     real authored content, not invented here. */
  const JOURNEY_CATALOGUE=[
    // ---------------- World Tours > Long-Distance Trails ----------------
    {id:'appalachian-trail',name:'Appalachian Trail',subtitle:'Long-Distance Trail',category:'world-tours',subcategory:'Long-Distance Trails',status:'in_development',movement:'Foot',theme:'Wilderness',journeyStructure:'route',scale:'Epic',concept:'Eastern United States long-distance trail'},
    {id:'pacific-crest-trail',name:'Pacific Crest Trail',subtitle:'Long-Distance Trail',category:'world-tours',subcategory:'Long-Distance Trails',status:'coming_soon',movement:'Foot',theme:'Wilderness',journeyStructure:'route',scale:'Epic',concept:'Mexico border → Canada through the western US'},
    {id:'te-araroa',name:'Te Araroa',subtitle:'Long-Distance Trail',category:'world-tours',subcategory:'Long-Distance Trails',status:'coming_soon',movement:'Foot',theme:'Wilderness',journeyStructure:'route',scale:'Epic',concept:'The length of New Zealand'},
    {id:'west-highland-way',name:'West Highland Way',subtitle:'Long-Distance Trail',category:'world-tours',subcategory:'Long-Distance Trails',status:'coming_soon',movement:'Foot',theme:'Wilderness',journeyStructure:'route',scale:'Long',concept:'Milngavie → Fort William'},
    {id:'great-glen-loch-ness',name:'Great Glen / Loch Ness',subtitle:'Long-Distance Trail',category:'world-tours',subcategory:'Long-Distance Trails',status:'coming_soon',movement:'Foot',theme:'Wilderness',journeyStructure:'route',scale:'Long',concept:'Fort William → Inverness corridor'},
    // ---------------- World Tours > National & Continental Crossings ----------------
    {id:'cape-town-magadan',name:'Cape Town → Magadan',subtitle:'Continental Crossing',category:'world-tours',subcategory:'National & Continental Crossings',status:'coming_soon_prestige',movement:'Foot / Human Powered / Custom',theme:'Prestige',journeyStructure:'route',scale:'Epic / Prestige',concept:'Southern Africa → far eastern Russia, theoretical overland crossing'},
    {id:'john-ogroats-lands-end',name:'John o’ Groats → Land’s End',subtitle:'National Crossing',category:'world-tours',subcategory:'National & Continental Crossings',status:'coming_soon',movement:'Foot / cycle',theme:'Crossing',journeyStructure:'route',scale:'Long / Epic',concept:'Northern Scotland → southwest England'},
    {id:'nordkapp-lindesnes',name:'Nordkapp → Lindesnes',subtitle:'National Crossing',category:'world-tours',subcategory:'National & Continental Crossings',status:'coming_soon',movement:'Foot / cycle',theme:'Crossing',journeyStructure:'route',scale:'Epic',concept:'Northernmost Norway → southern Norway'},
    {id:'japan-end-to-end',name:'Japan End-to-End',subtitle:'National Crossing',category:'world-tours',subcategory:'National & Continental Crossings',status:'coming_soon',movement:'Foot / cycle',theme:'Crossing',journeyStructure:'route',scale:'Epic',concept:'Curated north → south Japan traversal'},
    {id:'australia-crossing',name:'Australia Crossing',subtitle:'Continental Crossing',category:'world-tours',subcategory:'National & Continental Crossings',status:'coming_soon',movement:'Human Powered',theme:'Crossing',journeyStructure:'route',scale:'Epic',concept:'Defined coast-to-coast Australian crossing'},
    {id:'trans-canada',name:'Trans-Canada',subtitle:'National Crossing',category:'world-tours',subcategory:'National & Continental Crossings',status:'coming_soon',movement:'Human Powered',theme:'Crossing',journeyStructure:'route',scale:'Epic',concept:'Cross-Canada traversal'},
    {id:'pan-american-route',name:'Pan-American Route',subtitle:'Continental Crossing',category:'world-tours',subcategory:'National & Continental Crossings',status:'coming_soon',movement:'Human Powered',theme:'Crossing',journeyStructure:'network',scale:'Epic / Prestige',concept:'North America → South America macro Journey (Darién Gap needs an authored treatment, not a continuous walkable road)'},
    // ---------------- World Tours > Coastal & Island Tours ----------------
    {id:'around-iceland',name:'Around Iceland',subtitle:'Coastal Tour',category:'world-tours',subcategory:'Coastal & Island Tours',status:'coming_soon',movement:'Foot / cycle',theme:'Coastal',journeyStructure:'circuit',scale:'Long / Epic',concept:'Iceland circuit'},
    {id:'isle-of-wight-coastal',name:'Isle of Wight Coastal Tour',subtitle:'Coastal Tour',category:'world-tours',subcategory:'Coastal & Island Tours',status:'in_development',movement:'Foot',theme:'Coastal',journeyStructure:'circuit',scale:'Long',concept:'Island coastal circuit'},
    {id:'cinque-terre-coast',name:'Cinque Terre Coast',subtitle:'Coastal Tour',category:'world-tours',subcategory:'Coastal & Island Tours',status:'coming_soon',movement:'Foot',theme:'Coastal',journeyStructure:'route',scale:'Short',concept:'Five Ligurian villages and connecting coastal route'},
    {id:'ring-of-kerry',name:'Ring of Kerry',subtitle:'Coastal Tour',category:'world-tours',subcategory:'Coastal & Island Tours',status:'coming_soon',movement:'Foot / cycle',theme:'Coastal',journeyStructure:'circuit',scale:'Long',concept:'Kerry peninsula circuit'},
    {id:'causeway-coast-way',name:'Causeway Coast Way',subtitle:'Coastal Tour',category:'world-tours',subcategory:'Coastal & Island Tours',status:'coming_soon',movement:'Foot',theme:'Coastal',journeyStructure:'route',scale:'Short / Long',concept:'Northern Irish coastal route'},
    {id:'maltese-islands-tour',name:'Maltese Islands Tour',subtitle:'Island Tour',category:'world-tours',subcategory:'Coastal & Island Tours',status:'coming_soon',movement:'Foot',theme:'Coastal',journeyStructure:'network',scale:'Short / Long',concept:'Curated Malta / Gozo network'},
    {id:'singapore-coast-to-coast',name:'Singapore Coast-to-Coast',subtitle:'Coastal Tour',category:'world-tours',subcategory:'Coastal & Island Tours',status:'in_development',movement:'Foot',theme:'Coastal',journeyStructure:'route',scale:'Short',concept:'Cross-island urban/nature Journey'},
    {id:'monaco-grand-loop',name:'Monaco Grand Loop',subtitle:'Coastal Tour',category:'world-tours',subcategory:'Coastal & Island Tours',status:'in_development',movement:'Foot',theme:'Coastal',journeyStructure:'circuit',scale:'Mini',concept:'Compact Monaco circuit'},
    {id:'great-ocean-road',name:'Great Ocean Road',subtitle:'Coastal Tour',category:'world-tours',subcategory:'Coastal & Island Tours',status:'coming_soon',movement:'Foot / cycle',theme:'Coastal',journeyStructure:'route',scale:'Long',concept:'Victoria coastal route'},
    {id:'coast-of-norway',name:'Coast of Norway',subtitle:'Coastal Tour',category:'world-tours',subcategory:'Coastal & Island Tours',status:'coming_soon',movement:'Human Powered',theme:'Coastal',journeyStructure:'route',scale:'Epic',concept:'Curated Norwegian coastal Journey'},
    // ---------------- World Tours > Road / Touring Routes ----------------
    {id:'rpg-grand-tour-france',name:'RPG Grand Tour of France',subtitle:'Road / Touring Route',category:'world-tours',subcategory:'Road / Touring Routes',status:'coming_soon',movement:'Cycling / Human Powered',theme:'Touring',journeyStructure:'route',scale:'Long / Epic',concept:'RPG-original cycling/walking grand tour, clearly its own route rather than a duplicate of a real event'},
    // ---------------- Legendary Journeys ----------------
    {id:'legendary-journey-1',name:'Legendary Journey I',subtitle:'Legendary Journey',category:'legendary',subcategory:null,status:'coming_soon',movement:null,theme:'Legendary',journeyStructure:null,scale:'TBD',concept:null},
    {id:'legendary-journey-2',name:'Legendary Journey II',subtitle:'Legendary Journey',category:'legendary',subcategory:null,status:'coming_soon',movement:null,theme:'Legendary',journeyStructure:null,scale:'TBD',concept:null},
    {id:'legendary-journey-3',name:'Legendary Journey III',subtitle:'Legendary Journey',category:'legendary',subcategory:null,status:'coming_soon',movement:null,theme:'Legendary',journeyStructure:null,scale:'TBD',concept:null},
    // ---------------- Mountain & Vertical > Alpine Trails ----------------
    {id:'via-alpina',name:'Via Alpina / Alps',subtitle:'Alpine Trail',category:'mountain',subcategory:'Alpine Trails',status:'coming_soon',movement:'Foot',theme:'Alpine',journeyStructure:'route',scale:'Epic',concept:'Multi-country Alpine trail Journey'},
    {id:'tour-du-mont-blanc',name:'Tour du Mont Blanc',subtitle:'Alpine Trail',category:'mountain',subcategory:'Alpine Trails',status:'coming_soon',movement:'Foot',theme:'Alpine',journeyStructure:'circuit',scale:'Long',concept:'Full circuit around the Mont Blanc massif — distinct from the summit Journey'},
    // ---------------- Mountain & Vertical > Individual Mountains ----------------
    {id:'everest',name:'Everest',subtitle:'Vertical Journey',category:'mountain',subcategory:'Individual Mountains',status:'coming_soon',movement:'Foot / elevation',theme:'Mountain',journeyStructure:'vertical',scale:'Special commitment',concept:'Elevation-band progression / Everest ascent simulation — never treated as horizontal km equalling the real climb'},
    {id:'kilimanjaro',name:'Kilimanjaro',subtitle:'Vertical Journey',category:'mountain',subcategory:'Individual Mountains',status:'coming_soon',movement:'Foot / elevation',theme:'Mountain',journeyStructure:'vertical',scale:'Short commitment',concept:'Base → summit vertical Journey'},
    {id:'mont-blanc-ascent',name:'Mont Blanc Ascent',subtitle:'Vertical Journey',category:'mountain',subcategory:'Individual Mountains',status:'coming_soon',movement:'Foot / elevation',theme:'Mountain',journeyStructure:'vertical',scale:'Short commitment',concept:'Base → Mont Blanc summit'},
    // ---------------- Mountain & Vertical > Mountain Collections ----------------
    {id:'seven-summits',name:'Seven Summits',subtitle:'Mountain Collection',category:'mountain',subcategory:'Mountain Collections',status:'coming_soon_meta',movement:'Mixed',theme:'Mountain',journeyStructure:'network',scale:'Prestige / Meta',concept:'Seven mountain nodes (one per continent) completed as a meta Journey'},
    // ---------------- River & Water ----------------
    {id:'danube',name:'Danube',subtitle:'River Journey',category:'river',subcategory:null,status:'coming_soon',movement:'Foot / cycle / rowing',theme:'River',journeyStructure:'river',scale:'Epic',concept:'Source toward the Black Sea'},
    {id:'rhine',name:'Rhine',subtitle:'River Journey',category:'river',subcategory:null,status:'coming_soon',movement:'Foot / cycle / rowing',theme:'River',journeyStructure:'river',scale:'Long / Epic',concept:'Alps → North Sea'},
    {id:'nile',name:'Nile',subtitle:'River Journey',category:'river',subcategory:null,status:'coming_soon',movement:'Custom / rowing',theme:'River',journeyStructure:'river',scale:'Epic',concept:'Curated Nile Journey through northeast Africa'},
    {id:'amazon',name:'Amazon',subtitle:'River Journey',category:'river',subcategory:null,status:'coming_soon',movement:'Rowing / Custom',theme:'River',journeyStructure:'river',scale:'Epic / Prestige',concept:'Curated source-to-ocean Amazon Journey'},
    // ---------------- Special Tours > Network & Circuit Tours ----------------
    {id:'european-capitals-tour',name:'European Capitals Tour',subtitle:'Network Tour',category:'special',subcategory:'Network & Circuit Tours',status:'coming_soon',movement:'Custom',theme:'Network',journeyStructure:'network',scale:'Epic / Network',concept:'Connected sequence of European capitals — each capital a node and reward checkpoint'},
    {id:'around-mediterranean',name:'Around Mediterranean',subtitle:'Network Tour',category:'special',subcategory:'Network & Circuit Tours',status:'coming_soon',movement:'Custom',theme:'Coastal',journeyStructure:'network',scale:'Epic / Prestige',concept:'Multi-country Mediterranean circuit'},
    // ---------------- Special Tours > Meta & Concept Tours ----------------
    {id:'equator-tour',name:'Equator Tour',subtitle:'Meta Tour',category:'special',subcategory:'Meta & Concept Tours',status:'coming_soon',movement:'Any eligible',theme:'Special',journeyStructure:'meta',scale:'Prestige / Meta',concept:'Progress around the world following the Equator — not a literal walkable route'},
    {id:'prime-meridian-tour',name:'Prime Meridian Tour',subtitle:'Meta Tour',category:'special',subcategory:'Meta & Concept Tours',status:'coming_soon',movement:'Any',theme:'Special',journeyStructure:'meta',scale:'Epic / Meta',concept:'Pole-to-pole progression following the 0° longitude concept'},
    {id:'around-the-world',name:'Around the World',subtitle:'Meta Tour',category:'special',subcategory:'Meta & Concept Tours',status:'coming_soon_meta',movement:'Any eligible',theme:'Prestige',journeyStructure:'meta',scale:'Mythic / Prestige',concept:'Full global-distance meta Journey — countries/continents could unlock as chapters'},
    // ---------------- Historical > Ancient Empires ----------------
    {id:'hadrians-wall',name:'Hadrian’s Wall',subtitle:'Ancient Empire',category:'historical',subcategory:'Ancient Empires',status:'available',movement:'Foot',theme:'Historic',journeyStructure:'route',scale:'135 km — locked',concept:'Wallsend → Bowness-on-Solway'},
    {id:'great-wall-of-china',name:'Great Wall of China',subtitle:'Ancient Empire',category:'historical',subcategory:'Ancient Empires',status:'coming_soon',movement:'Foot',theme:'Historic',journeyStructure:'network',scale:'Epic',concept:'Curated sequence of major Wall sections, not one continuous trail'},
    {id:'silk-road',name:'Silk Road',subtitle:'Ancient Empire',category:'historical',subcategory:'Ancient Empires',status:'coming_soon',movement:'Human Powered',theme:'Historic',journeyStructure:'network',scale:'Epic / Prestige',concept:'Multi-stage trade route across Eurasia'},
    {id:'inca-trail-andes',name:'Inca Trail / Andes Route',subtitle:'Ancient Empire',category:'historical',subcategory:'Ancient Empires',status:'coming_soon',movement:'Foot',theme:'Historic',journeyStructure:'route',scale:'Short / Long',concept:'Curated Andean route culminating around Machu Picchu'},
    // ---------------- Historical > Sacred & Pilgrimage Routes ----------------
    {id:'camino-de-santiago',name:'Camino Francés',subtitle:'Pilgrimage',category:'historical',subcategory:'Sacred & Pilgrimage Routes',status:'available',movement:'Foot',theme:'Pilgrimage',journeyStructure:'route',scale:'791 km — proposed, pending Aster approval',concept:'Saint-Jean-Pied-de-Port → Santiago de Compostela'},
    {id:'rome-four-basilicas',name:'Rome — Four Basilicas',subtitle:'Pilgrimage',category:'historical',subcategory:'Sacred & Pilgrimage Routes',status:'prototype',movement:'Foot',theme:'Pilgrimage',journeyStructure:'route',scale:'Mini',concept:'Four major papal basilicas of Rome'},
    {id:'shikoku-88-temple',name:'Shikoku 88 Temple Pilgrimage',subtitle:'Pilgrimage',category:'historical',subcategory:'Sacred & Pilgrimage Routes',status:'coming_soon',movement:'Foot',theme:'Pilgrimage',journeyStructure:'circuit',scale:'Long',concept:'Circuit of Shikoku’s 88 temples'},
    {id:'kumano-kodo-kohechi',name:'Kumano Kodo — Kohechi',subtitle:'Pilgrimage',category:'historical',subcategory:'Sacred & Pilgrimage Routes',status:'coming_soon',movement:'Foot',theme:'Pilgrimage',journeyStructure:'route',scale:'Short / Long',concept:'Mountain pilgrimage route through the Kii Peninsula'},
    {id:'kumano-kodo-nakahechi',name:'Kumano Kodo — Nakahechi Highlights',subtitle:'Pilgrimage',category:'historical',subcategory:'Sacred & Pilgrimage Routes',status:'coming_soon',movement:'Foot',theme:'Pilgrimage',journeyStructure:'route',scale:'Short',concept:'Curated shorter version of the Nakahechi pilgrimage'},
    // ---------------- Historical > Modern History ----------------
    {id:'berlin-wall-trail',name:'Berlin Wall Trail',subtitle:'Modern History',category:'historical',subcategory:'Modern History',status:'coming_soon',movement:'Foot / cycle',theme:'Historic',journeyStructure:'circuit',scale:'Long',concept:'Circuit following the former Berlin Wall'},
    {id:'route-66',name:'Route 66',subtitle:'Modern History',category:'historical',subcategory:'Modern History',status:'coming_soon',movement:'Custom / cycling / foot conversion',theme:'Historic',journeyStructure:'route',scale:'Long / Epic',concept:'Chicago → Santa Monica'}
    // ---------------- Historical > Ruins & Archaeology ----------------
    // Reserved for future ruin/archaeology-site Journeys (Roman, Greek,
    // Egyptian, Norse, medieval, Mesoamerican, etc.) -- deliberately no
    // entries yet; a subcategory with zero entries renders no heading
    // (jcCategoryHTML groups only subcategories that have entries), so
    // nothing needs to be invented here to "reserve" the slot. Tag a
    // future entry subcategory:'Ruins & Archaeology' and the heading
    // appears on its own.
  ];

  const JC_STATUS_LABEL={
    available:'AVAILABLE',
    prototype:'PROTOTYPE · DEV TESTING',
    in_development:'UNDER DEVELOPMENT',
    coming_soon:'COMING SOON',
    coming_soon_prestige:'COMING SOON — PRESTIGE',
    coming_soon_meta:'COMING SOON — META',
    locked:'LOCKED',
    active:'ACTIVE',
    paused:'PAUSED',
    completed:'COMPLETED'
  };
  /* Card badge for a REAL entry reflects live progress once started
     (ACTIVE/PAUSED/COMPLETED override the catalogue's authored
     available/prototype status); a placeholder always shows exactly
     its authored status since it has no progress to read. */
  function jcDisplayStatus(entry){
    if(JC_REAL_IDS.has(entry.id)){
      const prog=jcLiveProgress(entry);
      if(prog&&(prog.status==='active'||prog.status==='paused'||prog.status==='completed'))return prog.status;
    }
    return entry.status;
  }

  function jcSizeClass(km){
    if(km==null)return null;
    if(km<20)return 'mini';
    if(km<100)return 'short';
    if(km<1000)return 'long';
    return 'epic';
  }
  /* Live distance for a REAL entry, read from the actual engine data --
     never duplicated/hardcoded here so it can never drift (Rome's own
     totalDistance is itself derived, per RPG-0084/0087). null for every
     placeholder, exactly as authored. */
  function jcLiveDistance(entry){
    if(!JC_REAL_IDS.has(entry.id))return null;
    const wt=WORLD_TOUR_DEFINITIONS[entry.id];
    return wt?Number(wt.totalDistance):null;
  }
  function jcLiveProgress(entry){
    if(!JC_REAL_IDS.has(entry.id))return null;
    return ensureJourneyProgress(entry.id);
  }
  /* A placeholder has no live km, so the Mini/Short/Long/Epic filter
     falls back to a case-insensitive substring match against Aster's
     own scale text ("Epic", "Short / Long", ...) -- her scale words
     ARE the bucket names, so this stays a direct match rather than a
     second guessed taxonomy. Entries whose scale doesn't use any of
     the 4 words (e.g. "Mythic / Prestige", "Special commitment", "TBD")
     only ever show under "All", which is honest: we don't know exactly
     which bucket they'd land in. */
  function jcMatchesSizeFilter(entry,filterKey){
    const km=jcLiveDistance(entry);
    if(km!=null)return jcSizeClass(km)===filterKey;
    return Boolean(entry.scale)&&entry.scale.toLowerCase().includes(filterKey);
  }

  let jcView='hub'; // 'hub' | 'category'
  let jcCategory=null;
  let jcFilter='all'; // all | mini | short | long | epic

  function jcReset(){jcView='hub';jcCategory=null;jcFilter='all'}

  function jcCategoryCount(catId){return JOURNEY_CATALOGUE.filter(e=>e.category===catId).length}

  function jcActiveSectionHTML(){
    const j=ensureJourneysState();
    const ids=[];
    j.slots.forEach(id=>{if(id){const p=ensureJourneyProgress(id);if(p.status==='active'||p.status==='paused')ids.push(id)}});
    const megaP=j.progress[j.megaJourneyId];
    if(megaP&&(megaP.status==='active'||megaP.status==='paused')&&!ids.includes(j.megaJourneyId))ids.push(j.megaJourneyId);
    if(!ids.length)return '';
    return `<div class="jc-section"><h3 class="jc-section-title">Active Journeys</h3><div class="jc-active-row">${ids.map(id=>{
      const def=QUEST_DEFINITIONS[id],wt=WORLD_TOUR_DEFINITIONS[id],p=ensureJourneyProgress(id);
      const pct=wt&&wt.totalDistance?Math.round((p.totalProgress/wt.totalDistance)*100):0;
      return `<button type="button" class="jc-active-card" data-jc-continue="${id}">
        <b>${esc(def?def.title:id)}</b>
        <span>${p.totalProgress.toFixed(1)} / ${(wt?wt.totalDistance:0).toLocaleString()} km · ${pct}%${p.status==='paused'?' · Paused':''}</span>
      </button>`;
    }).join('')}</div></div>`;
  }

  function jcFeaturedSectionHTML(){
    const ids=['hadrians-wall','cape-town-magadan','route-66','everest'];
    return `<div class="jc-section"><h3 class="jc-section-title">Featured</h3><div class="jc-featured-list">${ids.map(id=>{
      const e=JOURNEY_CATALOGUE.find(x=>x.id===id);if(!e)return '';
      const ds=jcDisplayStatus(e);
      return `<button type="button" class="jc-featured-row" data-jc-open-card="${e.id}"><span>${esc(e.name)}</span><span class="jc-status-pill jc-status-${ds}">${JC_STATUS_LABEL[ds]||ds}</span></button>`;
    }).join('')}</div></div>`;
  }

  function jcHubHTML(){
    const div=QUEST_DIVISIONS.find(d=>d.id==='journeys');
    const back=`<button type="button" class="text-btn campaign-back" id="questDivisionBack">← Adventures</button>`;
    const header=`<h2 class="section-title">${esc(div?div.label:'Journeys')}</h2><p class="helper">${esc(div?div.description||div.subtitle:'')}</p>`;
    return back+header+`${jcActiveSectionHTML()}
    <div class="jc-section">
      <h3 class="jc-section-title">Explore</h3>
      <div class="jc-category-grid">${JC_CATEGORIES.map(c=>`<button type="button" class="jc-category-tile" data-jc-open-category="${c.id}">
        <b>${esc(c.label)}</b><span class="jc-category-subtitle">${esc(c.subtitle)}</span><span class="jc-category-count">${jcCategoryCount(c.id)}</span>
      </button>`).join('')}</div>
    </div>
    ${jcFeaturedSectionHTML()}`;
  }

  function jcFilterBarHTML(){
    const filters=[['all','All'],['mini','Mini'],['short','Short'],['long','Long'],['epic','Epic']];
    return `<div class="jc-filter-bar">${filters.map(([key,label])=>`<button type="button" class="jc-filter-chip ${jcFilter===key?'active':''}" data-jc-filter="${key}">${label}</button>`).join('')}</div>`;
  }

  function jcCardHTML(entry){
    const isReal=JC_REAL_IDS.has(entry.id);
    const distanceKm=jcLiveDistance(entry);
    const prog=jcLiveProgress(entry);
    const started=prog&&prog.status!=='not_started';
    const distanceText=distanceKm!=null?`${distanceKm.toLocaleString()} km`:(entry.scale?`Scale: ${entry.scale}`:'Distance: —');
    const tags=[entry.movement,entry.theme].filter(Boolean).join(' · ');
    const ds=jcDisplayStatus(entry);
    return `<button type="button" class="jc-card ${isReal?'jc-card-real':'jc-card-placeholder'}" data-jc-card="${entry.id}">
      <div class="jc-card-art">${isReal?'':'<span>PLACEHOLDER ART</span>'}</div>
      <div class="jc-card-body">
        <b class="jc-card-name">${esc(entry.name)}</b>
        <span class="jc-card-subtitle">${esc(entry.subtitle||'')}</span>
        ${entry.concept?`<span class="jc-card-concept">${esc(entry.concept)}</span>`:''}
        <span class="jc-card-distance">${distanceText}</span>
        ${tags?`<span class="jc-card-tags">${esc(tags)}</span>`:''}
        ${started?`<span class="jc-card-progress">${prog.totalProgress.toFixed(1)} km travelled</span>`:''}
        <span class="jc-status-pill jc-status-${ds}">${JC_STATUS_LABEL[ds]||ds}</span>
      </div>
    </button>`;
  }

  function jcCategoryHTML(catId){
    const cat=JC_CATEGORIES.find(c=>c.id===catId);if(!cat)return '';
    let entries=JOURNEY_CATALOGUE.filter(e=>e.category===catId);
    if(jcFilter!=='all')entries=entries.filter(e=>jcMatchesSizeFilter(e,jcFilter));
    const bySub={};
    const subOrder=[];
    entries.forEach(e=>{
      const key=e.subcategory||'';
      if(!bySub[key]){bySub[key]=[];subOrder.push(key)}
      bySub[key].push(e);
    });
    const back=`<button type="button" class="text-btn campaign-back" data-jc-back-hub="1">← Journeys</button>`;
    const header=`<h2 class="section-title">${esc(cat.label)}</h2><p class="helper">${esc(cat.subtitle)}</p>`;
    if(!entries.length)return back+header+jcFilterBarHTML()+`<p class="helper">No Journeys match this filter yet.</p>`;
    /* inside each heading: playable first, then the ones being built, then coming soon (stable, so authored order is kept within a group) */
    const rank=e=>{const st=jcDisplayStatus(e);return (st==='available'||st==='active'||st==='paused'||st==='completed')?0:st==='prototype'?1:st==='in_development'?2:3};
    Object.keys(bySub).forEach(k=>{bySub[k]=bySub[k].map((e,i)=>[e,i]).sort((a,b)=>rank(a[0])-rank(b[0])||a[1]-b[1]).map(x=>x[0])});
    const groups=subOrder.map(sub=>`${sub?`<h4 class="jc-subcategory-title">${esc(sub)}</h4>`:''}<div class="jc-card-grid">${bySub[sub].map(jcCardHTML).join('')}</div>`).join('');
    return back+header+jcFilterBarHTML()+groups;
  }

  function jcRenderJourneysDivision(){
    return jcView==='category'&&jcCategory?jcCategoryHTML(jcCategory):jcHubHTML();
  }

  function jcBind(){
    document.querySelectorAll('[data-jc-open-category]').forEach(b=>b.onclick=()=>{jcView='category';jcCategory=b.dataset.jcOpenCategory;jcFilter='all';renderQuestsArea()});
    document.querySelectorAll('[data-jc-back-hub]').forEach(b=>b.onclick=()=>{jcView='hub';jcCategory=null;renderQuestsArea()});
    document.querySelectorAll('[data-jc-filter]').forEach(b=>b.onclick=()=>{jcFilter=b.dataset.jcFilter;renderQuestsArea()});
    document.querySelectorAll('[data-jc-continue]').forEach(b=>b.onclick=()=>{questsView='quest';questsQuestId=b.dataset.jcContinue;renderQuestsArea()});
    document.querySelectorAll('[data-jc-card],[data-jc-open-card]').forEach(el=>{
      const id=el.dataset.jcCard||el.dataset.jcOpenCard;
      el.onclick=()=>{
        const entry=JOURNEY_CATALOGUE.find(e=>e.id===id);if(!entry)return;
        if(JC_REAL_IDS.has(id)){questsView='quest';questsQuestId=id;renderQuestsArea();return}
        toast(entry.status==='in_development'?`${entry.name} — under development. Not playable yet.`:`${entry.name} — ${JC_STATUS_LABEL[entry.status]||'not yet available'}.`);
      };
    });
  }

  window.jcReset=jcReset;
  window.jcRenderJourneysDivision=jcRenderJourneysDivision;
  window.jcBind=jcBind;
  window.JOURNEY_CATALOGUE=JOURNEY_CATALOGUE;
})();
