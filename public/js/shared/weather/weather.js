/**
 * Client météo (Open-Meteo sans clé, géocodage, prévisions 7 jours et résilience hors-ligne)
 */

export const WEATHER_LABELS = {
  clear: "Ensoleillé",
  partlyCloudy: "Éclaircies / Nuageux",
  rain: "Pluie",
  snow: "Neige",
  storm: "Orage",
  wind: "Vent fort",
};

export const DEFAULT_WEATHER_LOCATION = {
  name: "Paris, France",
  coordinates: { latitude: 48.8566, longitude: 2.3522 },
};

const WEATHER_STORAGE_KEY = "styleai_weather_location";

/** @type {Record<string, any>} */
let weeklyWeather = {};
/** @type {Array<any>} */
let weeklyWeatherList = [];
let weatherLocation = DEFAULT_WEATHER_LOCATION.name;
let weatherCoordinates = DEFAULT_WEATHER_LOCATION.coordinates;
let onWeatherChangeListeners = new Set();

/**
 * Détermine le type météo simplifié à partir du code WMO
 * @param {number} code
 * @param {number} [windSpeed=0]
 * @returns {keyof typeof WEATHER_LABELS}
 */
export function weatherType(code, windSpeed = 0) {
  if (windSpeed >= 50) return "wind";
  if ([95, 96, 99].includes(code)) return "storm";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "rain";
  }
  if ([1, 2, 3, 45, 48].includes(code)) return "partlyCloudy";
  return "clear";
}

/**
 * Emoji de secours par type météo
 * @param {string} type
 * @returns {string}
 */
export function weatherEmoji(type) {
  const emojis = {
    clear: "☀️",
    partlyCloudy: "⛅",
    rain: "🌧️",
    snow: "❄️",
    storm: "⛈️",
    wind: "💨",
  };
  return emojis[type] || "🌤️";
}

/**
 * Icône SVG accessible et nette pour chaque type de météo
 * @param {string} type
 * @returns {string}
 */
export function weatherIconSvg(type) {
  const svgs = {
    clear: `<svg class="weather-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
    partlyCloudy: `<svg class="weather-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#78716c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
    rain: `<svg class="weather-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><path d="M8 19v2M8 13v2M12 21v2M12 15v2M16 19v2M16 13v2"/></svg>`,
    snow: `<svg class="weather-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07"/></svg>`,
    storm: `<svg class="weather-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polygon points="13 11 9 17 15 17 11 23"/></svg>`,
    wind: `<svg class="weather-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`,
  };
  return svgs[type] || svgs.clear;
}

/**
 * Fetch avec timeout défensif (par défaut 7500ms)
 * @param {string} url
 * @param {RequestInit} [options={}]
 * @param {number} [timeoutMs=7500]
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 7500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Récupère l'emplacement météo mémorisé
 * @returns {{ name: string, coordinates: { latitude: number, longitude: number } }}
 */
export function getSavedWeatherLocation() {
  try {
    const raw = localStorage.getItem(WEATHER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.name && parsed?.coordinates?.latitude && parsed?.coordinates?.longitude) {
        return parsed;
      }
    }
  } catch {
    // Échec de lecture silencieux
  }
  return DEFAULT_WEATHER_LOCATION;
}

/**
 * Enregistre l'emplacement météo dans le localStorage
 * @param {{ name: string, coordinates: { latitude: number, longitude: number } }} loc
 */
export function saveWeatherLocation(loc) {
  try {
    localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // Échec d'écriture silencieux (quota ou navigation privée)
  }
}

/**
 * Retourne le dictionnaire météo hebdomadaire par date ISO
 * @returns {Record<string, any>}
 */
export function getWeeklyWeather() {
  return weeklyWeather;
}

/**
 * Retourne la liste des prévisions météo pour les 7 prochains jours
 * @returns {Array<any>}
 */
export function getWeeklyWeatherList() {
  return weeklyWeatherList;
}

/**
 * Récupère la prévision météo pour un index de jour (0 = aujourd'hui)
 * @param {number} dayIndex
 * @returns {any|null}
 */
export function getForecastForDay(dayIndex) {
  if (Array.isArray(weeklyWeatherList) && weeklyWeatherList[dayIndex]) {
    return weeklyWeatherList[dayIndex];
  }
  const date = new Date();
  date.setDate(date.getDate() + dayIndex);
  const isoKey = date.toISOString().slice(0, 10);
  return weeklyWeather[isoKey] || null;
}

/**
 * Abonne un callback aux mises à jour météo
 * @param {() => void} listener
 * @returns {() => void} Désinscription
 */
export function subscribeWeatherChange(listener) {
  onWeatherChangeListeners.add(listener);
  return () => onWeatherChangeListeners.delete(listener);
}

function notifyWeatherChange() {
  onWeatherChangeListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn("[Weather] Erreur listener :", e);
    }
  });
}

/**
 * Affiche l'état skeleton dans le conteneur météo
 */
function renderWeatherSkeleton() {
  const weatherSummary = document.getElementById("weather-summary");
  if (!weatherSummary) return;

  weatherSummary.replaceChildren();
  const title = document.createElement("div");
  title.className = "weather-skeleton-title skeleton-line";
  title.innerHTML = `
    <span class="skeleton-shimmer skeleton-shimmer-wide"></span>
    <span class="skeleton-shimmer skeleton-shimmer-medium"></span>
  `;

  weatherSummary.appendChild(title);
}

/**
 * Charge les prévisions météo Open-Meteo pour un lieu donné
 * @param {{ name: string, coordinates: { latitude: number, longitude: number } }} [location]
 */
export async function loadWeatherForecast(location = getSavedWeatherLocation()) {
  const weatherSummary = document.getElementById("weather-summary");
  const cityInput = document.getElementById("city-input");
  const cityWeatherStatus = document.getElementById("city-weather-status");

  renderWeatherSkeleton();

  try {
    if (!location?.coordinates?.latitude || !location?.coordinates?.longitude) {
      location = DEFAULT_WEATHER_LOCATION;
    }

    const { latitude, longitude } = location.coordinates;
    weatherCoordinates = location.coordinates;
    weatherLocation = location.name || DEFAULT_WEATHER_LOCATION.name;
    saveWeatherLocation(location);

    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      daily:
        "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code",
      forecast_days: "7",
      timezone: "auto",
    });

    const response = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      {},
      7000,
    );

    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data?.daily?.time || !Array.isArray(data.daily.time)) {
      throw new Error("Format de réponse météo invalide");
    }

    weeklyWeatherList = data.daily.time.map((dateStr, index) => {
      const min = Math.round(data.daily.temperature_2m_min[index] ?? 12);
      const max = Math.round(data.daily.temperature_2m_max[index] ?? 18);
      const rain = Math.round(data.daily.precipitation_probability_max?.[index] ?? 0);
      const wind = Math.round(data.daily.wind_speed_10m_max?.[index] ?? 10);
      const code = data.daily.weather_code?.[index] ?? 0;
      const type = weatherType(code, wind);

      return {
        date: dateStr,
        min,
        max,
        rain,
        wind,
        code,
        type,
        label: WEATHER_LABELS[type] || "Météo standard",
        emoji: weatherEmoji(type),
        iconSvg: weatherIconSvg(type),
        confidence: Math.max(70, 96 - index * 4),
      };
    });

    weeklyWeather = Object.fromEntries(
      weeklyWeatherList.map((item) => [item.date, item]),
    );

    // Mise à jour de la barre d'information météo (claire, compacte, sans dupliquer les 7 cartes)
    if (weatherSummary) {
      weatherSummary.replaceChildren();

      const todayWeather = weeklyWeatherList[0] || {
        min: 10,
        max: 18,
        rain: 0,
        wind: 10,
        label: "Ensoleillé",
        iconSvg: weatherIconSvg("clear"),
      };

      const summaryContent = document.createElement("div");
      summaryContent.className = "weather-summary-content";

      const locationBadge = document.createElement("span");
      locationBadge.className = "weather-summary-location";
      const locationIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      locationIcon.setAttribute("viewBox", "0 0 24 24");
      locationIcon.setAttribute("width", "16");
      locationIcon.setAttribute("height", "16");
      locationIcon.setAttribute("fill", "currentColor");
      locationIcon.setAttribute("aria-hidden", "true");
      locationIcon.style.cssText = "vertical-align: -2px; margin-right: 4px;";
      const locationPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      locationPath.setAttribute("d", "M12 2a8 8 0 0 0-8 8c0 5.4 7 11.4 7.3 11.7.4.3 1 .3 1.4 0 .3-.3 7.3-6.3 7.3-11.7a8 8 0 0 0-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z");
      locationIcon.appendChild(locationPath);
      const locationName = document.createElement("span");
      locationName.textContent = weatherLocation;
      locationBadge.append(locationIcon, locationName);

      const todayInfo = document.createElement("span");
      todayInfo.className = "weather-summary-today";
      const todayLabel = document.createElement("strong");
      todayLabel.textContent = "Aujourd'hui :";
      const todayDetails = document.createElement("span");
      todayDetails.textContent = ` ${todayWeather.label} · ${todayWeather.min}° à ${todayWeather.max}°C · Pluie ${todayWeather.rain}% · Vent ${todayWeather.wind} km/h`;
      todayInfo.append(todayLabel, todayDetails);

      const helperTag = document.createElement("span");
      helperTag.className = "weather-status-badge";
      helperTag.textContent = "Météo des 7 jours intégrée dans chaque carte ci-dessous";

      summaryContent.append(locationBadge, todayInfo, helperTag);
      weatherSummary.appendChild(summaryContent);
    }

    if (cityInput && location?.name) {
      cityInput.value = location.name;
    }
    if (cityWeatherStatus) {
      cityWeatherStatus.textContent = `Ville active : ${weatherLocation}. Les tenues s'adapteront à ces prévisions.`;
    }

    notifyWeatherChange();
  } catch (error) {
    console.warn("[Weather] Prévisions météo indisponibles :", error?.message || error);
    weeklyWeather = {};
    weeklyWeatherList = [];

    if (weatherSummary) {
      weatherSummary.replaceChildren();
      const fallbackMsg = document.createElement("div");
      fallbackMsg.className = "weather-fallback-message";
      fallbackMsg.innerHTML = `
        <span class="weather-fallback-icon" aria-hidden="true">—</span>
        <div>
          <strong>Météo momentanément indisponible</strong>
          <p>Tu peux composer et générer tes tenues normalement sans adaptation météo.</p>
        </div>
      `;
      weatherSummary.appendChild(fallbackMsg);
    }

    if (cityWeatherStatus) {
      cityWeatherStatus.textContent = "Météo hors-ligne. Génération possible sans météo.";
    }

    notifyWeatherChange();
  }
}

/**
 * Géocode une ville via Open-Meteo.
 * @param {string} query
 * @returns {Promise<{name: string, country: string, admin1: string, coordinates: {latitude: number, longitude: number}}|null>}
 */
export async function geocodeCity(query) {
  const cleanQuery = String(query ?? "").trim();
  if (!cleanQuery) return null;

  const params = new URLSearchParams({
    name: cleanQuery,
    count: "1",
    language: "fr",
    format: "json",
  });
  const response = await fetchWithTimeout(
    `https://geocoding-api.open-meteo.com/v1/search?${params}`,
    {},
    6500,
  );
  if (!response.ok) {
    throw new Error(`Open-Meteo Geocoding HTTP ${response.status}`);
  }
  const data = await response.json();
  const result = data?.results?.[0];
  if (!result) return null;

  return {
    name: [result.name, result.admin1, result.country].filter(Boolean).join(", "),
    country: result.country || "",
    admin1: result.admin1 || "",
    coordinates: {
      latitude: result.latitude,
      longitude: result.longitude,
    },
  };
}

/**
 * Récupère les prévisions quotidiennes pour une plage de dates.
 * Open-Meteo forecast couvre aujourd'hui + 15 jours ; au-delà, la date est
 * absente du résultat et le mode valise le signale.
 *
 * @param {{latitude: number, longitude: number}} coordinates
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Promise<Array<object>>}
 */
export async function fetchWeatherForDateRange(coordinates, startDate, endDate) {
  if (!coordinates?.latitude || !coordinates?.longitude) {
    throw new Error("Coordonnées météo manquantes");
  }

  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code",
    forecast_days: "16",
    timezone: "auto",
  });
  const response = await fetchWithTimeout(
    `https://api.open-meteo.com/v1/forecast?${params}`,
    {},
    8000,
  );
  if (!response.ok) {
    throw new Error(`Open-Meteo Forecast HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!data?.daily?.time || !Array.isArray(data.daily.time)) {
    throw new Error("Format de réponse météo invalide");
  }

  return data.daily.time
    .map((dateStr, index) => {
      if (dateStr < startDate || dateStr > endDate) return null;
      const min = Math.round(data.daily.temperature_2m_min[index] ?? 12);
      const max = Math.round(data.daily.temperature_2m_max[index] ?? 18);
      const rain = Math.round(data.daily.precipitation_probability_max?.[index] ?? 0);
      const wind = Math.round(data.daily.wind_speed_10m_max?.[index] ?? 10);
      const code = data.daily.weather_code?.[index] ?? 0;
      const type = weatherType(code, wind);
      return {
        date: dateStr,
        min,
        max,
        rain,
        wind,
        code,
        type,
        label: WEATHER_LABELS[type] || "Météo standard",
        emoji: weatherEmoji(type),
        iconSvg: weatherIconSvg(type),
      };
    })
    .filter(Boolean);
}

/**
 * Recherche et applique une nouvelle ville
 */
export async function selectWeatherCity() {
  const cityInput = document.getElementById("city-input");
  const cityWeatherBtn = document.getElementById("city-weather-btn");
  const cityWeatherStatus = document.getElementById("city-weather-status");

  const query = cityInput?.value?.trim();
  if (!query) {
    if (cityWeatherStatus) {
      cityWeatherStatus.textContent = "Entre le nom d'une ville (ex. Paris, Lyon, Bordeaux).";
    }
    cityInput?.focus();
    return;
  }

  if (cityWeatherBtn) {
    cityWeatherBtn.disabled = true;
    cityWeatherBtn.textContent = "Recherche...";
  }
  if (cityWeatherStatus) {
    cityWeatherStatus.textContent = `Recherche de « ${query} »...`;
  }

  try {
    const newLocation = await geocodeCity(query);

    if (!newLocation) {
      if (cityWeatherStatus) {
        cityWeatherStatus.textContent = `Ville « ${query} » introuvable. Vérifie l'orthographe.`;
      }
      return;
    }

    await loadWeatherForecast(newLocation);
  } catch (error) {
    console.warn("[Weather] Recherche de ville impossible :", error?.message || error);
    if (cityWeatherStatus) {
      cityWeatherStatus.textContent =
        "Impossible de joindre le service de géocodage. Réessaie dans un instant.";
    }
  } finally {
    if (cityWeatherBtn) {
      cityWeatherBtn.disabled = false;
      cityWeatherBtn.textContent = "Appliquer";
    }
  }
}

/**
 * Initialise les écouteurs du formulaire de sélection de ville
 */
export function initWeatherControls() {
  const cityWeatherBtn = document.getElementById("city-weather-btn");
  const cityInput = document.getElementById("city-input");

  cityWeatherBtn?.addEventListener("click", selectWeatherCity);
  cityInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      selectWeatherCity();
    }
  });
}
