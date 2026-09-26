/* Personal Growth: Reading Nook, Book and Audiobook detail (RPG-0049, 0050, 0051).
   Astra, 2026-09-25. Loads after v0.02.52 (it reuses its notes, confirm and stat helpers).

   Books and audiobooks belong in Personal Growth, not the Library (Library V1 defers reading here).
   New, additive data, created lazily so older saves are untouched:

     state.reading = { version: 1, items: [ Item ] }
     Item = { id, kind: 'book' | 'audiobook', title, author,
              status: 'reading' | 'paused' | 'wishlist' | 'finished',
              totalPages | totalMinutes (0 = unknown), sessions: [ { id, date, amount, minutes } ],
              notes: [ { id, at, text } ], rating (0 = none, 1..5),
              addedAt, startedAt, finishedAt }

   `amount` is pages read (book) or minutes listened (audiobook); progress is the SUM of a book's
   sessions, so deleting a mistaken session corrects it. Nothing here grants XP, stats or Gold and
   nothing is wired to achievements: the old Reading / Mindfulness writers were retired in
   Self Care & Habits V1 and reading has no progression rules yet. Audible / Goodreads import is
   separate (RPG-0069). Styles: styles/personal-growth/03-pg-detail.css. */

const RD_STATUS = [['reading', 'Reading'], ['paused', 'Paused'], ['wishlist', 'Want to read'], ['finished', 'Finished']];
let rdShelf = 'finished', rdTab = 'overview';

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
function ensureReading() {
  state.reading = state.reading && typeof state.reading === 'object' ? state.reading : {};
  state.reading.version = 1;
  state.reading.items = Array.isArray(state.reading.items) ? state.reading.items : [];
  return state.reading;
}
function rdItems() { return ensureReading().items; }
function rdById(id) { return rdItems().find(x => String(x.id) === String(id)) || null; }
const rdIsAudio = it => it.kind === 'audiobook';
const rdUnit = it => rdIsAudio(it) ? 'min' : 'pages';
const rdTotal = it => Number(rdIsAudio(it) ? it.totalMinutes : it.totalPages) || 0;
function rdSessions(it) { return Array.isArray(it.sessions) ? it.sessions : []; }
function rdRawProgress(it) { return rdSessions(it).reduce((n, s) => n + (Number(s.amount) || 0), 0); }
function rdProgress(it) {
  const total = rdTotal(it), raw = rdRawProgress(it);
  if (it.status === 'finished' && total > 0 && raw < total) return total;   /* finished without logging: full */
  return total > 0 ? Math.min(raw, total) : raw;
}
function rdPercent(it) { const t = rdTotal(it); return t > 0 ? Math.round((rdProgress(it) / t) * 100) : null; }
/* minutes spent: audiobook minutes listened, plus any minutes noted on a book session */
function rdSessionMinutes(s, it) { return rdIsAudio(it) ? Number(s.amount) || 0 : Number(s.minutes) || 0; }
function rdFormatAmount(it, n) {
  n = Math.round(Number(n) || 0);
  return rdIsAudio(it) ? pgFormatMinutes(n) : `${n} ${n === 1 ? 'page' : 'pages'}`;
}
function rdCreate({ kind, title, author, total, status }) {
  const it = {
    id: uid(), kind: kind === 'audiobook' ? 'audiobook' : 'book', title: String(title).trim().slice(0, 120), author: String(author || '').trim().slice(0, 80),
    status: RD_STATUS.some(x => x[0] === status) ? status : 'reading', sessions: [], notes: [], rating: 0,
    addedAt: todayISO(), startedAt: status === 'wishlist' ? null : todayISO(), finishedAt: status === 'finished' ? todayISO() : null
  };
  if (it.kind === 'audiobook') it.totalMinutes = Math.max(0, Math.round(Number(total) || 0)); else it.totalPages = Math.max(0, Math.round(Number(total) || 0));
  ensureReading().items.push(it);
  save();
  return it;
}
/* One reading session. Returns { ok, finished } so the caller can say "Finished!". */
function rdLogSession(it, { amount, minutes, date }) {
  amount = Number(amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false };
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) && date <= todayISO() ? date : todayISO();
  it.sessions = rdSessions(it).concat([{ id: uid(), date: d, amount: Math.round(amount * 100) / 100, minutes: Math.max(0, Math.round(Number(minutes) || 0)) }]);
  if (it.status === 'wishlist' || it.status === 'paused') it.status = 'reading';
  if (!it.startedAt) it.startedAt = d;
  let finished = false;
  if (rdTotal(it) > 0 && rdRawProgress(it) >= rdTotal(it) && it.status !== 'finished') { it.status = 'finished'; it.finishedAt = d; finished = true; }
  save();
  return { ok: true, finished };
}
function rdSetStatus(it, status) {
  if (!RD_STATUS.some(x => x[0] === status) || it.status === status) return;
  const was = it.status;
  it.status = status;
  if (status === 'finished') it.finishedAt = it.finishedAt || todayISO();
  else if (was === 'finished') it.finishedAt = null;
  if (status === 'reading' && !it.startedAt) it.startedAt = todayISO();
  save();
}

/* ------------------------------------------------------------------ */
/* Stats (derived, nothing stored)                                     */
/* ------------------------------------------------------------------ */
function rdStats() {
  const items = rdItems(), week = pgWeekDays(), year = todayISO().slice(0, 4);
  let weekPages = 0, weekMin = 0, totalPages = 0, totalMin = 0;
  const days = new Set();
  items.forEach(it => rdSessions(it).forEach(s => {
    days.add(s.date);
    const min = rdSessionMinutes(s, it);
    totalMin += min;
    if (!rdIsAudio(it)) totalPages += Number(s.amount) || 0;
    if (week.includes(s.date)) { weekMin += min; if (!rdIsAudio(it)) weekPages += Number(s.amount) || 0; }
  }));
  let streak = 0;
  for (let d = todayISO(), i = 0; i < 366; i++, d = addDays(d, -1)) {
    if (days.has(d)) streak++; else if (i === 0) continue; else break;   /* today not logged yet does not break yesterday's streak */
  }
  return {
    finishedTotal: items.filter(x => x.status === 'finished').length,
    finishedThisYear: items.filter(x => x.status === 'finished' && String(x.finishedAt || '').startsWith(year)).length,
    reading: items.filter(x => x.status === 'reading').length,
    weekPages: Math.round(weekPages), weekMin: Math.round(weekMin), totalPages: Math.round(totalPages), totalMin: Math.round(totalMin), streak, readingDays: days.size
  };
}

/* ------------------------------------------------------------------ */
/* Markup                                                              */
/* ------------------------------------------------------------------ */
function rdProgressBarHTML(it) {
  const total = rdTotal(it), p = rdProgress(it), pct = rdPercent(it);
  if (!total) return `<p class="pg-meta">${esc(rdFormatAmount(it, p))} so far · length not set</p>`;
  return `${pgBarHTML(p, total, `Progress in ${it.title}`, `${p} of ${total} ${rdUnit(it)}`)}<p class="pg-meta">${esc(rdIsAudio(it) ? `${pgFormatMinutes(p)} of ${pgFormatMinutes(total)}` : `${p} of ${total} pages`)} · ${pct}%</p>`;
}
function rdCardHTML(it) {
  const act = it.status === 'reading'
    ? `<button type="button" class="pg-btn pg-btn--primary pg-btn--compact" data-rd-log="${esc(it.id)}">${rdIsAudio(it) ? 'Log listening' : 'Log reading'}</button>`
    : `<button type="button" class="pg-btn pg-btn--primary pg-btn--compact" data-rd-status="${esc(it.id)}:reading">${it.status === 'paused' ? 'Resume' : 'Start reading'}</button>`;
  return `<li class="pg-book" data-rd-id="${esc(it.id)}"><div class="pg-book__head"><div><h3 class="pg-book__title">${esc(it.title)}</h3>${it.author ? `<p class="pg-book__by">${esc(it.author)}</p>` : ''}</div><span class="pg-tag pg-book__kind">${rdIsAudio(it) ? 'Audiobook' : 'Book'}</span></div>${rdProgressBarHTML(it)}<div class="pg-book__actions">${act}<button type="button" class="pg-btn pg-btn--secondary pg-btn--compact" data-rd-open="${esc(it.id)}" aria-label="Open details for ${esc(it.title)}">Details</button></div></li>`;
}
function rdShelfRowHTML(it) {
  const meta = it.status === 'finished'
    ? [it.finishedAt ? `Finished ${pgShortDate(it.finishedAt)}` : 'Finished', it.rating ? `${'★'.repeat(it.rating)}` : ''].filter(Boolean).join(' · ')
    : [rdIsAudio(it) ? 'Audiobook' : 'Book', rdPercent(it) != null ? `${rdPercent(it)}%` : ''].filter(Boolean).join(' · ');
  return `<li><button type="button" class="pg-shelf__row" data-rd-open="${esc(it.id)}"><span class="pg-shelf__name">${esc(it.title)}</span><span aria-hidden="true">›</span><span class="pg-shelf__meta">${esc([it.author, meta].filter(Boolean).join(' · '))}</span></button></li>`;
}
function rdSummaryHTML() {
  const s = rdStats();
  return `<section class="pg-summary pg-summary--four" aria-label="Your reading at a glance">${pgStatHTML(s.finishedThisYear, 'Finished this year')}${pgStatHTML(s.weekPages, 'Pages this week')}${pgStatHTML(pgFormatMinutes(s.weekMin), 'Time this week')}${pgStatHTML(s.streak, 'Reading streak', s.streak === 1 ? 'day' : 'days')}</section>`;
}

function pgRenderReading() {
  const items = rdItems(), focusSel = pgFocusSelector(document.activeElement);
  const now = items.filter(x => x.status === 'reading');
  const shelfFilters = [['finished', 'Finished'], ['wishlist', 'Want to read'], ['paused', 'Paused']];
  const shelf = items.filter(x => x.status === rdShelf).sort((a, b) => String(b.finishedAt || b.addedAt).localeCompare(String(a.finishedAt || a.addedAt)));
  const nowHTML = now.length ? `<ul class="pg-books">${now.map(rdCardHTML).join('')}</ul>` : `<p class="pg-meta">${items.length ? 'Nothing in progress. Pick something from your shelf, or add a new book.' : 'Nothing yet.'}</p>`;
  const empty = !items.length;
  view.innerHTML = `<div class="pg-theme pg-page pg-accent-blue"><div class="pg-page__inner">
    ${pgBackMarkup()}
    ${pgHeroMarkup({ title: 'Reading Nook', sub: 'Books & audiobooks', iconSrc: asset(PG_SOON.reading.art), glyph: '▤', compact: true, scene: 'reading' })}
    ${empty ? '' : rdSummaryHTML()}
    ${empty ? `<section class="pg-shell pg-soon"><div class="pg-empty">${pgMedallionHTML({ glyph: '▤' })}<h2 class="pg-empty__title">Start your reading nook</h2><p class="pg-empty__text">Add the book you are reading or the audiobook on your commute, log a few pages or minutes each day, and watch it fill up.</p><button type="button" class="pg-btn pg-btn--primary" id="rdAdd">Add a book or audiobook</button></div></section>` : `
    <section class="pg-shell" aria-labelledby="rdNowT"><div class="pg-trackers__head"><div><h2 class="pg-section__title" id="rdNowT" tabindex="-1">Now reading</h2><p class="pg-meta pg-trackers__count">${now.length} in progress</p></div><button type="button" class="pg-btn pg-btn--primary pg-btn--compact" id="rdAdd"><span aria-hidden="true">+</span> Add</button></div>${nowHTML}</section>
    <section class="pg-shell" aria-labelledby="rdShelfT"><h2 class="pg-section__title" id="rdShelfT">Bookshelf</h2><div class="pg-filters" role="group" aria-label="Choose a shelf">${shelfFilters.map(([k, l]) => pgChipHTML({ label: `${l} (${items.filter(x => x.status === k).length})`, glyph: '▤', pressed: rdShelf === k, attrs: `data-rd-shelf="${k}"` })).join('')}</div>${shelf.length ? `<ul class="pg-shelf">${shelf.map(rdShelfRowHTML).join('')}</ul>` : '<p class="pg-meta">Nothing on this shelf yet.</p>'}</section>`}
  </div></div>`;
  pgBindNav();
  const add = document.querySelector('#rdAdd'); if (add) add.onclick = rdAddModal;
  document.querySelectorAll('[data-rd-shelf]').forEach(b => b.onclick = () => { rdShelf = b.dataset.rdShelf; renderPersonalGrowth(); });
  view.querySelector('.pg-page__inner').addEventListener('click', e => {
    const o = e.target.closest('[data-rd-open]'); if (o) { pgOpenReadingItem(o.dataset.rdOpen); return; }
    const l = e.target.closest('[data-rd-log]'); if (l) { rdLogModal(l.dataset.rdLog); return; }
    const st = e.target.closest('[data-rd-status]');
    if (st) { const [id, status] = st.dataset.rdStatus.split(':'), it = rdById(id); if (it) { rdSetStatus(it, status); renderPersonalGrowth(); pgAnnounce(`${it.title}: ${status}`); } }
  });
  if (focusSel) { const el = view.querySelector(focusSel); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */
function rdAddModal() {
  pgModal({
    title: 'Add to your Reading Nook', sub: 'A book you read, or an audiobook you listen to.', accentClass: 'pg-accent-blue', glyph: '▤', size: 'wide',
    body: `<div class="pg-form">
      ${pgSelectFieldHTML({ id: 'rdKind', label: 'Type', options: [['book', 'Book'], ['audiobook', 'Audiobook']] })}
      ${pgInputFieldHTML({ id: 'rdTitle', label: 'Title', placeholder: 'The title', help: 'Required. Up to 120 characters.', attrs: 'maxlength="120" autocomplete="off" required aria-required="true"' })}
      ${pgInputFieldHTML({ id: 'rdAuthor', label: 'Author', optional: true, attrs: 'maxlength="80" autocomplete="off"' })}
      <div class="pg-form__row" id="rdLenBook">${pgInputFieldHTML({ id: 'rdPages', label: 'Pages', type: 'number', optional: true, help: 'Lets the bar show progress.', attrs: 'min="0" step="1" inputmode="numeric"' })}</div>
      <div class="pg-form__row" id="rdLenAudio" hidden>${pgInputFieldHTML({ id: 'rdHours', label: 'Length: hours', type: 'number', optional: true, attrs: 'min="0" step="1" inputmode="numeric"' })}${pgInputFieldHTML({ id: 'rdMins', label: 'Minutes', type: 'number', optional: true, attrs: 'min="0" max="59" step="1" inputmode="numeric"' })}</div>
      ${pgSelectFieldHTML({ id: 'rdStatusSel', label: 'Where is it?', options: [['reading', 'Reading it now'], ['wishlist', 'Want to read'], ['finished', 'Already finished']] })}
    </div>`,
    actions: '<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button><button type="button" class="pg-btn pg-btn--primary" id="rdCreate">Add</button>',
    focus: '#rdTitle',
    isDirty: d => d.querySelector('#rdTitle').value.trim() !== ''
  });
  const kind = modalRoot.querySelector('#rdKind');
  const sync = () => { const a = kind.value === 'audiobook'; modalRoot.querySelector('#rdLenBook').hidden = a; modalRoot.querySelector('#rdLenAudio').hidden = !a; };
  kind.onchange = sync;
  const title = modalRoot.querySelector('#rdTitle');
  title.addEventListener('input', () => pgFieldError('rdTitle', ''));
  modalRoot.querySelector('#rdCreate').onclick = () => {
    const name = title.value.trim();
    if (!name) { pgFieldError('rdTitle', 'Give it a title.'); title.focus(); return; }
    const audio = kind.value === 'audiobook';
    const total = audio ? (Number(modalRoot.querySelector('#rdHours').value || 0) * 60 + Number(modalRoot.querySelector('#rdMins').value || 0)) : Number(modalRoot.querySelector('#rdPages').value || 0);
    const it = rdCreate({ kind: kind.value, title: name, author: modalRoot.querySelector('#rdAuthor').value, total, status: modalRoot.querySelector('#rdStatusSel').value });
    closeModal();
    if (it.status === 'reading') rdShelf = rdShelf;
    renderPersonalGrowth();
    toast(`${it.title} added.`);
    pgAnnounce(`${it.title} added`);
  };
}
function rdLogModal(id) {
  const it = rdById(id);
  if (!it) return;
  const audio = rdIsAudio(it), total = rdTotal(it), p = rdProgress(it);
  pgModal({
    title: audio ? 'Log listening' : 'Log reading', sub: it.title, accentClass: 'pg-accent-blue', glyph: '▤', size: 'sm',
    body: `<div class="pg-form">
      ${pgInputFieldHTML({ id: 'rdAmount', label: audio ? 'Minutes listened' : 'Pages read', type: 'number', help: total ? `${p} of ${total} ${rdUnit(it)} so far.` : 'Length not set, so no progress bar.', attrs: 'min="1" step="1" inputmode="numeric"' })}
      ${audio ? '' : pgInputFieldHTML({ id: 'rdMinutes', label: 'Minutes spent', type: 'number', optional: true, help: 'Optional. Feeds your reading time.', attrs: 'min="0" step="1" inputmode="numeric"' })}
      ${pgInputFieldHTML({ id: 'rdDate', label: 'Day', type: 'date', value: todayISO(), attrs: `max="${todayISO()}"` })}
    </div>`,
    actions: '<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button><button type="button" class="pg-btn pg-btn--primary" id="rdSave">Save</button>',
    focus: '#rdAmount'
  });
  const amt = modalRoot.querySelector('#rdAmount');
  amt.addEventListener('input', () => pgFieldError('rdAmount', ''));
  modalRoot.querySelector('#rdSave').onclick = () => {
    const v = Number(amt.value);
    if (!Number.isFinite(v) || v <= 0) { pgFieldError('rdAmount', `Enter ${audio ? 'the minutes' : 'the pages'} as a number above 0.`); amt.focus(); return; }
    const r = rdLogSession(it, { amount: v, minutes: audio ? 0 : modalRoot.querySelector('#rdMinutes').value, date: modalRoot.querySelector('#rdDate').value });
    if (!r.ok) return;
    closeModal();
    renderPersonalGrowth();
    toast(r.finished ? `Finished ${it.title}!` : `${rdFormatAmount(it, v)} logged.`);
    pgAnnounce(r.finished ? `${it.title} finished` : `${rdFormatAmount(it, v)} logged`);
  };
}

/* ------------------------------------------------------------------ */
/* Detail (Book Detail and Audiobook Detail: one page)                 */
/* ------------------------------------------------------------------ */
function pgOpenReadingItem(id) {
  const it = rdById(id);
  if (!it) return;
  pgReadingId = String(it.id);
  rdTab = 'overview';
  pgView = 'readingItem';
  renderPersonalGrowth();
  window.scrollTo(0, 0);
  const h = document.querySelector('.pg-hero__title'); if (h) h.focus({ preventScroll: true });
}
function rdOverviewHTML(it) {
  const s = rdSessions(it), mins = s.reduce((n, x) => n + rdSessionMinutes(x, it), 0);
  const days = new Set(s.map(x => x.date)).size;
  const primary = it.status === 'reading'
    ? `<button type="button" class="pg-btn pg-btn--primary" data-rd-log="${esc(it.id)}">${rdIsAudio(it) ? 'Log listening' : 'Log reading'}</button><button type="button" class="pg-btn pg-btn--secondary" data-rd-status="${esc(it.id)}:finished">Mark finished</button><button type="button" class="pg-btn pg-btn--secondary" data-rd-status="${esc(it.id)}:paused">Pause</button>`
    : it.status === 'finished'
      ? `<button type="button" class="pg-btn pg-btn--secondary" data-rd-status="${esc(it.id)}:reading">Read it again</button>`
      : `<button type="button" class="pg-btn pg-btn--primary" data-rd-status="${esc(it.id)}:reading">${it.status === 'paused' ? 'Resume' : 'Start reading'}</button>`;
  const pace = days && !rdIsAudio(it) && rdRawProgress(it) ? `${Math.round(rdRawProgress(it) / days)} pages / day` : (days && rdIsAudio(it) && rdRawProgress(it) ? `${pgFormatMinutes(rdRawProgress(it) / days)} / day` : null);
  const remaining = rdTotal(it) && it.status !== 'finished' && pace && rdRawProgress(it) ? Math.max(0, rdTotal(it) - rdProgress(it)) : null;
  const tiles = [
    pgStatHTML(rdPercent(it) == null ? null : rdPercent(it), 'Progress', rdPercent(it) == null ? '' : '%', rdPercent(it) == null ? 'Set the length to see it' : ''),
    pgStatHTML(s.length, s.length === 1 ? 'Session' : 'Sessions'),
    pgStatHTML(mins ? pgFormatMinutes(mins) : null, 'Time spent', '', mins ? '' : 'None logged'),
    pgStatHTML(pace, 'Pace', '', pace ? '' : 'Log a session')
  ].join('');
  return `<section class="pg-shell pg-detail__block" aria-labelledby="rdOvT"><h2 class="pg-section__title" id="rdOvT">Where you are</h2>${rdProgressBarHTML(it)}<div class="pg-detail-stats">${tiles}</div><p class="pg-meta">${[it.startedAt ? `Started ${pgShortDate(it.startedAt)}` : 'Not started', it.finishedAt ? `finished ${pgShortDate(it.finishedAt)}` : '', remaining != null ? `about ${remaining} ${rdUnit(it)} to go` : ''].filter(Boolean).join(' · ')}</p><div class="pg-detail__actions">${primary}</div></section>`;
}
function rdSessionsHTML(it) {
  const list = rdSessions(it).slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  return `<section class="pg-shell pg-detail__block" aria-labelledby="rdSeT"><h2 class="pg-section__title" id="rdSeT">Sessions</h2>${list.length ? `<ul class="pg-entries">${list.map(x => `<li><span class="pg-entries__date">${esc(pgShortDate(x.date))}</span><span class="pg-entries__val pg-num">${esc(rdFormatAmount(it, x.amount))}${!rdIsAudio(it) && x.minutes ? ` · ${esc(pgFormatMinutes(x.minutes))}` : ''}</span><button type="button" class="pg-btn pg-btn--secondary pg-btn--compact" data-rd-del-session="${esc(x.id)}" aria-label="Delete the ${esc(pgShortDate(x.date))} session">Delete</button></li>`).join('')}</ul>` : '<p class="pg-meta">No sessions yet. Log one from Overview.</p>'}</section>`;
}
function rdSettingsHTML(it) {
  const total = rdTotal(it);
  const lenFields = rdIsAudio(it)
    ? `<div class="pg-form__row">${pgInputFieldHTML({ id: 'rdSHours', label: 'Length: hours', type: 'number', value: Math.floor(total / 60) || '', optional: true, attrs: 'min="0" step="1" inputmode="numeric"' })}${pgInputFieldHTML({ id: 'rdSMins', label: 'Minutes', type: 'number', value: total ? total % 60 : '', optional: true, attrs: 'min="0" max="59" step="1" inputmode="numeric"' })}</div>`
    : pgInputFieldHTML({ id: 'rdSPages', label: 'Pages', type: 'number', value: total || '', optional: true, attrs: 'min="0" step="1" inputmode="numeric"' });
  return `<form id="rdSettingsForm" class="pg-detail__block" novalidate>
    <section class="pg-shell pg-detail__block"><h2 class="pg-section__title">Details</h2>
      ${pgInputFieldHTML({ id: 'rdSTitle', label: 'Title', value: it.title, help: 'Required. Up to 120 characters.', attrs: 'maxlength="120" autocomplete="off" required aria-required="true"' })}
      ${pgInputFieldHTML({ id: 'rdSAuthor', label: 'Author', value: it.author || '', optional: true, attrs: 'maxlength="80" autocomplete="off"' })}
      ${lenFields}
      ${pgSelectFieldHTML({ id: 'rdSStatus', label: 'Status', options: RD_STATUS, value: it.status })}
      ${pgSelectFieldHTML({ id: 'rdSRating', label: 'Rating', options: [['0', 'Not rated'], ['1', '1 star'], ['2', '2 stars'], ['3', '3 stars'], ['4', '4 stars'], ['5', '5 stars']], value: String(it.rating || 0) })}
      <p class="pg-meta">${rdIsAudio(it) ? 'Audiobook' : 'Book'}. The type cannot be changed after it is added.</p>
    </section>
    <div class="pg-detail__actions"><button type="submit" class="pg-btn pg-btn--primary">Save changes</button></div>
    <section class="pg-shell pg-detail__block pg-detail__danger"><h2 class="pg-section__title">Remove from your Reading Nook</h2><p class="pg-meta">Removes it with its sessions and notes. This cannot be undone.</p><button type="button" class="pg-btn pg-btn--danger" data-rd-delete="${esc(it.id)}">Remove ${esc(it.title)}</button></section>
  </form>`;
}
function pgRenderReadingItem() {
  const it = rdById(pgReadingId);
  if (!it) { pgView = 'reading'; pgReadingId = null; return renderPersonalGrowth(); }
  const cur = view.querySelector('.pg-detail .pg-tab[aria-selected="true"]');
  if (cur) rdTab = cur.id.replace('pgTab-', '');
  const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'sessions', label: `Sessions${rdSessions(it).length ? ` (${rdSessions(it).length})` : ''}` }, { id: 'notes', label: `Notes${pgNotesOf(it).length ? ` (${pgNotesOf(it).length})` : ''}` }, { id: 'settings', label: 'Settings' }];
  if (!tabs.some(x => x.id === rdTab)) rdTab = 'overview';
  view.innerHTML = `<div class="pg-theme pg-page pg-accent-blue"><div class="pg-page__inner pg-detail">
    ${pgBackMarkup('Reading Nook', 'reading')}
    ${pgHeroMarkup({ title: it.title, sub: `${rdIsAudio(it) ? 'Audiobook' : 'Book'}${it.author ? ` · ${it.author}` : ''} · ${(RD_STATUS.find(x => x[0] === it.status) || ['', it.status])[1]}`, iconSrc: asset(PG_SOON.reading.art), glyph: '▤', compact: true })}
    ${pgTabsHTML(tabs, rdTab, { overview: rdOverviewHTML(it), sessions: rdSessionsHTML(it), notes: pgDetailNotesHTML(it), settings: rdSettingsHTML(it) }, `${it.title} sections`)}
  </div></div>`;
  pgBindNav();
  const root = view.querySelector('.pg-tabs-wrap');
  pgBindTabs(root);
  root.querySelectorAll('[role="tab"]').forEach(x => x.addEventListener('click', () => { rdTab = x.id.replace('pgTab-', ''); }));
  pgBindNotes(root, it);
  root.addEventListener('click', e => {
    const l = e.target.closest('[data-rd-log]'); if (l) { rdLogModal(l.dataset.rdLog); return; }
    const st = e.target.closest('[data-rd-status]');
    if (st) { const [, status] = st.dataset.rdStatus.split(':'); rdSetStatus(it, status); renderPersonalGrowth(); pgAnnounce(`${it.title}: ${status}`); return; }
    const ds = e.target.closest('[data-rd-del-session]');
    if (ds) { it.sessions = rdSessions(it).filter(x => String(x.id) !== ds.dataset.rdDelSession); save(); renderPersonalGrowth(); pgAnnounce('Session deleted'); return; }
    const del = e.target.closest('[data-rd-delete]');
    if (del) pgConfirmAction({ title: `Remove ${it.title}?`, text: `This permanently removes it${rdSessions(it).length ? `, its ${rdSessions(it).length} logged ${rdSessions(it).length === 1 ? 'session' : 'sessions'}` : ''} and its notes.`, confirmLabel: 'Remove', accentClass: 'pg-accent-blue', glyph: '▤', onConfirm: () => { ensureReading().items = rdItems().filter(x => x.id !== it.id); save(); pgView = 'reading'; pgReadingId = null; renderPersonalGrowth(); toast(`${it.title} removed.`); } });
  });
  const sf = root.querySelector('#rdSettingsForm');
  if (sf) sf.onsubmit = e => {
    e.preventDefault();
    ['rdSTitle'].forEach(id => pgInlineError(id, ''));
    const name = sf.querySelector('#rdSTitle').value.trim();
    if (!name) { pgInlineError('rdSTitle', 'Give it a title.'); sf.querySelector('#rdSTitle').focus(); return; }
    it.title = name.slice(0, 120);
    it.author = sf.querySelector('#rdSAuthor').value.trim().slice(0, 80);
    if (rdIsAudio(it)) it.totalMinutes = Math.max(0, Math.round(Number(sf.querySelector('#rdSHours').value || 0) * 60 + Number(sf.querySelector('#rdSMins').value || 0)));
    else it.totalPages = Math.max(0, Math.round(Number(sf.querySelector('#rdSPages').value || 0)));
    it.rating = Math.max(0, Math.min(5, Number(sf.querySelector('#rdSRating').value) || 0));
    rdSetStatus(it, sf.querySelector('#rdSStatus').value);
    save();
    rdTab = 'settings';
    renderPersonalGrowth();
    toast(`${it.title} saved.`);
    pgAnnounce(`${it.title} saved`);
  };
}

/* ------------------------------------------------------------------ */
/* Hub source: the Reading Nook card and reading activity              */
/* ------------------------------------------------------------------ */
PG_HUB_SOURCES.push({
  id: 'reading',
  card() {
    const items = rdItems(), s = rdStats();
    return { status: items.length ? `${s.reading} reading` : 'None yet', detail: items.length ? `${s.finishedThisYear} finished this year` : '', badge: '' };
  },
  activity() {
    const out = [];
    rdItems().forEach(it => {
      rdSessions(it).forEach(s => out.push({ id: `read:${it.id}:${s.id}`, sourceType: 'reading', sourceId: it.id, action: rdIsAudio(it) ? 'Listening logged' : 'Reading logged', title: it.title, summary: rdFormatAmount(it, s.amount), date: s.date, order: Number(s.id) || 0, route: 'reading', glyph: '▤', open: `book:${it.id}` }));
      if (it.status === 'finished' && it.finishedAt) out.push({ id: `fin:${it.id}`, sourceType: 'reading', sourceId: it.id, action: rdIsAudio(it) ? 'Finished an audiobook' : 'Finished a book', title: it.title, summary: it.rating ? '★'.repeat(it.rating) : '', date: it.finishedAt, order: (Number(it.id) || 0) + 0.5, route: 'reading', glyph: '✔', open: `book:${it.id}` });
      pgNotesOf(it).forEach(n => { const at = String(n.at || ''); if (at) out.push({ id: `rnote:${it.id}:${n.id}`, sourceType: 'note', sourceId: it.id, action: 'Note added', title: it.title, summary: String(n.text).length > 48 ? `${String(n.text).slice(0, 47)}…` : String(n.text), date: localISO(new Date(at)), at, order: Number(it.id) || 0, route: 'reading', glyph: '✎', open: `book:${it.id}` }); });
    });
    return out;
  }
});
