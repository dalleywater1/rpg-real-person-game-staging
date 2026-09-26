/* Personal Growth presentation (Astra, 2026-09-21).
   Handover: ASTRA_PERSONAL_GROWTH_MASTER_HANDOVER. Docs: docs/PERSONAL_GROWTH.md.
   Styles: styles/personal-growth/ (theme, components, pages), all scoped to .pg-theme.

   This file is presentation only. The data model and rules are unchanged and
   stay in app.js: PERSONAL_GROWTH_CATEGORIES / PERSONAL_GROWTH_PRESETS,
   ensurePersonalGrowth, pgWeekDays, pgScheduledOn, pgEntryComplete,
   pgTrackerStats, pgValueLabel, pgCreateTracker, and the focus-timer
   behaviour (bindFocusTools, toggleFocus, stopFocus, showRandomTask). What
   moved here is everything that builds markup or opens a dialog:
   renderPersonalGrowth, the tracker rows, filters, Focus Tools markup, the
   log-value dialog and the Add Tracker dialogs.

   Two layers:
     1. Pure markup functions (pg...HTML / pg...Markup). They take plain view
        models and depend only on esc() and asset(), so the internal specimen
        (dev/personal-growth-specimen.html) renders exactly the shipped code.
     2. Adapters and behaviour. They read app state at call time, never at
        load time, so this file is safe to load anywhere.

   Nothing here invents data: missing capabilities (detail pages, notes,
   books, records) are recorded as gaps in the docs, not faked. */

const PG_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PG_DAY_LETTERS = 'MTWTFSS';
const PG_STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/></svg>';
/* Production art (assets/PersonalGrowth/, installed from Velora's batches 1 and 2).
   Paths are relative to assets/, as asset() expects. Art is optional everywhere: a
   category, destination or page with no entry here keeps its glyph or its gradient. */
const PG_CATEGORY_ART = {
  wellbeing: 'PersonalGrowth/pg-cat-wellbeing.webp',
  learning: 'PersonalGrowth/pg-cat-learning.webp',
  hobbies: 'PersonalGrowth/pg-emblem-hobbies.webp',
  personalCare: 'PersonalGrowth/pg-cat-personalCare.webp',
  homeRoutine: 'PersonalGrowth/pg-cat-homeRoutine.webp',
  social: 'PersonalGrowth/pg-cat-social.webp',
  personalGoals: 'PersonalGrowth/pg-cat-personalGoals.webp'
};
const PG_METHOD_OPTIONS = [
  ['completion', 'Completion / yes-no'], ['number', 'Number'], ['quantity', 'Quantity'],
  ['duration', 'Duration'], ['rating', 'Rating'], ['progress', 'Progress toward goal']
];
const PG_FREQUENCY_OPTIONS = [
  ['daily', 'Daily'], ['selected', 'Selected days'], ['weekly', 'Weekly target'],
  ['monthly', 'Monthly target'], ['none', 'No schedule']
];

/* ------------------------------------------------------------------ */
/* 1. Pure markup                                                      */
/* ------------------------------------------------------------------ */

/* A circle holder for a category glyph or for art that supplies its own ring. */
function pgMedallionHTML({ glyph = '', src = '', size = '', art = false } = {}) {
  const cls = `pg-medallion${size ? ` pg-medallion--${size}` : ''}${art ? ' pg-medallion--art' : ''}`;
  if (src) return `<span class="${cls}"><img src="${esc(src)}" alt="" width="256" height="256" decoding="async"${glyph ? ` data-pg-glyph="${esc(glyph)}"` : ''}></span>`;
  return `<span class="${cls}" aria-hidden="true">${esc(glyph)}</span>`;
}

/* value === null means "not available", which is different from zero: a dash,
   spoken as "not available yet", plus an optional visible note. */
function pgStatHTML(value, label, unit = '', note = '') {
  if (value === null) {
    return `<div class="pg-stat pg-stat--na"><span class="pg-stat__value"><span aria-hidden="true">—</span><span class="pg-sr">Not available yet</span></span><span class="pg-stat__label">${esc(label)}</span>${note ? `<span class="pg-stat__note">${esc(note)}</span>` : ''}</div>`;
  }
  return `<div class="pg-stat"><span class="pg-stat__value pg-num">${esc(value)}${unit ? `<span class="pg-stat__unit">${esc(unit)}</span>` : ''}</span><span class="pg-stat__label">${esc(label)}</span>${note ? `<span class="pg-stat__note">${esc(note)}</span>` : ''}</div>`;
}

/* The fill is clamped to 0..100. The exact numbers stay in the visible label
   and in aria-valuetext, so an over-goal value is never misreported. */
function pgBarHTML(value, max, label, text) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `<div class="pg-bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.max(0, Math.min(value, max))}" aria-valuetext="${esc(text)}" style="--pg-fill:${pct}%"><i></i></div>`;
}

function pgChipHTML({ label, glyph = '', pressed = false, catKey = '', attrs = '' }) {
  return `<button type="button" class="pg-chip${catKey ? ` pg-cat-${esc(catKey)}` : ''}" ${attrs} aria-pressed="${Boolean(pressed)}"><span class="pg-chip__glyph" aria-hidden="true">${esc(glyph)}</span><span>${esc(label)}</span></button>`;
}

/* m: { id, name, catKey, glyph, meta, favorite, today:{text,done,bar}, days:[...], weekCount, stats:{current,best,total} } */
/* The seven day buttons and the "n of m days" line. Shared by the row and the detail page. */
function pgWeekStripHTML(m) {
  const days = m.days.map(d => {
    const state = d.scheduled ? (d.toggle ? ` aria-pressed="${Boolean(d.done)}"` : ' aria-haspopup="dialog"') : '';
    return `<div class="pg-day${d.isToday ? ' is-today' : ''}"><span class="pg-day__label" aria-hidden="true">${esc(d.letter)}</span><button type="button" class="pg-orb${d.done ? ' is-done' : ''}${d.isToday ? ' is-today' : ''}" data-pg-orb="${esc(m.id)}" data-date="${esc(d.date)}"${d.scheduled ? '' : ' disabled'}${state} aria-label="${esc(d.label)}"></button></div>`;
  }).join('');
  return `<div class="pg-week" role="group" aria-label="This week for ${esc(m.name)}"><div class="pg-days">${days}</div><p class="pg-week__count">${esc(m.weekCount)}</p></div>`;
}
function pgRowMarkup(m) {
  const t = m.today;
  const today = `<div class="pg-today"><div class="pg-today__line"><span class="pg-today__label">Today</span><span class="pg-today__value${t.done ? ' is-done' : ''}">${esc(t.text)}</span></div>${t.bar ? pgBarHTML(t.bar.value, t.bar.max, t.bar.label, t.bar.text) : ''}</div>`;
  return `<li class="pg-row pg-cat-${esc(m.catKey)}" data-pg-id="${esc(m.id)}">
    <div class="pg-row__head">${m.art ? pgMedallionHTML({ src: asset(m.art), glyph: m.glyph, art: true }) : pgMedallionHTML({ glyph: m.glyph })}<div><h3 class="pg-row__name">${esc(m.name)}</h3><p class="pg-row__meta pg-meta">${esc(m.meta)}</p></div><button type="button" class="pg-fav" data-pg-favorite="${esc(m.id)}" aria-pressed="${Boolean(m.favorite)}" aria-label="Favorite: ${esc(m.name)}">${PG_STAR_SVG}</button></div>
    ${today}
    ${pgWeekStripHTML(m)}
    <div class="pg-row__foot"><dl class="pg-row__stats"><div><dt>Streak</dt><dd class="pg-num">${m.stats.current}</dd></div><div><dt>Best</dt><dd class="pg-num">${m.stats.best}</dd></div><div><dt>Total</dt><dd class="pg-num">${m.stats.total}</dd></div></dl><span class="pg-row__actions"><button type="button" class="pg-btn pg-btn--secondary pg-btn--compact" data-pg-detail="${esc(m.id)}" aria-label="Open details for ${esc(m.name)}">Details</button><button type="button" class="pg-btn pg-btn--danger pg-btn--compact" data-pg-delete="${esc(m.id)}" aria-label="Delete ${esc(m.name)}">Delete</button></span></div>
  </li>`;
}

/* s: { checkins, best, total } or null. Unknown is hidden, never shown as zero. */
function pgSummaryMarkup(s) {
  if (!s) return '';
  return `<section class="pg-summary" aria-label="Your tracking at a glance">${pgStatHTML(s.checkins, 'Check‑ins this week')}${pgStatHTML(s.best, 'Longest current streak', s.best === 1 ? 'day' : 'days')}${pgStatHTML(s.total, 'Total check‑ins')}</section>`;
}

/* compact: the Hub and the child pages use a shorter header. The h1 is
   focusable (tabindex -1) so a page change can move focus to it. */
function pgHeroMarkup({ title, sub = '', iconSrc = '', glyph = '', compact = false, scene = '' }) {
  const medallion = iconSrc ? pgMedallionHTML({ src: iconSrc, glyph, size: 'hero', art: true }) : pgMedallionHTML({ glyph, size: 'hero' });
  return `<header class="pg-hero${compact ? ' pg-hero--compact' : ''}${scene ? ' pg-hero--art' : ''}"><div class="pg-hero__scene${scene ? ` pg-scene--${scene}` : ''}" aria-hidden="true"></div><div class="pg-hero__content">${medallion}<div class="pg-hero__text"><h1 class="pg-hero__title" tabindex="-1">${esc(title)}</h1>${sub ? `<p class="pg-hero__sub">${esc(sub)}</p>` : ''}</div></div></header>`;
}

/* m: { timer, status, running, minutes }. The timer has role=timer (no per-second
   announcements); the random-quest line is a polite live region. */
function pgFocusMarkup(m) {
  return `<section class="pg-shell pg-focus" aria-labelledby="pgFocusTitle"><div class="pg-focus__head">${pgMedallionHTML({ glyph: '◔', size: 'sm' })}<h2 class="pg-section__title" id="pgFocusTitle">Focus Tools</h2></div><div class="pg-focus__body"><div class="pg-timer pg-num${m.running ? ' is-running' : ''}" id="focusTimer" role="timer" aria-live="off" aria-label="Focus timer">${esc(m.timer)}</div><p class="pg-focus__status"><span class="pg-focus__state">${esc(m.status)}</span> · <span class="pg-focus__len">${esc(m.minutes)} min</span></p><div class="pg-focus__actions"><button type="button" class="pg-btn pg-btn--primary" id="focusStart">${m.running ? 'Pause' : 'Start'}</button><button type="button" class="pg-btn pg-btn--secondary" id="focusReset">Reset</button><button type="button" class="pg-btn pg-btn--secondary" id="focusSetTime"${m.running ? ' disabled aria-describedby="focusTimeHint"' : ''}>Set time</button><button type="button" class="pg-btn pg-btn--secondary" id="randomTask">Random Quick Quest</button></div>${m.running ? '<p class="pg-meta pg-focus__hint" id="focusTimeHint">Pause the timer to change its length.</p>' : ''}<p class="pg-focus__note" id="randomTaskDisplay" aria-live="polite">Choose a tool when your brain refuses to cooperate.</p></div></section>`;
}

/* kind: 'none' (nothing tracked yet) or 'filtered' (nothing matches). Different message, different recovery. */
function pgEmptyMarkup(kind) {
  const none = kind === 'none';
  return `<div class="pg-empty">${pgMedallionHTML({ glyph: '✧' })}<h3 class="pg-empty__title">${none ? 'Begin your Personal Growth' : 'No trackers match this filter'}</h3><p class="pg-empty__text">${none ? 'Add a habit, hobby, routine or personal goal to begin tracking.' : 'Choose another category or turn off Favorites.'}</p>${none ? '<button type="button" class="pg-btn pg-btn--primary" id="pgEmptyAdd">Add your first tracker</button>' : '<button type="button" class="pg-btn pg-btn--secondary" id="pgClearFilter">Show all trackers</button>'}</div>`;
}

/* ---- Hub components (PGHubCard, PGActivityRow) and child-page furniture ---- */

/* Back control shared by every child page. */
function pgBackMarkup(label = 'Personal Growth', to = 'hub') {
  return `<div class="pg-backrow"><button type="button" class="pg-btn pg-btn--secondary pg-btn--compact" data-pg-back data-pg-back-to="${esc(to)}"><span aria-hidden="true">←</span> <span class="pg-sr">Back to </span>${esc(label)}</button></div>`;
}

/* d: { id, title, subtitle, glyph, accent, built, status, detail, badge }
   built=false renders the card as available but honest: dashed edge and the
   words "Coming later". The card is a button because it switches an in-page
   view (there is no URL to link to). */
function pgHubCardMarkup(d) {
  return `<li><button type="button" class="pg-hubcard pg-accent-${esc(d.accent)}${d.built ? '' : ' is-unavailable'}" data-pg-go="${esc(d.id)}"><span class="pg-hubcard__top">${d.art ? pgMedallionHTML({ src: asset(d.art), glyph: d.glyph, art: true }) : pgMedallionHTML({ glyph: d.glyph })}${d.badge ? `<span class="pg-tag pg-tag--live">${esc(d.badge)}</span>` : ''}</span><span class="pg-hubcard__title">${esc(d.title)}</span><span class="pg-hubcard__sub">${esc(d.subtitle)}</span><span class="pg-hubcard__foot"><span class="pg-hubcard__status">${esc(d.status)}</span>${d.detail ? `<span class="pg-hubcard__detail">${esc(d.detail)}</span>` : ''}</span></button></li>`;
}

/* a: PersonalGrowthActivity { id, sourceType, sourceId, action, title, summary, when, route, glyph } */
function pgActivityRowMarkup(a) {
  return `<li><button type="button" class="pg-act" data-pg-go="${esc(a.route)}"${a.open ? ` data-pg-open="${esc(a.open)}" data-pg-from="${esc(pgView)}"` : ''}>${pgMedallionHTML({ glyph: a.glyph, size: 'sm' })}<span class="pg-act__text"><span class="pg-act__action">${esc(a.action)}</span><span class="pg-act__title">${esc(a.title)}${a.summary ? ` · ${esc(a.summary)}` : ''}</span></span><span class="pg-act__when">${esc(a.when)}</span></button></li>`;
}

/* p: { title, headline, text, note, noteAction:{go,label}|null }. The
   destinations that are not built yet say so plainly and offer nothing that
   does not work. */
/* When the page has art, its hero already carries the emblem, so the panel does not repeat it. */
function pgPlaceholderMarkup(p) {
  return `<section class="pg-shell pg-soon" aria-labelledby="pgSoonTitle"><div class="pg-empty">${p.art ? '' : pgMedallionHTML({ glyph: p.glyph })}<span class="pg-tag">Coming later</span><h2 class="pg-empty__title" id="pgSoonTitle">${esc(p.headline)}</h2><p class="pg-empty__text">${esc(p.text)}</p>${p.note ? `<p class="pg-meta">${esc(p.note)}</p>` : ''}${p.noteAction ? `<button type="button" class="pg-btn pg-btn--secondary" data-pg-go="${esc(p.noteAction.go)}">${esc(p.noteAction.label)}</button>` : ''}</div></section>`;
}

/* Form fields: visible label, help and error wired with aria-describedby. */
function pgInputFieldHTML({ id, label, type = 'text', value = '', placeholder = '', help = '', optional = false, attrs = '' }) {
  return `<div class="pg-field"><label class="pg-field__label" for="${id}">${esc(label)}${optional ? '<span class="pg-field__opt">(optional)</span>' : ''}</label><input class="pg-input" id="${id}" type="${type}" value="${esc(value)}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ''} aria-describedby="${help ? `${id}Help ` : ''}${id}Error" ${attrs}>${help ? `<p class="pg-field__help" id="${id}Help">${esc(help)}</p>` : ''}<p class="pg-field__error" id="${id}Error" role="alert" hidden></p></div>`;
}
function pgSelectFieldHTML({ id, label, options, value = '', help = '' }) {
  return `<div class="pg-field"><label class="pg-field__label" for="${id}">${esc(label)}</label><select class="pg-select" id="${id}"${help ? ` aria-describedby="${id}Help"` : ''}>${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${help ? `<p class="pg-field__help" id="${id}Help">${esc(help)}</p>` : ''}</div>`;
}

/* Tabs (content tabs with panels). Not used by a live page yet: the detail
   pages that need them do not exist in the product. Built as part of the
   foundation and shown in the specimen. tabs: [{id,label}], panels by id. */
function pgTabsHTML(tabs, activeId, panels, label = 'Sections') {
  return `<div class="pg-tabs-wrap"><div class="pg-tabs" role="tablist" aria-label="${esc(label)}">${tabs.map(t => `<button type="button" class="pg-tab" role="tab" id="pgTab-${esc(t.id)}" aria-controls="pgPanel-${esc(t.id)}" aria-selected="${t.id === activeId}" tabindex="${t.id === activeId ? 0 : -1}">${esc(t.label)}</button>`).join('')}</div>${tabs.map(t => `<div class="pg-tabpanel" role="tabpanel" id="pgPanel-${esc(t.id)}" aria-labelledby="pgTab-${esc(t.id)}"${t.id === activeId ? '' : ' hidden'}>${panels[t.id] || ''}</div>`).join('')}</div>`;
}
function pgBindTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const select = (tab, focus) => {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = root.querySelector('#' + t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach(t => {
    t.onclick = () => select(t, false);
    t.onkeydown = e => {
      const i = tabs.indexOf(t);
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); select(next, true); }
    };
  });
}

/* Dialog markup. pgModal() below mounts it into #modalRoot. accentClass is
   pg-accent-<name> or pg-cat-<category>, so the dialog carries the same
   accent context as the page it opened from. */
function pgDialogHTML({ title, sub = '', accentClass = 'pg-accent-green', glyph = '✧', body = '', actions = '', size = '', role = 'dialog', describedBy = '' }) {
  return `<div class="modal-backdrop pg-dialog-backdrop pg-theme ${esc(accentClass)}"><div class="pg-dialog${size ? ` pg-dialog--${size}` : ''}" role="${role}" aria-modal="true" aria-labelledby="pgDialogTitle"${describedBy ? ` aria-describedby="${describedBy}"` : ''} tabindex="-1"><header class="pg-dialog__head">${pgMedallionHTML({ glyph, size: 'sm' })}<div class="pg-dialog__titles"><h2 class="pg-dialog__title" id="pgDialogTitle">${esc(title)}</h2>${sub ? `<p class="pg-dialog__sub">${esc(sub)}</p>` : ''}</div><button type="button" class="pg-btn pg-btn--secondary pg-btn--icon" data-pg-close aria-label="Close dialog">&times;</button></header><div class="pg-dialog__body">${body}</div>${actions ? `<footer class="pg-dialog__foot">${actions}</footer>` : ''}</div></div>`;
}

/* ------------------------------------------------------------------ */
/* 2. Adapters and behaviour (read app state at call time only)        */
/* ------------------------------------------------------------------ */

function pgRowModel(t) {
  const catKey = PERSONAL_GROWTH_CATEGORIES[t.category] ? t.category : 'personalGoals';
  const cat = PERSONAL_GROWTH_CATEGORIES[catKey];
  const week = pgWeekDays(), today = todayISO(), stats = pgTrackerStats(t);
  const scheduled = week.filter(d => pgScheduledOn(t, d));
  const doneCount = scheduled.filter(d => pgEntryComplete(t, d)).length;
  const goal = Number(t.goal) || 0;
  const entry = t.entries ? Number(t.entries[today]) : NaN;
  const schedToday = pgScheduledOn(t, today), doneToday = pgEntryComplete(t, today);

  let todayModel;
  if (!schedToday) todayModel = { text: 'Not scheduled today', done: false, bar: null };
  else if (t.method === 'completion') todayModel = { text: doneToday ? 'Done today' : 'Not done yet', done: doneToday, bar: null };
  else {
    const value = Number.isFinite(entry) ? entry : 0;
    const met = goal > 0 && value >= goal;
    const label = pgValueLabel(t);
    todayModel = {
      text: met ? `${label} · Goal met` : label,
      done: met,
      bar: goal > 0 ? { value, max: goal, label: `Today's progress for ${t.name}`, text: label } : null
    };
  }

  const freq = t.frequency === 'selected' ? 'Selected days' : (t.frequency === 'daily' ? 'Daily' : '');
  const goalText = t.method !== 'completion' && goal ? `${goal}${t.unit ? ` ${t.unit}` : ''} goal` : '';
  return {
    id: t.id, name: t.name, catKey, glyph: cat.icon, art: PG_CATEGORY_ART[catKey] || '', favorite: Boolean(t.favorite),
    meta: [cat.label, freq, goalText].filter(Boolean).join(' · '),
    today: todayModel,
    days: week.map((d, i) => {
      const sch = pgScheduledOn(t, d), done = pgEntryComplete(t, d), isToday = d === today;
      return {
        date: d, letter: PG_DAY_LETTERS[i], scheduled: sch, done, isToday, toggle: t.method === 'completion',
        label: `${PG_DAY_NAMES[i]}${isToday ? ' (today)' : ''}, ${t.name}: ${sch ? (done ? 'logged' : 'not logged') : 'not scheduled'}`
      };
    }),
    weekCount: scheduled.length ? `${doneCount} of ${scheduled.length} ${scheduled.length === 1 ? 'day' : 'days'} this week` : 'No scheduled days this week',
    stats
  };
}

/* Page-level totals. Straight aggregates of the same numbers each row shows. */
function pgSummaryModel(trackers) {
  if (!trackers.length) return null;
  const week = pgWeekDays();
  let checkins = 0, best = 0, total = 0;
  trackers.forEach(t => {
    week.forEach(d => { if (pgEntryComplete(t, d)) checkins++; });
    const s = pgTrackerStats(t);
    best = Math.max(best, s.current);
    total += s.total;
  });
  return { checkins, best, total };
}

/* Keep keyboard focus across the full re-render every action triggers. */
function pgFocusSelector(el) {
  if (!el || el === document.body || !el.closest || !el.closest('.pg-page')) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const d = el.dataset || {};
  if (d.pgOrb) return `[data-pg-orb="${CSS.escape(d.pgOrb)}"][data-date="${CSS.escape(d.date || '')}"]`;
  if (d.pgFavorite) return `[data-pg-favorite="${CSS.escape(d.pgFavorite)}"]`;
  if (d.pgFilter) return `[data-pg-filter="${CSS.escape(d.pgFilter)}"]`;
  if (d.pgDelete) return `[data-pg-delete="${CSS.escape(d.pgDelete)}"]`;
  if (d.pgGo) return `[data-pg-go="${CSS.escape(d.pgGo)}"]`;
  if (el.hasAttribute('data-pg-back')) return '[data-pg-back]';
  return null;
}

function pgAnnounce(msg) {
  let r = document.querySelector('#pgLiveRegion');
  if (!r) {
    r = document.createElement('div');
    r.id = 'pgLiveRegion';
    r.className = 'pg-sr';
    r.setAttribute('role', 'status');
    r.setAttribute('aria-live', 'polite');
    document.body.appendChild(r);
  }
  r.textContent = '';
  setTimeout(() => { r.textContent = msg; }, 60);
}

/* ------------------------------------------------------------------ */
/* Hub: an overview and routing page over the Personal Growth systems. */
/* It stores nothing. Everything on it is derived from the source       */
/* systems at render time.                                              */
/* ------------------------------------------------------------------ */

/* Which page of Personal Growth is showing. Not persisted: the app always
   starts on Home, and every entry from global navigation lands on the Hub. */
let pgView = 'hub';
const PG_VIEWS = ['hub', 'habits', 'hobbies', 'reading', 'trackers', 'records', 'selfcare', 'detail', 'readingItem', 'activity'];
/* Detail views need to know WHICH record they show and where Back returns to. They are set by
   pgOpenDetail / pgOpenReadingItem (v0.02.52 / v0.02.53); like pgView they are not persisted. */
let pgDetailId = null, pgDetailFrom = 'trackers', pgReadingId = null;
function pgOpenHub() { pgView = 'hub'; }   // setPage() calls this for every entry from global navigation

/* Standard in-page navigation (the app's own pattern: a Back control, no history
   entries). Focus moves to the new page's heading, or back to the card that
   opened the page you just left. */
function pgGo(next) {
  if (!PG_VIEWS.includes(next)) return;
  const from = pgView;
  pgView = next;
  renderPersonalGrowth();
  window.scrollTo(0, 0);
  const target = next === 'hub'
    ? (from !== 'hub' ? document.querySelector(`[data-pg-go="${CSS.escape(from)}"]`) : null)
    : document.querySelector('.pg-hero__title');
  if (target) target.focus({ preventScroll: true });
}
/* If a piece of medallion art fails to load (offline before it was cached, a
   missing file), swap in the glyph so the circle is never empty. Error events do
   not bubble, so this listens in the capture phase on the page root. */
function pgBindArtFallback(root) {
  root.addEventListener('error', e => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.dataset.pgGlyph) return;
    const holder = img.parentElement;
    holder.classList.remove('pg-medallion--art');
    holder.setAttribute('aria-hidden', 'true');
    holder.textContent = img.dataset.pgGlyph;
  }, true);
}
function pgBindNav() {
  const root = document.querySelector('.pg-page');
  if (!root) return;
  pgBindArtFallback(root);
  root.onclick = e => {
    /* an activity row (or any record link) opens the exact record: "detail:<trackerId>" or "book:<itemId>" */
    const open = e.target.closest('[data-pg-open]');
    if (open && open.dataset.pgOpen) {
      const [kind, ...rest] = open.dataset.pgOpen.split(':'), id = rest.join(':');
      if (kind === 'detail' && typeof pgOpenDetail === 'function') { pgOpenDetail(id, open.dataset.pgFrom || 'hub'); return; }
      if (kind === 'book' && typeof pgOpenReadingItem === 'function') { pgOpenReadingItem(id); return; }
    }
    const go = e.target.closest('[data-pg-go]');
    if (go) { pgGo(go.dataset.pgGo); return; }
    const back = e.target.closest('[data-pg-back]');
    if (back) pgGo(back.dataset.pgBackTo || 'hub');
  };
}

/* The five destinations, in the agreed order. Copy and art are placeholders
   until Aurelia and Velora supply them; the glyphs are the existing family. */
const PG_HUB_DESTINATIONS = [
  { id: 'habits', title: 'Habits', subtitle: 'Build consistency', glyph: '◈', accent: 'green', art: 'PersonalGrowth/pg-emblem-habits.webp' },
  { id: 'hobbies', title: 'Hobbies', subtitle: 'Time for what you love', glyph: '✣', accent: 'pink', art: 'PersonalGrowth/pg-emblem-hobbies.webp' },
  { id: 'reading', title: 'Reading Nook', subtitle: 'Books & audiobooks', glyph: '▤', accent: 'blue', art: 'PersonalGrowth/pg-emblem-reading.webp' },
  { id: 'trackers', title: 'Trackers', subtitle: 'Track progress', glyph: '◎', accent: 'purple', art: 'PersonalGrowth/pg-emblem-trackers.webp' },
  { id: 'records', title: 'Records & Milestones', subtitle: 'Personal bests and milestones', glyph: '✦', accent: 'gold', art: 'PersonalGrowth/pg-emblem-records.webp' },
  /* Self Care & Habits V1 (2026-09-25): the sixth hub card. No art delivered yet, so it keeps its glyph. */
  { id: 'selfcare', title: 'Self Care', subtitle: 'Water · Meals · Sleep · Vigil', glyph: '♡', accent: 'blue', art: '' }
];

/* Each source system adapts its own data for the Hub through the same three
   optional methods: summary() (numbers that are added up), activity() (events)
   and card() (the status on its quick-access card). Trackers is the only
   source today. Habits, Hobbies, Reading and Records register here when they
   exist; nothing else in the Hub changes. */
const PG_HUB_SOURCES = [{
  /* Self Care registers like Trackers (Tally §1): it adapts its own data for the Hub's card. Its numbers are not added into the Hub summary (those are tracker totals). */
  id: 'selfcare',
  card() {
    return typeof selfCareHubLine === 'function' ? { status: selfCareHubLine(), detail: '', badge: '' } : { status: 'Coming later', detail: '', badge: '' };
  }
}, {
  id: 'trackers',
  summary() {
    const ts = ensurePersonalGrowth().trackers;
    return { currentStreaks: ts.filter(t => pgTrackerStats(t).current > 0).length, activeTrackers: ts.length };
  },
  activity() {
    const out = [], today = todayISO();
    ensurePersonalGrowth().trackers.forEach(t => {
      Object.keys(t.entries || {}).forEach(d => {
        if (d > today || !pgEntryComplete(t, d)) return;
        const v = t.entries[d];
        out.push({
          id: `tracker:${t.id}:${d}`, sourceType: t.category === 'hobbies' ? 'hobby' : 'habit', sourceId: t.id, action: t.category === 'hobbies' ? 'Hobby logged' : 'Habit logged', title: t.name,
          summary: t.method === 'completion' ? 'Completed' : `${v}${t.unit ? ` ${t.unit}` : ''}`,
          date: d, order: Number(t.id) || 0, route: 'trackers', glyph: (PERSONAL_GROWTH_CATEGORIES[t.category] || {}).icon || '◎', open: `detail:${t.id}`
        });
      });
    });
    return out;
  },
  card() {
    const ts = ensurePersonalGrowth().trackers, week = pgWeekDays();
    let checkins = 0;
    ts.forEach(t => week.forEach(d => { if (pgEntryComplete(t, d)) checkins++; }));
    return {
      status: ts.length ? `${ts.length} active` : 'None yet',
      detail: ts.length ? `${checkins} check‑in${checkins === 1 ? '' : 's'} this week` : '',
      badge: focusRunning ? 'Timer running' : ''
    };
  }
}];

/* Habits Completed and Personal Bests have no source system yet, so they stay
   null ("not available"), which is not the same as zero. */
function pgHubSummary() {
  const s = { habitsCompleted: null, currentStreaks: 0, personalBests: null, activeTrackers: 0 };
  PG_HUB_SOURCES.forEach(src => {
    if (!src.summary) return;
    const p = src.summary();
    Object.keys(p).forEach(k => { s[k] = (s[k] || 0) + p[k]; });
  });
  return s;
}

/* Recent events, newest first. Entries carry a date, not a time, so events on
   the same day are ordered by tracker creation, newest tracker first. */
const PG_ACTIVITY_LIMIT = 5;
function pgWhenLabel(iso) {
  const t = todayISO();
  if (iso === t) return 'Today';
  if (iso === addDays(t, -1)) return 'Yesterday';
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
function pgHubActivity(limit = PG_ACTIVITY_LIMIT) {
  const all = [];
  PG_HUB_SOURCES.forEach(src => { if (src.activity) all.push(...src.activity()); });
  all.sort((a, b) => b.date.localeCompare(a.date) || String(b.at || '').localeCompare(String(a.at || '')) || b.order - a.order);
  return all.slice(0, limit).map(a => ({ ...a, timestamp: a.at || a.date, when: pgWhenLabel(a.date) }));
}

function pgHubCards() {
  return PG_HUB_DESTINATIONS.map(d => {
    const src = PG_HUB_SOURCES.find(s => s.id === d.id), c = src && src.card ? src.card() : null;
    return { ...d, built: Boolean(src), status: c ? c.status : 'Coming later', detail: c ? c.detail : '', badge: c ? c.badge : '' };
  });
}

function pgRenderHub() {
  const focusSel = pgFocusSelector(document.activeElement);
  const s = pgHubSummary(), acts = pgHubActivity();
  const stats = [
    pgStatHTML(s.habitsCompleted, 'Habits Completed', '', 'Not tracked yet'),
    pgStatHTML(s.currentStreaks, 'Current Streaks'),
    pgStatHTML(s.personalBests, 'Personal Bests', '', 'Not tracked yet'),
    pgStatHTML(s.activeTrackers, 'Active Trackers')
  ].join('');
  view.innerHTML = `<div class="pg-theme pg-page pg-accent-green"><div class="pg-page__inner pg-hub">
    ${pgHeroMarkup({ title: 'Personal Growth', iconSrc: asset('icons/navigation/NAV_GROWTH.png'), compact: true, scene: 'home' })}
    <section class="pg-summary pg-summary--four" aria-label="Your Personal Growth at a glance">${stats}</section>
    <section class="pg-shell pg-quick" aria-labelledby="pgQuickTitle"><h2 class="pg-section__title" id="pgQuickTitle">Quick Access</h2><ul class="pg-hub-grid">${pgHubCards().map(pgHubCardMarkup).join('')}</ul></section>
    <section class="pg-shell pg-recent" aria-labelledby="pgRecentTitle"><h2 class="pg-section__title" id="pgRecentTitle">Recent Activity</h2>${acts.length ? `<ul class="pg-acts">${acts.map(pgActivityRowMarkup).join('')}</ul><button type="button" class="pg-btn pg-btn--secondary pg-btn--compact" data-pg-go="activity">See all activity</button>` : '<p class="pg-meta pg-acts__empty">No Personal Growth activity yet.</p>'}</section>
  </div></div>`;
  pgBindNav();
  if (focusSel) { const el = view.querySelector(focusSel); if (el) el.focus({ preventScroll: true }); }
}

/* Destinations that are not built yet: an honest page, no fake controls, no
   silent redirect. Habits and Hobbies point at Trackers with a labelled button
   because that is where matching data lives today. */
const PG_SOON = {
  habits: { title: 'Habits', glyph: '◈', accent: 'green', art: 'PersonalGrowth/pg-emblem-habits.webp', scene: 'habits', headline: 'Your habits will live here', text: 'Repeatable personal behaviours, built up one day at a time. No habits added yet.', note: 'Anything you already track every day is in Trackers.', noteAction: { go: 'trackers', label: 'Open Trackers' } },
  hobbies: { title: 'Hobbies', glyph: '✣', accent: 'pink', art: 'PersonalGrowth/pg-emblem-hobbies.webp', scene: '', headline: 'Your hobbies will live here', text: 'Activities you develop and spend time on, such as gaming, painting, gardening, music or photography. No hobbies added yet.', note: 'Trackers you filed under Hobbies stay in Trackers for now.', noteAction: { go: 'trackers', label: 'Open Trackers' } },
  reading: { title: 'Reading Nook', glyph: '▤', accent: 'blue', art: 'PersonalGrowth/pg-emblem-reading.webp', scene: 'reading', headline: 'Your reading archive will live here', text: 'Books and audiobooks you are reading or have finished. No books added yet.', note: '', noteAction: null },
  records: { title: 'Records & Milestones', glyph: '✦', accent: 'gold', art: 'PersonalGrowth/pg-emblem-records.webp', scene: '', headline: 'Your records will live here', text: 'Personal bests and milestones from Personal Growth. Nothing recorded yet.', note: '', noteAction: null }
};
function pgRenderPlaceholder(id) {
  const p = PG_SOON[id];
  view.innerHTML = `<div class="pg-theme pg-page pg-accent-${p.accent}"><div class="pg-page__inner">${pgBackMarkup()}${pgHeroMarkup({ title: p.title, glyph: p.glyph, iconSrc: p.art ? asset(p.art) : '', compact: true, scene: p.scene })}${pgPlaceholderMarkup(p)}</div></div>`;
  pgBindNav();
}

/* The one entry point the rest of the app calls. It routes to the current view.
   The guard stops a finishing Focus timer from painting this page over
   whatever page is open. */
function renderPersonalGrowth() {
  if (page !== 'personal-growth') return;
  if (pgView === 'hub') return pgRenderHub();
  if (pgView === 'trackers') return pgRenderTrackers();
  if (pgView === 'selfcare') return pgRenderSelfCare();
  /* Habits, Hobbies, the detail pages, Reading Nook, Records and the activity feed live in
     v0.02.52-54. Until a page's builder exists it keeps its honest "coming later" page. */
  const builders = { habits: 'pgRenderHabits', hobbies: 'pgRenderHobbies', detail: 'pgRenderDetail', reading: 'pgRenderReading', readingItem: 'pgRenderReadingItem', records: 'pgRenderRecords', activity: 'pgRenderActivity' };
  const fn = builders[pgView] && typeof window[builders[pgView]] === 'function' ? window[builders[pgView]] : null;
  if (fn) return fn();
  return pgRenderPlaceholder(PG_SOON[pgView] ? pgView : 'habits');
}

/* Trackers: the shipped tracker page, unchanged apart from its header (it is
   now a child of the Hub) and the Back control. */
function pgRenderTrackers() {
  const pg = ensurePersonalGrowth(), filter = pg.filter || 'all';
  const focusSel = pgFocusSelector(document.activeElement);
  const prevScroll = (view.querySelector('.pg-filters') || {}).scrollLeft || 0;

  const filtered = pg.trackers.filter(t => (filter === 'all' || t.category === filter) && (!pg.favoritesOnly || t.favorite));
  const chips = [
    pgChipHTML({ label: 'All', glyph: '✧', pressed: filter === 'all' && !pg.favoritesOnly, attrs: 'data-pg-filter="all"' }),
    ...Object.entries(PERSONAL_GROWTH_CATEGORIES).map(([k, c]) => pgChipHTML({ label: c.label, glyph: c.icon, catKey: k, pressed: filter === k && !pg.favoritesOnly, attrs: `data-pg-filter="${k}"` })),
    pgChipHTML({ label: 'Favorites', glyph: '★', pressed: pg.favoritesOnly, attrs: 'id="pgFavoritesFilter"' })
  ].join('');
  const list = filtered.length
    ? `<ul class="pg-rows">${filtered.map(t => pgRowMarkup(pgRowModel(t))).join('')}</ul>`
    : pgEmptyMarkup(pg.trackers.length ? 'filtered' : 'none');
  /* The timer starts a page load at the default; take the saved length once,
     unless it is already running. After that only Set time, Reset and a finished
     session change it. */
  if (!pgFocusSynced) { pgFocusSynced = true; if (!focusRunning) focusSeconds = focusDurationSeconds(); }
  const timer = { timer: formatTimer(focusSeconds), running: focusRunning, minutes: focusMinutes(), status: focusRunning ? 'Running' : (focusSeconds < focusDurationSeconds() ? 'Paused' : 'Ready') };

  view.innerHTML = `<div class="pg-theme pg-page pg-accent-green"><div class="pg-page__inner">
    ${pgBackMarkup()}
    ${pgHeroMarkup({ title: 'Trackers', sub: 'Track your progress day by day', iconSrc: asset('icons/navigation/NAV_GROWTH.png'), scene: 'trackers' })}
    <div class="pg-layout">
      <div class="pg-side">${pgSummaryMarkup(pgSummaryModel(pg.trackers))}${pgFocusMarkup(timer)}</div>
      <div class="pg-main"><section class="pg-shell pg-trackers" aria-labelledby="pgTrackersTitle">
        <div class="pg-trackers__head"><div><h2 class="pg-section__title" id="pgTrackersTitle" tabindex="-1">Your trackers</h2><p class="pg-meta pg-trackers__count">${pg.trackers.length ? `${filtered.length} of ${pg.trackers.length} shown` : 'Nothing tracked yet'}</p></div>${pg.trackers.length ? '<button type="button" class="pg-btn pg-btn--primary pg-btn--compact" id="pgAddTracker"><span aria-hidden="true">+</span> Add tracker</button>' : ''}</div>
        ${pg.trackers.length ? `<div class="pg-filters" role="group" aria-label="Filter trackers by category">${chips}</div>` : ''}
        ${list}
      </section></div>
    </div>
  </div></div>`;

  pgBindNav();
  document.querySelectorAll('[data-pg-filter]').forEach(b => b.onclick = () => { pg.filter = b.dataset.pgFilter; pg.favoritesOnly = false; save(); renderPersonalGrowth(); });
  const ff = document.querySelector('#pgFavoritesFilter'); if (ff) ff.onclick = () => { pg.favoritesOnly = !pg.favoritesOnly; save(); renderPersonalGrowth(); };
  /* One delegated handler for the rows: a day button, a favourite star, Details or Delete. The
     rows can then be patched one at a time without rebinding anything. The same handler
     serves the Habits and Hobbies pages (v0.02.52). */
  const rowsEl = document.querySelector('.pg-rows');
  if (rowsEl) rowsEl.onclick = pgRowsClick;
  const add = document.querySelector('#pgAddTracker'); if (add) add.onclick = pgAddTrackerModal;
  const addEmpty = document.querySelector('#pgEmptyAdd'); if (addEmpty) addEmpty.onclick = pgAddTrackerModal;
  const clear = document.querySelector('#pgClearFilter'); if (clear) clear.onclick = () => { pg.filter = 'all'; pg.favoritesOnly = false; save(); renderPersonalGrowth(); };
  bindFocusTools();
  const setTime = document.querySelector('#focusSetTime'); if (setTime && !setTime.disabled) setTime.onclick = pgFocusTimeModal;

  const fs = view.querySelector('.pg-filters');
  if (fs) {
    fs.scrollLeft = prevScroll;
    const on = fs.querySelector('[aria-pressed="true"]');
    if (on) {
      const r = on.getBoundingClientRect(), fr = fs.getBoundingClientRect();
      if (r.left < fr.left || r.right > fr.right - 28) on.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }
  if (focusSel) { const el = view.querySelector(focusSel); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}

function pgRowsClick(e) {
  const pg = ensurePersonalGrowth();
  const orb = e.target.closest('[data-pg-orb]');
  if (orb) { if (!orb.disabled) pgLogTracker(orb.dataset.pgOrb, orb.dataset.date); return; }
  const del = e.target.closest('[data-pg-delete]');
  if (del) { pgConfirmDelete(del.dataset.pgDelete); return; }
  const det = e.target.closest('[data-pg-detail]');
  if (det) { if (typeof pgOpenDetail === 'function') pgOpenDetail(det.dataset.pgDetail, pgView); return; }
  const fav = e.target.closest('[data-pg-favorite]');
  if (fav) {
    const t = pg.trackers.find(x => String(x.id) === fav.dataset.pgFavorite);
    if (!t) return;
    t.favorite = !t.favorite;
    save();
    if (pg.favoritesOnly || !pgPatchRow(t.id)) renderPersonalGrowth();
  }
}

/* Update one tracker's row (and the summary strip) in place instead of
   rebuilding the whole page. Logging a day and toggling a favourite are the
   frequent actions; a full render costs time proportional to the whole list
   (style and layout dominate), a row patch does not. Returns false when the
   change could alter which rows are shown, so the caller falls back to a full
   render. Keyboard focus stays on the same control. */
function pgPatchRow(id) {
  const pg = ensurePersonalGrowth(), t = pg.trackers.find(x => String(x.id) === String(id));
  const li = document.querySelector(`.pg-row[data-pg-id="${CSS.escape(String(id))}"]`);
  if (!t || !li) return false;
  const focusSel = pgFocusSelector(document.activeElement);
  li.outerHTML = pgRowMarkup(pgRowModel(t));
  const sum = document.querySelector('.pg-summary');
  if (sum) sum.outerHTML = typeof pgScopedSummaryHTML === 'function' ? pgScopedSummaryHTML() : pgSummaryMarkup(pgSummaryModel(pg.trackers));
  if (focusSel) { const el = document.querySelector(focusSel); if (el && !el.disabled) el.focus({ preventScroll: true }); }
  return true;
}

/* Focus length: the saved session length for the Focus timer. Whole minutes,
   1 to 180. Saving resets the timer to the new length, so it is only offered
   while the timer is not running. */
let pgFocusSynced = false;
const PG_FOCUS_PRESETS = [5, 10, 15, 25, 30, 45, 60, 90];
function pgFocusTimeModal() {
  if (focusRunning) return;
  const cur = focusMinutes();
  pgModal({
    title: 'Focus length', sub: 'How long each focus session runs', size: 'sm', glyph: '◔',
    body: `<div class="pg-form"><div class="pg-chips" role="group" aria-label="Common lengths">${PG_FOCUS_PRESETS.map(m => `<button type="button" class="pg-chip" data-pg-min="${m}" aria-pressed="${m === cur}">${m} min</button>`).join('')}</div>${pgInputFieldHTML({ id: 'pgFocusMinutes', label: 'Minutes', type: 'number', value: cur, help: `Whole minutes, ${FOCUS_MIN_MINUTES} to ${FOCUS_MAX_MINUTES}. Saving resets the timer to the new length. Sessions of 25 minutes or more earn Wisdom XP; shorter ones do not.`, attrs: `min="${FOCUS_MIN_MINUTES}" max="${FOCUS_MAX_MINUTES}" step="1" inputmode="numeric"` })}</div>`,
    actions: '<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button><button type="button" class="pg-btn pg-btn--primary" id="pgFocusSave">Save</button>',
    focus: '#pgFocusMinutes'
  });
  const input = modalRoot.querySelector('#pgFocusMinutes');
  const chips = [...modalRoot.querySelectorAll('[data-pg-min]')];
  const sync = () => chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.pgMin === String(input.value).trim())));
  input.addEventListener('input', () => { pgFieldError('pgFocusMinutes', ''); sync(); });
  chips.forEach(c => c.onclick = () => { input.value = c.dataset.pgMin; pgFieldError('pgFocusMinutes', ''); sync(); });
  modalRoot.querySelector('#pgFocusSave').onclick = () => {
    const v = Number(String(input.value).trim());
    if (String(input.value).trim() === '' || !Number.isInteger(v) || v < FOCUS_MIN_MINUTES || v > FOCUS_MAX_MINUTES) {
      pgFieldError('pgFocusMinutes', `Enter a whole number of minutes from ${FOCUS_MIN_MINUTES} to ${FOCUS_MAX_MINUTES}.`);
      input.focus();
      return;
    }
    ensurePersonalGrowth().focusMinutes = v;
    save();
    focusSeconds = v * 60;
    closeModal();
    renderPersonalGrowth();
    pgAnnounce(`Focus length set to ${v} minutes`);
  };
}

/* Delete a tracker. There is no undo, so it is a deliberate two-step: an
   alertdialog that names the tracker and what goes with it, with Cancel focused
   first. Nothing else stores a tracker id (the Home schedule rows and the Hub
   are derived on every render, and the one rule resolver that names a tracker,
   resolvePersonalGrowthEvidence, already treats a missing tracker as zero), so
   removing the record is the whole change. */
function pgConfirmDelete(id) {
  const pg = ensurePersonalGrowth(), t = pg.trackers.find(x => String(x.id) === String(id));
  if (!t) return;
  const catKey = PERSONAL_GROWTH_CATEGORIES[t.category] ? t.category : 'personalGoals';
  const days = pgTrackerStats(t).total;
  pgModal({
    title: `Delete ${t.name}?`, sub: 'This cannot be undone', accentClass: `pg-cat-${catKey}`, glyph: PERSONAL_GROWTH_CATEGORIES[catKey].icon,
    size: 'sm', role: 'alertdialog', describedBy: 'pgDelText',
    body: `<p class="pg-dialog__text" id="pgDelText">This permanently removes the tracker${days ? ` and its ${days} logged ${days === 1 ? 'day' : 'days'}, including the streaks and totals built from them` : ''}.</p>`,
    actions: '<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button><button type="button" class="pg-btn pg-btn--danger pg-btn--solid" id="pgDeleteConfirm">Delete tracker</button>',
    focus: '.pg-dialog__foot [data-pg-close]'
  });
  let done = false;
  modalRoot.querySelector('#pgDeleteConfirm').onclick = () => {
    if (done) return;
    done = true;
    const i = pg.trackers.findIndex(x => String(x.id) === String(id));
    if (i < 0) { closeModal(); return; }
    const name = pg.trackers[i].name;
    pg.trackers.splice(i, 1);
    save();
    closeModal();
    renderPersonalGrowth();
    const heading = document.querySelector('#pgTrackersTitle');
    if (heading) heading.focus({ preventScroll: true });
    pgAnnounce(`${name} deleted`);
    toast(`${name} deleted.`);
  };
}

/* Log or toggle one day. Completion trackers toggle; everything else opens
   the value dialog. The data rules are exactly the previous ones. */
function pgLogTracker(id, date) {
  const pg = ensurePersonalGrowth(), t = pg.trackers.find(x => String(x.id) === String(id));
  if (!t) return;
  t.entries = t.entries || {};
  const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  if (t.method === 'completion') {
    t.entries[date] = !Boolean(t.entries[date]);
    save();
    if (!pgPatchRow(t.id)) renderPersonalGrowth();
    pgAnnounce(`${t.name} ${t.entries[date] ? 'logged' : 'cleared'} for ${dayLabel}`);
    return;
  }
  const catKey = PERSONAL_GROWTH_CATEGORIES[t.category] ? t.category : 'personalGoals';
  const cat = PERSONAL_GROWTH_CATEGORIES[catKey];
  const existing = t.entries[date] ?? '';
  const unit = t.unit ? ` (${t.unit})` : '';
  pgModal({
    title: `Log ${t.name}`, sub: `${cat.label} · ${dayLabel}`, accentClass: `pg-cat-${catKey}`, glyph: cat.icon, size: 'sm',
    body: `<div class="pg-form">${pgInputFieldHTML({ id: 'pgLogValue', label: `Value${unit}`, type: 'number', value: existing, help: t.goal ? `Goal: ${t.goal}${t.unit ? ` ${t.unit}` : ''}. Enter 0 or more.` : 'Enter 0 or more.', attrs: 'min="0" step="any" inputmode="decimal"' })}</div>`,
    actions: '<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button><button type="button" class="pg-btn pg-btn--primary" id="pgSaveLog">Save</button>',
    focus: '#pgLogValue'
  });
  const input = modalRoot.querySelector('#pgLogValue');
  input.addEventListener('input', () => pgFieldError('pgLogValue', ''));
  modalRoot.querySelector('#pgSaveLog').onclick = () => {
    const v = Number(input.value);
    if (!Number.isFinite(v) || v < 0) { pgFieldError('pgLogValue', 'Enter a valid number, 0 or more.'); input.focus(); return; }
    t.entries[date] = v;
    save();
    closeModal();
    if (!pgPatchRow(t.id)) renderPersonalGrowth();
    pgAnnounce(`${t.name} logged for ${dayLabel}: ${v}${t.unit ? ` ${t.unit}` : ''}`);
  };
}

function pgFieldError(id, msg) {
  const input = modalRoot.querySelector(`#${id}`), err = modalRoot.querySelector(`#${id}Error`);
  if (!input || !err) return;
  err.textContent = msg;
  err.hidden = !msg;
  if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
}

function pgAddTrackerModal(opts) {
  /* opts: { scope: [categoryKeys], noun: 'habit' | 'hobby' }. The Trackers page passes the click
     event (or nothing), which is ignored: everything is offered. */
  const scope = opts && Array.isArray(opts.scope) ? opts.scope : null, noun = opts && opts.noun ? opts.noun : 'tracker';
  const groups = Object.entries(PERSONAL_GROWTH_PRESETS).filter(([key]) => !scope || scope.includes(key)).map(([key, items]) => {
    const cat = PERSONAL_GROWTH_CATEGORIES[key];
    const rows = items.map((x, i) => {
      const meta = x[1] === 'completion' ? 'Yes / no' : `${x[1] === 'progress' ? 'Progress' : 'Duration'} · ${x[2]} ${x[3]}`;
      return `<li><button type="button" class="pg-preset" data-pg-preset="${key}:${i}"><span class="pg-preset__name">${esc(x[0])}</span><span class="pg-preset__meta">${esc(meta)}</span><span class="pg-preset__add" aria-hidden="true">+</span></button></li>`;
    }).join('');
    return `<section class="pg-preset-group pg-cat-${key}" aria-labelledby="pgGroup-${key}"><h3 class="pg-preset-group__title" id="pgGroup-${key}">${pgMedallionHTML({ glyph: cat.icon, size: 'sm' })}${esc(cat.label)}</h3><ul class="pg-preset-list">${rows}</ul></section>`;
  }).join('');
  pgModal({
    title: `Add a ${noun}`, sub: `Choose a premade ${noun} or create your own. They use shared category artwork rather than one icon per activity.`, size: 'wide',
    body: `<div class="pg-presets">${groups}</div>`,
    actions: '<button type="button" class="pg-btn pg-btn--primary" id="pgAddCustom"><span aria-hidden="true">+</span> Add your own</button>'
  });
  let added = false;
  modalRoot.querySelectorAll('[data-pg-preset]').forEach(b => b.onclick = () => {
    if (added) return;
    added = true;
    const [cat, idx] = b.dataset.pgPreset.split(':'), x = PERSONAL_GROWTH_PRESETS[cat][Number(idx)];
    pgCreateTracker({ name: x[0], category: cat, method: x[1], goal: x[2], unit: x[3] });
    closeModal();
    renderPersonalGrowth();
    toast(`${x[0]} added.`);
  });
  modalRoot.querySelector('#pgAddCustom').onclick = () => pgCustomTrackerModal(opts && Array.isArray(opts.scope) ? opts : null);
}

function pgCustomTrackerModal(opts) {
  const scope = opts && Array.isArray(opts.scope) ? opts.scope : null, noun = opts && opts.noun ? opts.noun : 'tracker';
  const cats = Object.entries(PERSONAL_GROWTH_CATEGORIES).filter(([k]) => !scope || scope.includes(k)).map(([k, c]) => [k, c.label]);
  const days = PG_DAY_LETTERS.split('').map((d, i) => `<label class="pg-daychip"><input type="checkbox" data-pg-day="${i}" checked><span aria-hidden="true">${d}</span><span class="pg-sr">${PG_DAY_NAMES[i]}</span></label>`).join('');
  pgModal({
    title: 'Add your own', sub: noun === 'tracker' ? 'Create a tracker for anything you want to keep doing.' : `Create a ${noun} of your own.`, size: 'wide',
    body: `<div class="pg-form">
      ${pgInputFieldHTML({ id: 'pgCustomName', label: 'Name', placeholder: 'My tracker', help: 'Required. Up to 60 characters.', attrs: 'maxlength="60" autocomplete="off" required aria-required="true"' })}
      ${pgSelectFieldHTML({ id: 'pgCustomCategory', label: 'Category', options: cats })}
      ${pgSelectFieldHTML({ id: 'pgCustomMethod', label: 'Tracking method', options: PG_METHOD_OPTIONS, help: 'Yes / no, or a number you record each time.' })}
      <div class="pg-form__row">
        ${pgInputFieldHTML({ id: 'pgCustomGoal', label: 'Goal', type: 'number', value: '1', help: 'Target for each check-in. Use 0 for no target.', attrs: 'min="0" step="any" inputmode="decimal"' })}
        ${pgInputFieldHTML({ id: 'pgCustomUnit', label: 'Unit', placeholder: 'min, pages, etc', optional: true, attrs: 'maxlength="16" autocomplete="off"' })}
      </div>
      ${pgSelectFieldHTML({ id: 'pgCustomFrequency', label: 'Frequency', options: PG_FREQUENCY_OPTIONS, help: 'The days below are used when Frequency is Selected days.' })}
      <fieldset class="pg-daychips"><legend>Scheduled days</legend>${days}</fieldset>
    </div>`,
    actions: `<button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button><button type="button" class="pg-btn pg-btn--primary" id="pgCreateCustom">Create ${noun}</button>`,
    focus: '#pgCustomName',
    isDirty: dialog => dialog.querySelector('#pgCustomName').value.trim() !== '' || dialog.querySelector('#pgCustomUnit').value.trim() !== ''
  });
  const nameInput = modalRoot.querySelector('#pgCustomName');
  nameInput.addEventListener('input', () => pgFieldError('pgCustomName', ''));
  const create = modalRoot.querySelector('#pgCreateCustom');
  create.onclick = () => {
    if (create.getAttribute('aria-busy') === 'true') return;
    const name = nameInput.value.trim();
    if (!name) { pgFieldError('pgCustomName', 'Give your tracker a name.'); nameInput.focus(); return; }
    create.setAttribute('aria-busy', 'true');
    const scheduledDays = [...modalRoot.querySelectorAll('[data-pg-day]:checked')].map(x => Number(x.dataset.pgDay));
    pgCreateTracker({
      name,
      category: modalRoot.querySelector('#pgCustomCategory').value,
      method: modalRoot.querySelector('#pgCustomMethod').value,
      goal: Number(modalRoot.querySelector('#pgCustomGoal').value || 0),
      unit: modalRoot.querySelector('#pgCustomUnit').value.trim(),
      frequency: modalRoot.querySelector('#pgCustomFrequency').value,
      scheduledDays
    });
    closeModal();
    renderPersonalGrowth();
    toast(`${name} added.`);
  };
}

/* Accessible dialog: role, label, focus in and contained, background inert,
   Escape, focus restored to the opener. Mirrors questsModal(); the
   .modal-backdrop class stays for stacking and the keyboard viewport sync.
   opts.isDirty(dialog) stops a backdrop click from silently discarding
   meaningful input (the close button, Cancel and Escape are the explicit
   ways out). */
let pgOriginSel = null;
function pgFocusable(root) {
  return [...root.querySelectorAll('button:not([disabled]),[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null || el === document.activeElement);
}
function pgModal(opts) {
  const replacing = Boolean(modalRoot.querySelector('.pg-dialog'));
  const launcher = replacing ? null : document.activeElement;
  const launcherSel = replacing ? pgOriginSel : pgFocusSelector(launcher);
  pgOriginSel = launcherSel;
  closeModal();
  modalRoot.innerHTML = pgDialogHTML(opts);
  const backdrop = modalRoot.querySelector('.modal-backdrop'), dialog = modalRoot.querySelector('.pg-dialog');
  if (dialog.querySelector('input,textarea,select')) backdrop.classList.add('keyboard-aware');
  modalRoot.querySelectorAll('[data-pg-close]').forEach(b => b.onclick = closeModal);
  backdrop.onclick = e => {
    if (e.target !== e.currentTarget) return;
    if (opts.isDirty && opts.isDirty(dialog)) return;
    closeModal();
  };
  const shell = document.querySelector('#appShell');
  if (shell && 'inert' in shell) shell.inert = true;
  const onKey = e => {
    if (!dialog.isConnected) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    const f = pgFocusable(dialog);
    if (!f.length) { e.preventDefault(); dialog.focus(); return; }
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!dialog.contains(a) || (e.shiftKey && (a === first || a === dialog))) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey, true);
  modalCleanup = () => {
    document.removeEventListener('keydown', onKey, true);
    if (shell && 'inert' in shell) shell.inert = false;
    setTimeout(() => {
      if (modalCleanup || modalRoot.querySelector('.pg-dialog')) return;
      const t = launcher && launcher.isConnected ? launcher : (launcherSel ? document.querySelector(launcherSel) : null);
      if (t && t.focus) t.focus({ preventScroll: true });
    }, 0);
  };
  bindModalViewport();
  const fine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
  const target = opts.focus ? dialog.querySelector(opts.focus) : null;
  (target && (fine || !/^(input|textarea)$/i.test(target.tagName)) ? target : dialog).focus({ preventScroll: true });
}
