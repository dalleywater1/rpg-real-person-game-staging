/* Test tools (Jay 2026-09-25: "a test variant of the repo so I can push adventure stages to test that they trigger").
   NOT for players. It is inert unless BOTH are true:
     1. this is a test surface: localhost, or a deployed build whose version.json says environment "staging" (RPG TEST); and
     2. the tester opted in with ?devtools=1 on the URL (remembered in localStorage; ?devtools=0 turns it off).
   A production/Play build has no environment "staging", so the tools never appear there.
   It only pushes distance through the REAL movement paths (creditCampaignMovement / creditJourneyMovement), so every stage
   trigger, discovery and reward fires exactly as if the player had walked there. It creates no fake Training activity, so
   no Training XP or Training achievements are produced. Snapshot/Restore protects the tester's real save. */
(function(){
  const FLAG='rpg_devtools_enabled_v1',SNAP='rpg_devtools_snapshot_v1';
  let allowed=false;
  function safe(fn,fb){try{return fn()}catch(e){return fb}}
  try{
    const q=new URLSearchParams(location.search).get('devtools');
    if(q==='1')localStorage.setItem(FLAG,'1');
    if(q==='0')localStorage.removeItem(FLAG);
  }catch(e){}
  const optedIn=()=>safe(()=>localStorage.getItem(FLAG)==='1',false);
  const isLocal=()=>/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  function surfaceOk(){
    if(isLocal())return Promise.resolve(true);
    return fetch('version.json',{cache:'no-store'}).then(r=>r.json()).then(v=>v&&v.environment==='staging').catch(()=>false);
  }
  const LF='lost-fortress';
  const el=(h)=>{const d=document.createElement('div');d.innerHTML=h;return d.firstElementChild};

  function campaignSummary(){
    const c=ensureAdventureState()[LF];
    const stage=(LOST_FORTRESS_STAGES[lostFortressStageIndex(c.currentStage)]||{}).name||'—';
    return {c,stage,html:c.started
      ?`Stage: <b>${esc(stage)}</b> · ${Number(c.routeProgressKm||0).toFixed(1)} / ${c.routeTargetKm} km${Number(c.bankedKm)>0?` · <b>${Number(c.bankedKm).toFixed(1)} km banked</b>`:''}${c.completedAt?' · <b>COMPLETE</b>':''}`
      :'Not started'};
  }
  function flagsHTML(c){
    const f=[['Quentin met',c.quentin&&c.quentin.discovered],['Echo can be found',c.echo&&c.echo.stageUnlocked],['Echo state',c.echo&&c.echo.state],['Yeti',c.yeti&&c.yeti.state],['Fragments',`${c.pinnacleMapFragments||0}/4`],['Fourfold Trail',(state.hunts&&state.hunts['RPG-0032'])?'unlocked':'hidden']];
    return f.map(([k,v])=>`<span class="dt-flag"><small>${esc(k)}</small> ${esc(String(v===true?'yes':v===false||v==null?'no':v))}</span>`).join('');
  }
  function stageButtons(c){
    return LOST_FORTRESS_STAGES.map((s,i)=>`<button type="button" class="rpg-btn small" data-dt-stage="${i}" ${c.started&&!c.completedAt?'':'disabled'}>${i+1}. ${esc(s.name)} · ${s.startKm} km</button>`).join('');
  }
  function html(){
    const {c,html:sum}=campaignSummary();
    const journeys=safe(()=>activeJourneyIds(),[]);
    return `<h2>Test tools</h2>
      <p class="helper"><b>TEST BUILD ONLY.</b> Pushes distance through the real movement paths, so stage triggers fire for real. Take a snapshot first; Restore puts your save back.</p>
      <div class="modal-section"><h3>Save safety</h3>
        <div class="dt-row"><button type="button" class="rpg-btn small" data-dt="snap">Snapshot save</button><button type="button" class="rpg-btn small" data-dt="restore" ${localStorage.getItem(SNAP)?'':'disabled'}>Restore snapshot</button></div>
        <p class="helper" id="dtSnapInfo">${localStorage.getItem(SNAP)?'A snapshot is stored.':'No snapshot yet.'}</p></div>
      <div class="modal-section"><h3>Call to the Lost Fortress</h3>
        <p id="dtSummary">${sum}</p><div class="dt-flags">${flagsHTML(c)}</div>
        <div class="dt-row"><button type="button" class="rpg-btn small accent" data-dt="start" ${c.started&&!c.completedAt?'disabled':''}>Start run</button>
          <button type="button" class="rpg-btn small" data-dt="restart">Restart run</button>
          <button type="button" class="rpg-btn small" data-dt="skipvillage" ${c.started&&!c.completedAt&&c.currentStage==='stage-1-mountain-village'?'':'disabled'}>Skip village</button>
          <button type="button" class="rpg-btn small" data-dt="opengate" ${c.started&&!c.completedAt?'':'disabled'}>Open this stage's gate</button></div>
        <div class="dt-row"><span class="helper">Add distance:</span>${[1,5,10,20].map(n=>`<button type="button" class="rpg-btn small" data-dt-km="${n}" ${c.started&&!c.completedAt?'':'disabled'}>+${n} km</button>`).join('')}</div>
        <p class="helper">Jump to the start of a stage:</p><div class="dt-stages">${stageButtons(c)}</div></div>
      <div class="modal-section"><h3>Journeys</h3>
        <p class="helper">${journeys.length?`Active: ${journeys.map(esc).join(', ')}`:'No active Journey. Start one in Adventures > Journeys.'}</p>
        <div class="dt-row"><select id="dtJType"><option>Walking</option><option>Running</option><option>Hiking</option><option>Cycling</option></select>${[1,5,10,25].map(n=>`<button type="button" class="rpg-btn small" data-dt-jkm="${n}" ${journeys.length?'':'disabled'}>+${n} km</button>`).join('')}</div></div>
      <p class="helper" id="dtMsg"></p>`;
  }
  function say(t){const m=document.querySelector('#dtMsg');if(m)m.textContent=t}
  function rerender(){const r=document.querySelector('#dtRoot');if(!r)return;r.innerHTML=html();bind();if(typeof renderQuestsArea==='function'&&page==='adventures'){try{renderQuestsArea()}catch(e){}}}
  function credit(km){
    const c=ensureAdventureState()[LF];if(!c.started||c.completedAt)return say('Start a run first.');
    const before=c.currentStage;
    creditCampaignMovement({distance:km,type:'Walking',source:'Test tools'});
    const now=ensureAdventureState()[LF];
    rerender();say(before!==now.currentStage?`Advanced to ${(LOST_FORTRESS_STAGES[lostFortressStageIndex(now.currentStage)]||{}).name}.`:`Added ${km} km.`);
  }
  function bind(){
    const r=document.querySelector('#dtRoot');if(!r)return;
    r.querySelectorAll('[data-dt-km]').forEach(b=>b.onclick=()=>credit(Number(b.dataset.dtKm)));
    r.querySelectorAll('[data-dt-stage]').forEach(b=>b.onclick=()=>{
      const c=ensureAdventureState()[LF],s=LOST_FORTRESS_STAGES[Number(b.dataset.dtStage)];
      const need=s.startKm-Number(c.routeProgressKm||0);
      if(need<=0)return say('Already at or past that stage.');
      credit(Math.round((need+0.01)*100)/100);
    });
    r.querySelectorAll('[data-dt-jkm]').forEach(b=>b.onclick=()=>{
      const t=(r.querySelector('#dtJType')||{}).value||'Walking';
      creditJourneyMovement({distance:Number(b.dataset.dtJkm),type:t,source:'Test tools'});save();rerender();say(`Credited ${b.dataset.dtJkm} km (${t}) to active Journeys.`);
    });
    const act=(name,fn)=>{const b=r.querySelector(`[data-dt="${name}"]`);if(b)b.onclick=fn};
    act('start',()=>{questStartOrContinue(LF);save();rerender();say('Run started.')});
    act('restart',()=>{const c=ensureAdventureState()[LF];c.started=false;campaignStart(LF);save();rerender();say('Run restarted from Stage 1.')});
    act('skipvillage',()=>{const cid=LF;campaignEnterVillage(cid);campaignVillageSearch(cid);campaignVillageSearch(cid);campaignLeaveVillage(cid);save();rerender();say('Village skipped (entered, two searches, left).')});
    act('opengate',()=>{const c=ensureAdventureState()[LF];const req=campaignRequiredEvents(c.currentStage);req.forEach(r=>campaignResolveRequired(LF,r.id));rerender();say(req.length?'Gate opened; banked distance released.':'This stage has no mandatory events.')});
    act('snap',()=>{try{save();localStorage.setItem(SNAP,localStorage.getItem(KEY));rerender();say('Snapshot saved.')}catch(e){say('Snapshot failed.')}});
    act('restore',()=>{try{const s=localStorage.getItem(SNAP);if(!s)return say('No snapshot.');localStorage.setItem(KEY,s);say('Restored. Reloading...');setTimeout(()=>location.reload(),400)}catch(e){say('Restore failed.')}});
  }
  function open(){modal(`<div id="dtRoot">${html()}</div>`);bind()}
  function mount(){
    if(document.querySelector('#dtFab'))return;
    const css=document.createElement('style');
    css.textContent='#dtFab{position:fixed;left:8px;bottom:78px;z-index:9000;padding:4px 8px;border-radius:6px;border:1px solid #c9a03d;background:rgba(20,16,4,.9);color:#e9c46a;font:600 10px/1 system-ui,sans-serif;letter-spacing:.08em}.dt-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.dt-stages{display:grid;gap:4px}.dt-flags{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.dt-flag{font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,.06)}.dt-flag small{color:#a8bbbd}';
    document.head.appendChild(css);
    const b=el('<button type="button" id="dtFab" aria-label="Open test tools">TEST</button>');
    b.onclick=open;document.body.appendChild(b);
  }
  window.rpgDevTools={open,enabled:()=>allowed};
  /* COLD-LOAD SMOKE CHECK (RPG-0107). ?smoke=1 on a test surface: once the page has been up for 1.5 s with NO interaction, record what a
     phone would show. Every dev suite calls setPage()/render() itself, which is exactly what hid the old/new Home flip for days; this
     looks at the page as loaded. window.__smoke + one console line `SMOKE {json}`; pass rule in docs/TEST_TOOLS.md. */
  function smokeReport(){
    const failed=[];
    safe(()=>performance.getEntriesByType('resource').forEach(e=>{if(e.responseStatus&&e.responseStatus>=400)failed.push(e.name.replace(location.origin,'')+' ('+e.responseStatus+')')}));
    document.querySelectorAll('img').forEach(i=>{if(i.complete&&i.getAttribute('src')&&i.naturalWidth===0&&getComputedStyle(i).display!=='none')failed.push('img '+i.getAttribute('src'))});
    return fetch('version.json',{cache:'no-store'}).then(r=>r.json()).catch(()=>({})).then(v=>{
      const r={commit:(v.commit||'').slice(0,7)||null,buildHash:v.buildHash||null,page:safe(()=>page,null),
        ctRows:document.querySelectorAll('.ct-row').length,splashGone:!document.querySelector('#startupScreen'),
        errors:(window.__errs||[]).map(e=>e.k+': '+e.m),failedLoads:[...new Set(failed)],
        scrollX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};
      r.pass=r.ctRows===4&&r.splashGone&&!r.errors.length&&!r.failedLoads.length&&!r.scrollX;
      return r;
    });
  }
  if(safe(()=>new URLSearchParams(location.search).get('smoke')==='1',false)){
    surfaceOk().then(ok=>{if(!ok)return;const go=()=>setTimeout(()=>smokeReport().then(r=>{window.__smoke=r;console.log('SMOKE',JSON.stringify(r))}),1500);
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go()});
  }
  /* DIAGNOSTICS BLOCK (RPG-0110). On the Profile tab of Profile & Setup, on a test surface only (localhost or environment "staging"):
     what THIS phone is actually running, so "is it on the new build?" can be answered from a screenshot, plus real start-up timings
     so the speed work (RPG-0114) can be measured on the phone instead of guessed. Never rendered on a production/Play build. */
  const diagStamp=()=>fetch('version.json',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));
  async function diagLines(){
    const v=await diagStamp();
    let caches_=[];try{caches_=(await caches.keys()).filter(k=>k.startsWith('rpg-'))}catch(e){}
    const scr=[...document.scripts].filter(s=>s.src&&s.src.startsWith(location.origin));
    const appRev=((document.querySelector('script[src*="app.js"]')||{}).src||'').split('?v=')[1]||'?';
    const nav=safe(()=>performance.getEntriesByType('navigation')[0],null)||{};
    const res=safe(()=>performance.getEntriesByType('resource'),[]);
    const kb=Math.round(res.reduce((n,e)=>n+(e.transferSize||0),0)/1024);
    const mark=n=>{const m=safe(()=>performance.getEntriesByName(n)[0],null);return m?Math.round(m.startTime):null};
    const errs=(window.__errs||[]).slice(-5);
    const L=[];
    L.push('Running: v'+VERSION+' · app.js ?v='+appRev);
    L.push('Latest deployed: build '+(v.buildHash||'?')+' · commit '+((v.commit||'').slice(0,7)||'?')+' · built '+(v.builtAt||'?'));
    L.push('Service worker: '+(navigator.serviceWorker&&navigator.serviceWorker.controller?'controlling':'not controlling')+' · cache '+(caches_.join(', ')||'none'));
    L.push('Network: '+(navigator.onLine?'online':'offline'));
    {const sz=safe(()=>JSON.stringify(state).length,0);L.push('Save size: '+Math.round(sz/1000)+' k characters (about '+Math.round(sz/50000)+'% of the ~5M browser limit)'+(window.__storageFailed?' · LAST WRITE FAILED at '+new Date(window.__storageFailed.at).toLocaleTimeString()+': '+window.__storageFailed.message:''))}
    L.push('Start-up: DOM ready '+(nav.domContentLoadedEventEnd?Math.round(nav.domContentLoadedEventEnd)+' ms':'?')+' · splash gone '+(mark('rpg-splash-gone')!=null?mark('rpg-splash-gone')+' ms':'?')+' · '+scr.length+' scripts · '+kb+' KB transferred');
    L.push('Last errors: '+(errs.length?errs.map(e=>new Date(e.at).toLocaleTimeString()+' '+e.k+': '+e.m).join(' || '):'none'));
    return L;
  }
  window.rpgDiagnosticsMount=function(root){
    surfaceOk().then(ok=>{
      if(!ok||!root||!root.isConnected)return;
      const anchor=root.querySelector('#saveProfile');if(!anchor||root.querySelector('#dtDiag'))return;
      const sec=el('<div class="modal-section" id="dtDiag"><h3>Diagnostics <small>(test build)</small></h3><pre id="dtDiagText" class="helper" style="white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.45;margin:0">Reading…</pre><div class="dt-row"><button type="button" class="rpg-btn small" id="dtDiagCopy">Copy</button><button type="button" class="rpg-btn small" id="dtDiagRefresh">Refresh</button></div></div>');
      anchor.parentNode.insertBefore(sec,anchor);
      let text='';
      const fill=()=>diagLines().then(L=>{text=L.join('\n');const pre=root.querySelector('#dtDiagText');if(pre)pre.textContent=text});
      fill();
      sec.querySelector('#dtDiagRefresh').onclick=fill;
      sec.querySelector('#dtDiagCopy').onclick=()=>{
        const one=text.split('\n').join(' | ');
        const done=()=>toast('Diagnostics copied.');
        if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(one).then(done,()=>{toast('Could not copy; select the text instead.')});
        else{const t=document.createElement('textarea');t.value=one;document.body.appendChild(t);t.select();try{document.execCommand('copy');done()}catch(e){toast('Could not copy; select the text instead.')}t.remove()}
      };
    });
  };
  if(optedIn()){
    surfaceOk().then(ok=>{allowed=ok;if(ok){if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount)}});
  }
})();
