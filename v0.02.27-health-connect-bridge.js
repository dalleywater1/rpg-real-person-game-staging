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
   reports the same status) — this is also how HC-001/HC-004/etc. get
   proven logically without a physical device: see
   __healthConnectTestHarness at the bottom, a dev-only mock bridge that
   stands in for window.AndroidHealthBridge.

   SCOPE (brief §3/§25): Steps + Distance + Exercise Session metadata,
   read-only. No Sleep (records.sleep stays an empty, unused array —
   architecture only). No write-back, no auto-Achievement/auto-Class-
   unlock wiring, no Garmin/Strava/Apple Health. Exercise Sessions are
   normalized and stored with real provenance but are NOT auto-inserted
   into state.activities (Training's real activity list) — see
   healthExerciseToTrainingActivity(), a ready-but-unwired mapping
   function, per §14/HC1.9's explicit "do not auto-create permanent
   Training records until mapping and deduplication are proven." */

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
function rpgHealthBridgeCall(method, ...args) {
  return new Promise((resolve, reject) => {
    if (!healthBridgeAvailable()) {
      reject(new Error('AndroidHealthBridge unavailable'));
      return;
    }
    window.AndroidHealthBridge.onmessage = healthBridgeOnMessage;
    const callbackId = `hc_${Date.now()}_${++__rpgHealthCallbackSeq}`;
    __rpgHealthPending.set(callbackId, { resolve, reject });
    try {
      window.AndroidHealthBridge.postMessage(JSON.stringify({ method, args, callbackId }));
    } catch (e) {
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
  } catch (e) { return 'SDK_UNAVAILABLE'; }
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
  if (sdk === 'SDK_UNAVAILABLE') return 'unavailable';
  if (sdk === 'SDK_UPDATE_REQUIRED') return 'unavailable';
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

function normalizeStepsRecord(raw) {
  const { date, dateSource } = healthDateFromCapturedInstant(raw.startAt, raw.startZoneOffsetSeconds);
  return {
    id: healthRecordId(raw.externalId),
    externalId: raw.externalId,
    provider: 'health-connect',
    type: 'movement',
    startAt: raw.startAt,
    endAt: raw.endAt,
    date,
    dateSource,
    steps: Number(raw.steps || 0),
    sourceApp: raw.sourceApp || null,
    importedAt: Date.now()
  };
}

function normalizeDistanceRecord(raw) {
  const { date, dateSource } = healthDateFromCapturedInstant(raw.startAt, raw.startZoneOffsetSeconds);
  return {
    id: healthRecordId(raw.externalId),
    externalId: raw.externalId,
    provider: 'health-connect',
    type: 'movement',
    startAt: raw.startAt,
    endAt: raw.endAt,
    date,
    dateSource,
    distanceMeters: Number(raw.distanceMeters || 0),
    sourceApp: raw.sourceApp || null,
    importedAt: Date.now()
  };
}

/* Health Connect ExerciseSessionRecord.exerciseType int -> RPG Training
   type string (the vocabulary creditJourneyMovement()/
   JOURNEY_MOVEMENT_PROFILES already use — see app.js). Values verified
   2026-09-13 directly from the compiled androidx.health.connect:connect-
   client:1.1.0 AAR (javap -p -constants on ExerciseSessionRecord.class),
   not guessed or copied from documentation prose. Only the subset that
   maps onto an existing Journey-eligible type is included — everything
   else normalizes with activityType kept (so it's still visible/usable
   later) but mapsToTrainingType:null, and healthCreditNewExerciseRecord
   below simply won't credit a Journey for those, which is correct: a
   game of squash isn't foot-or-cycle movement. */
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

function normalizeExerciseRecord(raw) {
  const { date, dateSource } = healthDateFromCapturedInstant(raw.startAt, raw.startZoneOffsetSeconds);
  return {
    id: healthRecordId(raw.externalId),
    externalId: raw.externalId,
    provider: 'health-connect',
    type: 'exercise',
    activityType: raw.activityType,
    mapsToTrainingType: HEALTH_EXERCISE_TYPE_TO_TRAINING[raw.activityType] || null,
    title: raw.title || null,
    startAt: raw.startAt,
    endAt: raw.endAt,
    date,
    dateSource,
    durationSeconds: Number(raw.durationSeconds || 0),
    distanceMeters: raw.distanceMeters != null ? Number(raw.distanceMeters) : undefined,
    sourceApp: raw.sourceApp || null,
    importedAt: Date.now()
  };
}

/* Ready-but-unwired Exercise Session -> Training activity mapping
   (brief §14/HC1.9 — "architecture preparation, not necessarily
   complete Training auto-import... do not auto-create permanent
   Training records until mapping and deduplication are proven").
   Nothing in this file calls this yet; it exists so a future "Review &
   Import" UI has a single correct place to do the conversion instead of
   reinventing it, and so this mapping decision is visible/reviewable
   now rather than invented later under time pressure. */
function healthExerciseToTrainingActivity(record) {
  return {
    id: uid(),
    type: record.mapsToTrainingType || 'Other',
    date: record.date,
    distance: record.distanceMeters != null ? record.distanceMeters / 1000 : 0,
    durationMinutes: Math.round(record.durationSeconds / 60),
    completed: true,
    source: 'Health Connect',
    healthExternalId: record.externalId
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

async function syncHealthConnect() {
  const h = state.health;
  h.connection.status = 'syncing';

  const sdk = await healthSdkStatus();
  if (sdk !== 'SDK_AVAILABLE') {
    h.connection.status = sdk === 'SDK_UNAVAILABLE' ? 'unavailable' : 'unavailable';
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
  const syncStart = h.import.syncedThroughAt
    ? Number(h.import.syncedThroughAt)
    : now - HEALTH_INITIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  console.log('HEALTH SYNC START');
  try {
    const [stepsRaw, distanceRaw, exerciseRaw] = await Promise.all([
      healthReadSteps(syncStart, now),
      healthReadDistance(syncStart, now),
      healthReadExerciseSessions(syncStart, now)
    ]);

    const normalizedMovement = [
      ...stepsRaw.map(normalizeStepsRecord),
      ...distanceRaw.map(normalizeDistanceRecord)
    ];
    const normalizedExercise = exerciseRaw.map(normalizeExerciseRecord);

    const movementResult = healthMergeRecords(h.records.movement, normalizedMovement, healthCreditNewMovementRecord);
    const exerciseResult = healthMergeRecords(h.records.exercise, normalizedExercise, healthCreditNewExerciseRecord);

    h.import.syncedThroughAt = now;
    h.connection.status = 'connected';
    h.connection.lastSyncAt = now;
    h.connection.lastError = null;
    save();

    console.log(`Steps records read: ${stepsRaw.length}`);
    console.log(`Distance records read: ${distanceRaw.length}`);
    console.log(`Exercise records read: ${exerciseRaw.length}`);
    console.log(`New normalized records: ${movementResult.added + exerciseResult.added}`);
    console.log(`Duplicates ignored: ${movementResult.duplicates + exerciseResult.duplicates}`);
    console.log('Sync completed');

    if (page === 'home') renderHome();

    return {
      ok: true,
      status: 'connected',
      newRecords: movementResult.added + exerciseResult.added,
      duplicates: movementResult.duplicates + exerciseResult.duplicates
    };
  } catch (e) {
    // §21 — a failed sync must not wipe already-imported data: h.records
    // is only ever pushed to (healthMergeRecords), never reset, and
    // syncedThroughAt is only advanced on the success path above, so a
    // failure here simply leaves both exactly where they were.
    h.connection.status = 'sync-error';
    h.connection.lastError = e.message || String(e);
    save();
    console.log('HEALTH SYNC ERROR: ' + h.connection.lastError);
    return { ok: false, status: 'sync-error', error: h.connection.lastError };
  }
}

// ============================================================
// 8. Diagnostic Sync UI (brief §19) — deliberately placed inside the
//    existing Connections screen (trainingManageConnections(), app.js)
//    rather than a new screen, since "Health Connect" already exists
//    there as a placeholder row (found during the pre-implementation
//    audit) and the brief's own long-term placement is "Profile & Setup
//    → Connections alongside future Garmin/Strava integrations" — this
//    IS that location, just reached one phase early.
// ============================================================
function healthConnectSyncPanelHTML() {
  const h = state.health;
  const statusLabel = {
    'unavailable': 'Unavailable on this device',
    'disconnected': 'Not connected',
    'permission-required': 'Permission required',
    'connected': 'Connected',
    'syncing': 'Syncing…',
    'sync-error': 'Sync error'
  }[h.connection.status] || 'Not connected';
  const lastSync = h.connection.lastSyncAt
    ? new Date(h.connection.lastSyncAt).toLocaleString()
    : 'Never';
  const actionLabel = h.connection.status === 'permission-required' ? 'Grant Permissions'
    : h.connection.status === 'unavailable' ? 'Unavailable'
    : 'Sync Now';
  return `<div class="health-connect-sync-panel">
    <div class="health-connect-sync-row"><span>Health Connect</span><b>${esc(statusLabel)}</b></div>
    <div class="health-connect-sync-row"><span>Last sync</span><b>${esc(lastSync)}</b></div>
    ${h.connection.lastError ? `<p class="helper">${esc(h.connection.lastError)}</p>` : ''}
    <button type="button" class="rpg-btn accent" id="healthConnectSyncNow" ${h.connection.status === 'unavailable' ? 'disabled' : ''}>${esc(actionLabel)}</button>
  </div>`;
}

function bindHealthConnectSyncPanel() {
  const btn = document.querySelector('#healthConnectSyncNow');
  if (!btn) return;
  btn.onclick = async () => {
    if (state.health.connection.status === 'permission-required') {
      await healthRequestPermissions();
    }
    await syncHealthConnect();
    if (typeof trainingManageConnections === 'function') trainingManageConnections();
  };
}

/* Reassigns trainingManageConnections() (app.js) to append the sync
   panel when "Health Connect" is the selected connection — same
   override pattern already used throughout this project for a targeted
   addition to an existing render function (see e.g. v0.02.4.16's
   resourcesHeaderHTML reassignment). Everything else about the
   Connections modal (the row list, the Garmin/Strava placeholder
   copy) is untouched. */
if (typeof trainingManageConnections === 'function') {
  const __healthPreviousTrainingManageConnections = trainingManageConnections;
  trainingManageConnections = function() {
    __healthPreviousTrainingManageConnections();
    const current = ensureTrainingState().selectedConnection;
    if (current !== 'Health Connect') return;
    const list = modalRoot.querySelector('.training-connection-list');
    if (!list || modalRoot.querySelector('.health-connect-sync-panel')) return;
    list.insertAdjacentHTML('afterend', healthConnectSyncPanelHTML());
    bindHealthConnectSyncPanel();
  };
}
