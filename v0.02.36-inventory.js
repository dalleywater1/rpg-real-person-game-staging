/* Inventory V1 — Phase A: Data Foundation (Astra, 2026-09-22), ACCEPTED
   and locked by Lyra the same day -- see the file's own history for the
   round-2 corrections. Phase D (RPG-0020) added ONE more small, purely
   additive data concept below (Collections) — same fixture discipline,
   same "derive, never store a second source of truth" rule. Nothing
   above the Collections section changed for Phase D.
   Handovers: Aurelia's "The Player's Vault" (visual, NOT started here —
   see docs note below) + Lyra's architecture review, ROUND 2 corrections
   applied 2026-09-22 (round 1 was "accepted as a working prototype, not
   yet frozen" — these three fixes are what round 2 asked for before
   schema freeze/commit).

   SCOPE OF THIS FILE: persistence + grant/equip logic ONLY. No UI, no
   render function, no route. state.inventory/state.equipment already
   exist (defaults()/migrate() in app.js) — this file is what actually
   reads and writes them.

   Lyra's round-2 corrections, all applied below:
     1. grantRef is now a REQUIRED, caller-supplied parameter, separate
        from sourceRef — see grantItem()'s header comment. Round 1's
        design asked the caller to fold occurrence-uniqueness into
        sourceRef, which worked but left the API able to silently accept
        a non-unique value for a repeatable source. Splitting it into its
        own required field makes "what makes THIS grant occurrence
        unique" something every caller must consciously answer, not an
        implicit convention.
     2. state.equipment.statModifiers is now explicitly documented (and
        enforced by call-site discipline — see its own comment) as
        DERIVED CACHE, never an independent source of truth. Rebuilt from
        equipped[] + item definitions on every equip, every unequip, and
        once at load — never written any other way.
     3. grantItem() no longer touches Gold. Inventory is not a Reward
        Service; granting Gold is the caller's responsibility, exactly
        the shape mainQuestGrantReward() already uses elsewhere in this
        codebase (check the grant succeeded, mutate state.gold only on
        that branch).

   Lyra's round-1 controls, still applied:
     - Equipment integration is an INTERFACE BOUNDARY, not a locked slot
       schema — see refreshEquipmentStatModifiers()'s header comment.
     - The 7 dev fixture items are fixture data ONLY — see
       DEV_FIXTURE_ITEM_DEFS's header comment. devSeedInventory() is the
       only path that can ever put them in a save, and nothing calls it.
     - Phase A only (ItemDefinition, OwnedItem, grantItem(), persistence,
       idempotency tests). Phase B (Hub/All Items/Item Card/Item Detail)
       additionally needs Aurelia's six-piece visual review board
       approved and frozen first — not done as of this file (tracked
       RPG-0017). Phase C (Equipment proof/Character reflection) sits
       behind Lyra's own review gate after Phase B. Nothing past Phase A
       is built here.

   Still a proposal, not a lock: Lyra's round-2 note says she'll freeze
   the ownership foundation once these three corrections are confirmed
   re-tested. That confirmation hasn't happened yet — don't treat this
   schema as final until it does. */

/* ------------------------------------------------------------------ */
/* State normalisation (lazy, mirrors ensureQuickQuestsState() etc.)   */
/* ------------------------------------------------------------------ */

function ensureInventoryState(){
  if(!state.inventory||typeof state.inventory!=='object'||Array.isArray(state.inventory))state.inventory={version:1,ownedItems:[],grantLedger:{}};
  const inv=state.inventory;
  if(!Array.isArray(inv.ownedItems))inv.ownedItems=[];
  if(!inv.grantLedger||typeof inv.grantLedger!=='object'||Array.isArray(inv.grantLedger))inv.grantLedger={};
  return inv;
}
/* Equipment state (Master Build Phase A, RPG-0093 -- Lyra §3.3).
   ONE persisted authority: state.equipment.slots = the nine functional
   slots, each an OwnedItem id or null. Everything else on state.equipment
   is derived:
     - statModifiers  = disposable CACHE rebuilt from slots + item
                        definitions (Lyra round-2 correction #2, unchanged
                        -- see refreshEquipmentStatModifiers()).
     - equipped[]     = compatibility VIEW (a non-enumerable getter, so it
                        is never serialised): every slot value + every
                        equipped cosmetic. Legacy readers keep working; it
                        cannot become a second source of truth because it
                        cannot be written or persisted.
   state.equipment.cosmetics is the separate, power-free Cosmetic layer
   (Lyra §3.3: "a future Cosmetic layer is separate and has no power") --
   it exists only so an equippable cosmetic keeps its old equip behaviour
   without occupying a functional slot.
   A pre-Phase-A save has version 1 + a flat equipped[] of OwnedItem ids;
   that array is migrated ONCE into slots (idempotent -- a save that
   already has slots is never re-migrated) and any id that cannot be
   placed is recorded in eq.migration.unplaced rather than silently lost. */
function equipmentEmptySlots(){const o={};EQUIPMENT_SLOTS.forEach(k=>{o[k]=null});return o}
function ensureEquipmentState(){
  if(!state.equipment||typeof state.equipment!=='object'||Array.isArray(state.equipment))state.equipment={version:2,slots:equipmentEmptySlots(),cosmetics:[],statModifiers:{}};
  const eq=state.equipment;
  if(!eq.slots||typeof eq.slots!=='object'||Array.isArray(eq.slots)){
    /* One-time migration from the flat proof shape. Only an OWN DATA
       property counts as legacy input -- once the derived getter is
       installed the property is an accessor and is never re-read here. */
    const legacy=Object.getOwnPropertyDescriptor(eq,'equipped');
    const legacyIds=(legacy&&'value' in legacy&&Array.isArray(legacy.value))?legacy.value:[];
    eq.slots=equipmentEmptySlots();
    eq.cosmetics=Array.isArray(eq.cosmetics)?eq.cosmetics:[];
    const unplaced=[];
    legacyIds.forEach(ownedId=>{
      const owned=ensureInventoryState().ownedItems.find(o=>o.id===ownedId);
      const def=owned?itemDefinitionById(owned.itemDefinitionId):null;
      if(!def){unplaced.push(ownedId);return}
      if(def.kind==='cosmetic'){if(!eq.cosmetics.includes(ownedId))eq.cosmetics.push(ownedId);return}
      const slot=equipmentSlotForDef(def,eq.slots);
      if(slot)eq.slots[slot]=ownedId;else unplaced.push(ownedId);
    });
    if(legacyIds.length)eq.migration={fromVersion:1,at:new Date().toISOString(),placed:legacyIds.length-unplaced.length,unplaced};
  }
  EQUIPMENT_SLOTS.forEach(k=>{if(!(k in eq.slots))eq.slots[k]=null});
  if(!Array.isArray(eq.cosmetics))eq.cosmetics=[];
  eq.version=2;
  if(!eq.statModifiers||typeof eq.statModifiers!=='object'||Array.isArray(eq.statModifiers))eq.statModifiers={};
  const d=Object.getOwnPropertyDescriptor(eq,'equipped');
  if(!(d&&d.get)){
    delete eq.equipped;
    Object.defineProperty(eq,'equipped',{configurable:true,enumerable:false,get(){return equipmentEquippedView(this)},set(){/* derived view: intentionally not writable */}});
  }
  return eq;
}
/* Derived compat view -- see the ensureEquipmentState() header. */
function equipmentEquippedView(eq){
  const ids=[];
  EQUIPMENT_SLOTS.forEach(k=>{const v=eq.slots&&eq.slots[k];if(v!=null)ids.push(v)});
  (eq.cosmetics||[]).forEach(id=>{if(!ids.includes(id))ids.push(id)});
  return ids;
}
/* Which functional slot an ItemDefinition occupies (null for a cosmetic or
   a non-equippable item). ACCESSORY resolves to whichever of the two
   accessory slots is free, else Accessory 1 (replace). */
function equipmentSlotForDef(def,slots,preferred){
  if(!def||!def.equippable||def.kind==='cosmetic')return null;
  const s=def.slot;
  if(!s)return null;
  if(s==='ACCESSORY'){
    if(preferred==='ACCESSORY_1'||preferred==='ACCESSORY_2')return preferred;
    if(!slots||slots.ACCESSORY_1==null)return 'ACCESSORY_1';
    if(slots.ACCESSORY_2==null)return 'ACCESSORY_2';
    return 'ACCESSORY_1';
  }
  return EQUIPMENT_SLOTS.includes(s)?s:null;
}
/* Which slot an OwnedItem currently occupies: a slot key, 'COSMETIC', or null. */
function equipmentSlotOf(ownedItemId){
  const eq=ensureEquipmentState();
  for(const k of EQUIPMENT_SLOTS)if(eq.slots[k]===ownedItemId)return k;
  return eq.cosmetics.includes(ownedItemId)?'COSMETIC':null;
}

/* ------------------------------------------------------------------ */
/* ItemDefinition catalogue                                            */
/* ------------------------------------------------------------------ */

/* Static content, not persisted state — same split as the Exercise
   Library (EXERCISE_LIBRARY_BUILTIN vs. state.customExercises). Plain
   object literals rather than the Exercise Library's compact tuple-row
   format: that format earns its keep at ~150-260 rows, not at the 0 real
   + 7 fixture items this starts with. If/when a real catalogue grows
   large, ITEM_ROWS/ITEM_row(r) mirroring EL_row() is the documented
   precedent to switch to — not done preemptively. */
const ITEM_DATASET_VERSION='2026.09.22.1';
/* Same LOCKED RULE as EXERCISE_ID_MIGRATION: existing ids are never
   regenerated, only ever added here as a rename/merge table, so any
   already-saved OwnedItem.itemDefinitionId keeps resolving. */
const ITEM_ID_MIGRATION={};
function resolveItemId(id){return ITEM_ID_MIGRATION[id]||id}

/* Real, Jay-approved item catalogue. First real content: World Tours 5.3,
   Hadrian's Wall (Aster's production content pack, docs/handovers/
   world-tours-5.3/, 2026-09-23) -- 12 collectible cards granted by
   Hadrian's Wall landmark/event discovery via grantItem() (app.js,
   journeyResolveProgress). Names/rarities are Aster's own content
   verbatim; rarity strings lowercased to match this file's own
   convention (item rarity is lowercase everywhere else here, unlike the
   achievement register's capitalized rarity strings). */
const ITEM_DEFINITIONS_BUILTIN=[
  {id:'hw_card_fort_segedunum',name:'Segedunum',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Fort',collectionId:'hw_collection_forts'},
  {id:'hw_card_fort_chesters',name:'Cilurnum — Chesters',kind:'collectible',rarity:'rare',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Fort',collectionId:'hw_collection_forts'},
  {id:'hw_card_fort_housesteads',name:'Vercovicium — Housesteads',kind:'collectible',rarity:'rare',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Fort',collectionId:'hw_collection_forts'},
  {id:'hw_card_fort_birdoswald',name:'Banna — Birdoswald',kind:'collectible',rarity:'rare',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Fort',collectionId:'hw_collection_forts'},
  {id:'hw_card_legion_ii_augusta',name:'Legio II Augusta',kind:'collectible',rarity:'uncommon',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Legion',collectionId:'hw_collection_legions'},
  {id:'hw_card_legion_vi_victrix',name:'Legio VI Victrix',kind:'collectible',rarity:'uncommon',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Legion',collectionId:'hw_collection_legions'},
  {id:'hw_card_legion_xx_valeria_victrix',name:'Legio XX Valeria Victrix',kind:'collectible',rarity:'uncommon',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Legion',collectionId:'hw_collection_legions'},
  {id:'hw_card_infra_wall',name:'Curtain Wall',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Infrastructure',collectionId:'hw_collection_infrastructure'},
  {id:'hw_card_infra_milecastle',name:'Milecastle',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Infrastructure',collectionId:'hw_collection_infrastructure'},
  {id:'hw_card_infra_turret',name:'Turret',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Infrastructure',collectionId:'hw_collection_infrastructure'},
  {id:'hw_card_infra_vallum',name:'Vallum',kind:'collectible',rarity:'uncommon',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Infrastructure',collectionId:'hw_collection_infrastructure'},
  {id:'hw_card_infra_bridge',name:'Roman Bridge',kind:'collectible',rarity:'uncommon',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Infrastructure',collectionId:'hw_collection_infrastructure'},
  /* World Tours 5.4.x -- Camino Francés (RPG-0090 pipeline, 2026-09-24).
     15 collectible cards granted by Camino landmark/event discovery, same
     grantItem() mechanism as Hadrian's Wall -- zero new code needed.
     Names are RPG-original (credencial "sello" stamps + RPG-original
     relic trinkets), never a reproduction of a real church/albergue
     stamp's actual artwork -- per the brief's explicit instruction, this
     is a naming/flavour pass only; the real stamp-style illustration
     work is Aurelia's, later. */
  {id:'cam_stamp_sjpp',name:'Saint-Jean Sello',kind:'collectible',rarity:'uncommon',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Stamp',collectionId:'cam_collection_credencial'},
  {id:'cam_stamp_roncesvalles',name:'Roncesvalles Sello',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Stamp',collectionId:'cam_collection_credencial'},
  {id:'cam_stamp_pamplona',name:'Pamplona Sello',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Stamp',collectionId:'cam_collection_credencial'},
  {id:'cam_stamp_logrono',name:'Logroño Sello',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Stamp',collectionId:'cam_collection_credencial'},
  {id:'cam_stamp_burgos',name:'Burgos Sello',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Stamp',collectionId:'cam_collection_credencial'},
  {id:'cam_stamp_leon',name:'León Sello',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Stamp',collectionId:'cam_collection_credencial'},
  {id:'cam_stamp_ponferrada',name:'Ponferrada Sello',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Stamp',collectionId:'cam_collection_credencial'},
  {id:'cam_stamp_sarria',name:'Sarria Sello',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Stamp',collectionId:'cam_collection_credencial'},
  {id:'cam_stamp_santiago',name:'Compostela Sello',kind:'collectible',rarity:'uncommon',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Stamp',collectionId:'cam_collection_credencial'},
  {id:'cam_relic_rolands_horn',name:'Roland\'s Horn Fragment',kind:'collectible',rarity:'uncommon',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Relic',collectionId:'cam_collection_relics'},
  {id:'cam_relic_meseta_stone',name:'Meseta Stone',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Relic',collectionId:'cam_collection_relics'},
  {id:'cam_relic_cruz_pebble',name:'Cruz de Ferro Pebble',kind:'collectible',rarity:'rare',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Relic',collectionId:'cam_collection_relics'},
  {id:'cam_relic_last_waymark',name:'Sarria Waymark',kind:'collectible',rarity:'common',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Relic',collectionId:'cam_collection_relics'},
  {id:'cam_relic_wine_cork',name:'Irache Wine Cork',kind:'collectible',rarity:'uncommon',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Relic',collectionId:'cam_collection_relics'},
  {id:'cam_relic_botafumeiro_charm',name:'Botafumeiro Charm',kind:'collectible',rarity:'rare',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Relic',collectionId:'cam_collection_relics'}
];

/* Dev/test fixtures ONLY (Lyra, 2026-09-22, control #3): "Astra must
   keep them as fixture/dev data unless Jay explicitly approves them as
   actual RPG content. They must not silently migrate into existing
   saves." These seven cover exactly the states Aurelia's review board
   and the eventual QA pass need (§31/§32 of her handover): gear,
   cosmetic, collectible, Quest item, stackable, hidden/secret, and all
   five rarity tiers touched at least once. A definition existing here is
   harmless by itself (no different from an unused Exercise Library row);
   the only path that can ever grant one into state.inventory.ownedItems
   is devSeedInventory() below, and nothing else in this codebase calls
   it. Names reuse real, already-existing narrative content where one
   exists (Echo's Leaf Amulet, a Pinnacle-relics collection echoing the
   real Pinnacle Map Fragments counter) rather than inventing new lore. */
const DEV_FIXTURE_ITEM_DEFS=[
  {id:'dev_iron_sword',name:'Iron Sword',kind:'gear',rarity:'rare',stackable:false,equippable:true,secret:false,statModifiers:{damage:2},category:'Weapon',slot:'WEAPON',levelRequirement:1,status:'DEV_FIXTURE'},
  {id:'dev_travelers_cloak',name:'Traveler’s Cloak',kind:'cosmetic',rarity:'common',stackable:false,equippable:true,secret:false,statModifiers:{},category:'Cosmetic'},
  {id:'dev_pinnacle_relic_shard',name:'Pinnacle Relic Shard',kind:'collectible',rarity:'uncommon',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Collectible',collectionId:'pinnacle-relics'},
  {id:'dev_echo_leaf_amulet',name:'Echo’s Leaf Amulet',kind:'quest',rarity:'epic',stackable:false,equippable:false,secret:false,statModifiers:{},category:'Quest Item'},
  {id:'dev_travel_ration',name:'Travel Ration',kind:'consumable',rarity:'common',stackable:true,equippable:false,secret:false,statModifiers:{},category:'Consumable',status:'DEV_FIXTURE'},
  {id:'dev_sealed_relic_casket',name:'Sealed Relic Casket',kind:'collectible',rarity:'rare',stackable:false,equippable:false,secret:true,statModifiers:{},category:'Collectible',collectionId:'pinnacle-relics'},
  {id:'dev_smiths_whetstone',name:'Smith’s Whetstone',kind:'gear',rarity:'legendary',stackable:true,equippable:true,secret:false,statModifiers:{defence:1},category:'Utility',slot:'ACCESSORY',levelRequirement:1,status:'DEV_FIXTURE'}
];

/* Phase D (RPG-0020) collection-member fixtures ONLY -- real definitions
   (so the Pinnacle Relics collection has real content to point at and
   invItemCardHTML's Unknown state has something genuine to obscure), but
   deliberately NOT included in DEV_FIXTURE_ITEM_DEFS/devSeedInventory():
   if every collection member were auto-granted, the Collection Detail
   page would never actually show an undiscovered "?" slot to verify
   against. Same fixture-only discipline as the rest of this file --
   never real content, never silently owned. */
const DEV_FIXTURE_COLLECTION_ONLY_DEFS=[
  {id:'dev_relic_frostbound_shard',name:'Frostbound Shard',kind:'collectible',rarity:'epic',stackable:false,equippable:false,secret:true,statModifiers:{},category:'Collectible',collectionId:'pinnacle-relics'},
  {id:'dev_relic_sunspire_core',name:'Sunspire Core',kind:'collectible',rarity:'legendary',stackable:false,equippable:false,secret:true,statModifiers:{},category:'Collectible',collectionId:'pinnacle-relics'}
];

/* Master Build Phase A (RPG-0093): the ONE registry now also carries
   Assay's seed consumables/supplies/containers (v0.02.46-economy-config.js,
   status APPROVED) and the per-slot equipment DEV FIXTURES (status
   'DEV_FIXTURE', never in a real pool). `id` stays the registry key;
   Assay's `itemId` is an alias carried on each row (same value), so there
   is no second registry keyed separately. Rarity is lowercase throughout,
   matching this file's own convention. */
let __itemDefAll=null,__itemDefIndex=null;
function allItemDefinitions(){
  if(!__itemDefAll){
    __itemDefAll=ITEM_DEFINITIONS_BUILTIN.concat(DEV_FIXTURE_ITEM_DEFS).concat(DEV_FIXTURE_COLLECTION_ONLY_DEFS)
      .concat(typeof ECONOMY_SEED_DEFS!=='undefined'?ECONOMY_SEED_DEFS:[])
      .concat(typeof ECONOMY_DEV_EQUIPMENT_DEFS!=='undefined'?ECONOMY_DEV_EQUIPMENT_DEFS:[])
      .concat(typeof ECONOMY_BASIC_GEAR_DEFS!=='undefined'?ECONOMY_BASIC_GEAR_DEFS:[]);
    __itemDefIndex=new Map(__itemDefAll.map(d=>[d.id,d]));
  }
  return __itemDefAll;
}
function itemDefinitionById(id){allItemDefinitions();return __itemDefIndex.get(resolveItemId(id))||null}
/* Only APPROVED production content may enter a Store/chest/drop pool. A
   DEV_FIXTURE row qualifies only while the console-only, non-persisted
   economyDevFixturesEnabled() switch is on (see the economy config). */
function itemDefinitionPoolEligible(def){
  if(!def)return false;
  if(def.status==='APPROVED')return true;
  return def.status==='DEV_FIXTURE'&&typeof economyDevFixturesEnabled==='function'&&economyDevFixturesEnabled();
}
/* Aggregate of a definition's gear power as a flat key->number map: legacy
   statModifiers + implicit damage/defence + STAT_FLAT affixes. Non-flat
   affixes (DAMAGE_PCT, CHECK_BONUS, ...) are stored on the template but not
   applied here -- combat and campaign checks are Phases C/D. */
function itemDefinitionGearModifiers(def){
  const t={};
  const add=(k,v)=>{v=Number(v||0);if(v)t[k]=(t[k]||0)+v};
  if(!def||def.kind==='cosmetic'||def.cosmeticOnly)return t;
  if(def.statModifiers)Object.keys(def.statModifiers).forEach(k=>add(k,def.statModifiers[k]));
  if(def.implicit){add('damage',def.implicit.damage);add('defence',def.implicit.defence)}
  (def.affixes||[]).forEach(a=>{if(a&&a.effectId==='STAT_FLAT'&&a.stat)add(String(a.stat).toLowerCase(),a.value)});
  return t;
}
function itemDefinitionMaxStack(def){
  if(!def||!def.stackable)return 1;
  const n=Math.floor(Number(def.maxStack));
  return n>0?n:(typeof ECONOMY_CONFIG!=='undefined'?ECONOMY_CONFIG.stack.defaultMax:99);
}

/* ------------------------------------------------------------------ */
/* Collections (Phase D, RPG-0020)                                     */
/* ------------------------------------------------------------------ */

/* Static content, same split as ItemDefinition -- a collection's shape
   (id/name/description/emblem/member ids) is code, not persisted state.
   First real content: World Tours 5.3, Hadrian's Wall. Aster's content
   pack structures these as three named SUBSETS inside one umbrella
   collection ("Frontier of Britannia"); the Collection model built for
   RPG-0020 is flat (one collection = one itemDefinitionIds list, no
   subset/nesting concept), so this ships as three flat top-level
   Collections instead of one nested one -- reusing the existing,
   already-tested model exactly as-is rather than adding nesting support
   it doesn't need yet. hw_ach_infrastructure (v0.02.4-integration.js)
   checks the infrastructure one specifically for its "complete the
   subset" achievement. */
const COLLECTION_DEFINITIONS_BUILTIN=[
  {id:'hw_collection_forts',name:'Forts of the Frontier',description:'Roman forts along Hadrian’s Wall.',itemDefinitionIds:['hw_card_fort_segedunum','hw_card_fort_chesters','hw_card_fort_housesteads','hw_card_fort_birdoswald']},
  {id:'hw_collection_legions',name:'Builders of the Wall',description:'The three legions whose working parties built Hadrian’s Wall.',itemDefinitionIds:['hw_card_legion_ii_augusta','hw_card_legion_vi_victrix','hw_card_legion_xx_valeria_victrix']},
  {id:'hw_collection_infrastructure',name:'Infrastructure of the Frontier',description:'The Wall’s supporting infrastructure — curtain wall, milecastles, turrets, the Vallum and its bridges.',itemDefinitionIds:['hw_card_infra_wall','hw_card_infra_milecastle','hw_card_infra_turret','hw_card_infra_vallum','hw_card_infra_bridge']},
  {id:'cam_collection_credencial',name:'Pilgrim\'s Credencial',description:'A sello from every major town on the Camino Francés.',itemDefinitionIds:['cam_stamp_sjpp','cam_stamp_roncesvalles','cam_stamp_pamplona','cam_stamp_logrono','cam_stamp_burgos','cam_stamp_leon','cam_stamp_ponferrada','cam_stamp_sarria','cam_stamp_santiago']},
  {id:'cam_collection_relics',name:'Relics of the Way',description:'Small tokens of the Camino Francés\'s six best discoveries.',itemDefinitionIds:['cam_relic_rolands_horn','cam_relic_meseta_stone','cam_relic_cruz_pebble','cam_relic_last_waymark','cam_relic_wine_cork','cam_relic_botafumeiro_charm']}
];
const DEV_FIXTURE_COLLECTIONS=[
  {id:'pinnacle-relics',name:'Pinnacle Relics',description:'Relics recovered along the Call to the Lost Fortress campaign.',itemDefinitionIds:['dev_pinnacle_relic_shard','dev_sealed_relic_casket','dev_relic_frostbound_shard','dev_relic_sunspire_core']}
];
function allCollectionDefinitions(){return COLLECTION_DEFINITIONS_BUILTIN.concat(DEV_FIXTURE_COLLECTIONS)}
function collectionById(id){return allCollectionDefinitions().find(c=>c.id===id)||null}

/* Progress is ALWAYS derived at call time from state.inventory.ownedItems
   -- Lyra, Phase D scope: "Collections should derive from owned items...
   do not create a second collection-progress source of truth." Nothing
   here is stored; calling this twice in a row after a grant just sees
   the new real count, no cache to invalidate. */
function collectionProgress(collectionId){
  const col=collectionById(collectionId);
  if(!col)return {owned:0,total:0,ownedDefIds:[]};
  const ownedDefIds=new Set(invOwnedItemsSafe().map(o=>o.itemDefinitionId));
  const ownedInCollection=col.itemDefinitionIds.filter(id=>ownedDefIds.has(id));
  return {owned:ownedInCollection.length,total:col.itemDefinitionIds.length,ownedDefIds:ownedInCollection};
}
/* Tiny indirection so this file never assumes ensureInventoryState() has
   already run this render pass -- safe to call from anywhere, anytime. */
function invOwnedItemsSafe(){return ensureInventoryState().ownedItems}

/* ------------------------------------------------------------------ */
/* Granting — idempotent, item-only (Lyra round-1 control #2,          */
/* round-2 corrections #1 and #3)                                      */
/* ------------------------------------------------------------------ */

/* The ledger key is the stable identity of THIS GRANT EVENT, built from
   (sourceType, sourceRef, grantRef, itemDefinitionId) via v023StableId()
   — the same stable-hash-then-look-up-before-creating idiom this
   codebase already uses for training event ids and stat-modifier ids
   (v0.02.4-integration.js).

   Lyra round-2 correction #1: grantRef is a REQUIRED parameter, distinct
   from sourceRef. sourceType+sourceRef identify WHICH SYSTEM/ENTITY is
   granting (e.g. 'quest' + a quest's own stable id) and do not need to
   be unique per occurrence; grantRef identifies THIS SPECIFIC
   OCCURRENCE and is what the caller must make unique per real event. A
   one-time Achievement can pass a stable grantRef (e.g. the achievement
   id itself — it only ever fires once, so that's already unique
   forever). A repeatable Quest/challenge MUST pass something that
   changes per completion (that completion's own event id, or a
   completion timestamp) — round 1's design asked callers to fold this
   into sourceRef by convention; making it its own required field means
   a caller literally cannot omit an occurrence reference by accident.
   grantItem() itself never guesses which case it's in — it only ever
   dedupes on the exact (sourceType, sourceRef, grantRef, itemDefinitionId)
   tuple it's given. A replayed render of the SAME completion passes the
   same grantRef and is correctly suppressed; a genuinely new completion
   passes a new grantRef and is correctly granted.

   Lyra round-2 correction #3: this function grants an ITEM. Nothing
   else. It does not touch Gold, XP, or any other reward currency —
   Inventory is not a general Reward Service. A caller that needs to
   grant an item AND Gold for the same event (e.g. a future
   questGrantReward()) checks this call's `granted` flag and mutates
   state.gold itself only on that branch — the exact shape
   mainQuestGrantReward() (app.js) already uses for its own Gold
   mutation. */
function grantItem({itemDefinitionId,sourceType,sourceRef,grantRef,quantity=1}={}){
  const def=itemDefinitionById(itemDefinitionId);
  if(!def)return {granted:false,reason:'unknown-item-definition'};
  if(!sourceType||!sourceRef||!grantRef)return {granted:false,reason:'missing-source'};
  quantity=Math.max(1,Math.floor(Number(quantity)||1));
  const inv=ensureInventoryState();
  const ledgerKey=v023StableId('itemGrant',sourceType,sourceRef,grantRef,def.id);
  const existingOwnedId=inv.grantLedger[ledgerKey];
  if(existingOwnedId){
    const existing=inv.ownedItems.find(o=>o.id===existingOwnedId);
    return {granted:false,reason:'already-granted',ledgerKey,ownedItem:existing||null};
  }
  /* Stackable items merge into an existing row for that definition
     regardless of which grant most recently topped it up (so three
     Travel Rations from three different completions still read as one
     stack of 3, not three separate rows) -- non-stackable items always
     create their own new row, since a second Iron Sword grant is a
     second real sword, not more quantity of the first. Master Build
     Phase A: a stackable definition now honours its maxStack (Assay:
     99). Merging fills the existing rows that still have room first; any
     remainder opens a NEW stack row, so the "one OwnedItem row per stack"
     model is unchanged and no quantity is ever lost or clamped. */
  const maxStack=itemDefinitionMaxStack(def);
  let owned=null,remaining=quantity;
  if(def.stackable){
    for(const row of inv.ownedItems){
      if(remaining<=0)break;
      if(row.itemDefinitionId!==def.id)continue;
      const room=maxStack-Number(row.quantity||1);
      if(room<=0)continue;
      const add=Math.min(room,remaining);
      row.quantity=Number(row.quantity||1)+add;row.isNew=true;remaining-=add;owned=owned||row;
    }
  }
  while(remaining>0||!owned){
    const take=def.stackable?Math.min(maxStack,Math.max(remaining,1)):1;
    const row={
      id:invNewOwnedId(inv),
      itemDefinitionId:def.id,
      quantity:take,
      acquiredAt:new Date().toISOString(),
      sourceType,sourceRef,grantRef,
      isNew:true,isFavourite:false,isLocked:false,
      /* Reserved for future per-instance data (e.g. an enchantment's
         remaining charges). Always {} in Phase A — nothing writes to it
         yet, so nothing here is invented ahead of a real need. */
      meta:{}
    };
    inv.ownedItems.push(row);
    owned=owned||row;
    remaining-=take;
    if(remaining<=0)break;
  }
  inv.grantLedger[ledgerKey]=owned.id;
  invSave();
  return {granted:true,ownedItem:owned,ledgerKey};
}

/* uid() is Date.now()+random(0..9999): two grants in the same millisecond
   (a Claim all, a chest open + its result) can draw the SAME id, and an
   OwnedItem id is what equipment slots and the grant ledger point at, so a
   collision would silently alias two items. Found by the Phase A chest
   simulation. Ids stay numbers (every UI click handler does Number(id)). */
function invNewOwnedId(inv){
  const used=new Set(inv.ownedItems.map(o=>o.id));
  let id=uid();
  while(used.has(id))id+=1;
  return id;
}

/* All inventory/equipment/economy writes go through one save gate so a
   multi-step transaction (purchase, claim, sell, chest open -- see
   economyTransaction() in v0.02.47) can suppress the intermediate saves
   and persist exactly once at the end, or roll back and never persist. */
function invSave(){
  if(typeof economyBatchActive==='function'&&economyBatchActive())return;
  save();
}

/* Clears the New marker once the player has actually seen the item (a
   future Item Detail open, in Phase B). No-op if already false so it's
   safe to call unconditionally. */
function markOwnedItemSeen(ownedItemId){
  const inv=ensureInventoryState();
  const owned=inv.ownedItems.find(o=>o.id===ownedItemId);
  if(!owned||!owned.isNew)return false;
  owned.isNew=false;invSave();return true;
}

function toggleOwnedItemFavourite(ownedItemId){
  const inv=ensureInventoryState();
  const owned=inv.ownedItems.find(o=>o.id===ownedItemId);
  if(!owned)return null;
  owned.isFavourite=!owned.isFavourite;invSave();
  return owned.isFavourite;
}

/* ------------------------------------------------------------------ */
/* Equipment adapter boundary (Lyra round-1 control #1,                 */
/* round-2 correction #2)                                              */
/* ------------------------------------------------------------------ */

/*
   Inventory OwnedItem
           v
   Equipment Service / Adapter   <- equipItem()/unequipItem() below
           v
   Current Equipment State       <- state.equipment.slots (the ONE authority; equipped[] is a derived view)
           v                        state.equipment.statModifiers (CACHE)
   Character                     <- statSources() already reads the cache

   Lyra round-1, control #1: "Do not let Astra invent permanent equipment
   slots merely to finish Inventory... build an interface boundary...
   Then we can settle the actual slot schema separately."
   state.equipment.equipped is a plain array of OwnedItem ids — no
   .weapon/.armor keys, no fixed slot count, nothing that presumes a slot
   schema. Real slots are explicitly Phase C, past Lyra's review gate,
   not decided here.

   Lyra round-2, correction #2: "statModifiers must not become a second
   independent Equipment truth... define it explicitly as derived/cache
   state that can be rebuilt from equipped items, not something edited
   independently. Otherwise we eventually get drift." The ONLY authority
   for what is equipped is state.equipment.equipped (an id list).
   state.equipment.statModifiers is a disposable, always-rebuildable
   CACHE of that list's aggregate stat effect — it exists only because
   Character's statSources() needs a plain object to read (see below),
   not because it's a second source of truth. It is written in exactly
   ONE place: refreshEquipmentStatModifiers(), called at every point
   equipped[] can change (equipItem, unequipItem) and once more at this
   file's own load (bottom of this file) so a persisted cache from a
   previous session is never trusted on faith — it's rebuilt fresh before
   anything reads it. If you ever need to mutate state.equipment.equipped
   directly for some new reason, call refreshEquipmentStatModifiers()
   immediately after, or the cache WILL drift until the next equip/unequip.

   The Character-side integration point ALREADY EXISTS and needed zero
   new code: statSources()'s live override (v0.02.4-integration.js,
   v023ModifierRecords) already reads state.equipment?.statModifiers as
   one of its modifier sources, feeding the same base/effective/per-
   source-record pipeline Character's stat cards and statBreakdownModal
   already render. This cache is the only reason that plumbing works
   without Inventory duplicating any Character logic. */
/* Slot-aware equip (Master Build Phase A, Lyra §3.3). The authority is
   state.equipment.slots -- see ensureEquipmentState(). Rules:
     - the item must be owned and equippable;
     - a functional item needs Character Level >= its levelRequirement
       (Assay §3.4 -- gold cannot skip progression);
     - a slot holds one item: equipping into an occupied slot REPLACES the
       occupant, and the derived modifier cache is rebuilt in the same
       call, so a replacement can never leave a stale modifier behind;
     - ACCESSORY items go to a free Accessory slot (or a caller-chosen
       one via slotHint), else replace Accessory 1;
     - a cosmetic joins the power-free Cosmetic layer instead of a slot;
     - equipping never duplicates an OwnedItem (slots hold ids only).
   canEquipOwnedItem() is the read-only pre-check the UI uses to disable
   Equip and say why. */
function canEquipOwnedItem(ownedItemId,slotHint){
  const inv=ensureInventoryState(),eq=ensureEquipmentState();
  const owned=inv.ownedItems.find(o=>o.id===ownedItemId);
  if(!owned)return {ok:false,reason:'not-owned'};
  const def=itemDefinitionById(owned.itemDefinitionId);
  if(!def||!def.equippable)return {ok:false,reason:'not-equippable'};
  if(def.kind==='cosmetic')return {ok:true,slot:'COSMETIC',cosmetic:true};
  const slot=equipmentSlotForDef(def,eq.slots,slotHint);
  if(!slot)return {ok:false,reason:'no-slot'};
  const required=Number(def.levelRequirement||1);
  if(Number(state.level||1)<required)return {ok:false,reason:'level-too-low',required,slot};
  return {ok:true,slot,replaces:eq.slots[slot]!=null&&eq.slots[slot]!==ownedItemId?eq.slots[slot]:null};
}
function equipItem(ownedItemId,slotHint){
  const eq=ensureEquipmentState();
  const check=canEquipOwnedItem(ownedItemId,slotHint);
  if(!check.ok)return {equipped:false,reason:check.reason,required:check.required};
  if(check.cosmetic){
    if(!eq.cosmetics.includes(ownedItemId))eq.cosmetics.push(ownedItemId);
  }else{
    /* Already worn somewhere: move it, never keep two references. */
    EQUIPMENT_SLOTS.forEach(k=>{if(eq.slots[k]===ownedItemId)eq.slots[k]=null});
    eq.slots[check.slot]=ownedItemId;
  }
  refreshEquipmentStatModifiers();
  invSave();
  return {equipped:true,slot:check.slot,replaced:check.replaces||null};
}
function unequipItem(ownedItemId){
  const eq=ensureEquipmentState();
  let changed=false;
  EQUIPMENT_SLOTS.forEach(k=>{if(eq.slots[k]===ownedItemId){eq.slots[k]=null;changed=true}});
  const before=eq.cosmetics.length;
  eq.cosmetics=eq.cosmetics.filter(id=>id!==ownedItemId);
  if(eq.cosmetics.length!==before)changed=true;
  if(!changed)return {equipped:false,reason:'not-equipped'};
  refreshEquipmentStatModifiers();
  invSave();
  return {equipped:true};
}
/* The single writer of state.equipment.statModifiers. Always a full
   rebuild from slots + item definitions, never an incremental edit -- so
   there is no code path anywhere that can leave the cache holding a value
   that doesn't match what's actually equipped. It also self-heals the
   authority itself: a slot that names an OwnedItem which no longer exists
   (or no longer fits the slot) is emptied, so a stale id can neither
   contribute a modifier nor sit in a slot forever. The value stored is the
   RAW flat sum; the per-stat gear cap (floor(5+0.2xBase), Assay §6.4) is
   applied at read time in Character's modifier pipeline because it depends
   on Base, which moves as the player trains. */
function refreshEquipmentStatModifiers(){
  const inv=ensureInventoryState(),eq=ensureEquipmentState();
  const totals={};
  EQUIPMENT_SLOTS.forEach(k=>{
    const ownedId=eq.slots[k];
    if(ownedId==null)return;
    const owned=inv.ownedItems.find(o=>o.id===ownedId);
    const def=owned?itemDefinitionById(owned.itemDefinitionId):null;
    if(!owned||!def||!def.equippable){eq.slots[k]=null;return}
    const mods=itemDefinitionGearModifiers(def);
    Object.keys(mods).forEach(key=>{totals[key]=Number(totals[key]||0)+Number(mods[key]||0)});
  });
  eq.cosmetics=eq.cosmetics.filter(id=>inv.ownedItems.some(o=>o.id===id));
  eq.statModifiers=totals;
  return totals;
}

/* ------------------------------------------------------------------ */
/* Dev-only seeding — never auto-invoked (Lyra control #3)             */
/* ------------------------------------------------------------------ */

/* Run this yourself from a console when Phase B needs sample owned items
   to develop against. Goes through the real grantItem() idempotency
   path, so running it twice never duplicates anything (each fixture's
   grantRef is stable across runs). Tagged sourceType:'dev-seed' so every
   fixture-granted row is unambiguous in the data itself, not just by
   convention. NOTHING in migrate(), defaults(), or any render path calls
   this — confirm with `grep -rn devSeedInventory` before ever wiring it
   into a real flow. */
function devSeedInventory(){
  return DEV_FIXTURE_ITEM_DEFS.map(def=>grantItem({
    itemDefinitionId:def.id,sourceType:'dev-seed',sourceRef:def.id,grantRef:'phase-a-fixture',
    quantity:def.stackable?3:1
  }));
}

/* ------------------------------------------------------------------ */
/* Phase A self-test (Lyra, Phase A: "idempotency tests";               */
/* extended 2026-09-22 for the round-2 corrections)                    */
/* ------------------------------------------------------------------ */

/* Not a shipped test framework (this codebase has none) — a callable
   smoke test that exercises the real functions above against a
   throwaway in-memory copy of state.inventory/state.equipment,
   restores the real ones afterward regardless of outcome, and returns a
   pass/fail report. Run from a console: __inventoryPhaseATests(). */
function __inventoryPhaseATests(){
  const savedInv=state.inventory,savedEq=state.equipment,savedGold=state.gold,savedSave=window.save;
  window.save=function(){}; // don't hit localStorage/Drive during a self-test
  state.inventory={version:1,ownedItems:[],grantLedger:{}};
  state.equipment={version:1,equipped:[],statModifiers:{}};
  const results=[];
  const check=(label,cond)=>results.push({label,pass:Boolean(cond)});
  try {
    // 1. A single grant creates exactly one OwnedItem.
    const g1=grantItem({itemDefinitionId:'dev_iron_sword',sourceType:'quest',sourceRef:'q-1',grantRef:'completion-1'});
    check('first grant succeeds',g1.granted===true);
    check('exactly one owned item after first grant',ensureInventoryState().ownedItems.length===1);

    // 2. Replaying the SAME grantRef (same occurrence) is suppressed, not duplicated.
    const g2=grantItem({itemDefinitionId:'dev_iron_sword',sourceType:'quest',sourceRef:'q-1',grantRef:'completion-1'});
    check('replayed same grantRef is suppressed',g2.granted===false&&g2.reason==='already-granted');
    check('still exactly one owned item after replay',ensureInventoryState().ownedItems.length===1);

    // 3. Round-2 correction #1: the SAME source (sourceType+sourceRef) granting again with a
    //    DIFFERENT grantRef (a genuinely new completion of a repeatable quest) is NOT suppressed.
    const g3=grantItem({itemDefinitionId:'dev_iron_sword',sourceType:'quest',sourceRef:'q-1',grantRef:'completion-2'});
    check('same source, new grantRef, is granted (repeatable-reward case)',g3.granted===true&&ensureInventoryState().ownedItems.length===2);

    // 4. Stackable items merge quantity across different grants instead of adding rows.
    grantItem({itemDefinitionId:'dev_travel_ration',sourceType:'quest',sourceRef:'q-2',grantRef:'completion-1',quantity:2});
    grantItem({itemDefinitionId:'dev_travel_ration',sourceType:'quest',sourceRef:'q-2',grantRef:'completion-2',quantity:1});
    const ration=ensureInventoryState().ownedItems.find(o=>o.itemDefinitionId==='dev_travel_ration');
    check('stackable merges into one row',ensureInventoryState().ownedItems.filter(o=>o.itemDefinitionId==='dev_travel_ration').length===1);
    check('stackable quantity sums across grants',ration&&ration.quantity===3);

    // 5. Round-2 correction #3: grantItem() has no gold parameter/effect at all — Gold is
    //    entirely the caller's responsibility, proven by confirming a grant call never touches it.
    const goldBefore=state.gold;
    grantItem({itemDefinitionId:'dev_smiths_whetstone',sourceType:'achievement',sourceRef:'ach-1',grantRef:'ach-1'});
    check('grantItem never mutates Gold',state.gold===goldBefore);
    check('grantItem result carries no gold field',!('gold' in grantItem({itemDefinitionId:'dev_smiths_whetstone',sourceType:'achievement',sourceRef:'ach-1',grantRef:'ach-1'})));

    // 6. Round-2 correction #1: an Achievement-style one-time grant using a stable grantRef
    //    (equal to sourceRef, since it only ever fires once) stays idempotent forever.
    const ach1=grantItem({itemDefinitionId:'dev_pinnacle_relic_shard',sourceType:'achievement',sourceRef:'ach-2',grantRef:'ach-2'});
    const ach2=grantItem({itemDefinitionId:'dev_pinnacle_relic_shard',sourceType:'achievement',sourceRef:'ach-2',grantRef:'ach-2'});
    check('stable one-time grantRef grants once',ach1.granted===true);
    check('stable one-time grantRef suppresses replay',ach2.granted===false);

    // 7. Equip/unequip is slot-agnostic and feeds statSources() via state.equipment.statModifiers.
    const swordOwnedId=ensureInventoryState().ownedItems.find(o=>o.itemDefinitionId==='dev_iron_sword').id;
    equipItem(swordOwnedId);
    check('equip adds to equipped[]',ensureEquipmentState().equipped.includes(swordOwnedId));
    check('equip aggregates statModifiers',ensureEquipmentState().statModifiers.damage===2);
    unequipItem(swordOwnedId);
    check('unequip removes from equipped[]',!ensureEquipmentState().equipped.includes(swordOwnedId));
    check('unequip clears statModifiers',!ensureEquipmentState().statModifiers.damage);

    // 8. Round-2 correction #2: statModifiers is a rebuildable cache, not independent truth --
    //    corrupt it directly, then prove refreshEquipmentStatModifiers() derives the correct
    //    value from equipped[] regardless of whatever the cache previously held.
    equipItem(swordOwnedId);
    ensureEquipmentState().statModifiers={damage:999,thisFieldShouldNeverPersist:true};
    const rebuilt=refreshEquipmentStatModifiers();
    check('corrupted cache is fully discarded on rebuild',rebuilt.damage===2&&!('thisFieldShouldNeverPersist' in rebuilt));
    check('rebuild replaces (not merges into) the stored cache',ensureEquipmentState().statModifiers.damage===2&&!('thisFieldShouldNeverPersist' in ensureEquipmentState().statModifiers));
    unequipItem(swordOwnedId);

    // 9. Unknown item definition and missing source/grantRef are all rejected cleanly, not thrown.
    check('unknown item definition rejected',grantItem({itemDefinitionId:'does_not_exist',sourceType:'test',sourceRef:'x',grantRef:'x'}).granted===false);
    check('missing grantRef rejected',grantItem({itemDefinitionId:'dev_iron_sword',sourceType:'test',sourceRef:'x'}).granted===false);
    check('missing source rejected',grantItem({itemDefinitionId:'dev_iron_sword',grantRef:'x'}).granted===false);

    // 10. devSeedInventory() is itself idempotent (Lyra control #3's other half: safe to run more than once).
    state.inventory={version:1,ownedItems:[],grantLedger:{}};
    devSeedInventory();
    const afterFirstSeed=ensureInventoryState().ownedItems.length;
    devSeedInventory();
    check('devSeedInventory is idempotent',ensureInventoryState().ownedItems.length===afterFirstSeed);
  } finally {
    state.inventory=savedInv;state.equipment=savedEq;state.gold=savedGold;window.save=savedSave;
  }
  const failed=results.filter(r=>!r.pass);
  return {pass:failed.length===0,total:results.length,failed:failed.map(f=>f.label),results};
}

/* Round-2 correction #2, applied at load time: state.equipment.statModifiers
   is a cache, so a value restored from a previous session's localStorage
   is never trusted on faith — it's rebuilt from the real source of truth
   (equipped[] + item definitions) the moment this file runs, before
   anything (Character's stat pipeline included) has a chance to read a
   stale persisted value. */
refreshEquipmentStatModifiers();
