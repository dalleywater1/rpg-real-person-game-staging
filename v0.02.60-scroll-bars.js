/* Scrolling bars (Jay 2026-09-25): keeps the horizontal bars on the Training pages honest.
   - The specialist tab rail (Overview | Builder | Workouts | Exercises | Progress ...) can be wider than a phone. The page is redrawn
     on every tab change, which used to reset the rail to the start and could leave the ACTIVE tab half hidden. After each draw the
     active tab is scrolled fully into view, and the right-edge fade (a "there is more" cue) is dropped once the end is reached.
   - Library card rows (Workouts, templates, gear, saved problems) are plain scroll containers styled in
     styles/training-v3/14-library-scroll-rows.css; nothing to do here except keep a focused card button scrolled into view, which
     the browser already does.
   Presentation only: no state, no data. */
(function(){
  /* the host that carries the is-at-end / is-scrolled classes: the tab rail's wrapper, or the chip bar itself */
  const hostOf=rail=>rail.classList.contains('mg-zone-chips')?rail:rail.parentElement;
  function syncRail(rail){
    const wrap=hostOf(rail);
    if(!wrap||!(wrap===rail||wrap.classList.contains('running-tab-rail-wrap')))return;
    const atEnd=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2,atStart=rail.scrollLeft<=2;
    wrap.classList.toggle('is-at-end',atEnd);
    wrap.classList.toggle('is-scrolled',!atStart);
  }
  function prepRail(rail){
    if(rail.__scrollBarsBound)return;
    rail.__scrollBarsBound=true;
    rail.addEventListener('scroll',()=>syncRail(rail),{passive:true});
  }
  function showActive(rail){
    const act=rail.querySelector('button.active');
    if(!act||rail.scrollWidth<=rail.clientWidth+1)return;
    /* snap only after a redraw (a NEW active button), never on a resize or an unrelated change: that would undo the player's own scrolling */
    if(rail.__lastActive===act)return;
    rail.__lastActive=act;
    /* measured from the rendered boxes, so it is right whether or not the bar is positioned */
    const rr=rail.getBoundingClientRect(),ar=act.getBoundingClientRect();
    const left=ar.left-rr.left+rail.scrollLeft,right=left+ar.width;
    if(left<rail.scrollLeft+8)rail.scrollLeft=Math.max(0,left-16);
    else if(right>rail.scrollLeft+rail.clientWidth-8)rail.scrollLeft=right-rail.clientWidth+16;
  }
  function scan(){
    document.querySelectorAll('.running-tab-rail, .mg-zone-chips').forEach(rail=>{prepRail(rail);showActive(rail);syncRail(rail)});
  }
  window.scrollBarsScan=scan;
  /* ---- keep your place across a redraw ----
     Training redraws the whole tab (innerHTML) for almost every tap, which reset every scrolling bar to its start and dropped
     keyboard focus. Around each redraw we remember: the sideways scroll of every card row and of the zone-chip bar, and which
     control had focus, then put them back. A new zone or tab still starts its own lists at the top. */
  const FOCUS_KEYS=['data-mg-zone','data-mg-view','data-fav-workout','data-copy-workout','data-el-fav','data-wb-pick'];
  const rowKey=g=>g.id||('row:'+((g.previousElementSibling&&g.previousElementSibling.textContent)||'').trim().slice(0,40)+':'+[...document.querySelectorAll('.training-library-grid')].indexOf(g));
  function captureScroll(){
    const rows={};
    document.querySelectorAll('.training-library-grid').forEach(g=>{if(g.scrollLeft>0)rows[rowKey(g)]=g.scrollLeft});
    const chips=document.querySelector('.mg-zone-chips');
    const f=document.activeElement;let focus=null;
    if(f&&f.getAttribute&&document.getElementById('view')&&document.getElementById('view').contains(f)){
      for(const k of FOCUS_KEYS){const v=f.getAttribute(k);if(v!=null){focus=`[${k}="${(window.CSS&&CSS.escape?CSS.escape(v):v)}"]`;break}}
    }
    return {rows,chips:chips?chips.scrollLeft:0,focus};
  }
  function restoreScroll(c){
    document.querySelectorAll('.training-library-grid').forEach(g=>{const k=rowKey(g);if(c.rows[k]!=null)g.scrollLeft=c.rows[k]});
    const chips=document.querySelector('.mg-zone-chips');if(chips&&c.chips)chips.scrollLeft=c.chips;
    if(c.focus){const b=document.querySelector(c.focus);if(b)b.focus({preventScroll:true})}
    scan();
  }
  if(typeof renderTrainingArea==='function'){
    const inner=renderTrainingArea;
    renderTrainingArea=function(){
      const c=captureScroll();
      const r=inner.apply(this,arguments);
      restoreScroll(c);
      return r;
    };
  }
  /* a focused control that is only partly visible (keyboard Tab) is scrolled fully into view */
  document.addEventListener('focusin',e=>{
    const el=e.target;
    if(el&&el.closest&&el.scrollIntoView&&el.closest('.running-tab-rail, .mg-zone-chips, .training-library-grid'))el.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  /* Redraw the Training area WITHOUT losing your place in a long exercise list: tapping a star or + rebuilds the whole tab, which used to
     throw the list back to its first row and drop keyboard focus. The zone chips and Front/Back still redraw normally (a new zone starts at the top). */
  window.renderTrainingAreaKeepLists=function(){
    const list=document.querySelector('.mg-results .exercise-library-results'),top=list?list.scrollTop:0;
    const f=document.activeElement,sel=f&&f.dataset?(f.dataset.elFav?`[data-el-fav="${f.dataset.elFav}"]`:f.dataset.wbPick?`[data-wb-pick="${f.dataset.wbPick}"]`:null):null;
    renderTrainingArea();
    const again=document.querySelector('.mg-results .exercise-library-results');
    if(again)again.scrollTop=top;
    if(sel){const b=document.querySelector(sel);if(b)b.focus({preventScroll:true})}
  };
  if(typeof document==='undefined')return;
  let queued=false;
  const queue=()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;scan()},30)};/* a timer, not rAF: rAF is paused in a hidden tab and the rail must still be right when the tab returns */
  const start=()=>{
    const v=document.getElementById('view')||document.body;
    new MutationObserver(queue).observe(v,{childList:true,subtree:true});
    window.addEventListener('resize',queue,{passive:true});
    queue();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
