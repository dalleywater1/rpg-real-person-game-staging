/* RPG v0.02.4.7 — Home Weather panel content redesign (Phase 2A).
   Reversible by setting HOME_WEATHER_V2_HOTFIX=false below.
   Overrides renderWeatherHTML() only: same live data bindings
   (currentWeatherView/runningConditions/state.weatherCache), new layout.
   No frame, gameplay, navigation, or other Home panel changes. */
const HOME_WEATHER_V2_HOTFIX=true;

const V0247_RUNNING_COLOR={poor:'#c0392b',caution:'#d97706',mixed:'#3d8ee0',good:'#3fa15c',perfect:'#e9c877'};

function v0247RunningBadgeHTML(run){
  const color=V0247_RUNNING_COLOR[run.cls]||V0247_RUNNING_COLOR.good;
  const isPerfect=run.cls==='perfect';
  return `<div class="weather-v2-running wc-${esc(run.cls)}" style="--wc-color:${color}" title="${esc(run.note)}">${isPerfect?'<span class="weather-v2-running-star">★</span>':'<span class="weather-v2-running-dot"></span>'}<b>RUNNING: ${esc(String(run.label).toUpperCase())}</b></div>`;
}

function v0247LiveClockText(){
  const now=new Date();
  const day=now.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const time=now.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
  return `${day} · ${time}`;
}

const v0247PreviousRenderWeatherHTML=renderWeatherHTML;
renderWeatherHTML=function(){
  if(!HOME_WEATHER_V2_HOTFIX)return v0247PreviousRenderWeatherHTML();
  const w=currentWeatherView(),run=runningConditions(w);
  return `<div class="weather-approved-v4 weather-v2">
    <div class="weather-v2-header">
      <div>
        <div class="weather-v2-title">Weather</div>
        <div class="weather-v2-clock" id="weatherLiveClock">${v0247LiveClockText()}</div>
      </div>
      ${v0247RunningBadgeHTML(run)}
    </div>
    <div class="weather-primary-row weather-v2-main">
      <div class="weather-v2-main-left">
        <img class="weather-art weather-forecast-trigger" id="weatherForecastTrigger" role="button" tabindex="0" aria-label="Open 5-day weather forecast" title="Open 5-day forecast" src="${asset(w.icon)}" alt="${esc(w.condition)}">
        <div class="weather-v2-condition-block">
          <div class="weather-condition">${esc(w.condition)}</div>
          <div class="weather-v2-tap-hint">Tap icon for 5-day forecast</div>
        </div>
      </div>
      <span class="weather-temp">${w.temp==='--'?'--':Math.round(w.temp)}°C</span>
    </div>
    <div class="weather-v2-divider"><span class="weather-v2-gem"></span></div>
    <div class="weather-secondary-row weather-v2-stats">
      <div class="weather-v2-stat"><span>Feels Like</span><b>${w.feels==='--'?'--':Math.round(w.feels)}°</b></div>
      <div class="weather-v2-stat-divider"></div>
      <div class="weather-v2-stat"><span>High / Low</span><b>${w.high==='--'?'--':Math.round(w.high)}° / ${w.low==='--'?'--':Math.round(w.low)}°</b></div>
      <div class="weather-v2-stat-divider"></div>
      <div class="weather-v2-stat"><span>Rain</span><b>${w.rain==='--'?'--':Math.round(w.rain)}%</b></div>
      <div class="weather-v2-stat-divider"></div>
      <div class="weather-v2-stat"><span>Wind</span><b>${w.wind==='--'?'--':Math.round(w.wind)} km/h</b></div>
    </div>
    <div class="weather-footer"><small class="weather-attribution">Weather data: Open-Meteo</small></div>
  </div>`;
};

function v0247CleanWeatherPanel(){
  if(!HOME_WEATHER_V2_HOTFIX||page!=='home')return;
  const panel=document.querySelector('.weather-panel');
  if(!panel)return;
  panel.classList.add('weather-v2-active');
  panel.querySelector('#weatherForecastButton')?.remove();
  panel.querySelector(':scope > .home-v2-title')?.remove();
  const stale=panel.querySelector(':scope > .weather-approved-v4:not(.weather-v2)');
  if(stale){stale.outerHTML=renderWeatherHTML();bindWeatherForecastTrigger()}
}

const v0247PreviousRenderHome=renderHome;
renderHome=function(){v0247PreviousRenderHome();v0247CleanWeatherPanel()};
if(page==='home')v0247CleanWeatherPanel();

setInterval(()=>{
  const clock=document.getElementById('weatherLiveClock');
  if(clock)clock.textContent=v0247LiveClockText();
},30000);
