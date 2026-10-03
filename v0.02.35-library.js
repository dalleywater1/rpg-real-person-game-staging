/* Library, Phase 1A: the Hub (Astra, 2026-09-21).
   Handover: Library V1 (Jay / Lyra). Docs: docs/LIBRARY.md.
   Styles: styles/library/ (theme, components), all scoped to .lib-theme.

   THE RULE THIS FILE EXISTS UNDER
     SOURCE SYSTEM -> SHARED DATA -> LIBRARY PRESENTATION.
   The Library is a read-only view of knowledge that other systems own. It
   stores nothing: there is no state.library, no save() call, no copy of an
   exercise, a quest or a discovery. Every number and row on the Hub is
   computed from the owner's own data at render time, so a correction in a
   source flows straight through, and nothing has to be kept in sync.

   Who owns what
     Training Codex      the canonical exercise catalogue (v0.02.17-exercise-library.js)
     Discoveries         Quest state: QUEST_DEFINITIONS discoverables plus their
                         registry (app.js), and the Campaign encounter substates
     Handbook, Chronicles   no source is built yet, so they show "Coming soon" and
                         nothing else. Nothing is invented for them.

   Two layers, as in Personal Growth:
     1. Pure markup functions (lib...HTML). They take plain view models and
        depend only on esc() and asset().
     2. Adapters and behaviour. They read app state at call time, never at load
        time, so this file is safe to load anywhere.

   Phase 1A is the Hub only. The collection pages below the Hub are honest
   "Coming soon" pages: no fake controls, no silent redirect. Training Codex >
   Strength > Chest > Bench Press is the next slice; Discoveries > People > Echo
   follows it. Each plugs in through the registries in this file. */

/* ------------------------------------------------------------------ */
/* 1. Pure markup                                                      */
/* ------------------------------------------------------------------ */

/* A circle holder for a glyph, a letter (the placeholder for an entry with no
   art yet), or art that supplies its own ring. */
function libMedallionHTML({ glyph = '', src = '', size = '', art = false, letter = false } = {}) {
  const cls = `lib-medallion${size ? ` lib-medallion--${size}` : ''}${art ? ' lib-medallion--art' : ''}${letter ? ' lib-medallion--letter' : ''}`;
  if (src) return `<span class="${cls}"><img src="${esc(src)}" alt="" width="256" height="256" decoding="async"></span>`;
  return `<span class="${cls}" aria-hidden="true">${esc(glyph)}</span>`;
}

/* The h1 is focusable (tabindex -1) so a page change can move focus to it. */
function libHeroHTML({ title, sub = '', iconSrc = '', glyph = '' }) {
  const medallion = iconSrc ? libMedallionHTML({ src: iconSrc, size: 'hero', art: true }) : libMedallionHTML({ glyph, size: 'hero' });
  return `<header class="lib-hero"><div class="lib-hero__scene" aria-hidden="true"></div><div class="lib-hero__content">${medallion}<div class="lib-hero__text"><h1 class="lib-hero__title" tabindex="-1">${esc(title)}</h1>${sub ? `<p class="lib-hero__sub">${esc(sub)}</p>` : ''}</div></div></header>`;
}

function libBackHTML() {
  return '<div class="lib-backrow"><button type="button" class="lib-btn lib-btn--compact" data-lib-back><span aria-hidden="true">←</span> <span class="lib-sr">Back to </span>Library</button></div>';
}

const LIB_SEARCH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';

/* LibrarySearch: one field for the whole Library. */
function libSearchHTML(query = '') {
  return `<form class="lib-search" id="libSearchForm" role="search" novalidate><label class="lib-sr" for="libSearch">Search the Library</label><span class="lib-search__icon" aria-hidden="true">${LIB_SEARCH_SVG}</span><input class="lib-search__input" id="libSearch" type="search" name="q" placeholder="Search the Library…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(query)}"><button type="button" class="lib-search__clear" id="libSearchClear" aria-label="Clear search"${query ? '' : ' hidden'}><span aria-hidden="true">×</span></button></form>`;
}

/* LibraryCollectionCard. c: { id, title, subtitle, glyph, accent, status, detail } */
function libCardHTML(c) {
  return `<li><button type="button" class="lib-card lib-accent-${esc(c.accent)}" data-lib-go="${esc(c.id)}"><span class="lib-card__top">${libMedallionHTML({ glyph: c.glyph })}</span><span class="lib-card__title">${esc(c.title)}</span><span class="lib-card__sub">${esc(c.subtitle)}</span><span class="lib-card__foot"><span class="lib-card__status">${esc(c.status)}</span>${c.detail ? `<span class="lib-card__detail">${esc(c.detail)}</span>` : ''}</span></button></li>`;
}

/* LibraryEntryRow: one thing in a list (a result, a discovery, later an
   exercise or a chronicle). e: { title, subtitle, glyph, letter, accent, when, go }
   With `go` it is a button that opens that view. Without it the row is plain
   text: no button, no hover, nothing that looks tappable and does nothing. */
function libEntryRowHTML(e) {
  const cls = `lib-entry lib-accent-${esc(e.accent || 'gold')}${e.when ? '' : ' lib-entry--nowhen'}`;
  const inner = `${libMedallionHTML({ glyph: e.glyph, size: 'sm', letter: Boolean(e.letter) })}<span class="lib-entry__text"><span class="lib-entry__title">${esc(e.title)}</span>${e.subtitle ? `<span class="lib-entry__sub">${esc(e.subtitle)}</span>` : ''}</span>${e.when ? `<span class="lib-entry__when">${esc(e.when)}</span>` : ''}`;
  return e.go
    ? `<li><button type="button" class="${cls} lib-entry--link" data-lib-go="${esc(e.go)}">${inner}</button></li>`
    : `<li><div class="${cls}">${inner}</div></li>`;
}

/* Search results, grouped by source. A group heading only appears when more
   than one source has something to show. */
function libResultsHTML(groups) {
  const multi = groups.length > 1;
  return groups.map(g => `<section class="lib-results__group"${multi ? '' : ' aria-label="Search results"'}>${multi ? `<h3 class="lib-results__label">${esc(g.label)}</h3>` : ''}<ul class="lib-entries">${g.items.map(libEntryRowHTML).join('')}</ul></section>`).join('');
}

function libEmptyHTML({ title, text, inline = false }) {
  return `<div class="lib-empty${inline ? ' lib-empty--inline' : ''}"><p class="lib-empty__title">${esc(title)}</p><p class="lib-empty__text">${esc(text)}</p></div>`;
}

/* ------------------------------------------------------------------ */
/* 2. Time                                                             */
/* ------------------------------------------------------------------ */

/* "Just now", "12 min ago", "3 h ago", "Yesterday", "4 days ago", then a date.
   Returns '' for a missing time, so a row never shows "Invalid Date". */
function libWhen(at, now = Date.now()) {
  if (typeof at !== 'number' || !Number.isFinite(at)) return '';
  const diff = now - at;
  if (diff < 60000) return 'Just now';
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} min ago`;   // minutes are relative even across midnight
  const d = new Date(at), n = new Date(now);
  const day = t => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const dayDiff = Math.round((day(n) - day(d)) / 86400000);
  if (dayDiff <= 0) return `${Math.floor(min / 60)} h ago`;
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return `${dayDiff} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric' });
}

/* ------------------------------------------------------------------ */
/* 3. Collections                                                      */
/* ------------------------------------------------------------------ */

/* The four collections, in the agreed order. Titles and subtitles are the
   handover's. The glyphs are placeholders until Aurelia's art arrives (artwork
   tier 3: a missing emblem never blocks the page). `tags` feed search only. */
const LIB_COLLECTIONS = [
  {
    id: 'codex', title: 'Training Codex', subtitle: 'Exercises, techniques and training knowledge', glyph: '▣', accent: 'orange',
    tags: ['exercise', 'exercises', 'technique', 'techniques', 'training', 'strength', 'workout', 'muscle', 'muscles', 'equipment', 'movement'],
    soon: { headline: 'The Training Codex is being prepared', text: 'Exercises, techniques and training knowledge, organised by discipline and muscle group. It reads from the Exercise Library you already use, so nothing is entered twice.' }
  },
  {
    id: 'handbook', title: 'Adventurer’s Handbook', subtitle: 'Understand how RPG systems work', glyph: '▤', accent: 'blue',
    tags: ['guide', 'guides', 'how', 'help', 'rules', 'system', 'systems', 'stats', 'levels', 'skills', 'classes', 'handbook'],
    soon: { headline: 'The Adventurer’s Handbook is being prepared', text: 'Plain guides to how the game works, written from what the app really does today.' }
  },
  {
    id: 'chronicles', title: 'Quest Chronicles', subtitle: 'Completed stories and journey records', glyph: '❖', accent: 'gold',
    tags: ['story', 'stories', 'quest', 'quests', 'campaign', 'campaigns', 'journey', 'journeys', 'history', 'record', 'records', 'lore'],
    soon: { headline: 'Quest Chronicles are being prepared', text: 'A read-only record of the stories and journeys you have completed, taken from your real Quest history.' }
  },
  {
    id: 'discoveries', title: 'Discoveries', subtitle: 'People, creatures, places and artifacts', glyph: '✧', accent: 'purple',
    tags: ['discovery', 'discoveries', 'people', 'person', 'creature', 'creatures', 'place', 'places', 'artifact', 'artifacts', 'secret', 'secrets', 'found'],
    soon: { headline: 'Discovery pages are being prepared', text: 'Each discovery will open into its own page. An entry appears only once you have found it.' }
  }
];
const LIB_VIEWS = ['hub'].concat(LIB_COLLECTIONS.map(c => c.id));

/* ------------------------------------------------------------------ */
/* 4. Source adapters                                                  */
/* ------------------------------------------------------------------ */

/* Each collection reads its own source through an adapter. An adapter has one
   optional method today: card(), the fact shown on the Hub card. Nothing is
   copied; card() runs on every render. When a collection is built (Codex in
   1B, Discoveries in 1C) it adds its own methods here and nothing else in the
   Hub changes. A collection with no adapter shows "Coming soon" and nothing
   else. */
const LIB_SOURCES = {
  /* The canonical exercise catalogue owns the exercises. Custom exercises the
     user made belong to their workout data, so only built-in ones are counted. */
  codex: {
    count() {
      if (typeof allExercises !== 'function') return null;
      try { return allExercises().filter(e => !e.custom).length; } catch (err) { return null; }
    },
    card() {
      const n = this.count();
      return n ? { status: `${n} exercise${n === 1 ? '' : 's'}`, detail: 'Browse and search' } : null;
    }
  },
  /* Quest state owns discoveries (see libDiscoveryEntries). The count is only
     what has been found. It never says how many are left, because the total is
     itself a spoiler. */
  discoveries: {
    card() {
      const n = libDiscoveryEntries().length;
      return { status: n ? `${n} found` : 'Nothing found yet', detail: n ? 'Open any entry' : '' };
    }
  }
};

function libCards() {
  return LIB_COLLECTIONS.map(c => {
    const src = LIB_SOURCES[c.id], card = src && src.card ? src.card() : null;
    return { ...c, status: card ? card.status : 'Coming soon', detail: card ? card.detail : '' };
  });
}

/* ------------------------------------------------------------------ */
/* 4a. Codex item: Bench Press (Phase 1B)                              */
/* ------------------------------------------------------------------ */

/* The one real exercise detail page so far, out of 264 in the catalogue.
   Reads the canonical Exercise Library entry directly through the same
   exerciseById() every other Training screen uses -- every field shown is
   real. Nothing is invented for fields the catalogue doesn't carry yet
   (no instructions/cues, no difficulty rating, no image for this exercise
   specifically -- only 4 of 264 have a thumbnail today and this isn't one
   of them; see docs/LIBRARY.md's "no description, technique, difficulty
   or art fields" note). */
const LIB_BENCH_PRESS_ID = 'barbell_bench_press';

/* One row of muscle tags with a label, or '' if that involvement level is
   empty (e.g. Bench Press has no stabilizer tags) -- an empty row would
   otherwise read as "we checked and there's nothing," which isn't honest
   when the truth is closer to "not classified at that level." */
function libMuscleTagsHTML(label, tags) {
  if (!tags || !tags.length) return '';
  return `<div class="lib-detail__row"><span class="lib-detail__row-label">${esc(label)}</span><span class="lib-detail__tags">${tags.map(t => `<span class="lib-tag">${esc(t)}</span>`).join('')}</span></div>`;
}

/* Every built-in exercise now has a page (RPG-0044: search needs a target for each). Same facts as the Bench Press page ever
   showed -- only what the catalogue really carries; nothing is invented for fields it does not have. */
function libRenderCodexExercise(id) {
  const ex = typeof exerciseById === 'function' ? exerciseById(id) : null;
  if (!ex || ex.custom) { libGo('codex'); return; }   // catalogue entry missing/renamed -- fail back to the collection, never a blank page
  const pbKey = typeof strengthPbKeyForExercise === 'function' ? strengthPbKeyForExercise(ex.name) : null;
  const pb = pbKey && typeof currentTrainingRecordValue === 'function' ? currentTrainingRecordValue(pbKey) : null;
  const stabilizerLabels = ((ex.muscles && ex.muscles.stabilizer) || []).map(muscleTagLabel);
  view.innerHTML = `<div class="lib-theme lib-page lib-accent-orange"><div class="lib-page__inner">
    ${libBackHTML()}
    ${libHeroHTML({ title: ex.name, sub: (ex.aliases || []).length ? `Also known as ${ex.aliases.join(', ')}` : '', glyph: '▣' })}
    <section class="lib-shell lib-detail" aria-labelledby="libBenchFactsTitle">
      <h2 class="lib-section__title" id="libBenchFactsTitle">The facts</h2>
      <div class="lib-detail__facts">
        <div class="lib-detail__fact"><span class="lib-detail__fact-label">Equipment</span><span class="lib-detail__fact-value">${esc(ex.equipment || '—')}</span></div>
        <div class="lib-detail__fact"><span class="lib-detail__fact-label">Movement</span><span class="lib-detail__fact-value">${esc(ex.movement || '—')}</span></div>
        <div class="lib-detail__fact"><span class="lib-detail__fact-label">Type</span><span class="lib-detail__fact-value">${ex.compound ? 'Compound' : 'Isolation'}${ex.unilateral ? ' · Unilateral' : ''}</span></div>
      </div>
      ${libMuscleTagsHTML('Primary', [ex.primaryMuscle].filter(Boolean))}
      ${libMuscleTagsHTML('Also trains', ex.secondaryMuscles)}
      ${libMuscleTagsHTML('Stabilizes', stabilizerLabels)}
    </section>
    ${pbKey ? `<section class="lib-shell" aria-labelledby="libBenchPbTitle">
      <h2 class="lib-section__title" id="libBenchPbTitle">Personal Best</h2>
      ${pb != null
        ? `<p class="lib-fact lib-num">${esc(String(pb))} kg is your recorded ${esc(ex.name)} PB.</p>`
        : libEmptyHTML({ title: 'No PB recorded yet', text: `Log a ${ex.name} set as a Personal Best in Training > Strength to see it here.`, inline: true })}
    </section>` : ''}
  </div></div>`;
  libBindNav();
}

/* ------------------------------------------------------------------ */
/* 4b. Discoveries item: Echo (Phase 1C)                                */
/* ------------------------------------------------------------------ */

/* Same compound id libDiscoveryEntries() already mints for her (see
   LIB_CAMPAIGN_ENCOUNTERS above) -- never a second, Library-invented id. */
const LIB_ECHO_ID = 'campaign:lost-fortress:echo';
const LIB_ECHO_STATE_LABEL = { discovered: 'Discovered', enchantment: 'Under an enchantment', companion: 'Companion' };

function libRenderDiscoveryEcho() {
  const camps = typeof ensureAdventureState === 'function' ? ensureAdventureState() : {};
  const c = camps['lost-fortress'];
  const echoState = c && c.echo;
  /* Not found yet -- this page never renders, not even a "???" teaser.
     Reachable only defensively (libView could in principle be set without
     going through a real discovered row); libDiscoveryEntries() itself
     already keeps an unfound Echo out of every list that links here. */
  if (!echoState || (echoState.state === 'not_found' && !(c.everDiscovered && c.everDiscovered.echo))) { libGo('discoveries'); return; }
  const def = typeof QUEST_DEFINITIONS !== 'undefined' ? QUEST_DEFINITIONS['lost-fortress'] : null;
  const foundAt = libFoundAt('lost-fortress', 'echo_discovered');
  const isCompanion = Boolean(echoState.unlockedAsCompanion) || (c && Array.isArray(c.companions) && c.companions.includes('echo'));
  const relIndex = typeof ECHO_RELATIONSHIP_LADDER !== 'undefined' ? ECHO_RELATIONSHIP_LADDER.indexOf(echoState.relationship) : -1;
  const relLabel = relIndex >= 0 ? echoState.relationship.charAt(0).toUpperCase() + echoState.relationship.slice(1) : null;
  view.innerHTML = `<div class="lib-theme lib-page lib-accent-purple"><div class="lib-page__inner">
    ${libBackHTML()}
    ${libHeroHTML({ title: 'Echo', sub: def ? def.title : 'Lost Fortress', glyph: libMonogram('Echo') })}
    <section class="lib-shell lib-detail" aria-labelledby="libEchoFactsTitle">
      <h2 class="lib-section__title" id="libEchoFactsTitle">What you know</h2>
      <div class="lib-detail__facts">
        <div class="lib-detail__fact"><span class="lib-detail__fact-label">Status</span><span class="lib-detail__fact-value">${esc(LIB_ECHO_STATE_LABEL[echoState.state] || 'Discovered')}</span></div>
        ${relLabel ? `<div class="lib-detail__fact"><span class="lib-detail__fact-label">Relationship</span><span class="lib-detail__fact-value">${esc(relLabel)}</span></div>` : ''}
        ${isCompanion ? `<div class="lib-detail__fact"><span class="lib-detail__fact-label">Companion</span><span class="lib-detail__fact-value">Travels with you</span></div>` : ''}
      </div>
      ${foundAt !== null ? `<p class="lib-meta">First encountered ${esc(libWhen(foundAt))}.</p>` : ''}
    </section>
  </div></div>`;
  libBindNav();
}

/* --- Discoveries: read from Quest and Campaign state, owned elsewhere --- */

/* How a discovery is described. These are presentation labels only. The
   entries themselves (names, what was found) come from the Quest data. */
const LIB_KIND_LABEL = {
  hiddenEvent: 'Hidden Event', rareLoot: 'Rare Loot', secret: 'Secret', route: 'Landmark',
  npc: 'Person', people: 'Person', creatures: 'Creature'
};

/* Encounters the Campaign system tracks as substates rather than as quest
   discoverables. Whether one is found is decided by the campaign's own state
   (`test`). The entry's name is a presentation label held here until the
   Discoveries catalogue exists (Phase 1C), when it takes over. */
const LIB_CAMPAIGN_ENCOUNTERS = [
  { campaign: 'lost-fortress', id: 'quentin', title: 'Lord Quentin', kind: 'people', event: 'quentin_discovered', test: c => Boolean((c.everDiscovered && c.everDiscovered.quentin) || (c.quentin && c.quentin.discovered)) },
  { campaign: 'lost-fortress', id: 'echo', title: 'Echo', kind: 'people', event: 'echo_discovered', test: c => Boolean((c.everDiscovered && c.everDiscovered.echo) || (c.echo && c.echo.state && c.echo.state !== 'not_found')) },
  { campaign: 'lost-fortress', id: 'yeti', title: 'Wounded Snow Yeti', kind: 'creatures', event: 'yeti_encountered', test: c => Boolean((c.everDiscovered && c.everDiscovered.yeti) || (c.yeti && c.yeti.state && c.yeti.state !== 'undiscovered')) }
];

/* When something was found, if the Campaign event log knows. The log is the
   only place a time is recorded, and it keeps only the last 200 events, so
   this can be null; a null time is shown honestly (no "when"), never guessed.
   Whether the thing was found is always decided by its owner's own state. */
function libFoundAt(campaignId, type, pick) {
  const camps = typeof ensureAdventureState === 'function' ? ensureAdventureState() : {};
  const c = camps[campaignId], events = c && Array.isArray(c.events) ? c.events : [];
  const times = events.filter(e => e && e.type === type && (!pick || pick(e)) && typeof e.at === 'number' && Number.isFinite(e.at)).map(e => e.at);
  return times.length ? Math.min(...times) : null;
}

/* Everything the player has found, newest first. Only found things are listed:
   an item revealed by a hint but not yet found is not included, so nothing
   leaks ahead of the story. Entries with a known time come first; the rest
   follow in the order the source defines them. */
function libDiscoveryEntries() {
  const out = [];
  if (typeof QUEST_DEFINITIONS === 'undefined' || typeof ensureQuestsState !== 'function') return out;
  const quests = ensureQuestsState();
  Object.keys(QUEST_DEFINITIONS).forEach(qid => {
    const def = QUEST_DEFINITIONS[qid], reg = quests.registry[qid];
    const items = (reg && reg.discovery && reg.discovery.items) || {};
    (def.discoverables || []).forEach(d => {
      if (!(items[d.id] && items[d.id].discovered)) return;
      const stored = Number(items[d.id].discoveredAt);   /* RPG-0041: the item's own timestamp first, the capped event log only as a fallback */
      out.push({ id: `quest:${qid}:${d.id}`, title: d.name, kind: d.category, origin: def.title, description: d.description || '', at: Number.isFinite(stored) && stored > 0 ? stored : libFoundAt(qid, 'hidden_content_discovered', e => e.itemId === d.id) });
    });
  });
  const camps = typeof ensureAdventureState === 'function' ? ensureAdventureState() : {};
  LIB_CAMPAIGN_ENCOUNTERS.forEach(enc => {
    const c = camps[enc.campaign];
    if (!c || !enc.test(c)) return;
    const def = QUEST_DEFINITIONS[enc.campaign];
    const storedAt = c.everDiscoveredAt && Number(c.everDiscoveredAt[enc.id]);
    out.push({ id: `campaign:${enc.campaign}:${enc.id}`, title: enc.title, kind: enc.kind, origin: def ? def.title : enc.campaign, facts: libEncounterFacts(enc.id, c), at: Number.isFinite(storedAt) && storedAt > 0 ? storedAt : libFoundAt(enc.campaign, enc.event) });
  });
  out.forEach((e, i) => { e.order = i; });
  out.sort((a, b) => ((b.at || 0) - (a.at || 0)) || (a.order - b.order));
  return out;
}

/* The first letter, skipping a leading article, is the placeholder emblem. */
function libMonogram(title) {
  const m = String(title || '').replace(/^(the|a|an)\s+/i, '').match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : '?';
}

/* A discovery as an entry row. Tappable only when a real detail page exists
   for it (LIB_ITEMS, defined below Navigation) -- Echo today, everyone else
   stays a plain row until their own page is built, same as before. */
function libDiscoveryRow(e) {
  const go = e.id;   /* every found discovery has a page (RPG-0040) */
  return { title: e.title, subtitle: `${LIB_KIND_LABEL[e.kind] || 'Discovery'} · ${e.origin}`, glyph: libMonogram(e.title), letter: true, accent: 'purple', when: libWhen(e.at), go };
}

/* Recently Discovered: at most five, and only ones with a known time (a thing
   with no recorded time cannot honestly be called recent; it is still listed
   under View All). */
const LIB_RECENT_MAX = 5;
function libRecentlyDiscovered() {
  return libDiscoveryEntries().filter(e => e.at !== null).slice(0, LIB_RECENT_MAX);
}

/* ------------------------------------------------------------------ */
/* 5. Search                                                           */
/* ------------------------------------------------------------------ */

/* One normaliser for the whole Library: lower case, no accents, no
   apostrophes, punctuation as spaces. "Adventurer's" and "adventurers" match. */
function libNormalize(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Simple match on name, tags, category and text, as the handover asks (no
   semantic search). Every word typed must start a word somewhere in the entry;
   the score prefers the name, then tags, then the category, then the rest.
   Returns 0 for no match. Every source scores with this, so ranking is the same
   everywhere. fields: { name, tags: [], category, text } */
function libMatchScore(query, fields) {
  const q = libNormalize(query);
  if (!q) return 0;
  const name = libNormalize(fields.name), words = f => libNormalize(f).split(' ').filter(Boolean);
  const nameWords = words(fields.name), tagWords = (fields.tags || []).flatMap(words), catWords = words(fields.category), textWords = words(fields.text);
  const starts = (list, t) => list.some(w => w.startsWith(t));
  let total = 0;
  for (const t of q.split(' ')) {
    let best = 0;
    if (starts(nameWords, t)) best = Math.max(best, name.startsWith(t) ? 90 : 60);
    if (starts(tagWords, t)) best = Math.max(best, 40);
    if (starts(catWords, t)) best = Math.max(best, 30);
    if (starts(textWords, t)) best = Math.max(best, 15);
    if (!best) return 0;
    total += best;
  }
  return total + (name === q ? 100 : 0);
}

/* A search source: { id, label, search(query) -> rows }. A row is what
   libEntryRowHTML takes plus { score }. Only implemented content is
   searchable, so Phase 1A registers only the four collections. The Training
   Codex registers its exercises in Phase 1B and Discoveries its entries in
   Phase 1C: push one source here and nothing else changes. */
const LIB_SEARCH_SOURCES = [{
  id: 'collections', label: 'Collections',
  search(query) {
    return LIB_COLLECTIONS.map(c => {
      const score = libMatchScore(query, { name: c.title, tags: c.tags, text: c.subtitle });
      return score ? { score, title: c.title, subtitle: c.subtitle, glyph: c.glyph, accent: c.accent, go: c.id } : null;
    }).filter(Boolean);
  }
}, {
  /* Every built-in exercise has a page now (RPG-0044), so every one is searchable: name, aliases, muscle, equipment and
     movement. A custom exercise belongs to the player's workout data and is never Library knowledge. */
  id: 'codexItems', label: 'Training Codex',
  search(query) {
    if (typeof allExercises !== 'function') return [];
    const out = [];
    allExercises().forEach(ex => {
      if (ex.custom) return;
      const score = libMatchScore(query, { name: ex.name, tags: ex.aliases, category: ex.primaryMuscle, text: [ex.equipment, ex.movement].filter(Boolean).join(' ') });
      if (score) out.push({ score, title: ex.name, subtitle: [ex.primaryMuscle, ex.equipment].filter(Boolean).join(' · '), glyph: '▣', accent: 'orange', go: ex.id });
    });
    return out;
  }
}, {
  /* Phase 1C: searches the SAME libDiscoveryEntries() list every other
     discovery surface reads — nothing undiscovered can ever appear here,
     the gating is the source's, not a separate check of our own. Only
     entries with a real detail page (LIB_ITEMS) become a link; the rest
     are still findable, just not tappable, same as libDiscoveryRow(). */
  id: 'discoveries', label: 'Discoveries',
  search(query) {
    return libDiscoveryEntries().map(e => {
      const score = libMatchScore(query, { name: e.title, category: LIB_KIND_LABEL[e.kind] || '', text: e.origin });
      if (!score) return null;
      const go = e.id;
      return { score, title: e.title, subtitle: `${LIB_KIND_LABEL[e.kind] || 'Discovery'} · ${e.origin}`, glyph: libMonogram(e.title), letter: true, accent: 'purple', go };
    }).filter(Boolean);
  }
}];

const LIB_RESULT_CAP = 30;
function libSearch(query) {
  const groups = [];
  let total = 0;
  LIB_SEARCH_SOURCES.forEach(src => {
    let items = [];
    try { items = src.search(query) || []; } catch (err) { items = []; }   // one broken source never blanks the rest
    items.sort((a, b) => (b.score - a.score) || a.title.localeCompare(b.title));
    if (items.length) groups.push({ label: src.label, items, best: items[0].score });
    total += items.length;
  });
  groups.sort((a, b) => b.best - a.best);
  let room = LIB_RESULT_CAP;
  groups.forEach(g => { g.items = g.items.slice(0, room); room -= g.items.length; });
  return { groups: groups.filter(g => g.items.length), total };
}

/* ------------------------------------------------------------------ */
/* 6. Navigation and pages                                             */
/* ------------------------------------------------------------------ */

/* Which page of the Library is showing, and what is typed in the search box.
   Neither is persisted: the app always starts on Home, and every entry from
   global navigation lands on the Hub with an empty search. */
let libView = 'hub';
let libQuery = '';
function libOpenHub() { libView = 'hub'; libQuery = ''; }   // setPage() calls this for every entry from global navigation

/* Item-level detail views (Phase 1B/1C). Each entry's KEY is the real id its
   owning source already uses -- an Exercise Library id, or a discovery's own
   compound id from libDiscoveryEntries() -- never a second, Library-invented
   id to keep in sync with the source. `parent` is the collection view Back
   returns to. Adding the next real item page is one entry here; nothing else
   in the navigation/search plumbing below needs to change. */
const LIB_ITEMS = {
  [LIB_BENCH_PRESS_ID]: { parent: 'codex', render: () => libRenderCodexExercise(LIB_BENCH_PRESS_ID) },
  [LIB_ECHO_ID]: { parent: 'discoveries', render: libRenderDiscoveryEcho }
};
/* The page for an id: a hand-built entry above, any built-in exercise (Codex), or any discovery the player has FOUND. An id that
   is none of these (an undiscovered thing, a custom exercise) has no page, so nothing can leak by typing an id. */
function libItem(v) {
  if (Object.prototype.hasOwnProperty.call(LIB_ITEMS, v)) return LIB_ITEMS[v];   /* own keys only: 'constructor' etc. are not pages */
  if (typeof exerciseById === 'function') {
    try { const ex = exerciseById(v); if (ex && !ex.custom && ex.id === v) return { parent: 'codex', render: () => libRenderCodexExercise(v) }; } catch (err) { /* fall through */ }
  }
  if (String(v).indexOf(':') > 0 && libDiscoveryEntries().some(e => e.id === v)) return { parent: 'discoveries', render: () => libRenderDiscoveryDetail(v) };
  return null;
}
function libParentView(v) { const it = libItem(v); return (it && it.parent) || 'hub'; }

function libAnnounce(msg) {
  let r = document.querySelector('#libLiveRegion');
  if (!r) {
    r = document.createElement('div');
    r.id = 'libLiveRegion';
    r.className = 'lib-sr';
    r.setAttribute('role', 'status');
    r.setAttribute('aria-live', 'polite');
    document.body.appendChild(r);
  }
  r.textContent = '';
  setTimeout(() => { r.textContent = msg; }, 60);
}

/* Standard in-page navigation (the app's own pattern: a Back control, no
   history entries). Focus moves to the new page's heading, or back to the card
   that opened the page you just left. */
function libGo(next) {
  if (!LIB_VIEWS.includes(next) && !libItem(next)) return;
  const from = libView;
  libView = next;
  if (next !== 'hub') libQuery = '';
  renderLibrary();
  window.scrollTo(0, 0);
  const target = next === 'hub'
    ? (from !== 'hub' ? document.querySelector(`.lib-card[data-lib-go="${CSS.escape(from)}"]`) : null)
    : document.querySelector('.lib-hero__title');
  if (target) target.focus({ preventScroll: true });
}

function libBindNav() {
  const root = document.querySelector('.lib-page');
  if (!root) return;
  root.onclick = e => {
    const go = e.target.closest('[data-lib-go]');
    if (go) { libGo(go.dataset.libGo); return; }
    /* An item page's Back returns to its own collection, not straight to
       the Hub (a collection page's Back still goes to the Hub, since
       libParentView falls back to 'hub' for anything not in LIB_ITEMS). */
    if (e.target.closest('[data-lib-back]')) libGo(libParentView(libView));
  };
}

/* Search updates the results in place. The page is not re-rendered, so the
   field keeps focus and the caret while typing. While there is a query, the
   browse sections are hidden and the results take their place. */
function libApplySearch({ announce = true } = {}) {
  const browse = document.querySelector('#libBrowse'), wrap = document.querySelector('#libResultsWrap');
  const clear = document.querySelector('#libSearchClear');
  if (!browse || !wrap) return;
  const q = libQuery.trim();
  if (clear) clear.hidden = !libQuery;
  if (!q) { browse.hidden = false; wrap.hidden = true; wrap.innerHTML = ''; return; }
  const { groups, total } = libSearch(q);
  browse.hidden = true;
  wrap.hidden = false;
  wrap.innerHTML = total
    ? `<section class="lib-shell" aria-labelledby="libResultsTitle"><h2 class="lib-section__title" id="libResultsTitle">${total} result${total === 1 ? '' : 's'}</h2><div class="lib-results">${libResultsHTML(groups)}</div>${total > LIB_RESULT_CAP ? `<p class="lib-meta">Showing the first ${LIB_RESULT_CAP}. Type more to narrow it down.</p>` : ''}</section>`
    : `<section class="lib-shell" aria-labelledby="libResultsTitle"><h2 class="lib-section__title" id="libResultsTitle">No results</h2>${libEmptyHTML({ title: `Nothing matches “${q}”`, text: 'Search finds collections, every exercise in the Training Codex and everything you have discovered. Individual entries become searchable as each collection opens.', inline: true })}</section>`;
  if (announce) libAnnounce(total ? `${total} result${total === 1 ? '' : 's'}` : 'No results');
}

/* Enter opens the top result. It is handled on the key itself, not left to the
   browser's implicit form submission, which not every keyboard or input method
   triggers. A key pressed while an input method is composing text is ignored. */
function libOpenFirstResult() {
  const first = document.querySelector('#libResultsWrap [data-lib-go]');
  if (first) libGo(first.dataset.libGo);
}

function libBindSearch() {
  const form = document.querySelector('#libSearchForm'), input = document.querySelector('#libSearch');
  if (!form || !input) return;
  input.oninput = () => { libQuery = input.value; libApplySearch(); };
  input.onkeydown = e => {
    if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; libQuery = ''; libApplySearch(); }
    else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); libOpenFirstResult(); }
  };
  form.onsubmit = e => { e.preventDefault(); libOpenFirstResult(); };
  const clear = document.querySelector('#libSearchClear');
  if (clear) clear.onclick = () => { input.value = ''; libQuery = ''; libApplySearch(); input.focus(); };
}

function libRenderHub() {
  const keepFocus = document.activeElement && document.activeElement.id === 'libSearch';
  const caret = keepFocus ? document.activeElement.selectionStart : null;
  const recent = libRecentlyDiscovered();
  const recentBody = recent.length
    ? `<ul class="lib-entries">${recent.map(e => libEntryRowHTML(libDiscoveryRow(e))).join('')}</ul>`
    : libEmptyHTML({ title: 'Nothing discovered yet', text: 'People, creatures and secrets you find on your adventures will appear here.', inline: true });
  view.innerHTML = `<div class="lib-theme lib-page lib-accent-gold"><div class="lib-page__inner lib-hub">
    ${libHeroHTML({ title: 'Library', sub: 'Knowledge builds stronger adventurers.', iconSrc: asset('icons/navigation/NAV_LIBRARY.png') })}
    ${libSearchHTML(libQuery)}
    <div class="lib-browse" id="libBrowse">
      <section class="lib-shell" aria-labelledby="libCollectionsTitle"><h2 class="lib-section__title" id="libCollectionsTitle">Collections</h2><ul class="lib-grid">${libCards().map(libCardHTML).join('')}</ul></section>
      <section class="lib-shell lib-recent" aria-labelledby="libRecentTitle"><div class="lib-recent__head"><h2 class="lib-section__title" id="libRecentTitle">Recently Discovered</h2>${recent.length ? '<button type="button" class="lib-link" data-lib-go="discoveries" aria-label="View all discoveries">View All <span aria-hidden="true">→</span></button>' : ''}</div>${recentBody}</section>
    </div>
    <div class="lib-results-wrap" id="libResultsWrap" hidden></div>
  </div></div>`;
  libBindNav();
  libBindSearch();
  if (libQuery) libApplySearch({ announce: false });
  if (keepFocus) { const el = document.querySelector('#libSearch'); if (el) { el.focus({ preventScroll: true }); if (caret !== null) el.setSelectionRange(caret, caret); } }
}

/* A collection that is not built yet: an honest page, no fake controls. It
   states the source's real facts where the source exists. Discoveries also
   lists what has been found so far, which is the same derived list the Hub
   shows, unlimited (this is what "View All" opens). */
/* ---- Codex browsing and Discoveries filtering (RPG-0040 / RPG-0044). View state only: never persisted. ---- */
let libCodexMuscle = 'all', libCodexShown = 40, libDiscFilter = 'all';
const LIB_CODEX_STEP = 40;
const LIB_DISC_GROUPS = [['all', 'All'], ['people', 'People'], ['creatures', 'Creatures'], ['places', 'Places'], ['artifacts', 'Artifacts'], ['secrets', 'Secrets']];
function libDiscGroup(kind) {
  if (kind === 'people' || kind === 'npc') return 'people';
  if (kind === 'creatures') return 'creatures';
  if (kind === 'route') return 'places';
  if (kind === 'rareLoot') return 'artifacts';
  return 'secrets';   /* hiddenEvent, secret and anything unknown */
}
function libChipHTML(label, attr, value, pressed) {
  return `<button type="button" class="lib-chip" ${attr}="${esc(value)}" aria-pressed="${Boolean(pressed)}">${esc(label)}</button>`;
}
/* What the player's own current run shows about an encounter: only fields that are already theirs, nothing forward-looking. */
function libEncounterFacts(id, c) {
  const facts = [];
  if (id === 'quentin' && c.quentin && c.quentin.discovered) {
    facts.push(['Relationship', String(c.quentin.relationship || '').toLowerCase().replace(/^./, m => m.toUpperCase())]);
    if (c.quentin.wager && c.quentin.wager.result) facts.push(['Your wager', c.quentin.wager.result === 'won' ? 'Won' : c.quentin.wager.result === 'lost' ? 'Lost' : 'Even']);
  }
  if (id === 'yeti' && c.yeti && c.yeti.state && c.yeti.state !== 'undiscovered') facts.push(['State', String(c.yeti.state).replace(/_/g, ' ').replace(/^./, m => m.toUpperCase())]);
  return facts;
}
const LIB_DISC_TYPE_WORD = { people: 'Person', creatures: 'Creature', places: 'Place', artifacts: 'Artifact', secrets: 'Secret' };
function libRenderDiscoveryDetail(id) {
  const e = libDiscoveryEntries().find(x => x.id === id);
  if (!e) { libGo('discoveries'); return; }   /* not found (or no longer listed): never a page for something undiscovered */
  const when = e.at ? `${new Date(e.at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })} (${libWhen(e.at)})` : 'Time not recorded';
  const facts = (e.facts || []).map(([l, v]) => `<div class="lib-detail__fact"><span class="lib-detail__fact-label">${esc(l)}</span><span class="lib-detail__fact-value">${esc(v)}</span></div>`).join('');
  view.innerHTML = `<div class="lib-theme lib-page lib-accent-purple"><div class="lib-page__inner">
    ${libBackHTML()}
    ${libHeroHTML({ title: e.title, sub: `${LIB_KIND_LABEL[e.kind] || 'Discovery'} · ${e.origin}`, glyph: libMonogram(e.title) })}
    <section class="lib-shell lib-detail" aria-labelledby="libDiscFactsT"><h2 class="lib-section__title" id="libDiscFactsT">The facts</h2>
      <div class="lib-detail__facts">
        <div class="lib-detail__fact"><span class="lib-detail__fact-label">Type</span><span class="lib-detail__fact-value">${esc(LIB_DISC_TYPE_WORD[libDiscGroup(e.kind)])}</span></div>
        <div class="lib-detail__fact"><span class="lib-detail__fact-label">Found in</span><span class="lib-detail__fact-value">${esc(e.origin)}</span></div>
        <div class="lib-detail__fact"><span class="lib-detail__fact-label">Found</span><span class="lib-detail__fact-value">${esc(when)}</span></div>
        ${facts}
      </div>
    </section>
    ${e.description ? `<section class="lib-shell" aria-labelledby="libDiscAboutT"><h2 class="lib-section__title" id="libDiscAboutT">About</h2><p class="lib-fact" style="font-weight:400">${esc(e.description)}</p></section>` : ''}
  </div></div>`;
  libBindNav();
}

function libCodexList() {
  if (typeof allExercises !== 'function') return [];
  try { return allExercises().filter(e => !e.custom).sort((a, b) => String(a.name).localeCompare(String(b.name))); } catch (err) { return []; }
}
function libRenderCollection(id) {
  const c = LIB_COLLECTIONS.find(x => x.id === id);
  if (!c) return libRenderHub();
  let body = '', soon = true;
  if (id === 'codex') {
    const all = libCodexList();
    if (all.length) {
      soon = false;
      const muscles = [...new Set(all.map(e => e.primaryMuscle).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
      if (libCodexMuscle !== 'all' && !muscles.includes(libCodexMuscle)) libCodexMuscle = 'all';
      const filtered = all.filter(e => libCodexMuscle === 'all' || e.primaryMuscle === libCodexMuscle);
      const shown = filtered.slice(0, libCodexShown);
      body = `<section class="lib-shell" aria-labelledby="libCodexT"><h2 class="lib-section__title" id="libCodexT">Exercises</h2>
        <p class="lib-meta">${filtered.length} exercise${filtered.length === 1 ? '' : 's'}${libCodexMuscle === 'all' ? '' : ` for ${esc(libCodexMuscle)}`}. Each page shows the facts the Exercise Library holds; technique guidance is not written yet.</p>
        <div class="lib-filters" role="group" aria-label="Filter by muscle group">${libChipHTML('All', 'data-lib-muscle', 'all', libCodexMuscle === 'all')}${muscles.map(m => libChipHTML(m, 'data-lib-muscle', m, libCodexMuscle === m)).join('')}</div>
        <ul class="lib-entries">${shown.map(ex => libEntryRowHTML({ title: ex.name, subtitle: [ex.primaryMuscle, ex.equipment].filter(Boolean).join(' · '), glyph: '▣', accent: 'orange', go: ex.id })).join('')}</ul>
        ${filtered.length > shown.length ? `<button type="button" class="lib-btn lib-btn--compact" data-lib-more="codex">Show ${Math.min(LIB_CODEX_STEP, filtered.length - shown.length)} more</button>` : ''}
      </section>`;
    }
  } else if (id === 'discoveries') {
    soon = false;
    const all = libDiscoveryEntries();
    const usedGroups = LIB_DISC_GROUPS.filter(g => g[0] === 'all' || all.some(e => libDiscGroup(e.kind) === g[0]));
    if (!usedGroups.some(g => g[0] === libDiscFilter)) libDiscFilter = 'all';
    const rows = all.filter(e => libDiscFilter === 'all' || libDiscGroup(e.kind) === libDiscFilter);
    body = `<section class="lib-shell" aria-labelledby="libFoundTitle"><h2 class="lib-section__title" id="libFoundTitle">Found so far</h2>${all.length
      ? `${usedGroups.length > 2 ? `<div class="lib-filters" role="group" aria-label="Filter by type">${usedGroups.map(g => libChipHTML(g[1], 'data-lib-disc', g[0], libDiscFilter === g[0])).join('')}</div>` : ''}<ul class="lib-entries">${rows.map(e => libEntryRowHTML(libDiscoveryRow(e))).join('')}</ul>`
      : libEmptyHTML({ title: 'Nothing discovered yet', text: 'People, creatures and secrets you find on your adventures will appear here. Each opens into its own page, and an entry appears only once you have found it.', inline: true })}</section>`;
  }
  const soonHTML = soon ? `<section class="lib-shell lib-soon" aria-labelledby="libSoonTitle"><div class="lib-empty">${libMedallionHTML({ glyph: c.glyph })}<span class="lib-tag">Coming soon</span><h2 class="lib-empty__title" id="libSoonTitle">${esc(c.soon.headline)}</h2><p class="lib-empty__text">${esc(c.soon.text)}</p></div></section>` : '';
  view.innerHTML = `<div class="lib-theme lib-page lib-accent-${esc(c.accent)}"><div class="lib-page__inner">
    ${libBackHTML()}
    ${libHeroHTML({ title: c.title, sub: c.subtitle, glyph: c.glyph })}
    ${body}
    ${soonHTML}
  </div></div>`;
  libBindNav();
  document.querySelectorAll('[data-lib-muscle]').forEach(b => b.onclick = () => { libCodexMuscle = b.dataset.libMuscle; libCodexShown = LIB_CODEX_STEP; libRenderCollection('codex'); const p = document.querySelector(`[data-lib-muscle="${CSS.escape(libCodexMuscle)}"]`); if (p) p.focus({ preventScroll: true }); });
  document.querySelectorAll('[data-lib-disc]').forEach(b => b.onclick = () => { libDiscFilter = b.dataset.libDisc; libRenderCollection('discoveries'); const p = document.querySelector(`[data-lib-disc="${CSS.escape(libDiscFilter)}"]`); if (p) p.focus({ preventScroll: true }); });
  const more = document.querySelector('[data-lib-more="codex"]');
  if (more) more.onclick = () => { libCodexShown += LIB_CODEX_STEP; libRenderCollection('codex'); const m = document.querySelector('[data-lib-more="codex"]'); if (m) m.focus({ preventScroll: true }); };
}

/* The one entry point the rest of the app calls. It routes to the current
   view. The guard stops any late render from painting this page over
   whatever page is open. */
function renderLibrary() {
  if (page !== 'library') return;
  if (libView === 'hub') return libRenderHub();
  const it = LIB_VIEWS.includes(libView) ? null : libItem(libView);
  if (it) return it.render();
  return libRenderCollection(LIB_VIEWS.includes(libView) ? libView : 'hub');
}
