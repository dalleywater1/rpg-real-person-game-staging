/* RPG v0.02.32 -- Connections / Integrations UI (Integrations Readiness,
   2026-09-19).

   Every status and every button here is derived from real state:
     Health Connect  <- the native bridge + real permission state
                        (state.health.connection, refreshed on open)
     Strava          <- STRAVA_CONFIG + stored tokens (stravaStatus())
     Garmin          <- static "Coming later" (no code, no fake toggle)
   A control only exists when its action can work in the current state:
   no Connect button on a browser with no Health bridge, none for Strava
   until it is configured, none for Garmin. */

const RPG_PRIVACY_POLICY_URL = 'assets/legal/privacy-policy.html';

function integrationImportLine(lastImport) {
  if (!lastImport) return '';
  const bits = [];
  if (lastImport.created) bits.push(`${lastImport.created} new`);
  if (lastImport.merged) bits.push(`${lastImport.merged} matched`);
  if (lastImport.updated) bits.push(`${lastImport.updated} updated`);
  return bits.length ? bits.join(' · ') : 'No new workouts';
}

function integrationTimeAgo(ts) {
  return ts ? new Date(ts).toLocaleString() : 'Never';
}

function healthIntegrationItem() {
  const c = state.health.connection;
  const bridge = typeof healthBridgeAvailable === 'function' && healthBridgeAvailable();
  const imported = typeof trainingImportedCount === 'function' ? trainingImportedCount('health-connect') : 0;
  const base = { id: 'health-connect', label: 'Health Connect', shield: 'Health Connect', actions: [] };
  if (!bridge) {
    return { ...base, tone: 'muted', pill: 'Android app only', line: 'Health Connect works in the Android app. There is nothing to connect in a browser.' };
  }
  switch (c.status) {
    case 'unavailable':
      return { ...base, tone: 'muted', pill: 'Not supported', line: 'Health Connect is not available on this device.' };
    case 'update-required':
      return { ...base, tone: 'warn', pill: 'Update needed', line: 'Health Connect needs an update before RPG can use it.', actions: [{ id: 'hc-open', label: 'Update Health Connect', primary: true }] };
    case 'syncing':
      return { ...base, tone: 'ok', pill: 'Syncing…', line: 'Reading steps, distance and workouts…' };
    case 'connected':
      return {
        ...base, tone: 'ok', pill: 'Connected',
        line: `Last sync: ${integrationTimeAgo(c.lastSyncAt)}${imported ? ` · ${imported} imported workout${imported === 1 ? '' : 's'}` : ''}${state.health.import && state.health.import.lastImport ? ` · ${integrationImportLine(state.health.import.lastImport)}` : ''}`,
        actions: [{ id: 'hc-sync', label: 'Sync now', primary: true }, { id: 'hc-open', label: 'Manage' }, { id: 'hc-remove', label: 'Remove imported data', danger: true }]
      };
    case 'sync-error':
      return { ...base, tone: 'error', pill: 'Sync problem', line: `${c.lastError || 'The last sync failed.'} Your imported history is untouched.`, actions: [{ id: 'hc-sync', label: 'Try again', primary: true }, { id: 'hc-open', label: 'Manage' }] };
    default: {
      if (c.everConnected) {
        return { ...base, tone: 'warn', pill: 'Access removed', line: 'Access was removed in Health Connect, so importing has paused. Your imported history is kept. Connect again to resume.', actions: [{ id: 'hc-connect', label: 'Connect', primary: true }, { id: 'hc-open', label: 'Open Health Connect' }] };
      }
      if (c.deniedAt) {
        return { ...base, tone: 'warn', pill: 'Not connected', line: 'Permission was not granted. If Android no longer shows the prompt, allow access from inside Health Connect.', actions: [{ id: 'hc-connect', label: 'Try again', primary: true }, { id: 'hc-open', label: 'Open Health Connect' }] };
      }
      return { ...base, tone: 'muted', pill: 'Not connected', line: 'Import steps, distance and workouts recorded by other apps. Read-only.', actions: [{ id: 'hc-connect', label: 'Connect', primary: true }] };
    }
  }
}

function stravaIntegrationItem() {
  const status = typeof stravaStatus === 'function' ? stravaStatus() : 'not-configured';
  const st = typeof ensureIntegrationsState === 'function' ? ensureIntegrationsState().strava : {};
  const imported = typeof trainingImportedCount === 'function' ? trainingImportedCount('strava') : 0;
  const base = { id: 'strava', label: 'Strava', shield: 'Strava', actions: [] };
  switch (status) {
    case 'not-configured':
      return { ...base, tone: 'muted', pill: 'Not available yet', line: 'Strava sync is built but needs the app registered with Strava first. It will appear here when ready.' };
    case 'connected':
      return {
        ...base, tone: 'ok', pill: 'Connected',
        line: `${st.athleteName ? `${st.athleteName} · ` : ''}Last sync: ${integrationTimeAgo(st.lastSyncAt)}${imported ? ` · ${imported} imported workout${imported === 1 ? '' : 's'}` : ''}`,
        actions: [{ id: 'strava-sync', label: 'Sync now', primary: true }, { id: 'strava-disconnect', label: 'Disconnect', danger: true }]
      };
    case 'syncing':
      return { ...base, tone: 'ok', pill: 'Syncing…', line: 'Reading your recent activities…' };
    case 'error':
      return { ...base, tone: 'error', pill: 'Sync problem', line: `${st.lastError || 'The last sync failed.'} Your imported history is untouched.`, actions: [{ id: 'strava-sync', label: 'Try again', primary: true }, { id: 'strava-disconnect', label: 'Disconnect', danger: true }] };
    default:
      return { ...base, tone: 'muted', pill: 'Not connected', line: st.lastError || 'Import your Strava activities into Training. Read-only.', actions: [{ id: 'strava-connect', label: 'Connect', primary: true }] };
  }
}

function garminIntegrationItem() {
  return { id: 'garmin', label: 'Garmin', shield: 'Garmin', tone: 'muted', pill: 'Coming later', line: 'A direct Garmin connection is not available yet. Garmin activities can already reach RPG through Health Connect or Strava if you share them there.', actions: [] };
}

function integrationItems() {
  return [healthIntegrationItem(), stravaIntegrationItem(), garminIntegrationItem()];
}

function integrationCardHTML(item) {
  const actions = item.actions.map(a =>
    `<button type="button" class="${a.primary ? 'rpg-btn accent small' : a.danger ? 'text-btn danger' : 'text-btn'}" data-int-action="${a.id}">${esc(a.label)}</button>`
  ).join('');
  return `<article class="int-card int-${item.tone}" data-integration="${item.id}">
    <div class="int-head">
      <span class="int-shield">${connectionShield(item.shield)}</span>
      <div class="int-title"><b>${esc(item.label)}</b><span class="int-pill int-pill-${item.tone}">${esc(item.pill)}</span></div>
    </div>
    <p class="int-line">${esc(item.line)}</p>
    ${actions ? `<div class="int-actions">${actions}</div>` : ''}
  </article>`;
}

function integrationsPanelHTML() {
  return `<div class="integrations-panel" id="integrationsPanel">
    ${integrationItems().map(integrationCardHTML).join('')}
    <p class="helper">Connections are read-only: RPG never writes to Health Connect or Strava, and imported workouts are added to your Training history without awarding XP.</p>
    <button type="button" class="text-btn" data-int-action="privacy">Health data &amp; privacy</button>
  </div>`;
}

/* Compact status list for the Training front page. */
function integrationsHomeSectionHTML() {
  const rows = integrationItems().map(i =>
    `<span class="tr-int-row"><span class="tr-int-name">${connectionShield(i.shield)}<b>${esc(i.label)}</b></span><span class="int-pill int-pill-${i.tone}">${esc(i.pill)}</span></span>`
  ).join('');
  return `<section class="tr-card">
    <h3 class="tr-card-title">Connections</h3>
    <button type="button" class="tr-int-open" data-open-connections aria-label="Manage connections">${rows}<i>Manage</i></button>
  </section>`;
}

/* ---------- actions ---------- */
function integrationsRerender() {
  const panel = modalRoot.querySelector('#integrationsPanel');
  if (panel) {
    panel.outerHTML = integrationsPanelHTML();
    integrationsBind(modalRoot);
  }
  try {
    if (page === 'training' && typeof renderTrainingArea === 'function') renderTrainingArea();
  } catch (e) { /* Training render trouble is not a Connections problem */ }
}

function hcResultMessage(r) {
  if (!r) return 'Done.';
  if (r.ok) {
    const i = r.import;
    return i && !i.error ? `Health Connect synced. ${integrationImportLine(i)}.` : 'Health Connect synced.';
  }
  if (r.denied) return 'Permission was not granted.';
  if (r.status === 'update-required') return 'Health Connect needs an update.';
  if (r.status === 'unavailable') return 'Health Connect is not available on this device.';
  if (r.status === 'permission-required') return 'Health Connect access is needed.';
  return r.error ? `Sync problem: ${r.error}` : 'Sync problem.';
}

function integrationsConfirm({ title, body, buttons }) {
  modal(`<h2>${esc(title)}</h2><p class="helper">${esc(body)}</p>
    ${buttons.map((b, i) => `<button type="button" class="${b.danger ? 'text-btn danger' : 'rpg-btn accent'}" data-int-confirm="${i}" style="width:100%;margin-top:8px">${esc(b.label)}</button>`).join('')}
    <button type="button" class="text-btn" data-int-confirm="cancel" style="width:100%;margin-top:8px">Cancel</button>`);
  modalRoot.querySelectorAll('[data-int-confirm]').forEach(el => {
    el.onclick = async () => {
      const key = el.dataset.intConfirm;
      if (key !== 'cancel') await buttons[Number(key)].run();
      profileModal('connections');
    };
  });
}

async function integrationsRunAction(action, btn) {
  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Working…'; }
  try {
    switch (action) {
      case 'hc-connect': toast(hcResultMessage(await healthConnect())); break;
      case 'hc-sync': toast(hcResultMessage(await syncHealthConnect())); break;
      case 'hc-open':
        if (!(await healthOpenHealthConnect())) toast('Could not open Health Connect.');
        break;
      case 'hc-remove': {
        const n = trainingImportedCount('health-connect');
        integrationsConfirm({
          title: 'Remove imported data?',
          body: `This removes ${n} workout${n === 1 ? '' : 's'} imported from Health Connect and the stored steps and distance readings. Workouts you logged yourself are not affected. To stop importing, also remove access in Health Connect.`,
          buttons: [{ label: 'Remove imported data', danger: true, run: async () => { const r = healthRemoveImportedData(); toast(`Removed ${r.removed} imported workout${r.removed === 1 ? '' : 's'}.`); } }]
        });
        return;
      }
      case 'strava-connect': {
        const r = stravaConnect();
        toast(r.ok ? 'Finish signing in with Strava, then return here.' : 'Strava is not set up yet.');
        break;
      }
      case 'strava-sync': {
        const r = await stravaSyncNow();
        toast(r.ok ? `Strava synced. ${integrationImportLine(r.import)}.` : (r.error || 'Could not sync Strava.'));
        break;
      }
      case 'strava-disconnect': {
        const n = trainingImportedCount('strava');
        integrationsConfirm({
          title: 'Disconnect Strava?',
          body: `RPG will stop importing and delete its stored Strava access. ${n} imported workout${n === 1 ? '' : 's'} can stay in your history or be removed.`,
          buttons: [
            { label: 'Disconnect and keep workouts', run: async () => { const r = await stravaDisconnect({ removeImported: false }); toast(r.upstreamRevoked ? 'Strava disconnected.' : 'Disconnected here. Also remove RPG in Strava settings to fully revoke access.'); } },
            { label: 'Disconnect and remove workouts', danger: true, run: async () => { const r = await stravaDisconnect({ removeImported: true }); toast(`Disconnected. Removed ${r.removal ? r.removal.removed : 0} imported workouts.`); } }
          ]
        });
        return;
      }
      case 'privacy': healthRationaleModal(); return;
    }
  } catch (e) {
    toast(`Something went wrong: ${e.message || e}`);
  }
  integrationsRerender();
}

function integrationsBind(root) {
  root.querySelectorAll('[data-int-action]').forEach(btn => {
    btn.onclick = () => integrationsRunAction(btn.dataset.intAction, btn);
  });
}

/* Called when the Connections tab opens: paint from cached state at once,
   then re-check the REAL Health Connect state (permission may have been
   revoked while the app was closed) and repaint. */
function integrationsOnOpen() {
  integrationsBind(modalRoot);
  if (typeof healthRefreshConnectionStatus === 'function') {
    healthRefreshConnectionStatus().then(integrationsRerender).catch(() => {});
  }
}

/* ---------- Health data explanation (Health Connect "rationale" and
   Android 14 "permission usage" entry points open this) ---------- */
function healthRationaleModal() {
  modal(`<h2>Health data &amp; privacy</h2>
    <p class="helper">RPG can read three kinds of data from Health Connect, only after you allow it:</p>
    <ul class="int-list"><li>Steps</li><li>Distance</li><li>Exercise sessions (type, start and end time)</li></ul>
    <p class="helper"><b>Why:</b> to show your daily movement, move your Journeys forward, and add workouts recorded in other apps to your Training history.</p>
    <p class="helper"><b>How it is used:</b> read-only. RPG never writes to Health Connect. This health data stays in the app on your device; it is not sent to an RPG server or shared with anyone.</p>
    <p class="helper"><b>Your control:</b> stop at any time in Health Connect, and remove imported data from Settings → Connections.</p>
    <p class="helper"><a href="${esc(RPG_PRIVACY_POLICY_URL)}">Privacy policy</a></p>
    ${typeof healthBridgeAvailable === 'function' && healthBridgeAvailable() ? '<button type="button" class="rpg-btn accent" id="healthRationaleOpen" style="width:100%">Open Health Connect</button>' : ''}`);
  const open = modalRoot.querySelector('#healthRationaleOpen');
  if (open) open.onclick = () => healthOpenHealthConnect();
}

function healthRationaleFromHash() {
  if (location.hash !== '#health-rationale') return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* cosmetic */ }
  healthRationaleModal();
}
window.addEventListener('hashchange', healthRationaleFromHash);
setTimeout(healthRationaleFromHash, 900);
