/* RPG v0.02.30 -- Training Import Service (Integrations Readiness,
   2026-09-19).

   ONE entry point for every external source:

       Health Connect --+
       Strava ----------+--> adapter --> Normalized Training Session
       Garmin (later) --+                        |
                                                 v
                                     trainingImportSessions()
                                                 |
                                                 v
                            state.activities (Training stays authoritative)

   Adapters only ever produce Normalized Training Sessions. They never
   touch state.activities, XP, Achievements, Classes or any specialist
   page. This file is the single place a session becomes (or merges into)
   a Training activity, through the existing canonical ingest
   (v023IngestActivity), so imports use the same identity, fingerprint and
   schedule projection as manual entries.

   NORMALIZED TRAINING SESSION (input contract)
     source              'health-connect' | 'strava' | 'garmin'
     providerRecordId    provider's own id for the record (string)
     type                RPG activity type (one of ACTIVITY_TYPES) or 'Other'
     name                optional provider title
     startAt / endAt     epoch ms (absolute instants)
     durationSeconds     optional; defaults to endAt-startAt (Strava passes
                         moving time here so it compares with manual entry)
     distanceMeters      optional; never fabricated, dropped when not > 0
     date / time         optional 'YYYY-MM-DD' / 'HH:MM' in the zone the
                         activity happened in (falls back to device local)
     sourceApp           optional originating app/package
     lastUpdatedAt       optional epoch ms of the provider's last edit
     importedAt          epoch ms

   PROVENANCE ON THE ACTIVITY (existing schema, extended)
     source              'Manual' | 'Health Connect' | 'Strava' | 'Garmin'
                         (the highest-priority source that describes it)
     sourceActivityId    provider record id of that source (this is the
                         session's providerRecordId)
     sourceApp, importedAt, lastUpdatedAt
     sourceRefs[]        every provider record known to be this same real
                         activity: {source, id, sourceApp, importedAt,
                         lastUpdatedAt}
     imported: true      set only when the activity was created by an import
                         (a manual activity that a provider later matched
                         stays imported:false)

   DEDUPLICATION (never two workouts for one real activity)
     1. Identity: same provider + record id already linked -> same
        activity. Unchanged -> no-op. Newer lastUpdatedAt -> refresh
        metrics only.
     2. Cross-source match against COMPLETED activities of any source
        (manual, Health Connect, Strava, Garmin). ALL must hold:
          - same activity family (Running/Long Run/Interval Run are one)
          - at least one metric both sides have (distance or duration) and
            every such metric agrees: distance within max(15%, 0.3 km),
            duration within max(20%, 5 min)
          - precise timing (both have start/end): windows overlap >= 70%
            of the shorter one AND starts within max(10 min, 15% of the
            longer duration). Two back-to-back separate sessions do not
            overlap, so they are never merged.
          - imprecise timing (manual entry): same calendar day, and if the
            manual entry has a time, within 90 min of the start.
        Two records from the SAME provider AND SAME app are separate
        records, never fuzzy-merged.
        If two existing activities match about equally the result is
        ambiguous -> treated as NOT reliable -> a new activity is created
        (a wrong merge loses data; a duplicate can be fixed by the user).
     3. Planned (not completed) activities are never matched or completed
        by an import.

   SOURCE PRIORITY (conflicting fields)   Manual > Strava > Garmin >
   Health Connect > anything else. A manual entry is never overwritten: the
   import only FILLS blanks (duration, distance, time, precise start/end)
   and records the provider link. A higher-priority provider replaces the
   metrics and source of a lower-priority imported activity; a lower one
   only adds its link.

   NOT DONE HERE (by design): no XP, no stats, no achievements, no Journey
   or Campaign credit, no personal-record processing. Imported sessions are
   created completed with xpAwarded:true so toggling completion can never
   award XP. NOTE FOR REVIEW: achievement counters in
   v0.02.4-integration.js recompute from every completed state.activities
   entry on each save, so an imported session counts toward session-count
   achievements exactly like a manual one. That is existing Training/
   Achievements behaviour, not changed here. */

const TRAINING_IMPORT_SOURCES = {
  'health-connect': { label: 'Health Connect', priority: 5 },
  garmin: { label: 'Garmin', priority: 6 },
  strava: { label: 'Strava', priority: 7 }
};
const TRAINING_MANUAL_PRIORITY = 10;
const TRAINING_IMPORT_MIN_START_MS = Date.UTC(2000, 0, 1);
const TRAINING_IMPORT_MIN_SECONDS = 60;
const TRAINING_IMPORT_MAX_SECONDS = 24 * 3600;
const TRAINING_IMPORT_MAX_DISTANCE_M = 1000000;

function trainingSourceLabel(id) {
  return (TRAINING_IMPORT_SOURCES[id] || {}).label || null;
}
function trainingSourceIdOfLabel(label) {
  return Object.keys(TRAINING_IMPORT_SOURCES).find(k => TRAINING_IMPORT_SOURCES[k].label === label) || null;
}
function trainingActivityPriority(a) {
  const label = (a && a.source) || 'Manual';
  if (label === 'Manual') return TRAINING_MANUAL_PRIORITY;
  const id = trainingSourceIdOfLabel(label);
  return id ? TRAINING_IMPORT_SOURCES[id].priority : 3;
}

const TRAINING_DEFAULT_NAMES = {
  Running: 'Run', 'Long Run': 'Long Run', 'Interval Run': 'Interval Run', Cycling: 'Ride',
  'Gym / Strength': 'Strength Workout', Swimming: 'Swim', Walking: 'Walk', Hiking: 'Hike',
  Yoga: 'Yoga', Rowing: 'Row', Climbing: 'Climb', Skiing: 'Ski Session', Other: 'Workout'
};
function trainingDefaultName(type) {
  return TRAINING_DEFAULT_NAMES[type] || 'Workout';
}

function trainingTypeFamily(type) {
  if (['Running', 'Long Run', 'Interval Run'].includes(type)) return 'family:run';
  return 'type:' + type;
}

function trainingLocalParts(ms) {
  const d = new Date(Number(ms));
  return {
    date: localISO(d),
    time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  };
}

/* ---------- validation: a malformed record is rejected with a reason,
   never imported half-formed and never allowed to throw. ---------- */
function trainingImportValidate(raw, now) {
  now = now || Date.now();
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not-an-object' };
  const src = TRAINING_IMPORT_SOURCES[raw.source];
  if (!src) return { ok: false, reason: 'unknown-source' };
  const rawId = raw.providerRecordId;
  if ((typeof rawId !== 'string' && typeof rawId !== 'number') || !String(rawId).trim()) return { ok: false, reason: 'missing-id' };
  const providerRecordId = String(rawId).trim();
  if (providerRecordId.length > 200) return { ok: false, reason: 'id-too-long' };

  const startAt = Number(raw.startAt);
  if (!Number.isFinite(startAt) || startAt < TRAINING_IMPORT_MIN_START_MS || startAt > now + 24 * 3600 * 1000) {
    return { ok: false, reason: 'bad-start' };
  }
  let endAt = Number(raw.endAt);
  if (!Number.isFinite(endAt) || endAt < startAt) {
    const d = Number(raw.durationSeconds);
    if (Number.isFinite(d) && d > 0) endAt = startAt + d * 1000;
    else return { ok: false, reason: 'bad-end' };
  }
  const windowSeconds = (endAt - startAt) / 1000;
  if (windowSeconds < TRAINING_IMPORT_MIN_SECONDS) return { ok: false, reason: 'too-short' };
  if (windowSeconds > TRAINING_IMPORT_MAX_SECONDS) return { ok: false, reason: 'too-long' };

  let durationSeconds = Number(raw.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds < TRAINING_IMPORT_MIN_SECONDS || durationSeconds > windowSeconds + 1) {
    durationSeconds = windowSeconds;
  }
  let distanceMeters = Number(raw.distanceMeters);
  if (!(Number.isFinite(distanceMeters) && distanceMeters > 0 && distanceMeters <= TRAINING_IMPORT_MAX_DISTANCE_M)) distanceMeters = undefined;

  let type = typeof raw.type === 'string' && raw.type ? raw.type : 'Other';
  if (typeof ACTIVITY_TYPES !== 'undefined' && !ACTIVITY_TYPES.includes(type)) type = 'Other';

  const local = trainingLocalParts(startAt);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw.date || '') ? raw.date : local.date;
  const time = /^\d{2}:\d{2}$/.test(raw.time || '') ? raw.time : local.time;
  const lastUpdatedAt = Number.isFinite(Number(raw.lastUpdatedAt)) && Number(raw.lastUpdatedAt) > 0 ? Number(raw.lastUpdatedAt) : null;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : null;

  return {
    ok: true,
    session: {
      source: raw.source, sourceLabel: src.label, providerRecordId, type, name,
      startAt, endAt, durationSeconds, distanceMeters, date, time,
      sourceApp: typeof raw.sourceApp === 'string' && raw.sourceApp ? raw.sourceApp : null,
      lastUpdatedAt, importedAt: Number(raw.importedAt) || now
    }
  };
}

/* ---------- matching ---------- */
function trainingActivityStartMs(a) {
  if (Number.isFinite(Number(a.startAt)) && Number(a.startAt) > 0) return Number(a.startAt);
  if (a.date && /^\d{2}:\d{2}$/.test(a.time || '')) {
    const [y, m, d] = String(a.date).split('-').map(Number);
    const [hh, mm] = a.time.split(':').map(Number);
    if ([y, m, d, hh, mm].every(Number.isFinite)) return new Date(y, m - 1, d, hh, mm).getTime();
  }
  return null;
}

function trainingImportIdentityMatch(s) {
  return state.activities.find(a =>
    (a.source === s.sourceLabel && a.sourceActivityId != null && String(a.sourceActivityId) === s.providerRecordId) ||
    (Array.isArray(a.sourceRefs) && a.sourceRefs.some(r => r.source === s.source && String(r.id) === s.providerRecordId))
  ) || null;
}

/* Returns null when the activity is not the same real session, otherwise
   a score (lower = closer). See the header for the exact rules. */
function trainingImportMatchScore(s, a) {
  if (!a || !a.completed) return null;
  if (trainingTypeFamily(a.type) !== trainingTypeFamily(s.type)) return null;
  const refs = Array.isArray(a.sourceRefs) ? a.sourceRefs : [];
  const sameProviderSameApp = s.sourceApp && refs.some(r => r.source === s.source && r.sourceApp && r.sourceApp === s.sourceApp) ||
    (a.source === s.sourceLabel && a.sourceApp && s.sourceApp && a.sourceApp === s.sourceApp);
  if (sameProviderSameApp) return null;

  const aStart = trainingActivityStartMs(a);
  const aPrecise = Number.isFinite(Number(a.startAt)) && Number(a.startAt) > 0;
  let aDurSec = Number(a.duration || 0) * 60;
  if (aPrecise && Number.isFinite(Number(a.endAt)) && Number(a.endAt) > Number(a.startAt)) {
    aDurSec = aDurSec || (Number(a.endAt) - Number(a.startAt)) / 1000;
  }
  const sDurSec = s.durationSeconds;
  const sKm = s.distanceMeters ? s.distanceMeters / 1000 : 0;
  const aKm = Number(a.distance || 0);

  let comparable = 0, distRatio = 0, durRatio = 0;
  if (aKm > 0 && sKm > 0) {
    comparable++;
    const diff = Math.abs(aKm - sKm), big = Math.max(aKm, sKm);
    if (diff > Math.max(0.15 * big, 0.3)) return null;
    distRatio = diff / big;
  }
  if (aDurSec > 0 && sDurSec > 0) {
    comparable++;
    const diff = Math.abs(aDurSec - sDurSec), big = Math.max(aDurSec, sDurSec);
    if (diff > Math.max(0.2 * big, 300)) return null;
    durRatio = diff / big;
  }
  if (!comparable) return null;

  let startPenalty;
  if (aPrecise && aStart !== null && aDurSec > 0) {
    const aEnd = Number(a.endAt) > aStart ? Number(a.endAt) : aStart + aDurSec * 1000;
    const overlap = Math.min(s.endAt, aEnd) - Math.max(s.startAt, aStart);
    const shorter = Math.min(s.endAt - s.startAt, aEnd - aStart);
    if (shorter <= 0 || overlap < 0.7 * shorter) return null;
    const startDiff = Math.abs(s.startAt - aStart);
    const longer = Math.max(s.endAt - s.startAt, aEnd - aStart);
    if (startDiff > Math.max(600000, 0.15 * longer)) return null;
    startPenalty = startDiff / longer;
  } else {
    if (a.date !== s.date) return null;
    if (aStart !== null) {
      const diff = Math.abs(s.startAt - aStart);
      if (diff > 90 * 60000) return null;
      startPenalty = diff / (90 * 60000);
    } else startPenalty = 0.5;
  }
  return startPenalty + distRatio + durRatio;
}

function trainingImportFindMatch(s) {
  const identity = trainingImportIdentityMatch(s);
  if (identity) return { activity: identity, how: 'identity' };
  const scored = [];
  for (const a of state.activities) {
    const score = trainingImportMatchScore(s, a);
    if (score !== null) scored.push({ a, score });
  }
  if (!scored.length) return null;
  scored.sort((x, y) => x.score - y.score);
  if (scored.length > 1 && scored[1].score - scored[0].score < 0.15) return { ambiguous: true };
  return { activity: scored[0].a, how: 'fuzzy' };
}

/* ---------- merge / create ---------- */
function trainingRef(s) {
  return { source: s.source, id: s.providerRecordId, sourceApp: s.sourceApp, importedAt: s.importedAt, lastUpdatedAt: s.lastUpdatedAt };
}
function trainingDurationMinutes(s) { return Math.max(1, Math.round(s.durationSeconds / 60)); }
function trainingDistanceKm(s) { return s.distanceMeters ? Math.round(s.distanceMeters / 10) / 100 : 0; }

/* Returns true when the activity actually changed. */
function trainingMergeSession(a, s) {
  let changed = false;
  a.sourceRefs = Array.isArray(a.sourceRefs) ? a.sourceRefs : [];
  if (a.source && a.source !== 'Manual' && a.sourceActivityId != null && !a.sourceRefs.length) {
    a.sourceRefs.push({
      source: trainingSourceIdOfLabel(a.source) || a.source, id: String(a.sourceActivityId),
      sourceApp: a.sourceApp || null, importedAt: a.importedAt || null, lastUpdatedAt: a.lastUpdatedAt || null
    });
  }
  let providerEdited = false;
  const ref = a.sourceRefs.find(r => r.source === s.source && String(r.id) === s.providerRecordId);
  if (!ref) { a.sourceRefs.push(trainingRef(s)); changed = true; }
  else if ((s.lastUpdatedAt || 0) > (ref.lastUpdatedAt || 0)) {
    ref.lastUpdatedAt = s.lastUpdatedAt; ref.sourceApp = s.sourceApp || ref.sourceApp; changed = true; providerEdited = true;
  }

  const existingPriority = trainingActivityPriority(a);
  const incomingPriority = TRAINING_IMPORT_SOURCES[s.source].priority;
  const durMin = trainingDurationMinutes(s), distKm = trainingDistanceKm(s);
  const fill = (field, value) => { if (value && !a[field]) { a[field] = value; changed = true; } };
  const set = (field, value) => { if (value !== undefined && value !== null && a[field] !== value) { a[field] = value; changed = true; } };

  const overlay = incomingPriority > existingPriority || (a.source === s.sourceLabel && providerEdited);
  if (overlay && (a.source || 'Manual') !== 'Manual') {
    set('duration', durMin);
    if (distKm) set('distance', distKm);
    set('startAt', s.startAt); set('endAt', s.endAt);
    if (incomingPriority > existingPriority) {
      set('source', s.sourceLabel); set('sourceActivityId', s.providerRecordId);
      set('importFingerprint', `${s.sourceLabel.toLowerCase()}:${s.providerRecordId}`);
      set('sourceApp', s.sourceApp);
      if (a.type === 'Other') set('type', s.type);
      if (s.name && (!a.name || Object.values(TRAINING_DEFAULT_NAMES).includes(a.name))) set('name', s.name);
    }
  } else {
    fill('duration', durMin); fill('distance', distKm); fill('time', s.time);
    fill('startAt', s.startAt); fill('endAt', s.endAt);
  }
  if (s.lastUpdatedAt && (a.lastUpdatedAt || 0) < s.lastUpdatedAt) { a.lastUpdatedAt = s.lastUpdatedAt; }
  if (changed) a.updatedAt = typeof v023Now === 'function' ? v023Now() : new Date().toISOString();
  return changed;
}

function trainingCreateFromSession(s) {
  const input = {
    name: s.name || trainingDefaultName(s.type),
    type: s.type, date: s.date, time: s.time,
    duration: trainingDurationMinutes(s), distance: trainingDistanceKm(s),
    outcome: '', gearId: null, planText: '',
    source: s.sourceLabel, sourceActivityId: s.providerRecordId, sourceApp: s.sourceApp,
    importedAt: s.importedAt, lastUpdatedAt: s.lastUpdatedAt,
    startAt: s.startAt, endAt: s.endAt,
    sourceRefs: [trainingRef(s)],
    imported: true, completed: true, xpAwarded: true, startedAt: null, sportData: {}
  };
  return v023IngestActivity(input).activity;
}

/* One session -> 'created' | 'merged' | 'updated' | 'duplicate'. */
function trainingImportOne(s) {
  const match = trainingImportFindMatch(s);
  if (match && match.activity) {
    const changed = trainingMergeSession(match.activity, s);
    if (!changed) return 'duplicate';
    return match.how === 'identity' ? 'updated' : 'merged';
  }
  trainingCreateFromSession(s);
  return match && match.ambiguous ? 'createdAmbiguous' : 'created';
}

/* Public entry: never throws, never partially applies one bad record to
   another, and reports what happened. */
function trainingImportSessions(rawSessions) {
  const result = { created: 0, merged: 0, updated: 0, duplicates: 0, ambiguous: 0, rejected: [] };
  const list = Array.isArray(rawSessions) ? rawSessions : [];
  const valid = [];
  list.forEach((raw, index) => {
    let v;
    try { v = trainingImportValidate(raw); } catch (e) { v = { ok: false, reason: 'validate-error' }; }
    if (v.ok) valid.push(v.session);
    else result.rejected.push({ index, id: raw && raw.providerRecordId, reason: v.reason });
  });
  valid.sort((x, y) => x.startAt - y.startAt);
  for (const s of valid) {
    try {
      const outcome = trainingImportOne(s);
      if (outcome === 'createdAmbiguous') { result.created++; result.ambiguous++; }
      else if (outcome === 'duplicate') result.duplicates++;
      else result[outcome]++;
    } catch (e) {
      result.rejected.push({ id: s.providerRecordId, reason: 'error: ' + (e && e.message) });
    }
  }
  if (result.created || result.merged || result.updated) {
    try { save(); } catch (e) { /* storage full: state stays in memory, next save retries */ }
  }
  return result;
}

/* ---------- removal (Connections > Remove imported data) ----------
   Deletes activities that exist ONLY because of this source; a manual
   activity that merely got linked to it keeps everything and just loses
   the link. Never touches other providers' data. */
function trainingRemoveImportedFromSource(sourceId) {
  const label = trainingSourceLabel(sourceId);
  if (!label) return { removed: 0, unlinked: 0 };
  let removed = 0, unlinked = 0;
  state.activities = state.activities.filter(a => {
    const refs = Array.isArray(a.sourceRefs) ? a.sourceRefs : [];
    const touches = refs.some(r => r.source === sourceId) || (a.source === label && a.imported);
    if (!touches) return true;
    const others = refs.filter(r => r.source !== sourceId);
    if (a.imported && a.source === label && !others.length) { removed++; return false; }
    a.sourceRefs = others;
    if (a.source === label && others.length) {
      const best = others.slice().sort((x, y) => (TRAINING_IMPORT_SOURCES[y.source]?.priority || 0) - (TRAINING_IMPORT_SOURCES[x.source]?.priority || 0))[0];
      a.source = trainingSourceLabel(best.source) || a.source;
      a.sourceActivityId = best.id; a.sourceApp = best.sourceApp || null;
      a.importFingerprint = `${a.source.toLowerCase()}:${best.id}`;
    }
    unlinked++;
    return true;
  });
  save();
  return { removed, unlinked };
}

function trainingImportedCount(sourceId) {
  const label = trainingSourceLabel(sourceId);
  return state.activities.filter(a => a.imported && a.source === label).length;
}

/* Small display helper: "Source: Strava" for imported/linked sessions,
   empty for a plain manual entry. */
function trainingSourceLine(a) {
  if (!a || !a.source || a.source === 'Manual') return '';
  return `Source: ${a.source}`;
}
