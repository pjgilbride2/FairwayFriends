// ============================================================
//  FAIRWAY FRIEND — Weather (Open-Meteo, free, no API key)
//  Primary source: user city/state from their profile
//  Secondary: browser GPS if user grants permission
//  Auto-refreshes every 10 minutes
// ============================================================

const WMO = {
  0:  { label:"Clear skies",        icon:"☀️",  golf:"Perfect day" },
  1:  { label:"Mainly clear",       icon:"🌤️",  golf:"Great conditions" },
  2:  { label:"Partly cloudy",      icon:"⛅",  golf:"Good conditions" },
  3:  { label:"Overcast",           icon:"☁️",  golf:"Playable" },
  45: { label:"Foggy",              icon:"🌫️",  golf:"Low visibility" },
  48: { label:"Icy fog",            icon:"🌫️",  golf:"Low visibility" },
  51: { label:"Light drizzle",      icon:"🌦️",  golf:"Light rain" },
  53: { label:"Drizzle",            icon:"🌧️",  golf:"Wet round" },
  55: { label:"Heavy drizzle",      icon:"🌧️",  golf:"Wet round" },
  61: { label:"Light rain",         icon:"🌦️",  golf:"Light rain" },
  63: { label:"Rain",               icon:"🌧️",  golf:"Wet round" },
  65: { label:"Heavy rain",         icon:"🌧️",  golf:"Stay home" },
  71: { label:"Light snow",         icon:"🌨️",  golf:"Course closed" },
  73: { label:"Snow",               icon:"❄️",  golf:"Course closed" },
  75: { label:"Heavy snow",         icon:"❄️",  golf:"Course closed" },
  80: { label:"Rain showers",       icon:"🌦️",  golf:"Bring rain gear" },
  81: { label:"Showers",            icon:"🌧️",  golf:"Bring rain gear" },
  82: { label:"Heavy showers",      icon:"⛈️",  golf:"Stay home" },
  95: { label:"Thunderstorm",       icon:"⛈️",  golf:"Stay home" },
  96: { label:"Thunderstorm",       icon:"⛈️",  golf:"Stay home" },
  99: { label:"Heavy thunderstorm", icon:"⛈️",  golf:"Stay home" },
};
const wmo = (c) => WMO[c] || { label:"Unknown", icon:"🌡️", golf:"Check forecast" };

function windDir(d) {
  return ["N","NE","E","SE","S","SW","W","NW"][Math.round((d||0)/45)%8];
}

function playScore(temp, wind, rain, code) {
  let s=100;
  if (temp<45) s-=30; else if (temp<55) s-=15;
  else if (temp>95) s-=20; else if (temp>85) s-=5;
  if (wind>25) s-=30; else if (wind>18) s-=15; else if (wind>12) s-=5;
  s-=Math.round(rain*0.4);
  if ([65,71,73,75,82,95,96,99].includes(code)) s-=40;
  else if ([51,53,55,61,63,80,81].includes(code)) s-=20;
  return Math.max(0,Math.min(100,s));
}

function playLabel(n) {
  if (n>=80) return {text:"Great day to play",       c:"var(--green-dark)", bg:"var(--green-light)"};
  if (n>=60) return {text:"Good conditions",         c:"#0C447C",           bg:"#E6F1FB"};
  if (n>=40) return {text:"Playable — dress for it", c:"#633806",           bg:"#FAEEDA"};
  return            {text:"Tough conditions",        c:"#791F1F",           bg:"#FCEBEB"};
}

// Geocode city string to lat/lon via Open-Meteo geocoding API
async function geocodeCity(city) {
  if (!city || !city.trim()) throw new Error("No city provided");
  // For "City, ST" format — try full string first, then city-only
  const cityOnly = city.split(",")[0].trim();
  const stateRegion = city.includes(",") ? city.split(",")[1]?.trim() : "";
  // Try with country bias for US cities to get most accurate result
  const searchStr = encodeURIComponent(cityOnly);
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${searchStr}&count=5&language=en&format=json`);
  const d = await r.json();
  if (!d.results?.length) throw new Error("City not found: "+city);
  // If state/region provided, pick the result that best matches it
  let g = d.results[0];
  if (stateRegion && d.results.length > 1) {
    const sr = stateRegion.toUpperCase();
    const match = d.results.find(r =>
      (r.admin1_code||"").toUpperCase() === sr ||
      (r.admin1||"").toUpperCase().startsWith(sr) ||
      (r.country_code||"").toUpperCase() === sr
    );
    if (match) g = match;
  }
  return { lat:g.latitude, lon:g.longitude, display: g.admin1 ? g.name+", "+g.admin1 : g.name };
}

// Fetch full 5-day forecast from Open-Meteo
async function fetchForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    +`&current=temperature_2m,relative_humidity_2m,apparent_temperature`
    +`,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability`
    +`&hourly=temperature_2m,weather_code,wind_speed_10m,precipitation_probability`
    +`&daily=weather_code,temperature_2m_max,temperature_2m_min`
    +`,precipitation_probability_max,wind_speed_10m_max`
    +`&temperature_unit=fahrenheit&wind_speed_unit=mph`
    +`&precipitation_unit=inch&timezone=auto&forecast_days=5`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Open-Meteo error "+r.status);
  return r.json();
}

// Auto-refresh every 10 minutes
let _refreshTimer = null;
function scheduleRefresh(lat, lon, display) {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(async () => {
    await doRender(lat, lon, display);
    scheduleRefresh(lat, lon, display);
  }, 10*60*1000);
}

async function doRender(lat, lon, display) {
  const el = document.getElementById("wx-container");
  if (!el) return;
  try {
    const data = await fetchForecast(lat, lon);
    el.innerHTML = buildWeatherCard(data, display);
  } catch(e) {
    console.error("Weather render:", e);
  }
}

// ── Main export — called by app.js whenever feed loads or user refreshes ──
export async function loadWeather(cityString) {
  const el = document.getElementById("wx-container");
  if (!el) return;

  el.innerHTML = `<div class="wx-loading"><div class="wx-loading-dot"></div><div class="wx-loading-dot"></div><div class="wx-loading-dot"></div></div>`;

  let lat=null, lon=null, display=cityString||"";

  // Step 1: geocode city from profile (this always works, no permission needed)
  if (cityString && cityString.trim()) {
    try {
      const g = await geocodeCity(cityString);
      lat=g.lat; lon=g.lon; display=g.display;
    } catch(e) {
      console.warn("Geocode failed:", e.message);
    }
  }

  // Step 2: try GPS only if we don't already have city coords
  // (if city was just changed, _wxLat is null so we skip GPS to force re-geocode)
  if (!lat) {
    try {
      const pos = await new Promise((res,rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {timeout:4000})
      );
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
      window._wxLat = lat;
      window._wxLon = lon;
    } catch(_) {}
  } else {
    // City coords found — also cache them for round forecast use
    window._wxLat = lat;
    window._wxLon = lon;
  }

  // Step 3: use previously cached GPS only if still no coords
  if (!lat && window._wxLat) {
    lat = window._wxLat;
    lon = window._wxLon;
  }

  if (!lat) {
    el.innerHTML = `<div class="wx-empty">Add your city in Edit Profile to see weather ⛅</div>`;
    return;
  }

  await doRender(lat, lon, display);
  scheduleRefresh(lat, lon, display);
}

export function stopWeather() {
  clearTimeout(_refreshTimer);
  _refreshTimer = null;
}

// Backward compat export used elsewhere
export const loadWeatherForCity = loadWeather;
export const startLocationWatch  = () => {};
export const stopLocationWatch   = stopWeather;

// ── Build main weather card HTML ──
function buildWeatherCard(data, location) {
  const c    = data.current;
  const cond = wmo(c.weather_code);
  const temp  = Math.round(c.temperature_2m);
  const feels = Math.round(c.apparent_temperature);
  const wind  = Math.round(c.wind_speed_10m);
  const wdir  = windDir(c.wind_direction_10m);
  const hum   = c.relative_humidity_2m;
  const rain  = c.precipitation_probability || 0;
  const sc    = playScore(temp, wind, rain, c.weather_code);
  const pl    = playLabel(sc);
  const ts    = new Date().toLocaleTimeString("en-US", {hour:"numeric", minute:"2-digit"});
  const DAYS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  // ── 5-day strip ──
  const daily = data.daily.time.slice(1,5).map((dt,i) => {
    const dw = wmo(data.daily.weather_code[i+1]);
    const d  = new Date(dt + "T12:00:00");
    const hi = Math.round(data.daily.temperature_2m_max[i+1]);
    const lo = Math.round(data.daily.temperature_2m_min[i+1]);
    const r  = data.daily.precipitation_probability_max[i+1] || 0;
    return `<div class="wx-day">
      <div class="wx-day-name">${DAYS[d.getDay()]}</div>
      <div class="wx-day-icon">${dw.icon}</div>
      <div class="wx-day-temp">${hi}°</div>
      <div class="wx-day-lo">${lo}°</div>
      <div class="wx-day-rain">${r > 30 ? r + "%" : ""}</div>
    </div>`;
  }).join("");

  // ── Next 5 hours ──
  const nowH = new Date().getHours();
  const si   = Math.max(0, data.hourly.time.findIndex(t => new Date(t).getHours() >= nowH));
  const hours = data.hourly.time.slice(si, si+5).map((t,i) => {
    const idx = si + i;
    const h   = new Date(t).getHours();
    const lbl = h === 0 ? "12a" : h < 12 ? h+"a" : h === 12 ? "12p" : (h-12)+"p";
    const hw  = wmo(data.hourly.weather_code[idx]);
    const hr  = data.hourly.precipitation_probability[idx] || 0;
    return `<div class="wx-hour">
      <div class="wx-hour-time">${lbl}</div>
      <div class="wx-hour-icon">${hw.icon}</div>
      <div class="wx-hour-temp">${Math.round(data.hourly.temperature_2m[idx])}°</div>
      <div class="wx-hour-wind">${Math.round(data.hourly.wind_speed_10m[idx])}mph</div>
      <div class="wx-hour-rain">${hr > 20 ? hr+"%" : ""}</div>
    </div>`;
  }).join("");

  return `<div class="wx-card">

    <!-- Hero row -->
    <div class="wx-hero">
      <div class="wx-hero-left">
        <div class="wx-big-icon">${cond.icon}</div>
        <div>
          <div class="wx-temp-big">${temp}°<span class="wx-unit">F</span></div>
          <div class="wx-condition">${cond.label}</div>
        </div>
      </div>
      <div class="wx-hero-right">
        <div class="wx-meta-row">📍 ${location}</div>
        <div class="wx-meta-row">🌡️ Feels ${feels}°</div>
        <div class="wx-meta-row">💨 ${wind}mph ${wdir}</div>
        <div class="wx-meta-row">💧 ${hum}% · 🌧️ ${rain}%</div>
      </div>
    </div>

    <!-- Playability badge -->
    <div class="wx-play-bar" style="background:${pl.bg};color:${pl.c}">
      <div class="wx-play-num" style="background:${pl.c};color:white">${sc}</div>
      <div>
        <div class="wx-play-label">${pl.text}</div>
        <div class="wx-play-sub">${cond.golf}</div>
      </div>
      <div class="wx-updated">${ts}</div>
    </div>

    <!-- Hourly -->
    <div class="wx-hours-wrap">
      <div class="wx-section-title">Next 5 hours</div>
      <div class="wx-hours">${hours}</div>
    </div>

    <!-- 4-day -->
    <div class="wx-daily-wrap">
      <div class="wx-section-title">4-day forecast</div>
      <div class="wx-days">${daily}</div>
    </div>

    <div class="wx-credit">Open-Meteo · auto-refreshes every 10 min</div>
  </div>`;
}

// ── Round-day forecast for tee time sheet ──
export async function loadRoundDayForecast(dateStr, timeStr, courseCity) {
  const el = document.getElementById("sheet-weather");
  if (!el) return;
  const rd = parseRoundDate(dateStr);
  if (!rd) { el.innerHTML=""; return; }
  const ahead = Math.round((rd-new Date())/86400000);
  if (ahead>7||ahead<0) { el.innerHTML=`<div class="wx-empty" style="margin:0">Forecast available within 7 days</div>`; return; }
  el.innerHTML=`<div class="wx-loading"><div class="wx-loading-dot"></div><div class="wx-loading-dot"></div><div class="wx-loading-dot"></div></div>`;
  try {
    let lat=window._wxLat, lon=window._wxLon, disp=courseCity||window._weatherCity||"";
    if (!lat) {
      const g=await geocodeCity(disp||""); lat=g.lat; lon=g.lon; disp=g.display;
    }
    const data=await fetchForecast(lat,lon);
    const teeH=parseRoundHour(timeStr);
    const target=rd.toISOString().split("T")[0];
    const slots=[];
    data.hourly.time.forEach((t,i)=>{
      if (t.split("T")[0]===target){
        const h=new Date(t).getHours();
        if(h>=teeH&&h<teeH+5) slots.push({h,temp:Math.round(data.hourly.temperature_2m[i]),wind:Math.round(data.hourly.wind_speed_10m[i]),rain:data.hourly.precipitation_probability[i]||0,w:wmo(data.hourly.weather_code[i])});
      }
    });
    const di=data.daily.time.indexOf(target);
    const dd=di>=0?{hi:Math.round(data.daily.temperature_2m_max[di]),lo:Math.round(data.daily.temperature_2m_min[di]),rain:data.daily.precipitation_probability_max[di]||0,wind:Math.round(data.daily.wind_speed_10m_max[di]),w:wmo(data.daily.weather_code[di])}:null;
    const sc_=slots[0]?playScore(slots[0].temp,slots[0].wind,slots[0].rain,0):dd?playScore(dd.hi,dd.wind,dd.rain,0):60;
    const pl_=playLabel(sc_);
    const dl=rd.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
    const sH=slots.map(s=>{const lbl=s.h===0?"12am":s.h<12?`${s.h}am`:s.h===12?"12pm":`${s.h-12}pm`;return `<div class="wx-hour"><div class="wx-hour-time">${lbl}</div><div class="wx-hour-icon">${s.w.icon}</div><div class="wx-hour-temp">${s.temp}°</div><div class="wx-hour-wind">${s.wind}mph</div><div class="wx-hour-rain">${s.rain>20?s.rain+"%":""}</div></div>`;}).join("")||`<div style="font-size:12px;color:var(--muted);padding:8px">No hourly data for this date</div>`;
    el.innerHTML=`<div class="wx-round-card">
      <div class="wx-round-header">
        <span class="wx-round-icon">${dd?dd.w.icon:"⛅"}</span>
        <div class="wx-round-meta"><div class="wx-round-date">${dl}</div><div class="wx-round-loc">${disp}</div></div>
        ${dd?`<div class="wx-round-summary"><div class="wx-round-hi">${dd.hi}°</div><div class="wx-round-lo">${dd.lo}°</div></div>`:""}
      </div>
      <div class="wx-playability" style="background:${pl_.bg};color:${pl_.c}">
        <div class="wx-play-score" style="background:${pl_.c};color:white">${sc_}</div>
        <div class="wx-play-text">${pl_.text}</div>
        <div class="wx-play-sub">${dd?dd.w.golf:""}</div>
      </div>
      ${dd?`<div class="wx-round-stats"><div class="wx-round-stat">💨 ${dd.wind}mph</div><div class="wx-round-stat">🌧️ ${dd.rain}%</div><div class="wx-round-stat">🌡️ ${dd.hi}°/${dd.lo}°</div></div>`:""}
      <div class="wx-section-label">During your round</div>
      <div class="wx-hours">${sH}</div>
      <div class="wx-credit">Weather by <a href="https://open-meteo.com" target="_blank" style="color:var(--green)">Open-Meteo</a></div>
    </div>`;
  } catch(e) { el.innerHTML=`<div class="wx-empty" style="margin:0">Forecast unavailable</div>`; }
}

function parseRoundDate(s) {
  if (!s) return null;
  if (/today/i.test(s)) return new Date();
  if (/tomorrow/i.test(s)) { const d=new Date(); d.setDate(d.getDate()+1); return d; }
  const d=new Date(s.replace(/^[^·]*·\s*/,"").trim()+" "+new Date().getFullYear());
  return isNaN(d)?null:d;
}
function parseRoundHour(s) {
  if (!s) return 8;
  const m=s.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return 8;
  let h=parseInt(m[1]);
  if (m[3]&&/pm/i.test(m[3])&&h!==12) h+=12;
  if (m[3]&&/am/i.test(m[3])&&h===12) h=0;
  return h;
}
