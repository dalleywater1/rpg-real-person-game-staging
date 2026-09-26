/* Compact Home trackers, V1 (Aurelia -> Astra handover "Compact Home Tracker Modules", 2026-09-25).
   Hydration, Movement, Meals and Sleep become one shared compact row:
       | quick-action icon | name + value + progress bar | chevron |
   Vigil is the circular countdown variant. Home only: the Self Care page keeps its own builders in v0.02.51.
   Colour and state are CSS, driven by the data-state on the row; there is no completion icon inside any bar.
   Tap the main area or the chevron = the tracker's popup. The left icon is a fast action ONLY where the handover defines one
   (Hydration = +250 ml, Sleep = the row beneath); Movement and Meals icons are decorative until an action is decided.
   Thresholds are never hard-coded here where the player already owns them: the Sleep zone is the player's own Self Care range. */
const CT_ICON={
  water:'Home/V3/Resources/home-v3-resource-water-2x.png',
  movement:'Home/V3/Widgets/HOMEV3_ICON_MOVEMENT.png',
  meals:'Home/V3/Resources/home-v3-resource-calories-2x.png',
  sleep:'Home/V3/Resources/home-v3-resource-sleep-2x.png'
};
const CT_HYDRATION_QUICK_ML=250;/* Aurelia §3 */

/* ---- state mapping (integer percent of target) ---- */
function ctPercent(value,target){return target>0?Math.round(Number(value||0)/target*100):0}
/* Hydration (positive): 1-99 blue, 100-199 aquamarine, 200+ gold */
function ctStateHydration(r){return r<=0?'none':r<100?'progress':r<200?'goal':'double'}
/* Movement (positive): 1-99 orange>yellow, 100 yellow, 101-199 yellow>gold, 200+ gold */
function ctStateMovement(r){return r<=0?'none':r<100?'progress':r===100?'goal':r<200?'over':'double'}
/* Meals (LIMIT tracker, opposite direction): 0-100 green, 101-199 red>purple, 200 deep purple, 201-299 purple>near-black, 300+ black */
function ctStateMeals(r){return r<=100?'ok':r<200?'over':r===200?'double':r<300?'severe':'max'}
/* Sleep (target ZONE, Aurelia review 2026-09-25): inside the player's own range = white; below OR above it the bar moves away from
   white through pink to deep purple, the same both ways. Severity is how far outside the range you are, measured in widths of the
   configured range (targetMin..targetMax from Self Care settings) and clamped at 1 = deep purple. No fixed hours anywhere. */
function ctSleepZone(hours,min,max){
  if(!(Number(hours)>0))return 'none';
  if(hours<min)return 'low';
  return hours<=max?'ideal':'high';
}
function ctSleepSeverity(hours,min,max){
  if(!(Number(hours)>0))return 0;
  const width=Math.max(0.5,Number(max)-Number(min));/* a degenerate range still gets a sane scale */
  const out=hours<min?min-hours:hours>max?hours-max:0;
  return Math.max(0,Math.min(1,out/width));
}
const CT_SLEEP_STOPS=[[255,255,255],[229,138,184],[91,31,156]];/* white -> pink -> deep purple */
function ctSleepColor(sev){
  const s=Math.max(0,Math.min(1,Number(sev)||0)),seg=s<0.5?0:1,t=s<0.5?s/0.5:(s-0.5)/0.5,a=CT_SLEEP_STOPS[seg],b=CT_SLEEP_STOPS[seg+1];
  return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`;
}

/* ---- shared row ---- */
function ctRowHTML(o){
  const icon=o.quick
    ?`<button type="button" class="ct-icon ct-icon--action" ${o.quick.attrs} aria-label="${esc(o.quick.label)}"><img src="${asset(o.icon)}" alt="" width="28" height="28"></button>`
    :`<span class="ct-icon" aria-hidden="true"><img src="${asset(o.icon)}" alt="" width="28" height="28"></span>`;
  const fill=Math.max(0,Math.min(100,Number(o.fill||0)));
  return `<div class="ct-row" data-ct="${o.key}" data-state="${o.state}"${o.color?` style="--ct-c:${o.color}"`:''}>
    ${icon}
    <button type="button" class="ct-main" ${o.open} aria-label="${esc(o.aria)}">
      <span class="ct-top"><span class="ct-name">${esc(o.name)}</span><span class="ct-val">${o.valueHTML}</span></span>
      <span class="ct-bar" aria-hidden="true"><i style="--p:${fill}"></i></span>
    </button>
    <button type="button" class="ct-chev" ${o.open} aria-label="${esc(o.openLabel)}"><span aria-hidden="true">›</span></button>
  </div>`;
}
const ctPanel=(key,inner,cls='')=>`<section class="home-panel home-compact ${cls}" data-sc-module="${key}" data-ct-module="${key}">${inner}</section>`;
const ctNum=n=>Math.round(Number(n||0)).toLocaleString();

/* ---- Hydration ---- */
function ctWaterHTML(){
  const w=selfCareWaterView(),r=ctPercent(w.ml,w.target);
  return ctPanel('water',ctRowHTML({
    key:'water',icon:CT_ICON.water,name:'Hydration',state:ctStateHydration(r),fill:Math.min(100,r),
    valueHTML:`${ctNum(w.ml)}<small> / ${ctNum(w.target)} ml</small>`,
    quick:{attrs:`data-sc-action="water-add" data-amount="${CT_HYDRATION_QUICK_ML}"`,label:`Add ${CT_HYDRATION_QUICK_ML} millilitres of water`},
    open:'data-sc-action="water-open"',aria:`Hydration, ${ctNum(w.ml)} of ${ctNum(w.target)} millilitres, ${r} percent. Open details`,openLabel:'Open Hydration'
  }));
}
/* ---- Movement ---- */
function ctMovementHTML(){
  const steps=Math.round(state.daily.steps||0)+healthImportedStepsTodayOrZero(),target=Math.round(state.profile.stepsTarget||8000),r=ctPercent(steps,target);
  return ctPanel('movement',ctRowHTML({
    key:'movement',icon:CT_ICON.movement,name:'Movement',state:ctStateMovement(r),fill:Math.min(100,r),
    valueHTML:`${ctNum(steps)}<small> / ${ctNum(target)} steps</small>`,
    quick:null,/* the quick-add increment is deliberately not defined (Aurelia §4, §12) */
    open:'data-ct-action="movement-open"',aria:`Movement, ${ctNum(steps)} of ${ctNum(target)} steps, ${r} percent. Open details`,openLabel:'Open Movement'
  }));
}
/* ---- Meals / calories (a limit tracker) ---- */
function ctMealsHTML(){
  const cfg=selfCareSettings().food;
  let name='Calories',state_,fill,val,aria;
  if(cfg.mode==='meals'){
    const st=selfCareFoodStatus(),n=st.mains||0,r=ctPercent(n,3);
    name='Meals';state_=ctStateMeals(r);fill=Math.min(100,r);val=`${n}<small> of 3 meals</small>`;aria=`Meals, ${n} of 3 main meals`;
  }else{
    const cal=Math.round(Number(state.daily.calories||0)),target=Math.round(Number(cfg.calMax!=null?cfg.calMax:state.profile.calTarget||0)),r=ctPercent(cal,target);
    state_=ctStateMeals(r);fill=Math.min(100,r);
    val=`${ctNum(cal)}<small>${target>0?` / ${ctNum(target)} kcal`:' kcal'}</small>`;aria=`Calories, ${ctNum(cal)}${target>0?` of ${ctNum(target)}`:''} kilocalories${target>0?`, ${r} percent`:''}`;
  }
  return ctPanel('meals',ctRowHTML({
    key:'meals',icon:CT_ICON.meals,name,state:state_,fill,valueHTML:val,quick:null,
    open:'data-sc-action="food-open"',aria:`${aria}. Open the meal log`,openLabel:'Open the meal log'
  }));
}
/* ---- Sleep ---- */
function ctSleepHTML(){
  const ph=selfCareSleepPhase(),a=selfCareSleepActive(),cfg=selfCareSettings().sleep,min=Number(cfg.targetMin),max=Number(cfg.targetMax);
  const mid=selfCareSleepTargetHours(),ln=selfCareLastNight();
  let row,under='';
  if(ph.phase==='awake'){
    const h=ln.hours,zone=ctSleepZone(h,min,max),sev=ctSleepSeverity(h,min,max);
    row=ctRowHTML({key:'sleep',icon:CT_ICON.sleep,name:'Sleep',state:zone,color:zone==='none'?'':ctSleepColor(sev),fill:h>0?Math.min(100,h/mid*100):0,
      valueHTML:h!=null?`${h.toFixed(1)}<small> h${Number.isFinite(min)&&Number.isFinite(max)?` · ${min}–${max} h`:''}</small>`:'<small>Not logged</small>',quick:null,
      open:'data-sc-action="sleep-log"',aria:`Sleep, ${h!=null?h.toFixed(1)+' hours':'not logged'}. Log sleep`,openLabel:'Log sleep'});
    under=`<div class="ct-actions" role="group" aria-label="Sleep actions"><button type="button" class="ct-pill ct-pill--primary" data-sc-action="sleep-start">Going to Sleep</button><button type="button" class="ct-pill" data-sc-action="sleep-log">Log Sleep</button><button type="button" class="ct-pill" data-ct-action="sleep-quality">Sleep Quality</button></div>`;
  }else if(ph.phase==='asleep'){
    row=ctRowHTML({key:'sleep',icon:CT_ICON.sleep,name:'Asleep',state:'asleep',fill:100,
      valueHTML:`<span data-sc-elapsed="${a.startedAt}">${scFmtDuration(ph.elapsed)}</span>`,quick:null,
      open:'data-sc-action="sleep-wake"',aria:'Asleep. Tap when you are awake',openLabel:'I am awake'});
    under=`<div class="ct-actions" role="group" aria-label="Sleep actions"><button type="button" class="ct-pill ct-pill--primary" data-sc-action="sleep-wake">I’m awake</button>${ph.cancelable?'<button type="button" class="ct-pill" data-sc-action="sleep-cancel">Not sleeping</button>':''}</div>`;
  }else{
    row=ctRowHTML({key:'sleep',icon:CT_ICON.sleep,name:'Sleep',state:'asleep',fill:100,valueHTML:'<small>Still asleep?</small>',quick:null,open:'data-sc-action="sleep-wake"',aria:'Still asleep? Tap if you are awake',openLabel:'I am awake'});
    under=`<div class="ct-confirm"><p class="ct-note">${ph.reason==='auto'?'This sleep was closed automatically after 16 hours.':'Still asleep?'} You went to bed at <b>${scFmtClock(a.startedAt)}</b>. When did you wake up?</p>
      <div class="sc-field"><label for="scWakeAt">Woke up at</label><input type="datetime-local" id="scWakeAt" value="${scLocalInput(ph.suggestWake)}" min="${scLocalInput(a.startedAt)}" max="${scLocalInput(Date.now())}"></div>
      <div class="ct-actions"><button type="button" class="ct-pill ct-pill--primary" data-sc-action="sleep-confirm-wake">Save wake time</button><button type="button" class="ct-pill" data-sc-action="sleep-wake">I’m awake now</button></div></div>`;
  }
  return ctPanel('sleep',row+under);
}
/* Sleep Quality opens the detailed Sleep popup (the follow-up questions) for last night's saved sleep. */
function ctSleepQuality(){
  const ln=selfCareLastNight();
  if(ln.hours==null){toast('Log your sleep first, then you can add how it went.');return}
  scSleepFollowUpDialog({wakeDate:ln.date,hours:ln.hours});
}

/* ---- Vigil: circular countdown ---- */
function ctVigilHTML(){
  if(!selfCareEnabled('vigil'))return '';
  const a=selfCareVigilTick(),note=selfCareCareNote(),C=2*Math.PI*42;
  const paused=Boolean(a&&a.pausedAt),rem=a?selfCareVigilRemaining(a):0,total=a?a.plannedHours*3600000:1;
  const off=a?C*(1-rem/total):C;/* starts FULL and empties as the fast runs down */
  const ring=`<svg viewBox="0 0 100 100" class="ct-ring__svg" aria-hidden="true"><circle cx="50" cy="50" r="42" class="ct-ring__bg"/>${a?`<circle cx="50" cy="50" r="42" class="ct-ring__fg" data-ct-ring="${a.id}" data-ct-total="${total}" data-ct-end="${paused?'':a.plannedEnd}" data-ct-rem="${rem}" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/>`:''}</svg>`;
  const center=a
    ?`<span class="ct-ring__time"${paused?'':` data-sc-remaining="${a.plannedEnd}"`}>${scFmtDuration(rem)}</span><small>${paused?'Paused':'left'}</small>`
    :`<span class="ct-ring__time">Vigil</span><small>Set length</small>`;
  return ctPanel('vigil',`${note?`<p class="ct-note ct-note--care" role="status">${esc(note)}</p>`:''}
    <div class="ct-vigil">
      <button type="button" class="ct-ring${a?' is-active':''}${paused?' is-paused':''}" data-ct-action="vigil-circle" aria-label="${a?`Vigil, ${scFmtDuration(rem)} remaining${paused?', paused':''}. Open the Vigil details`:'Set the Vigil length'}">${ring}<span class="ct-ring__center">${center}</span></button>
      <button type="button" class="ct-pill" data-sc-action="vigil-end" ${a?'':'disabled'}>Stop</button>
      <button type="button" class="ct-pill" data-ct-action="${paused?'vigil-resume':'vigil-pause'}" ${a?'':'disabled'}>${paused?'Resume':'Pause'}</button>
      <button type="button" class="ct-pill" data-ct-action="vigil-log">Log</button>
    </div>`,'ct-vigilpanel');
}
/* Tapping the circle while a fast runs (Aurelia review 2026-09-25): a read-only view of the running fast. The length cannot be edited here;
   Stop, Pause/Resume and Log stay the explicit actions on Home. */
function ctVigilDetailsDialog(){
  const a=selfCareVigilTick();
  if(!a){scVigilSetupDialog();return}
  const paused=Boolean(a.pausedAt),now=Date.now();
  const day=ms=>new Date(ms).toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'});
  const at=ms=>`${scFmtClock(ms)} · ${day(ms)}`;
  const pausedFor=Number(a.pausedMs||0)+(paused?now-a.pausedAt:0);
  pgModal({
    title:'Vigil',sub:paused?'Paused':'Active',accentClass:'pg-accent-purple',glyph:'◔',size:'sm',
    body:`<div class="pg-form"><dl class="ct-facts" aria-label="Vigil details">
      <div><dt>Started</dt><dd>${at(a.startedAt)}</dd></div>
      <div><dt>Planned length</dt><dd>${a.plannedHours} h</dd></div>
      <div><dt>Planned end</dt><dd>${paused?'Moves later while paused':at(a.plannedEnd)}</dd></div>
      <div><dt>Remaining</dt><dd${paused?'':` data-sc-remaining="${a.plannedEnd}"`}>${scFmtDuration(selfCareVigilRemaining(a))}</dd></div>
      ${pausedFor>0?`<div><dt>Paused for</dt><dd>${scFmtDuration(pausedFor)}</dd></div>`:''}
    </dl><p class="pg-dialog__text">The length cannot be changed while a Vigil is running. Use Stop, Pause or Log on Home.</p></div>`,
    actions:'<button type="button" class="pg-btn pg-btn--primary" data-pg-close>Close</button>',focus:'[data-pg-close]'
  });
}
/* Log a Vigil that already happened. */
function ctVigilLogDialog(){
  const now=Date.now(),def=now-14*3600000;
  pgModal({
    title:'Log a Vigil',sub:'Optional · a timer, not medical guidance',accentClass:'pg-accent-purple',glyph:'◔',size:'sm',
    body:`<div class="pg-form">${pgInputFieldHTML({id:'ctVigilStart',label:'Started',type:'datetime-local',value:scLocalInput(def),attrs:`max="${scLocalInput(now)}"`})}${pgInputFieldHTML({id:'ctVigilHours',label:'Length (hours)',type:'number',value:'14',attrs:'min="1" max="24" step="0.5" inputmode="decimal"'})}</div>`,
    actions:'<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button><button type="button" class="pg-btn pg-btn--primary" id="ctVigilSave">Save</button>',focus:'#ctVigilStart'
  });
  modalRoot.querySelector('#ctVigilSave').onclick=()=>{
    const start=new Date(modalRoot.querySelector('#ctVigilStart').value).getTime(),hours=Number(modalRoot.querySelector('#ctVigilHours').value);
    if(!Number.isFinite(start)){pgFieldError('ctVigilStart','Enter when it started.');return}
    if(!(hours>=SELF_CARE_VIGIL.minHours&&hours<=SELF_CARE_VIGIL.maxHours)){pgFieldError('ctVigilHours','A Vigil is 1 to 24 hours.');return}
    if(!selfCareVigilLog(start,hours)){pgFieldError('ctVigilStart','It must have finished already, and cannot overlap your active Vigil.');return}
    closeModal();scRefresh();toast('Vigil logged.');
  };
}
/* Meals <-> Vigil (Aurelia §8): logging a meal while a Vigil is active asks; it never ends the Vigil silently, and the meal stays logged. */
function vigilMealPrompt(){
  if(typeof selfCareEnabled!=='function'||!selfCareEnabled('vigil'))return;
  const a=selfCareVigilTick();
  if(!a)return;
  pgModal({
    title:'Active Vigil',sub:'',accentClass:'pg-accent-purple',glyph:'◔',size:'sm',
    body:'<p class="pg-dialog__text">You have an active Vigil. End it now?</p><p class="pg-dialog__text">Your meal is logged either way.</p>',
    actions:'<button type="button" class="pg-btn pg-btn--secondary" id="ctVigilKeep">Keep Vigil Active</button><button type="button" class="pg-btn pg-btn--primary" id="ctVigilEnd">End Vigil</button>',focus:'#ctVigilKeep'
  });
  modalRoot.querySelector('#ctVigilKeep').onclick=()=>closeModal();
  modalRoot.querySelector('#ctVigilEnd').onclick=()=>{const e=selfCareVigilEnd();closeModal();scRefresh();if(e)toast(selfCareVigilLabel(e)+'.')};
}

/* ---- routing into Home ---- */
(function(){
  const prev=homeModuleHTML;
  homeModuleHTML=function(id,panels){
    if(typeof selfCareEnabled==='function'){
      if(id==='water')return selfCareEnabled('water')?ctWaterHTML():'';
      if(id==='meals')return selfCareEnabled('food')?ctMealsHTML():'';
      if(id==='sleep')return selfCareEnabled('sleep')?ctSleepHTML():'';
      if(id==='vigil')return ctVigilHTML();
    }
    if(id==='movement')return ctMovementHTML();
    return prev(id,panels);
  };
})();

/* ---- behaviour ---- */
let ctBound=false;
function ctBind(){
  if(ctBound||typeof view==='undefined'||!view)return;
  ctBound=true;
  view.addEventListener('click',e=>{
    const el=e.target.closest('[data-ct-action]');
    if(!el||!view.contains(el))return;
    switch(el.dataset.ctAction){
      case 'movement-open':movementModal('overview');return;
      case 'sleep-quality':ctSleepQuality();return;
      case 'vigil-circle':if(selfCareVigilTick())ctVigilDetailsDialog();else scVigilSetupDialog();return;
      case 'vigil-pause':if(selfCareVigilPause())scRefresh();return;
      case 'vigil-resume':if(selfCareVigilResume())scRefresh();return;
      case 'vigil-log':ctVigilLogDialog();return;
    }
  });
  /* keeps the Vigil ring emptying between renders */
  setInterval(()=>{
    document.querySelectorAll('[data-ct-ring]').forEach(el=>{
      const total=Number(el.dataset.ctTotal),end=Number(el.dataset.ctEnd);
      if(!(total>0)||!end)return;
      const rem=Math.max(0,end-Date.now()),C=2*Math.PI*42;
      el.style.strokeDashoffset=(C*(1-rem/total)).toFixed(1);
    });
  },20000);
}
ctBind();
/* The clocks are absolute timestamps (Vigil start/end, sleep start), so they keep running while the app is closed or in the
   background. When the page comes back, redraw at once: a hidden tab throttles the 30 s timers, so a fast that ended while the
   app was away is finalised at its planned end and the countdown and ring are correct immediately, not up to 30 s later. */
function ctResync(){
  if(typeof selfCareVigilTick==='function')selfCareVigilTick();
  if(typeof page!=='undefined'&&(page==='home'||(page==='personal-growth'&&typeof pgView!=='undefined'&&pgView==='selfcare'))&&typeof scRefresh==='function')scRefresh();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ctResync()});
window.addEventListener('pageshow',e=>{if(e.persisted)ctResync()});
