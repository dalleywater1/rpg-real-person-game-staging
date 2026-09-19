/* RPG v0.02.4.11 — Player Box Help/Settings simplification (2nd follow-up,
   issue 3). Reversible by setting HOME_PLAYER_TOOL_GLYPH_HOTFIX=false.
   Swaps the ornate baked-art Help/Settings icons for a plain CSS button
   with a text glyph, per the approved reference — no id/handler changes,
   #helpButton and #settingsButton keep their existing bound onclick. */
const HOME_PLAYER_TOOL_GLYPH_HOTFIX=true;

function v0248CssToolGlyphs(){
  if(!HOME_PLAYER_TOOL_GLYPH_HOTFIX||page!=='home')return;
  if(document.querySelector('.player-status-panel.widget-player-status'))return;
  const map={helpButton:'?',settingsButton:'⚙'};
  Object.entries(map).forEach(([id,glyph])=>{
    const btn=document.getElementById(id);
    if(!btn)return;
    btn.classList.add('v8-tool-css-glyph');
    if(!btn.querySelector('.v8-tool-glyph')){
      const span=document.createElement('span');
      span.className='v8-tool-glyph';
      span.setAttribute('aria-hidden','true');
      span.textContent=glyph;
      btn.appendChild(span);
    }
  });
}

const v0248bPreviousRenderHome=renderHome;
renderHome=function(){v0248bPreviousRenderHome();v0248CssToolGlyphs()};
if(page==='home')v0248CssToolGlyphs();
