/* Economy / Store / Loot — Phase A configuration (Astra, 2026-09-25, RPG-0093).
   Authority: Lyra's Master Build Phase A handover (shared architecture,
   sequencing) + Assay's economy package (numbers, seed templates). Every
   TUNABLE VALUE lives in this one file and nowhere else -- rates,
   prices, odds, pity thresholds, caps, unlock levels, stall listings,
   and the three open-decision flags Jay has not frozen yet (clawback,
   buff-duration model, where selling lives). Changing a number here
   changes the whole economy; nothing else in the app hard-codes one.

   What is NOT here on purpose (Phase A hard boundaries):
     - Gold earning rates (Effort Units / resources / achievement
       mapping) -- Phase B, waits for Scales G3.
     - Any equipment that is APPROVED production content. Assay's
       equipment registry has not shipped; the per-slot Common/Uncommon
       templates below are DEV FIXTURES (status 'DEV_FIXTURE'): they are
       never in a real Store/chest pool. A console-only, non-persisted
       switch (economyDevFixturesEnabled) lets QA populate the Armoury
       with them; it is deliberately not part of the save so it can never
       leak onto a real phone. */

const ECONOMY_VERSION='assay-v1';

const ECONOMY_CONFIG={
  version:ECONOMY_VERSION,
  currencies:['GOLD'],
  /* Open decision #4 (Assay §10): clawback. Default ON = a negative
     balance is allowed (only via an ADJUST entry) and blocks purchases
     while it lasts. Set enabled:false to make a clawback clamp at 0
     instead. Kept switchable until Jay freezes it. */
  clawback:{enabled:true},
  /* Open decision #3: buff durations count real time (proposed). Only the
     'realtime' model is implemented; 'campaign-km' is reserved. */
  buffs:{durationModel:'realtime',oneActivePerStat:true},
  /* Open decision #7: selling lives in the Store's Sell tab with a Storage
     shortcut (proposed). 'store' = the one service path. */
  selling:{location:'store',ratePct:25,buyback:{count:5,sameDayOnly:true}},
  /* Confirmation dialog: purchases at/above this price, any Epic-or-higher
     item, and any chest. */
  confirm:{minGold:100,minRarity:'epic',chests:true},
  /* Gear stat cap (Assay §6.4): the flat bonus gear can add to one Base
     Stat is floor(base + perBase * BaseStat). */
  gearCap:{flat:5,perBase:0.2},
  /* Shop level bracket = max(min, floor(Level/step)*step). */
  bracket:{step:5,min:1},
  stack:{defaultMax:99},
  /* Loot / purchases must not touch Character progression -- a single
     source of truth for the regression checks in the acceptance suite. */
  forbiddenSideEffects:['xp','baseStats','classUnlockCredit','achievementProgress']
};

/* Rarity ladder (Assay §5). Mythic is the top and is NEVER random. */
const ECONOMY_RARITIES=['common','uncommon','rare','epic','legendary','celestial','mythic'];
const ECONOMY_RARITY_LABEL={common:'Common',uncommon:'Uncommon',rare:'Rare',epic:'Epic',legendary:'Legendary',celestial:'Celestial',mythic:'Mythic'};
const ECONOMY_RARITY_POWER={common:1.0,uncommon:1.15,rare:1.30,epic:1.45,legendary:1.60,celestial:1.75,mythic:1.90};
const ECONOMY_RARITY_RANDOM_ELIGIBLE=['common','uncommon','rare','epic','legendary','celestial'];

/* The nine functional equipment slots (Lyra §3.3). The Cosmetic layer is
   separate and carries no power. ACCESSORY is the ItemDefinition-level
   slot; it resolves to ACCESSORY_1 or ACCESSORY_2 at equip time. */
const EQUIPMENT_SLOTS=['WEAPON','OFFHAND','HEAD','CHEST','HANDS','LEGS','FEET','ACCESSORY_1','ACCESSORY_2'];
const EQUIPMENT_SLOT_LABEL={WEAPON:'Weapon',OFFHAND:'Off-hand',HEAD:'Head',CHEST:'Chest',HANDS:'Hands',LEGS:'Legs',FEET:'Feet',ACCESSORY_1:'Accessory 1',ACCESSORY_2:'Accessory 2'};
const EQUIPMENT_DEF_SLOTS=['WEAPON','OFFHAND','HEAD','CHEST','HANDS','LEGS','FEET','ACCESSORY'];
const ECONOMY_STATS=['str','dex','con','int','wis','cha'];

/* ------------------------------------------------------------------ */
/* Seed consumables / supplies / containers (Assay §4.6, APPROVED)     */
/* ------------------------------------------------------------------ */

/* Registry rows in the SAME shape as ITEM_DEFINITIONS_BUILTIN (key `id`,
   lowercase rarity, `kind`, `statModifiers`) plus Assay's additive fields
   (itemId alias, slot, itemLevel, consumable, maxStack, sources,
   priceGold, sellGold, balanceVersion, status). No second registry: these
   are concatenated into allItemDefinitions() by v0.02.36-inventory.js. */
const ECONOMY_HP_TIERS=[
  {key:'MINOR',    tier:'Minor',    rarity:'common',   pct:25, price:6,   sell:1, status:'APPROVED', sources:['SHOP']},
  {key:'',         tier:'',         rarity:'uncommon', pct:40, price:12,  sell:3, status:'APPROVED', sources:['SHOP']},
  {key:'GREATER',  tier:'Greater',  rarity:'rare',     pct:60, price:25,  sell:6, status:'APPROVED', sources:['SHOP']},
  {key:'SUPERIOR', tier:'Superior', rarity:'epic',     pct:100,price:null,sell:12,status:'APPROVED', sources:['CHEST']}
];
const ECONOMY_BUFF_TIERS=[
  {key:'COM',rarity:'common',  pct:10,minFlat:2,durationMin:240, price:12,sell:3, label:'Common'},
  {key:'UNC',rarity:'uncommon',pct:15,minFlat:3,durationMin:480, price:30,sell:7, label:'Uncommon'},
  {key:'RAR',rarity:'rare',    pct:20,minFlat:4,durationMin:1440,price:70,sell:17,label:'Rare'}
];
const ECONOMY_STAT_LONG={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};

function economyBuildSeedDefinitions(){
  const out=[];
  const common={stackable:true,maxStack:99,equippable:false,secret:false,statModifiers:{},slot:null,itemLevel:null,levelRequirement:1,scalingStat:null,implicit:{damage:0,defence:0},affixes:[],bind:'NONE',cosmeticOnly:false,balanceVersion:ECONOMY_VERSION,designedBy:'Assay (seed)'};
  out.push({...common,id:'ITM-SUP-RATION',itemId:'ITM-SUP-RATION',name:'Travel Ration',kind:'supply',assayCategory:'SUPPLY',rarity:'common',category:'Supply',
    consumable:{effectId:'CAMP_RATION',note:'Consumed at camps (Phase C)'},sources:['SHOP'],priceGold:3,sellGold:0,status:'APPROVED',description:'Food for the road. Consumed at each camp, one per party member.'});
  ECONOMY_HP_TIERS.forEach(t=>{
    const nm=t.tier?`${t.tier} `:'';
    out.push({...common,id:`ITM-CON-HP${t.key?'-'+t.key:''}`,itemId:`ITM-CON-HP${t.key?'-'+t.key:''}`,name:`${nm}Health Potion`,kind:'consumable',assayCategory:'CONSUMABLE',rarity:t.rarity,category:'Potion',
      consumable:{effectId:'RESTORE_HP_PCT',pct:t.pct},sources:t.sources,priceGold:t.price,sellGold:t.sell,status:t.status,description:`Restores ${t.pct}% of maximum HP.`});
    out.push({...common,id:`ITM-CON-ST${t.key?'-'+t.key:''}`,itemId:`ITM-CON-ST${t.key?'-'+t.key:''}`,name:`${nm}Stamina Potion`,kind:'consumable',assayCategory:'CONSUMABLE',rarity:t.rarity,category:'Potion',
      consumable:{effectId:'RESTORE_STAMINA_PCT',pct:t.pct},sources:t.sources,priceGold:t.price,sellGold:t.sell,status:t.status,description:`Restores ${t.pct}% of maximum Stamina.`});
  });
  ECONOMY_STATS.forEach(stat=>{
    const S=stat.toUpperCase();
    ECONOMY_BUFF_TIERS.forEach(t=>{
      const hours=t.durationMin/60;
      out.push({...common,id:`ITM-CON-BUFF-${S}-${t.key}`,itemId:`ITM-CON-BUFF-${S}-${t.key}`,name:`${t.label} ${ECONOMY_STAT_LONG[stat]} Elixir`,kind:'consumable',assayCategory:'CONSUMABLE',rarity:t.rarity,category:'Elixir',
        consumable:{effectId:'BUFF_STAT_PCT',stat:S,pct:t.pct,minFlat:t.minFlat,durationMin:t.durationMin},sources:['SHOP'],priceGold:t.price,sellGold:t.sell,status:'APPROVED',
        description:`+${t.pct}% of your Base ${S} (minimum +${t.minFlat}) for ${hours} hour${hours===1?'':'s'}. One elixir per stat; a new one replaces the old.`});
    });
  });
  /* Containers (Assay §8). Working names -- Lyra names and themes them.
     Traveller's / Adventurer's are sold in the Treasury; Heroic is earned
     only (priceGold:null, sources exclude SHOP). */
  [{id:'ITM-BOX-TRAVELLER',chestId:'CHEST-TRAVELLER',name:"Traveller's Chest",rarity:'common',price:60,sell:15,sources:['SHOP']},
   {id:'ITM-BOX-ADVENTURER',chestId:'CHEST-ADVENTURER',name:"Adventurer's Chest",rarity:'uncommon',price:220,sell:55,sources:['SHOP']},
   {id:'ITM-BOX-HEROIC',chestId:'CHEST-HEROIC',name:'Heroic Chest',rarity:'rare',price:null,sell:0,sources:['EARNED']}
  ].forEach(c=>out.push({...common,id:c.id,itemId:c.id,name:c.name,kind:'container',assayCategory:'CONTAINER',rarity:c.rarity,category:'Chest',
    consumable:null,container:{chestId:c.chestId},sources:c.sources,priceGold:c.price,sellGold:c.sell,status:'APPROVED',description:'Open it from Storage to reveal one item. Odds and pity are shown before you open.'}));
  return out;
}
const ECONOMY_SEED_DEFS=economyBuildSeedDefinitions();

/* ------------------------------------------------------------------ */
/* DEV FIXTURE equipment (Assay §4.6 test table) -- NEVER production   */
/* ------------------------------------------------------------------ */

/* One Common + one Uncommon per slot type at ilvl 1 and ilvl 10, values
   straight from Assay's table. Prices 30x / 90x (1+ilvl/100), rounded to
   the nearest 5; sell = floor(25%). status 'DEV_FIXTURE' keeps them out
   of every pool unless economyDevFixturesEnabled() is switched on for a
   test session. Ids carry the DEV- prefix so a stray one is unmistakable
   in a save. */
function economyBuildDevEquipment(){
  const rows=[];
  const SLOT_NAME={WEAPON:'Test Blade',OFFHAND:'Test Shield',HEAD:'Test Helm',CHEST:'Test Cuirass',HANDS:'Test Gloves',LEGS:'Test Greaves',FEET:'Test Boots',ACCESSORY:'Test Charm'};
  const DMG={C1:6,U1:7,C10:10,U10:11},CHEST_DEF={C1:2,U1:2,C10:4,U10:4},PIECE_DEF={C1:1,U1:2,C10:3,U10:3},OFF_DEF={C1:2,U1:2,C10:3,U10:4};
  const r5=n=>Math.round(n/5)*5;
  [1,10].forEach(ilvl=>['common','uncommon'].forEach(rarity=>{
    const code=(rarity==='common'?'C':'U')+ilvl;
    const base=rarity==='common'?30:90;
    const price=r5(base*(1+ilvl/100));
    EQUIPMENT_DEF_SLOTS.forEach(slot=>{
      const implicit={damage:0,defence:0},affixes=[];
      let scalingStat=null;
      if(slot==='WEAPON'){implicit.damage=DMG[code];scalingStat='STR';affixes.push({effectId:'STAT_FLAT',stat:'STR',value:1})}
      else if(slot==='CHEST')implicit.defence=CHEST_DEF[code];
      else if(slot==='OFFHAND')implicit.defence=OFF_DEF[code];
      else if(slot==='ACCESSORY'){scalingStat='WIS';affixes.push({effectId:'STAT_FLAT',stat:'WIS',value:1})}
      else implicit.defence=PIECE_DEF[code];
      if(code==='U10'&&(slot==='WEAPON'||slot==='ACCESSORY'))affixes.push({effectId:'STAT_FLAT',stat:'CON',value:1});
      const id=`DEV-EQ-${slot}-${code}`;
      rows.push({id,itemId:id,name:`${SLOT_NAME[slot]} (${rarity==='common'?'Common':'Uncommon'} i${ilvl})`,kind:'gear',assayCategory:'EQUIPMENT',rarity,category:SLOT_NAME[slot],
        stackable:false,maxStack:1,equippable:true,secret:false,statModifiers:{},slot,itemLevel:ilvl,levelRequirement:ilvl,scalingStat,implicit,affixes,consumable:null,bind:'NONE',
        sources:['DEV_FIXTURE'],priceGold:price,sellGold:Math.floor(price*0.25),cosmeticOnly:false,balanceVersion:ECONOMY_VERSION,designedBy:'Assay (dev fixture)',status:'DEV_FIXTURE',
        description:'Development fixture. Not production content.'});
    });
  }));
  return rows;
}
const ECONOMY_DEV_EQUIPMENT_DEFS=economyBuildDevEquipment();

/* ------------------------------------------------------------------ */
/* BASIC GEAR (Jay 2026-09-25: "make some basic equipment") -- REAL     */
/* ------------------------------------------------------------------ */

/* One plain Common, item-level-1 piece per slot type so the Equipment page
   has something real to equip. NO new numbers are invented: every value is
   Assay's own ilvl-1 Common row from the equipment table above (Weapon
   Damage 6 + STR 1; Chest Defence 2; Offhand Defence 2; Head/Hands/Legs/
   Feet Defence 1; Accessory WIS 1), priced by the same 30x rule (30 gold,
   sells for 7). They are sold in the Armoury as FIXED listings so they are
   always available from Level 3, whatever the level bracket, and are kept
   OUT of the bracket rotations and the chest pools (`basicGear:true`) so
   they change no existing drop table or odds. They are gear only: no XP, no
   Base Stat, no class semantics. Names are working names for Lyra/Aurelia. */
const BASIC_GEAR_NAMES={WEAPON:"Traveller's Blade",OFFHAND:"Wayfarer's Buckler",HEAD:"Traveller's Cap",CHEST:"Traveller's Jerkin",HANDS:"Traveller's Gloves",LEGS:"Traveller's Leggings",FEET:"Traveller's Boots",ACCESSORY:"Wayfarer's Charm"};
function economyBuildBasicGear(){
  const DMG={WEAPON:6},DEF={CHEST:2,OFFHAND:2,HEAD:1,HANDS:1,LEGS:1,FEET:1};
  return EQUIPMENT_DEF_SLOTS.map(slot=>{
    const implicit={damage:DMG[slot]||0,defence:DEF[slot]||0},affixes=[];
    let scalingStat=null;
    if(slot==='WEAPON'){scalingStat='STR';affixes.push({effectId:'STAT_FLAT',stat:'STR',value:1})}
    if(slot==='ACCESSORY'){scalingStat='WIS';affixes.push({effectId:'STAT_FLAT',stat:'WIS',value:1})}
    const id=`ITM-EQ-BASIC-${slot}`;
    return {id,itemId:id,name:BASIC_GEAR_NAMES[slot],kind:'gear',assayCategory:'EQUIPMENT',rarity:'common',category:BASIC_GEAR_NAMES[slot].split(' ').pop(),
      stackable:false,maxStack:1,equippable:true,secret:false,statModifiers:{},slot,itemLevel:1,levelRequirement:1,scalingStat,implicit,affixes,consumable:null,bind:'NONE',
      sources:['SHOP'],priceGold:30,sellGold:7,cosmeticOnly:false,basicGear:true,balanceVersion:ECONOMY_VERSION,designedBy:'Assay table, ilvl 1 Common',status:'APPROVED',
      description:'Plain, dependable gear for a new adventurer.'};
  });
}
const ECONOMY_BASIC_GEAR_DEFS=economyBuildBasicGear();

/* Console-only, NON-persisted switch. Never written to state. */
let __economyDevFixtures=false;
function economyDevFixturesEnabled(){return __economyDevFixtures}
function economyDevEnableFixtures(on){__economyDevFixtures=Boolean(on);return __economyDevFixtures}

/* ------------------------------------------------------------------ */
/* Store catalogue (Assay §10.4) -- stalls and listings are data       */
/* ------------------------------------------------------------------ */

/* `unlock.minLevel` gates a stall on Character Level. Locked stalls are
   still SHOWN (with their unlock level) so players know what's coming;
   only the cosmetics stall is hidden until a cosmetic system exists, so
   it is simply not listed here. `ROTATION_*` listings are resolved by the
   seeded rotation engine in v0.02.47-economy-core.js; `pool` filters the
   registry to eligible (APPROVED) definitions. */
const STORE_STALLS=[
  {stallId:'STALL-PROVISIONS',label:'Provisions',blurb:'Expedition supplies.',unlock:{minLevel:1},
    listings:[{itemId:'ITM-SUP-RATION',stock:'UNLIMITED'}]},
  {stallId:'STALL-APOTHECARY',label:'Apothecary',blurb:'Potions and elixirs.',unlock:{minLevel:1},
    listings:[
      {itemId:'ITM-CON-HP-MINOR',stock:'UNLIMITED'},{itemId:'ITM-CON-HP',stock:'UNLIMITED'},{itemId:'ITM-CON-HP-GREATER',stock:'UNLIMITED'},
      {itemId:'ITM-CON-ST-MINOR',stock:'UNLIMITED'},{itemId:'ITM-CON-ST',stock:'UNLIMITED'},{itemId:'ITM-CON-ST-GREATER',stock:'UNLIMITED'},
      ...['COM','UNC','RAR'].flatMap(tier=>ECONOMY_STATS.map(s=>({itemId:`ITM-CON-BUFF-${s.toUpperCase()}-${tier}`,stock:'UNLIMITED'})))
    ]},
  {stallId:'STALL-ARMOURY',label:'Armoury',blurb:'Equipment for your level bracket.',unlock:{minLevel:3},
    listings:[
      ...EQUIPMENT_DEF_SLOTS.map(slot=>({itemId:`ITM-EQ-BASIC-${slot}`,stock:'UNLIMITED'})),
      {rule:'BRACKET_ALL',pool:'EQUIPMENT',rarities:['common','uncommon']},
      {rule:'ROTATION_DAILY',pool:'EQUIPMENT',rarity:'rare',count:4,ilvl:'PLAYER_BRACKET'}
    ]},
  {stallId:'STALL-TREASURY',label:'Treasury',blurb:'Chests with the odds on the lid.',unlock:{minLevel:5},
    listings:[{itemId:'ITM-BOX-TRAVELLER',stock:'UNLIMITED'},{itemId:'ITM-BOX-ADVENTURER',stock:'UNLIMITED'}]},
  {stallId:'STALL-FEATURED',label:'Featured',blurb:'This week only.',unlock:{minLevel:10},
    listings:[
      {rule:'ROTATION_WEEKLY',pool:'EQUIPMENT',rarity:'epic',count:1,ilvl:'PLAYER_BRACKET'},
      {rule:'ROTATION_WEEKLY',pool:'EQUIPMENT',rarity:'rare',count:3,ilvl:'PLAYER_BRACKET'}
    ]},
  {stallId:'STALL-SELL',label:'Sell',blurb:'Sell from Storage. Buy back today’s sales.',unlock:{minLevel:1},service:'SELL',listings:[]},
  {stallId:'STALL-ORIN',label:'Orin',blurb:'Hints for your active campaigns.',unlock:{phase:'D'},service:'LATER',listings:[]}
];

/* ------------------------------------------------------------------ */
/* Chests (Assay §8) -- odds are C/U/R/E/L/Cel, always shown           */
/* ------------------------------------------------------------------ */

const CHEST_CONFIG={
  'CHEST-TRAVELLER':{chestId:'CHEST-TRAVELLER',itemId:'ITM-BOX-TRAVELLER',label:"Traveller's Chest",priceGold:60,odds:{common:62,uncommon:28,rare:9,epic:1,legendary:0,celestial:0},pity:null,earnedOnly:false},
  'CHEST-ADVENTURER':{chestId:'CHEST-ADVENTURER',itemId:'ITM-BOX-ADVENTURER',label:"Adventurer's Chest",priceGold:220,odds:{common:0,uncommon:55,rare:33,epic:10,legendary:2,celestial:0},
    pity:{epic:{tier:'epic',withinOpens:10},legendary:{tier:'legendary',withinOpens:50}},earnedOnly:false},
  'CHEST-HEROIC':{chestId:'CHEST-HEROIC',itemId:'ITM-BOX-HEROIC',label:'Heroic Chest',priceGold:null,odds:{common:0,uncommon:0,rare:55,epic:33,legendary:10,celestial:2},
    pity:{legendary:{tier:'legendary',withinOpens:8}},earnedOnly:true}
};

/* Assay §4.4/§6.4 helper used by both the engine and the UI. */
function economyRarityIndex(r){return ECONOMY_RARITIES.indexOf(String(r||'common').toLowerCase())}
