const $ = (id) => document.getElementById(id);

const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const locationName = $('locationName');
const timezoneEl = $('timezone');
const localTimeEl = $('localTime');
const localDateEl = $('localDate');
const temperatureEl = $('temperature');
const weatherDescEl = $('weatherDesc');
const windEl = $('wind');
const humidityEl = $('humidity');
const pressureEl = $('pressure');
const forecastNext = $('forecastNext');
const historyPrev = $('historyPrev');
const animatedBg = $('animatedBg');

let timeInterval = null;

function formatDateISO(date) {
  return date.toISOString().slice(0, 10);
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function dayName(date, tz) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: tz,
  }).format(date);
}
function bgClassFromWeather(weatherDesc, weatherCode) {
  const code = Number(weatherCode);
  if (code === 0) return 'bg-clear';
  if (code >= 1 && code <= 3) return 'bg-clouds';
  if ((code >= 45 && code <= 48) || (code >= 70 && code <= 79)) return 'bg-fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'bg-rain';
  if (code >= 85 && code <= 86) return 'bg-snow';
  if (code >= 95 && code <= 99) return 'bg-thunder';
  return 'bg-clear';
}

function startClock(timezone) {
  if (timeInterval) clearInterval(timeInterval);
  function tick() {
    try {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: timezone,
      }).format(now);
      const dateStr = new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: timezone,
      }).format(now);
      localTimeEl.textContent = timeStr;
      localDateEl.textContent = dateStr;
    } catch (e) {
      localTimeEl.textContent = new Date().toLocaleTimeString();
      localDateEl.textContent = new Date().toLocaleDateString();
    }
  }
  tick();
  timeInterval = setInterval(tick, 1000);
}

async function fetchAndRenderFor(query) {
  try {
    locationName.textContent = 'Searching...';
    timezoneEl.textContent = '';
    forecastNext.innerHTML = '';
    historyPrev.innerHTML = '';

    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query
    )}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl).then((r) => r.json());

    if (!geoRes.results || geoRes.results.length === 0) {
      locationName.textContent = 'Location not found';
      return;
    }

    const place = geoRes.results[0];
    const lat = place.latitude;
    const lon = place.longitude;
    const placeName = `${place.name}${
      place.admin1 ? ', ' + place.admin1 : ''
    }${place.country ? ', ' + place.country : ''}`;
    locationName.textContent = placeName;

    const today = new Date();

    // ✅ Changed to 4-day data instead of 7-day
    const startPast = addDays(today, -4);
    const endPast = addDays(today, -1);
    const startFuture = today;
    const endFuture = addDays(today, 3);

    const dailyVars = [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'sunrise',
      'sunset',
      'weathercode',
    ].join(',');

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=${dailyVars}&timezone=auto&start_date=${formatDateISO(
      startFuture
    )}&end_date=${formatDateISO(endFuture)}`;
    const forecastRes = await fetch(forecastUrl).then((r) => r.json());

    const tz = forecastRes.timezone || 'UTC';
    timezoneEl.textContent = `Timezone: ${tz}`;
    startClock(tz);

    const currentUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relativehumidity_2m,pressure_msl,windspeed_10m,weathercode&timezone=auto&start_date=${formatDateISO(
      today
    )}&end_date=${formatDateISO(today)}`;
    const curRes = await fetch(currentUrl).then((r) => r.json());

    let curTemp = '--',
      curHum = '--',
      curWind = '--',
      curPressure = '--',
      curWeatherDesc = '--',
      curCode;

    if (curRes && curRes.hourly && curRes.hourly.time.length > 0) {
      const idx = curRes.hourly.time.length - 1;
      curTemp = curRes.hourly.temperature_2m[idx];
      curHum = curRes.hourly.relativehumidity_2m[idx];
      curWind = curRes.hourly.windspeed_10m[idx];
      curPressure = curRes.hourly.pressure_msl[idx];
      curCode = curRes.hourly.weathercode[idx];

      const codeMap = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Light rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Snow: light',
        73: 'Snow: moderate',
        75: 'Snow: heavy',
        80: 'Rain showers',
        81: 'Heavy showers',
        95: 'Thunderstorm',
        99: 'Severe thunderstorm',
      };
      curWeatherDesc = codeMap[curCode] || 'Weather';
    }

    temperatureEl.textContent = `${Math.round(curTemp)}°C`;
    weatherDescEl.textContent = curWeatherDesc;
    windEl.textContent = `${curWind} m/s`;
    humidityEl.textContent = `${curHum}%`;
    pressureEl.textContent = `${Math.round(curPressure)} hPa`;

    const bgClass = bgClassFromWeather(curWeatherDesc, curCode);
    animatedBg.className = 'animated-bg ' + bgClass;

    forecastNext.innerHTML = '';
    if (forecastRes.daily) {
      const d = forecastRes.daily;
      for (let i = 0; i < d.time.length; i++) {
        const day = d.time[i];
        const max = Math.round(d.temperature_2m_max[i]);
        const min = Math.round(d.temperature_2m_min[i]);
        const precip = d.precipitation_sum[i];
        const wcode = d.weathercode[i];
        const desc = bgClassFromWeather('', wcode).replace('bg-', '');
        const dayLabel = dayName(new Date(day + 'T00:00:00'), tz);
        const card = document.createElement('div');
        card.className = 'forecast-day';
        card.innerHTML = `
          <p class="day">${dayLabel}</p>
          <p class="big">${max}° / ${min}°</p>
          <p class="small-muted">${precip}mm • ${desc}</p>
        `;
        forecastNext.appendChild(card);
      }
    }

    const histUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=${dailyVars}&timezone=auto&start_date=${formatDateISO(
      startPast
    )}&end_date=${formatDateISO(endPast)}`;
    const histRes = await fetch(histUrl).then((r) => r.json());
    historyPrev.innerHTML = '';
    if (histRes.daily) {
      const d = histRes.daily;
      for (let i = 0; i < d.time.length; i++) {
        const day = d.time[i];
        const max = Math.round(d.temperature_2m_max[i]);
        const min = Math.round(d.temperature_2m_min[i]);
        const precip = d.precipitation_sum[i];
        const wcode = d.weathercode[i];
        const desc = bgClassFromWeather('', wcode).replace('bg-', '');
        const dayLabel = dayName(new Date(day + 'T00:00:00'), tz);
        const card = document.createElement('div');
        card.className = 'forecast-day';
        card.innerHTML = `
          <p class="day">${dayLabel}</p>
          <p class="big">${max}° / ${min}°</p>
          <p class="small-muted">${precip}mm • ${desc}</p>
        `;
        historyPrev.appendChild(card);
      }
    }
  } catch (err) {
    console.error(err);
    locationName.textContent = 'Error loading data';
  }
}

searchBtn.addEventListener('click', () => {
  const q = searchInput.value.trim();
  if (q) {
    fetchAndRenderFor(q);
    searchInput.value = ''; // ✅ Auto clear search bar after searching
  }
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const q = searchInput.value.trim();
    if (q) {
      fetchAndRenderFor(q);
      searchInput.value = ''; // ✅ Auto clear search bar after pressing Enter
    }
  }
});

fetchAndRenderFor('Kolkata');
