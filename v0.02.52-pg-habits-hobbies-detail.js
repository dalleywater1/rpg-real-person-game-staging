/* Personal Growth: Habits, Hobbies and the shared Detail page (RPG-0045, 0046, 0047, 0048).
   Astra, 2026-09-25. Loads after v0.02.34-personal-growth.js, whose router calls
   pgRenderHabits / pgRenderHobbies / pgRenderDetail when they exist.

   DECISIONS (Jay asked for these to be built without a separate product round; flagged in
   docs/PERSONAL_GROWTH_PHASE2.md so Lyra / Aurelia can overrule any of them):
   - There is still ONE data object, the tracker record in state.personalGrowth.trackers. The
     rules, schedule provider and the Home Habits 3x3 all read it, so a second model would
     fork the truth. Habits and Hobbies are two VIEWS over it: a Hobby is a tracker filed under
     the Hobbies category, a Habit is any other tracker. Moving a tracker between categories
     moves it between the pages. The Trackers page still shows everything.
   - ONE Detail page serves Habit Detail, Hobby Detail and Tracker Detail: Overview / History /
     Notes / Settings (the "shared Personal Growth detail architecture" the handover asks for).
   - Additive data only: `notes: [{id, at, text}]` on a tracker. Nothing existing is renamed,
     removed or migrated, and older saves simply have no notes.
   - The tracking METHOD cannot be changed after creation (it would reinterpret every logged
     value); name, category, goal, unit, schedule and favourite can.
   Presentation only otherwise: logging still goes through pgLogTracker, deletion through
   pgConfirmDelete, so every existing rule keeps working. Styles: styles/personal-growth/03-pg-detail.css. */

const PG_HOBBY_CATEGORY = 'hobbies';
const PG_DETAIL_NAMES = { habits: 'Habits', hobbies: 'Hobbies', trackers: 'Trackers', hub: 'Personal Growth', activity: 'Activity', records: 'Records & Milestones' };
const PG_NOTE_MAX = 500;
let pgDetailTab = 'overview', pgDetailMonth = null;
let pgHabitFilter = 'all';

/* ------------------------------------------------------------------ */
/* Scope: which trackers belong to which page                          */
/* ------------------------------------------------------------------ */
function pgIsHobby(t) { return t.category === PG_HOBBY_CATEGORY; }
function pgHabitList() { return ensurePersonalGrowth().trackers.filter(t => !pgIsHobby(t)); }
function pgHobbyList() { return ensurePersonalGrowth().trackers.filter(pgIsHobby); }
function pgHabitCategoryKeys() { return Object.keys(PERSONAL_GROWTH_CATEGORIES).filter(k => k !== PG_HOBBY_CATEGORY); }
function pgScopeTrackers() {
  if (pgView === 'habits') return pgHabitList();
  if (pgView === 'hobbies') return pgHobbyList();
  return ensurePersonalGrowth().trackers;
}
function pgNoun(t) { return pgIsHobby(t) ? 'hobby' : 'habit'; }

/* ------------------------------------------------------------------ */
/* Time and value helpers (pure)                                       */
/* ------------------------------------------------------------------ */
function pgIsMinutes(t) { return t.method === 'duration' && /^(min|mins|minute|minutes)?$/i.test(String(t.unit || '').trim()); }
function pgFormatMinutes(m) {
  m = Math.round(Number(m) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
function pgFormatValue(t, v) {
  if (t.method === 'completion') return 'Done';
  if (pgIsMinutes(t)) return pgFormatMinutes(v);
  return `${v}${t.unit ? ` ${t.unit}` : ''}`;
}
function pgCompleteDates(t) { return Object.keys(t.entries || {}).filter(d => pgEntryComplete(t, d)).sort(); }
function pgSumIn(t, dates) { return dates.reduce((n, d) => n + (pgEntryComplete(t, d) ? Number(t.entries[d]) || 0 : 0), 0); }
/* [label, value text, note] tiles that depend on how the tracker measures things. */
function pgValueStats(t) {
  const done = pgCompleteDates(t);
  if (!done.length || t.method === 'completion') return [];
  const sum = pgSumIn(t, done), avg = sum / done.length;
  if (t.method === 'rating') return [['Average rating', (Math.round(avg * 10) / 10).toString(), `${done.length} rating${done.length === 1 ? '' : 's'}`]];
  if (t.method === 'progress') return [['Latest', `${t.entries[done[done.length - 1]]}${t.unit ? ` ${t.unit}` : ''}`, `on ${done[done.length - 1]}`]];
  if (pgIsMinutes(t)) return [['Time logged', pgFormatMinutes(sum), `${done.length} session${done.length === 1 ? '' : 's'}`], ['Average', pgFormatMinutes(avg), 'per session']];
  return [['Total', pgFormatValue(t, Math.round(sum * 100) / 100), `${done.length} check‑in${done.length === 1 ? '' : 's'}`], ['Average', pgFormatValue(t, Math.round(avg * 100) / 100), 'per check‑in']];
}
function pgWeekPercent(list) {
  const week = pgWeekDays();
  let sched = 0, done = 0;
  list.forEach(t => week.forEach(d => { if (pgScheduledOn(t, d)) { sched++; if (pgEntryComplete(t, d)) done++; } }));
  return sched ? Math.round((done / sched) * 100) : null;
}
function pgLongDate(iso) { return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); }
function pgShortDate(iso) { return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }

/* ------------------------------------------------------------------ */
/* Summaries                                                           */
/* ------------------------------------------------------------------ */
function pgHabitSummaryHTML() {
  const list = pgHabitList();
  if (!list.length) return '';
  const week = pgWeekDays(), pct = pgWeekPercent(list);
  let checkins = 0, best = 0;
  list.forEach(t => { week.forEach(d => { if (pgEntryComplete(t, d)) checkins++; }); best = Math.max(best, pgTrackerStats(t).current); });
  return `<section class="pg-summary pg-summary--four" aria-label="Your habits at a glance">${pgStatHTML(pct, 'Weekly completion', '%')}${pgStatHTML(checkins, 'Check‑ins this week')}${pgStatHTML(best, 'Longest current streak', best === 1 ? 'day' : 'days')}${pgStatHTML(list.reduce((n, t) => n + pgTrackerStats(t).total, 0), 'Total check‑ins')}</section>`;
}
function pgHobbySummaryHTML() {
  const list = pgHobbyList();
  if (!list.length) return '';
  const week = pgWeekDays();
  const timed = list.filter(pgIsMinutes);
  const weekMin = timed.reduce((n, t) => n + pgSumIn(t, week), 0);
  const totalMin = timed.reduce((n, t) => n + pgSumIn(t, pgCompleteDates(t)), 0);
  let sessions = 0;
  list.forEach(t => week.forEach(d => { if (pgEntryComplete(t, d)) sessions++; }));
  return `<section class="pg-summary pg-summary--four" aria-label="Your hobbies at a glance">${timed.length ? pgStatHTML(pgFormatMinutes(weekMin), 'Time this week') : pgStatHTML(null, 'Time this week', '', 'No timed hobbies')}${pgStatHTML(sessions, 'Sessions this week')}${timed.length ? pgStatHTML(pgFormatMinutes(totalMin), 'Total time') : pgStatHTML(null, 'Total time', '', 'No timed hobbies')}${pgStatHTML(list.length, list.length === 1 ? 'Hobby' : 'Hobbies')}</section>`;
}
/* pgPatchRow (v0.02.34) asks for the summary of whichever page is showing. */
function pgScopedSummaryHTML() {
  if (pgView === 'habits') return pgHabitSummaryHTML();
  if (pgView === 'hobbies') return pgHobbySummaryHTML();
  return pgSummaryMarkup(pgSummaryModel(ensurePersonalGrowth().trackers));
}

/* ------------------------------------------------------------------ */
/* Habits page                                                         */
/* ------------------------------------------------------------------ */
function pgHabitsEmptyHTML(filtered) {
  return `<div class="pg-empty">${pgMedallionHTML({ glyph: '◈' })}<h3 class="pg-empty__title">${filtered ? 'No habits match this filter' : 'Build your first habit'}</h3><p class="pg-empty__text">${filtered ? 'Choose another category or turn off Favorites.' : 'A habit is something you want to do again and again: a routine, a bit of self care, a daily practice. Add one and log it day by day.'}</p><button type="button" class="pg-btn pg-btn--primary" id="${filtered ? 'pgHabitClear' : 'pgHabitEmptyAdd'}">${filtered ? 'Show all habits' : 'Add your first habit'}</button></div>`;
}
function pgRenderHabits() {
  const pg = ensurePersonalGrowth(), all = pgHabitList();
  const focusSel = pgFocusSelector(document.activeElement);
  const usedCats = pgHabitCategoryKeys().filter(k => all.some(t => t.category === k));
  if (pgHabitFilter !== 'all' && !usedCats.includes(pgHabitFilter)) pgHabitFilter = 'all';
  const shown = all.filter(t => (pgHabitFilter === 'all' || t.category === pgHabitFilter) && (!pg.favoritesOnly || t.favorite));
  const chips = [
    pgChipHTML({ label: 'All', glyph: '✧', pressed: pgHabitFilter === 'all' && !pg.favoritesOnly, attrs: 'data-pg-hfilter="all"' }),
    ...usedCats.map(k => pgChipHTML({ label: PERSONAL_GROWTH_CATEGORIES[k].label, glyph: PERSONAL_GROWTH_CATEGORIES[k].icon, catKey: k, pressed: pgHabitFilter === k && !pg.favoritesOnly, attrs: `data-pg-hfilter="${k}"` })),
    pgChipHTML({ label: 'Favorites', glyph: '★', pressed: pg.favoritesOnly, attrs: 'id="pgHabitFavorites"' })
  ].join('');
  /* Grouped by category when the whole list is showing and more than one category is in use. */
  const groupBy = pgHabitFilter === 'all' && !pg.favoritesOnly && usedCats.length > 1;
  const body = !shown.length ? pgHabitsEmptyHTML(all.length > 0)
    : groupBy ? usedCats.map(k => {
      const rows = shown.filter(t => t.category === k);
      if (!rows.length) return '';
      const c = PERSONAL_GROWTH_CATEGORIES[k];
      return `<section class="pg-group-block pg-cat-${k}" aria-labelledby="pgHG-${k}"><h3 class="pg-group-block__title" id="pgHG-${k}">${pgMedallionHTML({ glyph: c.icon, size: 'sm' })}<span>${esc(c.label)}</span><span class="pg-meta">${rows.length}</span></h3><ul class="pg-rows">${rows.map(t => pgRowMarkup(pgRowModel(t))).join('')}</ul></section>`;
    }).join('')
      : `<ul class="pg-rows">${shown.map(t => pgRowMarkup(pgRowModel(t))).join('')}</ul>`;
  view.innerHTML = `<div class="pg-theme pg-page pg-accent-green"><div class="pg-page__inner">
    ${pgBackMarkup()}
    ${pgHeroMarkup({ title: 'Habits', sub: 'Build consistency, one day at a time', iconSrc: asset(PG_SOON.habits.art), glyph: '◈', compact: true, scene: 'habits' })}
    ${pgHabitSummaryHTML()}
    <section class="pg-shell pg-trackers" aria-labelledby="pgHabitsTitle">
      <div class="pg-trackers__head"><div><h2 class="pg-section__title" id="pgHabitsTitle" tabindex="-1">Your habits</h2><p class="pg-meta pg-trackers__count">${all.length ? `${shown.length} of ${all.length} shown` : 'Nothing here yet'}</p></div>${all.length ? '<button type="button" class="pg-btn pg-btn--primary pg-btn--compact" id="pgHabitAdd"><span aria-hidden="true">+</span> Add habit</button>' : ''}</div>
      ${all.length ? `<div class="pg-filters" role="group" aria-label="Filter habits by category">${chips}</div>` : ''}
      <div class="pg-listwrap" id="pgHabitList">${body}</div>
    </section>
  </div></div>`;
  pgBindNav();
  const opts = { scope: pgHabitCategoryKeys(), noun: 'habit' };
  document.querySelectorAll('[data-pg-hfilter]').forEach(b => b.onclick = () => { pgHabitFilter = b.dataset.pgHfilter; pg.favoritesOnly = false; save(); renderPersonalGrowth(); });
  const ff = document.querySelector('#pgHabitFavorites'); if (ff) ff.onclick = () => { pg.favoritesOnly = !pg.favoritesOnly; save(); renderPersonalGrowth(); };
  const list = document.querySelector('#pgHabitList'); if (list) list.onclick = pgRowsClick;
  ['#pgHabitAdd', '#pgHabitEmptyAdd'].forEach(sel => { const b = document.querySelector(sel); if (b) b.onclick = () => pgAddTrackerModal(opts); });
  const clr = document.querySelector('#pgHabitClear'); if (clr) clr.onclick = () => { pgHabitFilter = 'all'; pg.favoritesOnly = false; save(); renderPersonalGrowth(); };
  if (focusSel) { const el = view.querySelector(focusSel); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}

/* ------------------------------------------------------------------ */
/* Hobbies page                                                        */
/* ------------------------------------------------------------------ */
function pgRenderHobbies() {
  const list = pgHobbyList();
  const focusSel = pgFocusSelector(document.activeElement);
  const body = list.length
    ? `<ul class="pg-rows">${list.map(t => pgRowMarkup(pgRowModel(t))).join('')}</ul>`
    : `<div class="pg-empty">${pgMedallionHTML({ glyph: '✣' })}<h3 class="pg-empty__title">Make time for what you love</h3><p class="pg-empty__text">Gaming, painting, gardening, music, photography: add a hobby and log the time you spend on it.</p><button type="button" class="pg-btn pg-btn--primary" id="pgHobbyEmptyAdd">Add your first hobby</button></div>`;
  view.innerHTML = `<div class="pg-theme pg-page pg-accent-pink"><div class="pg-page__inner">
    ${pgBackMarkup()}
    ${pgHeroMarkup({ title: 'Hobbies', sub: 'Time for what you love', iconSrc: asset(PG_SOON.hobbies.art), glyph: '✣', compact: true })}
    ${pgHobbySummaryHTML()}
    <section class="pg-shell pg-trackers" aria-labelledby="pgHobbiesTitle">
      <div class="pg-trackers__head"><div><h2 class="pg-section__title" id="pgHobbiesTitle" tabindex="-1">Your hobbies</h2><p class="pg-meta pg-trackers__count">${list.length ? `${list.length} active` : 'Nothing here yet'}</p></div>${list.length ? '<button type="button" class="pg-btn pg-btn--primary pg-btn--compact" id="pgHobbyAdd"><span aria-hidden="true">+</span> Add hobby</button>' : ''}</div>
      <div class="pg-listwrap" id="pgHobbyList">${body}</div>
    </section>
  </div></div>`;
  pgBindNav();
  const opts = { scope: [PG_HOBBY_CATEGORY], noun: 'hobby' };
  const l = document.querySelector('#pgHobbyList'); if (l) l.onclick = pgRowsClick;
  ['#pgHobbyAdd', '#pgHobbyEmptyAdd'].forEach(sel => { const b = document.querySelector(sel); if (b) b.onclick = () => pgAddTrackerModal(opts); });
  if (focusSel) { const el = view.querySelector(focusSel); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}

/* ------------------------------------------------------------------ */
/* Detail page                                                         */
/* ------------------------------------------------------------------ */
function pgTrackerById(id) { return ensurePersonalGrowth().trackers.find(x => String(x.id) === String(id)) || null; }

function pgOpenDetail(id, from) {
  const t = pgTrackerById(id);
  if (!t) return;
  pgDetailId = String(t.id);
  pgDetailFrom = PG_DETAIL_NAMES[from] ? from : 'trackers';
  pgDetailTab = 'overview';
  pgDetailMonth = null;
  pgView = 'detail';
  renderPersonalGrowth();
  window.scrollTo(0, 0);
  const h = document.querySelector('.pg-hero__title'); if (h) h.focus({ preventScroll: true });
}

/* The last four weeks as a grid of small cells: done / goal met / nothing / not scheduled. */
function pgHeatHTML(t) {
  const today = todayISO(), cells = [];
  let done = 0, sched = 0;
  for (let i = 27; i >= 0; i--) {
    const d = addDays(today, -i), s = pgScheduledOn(t, d), c = pgEntryComplete(t, d);
    if (s) sched++;
    if (c) done++;
    const goalMet = c && t.method !== 'completion' && Number(t.goal) > 0 && Number(t.entries[d]) >= Number(t.goal);
    cells.push(`<i class="pg-heat__cell${c ? ' is-done' : ''}${goalMet ? ' is-goal' : ''}${s ? '' : ' is-off'}" title="${esc(pgShortDate(d))}"></i>`);
  }
  return `<div class="pg-heat" role="img" aria-label="Last 28 days: logged on ${done} of ${sched} scheduled days">${cells.join('')}</div>`;
}

function pgDetailOverviewHTML(t, m) {
  const st = m.stats, extra = pgValueStats(t);
  const tiles = [pgStatHTML(st.current, 'Current streak', st.current === 1 ? 'day' : 'days'), pgStatHTML(st.best, 'Best streak', st.best === 1 ? 'day' : 'days'), pgStatHTML(st.total, 'Check‑ins')]
    .concat(extra.map(([label, value, note]) => pgStatHTML(value, label, '', note))).join('');
  const goal = Number(t.goal) || 0;
  const goalLine = t.method === 'completion' ? 'Goal: mark it done' : (goal ? `Goal: ${goal}${t.unit ? ` ${t.unit}` : ''} each time` : 'No target');
  const freq = t.frequency === 'selected' ? `Scheduled ${(t.scheduledDays || []).map(i => PG_DAY_NAMES[i].slice(0, 3)).join(', ') || 'no days'}` : (t.frequency === 'daily' ? 'Every day' : (PG_FREQUENCY_OPTIONS.find(o => o[0] === t.frequency) || ['', 'No schedule'])[1]);
  return `<section class="pg-shell pg-detail__block" aria-labelledby="pgDOv"><h2 class="pg-section__title" id="pgDOv">At a glance</h2><div class="pg-detail-stats">${tiles}</div><p class="pg-meta">${esc(goalLine)} · ${esc(freq)}${t.createdAt ? ` · started ${esc(pgShortDate(t.createdAt))}` : ''}</p></section>
    <section class="pg-shell pg-detail__block" aria-labelledby="pgDWk"><h2 class="pg-section__title" id="pgDWk">This week</h2>${pgWeekStripHTML(m)}<div class="pg-detail__actions"><button type="button" class="pg-btn pg-btn--primary" data-pg-log-today="${esc(t.id)}">${t.method === 'completion' ? (pgEntryComplete(t, todayISO()) ? 'Undo today' : 'Mark today done') : 'Log today'}</button></div></section>
    <section class="pg-shell pg-detail__block" aria-labelledby="pgDHeat"><h2 class="pg-section__title" id="pgDHeat">Last 28 days</h2>${pgHeatHTML(t)}<p class="pg-meta pg-heat__legend"><span class="pg-heat__key is-done"></span> logged <span class="pg-heat__key is-goal"></span> goal met <span class="pg-heat__key is-off"></span> not scheduled</p></section>`;
}

/* Month calendar with one button per day. */
function pgMonthModel(t, ym) {
  const [Y, M] = ym.split('-').map(Number), first = new Date(Y, M - 1, 1), daysIn = new Date(Y, M, 0).getDate();
  const lead = (first.getDay() + 6) % 7, today = todayISO(), cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= daysIn; day++) {
    const iso = `${ym}-${String(day).padStart(2, '0')}`;
    cells.push({ iso, day, future: iso > today, done: pgEntryComplete(t, iso), sched: pgScheduledOn(t, iso), value: t.entries ? t.entries[iso] : undefined, today: iso === today });
  }
  return { label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), cells };
}
function pgDetailHistoryHTML(t) {
  const nowYM = todayISO().slice(0, 7), ym = pgDetailMonth || nowYM;
  const mm = pgMonthModel(t, ym);
  const prevYM = (() => { const [Y, M] = ym.split('-').map(Number); const d = new Date(Y, M - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const nextYM = (() => { const [Y, M] = ym.split('-').map(Number); const d = new Date(Y, M, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const grid = mm.cells.map(c => {
    if (!c) return '<span class="pg-cal__blank" aria-hidden="true"></span>';
    const val = c.done && t.method !== 'completion' ? `<span class="pg-cal__val">${esc(pgIsMinutes(t) ? String(Math.round(Number(c.value))) : String(c.value))}</span>` : '';
    const label = `${pgLongDate(c.iso)}: ${c.done ? `logged${t.method === 'completion' ? '' : ` ${pgFormatValue(t, c.value)}`}` : 'not logged'}${c.today ? ' (today)' : ''}`;
    return `<button type="button" class="pg-cal__day${c.done ? ' is-done' : ''}${c.today ? ' is-today' : ''}${c.sched ? '' : ' is-off'}" data-pg-orb="${esc(t.id)}" data-date="${c.iso}"${c.future ? ' disabled' : ''} aria-label="${esc(label)}"><span class="pg-cal__num">${c.day}</span>${val}</button>`;
  }).join('');
  const recent = pgCompleteDates(t).slice(-14).reverse();
  const list = recent.length ? `<ul class="pg-entries">${recent.map(d => `<li><span class="pg-entries__date">${esc(pgShortDate(d))}</span><span class="pg-entries__val pg-num">${esc(pgFormatValue(t, t.entries[d]))}</span><button type="button" class="pg-btn pg-btn--secondary pg-btn--compact" data-pg-orb="${esc(t.id)}" data-date="${d}" aria-label="${t.method === 'completion' ? 'Undo' : 'Edit'} ${esc(pgLongDate(d))}">${t.method === 'completion' ? 'Undo' : 'Edit'}</button></li>`).join('')}</ul>` : '<p class="pg-meta">Nothing logged yet. Tap a day above to log it.</p>';
  return `<section class="pg-shell pg-detail__block" aria-labelledby="pgDCal"><div class="pg-cal__head"><button type="button" class="pg-btn pg-btn--secondary pg-btn--compact" data-pg-month="${prevYM}" aria-label="Previous month">‹</button><h2 class="pg-section__title" id="pgDCal" aria-live="polite">${esc(mm.label)}</h2><button type="button" class="pg-btn pg-btn--secondary pg-btn--compact" data-pg-month="${nextYM}" ${ym >= nowYM ? 'disabled' : ''} aria-label="Next month">›</button></div>
    <div class="pg-cal" role="group" aria-label="${esc(mm.label)}"><span class="pg-cal__dow" aria-hidden="true">M</span><span class="pg-cal__dow" aria-hidden="true">T</span><span class="pg-cal__dow" aria-hidden="true">W</span><span class="pg-cal__dow" aria-hidden="true">T</span><span class="pg-cal__dow" aria-hidden="true">F</span><span class="pg-cal__dow" aria-hidden="true">S</span><span class="pg-cal__dow" aria-hidden="true">S</span>${grid}</div><p class="pg-meta">Tap a day to ${t.method === 'completion' ? 'mark it done or undo it' : 'log or change its value'}.</p></section>
    <section class="pg-shell pg-detail__block" aria-labelledby="pgDRec"><h2 class="pg-section__title" id="pgDRec">Recent entries</h2>${list}</section>`;
}

/* ---- notes ---- */
function pgNotesOf(t) { return Array.isArray(t.notes) ? t.notes : []; }
function pgTextareaFieldHTML({ id, label, value = '', placeholder = '', help = '', attrs = '' }) {
  return `<div class="pg-field"><label class="pg-field__label" for="${id}">${esc(label)}</label><textarea class="pg-input pg-textarea" id="${id}" rows="4" placeholder="${esc(placeholder)}" aria-describedby="${help ? `${id}Help ` : ''}${id}Error" ${attrs}>${esc(value)}</textarea>${help ? `<p class="pg-field__help" id="${id}Help">${esc(help)}</p>` : ''}<p class="pg-field__error" id="${id}Error" role="alert" hidden></p></div>`;
}
function pgNoteWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
function pgDetailNotesHTML(t) {
  const notes = pgNotesOf(t).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const list = notes.length ? `<ul class="pg-notes">${notes.map(n => `<li class="pg-note"><p class="pg-note__text">${esc(n.text)}</p><div class="pg-note__foot"><span class="pg-meta">${esc(pgNoteWhen(n.at))}</span><button type="button" class="pg-btn pg-btn--secondary pg-btn--compact" data-pg-note-delete="${esc(n.id)}" aria-label="Delete this note">Delete</button></div></li>`).join('')}</ul>` : '<p class="pg-meta">No notes yet. Jot down how it is going, what worked, or what to try next.</p>';
  return `<section class="pg-shell pg-detail__block" aria-labelledby="pgDNoteT"><h2 class="pg-section__title" id="pgDNoteT">Add a note</h2><form id="pgNoteForm" novalidate>${pgTextareaFieldHTML({ id: 'pgNoteText', label: 'Note', placeholder: 'What do you want to remember?', help: `Up to ${PG_NOTE_MAX} characters. Notes stay on this device.`, attrs: `maxlength="${PG_NOTE_MAX}"` })}<button type="submit" class="pg-btn pg-btn--primary">Save note</button></form></section>
    <section class="pg-shell pg-detail__block" aria-labelledby="pgDNoteL"><h2 class="pg-section__title" id="pgDNoteL">Your notes</h2>${list}</section>`;
}

/* ---- settings ---- */
function pgDetailSettingsHTML(t) {
  const cats = Object.entries(PERSONAL_GROWTH_CATEGORIES).map(([k, c]) => [k, c.label]);
  const days = PG_DAY_LETTERS.split('').map((d, i) => `<label class="pg-daychip"><input type="checkbox" data-pg-sday="${i}" ${(t.scheduledDays || []).includes(i) ? 'checked' : ''}><span aria-hidden="true">${d}</span><span class="pg-sr">${PG_DAY_NAMES[i]}</span></label>`).join('');
  const methodLabel = (PG_METHOD_OPTIONS.find(o => o[0] === t.method) || ['', t.method])[1];
  const numeric = t.method !== 'completion';
  return `<form id="pgSettingsForm" class="pg-detail__block" novalidate>
    <section class="pg-shell pg-detail__block"><h2 class="pg-section__title">Details</h2>
      ${pgInputFieldHTML({ id: 'pgSName', label: 'Name', value: t.name, help: 'Required. Up to 60 characters.', attrs: 'maxlength="60" autocomplete="off" required aria-required="true"' })}
      ${pgSelectFieldHTML({ id: 'pgSCategory', label: 'Category', options: cats, value: t.category, help: 'Filed under Hobbies it appears on the Hobbies page; any other category puts it on Habits.' })}
      <p class="pg-meta">Tracking method: <b>${esc(methodLabel)}</b>. It cannot be changed after creation because that would reinterpret everything you have logged.</p>
      ${numeric ? `<div class="pg-form__row">${pgInputFieldHTML({ id: 'pgSGoal', label: 'Goal', type: 'number', value: t.goal || 0, help: 'Target for each check-in. 0 for no target.', attrs: 'min="0" step="any" inputmode="decimal"' })}${pgInputFieldHTML({ id: 'pgSUnit', label: 'Unit', value: t.unit || '', optional: true, attrs: 'maxlength="16" autocomplete="off"' })}</div>` : ''}
    </section>
    <section class="pg-shell pg-detail__block"><h2 class="pg-section__title">Schedule</h2>
      ${pgSelectFieldHTML({ id: 'pgSFreq', label: 'Frequency', options: PG_FREQUENCY_OPTIONS, value: t.frequency, help: 'The days below are used when Frequency is Selected days.' })}
      <fieldset class="pg-daychips"><legend>Scheduled days</legend>${days}</fieldset>
      <p class="pg-field__error" id="pgSDaysError" role="alert" hidden></p>
      <label class="sc-check"><input type="checkbox" id="pgSFav" ${t.favorite ? 'checked' : ''}> <span>Favorite</span></label>
    </section>
    <div class="pg-detail__actions"><button type="submit" class="pg-btn pg-btn--primary">Save changes</button></div>
    <section class="pg-shell pg-detail__block pg-detail__danger"><h2 class="pg-section__title">Delete this ${pgNoun(t)}</h2><p class="pg-meta">Removes it and everything you logged for it. This cannot be undone.</p><button type="button" class="pg-btn pg-btn--danger" data-pg-delete-tracker="${esc(t.id)}">Delete ${esc(t.name)}</button></section>
  </form>`;
}

function pgRenderDetail() {
  const pg = ensurePersonalGrowth(), t = pgTrackerById(pgDetailId);
  if (!t) {                                    /* deleted (or a stale id): go back where we came from */
    pgView = PG_DETAIL_NAMES[pgDetailFrom] && pgDetailFrom !== 'hub' ? pgDetailFrom : 'trackers';
    pgDetailId = null;
    return renderPersonalGrowth();
  }
  const cur = view.querySelector('.pg-detail .pg-tab[aria-selected="true"]');
  if (cur) pgDetailTab = cur.id.replace('pgTab-', '');
  const m = pgRowModel(t), catKey = m.catKey, cat = PERSONAL_GROWTH_CATEGORIES[catKey];
  const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'history', label: 'History' }, { id: 'notes', label: `Notes${pgNotesOf(t).length ? ` (${pgNotesOf(t).length})` : ''}` }, { id: 'settings', label: 'Settings' }];
  if (!tabs.some(x => x.id === pgDetailTab)) pgDetailTab = 'overview';
  view.innerHTML = `<div class="pg-theme pg-page pg-cat-${catKey}"><div class="pg-page__inner pg-detail">
    ${pgBackMarkup(PG_DETAIL_NAMES[pgDetailFrom] || 'Trackers', pgDetailFrom)}
    ${pgHeroMarkup({ title: t.name, sub: `${cat.label} · ${pgIsHobby(t) ? 'Hobby' : 'Habit'}`, iconSrc: m.art ? asset(m.art) : '', glyph: m.glyph, compact: true })}
    ${pgTabsHTML(tabs, pgDetailTab, { overview: pgDetailOverviewHTML(t, m), history: pgDetailHistoryHTML(t), notes: pgDetailNotesHTML(t), settings: pgDetailSettingsHTML(t) }, `${t.name} sections`)}
  </div></div>`;
  pgBindNav();
  const root = view.querySelector('.pg-tabs-wrap');
  pgBindTabs(root);
  root.querySelectorAll('[role="tab"]').forEach(x => x.addEventListener('click', () => { pgDetailTab = x.id.replace('pgTab-', ''); }));
  pgBindDetail(root, t);
}

function pgBindDetail(root, t) {
  root.addEventListener('click', e => {
    const orb = e.target.closest('[data-pg-orb]');
    if (orb) { if (!orb.disabled) pgLogTracker(orb.dataset.pgOrb, orb.dataset.date); return; }
    const lt = e.target.closest('[data-pg-log-today]');
    if (lt) { pgLogTracker(lt.dataset.pgLogToday, todayISO()); return; }
    const mo = e.target.closest('[data-pg-month]');
    if (mo && !mo.disabled) { pgDetailMonth = mo.dataset.pgMonth; renderPersonalGrowth(); return; }
    const dt = e.target.closest('[data-pg-delete-tracker]');
    if (dt) pgConfirmDelete(dt.dataset.pgDeleteTracker);
  });
  pgBindNotes(root, t);
  const sf = root.querySelector('#pgSettingsForm');
  if (sf) sf.onsubmit = e => { e.preventDefault(); pgSaveSettings(sf, t); };
}
/* Notes work the same on any record that carries `notes: [{id, at, text}]` (a tracker, a book). */
function pgBindNotes(root, holder) {
  root.addEventListener('click', e => {
    const nd = e.target.closest('[data-pg-note-delete]');
    if (!nd) return;
    holder.notes = pgNotesOf(holder).filter(n => String(n.id) !== nd.dataset.pgNoteDelete);
    save(); renderPersonalGrowth(); pgAnnounce('Note deleted');
  });
  const nf = root.querySelector('#pgNoteForm');
  if (!nf) return;
  const ta = nf.querySelector('#pgNoteText');
  ta.addEventListener('input', () => pgInlineError('pgNoteText', ''));
  nf.onsubmit = e => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text) { pgInlineError('pgNoteText', 'Write something first.'); ta.focus(); return; }
    holder.notes = pgNotesOf(holder).concat([{ id: uid(), at: new Date().toISOString(), text: text.slice(0, PG_NOTE_MAX) }]);
    save(); renderPersonalGrowth(); pgAnnounce('Note saved');
  };
}
/* A small generic confirm dialog (alertdialog, Cancel focused first) for deletions that are not trackers. */
function pgConfirmAction({ title, text, confirmLabel, accentClass = 'pg-accent-green', glyph = '!', onConfirm }) {
  pgModal({
    title, sub: 'This cannot be undone', accentClass, glyph, size: 'sm', role: 'alertdialog', describedBy: 'pgConfText',
    body: `<p class="pg-dialog__text" id="pgConfText">${esc(text)}</p>`,
    actions: `<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button><button type="button" class="pg-btn pg-btn--danger pg-btn--solid" id="pgConfYes">${esc(confirmLabel)}</button>`,
    focus: '.pg-dialog__foot [data-pg-close]'
  });
  let done = false;
  modalRoot.querySelector('#pgConfYes').onclick = () => { if (done) return; done = true; closeModal(); onConfirm(); };
}
/* pgFieldError looks inside #modalRoot; the detail page's own fields need the same behaviour in the page. */
function pgInlineError(id, msg) {
  const input = document.getElementById(id), err = document.getElementById(id + 'Error');
  if (!input || !err) return;
  err.textContent = msg; err.hidden = !msg;
  if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
}
function pgSaveSettings(form, t) {
  ['pgSName', 'pgSGoal'].forEach(id => pgInlineError(id, ''));
  const daysErr = form.querySelector('#pgSDaysError'); if (daysErr) daysErr.hidden = true;
  const name = form.querySelector('#pgSName').value.trim();
  if (!name) { pgInlineError('pgSName', 'Give it a name.'); form.querySelector('#pgSName').focus(); return; }
  let goal = t.goal;
  const goalEl = form.querySelector('#pgSGoal');
  if (goalEl) {
    goal = Number(goalEl.value === '' ? 0 : goalEl.value);
    if (!Number.isFinite(goal) || goal < 0) { pgInlineError('pgSGoal', 'Enter a number, 0 or more.'); goalEl.focus(); return; }
  }
  const freq = form.querySelector('#pgSFreq').value;
  const days = [...form.querySelectorAll('[data-pg-sday]:checked')].map(x => Number(x.dataset.pgSday));
  if (freq === 'selected' && !days.length) {
    if (daysErr) { daysErr.textContent = 'Choose at least one day, or pick another frequency.'; daysErr.hidden = false; }
    return;
  }
  const wasHobby = pgIsHobby(t);
  t.name = name.slice(0, 60);
  t.category = PERSONAL_GROWTH_CATEGORIES[form.querySelector('#pgSCategory').value] ? form.querySelector('#pgSCategory').value : t.category;
  if (goalEl) { t.goal = goal; t.unit = form.querySelector('#pgSUnit').value.trim(); }
  t.frequency = freq;
  t.scheduledDays = days.length ? days : [0, 1, 2, 3, 4, 5, 6];
  t.favorite = form.querySelector('#pgSFav').checked;
  save();
  if (pgIsHobby(t) !== wasHobby && (pgDetailFrom === 'habits' || pgDetailFrom === 'hobbies')) pgDetailFrom = pgIsHobby(t) ? 'hobbies' : 'habits';
  pgDetailTab = 'settings';
  renderPersonalGrowth();
  toast(`${t.name} saved.`);
  pgAnnounce(`${t.name} saved`);
}

/* ------------------------------------------------------------------ */
/* Hub sources: the Habits and Hobbies cards, the Habits Completed stat */
/* and note activity. The Hub itself is unchanged (v0.02.34 comment).   */
/* ------------------------------------------------------------------ */
PG_HUB_SOURCES.push({
  id: 'habits',
  summary() { return { habitsCompleted: pgHabitList().reduce((n, t) => n + pgTrackerStats(t).total, 0) }; },
  card() {
    const list = pgHabitList(), today = todayISO();
    const scheduled = list.filter(t => pgScheduledOn(t, today)), done = scheduled.filter(t => pgEntryComplete(t, today)).length;
    return { status: list.length ? `${list.length} active` : 'None yet', detail: scheduled.length ? `${done} of ${scheduled.length} done today` : '', badge: '' };
  }
}, {
  id: 'hobbies',
  card() {
    const list = pgHobbyList(), week = pgWeekDays();
    const min = list.filter(pgIsMinutes).reduce((n, t) => n + pgSumIn(t, week), 0);
    return { status: list.length ? `${list.length} active` : 'None yet', detail: min ? `${pgFormatMinutes(min)} this week` : '', badge: '' };
  }
}, {
  id: 'pgnotes',
  activity() {
    const out = [];
    ensurePersonalGrowth().trackers.forEach(t => pgNotesOf(t).forEach(n => {
      const at = String(n.at || '');
      if (!at) return;
      out.push({ id: `note:${t.id}:${n.id}`, sourceType: 'note', sourceId: t.id, action: 'Note added', title: t.name, summary: String(n.text).length > 48 ? `${String(n.text).slice(0, 47)}…` : String(n.text), date: localISO(new Date(at)), at, order: Number(t.id) || 0, route: 'trackers', glyph: '✎', open: `detail:${t.id}` });
    }));
    return out;
  }
});
