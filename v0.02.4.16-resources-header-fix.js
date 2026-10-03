/* RPG v0.02.4.16 — Resources header fix (2026-09-04, revised per
   home-definitive-spec.md which supersedes the original header-fix doc;
   further revised per Home Baseline Correction item 7).
   Reversible by setting HOME_RESOURCES_HEADER_HOTFIX=false below.

   "RESOURCES" is a centered section header, plain text (no banner image),
   matching Weather/Today. Trophy (Streaks & Milestones) and History sit in
   a right-hand control group; the reset countdown now sits UNDERNEATH the
   title (item 7 — it used to crowd the title on the same line) rather
   than beside the action controls.

   Overrides resourcesHeaderHTML() one more time (after v0.02.4-integration.js
   and v0.02.4.9's own override) — same override pattern already used by
   those files, just with a different final layout. Reuses the existing
   #resourcesResetCountdown id/class so v0.02.4.9's own countdown ticker and
   duplicate-guard keep working unmodified. Resource bars, quick-add,
   overflow/danger fill logic, and Food/Mind sub-grouping are untouched. */
const HOME_RESOURCES_HEADER_HOTFIX=true;

const v0416PreviousResourcesHeaderHTML=resourcesHeaderHTML;
resourcesHeaderHTML=function(){
  if(!HOME_RESOURCES_HEADER_HOTFIX)return v0416PreviousResourcesHeaderHTML();
  const reset=typeof v0249ResetCountdownText==='function'?v0249ResetCountdownText():'';
  return `<div class="resources-section-header home-section-header-v2 ${homeResourcesOpen?'expanded':'collapsed'}">
    <span></span>
    <div class="home-section-title-group">
      <button class="home-section-title" id="toggleResourcesSection" aria-expanded="${homeResourcesOpen}" aria-label="${homeResourcesOpen?'Collapse':'Expand'} Resources">Resources</button>
      <span class="resources-v2-reset" id="resourcesResetCountdown">${esc(reset)}</span>
    </div>
    <div class="home-section-controls">
      <button class="resources-v3-icon" id="resourceTrackerButton"><span>Tracker</span></button>
      <button class="resources-v3-icon" id="resourceHistoryButton"><span>History</span></button>
    </div>
  </div>`;
};

if(page==='home')renderHome();
