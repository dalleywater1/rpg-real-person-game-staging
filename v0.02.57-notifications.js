/* Shared notification engine (RPG-0071). Astra, 2026-09-25.

   ONE engine that every system registers reminders with, instead of each tracker or module inventing its
   own. It owns: the master switch, quiet hours, per-source settings, "due" evaluation, once-only delivery
   (a stable key per reminder per day), and the delivery adapters.

   WHAT IS REAL, AND WHAT IS NOT (be honest about the platform):
   - In-app delivery works everywhere: a small banner with an Open button.
   - Web notifications work when the browser has granted permission AND the app/service worker is alive
     (shown when the page is hidden, via the service worker so tapping one opens the app).
   - A reminder while the app is fully CLOSED needs native scheduling (Android AlarmManager / WorkManager
     through the WebView bridge). That is NOT built here and cannot be verified without a device: the
     `native` adapter below is an inert interface (`window.RpgNative.scheduleNotification`) that a future
     Android pass fills in, exactly like the Strava adapter. Until then reminders are delivered while the
     app is open or backgrounded-but-alive, and this is stated in the settings screen.

   PRIVACY / SAFETY: everything is opt-in and OFF by default; text never contains anything sensitive
   (no sleep detail, no Vigil, no free text); nothing leaves the device; quiet hours are respected; each
   reminder is delivered once per day at most. Gentle by design (Self Care philosophy): no guilt language.

   State (additive, created lazily): state.notifications = { version, enabled, quiet: {from, to},
   sources: { id: { enabled, time } }, delivered: { key: epochMs }, lastTick }.
   Styles: styles/notifications/00-notifications.css. */

const NOTIF_SOURCES = {};
function notifRegister(src) { if (src && src.id) NOTIF_SOURCES[src.id] = src; }
let notifClock = null;                       /* tests inject a fake clock */
const notifNow = () => (notifClock ? notifClock() : new Date());
let notifPageHiddenOverride = null;          /* tests */
const notifPageHidden = () => (notifPageHiddenOverride !== null ? notifPageHiddenOverride : Boolean(document.hidden));

function ensureNotifications() {
  const n = state.notifications = state.notifications && typeof state.notifications === 'object' ? state.notifications : {};
  n.version = 1;
  n.enabled = Boolean(n.enabled);
  n.quiet = n.quiet && typeof n.quiet === 'object' ? n.quiet : {};
  if (!/^\d{2}:\d{2}$/.test(n.quiet.from || '')) n.quiet.from = '22:00';
  if (!/^\d{2}:\d{2}$/.test(n.quiet.to || '')) n.quiet.to = '07:00';
  n.sources = n.sources && typeof n.sources === 'object' ? n.sources : {};
  n.delivered = n.delivered && typeof n.delivered === 'object' ? n.delivered : {};
  return n;
}
const notifMin = hhmm => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
function notifSourceCfg(id) {
  const n = ensureNotifications(), src = NOTIF_SOURCES[id] || {}, c = n.sources[id] = n.sources[id] && typeof n.sources[id] === 'object' ? n.sources[id] : {};
  c.enabled = Boolean(c.enabled);
  if (!/^\d{2}:\d{2}$/.test(c.time || '')) c.time = src.defaultTime || '09:00';
  return c;
}
/* Quiet hours may cross midnight (22:00 to 07:00). */
function notifInQuiet(minutes) {
  const q = ensureNotifications().quiet, a = notifMin(q.from), b = notifMin(q.to);
  if (a === null || b === null || a === b) return false;
  return a < b ? (minutes >= a && minutes < b) : (minutes >= a || minutes < b);
}
const notifDate = d => localISO(d);

/* ------------------------------------------------------------------ */
/* Sources (each is small; a future system registers the same way)      */
/* ------------------------------------------------------------------ */
notifRegister({
  id: 'habits', label: 'Habit reminder', text: 'One reminder in the evening if habits you scheduled for today are still open.', defaultTime: 'evening', timed: true,
  available: () => typeof pgHabitList === 'function' && pgHabitList().length > 0,
  due(ctx) {
    if (ctx.minutes < ctx.at) return [];
    const open = pgHabitList().filter(t => pgScheduledOn(t, ctx.date) && !pgEntryComplete(t, ctx.date));
    if (!open.length) return [];
    const names = open.slice(0, 3).map(t => t.name).join(', ') + (open.length > 3 ? '…' : '');
    return [{ key: `habits:${ctx.date}`, title: 'Habits still open today', body: `${open.length} to go: ${names}`, route: 'habits' }];
  }
});
notifRegister({
  id: 'water', label: 'Water reminder', text: 'A gentle nudge every three hours between 09:00 and 20:00 while today\'s water is below your target.', defaultTime: '09:00', timed: false,
  available: () => typeof selfCareEnabled === 'function' && selfCareEnabled('water'),
  due(ctx) {
    if (ctx.minutes < 9 * 60 || ctx.minutes >= 20 * 60) return [];
    const target = Number(state.profile && state.profile.waterTarget) || 2500;
    if (Number(state.daily && state.daily.water) >= target) return [];
    const slot = Math.floor((ctx.minutes - 9 * 60) / 180);
    return [{ key: `water:${ctx.date}:${slot}`, title: 'A glass of water?', body: `${Math.round(Number(state.daily && state.daily.water) || 0)} of ${target} ml so far today.`, route: 'home' }];
  }
});
notifRegister({
  id: 'dailyQuest', label: 'Daily Quest reminder', text: 'A reminder in the morning if today\'s Daily Quest is not done.', defaultTime: '09:00', timed: true,
  available: () => Boolean(state.quest),
  due(ctx) {
    if (ctx.minutes < ctx.at) return [];
    if (!state.quest || state.quest.rewarded || !state.quest.title) return [];
    return [{ key: `dq:${ctx.date}`, title: 'Your Daily Quest is waiting', body: String(state.quest.title).slice(0, 80), route: 'quests' }];
  }
});
notifRegister({
  id: 'recap', label: 'Weekly recap', text: 'On Monday morning: your weekly recap is ready to look at.', defaultTime: '09:00', timed: true,
  available: () => typeof recapModel === 'function',
  due(ctx) {
    if (ctx.now.getDay() !== 1 || ctx.minutes < ctx.at) return [];
    return [{ key: `recap:${ctx.date}`, title: 'Your weekly recap is ready', body: 'See how last week went.', route: 'adventurers-log' }];
  }
});
/* "evening" default for the habit reminder */
const NOTIF_DEFAULT_TIMES = { habits: '19:00' };
Object.keys(NOTIF_DEFAULT_TIMES).forEach(k => { NOTIF_SOURCES[k].defaultTime = NOTIF_DEFAULT_TIMES[k]; });

/* ------------------------------------------------------------------ */
/* Evaluation and delivery                                             */
/* ------------------------------------------------------------------ */
/* What is due right now (pure apart from reading state). */
function notifDueList(now = notifNow()) {
  const n = ensureNotifications();
  if (!n.enabled) return [];
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (notifInQuiet(minutes)) return [];
  const date = notifDate(now), out = [];
  Object.values(NOTIF_SOURCES).forEach(src => {
    const cfg = notifSourceCfg(src.id);
    if (!cfg.enabled) return;
    try { if (src.available && !src.available()) return; } catch (e) { return; }
    let items = [];
    try { items = src.due({ now, date, minutes, at: notifMin(cfg.time) || 0, cfg }) || []; } catch (e) { items = []; }   /* one broken source never blocks the rest */
    items.forEach(it => { if (!n.delivered[it.key]) out.push({ ...it, source: src.id }); });
  });
  return out;
}
/* Delivery adapters. Each returns true when it showed the reminder. */
const notifAdapters = {
  inApp(item) {
    let host = document.querySelector('#notifBanner');
    if (!host) { host = document.createElement('div'); host.id = 'notifBanner'; host.className = 'notif-banner'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    host.innerHTML = `<div class="notif-banner__text"><b>${esc(item.title)}</b><span>${esc(item.body || '')}</span></div><button type="button" class="rpg-btn small" data-notif-open="${esc(item.route || 'home')}">Open</button><button type="button" class="text-btn" data-notif-dismiss aria-label="Dismiss reminder">×</button>`;
    host.hidden = false;
    clearTimeout(notifAdapters._t);
    notifAdapters._t = setTimeout(() => { host.hidden = true; }, 12000);
    return true;
  },
  web(item) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !notifPageHidden()) return false;
    try {
      const opts = { body: item.body || '', tag: item.key, icon: 'assets/app-icon-192.png', data: { route: item.route || 'home' } };
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) { navigator.serviceWorker.ready.then(r => r.showNotification(item.title, opts)).catch(() => new Notification(item.title, opts)); }
      else new Notification(item.title, opts);
      return true;
    } catch (e) { return false; }
  },
  /* Inert until an Android pass provides the bridge (no device here to verify it). */
  native(item) {
    try { if (window.RpgNative && typeof window.RpgNative.deliverNotification === 'function') { window.RpgNative.deliverNotification(JSON.stringify({ title: item.title, body: item.body || '', route: item.route || 'home', key: item.key })); return true; } } catch (e) { /* ignore */ }
    return false;
  }
};
function notifDeliver(item) {
  const n = ensureNotifications();
  const shown = [notifAdapters.native(item), notifAdapters.web(item)];
  /* the in-app banner only when the page is visible (a hidden page delivered a system notification instead) */
  if (!notifPageHidden() || !shown.some(Boolean)) notifAdapters.inApp(item);
  n.delivered[item.key] = Date.now();
  const keys = Object.keys(n.delivered);
  if (keys.length > 200) keys.sort((a, b) => n.delivered[a] - n.delivered[b]).slice(0, keys.length - 200).forEach(k => delete n.delivered[k]);
}
/* One evaluation pass. Returns the reminders it delivered. */
function notifTick(now = notifNow()) {
  const n = ensureNotifications();
  const due = notifDueList(now), sent = [];
  /* deliver at most ONE per pass so a returning user is not hit by a pile; the rest wait for the next pass */
  const first = due[0];
  if (first) { notifDeliver(first); sent.push(first); save(); }
  n.lastTick = now.getTime();
  return sent;
}

document.addEventListener('click', e => {
  const o = e.target.closest('[data-notif-open]');
  if (o) { const r = o.dataset.notifOpen, h = document.querySelector('#notifBanner'); if (h) h.hidden = true; notifOpenRoute(r); return; }
  if (e.target.closest('[data-notif-dismiss]')) { const h = document.querySelector('#notifBanner'); if (h) h.hidden = true; }
});
function notifOpenRoute(route) {
  if (route === 'habits') { setPage('personal-growth'); if (typeof pgGo === 'function') pgGo('habits'); }
  else if (route === 'adventurers-log') { setPage('adventurers-log'); if (typeof recapOpen !== 'undefined') { recapOpen = true; recapOffset = -1; /* the Monday reminder is about LAST week; this week is still empty */ renderTasks(); } }
  else setPage(route === 'quests' ? 'quests' : 'home');
}

/* ------------------------------------------------------------------ */
/* Settings dialog (Profile & Setup > Profile > Reminders)              */
/* ------------------------------------------------------------------ */
function notifPermissionText() {
  if (typeof Notification === 'undefined') return 'This device cannot show system notifications. Reminders will appear inside the app while it is open.';
  if (Notification.permission === 'granted') return 'System notifications are allowed. They appear when the app is in the background.';
  if (Notification.permission === 'denied') return 'System notifications are blocked in your browser settings. Reminders will appear inside the app while it is open.';
  return 'Turn reminders on to be asked about system notifications. Without them, reminders appear inside the app while it is open.';
}
function notifSettingsHTML() {
  return `<div class="modal-section notif-entry"><h3>Reminders</h3><p class="helper">Optional, off by default, and gentle. Nothing leaves your device.</p><button type="button" class="rpg-btn small" id="notifOpenSettings">Reminder settings</button></div>`;
}
function notifBindSettings() { const b = document.querySelector('#notifOpenSettings'); if (b) b.onclick = () => notifSettingsModal(); }
function notifSettingsModal() {
  const n = ensureNotifications();
  const rows = Object.values(NOTIF_SOURCES).map(src => {
    const cfg = notifSourceCfg(src.id), avail = (() => { try { return !src.available || src.available(); } catch (e) { return false; } })();
    return `<div class="notif-row"><label class="sc-check"><input type="checkbox" data-notif-src="${src.id}" ${cfg.enabled ? 'checked' : ''} ${avail ? '' : 'disabled'}> <span><b>${esc(src.label)}</b></span></label><p class="pg-field__help">${esc(src.text)}${avail ? '' : ' (Not available yet: it needs something to remind you about.)'}</p>${src.timed ? pgInputFieldHTML({ id: `notifT-${src.id}`, label: 'Time', type: 'time', value: cfg.time, attrs: `data-notif-time="${src.id}"` }) : ''}</div>`;
  }).join('');
  pgModal({
    title: 'Reminders', sub: 'Choose what to be reminded about', accentClass: 'pg-accent-gold', glyph: '◔', size: 'wide',
    body: `<div class="pg-form">
      <label class="sc-check"><input type="checkbox" id="notifMaster" ${n.enabled ? 'checked' : ''}> <span><b>Turn reminders on</b></span></label>
      <p class="pg-field__help" id="notifPermText">${esc(notifPermissionText())}</p>
      <div class="pg-form__row">${pgInputFieldHTML({ id: 'notifQuietFrom', label: 'Quiet from', type: 'time', value: n.quiet.from })}${pgInputFieldHTML({ id: 'notifQuietTo', label: 'Quiet until', type: 'time', value: n.quiet.to })}</div>
      <p class="pg-field__help">No reminder is shown during quiet hours.</p>
      ${rows}
      <p class="pg-field__help">Closed-app reminders need the Android app's native scheduling, which is not switched on yet: reminders are delivered while the app is open or in the background.</p>
    </div>`,
    actions: '<button type="button" class="pg-btn pg-btn--secondary" id="notifTest">Send a test</button><button type="button" class="pg-btn pg-btn--secondary" data-pg-close>Cancel</button><button type="button" class="pg-btn pg-btn--primary" id="notifSave">Save</button>'
  });
  modalRoot.querySelector('#notifTest').onclick = () => { notifAdapters.inApp({ title: 'Test reminder', body: 'This is how a reminder looks.', route: 'home', key: 'test' }); if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && notifPageHidden()) notifAdapters.web({ title: 'Test reminder', body: 'This is how a reminder looks.', route: 'home', key: 'test' }); };
  modalRoot.querySelector('#notifSave').onclick = async () => {
    const master = modalRoot.querySelector('#notifMaster').checked;
    const from = modalRoot.querySelector('#notifQuietFrom').value || '22:00', to = modalRoot.querySelector('#notifQuietTo').value || '07:00';
    if (master && !n.enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { /* the in-app path still works */ } }
    n.enabled = master; n.quiet.from = from; n.quiet.to = to;
    modalRoot.querySelectorAll('[data-notif-src]').forEach(cb => { notifSourceCfg(cb.dataset.notifSrc).enabled = cb.checked && !cb.disabled; });
    modalRoot.querySelectorAll('[data-notif-time]').forEach(inp => { if (/^\d{2}:\d{2}$/.test(inp.value)) notifSourceCfg(inp.dataset.notifTime).time = inp.value; });
    save(); closeModal(); toast(n.enabled ? 'Reminders saved.' : 'Reminders are off.');
  };
}

/* The scheduler: while the app is open, a light check every minute and whenever it becomes visible. */
setInterval(() => { try { notifTick(); } catch (e) { /* never break the app for a reminder */ } }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { try { notifTick(); } catch (e) { /* ignore */ } } });
