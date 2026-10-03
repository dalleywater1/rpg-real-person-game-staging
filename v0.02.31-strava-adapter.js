/* RPG v0.02.31 -- Strava adapter (Integrations Readiness, 2026-09-19).

   STATUS: INTEGRATION-READY, NOT ACTIVE. Everything below is implemented
   and unit-tested against a mocked Strava, but the adapter reports
   'not-configured' (and the Connections screen shows no Connect button)
   until STRAVA_CONFIG is filled in. No credentials, keys or secrets exist
   in this repository.

   ARCHITECTURE: Strava -> stravaNormalizeActivity() -> Normalized Training
   Session -> trainingImportSessions() (v0.02.30). This file never touches
   state.activities, XP, Achievements or any specialist page; Running and
   Cycling pages have no Strava-specific code.

   EXTERNAL SETUP JAY MUST COMPLETE (the code cannot do these):
   1. Register an application at https://www.strava.com/settings/api.
      Note the Client ID (public) and Client Secret (SECRET). Set the
      "Authorization Callback Domain" to the host that serves the app.
   2. Host a small HTTPS token proxy that holds the Client Secret. Strava's
      token exchange REQUIRES the secret, so it must never ship in the app.
      Contract (JSON, POST):
         {proxy}/token        {code, redirectUri}  -> Strava token response
         {proxy}/refresh      {refresh_token}      -> Strava token response
         {proxy}/deauthorize  {access_token}       -> {ok:true}
      where "Strava token response" is Strava's own body:
         {access_token, refresh_token, expires_at, athlete:{firstname,...}}
   3. Fill STRAVA_CONFIG below (clientId, redirectUri, tokenProxyUrl).
   4. Android only: the OAuth redirect must return to the app. Either an
      Android App Link for redirectUri or a custom-scheme intent filter in
      the manifest. Until then Strava works in the browser/PWA, where the
      redirect simply reloads the app with ?code=&state=.
   5. Verify on a real account that the Strava API is callable from the
      WebView origin (CORS). If not, route stravaFetchActivities through the
      same proxy; stravaHttp below is the single seam for that.
   6. Strava API terms apply (rate limits, attribution/branding, data use).

   TOKENS live in their OWN localStorage key, not in the game save, so they
   can never be swept into a save export. localStorage is app-private but
   unencrypted; moving them to Android Keystore-backed storage is a
   recommended hardening before a public release.

   READ-ONLY: scopes are read + activity:read. Nothing is ever written to
   Strava. */

const STRAVA_CONFIG = {
  clientId: '',
  redirectUri: '',
  tokenProxyUrl: ''
};
const STRAVA_SCOPE = 'read,activity:read';
const STRAVA_TOKEN_KEY = 'rpg_strava_tokens';
const STRAVA_OAUTH_STATE_KEY = 'rpg_strava_oauth_state';
const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_INITIAL_LOOKBACK_MS = 30 * 24 * 3600 * 1000;
const STRAVA_RESYNC_OVERLAP_MS = 48 * 3600 * 1000;
const STRAVA_AUTO_SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;
const STRAVA_MAX_PAGES = 5;

/* The single network seam: tests replace it, and a proxy can wrap it. */
let stravaHttp = (url, options) => fetch(url, options);

function ensureIntegrationsState() {
  if (!state.integrations || typeof state.integrations !== 'object') state.integrations = {};
  const s = state.integrations;
  s.strava = { status: 'disconnected', lastSyncAt: null, lastError: null, athleteName: null, syncedThroughAt: null, lastImport: null, ...(s.strava && typeof s.strava === 'object' ? s.strava : {}) };
  return s;
}

function isStravaConfigured() {
  return Boolean(STRAVA_CONFIG.clientId && STRAVA_CONFIG.redirectUri && STRAVA_CONFIG.tokenProxyUrl);
}

function stravaTokens() {
  try {
    const raw = localStorage.getItem(STRAVA_TOKEN_KEY);
    const t = raw ? JSON.parse(raw) : null;
    return t && t.accessToken && t.refreshToken ? t : null;
  } catch (e) { return null; }
}
function stravaSaveTokens(t) {
  localStorage.setItem(STRAVA_TOKEN_KEY, JSON.stringify({ accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt }));
}
function stravaClearTokens() {
  try { localStorage.removeItem(STRAVA_TOKEN_KEY); } catch (e) { /* nothing to clear */ }
}

/* 'not-configured' | 'disconnected' | 'connected' | 'syncing' | 'error' --
   derived from what really exists (config, tokens), never a stored toggle. */
function stravaStatus() {
  if (!isStravaConfigured()) return 'not-configured';
  if (!stravaTokens()) return 'disconnected';
  const st = ensureIntegrationsState().strava.status;
  return st === 'syncing' || st === 'error' ? st : 'connected';
}

/* ---------- sport -> RPG type (unsupported -> 'Other', no category
   metrics invented) ---------- */
const STRAVA_SPORT_TO_RPG = {
  Run: 'Running', TrailRun: 'Running', VirtualRun: 'Running',
  Walk: 'Walking', Hike: 'Hiking',
  Ride: 'Cycling', MountainBikeRide: 'Cycling', GravelRide: 'Cycling', EBikeRide: 'Cycling',
  EMountainBikeRide: 'Cycling', VirtualRide: 'Cycling',
  Swim: 'Swimming',
  WeightTraining: 'Gym / Strength', Crossfit: 'Gym / Strength',
  Yoga: 'Yoga', Rowing: 'Rowing', VirtualRow: 'Rowing',
  NordicSki: 'Skiing', AlpineSki: 'Skiing', BackcountrySki: 'Skiing',
  RockClimbing: 'Climbing', Kayaking: 'Kayaking', Canoeing: 'Kayaking'
};

/* Strava SummaryActivity -> Normalized Training Session. start_date is a
   UTC instant; start_date_local is the wall-clock time where the activity
   happened (Strava labels it 'Z' but it is local), so date/time are read
   from it directly and never from the device's current zone. */
function stravaNormalizeActivity(raw) {
  if (!raw || raw.id === undefined || raw.id === null) return null;
  const startAt = Date.parse(raw.start_date);
  const elapsed = Number(raw.elapsed_time), moving = Number(raw.moving_time);
  const local = typeof raw.start_date_local === 'string' ? raw.start_date_local : '';
  return {
    source: 'strava',
    providerRecordId: String(raw.id),
    type: STRAVA_SPORT_TO_RPG[raw.sport_type] || STRAVA_SPORT_TO_RPG[raw.type] || 'Other',
    name: typeof raw.name === 'string' ? raw.name : null,
    startAt,
    endAt: Number.isFinite(startAt) && Number.isFinite(elapsed) ? startAt + elapsed * 1000 : NaN,
    durationSeconds: moving > 0 ? moving : elapsed,
    distanceMeters: Number(raw.distance) > 0 ? Number(raw.distance) : undefined,
    date: /^\d{4}-\d{2}-\d{2}/.test(local) ? local.slice(0, 10) : undefined,
    time: /T\d{2}:\d{2}/.test(local) ? local.slice(11, 16) : undefined,
    sourceApp: 'strava',
    lastUpdatedAt: null,
    importedAt: Date.now()
  };
}

/* ---------- OAuth ---------- */
function stravaAuthorizeUrl() {
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem(STRAVA_OAUTH_STATE_KEY, nonce); } catch (e) { /* state check will fail closed */ }
  const q = new URLSearchParams({
    client_id: STRAVA_CONFIG.clientId, redirect_uri: STRAVA_CONFIG.redirectUri,
    response_type: 'code', approval_prompt: 'auto', scope: STRAVA_SCOPE, state: nonce
  });
  return `https://www.strava.com/oauth/mobile/authorize?${q.toString()}`;
}

function stravaConnect() {
  if (!isStravaConfigured()) return { ok: false, reason: 'not-configured' };
  window.open(stravaAuthorizeUrl(), '_blank', 'noopener');
  return { ok: true };
}

async function stravaProxy(path, body) {
  const res = await stravaHttp(STRAVA_CONFIG.tokenProxyUrl.replace(/\/$/, '') + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!res.ok) throw Object.assign(new Error(`Strava sign-in service error (${res.status})`), { status: res.status });
  return res.json();
}

function stravaStoreTokenResponse(r, previous) {
  stravaSaveTokens({
    accessToken: r.access_token,
    refreshToken: r.refresh_token || (previous && previous.refreshToken),
    expiresAt: Number(r.expires_at) || Math.floor(Date.now() / 1000) + 3600
  });
}

/* Called with location.search after the redirect. Verifies the anti-forgery
   state, exchanges the code through the proxy, stores tokens. */
async function stravaHandleAuthorizationCallback(search) {
  const p = new URLSearchParams(search || '');
  if (p.get('error')) return { ok: false, reason: 'denied' };
  const code = p.get('code'), stateParam = p.get('state');
  if (!code || !stateParam) return { ok: false, reason: 'no-code' };
  let expected = null;
  try { expected = localStorage.getItem(STRAVA_OAUTH_STATE_KEY); localStorage.removeItem(STRAVA_OAUTH_STATE_KEY); } catch (e) { /* fail closed */ }
  if (!expected || expected !== stateParam) return { ok: false, reason: 'state-mismatch' };
  if (!isStravaConfigured()) return { ok: false, reason: 'not-configured' };
  try {
    const r = await stravaProxy('/token', { code, redirectUri: STRAVA_CONFIG.redirectUri });
    stravaStoreTokenResponse(r, null);
    const st = ensureIntegrationsState().strava;
    st.status = 'connected'; st.lastError = null;
    st.athleteName = (r.athlete && r.athlete.firstname) || null;
    save();
    return { ok: true };
  } catch (e) {
    const st = ensureIntegrationsState().strava;
    st.status = 'error'; st.lastError = e.message || String(e); save();
    return { ok: false, reason: 'exchange-failed', error: st.lastError };
  }
}

async function stravaAccessToken() {
  const t = stravaTokens();
  if (!t) throw Object.assign(new Error('Not connected to Strava'), { status: 401 });
  if (t.expiresAt - 60 > Math.floor(Date.now() / 1000)) return t.accessToken;
  const r = await stravaProxy('/refresh', { refresh_token: t.refreshToken });
  stravaStoreTokenResponse(r, t);
  return r.access_token;
}

/* ---------- read ---------- */
async function stravaFetchActivities(afterEpochSec) {
  const token = await stravaAccessToken();
  const out = [];
  for (let page = 1; page <= STRAVA_MAX_PAGES; page++) {
    const res = await stravaHttp(`${STRAVA_API}/athlete/activities?after=${afterEpochSec}&per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw Object.assign(new Error(`Strava request failed (${res.status})`), { status: res.status });
    const batch = await res.json();
    if (!Array.isArray(batch)) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

let __stravaSyncInFlight = null;
let __stravaLastAutoSyncAt = 0;

function stravaSyncNow() {
  if (__stravaSyncInFlight) return __stravaSyncInFlight;
  __stravaSyncInFlight = (async () => {
    try { return await __stravaSyncImpl(); }
    finally { __stravaSyncInFlight = null; }
  })();
  return __stravaSyncInFlight;
}

async function __stravaSyncImpl() {
  const st = ensureIntegrationsState().strava;
  if (!isStravaConfigured()) return { ok: false, status: 'not-configured' };
  if (!stravaTokens()) return { ok: false, status: 'disconnected' };
  st.status = 'syncing';
  const now = Date.now();
  const since = st.syncedThroughAt
    ? Math.max(st.syncedThroughAt - STRAVA_RESYNC_OVERLAP_MS, now - STRAVA_INITIAL_LOOKBACK_MS)
    : now - STRAVA_INITIAL_LOOKBACK_MS;
  try {
    const raws = await stravaFetchActivities(Math.floor(since / 1000));
    const sessions = raws.map(stravaNormalizeActivity).filter(Boolean);
    const result = trainingImportSessions(sessions);
    st.syncedThroughAt = now; st.lastSyncAt = now; st.status = 'connected'; st.lastError = null;
    st.lastImport = { at: now, read: raws.length, ...result };
    save();
    try {
      if (page === 'home') renderHome();
      else if (page === 'training' && typeof renderTrainingArea === 'function') renderTrainingArea();
    } catch (e) { /* render trouble must not turn a good sync into an error */ }
    return { ok: true, status: 'connected', read: raws.length, import: result };
  } catch (e) {
    /* A provider failure only ever changes THIS provider's status. It never
       throws into Training and never removes anything already imported. */
    if (e.status === 401 || e.status === 403) {
      stravaClearTokens();
      st.status = 'disconnected';
      st.lastError = 'Strava access expired or was revoked. Connect again to resume.';
    } else if (e.status === 429) {
      st.status = 'error'; st.lastError = 'Strava is rate limiting requests. Try again in a few minutes.';
    } else {
      st.status = 'error'; st.lastError = e.message || 'Could not reach Strava.';
    }
    save();
    return { ok: false, status: st.status, error: st.lastError };
  }
}

/* Disconnect = revoke upstream (best effort) + always clear local tokens.
   Imported activities are kept unless removeImported is set. */
async function stravaDisconnect(options) {
  const opts = options || {};
  const t = stravaTokens();
  let upstreamRevoked = false;
  if (t && isStravaConfigured()) {
    try { await stravaProxy('/deauthorize', { access_token: t.accessToken }); upstreamRevoked = true; }
    catch (e) { /* offline or already revoked: local disconnect still proceeds */ }
  }
  stravaClearTokens();
  const st = ensureIntegrationsState().strava;
  st.status = 'disconnected'; st.syncedThroughAt = null; st.lastError = null; st.athleteName = null;
  let removal = null;
  if (opts.removeImported && typeof trainingRemoveImportedFromSource === 'function') removal = trainingRemoveImportedFromSource('strava');
  save();
  return { ok: true, upstreamRevoked, removal };
}

async function stravaAutoSync(force) {
  if (stravaStatus() !== 'connected' && stravaStatus() !== 'error') return null;
  const now = Date.now();
  if (!force && now - __stravaLastAutoSyncAt < STRAVA_AUTO_SYNC_MIN_INTERVAL_MS) return null;
  __stravaLastAutoSyncAt = now;
  return stravaSyncNow();
}

/* A save written mid-sync must not show "syncing" forever. */
(function stravaNormalizeStuckStatus() {
  const st = ensureIntegrationsState().strava;
  if (st.status === 'syncing') st.status = 'connected';
})();

/* Redirect landing (browser/PWA) + foreground sync. Inert until configured. */
setTimeout(async () => {
  try {
    if (isStravaConfigured() && /[?&]code=/.test(location.search) && /[?&]state=/.test(location.search)) {
      const r = await stravaHandleAuthorizationCallback(location.search);
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* cosmetic */ }
      if (r.ok) await stravaSyncNow();
    } else {
      await stravaAutoSync(false);
    }
  } catch (e) { /* adapter problems never reach the rest of the app */ }
}, 2000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') stravaAutoSync(false).catch(() => {});
});
