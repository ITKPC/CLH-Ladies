/* Club La Huerta weather + app bootstrap. */
(() => {
  const CLUB = { lat: 23.07, lon: -109.69 };
  const API = `https://api.open-meteo.com/v1/forecast?latitude=${CLUB.lat}&longitude=${CLUB.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=celsius&wind_speed_unit=kmh&timezone=America%2FMazatlan&forecast_days=10`;

  const wxIcon = code => {
    if (code === 0) return '☀️';
    if ([1,2].includes(code)) return '🌤️';
    if (code === 3) return '☁️';
    if ([45,48].includes(code)) return '🌫️';
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return '🌧️';
    if ([71,73,75,77,85,86].includes(code)) return '❄️';
    if ([95,96,99].includes(code)) return '⛈️';
    return '🌤️';
  };

  const wxText = code => {
    if (code === 0) return 'Sunny';
    if ([1,2].includes(code)) return 'Partly cloudy';
    if (code === 3) return 'Cloudy';
    if ([45,48].includes(code)) return 'Fog';
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return 'Rain';
    if ([71,73,75,77,85,86].includes(code)) return 'Snow';
    if ([95,96,99].includes(code)) return 'Thunderstorms';
    return 'Weather';
  };

  let forecast = new Map();
  let observer = null;
  let decorateQueued = false;

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .clh-weather{display:flex;align-items:center;gap:10px;margin-top:9px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.14);width:max-content;max-width:100%;backdrop-filter:blur(3px)}
      .clh-weather-icon{font-size:1.65rem;line-height:1}.clh-weather-main{font-weight:850;font-size:.92rem}.clh-weather-sub{font-size:.72rem;opacity:.9;margin-top:1px}
      .weather-inline{display:flex;align-items:center;gap:5px;font-size:.76rem;font-weight:800;color:#536a75;margin-top:5px}
      .daywx{position:absolute;bottom:4px;right:5px;font-size:.67rem;font-weight:850;color:#536a75}
      @media(max-width:580px){.clh-weather{width:100%}.daywx{font-size:.59rem}}
    `;
    document.head.appendChild(style);
  }

  function renderCurrent(data) {
    const brandText = document.querySelector('.brand > div:last-child');
    if (!brandText) return;
    let box = document.getElementById('clhWeather');
    if (!box) {
      box = document.createElement('div');
      box.id = 'clhWeather';
      box.className = 'clh-weather';
      brandText.appendChild(box);
    }
    const c = data.current;
    box.innerHTML = `<div class="clh-weather-icon" aria-hidden="true">${wxIcon(c.weather_code)}</div><div><div class="clh-weather-main">${Math.round(c.temperature_2m)}°C · ${wxText(c.weather_code)}</div><div class="clh-weather-sub">At Club La Huerta · feels ${Math.round(c.apparent_temperature)}° · wind ${Math.round(c.wind_speed_10m)} km/h</div></div>`;
  }

  function buildForecast(data) {
    forecast = new Map();
    data.daily.time.forEach((date, i) => forecast.set(date, {
      code: data.daily.weather_code[i],
      hi: Math.round(data.daily.temperature_2m_max[i]),
      lo: Math.round(data.daily.temperature_2m_min[i]),
      rain: data.daily.precipitation_probability_max[i]
    }));
  }

  function dateFromCard(card) {
    const dateBox = card.querySelector('.datebox');
    if (!dateBox) return null;
    const dn = dateBox.querySelector('.dn')?.textContent;
    const mo = dateBox.querySelector('.mo')?.textContent;
    if (!dn || !mo) return null;
    const now = new Date();
    let d = new Date(`${mo} ${dn}, ${now.getFullYear()} 12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getTime() < now.getTime() - 120 * 86400000) d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0,10);
  }

  function decorateEvents() {
    document.querySelectorAll('.event').forEach(card => {
      const f = forecast.get(dateFromCard(card));
      const existing = card.querySelector('.weather-inline');
      if (!f) {
        existing?.remove();
        return;
      }
      const meta = card.querySelector('.meta');
      if (!meta) return;
      const text = `${wxIcon(f.code)} ${f.hi}° / ${f.lo}°${f.rain >= 30 ? ` · ${f.rain}% rain` : ''}`;
      if (existing) {
        if (existing.textContent !== text) existing.textContent = text;
        return;
      }
      const row = document.createElement('div');
      row.className = 'weather-inline';
      row.textContent = text;
      meta.after(row);
    });
  }

  function decorateCalendar() {
    const label = document.getElementById('monthLabel')?.textContent;
    if (!label) return;
    document.querySelectorAll('.day').forEach(day => {
      const existing = day.querySelector('.daywx');
      const n = Number(day.querySelector('.num')?.textContent);
      if (!n) {
        existing?.remove();
        return;
      }
      const d = new Date(`${label} ${n} 12:00:00`);
      if (Number.isNaN(d.getTime())) return;
      const f = forecast.get(d.toISOString().slice(0,10));
      if (!f) {
        existing?.remove();
        return;
      }
      const text = `${wxIcon(f.code)} ${f.hi}°`;
      if (existing) {
        if (existing.textContent !== text) existing.textContent = text;
        return;
      }
      const span = document.createElement('span');
      span.className = 'daywx';
      span.textContent = text;
      day.appendChild(span);
    });
  }

  function decorateNow() {
    if (observer) observer.disconnect();
    try {
      decorateEvents();
      decorateCalendar();
    } finally {
      const root = document.querySelector('.app') || document.body;
      if (observer && root) observer.observe(root, { childList: true, subtree: true });
    }
  }

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    requestAnimationFrame(() => {
      decorateQueued = false;
      decorateNow();
    });
  }

  async function loadWeather() {
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) throw new Error('Weather request failed');
      const data = await response.json();
      buildForecast(data);
      renderCurrent(data);
      observer = new MutationObserver(queueDecorate);
      decorateNow();
    } catch (error) {
      console.warn('Club La Huerta weather unavailable', error);
    }
  }

  addStyles();
  loadWeather();
})();

/* Load the shared app pieces in a deterministic order. */
(() => {
  const loadScript = src => new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-clh-src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.dataset.clhSrc = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

  (async () => {
    try {
      await loadScript('friendly-copy.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      await loadScript('supabase-client.js');
      await loadScript('auth-gate.js');
      await loadScript('navigation-fix.js');
      await loadScript('play-sheet.js');
      await loadScript('shared-data.js');
      await loadScript('upcoming-all.js');
      await loadScript('court-picker.js');
      await loadScript('booking-guard.js');
      await loadScript('availability.js');
      await loadScript('player-booking-safety.js');
      await loadScript('past-game-rules.js');
      window.dispatchEvent(new Event('clh-app-ready'));
    } catch (error) {
      console.error('Club La Huerta app tools could not load', error);
    }
  })();
})();
