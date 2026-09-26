/* MASTER BUILD PHASE A (RPG-0093, 2026-09-25): this destination is now
   presented to the player as STORAGE (nav label + page titles) -- same
   system, same route id ('storage'), no fork (Lyra §7). Additions in this
   pass, all reading/calling the existing services: slot-aware Owned Gear
   (the nine functional slots), level requirement + effect lines on Item
   Detail, chest Open, elixir Use, a Sell shortcut that opens the Store's
   Sell stall (Store owns selling -- there is no second implementation
   here), and an unrevealed-chest banner.

   Inventory V1 — Phase B + Phase C (Astra, 2026-09-22, RPG-0018 + RPG-0019).
   Handover: docs/handovers/inventory-v1/ (Aurelia's visual board, frozen;
   Lyra's master handover + freeze annotations). Data layer:
   v0.02.36-inventory.js (Phase A, locked -- this file only READS it
   through its real functions, never re-implements grant/equip logic).

   PHASE B SCOPE (RPG-0018, accepted by Lyra 2026-09-22): Inventory Hub,
   All Items, the canonical Item Card (all 5 states: Normal/New/Equipped/
   Quest/Unknown, plus Favourite + stacked quantity), Item Detail, New
   state, Favourite state. Collections, Quest & Special sections, and
   real search/filter/sort are Phase D (RPG-0020), not built here; the
   Hub still shows honest placeholder sections for them (no fake
   controls).

   PHASE C SCOPE (RPG-0019, in progress): Owned Gear view only -- a new
   ENTRY POINT (a focused loadout grid, equipped items surfaced first),
   reusing the exact same canonical Item Card and the exact same
   equipItem()/unequipItem() Item Detail already wired in Phase B. No new
   equip mechanism, no permanent slot taxonomy invented -- Lyra's scope
   note, verbatim: "Owned Gear -> Equip/Unequip -> Equipment state ->
   derived modifiers -> Character." A mandatory review goes back to Lyra
   at the end of this phase (see the checklist in RPG-0019's own tracker
   notes) before Phase D starts.

   Two freeze annotations honoured throughout (VISUAL_FREEZE_NOTES.md):
     1. The five-button bottom nav on Aurelia's board is presentation-
        only. This file never renders it -- Inventory lives inside the
        existing global RPG navigation exactly like every other section.
     2. The jewel/teal accent on the board is test-only. --inv-accent
        (00-inv-tokens.css) uses the same warm antique gold every other
        dark-glass section already carries as its identity colour,
        never teal. */

/* ------------------------------------------------------------------ */
/* 1. Navigation                                                       */
/* ------------------------------------------------------------------ */

let invView='hub',invItemId=null,invQuery='',invCategoryFilter='all',invCollectionId=null;
/* Phase D filter/sort state -- All Items only, lives here rather than in
   a separate index (Lyra's Phase D rule: operate on existing data, no
   second index). Reset alongside everything else on Hub-open so a fresh
   entry from global nav never carries a stale filter forward. */
let invRarityFilter='all',invStatusFilter='all',invSort='recent',invFilterPanelOpen=false;
function invOpenHub(){invView='hub';invItemId=null;invQuery='';invCategoryFilter='all';invCollectionId=null;invRarityFilter='all';invStatusFilter='all';invSort='recent';invFilterPanelOpen=false}
function invGoHub(){invOpenHub();renderInventory();scrollTo(0,0)}
function invGoAll(category){invView='all';invItemId=null;if(category)invCategoryFilter=category;renderInventory();scrollTo(0,0)}
function invGoItem(ownedItemId){
  invView='item';invItemId=ownedItemId;
  markOwnedItemSeen(ownedItemId);/* Item Detail is the "actually seen it" moment -- clears New, never just rendering a card does (master handover §18). */
  renderInventory();scrollTo(0,0);
}
function invGoGear(){invView='gear';invItemId=null;renderInventory();scrollTo(0,0)}
function invGoCollections(){invView='collections';invItemId=null;renderInventory();scrollTo(0,0)}
function invGoCollectionDetail(collectionId){invView='collection';invCollectionId=collectionId;renderInventory();scrollTo(0,0)}
function invGoQuestSpecial(){invView='quest';invItemId=null;renderInventory();scrollTo(0,0)}

/* ------------------------------------------------------------------ */
/* 2. Small shared helpers                                             */
/* ------------------------------------------------------------------ */

const INV_RARITY_LABEL={common:'Common',uncommon:'Uncommon',rare:'Rare',epic:'Epic',legendary:'Legendary',celestial:'Celestial',mythic:'Mythic'};
const INV_KIND_LABEL={gear:'Gear',cosmetic:'Cosmetic',collectible:'Collectible',quest:'Quest Item',consumable:'Consumable',supply:'Supply',container:'Chest'};
/* Symbol-font glyph placeholder for an item with no real artworkRef yet
   (master handover: ItemDefinition.artworkRef is optional; art is a
   later Aurelia production pass, not blocked on by V1) -- same "no art
   yet, don't invent it" convention as Library's letter-monogram medallion. */
const INV_KIND_GLYPH={gear:'⚔',cosmetic:'✦',collectible:'✦',quest:'❖',consumable:'⬡',supply:'❖',container:'▣'};
function invKindGlyph(kind){return INV_KIND_GLYPH[kind]||'◆'}

function invOwnedItems(){return ensureInventoryState().ownedItems}
function invIsEquipped(ownedItemId){return ensureEquipmentState().equipped.includes(ownedItemId)}
function invTotalCount(){return invOwnedItems().length}
function invNewCount(){return invOwnedItems().filter(o=>o.isNew).length}

/* Category chip -> ItemDefinition.kind mapping. Hub's compact 4-chip set
   (All/Gear/Collections/Quest, per the review board) folds Cosmetic into
   Gear rather than giving it a 5th chip -- All Items' fuller filter set
   (Phase D) is where every kind gets its own filter. */
const INV_CATEGORY_KINDS={gear:['gear','cosmetic'],collections:['collectible'],quest:['quest'],cosmetic:['cosmetic'],collectible:['collectible'],supplies:['consumable','supply','container']};
function invMatchesCategory(def,cat){return cat==='all'||!INV_CATEGORY_KINDS[cat]||INV_CATEGORY_KINDS[cat].includes(def.kind)}

/* Phase D filter/sort -- operates on the existing owned-item array in
   memory, no separate index (Lyra's explicit Phase D rule). */
const INV_SORT_OPTIONS=[{id:'recent',label:'Recently Acquired'},{id:'oldest',label:'Oldest'},{id:'name-asc',label:'Name A–Z'},{id:'name-desc',label:'Name Z–A'},{id:'rarity',label:'Rarity'}];
const INV_RARITY_ORDER={mythic:-1,celestial:-0.5,legendary:0,epic:1,rare:2,uncommon:3,common:4};
function invMatchesStatus(owned,status){
  if(status==='all')return true;
  if(status==='equipped')return invIsEquipped(owned.id);
  if(status==='favourite')return Boolean(owned.isFavourite);
  if(status==='new')return Boolean(owned.isNew);
  return true;
}
function invSortList(list){
  const arr=list.slice();
  const nameOf=o=>{const d=itemDefinitionById(o.itemDefinitionId);return d?d.name:''};
  const rarityOf=o=>{const d=itemDefinitionById(o.itemDefinitionId);return INV_RARITY_ORDER[d&&d.rarity]??5};
  if(invSort==='oldest')arr.sort((a,b)=>String(a.acquiredAt||'').localeCompare(String(b.acquiredAt||'')));
  else if(invSort==='name-asc')arr.sort((a,b)=>nameOf(a).localeCompare(nameOf(b)));
  else if(invSort==='name-desc')arr.sort((a,b)=>nameOf(b).localeCompare(nameOf(a)));
  else if(invSort==='rarity')arr.sort((a,b)=>rarityOf(a)-rarityOf(b));
  else arr.sort((a,b)=>String(b.acquiredAt||'').localeCompare(String(a.acquiredAt||''))); // 'recent', also the default
  return arr;
}

/* ------------------------------------------------------------------ */
/* 3. Gold Summary (shared component, Hub + All Items)                 */
/* ------------------------------------------------------------------ */

function invGoldSummaryHTML(){
  return `<div class="inv-gold-summary">
    <div class="inv-gold-summary__stat"><span class="inv-gold-summary__icon" aria-hidden="true">\u{1F392}</span><div><div class="inv-gold-summary__num">${invTotalCount()} Item${invTotalCount()===1?'':'s'}</div>${invNewCount()?`<div class="inv-gold-summary__label">${invNewCount()} New</div>`:''}</div></div>
    <div class="inv-gold-summary__divider"></div>
    <div class="inv-gold-summary__stat"><span class="inv-gold-summary__icon inv-gold-summary__icon--gold" aria-hidden="true">\u{1FA99}</span><div><div class="inv-gold-summary__num${goldBalance()<0?' eco-negative':''}">${Number(goldBalance()).toLocaleString()}</div><div class="inv-gold-summary__label">Gold</div></div></div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 4. Canonical Item Card                                               */
/* ------------------------------------------------------------------ */

/* The ONE reusable card every list (Recently Acquired, All Items,
   Collections-later) composes -- master handover §11: "Do not create
   unrelated card implementations for each state." `owned` is a real
   OwnedItem row; pass {unknown:true} instead to render the spoiler-safe
   Undiscovered state (no live caller yet in Phase B -- Collections is
   Phase D -- but the component supports it now per §11/§20, verified via
   direct calls rather than live navigation this pass). */
function invItemCardHTML(owned){
  if(owned&&owned.unknown){
    return `<div class="inv-card is-unknown">
      <div class="inv-card__go" aria-hidden="true">
        <div class="inv-card__art"><span class="inv-card__art-glyph">?</span></div>
        <span class="inv-card__name">Undiscovered</span>
        <span class="inv-card__meta">???</span>
      </div>
    </div>`;
  }
  const def=itemDefinitionById(owned.itemDefinitionId);
  if(!def)return '';
  const equipped=invIsEquipped(owned.id);
  const cls=['inv-card'];
  if(equipped)cls.push('is-equipped');
  if(def.kind==='quest')cls.push('is-quest');
  let stateHTML='';
  if(equipped)stateHTML='<span class="inv-card__state">✓ Equipped</span>';
  else if(def.kind==='quest')stateHTML='<span class="inv-card__state">Quest Item</span>';
  return `<div class="${cls.join(' ')}">
    <button type="button" class="inv-card__fav${owned.isFavourite?' is-favourite':''}" data-inv-toggle-fav="${owned.id}" aria-label="${owned.isFavourite?'Remove from Favourites':'Add to Favourites'}" aria-pressed="${owned.isFavourite?'true':'false'}">${owned.isFavourite?'★':'☆'}</button>
    <button type="button" class="inv-card__go" data-inv-go-item="${owned.id}" aria-label="Open ${esc(def.name)}">
      ${owned.isNew?'<span class="inv-card__badge">New</span>':''}
      <div class="inv-card__art">${def.artworkRef?`<img src="${esc(asset(def.artworkRef))}" alt="">`:`<span aria-hidden="true">${invKindGlyph(def.kind)}</span>`}</div>
      ${owned.quantity>1?`<span class="inv-card__qty">×${owned.quantity}</span>`:''}
      <span class="inv-card__name">${esc(def.name)}</span>
      <span class="inv-card__meta"><span class="inv-card__rarity inv-card__rarity--${def.rarity||'common'}">${INV_RARITY_LABEL[def.rarity]||''}</span> · ${esc(INV_KIND_LABEL[def.kind]||def.category||'')}</span>
      ${stateHTML}
    </button>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 5. Row (Recently Acquired / Equipped preview)                       */
/* ------------------------------------------------------------------ */

function invRowHTML(owned){
  const def=itemDefinitionById(owned.itemDefinitionId);
  if(!def)return '';
  const equipped=invIsEquipped(owned.id);
  return `<button type="button" class="inv-row" data-inv-go-item="${owned.id}">
    <span class="inv-row__icon" aria-hidden="true">${def.artworkRef?`<img src="${esc(asset(def.artworkRef))}" alt="">`:invKindGlyph(def.kind)}</span>
    <span class="inv-row__body"><span class="inv-row__title">${esc(def.name)}${owned.quantity>1?` ×${owned.quantity}`:''}</span><span class="inv-row__sub">${INV_RARITY_LABEL[def.rarity]||''}${def.category?' · '+esc(def.category):''}</span></span>
    ${equipped?'<span class="inv-row__meta">✓ Equipped</span>':''}
  </button>`;
}

/* ------------------------------------------------------------------ */
/* 5b. Collection Card (Phase D, RPG-0020)                              */
/* ------------------------------------------------------------------ */

/* Progress is read fresh every render via collectionProgress() -- never
   stored on the card, never cached (Lyra's Phase D rule: derive, don't
   duplicate). Pips cap visually at 8 dots (matches the review board);
   the count text next to them is the real number regardless of size. */
function invCollectionCardHTML(col){
  const prog=collectionProgress(col.id);
  const pipCount=Math.min(prog.total,8);
  const pips=Array.from({length:pipCount},(_,i)=>`<span class="inv-pip${i<Math.round((prog.owned/prog.total)*pipCount)?' is-filled':''}"></span>`).join('');
  return `<button type="button" class="inv-collection-card" data-inv-go-collection="${esc(col.id)}">
    <span class="inv-collection-emblem" aria-hidden="true">${col.emblemRef?`<img src="${esc(asset(col.emblemRef))}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:50%">`:'✧'}</span>
    <span class="inv-collection-name">${esc(col.name)}</span>
    <span class="inv-collection-progress-text">${prog.owned} / ${prog.total} discovered</span>
    <span class="inv-pips">${pips}</span>
  </button>`;
}

/* ------------------------------------------------------------------ */
/* 6. Inventory Hub                                                     */
/* ------------------------------------------------------------------ */

/* A chest whose result is already committed but not yet viewed (the app was
   closed mid-reveal): show it again, never reroll. */
function invUnrevealedBannerHTML(){
  const pending=typeof chestPendingReveals==='function'?chestPendingReveals():[];
  if(!pending.length)return '';
  return `<div class="eco-banner" role="status"><span>${pending.length===1?'A chest you opened is waiting to be revealed.':`${pending.length} opened chests are waiting to be revealed.`}</span><button type="button" class="inv-btn" data-inv-reveal="${esc(pending[0].openingId)}">Reveal</button></div>`;
}
function invRenderHub(){
  const owned=invOwnedItems();
  const recent=owned.slice().sort((a,b)=>String(b.acquiredAt||'').localeCompare(String(a.acquiredAt||''))).slice(0,6);
  const equippedIds=ensureEquipmentState().equipped;
  const equippedItems=equippedIds.map(id=>owned.find(o=>o.id===id)).filter(Boolean);
  const questItems=owned.filter(o=>{const d=itemDefinitionById(o.itemDefinitionId);return d&&d.kind==='quest'});

  const categories=[{id:'all',label:'All'},{id:'gear',label:'Gear'},{id:'supplies',label:'Supplies'},{id:'collections',label:'Collections'},{id:'quest',label:'Quest'}];

  view.innerHTML=`<div class="inv-theme"><div class="inv-page">
    <div class="inv-header"><div class="inv-header-left"><h1 class="inv-title">Storage</h1></div><button type="button" class="inv-link" data-inv-go-store>Store →</button></div>
    ${invGoldSummaryHTML()}
    ${invUnrevealedBannerHTML()}
    <div class="inv-categories">${categories.map(c=>`<button type="button" class="inv-chip${invCategoryFilter===c.id?' is-active':''}" data-inv-category="${c.id}">${c.label}</button>`).join('')}</div>

    <div class="inv-shell">
      <div class="inv-section-head"><span class="inv-section-title">Recently Acquired</span>${owned.length>6?`<button type="button" class="inv-link" data-inv-see-all>See All →</button>`:''}</div>
      ${recent.length
        ?`<div class="inv-strip">${recent.map(o=>`<div style="flex:0 0 150px">${invItemCardHTML(o)}</div>`).join('')}</div>`
        :`<p class="inv-empty">Nothing in Storage yet. Claim a reward in Loot, or pick up supplies from the Store.</p>`}
    </div>

    <div class="inv-shell">
      <div class="inv-section-head"><span class="inv-section-title">Equipped</span><button type="button" class="inv-link" data-inv-go-gear>View All →</button></div>
      ${equippedItems.length
        ?`<div class="inv-rows">${equippedItems.map(invRowHTML).join('')}</div>`
        :`<p class="inv-empty">Nothing equipped. Equip a Gear item from its Item Detail page.</p>`}
    </div>

    <div class="inv-shell">
      <div class="inv-section-head"><span class="inv-section-title">Collections</span></div>
      ${allCollectionDefinitions().length
        ?`<div class="inv-collection-grid">${allCollectionDefinitions().map(invCollectionCardHTML).join('')}</div>`
        :`<p class="inv-empty">Collections are being prepared.</p>`}
    </div>

    <div class="inv-shell">
      <div class="inv-section-head"><span class="inv-section-title">Quest &amp; Special</span><button type="button" class="inv-link" data-inv-go-quest>View All →</button></div>
      ${questItems.length
        ?`<div class="inv-rows">${questItems.slice(0,4).map(invRowHTML).join('')}</div>`
        :`<p class="inv-empty">Quest and campaign items you're granted will appear here.</p>`}
    </div>
  </div></div>`;
  invBindNav();
}

/* ------------------------------------------------------------------ */
/* 7. All Items                                                        */
/* ------------------------------------------------------------------ */

const INV_TYPE_FILTER_OPTIONS=[{id:'all',label:'All'},{id:'gear',label:'Gear'},{id:'supplies',label:'Supplies'},{id:'cosmetic',label:'Cosmetic'},{id:'collectible',label:'Collectible'},{id:'quest',label:'Quest'}];
const INV_RARITY_FILTER_OPTIONS=[{id:'all',label:'All'},{id:'common',label:'Common'},{id:'uncommon',label:'Uncommon'},{id:'rare',label:'Rare'},{id:'epic',label:'Epic'},{id:'legendary',label:'Legendary'},{id:'celestial',label:'Celestial'}];
const INV_STATUS_FILTER_OPTIONS=[{id:'all',label:'All'},{id:'equipped',label:'Equipped'},{id:'favourite',label:'Favourite'},{id:'new',label:'New'}];

function invFilterPillsHTML(groupLabel,groupAttr,options,current){
  return `<div class="inv-filter-group"><span class="inv-filter-group-label">${esc(groupLabel)}</span><div class="inv-filter-options">${options.map(o=>`<button type="button" class="inv-filter-pill${current===o.id?' is-active':''}" data-inv-filter="${groupAttr}" data-inv-filter-value="${o.id}">${esc(o.label)}</button>`).join('')}</div></div>`;
}

function invRenderAll(){
  const q=invQuery.trim().toLowerCase();
  let list=invOwnedItems().filter(o=>{
    const def=itemDefinitionById(o.itemDefinitionId);
    if(!def)return false;
    if(!invMatchesCategory(def,invCategoryFilter))return false;
    if(invRarityFilter!=='all'&&def.rarity!==invRarityFilter)return false;
    if(!invMatchesStatus(o,invStatusFilter))return false;
    if(q&&def.name.toLowerCase().indexOf(q)===-1)return false;
    return true;
  });
  list=invSortList(list);
  const filtersActive=invCategoryFilter!=='all'||invRarityFilter!=='all'||invStatusFilter!=='all';

  view.innerHTML=`<div class="inv-theme"><div class="inv-page">
    <div class="inv-header"><div class="inv-header-left"><button type="button" class="inv-back" data-inv-back aria-label="Back to Storage">←</button><h1 class="inv-title">All Items</h1></div></div>
    ${invGoldSummaryHTML()}
    <div class="inv-toolbar">
      <div class="inv-search"><span class="inv-search__icon" aria-hidden="true">\u{1F50D}</span><input type="search" id="invSearchInput" placeholder="Search your items…" value="${esc(invQuery)}" autocomplete="off"></div>
      <button type="button" class="inv-filter-toggle${filtersActive?' is-active':''}" data-inv-toggle-filters>Filter${filtersActive?' •':''}</button>
      <select class="inv-sort-select" id="invSortSelect" aria-label="Sort">${INV_SORT_OPTIONS.map(o=>`<option value="${o.id}"${invSort===o.id?' selected':''}>${esc(o.label)}</option>`).join('')}</select>
    </div>
    <div class="inv-filter-panel inv-shell inv-shell--soft${invFilterPanelOpen?' is-open':''}" id="invFilterPanel">
      ${invFilterPillsHTML('Type','type',INV_TYPE_FILTER_OPTIONS,invCategoryFilter)}
      ${invFilterPillsHTML('Rarity','rarity',INV_RARITY_FILTER_OPTIONS,invRarityFilter)}
      ${invFilterPillsHTML('Status','status',INV_STATUS_FILTER_OPTIONS,invStatusFilter)}
      ${filtersActive?'<button type="button" class="inv-link" data-inv-reset-filters style="justify-self:start">Reset filters</button>':''}
    </div>
    <p class="inv-empty" style="padding-left:2px">Showing ${list.length} item${list.length===1?'':'s'}</p>
    ${list.length?`<div class="inv-grid">${list.map(invItemCardHTML).join('')}</div>`:`<p class="inv-empty">No items match. ${invQuery||filtersActive?'Try a different search or filter.':'Nothing owned in this category yet.'}</p>`}
  </div></div>`;
  invBindNav();
  const input=document.querySelector('#invSearchInput');
  if(input){
    input.addEventListener('input',()=>{invQuery=input.value;invRenderAll();
      const el=document.querySelector('#invSearchInput');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}
    });
  }
  const sortSel=document.querySelector('#invSortSelect');
  if(sortSel)sortSel.addEventListener('change',()=>{invSort=sortSel.value;invRenderAll()});
}

/* ------------------------------------------------------------------ */
/* 7b. Owned Gear (Phase C, RPG-0019)                                   */
/* ------------------------------------------------------------------ */

/* master handover §7 lists Owned Gear as its own page, distinct from All
   Items -- a focused loadout view (every equippable item, equipped ones
   surfaced first) rather than the general browse-everything grid. Reuses
   the exact same canonical Item Card/grid the rest of Phase B already
   uses -- no new card system, no new equip mechanism (still only
   equipItem()/unequipItem(), wired through Item Detail's own button, the
   same as before -- this page is a new ENTRY POINT, not new equip logic). */
/* The nine functional slots (state.equipment.slots -- the one authority).
   An occupied slot opens that item's detail; an empty one just says so. */
function invSlotGridHTML(){
  const eq=ensureEquipmentState(),owned=invOwnedItems();
  return `<div class="inv-shell"><div class="inv-section-head"><span class="inv-section-title">Equipped</span></div><div class="eco-slot-grid" role="list">${EQUIPMENT_SLOTS.map(k=>{
    const o=eq.slots[k]!=null?owned.find(x=>x.id===eq.slots[k]):null,def=o?itemDefinitionById(o.itemDefinitionId):null;
    return o&&def
      ?`<button type="button" role="listitem" class="eco-slot is-filled" data-inv-go-item="${o.id}" aria-label="${esc(EQUIPMENT_SLOT_LABEL[k])}: ${esc(def.name)}"><span class="eco-slot__label">${esc(EQUIPMENT_SLOT_LABEL[k])}</span><span class="eco-slot__name">${esc(def.name)}</span><span class="inv-card__rarity inv-card__rarity--${def.rarity||'common'}">${esc(INV_RARITY_LABEL[def.rarity]||'')}</span></button>`
      :`<div role="listitem" class="eco-slot" aria-label="${esc(EQUIPMENT_SLOT_LABEL[k])}: empty"><span class="eco-slot__label">${esc(EQUIPMENT_SLOT_LABEL[k])}</span><span class="eco-slot__empty">Empty</span></div>`;
  }).join('')}</div></div>`;
}
/* RPG-0023 (2026-09-25): the Character page's Equipment page. Nine slots; tap a slot to see what you own for it and
   equip/unequip right here. It calls the SAME equipItem/unequipItem as Storage > Owned Gear (one authority, no second
   equip path); gear only ever changes flat Damage/Defence/stat bonuses. `charEqSlot` is the slot currently open. */
let charEqSlot=null;
function charEqOwnedFor(slot){
  const baseSlot=slot==='ACCESSORY_1'||slot==='ACCESSORY_2'?'ACCESSORY':slot;
  return invOwnedItems().map(o=>({o,def:itemDefinitionById(o.itemDefinitionId)})).filter(x=>x.def&&x.def.equippable&&x.def.kind!=='cosmetic'&&x.def.slot===baseSlot);
}
function charEqBodyHTML(){
  const eq=ensureEquipmentState(),owned=invOwnedItems();
  const rows=EQUIPMENT_SLOTS.map(k=>{
    const o=eq.slots[k]!=null?owned.find(x=>x.id===eq.slots[k]):null,def=o?itemDefinitionById(o.itemDefinitionId):null;
    const lines=def&&typeof ecoEffectLines==='function'?ecoEffectLines(def):[];
    const openNow=charEqSlot===k,cands=openNow?charEqOwnedFor(k):[];
    const head=`<button type="button" class="char-eq-row ${def?'is-filled':''} ${openNow?'is-open':''}" data-char-eq-slot="${k}" aria-expanded="${openNow}"><span class="char-eq-slot">${esc(EQUIPMENT_SLOT_LABEL[k])}</span><span class="char-eq-item ${def?'':'char-eq-empty'}">${def?`<b>${esc(def.name)}</b>${lines.length?`<small>${lines.map(esc).join(' · ')}</small>`:''}`:'Empty'}</span></button>`;
    if(!openNow)return `<li>${head}</li>`;
    const list=cands.length?cands.map(({o:it,def:d})=>{
      const worn=EQUIPMENT_SLOTS.some(s2=>eq.slots[s2]===it.id),here=eq.slots[k]===it.id;
      const chk=canEquipOwnedItem(it.id,k),why=chk.ok?'':chk.reason==='level-too-low'?`Needs level ${chk.required}`:'Cannot equip';
      const ls=typeof ecoEffectLines==='function'?ecoEffectLines(d):[];
      return `<div class="char-eq-cand"><span><b>${esc(d.name)}</b>${ls.length?`<small>${ls.map(esc).join(' · ')}</small>`:''}${worn&&!here?'<small>Worn in another slot</small>':''}</span>${here?`<button type="button" class="rpg-btn" data-char-eq-off="${it.id}">Unequip</button>`:chk.ok?`<button type="button" class="rpg-btn accent" data-char-eq-on="${it.id}" data-slot="${k}">Equip</button>`:`<span class="helper">${esc(why)}</span>`}</div>`;
    }).join(''):`<p class="helper">You don't own anything for this slot yet. Basic gear is sold in the Store's Armoury (unlocks at Level 3).</p>`;
    return `<li>${head}<div class="char-eq-picker">${list}</div></li>`;
  }).join('');
  const mods=eq.statModifiers||{},totals=Object.entries(mods).filter(([k,v])=>Number(v)).map(([k,v])=>`${esc((typeof STAT_NAMES!=='undefined'&&STAT_NAMES[k])||k.charAt(0).toUpperCase()+k.slice(1))} ${Number(v)>0?'+':''}${Math.round(Number(v)*100)/100}`);
  const count=EQUIPMENT_SLOTS.filter(k=>eq.slots[k]!=null).length;
  return `<h2>Equipment</h2><p class="helper">${count?`${count} of ${EQUIPMENT_SLOTS.length} slots filled.`:'Nothing equipped yet.'} Tap a slot to change it.</p>
    <ul class="char-eq-list" aria-label="Equipment slots">${rows}</ul>
    <div class="modal-section"><h3>From your gear</h3><p class="helper" id="charEqTotals">${totals.length?totals.join(' · '):'No bonuses yet.'}</p></div>
    <button type="button" class="rpg-btn" id="charEqOpenGear" style="width:100%">Open Owned Gear</button>`;
}
function characterEquipmentModal(){
  charEqSlot=null;
  modal(`<div id="charEqRoot">${charEqBodyHTML()}</div>`);
  charEqBind();
}
function charEqRerender(){
  const r=document.querySelector('#charEqRoot');if(!r)return;
  r.innerHTML=charEqBodyHTML();charEqBind();
  if(page==='character'&&typeof renderCharacter==='function'){try{renderCharacter()}catch(e){}}
}
function charEqBind(){
  const r=document.querySelector('#charEqRoot');if(!r)return;
  r.querySelectorAll('[data-char-eq-slot]').forEach(b=>b.onclick=()=>{charEqSlot=charEqSlot===b.dataset.charEqSlot?null:b.dataset.charEqSlot;charEqRerender()});
  r.querySelectorAll('[data-char-eq-on]').forEach(b=>b.onclick=()=>{
    const res=equipItem(Number.isNaN(Number(b.dataset.charEqOn))?b.dataset.charEqOn:Number(b.dataset.charEqOn),b.dataset.slot);
    if(res&&res.equipped)toast('Equipped.');else toast(res&&res.reason==='level-too-low'?`Needs level ${res.required}.`:'Cannot equip that.');
    charEqRerender();
  });
  r.querySelectorAll('[data-char-eq-off]').forEach(b=>b.onclick=()=>{unequipItem(Number.isNaN(Number(b.dataset.charEqOff))?b.dataset.charEqOff:Number(b.dataset.charEqOff));toast('Unequipped.');charEqRerender()});
  const g=r.querySelector('#charEqOpenGear');
  if(g)g.onclick=()=>{closeModal();setPage('storage');if(typeof invGoGear==='function')invGoGear()};
}
function invRenderGear(){
  const gear=invOwnedItems().filter(o=>{const d=itemDefinitionById(o.itemDefinitionId);return d&&d.equippable}).sort((a,b)=>{
    const ae=invIsEquipped(a.id)?0:1,be=invIsEquipped(b.id)?0:1;
    if(ae!==be)return ae-be;
    return String(b.acquiredAt||'').localeCompare(String(a.acquiredAt||''));
  });
  view.innerHTML=`<div class="inv-theme"><div class="inv-page">
    <div class="inv-header"><div class="inv-header-left"><button type="button" class="inv-back" data-inv-back aria-label="Back to Storage">←</button><h1 class="inv-title">Owned Gear</h1></div></div>
    ${invGoldSummaryHTML()}
    ${invSlotGridHTML()}
    <p class="inv-empty" style="padding-left:2px">${gear.length} equippable item${gear.length===1?'':'s'}${ensureEquipmentState().equipped.length?` · ${ensureEquipmentState().equipped.length} equipped`:''}</p>
    ${gear.length?`<div class="inv-grid">${gear.map(invItemCardHTML).join('')}</div>`:`<p class="inv-empty">Nothing equippable yet. Gear you earn will appear here.</p>`}
  </div></div>`;
  invBindNav();
}

/* ------------------------------------------------------------------ */
/* 8. Item Detail                                                       */
/* ------------------------------------------------------------------ */

function invRenderItem(){
  const owned=invOwnedItems().find(o=>o.id===invItemId);
  if(!owned){invGoHub();return}
  const def=itemDefinitionById(owned.itemDefinitionId);
  if(!def){invGoHub();return}
  const equipped=invIsEquipped(owned.id);

  view.innerHTML=`<div class="inv-theme"><div class="inv-page">
    <div class="inv-header">
      <div class="inv-header-left"><button type="button" class="inv-back" data-inv-back aria-label="Back">←</button></div>
      <button type="button" class="inv-card__fav${owned.isFavourite?' is-favourite':''}" style="position:static" data-inv-toggle-fav="${owned.id}" aria-label="${owned.isFavourite?'Remove from Favourites':'Add to Favourites'}" aria-pressed="${owned.isFavourite?'true':'false'}">${owned.isFavourite?'★':'☆'}</button>
    </div>

    <div class="inv-detail-hero">
      <div class="inv-detail-art">${def.artworkRef?`<img src="${esc(asset(def.artworkRef))}" alt="">`:`<span aria-hidden="true">${invKindGlyph(def.kind)}</span>`}</div>
      <div><div class="inv-detail-name">${esc(def.name)}</div><div class="inv-detail-meta"><span class="inv-card__rarity inv-card__rarity--${def.rarity||'common'}">${INV_RARITY_LABEL[def.rarity]||''}</span><span>·</span><span>${esc(INV_KIND_LABEL[def.kind]||def.category||'')}</span>${owned.quantity>1?`<span>· ×${owned.quantity}</span>`:''}</div></div>
      ${equipped?'<span class="inv-detail-equipped-tag">✓ Currently Equipped</span>':''}
    </div>

    ${def.description?`<div class="inv-shell"><span class="inv-section-title">Description</span><p style="color:var(--inv-text-secondary);font-size:.92rem;margin:0">${esc(def.description)}</p></div>`:''}

    <div class="inv-shell">
      <span class="inv-section-title">Details</span>
      <div class="inv-fact-row"><span class="inv-fact-label">Acquired</span><span class="inv-fact-value">${owned.acquiredAt?fmtDate(owned.acquiredAt.slice(0,10)):'—'}</span></div>
      <div class="inv-fact-row"><span class="inv-fact-label">Source</span><span class="inv-fact-value">${esc(invSourceLabel(owned.sourceType))}</span></div>
      ${def.collectionId&&collectionById(def.collectionId)?`<div class="inv-fact-row"><span class="inv-fact-label">Collection</span><button type="button" class="inv-link" data-inv-go-collection="${esc(def.collectionId)}" style="font-size:.92rem">${esc(collectionById(def.collectionId).name)} →</button></div>`:''}
    </div>

    ${invDetailEffectsHTML(def)}
    ${def.container&&chestAvailability(def.container.chestId).available?ecoChestInfoHTML(def.container.chestId):''}
    ${invDetailActionsHTML(owned,def,equipped)}
  </div></div>`;
  invBindNav();
}

/* Effects and requirements straight from the template (Assay's numbers). */
function invDetailEffectsHTML(def){
  const lines=typeof ecoEffectLines==='function'?ecoEffectLines(def):[];
  const slot=def.slot?(EQUIPMENT_SLOT_LABEL[def.slot==='ACCESSORY'?'ACCESSORY_1':def.slot]||def.slot):'';
  const active=(def.consumable&&def.consumable.effectId==='BUFF_STAT_PCT')?economyActiveBuff(String(def.consumable.stat).toLowerCase()):null;
  if(!lines.length&&!slot&&!def.levelRequirement)return '';
  return `<div class="inv-shell"><span class="inv-section-title">Effects</span>
    ${slot?`<div class="inv-fact-row"><span class="inv-fact-label">Slot</span><span class="inv-fact-value">${esc(def.slot==='ACCESSORY'?'Accessory':slot)}</span></div>`:''}
    ${def.kind==='gear'&&def.levelRequirement?`<div class="inv-fact-row"><span class="inv-fact-label">Requires</span><span class="inv-fact-value">Level ${def.levelRequirement}</span></div>`:''}
    ${lines.map(l=>`<div class="inv-fact-row"><span class="inv-fact-label">Effect</span><span class="inv-fact-value">${esc(l)}</span></div>`).join('')}
    ${active?`<p class="eco-note eco-note--warn">A ${esc(String(def.consumable.stat))} elixir is already active; using another replaces it.</p>`:''}
  </div>`;
}
/* Every action here calls an existing service: equip/unequip (equipment
   authority), economyUseConsumable, chestOpen (via ecoOpenChest), and the
   Store's Sell stall. Nothing here mutates money or items itself. */
function invDetailActionsHTML(owned,def,equipped){
  const parts=[];
  if(def.equippable){
    const chk=canEquipOwnedItem(owned.id);
    const label=equipped?'Unequip':(def.kind==='cosmetic'?'Wear':'Equip');
    const dis=!equipped&&!chk.ok;
    parts.push(`<button type="button" class="inv-btn${equipped?' inv-btn--ghost':''}" data-inv-toggle-equip="${owned.id}" ${dis?'disabled':''}>${label}</button>`);
    if(dis)parts.push(`<p class="eco-note eco-note--warn">${chk.reason==='level-too-low'?`Requires Level ${chk.required} (you are Level ${Number(state.level||1)}).`:'This can’t be equipped.'}</p>`);
  }
  if(def.container){
    const av=chestAvailability(def.container.chestId);
    parts.push(av.available?`<button type="button" class="inv-btn" data-inv-open-chest="${owned.id}">Open chest</button>`:`<button type="button" class="inv-btn" disabled>Open chest</button><p class="eco-note">This chest is kept safe in Storage. It can’t be opened yet — it becomes openable as soon as its reward pool is available.</p>`);
  }
  if(def.consumable){
    const usable=def.consumable.effectId==='BUFF_STAT_PCT';
    if(def.kind==='consumable')parts.push(`<button type="button" class="inv-btn${usable?'':' inv-btn--ghost'}" data-inv-use="${owned.id}" ${usable?'':'disabled'}>Use</button>${usable?'':'<p class="eco-note">Usable during campaigns.</p>'}`);
  }
  const q=typeof storeSellQuote==='function'?storeSellQuote(owned.id,1):{ok:false};
  if(q.ok)parts.push(`<button type="button" class="inv-btn inv-btn--ghost" data-inv-sell="${owned.id}">Sell in Store · ${q.each} g</button>`);
  return parts.length?`<div class="eco-actions" style="display:grid;gap:8px">${parts.join('')}</div>`:'';
}

/* Plain, honest source labels -- no invented narrative copy per source,
   just what's actually known (sourceType/sourceRef from Phase A). */
function invSourceLabel(sourceType){
  const labels={quest:'Quest reward','dev-seed':'Development fixture',achievement:'Achievement reward',campaign:'Campaign reward',shop:'Bought in the Store',chest:'Chest',buyback:'Bought back',reward:'Loot'};
  return labels[sourceType]||(sourceType?sourceType.charAt(0).toUpperCase()+sourceType.slice(1):'Unknown');
}

/* ------------------------------------------------------------------ */
/* 8b. Collections list + Collection Detail (Phase D, RPG-0020)         */
/* ------------------------------------------------------------------ */

function invRenderCollections(){
  const cols=allCollectionDefinitions();
  view.innerHTML=`<div class="inv-theme"><div class="inv-page">
    <div class="inv-header"><div class="inv-header-left"><button type="button" class="inv-back" data-inv-back aria-label="Back to Storage">←</button><h1 class="inv-title">Collections</h1></div></div>
    ${cols.length?`<div class="inv-collection-grid">${cols.map(invCollectionCardHTML).join('')}</div>`:`<p class="inv-empty">Collections are being prepared.</p>`}
  </div></div>`;
  invBindNav();
}

/* Collection Detail -- the one live consumer of invItemCardHTML's Unknown
   state (built in Phase B, unused until now per that section's own
   comment). A collection member that isn't owned renders as {unknown:true}
   -- master handover §20: "must not expose real name, recognisable
   artwork, ... description" for a hiddenUntilOwned item the player
   doesn't own yet. Owned members render as the real, normal card. */
function invRenderCollectionDetail(){
  const col=collectionById(invCollectionId);
  if(!col){invGoCollections();return}
  const prog=collectionProgress(col.id);
  const owned=invOwnedItems();
  const slots=col.itemDefinitionIds.map(defId=>{
    const ownedRow=owned.find(o=>o.itemDefinitionId===defId);
    return ownedRow||{unknown:true};
  });
  const pct=prog.total?Math.round((prog.owned/prog.total)*100):0;

  view.innerHTML=`<div class="inv-theme"><div class="inv-page">
    <div class="inv-header"><div class="inv-header-left"><button type="button" class="inv-back" data-inv-back-collections aria-label="Back to Collections">←</button><h1 class="inv-title">${esc(col.name)}</h1></div></div>
    ${col.description?`<p class="inv-detail-desc">${esc(col.description)}</p>`:''}
    <div class="inv-shell">
      <div class="inv-section-head"><span class="inv-section-title">${prog.owned} / ${prog.total} Discovered</span></div>
      <div class="inv-progress-bar"><i style="width:${pct}%"></i></div>
    </div>
    <div class="inv-grid">${slots.map(invItemCardHTML).join('')}</div>
  </div></div>`;
  invBindNav();
}

/* ------------------------------------------------------------------ */
/* 8c. Quest & Special (Phase D, RPG-0020) -- a view, not a new store.  */
/* Exactly the Owned Gear shape: reuses the canonical card/grid, filters */
/* the SAME owned-item array by kind==='quest'. No new ownership model. */
/* ------------------------------------------------------------------ */

function invRenderQuestSpecial(){
  const quest=invOwnedItems().filter(o=>{const d=itemDefinitionById(o.itemDefinitionId);return d&&d.kind==='quest'})
    .sort((a,b)=>String(b.acquiredAt||'').localeCompare(String(a.acquiredAt||'')));
  view.innerHTML=`<div class="inv-theme"><div class="inv-page">
    <div class="inv-header"><div class="inv-header-left"><button type="button" class="inv-back" data-inv-back aria-label="Back to Storage">←</button><h1 class="inv-title">Quest &amp; Special</h1></div></div>
    ${invGoldSummaryHTML()}
    <p class="inv-empty" style="padding-left:2px">${quest.length} item${quest.length===1?'':'s'}</p>
    ${quest.length?`<div class="inv-grid">${quest.map(invItemCardHTML).join('')}</div>`:`<p class="inv-empty">Quest and campaign items you're granted will appear here.</p>`}
  </div></div>`;
  invBindNav();
}

/* ------------------------------------------------------------------ */
/* 9. Router + binding                                                  */
/* ------------------------------------------------------------------ */

function renderInventory(){
  if(page!=='storage')return;
  if(invView==='all')return invRenderAll();
  if(invView==='gear')return invRenderGear();
  if(invView==='collections')return invRenderCollections();
  if(invView==='collection')return invRenderCollectionDetail();
  if(invView==='quest')return invRenderQuestSpecial();
  if(invView==='item')return invRenderItem();
  return invRenderHub();
}

/* Owned item ids are numbers (uid()), but every dataset.* read is always
   a string -- a bare === comparison against owned.id silently fails for
   every one of these (found live while verifying: an Equip click did
   nothing, no error, because "123"===123 is false). Number(...) on every
   id read from a data attribute, matching the same fix already applied
   elsewhere in this codebase (e.g. Number(b.dataset.trainingStart)). */
function invBindNav(){
  const root=document.querySelector('.inv-theme');
  if(!root)return;
  root.onclick=e=>{
    const back=e.target.closest('[data-inv-back]');if(back){invGoHub();return}
    const backCol=e.target.closest('[data-inv-back-collections]');if(backCol){invGoCollections();return}
    const seeAll=e.target.closest('[data-inv-see-all]');if(seeAll){invGoAll();return}
    const goGear=e.target.closest('[data-inv-go-gear]');if(goGear){invGoGear();return}
    const goQuest=e.target.closest('[data-inv-go-quest]');if(goQuest){invGoQuestSpecial();return}
    const goCol=e.target.closest('[data-inv-go-collection]');if(goCol){invGoCollectionDetail(goCol.dataset.invGoCollection);return}
    const cat=e.target.closest('[data-inv-category]');if(cat){invGoAll(cat.dataset.invCategory);return}
    const fav=e.target.closest('[data-inv-toggle-fav]');
    if(fav){toggleOwnedItemFavourite(Number(fav.dataset.invToggleFav));renderInventory();return}
    const eq=e.target.closest('[data-inv-toggle-equip]');
    if(eq){
      const id=Number(eq.dataset.invToggleEquip);
      if(invIsEquipped(id))unequipItem(id);
      else{const r=equipItem(id);if(!r.equipped)toast(r.reason==='level-too-low'?`Requires Level ${r.required}.`:'Can’t equip that.')}
      renderInventory();return;
    }
    const toggleFilters=e.target.closest('[data-inv-toggle-filters]');
    if(toggleFilters){invFilterPanelOpen=!invFilterPanelOpen;renderInventory();return}
    const filterPill=e.target.closest('[data-inv-filter]');
    if(filterPill){
      const group=filterPill.dataset.invFilter,value=filterPill.dataset.invFilterValue;
      if(group==='type')invCategoryFilter=value;
      else if(group==='rarity')invRarityFilter=value;
      else if(group==='status')invStatusFilter=value;
      renderInventory();return;
    }
    const resetFilters=e.target.closest('[data-inv-reset-filters]');
    if(resetFilters){invCategoryFilter='all';invRarityFilter='all';invStatusFilter='all';renderInventory();return}
    const goStore=e.target.closest('[data-inv-go-store]');if(goStore){setPage('store');return}
    const reveal=e.target.closest('[data-inv-reveal]');if(reveal){ecoShowReveal(reveal.dataset.invReveal);return}
    const openChest=e.target.closest('[data-inv-open-chest]');
    if(openChest&&!openChest.disabled){openChest.disabled=true;ecoOpenChest(Number(openChest.dataset.invOpenChest));if(page==='storage')invGoHub();return}
    const useItem=e.target.closest('[data-inv-use]');
    if(useItem&&!useItem.disabled){
      useItem.disabled=true;
      const r=economyUseConsumable(Number(useItem.dataset.invUse));
      toast(r.ok?'Elixir active.':(r.message||'Can’t use that right now.'));
      if(r.ok)invGoHub();else renderInventory();
      return;
    }
    const sellItem=e.target.closest('[data-inv-sell]');if(sellItem){storeOpenSell(Number(sellItem.dataset.invSell));return}
    const go=e.target.closest('[data-inv-go-item]');if(go){invGoItem(Number(go.dataset.invGoItem));return}
  };
}
