/* First-run onboarding and the guided first goals (RPG-0063, RPG-0064). Astra, 2026-09-25.

   Two small pieces, both skippable, neither ever blocks the app:
     1. A short WELCOME TOUR (five cards) shown once to a brand-new player.
     2. YOUR FIRST STEPS: a checklist card on Home with six goals that are ticked ONLY by real actions.

   DECISIONS (flagged in docs/ONBOARDING.md for Lyra / Aurelia to overrule):
   - Only a genuinely NEW save gets the tour. A save that already has any history (level above 1, XP,
     completed activities, trackers, quest history or achievements) is marked `existing` on first
     contact and never sees it; it can replay the tour from Profile & Setup > Home.
   - "Without fake completion": a step is done only when the real thing happened (a saved name, a
     completed training session, a completed quest of any kind, a habit logged, water logged, the
     Character page opened). Nothing is ticked by reading a card. The Character step is the one
     informational step (its whole point is to look), and it says so.
   - No rewards. Nothing here grants XP, Gold, stats or achievements: the economy and progression
     are frozen, and inventing rewards for onboarding is exactly what "no fake completion" rules out.
   - Progressive: at most THREE unfinished steps are shown at a time; finished ones collapse to a count.
   - Additive state: `state.onboarding = { version, status: 'active'|'done'|'skipped'|'existing',
     startedAt, completedAt, hidden, tourSeen, nameSet, charViewed, goals: { id: epochMs } }`.
     A goal's completion time is recorded the first time it is seen done, so it never un-ticks.
   Styles: styles/onboarding/00-onboarding.css. */

const OB_GOALS = [
  { id: 'profile', title: 'Tell the app your name', why: 'It appears on your Character and Home.', done: () => Boolean(state.profile && state.profile.name && state.profile.name !== 'Player') || Boolean(state.onboarding && state.onboarding.nameSet), go: () => profileModal('profile'), cta: 'Open Profile' },
  { id: 'training', title: 'Log your first training session', why: 'A walk, a run or a workout: complete one in Training.', done: () => (state.activities || []).some(a => a && a.completed), go: () => setPage('training'), cta: 'Open Training' },
  { id: 'quest', title: 'Complete a quest', why: 'Any Daily, Side or Quick Quest counts.', done: () => (state.questHistory || []).some(q => q && (q.type === 'completed' || q.type === 'completed-early')) || (state.sideQuestHistory || []).length > 0 || (typeof quickQuestCompletedTotal === 'function' && quickQuestCompletedTotal() > 0), go: () => setPage('quests'), cta: 'Open Quests' },
  { id: 'habit', title: 'Start a habit', why: 'Add one in Personal Growth and log it once.', done: () => (typeof ensurePersonalGrowth === 'function' ? ensurePersonalGrowth().trackers : []).some(t => Object.keys(t.entries || {}).some(d => pgEntryComplete(t, d))), go: () => { setPage('personal-growth'); if (typeof pgGo === 'function') pgGo('habits'); }, cta: 'Open Habits' },
  { id: 'water', title: 'Log some water', why: 'Water lives on Home; one glass is a start.', done: () => Number(state.daily && state.daily.water) > 0 || (state.resourceHistory || []).some(r => Number(r.water) > 0), go: () => setPage('home'), cta: 'Go to Home' },
  { id: 'character', title: 'Meet your Character', why: 'Look at your stats. This step is just for looking.', done: () => Boolean(state.onboarding && state.onboarding.charViewed), go: () => setPage('character'), cta: 'Open Character' }
];
const OB_VISIBLE = 3;

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
function obIsFreshSave() {
  const pg = typeof ensurePersonalGrowth === 'function' ? ensurePersonalGrowth() : { trackers: [] };
  /* APP-LOG-001 (Welcome, Adventurer) is granted just for opening the app, before this check runs on a genuinely new save, so it must not count as history */
  const ae = (state.achievementEngine && Array.isArray(state.achievementEngine.unlockedAchievements) ? state.achievementEngine.unlockedAchievements : []).filter(a => !a || a.achievementId !== 'APP-LOG-001');
  return Number(state.level || 1) <= 1 && !Number(state.xp || 0) && !(state.activities || []).length && !pg.trackers.length && !(state.questHistory || []).length && !(state.sideQuestHistory || []).length && !ae.length;
}
function ensureOnboarding() {
  if (state.onboarding && typeof state.onboarding === 'object') {
    const o = state.onboarding;
    o.goals = o.goals && typeof o.goals === 'object' ? o.goals : {};
    return o;
  }
  state.onboarding = { version: 1, status: obIsFreshSave() ? 'active' : 'existing', startedAt: Date.now(), completedAt: null, hidden: false, tourSeen: false, nameSet: false, charViewed: false, goals: {} };
  save();
  return state.onboarding;
}
function obActive() { const o = ensureOnboarding(); return o.status === 'active' && !o.hidden; }
/* Record the first time each goal is seen done (never un-ticks). Returns true when something changed. */
function obSync() {
  const o = ensureOnboarding();
  if (o.status !== 'active') return false;
  let changed = false;
  OB_GOALS.forEach(g => { if (!o.goals[g.id] && g.done()) { o.goals[g.id] = Date.now(); changed = true; } });
  if (OB_GOALS.every(g => o.goals[g.id]) && !o.completedAt) { o.completedAt = Date.now(); changed = true; }
  if (changed) save();
  return changed;
}
function obNote(what) {
  const o = ensureOnboarding();
  if (what === 'character' && !o.charViewed) { o.charViewed = true; save(); }
}
function obDoneCount() { const o = ensureOnboarding(); return OB_GOALS.filter(g => o.goals[g.id]).length; }

/* ------------------------------------------------------------------ */
/* Home card                                                           */
/* ------------------------------------------------------------------ */
function onboardingCardHTML() {
  const o = ensureOnboarding();
  if (o.status !== 'active' || o.hidden) return '';
  obSync();
  const done = obDoneCount(), total = OB_GOALS.length;
  if (done === total) {
    return `<section class="rpg-frame minor ob-card" aria-labelledby="obT"><div class="ob-head"><h3 id="obT">You know your way around</h3></div><p class="ob-lede">Every first step is done, for real. Nothing more is asked of you here.</p><div class="ob-actions"><button type="button" class="rpg-btn small" data-ob-close>Close this card</button></div></section>`;
  }
  const open = OB_GOALS.filter(g => !o.goals[g.id]).slice(0, OB_VISIBLE);
  return `<section class="rpg-frame minor ob-card" aria-labelledby="obT">
    <div class="ob-head"><h3 id="obT">Your first steps</h3><span class="ob-count" aria-label="${done} of ${total} done">${done} of ${total}</span></div>
    <p class="ob-lede">A step is ticked only when you really do it. There are no rewards for these; they are just a way in.</p>
    <ul class="ob-list">${open.map(g => `<li class="ob-item"><span class="ob-box" aria-hidden="true"></span><span class="ob-text"><b>${esc(g.title)}</b><small>${esc(g.why)}</small></span><button type="button" class="rpg-btn small" data-ob-go="${g.id}">${esc(g.cta)}</button></li>`).join('')}</ul>
    <div class="ob-actions"><button type="button" class="text-btn" data-ob-hide>Hide for now</button></div>
  </section>`;
}
document.addEventListener('click', e => {
  const go = e.target.closest('[data-ob-go]');
  if (go) { const g = OB_GOALS.find(x => x.id === go.dataset.obGo); if (g) g.go(); return; }
  if (e.target.closest('[data-ob-hide]')) { ensureOnboarding().hidden = true; save(); if (page === 'home') renderHome(); toast('Hidden. Bring it back any time from Profile & Setup > Home.'); return; }
  if (e.target.closest('[data-ob-close]')) { const o = ensureOnboarding(); o.status = 'done'; o.completedAt = o.completedAt || Date.now(); save(); if (page === 'home') renderHome(); }
});

/* ------------------------------------------------------------------ */
/* Welcome tour                                                        */
/* ------------------------------------------------------------------ */
const OB_STEPS = [
  { title: 'Welcome', sub: 'Real Person Game', text: 'This app turns the real things you do into an adventure. Train, keep habits, read, look after yourself and take on quests, and your Character grows with you. It takes two minutes to find your feet, and you can skip any of it.' },
  { title: 'Four places to know', sub: 'Where things live', list: [['Training', 'log runs, walks and workouts'], ['Quests', 'daily, side and quick quests'], ['Personal Growth', 'habits, hobbies, reading and self care'], ['Character', 'your stats and progress']], text: 'Home is your dashboard. Tap the compass in the middle of the bottom bar to open the wheel of everything else.' },
  { title: 'What should we call you?', sub: 'Optional', name: true, text: 'This is only shown on your Character and Home, and it stays on your device. You can change it any time in Profile & Setup.' },
  { title: 'Your first steps', sub: 'A way in, not a test', text: 'On Home you will see a short checklist. A step is ticked only when you really do the thing, and there are no rewards for them. Hide it whenever you like; it comes back from Profile & Setup.' },
  { title: 'You are ready', sub: 'Have a good first day', text: 'Start anywhere. If you are not sure, pick the first step on Home.' }
];
function onboardingTour(i = 0) {
  const o = ensureOnboarding(), s = OB_STEPS[i], last = i === OB_STEPS.length - 1;
  const list = s.list ? `<ul class="ob-tour-list">${s.list.map(([a, b]) => `<li><b>${esc(a)}</b> <span>${esc(b)}</span></li>`).join('')}</ul>` : '';
  const name = s.name ? pgInputFieldHTML({ id: 'obName', label: 'Your name', value: state.profile && state.profile.name !== 'Player' ? state.profile.name : '', placeholder: 'Adventurer', optional: true, attrs: 'maxlength="40" autocomplete="off"' }) : '';
  pgModal({
    title: s.title, sub: `${s.sub} · ${i + 1} of ${OB_STEPS.length}`, accentClass: 'pg-accent-gold', glyph: '✦', size: 'sm',
    body: `<div class="pg-form"><p class="pg-dialog__text">${esc(s.text)}</p>${list}${name}</div>`,
    actions: `${i === 0 ? '<button type="button" class="pg-btn pg-btn--secondary" id="obSkip">Skip the tour</button>' : '<button type="button" class="pg-btn pg-btn--secondary" id="obBack">Back</button>'}<button type="button" class="pg-btn pg-btn--primary" id="obNext">${last ? 'Start' : 'Next'}</button>`,
    focus: '#obNext'
  });
  const finish = (status) => { o.tourSeen = true; if (status && o.status === 'active' && status === 'skipped') { /* skipping the tour keeps the first steps card */ } save(); closeModal(); if (page === 'home') renderHome(); };
  const skip = document.querySelector('#obSkip'); if (skip) skip.onclick = () => finish('skipped');
  const back = document.querySelector('#obBack'); if (back) back.onclick = () => onboardingTour(i - 1);
  document.querySelector('#obNext').onclick = () => {
    if (s.name) { const v = String(document.querySelector('#obName').value || '').trim().slice(0, 40); if (v) { state.profile.name = v; o.nameSet = true; save(); } }
    if (last) finish('done'); else onboardingTour(i + 1);
  };
}

/* Profile & Setup > Home: bring the tour or the checklist back. */
function onboardingSettingsHTML() {
  const o = ensureOnboarding();
  return `<div class="modal-section ob-settings"><h3>First steps</h3><p class="helper">The welcome tour and the short checklist for new players.</p><div class="ob-actions"><button type="button" class="rpg-btn small" id="obReplayTour">Show the tour</button><button type="button" class="rpg-btn small" id="obShowSteps">${o.status === 'active' && !o.hidden ? 'Checklist is showing' : 'Show the checklist on Home'}</button></div></div>`;
}
function onboardingBindSettings() {
  const t = document.querySelector('#obReplayTour'); if (t) t.onclick = () => { closeModal(); onboardingTour(0); };
  const s = document.querySelector('#obShowSteps'); if (s) s.onclick = () => {
    const o = ensureOnboarding();
    o.status = 'active'; o.hidden = false; o.completedAt = OB_GOALS.every(g => o.goals[g.id]) ? o.completedAt : null; save();
    closeModal(); setPage('home'); toast('The checklist is back on Home.');
  };
}

/* Boot: a brand-new player sees the tour once, on Home, after the first paint. */
function onboardingBoot() {
  const o = ensureOnboarding();
  if (o.status === 'active' && !o.tourSeen && page === 'home' && !document.querySelector('.modal-backdrop')) setTimeout(() => { if (page === 'home' && !document.querySelector('.modal-backdrop') && ensureOnboarding().status === 'active' && !ensureOnboarding().tourSeen) onboardingTour(0); }, 700);
  if (page === 'home' && o.status === 'active' && !o.hidden) renderHome();
}
onboardingBoot();
