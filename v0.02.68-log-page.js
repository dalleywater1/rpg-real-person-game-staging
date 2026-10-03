/* ==========================================================================
   ADVENTURER'S LOG PAGE (Milestone 2; docs/QUESTS_LOG_BUILD_DESIGN_20261003.md section 3)
   ==========================================================================
   The Log screen on the Log-owned store (v0.02.67): Top 3, Today (Overdue group, NEXT marker, Habits due), Coming up, Soon /
   Later / Unscheduled, Done, the Calendar passed in by renderTasks, and Notes. Presentation + event wiring only: every read
   comes from the store or the shared schedule feed, every write goes through the store's mutators (which save), and a
   schedule row that belongs to a quest or to Training is a REFERENCE: its title, time and completion are the source's,
   shown here and never copied.

   Each section is ONE <section class="q-section"> with data-arrange-id / data-arrange-label (Page Arrange), a direct
   child of the page root, heading inside it, rendered synchronously. The Add Item toolbar sits under the header and is
   fixed chrome (no attribute).

   Nothing open is ever out of sight: an open item or reference is in exactly one of Overdue (past), Today, Coming up
   (future) or Soon / Later / Unscheduled (no day); a finished one that is not dated today is in Done (latest ten).

   Events are delegated from the page root (one set of listeners per render; the root dies with the next render). Rows
   that open a source carry data-log-open + data-source-type/-id and are handled by ONE document-level listener
   (openLogSource), so Home can reuse it. Every mutation that can be undone raises the undo toast AND the toolbar's
   keyboard-reachable "Undo" button (an in-memory stack of inverse operations, capped at LOG_UNDO_MAX, gone on reload).
   ========================================================================== */

let logNotesOpen=false;            /* Notes are collapsed by default; remembered for the session only */
let logHabitsOpen=false;           /* the Habits fold and the Done list keep their open state across re-renders */
let logDoneOpen=false;
let logNoteDraft='';               /* what is typed in the capture field survives a re-render */
const logUndoStack=[];
const LOG_UPCOMING_MAX=50;

/* ---------- small helpers ---------- */
function logDayLabel(date){return dateFromISO(date).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}
function logShort(s,n){s=String(s==null?'':s);return s.length>n?s.slice(0,n-1)+'…':s}
function logTop3Has(kind,id){return ensureAdventurersLogState().top3.some(t=>t.kind===kind&&t.id===String(id))}
/* Re-render the Log. If the control that had focus is gone (a row moved or was removed), focus lands in the same section instead of on <body>. */
function logRerender(){
  if(typeof page==='undefined'||page!=='adventurers-log')return;
  const a=document.activeElement,sec=a&&a.closest?a.closest('.log-v1 [data-arrange-id]'):null,secId=sec?sec.dataset.arrangeId:null;
  renderTasks();
  const now=document.activeElement;
  if(secId&&(!now||now===document.body))logFocusSection(secId);
}
function logFocusSection(secId){
  const s=document.querySelector(`.log-v1 [data-arrange-id="${secId}"]`);
  if(!s)return;
  const f=s.querySelector('button:not(:disabled),input:not(:disabled)');
  if(f){f.focus({preventScroll:true});return}
  const h=s.querySelector('h2');
  if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}
}
function logFocusItem(id){
  const el=document.querySelector(`.log-v1 [data-log-open][data-log-id="${CSS.escape(String(id))}"]`);
  if(el)el.focus({preventScroll:true});
}
/* The undo path. `undo` is the inverse operation. It runs from the toast's Undo or from the toolbar's Undo, and only ONCE: once it has
   left the stack (used, or pushed out by newer ones) neither control can run it again. */
function logUndoPush(label,undo){
  const entry={label,undo};
  logUndoStack.push(entry);
  while(logUndoStack.length>LOG_UNDO_MAX)logUndoStack.shift();
  const run=()=>{
    const i=logUndoStack.indexOf(entry);
    if(i<0)return;
    logUndoStack.splice(i,1);
    try{undo()}catch(e){try{window.__errs.push({at:Date.now(),k:'log-undo',m:String(e&&e.message||e).slice(0,200)})}catch(x){}}
    logRerender();
  };
  entry.run=run;
  if(typeof toastWithAction==='function')toastWithAction(label,'Undo',run,8000);
  return run;
}
function logUndoLast(){const e=logUndoStack[logUndoStack.length-1];if(e)e.run()}

/* ---------- row builders ---------- */
/* A Log item: circular check (its own state, awards nothing), a title button that opens the sheet, the when/length/category line, and
   on the trail either the Top 3 star or the Top 3 order controls. The NEXT chip sits above the title. */
function logItemRowHTML(it,opt={}){
  const id=esc(it.id),done=it.status==='done',title=esc(it.title);
  const bits=[];
  if(opt.withDate&&it.date)bits.push(esc(logDayLabel(it.date)));
  if(it.time)bits.push(`<b class="log-row__when">${esc(it.time)}</b>`);
  if(it.durationMin)bits.push(esc(it.durationMin+' min'));
  if(it.category)bits.push(esc(it.category));
  const sub=bits.join(' · ')||(it.notes?esc(logShort(it.notes,60)):'');
  const inTop=logTop3Has('item',it.id);
  let trail='';
  if(opt.top3){
    const t=opt.top3;
    trail=`<button type="button" class="q-icon-btn" data-log-top3="up" data-log-id="${id}" data-log-top3-kind="item" aria-label="Move up in Top 3: ${title}"${t.index===0?' disabled':''}><span aria-hidden="true">↑</span></button><button type="button" class="q-icon-btn" data-log-top3="down" data-log-id="${id}" data-log-top3-kind="item" aria-label="Move down in Top 3: ${title}"${t.index===t.count-1?' disabled':''}><span aria-hidden="true">↓</span></button><button type="button" class="q-icon-btn" data-log-top3="remove" data-log-id="${id}" data-log-top3-kind="item" aria-label="Remove from Top 3: ${title}"><span aria-hidden="true">✕</span></button>`;
  }else if(!done){
    trail=`<button type="button" class="q-icon-btn log-star${inTop?' is-on':''}" data-log-star="${id}" data-log-id="${id}" aria-pressed="${inTop}" aria-label="Top 3: ${title}"><span aria-hidden="true">${inTop?'★':'☆'}</span></button>`;
  }
  const acts=opt.overdue?`<span class="q-btn-row log-row__actions" role="group" aria-label="Reschedule: ${title}"><button type="button" class="q-btn q-btn--sm" data-log-resched="today" data-log-id="${id}" aria-label="Reschedule ${title} to today">Today</button><button type="button" class="q-btn q-btn--sm" data-log-resched="tomorrow" data-log-id="${id}" aria-label="Reschedule ${title} to tomorrow">Tomorrow</button><button type="button" class="q-btn q-btn--ghost q-btn--sm" data-log-resched="none" data-log-id="${id}" aria-label="Move ${title} to Unscheduled">Unscheduled</button></span>`:'';
  return `<div class="q-row log-item-row${opt.top3?' log-item-row--top3':''}${done?' is-done':''}${opt.next?' is-next':''}" role="listitem" data-log-row="${id}"><input type="checkbox" class="q-check" data-log-done="${id}" data-log-id="${id}" aria-label="Done: ${title}"${done?' checked':''}><span class="q-row__body">${opt.next?'<span class="q-reward log-next">Next</span>':''}<button type="button" class="log-row__open" data-log-open data-log-id="${id}" data-source-type="logItem" data-source-id="${id}"><span class="q-row__title">${title}</span></button>${sub?`<span class="q-row__sub">${sub}</span>`:''}</span><span class="q-row__actions">${trail}</span>${acts}</div>`;
}
/* A scheduled quest reference. Read-only here: finishing it is the quest's own action; the Log can open it, move it or take it off the schedule.
   Its lead is a quest glyph, not a tick, because nothing on this row completes it. */
function logRefRowHTML(r,opt={}){
  const sid=esc(r.scheduleId),title=esc(r.title),bits=[];
  if(opt.withDate&&r.date)bits.push(esc(logDayLabel(r.date)));
  if(logTimeToMin(r.time)!=null)bits.push(`<b class="log-row__when">${esc(r.time)}</b>`);
  bits.push(r.missing?'Quest removed':('Quest'+(r.sub?' · '+esc(r.sub):'')));
  let trail='';
  if(opt.top3){
    const t=opt.top3;
    trail=`<button type="button" class="q-icon-btn" data-log-top3="up" data-log-id="${sid}" data-log-top3-kind="schedule" aria-label="Move up in Top 3: ${title}"${t.index===0?' disabled':''}><span aria-hidden="true">↑</span></button><button type="button" class="q-icon-btn" data-log-top3="down" data-log-id="${sid}" data-log-top3-kind="schedule" aria-label="Move down in Top 3: ${title}"${t.index===t.count-1?' disabled':''}><span aria-hidden="true">↓</span></button><button type="button" class="q-icon-btn" data-log-top3="remove" data-log-id="${sid}" data-log-top3-kind="schedule" aria-label="Remove from Top 3: ${title}"><span aria-hidden="true">✕</span></button>`;
  }else{
    if(r.done)trail+='<span class="q-reward is-done">Done</span>';
    trail+=`<button type="button" class="q-icon-btn" data-log-unschedule="${sid}" data-log-id="${sid}" aria-label="Take off the schedule: ${title}"><span aria-hidden="true">✕</span></button>`;
  }
  const acts=opt.overdue&&!r.missing?`<span class="q-btn-row log-row__actions" role="group" aria-label="Reschedule: ${title}"><button type="button" class="q-btn q-btn--sm" data-log-resched="today" data-log-entry="${sid}" data-log-id="${sid}" aria-label="Reschedule ${title} to today">Today</button><button type="button" class="q-btn q-btn--sm" data-log-resched="tomorrow" data-log-entry="${sid}" data-log-id="${sid}" aria-label="Reschedule ${title} to tomorrow">Tomorrow</button><button type="button" class="q-btn q-btn--ghost q-btn--sm" data-log-resched="none" data-log-entry="${sid}" data-log-id="${sid}" aria-label="Take ${title} off the schedule">Unschedule</button></span>`:'';
  const open=r.missing?`<span class="q-row__title">${title}</span>`:`<button type="button" class="log-row__open" data-log-open data-log-id="${sid}" data-source-type="${esc(r.sourceType)}" data-source-id="${esc(r.sourceId)}"><span class="q-row__title">${title}</span></button>`;
  return `<div class="q-row log-item-row log-ref-row${opt.top3?' log-item-row--top3':''}${r.done?' is-done':''}${opt.next?' is-next':''}" role="listitem" data-log-ref="${sid}"><span class="q-glyph log-ref-glyph" aria-hidden="true">◆</span><span class="q-row__body">${opt.next?'<span class="q-reward log-next">Next</span>':''}${open}<span class="q-row__sub">${bits.join(' · ')}</span></span><span class="q-row__actions">${trail}</span>${acts}</div>`;
}
/* Anything else in today's shared feed (Training, Personal Growth, Main Quest): the row Jay has always had,
   its title now opens the owning page where there is one. */
const LOG_OPENABLE_SOURCES=['training','personalGrowth','mainQuest','mainQuestMilestone','sideQuest'];
function logSourceRowHTML(i,opt={}){
  const time=i.time==='Any'?'':String(i.time||'');
  const title=LOG_OPENABLE_SOURCES.includes(i.sourceType)
    ?`<button type="button" class="log-row__open" data-log-open data-log-id="${esc(i.sourceType)}:${esc(i.sourceId??'')}" data-source-type="${esc(i.sourceType)}" data-source-id="${esc(i.sourceId??'')}"><b class="q-row__title">${esc(i.title)}</b></button>`
    :`<b class="q-row__title">${esc(i.title)}</b>`;
  return `<div class="q-row log-row${time?'':' q-row--nolead'}${i.done?' is-done':''}${opt.next?' is-next':''}" role="listitem" data-source-type="${esc(i.sourceType||'')}" data-source-id="${esc(i.sourceId??'')}">${time?`<span class="log-row__time">${esc(time)}</span>`:''}<span class="q-row__body">${title}<span class="q-row__sub">${esc(SCHEDULE_KIND_LABELS[i.kind]||i.kind)}${i.sub?' · '+esc(i.sub):''}</span></span>${opt.next?'<span class="q-reward log-next">Next</span>':''}${i.done?'<span class="q-reward is-done">Done</span>':''}</div>`;
}
function logAnyRowHTML(r,opt={}){
  if(r.kind==='logItem'){const it=logItemById(r.logItemId);return it?logItemRowHTML(it,opt):''}
  if(r.kind==='questRef')return logRefRowHTML(r,opt);
  return logSourceRowHTML(r,opt);
}

/* ---------- sections ---------- */
function logToolbarHTML(){
  const last=logUndoStack[logUndoStack.length-1];
  return `<div class="q-toolbar log-toolbar"><button type="button" class="q-btn q-btn--primary" id="logAddItem">+ Add Item</button>${last?`<button type="button" class="q-btn" id="logUndoLast" data-log-undo-last aria-label="Undo: ${esc(last.label)}">Undo</button>`:''}</div>`;
}
function logTop3SectionHTML(){
  const list=logTop3Resolved();
  const rows=list.map((t,i)=>{
    const opt={top3:{index:i,count:list.length}};
    return t.kind==='item'?logItemRowHTML(t.item,opt):logRefRowHTML({...t.view,scheduleId:t.id,sourceType:t.entry.sourceKind,sourceId:t.entry.sourceId,time:t.entry.startTime||'Any',date:t.entry.startDate},opt);
  }).join('');
  return `<section class="q-section" data-arrange-id="top3" data-arrange-label="Top 3"><h2 class="q-section__title">Top 3</h2><p class="q-note">Up to three things that matter most. ${list.length} of ${LOG_TOP3_MAX}.</p>${rows?`<div class="q-stack" role="list">${rows}</div>`:'<div class="q-empty">Star an item to make it one of your three.</div>'}</section>`;
}
function logTodaySectionHTML(){
  const m=logTodayModel();
  const overdue=m.overdue.length?`<div class="log-group"><h3 class="log-group__title">Overdue <span class="log-group__count">${m.overdue.length}</span></h3><div class="q-stack" role="list">${m.overdue.map(r=>logAnyRowHTML(r,{overdue:true,withDate:true})).join('')}</div></div>`:'';
  const rows=m.rows.map(r=>logAnyRowHTML(r,{next:m.next===r})).join('');
  const habits=m.habits.length?`<details class="log-habits" data-log-fold="habits"${logHabitsOpen?' open':''}><summary>Habits due <span class="log-group__count">${m.habits.length}</span></summary><div class="q-stack" role="list">${m.habits.map(r=>logSourceRowHTML(r)).join('')}</div></details>`:'';
  const body=rows?`<div class="log-today-list" role="list">${rows}</div>`:`<div class="q-empty">${overdue||habits?'Nothing else scheduled today.':'Nothing scheduled today.'}</div>`;
  return `<section class="q-section" data-arrange-id="today" data-arrange-label="Today"><h2 class="q-section__title">Today</h2>${overdue}${body}${habits}</section>`;
}
/* Open, dated after today: shown with their day, soonest first, so a day picked for next week does not make an item vanish. */
function logUpcomingSectionHTML(){
  const all=logUpcoming(),rows=all.slice(0,LOG_UPCOMING_MAX);
  if(!rows.length)return `<section class="q-section log-section--empty" data-arrange-id="upcoming" data-arrange-label="Coming up"><h2 class="q-section__title">Coming up</h2><p class="q-note">Things with a day ahead. Nothing here.</p></section>`;
  const more=all.length>rows.length?`<p class="q-note">and ${all.length-rows.length} more further ahead.</p>`:'';
  return `<section class="q-section" data-arrange-id="upcoming" data-arrange-label="Coming up"><h2 class="q-section__title">Coming up</h2><div class="q-stack" role="list">${rows.map(r=>logAnyRowHTML(r,{withDate:true})).join('')}</div>${more}</section>`;
}
const LOG_BUCKETS_META={
  soon:{label:'Soon',hint:'Things for the next few days.'},
  later:{label:'Later',hint:'Things for another day.'},
  unscheduled:{label:'Unscheduled',hint:'Things with no day yet.'}
};
function logBucketSectionHTML(bucket){
  const meta=LOG_BUCKETS_META[bucket],items=logUndated(bucket);
  if(!items.length)return `<section class="q-section log-section--empty" data-arrange-id="${bucket}" data-arrange-label="${meta.label}"><h2 class="q-section__title">${meta.label}</h2><p class="q-note">${meta.hint} Nothing here.</p></section>`;
  return `<section class="q-section" data-arrange-id="${bucket}" data-arrange-label="${meta.label}"><h2 class="q-section__title">${meta.label}</h2><div class="q-stack" role="list">${items.map(it=>logItemRowHTML(it)).join('')}</div></section>`;
}
/* The latest finished items that Today does not show. Ticking one again re-opens it. Only present when there is something to show. */
function logDoneSectionHTML(){
  const done=logRecentDone(10);
  if(!done.length)return '';
  return `<section class="q-section" data-arrange-id="done" data-arrange-label="Done"><h2 class="q-section__title">Done</h2><details class="log-habits" data-log-fold="done"${logDoneOpen?' open':''}><summary>Latest finished <span class="log-group__count">${done.length}</span></summary><div class="q-stack" role="list">${done.map(it=>logItemRowHTML(it,{withDate:true})).join('')}</div></details></section>`;
}
function logNotesSectionHTML(){
  const notes=logNotes().slice().reverse(),n=notes.length;
  const noteRows=notes.map(x=>`<div class="q-row" role="listitem"><span class="q-glyph" aria-hidden="true">✦</span><span class="q-row__body"><span class="q-row__title">${esc(x.text)}</span><span class="q-row__sub">${x.origin==='brain-dump'?'From your Brain Dump':'Captured'}</span></span><span class="q-row__actions"><button type="button" class="q-btn q-btn--ghost q-btn--sm" data-log-note-item="${esc(x.id)}" data-log-id="${esc(x.id)}" aria-label="Make an item: ${esc(logShort(x.text,60))}">Make an item</button><button type="button" class="q-icon-btn" data-log-note-del="${esc(x.id)}" data-log-id="${esc(x.id)}" aria-label="Delete note: ${esc(logShort(x.text,60))}"><span aria-hidden="true">✕</span></button></span></div>`).join('');
  const body=logNotesOpen?`<div class="log-capture"><input id="logNoteInput" class="q-input" placeholder="Get it out of your head…" aria-label="New note" maxlength="2000" value="${esc(logNoteDraft)}"><button type="button" class="q-btn q-btn--primary" data-log-note-add id="logNoteAdd">Capture</button></div>${n?`<div class="log-dump" role="list">${noteRows}</div>`:'<div class="q-empty">No notes yet.</div>'}`:'';
  return `<section class="q-section" data-arrange-id="notes" data-arrange-label="Notes"><h2 class="q-section__title">Notes</h2><div class="q-toolbar"><button type="button" class="q-btn q-btn--sm" data-log-notes-toggle id="logNotesToggle" aria-expanded="${logNotesOpen}" aria-controls="logNotesBody">Notes (${n}) <span aria-hidden="true">${logNotesOpen?'▴':'▾'}</span></button></div><div id="logNotesBody"${logNotesOpen?'':' hidden'}>${body}</div></section>`;
}
/* Everything under the header/toolbar/recap, in the default order. The Calendar is built by renderTasks (it owns the Week/Month state). */
function logSectionsHTML(calendarHTML){
  return logTop3SectionHTML()+logTodaySectionHTML()+logUpcomingSectionHTML()+['soon','later','unscheduled'].map(logBucketSectionHTML).join('')+logDoneSectionHTML()+(calendarHTML||'')+logNotesSectionHTML();
}

/* ---------- the item sheet (Add Item and edit share it) ---------- */
function logItemSheet(id,preset){
  const it=id?logItemById(id):null;
  if(id&&!it)return false;
  const mode=it?'edit':'add',today=todayISO();
  const cur=it||{title:'',notes:'',date:null,time:null,durationMin:null,bucket:'unscheduled',...(preset||{})};
  const when=cur.date?'date':(LOG_BUCKETS.includes(cur.bucket)?cur.bucket:'unscheduled');
  const quick=mode==='edit'?`<div class="q-field"><span class="q-label" id="logMoveLbl">Move it</span><div class="q-btn-row" role="group" aria-labelledby="logMoveLbl"><button type="button" class="q-btn q-btn--sm" data-log-fill="later-today">Later today</button><button type="button" class="q-btn q-btn--sm" data-log-fill="tomorrow">Tomorrow</button><button type="button" class="q-btn q-btn--sm" data-log-fill="next-week">Next week</button></div></div>`:'';
  const top3=mode==='edit'&&it.status==='open'?`<label class="q-check-row"><input type="checkbox" class="q-check" id="logTop3Box"${logTop3Has('item',it.id)?' checked':''}> <span>One of my Top 3</span></label>`:'';
  const body=`<p class="q-note log-sheet-error" id="logSheetError" role="alert" hidden></p>
    <div class="q-field"><label class="q-label" for="logTitle">What needs doing?</label><input id="logTitle" class="q-input" maxlength="160" autocomplete="off" required aria-required="true" value="${esc(cur.title)}"></div>
    <div class="q-field"><span class="q-label" id="logWhenLbl">When</span>${questsChoiceHTML('logWhen',[{value:'unscheduled',label:'No date'},{value:'soon',label:'Soon'},{value:'later',label:'Later'},{value:'date',label:'Pick a day'}],when,'logWhenLbl')}</div>
    <div class="log-when-fields" id="logDateFields"${when==='date'?'':' hidden'}><div class="q-field-row"><div class="q-field"><label class="q-label" for="logDate">Day</label><input id="logDate" type="date" class="q-input" value="${esc(cur.date||today)}"></div><div class="q-field"><label class="q-label" for="logTime">Time (optional)</label><input id="logTime" type="time" class="q-input" value="${esc(cur.time||'')}"></div></div>
      <div class="q-field"><label class="q-label" for="logDur">Length in minutes (optional)</label><input id="logDur" type="number" inputmode="numeric" min="5" max="1440" step="5" class="q-input" value="${cur.durationMin?esc(cur.durationMin):''}"></div></div>
    ${quick}
    <div class="q-field"><label class="q-label" for="logNotes">Notes</label><textarea id="logNotes" class="q-input" maxlength="2000">${esc(cur.notes||'')}</textarea></div>${top3}`;
  const actions=(mode==='edit'?`<button type="button" class="q-btn q-btn--danger" id="logSheetDelete">Delete</button>`:'')+`<button type="button" class="q-btn" data-q-close>Cancel</button><button type="button" class="q-btn q-btn--primary" id="logSheetSave">${mode==='add'?'Add':'Save'}</button>`;
  questsModal({title:mode==='add'?'Add to the Log':'Edit item',sub:mode==='add'?'A title is all it needs.':'',category:'log',body,actions,focus:'#logTitle'});
  const q=s=>modalRoot.querySelector(s);
  /* an error is written INSIDE the dialog (role=alert, so it is announced) and the offending field is flagged and focused */
  const fail=(msg,fieldSel)=>{
    const e=q('#logSheetError');e.textContent=msg;e.hidden=false;
    modalRoot.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));
    const f=q(fieldSel);if(f){f.setAttribute('aria-invalid','true');f.focus()}
  };
  const showDate=()=>{q('#logDateFields').hidden=questsChoiceValue('logWhen')!=='date'};
  modalRoot.querySelectorAll('input[name="logWhen"]').forEach(r=>r.onchange=showDate);
  modalRoot.querySelectorAll('[data-log-fill]').forEach(b=>b.onclick=()=>{
    const w=logQuickWhen(b.dataset.logFill,new Date(),{time:q('#logTime').value});
    if(!w)return;
    const radio=modalRoot.querySelector('input[name="logWhen"][value="date"]');if(radio)radio.checked=true;
    q('#logDate').value=w.date;q('#logTime').value=w.time||'';showDate();
  });
  const save=()=>{
    const title=q('#logTitle').value.trim();
    if(!title)return fail('Give it a name.','#logTitle');
    const w=questsChoiceValue('logWhen')||'unscheduled';
    const patch={title,notes:q('#logNotes').value};
    if(w==='date'){
      const d=q('#logDate').value;
      if(!logIsDate(d))return fail('Pick a day for it.','#logDate');
      patch.date=d;patch.time=q('#logTime').value||null;patch.durationMin=logDur(q('#logDur').value);patch.bucket='unscheduled';
    }else{patch.date=null;patch.time=null;patch.durationMin=null;patch.bucket=w}
    if(mode==='add'){
      const item=logAddItem({...patch,origin:'manual'});
      if(!item)return fail('Give it a name.','#logTitle');
      closeModal();logRerender();toast('Added to the Log.','success');
      return;
    }
    const prev={title:it.title,notes:it.notes,date:it.date,time:it.time,bucket:it.bucket,durationMin:it.durationMin},top3Before=logTop3Snapshot();
    const r=logUpdateItem(it.id,patch);
    if(!r.ok)return fail(r.reason==='bad-date'?'Pick a day for it.':'That could not be saved.',r.reason==='bad-date'?'#logDate':'#logTitle');
    const box=q('#logTop3Box');let note='';
    if(box){
      const has=logTop3Has('item',it.id);
      if(box.checked&&!has){const t=logTop3Add('item',it.id);if(!t.ok)note=' Top 3 is full.'}
      else if(!box.checked&&has)logTop3Remove('item',it.id);
    }
    closeModal();
    logUndoPush('Saved.'+note,()=>{logUpdateItem(it.id,prev);logTop3Restore(top3Before)});
    logRerender();
    logFocusItem(it.id);
  };
  q('#logSheetSave').onclick=save;
  /* Enter submits from any single-line field (not the notes box, not a radio, not mid-composition for an IME) */
  q('.q-modal__body').addEventListener('keydown',e=>{
    const t=e.target;
    if(e.key!=='Enter'||e.isComposing||!t||t.tagName!=='INPUT'||t.type==='radio'||t.type==='checkbox')return;
    e.preventDefault();save();
  });
  const del=q('#logSheetDelete');
  if(del)del.onclick=()=>{closeModal();logDeleteWithUndo(it.id)};
  return true;
}

/* ---------- mutations with undo ---------- */
function logDeleteWithUndo(id){
  const it=logItemById(id);if(!it)return;
  const title=it.title,snap=logDeleteItem(id);
  if(!snap)return;
  logUndoPush(`Deleted “${logShort(title,28)}”.`,()=>logRestoreItem(snap));
  logRerender();
}
function logToggleDone(id,checked){
  const it=logItemById(id);if(!it)return;
  logSetItemDone(id,checked);
  logUndoPush(checked?'Marked done.':'Marked open.',()=>logSetItemDone(id,!checked));
  logRerender();
}
function logToggleStar(id){
  const it=logItemById(id);if(!it)return;
  if(logTop3Has('item',id)){logTop3Remove('item',id);logRerender();return}
  const r=logTop3Add('item',id);
  if(!r.ok)toast(r.reason==='full'?'Top 3 is full. Remove one first.':'That could not be added.','error');
  logRerender();
}
function logTop3Act(kind,id,act){
  if(act==='remove')logTop3Remove(kind,id);
  else logTop3Move(kind,id,act==='up'?-1:1);
  logRerender();
}
/* one tap: an item moves to today / tomorrow / next week, or loses its date; a quest reference is moved or taken off the schedule */
function logReschedule(spec,kind){
  const now=new Date();
  if(spec.item){
    const it=logItemById(spec.item);if(!it)return;
    const prev={date:it.date,time:it.time,bucket:it.bucket};
    if(kind==='none')logMoveItem(it.id,{date:null,time:null,bucket:'unscheduled'});
    else{const w=logQuickWhen(kind,now,it);if(!w)return;logMoveItem(it.id,w)}
    logUndoPush(kind==='none'?'Moved to Unscheduled.':'Rescheduled.',()=>logMoveItem(it.id,prev));
    logRerender();return;
  }
  const e=logEntryById(spec.entry);if(!e)return;
  const prev={sourceKind:e.sourceKind,sourceId:e.sourceId,startDate:e.startDate,startTime:e.startTime,durationMin:e.durationMin},top3Before=logTop3Snapshot();
  if(kind==='none'){
    logUnscheduleSource(e.scheduleId);
    logUndoPush('Taken off the schedule.',()=>{logScheduleSource(prev);logTop3Restore(top3Before)});
  }else{
    const w=logQuickWhen(kind,now,{time:e.startTime});if(!w)return;
    const r=logScheduleSource({...prev,startDate:w.date,startTime:w.time});
    if(!r.ok){toast('That could not be rescheduled.','error');return}
    logUndoPush('Rescheduled.',()=>logScheduleSource(prev));
  }
  logRerender();
}
function logUnscheduleWithUndo(scheduleId){
  const e=logEntryById(scheduleId);if(!e)return;
  const prev={sourceKind:e.sourceKind,sourceId:e.sourceId,startDate:e.startDate,startTime:e.startTime,durationMin:e.durationMin},top3Before=logTop3Snapshot();
  const gone=logResolveEntry(e).missing;
  if(!logUnscheduleSource(scheduleId))return;
  /* a reference to a quest that no longer exists cannot be put back, so it is simply cleared away */
  if(gone)toast('Removed.');
  else logUndoPush('Taken off the schedule.',()=>{logScheduleSource(prev);logTop3Restore(top3Before)});
  logRerender();
}

/* ---------- opening a source (one document-level listener) ---------- */
/* row: {sourceType, sourceId}. Returns true when something was opened. Navigation is the player's choice (a tap on the title). */
function openLogSource(row){
  const t=row&&row.sourceType,id=row&&row.sourceId;
  switch(t){
    case 'logItem':return logItemSheet(String(id));
    case 'training':{
      setPage('training');
      const a=(Array.isArray(state.activities)?state.activities:[]).find(x=>String(x.id)===String(id));   /* ids are compared as text: the row carried it through an attribute */
      if(a&&typeof openTrainingScheduleEntry==='function')openTrainingScheduleEntry(a.id);
      return true;
    }
    case 'personalGrowth':setPage('personal-growth');if(typeof pgOpenDetail==='function')pgOpenDetail(id);return true;
    case 'mainQuest':case 'mainQuestMilestone':qpView='main';setPage('quests');return true;
    case 'sideQuest':qpView='side';setPage('quests');return true;
  }
  return false;
}
document.addEventListener('click',e=>{
  const b=e.target&&e.target.closest?e.target.closest('[data-log-open]'):null;
  if(!b)return;
  e.preventDefault();
  openLogSource({sourceType:b.dataset.sourceType,sourceId:b.dataset.sourceId});
});

/* ---------- page wiring (called by bindTasks after every render) ---------- */
function logBindPage(){
  const root=view.querySelector('.log-v1');
  if(!root)return;
  root.addEventListener('click',e=>{
    const t=e.target&&e.target.closest?e.target:null;if(!t)return;
    const hit=sel=>t.closest(sel);
    let b;
    if(hit('#logAddItem'))return logItemSheet(null);
    if(hit('[data-log-undo-last]'))return logUndoLast();
    if((b=hit('[data-log-star]')))return logToggleStar(b.dataset.logStar);
    if((b=hit('[data-log-top3]')))return logTop3Act(b.dataset.logTop3Kind,b.dataset.logId,b.dataset.logTop3);
    if((b=hit('[data-log-resched]')))return logReschedule(b.dataset.logEntry?{entry:b.dataset.logEntry}:{item:b.dataset.logId},b.dataset.logResched);
    if((b=hit('[data-log-unschedule]')))return logUnscheduleWithUndo(b.dataset.logUnschedule);
    if(hit('[data-log-notes-toggle]')){logNotesOpen=!logNotesOpen;renderTasks();if(logNotesOpen){const i=document.querySelector('#logNoteInput');if(i)i.focus({preventScroll:true})}return}
    if(hit('[data-log-note-add]'))return logNoteAddFromInput();
    if((b=hit('[data-log-note-item]'))){
      const r=logNoteToItem(b.dataset.logNoteItem);if(!r)return;
      logUndoPush('Made an item.',()=>{logDeleteItem(r.item.id);logRestoreNote(r.noteSnap)});
      return logRerender();
    }
    if((b=hit('[data-log-note-del]'))){
      const snap=logDeleteNote(b.dataset.logNoteDel);if(!snap)return;
      logUndoPush('Note deleted.',()=>logRestoreNote(snap));
      return logRerender();
    }
  });
  root.addEventListener('change',e=>{
    const c=e.target&&e.target.closest?e.target.closest('[data-log-done]'):null;
    if(c)logToggleDone(c.dataset.logDone,c.checked);
  });
  root.addEventListener('input',e=>{if(e.target&&e.target.id==='logNoteInput')logNoteDraft=e.target.value});
  root.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.isComposing&&e.target&&e.target.id==='logNoteInput'){e.preventDefault();logNoteAddFromInput()}
  });
  /* the folds remember whether they are open ('toggle' does not bubble, so listen in the capture phase) */
  root.addEventListener('toggle',e=>{
    const d=e.target;
    if(!d||!d.matches||!d.matches('details[data-log-fold]'))return;
    if(d.dataset.logFold==='habits')logHabitsOpen=d.open;else if(d.dataset.logFold==='done')logDoneOpen=d.open;
  },true);
}
function logNoteAddFromInput(){
  const el=document.querySelector('#logNoteInput');if(!el)return;
  const n=logAddNote(el.value);
  if(!n){toast('Write something first.','error');return}
  logNoteDraft='';
  renderTasks();
  const again=document.querySelector('#logNoteInput');if(again)again.focus({preventScroll:true});
}
