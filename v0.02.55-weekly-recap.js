/* Weekly Recap (RPG-0061). Astra, 2026-09-25.
   A READ-ONLY summary of one Monday-to-Sunday week, worked out on every render from data other
   systems already own: Training activities and personal bests, Quests (Daily, Side, Quick),
   Personal Growth check-ins and reading, Self Care days, and achievements earned. It stores
   nothing, writes nothing and grants nothing.

   DECISIONS (flagged in docs/WEEKLY_RECAP.md):
   - It lives in the Adventurer's Log (the journal) as a card that opens the full recap, with a
     This week / Last week switch; on a Monday it is most useful to look back.
   - Missing data is neutral, never a miss: a part with nothing logged says "Nothing logged" (or is
     left out), and Self Care parts the player switched off do not appear at all.
   - "vs last week" appears only when at least one of the two weeks has something to compare.
   - Hidden Sleep achievements (SLP-SEX / SLP-MAS / SLP-HID) are NEVER listed here: the recap is a
     screen that gets shown to other people, and their privacy rule is absolute.
   Styles: styles/weekly-recap/00-recap.css. */

let recapOpen = false, recapOffset = 0;
function recapReset() { recapOpen = false; recapOffset = 0; }

/* ------------------------------------------------------------------ */
/* Derivation                                                          */
/* ------------------------------------------------------------------ */
function recapWeekDays(offset = 0) {
  const dow = (dateFromISO(todayISO()).getDay() + 6) % 7;
  const monday = addDays(todayISO(), -dow + 7 * offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
const recapMs = ms => { const d = new Date(ms); return isNaN(d) ? null : localISO(d); };
const RECAP_PRIVATE_ACH = /^SLP-(SEX|MAS|HID)-/;

function recapWeekData(days) {
  const set = new Set(days), inW = d => set.has(d), out = {};
  /* Training: completed activities */
  const acts = (state.activities || []).filter(a => a && a.completed && inW(a.date));
  out.sessions = acts.length;
  out.minutes = Math.round(acts.reduce((n, a) => n + (Number(a.duration) || 0), 0));
  out.km = Math.round(acts.reduce((n, a) => n + (Number(a.distance) || 0), 0) * 10) / 10;
  out.types = [...new Set(acts.map(a => a.type).filter(Boolean))];
  const recs = (state.training && Array.isArray(state.training.records)) ? state.training.records : [];
  out.records = recs.filter(r => r && r.date && inW(r.date)).length;
  /* Quests */
  const qh = Array.isArray(state.questHistory) ? state.questHistory : [];
  out.daily = new Set(qh.filter(q => q && (q.type === 'completed' || q.type === 'completed-early') && inW(q.date)).map(q => q.date)).size;
  out.dailyTitles = qh.filter(q => q && (q.type === 'completed' || q.type === 'completed-early') && inW(q.date)).length;
  out.side = (Array.isArray(state.sideQuestHistory) ? state.sideQuestHistory : []).filter(x => x && inW(x.date)).length;
  out.quick = typeof qqItems === 'function' ? qqItems().filter(x => x.status === 'completed' && x.completedAt && inW(recapMs(x.completedAt))).length : 0;
  out.quests = out.dailyTitles + out.side + out.quick;
  /* Personal Growth */
  let checkins = 0, habits = 0;
  (typeof ensurePersonalGrowth === 'function' ? ensurePersonalGrowth().trackers : []).forEach(t => {
    let n = 0; days.forEach(d => { if (pgEntryComplete(t, d)) n++; });
    if (n) { checkins += n; habits++; }
  });
  out.checkins = checkins; out.habitsLogged = habits;
  let pages = 0, listenMin = 0, readMin = 0, finished = 0;
  (typeof rdItems === 'function' ? rdItems() : []).forEach(it => {
    rdSessions(it).forEach(s => { if (!inW(s.date)) return; if (rdIsAudio(it)) listenMin += Number(s.amount) || 0; else { pages += Number(s.amount) || 0; readMin += Number(s.minutes) || 0; } });
    if (it.status === 'finished' && it.finishedAt && inW(it.finishedAt)) finished++;
  });
  out.pages = Math.round(pages); out.readingMin = Math.round(listenMin + readMin); out.finishedBooks = finished;
  /* Self Care (only parts the player has switched on; unlogged days are simply not counted) */
  out.selfCare = null;
  if (typeof selfCareHistoryRows === 'function') {
    const rows = selfCareHistoryRows(40).filter(r => inW(r.date));
    const sc = { water: null, food: null, sleep: null };
    rows.forEach(r => {
      if (r.water) { sc.water = sc.water || { met: 0, logged: 0 }; if (r.water.ml > 0) sc.water.logged++; if (r.water.met) sc.water.met++; }
      if (r.food) { sc.food = sc.food || { met: 0, logged: 0 }; if (r.food.met === true) sc.food.met++; if (r.food.met !== null && r.food.met !== undefined) sc.food.logged++; }
      if (r.sleep) { sc.sleep = sc.sleep || { met: 0, logged: 0 }; if (r.sleep.hours != null) sc.sleep.logged++; if (r.sleep.win) sc.sleep.met++; }
    });
    out.selfCare = sc;
  }
  /* Achievements earned this week (never the private sleep ones) */
  const ae = (typeof v023EnsureAchievementState === 'function') ? v023EnsureAchievementState() : { unlockedAchievements: [] };
  out.achievements = ae.unlockedAchievements
    .filter(u => u && !RECAP_PRIVATE_ACH.test(String(u.achievementId)) && inW(recapMs(Date.parse(u.unlockedAt))))
    .map(u => { const def = V023_ACHIEVEMENT_DEFINITIONS.find(d => d.achievementId === u.achievementId); return def ? { id: def.achievementId, name: def.name, rarity: def.rarity } : null; })
    .filter(Boolean);
  return out;
}
function recapModel(offset = 0) {
  const days = recapWeekDays(offset), cur = recapWeekData(days), prev = recapWeekData(recapWeekDays(offset - 1));
  const any = cur.sessions || cur.quests || cur.checkins || cur.pages || cur.readingMin || cur.achievements.length || cur.records || (cur.selfCare && ['water', 'food', 'sleep'].some(k => cur.selfCare[k] && cur.selfCare[k].logged));
  return { days, cur, prev, any: Boolean(any), label: offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `${pgShortDateSafe(days[0])} to ${pgShortDateSafe(days[6])}` };
}
function pgShortDateSafe(iso) { return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }

/* ------------------------------------------------------------------ */
/* Markup                                                              */
/* ------------------------------------------------------------------ */
function recapDelta(cur, prev, unit = '') {
  if (!(cur || prev)) return '';
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return '<span class="recap-delta">same as last week</span>';
  return `<span class="recap-delta ${d > 0 ? 'is-up' : 'is-down'}">${d > 0 ? '+' : '−'}${Math.abs(d)}${unit} vs last week</span>`;
}
function recapTile(label, value, delta = '', note = '') {
  return `<div class="recap-tile"><span class="recap-tile__val">${esc(value)}</span><span class="recap-tile__label">${esc(label)}</span>${delta}${note ? `<span class="recap-tile__note">${esc(note)}</span>` : ''}</div>`;
}
function recapSection(title, body, glyph) {
  return `<section class="rpg-frame minor recap-section"><h3 class="recap-section__title"><span aria-hidden="true">${glyph}</span> ${esc(title)}</h3>${body}</section>`;
}
function recapFormatMin(m) { m = Math.round(m); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; }
function recapPage() {
  const m = recapModel(recapOffset), c = m.cur, p = m.prev;
  const sections = [];
  sections.push(recapSection('Training', c.sessions
    ? `<div class="recap-grid">${recapTile('Sessions', c.sessions, recapDelta(c.sessions, p.sessions))}${recapTile('Time', recapFormatMin(c.minutes))}${c.km ? recapTile('Distance', `${c.km} km`, recapDelta(c.km, p.km, ' km')) : ''}${c.records ? recapTile('Records set', c.records) : ''}</div>${c.types.length ? `<p class="recap-note">${esc(c.types.join(' · '))}</p>` : ''}`
    : '<p class="recap-note">Nothing logged this week.</p>', '▣'));
  sections.push(recapSection('Quests', c.quests
    ? `<div class="recap-grid">${c.dailyTitles ? recapTile('Daily Quests', c.dailyTitles, recapDelta(c.dailyTitles, p.dailyTitles)) : ''}${c.side ? recapTile('Side Quests', c.side, recapDelta(c.side, p.side)) : ''}${c.quick ? recapTile('Quick Quests', c.quick, recapDelta(c.quick, p.quick)) : ''}</div>`
    : '<p class="recap-note">No quests completed this week.</p>', '❖'));
  sections.push(recapSection('Personal Growth', (c.checkins || c.pages || c.readingMin)
    ? `<div class="recap-grid">${c.checkins ? recapTile('Habit check-ins', c.checkins, recapDelta(c.checkins, p.checkins), `${c.habitsLogged} habit${c.habitsLogged === 1 ? '' : 's'} logged`) : ''}${c.readingMin ? recapTile('Reading time', recapFormatMin(c.readingMin), recapDelta(c.readingMin, p.readingMin, ' min')) : ''}${c.pages ? recapTile('Pages read', c.pages) : ''}${c.finishedBooks ? recapTile('Finished', c.finishedBooks, '', 'books') : ''}</div>`
    : '<p class="recap-note">Nothing logged this week.</p>', '✦'));
  const sc = c.selfCare;
  if (sc && ['water', 'food', 'sleep'].some(k => sc[k])) {
    const line = (k, label) => sc[k] ? recapTile(label, `${sc[k].met}`, '', sc[k].logged ? `of ${sc[k].logged} logged day${sc[k].logged === 1 ? '' : 's'}` : 'nothing logged') : '';
    sections.push(recapSection('Self Care', `<div class="recap-grid">${line('water', 'Water target days')}${line('food', 'Nourished days')}${line('sleep', 'Sleep in range')}</div><p class="recap-note">Days with nothing logged are skipped, never counted as a miss.</p>`, '♡'));
  }
  sections.push(recapSection('Achievements earned', c.achievements.length
    ? `<ul class="recap-ach">${c.achievements.slice(0, 12).map(a => `<li><span class="recap-ach__name">${esc(a.name)}</span><span class="recap-ach__rar">${esc(a.rarity)}</span></li>`).join('')}</ul>${c.achievements.length > 12 ? `<p class="recap-note">and ${c.achievements.length - 12} more</p>` : ''}`
    : '<p class="recap-note">None this week.</p>', '✧'));
  view.innerHTML = pageHeader('Weekly Recap', esc(m.label)) + `
    <div class="recap-page">
      <div class="recap-controls"><button type="button" class="text-btn" data-recap-back>← Adventurer's Log</button><div class="recap-switch" role="group" aria-label="Choose the week">
        <button type="button" class="rpg-btn small${recapOffset === 0 ? ' accent' : ''}" data-recap-week="0" aria-pressed="${recapOffset === 0}">This week</button>
        <button type="button" class="rpg-btn small${recapOffset === -1 ? ' accent' : ''}" data-recap-week="-1" aria-pressed="${recapOffset === -1}">Last week</button></div></div>
      <p class="recap-range">${esc(pgShortDateSafe(m.days[0]))} to ${esc(pgShortDateSafe(m.days[6]))}</p>
      ${m.any ? sections.join('') : `<section class="rpg-frame minor recap-section"><p class="recap-note">Nothing recorded for ${recapOffset === 0 ? 'this week' : 'that week'} yet. ${recapOffset === 0 ? 'Log a session, complete a quest or tick off a habit and it will show up here.' : ''}</p></section>${sections.slice(0, 0).join('')}`}
    </div>`;
  document.querySelector('[data-recap-back]').onclick = () => { recapOpen = false; renderTasks(); };
  document.querySelectorAll('[data-recap-week]').forEach(b => b.onclick = () => { recapOffset = Number(b.dataset.recapWeek); recapPage(); });
}

/* The card on the Adventurer's Log that opens it. */
function recapCardHTML() {
  const m = recapModel(0), c = m.cur;
  const bits = [];
  if (c.sessions) bits.push(`${c.sessions} session${c.sessions === 1 ? '' : 's'}`);
  if (c.quests) bits.push(`${c.quests} quest${c.quests === 1 ? '' : 's'}`);
  if (c.checkins) bits.push(`${c.checkins} check‑in${c.checkins === 1 ? '' : 's'}`);
  if (c.achievements.length) bits.push(`${c.achievements.length} achievement${c.achievements.length === 1 ? '' : 's'}`);
  return `<section class="rpg-frame minor recap-card"><div class="recap-card__text"><b>Weekly Recap</b><span>${bits.length ? esc(bits.join(' · ')) + ' this week' : 'Nothing logged yet this week'}</span></div><button type="button" class="rpg-btn small" data-recap-open>Open recap</button></section>`;
}
