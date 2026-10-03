/* Personal Growth: Records & Milestones and the unified activity feed (RPG-0052, RPG-0053).
   Astra, 2026-09-25. Loads after v0.02.52 / v0.02.53.

   Both are DERIVED, like the Hub: nothing new is stored. Records and milestones are computed on
   every render from the tracker entries and the Reading Nook sessions, so they can never drift from
   the data, and deleting a log removes the record it made.

   DECISIONS (flagged for Lyra / Aurelia in docs/PERSONAL_GROWTH_PHASE2.md):
   - "Records" are personal bests: a tracker's longest streak and best single day, and the reading
     records (books finished, most pages in a day, longest reading streak).
   - "Milestones" are thresholds earned, dated by the day they were reached: check-ins
     1/10/25/50/100/250/500/1000, streaks 7/14/30/60/100/365 days, books finished 1/5/10/25/50, pages
     read 100/500/1000/5000/10000. They are NOT achievements: no popup, no reward, no XP, and nothing
     here feeds the Achievement catalogue (the handover: "without duplicating the Achievement
     catalogue"). A tracker with data shows its next milestone as a plain "n to go" line.
   - The feed merges every Personal Growth source through the existing PG_HUB_SOURCES.activity()
     adapters, so a future source only registers there. */

const PG_CHECKIN_STEPS = [1, 10, 25, 50, 100, 250, 500, 1000];
const PG_STREAK_STEPS = [7, 14, 30, 60, 100, 365];
const RD_BOOK_STEPS = [1, 5, 10, 25, 50];
const RD_PAGE_STEPS = [100, 500, 1000, 5000, 10000];
let pgFeedFilter = 'all';

/* ------------------------------------------------------------------ */
/* Derivation (pure, from state)                                       */
/* ------------------------------------------------------------------ */
/* Runs of consecutive SCHEDULED days that were completed: [{len, start, end}] in date order. */
function pgStreakSpans(t) {
  const dates = pgCompleteDates(t), spans = [];
  let run = null;
  dates.forEach(d => {
    if (run && pgNextScheduled(t, run.end) === d) { run.len++; run.end = d; }
    else { run = { len: 1, start: d, end: d }; spans.push(run); }
  });
  return spans;
}
/* the next scheduled date after `iso` (max 8 days ahead) */
function pgNextScheduled(t, iso) {
  for (let i = 1; i <= 8; i++) { const d = addDays(iso, i); if (pgScheduledOn(t, d)) return d; }
  return null;
}
/* the date on which a streak first reached `n` */
function pgStreakReachedOn(t, n) {
  for (const sp of pgStreakSpans(t)) {
    if (sp.len < n) continue;
    let d = sp.start;
    for (let i = 1; i < n; i++) d = pgNextScheduled(t, d);
    return d;
  }
  return null;
}
function rdReadingDays(items) {
  const set = new Set();
  items.forEach(it => rdSessions(it).forEach(s => set.add(s.date)));
  return [...set].sort();
}
function rdBestReadingStreak(days) {
  let best = 0, run = 0, prev = null;
  days.forEach(d => { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  return best;
}

function pgRecordsModel() {
  const records = [], milestones = [], next = [];
  const trackers = ensurePersonalGrowth().trackers;
  trackers.forEach(t => {
    const dates = pgCompleteDates(t);
    if (!dates.length) return;
    const cat = PERSONAL_GROWTH_CATEGORIES[t.category] || PERSONAL_GROWTH_CATEGORIES.personalGoals;
    const open = `detail:${t.id}`, glyph = cat.icon;
    const spans = pgStreakSpans(t), best = spans.reduce((b, s) => (s.len > b.len ? s : b), { len: 0 });
    if (best.len >= 2) records.push({ id: `streak:${t.id}`, glyph, title: t.name, meta: `Longest streak · ${pgShortDate(best.start)} to ${pgShortDate(best.end)}`, value: `${best.len} days`, sort: best.len, open });
    if (t.method !== 'completion' && t.method !== 'rating' && t.method !== 'progress') {
      let top = null;
      dates.forEach(d => { const v = Number(t.entries[d]) || 0; if (!top || v > top.v) top = { d, v }; });
      if (top && top.v > 0 && dates.length >= 2) records.push({ id: `best:${t.id}`, glyph, title: t.name, meta: `Best day · ${pgShortDate(top.d)}`, value: pgFormatValue(t, top.v), sort: 0, open });
    }
    PG_CHECKIN_STEPS.forEach(n => { if (dates.length >= n) milestones.push({ id: `ci:${t.id}:${n}`, glyph, title: `${n} ${n === 1 ? 'check‑in' : 'check‑ins'}`, meta: t.name, date: dates[n - 1], open }); });
    PG_STREAK_STEPS.forEach(n => { const d = pgStreakReachedOn(t, n); if (d) milestones.push({ id: `st:${t.id}:${n}`, glyph: '✦', title: `${n}-day streak`, meta: t.name, date: d, open }); });
    const nextCi = PG_CHECKIN_STEPS.find(n => n > dates.length);
    if (nextCi) next.push({ id: `nx:${t.id}`, glyph, title: t.name, meta: `${nextCi - dates.length} more check‑in${nextCi - dates.length === 1 ? '' : 's'} to reach ${nextCi}`, ratio: dates.length / nextCi, open });
  });
  /* reading */
  const items = rdItems();
  const finished = items.filter(x => x.status === 'finished' && x.finishedAt).sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const ropen = it => (it ? `book:${it.id}` : '');
  if (finished.length) records.push({ id: 'rd:finished', glyph: '▤', title: 'Books and audiobooks finished', meta: 'Reading Nook', value: String(finished.length), sort: finished.length, open: '' });
  const bookSessions = [];
  items.filter(x => !rdIsAudio(x)).forEach(it => rdSessions(it).forEach(s => bookSessions.push({ d: s.date, a: Number(s.amount) || 0, it })));
  const perDay = {};
  bookSessions.forEach(s => { perDay[s.d] = (perDay[s.d] || 0) + s.a; });
  const topDay = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0];
  if (topDay && topDay[1] > 0 && Object.keys(perDay).length >= 2) records.push({ id: 'rd:pagesday', glyph: '▤', title: 'Most pages in a day', meta: pgShortDate(topDay[0]), value: `${Math.round(topDay[1])} pages`, sort: 0, open: '' });
  const rdBest = rdBestReadingStreak(rdReadingDays(items));
  if (rdBest >= 2) records.push({ id: 'rd:streak', glyph: '▤', title: 'Longest reading streak', meta: 'Reading Nook', value: `${rdBest} days`, sort: rdBest, open: '' });
  RD_BOOK_STEPS.forEach(n => { if (finished.length >= n) milestones.push({ id: `rb:${n}`, glyph: '▤', title: n === 1 ? 'First book finished' : `${n} books finished`, meta: finished[n - 1].title, date: finished[n - 1].finishedAt, open: ropen(finished[n - 1]) }); });
  let cum = 0;
  const byDate = bookSessions.slice().sort((a, b) => a.d.localeCompare(b.d));
  const steps = RD_PAGE_STEPS.slice();
  byDate.forEach(s => { cum += s.a; while (steps.length && cum >= steps[0]) { const n = steps.shift(); milestones.push({ id: `rp:${n}`, glyph: '▤', title: `${n.toLocaleString()} pages read`, meta: 'Reading Nook', date: s.d, open: '' }); } });
  milestones.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  records.sort((a, b) => b.sort - a.sort || a.id.localeCompare(b.id));
  next.sort((a, b) => b.ratio - a.ratio);
  return { records, milestones, next: next.slice(0, 3) };
}

/* ------------------------------------------------------------------ */
/* Records page                                                        */
/* ------------------------------------------------------------------ */
function pgRecordRowHTML(r, showDate) {
  const inner = `${pgMedallionHTML({ glyph: r.glyph, size: 'sm' })}<span class="pg-record__text"><span class="pg-record__title">${esc(r.title)}</span><span class="pg-record__meta">${esc(showDate && r.date ? `${r.meta} · ${pgShortDate(r.date)}` : r.meta)}</span></span>${r.value ? `<span class="pg-record__val pg-num">${esc(r.value)}</span>` : ''}`;
  return r.open ? `<li><button type="button" class="pg-record" data-pg-open="${esc(r.open)}" data-pg-from="records">${inner}</button></li>` : `<li><div class="pg-record">${inner}</div></li>`;
}
function pgRenderRecords() {
  const m = pgRecordsModel(), focusSel = pgFocusSelector(document.activeElement);
  const empty = !m.records.length && !m.milestones.length;
  const longest = m.records.filter(r => /^streak:/.test(r.id)).reduce((b, r) => Math.max(b, r.sort), 0);
  const stats = [pgStatHTML(m.records.length, 'Records held'), pgStatHTML(m.milestones.length, 'Milestones reached'), pgStatHTML(longest || null, 'Longest streak', longest ? 'days' : '', longest ? '' : 'Log two days in a row')].join('');
  view.innerHTML = `<div class="pg-theme pg-page pg-accent-gold"><div class="pg-page__inner">
    ${pgBackMarkup()}
    ${pgHeroMarkup({ title: 'Records & Milestones', sub: 'Personal bests and moments worth remembering', iconSrc: asset(PG_SOON.records.art), glyph: '✦', compact: true })}
    ${empty ? `<section class="pg-shell pg-soon"><div class="pg-empty">${pgMedallionHTML({ glyph: '✦' })}<h2 class="pg-empty__title">Nothing recorded yet</h2><p class="pg-empty__text">Log a few days of a habit or hobby, or some reading, and your personal bests and milestones will appear here. They are worked out from what you log, so they stay accurate.</p><button type="button" class="pg-btn pg-btn--secondary" data-pg-go="habits">Open Habits</button></div></section>` : `
    <section class="pg-summary pg-summary--four" aria-label="Your records at a glance">${stats}</section>
    ${m.records.length ? `<section class="pg-shell" aria-labelledby="pgRecT"><h2 class="pg-section__title" id="pgRecT" tabindex="-1">Personal bests</h2><ul class="pg-records">${m.records.map(r => pgRecordRowHTML(r, false)).join('')}</ul></section>` : ''}
    ${m.next.length ? `<section class="pg-shell" aria-labelledby="pgNextT"><h2 class="pg-section__title" id="pgNextT">Next milestones</h2><ul class="pg-records">${m.next.map(r => pgRecordRowHTML(r, false)).join('')}</ul></section>` : ''}
    ${m.milestones.length ? `<section class="pg-shell" aria-labelledby="pgMilT"><h2 class="pg-section__title" id="pgMilT">Milestones reached</h2><ul class="pg-records">${m.milestones.slice(0, 40).map(r => pgRecordRowHTML(r, true)).join('')}</ul>${m.milestones.length > 40 ? `<p class="pg-meta">Showing the latest 40 of ${m.milestones.length}.</p>` : ''}</section>` : ''}`}
  </div></div>`;
  pgBindNav();
  if (focusSel) { const el = view.querySelector(focusSel); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}

PG_HUB_SOURCES.push({
  id: 'records',
  summary() { return { personalBests: pgRecordsModel().records.length }; },
  card() {
    const m = pgRecordsModel();
    return { status: m.records.length ? `${m.records.length} record${m.records.length === 1 ? '' : 's'}` : 'None yet', detail: m.milestones.length ? `${m.milestones.length} milestone${m.milestones.length === 1 ? '' : 's'}` : '', badge: '' };
  }
});

/* ------------------------------------------------------------------ */
/* Activity feed                                                       */
/* ------------------------------------------------------------------ */
const PG_FEED_FILTERS = [['all', 'All', null], ['habit', 'Habits', ['habit']], ['hobby', 'Hobbies', ['hobby']], ['reading', 'Reading', ['reading']], ['note', 'Notes', ['note']]];
const PG_FEED_DAYS = 90;
function pgRenderActivity() {
  const focusSel = pgFocusSelector(document.activeElement);
  const since = addDays(todayISO(), -PG_FEED_DAYS);
  const f = PG_FEED_FILTERS.find(x => x[0] === pgFeedFilter) || PG_FEED_FILTERS[0];
  const all = pgHubActivity(1000).filter(a => a.date >= since);
  const rows = all.filter(a => !f[2] || f[2].includes(a.sourceType));
  const groups = [];
  rows.forEach(a => { const g = groups[groups.length - 1]; if (g && g.date === a.date) g.rows.push(a); else groups.push({ date: a.date, when: a.when, rows: [a] }); });
  const chips = PG_FEED_FILTERS.map(([k, l, types]) => pgChipHTML({ label: `${l}${types ? ` (${all.filter(a => types.includes(a.sourceType)).length})` : ''}`, glyph: '◌', pressed: pgFeedFilter === k, attrs: `data-pg-feed="${k}"` })).join('');
  view.innerHTML = `<div class="pg-theme pg-page pg-accent-green"><div class="pg-page__inner">
    ${pgBackMarkup()}
    ${pgHeroMarkup({ title: 'Activity', sub: `Everything you logged in the last ${PG_FEED_DAYS} days`, iconSrc: asset('icons/navigation/NAV_GROWTH.png'), glyph: '◌', compact: true, scene: 'home' })}
    <section class="pg-shell" aria-labelledby="pgFeedT"><h2 class="pg-section__title" id="pgFeedT" tabindex="-1">Your activity</h2>
      <div class="pg-filters" role="group" aria-label="Filter the activity">${chips}</div>
      ${groups.length ? groups.map(g => `<h3 class="pg-feed-day">${esc(g.when)}</h3><ul class="pg-acts">${g.rows.map(pgActivityRowMarkup).join('')}</ul>`).join('') : `<p class="pg-meta pg-acts__empty">${all.length ? 'Nothing in this filter.' : 'No Personal Growth activity yet.'}</p>`}
    </section>
  </div></div>`;
  pgBindNav();
  document.querySelectorAll('[data-pg-feed]').forEach(b => b.onclick = () => { pgFeedFilter = b.dataset.pgFeed; renderPersonalGrowth(); });
  if (focusSel) { const el = view.querySelector(focusSel); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}
