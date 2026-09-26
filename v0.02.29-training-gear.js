/* ---------- Training Gear (Astra handover, 2026-09-18) ----------
   One shared gear system underneath both Running's Shoes tab and
   Cycling's future Bikes tab, per the explicit brief: "Astra should
   not build completely separate shoe and bike storage systems."
   TrainingGear records share one field set (id/category/name/brand/
   model/addedAt/startingDistance/isDefault/status/notes) with only a
   single category-specific field layered on top (shoe: free-text
   `type`; bike: `type` from a fixed enum) -- adding a third category
   later (climbing shoes, swim gear, rackets) means a new category
   string and, if needed, one more category-specific field, never a
   second storage system.

   Distance is deliberately NOT a mutated running counter. "Current
   accumulated distance" is startingDistance (a manual one-time
   carry-over for gear owned before this existed) plus the live sum of
   every COMPLETED activity's own distance that references this gear
   via activity.gearId. Recomputing it on read instead of incrementing
   a stored number on save sidesteps the double-count-on-edit and
   drift-on-delete bugs a mutated counter would need separate guards
   against -- the same "derive, don't duplicate" rule this app already
   applies to PBs and week stats.

   Retiring gear only flips status -- id and every activity.gearId
   link that already points at it stay exactly as they are, forever
   (explicit brief: "Retiring shoes should never delete their
   historical links"). */

const TRAINING_GEAR_BIKE_TYPES=['Road','Mountain','Gravel','Hybrid','BMX','Indoor / Trainer','Other'];
const TRAINING_GEAR_CATEGORY_LABEL={shoe:'Shoes',bike:'Bike'};

function ensureTrainingGear(){
  const t=ensureTrainingState();
  if(!Array.isArray(t.gear))t.gear=[];
  return t.gear;
}
function gearById(id){return ensureTrainingGear().find(g=>g.id===id)}
/* Default-first, otherwise insertion order -- a stable sort so two
   non-default items never swap places just because a default exists. */
function gearOfCategory(category){
  return ensureTrainingGear().filter(g=>g.category===category).map((g,i)=>({g,i})).sort((a,b)=>(b.g.isDefault-a.g.isDefault)||(a.i-b.i)).map(x=>x.g);
}
function gearDistance(g){
  if(!g)return 0;
  const logged=state.activities.filter(a=>a.gearId===g.id&&a.completed).reduce((s,a)=>s+Number(a.distance||0),0);
  return Number(g.startingDistance||0)+logged;
}
function setDefaultGear(id){
  const g=gearById(id);if(!g)return;
  ensureTrainingGear().forEach(x=>{if(x.category===g.category)x.isDefault=(x.id===id)});
  save();
}
/* Which gear category (if any) applies to a given activity type -- the
   one place Running's 3 legacy type strings and Cycling's single type
   string both resolve through, so activityEditorForm's gear picker and
   the Shoes/Bikes tabs never need a second copy of this mapping. */
function gearCategoryForActivityType(type){
  if(isRunningActivity({type}))return 'shoe';
  if(type==='Cycling')return 'bike';
  return null;
}

/* ---------- Add/Edit modal — one form for both categories ---------- */
let __gearDraft=null;
function gearModal(category,id){
  const existing=id?gearById(id):null;
  __gearDraft=existing?{...existing}:{id:'gear_'+uid(),category,name:'',brand:'',model:'',type:'',addedAt:todayISO(),startingDistance:0,isDefault:!gearOfCategory(category).length,status:'active',notes:''};
  gearRender();
}
function gearRender(){
  const d=__gearDraft,isBike=d.category==='bike',isEdit=Boolean(gearById(d.id));
  const label=TRAINING_GEAR_CATEGORY_LABEL[d.category]||'Gear';
  modal(`<h2>${isEdit?'Edit':'Add'} ${isBike?'Bike':'Shoes'}</h2>
    <div class="form-row"><label>Name / nickname</label><input id="gearName" value="${esc(d.name)}" placeholder="${isBike?'e.g. Road Bike':'e.g. Hoka Bondi 9'}" autofocus></div>
    <div class="two-col">
      <div class="form-row"><label>Brand</label><input id="gearBrand" value="${esc(d.brand)}"></div>
      <div class="form-row"><label>Model</label><input id="gearModel" value="${esc(d.model)}"></div>
    </div>
    ${isBike
      ?`<div class="form-row"><label>Bike type</label><select id="gearType">${TRAINING_GEAR_BIKE_TYPES.map(t=>`<option value="${esc(t)}" ${d.type===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`
      :`<div class="form-row"><label>Type <small>optional</small></label><input id="gearType" value="${esc(d.type)}" placeholder="e.g. Road, Trail, Racing"></div>`}
    <div class="two-col">
      <div class="form-row"><label>Starting distance <small>optional, km</small></label><input id="gearStartDist" type="number" min="0" step="0.1" value="${d.startingDistance||''}"></div>
      <div class="form-row"><label class="home-settings-row"><span>Default ${isBike?'bike':'shoe'}</span><input type="checkbox" id="gearDefault" ${d.isDefault?'checked':''}></label></div>
    </div>
    ${isEdit?`<div class="form-row"><label>Status</label><select id="gearStatus"><option value="active" ${d.status==='active'?'selected':''}>Active</option><option value="retired" ${d.status==='retired'?'selected':''}>Retired</option></select></div>`:''}
    <div class="form-row"><label>Notes <small>optional</small></label><textarea id="gearNotes" rows="2">${esc(d.notes)}</textarea></div>
    <button type="button" class="rpg-btn accent" id="gearSave" style="width:100%">Save ${label}</button>`);
  modalRoot.querySelector('#gearSave').onclick=()=>{
    const name=modalRoot.querySelector('#gearName').value.trim();
    if(!name){toast(`Name your ${isBike?'bike':'shoe'}.`);return}
    const wantsDefault=modalRoot.querySelector('#gearDefault').checked;
    const payload={...d,name,
      brand:modalRoot.querySelector('#gearBrand').value.trim(),
      model:modalRoot.querySelector('#gearModel').value.trim(),
      type:modalRoot.querySelector('#gearType').value.trim(),
      startingDistance:Number(modalRoot.querySelector('#gearStartDist').value||0),
      status:modalRoot.querySelector('#gearStatus')?.value||d.status,
      notes:modalRoot.querySelector('#gearNotes').value.trim(),
      isDefault:wantsDefault
    };
    const gear=ensureTrainingGear();
    const idx=gear.findIndex(g=>g.id===d.id);
    if(idx>=0)gear[idx]=payload;else gear.push(payload);
    if(wantsDefault)setDefaultGear(payload.id);
    save();closeModal();toast(`${payload.name} saved.`);renderTrainingArea();
  };
}

/* ---------- Gear list tab content — reused by Running's Shoes tab
   and Cycling's Bikes tab, never a second card layout. ---------- */
function trainingGearCardHTML(g){
  const dist=gearDistance(g);
  return `<article class="training-library-card" data-gear-detail="${g.id}">
    <div class="wl-card-shield">${g.category==='bike'?'🚲':'👟'}</div>
    <strong>${esc(g.name)}</strong>
    <span class="wl-card-meta">${esc(g.type||'—')}</span>
    <span class="wl-card-meta">${dist.toFixed(dist<10?1:0)} km${g.isDefault?' · Default ✓':''}</span>
  </article>`;
}
function trainingGearTabHTML(category){
  const label=TRAINING_GEAR_CATEGORY_LABEL[category]||'Gear';
  const all=gearOfCategory(category);
  const active=all.filter(g=>g.status!=='retired');
  const retired=all.filter(g=>g.status==='retired');
  return `<section class="rpg-frame primary training-library-section">
    <div class="training-panel-title">${esc(label.toUpperCase())}</div>
    <p class="helper" style="margin-top:-4px">Distance adds up automatically from every completed session logged against it.</p>
    <div class="training-panel-title" style="font-size:9px;letter-spacing:.06em;opacity:.7;border:0;margin:6px 0 4px">CURRENT</div>
    <div class="training-library-grid">${active.length?active.map(trainingGearCardHTML).join(''):`<p class="helper">No ${esc(label.toLowerCase())} yet — add your first below.</p>`}</div>
    <button type="button" class="text-btn accent" data-add-gear="${category}" style="width:100%">+ Add ${category==='bike'?'Bike':'Shoes'}</button>
    ${retired.length?`<div class="training-panel-title" style="font-size:9px;letter-spacing:.06em;opacity:.7;border:0;margin:14px 0 4px">RETIRED</div><div class="training-library-grid">${retired.map(trainingGearCardHTML).join('')}</div>`:''}
  </section>`;
}
function bindTrainingGearTab(container){
  if(!container)return;
  container.querySelectorAll('[data-add-gear]').forEach(b=>b.onclick=()=>gearModal(b.dataset.addGear));
  container.querySelectorAll('[data-gear-detail]').forEach(el=>el.onclick=()=>gearDetailModal(el.dataset.gearDetail));
}
function runningShoesTabHTML(){return trainingGearTabHTML('shoe')}
function cyclingBikesTabHTML(){return trainingGearTabHTML('bike')}

/* ---------- Gear Detail (Cycling Bikes Tab handover, 2026-09-18) ----------
   Read-only summary + Edit/Retire, falls out onto Shoes for free since
   it's the shared gear system's own tap target (bindTrainingGearTab),
   not a Bikes-specific modal — exactly the "falls out naturally from
   shared code" the brief asks for rather than building it twice. */
function gearLastActivity(g){
  return state.activities.filter(a=>a.gearId===g.id&&a.completed).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')))[0]||null;
}
function gearRecentActivities(g,limit=5){
  return state.activities.filter(a=>a.gearId===g.id&&a.completed).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))).slice(0,limit);
}
function updateGearStatus(id,status){
  const g=gearById(id);if(!g)return;
  g.status=status;
  if(status==='retired')g.isDefault=false;
  save();
}
function gearDetailModal(id){
  const g=gearById(id);if(!g)return;
  const isBike=g.category==='bike',sessionWord=isBike?'Ride':'Run';
  const dist=gearDistance(g),last=gearLastActivity(g),recent=gearRecentActivities(g);
  modal(`<h2>${esc(g.name)}</h2>
    <p class="helper">${esc(g.type||(isBike?'Bike':'Shoes'))}${g.isDefault?' · Default':''}${g.status==='retired'?' · Retired':''}</p>
    <div class="training-record-row"><div><b>Total Distance</b></div><strong>${dist.toFixed(dist<10?1:0)} km</strong></div>
    <div class="training-record-row"><div><b>Last ${sessionWord}</b>${last?`<span>${fmtShort(last.date)}</span>`:''}</div><strong>${last?(last.distance?`${last.distance} km`:'—'):'None yet'}</strong></div>
    <div class="two-col">
      <button type="button" class="rpg-btn" id="gearDetailEdit">Edit</button>
      <button type="button" class="rpg-btn ${g.status==='retired'?'accent':'danger'}" id="gearDetailRetireToggle">${g.status==='retired'?'Reactivate':'Retire'}</button>
    </div>
    ${recent.length?`<h2 class="section-title">Recent ${sessionWord}s</h2><div class="training-history-list">${recent.map(a=>`<div class="training-history-row" data-training-edit="${a.id}"><span class="history-shield">${trainingShield(a.type,a.name)}</span><strong>${esc(a.name)}</strong><span>${fmtShort(a.date)}</span><span>${a.distance?a.distance+' km':'—'}</span></div>`).join('')}</div>`:''}`);
  modalRoot.querySelector('#gearDetailEdit').onclick=()=>gearModal(g.category,g.id);
  modalRoot.querySelector('#gearDetailRetireToggle').onclick=()=>{
    updateGearStatus(g.id,g.status==='retired'?'active':'retired');
    toast(`${g.name} ${g.status==='retired'?'reactivated':'retired'}.`);
    closeModal();renderTrainingArea();
  };
  modalRoot.querySelectorAll('[data-training-edit]').forEach(row=>row.onclick=()=>editActivityModal(Number(row.dataset.trainingEdit)));
}
