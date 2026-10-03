/* Economy core — Gold ledger, atomic transactions, RewardEnvelope/Loot claim
   contract, Store services, chest/pity engine (Master Build Phase A, A1;
   Astra, 2026-09-25, RPG-0093). No UI in this file: the Store/Loot/chest
   screens live in v0.02.48-economy-ui.js and only ever call the functions
   below, so there is exactly one path for every money/item mutation.

   Authority: Lyra's Phase A handover (architecture) + Assay's package
   (numbers -> v0.02.46-economy-config.js). Load order: config, inventory
   (registry/OwnedItem/equipment), inventory-ui, THIS file, economy-ui.

   Hard boundaries kept here (Lyra §1/§12/§13):
     - nothing in this file touches XP, Stat XP, Base Stats, class-unlock
       credit or achievement progress -- economyProgressionSnapshot() +
       the acceptance suite prove it;
     - Gold changes ONLY through goldPost() (every call = one ledger
       transaction, idempotent by key); state.gold is a derived read-mirror;
     - purchases / claims / sells / chest opens are all wrapped in
       economyTransaction(): validate -> mutate in memory with inner saves
       suppressed -> one save(), or restore the snapshot and persist nothing;
     - no Phase B earning rules, no demo-gold removal, no campaign loot. */

/* ------------------------------------------------------------------ */
/* 0. Small pure helpers                                               */
/* ------------------------------------------------------------------ */

/* xmur3 string hash + mulberry32 PRNG: deterministic from a seed string,
   so a rotation/chest result is a pure function of (playerId, date|chest). */
function economyHash(str){
  let h=1779033703^str.length;
  for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19)}
  h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);
  return (h^(h>>>16))>>>0;
}
function economyRng(seedStr){
  let a=economyHash(String(seedStr))>>>0;
  return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296};
}
function economyRoundGold(n){return Math.round(Number(n||0)*100)/100}
/* ISO-8601 week key for a local YYYY-MM-DD, e.g. 2026-W39. */
function economyIsoWeekKey(iso){
  const d=dateFromISO(iso);
  const day=(d.getDay()+6)%7;                 /* Mon=0 */
  d.setDate(d.getDate()-day+3);               /* Thursday of this week */
  const jan4=new Date(d.getFullYear(),0,4,12,0,0);
  const week=1+Math.round(((d-jan4)/86400000-3+((jan4.getDay()+6)%7))/7);
  return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
}
function economyBracket(level){
  const b=ECONOMY_CONFIG.bracket;
  return Math.max(b.min,Math.floor(Number(level||1)/b.step)*b.step);
}
function economyNowISO(){return new Date().toISOString()}
function economyNewId(prefix){return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random()*1e6).toString(36)}`}

/* ------------------------------------------------------------------ */
/* 1. Save gate + atomic transaction                                   */
/* ------------------------------------------------------------------ */

let __economyBatchDepth=0;
function economyBatchActive(){return __economyBatchDepth>0}

/* Everything a purchase / claim / sell / chest-open can mutate. The Gold
   ledger is append-only inside a transaction, so its rollback is a
   truncate (no clone of a possibly-large array). */
function economySnapshot(){
  const e=ensureEconomyState(),eq=ensureEquipmentState();
  const {ledger,...economyRest}=e;
  return {
    ledgerLen:ledger.length,
    economy:JSON.stringify(economyRest),
    wallet:JSON.stringify(state.wallet),
    gold:state.gold,
    pendingRewards:JSON.stringify(state.pendingRewards),
    inventory:JSON.stringify(state.inventory),
    equipment:JSON.stringify({slots:eq.slots,cosmetics:eq.cosmetics,statModifiers:eq.statModifiers})
  };
}
function economyRestore(snap){
  const e=ensureEconomyState();
  const ledger=e.ledger;
  ledger.length=snap.ledgerLen;
  state.economy=Object.assign(JSON.parse(snap.economy),{ledger});
  state.wallet=JSON.parse(snap.wallet);
  state.gold=snap.gold;
  state.pendingRewards=JSON.parse(snap.pendingRewards);
  state.inventory=JSON.parse(snap.inventory);
  const eq=ensureEquipmentState(),saved=JSON.parse(snap.equipment);
  eq.slots=saved.slots;eq.cosmetics=saved.cosmetics;eq.statModifiers=saved.statModifiers;
  __economyLedgerKeyCache=null;
}
/* fn returns {ok:true,...} to commit or {ok:false,reason} to roll back.
   A throw also rolls back. The single save() happens only at depth 0, and
   if that save itself fails (e.g. storage quota) the in-memory state is
   restored too, so memory never runs ahead of what was persisted. */
function economyTransaction(fn){
  const snap=economySnapshot();
  __economyBatchDepth++;
  let result;
  try{result=fn()}
  catch(err){
    __economyBatchDepth--;
    economyRestore(snap);
    console.error('[Economy] transaction rolled back:',err);
    return {ok:false,reason:'exception',error:String(err&&err.message||err)};
  }
  __economyBatchDepth--;
  if(!result||result.ok===false){economyRestore(snap);return result||{ok:false,reason:'failed'}}
  if(__economyBatchDepth===0){
    try{save()}
    catch(err){economyRestore(snap);console.error('[Economy] save failed, rolled back:',err);return {ok:false,reason:'save-failed',error:String(err&&err.message||err)}}
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* 2. Economy state + Gold ledger + wallet                             */
/* ------------------------------------------------------------------ */

/* state.wallet.gold  = cached balance, MUST equal the ledger sum.
   state.economy.ledger = the append-only transaction list (truth).
   state.gold         = derived read-mirror for legacy readers; written in
                        exactly one place (goldWriteBalance below).
   New saves and existing saves both get ONE opening MIGRATION entry equal
   to whatever Gold they already had, so the ledger explains the balance
   without changing it (demo-gold removal / fresh-save 100g is Phase B). */
function ensureEconomyState(){
  if(!state.economy||typeof state.economy!=='object'||Array.isArray(state.economy))state.economy={};
  const e=state.economy;
  e.version=1;
  if(!e.playerId||typeof e.playerId!=='string')e.playerId='P'+economyHash(navigator.userAgent+Date.now()+Math.random()).toString(36)+Math.floor(Math.random()*1e9).toString(36);
  if(!Array.isArray(e.ledger))e.ledger=[];
  if(!e.pity||typeof e.pity!=='object'||Array.isArray(e.pity))e.pity={};
  if(!e.rotations||typeof e.rotations!=='object'||Array.isArray(e.rotations))e.rotations={};
  if(!Array.isArray(e.buyback))e.buyback=[];
  if(!Array.isArray(e.openings))e.openings=[];
  if(!e.buffs||typeof e.buffs!=='object'||Array.isArray(e.buffs))e.buffs={};
  if(!Array.isArray(e.priceOverrideLog))e.priceOverrideLog=[];
  if(!state.wallet||typeof state.wallet!=='object'||Array.isArray(state.wallet))state.wallet={gold:0};
  if(!Array.isArray(state.pendingRewards))state.pendingRewards=[];
  if(!e.ledger.length&&!e.openingDone){
    const start=economyRoundGold(state.gold);
    e.openingDone=true;/* set BEFORE posting: goldPost() re-enters ensureEconomyState() */
    state.wallet.gold=0;
    if(start>0)goldPost({kind:'EARN',amount:start,source:'MIGRATION',refId:'opening-balance',idempotencyKey:'MIG:OPENING',note:'Opening balance carried over unchanged (Phase A).'});
    goldWriteBalance(state.wallet.gold);
  }
  return e;
}
function goldWriteBalance(v){
  state.wallet.gold=economyRoundGold(v);
  state.gold=state.wallet.gold;/* the ONLY write of the legacy mirror */
}
/* A read-mirror that no longer equals the wallet means some non-ledger code
   wrote state.gold directly. Absorb the difference as an explicit ADJUST so
   the ledger still explains the balance instead of silently overwriting it. */
function economyAbsorbLegacyGoldWrite(){
  const e=state.economy;
  if(!e||!Array.isArray(e.ledger)||!e.ledger.length||__economyAbsorbing)return;
  const legacy=economyRoundGold(state.gold),wallet=economyRoundGold(state.wallet.gold);
  if(legacy===wallet||!Number.isFinite(legacy))return;
  __economyAbsorbing=true;
  try{goldPost({kind:'ADJUST',amount:economyRoundGold(legacy-wallet),source:'MIGRATION',refId:'legacy-direct-write',idempotencyKey:economyNewId('MIG:LEGACY'),note:'state.gold was written outside the ledger; absorbed as an adjustment.'})}
  finally{__economyAbsorbing=false}
}
let __economyAbsorbing=false;
let __economyLedgerKeyCache=null;
function economyLedgerKeySet(){
  const e=ensureEconomyState();
  const c=__economyLedgerKeyCache;
  if(!c||c.ref!==e.ledger||c.n!==e.ledger.length)__economyLedgerKeyCache={ref:e.ledger,n:e.ledger.length,keys:new Set(e.ledger.map(t=>t.idempotencyKey))};
  return __economyLedgerKeyCache.keys;
}
function goldLedgerHasKey(key){return economyLedgerKeySet().has(key)}
function goldBalance(){ensureEconomyState();economyAbsorbLegacyGoldWrite();return Number(state.wallet.gold||0)}
function goldDeficit(){return ECONOMY_CONFIG.clawback.enabled&&goldBalance()<0}

/* THE only place Gold changes. amount is SIGNED (EARN/REFUND >0, SPEND <0,
   ADJUST either). A repeated idempotencyKey is ignored (returns the
   original transaction, duplicate:true). A SPEND that the balance cannot
   cover, or any non-ADJUST entry that would end below zero, is rejected and
   writes nothing. */
function goldPost({kind,amount,source,refId=null,idempotencyKey,note=null,at=null}={}){
  const e=ensureEconomyState();
  if(!idempotencyKey||typeof idempotencyKey!=='string')return {ok:false,reason:'missing-idempotency-key'};
  if(!['EARN','SPEND','ADJUST','REFUND'].includes(kind))return {ok:false,reason:'bad-kind'};
  let amt=economyRoundGold(amount);
  if(!Number.isFinite(amt)||amt===0)return {ok:false,reason:'bad-amount'};
  if((kind==='EARN'||kind==='REFUND')&&amt<0)return {ok:false,reason:'bad-amount'};
  if(kind==='SPEND'&&amt>0)amt=-amt;
  const existing=economyLedgerKeySet().has(idempotencyKey)?e.ledger.find(t=>t.idempotencyKey===idempotencyKey):null;
  if(existing)return {ok:true,duplicate:true,tx:existing};
  const before=economyRoundGold(state.wallet.gold);
  if(kind==='SPEND'){
    if(before<0&&ECONOMY_CONFIG.clawback.enabled)return {ok:false,reason:'deficit'};
    if(before+amt<0)return {ok:false,reason:'insufficient'};
  }
  if(kind==='ADJUST'&&!ECONOMY_CONFIG.clawback.enabled&&before+amt<0)amt=economyRoundGold(-before);/* clamp-at-0 mode */
  if(amt===0)return {ok:false,reason:'bad-amount'};
  const balanceAfter=economyRoundGold(before+amt);
  if(balanceAfter<0&&kind!=='ADJUST')return {ok:false,reason:'negative-balance'};
  const tx={txId:economyNewId('tx'),currencyId:'GOLD',amount:amt,balanceAfter,kind,source:String(source||'UNKNOWN'),refId:refId==null?null:String(refId),idempotencyKey,economyVersion:ECONOMY_VERSION,at:at||economyNowISO()};
  if(note)tx.note=note;
  e.ledger.push(tx);
  goldWriteBalance(balanceAfter);
  invSave();
  return {ok:true,tx};
}
function goldEarn(amount,opts={}){return goldPost({kind:'EARN',amount:Math.abs(Number(amount)),...opts})}
function goldSpend(amount,opts={}){return goldPost({kind:'SPEND',amount:-Math.abs(Number(amount)),...opts})}
function goldAdjust(signedAmount,opts={}){return goldPost({kind:'ADJUST',amount:signedAmount,...opts})}
function goldRefund(amount,opts={}){return goldPost({kind:'REFUND',amount:Math.abs(Number(amount)),...opts})}

/* Debug / QA reconciliation (Lyra §5 "debug/rebuild check exists"). */
function economyReconcile(){
  const e=ensureEconomyState();
  const ledgerSum=economyRoundGold(e.ledger.reduce((n,t)=>n+Number(t.amount||0),0));
  const walletGold=economyRoundGold(state.wallet.gold),mirror=economyRoundGold(state.gold);
  const lastAfter=e.ledger.length?economyRoundGold(e.ledger[e.ledger.length-1].balanceAfter):0;
  return {ok:ledgerSum===walletGold&&walletGold===mirror&&lastAfter===ledgerSum,ledgerSum,walletGold,mirrorGold:mirror,lastBalanceAfter:lastAfter,txCount:e.ledger.length};
}
/* Rebuild the cached balance from the ledger (the ledger is truth). */
function economyRebuildWallet(){
  const e=ensureEconomyState();
  goldWriteBalance(e.ledger.reduce((n,t)=>n+Number(t.amount||0),0));
  invSave();
  return economyReconcile();
}
function economyGoldEarnedToday(){
  const e=ensureEconomyState(),today=todayISO();
  return economyRoundGold(e.ledger.filter(t=>t.amount>0&&t.source!=='MIGRATION'&&t.source!=='SELL'&&localISO(new Date(t.at))===today).reduce((n,t)=>n+t.amount,0));/* earnings only: not the opening balance, and not the proceeds of selling something you own */
}
function economyWalletView(){
  const gold=goldBalance();
  return {gold,deficit:ECONOMY_CONFIG.clawback.enabled&&gold<0,earnedToday:economyGoldEarnedToday(),deficitMessage:'Purchases paused until your balance is above 0.'};
}

/* ------------------------------------------------------------------ */
/* 3. Effective-stat contributions (read by Character's pipeline)       */
/* ------------------------------------------------------------------ */

/* Gear cap (Assay §6.4): flat gear bonus to one Base Stat is limited to
   floor(5 + 0.2 x Base). Base is READ-ONLY here. Non-stat keys
   (damage/defence) pass through uncapped. Never feeds Base progression. */
function economyGearCap(base){const c=ECONOMY_CONFIG.gearCap;return Math.floor(c.flat+c.perBase*Number(base||0))}
function economyGearFlatCapped(key){
  const raw=numericSourceValue(ensureEquipmentState().statModifiers,key);
  if(!ECONOMY_STATS.includes(key)||raw<=0)return raw;
  return Math.min(raw,economyGearCap(v023BaseStat(key)));
}
/* Active buff for a stat, as a flat amount at the CURRENT Base:
   max(minFlat, round(Base x pct / 100)). Expired buffs read as 0. */
function economyActiveBuff(key){
  const b=ensureEconomyState().buffs[key];
  if(!b)return null;
  if(Date.now()>=Number(b.expiresAt||0))return null;
  return b;
}
function economyBuffAmount(key){
  const b=economyActiveBuff(key);
  if(!b)return 0;
  return Math.max(Number(b.minFlat||0),Math.round(v023BaseStat(key)*Number(b.pct||0)/100));
}
function economyPruneExpiredBuffs(){
  const e=ensureEconomyState();let changed=false;
  Object.keys(e.buffs).forEach(k=>{if(Date.now()>=Number(e.buffs[k].expiresAt||0)){delete e.buffs[k];changed=true}});
  return changed;
}
/* A read-only proof snapshot of everything Phase A promises not to touch. */
function economyProgressionSnapshot(){
  const stats={};
  ECONOMY_STATS.forEach(k=>{const s=state.stats&&state.stats[k]||{};stats[k]={base:v023BaseStat(k),xp:Number(s.xp||0),score:Number(s.score||0)}});
  return JSON.stringify({xp:state.xp,level:state.level,stats,classSystem:state.classSystem,achievementEngine:state.achievementEngine?state.achievementEngine.unlockedAchievements:null,achievements:state.achievements,milestones:state.statMilestones||null});
}

/* ------------------------------------------------------------------ */
/* 4. RewardEnvelope / Loot contract                                   */
/* ------------------------------------------------------------------ */

/* Owning systems create an envelope ONCE; Loot only stores, presents and
   claims it (Lyra §4). state.pendingRewards holds unclaimed AND claimed
   envelopes (claimedAt marks history) -- the transitional name is kept on
   purpose (Lyra §2.2). Envelopes are never pruned in Phase A: the
   idempotency lookup needs them, and they are tiny. */
const REWARD_LEDGER_SOURCE={quest:'QUEST',achievement:'ACHIEVEMENT',campaign:'CAMPAIGN',weekly:'WEEKLY_CHEST'};
function rewardIdempotencyKey(sourceType,sourceRef,grantRef){return `RWD:${sourceType}:${sourceRef}:${grantRef}`}
function pendingRewardsList(){ensureEconomyState();return state.pendingRewards}
function unclaimedRewards(){return pendingRewardsList().filter(r=>!r.claimedAt)}
function unclaimedRewardCount(){return unclaimedRewards().length}
function claimedRewardHistory(){return pendingRewardsList().filter(r=>r.claimedAt).sort((a,b)=>String(b.claimedAt).localeCompare(String(a.claimedAt)))}
function createRewardEnvelope({sourceType,sourceRef,grantRef,gold=0,items=[],title='',ledgerKey=null,ledgerSource=null}={}){
  ensureEconomyState();
  if(!sourceType||!sourceRef||!grantRef)return {created:false,reason:'missing-source'};
  gold=economyRoundGold(gold);
  const cleanItems=(Array.isArray(items)?items:[]).map(it=>({itemDefinitionId:String(it.itemDefinitionId),quantity:Math.max(1,Math.floor(Number(it.quantity)||1))}));
  if(!(gold>0)&&!cleanItems.length)return {created:false,reason:'empty-reward'};
  if(cleanItems.some(it=>!itemDefinitionById(it.itemDefinitionId)))return {created:false,reason:'unknown-item-definition'};
  const key=rewardIdempotencyKey(sourceType,sourceRef,grantRef);
  const existing=state.pendingRewards.find(r=>r.idempotencyKey===key);
  if(existing)return {created:false,duplicate:true,envelope:existing};
  const env={
    rewardId:economyNewId('rwd'),sourceType,sourceRef:String(sourceRef),grantRef:String(grantRef),idempotencyKey:key,
    title:title||`${String(sourceType).charAt(0).toUpperCase()+String(sourceType).slice(1)} reward`,
    gold,items:cleanItems,createdAt:economyNowISO(),claimedAt:null
  };
  if(ledgerKey)env.ledgerKey=ledgerKey;
  if(ledgerSource)env.ledgerSource=ledgerSource;
  state.pendingRewards.push(env);
  invSave();
  return {created:true,envelope:env};
}
/* Atomic + idempotent. Gold -> ledger (its own idempotency key), items ->
   grantItem() with stable child grantRefs. The envelope is marked claimed
   only after every grant succeeded; any failure restores everything and
   leaves the reward unclaimed. Replaying a claim is a no-op. */
function claimReward(rewardId){
  ensureEconomyState();
  const env=state.pendingRewards.find(r=>r.rewardId===rewardId);
  if(!env)return {ok:false,reason:'not-found'};
  if(env.claimedAt)return {ok:true,duplicate:true,envelope:env};
  const res=economyTransaction(()=>{
    const goldKey=env.ledgerKey||`RWD:${env.idempotencyKey}`;
    if(env.gold>0){
      const g=goldPost({kind:'EARN',amount:env.gold,source:env.ledgerSource||REWARD_LEDGER_SOURCE[env.sourceType]||'REWARD',refId:env.sourceRef,idempotencyKey:goldKey});
      if(!g.ok)return {ok:false,reason:g.reason};
    }
    for(let i=0;i<env.items.length;i++){
      const it=env.items[i];
      const gi=grantItem({itemDefinitionId:it.itemDefinitionId,sourceType:env.sourceType,sourceRef:env.sourceRef,grantRef:`${env.grantRef}:${i}`,quantity:it.quantity});
      if(!gi.granted&&gi.reason!=='already-granted')return {ok:false,reason:gi.reason||'grant-failed'};
    }
    env.claimedAt=economyNowISO();
    return {ok:true,envelope:env};
  });
  return res;
}
/* Claim all = the SAME single-reward contract, once per envelope. */
function claimAllRewards(){
  const out={claimed:0,failed:0,results:[]};
  unclaimedRewards().slice().forEach(r=>{
    const res=claimReward(r.rewardId);
    out.results.push({rewardId:r.rewardId,...res});
    if(res.ok&&!res.duplicate)out.claimed++;else if(!res.ok)out.failed++;
  });
  return out;
}
/* Achievement hook (Lyra §8.1): an unlock creates its reward envelope once
   and NEVER pays. There is no achievement->Gold mapping in Phase A (that is
   Phase B), so today this is a no-op for every definition (lootReward is
   null everywhere); it exists so the contract is wired end-to-end. */
function economyOnAchievementUnlocked(def){
  if(!def||!def.lootReward||typeof def.lootReward!=='object')return null;
  const {gold=0,items=[]}=def.lootReward;
  const res=createRewardEnvelope({sourceType:'achievement',sourceRef:def.achievementId,grantRef:def.achievementId,gold,items,title:def.name,ledgerKey:`ACH:${def.achievementId}`});
  return res.envelope||null;
}

/* ------------------------------------------------------------------ */
/* 5. Store                                                            */
/* ------------------------------------------------------------------ */

function storeStall(stallId){return STORE_STALLS.find(s=>s.stallId===stallId)||null}
function storeStallUnlocked(stall){
  if(!stall||!stall.unlock)return false;
  if(stall.unlock.phase)return false;
  return Number(state.level||1)>=Number(stall.unlock.minLevel||1);
}
function storeStallLockLabel(stall){
  if(stall.unlock&&stall.unlock.phase)return 'Coming later';
  return `Unlocks at Level ${stall.unlock.minLevel}`;
}
function storeRarityRank(r){return Math.max(0,economyRarityIndex(r))}
/* Equipment pool for Store rotations/brackets. Only eligible (APPROVED, or
   DEV_FIXTURE while the dev switch is on) gear with a price. With the dev
   switch, a bracket with no exact-ilvl fixture falls back to the highest
   fixture ilvl at or below it; real APPROVED content never falls back. */
function storeEquipmentPool({rarities,bracket}){
  const eligible=allItemDefinitions().filter(d=>d.kind==='gear'&&!d.basicGear&&d.slot&&d.priceGold>0&&d.itemLevel!=null&&itemDefinitionPoolEligible(d)&&rarities.includes(d.rarity));
  const exact=eligible.filter(d=>d.itemLevel===bracket);
  if(exact.length||!(typeof economyDevFixturesEnabled==='function'&&economyDevFixturesEnabled()))return exact;
  const fixtures=eligible.filter(d=>d.status==='DEV_FIXTURE'&&d.itemLevel<=bracket);
  if(!fixtures.length)return [];
  const top=Math.max(...fixtures.map(d=>d.itemLevel));
  return fixtures.filter(d=>d.itemLevel===top);
}
/* The bracket is captured the first time a period's rotation is resolved
   and then kept: levelling up mid-day does not change today's stock. */
function storeRotationPeriod(kind,dateISO){return kind==='WEEKLY'?economyIsoWeekKey(dateISO):dateISO}
function storeRotationBracket(kind,stallId,period){
  const e=ensureEconomyState(),key=`${kind}|${stallId}|${period}`;
  if(!e.rotations[key]){
    e.rotations[key]={bracket:economyBracket(state.level)};
    const keys=Object.keys(e.rotations);
    if(keys.length>24)keys.slice(0,keys.length-24).forEach(k=>delete e.rotations[k]);
    invSave();
  }
  return e.rotations[key].bracket;
}
/* Seeded selection: a pure function of (playerId, period, stall, rarity).
   No refresh, no reroll. `pool` and `count` are inputs so tests can drive it
   with synthetic content. */
function storeSeededPick(pool,count,seedStr){
  const rng=economyRng(seedStr);
  const arr=pool.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}
  return arr.slice(0,Math.max(0,count));
}
function storeListingPrice(def,listing){
  if(listing&&listing.priceOverride!=null)return Number(listing.priceOverride);
  return def&&def.priceGold!=null?Number(def.priceGold):null;
}
/* Resolve a stall's config into concrete, priced listings for a date. */
function storeResolveListings(stallId,dateISO=todayISO()){
  const stall=storeStall(stallId);
  if(!stall)return [];
  const e=ensureEconomyState();
  const out=[];
  (stall.listings||[]).forEach((L,idx)=>{
    if(L.itemId){
      const def=itemDefinitionById(L.itemId);
      if(!itemDefinitionPoolEligible(def))return;
      const price=storeListingPrice(def,L);
      if(price==null)return;
      out.push({listingId:`${stallId}:${L.itemId}`,stallId,itemId:def.id,def,price,rule:'FIXED',stock:L.stock||'UNLIMITED',override:L.priceOverride!=null});
      return;
    }
    if(L.rule==='BRACKET_ALL'){
      const bracket=economyBracket(state.level);
      const pool=storeEquipmentPool({rarities:L.rarities||['common','uncommon'],bracket});
      pool.sort((a,b)=>EQUIPMENT_DEF_SLOTS.indexOf(a.slot)-EQUIPMENT_DEF_SLOTS.indexOf(b.slot)||storeRarityRank(a.rarity)-storeRarityRank(b.rarity)).forEach(def=>{
        out.push({listingId:`${stallId}:${def.id}`,stallId,itemId:def.id,def,price:def.priceGold,rule:'BRACKET_ALL',stock:'UNLIMITED',ilvl:def.itemLevel});
      });
      return;
    }
    if(L.rule==='ROTATION_DAILY'||L.rule==='ROTATION_WEEKLY'){
      const kind=L.rule==='ROTATION_WEEKLY'?'WEEKLY':'DAILY';
      const period=storeRotationPeriod(kind,dateISO);
      const bracket=storeRotationBracket(kind,`${stallId}#${idx}`,period);
      const pool=storeEquipmentPool({rarities:[L.rarity],bracket});
      const picks=storeSeededPick(pool,L.count,`${e.playerId}|${period}|${stallId}|${L.rarity}`);
      picks.forEach(def=>out.push({listingId:`${stallId}:${def.id}`,stallId,itemId:def.id,def,price:def.priceGold,rule:L.rule,stock:'ONE_PER_PERIOD',period,ilvl:def.itemLevel,rotationRarity:L.rarity}));
    }
  });
  return out;
}
/* Why a listing cannot be bought right now (null = it can). */
function storePurchaseBlockReason(listing,{qty=1}={}){
  if(!listing)return 'not-listed';
  const stall=storeStall(listing.stallId);
  if(!storeStallUnlocked(stall))return 'locked-stall';
  const def=listing.def,price=listing.price;
  if(price==null||!(price>=0))return 'no-price';
  if(def.kind==='container'&&def.container&&!chestAvailability(def.container.chestId).available)return 'chest-unavailable';/* no purchase path for a chest the pool cannot honour */
  if(goldDeficit())return 'deficit';
  if(goldBalance()<price*qty)return 'insufficient';
  if(def.kind==='gear'&&Number(state.level||1)<Number(def.levelRequirement||1))return 'level';
  if(def.stackable){
    const owned=ensureInventoryState().ownedItems.filter(o=>o.itemDefinitionId===def.id).reduce((n,o)=>n+Number(o.quantity||1),0);
    if(owned+qty>itemDefinitionMaxStack(def)*3)return 'stack-full';/* soft ceiling: three full stacks */
  }
  return null;
}
const STORE_BLOCK_TEXT={
  'not-listed':'Not for sale right now.','locked-stall':'This stall is still locked.','no-price':'Not for sale.',
  deficit:'Purchases paused until your balance is above 0.',insufficient:'Not enough Gold.',level:'Your level is too low to use this.','stack-full':'You are carrying the maximum.','chest-unavailable':'Not available yet — its rewards are still being prepared.'
};
function storeNeedsConfirm(def,price){
  const c=ECONOMY_CONFIG.confirm;
  if(price>=c.minGold)return true;
  if(economyRarityIndex(def.rarity)>=economyRarityIndex(c.minRarity))return true;
  if(c.chests&&def.kind==='container')return true;
  return false;
}
/* Atomic purchase. attemptId is created by the UI when the buy control is
   rendered; a double tap replays the same id, so the second call finds its
   own ledger key and buys nothing. */
function storeBuy({listingId,attemptId,qty=1,dateISO=todayISO()}={}){
  ensureEconomyState();
  if(!attemptId)return {ok:false,reason:'missing-attempt-id'};
  qty=Math.max(1,Math.floor(Number(qty)||1));
  const key=`BUY:${attemptId}`;
  if(goldLedgerHasKey(key))return {ok:false,duplicate:true,reason:'already-purchased'};
  const stallId=String(listingId||'').split(':')[0];
  const listing=storeResolveListings(stallId,dateISO).find(l=>l.listingId===listingId);
  const block=storePurchaseBlockReason(listing,{qty});
  if(block)return {ok:false,reason:block};
  return economyTransaction(()=>{
    const spend=goldPost({kind:'SPEND',amount:-(listing.price*qty),source:'SHOP',refId:listing.itemId,idempotencyKey:key});
    if(!spend.ok)return {ok:false,reason:spend.reason};
    const grant=grantItem({itemDefinitionId:listing.itemId,sourceType:'shop',sourceRef:listing.stallId,grantRef:key,quantity:qty});
    if(!grant.granted)return {ok:false,reason:grant.reason||'grant-failed'};
    if(listing.override)ensureEconomyState().priceOverrideLog.push({at:economyNowISO(),itemId:listing.itemId,stallId:listing.stallId,price:listing.price});
    return {ok:true,tx:spend.tx,ownedItem:grant.ownedItem,itemId:listing.itemId,price:listing.price*qty};
  });
}
/* ---- Selling / buyback: ONE Store service path (Lyra §6.2) ---- */
function storeSellQuote(ownedItemId,qty=1){
  const owned=ensureInventoryState().ownedItems.find(o=>o.id===ownedItemId);
  if(!owned)return {ok:false,reason:'not-owned'};
  const def=itemDefinitionById(owned.itemDefinitionId);
  if(!def)return {ok:false,reason:'unknown-item-definition'};
  if(def.kind==='quest')return {ok:false,reason:'quest-item'};
  if(def.kind==='cosmetic'||def.cosmeticOnly)return {ok:false,reason:'cosmetic'};
  if(equipmentSlotOf(ownedItemId))return {ok:false,reason:'equipped'};
  if(owned.isLocked)return {ok:false,reason:'locked'};
  const each=Number(def.sellGold||0);
  if(!(each>0))return {ok:false,reason:'no-sell-value'};
  qty=Math.max(1,Math.floor(Number(qty)||1));
  if(qty>Number(owned.quantity||1))return {ok:false,reason:'quantity'};
  return {ok:true,ownedItemId,def,qty,each,total:economyRoundGold(each*qty)};
}
const STORE_SELL_TEXT={'not-owned':'You no longer own this.','quest-item':'Quest items can’t be sold.',cosmetic:'Cosmetics can’t be sold.',equipped:'Unequip it before selling.',locked:'Unlock it before selling.','no-sell-value':'This has no sell value.',quantity:'You don’t have that many.','unknown-item-definition':'Unknown item.'};
function storeBuybackList(){
  const e=ensureEconomyState(),today=todayISO();
  const fresh=e.buyback.filter(b=>b.dateKey===today);
  if(fresh.length!==e.buyback.length){e.buyback=fresh;invSave()}/* the list clears at local midnight */
  return e.buyback;
}
function storeSell({ownedItemId,qty=1,saleId}={}){
  ensureEconomyState();
  if(!saleId)return {ok:false,reason:'missing-sale-id'};
  const key=`SELL:${ownedItemId}:${saleId}`;
  if(goldLedgerHasKey(key))return {ok:false,duplicate:true,reason:'already-sold'};
  const quote=storeSellQuote(ownedItemId,qty);
  if(!quote.ok)return quote;
  return economyTransaction(()=>{
    const inv=ensureInventoryState(),e=ensureEconomyState();
    const owned=inv.ownedItems.find(o=>o.id===ownedItemId);
    const earn=goldPost({kind:'EARN',amount:quote.total,source:'SELL',refId:quote.def.id,idempotencyKey:key});
    if(!earn.ok)return {ok:false,reason:earn.reason};
    owned.quantity=Number(owned.quantity||1)-quote.qty;
    if(owned.quantity<=0)inv.ownedItems=inv.ownedItems.filter(o=>o.id!==ownedItemId);
    storeBuybackList();
    e.buyback.push({saleId,itemDefinitionId:quote.def.id,quantity:quote.qty,price:quote.total,soldAt:economyNowISO(),dateKey:todayISO(),isFavourite:Boolean(owned.isFavourite)});
    e.buyback=e.buyback.slice(-ECONOMY_CONFIG.selling.buyback.count);
    return {ok:true,tx:earn.tx,total:quote.total,itemId:quote.def.id};
  });
}
function storeBuyback({saleId,attemptId}={}){
  ensureEconomyState();
  if(!attemptId)return {ok:false,reason:'missing-attempt-id'};
  const key=`BUY:${attemptId}`;
  if(goldLedgerHasKey(key))return {ok:false,duplicate:true,reason:'already-purchased'};
  const entry=storeBuybackList().find(b=>b.saleId===saleId);
  if(!entry)return {ok:false,reason:'not-in-buyback'};
  if(goldDeficit())return {ok:false,reason:'deficit'};
  if(goldBalance()<entry.price)return {ok:false,reason:'insufficient'};
  return economyTransaction(()=>{
    const e=ensureEconomyState();
    const spend=goldPost({kind:'SPEND',amount:-entry.price,source:'BUYBACK',refId:entry.itemDefinitionId,idempotencyKey:key});
    if(!spend.ok)return {ok:false,reason:spend.reason};
    const grant=grantItem({itemDefinitionId:entry.itemDefinitionId,sourceType:'buyback',sourceRef:entry.saleId,grantRef:key,quantity:entry.quantity});
    if(!grant.granted)return {ok:false,reason:grant.reason||'grant-failed'};
    if(entry.isFavourite&&grant.ownedItem)grant.ownedItem.isFavourite=true;
    e.buyback=e.buyback.filter(b=>b.saleId!==saleId);
    return {ok:true,tx:spend.tx,ownedItem:grant.ownedItem,price:entry.price};
  });
}
/* Armoury comparison (Assay §10.1): change in damage/defence vs whatever
   occupies the slot, and the Effective-stat change AFTER the gear cap. */
function storeCompareToEquipped(def){
  if(!def||def.kind!=='gear'||!def.slot)return null;
  const eq=ensureEquipmentState(),inv=ensureInventoryState();
  const slot=equipmentSlotForDef(def,eq.slots);
  const equippedOwned=slot&&eq.slots[slot]!=null?inv.ownedItems.find(o=>o.id===eq.slots[slot]):null;
  const equippedDef=equippedOwned?itemDefinitionById(equippedOwned.itemDefinitionId):null;
  const newMods=itemDefinitionGearModifiers(def),oldMods=equippedDef?itemDefinitionGearModifiers(equippedDef):{};
  const out={slot,equippedName:equippedDef?equippedDef.name:null,damage:(newMods.damage||0)-(oldMods.damage||0),defence:(newMods.defence||0)-(oldMods.defence||0),stats:[]};
  ECONOMY_STATS.forEach(k=>{
    const add=(newMods[k]||0)-(oldMods[k]||0);
    if(!add)return;
    const total=numericSourceValue(eq.statModifiers,k),cap=economyGearCap(v023BaseStat(k));
    const beforeEff=Math.min(total,cap),afterEff=Math.min(total+add,cap);
    out.stats.push({stat:k.toUpperCase(),gross:add,effectiveChange:afterEff-beforeEff,capped:afterEff-beforeEff<add,cap});
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* 6. Consumables (buff elixirs live; potions wait for campaigns)      */
/* ------------------------------------------------------------------ */

function economyUseConsumable(ownedItemId){
  const inv=ensureInventoryState();
  const owned=inv.ownedItems.find(o=>o.id===ownedItemId);
  const def=owned?itemDefinitionById(owned.itemDefinitionId):null;
  if(!def||!def.consumable)return {ok:false,reason:'not-usable'};
  const c=def.consumable;
  if(c.effectId!=='BUFF_STAT_PCT')return {ok:false,reason:'later',message:'Usable during campaigns'};
  return economyTransaction(()=>{
    const e=ensureEconomyState(),stat=String(c.stat).toLowerCase();
    e.buffs[stat]={itemId:def.id,name:def.name,pct:c.pct,minFlat:c.minFlat,startedAt:Date.now(),expiresAt:Date.now()+c.durationMin*60000};
    owned.quantity=Number(owned.quantity||1)-1;
    if(owned.quantity<=0)inv.ownedItems=inv.ownedItems.filter(o=>o.id!==ownedItemId);
    return {ok:true,stat,expiresAt:e.buffs[stat].expiresAt};
  });
}

/* ------------------------------------------------------------------ */
/* 7. Chest / pity / seeded-result engine                              */
/* ------------------------------------------------------------------ */

function chestPityState(chestId){
  const e=ensureEconomyState();
  if(!e.pity[chestId]||typeof e.pity[chestId]!=='object')e.pity[chestId]={opens:0,sinceEpic:0,sinceLegendary:0};
  return e.pity[chestId];
}
/* Eligible chest content: APPROVED consumables + eligible gear inside the
   player's item-level band. Mythic can never appear; only tiers in
   ECONOMY_RARITY_RANDOM_ELIGIBLE are ever rolled. Supplies (rations),
   containers and quest items are not chest contents. */
function chestPool(bracket=economyBracket(state.level),{approvedOnly=false}={}){
  const defs=allItemDefinitions().filter(d=>!d.basicGear&&(approvedOnly?d.status==='APPROVED':itemDefinitionPoolEligible(d))&&d.rarity!=='mythic'&&ECONOMY_RARITY_RANDOM_ELIGIBLE.includes(d.rarity));
  const consumables=defs.filter(d=>d.kind==='consumable');
  const gearAll=defs.filter(d=>d.kind==='gear'&&d.slot&&d.itemLevel!=null&&d.priceGold>0);
  let gear=gearAll.filter(d=>d.itemLevel<=bracket&&d.itemLevel>bracket-10);
  if(!gear.length&&!approvedOnly&&typeof economyDevFixturesEnabled==='function'&&economyDevFixturesEnabled()){
    const fx=gearAll.filter(d=>d.status==='DEV_FIXTURE'&&d.itemLevel<=bracket);
    if(fx.length){const top=Math.max(...fx.map(d=>d.itemLevel));gear=fx.filter(d=>d.itemLevel===top)}
  }
  const byTier={};
  ECONOMY_RARITY_RANDOM_ELIGIBLE.forEach(t=>{byTier[t]=consumables.concat(gear).filter(d=>d.rarity===t).sort((a,b)=>String(a.id).localeCompare(String(b.id)))});
  return byTier;
}
function chestOddsTable(chestId){
  const cfg=CHEST_CONFIG[chestId];
  if(!cfg)return [];
  return ECONOMY_RARITIES.filter(t=>cfg.odds[t]!==undefined&&(cfg.odds[t]>0||['common','uncommon','rare','epic','legendary','celestial'].includes(t))).map(t=>({tier:t,pct:cfg.odds[t]||0}));
}
/* Pity as the UI shows it: opens left until each guarantee, plus whether the
   guarantee can actually be honoured (needs eligible content at/above it). */
function chestPityView(chestId,{approvedOnly=false}={}){
  const cfg=CHEST_CONFIG[chestId];
  if(!cfg)return null;
  const st=chestPityState(chestId),pool=chestPool(economyBracket(state.level),{approvedOnly}),out={opens:st.opens,rules:[]};
  if(!cfg.pity)return out;
  Object.keys(cfg.pity).forEach(name=>{
    const r=cfg.pity[name],since=name==='epic'?st.sinceEpic:st.sinceLegendary;
    const from=economyRarityIndex(r.tier);
    const fulfillable=ECONOMY_RARITY_RANDOM_ELIGIBLE.some(t=>economyRarityIndex(t)>=from&&pool[t]&&pool[t].length);
    out.rules.push({name,tier:r.tier,withinOpens:r.withinOpens,since,opensLeft:Math.max(0,r.withinOpens-since),fulfillable});
  });
  return out;
}
/* A chest may only be sold / opened when the CURRENT approved item pool can
   keep every promise on its lid (Lyra correction, 2026-09-25): each rarity with
   a non-zero drop chance needs at least one APPROVED item to give, and every
   pity guarantee must be satisfiable. Judged on APPROVED content only -- dev
   fixtures are never counted, so they can never "unlock" a chest. The engine
   and config are untouched; a chest simply becomes available the moment the
   approved catalogue can honour it. With today's content that leaves the
   Traveller's Chest available and the Adventurer's / Heroic chests (Legendary
   and Celestial odds + Legendary pity, no approved Legendary+ items) not. */
function chestAvailability(chestId){
  const cfg=CHEST_CONFIG[chestId];
  if(!cfg)return {available:false,reason:'unknown-chest',missingTiers:[],unmetPity:[]};
  const pool=chestPool(economyBracket(state.level),{approvedOnly:true});
  const missingTiers=ECONOMY_RARITY_RANDOM_ELIGIBLE.filter(t=>(cfg.odds[t]||0)>0&&!(pool[t]&&pool[t].length));
  const pv=chestPityView(chestId,{approvedOnly:true});
  const unmetPity=(pv&&pv.rules?pv.rules:[]).filter(r=>!r.fulfillable).map(r=>r.name);
  const available=!missingTiers.length&&!unmetPity.length;
  return {available,reason:available?null:'pool-cannot-satisfy',missingTiers,unmetPity};
}
function chestForceTiers(cfg,st,pool){
  /* Highest guarantee that is due AND has eligible content wins. */
  const due=[];
  if(cfg.pity){
    Object.keys(cfg.pity).forEach(name=>{
      const r=cfg.pity[name],since=name==='epic'?st.sinceEpic:st.sinceLegendary;
      if(since+1>=r.withinOpens)due.push(economyRarityIndex(r.tier));
    });
  }
  /* Try the strictest due guarantee first; if nothing eligible exists at
     that level (e.g. no APPROVED Legendary item yet) fall through to the
     next due guarantee instead of dropping all of them. */
  due.sort((a,b)=>b-a);
  for(const from of due){
    const tiers=ECONOMY_RARITY_RANDOM_ELIGIBLE.filter(t=>economyRarityIndex(t)>=from&&pool[t]&&pool[t].length);
    if(tiers.length)return tiers;
  }
  return null;
}
/* Roll (pure given state): returns {tier,resolvedTier,def,forced}. */
function chestRoll(chestId,seedStr,st,pool){
  const cfg=CHEST_CONFIG[chestId],rng=economyRng(seedStr);
  const forcedTiers=chestForceTiers(cfg,st,pool);
  let tiers=ECONOMY_RARITY_RANDOM_ELIGIBLE.filter(t=>(cfg.odds[t]||0)>0);
  if(forcedTiers)tiers=forcedTiers;
  let total=tiers.reduce((n,t)=>n+(cfg.odds[t]||(forcedTiers?1:0)),0);
  let r=rng()*total,rolled=tiers[tiers.length-1];
  for(const t of tiers){const w=cfg.odds[t]||(forcedTiers?1:0);if(r<w){rolled=t;break}r-=w}
  /* Rarity fallback: nothing eligible in the rolled tier -> nearest lower
     tier with content, then the nearest higher. */
  let resolved=rolled;
  if(!pool[resolved]||!pool[resolved].length){
    const idx=ECONOMY_RARITY_RANDOM_ELIGIBLE.indexOf(rolled);
    resolved=null;
    for(let i=idx-1;i>=0&&!resolved;i--)if(pool[ECONOMY_RARITY_RANDOM_ELIGIBLE[i]].length)resolved=ECONOMY_RARITY_RANDOM_ELIGIBLE[i];
    for(let i=idx+1;i<ECONOMY_RARITY_RANDOM_ELIGIBLE.length&&!resolved;i++)if(pool[ECONOMY_RARITY_RANDOM_ELIGIBLE[i]].length)resolved=ECONOMY_RARITY_RANDOM_ELIGIBLE[i];
  }
  if(!resolved)return {tier:rolled,resolvedTier:null,def:null,forced:Boolean(forcedTiers)};
  const list=pool[resolved];
  return {tier:rolled,resolvedTier:resolved,def:list[Math.floor(rng()*list.length)],forced:Boolean(forcedTiers)};
}
function chestOpeningById(openingId){return ensureEconomyState().openings.find(o=>o.openingId===openingId)||null}
function chestPendingReveals(){return ensureEconomyState().openings.filter(o=>!o.revealed)}
function chestMarkRevealed(openingId){
  const o=chestOpeningById(openingId);
  if(!o||o.revealed)return false;
  o.revealed=true;invSave();return true;
}
/* Open one chest from an OwnedItem stack. The result is chosen, the chest
   consumed, the item granted and the opening recorded in ONE transaction --
   i.e. committed before any reveal animation starts. The seed is
   playerId + chestInstanceId, where chestInstanceId is the per-chest-type
   open counter, so quitting mid-animation, re-opening the app or asking
   again can only ever return the same record. */
function chestOpen(ownedItemId){
  const e=ensureEconomyState(),inv=ensureInventoryState();
  const owned=inv.ownedItems.find(o=>o.id===ownedItemId);
  const def=owned?itemDefinitionById(owned.itemDefinitionId):null;
  if(!def||def.kind!=='container'||!def.container)return {ok:false,reason:'not-a-chest'};
  const chestId=def.container.chestId,cfg=CHEST_CONFIG[chestId];
  if(!cfg)return {ok:false,reason:'unknown-chest'};
  if(!chestAvailability(chestId).available)return {ok:false,reason:'chest-unavailable'};/* never open a chest whose promises the pool cannot keep */
  const st=chestPityState(chestId);
  const chestInstanceId=`${chestId}#${st.opens+1}`,openingId=`OPEN:${chestInstanceId}`;
  const prior=chestOpeningById(openingId);
  if(prior)return {ok:true,duplicate:true,opening:prior};
  const pool=chestPool();
  const seed=`${e.playerId}|${chestInstanceId}`;
  const roll=chestRoll(chestId,seed,st,pool);
  if(!roll.def)return {ok:false,reason:'no-eligible-items'};
  return economyTransaction(()=>{
    const inv2=ensureInventoryState(),e2=ensureEconomyState();
    const stack=inv2.ownedItems.find(o=>o.id===ownedItemId);
    if(!stack||Number(stack.quantity||1)<1)return {ok:false,reason:'no-chest'};
    const pityBefore={opens:st.opens,sinceEpic:st.sinceEpic,sinceLegendary:st.sinceLegendary};
    const grant=grantItem({itemDefinitionId:roll.def.id,sourceType:'chest',sourceRef:chestInstanceId,grantRef:'open',quantity:1});
    if(!grant.granted)return {ok:false,reason:grant.reason||'grant-failed'};
    stack.quantity=Number(stack.quantity||1)-1;
    if(stack.quantity<=0)inv2.ownedItems=inv2.ownedItems.filter(o=>o.id!==ownedItemId);
    const rank=economyRarityIndex(roll.resolvedTier);
    st.opens+=1;
    st.sinceEpic=rank>=economyRarityIndex('epic')?0:st.sinceEpic+1;
    st.sinceLegendary=rank>=economyRarityIndex('legendary')?0:st.sinceLegendary+1;
    const opening={openingId,chestId,chestInstanceId,seed,rolledTier:roll.tier,resolvedTier:roll.resolvedTier,forcedByPity:roll.forced,itemDefinitionId:roll.def.id,ownedItemId:grant.ownedItem&&grant.ownedItem.id,openedAt:economyNowISO(),revealed:false,pityBefore,pityAfter:{opens:st.opens,sinceEpic:st.sinceEpic,sinceLegendary:st.sinceLegendary}};
    e2.openings.push(opening);
    if(e2.openings.length>200)e2.openings=e2.openings.slice(-200);
    return {ok:true,opening};
  });
}

/* ------------------------------------------------------------------ */
/* 8. Load-time normalisation                                          */
/* ------------------------------------------------------------------ */

/* Run once when this file loads, before any page renders: builds the
   ledger's opening entry for a save that has none, absorbs any stray
   direct state.gold write, rebuilds the derived equipment cache and drops
   expired buffs. All idempotent -- running it every launch is safe. */
(function economyBoot(){
  ensureEconomyState();
  economyAbsorbLegacyGoldWrite();
  refreshEquipmentStatModifiers();
  economyPruneExpiredBuffs();
  invSave();/* persist the new economy state at once so playerId / the opening ledger entry can never be regenerated on a later launch */
})();
