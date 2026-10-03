/* Self Care UI — Home modules (Water, Meals, Sleep, Vigil, Habits 3x3) and
   the Personal Growth "Self Care" page (Today / History / Streaks & Records /
   Settings). Self Care & Habits V1, Phase A; Astra 2026-09-25, RPG-0094.
   Presentation only: every change goes through the services in
   v0.02.50-self-care.js. Home modules are PREVIEWS owned by Self Care /
   Habits (Lyra §2: source page -> shared data -> Home preview). The page and
   the Home modules render from the same builders, so there is one markup per
   module. Styles: styles/self-care/00-self-care.css. */

const SC_ICON={water:'Home/V3/Resources/home-v3-resource-water-2x.png',meals:'Home/V3/Resources/home-v3-resource-calories-2x.png',sleep:'Home/V3/Resources/home-v3-resource-sleep-2x.png'};
const SC_QUALITY=[['positive','Good'],['neutral','Mixed'],['negative','Poor']];
let scTab='today',scHabitsEdit=false,scLongPressFired=false;

function scFmtDuration(ms){
  const m=Math.max(0,Math.floor(ms/60000));
  return `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;
}
function scFmtClock(ms){return new Date(ms).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function scHeaderHTML(iconHTML,title,linkHTML=''){
  return `<div class="home-panel-header">${iconHTML}<span>${esc(title)}</span>${linkHTML}</div>`;
}
const scImgIcon=file=>`<img class="home-panel-icon" src="${asset(file)}" alt="">`;
const scOpenLink=`<button type="button" class="sc-link" data-sc-action="open-selfcare" aria-label="Open Self Care">Self Care ›</button>`;
function scMeterHTML(key,label){
  const m=selfCareMeterRead(key);
  return `<div class="sc-meter" data-sc-meter="${key}" aria-label="${esc(label)} meter ${m.value} of 100${m.enabled?'':' (switched off)'}"><span class="sc-meter__label">${esc(label)}</span>${hwProgressBarHTML(m.value,100,'normal')}<span class="sc-meter__val">${m.enabled?m.value:'—'}</span></div>`;
}

/* ------------------------------------------------------------------ */
/* Water                                                               */
/* ------------------------------------------------------------------ */
function selfCareWaterPanelHTML(){
  const w=selfCareWaterView(),qa=selfCareSettings().water.quickAdd,recent=selfCareRecentDrink();
  return `<section class="home-panel home-panel-selfcare home-panel-water" data-sc-module="water">
    ${scHeaderHTML(scImgIcon(SC_ICON.water),'Water',scOpenLink)}
    <div class="sc-body">
      <button type="button" class="sc-hero" data-sc-action="water-open" aria-label="Open Water log: ${w.ml} of ${w.target} millilitres">
        <span class="sc-hero__num">${w.ml.toLocaleString()}<small> / ${w.target.toLocaleString()} ml</small></span>${w.met?'<span class="sc-tick" aria-label="Target met">✓</span>':''}
      </button>
      ${scMeterHTML('hydration','Hydration')}
      <div class="sc-quick" role="group" aria-label="Quick add">
        <button type="button" class="sc-chipbtn" data-sc-action="water-add" data-amount="${qa[0]}">+${qa[0]} <small>Glass</small></button>
        <button type="button" class="sc-chipbtn" data-sc-action="water-add" data-amount="${qa[1]}">+${qa[1]} <small>Bottle</small></button>
        ${recent?`<button type="button" class="sc-chipbtn" data-sc-action="water-add" data-amount="${qa[0]}" data-type="${esc(recent.key)}">+${qa[0]} <small>${esc(recent.label)}</small></button>`:''}
      </div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Meals                                                               */
/* ------------------------------------------------------------------ */
function selfCareMealsPanelHTML(){
  const cfg=selfCareSettings().food,st=selfCareFoodStatus(),meals=selfCareMealsFor();
  let body;
  if(cfg.mode==='meals'){
    body=`<div class="sc-chips" role="group" aria-label="Meals today">${SELF_CARE_MEALS.map(m=>`<button type="button" class="sc-chipbtn sc-meal${meals[m]?' is-on':''}" data-sc-action="meal-toggle" data-meal="${m}" aria-pressed="${meals[m]}">${meals[m]?'✓ ':''}${SELF_CARE_MEAL_LABEL[m]}</button>`).join('')}</div>
      ${st.met===true?'<p class="sc-note sc-note--good">Nourished today.</p>':`<p class="sc-note">${st.mains||0} of 3 main meals logged.</p>`}`;
  }else{
    const cal=Math.round(Number(state.daily.calories||0)),lo=cfg.calMin,hi=cfg.calMax;
    const range=lo!=null&&hi!=null?`${lo.toLocaleString()}–${hi.toLocaleString()}`:(hi!=null?`up to ${hi.toLocaleString()}`:(lo!=null?`at least ${lo.toLocaleString()}`:'no limit set'));
    body=`<button type="button" class="sc-hero" data-sc-action="food-open" aria-label="Open Food log"><span class="sc-hero__num">${cal.toLocaleString()}<small> kcal · ${range}</small></span>${st.met===true?'<span class="sc-tick" aria-label="Inside your range">✓</span>':''}</button>
      ${cfg.protein!=null?`<p class="sc-note">Protein ${Math.round(Number(state.daily.protein||0))} / ${cfg.protein} g</p>`:''}
      <div class="sc-quick"><button type="button" class="sc-chipbtn" data-sc-action="food-open">+ Add food</button></div>`;
  }
  return `<section class="home-panel home-panel-selfcare home-panel-meals" data-sc-module="meals">
    ${scHeaderHTML(scImgIcon(SC_ICON.meals),'Meals',scOpenLink)}
    <div class="sc-body">${scMeterHTML('satiety','Satiety')}${body}</div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Sleep (tap in / tap out)                                            */
/* ------------------------------------------------------------------ */
function selfCareSleepPanelHTML(){
  const ph=selfCareSleepPhase(),a=selfCareSleepActive();
  let body;
  if(ph.phase==='awake'){
    const ln=selfCareLastNight();
    body=`${scMeterHTML('rest','Rest')}
      <p class="sc-note">${ln.hours!=null?`Last night: <b>${ln.hours.toFixed(1)} h</b>${ln.quality?` · ${esc(ln.quality)}`:''}`:'No sleep logged yet.'}</p>
      <div class="sc-quick"><button type="button" class="sc-primary" data-sc-action="sleep-start">Going to sleep</button><button type="button" class="sc-chipbtn" data-sc-action="sleep-log">Log sleep</button></div>`;
  }else if(ph.phase==='asleep'){
    body=`<div class="sc-asleep"><span class="sc-moon" aria-hidden="true">☾</span><span class="sc-asleep__time" data-sc-elapsed="${a.startedAt}">${scFmtDuration(ph.elapsed)}</span></div>
      ${scMeterHTML('rest','Rest')}
      <div class="sc-quick"><button type="button" class="sc-primary" data-sc-action="sleep-wake">I’m awake</button>${ph.cancelable?'<button type="button" class="sc-chipbtn" data-sc-action="sleep-cancel">Cancel, I’m not sleeping</button>':''}</div>`;
  }else{
    const suggest=ph.suggestWake;
    body=`<p class="sc-note">${ph.reason==='auto'?'This sleep was closed automatically after 16 hours.':'Still asleep?'} You went to bed at <b>${scFmtClock(a.startedAt)}</b>. When did you wake up?</p>
      <div class="sc-field"><label for="scWakeAt">Woke up at</label><input type="datetime-local" id="scWakeAt" value="${scLocalInput(suggest)}" min="${scLocalInput(a.startedAt)}" max="${scLocalInput(Date.now())}"></div>
      <div class="sc-quick"><button type="button" class="sc-primary" data-sc-action="sleep-confirm-wake">Save wake time</button><button type="button" class="sc-chipbtn" data-sc-action="sleep-wake">I’m awake now</button></div>`;
  }
  return `<section class="home-panel home-panel-selfcare home-panel-sleep" data-sc-module="sleep">
    ${scHeaderHTML(scImgIcon(SC_ICON.sleep),'Sleep',scOpenLink)}<div class="sc-body">${body}</div>
  </section>`;
}
function scLocalInput(ms){
  const d=new Date(ms),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */
/* Vigil (opt-in, hidden unless enabled)                               */
/* ------------------------------------------------------------------ */
function selfCareVigilPanelHTML(){
  if(!selfCareEnabled('vigil'))return '';
  const a=selfCareVigilTick(),hist=ensureSelfCare().vigil.history,last=hist[hist.length-1];
  const note=selfCareCareNote();
  let body;
  if(a){
    const remaining=Math.max(0,a.plannedEnd-Date.now()),frac=1-remaining/(a.plannedHours*3600000),C=2*Math.PI*42;
    body=`<div class="sc-ringwrap"><svg viewBox="0 0 100 100" class="sc-ring" aria-hidden="true"><circle cx="50" cy="50" r="42" class="sc-ring__bg"/><circle cx="50" cy="50" r="42" class="sc-ring__fg" data-sc-ring="${a.id}" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${(C*(1-frac)).toFixed(1)}"/></svg>
      <div class="sc-ring__center"><span class="sc-ring__time" data-sc-remaining="${a.plannedEnd}">${scFmtDuration(remaining)}</span><small>until ${scFmtClock(a.plannedEnd)}</small></div></div>
      <div class="sc-quick"><button type="button" class="sc-chipbtn" data-sc-action="vigil-end">End Vigil</button></div>`;
  }else{
    const recent=last&&Date.now()-last.endedAt<24*3600000?`<p class="sc-note${last.completed?' sc-note--good':''}">${esc(selfCareVigilLabel(last))}.${last.completed&&ensureSelfCare().vigil.feastPending?' Your next meal gets a small Feast boost.':''}</p>`:'';
    body=`${recent}<p class="sc-note">An optional timer. Not medical guidance.</p><div class="sc-quick"><button type="button" class="sc-primary" data-sc-action="vigil-begin">Begin Vigil</button></div>`;
  }
  return `<section class="home-panel home-panel-selfcare home-panel-vigil" data-sc-module="vigil">
    ${scHeaderHTML('<span class="home-panel-icon sc-glyph" aria-hidden="true">◔</span>','Vigil',scOpenLink)}
    <div class="sc-body">${note?`<p class="sc-note sc-note--care" role="status">${esc(note)}</p>`:''}${body}</div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Habits 3x3                                                          */
/* ------------------------------------------------------------------ */
function habitsTileHTML(id,index){
  if(!id)return `<button type="button" class="sc-tile sc-tile--empty" data-sc-action="habit-add" data-slot="${index}" aria-label="Add a habit to slot ${index+1}"><span class="sc-tile__plus" aria-hidden="true">+</span></button>`;
  const t=habitsById(id),m=habitsTileModel(t),art=PG_CATEGORY_ART[m.catKey];
  const value=m.method==='completion'?(m.done?'Done':''):(m.goal>0?`${Math.round(m.value)}/${m.goal}`:(m.value>0?String(Math.round(m.value)):''));
  return `<div class="sc-tile-wrap${scHabitsEdit?' is-editing':''}" data-slot="${index}"${scHabitsEdit?' draggable="true"':''}>
    <button type="button" class="sc-tile${m.done?' is-done':''}${m.scheduled?'':' is-rest'}" data-sc-action="habit-tap" data-habit="${esc(m.id)}" data-slot="${index}" aria-label="${esc(m.name)}${m.done?', done':''}${m.scheduled?'':', rest day'}${m.streak?`, ${m.streak} day streak`:''}">
      <span class="sc-ring2" style="--p:${Math.round(m.ring)}"><span class="sc-tile__icon">${art?`<img src="${asset(art)}" alt="" width="40" height="40">`:esc(m.glyph)}</span>${m.done?'<span class="sc-tile__tick" aria-hidden="true">✓</span>':''}</span>
      <span class="sc-tile__name">${esc(m.name)}</span>
      <span class="sc-tile__meta">${m.scheduled?(value||'&nbsp;'):'Rest day'}${m.streak?`<b class="sc-tile__streak" aria-hidden="true"> · ${m.streak}d</b>`:''}</span>
    </button>
    ${scHabitsEdit?`<div class="sc-tile__edit"><button type="button" data-sc-action="habit-move" data-slot="${index}" data-dir="-1" aria-label="Move earlier">‹</button><button type="button" data-sc-action="habit-remove" data-slot="${index}" aria-label="Remove ${esc(m.name)} from Home">✕</button><button type="button" data-sc-action="habit-move" data-slot="${index}" data-dir="1" aria-label="Move later">›</button></div>`:''}
  </div>`;
}
function habitsHomePanelHTML(){
  const slots=habitsHomeSlots(),any=slots.some(Boolean);
  return `<section class="home-panel home-panel-selfcare home-panel-habits" data-sc-module="habits">
    ${scHeaderHTML(`<img class="home-panel-icon" src="${asset('PersonalGrowth/pg-emblem-habits.webp')}" alt="">`,'Habits',`<button type="button" class="sc-link" data-sc-action="habit-edit-toggle" aria-pressed="${scHabitsEdit}">${scHabitsEdit?'Done':'Edit'}</button>`)}
    <div class="sc-body"><div class="sc-habit-grid" role="group" aria-label="Habits">${slots.map((id,i)=>habitsTileHTML(id,i)).join('')}</div>
    ${any?'':'<p class="sc-note">Add up to nine habits. Tap to log, hold to open the full log.</p>'}</div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Dialogs (Personal Growth dialog system)                             */
/* ------------------------------------------------------------------ */
function scSleepFollowUpDialog(sess){
  const date=sess.wakeDate;
  pgModal({
    title:'Good morning',sub:`${sess.hours.toFixed(1)} h saved`,accentClass:'pg-accent-blue',glyph:'☾',size:'sm',
    body:`<div class="pg-form"><p class="pg-dialog__text">Your hours are saved. These questions are optional — you can skip them.</p>
      <div class="sc-quality" role="group" aria-label="Sleep quality">${SC_QUALITY.map(([v,l])=>`<button type="button" class="pg-chip" data-sc-quality="${v}" aria-pressed="false"><span>${l}</span></button>`).join('')}</div>
      <label class="sc-check"><input type="checkbox" id="scChildren"> Children interruption</label>
      ${pgInputFieldHTML({id:'scOther',label:'Other',value:'',placeholder:'What kept you from sleeping? (optional)',help:'Used once on this device and not saved.',optional:true,attrs:'maxlength="120" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"'})}
      <label class="sc-check"><input type="checkbox" id="scMed"> Was medication used?</label></div>`,
    actions:'<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Skip</button><button type="button" class="pg-btn pg-btn--primary" id="scFollowSave">Save</button>',
    focus:'.sc-quality .pg-chip'
  });
  let quality;
  modalRoot.querySelectorAll('[data-sc-quality]').forEach(b=>b.onclick=()=>{quality=quality===b.dataset.scQuality?undefined:b.dataset.scQuality;modalRoot.querySelectorAll('[data-sc-quality]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.scQuality===quality)))});
  modalRoot.querySelector('#scFollowSave').onclick=()=>{
    const other=modalRoot.querySelector('#scOther').value;
    const used=Boolean(other.trim());
    /* PRIVACY: the Other text goes straight to the transient matcher and is
       discarded; nothing else reads or stores it (Lyra §7). */
    if(typeof sleepHiddenIngest==='function'){const basis=selfCareSleepNightBasis(date);sleepHiddenIngest(other,{date,hours:basis.hours,target:basis.target})}/* the wake day's aggregated night total, not this one session */
    modalRoot.querySelector('#scOther').value='';
    selfCareSleepFollowUp(date,{quality,medication:modalRoot.querySelector('#scMed').checked,children:modalRoot.querySelector('#scChildren').checked});
    if(used){const r=Array.isArray(state.daily.sleepReasons)?state.daily.sleepReasons:[];if(date===todayISO()&&!r.includes('other'))state.daily.sleepReasons=[...r,'other']}
    save();closeModal();scRefresh();
  };
}
function scSleepTimesDialog(existing){
  const now=Date.now(),st=selfCareSettings().sleep;
  const bedMin=selfCareTimeToMinutes(st.bedtime)??1380,wakeMin=selfCareTimeToMinutes(st.wake)??420;
  const defWake=existing?existing.endedAt:selfCareSuggestedWake(now-9*3600000);
  const defBed=existing?existing.startedAt:(()=>{const d=new Date(defWake);d.setHours(Math.floor(bedMin/60),bedMin%60,0,0);if(d.getTime()>=defWake)d.setDate(d.getDate()-1);return d.getTime()})();
  pgModal({
    title:existing?'Edit sleep':'Log sleep',sub:'Today and yesterday can be corrected',accentClass:'pg-accent-blue',glyph:'☾',size:'sm',
    body:`<div class="pg-form">${pgInputFieldHTML({id:'scBed',label:'Went to bed',type:'datetime-local',value:scLocalInput(defBed)})}${pgInputFieldHTML({id:'scWake',label:'Woke up',type:'datetime-local',value:scLocalInput(defWake),attrs:`max="${scLocalInput(now)}"`})}</div>`,
    actions:`${existing?'<button type="button" class="pg-btn pg-btn--danger" id="scSessDelete">Delete</button>':'<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button>'}<button type="button" class="pg-btn pg-btn--primary" id="scSessSave">Save</button>`,
    focus:'#scBed'
  });
  modalRoot.querySelector('#scSessSave').onclick=()=>{
    const a=new Date(modalRoot.querySelector('#scBed').value).getTime(),b=new Date(modalRoot.querySelector('#scWake').value).getTime();
    if(!Number.isFinite(a)||!Number.isFinite(b)){pgFieldError('scBed','Enter both times.');return}
    if(!(b>a)){pgFieldError('scWake','Wake time must be after bed time.');return}
    if(b-a>SELF_CARE_SLEEP_RULES.maxSessionMs){pgFieldError('scWake','A sleep can be at most 24 hours.');return}
    const res=existing?selfCareSleepEdit(existing.id,{startMs:a,endMs:b}):selfCareSleepLog(a,b);
    if(!res){pgFieldError('scWake','Only sleeps that end today or yesterday can be added or changed.');return}
    closeModal();scRefresh();
    if(!existing&&res.kind==='night')scSleepFollowUpDialog(res);else toast(res.kind==='nap'?'Nap saved — it refills Rest but doesn’t count toward your night.':'Sleep saved.');
  };
  const del=modalRoot.querySelector('#scSessDelete');
  if(del)del.onclick=()=>{if(selfCareSleepDelete(existing.id)){closeModal();scRefresh();toast('Sleep removed.')}};
}
function scVigilSetupDialog(){
  pgModal({
    title:'Begin Vigil',sub:'Optional · a timer, not medical guidance',accentClass:'pg-accent-purple',glyph:'◔',size:'sm',
    body:`<div class="pg-form"><p class="pg-dialog__text">Choose how long. There is no advantage to going longer — a Vigil counts once whether it is 12 hours or 24, nothing is earned past the planned end, and ending early is fine. Skip it any time you are unwell, tired or need to eat.</p>
      <div class="sc-quality" role="group" aria-label="Length">${SELF_CARE_VIGIL.presets.map(h=>`<button type="button" class="pg-chip" data-sc-vigil="${h}" aria-pressed="false"><span>${h} h</span></button>`).join('')}</div>
      ${pgInputFieldHTML({id:'scVigilCustom',label:'Custom length (hours)',type:'number',value:'',placeholder:'e.g. 20',optional:true,help:'Up to 24 hours.',attrs:'min="1" max="24" step="0.5" inputmode="decimal"'})}</div>`,
    actions:'<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button><button type="button" class="pg-btn pg-btn--primary" id="scVigilStart" disabled>Begin</button>',
    focus:'.sc-quality .pg-chip'
  });
  let hours=null;
  const btn=modalRoot.querySelector('#scVigilStart'),custom=modalRoot.querySelector('#scVigilCustom');
  const sync=()=>{modalRoot.querySelectorAll('[data-sc-vigil]').forEach(x=>x.setAttribute('aria-pressed',String(Number(x.dataset.scVigil)===hours)));btn.disabled=!(hours>=SELF_CARE_VIGIL.minHours&&hours<=SELF_CARE_VIGIL.maxHours)};
  modalRoot.querySelectorAll('[data-sc-vigil]').forEach(b=>b.onclick=()=>{hours=Number(b.dataset.scVigil);custom.value='';sync()});
  custom.oninput=()=>{const v=Number(custom.value);hours=custom.value===''?null:v;pgFieldError('scVigilCustom',v>SELF_CARE_VIGIL.maxHours?'A Vigil can be at most 24 hours.':'');sync()};
  btn.onclick=()=>{if(selfCareVigilStart(hours)){closeModal();scRefresh()}};
}
function scHabitPickerDialog(slot){
  const inSlots=new Set(habitsHomeSlots().filter(Boolean)),avail=habitsAll().filter(t=>!inSlots.has(String(t.id)));
  pgModal({
    title:'Add a habit',sub:'Shown on Home, still lives in Trackers',accentClass:'pg-accent-green',glyph:'◈',size:'sm',
    body:avail.length?`<ul class="sc-picker">${avail.map(t=>`<li><button type="button" class="pg-btn pg-btn--secondary sc-picker__btn" data-sc-pick="${esc(t.id)}">${esc(PERSONAL_GROWTH_CATEGORIES[t.category]?PERSONAL_GROWTH_CATEGORIES[t.category].icon:'✧')} ${esc(t.name)}</button></li>`).join('')}</ul>`:'<p class="pg-dialog__text">Every habit you track is already on Home. Add a new one from Personal Growth → Trackers.</p>',
    actions:'<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Close</button>',focus:'.sc-picker__btn'
  });
  modalRoot.querySelectorAll('[data-sc-pick]').forEach(b=>b.onclick=()=>{habitsHomeAssign(slot,b.dataset.scPick);closeModal();scRefresh()});
}
/* Long-press: the full log for that habit. Yes/no habits get a two-button
   dialog; everything else reuses the shipped value dialog. */
function scHabitFullLog(id){
  const t=habitsById(id);
  if(!t)return;
  if(t.method!=='completion'){pgLogTracker(id,todayISO());return}
  const date=todayISO(),done=Boolean(t.entries&&t.entries[date]);
  pgModal({
    title:t.name,sub:'Today',accentClass:'pg-accent-green',glyph:(PERSONAL_GROWTH_CATEGORIES[t.category]||{}).icon||'◈',size:'sm',
    body:`<p class="pg-dialog__text">${done?'Marked done today.':'Not marked yet today.'}</p>`,
    actions:`<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Close</button><button type="button" class="pg-btn pg-btn--primary" id="scHabitToggle">${done?'Clear today':'Mark done'}</button>`,focus:'#scHabitToggle'
  });
  modalRoot.querySelector('#scHabitToggle').onclick=()=>{t.entries=t.entries||{};t.entries[date]=!done;save();closeModal();scRefresh()};
}

/* ------------------------------------------------------------------ */
/* Refresh + delegated behaviour                                        */
/* ------------------------------------------------------------------ */
function scRefresh(){
  if(page==='home')renderHome();
  else if(page==='personal-growth'&&pgView==='selfcare')renderPersonalGrowth();
  navRefreshBadges&&navRefreshBadges();
}
function scHandleAction(el){
  const act=el.dataset.scAction;
  switch(act){
    case 'open-selfcare':setPage('personal-growth');pgGo('selfcare');return;
    case 'water-open':resourceModal('water');return;
    case 'water-add':{const amt=Number(el.dataset.amount),type=el.dataset.type||'water';if(hydrationLogAdd(amt,type)){scRefresh();toastWithAction(`+${amt} ml logged.`,'Undo',()=>{hydrationLogUndoLast();scRefresh()})}return}
    case 'food-open':resourceModal('food');return;
    case 'meal-toggle':{const r=selfCareToggleMeal(el.dataset.meal);if(r)scRefresh();return}
    case 'sleep-start':if(selfCareSleepStart()){scRefresh();toast('Sleep well.')}return;
    case 'sleep-cancel':if(selfCareSleepCancel())scRefresh();return;
    case 'sleep-wake':{const s=selfCareSleepWake();scRefresh();if(s){if(s.kind==='night')scSleepFollowUpDialog(s);else toast('Nap saved — it refills Rest but doesn’t count toward your night.')}return}
    case 'sleep-confirm-wake':{const v=new Date(document.querySelector('#scWakeAt').value).getTime();const a=selfCareSleepActive();if(!a||!Number.isFinite(v)||v<=a.startedAt||v>Date.now()){toast('Enter a wake time after you went to bed.');return}const s=selfCareSleepWake(v);scRefresh();if(s&&s.kind==='night')scSleepFollowUpDialog(s);return}
    case 'sleep-log':scSleepTimesDialog(null);return;
    case 'sleep-edit':{const s=ensureSelfCare().sleep.sessions.find(x=>String(x.id)===el.dataset.session);if(s)scSleepTimesDialog(s);return}
    case 'vigil-begin':scVigilSetupDialog();return;
    case 'vigil-end':{const e=selfCareVigilEnd();scRefresh();if(e)toast(selfCareVigilLabel(e)+'.');return}
    case 'habit-tap':{
      if(scLongPressFired){scLongPressFired=false;return}
      const res=habitsTap(el.dataset.habit);
      if(!res)return;
      if(res.action==='open'){if(res.target==='training')setPage('training');else movementModal('overview');return}
      scRefresh();
      const t=habitsById(res.id);
      toastWithAction(`${t?t.name:'Habit'} ${res.after===false||res.after===undefined?'cleared':'logged'}.`,'Undo',()=>{habitsUndo(res);scRefresh()});
      return;
    }
    case 'habit-add':scHabitPickerDialog(Number(el.dataset.slot));return;
    case 'habit-edit-toggle':scHabitsEdit=!scHabitsEdit;scRefresh();return;
    case 'habit-remove':{const prev=habitsHomeRemove(Number(el.dataset.slot));if(prev!=null){const idx=Number(el.dataset.slot);scRefresh();toastWithAction('Removed from Home.','Undo',()=>{habitsHomeAssign(idx,prev);scRefresh()})}return}
    case 'habit-move':{const i=Number(el.dataset.slot),j=i+Number(el.dataset.dir);if(habitsHomeMove(i,j))scRefresh();return}
  }
}
let scBound=false;
function selfCareBindHome(){
  if(scBound)return;
  scBound=true;
  view.addEventListener('click',e=>{const el=e.target.closest('[data-sc-action]');if(el&&view.contains(el))scHandleAction(el)});
  /* Long-press on a habit tile (550 ms) opens the full log. */
  let timer=null,startX=0,startY=0;
  view.addEventListener('pointerdown',e=>{
    const tile=e.target.closest('[data-sc-action="habit-tap"]');
    if(!tile||scHabitsEdit)return;
    startX=e.clientX;startY=e.clientY;
    timer=setTimeout(()=>{scLongPressFired=true;scHabitFullLog(tile.dataset.habit)},550);
  });
  const cancel=()=>{if(timer){clearTimeout(timer);timer=null}};
  view.addEventListener('pointerup',cancel);view.addEventListener('pointercancel',cancel);view.addEventListener('pointerleave',cancel);
  view.addEventListener('pointermove',e=>{if(timer&&(Math.abs(e.clientX-startX)>8||Math.abs(e.clientY-startY)>8))cancel()});
  view.addEventListener('contextmenu',e=>{if(e.target.closest('[data-sc-action="habit-tap"]'))e.preventDefault()});
  /* Drag to reorder (pointer devices) while editing; the ‹ › buttons are the touch/keyboard path. */
  let dragFrom=null;
  view.addEventListener('dragstart',e=>{const w=e.target.closest('.sc-tile-wrap[draggable="true"]');if(!w)return;dragFrom=Number(w.dataset.slot);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragFrom))});
  view.addEventListener('dragover',e=>{if(dragFrom!=null&&e.target.closest('.sc-tile-wrap,.sc-tile--empty'))e.preventDefault()});
  view.addEventListener('drop',e=>{const w=e.target.closest('.sc-tile-wrap,.sc-tile--empty');if(dragFrom==null||!w)return;e.preventDefault();const to=Number(w.dataset.slot);if(habitsHomeMove(dragFrom,to))scRefresh();dragFrom=null});
  /* One light timer keeps elapsed / remaining / Rest text live without re-rendering. */
  setInterval(()=>{
    document.querySelectorAll('[data-sc-elapsed]').forEach(el=>{el.textContent=scFmtDuration(Date.now()-Number(el.dataset.scElapsed))});
    document.querySelectorAll('[data-sc-remaining]').forEach(el=>{const r=Number(el.dataset.scRemaining)-Date.now();if(r<=0){scRefresh();return}el.textContent=scFmtDuration(r)});
    document.querySelectorAll('[data-sc-meter]').forEach(el=>{const m=selfCareMeterRead(el.dataset.scMeter),v=el.querySelector('.sc-meter__val'),i=el.querySelector('.hw-progress-bar i');if(v)v.textContent=m.enabled?m.value:'—';if(i)i.style.setProperty('--p',m.value)});
  },30000);
}
selfCareBindHome();

/* ------------------------------------------------------------------ */
/* Personal Growth page                                                */
/* ------------------------------------------------------------------ */
function scHistoryRowHTML(r){
  const bits=[];
  if(r.water)bits.push(`<span>Water ${r.water.ml.toLocaleString()} ml${r.water.met?' ✓':''}</span>`);
  if(r.food){
    if(r.food.mode==='meals')bits.push(`<span>Meals ${r.food.mains!=null?r.food.mains:[r.food.meals.breakfast,r.food.meals.lunch,r.food.meals.dinner].filter(Boolean).length}/3${r.food.met===true?' ✓':''}</span>`);
    else bits.push(`<span>${r.food.calories.toLocaleString()} kcal${r.food.met===true?' ✓':''}</span>`);
  }
  if(r.sleep){
    const sess=r.sleep.sessions.map(x=>`<button type="button" class="sc-sess" data-sc-action="sleep-edit" data-session="${x.id}" ${selfCareSleepDateEditable(x.wakeDate)?'':'disabled'} aria-label="Edit sleep ${scFmtClock(x.startedAt)} to ${scFmtClock(x.endedAt)}">${x.kind==='nap'?'Nap ':''}${scFmtClock(x.startedAt)}–${scFmtClock(x.endedAt)}</button>`).join('');
    bits.push(`<span>Sleep ${r.sleep.hours!=null?r.sleep.hours.toFixed(1)+' h'+(r.sleep.win?' ✓':''):'—'}</span>${sess}`);
  }
  r.vigils.forEach(v=>bits.push(`<span>${esc(selfCareVigilLabel(v))}</span>`));
  return `<li class="sc-hist"><b class="sc-hist__date">${esc(pgWhenLabel(r.date))}</b><div class="sc-hist__bits">${bits.join('')||'<span class="pg-meta">Nothing logged.</span>'}</div></li>`;
}
function scSettingsHTML(){
  const st=selfCareSettings(),num=(v)=>v==null?'':String(v);
  const chk=(id,label,on,help='')=>`<label class="sc-check"><input type="checkbox" id="${id}" ${on?'checked':''}> <span>${label}</span></label>${help?`<p class="pg-field__help">${esc(help)}</p>`:''}`;
  return `<form class="sc-settings" id="scSettingsForm" novalidate>
    <fieldset class="pg-shell"><legend class="pg-section__title">Water</legend>
      ${chk('scWaterOn','Track water',st.water.enabled)}
      ${pgInputFieldHTML({id:'scWaterTarget',label:'Daily target (ml)',type:'number',value:num(state.profile.waterTarget),attrs:'min="250" step="50" inputmode="numeric"'})}
      <div class="sc-two">${pgInputFieldHTML({id:'scQuick1',label:'Quick add 1 (ml)',type:'number',value:num(st.water.quickAdd[0]),attrs:'min="50" step="10" inputmode="numeric"'})}${pgInputFieldHTML({id:'scQuick2',label:'Quick add 2 (ml)',type:'number',value:num(st.water.quickAdd[1]),attrs:'min="50" step="10" inputmode="numeric"'})}</div>
    </fieldset>
    <fieldset class="pg-shell"><legend class="pg-section__title">Food</legend>
      ${chk('scFoodOn','Track food',st.food.enabled)}
      ${pgSelectFieldHTML({id:'scFoodMode',label:'Mode',options:[['meals','Meals (breakfast, lunch, dinner)'],['macros','Macros (calories and protein)']],value:st.food.mode,help:'Meals: a day is Nourished when the three main meals are logged. Macros: being inside your own range is a win; eating less than your minimum never is.'})}
      <div class="sc-two">${pgInputFieldHTML({id:'scCalMin',label:'Calorie minimum',type:'number',value:num(st.food.calMin),optional:true,attrs:'min="0" step="50" inputmode="numeric"'})}${pgInputFieldHTML({id:'scCalMax',label:'Calorie maximum',type:'number',value:num(st.food.calMax),optional:true,attrs:'min="0" step="50" inputmode="numeric"'})}</div>
      ${pgInputFieldHTML({id:'scProtein',label:'Protein target (g)',type:'number',value:num(st.food.protein),optional:true,attrs:'min="0" step="5" inputmode="numeric"'})}
    </fieldset>
    <fieldset class="pg-shell"><legend class="pg-section__title">Sleep</legend>
      ${chk('scSleepOn','Track sleep',st.sleep.enabled)}
      <div class="sc-two">${pgInputFieldHTML({id:'scSleepMin',label:'Target from (hours)',type:'number',value:num(st.sleep.targetMin),attrs:'min="3" max="14" step="0.5" inputmode="decimal"'})}${pgInputFieldHTML({id:'scSleepMax',label:'Target up to (hours)',type:'number',value:num(st.sleep.targetMax),help:'Sleeping past this is not counted as a win.',attrs:'min="3" max="16" step="0.5" inputmode="decimal"'})}</div>
      <div class="sc-two">${pgInputFieldHTML({id:'scBed',label:'Usual bedtime',type:'time',value:st.sleep.bedtime})}${pgInputFieldHTML({id:'scWakeT',label:'Usual wake time',type:'time',value:st.sleep.wake})}</div>
    </fieldset>
    <fieldset class="pg-shell"><legend class="pg-section__title">Vigil</legend>
      ${chk('scVigilOn','Show Vigil (optional timer)',st.vigil.enabled,'Off by default and hidden unless you switch it on. A timer and consistency tool only — not medical guidance. Longest possible: 24 hours. Longer never earns more, and ending early is always fine. Please do not use it if you are unwell, pregnant, or have a history of disordered eating.')}
    </fieldset>
    <p class="pg-field__help">Switching a part off makes it neutral — it is never counted as done or missed.</p>
    <button type="submit" class="pg-btn pg-btn--primary">Save settings</button>
  </form>`;
}
function scBindSettings(root){
  const form=root.querySelector('#scSettingsForm');
  if(!form)return;
  form.onsubmit=e=>{
    e.preventDefault();
    const num=id=>{const v=form.querySelector('#'+id).value;return v===''?null:Number(v)};
    const err=(id,msg)=>{pgFieldError&&(()=>{const el=form.querySelector('#'+id+'Error');if(el){el.textContent=msg;el.hidden=!msg}})()};
    ['scWaterTarget','scQuick1','scQuick2','scCalMin','scCalMax','scSleepMin','scSleepMax'].forEach(id=>err(id,''));
    let ok=true;
    const target=num('scWaterTarget'),q1=num('scQuick1'),q2=num('scQuick2'),cmin=num('scCalMin'),cmax=num('scCalMax'),smin=num('scSleepMin'),smax=num('scSleepMax');
    if(!(target>=250)){err('scWaterTarget','Enter at least 250 ml.');ok=false}
    if(!(q1>=50)){err('scQuick1','Enter at least 50 ml.');ok=false}
    if(!(q2>=50)){err('scQuick2','Enter at least 50 ml.');ok=false}
    if(cmin!=null&&cmax!=null&&cmin>cmax){err('scCalMax','The maximum must be at least the minimum.');ok=false}
    if(!(smin>=3)){err('scSleepMin','Enter at least 3 hours.');ok=false}
    if(!(smax>=smin)){err('scSleepMax','The top of the range must be at least the start.');ok=false}
    if(!ok)return;
    selfCareSaveSettings({
      waterTarget:target,
      water:{enabled:form.querySelector('#scWaterOn').checked,quickAdd:[q1,q2]},
      food:{enabled:form.querySelector('#scFoodOn').checked,mode:form.querySelector('#scFoodMode').value,calMin:cmin,calMax:cmax,protein:num('scProtein')},
      sleep:{enabled:form.querySelector('#scSleepOn').checked,targetMin:smin,targetMax:smax,bedtime:form.querySelector('#scBed').value||'23:00',wake:form.querySelector('#scWakeT').value||'07:00'},
      vigil:{enabled:form.querySelector('#scVigilOn').checked}
    });
    toast('Self Care settings saved.');renderPersonalGrowth();
  };
}
function pgRenderSelfCare(){
  const rec=selfCareRecords(),rows=selfCareHistoryRows(30);
  const streakStat=(label,s)=>s?pgStatHTML(s.best,label,'best',`${s.current} current · ${s.total} days`):'';
  const today=`<div class="sc-today">${selfCareEnabled('water')?selfCareWaterPanelHTML():''}${selfCareEnabled('food')?selfCareMealsPanelHTML():''}${selfCareEnabled('sleep')?selfCareSleepPanelHTML():''}${selfCareVigilPanelHTML()}
    ${!selfCareEnabled('water')&&!selfCareEnabled('food')&&!selfCareEnabled('sleep')?'<p class="pg-meta">Every part is switched off. Turn something on in Settings when you want it.</p>':''}</div>`;
  const history=`<section class="pg-shell"><h2 class="pg-section__title">Day by day</h2><ul class="sc-histlist">${rows.map(scHistoryRowHTML).join('')||'<li class="pg-meta">No history yet.</li>'}</ul></section>`;
  const streaks=`<section class="pg-summary pg-summary--four" aria-label="Streaks and records">${streakStat('Water target days',rec.water)}${streakStat('Nourished days',rec.food)}${streakStat('Sleep in range',rec.sleep)}${rec.vigilsKept!==null?pgStatHTML(rec.vigilsKept,'Vigils kept','',''):''}</section>
    <p class="pg-meta">Days with nothing logged are skipped, never counted as a miss.</p>`;
  const tabs=[{id:'today',label:'Today'},{id:'history',label:'History'},{id:'records',label:'Streaks & Records'},{id:'settings',label:'Settings'}];
  view.innerHTML=`<div class="pg-theme pg-page pg-accent-blue"><div class="pg-page__inner sc-page">
    ${pgBackMarkup()}${pgHeroMarkup({title:'Self Care',sub:'Water · Meals · Sleep · Vigil',glyph:'♡',compact:true,scene:'home'})}
    ${pgTabsHTML(tabs,scTab,{today,history,records:streaks,settings:scSettingsHTML()},'Self Care sections')}
  </div></div>`;
  pgBindNav();
  const root=view.querySelector('.pg-tabs-wrap');
  pgBindTabs(root);
  root.querySelectorAll('[role="tab"]').forEach(t=>t.addEventListener('click',()=>{scTab=t.id.replace('pgTab-','')}));
  scBindSettings(root);
}

/* First paint happens in app.js before this file exists; repaint Home once so the Self Care and Habits previews appear. */
if(typeof page!=="undefined"&&page==="home"&&typeof renderHome==="function")renderHome();
