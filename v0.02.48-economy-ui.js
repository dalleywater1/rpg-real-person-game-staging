/* Economy UI — Store, Loot, chest reveal (Master Build Phase A, A2;
   Astra, 2026-09-25, RPG-0093). Presentation only: every purchase, sale,
   claim and chest open goes through the services in
   v0.02.47-economy-core.js (storeBuy / storeSell / storeBuyback /
   claimReward / claimAllRewards / chestOpen), so there is no second path
   for money or items in any screen. Reuses Storage's dark-glass tokens and
   components (styles/inventory-v1) via the shared `.inv-theme` scope plus a
   few `eco-*` additions (styles/economy/00-economy.css).
   Load order: after v0.02.47-economy-core.js. */

/* ------------------------------------------------------------------ */
/* 1. Shared bits                                                      */
/* ------------------------------------------------------------------ */

const ECO_RARITY_LABEL=ECONOMY_RARITY_LABEL;
const ECO_KIND_GLYPH={gear:'⚔',consumable:'⬡',supply:'❖',container:'▣',cosmetic:'✦',collectible:'✦',quest:'❖'};
function ecoGlyph(def){return ECO_KIND_GLYPH[def.kind]||'◆'}
function ecoGold(n){return `${Number(n||0).toLocaleString()} g`}
function ecoRarityTag(def){return `<span class="inv-card__rarity inv-card__rarity--${def.rarity||'common'}">${esc(ECO_RARITY_LABEL[def.rarity]||'')}</span>`}
/* One-line, plain-language effect text straight from the template (no
   runtime balance maths -- the numbers are Assay's, on the definition). */
function ecoEffectLines(def){
  const out=[];
  if(def.consumable){
    const c=def.consumable;
    if(c.effectId==='RESTORE_HP_PCT')out.push(`Restores ${c.pct}% of max HP`);
    else if(c.effectId==='RESTORE_STAMINA_PCT')out.push(`Restores ${c.pct}% of max Stamina`);
    else if(c.effectId==='BUFF_STAT_PCT'){const h=c.durationMin/60;out.push(`+${c.pct}% of Base ${c.stat} (min +${c.minFlat}) · ${h} h`)}
    else if(c.effectId==='CAMP_RATION')out.push('Eaten at camps — one per party member');
  }
  if(def.container)out.push('Reveals one item when opened');
  if(def.implicit&&def.implicit.damage)out.push(`Damage +${def.implicit.damage}`);
  if(def.implicit&&def.implicit.defence)out.push(`Defence +${def.implicit.defence}`);
  (def.affixes||[]).forEach(a=>{if(a.effectId==='STAT_FLAT')out.push(`+${a.value} ${a.stat}`);else out.push(`${a.effectId.replace(/_/g,' ').toLowerCase()}${a.value!=null?' '+a.value:''}`)});
  return out;
}
function ecoOwnedQty(defId){return ensureInventoryState().ownedItems.filter(o=>o.itemDefinitionId===defId).reduce((n,o)=>n+Number(o.quantity||1),0)}
function ecoNewAttempt(){return economyNewId('att')}
/* Double-tap guard: an attempt id stays stable for a short cooldown after a
   success, so a second tap on the (re-rendered) control replays the same id
   and the service ignores it. */
const ECO_COOLDOWN_MS=1200;
const ecoAttempts={};
function ecoAttemptFor(key){
  const a=ecoAttempts[key];
  if(!a||(a.doneAt&&Date.now()-a.doneAt>ECO_COOLDOWN_MS))ecoAttempts[key]={id:ecoNewAttempt(),doneAt:0};
  return ecoAttempts[key];
}
function ecoWalletHTML(){
  const w=economyWalletView();
  return `<div class="inv-gold-summary eco-wallet${w.deficit?' is-deficit':''}" role="group" aria-label="Wallet">
    <div class="inv-gold-summary__stat"><span class="inv-gold-summary__icon inv-gold-summary__icon--gold" aria-hidden="true">\u{1FA99}</span><div><div class="inv-gold-summary__num${w.deficit?' eco-negative':''}">${Number(w.gold).toLocaleString()}</div><div class="inv-gold-summary__label">Gold</div></div></div>
    <div class="inv-gold-summary__divider"></div>
    <div class="inv-gold-summary__stat"><div><div class="inv-gold-summary__num">+${Number(w.earnedToday).toLocaleString()}</div><div class="inv-gold-summary__label">Earned today</div></div></div>
    ${w.deficit?`<p class="eco-deficit" role="status">${esc(w.deficitMessage)}</p>`:''}
  </div>`;
}
function ecoBlockText(reason){return STORE_BLOCK_TEXT[reason]||'Unavailable.'}

/* ------------------------------------------------------------------ */
/* 2. Store                                                            */
/* ------------------------------------------------------------------ */

let storeStallId='STALL-PROVISIONS',storeSellPreselect=null,storeSellPending=null;
function storeOpenHub(){
  if(storeSellPending!=null){storeStallId='STALL-SELL';storeSellPreselect=storeSellPending;storeSellPending=null;return}
  storeStallId='STALL-PROVISIONS';storeSellPreselect=null;
}
/* Storage's "Sell" shortcut on Item Detail: opens the Store's Sell stall
   with the item highlighted. Selling itself is only ever done by Store. */
function storeOpenSell(ownedItemId){storeSellPending=ownedItemId;setPage('store')}
function ecoGoToStorageItem(ownedItemId){setPage('storage');invGoItem(ownedItemId)}

function ecoStallTabsHTML(){
  return `<div class="eco-stalls" role="tablist" aria-label="Store stalls">${STORE_STALLS.map(st=>{
    const locked=!storeStallUnlocked(st);
    return `<button type="button" role="tab" aria-selected="${storeStallId===st.stallId?'true':'false'}" class="inv-chip eco-stall${storeStallId===st.stallId?' is-active':''}${locked?' is-locked':''}" data-store-stall="${st.stallId}">${esc(st.label)}${locked?' <span aria-hidden="true">\u{1F512}</span>':''}</button>`;
  }).join('')}</div>`;
}
function ecoCompareHTML(def){
  const c=storeCompareToEquipped(def);
  if(!c)return '';
  const bits=[];
  const sign=n=>`${n>0?'+':''}${n}`;
  if(def.implicit&&def.implicit.damage)bits.push(`Damage ${sign(c.damage)}`);
  if(def.implicit&&def.implicit.defence)bits.push(`Defence ${sign(c.defence)}`);
  c.stats.forEach(s=>bits.push(s.capped?`${sign(s.gross)} ${s.stat}, capped at ${sign(s.effectiveChange)}`:`${sign(s.effectiveChange)} ${s.stat}`));
  const vs=c.equippedName?`vs ${esc(c.equippedName)}`:`vs empty ${esc(EQUIPMENT_SLOT_LABEL[c.slot]||'slot')}`;
  return `<div class="eco-compare">${vs}: ${bits.map(esc).join(' · ')||'no change'}</div>`;
}
/* A chest the approved pool cannot keep the promises of is shown as a plain,
   locked card: name and a short reason -- NO price, NO odds table, NO Buy
   control (so there is no purchase path and no promise on the lid). */
function ecoLockedChestHTML(l){
  const def=l.def;
  return `<article class="eco-listing eco-listing--locked" data-listing="${esc(l.listingId)}" aria-label="${esc(def.name)}, not available yet">
    <div class="eco-listing__art" aria-hidden="true">\u{1F512}</div>
    <div class="eco-listing__body"><div class="eco-listing__name">${esc(def.name)}</div><div class="eco-listing__desc">Not available yet. It opens up once the item catalogue behind it is ready.</div></div>
  </article>`;
}
function ecoListingHTML(l){
  if(l.def.kind==='container'&&l.def.container&&!chestAvailability(l.def.container.chestId).available)return ecoLockedChestHTML(l);
  const def=l.def,block=storePurchaseBlockReason(l);
  const att=ecoAttemptFor(`buy:${l.listingId}`);
  const cooling=att.doneAt&&Date.now()-att.doneAt<ECO_COOLDOWN_MS;
  const owned=ecoOwnedQty(def.id);
  const effects=ecoEffectLines(def);
  const chest=def.container?ecoChestInfoHTML(def.container.chestId):'';
  return `<article class="eco-listing" data-listing="${esc(l.listingId)}">
    <div class="eco-listing__art" aria-hidden="true">${ecoGlyph(def)}</div>
    <div class="eco-listing__body">
      <div class="eco-listing__name">${esc(def.name)} ${ecoRarityTag(def)}</div>
      ${effects.length?`<div class="eco-listing__desc">${effects.map(esc).join(' · ')}</div>`:''}
      ${def.kind==='gear'?`<div class="eco-listing__meta">${esc(EQUIPMENT_SLOT_LABEL[def.slot==='ACCESSORY'?'ACCESSORY_1':def.slot]||def.slot||'')} · Level ${def.levelRequirement}${l.period?' · '+(l.rule==='ROTATION_WEEKLY'?'This week':'Today'):''}</div>${ecoCompareHTML(def)}`:''}
      ${owned?`<div class="eco-listing__meta">You have ×${owned}</div>`:''}
      ${chest}
    </div>
    <div class="eco-listing__buy">
      <span class="eco-price">${ecoGold(l.price)}</span>
      <button type="button" class="inv-btn" data-store-buy="${esc(l.listingId)}" ${block||cooling?'disabled':''}>Buy</button>
      ${block?`<small class="eco-reason">${esc(ecoBlockText(block))}</small>`:''}
    </div>
  </article>`;
}
/* Chest odds + pity, ALWAYS visible on the chest card (Assay §8/§10.1). */
function ecoChestInfoHTML(chestId){
  const cfg=CHEST_CONFIG[chestId];
  if(!cfg)return '';
  const odds=chestOddsTable(chestId).filter(o=>o.pct>0||ECONOMY_RARITIES.indexOf(o.tier)<=ECONOMY_RARITIES.indexOf('celestial'));
  const pv=chestPityView(chestId);
  const pityHTML=pv&&pv.rules.length?pv.rules.map(r=>`<li class="eco-pity${r.fulfillable?'':' is-pending'}">${esc(ECO_RARITY_LABEL[r.tier])} or better guaranteed within ${r.opensLeft} more open${r.opensLeft===1?'':'s'} <span class="eco-pity__count">(${r.since}/${r.withinOpens})</span>${r.fulfillable?'':' — waiting for approved items at that tier'}</li>`).join(''):'';
  return `<div class="eco-odds" aria-label="Odds">
    <table class="eco-odds__table"><thead><tr>${odds.map(o=>`<th scope="col">${esc(ECO_RARITY_LABEL[o.tier].slice(0,3))}</th>`).join('')}</tr></thead><tbody><tr>${odds.map(o=>`<td class="eco-odds__cell eco-odds--${o.tier}">${o.pct}%</td>`).join('')}</tr></tbody></table>
    ${pityHTML?`<ul class="eco-pity-list">${pityHTML}</ul>`:'<div class="eco-pity is-none">No pity — every open is a fresh roll.</div>'}
  </div>`;
}
function ecoStockArrivingHTML(label){
  return `<div class="inv-shell inv-shell--soft"><p class="inv-empty">${esc(label)}: no approved equipment is on sale yet. Stock arrives with the equipment catalogue.</p></div>`;
}
function ecoSellRowHTML(o,selected){
  const def=itemDefinitionById(o.itemDefinitionId);
  if(!def)return '';
  const q=storeSellQuote(o.id,1);
  const attKey=`sell:${o.id}`,att=ecoAttemptFor(attKey);
  const cooling=att.doneAt&&Date.now()-att.doneAt<ECO_COOLDOWN_MS;
  const reasonText=q.ok?'':(STORE_SELL_TEXT[q.reason]||'Can’t be sold.');
  return `<div class="eco-sell-row${selected?' is-selected':''}" data-sell-row="${o.id}">
    <div class="eco-listing__art" aria-hidden="true">${ecoGlyph(def)}</div>
    <div class="eco-listing__body"><div class="eco-listing__name">${esc(def.name)}${o.quantity>1?` ×${o.quantity}`:''} ${ecoRarityTag(def)}</div>${q.ok?`<div class="eco-listing__meta">Sells for ${ecoGold(q.each)} each</div>`:`<div class="eco-listing__meta">${esc(reasonText)}</div>`}</div>
    <div class="eco-listing__buy">
      <button type="button" class="inv-btn" data-store-sell="${o.id}" data-sell-qty="1" ${q.ok&&!cooling?'':'disabled'}>Sell${o.quantity>1?' 1':''}</button>
      ${o.quantity>1&&q.ok?`<button type="button" class="inv-btn inv-btn--ghost" data-store-sell="${o.id}" data-sell-qty="${o.quantity}" ${cooling?'disabled':''}>Sell all</button>`:''}
    </div>
  </div>`;
}
function ecoSellStallHTML(){
  const owned=ensureInventoryState().ownedItems.filter(o=>{const d=itemDefinitionById(o.itemDefinitionId);return d&&d.kind!=='quest'&&d.kind!=='cosmetic'&&d.kind!=='collectible'&&Number(d.sellGold||0)>0});
  const sorted=owned.slice().sort((a,b)=>(a.id===storeSellPreselect?-1:0)-(b.id===storeSellPreselect?-1:0));
  const bb=storeBuybackList();
  return `<div class="inv-shell inv-shell--soft"><p class="helper" style="margin:0">Items sell for ${ECONOMY_CONFIG.selling.ratePct}% of their shop price. Equipped, quest and cosmetic items can’t be sold. Your last ${ECONOMY_CONFIG.selling.buyback.count} sales can be bought back today at the price they sold for.</p></div>
    <div class="inv-shell"><div class="inv-section-head"><span class="inv-section-title">Sell from Storage</span></div>
      ${sorted.length?`<div class="eco-list">${sorted.map(o=>ecoSellRowHTML(o,o.id===storeSellPreselect)).join('')}</div>`:'<p class="inv-empty">Nothing in Storage can be sold right now.</p>'}
    </div>
    <div class="inv-shell"><div class="inv-section-head"><span class="inv-section-title">Buy back (today)</span></div>
      ${bb.length?`<div class="eco-list">${bb.slice().reverse().map(b=>{const d=itemDefinitionById(b.itemDefinitionId);const att=ecoAttemptFor(`bb:${b.saleId}`);const block=goldDeficit()?'deficit':(goldBalance()<b.price?'insufficient':null);return `<div class="eco-sell-row"><div class="eco-listing__art" aria-hidden="true">${d?ecoGlyph(d):'◆'}</div><div class="eco-listing__body"><div class="eco-listing__name">${esc(d?d.name:b.itemDefinitionId)}${b.quantity>1?` ×${b.quantity}`:''}</div><div class="eco-listing__meta">Buy back for ${ecoGold(b.price)}</div></div><div class="eco-listing__buy"><button type="button" class="inv-btn" data-store-buyback="${esc(b.saleId)}" ${block?'disabled':''}>Buy back</button>${block?`<small class="eco-reason">${esc(ecoBlockText(block))}</small>`:''}</div></div>`}).join('')}</div>`:'<p class="inv-empty">No sales to buy back today.</p>'}
    </div>`;
}
function ecoStallBodyHTML(){
  const stall=storeStall(storeStallId)||STORE_STALLS[0];
  if(!storeStallUnlocked(stall)){
    return `<div class="inv-shell inv-shell--soft"><p class="inv-empty"><span aria-hidden="true">\u{1F512}</span> ${esc(stall.label)} — ${esc(storeStallLockLabel(stall))}. ${esc(stall.blurb||'')}</p></div>`;
  }
  if(stall.service==='SELL')return ecoSellStallHTML();
  const listings=storeResolveListings(stall.stallId);
  const devBanner=economyDevFixturesEnabled()?'<div class="eco-dev-banner" role="status">DEV FIXTURES ON — test gear only, not production stock</div>':'';
  if(stall.stallId==='STALL-ARMOURY'||stall.stallId==='STALL-FEATURED'){
    return `${devBanner}${listings.length?`<div class="eco-list">${listings.map(ecoListingHTML).join('')}</div>`:ecoStockArrivingHTML(stall.label)}`;
  }
  return `<div class="inv-shell inv-shell--soft"><p class="helper" style="margin:0">${esc(stall.blurb||'')}</p></div>${listings.length?`<div class="eco-list">${listings.map(ecoListingHTML).join('')}</div>`:'<p class="inv-empty">Nothing on sale here yet.</p>'}`;
}
function renderStore(){
  ensureEconomyState();
  if(!storeStall(storeStallId))storeStallId='STALL-PROVISIONS';
  view.innerHTML=`<div class="inv-theme eco-theme"><div class="inv-page eco-page">
    <div class="inv-header"><div class="inv-header-left"><h1 class="inv-title">Store</h1></div></div>
    ${ecoWalletHTML()}
    ${ecoStallTabsHTML()}
    <div class="eco-stall-body" id="ecoStallBody">${ecoStallBodyHTML()}</div>
  </div></div>`;
  bindStore();
  if(storeSellPreselect!=null){const row=document.querySelector(`[data-sell-row="${storeSellPreselect}"]`);if(row&&row.scrollIntoView)row.scrollIntoView({block:'center'})}
}
function ecoAfterEconomyChange(){navRefreshBadges()}
function ecoConfirmBuyModal(listing,attId){
  const def=listing.def,after=goldBalance()-listing.price;
  modal(`<div class="inv-theme eco-dialog"><h2>Confirm purchase</h2><p>Buy <b>${esc(def.name)}</b> for <b>${ecoGold(listing.price)}</b>?</p><p class="eco-note">Balance after: ${Number(after).toLocaleString()} g</p>${def.container?ecoChestInfoHTML(def.container.chestId):''}<div class="eco-confirm-actions"><button type="button" class="inv-btn" id="ecoConfirmBuy">Buy for ${ecoGold(listing.price)}</button><button type="button" class="inv-btn inv-btn--ghost" id="ecoCancelBuy">Cancel</button></div></div>`);
  modalRoot.querySelector('#ecoCancelBuy').onclick=closeModal;
  const btn=modalRoot.querySelector('#ecoConfirmBuy');
  btn.onclick=()=>{btn.disabled=true;closeModal();ecoDoBuy(listing.listingId)};
}
function ecoDoBuy(listingId){
  const att=ecoAttemptFor(`buy:${listingId}`);
  if(att.doneAt&&Date.now()-att.doneAt<ECO_COOLDOWN_MS)return;/* double-tap guard */
  const res=storeBuy({listingId,attemptId:att.id});
  if(res.ok){
    att.doneAt=Date.now();
    const def=itemDefinitionById(res.itemId);
    const owned=res.ownedItem;
    if(def&&def.kind==='container'&&owned)toastWithAction(`Bought ${def.name} for ${ecoGold(res.price)}.`,'Open',()=>ecoGoToStorageItem(owned.id));
    else toast(`Bought ${def?def.name:'item'} for ${ecoGold(res.price)}.`);
  }else if(res.duplicate){/* already bought with this attempt id -- nothing to do */}
  else toast(ecoBlockText(res.reason));
  ecoAfterEconomyChange();renderStore();
}
function ecoDoSell(ownedItemId,qty){
  const att=ecoAttemptFor(`sell:${ownedItemId}`);
  if(att.doneAt&&Date.now()-att.doneAt<ECO_COOLDOWN_MS)return;
  const res=storeSell({ownedItemId,qty,saleId:att.id});
  if(res.ok){att.doneAt=Date.now();const d=itemDefinitionById(res.itemId);toast(`Sold ${d?d.name:'item'} for ${ecoGold(res.total)}.`)}
  else if(!res.duplicate)toast(STORE_SELL_TEXT[res.reason]||'Couldn’t sell that.');
  storeSellPreselect=null;ecoAfterEconomyChange();renderStore();
}
function ecoDoBuyback(saleId){
  const att=ecoAttemptFor(`bb:${saleId}`);
  if(att.doneAt&&Date.now()-att.doneAt<ECO_COOLDOWN_MS)return;
  const res=storeBuyback({saleId,attemptId:att.id});
  if(res.ok){att.doneAt=Date.now();toast(`Bought back for ${ecoGold(res.price)}.`)}
  else if(!res.duplicate)toast(ecoBlockText(res.reason)||'Couldn’t buy that back.');
  ecoAfterEconomyChange();renderStore();
}
function bindStore(){
  const root=document.querySelector('.eco-theme');
  if(!root)return;
  root.onclick=e=>{
    const stall=e.target.closest('[data-store-stall]');
    if(stall){storeStallId=stall.dataset.storeStall;storeSellPreselect=null;renderStore();return}
    const buy=e.target.closest('[data-store-buy]');
    if(buy&&!buy.disabled){
      const id=buy.dataset.storeBuy,stallId=id.split(':')[0];
      const listing=storeResolveListings(stallId).find(l=>l.listingId===id);
      if(!listing)return;
      if(storeNeedsConfirm(listing.def,listing.price))ecoConfirmBuyModal(listing);else ecoDoBuy(id);
      return;
    }
    const sell=e.target.closest('[data-store-sell]');
    if(sell&&!sell.disabled){ecoDoSell(Number(sell.dataset.storeSell),Number(sell.dataset.sellQty||1));return}
    const bb=e.target.closest('[data-store-buyback]');
    if(bb&&!bb.disabled){ecoDoBuyback(bb.dataset.storeBuyback);return}
  };
}

/* ------------------------------------------------------------------ */
/* 3. Loot (the claim inbox)                                           */
/* ------------------------------------------------------------------ */

let lootTab='unclaimed';
function lootOpenHub(){lootTab='unclaimed'}
const LOOT_SOURCE_LABEL={achievement:'Achievement',quest:'Quest',campaign:'Campaign',weekly:'Weekly chest'};
function ecoRewardContentsHTML(env){
  const bits=[];
  if(env.gold>0)bits.push(`<span class="eco-pill eco-pill--gold">+${ecoGold(env.gold)}</span>`);
  env.items.forEach(it=>{const d=itemDefinitionById(it.itemDefinitionId);bits.push(`<span class="eco-pill">${esc(d?d.name:it.itemDefinitionId)}${it.quantity>1?` ×${it.quantity}`:''}</span>`)});
  return `<div class="eco-pills">${bits.join('')}</div>`;
}
function ecoRewardCardHTML(env,claimed){
  const att=ecoAttemptFor(`claim:${env.rewardId}`);
  return `<article class="eco-reward${claimed?' is-claimed':''}" data-reward="${esc(env.rewardId)}">
    <div class="eco-reward__head"><span class="eco-reward__source">${esc(LOOT_SOURCE_LABEL[env.sourceType]||env.sourceType)}</span><span class="eco-reward__when">${claimed?`Claimed ${esc(fmtDate(String(env.claimedAt).slice(0,10)))}`:`Earned ${esc(fmtDate(String(env.createdAt).slice(0,10)))}`}</span></div>
    <h3 class="eco-reward__title">${esc(env.title)}</h3>
    ${ecoRewardContentsHTML(env)}
    ${claimed?'':`<button type="button" class="inv-btn" data-loot-claim="${esc(env.rewardId)}">Claim</button>`}
  </article>`;
}
function renderLoot(){
  ensureEconomyState();
  const unclaimed=unclaimedRewards(),history=claimedRewardHistory();
  const list=lootTab==='history'?history:unclaimed;
  const legacyBoxes=Math.max(0,Number(state.lootBoxes&&state.lootBoxes.minor||0));
  view.innerHTML=`<div class="inv-theme eco-theme"><div class="inv-page eco-page">
    <div class="inv-header"><div class="inv-header-left"><h1 class="inv-title">Loot</h1></div></div>
    ${ecoWalletHTML()}
    <div class="eco-tabs" role="tablist" aria-label="Loot sections">
      <button type="button" role="tab" aria-selected="${lootTab==='unclaimed'}" class="inv-chip${lootTab==='unclaimed'?' is-active':''}" data-loot-tab="unclaimed">Unclaimed${unclaimed.length?` (${unclaimed.length})`:''}</button>
      <button type="button" role="tab" aria-selected="${lootTab==='history'}" class="inv-chip${lootTab==='history'?' is-active':''}" data-loot-tab="history">History</button>
    </div>
    ${lootTab==='unclaimed'&&unclaimed.length>1?`<button type="button" class="inv-btn eco-claim-all" data-loot-claim-all>Claim all (${unclaimed.length})</button>`:''}
    ${list.length?`<div class="eco-list">${list.map(r=>ecoRewardCardHTML(r,lootTab==='history')).join('')}</div>`:`<div class="inv-shell inv-shell--soft"><p class="inv-empty">${lootTab==='history'?'Nothing claimed yet.':'Nothing waiting. Rewards you earn from Achievements, Quests and Campaigns collect here until you claim them.'}</p></div>`}
    ${lootTab==='unclaimed'&&legacyBoxes?`<div class="inv-shell inv-shell--soft"><p class="helper" style="margin:0"><b>${legacyBoxes}</b> Minor Loot Box${legacyBoxes===1?'':'es'} from earlier Daily Challenges are kept safe. Opening them arrives with a later update.</p></div>`:''}
  </div></div>`;
  bindLoot();
  navRefreshBadges();
}
function ecoDoClaim(rewardId){
  const att=ecoAttemptFor(`claim:${rewardId}`);
  if(att.doneAt&&Date.now()-att.doneAt<ECO_COOLDOWN_MS)return;
  const res=claimReward(rewardId);
  if(res.ok&&!res.duplicate){att.doneAt=Date.now();toast('Reward claimed.')}
  else if(!res.ok)toast('Couldn’t claim that reward — nothing was changed.');
  renderLoot();
}
function bindLoot(){
  const root=document.querySelector('.eco-theme');
  if(!root)return;
  root.onclick=e=>{
    const tab=e.target.closest('[data-loot-tab]');if(tab){lootTab=tab.dataset.lootTab;renderLoot();return}
    const claim=e.target.closest('[data-loot-claim]');if(claim&&!claim.disabled){claim.disabled=true;ecoDoClaim(claim.dataset.lootClaim);return}
    const all=e.target.closest('[data-loot-claim-all]');
    if(all&&!all.disabled){all.disabled=true;const r=claimAllRewards();toast(r.failed?`Claimed ${r.claimed}; ${r.failed} couldn’t be claimed.`:`Claimed ${r.claimed} reward${r.claimed===1?'':'s'}.`);renderLoot();return}
  };
}

/* ------------------------------------------------------------------ */
/* 4. Chest open + reveal (opened from Storage)                        */
/* ------------------------------------------------------------------ */

/* The result is already stored and granted when this runs (chestOpen()
   commits before returning), so the reveal is pure presentation: closing
   the app or the dialog mid-way changes nothing, and the same record is
   shown again from "Unrevealed" until the player views it. */
function ecoOpenChest(ownedItemId){
  const res=chestOpen(ownedItemId);
  if(!res.ok){toast(res.reason==='no-eligible-items'||res.reason==='chest-unavailable'?'This chest is kept safe in Storage. It opens as soon as its reward pool is available.':'Couldn’t open that chest — nothing was changed.');return}
  ecoAfterEconomyChange();
  ecoShowReveal(res.opening.openingId);
}
function ecoShowReveal(openingId){
  const o=chestOpeningById(openingId);
  if(!o)return;
  const def=itemDefinitionById(o.itemDefinitionId),cfg=CHEST_CONFIG[o.chestId];
  modal(`<div class="inv-theme eco-dialog eco-reveal eco-reveal--${o.resolvedTier}"><div class="eco-reveal__lid" aria-hidden="true">▣</div><h2>${esc(cfg?cfg.label:'Chest')} opened</h2>
    <div class="eco-reveal__item"><div class="eco-listing__art" aria-hidden="true">${def?ecoGlyph(def):'◆'}</div><div><div class="eco-listing__name">${esc(def?def.name:o.itemDefinitionId)}</div>${def?ecoRarityTag(def):''}</div></div>
    <p class="eco-note">${o.forcedByPity?'Pity guarantee triggered. ':''}Added to Storage.</p>
    <div class="eco-confirm-actions"><button type="button" class="inv-btn" id="ecoRevealDone">Done</button></div></div>`);
  chestMarkRevealed(openingId);
  modalRoot.querySelector('#ecoRevealDone').onclick=()=>{closeModal();if(page==='storage'&&typeof renderInventory==='function')renderInventory()};
}

/* ------------------------------------------------------------------ */
/* 5. Home HUD indicator                                               */
/* ------------------------------------------------------------------ */

/* Unclaimed-rewards icon beside Gold in the Home Player HUD (Assay §4.2,
   Lyra §8.3). Filename binding `HUD_REWARDS_*.png` is deliberate so Lyra /
   Aurelia can swap final art without a code change. Hidden at 0; "9+" above
   9; the tap target opens Loot. */
function economyHudRewardsHTML(){
  const n=unclaimedRewardCount();
  if(n<=0)return '';
  const base='assets/Home/V3/Identity/HUD_REWARDS';
  return `<button type="button" class="hero-hud-loot" data-open-loot aria-label="${n} unclaimed reward${n===1?'':'s'} — open Loot"><img class="hero-info-icon hero-hud-loot__icon" src="${base}_40.png" srcset="${base}_40.png 1x, ${base}_80.png 2x" alt=""><span class="hero-hud-loot__badge">${n>9?'9+':n}</span></button>`;
}
