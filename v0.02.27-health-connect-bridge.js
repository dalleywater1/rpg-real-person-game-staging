/* RPG v0.02.27 — Health Connect Phase 1: Android bridge client, RPG
   Health Import Service, and Movement/Journey resolvers.
   (ASTRA — HEALTH CONNECT PHASE 1 IMPLEMENTATION BRIEF, 2026-09-13.)

   ARCHITECTURE (brief §2/§4): this file is the ONLY place in the RPG
   frontend that ever calls window.AndroidHealthBridge (the native
   bridge exposed by android/app/.../HealthConnectBridge.kt). Movement,
   Training, Journeys, Sleep, Achievements and Main Quests never query
   Health Connect or android/'s bridge directly — they consume the
   resolver functions at the bottom of this file
   (healthImportedStepsForDate/healthImportedDistanceMetersForDate),
   which read already-normalized, already-deduplicated state.health
   records. That's the whole point of "one import service": Training
   and Movement can't both double-import the same walk if neither of
   them is allowed to import anything at all.

   RUNS WITHOUT THE NATIVE WRAPPER: everything in this file degrades
   gracefully in a plain browser (healthBridgeAvailable() false,
   healthSdkStatus() 'SDK_UNAVAILABLE', syncHealthConnect() a no-op that
   reports the same status). The bridge transport is a plain
   postMessage/onmessage object, so a mock at window.AndroidHealthBridge
   exercises every path here without a physical device.

   INTEGRATIONS READINESS (2026-09-19): Exercise Sessions now leave this
   file as Normalized Training Sessions (healthExerciseToSession) and are
   handed to the Training Import Service (v0.02.30-training-import.js),
   which owns matching/deduplication against ALL sources and is the only
   code that turns a session into a Training activity. This file still
   never touches state.activities, XP, Achievements or any specialist page.

   SCOPE (brief §3/§25): Steps + Distance + Exercise Session metadata,
   read-only. No Sleep (records.sleep stays an empty, unused array —
   architecture only). No write-back, no auto-Achievement/auto-Class-
   unlock wiring. The Phase 1 rule "do not auto-create permanent Training
   records until mapping and deduplication are proven" is now satisfied:
   the mapping is HEALTH_EXERCISE_TO_RPG_TYPE and deduplication is the
   Training Import Service's cross-source matching. */

// ============================================================
// 1. Bridge client — promise wrapper over window.AndroidHealthBridge
//
//    TRANSPORT (rewritten 2026-09-13, pre-commit security review round
//    2): window.AndroidHealthBridge is now registered natively via
//    WebViewCompat.addWebMessageListener with an explicit HTTPS
//    allowedOriginRules entry, NOT addJavascriptInterface — see
//    MainActivity.kt's attachHealthBridge() for the full reasoning
//    (an injected JS interface is visible to every frame the WebView
//    ever loads, including an untrusted iframe; addWebMessageListener
//    has the WebView/Chromium implementation itself verify the calling
//    frame's origin before this app's code is ever reached).
//    That object shape is fundamentally different from a plain
//    method-call interface: it exposes only postMessage(string) (JS ->
//    native) and an onmessage handler (native -> JS), both message-
//    passing, not direct calls — so every request here is a JSON
//    envelope {method, args, callbackId} sent via postMessage, and
//    every reply (success or failure) arrives on the SAME onmessage
//    handler as {callbackId, result} or {callbackId, error}, routed
//    back to the right caller purely by callbackId. This also means
//    getSdkStatus is no longer synchronous (there is no synchronous
//    channel at all under this transport) — see healthSdkStatus()
//    below, now async.
// ============================================================
let __rpgHealthCallbackSeq = 0;
const __rpgHealthPending = new Map();

function healthBridgeAvailable() {
  return typeof window.AndroidHealthBridge !== 'undefined' && window.AndroidHealthBridge !== null
    && typeof window.AndroidHealthBridge.postMessage === 'function';
}

/* Wires the shared onmessage handler onto whatever object currently
   sits at window.AndroidHealthBridge, idempotently. Called lazily from
   rpgHealthBridgeCall() (not just once at script-load time) — the real
   native bridge is injected by the WebView before this script runs in
   production, but wiring it lazily costs nothing and means this file
   doesn't silently stop working if that ordering ever changes, and lets
   a dev/test harness swap in a mock bridge after load (see the Astra
   return report's proof scripts). Re-assigning the same function
   reference every call is cheap and always correct — no separate
   "already wired" flag to accidentally get out of sync with a bridge
   object that was itself replaced. */
function healthBridgeOnMessage(event) {
  let envelope;
  try { envelope = JSON.parse(event.data); } catch (e) { return; }
  const entry = __rpgHealthPending.get(envelope.callbackId);
  if (!entry) return;
  __rpgHealthPending.delete(envelope.callbackId);
  if (envelope.error) entry.reject(new Error(envelope.error));
  else entry.resolve(envelope.result);
}

/* Sends one {method, args, callbackId} envelope to the native bridge
   via postMessage and returns a Promise the shared onmessage handler
   above settles once HealthConnectBridge.kt replies with a matching
   callbackId. */
/* A call the native side never answers (WebView torn down, permission UI
   killed by the OS) must not leave the sync stuck on "Syncing" forever, so
   every request has a timeout. Permission requests wait on a human, so
   theirs is long. Mutable so tests can shorten it. */
const HEALTH_BRIDGE_TIMEOUT_MS = { default: 60000, requestPermissions: 600000, openHealthConnect: 10000 };

function rpgHealthBridgeCall(method, ...args) {
  return new Promise((resolve, reject) => {
    if (!healthBridgeAvailable()) {
      reject(new Error('AndroidHealthBridge unavailable'));
      return;
    }
    window.AndroidHealthBridge.onmessage = healthBridgeOnMessage;
    const callbackId = `hc_${Date.now()}_${++__rpgHealthCallbackSeq}`;
    const timeoutMs = HEALTH_BRIDGE_TIMEOUT_MS[method] || HEALTH_BRIDGE_TIMEOUT_MS.default;
    const timer = setTimeout(() => {
      if (__rpgHealthPending.delete(callbackId)) reject(new Error('Health Connect did not respond'));
    }, timeoutMs);
    __rpgHealthPending.set(callbackId, {
      resolve: v => { clearTimeout(timer); resolve(v); },
      reject: e => { clearTimeout(timer); reject(e); }
    });
    try {
      window.AndroidHealthBridge.postMessage(JSON.stringify({ method, args, callbackId }));
    } catch (e) {
      clearTimeout(timer);
      __rpgHealthPending.delete(callbackId);
      reject(e);
    }
  });
}

/* Now async — the message-passing transport has no synchronous channel
   at all (see the section header above). Mirrors HealthConnectClient's
   own SDK_* constants (see the Kotlin side). */
async function healthSdkStatus() {
  if (!healthBridgeAvailable()) return 'SDK_UNAVAILABLE';
  try {
    const result = await rpgHealthBridgeCall('getSdkStatus');
    return result.status || 'SDK_UNAVAILABLE';
  } catch (e) {
    /* The bridge exists but did not answer (timeout / native error): a
       transient problem, NOT "this device is unsupported". */
    return 'SDK_ERROR';
  }
}

async function healthHasPermissions() {
  try {
    const result = await rpgHealthBridgeCall('hasAllPermissions');
    return Boolean(result.granted);
  } catch (e) { return false; }
}

async function healthRequestPermissions() {
  const result = await rpgHealthBridgeCall('requestPermissions');
  return Boolean(result.granted);
}

/* Opens Health Connect's settings (grant / review / REVOKE access) or its
   Play Store page when it is missing or outdated. */
async function healthOpenHealthConnect() {
  try {
    const result = await rpgHealthBridgeCall('openHealthConnect');
    return Boolean(result.opened);
  } catch (e) { return false; }
}

async function healthReadSteps(startEpochMs, endEpochMs) {
  const result = await rpgHealthBridgeCall('readSteps', startEpochMs, endEpochMs);
  return result.records || [];
}
async function healthReadDistance(startEpochMs, endEpochMs) {
  const result = await rpgHealthBridgeCall('readDistance', startEpochMs, endEpochMs);
  return result.records || [];
}
async function healthReadExerciseSessions(startEpochMs, endEpochMs) {
  const result = await rpgHealthBridgeCall('readExerciseSessions', startEpochMs, endEpochMs);
  return result.records || [];
}

// ============================================================
// 2. Connection status (brief §20) — layers RPG's own richer
//    vocabulary on top of the native bridge's raw SDK status.
//    "Connected" is never shown merely because the bridge exists.
// ============================================================
async function healthConnectionStatus() {
  const sdk = await healthSdkStatus();
  if (sdk === 'SDK_ERROR') return 'error';
  if (sdk === 'SDK_UNAVAILABLE') return 'unavailable';
  if (sdk === 'SDK_UPDATE_REQUIRED') return 'update-required';
  const granted = await healthHasPermissions();
  if (!granted) return 'permission-required';
  return 'connected';
}

// ============================================================
// 3. Normalization (brief §7/§8) + date handling (brief §11)
// ============================================================
/* RPG-local date derivation — reuses the SAME localISO() every other
   daily system in app.js already uses (Movement/Resources/Today all key
   off this), rather than a UTC truncation, so a Health Connect record
   lands on the day it actually happened in the device's current local
   time.

   *** PHASE 1 BLOCKER — NOT RESOLVED, DO NOT TREAT AS PRODUCTION-
   AUTHORITATIVE UNTIL FIXED (flagged explicitly per the 2026-09-13
   pre-commit security/architecture review). *** This reads the local
   timezone RULE IN EFFECT AT SYNC TIME (JS Date's own local-time
   getters), not the zone that was actually active when the record was
   captured. DST within one fixed timezone resolves correctly (Date's
   epoch->local conversion is DST-aware for whatever zone the OS is
   currently set to), but a genuine zone CHANGE between capture and sync
   — travel, or the phone's Settings > timezone changed — can shift
   which calendar day a record lands on, which matters because RPG's
   whole Daily-system architecture (streaks, resets, dailyReset()) is
   date-keyed.
   FIXED (2026-09-13, pre-commit review round 2): the device-timezone-
   at-import-time proposal above was correctly rejected during review —
   it still fails across travel ("walk recorded in London, fly to
   Norway, sync RPG" could still land on the wrong day, since the
   fallback would use TODAY's zone, not London's). Health Connect
   records carry their OWN startZoneOffset/endZoneOffset (verified
   directly from the compiled connect-client AAR — nullable, Health
   Connect does not guarantee every reading has one, per
   HealthConnectBridge.kt's own comment) — the RECORD's captured offset
   is now used when present, so the RPG day is derived from where and
   when the walk actually happened, not from wherever the phone is when
   it later syncs. healthDateFromCapturedInstant() below implements
   this; every normalizer stamps a dateSource field ('record-offset' vs
   'device-fallback') so the fallback path — genuinely still possible
   when Health Connect supplies no offset for a given reading — is
   visible and auditable rather than silently indistinguishable from
   the offset-derived case. */
function healthLocalDateFromEpochMs(ms) {
  return localISO(new Date(Number(ms)));
}

/* Derives the RPG-local calendar day a Health Connect instant belongs
   to using THAT RECORD's own captured zone offset when Health Connect
   supplied one, rather than the device's current timezone. Shifting the
   UTC epoch instant by the record's own offset and then reading the
   date off that shifted instant with UTC getters means the device's
   present-day timezone never enters the calculation at all when a real
   offset is available — correct across travel, not just across DST
   within one zone. Falls back to device-local time (marked
   'device-fallback') only when Health Connect genuinely supplied no
   offset for this specific reading. */
function healthDateFromCapturedInstant(epochMs, zoneOffsetSeconds) {
  if (zoneOffsetSeconds === null || zoneOffsetSeconds === undefined) {
    return { date: healthLocalDateFromEpochMs(epochMs), dateSource: 'device-fallback' };
  }
  const shifted = new Date(Number(epochMs) + Number(zoneOffsetSeconds) * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return { date: `${y}-${m}-${d}`, dateSource: 'record-offset' };
}

function healthRecordId(externalId) {
  return `health-connect:${externalId}`;
}

/* A raw record is usable only with a real id and sane instants. Anything
   else is counted as malformed and skipped; one bad record never aborts
   the sync of the good ones. */
function healthRawIsUsable(raw) {
  return Boolean(raw) && typeof raw === 'object'
    && (typeof raw.externalId === 'string' || typeof raw.externalId === 'number')
    && String(raw.externalId).length > 0
    && Number.isFinite(Number(raw.startAt)) && Number.isFinite(Number(raw.endAt))
    && Number(raw.endAt) >= Number(raw.startAt);
}
function healthUpdatedAt(raw) {
  const n = Number(raw.lastModifiedAt);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* HH:MM in the zone the record was captured in (same offset logic as the
   date above), so an imported session's time matches where it happened. */
function healthTimeFromCapturedInstant(epochMs, zoneOffsetSeconds) {
  if (zoneOffsetSeconds === null || zoneOffsetSeconds === undefined) {
    const d = new Date(Number(epochMs));
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  const shifted = new Date(Number(epochMs) + Number(zoneOffsetSeconds) * 1000);
  return String(shifted.getUTCHours()).padStart(2, '0') + ':' + String(shifted.getUTCMinutes()).padStart(2, '0');
}

function normalizeStepsRecord(raw) {
  const { date, dateSource } = healthDateFromCapturedInstant(raw.startAt, raw.startZoneOffsetSeconds);
  return {
    id: healthRecordId(raw.externalId),
    externalId: String(raw.externalId),
    provider: 'health-connect',
    type: 'movement',
    startAt: raw.startAt,
    endAt: raw.endAt,
    date,
    dateSource,
    steps: Math.max(0, Number(raw.steps || 0) || 0),
    sourceApp: raw.sourceApp || null,
    importedAt: Date.now(),
    lastUpdatedAt: healthUpdatedAt(raw)
  };
}

function normalizeDistanceRecord(raw) {
  const { date, dateSource } = healthDateFromCapturedInstant(raw.startAt, raw.startZoneOffsetSeconds);
  return {
    id: healthRecordId(raw.externalId),
    externalId: String(raw.externalId),
    provider: 'health-connect',
    type: 'movement',
    startAt: raw.startAt,
    endAt: raw.endAt,
    date,
    dateSource,
    distanceMeters: Math.max(0, Number(raw.distanceMeters || 0) || 0),
    sourceApp: raw.sourceApp || null,
    importedAt: Date.now(),
    lastUpdatedAt: healthUpdatedAt(raw)
  };
}

/* Health Connect ExerciseSessionRecord.exerciseType int -> RPG Training
   type string, used ONLY for Journey-eligible movement (the vocabulary
   creditJourneyMovement()/JOURNEY_MOVEMENT_PROFILES already use). Values
   verified 2026-09-13 from the compiled connect-client 1.1.0 AAR
   (javap -constants). Everything else keeps activityType and gets
   mapsToTrainingType:null. Unchanged by the integrations pass. */
const HEALTH_EXERCISE_TYPE_TO_TRAINING = {
  56: 'Running',   // EXERCISE_TYPE_RUNNING
  57: 'Running',   // EXERCISE_TYPE_RUNNING_TREADMILL
  79: 'Walking',   // EXERCISE_TYPE_WALKING
  37: 'Hiking',    // EXERCISE_TYPE_HIKING
  8: 'Cycling',    // EXERCISE_TYPE_BIKING
  9: 'Cycling',    // EXERCISE_TYPE_BIKING_STATIONARY
  53: 'Rowing',    // EXERCISE_TYPE_ROWING
  61: 'Skiing'     // EXERCISE_TYPE_SKIING
};

/* Health Connect exercise type -> RPG ACTIVITY_TYPE for the Normalized
   Training Session. Constants re-verified 2026-09-19 against the same
   AAR. Only types with an unambiguous RPG equivalent are mapped;
   anything else (Pilates, HIIT, elliptical, dancing, ...) imports as
   'Other' with its own title and duration and NO category metrics --
   degrading safely rather than guessing a category. */
const HEALTH_EXERCISE_TO_RPG_TYPE = {
  56: 'Running', 57: 'Running',
  79: 'Walking', 37: 'Hiking',
  8: 'Cycling', 9: 'Cycling',
  73: 'Swimming', 74: 'Swimming',
  70: 'Gym / Strength', 81: 'Gym / Strength',
  83: 'Yoga', 13: 'Calisthenics',
  53: 'Rowing', 54: 'Rowing',
  61: 'Skiing', 51: 'Climbing', 46: 'Kayaking',
  11: 'Boxing', 44: 'Martial Arts',
  32: 'Golf', 76: 'Tennis', 5: 'Basketball', 78: 'Volleyball',
  75: 'Table Tennis', 55: 'Rugby', 64: 'Football'
};

function normalizeExerciseRecord(raw) {
  const { date, dateSource } = healthDateFromCapturedInstant(raw.startAt, raw.startZoneOffsetSeconds);
  const sessionDistance = Number(raw.sessionDistanceMeters);
  return {
    id: healthRecordId(raw.externalId),
    externalId: String(raw.externalId),
    provider: 'health-connect',
    type: 'exercise',
    activityType: raw.activityType,
    mapsToTrainingType: HEALTH_EXERCISE_TYPE_TO_TRAINING[raw.activityType] || null,
    title: typeof raw.title === 'string' && raw.title ? raw.title : null,
    startAt: raw.startAt,
    endAt: raw.endAt,
    date,
    time: healthTimeFromCapturedInstant(raw.startAt, raw.startZoneOffsetSeconds),
    dateSource,
    durationSeconds: Number(raw.durationSeconds || 0),
    /* NOT distanceMeters: that field feeds healthImportedDistanceMeters
       ForDate() and Journey crediting, and a session's distance is just
       the sum of DistanceRecords those paths already count. Keeping it
       separate makes double-counting structurally impossible. */
    sessionDistanceMeters: Number.isFinite(sessionDistance) && sessionDistance > 0 ? sessionDistance : undefined,
    sourceApp: raw.sourceApp || null,
    importedAt: Date.now(),
    lastUpdatedAt: healthUpdatedAt(raw)
  };
}

/* Health Connect exercise record -> Normalized Training Session (the
   adapter's whole output). Consumed only by trainingImportSessions(). */
function healthExerciseToSession(record) {
  return {
    source: 'health-connect',
    providerRecordId: record.externalId,
    type: HEALTH_EXERCISE_TO_RPG_TYPE[record.activityType] || 'Other',
    name: record.title,
    startAt: record.startAt,
    endAt: record.endAt,
    durationSeconds: record.durationSeconds,
    distanceMeters: record.sessionDistanceMeters,
    date: record.date,
    time: record.time,
    sourceApp: record.sourceApp,
    lastUpdatedAt: record.lastUpdatedAt,
    importedAt: record.importedAt
  };
}

// ============================================================
// 4. Dedup + merge (brief §9 — mandatory, "import once -> 10,000
//    steps; import again -> still 10,000 steps")
//
//    EXACT IDEMPOTENCY MECHANISM (2026-09-13, written for the pre-
//    commit security/architecture review — "the exact mechanism...
//    even if the sync cursor is reset or the app is reinstalled"):
//
//    Journey/Movement credit is issued ONLY from inside onNewRecord,
//    which healthMergeRecords() below calls ONLY for a record whose id
//    is not already present in `bucketArray` (state.health.records.
//    movement/.exercise) — a plain `Set` membership check, rebuilt
//    fresh from the PERSISTED array on every call, not from the sync
//    cursor. This is deliberate: the cursor (state.health.import.
//    syncedThroughAt) only controls what Health Connect is even ASKED
//    for; it has no say over whether a returned record gets credited.
//    So resetting the cursor and re-syncing (proven live, see the
//    Astra return report's HC-004 test) re-reads the same raw records
//    from Health Connect, but healthMergeRecords() still refuses to
//    add them a second time or call onNewRecord again — credit is
//    topologically impossible to double-fire as long as the record's
//    id is still sitting in the persisted array.
//
//    THE ONE CASE THIS DOES NOT COVER, STATED PLAINLY: if
//    state.health.records itself is lost — an app reinstall or
//    "clear app data" with no prior save export/restore (Export Save/
//    Import Save doesn't exist yet, see the separate PWA staging
//    brief's §10) — the dedup ledger is gone. A subsequent sync would
//    re-read the same historical Health Connect data (if still inside
//    the lookback window) and see it as brand new, crediting Journey
//    progress again. This is a real, named gap, not an oversight: the
//    mechanism's safety is entirely contingent on state.health.records
//    surviving, exactly like every other piece of RPG state today —
//    solving it is the same Export/Import Save work already scoped
//    for before Health data becomes production-authoritative, not a
//    separate problem this file should invent its own fix for.
// ============================================================
function healthMergeRecords(bucketArray, normalizedRecords, onNewRecord) {
  const seen = new Set(bucketArray.map(r => r.id));
  let added = 0, duplicates = 0;
  normalizedRecords.forEach(r => {
    if (seen.has(r.id)) { duplicates++; return; }
    bucketArray.push(r);
    seen.add(r.id);
    added++;
    if (typeof onNewRecord === 'function') onNewRecord(r);
  });
  return { added, duplicates };
}

// ============================================================
// 5. Journey/Movement crediting — ONLY ever called for records that
//    healthMergeRecords() just confirmed are NEW (brief §13: Health
//    Import -> normalized distance -> Journey movement engine; the
//    engine itself, creditJourneyMovement() in app.js, is untouched).
// ============================================================
function healthCreditNewMovementRecord(record) {
  if (!(record.distanceMeters > 0)) return;
  if (typeof creditJourneyMovement !== 'function') return;
  creditJourneyMovement({ type: 'Walking', distance: record.distanceMeters / 1000 });
}
function healthCreditNewExerciseRecord(record) {
  if (!record.mapsToTrainingType) return;
  if (!(record.distanceMeters > 0)) return;
  if (typeof creditJourneyMovement !== 'function') return;
  creditJourneyMovement({ type: record.mapsToTrainingType, distance: record.distanceMeters / 1000 });
}

// ============================================================
// 6. Resolvers (brief §12/§13) — the ONLY sanctioned way Movement/
//    Journeys ever read Health-imported evidence. Always recomputed
//    from the deduplicated records array, never an accumulated running
//    total — that's what makes re-sync naturally idempotent, on top of
//    the id-based dedup in healthMergeRecords() itself (belt and
//    braces: even if a bug ever let a duplicate id through, these still
//    can't double-count because summing the same deduplicated array
//    twice yields the same sum both times).
// ============================================================
function healthImportedStepsForDate(iso) {
  const records = state.health?.records?.movement || [];
  return records.filter(r => r.date === iso).reduce((sum, r) => sum + Number(r.steps || 0), 0);
}
function healthImportedDistanceMetersForDate(iso) {
  const movement = state.health?.records?.movement || [];
  const exercise = state.health?.records?.exercise || [];
  const fromMovement = movement.filter(r => r.date === iso).reduce((sum, r) => sum + Number(r.distanceMeters || 0), 0);
  const fromExercise = exercise.filter(r => r.date === iso).reduce((sum, r) => sum + Number(r.distanceMeters || 0), 0);
  return fromMovement + fromExercise;
}

// ============================================================
// 7. Sync orchestration — the RPG Health Import Service itself
//    (brief §10 incremental sync, §21 fail-safe, §22 logging)
// ============================================================
const HEALTH_INITIAL_LOOKBACK_DAYS = 7; // "modest testing window" per §10
/* Re-read the last 48 h on every sync. A watch can hand a session to
   Health Connect hours after it happened (its start is then BEFORE the
   sync cursor) and records can be edited later; a cursor-only read would
   never see either. Safe because every merge below is idempotent. Capped
   at 30 days so a long-unopened app does not re-read months. */
const HEALTH_RESYNC_OVERLAP_MS = 48 * 60 * 60 * 1000;
const HEALTH_MAX_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
/* Steps arrive per-minute from a watch, so the dedup ledger would grow
   without bound in localStorage. Records older than this can never be
   re-read (lookback is 30 days), so dropping them cannot cause a
   re-import. */
const HEALTH_RECORD_RETENTION_DAYS = 90;
const HEALTH_AUTO_SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;

let __healthSyncInFlight = null;
let __healthLastAutoSyncAt = 0;

function healthPruneOldRecords(now) {
  const cutoff = (now || Date.now()) - HEALTH_RECORD_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const h = state.health;
  h.records.movement = h.records.movement.filter(r => Number(r.startAt) >= cutoff);
  h.records.exercise = h.records.exercise.filter(r => Number(r.startAt) >= cutoff);
}

/* Concurrent callers (auto-sync + a tap on Sync) share one run. */
function syncHealthConnect() {
  if (__healthSyncInFlight) return __healthSyncInFlight;
  __healthSyncInFlight = (async () => {
    try { return await __syncHealthConnectImpl(); }
    finally { __healthSyncInFlight = null; }
  })();
  return __healthSyncInFlight;
}

async function __syncHealthConnectImpl() {
  const h = state.health;
  h.connection.status = 'syncing';

  const sdk = await healthSdkStatus();
  if (sdk === 'SDK_ERROR') {
    h.connection.status = 'sync-error';
    h.connection.lastError = 'Health Connect did not respond. Try again.';
    save();
    return { ok: false, status: 'sync-error', error: h.connection.lastError };
  }
  if (sdk !== 'SDK_AVAILABLE') {
    h.connection.status = sdk === 'SDK_UPDATE_REQUIRED' ? 'update-required' : 'unavailable';
    h.connection.lastError = `Health Connect SDK status: ${sdk}`;
    save();
    console.log('HEALTH SYNC START');
    console.log(`Health Connect unavailable (${sdk}) — sync skipped.`);
    return { ok: false, status: h.connection.status };
  }

  const granted = await healthHasPermissions();
  if (!granted) {
    h.connection.status = 'permission-required';
    save();
    console.log('HEALTH SYNC START');
    console.log('Permission not granted — sync skipped.');
    return { ok: false, status: h.connection.status };
  }

  const now = Date.now();
  const cursor = Number(h.import.syncedThroughAt) || 0;
  const syncStart = cursor
    ? Math.max(cursor - HEALTH_RESYNC_OVERLAP_MS, now - HEALTH_MAX_LOOKBACK_MS)
    : now - HEALTH_INITIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  console.log('HEALTH SYNC START');
  try {
    const [stepsRaw, distanceRaw, exerciseRaw] = await Promise.all([
      healthReadSteps(syncStart, now),
      healthReadDistance(syncStart, now),
      healthReadExerciseSessions(syncStart, now)
    ]);

    let malformed = 0;
    const safe = (list, normalize) => (Array.isArray(list) ? list : []).flatMap(raw => {
      if (!healthRawIsUsable(raw)) { malformed++; return []; }
      try { return [normalize(raw)]; } catch (e) { malformed++; return []; }
    });
    const normalizedSteps = safe(stepsRaw, normalizeStepsRecord);
    const normalizedDistance = safe(distanceRaw, normalizeDistanceRecord);
    const normalizedExercise = safe(exerciseRaw, normalizeExerciseRecord);

    const movementResult = healthMergeRecords(h.records.movement, [...normalizedSteps, ...normalizedDistance], healthCreditNewMovementRecord);
    const exerciseResult = healthMergeRecords(h.records.exercise, normalizedExercise, healthCreditNewExerciseRecord);

    /* Exercise sessions -> Normalized Training Sessions -> the Training
       Import Service. ALL sessions read this sync go through (not only
       ledger-new ones) so a late or edited record still reconciles; the
       service dedups. A failure here must never fail the sync or break
       Training: the ledger above is already merged. */
    let importResult = null;
    try {
      if (typeof trainingImportSessions === 'function') {
        importResult = trainingImportSessions(normalizedExercise.map(healthExerciseToSession));
      }
    } catch (e) {
      importResult = { error: e.message || String(e) };
      console.log('HEALTH IMPORT ERROR: ' + importResult.error);
    }

    healthPruneOldRecords(now);
    h.import.syncedThroughAt = now;
    h.import.lastImport = importResult ? { at: now, malformed, ...importResult } : { at: now, malformed };
    h.connection.status = 'connected';
    h.connection.everConnected = true;
    h.connection.lastSyncAt = now;
    h.connection.lastError = null;
    h.connection.deniedAt = null;
    save();

    console.log(`Steps records read: ${stepsRaw.length}`);
    console.log(`Distance records read: ${distanceRaw.length}`);
    console.log(`Exercise records read: ${exerciseRaw.length}`);
    console.log(`New normalized records: ${movementResult.added + exerciseResult.added}`);
    console.log(`Duplicates ignored: ${movementResult.duplicates + exerciseResult.duplicates}`);
    console.log(`Malformed skipped: ${malformed}`);
    console.log('Sync completed');

    try {
      if (page === 'home') renderHome();
      else if (page === 'training' && typeof renderTrainingArea === 'function') renderTrainingArea();
    } catch (e) { /* a render problem must not turn a good sync into an error */ }

    return {
      ok: true,
      status: 'connected',
      newRecords: movementResult.added + exerciseResult.added,
      duplicates: movementResult.duplicates + exerciseResult.duplicates,
      malformed,
      import: importResult
    };
  } catch (e) {
    // §21 -- a failed sync must not wipe already-imported data: h.records
    // is only ever pushed to (healthMergeRecords), and syncedThroughAt is
    // only advanced on the success path above.
    h.connection.status = 'sync-error';
    h.connection.lastError = e.message || String(e);
    save();
    console.log('HEALTH SYNC ERROR: ' + h.connection.lastError);
    return { ok: false, status: 'sync-error', error: h.connection.lastError };
  }
}

/* Connect flow used by the Connections UI: distinguishes "not available",
   "denied" and "granted" instead of collapsing them, and records the
   denial so the UI can offer the only thing that still works after Android
   stops showing the dialog (opening Health Connect itself). */
async function healthConnect() {
  const h = state.health;
  const sdk = await healthSdkStatus();
  if (sdk === 'SDK_ERROR') {
    h.connection.status = 'sync-error';
    h.connection.lastError = 'Health Connect did not respond. Try again.';
    save();
    return { ok: false, status: 'sync-error', error: h.connection.lastError };
  }
  if (sdk !== 'SDK_AVAILABLE') {
    h.connection.status = sdk === 'SDK_UPDATE_REQUIRED' ? 'update-required' : 'unavailable';
    save();
    return { ok: false, status: h.connection.status };
  }
  let granted = false;
  try { granted = await healthRequestPermissions(); }
  catch (e) {
    h.connection.status = 'permission-required';
    h.connection.lastError = e.message || String(e);
    save();
    return { ok: false, status: 'permission-required', error: h.connection.lastError };
  }
  if (!granted) {
    h.connection.status = 'permission-required';
    h.connection.deniedAt = Date.now();
    h.connection.lastError = null;
    save();
    return { ok: false, status: 'permission-required', denied: true };
  }
  return syncHealthConnect();
}

/* Re-checks the REAL state (bridge, SDK, granted permissions) without
   reading any data. Catches a revoked permission or a removed Health
   Connect on app start/resume. Imported history is kept. */
async function healthRefreshConnectionStatus() {
  const h = state.health;
  if (h.connection.status === 'syncing' && __healthSyncInFlight) return h.connection.status;
  let status;
  if (!healthBridgeAvailable()) status = 'unavailable';
  else status = await healthConnectionStatus();
  if (status === 'error') return h.connection.status; // could not tell; keep what we knew
  if (status === 'connected' && h.connection.status === 'sync-error') status = 'sync-error';
  if (status === 'connected' && h.connection.status === 'unavailable') status = 'connected';
  if (h.connection.status !== status) {
    h.connection.status = status;
    save();
  }
  return status;
}

/* Foreground-only, throttled. Never requests permission on its own. */
async function healthAutoSync(force) {
  if (!healthBridgeAvailable()) return null;
  const now = Date.now();
  if (!force && now - __healthLastAutoSyncAt < HEALTH_AUTO_SYNC_MIN_INTERVAL_MS) return null;
  __healthLastAutoSyncAt = now;
  const status = await healthRefreshConnectionStatus();
  if (status === 'connected' || status === 'sync-error') return syncHealthConnect();
  return { ok: false, status };
}

/* "Remove imported data" for Health Connect: clears the ledger and cursor
   plus the Training activities that exist only because of this source
   (see trainingRemoveImportedFromSource). Does NOT revoke permission --
   that is done in Health Connect itself (healthOpenHealthConnect). */
function healthRemoveImportedData() {
  const h = state.health;
  h.records.movement = [];
  h.records.exercise = [];
  h.import.syncedThroughAt = null;
  h.import.lastImport = null;
  const result = typeof trainingRemoveImportedFromSource === 'function'
    ? trainingRemoveImportedFromSource('health-connect')
    : { removed: 0, unlinked: 0 };
  save();
  return result;
}

/* A save written mid-sync (app killed) would otherwise show "Syncing…"
   forever. */
(function healthNormalizeStuckStatus() {
  const c = state.health && state.health.connection;
  if (c && c.status === 'syncing') c.status = c.lastSyncAt ? 'connected' : 'disconnected';
})();

/* App start + return to foreground. */
setTimeout(() => { healthAutoSync(false).catch(() => {}); }, 1500);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') healthAutoSync(false).catch(() => {});
});
