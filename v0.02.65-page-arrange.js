/* ==========================================================================
   PAGE ARRANGE (Jay, 2026-10-03: "each page should have the ability to move
   the items in it up and down so its easily customizable")
   ==========================================================================
   Every registered page gets a small "Arrange" button at the top of its view.
   It opens a dialog listing the page's SECTIONS in their current order with an
   up and a down button on each (tap- and keyboard-friendly; no dragging
   needed). A move re-places the section on the page straight away and saves
   the order. The default order is unchanged for anybody who never uses it.

   How it works (so a page needs almost no change of its own):
   - A SPEC describes one view of one page: how to recognise that it is showing
     (match), which element holds the sections (container) and how to split that
     container's children into section GROUPS (groups). A group is one or more
     CONSECUTIVE sibling nodes that move together (a legacy heading plus its
     panel is one group) with a stable id and a label. Everything that is not
     in a group (the page header, a persistent category bar, a hero) is FIXED:
     it keeps its place and nothing is ever moved past it.
   - After every render of #view (a MutationObserver on #view's children, so
     every code path that re-renders a page is covered, including pages that
     paint late or are wrapped by later modules) the engine re-places the
     groups into the DOM positions the groups already occupy, in the saved
     order. Sections that are not in the saved order (new, or conditional) keep
     their default place relative to their neighbours; saved ids that are not
     on screen now are remembered.
   - The order is persisted per view in state.pageLayout.pages[key].order.
     A spec may supply its own move/reset (Home keeps ordering through its
     existing state.home.order, so the in-page Arrange and Profile & Setup >
     Home always agree).
   - Nothing here touches a page's data, handlers or ids; only the position of
     whole sections moves. ensure*State() never calls save() (this repo's rule:
     it runs inside save()'s hooks), only a move or a reset saves.
   ========================================================================== */

const PAGE_ARRANGE_SPECS=[];
const PAGE_ARRANGE_PLACED=new WeakSet();          /* first nodes of groups already placed in this render */
const PAGE_ARRANGE_DEFAULT={};                    /* key -> ids in the order the page rendered them */
let pageArrangeObserver=null,pageArrangeBusy=false,pageArrangeQueued=false,pageArrangeRefreshDialog=null;

/* ---------- state ---------- */
function ensurePageLayout(){
  if(!state.pageLayout||typeof state.pageLayout!=='object'||Array.isArray(state.pageLayout))state.pageLayout={version:1,pages:{}};
  const p=state.pageLayout;
  p.version=1;
  if(!p.pages||typeof p.pages!=='object'||Array.isArray(p.pages))p.pages={};
  return p;
}
function pageArrangeSavedOrder(key){
  const o=ensurePageLayout().pages[key];
  return o&&Array.isArray(o.order)?o.order.filter(x=>typeof x==='string'&&x):[];
}

/* ---------- registry ---------- */
/* spec: { key, label, match():bool, container():Element|null, groups(container):[{id,label,nodes:[Element]}],
           move?(id,dir):void, reset?():void, order?():string[] (read the order from elsewhere),
           noEntry?:bool, entry?(container):{host:Element,before?:Node|null} }
   entry(): where the Arrange button goes. The default is the first child of #view, which is right for a page with one
   view. A page whose header, tab bar or filter bar STAYS while its content swaps (Training, the Personal Growth tab pages,
   the Journeys category page) must put the button INSIDE the part that swaps, otherwise the persistent chrome moves by the
   button's height every time a tab without a spec is tapped. */
function pageArrangeRegister(spec){
  if(!spec||!spec.key||typeof spec.match!=='function'||typeof spec.container!=='function'||typeof spec.groups!=='function')return false;
  const i=PAGE_ARRANGE_SPECS.findIndex(s=>s.key===spec.key);
  if(i>=0)PAGE_ARRANGE_SPECS[i]=spec;else PAGE_ARRANGE_SPECS.push(spec);
  return true;
}
function pageArrangeUnregister(key){const i=PAGE_ARRANGE_SPECS.findIndex(s=>s.key===key);if(i>=0)PAGE_ARRANGE_SPECS.splice(i,1)}
function pageArrangeActiveSpec(){
  for(const s of PAGE_ARRANGE_SPECS){
    try{if(s.match()&&s.container())return s}catch(e){}
  }
  return null;
}

/* ---------- helpers specs use to describe their groups ---------- */
/* children of `container` carrying data-arrange-id; consecutive nodes with the same id are one group */
function arrangeGroupsByAttr(container){
  const out=[];
  [...container.children].forEach(el=>{
    const id=el.getAttribute&&el.getAttribute('data-arrange-id');
    if(!id)return;
    const last=out[out.length-1];
    if(last&&last.id===id&&last.nodes[last.nodes.length-1].nextElementSibling===el)last.nodes.push(el);
    else out.push({id,label:el.getAttribute('data-arrange-label')||id,nodes:[el]});
  });
  return out;
}
/* [{id,label,sel}]: the first DIRECT child of `container` matching each selector, one node per group */
function arrangeGroupsBySelectors(container,defs){
  const out=[];
  defs.forEach(d=>{
    const el=[...container.children].find(c=>c.matches&&c.matches(d.sel));
    if(el)out.push({id:d.id,label:d.label,nodes:[el]});
  });
  return out;
}
/* [{id,label,head,body}]: a heading selector and the sibling node(s) after it up to (not including) the next heading */
function arrangeGroupsByHeadings(container,headSel,defs){
  const kids=[...container.children],out=[];
  defs.forEach(d=>{
    const hi=kids.findIndex(c=>c.matches&&c.matches(headSel)&&d.match(c));
    if(hi<0)return;
    const nodes=[kids[hi]];
    for(let j=hi+1;j<kids.length&&!(kids[j].matches&&kids[j].matches(headSel));j++)nodes.push(kids[j]);
    out.push({id:d.id,label:d.label,nodes});
  });
  return out;
}

/* ---------- ordering ---------- */
function pageArrangeGroups(spec){
  const c=spec.container();
  if(!c)return [];
  const seen=new Set();
  const claimed=new Set();
  const list=(spec.groups(c)||[]).filter(g=>{
    if(!g||!g.id||!Array.isArray(g.nodes)||!g.nodes.length||seen.has(g.id))return false;
    if(!g.nodes.every(n=>n&&n.isConnected&&!claimed.has(n)))return false;                                  /* a node belongs to one group only */
    if(!g.nodes.every((n,i)=>i===0||g.nodes[i-1].nextElementSibling===n))return false;                    /* and a group is consecutive siblings */
    seen.add(g.id);g.nodes.forEach(n=>claimed.add(n));
    return true;
  });
  /* always in CURRENT DOM order, whatever order a helper built them in: the slot logic below maps slot i to groups[i] */
  return list.sort((a,b)=>(a.nodes[0].compareDocumentPosition(b.nodes[0])&Node.DOCUMENT_POSITION_FOLLOWING)?-1:1);
}
/* saved order wins; ids not in it keep their default place right after their default predecessor */
function pageArrangeResolve(groups,saved){
  if(!saved||!saved.length)return groups.slice();
  const byId=new Map(groups.map(g=>[g.id,g]));
  const ids=[];
  saved.forEach(id=>{if(byId.has(id)&&!ids.includes(id))ids.push(id)});
  groups.forEach((g,i)=>{
    if(ids.includes(g.id))return;
    const prev=i>0?groups[i-1].id:null;
    const at=prev&&ids.includes(prev)?ids.indexOf(prev)+1:0;
    ids.splice(at,0,g.id);
  });
  return ids.map(id=>byId.get(id));
}
/* put `ordered` into the DOM slots `groups` currently occupy; non-group siblings keep their places */
function pageArrangeScrolls(groups){
  const out=[];
  groups.forEach(g=>g.nodes.forEach(n=>{
    [n,...n.querySelectorAll('*')].forEach(el=>{if(el.scrollLeft||el.scrollTop)out.push([el,el.scrollLeft,el.scrollTop])});
  }));
  return out;
}
function pageArrangePlace(groups,ordered){
  if(groups.length<2||groups.every((g,i)=>g.id===ordered[i].id))return false;
  /* re-attaching a node blurs a focused control inside it and resets scrolled rows (a horizontally scrolled card strip):
     remember both and put them back */
  const focused=document.activeElement,scrolls=pageArrangeScrolls(groups);
  const markers=groups.map(g=>{const m=document.createComment('arrange');g.nodes[0].parentNode.insertBefore(m,g.nodes[0]);return m});
  groups.forEach(g=>g.nodes.forEach(n=>{if(n.parentNode)n.parentNode.removeChild(n)}));
  ordered.forEach((g,i)=>{
    const frag=document.createDocumentFragment();
    g.nodes.forEach(n=>frag.appendChild(n));
    markers[i].parentNode.insertBefore(frag,markers[i]);
    markers[i].remove();
  });
  scrolls.forEach(([el,l,tp])=>{if(el.isConnected){el.scrollLeft=l;el.scrollTop=tp}});
  if(focused&&focused!==document.body&&focused.isConnected&&document.activeElement!==focused){try{focused.focus({preventScroll:true})}catch(e){}}
  return true;
}

/* ---------- applying after a render ---------- */
function pageArrangeApply(){
  if(pageArrangeBusy)return;
  pageArrangeBusy=true;
  try{
    const spec=pageArrangeActiveSpec();
    pageArrangeEntry(spec);
    if(!spec)return;
    const groups=pageArrangeGroups(spec);
    if(groups.length<2)return;
    const placed=groups.filter(g=>PAGE_ARRANGE_PLACED.has(g.nodes[0])).length;
    if(placed===0)PAGE_ARRANGE_DEFAULT[spec.key]=groups.map(g=>g.id);      /* a whole fresh render: this IS the page's default order */
    else if(placed<groups.length){                                         /* a section appeared late: slot it into the known default */
      const def=PAGE_ARRANGE_DEFAULT[spec.key]||[];
      groups.forEach((g,i)=>{if(def.includes(g.id))return;const prev=i>0?groups[i-1].id:null,at=prev&&def.includes(prev)?def.indexOf(prev)+1:0;def.splice(at,0,g.id)});
      PAGE_ARRANGE_DEFAULT[spec.key]=def;
    }
    const saved=typeof spec.order==='function'?spec.order():pageArrangeSavedOrder(spec.key);
    const ordered=pageArrangeResolve(groups,saved);
    pageArrangePlace(groups,ordered);
    ordered.forEach(g=>PAGE_ARRANGE_PLACED.add(g.nodes[0]));
  }catch(e){
    try{if(window.__errs){window.__errs.push({at:Date.now(),k:'arrange',m:String(e&&e.message||e).slice(0,200)});if(window.__errs.length>10)window.__errs.shift()}}catch(x){}
  }finally{
    pageArrangeBusy=false;
    if(pageArrangeObserver)pageArrangeObserver.takeRecords();/* our own moves are not a re-render */
    if(pageArrangeRefreshDialog)pageArrangeRefreshDialog();
  }
}
function pageArrangeSchedule(){
  if(pageArrangeQueued)return;
  pageArrangeQueued=true;
  Promise.resolve().then(()=>{pageArrangeQueued=false;pageArrangeApply()});
}
/* the entry button: first child of #view on a registered page, removed from any other */
function pageArrangeEntry(spec){
  const view=document.querySelector('#view');
  if(!view)return;
  const rows=[...view.querySelectorAll('[data-arrange-entry]')];
  if(!spec||spec.noEntry){rows.forEach(r=>r.remove());return}
  let host=view,before=view.firstChild;
  if(typeof spec.entry==='function'){
    try{const e=spec.entry(spec.container());if(e&&e.host){host=e.host;before=e.before===undefined?e.host.firstChild:e.before}}catch(x){}
  }
  const cur=rows.find(r=>r.parentNode===host);
  rows.forEach(r=>{if(r!==cur)r.remove()});                                   /* never two, and never one left behind in the wrong place */
  if(cur&&(before===cur||cur.nextSibling===before))return;
  if(cur)cur.remove();
  const row=document.createElement('div');
  row.className='arrange-entry';
  row.setAttribute('data-arrange-entry','');
  row.innerHTML='<button type="button" class="arrange-btn" data-arrange-open aria-haspopup="dialog"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path d="M8 2 4.5 6h7zM8 14l3.5-4h-7z" fill="currentColor"/></svg><span>Arrange</span></button>';
  host.insertBefore(row,before&&before.parentNode===host?before:host.firstChild);
}

/* ---------- moving ---------- */
function pageArrangeMove(spec,id,dir){
  if(typeof spec.move==='function'){spec.move(id,dir);return true}
  const groups=pageArrangeGroups(spec);
  const ids=groups.map(g=>g.id),i=ids.indexOf(id),j=i+dir;
  if(i<0||j<0||j>=ids.length)return false;
  const next=ids.slice();
  [next[i],next[j]]=[next[j],next[i]];
  /* keep remembered ids that are not on screen now in their old relative slots */
  const old=[...new Set(pageArrangeSavedOrder(spec.key))],present=new Set(next),merged=[];
  let k=0;
  old.forEach(x=>{if(!present.has(x))merged.push(x);else if(k<next.length)merged.push(next[k++])});
  while(k<next.length)merged.push(next[k++]);
  ensurePageLayout().pages[spec.key]={order:merged};
  const ordered=pageArrangeResolve(groups,merged);
  pageArrangePlace(groups,ordered);
  save();
  return true;
}
function pageArrangeReset(spec){
  if(typeof spec.reset==='function'){spec.reset();return}
  delete ensurePageLayout().pages[spec.key];
  const groups=pageArrangeGroups(spec),def=PAGE_ARRANGE_DEFAULT[spec.key]||[];
  if(def.length)pageArrangePlace(groups,pageArrangeResolve(groups,def));
  save();
}

/* ---------- the dialog ---------- */
function pageArrangeSig(spec){return pageArrangeGroups(spec).map(g=>g.id+'|'+g.label).join('~')}
function pageArrangeRowsHTML(spec){
  const groups=pageArrangeGroups(spec);
  if(groups.length<2)return '<div class="q-empty">Nothing on this page can be moved yet.</div>';
  return `<ol class="arr-list">${groups.map((g,i)=>`<li class="arr-row" data-arrange-row="${esc(g.id)}"><span class="arr-pos" aria-hidden="true">${i+1}</span><span class="arr-label">${esc(g.label)}</span><span class="arr-ctl"><button type="button" class="q-icon-btn arr-btn" data-arrange-move="${esc(g.id)}" data-dir="-1" ${i===0?'disabled':''} aria-label="Move ${esc(g.label)} up, now position ${i+1} of ${groups.length}"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8 3 3 10h10z" fill="currentColor"/></svg></button><button type="button" class="q-icon-btn arr-btn" data-arrange-move="${esc(g.id)}" data-dir="1" ${i===groups.length-1?'disabled':''} aria-label="Move ${esc(g.label)} down, now position ${i+1} of ${groups.length}"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8 13 3 6h10z" fill="currentColor"/></svg></button></span></li>`).join('')}</ol>`;
}
function pageArrangeOpen(){
  const spec=pageArrangeActiveSpec();
  if(!spec||typeof questsModal!=='function')return;
  questsModal({category:'arrange',title:'Arrange',sub:spec.label,size:'sm',
    body:`<p class="q-hint">Use the arrows to move a section up or down. The page updates as you go.</p><div id="arrangeList">${pageArrangeRowsHTML(spec)}</div><p class="q-note" id="arrangeLive" role="status" aria-live="polite"></p>`,
    actions:`<button type="button" class="q-btn" id="arrangeReset">Reset order</button><button type="button" class="q-btn q-btn--primary" data-q-close>Done</button>`});
  const root=modalRoot,list=()=>root.querySelector('#arrangeList'),live=m=>{const el=root.querySelector('#arrangeLive');if(el)el.textContent=m};
  let bind;
  const relist=()=>{const l=list();l.innerHTML=pageArrangeRowsHTML(spec);l.dataset.sig=pageArrangeSig(spec);bind()};
  bind=()=>{
    list().querySelectorAll('[data-arrange-move]').forEach(b=>b.onclick=()=>{
      const id=b.dataset.arrangeMove,dir=Number(b.dataset.dir),label=(pageArrangeGroups(spec).find(g=>g.id===id)||{}).label||id;
      if(!pageArrangeMove(spec,id,dir)){relist();live('That section cannot move further.');return}
      relist();
      const rows=pageArrangeGroups(spec).map(g=>g.id),pos=rows.indexOf(id)+1;
      live(`${label} moved ${dir<0?'up':'down'}, position ${pos} of ${rows.length}.`);
      const again=list().querySelector(`[data-arrange-move="${CSS.escape(id)}"][data-dir="${dir}"]`);
      (again&&!again.disabled?again:list().querySelector(`[data-arrange-move="${CSS.escape(id)}"]:not([disabled])`))?.focus();
    });
  };
  list().dataset.sig=pageArrangeSig(spec);
  bind();
  /* the dialog follows the page: a re-render under it (a deleted quest, a late section) re-lists the sections; a no-op refresh
     leaves the DOM alone so focus is never stolen */
  pageArrangeRefreshDialog=()=>{
    const l=document.querySelector('#arrangeList');
    if(!l||!document.querySelector('.q-modal')){pageArrangeRefreshDialog=null;return}
    const s=pageArrangeActiveSpec();
    if(!s||s.key!==spec.key){pageArrangeRefreshDialog=null;return}
    if(l.dataset.sig!==pageArrangeSig(s))relist();
  };
  root.querySelector('#arrangeReset').onclick=()=>{pageArrangeReset(spec);relist();live('Order reset to the default.')};
}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-arrange-open]');
  if(!b)return;
  e.preventDefault();pageArrangeOpen();
});

/* The dialog needs a medallion; the shared settings icon fits every page. */
if(typeof QUEST_HUB_TILE_ART!=='undefined')QUEST_HUB_TILE_ART.arrange={icon:'icons/home-utility/ICON_HOME_SETTINGS.png',scene:LOG_HEADER_SCENE};

/* ---------- start: watch #view ---------- */
function pageArrangeStart(){
  const host=document.querySelector('#view');
  if(!host||pageArrangeObserver)return;
  pageArrangeObserver=new MutationObserver(()=>{if(!pageArrangeBusy)pageArrangeSchedule()});
  /* subtree: a page that re-renders only an inner region (a tab body, a list) is covered too. Re-applying is idempotent and
     cheap, and the engine's own moves are dropped with takeRecords(), so this does not loop. */
  pageArrangeObserver.observe(host,{childList:true,subtree:true});
  pageArrangeSchedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pageArrangeStart);else pageArrangeStart();
