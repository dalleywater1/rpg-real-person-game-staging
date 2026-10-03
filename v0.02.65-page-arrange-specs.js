/* ==========================================================================
   PAGE ARRANGE: per-page specs (Jay, 2026-10-03: "each page should have the ability to
   move the items in it up and down so its easily customizable").
   The engine is v0.02.65-page-arrange.js (read its header first). One block per page; each
   block is its own function scope so helper names cannot collide. A spec's match() must
   be mutually exclusive with the other specs of the same page, read the rendered DOM where
   state variables can be stale, and guard top-level `let` state with typeof. Sections that
   are not listed (page headers, the Training hero and category bars, Home's hero, ...) are
   FIXED. Order of sections INSIDE a section is data and is never touched.
   ========================================================================== */

/* ===== home ===== */
(function(){
/* ==========================================================================
   Page Arrange spec: HOME  (one view, key 'home')
   --------------------------------------------------------------------------
   Home is the odd page out. Its modules are NOT uniform siblings of #view:
   homeModulesHTML() (app.js) emits the Quests + Today pair as glued sections
   and wraps every other run in div.home-today-stack with gold dividers, all
   generated from state.home.order. So the engine must never physically
   re-place Home's nodes. This spec therefore:
     - lists the module roots (section.home-panel[data-arrange-id], tagged by
       homeArrangeTag() in app.js) as the groups (one node per module);
     - reports the CURRENT DOM order as order(), so the engine's apply step
       always sees "already in order" and pageArrangePlace() never touches the
       DOM (by construction, even if state.home.order were ever out of step);
     - does every real move/reset itself: swap two ids in state.home.order
       (the same list Profile & Setup > Home edits) and repaint with
       renderHome() (homeArrangeMove / homeArrangeReset, app.js);
     - never writes state.pageLayout.pages.home;
     - noEntry:true: the engine's default entry row is the FIRST child of #view,
       i.e. above the frozen Player Status hero (it would push it down). Home
       draws the very same button itself, right after the hero and the
       onboarding card, from homeArrangeEntryHTML() (app.js). The engine's
       document click handler opens the dialog from its data-arrange-open.
   FIXED (never listed, never moved past): header.home-top-panel (hero with
   Weather inside), the onboarding card, div.home-today-divider /
   div.home-today-stack wrappers, div.version.
   ========================================================================== */
pageArrangeRegister({
  key:'home',
  label:'Home',
  noEntry:true,
  /* the rendered hero is the marker: it exists only on a painted Home, so a stale `page` can never match another view */
  match:()=>typeof page!=='undefined'&&page==='home'&&!!document.querySelector('#view .home-top-panel'),
  container:()=>document.querySelector('#view'),
  groups:()=>homeArrangeNodes().map(el=>{
    const id=el.getAttribute('data-arrange-id');
    return {id,label:el.getAttribute('data-arrange-label')||id,nodes:[el]};
  }),
  order:()=>homeArrangeNodes().map(el=>el.getAttribute('data-arrange-id')),
  move:(id,dir)=>{homeArrangeMove(id,dir)},
  reset:()=>{homeArrangeReset()}
});
})();

/* ===== adventurers-log ===== */
(function(){
/* Adventurer's Log (the Log page): two views, both a vertical stack of single-element sections that carry
   data-arrange-id / data-arrange-label. The REBUILT Log must keep doing the same: one <section> per block, a direct child
   of the page root, a permanent kebab-case id, the heading inside the section, rendered synchronously.

   View 1  'adventurers-log'          the Log itself (renderTasks)         default order: Linked Training Schedule,
           container #view > .log-v1                                         Weekly Recap, Top 3, Today, Coming up, Soon,
                                                                              Later, Unscheduled, Done (only when something
                                                                              is done), Calendar, Notes
           FIXED (no attribute): header.q-head--scene, the Add Item toolbar (.log-toolbar) and the hidden span.log-linked-anchor.
   View 2  'adventurers-log:recap'    the Weekly Recap view (recapPage)     default order: Training, Quests,
           container #view > .log-v1 > .recap-page                           Personal Growth, Self Care (only when a
           FIXED: div.recap-controls (Back + This/Last week), p.recap-range, the whole-page .q-empty note.   Self Care part is on), Achievements earned

   The Week/Month switch is not a view of its own (it only changes the inside of the Calendar section), and neither is
   This week / Last week (same recap sections), so each view has ONE key. Both matches are DOM based (the Log's
   renderTasks and the recap's recapPage are both reached from several code paths that never go through render()),
   and they are mutually exclusive: the recap is the only thing that renders .recap-page under .log-v1.
   Linked Training is injected by v023AppendLinkedSchedule in the same synchronous call chain as the base render, so it is
   already in the DOM when the engine's microtask runs. */
const LOG_ARRANGE_ROOT = '#view > .log-v1';
const LOG_ARRANGE_RECAP = '#view > .log-v1 > .recap-page';
const logArrangeOnPage = () => typeof page !== 'undefined' && page === 'adventurers-log';

pageArrangeRegister({
  key: 'adventurers-log',
  label: "Adventurer's Log",
  match: () => logArrangeOnPage() && !!document.querySelector(LOG_ARRANGE_ROOT) && !document.querySelector(LOG_ARRANGE_RECAP),
  container: () => document.querySelector(LOG_ARRANGE_ROOT),
  groups: c => arrangeGroupsByAttr(c)
});

pageArrangeRegister({
  key: 'adventurers-log:recap',
  label: 'Weekly Recap',
  match: () => logArrangeOnPage() && !!document.querySelector(LOG_ARRANGE_RECAP),
  /* an empty week renders only a note (no sections): no container, so no Arrange button that opens an empty dialog */
  container: () => {
    const c = document.querySelector(LOG_ARRANGE_RECAP);
    return c && c.querySelectorAll(':scope > [data-arrange-id]').length >= 2 ? c : null;
  },
  groups: c => arrangeGroupsByAttr(c)
});
})();

/* ===== quests ===== */
(function(){
/* QUESTS page arrange specs (page id: quests). Five views, all keyed off the RENDERED DOM (never off qpView / qpMainView, which
   persist across navigation and can be reset mid-render). renderSideQuests() wraps every sub-view in
   <div class="quests-v4 quest-<hub|main|side|quick>"> as a direct child of #view, so the wrapper class is the first
   discriminator and the markers below tell the Main Quest views apart.
   NOT registered on purpose: Daily Quests (retired, Lyra D4: no page any more), the Main Quest list / drafts / history / templates views (one
   q-section each, nothing to reorder) and the Adventurer's Log (quest-log, owned by its own page id).
   The data-arrange-* attributes these specs read live in the page templates (app.js and v0.02.33-quick-quests.js). The
   attribute-based views only show the Arrange button while at least TWO tagged sections are on screen, so if a later rebuild
   (M3 Quick Quests, M5 hub) drops the attributes the button quietly disappears instead of opening an empty dialog. */

const QA_WRAP = '#view > .quests-v4';
const QA_HUB_GRID = QA_WRAP + '.quest-hub > .q-tile-grid';
const QA_MAIN = QA_WRAP + '.quest-main';
const QA_SIDE = QA_WRAP + '.quest-side';
const QA_QUICK = QA_WRAP + '.quest-quick';
const QA_TILE = '.q-tile[data-qp-view]';

/* number of direct children of `c` that carry a data-arrange-id */
function qaTagged(c) {
  return c.querySelectorAll(':scope > [data-arrange-id]').length;
}

/* ---- hub: the tile grid (Main, Side, Quick; the first tile spans both columns). One group per tile; the id is the tile's own route key (data-qp-view), so no markup change is
   needed and tiles added by the M5 hub rebuild join automatically. The grid reads row-major (1 / 2 3), so Up = earlier. ---- */
pageArrangeRegister({
  key: 'quests:hub',
  label: 'Quests (tiles read left to right, then down)',
  match: () => {
    const c = document.querySelector(QA_HUB_GRID);
    return !!c && c.querySelectorAll(':scope > ' + QA_TILE).length > 1;
  },
  container: () => document.querySelector(QA_HUB_GRID),
  groups: c => [...c.children]
    .filter(el => el.matches(QA_TILE))
    .map(el => {
      const id = el.getAttribute('data-qp-view');
      const t = el.querySelector('.q-tile__title');
      return { id, label: (t && t.textContent.trim()) || id, nodes: [el] };
    })
});

/* ---- Main Quests hub (qpMainView 'hub'): the quest-count stat strip and the Active Main Quests list. The compact hero with
   the New Main Quest button stays fixed above both. Identified by the 'counts' section, which only this view renders. ---- */
pageArrangeRegister({
  key: 'quests:main',
  label: 'Main Quests',
  match: () => {
    const c = document.querySelector(QA_MAIN);
    return !!c && !c.querySelector(':scope > .mq-detail-head') &&
      !!c.querySelector(':scope > [data-arrange-id="counts"]') && qaTagged(c) > 1;
  },
  container: () => document.querySelector(QA_MAIN),
  groups: c => arrangeGroupsByAttr(c)
});

/* ---- Main Quest detail (qpMainView 'detail'): the action buttons and the details/tabs block. Same key for all four tabs
   (a tab switch re-renders the whole page and both sections are present on every tab) and for every quest. The detail hero
   (.mq-detail-head) stays fixed. ---- */
pageArrangeRegister({
  key: 'quests:main-detail',
  label: 'Main Quest details',
  match: () => {
    const c = document.querySelector(QA_MAIN);
    return !!c && !!c.querySelector(':scope > .mq-detail-head') && qaTagged(c) > 1;
  },
  container: () => document.querySelector(QA_MAIN),
  groups: c => arrangeGroupsByAttr(c)
});

/* ---- Side Quests: Today, Quest Chain, Custom Side Quests ---- */
pageArrangeRegister({
  key: 'quests:side',
  label: 'Side Quests',
  match: () => {
    const c = document.querySelector(QA_SIDE);
    return !!c && qaTagged(c) > 1;
  },
  container: () => document.querySelector(QA_SIDE),
  groups: c => arrangeGroupsByAttr(c)
});

/* ---- Quick Quests (do-now): Active, Start one, Library, Saved, [Recently completed]. Recently completed is only rendered when it has
   rows; a saved layout from the old queue model (quick-add, today, upcoming) is harmless, the ids are just not on screen; a saved id that is not on screen is simply remembered by the engine. ---- */
pageArrangeRegister({
  key: 'quests:quick',
  label: 'Quick Quests',
  match: () => {
    const c = document.querySelector(QA_QUICK);
    return !!c && qaTagged(c) > 1;
  },
  container: () => document.querySelector(QA_QUICK),
  groups: c => arrangeGroupsByAttr(c)
});
})();

/* ===== training ===== */
(function(){
/* ==========================================================================
   PAGE ARRANGE: Training (hub + the specialist pages' multi-section screens)
   ==========================================================================
   Registered views (key -> container -> sections):
     training:hub                         .training-content of the front page: 6 sections
     training:running:overview            .running-tab-body: This Week / Next Run / Start a Run
     training:running:plans               .running-tab-body: New Plan / Saved Plans
     training:cycling:overview            .running-tab-body: This Week / Next Ride / Start a Ride
     training:cycling:plans               .running-tab-body: New Plan / Saved Plans
     training:strength:overview           .strength-tab-body: 4 sections
     training:strength:workouts           .strength-tab-body: Favourite / My Saved / Premade
     training:strength:progress           .strength-tab-body: Recent Workouts / Personal Records
     training:swimming:overview           .running-tab-body: 4 sections
     training:climbing:overview           .running-tab-body: 4 sections
     training:<gateway>:overview          the four simple gateways (walking-hiking, calisthenics, rowing, skiing)
   Deliberately NOT registered: the Strength session report, the Run/Swim reports, the three Journals, Builder, Exercises,
   Routes (Leaflet) and every single-section tab (Shoes, Bikes, History, Records, Progress of Climbing, ...).
   FIXED anchors (never in a group, always outside the containers): header.training-character-header (hub), header.tr-hero and
   the .running-tab-rail-wrap category bar (gateways), and the 12 Training Types tiles (data order inside the Training Types section).

   Matching is done on the RENDERED DOM (the root class training-<gateway> plus the ACTIVE button of the persistent category bar),
   not on the app.js state variables: the DOM can never be stale relative to what the player is looking at, and the specs are
   mutually exclusive by construction (one root class, one active tab). Only `page` is read, guarded with typeof, as a free
   fast exit on every other page (match() runs after every DOM change under #view). */

/* the attribute each gateway's category bar puts on its tab buttons (the value is the tab name) */
const TR_ARR_TAB_ATTR={
  running:'data-running-tab',
  cycling:'data-cycling-tab',
  strength:'data-strength-tab',
  swimming:'data-swim-tab',
  climbing:'data-climbing-screen-tab',
  'walking-hiking':'data-simple-gateway-tab',
  calisthenics:'data-simple-gateway-tab',
  rowing:'data-simple-gateway-tab',
  skiing:'data-simple-gateway-tab'
};

function trArrOnTraining(){return typeof page!=='undefined'&&page==='training'}

/* a specialist page: <div class="training-v3 training-<id> training-page"> (trainingGatewayPageHTML) */
function trArrRoot(gid){
  return trArrOnTraining()?document.querySelector('#view .training-v3.training-'+gid+'.training-page'):null;
}
/* the section stack: .strength-tab-body for Strength, .running-tab-body for every other tabbed gateway */
function trArrBody(gid){
  const r=trArrRoot(gid);
  return r?r.querySelector(gid==='strength'?'.strength-tab-body':'.running-tab-body'):null;
}
/* the name of the tab the persistent category bar shows as active, or null (Journals, Reports and the shell cards have no bar) */
function trArrTab(gid){
  const r=trArrRoot(gid);
  const b=r&&r.querySelector('.running-tab-rail-wrap .running-tab-rail > button.active');
  return b?b.getAttribute(TR_ARR_TAB_ATTR[gid]):null;
}
/* the front page: .training-content that holds the Training Types gateway grid (a specialist page never does) */
function trArrHub(){
  if(!trArrOnTraining())return null;
  const c=document.querySelector('#view .training-v3.training-page > .training-content');
  return c&&c.querySelector(':scope > .training-section > .tr-gateway-grid')?c:null;
}

/* the Arrange button goes inside the section stack, UNDER the locked hero and category bar, so those never move when a tab
   without a spec (Builder, Routes, History...) is tapped */
function trArrEntry(c){return {host:c,before:c.firstChild}}
function trArrRegister(key,label,gid,tab,groups){
  pageArrangeRegister({
    key:key,
    label:label,
    match:function(){return trArrTab(gid)===tab},
    container:function(){return trArrBody(gid)},
    entry:trArrEntry,
    groups:groups
  });
}
/* one single-node group per selector: the first DIRECT child of the container that matches (selectors stay unique whatever the order) */
function trArrBySel(defs){return function(c){return arrangeGroupsBySelectors(c,defs)}}
/* sections that carry data-arrange-id in the markup (identical classes, so a class selector cannot tell them apart) */
function trArrByAttr(labels){
  return function(c){
    return arrangeGroupsByAttr(c).map(function(g){return {id:g.id,label:labels[g.id]||g.label,nodes:g.nodes}});
  };
}
/* Plans tab (Running and Cycling share the markup): [section.primary: New Plan][h2.section-title "Saved Plans"][section.minor: the list].
   NOT arrangeGroupsByHeadings: that runs a heading group on to the next heading, so once Saved Plans sat above New Plan it would
   swallow the New Plan card too. The heading is paired with the ONE sibling right after it instead. */
function trArrPlansGroups(c){
  const out=[],kids=[].slice.call(c.children);
  const plan=kids.find(function(el){return el.matches('section.rpg-frame.primary')});
  if(plan)out.push({id:'new-plan',label:'New Plan',nodes:[plan]});
  const head=kids.find(function(el){return el.matches('h2.section-title')});
  const list=head&&head.nextElementSibling;
  if(head&&list&&list.matches('section.rpg-frame.minor'))out.push({id:'saved-plans',label:'Saved Plans',nodes:[head,list]});
  return out;
}

/* ---------- Training hub (the front page) ---------- */
pageArrangeRegister({
  key:'training:hub',
  label:'Training',
  match:function(){return trArrHub()!==null},
  container:trArrHub,
  entry:trArrEntry,
  groups:trArrBySel([
    {id:'overview',label:'Training Overview',sel:'section.training-overview-summary'},
    {id:'next-training',label:'Next Training',sel:'section.tr-card--feature'},
    {id:'this-week',label:'This Week',sel:'section.tr-week-calendar'},
    {id:'training-types',label:'Training Types',sel:'section.training-section'},
    {id:'recent-training',label:'Recent Training',sel:'section[data-arrange-id="recent-training"]'},
    {id:'connections',label:'Connections',sel:'section[data-arrange-id="connections"]'}
  ])
});

/* ---------- Running ---------- */
trArrRegister('training:running:overview','Running Overview','running','Overview',trArrBySel([
  {id:'this-week',label:'This Week',sel:'section.running-week-card'},
  {id:'next-run',label:'Next Run',sel:'section.tr-next'},
  {id:'start-run',label:'Start a Run',sel:'section.running-start'}
]));
trArrRegister('training:running:plans','Running Plans','running','Plans',trArrPlansGroups);

/* ---------- Cycling ---------- */
trArrRegister('training:cycling:overview','Cycling Overview','cycling','Overview',trArrBySel([
  {id:'this-week',label:'This Week',sel:'section.running-week-card'},
  {id:'next-ride',label:'Next Ride',sel:'section.tr-next'},
  {id:'start-ride',label:'Start a Ride',sel:'section.running-start'}
]));
trArrRegister('training:cycling:plans','Cycling Plans','cycling','Plans',trArrPlansGroups);

/* ---------- Strength (Overview, Workouts, Progress; Builder / Exercises / Journal / Session Report are left alone) ---------- */
trArrRegister('training:strength:overview','Strength Overview','strength','Overview',trArrBySel([
  {id:'this-week',label:'This Week',sel:'section.running-week-card'},
  {id:'next-workout',label:'Next Workout',sel:'section.rpg-frame.primary:not(.running-week-card):not(.training-library-section)'},
  {id:'favourite-workouts',label:'Favourite Workouts',sel:'section.training-library-section'},
  {id:'get-started',label:'Get Started',sel:'section.strength-quick-start'}
]));
trArrRegister('training:strength:workouts','Strength Workouts','strength','Workouts',trArrByAttr({
  'favourite-workouts':'Favourite Workouts',
  'saved-workouts':'My Saved Workouts',
  'premade-workouts':'Premade Workouts'
}));
trArrRegister('training:strength:progress','Strength Progress','strength','Progress',trArrByAttr({
  'recent-workouts':'Recent Workouts',
  'personal-records':'Personal Records'
}));

/* ---------- Swimming and Climbing (Overview only; Journals and Reports have no category bar, so no spec matches) ---------- */
trArrRegister('training:swimming:overview','Swimming Overview','swimming','Overview',trArrBySel([
  {id:'this-week',label:'This Week',sel:'section.running-week-card'},
  {id:'next-swim',label:'Next Swim',sel:'section.rpg-frame.primary:not(.running-week-card)'},
  {id:'start-swim',label:'Start Swim',sel:'section.strength-quick-start'},
  {id:'recent-swims',label:'Recent Swims',sel:'section.rpg-frame.minor:not(.strength-quick-start)'}
]));
trArrRegister('training:climbing:overview','Climbing Overview','climbing','Overview',trArrBySel([
  {id:'this-week',label:'This Week',sel:'section.running-week-card'},
  {id:'next-session',label:'Next Session',sel:'section.rpg-frame.primary:not(.running-week-card)'},
  {id:'start-climbing',label:'Start Climbing',sel:'section.strength-quick-start'},
  {id:'recent-sessions',label:'Recent Sessions',sel:'section.rpg-frame.minor:not(.strength-quick-start)'}
]));

/* ---------- the four simple gateways share one template; each keeps its own saved order (the key carries the gateway id) ---------- */
[['walking-hiking','Walking & Hiking'],['calisthenics','Calisthenics'],['rowing','Rowing'],['skiing','Skiing']].forEach(function(g){
  trArrRegister('training:'+g[0]+':overview',g[1]+' Overview',g[0],'Overview',trArrBySel([
    {id:'this-week',label:'This Week',sel:'section.running-week-card'},
    {id:'next-session',label:'Next Session',sel:'section.rpg-frame.primary:not(.running-week-card)'},
    {id:'start-session',label:'Start a Session',sel:'section.strength-quick-start'},
    {id:'recent',label:'Recent',sel:'section.rpg-frame.minor:not(.strength-quick-start)'}
  ]));
});
})();

/* ===== character ===== */
(function(){
/* ---- Character (live renderer: v0.02.4.2-character.js; ONE view, everything else is a modal) ----
   #view children, in default order:
     [data-arrange-entry]   engine Arrange row            FIXED
     div.page-head          banner from pageHeader()      FIXED
     div.accent-line                                      FIXED
     section.v0242-character-identity (hero card)         FIXED (kept as the page's hero)
     actions    section.v0242-character-menu (+ button.v023-milestone-notice when milestones are pending)
     attributes h2 + section.v0242-stat-grid
     status-lifetime  div.character-lower-grid: Status & Ailments and Lifetime Totals side by side above 700px (ONE group,
                      so the default two-column layout is unchanged)
     profile    h2 + section.v0242-profile-panel
   The patch tags every node of each group with data-arrange-id (label on the group's first node), so
   arrangeGroupsByAttr is all that is needed. Order lives in state.pageLayout.pages.character.order. */
pageArrangeRegister({
  key:'character',
  label:'Character',
  /* page is the app.js top-level `let`: guarded. The identity card is the rendered-DOM marker, so the
     match is false for the shadowed app.js fallback renderer and for any other page's DOM. */
  match:()=>typeof page!=='undefined'&&page==='character'&&!!document.querySelector('#view > section.v0242-character-identity'),
  container:()=>document.querySelector('#view'),
  groups:c=>arrangeGroupsByAttr(c)
});
})();

/* ===== personal-growth ===== */
(function(){
/* ==========================================================================
   Page Arrange: Personal Growth (v0.02.34 hub + trackers, v0.02.51 self care,
   v0.02.52 habits / hobbies / detail, v0.02.53 reading, v0.02.54 records)
   Eleven views are adopted. EVERY one is selector based: no markup change,
   no data-arrange-id (the .pg-summary strip is rebuilt with outerHTML by
   pgPatchRow, which would drop an attribute, so summaries are found by class).

   key                                  groups (default order)
   personal-growth:hub                  summary, quick-access, recent-activity
   personal-growth:habits               summary, habit-list
   personal-growth:hobbies              summary, hobby-list
   personal-growth:trackers             summary, focus-tools           (side column only)
   personal-growth:reading              summary, now-reading, bookshelf
   personal-growth:records              summary, personal-bests, next-milestones, milestones-reached
   personal-growth:selfcare:today       water, meals, sleep, vigil
   personal-growth:detail:overview      at-a-glance, this-week, last-28-days
   personal-growth:detail:history       calendar, recent-entries
   personal-growth:detail:notes         add-note, your-notes
   personal-growth:readingItem:notes    add-note, your-notes

   FIXED (never a group, so nothing is ever moved past them): div.pg-backrow and
   header.pg-hero on every child page, the tab bar, every other tab panel, the
   Settings forms, the Hub destination cards, tracker / book / record rows,
   filter chips, the Habits category blocks and the Trackers list column.

   match() reads the DOM (a marker element that only that view renders) rather
   than pgView / scTab / pgDetailTab / rdTab: those are only updated on a click
   or a render, the DOM is what is really on screen. Every match() also needs
   page==='personal-growth' (pgView is not reset when you leave the page) and
   needs at least TWO groups on screen, so an empty page (no habits yet, empty
   reading library, Vigil/Meals/Sleep switched off) offers no Arrange button
   instead of a dialog that says there is nothing to move.

   Tab panels (.pg-tabpanel) are toggled with the hidden attribute and are NOT
   re-rendered, so #view's childList observer never sees a tab switch. The small
   attribute watcher at the bottom of this file wakes the engine when a tab
   panel's hidden attribute changes; the engine then re-checks which spec
   matches, drops the Arrange button on tabs that have none and applies the saved
   order the first time a tab becomes visible.
   One saved order per VIEW (not per tracker / book id): it applies to every
   tracker's Overview / History / Notes and to every book's Notes.
   ========================================================================== */

/* the page's inner column; every child page is #view > .pg-page > .pg-page__inner */
const PGA_INNER='#view .pg-page > .pg-page__inner';

/* page is an app.js top-level `let` (not a window property): bare name behind a typeof guard */
function pgaOnPage(){return typeof page!=='undefined'&&page==='personal-growth'}

/* first DIRECT child of c matching sel, or null */
function pgaKid(c,sel){return c?([...c.children].find(k=>k.matches&&k.matches(sel))||null):null}

/* the inner column, but only when it directly holds a child matching markerSel (a marker only this view renders) */
function pgaInner(extra,markerSel){
  const c=document.querySelector(PGA_INNER+(extra||''));
  return c&&pgaKid(c,markerSel)?c:null;
}

/* a tab panel of a Detail page, only while it is the visible tab.
   kind is the tab id that tells the two Detail pages apart: 'history' (tracker Detail) or 'sessions' (Book Detail) */
function pgaDetailPanel(kind,tab){
  const r=document.querySelector(PGA_INNER+'.pg-detail');
  if(!r||!r.querySelector('#pgPanel-'+kind))return null;
  const p=r.querySelector('#pgPanel-'+tab);
  return p&&!p.hidden?p:null;
}

/* find(): the container or null; defs: [{id,label,sel}] in DEFAULT order. match() additionally needs >=2 groups on screen. */
function pgaRegister(key,label,find,defs){
  /* a page whose tab bar stays while panels swap (Self Care, tracker Detail, Book Detail): the button goes INSIDE the visible
     panel, so the back row, hero and tab bar never move when a tab without a spec is tapped */
  const tabbed=/^personal-growth:(selfcare|detail|readingItem)/.test(key);
  pageArrangeRegister({
    key,label,
    entry:tabbed?(c=>({host:c,before:c.firstChild})):undefined,
    match:()=>{
      if(!pgaOnPage())return false;
      const c=find();
      return !!c&&defs.filter(d=>pgaKid(c,d.sel)).length>=2;
    },
    container:find,
    groups:c=>arrangeGroupsBySelectors(c,defs)
  });
}

/* ---------- Hub ---------- */
pgaRegister('personal-growth:hub','Personal Growth',
  ()=>document.querySelector(PGA_INNER+'.pg-hub'),
  [
    {id:'summary',label:'Stats summary',sel:'.pg-summary'},
    {id:'quick-access',label:'Quick access',sel:'.pg-quick'},
    {id:'recent-activity',label:'Recent activity',sel:'.pg-recent'}
  ]);

/* ---------- Habits ---------- */
pgaRegister('personal-growth:habits','Habits',
  ()=>pgaInner('','section.pg-trackers[aria-labelledby="pgHabitsTitle"]'),
  [
    {id:'summary',label:'Habit summary',sel:'.pg-summary'},
    {id:'habit-list',label:'Your habits',sel:'.pg-trackers'}
  ]);

/* ---------- Hobbies ---------- */
pgaRegister('personal-growth:hobbies','Hobbies',
  ()=>pgaInner('','section.pg-trackers[aria-labelledby="pgHobbiesTitle"]'),
  [
    {id:'summary',label:'Hobby summary',sel:'.pg-summary'},
    {id:'hobby-list',label:'Your hobbies',sel:'.pg-trackers'}
  ]);

/* ---------- Trackers: the SIDE column only ----------
   .pg-layout is a dormant two-column grid (20rem + list) at wide container widths, so the tracker list
   (div.pg-main) stays where it is and only Summary and Focus Tools can swap inside div.pg-side. */
pgaRegister('personal-growth:trackers','Trackers',
  ()=>document.querySelector('#view .pg-page .pg-layout > .pg-side'),
  [
    {id:'summary',label:'Tracking summary',sel:'.pg-summary'},
    {id:'focus-tools',label:'Focus Tools',sel:'.pg-focus'}
  ]);

/* ---------- Reading Nook (the empty library renders a single .pg-soon panel: no marker, no Arrange) ---------- */
pgaRegister('personal-growth:reading','Reading Nook',
  ()=>pgaInner('','section[aria-labelledby="rdNowT"]'),
  [
    {id:'summary',label:'Reading summary',sel:'.pg-summary'},
    {id:'now-reading',label:'Now reading',sel:'section[aria-labelledby="rdNowT"]'},
    {id:'bookshelf',label:'Bookshelf',sel:'section[aria-labelledby="rdShelfT"]'}
  ]);

/* ---------- Records & Milestones (each of the three lists renders only when it has rows) ---------- */
pgaRegister('personal-growth:records','Records & Milestones',
  ()=>pgaInner('','section[aria-labelledby="pgRecT"],section[aria-labelledby="pgNextT"],section[aria-labelledby="pgMilT"]'),
  [
    {id:'summary',label:'Records summary',sel:'.pg-summary'},
    {id:'personal-bests',label:'Personal bests',sel:'section[aria-labelledby="pgRecT"]'},
    {id:'next-milestones',label:'Next milestones',sel:'section[aria-labelledby="pgNextT"]'},
    {id:'milestones-reached',label:'Milestones reached',sel:'section[aria-labelledby="pgMilT"]'}
  ]);

/* ---------- Self Care > Today ----------
   The same [data-sc-module] panels also render on Home, where state.home.order governs. Scoped to
   .sc-page > #pgPanel-today > .sc-today so Home is never touched. Meals' module id is 'meals' (its setting key is 'food').
   Vigil is opt-in: it only exists in the DOM when switched on, so a hidden Vigil never appears in the dialog. */
pgaRegister('personal-growth:selfcare:today','Self Care: Today',
  ()=>{
    const r=document.querySelector(PGA_INNER+'.sc-page'),p=r&&r.querySelector('#pgPanel-today');
    return p&&!p.hidden?pgaKid(p,'.sc-today'):null;
  },
  [
    {id:'water',label:'Water',sel:'[data-sc-module="water"]'},
    {id:'meals',label:'Meals',sel:'[data-sc-module="meals"]'},
    {id:'sleep',label:'Sleep',sel:'[data-sc-module="sleep"]'},
    {id:'vigil',label:'Vigil',sel:'[data-sc-module="vigil"]'}
  ]);

/* ---------- Tracker Detail (habit / hobby / tracker): Overview, History, Notes tabs ---------- */
pgaRegister('personal-growth:detail:overview','Details: Overview',
  ()=>pgaDetailPanel('history','overview'),
  [
    {id:'at-a-glance',label:'At a glance',sel:'section[aria-labelledby="pgDOv"]'},
    {id:'this-week',label:'This week',sel:'section[aria-labelledby="pgDWk"]'},
    {id:'last-28-days',label:'Last 28 days',sel:'section[aria-labelledby="pgDHeat"]'}
  ]);

pgaRegister('personal-growth:detail:history','Details: History',
  ()=>pgaDetailPanel('history','history'),
  [
    {id:'calendar',label:'Month calendar',sel:'section[aria-labelledby="pgDCal"]'},
    {id:'recent-entries',label:'Recent entries',sel:'section[aria-labelledby="pgDRec"]'}
  ]);

pgaRegister('personal-growth:detail:notes','Details: Notes',
  ()=>pgaDetailPanel('history','notes'),
  [
    {id:'add-note',label:'Add a note',sel:'section[aria-labelledby="pgDNoteT"]'},
    {id:'your-notes',label:'Your notes',sel:'section[aria-labelledby="pgDNoteL"]'}
  ]);

/* ---------- Book / Audiobook Detail: Notes tab only (it reuses pgDetailNotesHTML; its other tabs are one section or a form) ---------- */
pgaRegister('personal-growth:readingItem:notes','Book: Notes',
  ()=>pgaDetailPanel('sessions','notes'),
  [
    {id:'add-note',label:'Add a note',sel:'section[aria-labelledby="pgDNoteT"]'},
    {id:'your-notes',label:'Your notes',sel:'section[aria-labelledby="pgDNoteL"]'}
  ]);

/* ---------- tab switches ----------
   pgBindTabs() only flips aria-selected and each panel's hidden attribute. Wake the engine when a .pg-tabpanel's
   hidden attribute changes (a click, an arrow / Home / End key, or any code path). pageArrangeSchedule() is
   de-duplicated per microtask, so several panels flipping at once cost one pass. */
(function pgaWatchTabs(){
  const start=()=>{
    const host=document.querySelector('#view');
    if(!host||typeof MutationObserver==='undefined'||typeof pageArrangeSchedule!=='function')return;
    new MutationObserver(recs=>{
      if(recs.some(r=>r.target&&r.target.classList&&r.target.classList.contains('pg-tabpanel')))pageArrangeSchedule();
    }).observe(host,{attributes:true,attributeFilter:['hidden'],subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
})();

/* ===== adventures ===== */
(function(){
/* ==========================================================================
   PAGE ARRANGE specs: ADVENTURES (page id 'adventures')
   Views: adventures:hub, adventures:journeys-hub, adventures:journeys-<category> (x6),
          adventures:journey.
   Every spec matches on the RENDERED DOM (a marker element), never on app.js state:
   renderQuestsArea() is called from ~60 places, and jcView/jcCategory/jcFilter are private
   to the journey-catalogue IIFE. match() runs after every DOM change under #view (the
   MapLibre / illustrated map churn on a Journey page included), so each is one or two
   cheap querySelector calls. No markup change is needed anywhere on this page.
   DELIBERATELY NOT ARRANGEABLE (no spec, so no Arrange button there): the Campaigns
   feature row (fixed above the grid), division pages (one card / one stub), the Lost
   Fortress campaign body (stage-driven state machine), a not-started Journey, the top
   level of a quest page (moving section.journey-body would re-parent the live map).
   ========================================================================== */

/* ---------- 1. Adventures hub: the six standard Division cards ----------
   Container is the inner 2-column grid, NOT #view: the Campaigns feature row lives in the
   sibling position above the grid inside .quest-division-list, so it can never be moved
   or moved past. Each card is one node; its tracker region is INSIDE the card. The id is
   read from the existing data-open-division on the card's own identity button. */
const ADV_HUB_GRID='#view > .quest-division-list > .quest-division-grid-2col';
function advDivisionGroups(grid){
  const out=[];
  [...grid.children].forEach(row=>{
    if(!row.classList||!row.classList.contains('quest-division-row')||row.classList.contains('feature'))return;
    const open=[...row.children].find(k=>k.hasAttribute&&k.hasAttribute('data-open-division'));
    const did=open&&open.getAttribute('data-open-division');
    if(!did)return;
    let label='';
    try{
      if(typeof QUEST_DIVISIONS!=='undefined'){const d=QUEST_DIVISIONS.find(x=>x.id===did);if(d&&d.label)label=d.label}
    }catch(e){}
    if(!label){const h=row.querySelector('h3');label=h?h.textContent.trim():did}
    out.push({id:'division-'+did,label,nodes:[row]});
  });
  return out;
}
pageArrangeRegister({
  key:'adventures:hub',
  label:'Adventures',
  match(){return !!document.querySelector(ADV_HUB_GRID)},
  container(){return document.querySelector(ADV_HUB_GRID)},
  groups(grid){return advDivisionGroups(grid)}
});

/* ---------- 2. Journeys hub: Active Journeys / Explore / Featured ----------
   The three sections are direct children of #view (back button, title and blurb stay on top).
   Each is told apart by its OWN direct child, no template change. Active Journeys exists
   only while a Journey is active or paused. Data orders inside the sections (category tiles,
   featured rows, active cards) are never touched. */
const ADV_JC_HUB_MARK='#view > .jc-section > .jc-category-grid';
function advJcHubGroups(view){
  const out=[];
  [...view.children].forEach(sec=>{
    if(!sec.classList||!sec.classList.contains('jc-section'))return;
    const has=cls=>[...sec.children].some(k=>k.classList&&k.classList.contains(cls));
    if(has('jc-active-row'))out.push({id:'jc-active',label:'Active Journeys',nodes:[sec]});
    else if(has('jc-category-grid'))out.push({id:'jc-explore',label:'Explore',nodes:[sec]});
    else if(has('jc-featured-list'))out.push({id:'jc-featured',label:'Featured',nodes:[sec]});
  });
  return out;
}
pageArrangeRegister({
  key:'adventures:journeys-hub',
  label:'Journeys',
  match(){return !!document.querySelector(ADV_JC_HUB_MARK)},
  container(){return document.querySelector(ADV_JC_HUB_MARK)?document.querySelector('#view'):null},
  groups(view){return advJcHubGroups(view)}
});

/* ---------- 3. Journeys category page: one group per sub-category heading ----------
   A group is the h4.jc-subcategory-title plus the .jc-card-grid(s) right after it. Do NOT wrap
   a heading and its grid in a new element: the stylesheet's .jc-subcategory-title:first-of-type
   {margin-top:0} is evaluated among #view's children, so after a move the NEW first heading
   correctly gets margin-top:0 (a wrapper would make every heading first-of-type).
   The category is read from the first card on screen (JOURNEY_CATALOGUE is exported on window by
   v0.02.42, read lazily here because this file loads before it), so each category has its OWN key
   and Reset order only resets that category. A category with fewer than 2 headings on screen
   (Legendary, River, or a filter that leaves one sub-category) shows no Arrange button.
   Ids are slugs of Aster's authored sub-category strings: if she renames one, that section
   falls back to its default place (the engine tolerates unknown ids). */
const ADV_JC_CATEGORIES=['world-tours','legendary','mountain','river','special','historical'];
function advJcHeads(){
  const v=document.querySelector('#view');
  return v?[...v.children].filter(k=>k.tagName==='H4'&&k.classList.contains('jc-subcategory-title')):[];
}
function advJcCategoryOfView(){
  const cat=window.JOURNEY_CATALOGUE;
  if(!Array.isArray(cat))return '';
  const card=document.querySelector('#view > .jc-card-grid [data-jc-card]');
  if(!card)return '';
  const id=card.getAttribute('data-jc-card'),e=cat.find(x=>x.id===id);
  return e?String(e.category||''):'';
}
function advJcCatMatch(catId){
  if(!document.querySelector('#view > .jc-filter-bar'))return false;
  if(advJcHeads().length<2)return false;
  return advJcCategoryOfView()===catId;
}
function advJcCatGroups(view){
  const out=[];
  advJcHeads().forEach(h=>{
    const label=h.textContent.trim();
    const slug=label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    if(!slug)return;
    const nodes=[h];
    for(let n=h.nextElementSibling;n&&n.classList&&n.classList.contains('jc-card-grid');n=n.nextElementSibling)nodes.push(n);
    out.push({id:'sub-'+slug,label,nodes});
  });
  return out;
}
ADV_JC_CATEGORIES.forEach(catId=>{
  pageArrangeRegister({
    key:'adventures:journeys-'+catId,
    get label(){const h=document.querySelector('#view > h2.section-title');return (h&&h.textContent.trim())||'Journey category'},
    match(){return advJcCatMatch(catId)},
    container(){return advJcCatMatch(catId)?document.querySelector('#view'):null},
    /* below the filter bar: a size filter that leaves one sub-category removes the button, and the bar must not move */
    entry(c){const fb=c&&c.querySelector(':scope > .jc-filter-bar');return fb?{host:c,before:fb.nextSibling}:{host:c}},
    groups(view){return advJcCatGroups(view)}
  });
});

/* ---------- 4. A STARTED Journey page: everything under the map ----------
   Container is section.journey-body, but ONLY when it holds the position card (the not-started
   body is the same section with just an intro and a Start button, and must not match).
   The map block (div.ill-illustrated-wrap | div.journey-map-wrap | div.journey-route-track) is the
   first child and is in NO group: the engine removes and re-inserts every group node, which would
   detach a live MapLibre canvas or reset the illustrated map's measured markers. The map and the
   quest header above the body (back button, title, star, progress) therefore stay put.
   One shared key for every Journey (Hadrian's Wall, Rome, Camino, Route 66, Cape Town-Magadan):
   the player sets the preference once; missing sections (Regions, Nearby milestones) are tolerated. */
const ADV_JOURNEY_MARK='#view > section.journey-body > .journey-position-card';
pageArrangeRegister({
  key:'adventures:journey',
  label:'Journey page',
  match(){return !!document.querySelector(ADV_JOURNEY_MARK)},
  container(){const p=document.querySelector(ADV_JOURNEY_MARK);return p?p.parentElement:null},
  groups(body){
    return arrangeGroupsBySelectors(body,[
      {id:'position',label:'Position & progress',sel:'.journey-position-card'},
      {id:'regions',label:'Regions',sel:'.journey-region-list'},
      {id:'milestones',label:'Nearby milestones',sel:'.journey-milestone-timeline'},
      {id:'controls',label:'Pause & movement rules',sel:'.journey-controls'},
      {id:'landmarks',label:'Landmarks',sel:'.journey-landmark-list'}
    ]);
  }
});
})();

/* ===== loot ===== */
(function(){
/* Page Arrange spec: Loot (renderLoot in v0.02.48-economy-ui.js).
   One view, key 'loot', shared by the Unclaimed and History tabs (the same three section ids exist in both, so the player arranges once).
     wallet             the Gold / Earned today strip (div.eco-wallet)
     rewards            the Unclaimed/History tab bar + the optional "Claim all" button + the reward list (or its empty-state shell):
                        one unit, because the tab bar and Claim all act on that list
     legacy-loot-boxes  the "N Minor Loot Boxes ... kept safe" note; only on the Unclaimed tab and only while state.lootBoxes.minor > 0
   FIXED: div.inv-header (the page title), and every article.eco-reward card (claim order / history order is data, never moved).
   Recognised from the rendered DOM (.eco-tabs exists only on Loot; Store has .eco-stalls instead), so a stale `page` variable cannot
   mis-fire it. renderLoot() rebuilds the whole page on every tab switch / claim, and the engine re-applies after each rebuild. */
const lootArrangePage=()=>document.querySelector('#view .eco-theme > .eco-page');

/* Children that end the rewards run: the page header, the wallet, and anything carrying an explicit section id. The empty-state shell
   ("Nothing waiting...") has the same classes as the legacy note but NO marker, so it is swallowed into rewards on purpose. */
const lootArrangeStops=el=>el.matches('.inv-header,.eco-wallet,[data-arrange-id]');

pageArrangeRegister({
  key:'loot',
  label:'Loot',
  match:()=>!!document.querySelector('#view .eco-theme > .eco-page > .eco-tabs'),
  container:lootArrangePage,
  groups(c){
    const kids=[...c.children],out=[];
    const wallet=kids.find(k=>k.matches('.eco-wallet'));
    if(wallet)out.push({id:'wallet',label:'Wallet',nodes:[wallet]});
    const ti=kids.findIndex(k=>k.matches('.eco-tabs'));
    if(ti>=0){
      const nodes=[kids[ti]];
      for(let j=ti+1;j<kids.length&&!lootArrangeStops(kids[j]);j++)nodes.push(kids[j]);
      out.push({id:'rewards',label:'Rewards',nodes});
    }
    const legacy=kids.find(k=>k.matches('[data-arrange-id="legacy-loot-boxes"]'));
    if(legacy)out.push({id:'legacy-loot-boxes',label:'Loot box note',nodes:[legacy]});
    return out;
  }
});
})();

/* ===== store ===== */
(function(){
/* Page Arrange spec: Store (renderStore in v0.02.48-economy-ui.js).
   One view, key 'store', active on EVERY stall (the .eco-page children are identical for all stalls):
     wallet   the Gold / Earned today strip (div.eco-wallet)
     stalls   the stall tab bar (.eco-stalls) + the shelf below it (#ecoStallBody): two consecutive siblings that always move together,
              so the tabs stay directly above the shelf they control
   FIXED: div.inv-header (the page title); the stall tab buttons themselves (STORE_STALLS unlock order); every listing / sell-row card
   (seeded rotation + slot/rarity order is data, never moved).
   Recognised from the rendered DOM (.eco-stalls exists only on Store; Loot has .eco-tabs instead).
   NOT adopted: the Sell stall's "Sell from Storage" / "Buy back (today)" pair. The engine runs ONE active spec per page, so a Sell-only
   spec would replace this one while the Sell stall is showing and the wallet position the player saved here would snap back on that
   stall (and jump again on returning to another stall). */
pageArrangeRegister({
  key:'store',
  label:'Store',
  match:()=>!!document.querySelector('#view .eco-theme > .eco-page > .eco-stalls'),
  container:()=>document.querySelector('#view .eco-theme > .eco-page'),
  groups(c){
    const kids=[...c.children],out=[];
    const wallet=kids.find(k=>k.matches('.eco-wallet'));
    if(wallet)out.push({id:'wallet',label:'Wallet',nodes:[wallet]});
    const tabs=kids.find(k=>k.matches('.eco-stalls'));
    const body=tabs&&tabs.nextElementSibling;
    /* only when the shelf really is the next sibling: the pair must stay consecutive */
    if(tabs&&body&&body.id==='ecoStallBody')out.push({id:'stalls',label:'Stalls and shelf',nodes:[tabs,body]});
    return out;
  }
});
})();

/* ===== achievements ===== */
(function(){
/* ---------- Achievements: the REGISTER view only ----------
   renderAchievements() (app.js) paints  pageHeader + <div class="rewards-tab-body"> ...register... </div>.
   The register is five always-present, independent blocks (direct children of .rewards-tab-body):
     stats       div.ach-header-stats        "N Unlocked / X% Known Collection Complete"
     filters     div.ach-filter-row          the All / Recent / Hidden chips
     latest      div.ach-featured-wrap       the Latest achievement card
                 OR section.ach-featured     (the empty-state shape when nothing is unlocked yet; never both)
     categories  div.ach-categories          the horizontally scrolling category chip bar
     grid        div.ach-grid                the tiles (or the "Nothing here yet." paragraph)
   They are recognised by their existing classes, so the page markup needs no change (selectors are unique
   whatever the current order, no :nth-child). FIXED, never touched: pageHeader (it is a sibling ABOVE the
   container), the chips inside the filter row / category bar, the tiles inside the grid (data order), and the
   internals of the Latest card (the separate AchievementCard component).
   Every filter / category tap calls renderAchievements() directly, which rebuilds #view; the engine's
   MutationObserver re-applies the saved order after each of those renders, so the order survives filtering.
   The detail view (achievementDetailHTML) and the series view (achievementSeriesHTML) are deliberately NOT
   registered: they replace .rewards-tab-body's content, the .ach-grid marker disappears, match() turns false
   and the Arrange button goes away until the register comes back. */
const ACH_ARRANGE_SECTIONS=[
  {id:'stats',      label:'Collection stats',            sel:'.ach-header-stats'},
  {id:'filters',    label:'Filters (All, Recent, Hidden)',sel:'.ach-filter-row'},
  {id:'latest',     label:'Latest achievement',          sel:'.ach-featured-wrap, .ach-featured'},
  {id:'categories', label:'Categories',                  sel:'.ach-categories'},
  {id:'grid',       label:'Achievement grid',            sel:'.ach-grid'}
];
/* the register's container, or null in the detail / series views (cheap: two child-combinator lookups) */
function achArrangeContainer(){
  const c=document.querySelector('#view > .rewards-tab-body');
  return c&&c.querySelector(':scope > .ach-grid')?c:null;
}
pageArrangeRegister({
  key:'achievements:register',
  label:'Achievements',
  match:()=>!!achArrangeContainer(),
  container:achArrangeContainer,
  groups:c=>arrangeGroupsBySelectors(c,ACH_ARRANGE_SECTIONS)
});
})();

/* ===== library ===== */
(function(){
/* Library: Page Arrange specs.
   Three views are adopted. The four collection pages (Training Codex, Discoveries, Handbook, Chronicles) and the Echo page
   render ONE section each, so they have no spec and never show an Arrange button.

   No markup edit is needed: every section is a direct child of its container and carries a STATIC aria-labelledby
   (the heading ids are not data-derived), so the selectors below are unique regardless of the current order. Nothing
   here is :nth-child based. The Library renders with `view.innerHTML = ...` (including libGo(), which calls
   renderLibrary() directly), and the engine re-places the sections from a MutationObserver on #view, so every
   in-Library navigation is covered without wrapping renderLibrary().

   Match is on the rendered DOM, never on libView (a top-level `let`, stale-prone). A view only matches while TWO sections
   are on screen, so a page with a single section (a discovery without a description) gets no Arrange button at all.
   FIXED parts (never in a group, never moved): div.lib-backrow, header.lib-hero, form#libSearchForm and
   div#libResultsWrap; the four collection cards and every entry list keep their data order. */

/* --- Hub: the two glass sections inside #libBrowse --- */
const LIB_ARR_HUB='#view .lib-page__inner.lib-hub > #libBrowse';
pageArrangeRegister({
  key:'library:hub',
  label:'Library',
  match:()=>{const c=document.querySelector(LIB_ARR_HUB);return !!c&&!c.hidden},
  container:()=>{const c=document.querySelector(LIB_ARR_HUB);return c&&!c.hidden?c:null},
  groups:c=>arrangeGroupsBySelectors(c,[
    {id:'collections',label:'Collections',sel:'section[aria-labelledby="libCollectionsTitle"]'},
    {id:'recent',label:'Recently Discovered',sel:'section[aria-labelledby="libRecentTitle"]'}
  ])
});

/* --- Exercise page (every built-in Training Codex exercise): one shared order for all exercise pages --- */
const LIB_ARR_EX_FACTS='#view .lib-page__inner > section[aria-labelledby="libBenchFactsTitle"]';
const LIB_ARR_EX_PB='#view .lib-page__inner > section[aria-labelledby="libBenchPbTitle"]';
pageArrangeRegister({
  key:'library:exercise',
  label:'Library exercise page',
  match:()=>!!document.querySelector(LIB_ARR_EX_FACTS)&&!!document.querySelector(LIB_ARR_EX_PB),
  container:()=>{const f=document.querySelector(LIB_ARR_EX_FACTS);return f?f.parentElement:null},
  groups:c=>arrangeGroupsBySelectors(c,[
    {id:'facts',label:'The facts',sel:'section[aria-labelledby="libBenchFactsTitle"]'},
    {id:'personal-best',label:'Personal Best',sel:'section[aria-labelledby="libBenchPbTitle"]'}
  ])
});

/* --- Discovery page (any FOUND discovery except Echo, which has its own single-section page) --- */
const LIB_ARR_DISC_FACTS='#view .lib-page__inner > section[aria-labelledby="libDiscFactsT"]';
const LIB_ARR_DISC_ABOUT='#view .lib-page__inner > section[aria-labelledby="libDiscAboutT"]';
pageArrangeRegister({
  key:'library:discovery',
  label:'Library discovery page',
  match:()=>!!document.querySelector(LIB_ARR_DISC_FACTS)&&!!document.querySelector(LIB_ARR_DISC_ABOUT),
  container:()=>{const f=document.querySelector(LIB_ARR_DISC_FACTS);return f?f.parentElement:null},
  groups:c=>arrangeGroupsBySelectors(c,[
    {id:'facts',label:'The facts',sel:'section[aria-labelledby="libDiscFactsT"]'},
    {id:'about',label:'About',sel:'section[aria-labelledby="libDiscAboutT"]'}
  ])
});
})();

/* ===== social ===== */
(function(){
/* Social: deliberately NOT registered for Page Arrange (nothing to arrange).
   renderSocial() (app.js) emits only pageHeader('Social','Connections') (div.page-head + div.accent-line, both fixed)
   and ONE div.shell-grid holding two static placeholder tiles ('Social' = a pointer to the Home Social tracker,
   'Connected Parties' = FUTURE SYSTEM). At #view level the only movable node is the single div.shell-grid, so there is no
   sibling to swap with; the two tiles carry no ids and no data and sit in a 2-column CSS grid where up/down order is not
   a meaningful axis. shellCards() is shared by other stub pages (rewards stub, division stub, the locked Training shell),
   so this must never be auto-detected by class: a page with no registered spec gets no Arrange button.
   Re-evaluate when Social gets real sections (Connected Parties / hosted accounts, or an in-page check-in tracker). */
})();

/* ===== storage ===== */
(function(){
/* ==========================================================================
   Page Arrange: Storage (Inventory V1, v0.02.37-inventory-ui.js)
   Two views are adopted; the other five Storage views (all, collections,
   collection, quest, item) have no spec and therefore no Arrange button.

   storage:hub   groups (default order): categories, recent, equipped, collections, quest-special
   storage:gear  groups (default order): slots, gear-items

   Every section is a DIRECT child of  #view > .inv-theme > .inv-page  and carries
   data-arrange-id / data-arrange-label (stamped in the inventory templates), because the
   four Hub .inv-shell sections are otherwise byte-identical.
   FIXED (no data-arrange-id, never moved past): .inv-header, .inv-gold-summary and
   the conditional .eco-banner "chest waiting to be revealed" alert.
   Gear's "gear-items" group is TWO consecutive nodes (the count caption <p> and
   the card grid / empty-state <p>), both stamped with the same id.
   Data orders (strip, rows, cards, slot cells) are never touched: the engine only
   re-places whole direct children of .inv-page.
   ========================================================================== */
const STORAGE_NON_HUB_VIEWS=['all','gear','collections','collection','quest','item'];

/* The Inventory page root, returned only when the marker section of that view is really on screen.
   Store and Loot also render .inv-theme > .inv-page, but with the extra eco-theme / eco-page classes. */
function storageArrangePage(marker){
  const p=document.querySelector('#view > .inv-theme:not(.eco-theme) > .inv-page:not(.eco-page)');
  return p&&p.querySelector(':scope > [data-arrange-id="'+marker+'"]')?p:null;
}

/* page and invView are top-level `let` bindings (not window properties): bare names behind typeof guards */
pageArrangeRegister({
  key:'storage:hub',
  label:'Storage',
  match:()=>typeof page!=='undefined'&&page==='storage'&&typeof invView!=='undefined'&&!STORAGE_NON_HUB_VIEWS.includes(invView),
  container:()=>storageArrangePage('categories'),
  groups:c=>arrangeGroupsByAttr(c)
});

pageArrangeRegister({
  key:'storage:gear',
  label:'Owned Gear',
  match:()=>typeof page!=='undefined'&&page==='storage'&&typeof invView!=='undefined'&&invView==='gear',
  container:()=>storageArrangePage('slots'),
  groups:c=>arrangeGroupsByAttr(c)
});
})();
