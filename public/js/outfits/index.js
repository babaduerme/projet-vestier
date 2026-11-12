import { db } from "../core/config.js";
import { initAuth } from "../auth/auth.js";
import { escapeHtml, showToast } from "../core/ui-utils.js";
import { validateOutfitOnServer } from "../core/api-client.js";
import {
  GARMENT_TYPES,
  SLOTS,
  migrateGarment,
  normalizeGarmentSlot,
  validateOutfit,
  repairOrDiscardOutfit,
  resolveFormalOutfit,
  explainMissingPieces,
  checkWardrobeCompleteness,
  isShirt,
  isFormalNeckwear,
} from "../shared/outfit-matcher.js";
import {
  getForecastForDay,
  getWeeklyWeather,
  getWeeklyWeatherList,
  initWeatherControls,
  loadWeatherForecast,
  getSavedWeatherLocation,
  subscribeWeatherChange,
  DEFAULT_WEATHER_LOCATION,
} from "../shared/weather/weather.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { generateOutfits } from "../shared/outfit-generator.js";
import {
  CANONICAL_STYLES,
  getStyleLabel,
  normalizeRequestedStyle,
} from "../shared/styles/style-utils.js";

const WEEK_DAYS = [
  { key: "monday", label: "Lundi", dayNum: 1 },
  { key: "tuesday", label: "Mardi", dayNum: 2 },
  { key: "wednesday", label: "Mercredi", dayNum: 3 },
  { key: "thursday", label: "Jeudi", dayNum: 4 },
  { key: "friday", label: "Vendredi", dayNum: 5 },
  { key: "saturday", label: "Samedi", dayNum: 6 },
  { key: "sunday", label: "Dimanche", dayNum: 0 },
];
const ALTERNATIVE_STYLES = ["casual", "rock", "streetwear"];

let currentUser = null;
let userClothes = [];
let unclassifiedClothes = [];
let stopClothesListener = null;
let weeklyStyles = {};
let latestGeneratedOutfits = [];
let isSavingWeeklyOutfits = false;
let generationVersion = 0;
let activeGenerationController = null;

// Éléments DOM
const generateBtn = document.getElementById("generate-btn");
const progressContainer = document.getElementById("progress-container");
const progressFill = document.getElementById("progress-fill");
const progressBar = progressContainer?.querySelector('[role="progressbar"]');
const generationStatus = document.getElementById("generation-status");
const retryGenerationBtn = document.getElementById("retry-generation-btn");
const noClothesWarning = document.getElementById("no-clothes-warning");
const outfitsContainer = document.getElementById("outfits-container");
const outfitsGrid = document.getElementById("outfits-grid");
const outfitsTitle = document.getElementById("outfits-title");
const outfitsSavedIndicator = document.getElementById("outfits-saved-indicator");
const saveWeekButton = document.getElementById("save-week-btn");
const savedWeekPanel = document.getElementById("saved-week-panel");
const savedWeekCount = document.getElementById("saved-week-count");
const savedWeekList = document.getElementById("saved-week-list");
let savedWeekSnapshot = null;
let activeSavedWeekId = null;
let savedWeeks = [];
const weeklyPlanner = document.getElementById("weekly-style-planner");
const plannerStatus = document.getElementById("planner-status");
const todayStyleLabel = document.getElementById("today-style-label");
const resetWeekBtn = document.getElementById("reset-week-btn");
const cityInput = document.getElementById("city-input");
const cityWeatherStatus = document.getElementById("city-weather-status");

function scrollToWeeklyOutfits() {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    outfitsContainer?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  });
}

initWeatherControls();

// Initialisation immédiate du planning local (pour affichage instantané sans attendre Firebase)
void loadWeeklyStyles();

// Initialisation de l'authentification
initAuth(async (user) => {
  currentUser = user;
  loadUserClothes();
  await loadWeeklyStyles();
  await loadSavedOutfits();

  const savedLoc = getSavedWeatherLocation();
  if (cityInput && savedLoc?.name) {
    cityInput.value = savedLoc.name;
  }
  void loadWeatherForecast(savedLoc);
});

// Écoute les changements météo pour mettre à jour les cartes de jours
subscribeWeatherChange(() => {
  updateAllDayWeatherChips();
});

function getDayKey(date = new Date()) {
  const dayIndex = date.getDay();
  return WEEK_DAYS[dayIndex === 0 ? 6 : dayIndex - 1].key;
}

/**
 * Associe chaque jour (Lundi → Dimanche) à sa météo
 * @param {string} dayKey
 * @param {number} dayIndex
 */
function getWeatherForDay(dayKey, dayIndex) {
  const forecastList = getWeeklyWeatherList();
  if (!forecastList || forecastList.length === 0) return null;

  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
  const targetDay = WEEK_DAYS.find((d) => d.key === dayKey);
  if (!targetDay) return forecastList[dayIndex] || null;

  let diffDays = targetDay.dayNum - currentDayOfWeek;
  if (diffDays < 0) diffDays += 7;

  if (diffDays >= 0 && diffDays < forecastList.length) {
    return forecastList[diffDays];
  }
  return forecastList[dayIndex % forecastList.length] || null;
}

/**
 * Garantit que la météo est chargée avant de composer les tenues.
 * Sans cela, une génération lancée juste après l'ouverture de la page pouvait
 * se faire avec une météo nulle et donc sans veste alors qu'il fait froid.
 */
async function ensureWeatherAvailable() {
  if (getWeeklyWeatherList().length > 0) return;
  try {
    await loadWeatherForecast(getSavedWeatherLocation());
  } catch (error) {
    console.warn("[StyleAI] Météo indisponible avant génération :", error);
  }
}

const WARDROBE_CATEGORIES = new Set([
  "haut",
  "bas",
  "robe",
  "manteau",
  "chaussures",
  "accessoires",
  "ensemble",
]);

const CATEGORY_ALIASES = new Map([
  ["haut", "haut"],
  ["tshirt", "haut"],
  ["t shirt", "haut"],
  ["tee shirt", "haut"],
  ["tee-shirt", "haut"],
  ["chemise", "haut"],
  ["polo", "haut"],
  ["pull", "haut"],
  ["pullover", "haut"],
  ["tricot", "haut"],
  ["maille", "haut"],
  ["sweat", "haut"],
  ["sweatshirt", "haut"],
  ["hoodie", "haut"],
  ["sweat a capuche", "haut"],
  ["debardeur", "haut"],
  ["bas", "bas"],
  ["pantalon", "bas"],
  ["pant", "bas"],
  ["trousers", "bas"],
  ["robe", "robe"],
  ["manteau", "manteau"],
  ["parka", "manteau"],
  ["doudoune", "manteau"],
  ["veste", "manteau"],
  ["blouson", "manteau"],
  ["jacket", "manteau"],
  ["chaussures", "chaussures"],
  ["chaussure", "chaussures"],
  ["basket", "chaussures"],
  ["baskets", "chaussures"],
  ["sneakers", "chaussures"],
  ["tennis", "chaussures"],
]);

const CATEGORY_EMOJIS = {
  haut: "Vêtement",
  bas: "Vêtement",
  robe: "Vêtement",
  manteau: "Vêtement",
  chaussures: "Vêtement",
  accessoires: "Vêtement",
  ensemble: "Vêtement",
};

function normalizeWardrobePiece(piece) {
  if (!piece) return null;
  const migrated = migrateGarment(piece);
  if (!migrated || migrated.type === GARMENT_TYPES.AUTRE) {
    return null;
  }
  return migrated;
}

function canComposeAnyOutfit(clothes) {
  return checkWardrobeCompleteness(clothes, "casual").canCompose || unclassifiedClothes.length > 0;
}

function buildPartialOutfit(clothes, styleName, weather) {
  const completeness = checkWardrobeCompleteness(clothes, styleName);
  if (unclassifiedClothes.length) {
    return {
      pieces: [],
      missingSlots: [],
      missingReason: `${unclassifiedClothes.length} vêtement(s) à classer`,
    };
  }
  const missingReason = completeness.message
    ? completeness.message.replace(/^information manquante\s*:\s*/i, "")
    : explainMissingPieces(clothes, styleName)
      || "une pièce compatible avec le style demandé";
  const missingSlots = completeness.missingSlots.length
    ? [...completeness.missingSlots]
    : [SLOTS.COUCHE];
  return { pieces: [], missingSlots, missingReason };
}

function getDefaultWeeklyStyles() {
  return {
    monday: "chic",
    tuesday: "casual",
    wednesday: "minimaliste",
    thursday: "rock",
    friday: "chic",
    saturday: "streetwear",
    sunday: "minimaliste",
  };
}

/**
 * Met à jour l'état activé / désactivé du bouton "Générer toute la semaine"
 */
function updateGenerateButtonState() {
  if (!generateBtn) return;
  const hasAtLeastOneStyle = WEEK_DAYS.some(
    ({ key }) => Boolean(weeklyStyles[key]),
  );

  generateBtn.disabled = !hasAtLeastOneStyle;
  if (!hasAtLeastOneStyle) {
    generateBtn.setAttribute("aria-disabled", "true");
    generateBtn.title = "Choisis un style pour au moins un jour avant de générer.";
  } else {
    generateBtn.removeAttribute("aria-disabled");
    generateBtn.title = "Générer les tenues de la semaine selon tes styles";
  }
}

/**
 * Met à jour le badge météo de chaque carte de jour
 */
function updateAllDayWeatherChips() {
  WEEK_DAYS.forEach(({ key }, index) => {
    const chip = document.getElementById(`weather-chip-${key}`);
    if (!chip) return;

    const weather = getWeatherForDay(key, index);
    if (!weather) {
      chip.className = "day-card-weather is-unavailable";
      chip.innerHTML = `
        <span class="weather-chip-icon" aria-hidden="true">—</span>
        <span class="weather-chip-text">Météo indisponible</span>
      `;
      return;
    }

    chip.className = `day-card-weather weather-type-${weather.type}`;
    chip.innerHTML = `
      <div class="weather-row-primary">
        <span class="weather-chip-icon">${weather.iconSvg || weather.emoji}</span>
        <span class="weather-chip-temp">${weather.min}° / ${weather.max}°C</span>
        <span class="weather-chip-condition">${weather.label}</span>
      </div>
      <div class="weather-row-details">
        <span class="weather-chip-stat">Pluie ${weather.rain}%</span>
        <span class="weather-chip-stat">Vent ${weather.wind} km/h</span>
      </div>
    `;
    chip.title = `${weather.label} · ${weather.min} à ${weather.max} °C · Pluie ${weather.rain}% · Vent ${weather.wind} km/h`;
  });
}

function updateDayCardStyleUI(dayKey, styleKey) {
  const select = document.getElementById(`style-${dayKey}`);
  if (select) select.value = styleKey || "";

  const display = document.getElementById(`display-style-${dayKey}`);
  if (display) {
    if (styleKey) {
      display.className = "day-style-display has-style";
      display.innerHTML = `<span class="style-pill">${escapeHtml(getStyleLabel(styleKey))}</span>`;
    } else {
      display.className = "day-style-display no-style";
      display.innerHTML = `<span class="style-empty-box">Aucun style choisi</span>`;
    }
  }

  const card = document.querySelector(`.day-style-card[data-day="${dayKey}"]`);
  if (card) {
    card.classList.toggle("has-selected-style", Boolean(styleKey));
  }
}

/**
 * Affiche les 7 cartes Lundi → Dimanche
 */
function renderWeeklyPlanner() {
  if (!weeklyPlanner) return;
  weeklyPlanner.replaceChildren();
  const todayKey = getDayKey();

  WEEK_DAYS.forEach(({ key, label }, index) => {
    const isToday = key === todayKey;
    const currentStyle = weeklyStyles[key] || "";

    const dayCard = document.createElement("div");
    dayCard.className = `day-style-card${isToday ? " is-today" : ""}${currentStyle ? " has-selected-style" : ""}`;
    dayCard.dataset.day = key;
    dayCard.setAttribute("role", "group");
    dayCard.setAttribute("aria-label", `Jour ${label}`);

    // 1. En-tête : Nom du jour + badge Aujourd'hui
    const cardHeader = document.createElement("div");
    cardHeader.className = "day-card-header";

    const dayName = document.createElement("span");
    dayName.className = "day-style-name";
    dayName.id = `style-${key}-label`;
    dayName.textContent = label;

    cardHeader.appendChild(dayName);

    if (isToday) {
      const todayBadge = document.createElement("span");
      todayBadge.className = "today-tag";
      todayBadge.textContent = "Aujourd’hui";
      cardHeader.appendChild(todayBadge);
    }

    // 2. Météo du jour
    const weatherChip = document.createElement("div");
    weatherChip.id = `weather-chip-${key}`;
    weatherChip.className = "day-card-weather";
    weatherChip.innerHTML = `<span class="weather-chip-skeleton">Chargement météo...</span>`;

    // 3. État du style choisi (pastille caramel ou cadre pointillé)
    const styleDisplay = document.createElement("div");
    styleDisplay.id = `display-style-${key}`;
    styleDisplay.className = `day-style-display ${currentStyle ? "has-style" : "no-style"}`;
    styleDisplay.innerHTML = currentStyle
      ? `<span class="style-pill">${escapeHtml(getStyleLabel(currentStyle))}</span>`
      : `<span class="style-empty-box">Aucun style choisi</span>`;

    // 4. Menu déroulant plein largeur (SEUL moyen de choisir)
    const selectWrap = document.createElement("div");
    selectWrap.className = "day-card-select-wrap";

    const labelElement = document.createElement("label");
    labelElement.htmlFor = `style-${key}`;
    labelElement.className = "day-select-label";
    labelElement.textContent = "Choisir le style :";

    const select = document.createElement("select");
    select.id = `style-${key}`;
    select.className = "day-style-select";
    select.dataset.day = key;
    select.setAttribute("aria-labelledby", `style-${key}-label`);

    // Option "Aucun style"
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Aucun style";
    emptyOption.selected = !currentStyle;
    select.appendChild(emptyOption);

    // Les cinq styles disponibles
    CANONICAL_STYLES.forEach(({ key: styleKey, label: styleLabel }) => {
      const option = document.createElement("option");
      option.value = styleKey;
      option.textContent = styleLabel;
      option.selected = currentStyle === styleKey;
      select.appendChild(option);
    });

    selectWrap.append(labelElement, select);

    // Bouton de réessai spécifique au jour en cas d'erreur
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "day-retry-btn hidden";
    retryBtn.id = `retry-day-${key}`;
    retryBtn.dataset.day = key;
    retryBtn.textContent = "Réessayer";
    retryBtn.setAttribute("aria-label", `Réessayer la tenue de ${label}`);

    retryBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void generateSingleDayOutfit(key);
    });

    dayCard.append(cardHeader, weatherChip, styleDisplay, selectWrap, retryBtn);

    select.addEventListener("change", async () => {
      weeklyStyles[key] = select.value;
      updateDayCardStyleUI(key, select.value);
      updateTodayStyle();
      updateGenerateButtonState();
      await saveWeeklyStyles();
    });

    weeklyPlanner.appendChild(dayCard);
  });

  updateAllDayWeatherChips();
  updateTodayStyle();
  updateGenerateButtonState();
}

function updateTodayStyle() {
  const todayKey = getDayKey();
  const todayStyle = weeklyStyles[todayKey];
  if (todayStyleLabel) {
    if (todayStyle) {
      todayStyleLabel.textContent = `Aujourd’hui : ${getStyleLabel(todayStyle)}`;
      todayStyleLabel.classList.remove("has-no-style");
    } else {
      todayStyleLabel.textContent = "Aujourd’hui : Aucun style";
      todayStyleLabel.classList.add("has-no-style");
    }
  }
}

/**
 * Charge les styles hebdomadaires depuis Firestore, avec localStorage en secours
 */
async function loadWeeklyStyles() {
  weeklyStyles = getDefaultWeeklyStyles();

  const storageKey = currentUser
    ? `styleai_weekly_styles_${currentUser.uid}`
    : "styleai_weekly_styles_guest";

  try {
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      weeklyStyles = { ...weeklyStyles, ...parsed };
    }
  } catch {
    // Ignore cache error
  }

  // Les anciens styles enregistrés ne sont plus proposés : on les vide aussi
  // dans le cache local afin que le planning reste cohérent hors connexion.
  weeklyStyles = Object.fromEntries(
    WEEK_DAYS.map(({ key }) => [
      key,
      normalizeRequestedStyle(weeklyStyles[key]),
    ]),
  );

  if (currentUser) {
    try {
      const scheduleSnapshot = await getDoc(
        doc(db, `users/${currentUser.uid}/settings`, "weeklyStyles"),
      );
      if (scheduleSnapshot.exists()) {
        const storedStyles = scheduleSnapshot.data();
        weeklyStyles = Object.fromEntries(
          WEEK_DAYS.map(({ key }) => [
            key,
            normalizeRequestedStyle(storedStyles[key] ?? weeklyStyles[key] ?? ""),
          ]),
        );
        try {
          localStorage.setItem(storageKey, JSON.stringify(weeklyStyles));
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.warn("[StyleAI] Impossible de synchroniser avec Firestore, secours local utilisé :", error);
    }
  }

  renderWeeklyPlanner();
}

/**
 * Enregistre les styles hebdomadaires (Firestore + localStorage)
 */
async function saveWeeklyStyles() {
  const storageKey = currentUser
    ? `styleai_weekly_styles_${currentUser.uid}`
    : "styleai_weekly_styles_guest";

  try {
    localStorage.setItem(storageKey, JSON.stringify(weeklyStyles));
  } catch {
    // Ignore quota error
  }

  if (plannerStatus) plannerStatus.textContent = "Planning enregistré.";

  if (!currentUser) return;

  try {
    await setDoc(
      doc(db, `users/${currentUser.uid}/settings`, "weeklyStyles"),
      weeklyStyles,
      { merge: true },
    );
    if (plannerStatus) plannerStatus.textContent = "Planning enregistré.";
  } catch (error) {
    console.warn("Erreur enregistrement styles hebdo Firestore :", error);
  }
}

/**
 * Enregistre les tenues générées dans Firestore et localStorage
 * @param {Array<any>} outfits
 */
async function saveWeeklyOutfits(outfits, notify = false) {
  latestGeneratedOutfits = outfits;
  if (!currentUser) {
    if (notify) showToast("Connecte-toi pour sauvegarder ta semaine.", "error");
    return false;
  }
  if (!Array.isArray(outfits) || outfits.length === 0) {
    if (notify) showToast("Génère au moins une tenue avant de sauvegarder.", "error");
    return false;
  }
  if (isSavingWeeklyOutfits) return false;
  const storageKey = currentUser
    ? `styleai_weekly_outfits_${currentUser.uid}`
    : "styleai_weekly_outfits_guest";

  const payload = {
    updatedAt: new Date().toISOString(),
    outfits,
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // ignore
  }

  isSavingWeeklyOutfits = true;
  if (saveWeekButton) {
    saveWeekButton.disabled = true;
    saveWeekButton.textContent = "Sauvegarde en cours…";
  }
  try {
    const savedWeeksRef = collection(db, `users/${currentUser.uid}/outfits`);
    if (activeSavedWeekId) {
      await updateDoc(doc(db, `users/${currentUser.uid}/outfits`, activeSavedWeekId), payload);
    } else {
      const savedWeekRef = await addDoc(savedWeeksRef, payload);
      activeSavedWeekId = savedWeekRef.id;
    }
    if (outfitsSavedIndicator) {
      outfitsSavedIndicator.textContent = "✓ Tenues sauvegardées";
    }
    if (notify) showToast("Ta semaine est sauvegardée.");
    return true;
  } catch (error) {
    console.warn("[StyleAI] Erreur sauvegarde tenues Firestore :", error);
    if (outfitsSavedIndicator) outfitsSavedIndicator.textContent = "Semaine non sauvegardée";
    if (notify) showToast("Impossible de sauvegarder ta semaine. Réessaie.", "error");
    return false;
  } finally {
    isSavingWeeklyOutfits = false;
    if (saveWeekButton) {
      saveWeekButton.disabled = !currentUser || latestGeneratedOutfits.length === 0;
      saveWeekButton.textContent = "Sauvegarder ma semaine";
    }
  }
}

function markWeeklyOutfitsChanged(outfits) {
  latestGeneratedOutfits = outfits;
  if (saveWeekButton) saveWeekButton.disabled = !currentUser || !outfits.length;
  if (outfitsSavedIndicator) {
    outfitsSavedIndicator.textContent = activeSavedWeekId
      ? "Modifications non enregistrées"
      : "Semaine non sauvegardée";
  }
}

function renderSavedWeeks() {
  if (!savedWeekPanel || !savedWeekList) return;
  savedWeekPanel.classList.toggle("hidden", savedWeeks.length === 0);
  if (savedWeekCount) savedWeekCount.textContent = String(savedWeeks.length);
  savedWeekList.replaceChildren();
  for (const savedWeek of savedWeeks) {
    const card = document.createElement("article");
    card.className = "saved-week-item";
    const title = document.createElement("h4");
    title.className = "saved-week-title";
    title.textContent = savedWeek.title || "Ma semaine";
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.dataset.openWeek = savedWeek.id;
    openButton.textContent = "Rouvrir";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.dataset.deleteWeek = savedWeek.id;
    deleteButton.textContent = "Supprimer";
    card.append(title, openButton, deleteButton);
    savedWeekList.append(card);
  }
}

savedWeekList?.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-week]");
  const deleteButton = event.target.closest("[data-delete-week]");
  if (openButton) {
    const savedWeek = savedWeeks.find((week) => week.id === openButton.dataset.openWeek);
    if (!savedWeek) return;
    activeSavedWeekId = savedWeek.id === "local-cache" ? null : savedWeek.id;
    latestGeneratedOutfits = savedWeek.outfits || [];
    outfitsContainer?.classList.remove("hidden");
    renderWeeklyOutfits(latestGeneratedOutfits);
    scrollToWeeklyOutfits();
    if (outfitsSavedIndicator) outfitsSavedIndicator.textContent = "Tenues enregistrées";
    return;
  }
  if (!deleteButton || !currentUser) return;
  const savedWeek = savedWeeks.find((week) => week.id === deleteButton.dataset.deleteWeek);
  if (!savedWeek) return;
  if (savedWeek.id === "local-cache") {
    savedWeeks = savedWeeks.filter((week) => week.id !== savedWeek.id);
    renderSavedWeeks();
    return;
  }
  void deleteDoc(doc(db, `users/${currentUser.uid}/outfits`, savedWeek.id)).then(() => {
    if (activeSavedWeekId === savedWeek.id) activeSavedWeekId = null;
  }).catch((error) => {
    console.warn("[StyleAI] Impossible de supprimer la semaine :", error);
    showToast("Impossible de supprimer cette semaine.", "error");
  });
});

/**
 * Charge les tenues déjà sauvegardées au chargement de la page
 */
async function loadSavedOutfits() {
  const storageKey = currentUser
    ? `styleai_weekly_outfits_${currentUser.uid}`
    : "styleai_weekly_outfits_guest";

  try {
    const cached = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (Array.isArray(cached?.outfits) && cached.outfits.length) {
      savedWeeks = [{ ...cached, id: "local-cache", title: "Semaine sauvegardée sur cet appareil" }];
    }
  } catch { /* cache local absent ou invalide */ }
  if (!currentUser) return renderSavedWeeks();
  onSnapshot(collection(db, `users/${currentUser.uid}/outfits`), (snapshot) => {
    savedWeeks = snapshot.docs.map((savedWeek) => ({ id: savedWeek.id, ...savedWeek.data() }));
    renderSavedWeeks();
  }, (error) => {
    console.warn("[StyleAI] Impossible de lire les semaines sauvegardées :", error);
    renderSavedWeeks();
  });
}

saveWeekButton?.addEventListener("click", () => {
  void saveWeeklyOutfits(latestGeneratedOutfits, true);
});

function loadUserClothes() {
  stopClothesListener?.();
  const clothesRef = collection(db, `users/${currentUser.uid}/clothes`);
  stopClothesListener = onSnapshot(
    clothesRef,
    (snapshot) => {
      unclassifiedClothes = [];
      const migratedByDoc = snapshot.docs
        .map((clothDoc) => {
          const raw = { id: clothDoc.id, ...clothDoc.data() };
          const migrated = normalizeWardrobePiece(raw);
          if (!migrated) {
            unclassifiedClothes.push(raw);
            return null;
          }
          if (
            migrated &&
            ["type", "slot", "colors", "colorConfidence", "isContradictory"].some(
              (field) => raw[field] !== migrated[field],
            )
          ) {
            void setDoc(
              doc(db, `users/${currentUser.uid}/clothes`, clothDoc.id),
              {
                type: migrated.type,
                slot: migrated.slot,
                colors: migrated.colors,
                colorConfidence: migrated.colorConfidence,
                isContradictory: migrated.isContradictory,
              },
              { merge: true },
            );
          }
          return migrated;
        })
        .filter(Boolean);

      userClothes = migratedByDoc;
      updateGenerateButtonState();
      // La garde-robe peut arriver après les tenues sauvegardées : on réaffiche
      // pour que les réparations (cravate Chic, veste, etc.) puissent utiliser
      // les vêtements réellement chargés.
      if (latestGeneratedOutfits.length > 0) {
        renderWeeklyOutfits(latestGeneratedOutfits);
      }
    },
    (error) => {
      console.error("Erreur chargement garde-robe :", error);
      showToast("Erreur lors du chargement de la garde-robe", "error");
    },
  );
}

// Action discrète : Réinitialiser la semaine avec confirmation
resetWeekBtn?.addEventListener("click", async () => {
  if (
    !window.confirm(
      "Voulez-vous réinitialiser le style de tous les jours sur « Aucun style » ?",
    )
  ) {
    return;
  }
  WEEK_DAYS.forEach(({ key }) => {
    weeklyStyles[key] = "";
    updateDayCardStyleUI(key, "");
  });
  updateTodayStyle();
  updateGenerateButtonState();
  await saveWeeklyStyles();
  showToast("Planning réinitialisé sur Aucun style.");
});

function getGenerationErrorMessage(error, dayLabel, weather) {
  if (error?.message === "DAY_TIMEOUT") {
    return "La composition a pris trop de temps pour cette journée.";
  }
  return "Impossible de composer cette tenue avec les vêtements disponibles.";
}

function makeFailedDayOutfit(day, styleName, weather, reason) {
  return {
    id: `failed-${day.key}`,
    dayKey: day.key,
    name: day.label,
    style: styleName,
    styleBadge: getStyleLabel(styleName),
    pieces: [],
    missingSlots: ["Haut", "Bas", "Chaussures"],
    description: reason,
    manque: "une combinaison de vêtements adaptée",
    isError: true,
    weatherSummary: weather
      ? `Météo : ${weather.label} · ${weather.min}–${weather.max} °C · pluie ${weather.rain}%`
      : "Météo non prise en compte",
  };
}

function makeSkippedDayOutfit(day) {
  return {
    id: `skipped-${day.key}`,
    dayKey: day.key,
    name: day.label,
    style: "",
    styleBadge: "Aucun style",
    pieces: [],
    missingSlots: [],
    description: "Aucun style n'a été sélectionné pour cette journée.",
    manque: null,
    isSkipped: true,
    weatherSummary: "",
  };
}

/**
 * Génère une tenue pour un jour précis (utilisé pour les réessais jour par jour)
 * @param {string} dayKey
 */
async function generateSingleDayOutfit(dayKey, { silent = false } = {}) {
  const dayIndex = WEEK_DAYS.findIndex((d) => d.key === dayKey);
  if (dayIndex === -1) return;
  const day = WEEK_DAYS[dayIndex];
  const styleName = normalizeRequestedStyle(weeklyStyles[day.key]);

  if (!styleName) {
    showToast(`Choisis d'abord un style pour ${day.label}.`);
    return;
  }

  showToast(`Génération pour ${day.label}...`);
  await ensureWeatherAvailable();
  const weather = getWeatherForDay(day.key, dayIndex);
  let newOutfit = null;
  let serverRejection = null;
  let resolverMissingSlot = null;

  try {
    const isFormalVariant = styleName === "chic" || styleName === "minimaliste";
    if (isFormalVariant) {
      const chicRes = resolveFormalOutfit(userClothes, { weather, style: styleName });
      if (chicRes.success) {
        newOutfit = {
          id: `outfit-${dayIndex + 1}`,
          dayKey: day.key,
          name: day.label,
          style: chicRes.style,
          styleBadge: chicRes.style,
          pieces: chicRes.pieces,
          description: chicRes.justification,
          weather,
          weatherSummary: weather
            ? `Météo : ${weather.label} · ${weather.min}–${weather.max} °C · pluie ${weather.rain}%`
            : "Météo non prise en compte",
        };
      } else {
        serverRejection = chicRes.message;
        resolverMissingSlot = chicRes.missingSlot;
      }
    }

    if (!newOutfit) {
      const candidates = generateOutfits(userClothes, styleName, 1, dayIndex, weather);
      if (candidates && candidates.length > 0) {
        newOutfit = candidates[0];
        newOutfit.dayKey = day.key;
        newOutfit.name = day.label;
        newOutfit.weatherSummary = weather
          ? `Météo : ${weather.label} · ${weather.min}–${weather.max} °C · pluie ${weather.rain}%`
          : "Météo non prise en compte";
      }
    }

    if (newOutfit) {
      const serverValidation = await validateOutfitOnServer(newOutfit);
      if (serverValidation && !serverValidation.isValid) {
        serverRejection = serverValidation.errors?.[0] || "tenue refusée par le serveur";
        newOutfit = null;
      }
    }

    if (!newOutfit) {
      const partial = buildPartialOutfit(userClothes, styleName, weather);
      newOutfit = {
        id: `missing-${day.key}`,
        dayKey: day.key,
        name: day.label,
        style: styleName,
        styleBadge: getStyleLabel(styleName),
        pieces: [],
        missingSlots: resolverMissingSlot ? [resolverMissingSlot] : partial.missingSlots,
        description: serverRejection
          ? `Tenue refusée par le serveur : ${serverRejection}`
          : `Pièce manquante : ${partial.missingReason}`,
        manque: serverRejection || partial.missingReason,
        isError: true,
        weatherSummary: weather
          ? `Météo : ${weather.label} · ${weather.min}–${weather.max} °C · pluie ${weather.rain}%`
          : "Météo non prise en compte",
      };
    }

    const updated = [...latestGeneratedOutfits];
    const existingIdx = updated.findIndex((o) => o.dayKey === day.key || o.name === day.label);
    if (existingIdx !== -1) {
      updated[existingIdx] = newOutfit;
    } else {
      updated.push(newOutfit);
    }

    const retryBtn = document.getElementById(`retry-day-${day.key}`);
    if (retryBtn) {
      retryBtn.classList.toggle("hidden", !newOutfit.isError);
    }

    renderWeeklyOutfits(updated);
    markWeeklyOutfitsChanged(updated);
    if (!silent) showToast(`Tenue de ${day.label} mise à jour !`);
  } catch (error) {
    console.error(`Erreur réessai ${day.label} :`, error);
    if (!silent) showToast(`Échec pour ${day.label}`, "error");
  }
}

async function generateDayWithAlternativeStyle(dayKey, styleKey) {
  if (!ALTERNATIVE_STYLES.includes(styleKey)) return;
  weeklyStyles[dayKey] = styleKey;
  updateDayCardStyleUI(dayKey, styleKey);
  updateTodayStyle();
  updateGenerateButtonState();
  await saveWeeklyStyles();
  await generateSingleDayOutfit(dayKey);
}

function getOutfitPieceLabel(piece) {
  const slotLabels = {
    [SLOTS.BASE]: "Première couche",
    [SLOTS.COUCHE]: "Seconde couche",
    [SLOTS.VESTE]: "Manteau / veste",
    [SLOTS.BAS]: "Bas",
    [SLOTS.ROBE]: "Robe",
    [SLOTS.CHAUSSURES]: "Chaussures",
    [SLOTS.ACCESSOIRE]: "Accessoire",
  };
  const category = slotLabels[normalizeGarmentSlot(piece)] || piece.category;
  return [category, piece.colors].filter(Boolean).join(" · ");
}

/**
 * Génération hebdomadaire résiliente jour par jour
 */
async function generateWeeklyOutfitsReliable() {
  const currentGeneration = ++generationVersion;
  activeGenerationController?.abort();
  const controller = new AbortController();
  activeGenerationController = controller;
  const weeklyOutfits = [];
  let hasErrors = false;

  retryGenerationBtn?.classList.add("hidden");

  WEEK_DAYS.forEach(({ key }) => {
    document.getElementById(`retry-day-${key}`)?.classList.add("hidden");
  });

  if (!canComposeAnyOutfit(userClothes)) {
    const completeness = checkWardrobeCompleteness(userClothes, "casual");
    const missingReason = completeness.message
      ? completeness.message.replace(/^information manquante\s*:\s*/i, "")
      : "une pièce compatible avec la couche chaude obligatoire (pull ou hoodie)";
    noClothesWarning?.classList.remove("hidden");
    outfitsContainer?.classList.add("hidden");
    const warningText = document.getElementById("no-clothes-warning-text");
    if (warningText) {
      warningText.textContent = `Ta garde-robe ne contient pas encore les pièces nécessaires : ${missingReason}. Ajoute un haut et un bas, ou une robe, ainsi qu'une paire de chaussures et un pull ou un hoodie.`;
    }
    if (plannerStatus) plannerStatus.textContent = `Garde-robe incomplète : ${missingReason}.`;
    activeGenerationController = null;
    return;
  }

  noClothesWarning?.classList.add("hidden");
  outfitsContainer?.classList.add("hidden");
  progressContainer?.classList.remove("hidden");
  generateBtn.disabled = true;
  generateBtn.setAttribute("aria-busy", "true");
  if (progressFill) progressFill.style.width = "0%";
  progressBar?.setAttribute("aria-valuenow", "0");
  if (generationStatus) generationStatus.textContent = "Génération en cours : 0/7 jour traité...";

  await ensureWeatherAvailable();

  let previousDayPieces = [];

  try {
    for (let dayIndex = 0; dayIndex < WEEK_DAYS.length; dayIndex += 1) {
      const day = WEEK_DAYS[dayIndex];
      const styleName = normalizeRequestedStyle(weeklyStyles[day.key]);
      const weather = getWeatherForDay(day.key, dayIndex);
      const avoidIds = new Set(previousDayPieces.map((p) => p.id));

      if (!styleName) {
        weeklyOutfits.push(makeSkippedDayOutfit(day));
        const completed = dayIndex + 1;
        if (progressFill) progressFill.style.width = `${(completed / WEEK_DAYS.length) * 100}%`;
        progressBar?.setAttribute("aria-valuenow", String(completed));
        if (generationStatus) {
          generationStatus.textContent = `Génération en cours : ${completed}/7 jours traités...`;
        }
        continue;
      }

      try {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        await new Promise((resolve) => setTimeout(resolve, 30));

        let outfit = null;
        let specificFailureReason = null;
        let resolverMissingSlot = null;
        const isFormalVariant = styleName === "chic" || styleName === "minimaliste";

        if (isFormalVariant) {
          const chicRes = resolveFormalOutfit(userClothes, { weather, avoidIds, style: styleName });
          if (chicRes.success) {
            outfit = {
              id: `outfit-${dayIndex + 1}`,
              dayKey: day.key,
              name: day.label,
              style: chicRes.style,
              styleBadge: chicRes.style,
              pieces: chicRes.pieces,
              description: chicRes.justification,
              weather,
              weatherSummary: weather
                ? `Météo : ${weather.label} · ${weather.min}–${weather.max} °C · pluie ${weather.rain}%`
                : "Météo non prise en compte",
            };
          } else {
            specificFailureReason = chicRes.message;
            resolverMissingSlot = chicRes.missingSlot;
          }
        }

        if (!outfit) {
          const candidates = generateOutfits(userClothes, styleName, 1, dayIndex, weather, avoidIds);
          if (candidates && candidates.length > 0) {
            outfit = candidates[0];
            outfit.dayKey = day.key;
            outfit.name = day.label;
            outfit.weatherSummary = weather
              ? `Météo : ${weather.label} · ${weather.min}–${weather.max} °C · pluie ${weather.rain}%`
              : "Météo non prise en compte";
          }
        }

        if (outfit) {
          const serverValidation = await validateOutfitOnServer(outfit);
          if (serverValidation && !serverValidation.isValid) {
            specificFailureReason =
              serverValidation.errors?.[0] || "tenue refusée par le serveur";
            outfit = null;
          }
        }

        if (outfit) {
          outfit.pieces = outfit.pieces || [];
          outfit.missingSlots = [];
          outfit.manque = null;
          previousDayPieces = outfit.pieces;
          weeklyOutfits.push(outfit);
        } else {
          hasErrors = true;
          previousDayPieces = [];
          const partial = buildPartialOutfit(userClothes, styleName, weather);
          const failedOutfit = {
            id: `missing-${day.key}`,
            dayKey: day.key,
            name: day.label,
            style: styleName,
            styleBadge: getStyleLabel(styleName),
            pieces: [],
            missingSlots: resolverMissingSlot ? [resolverMissingSlot] : partial.missingSlots,
            description: specificFailureReason || `Pièce manquante : ${partial.missingReason}`,
            manque: specificFailureReason
              ? specificFailureReason.replace(/^il manque\s*:\s*/i, "")
              : partial.missingReason,
            isError: true,
            weatherSummary: weather
              ? `Météo : ${weather.label} · ${weather.min}–${weather.max} °C · pluie ${weather.rain}%`
              : "Météo non prise en compte",
          };
          weeklyOutfits.push(failedOutfit);

          document.getElementById(`retry-day-${day.key}`)?.classList.remove("hidden");
        }
      } catch (dayError) {
        hasErrors = true;
        console.warn(`[StyleAI] Erreur isolée pour ${day.label} :`, dayError);
        weeklyOutfits.push(
          makeFailedDayOutfit(day, styleName, weather, getGenerationErrorMessage(dayError, day.label, weather)),
        );
        document.getElementById(`retry-day-${day.key}`)?.classList.remove("hidden");
      }

      const completed = dayIndex + 1;
      if (progressFill) progressFill.style.width = `${(completed / WEEK_DAYS.length) * 100}%`;
      progressBar?.setAttribute("aria-valuenow", String(completed));
      if (generationStatus) {
        generationStatus.textContent = `Génération en cours : ${completed}/7 jours traités...`;
      }
    }

    if (currentGeneration !== generationVersion || controller.signal.aborted) return;

    outfitsContainer?.classList.remove("hidden");
    renderWeeklyOutfits(weeklyOutfits);
    scrollToWeeklyOutfits();
    markWeeklyOutfitsChanged(weeklyOutfits);
    const failedDayKeys = weeklyOutfits.filter((outfit) => outfit.isError).map((outfit) => outfit.dayKey);
    if (failedDayKeys.length > 0) {
      for (const dayKey of failedDayKeys) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await generateSingleDayOutfit(dayKey, { silent: true });
      }
    }

    if (plannerStatus) {
      plannerStatus.textContent = hasErrors
        ? "Certaines journées n’ont pas pu être composées (bouton « Réessayer » disponible)."
        : "Les 7 journées ont été générées et enregistrées avec succès !";
    }

    outfitsContainer?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (globalError) {
    if (globalError?.name !== "AbortError") {
      console.error("[StyleAI] Erreur globale de génération :", globalError);
      if (plannerStatus) {
        plannerStatus.textContent = "La génération a rencontré un problème. Vérifie ta garde-robe et réessaie.";
      }
      showToast("La génération a rencontré un problème. Réessaie.", "error");
    }
  } finally {
    if (currentGeneration === generationVersion) {
      progressContainer?.classList.add("hidden");
      generateBtn.disabled = false;
      generateBtn.removeAttribute("aria-busy");
      updateGenerateButtonState();
      retryGenerationBtn?.classList.toggle("hidden", !hasErrors);
    }
    if (activeGenerationController === controller) activeGenerationController = null;
  }
}

generateBtn?.addEventListener("click", () => {
  activeSavedWeekId = null;
  latestGeneratedOutfits = [];
  if (saveWeekButton) saveWeekButton.disabled = true;
  if (outfitsSavedIndicator) outfitsSavedIndicator.textContent = "";
  generateWeeklyOutfitsReliable();
});

retryGenerationBtn?.addEventListener("click", () => {
  activeSavedWeekId = null;
  generateWeeklyOutfitsReliable();
});

function withChicNeckwear(outfit, styleKey) {
  if (styleKey !== "chic" || !Array.isArray(outfit.pieces) || outfit.pieces.length === 0) {
    return outfit;
  }
  if (outfit.pieces.some(isFormalNeckwear)) return outfit;

  const base = outfit.pieces.find((piece) => normalizeGarmentSlot(piece) === SLOTS.BASE);
  if (!base || !isShirt(base)) return outfit;

  const neckwear = userClothes.find(
    (piece) =>
      isFormalNeckwear(piece) &&
      normalizeGarmentSlot(piece) === SLOTS.ACCESSOIRE,
  );
  if (!neckwear || outfit.pieces.some((piece) => piece.id === neckwear.id)) {
    return outfit;
  }

  const candidate = {
    ...outfit,
    style: styleKey,
    pieces: [...outfit.pieces, neckwear],
  };
  return validateOutfit(candidate, styleKey, outfit.weather || null).isValid
    ? candidate
    : outfit;
}

/**
 * Dernier verrou déterministe avant l'affichage : une tenue invalide est
 * réparée si possible, sinon transformée en carte d'erreur explicite. Une
 * tenue invalide n'est jamais rendue telle quelle.
 */
function ensureDisplayableOutfit(outfit) {
  if (!outfit || outfit.isSkipped) return outfit;
  if (!Array.isArray(outfit.pieces) || outfit.pieces.length === 0) return outfit;

  const styleKey = normalizeRequestedStyle(outfit.style) || "casual";
  const weather = outfit.weather || null;
  const normalizedOutfit = withChicNeckwear(
    { ...outfit, style: styleKey },
    styleKey,
  );
  const validation = validateOutfit(normalizedOutfit, styleKey, weather);
  if (validation.isValid) return normalizedOutfit;

  const repaired = repairOrDiscardOutfit(normalizedOutfit, styleKey, weather, userClothes);
  if (repaired) {
    const repairedWithNeckwear = withChicNeckwear(
      { ...repaired, style: styleKey },
      styleKey,
    );
    const revalidation = validateOutfit(repairedWithNeckwear, styleKey, weather);
    if (revalidation.isValid) {
      return {
        ...outfit,
        pieces: repairedWithNeckwear.pieces,
        repaired: true,
      };
    }
  }

  const missingReason =
    explainMissingPieces(userClothes, styleKey) ||
    validation.errors[0] ||
    "une combinaison valide avec les vêtements disponibles";
  return {
    ...outfit,
    pieces: [],
    isError: true,
    missingSlots: validation.missingSlots.length ? validation.missingSlots : [SLOTS.COUCHE],
    description: `Pièce manquante : ${missingReason}`,
    manque: missingReason,
  };
}

function renderOutfits(outfits, styleName, title = null) {
  if (!outfitsGrid) return;
  const displayOutfits = outfits.map(ensureDisplayableOutfit);
  const validCount = displayOutfits.filter(
    (o) => !o.isSkipped && !o.isError && o.pieces?.length,
  ).length;
  outfitsGrid.classList.toggle("single-outfit", displayOutfits.length === 1);
  if (outfitsTitle) {
    outfitsTitle.textContent =
      title || (validCount > 0 ? `Ta semaine (${validCount} tenues composées)` : "Tes tenues");
  }
  outfitsGrid.replaceChildren();

  displayOutfits.forEach((outfit, index) => {
    const isMissing = !outfit.pieces || outfit.pieces.length === 0;
    const isSkipped = Boolean(outfit.isSkipped);
    const isError = Boolean(outfit.isError);

    const card = document.createElement("div");
    card.className = `outfit-card${isMissing ? " is-missing" : ""}${isSkipped ? " is-skipped" : ""}${isError ? " is-error" : ""}`;

    const header = document.createElement("div");
    header.className = "outfit-header";

    const num = document.createElement("div");
    num.className = "outfit-number";
    num.textContent = outfit.name;

    const badge = document.createElement("div");
    badge.className = "style-badge";
    badge.textContent = outfit.styleBadge || "Style";

    header.appendChild(num);
    header.appendChild(badge);
    card.appendChild(header);

    const piecesContainer = document.createElement("div");
    piecesContainer.className = "outfit-pieces";

    if (!isMissing) {
      const layerOrder = [
        [SLOTS.BASE, "Première couche"],
        [SLOTS.COUCHE, "Seconde couche"],
        [SLOTS.VESTE, "Troisième couche · manteau / veste"],
        [SLOTS.BAS, "Bas"],
        [SLOTS.ROBE, "Robes"],
        [SLOTS.CHAUSSURES, "Chaussures"],
        [SLOTS.ACCESSOIRE, "Accessoires"],
      ];
      const piecesBySlot = new Map();
      outfit.pieces.forEach((piece) => {
        const slot = normalizeGarmentSlot(piece);
        if (!piecesBySlot.has(slot)) piecesBySlot.set(slot, []);
        piecesBySlot.get(slot).push(piece);
      });

      layerOrder.forEach(([slot, label]) => {
        const slotPieces = piecesBySlot.get(slot);
        if (!slotPieces?.length) return;
        const layerSection = document.createElement("section");
        layerSection.className = "outfit-layer-section";
        const layerHeading = document.createElement("h4");
        layerHeading.className = "outfit-layer-heading";
        layerHeading.textContent = label;
        const layerPieces = document.createElement("div");
        layerPieces.className = "outfit-layer-pieces";
        slotPieces.forEach((piece) => {
        const pieceDiv = document.createElement("div");
        pieceDiv.className = "outfit-piece";

        let thumbnail;
        if (piece.imageUrl) {
          thumbnail = document.createElement("img");
          thumbnail.loading = "lazy";
          thumbnail.decoding = "async";
          thumbnail.width = 240;
          thumbnail.height = 320;
          thumbnail.src = piece.imageUrl;
          thumbnail.alt = piece.name || "Vêtement";
          thumbnail.className = "piece-thumb";
        } else {
          thumbnail = document.createElement("div");
          thumbnail.className = "piece-thumb";
          thumbnail.setAttribute("aria-label", CATEGORY_EMOJIS[piece.category] || "Vêtement");
        }
        const pieceInfo = document.createElement("div");
        pieceInfo.className = "piece-info";
        const pieceName = document.createElement("h4");
        pieceName.className = "piece-name";
        pieceName.textContent = piece.name || "Vêtement";
        const pieceCategory = document.createElement("p");
        pieceCategory.className = "piece-category";
        pieceCategory.textContent = getOutfitPieceLabel(piece);
        pieceInfo.append(pieceName, pieceCategory);
        pieceDiv.append(thumbnail, pieceInfo);
        layerPieces.appendChild(pieceDiv);
      });
        layerSection.append(layerHeading, layerPieces);
        piecesContainer.appendChild(layerSection);
      });
      card.appendChild(piecesContainer);

      if (outfit.description) {
        const desc = document.createElement("div");
        desc.className = "outfit-description";
        desc.textContent = outfit.description;
        card.appendChild(desc);
      }

      if (outfit.weatherSummary) {
        const weatherInfo = document.createElement("div");
        weatherInfo.className = "outfit-weather";
        weatherInfo.textContent = outfit.weatherSummary;
        card.appendChild(weatherInfo);
      }

      // Bouton Modifier
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "edit-outfit-btn";
      editButton.textContent = "Modifier cette tenue";
      editButton.title = `Générer une alternative pour ${outfit.name}`;
      editButton.addEventListener("click", () => {
        const currentSignature = outfit.pieces
          .map((piece) => piece.id)
          .sort()
          .join("|");
        const seenSignatures = new Set(outfit._editHistory || []);
        seenSignatures.add(currentSignature);
        const currentPieceIds = new Set(outfit.pieces.map((piece) => piece.id));

        let replacement = null;
        for (let offset = 0; offset < 12 && !replacement; offset += 1) {
          const alternatives = generateOutfits(
            userClothes,
            outfit.style,
            6,
            offset * 7 + 1,
            outfit.weather || null,
            currentPieceIds,
          );
          replacement = alternatives.find((candidate) => {
            const signature = candidate.pieces
              .map((piece) => piece.id)
              .sort()
              .join("|");
            return !seenSignatures.has(signature);
          });
        }
        if (!replacement) {
          showToast("Aucune autre combinaison trouvée avec ces pièces.");
          return;
        }

        replacement.name = outfit.name;
        replacement.dayKey = outfit.dayKey;
        replacement.weather = outfit.weather;
        replacement.weatherSummary = outfit.weatherSummary;
        replacement._editHistory = [
          ...seenSignatures,
          replacement.pieces
            .map((piece) => piece.id)
            .sort()
            .join("|"),
        ];
        const updatedOutfits = [...outfits];
        updatedOutfits[index] = replacement;
        markWeeklyOutfitsChanged(updatedOutfits);
        renderOutfits(updatedOutfits, styleName, outfitsTitle?.textContent);
        showToast(`Nouvelle tenue générée pour ${outfit.name} !`);
      });
      card.appendChild(editButton);
    } else {
      if (isSkipped) {
        const skippedMsg = document.createElement("div");
        skippedMsg.className = "outfit-skipped-message";
        skippedMsg.innerHTML = `
          <p>Aucun style n'a été choisi pour cette journée.</p>
          <small>Choisis un style dans le planning ci-dessus pour composer cette tenue.</small>
        `;
        piecesContainer.appendChild(skippedMsg);
      } else {
        (outfit.missingSlots || ["Haut", "Bas", "Chaussures"]).forEach((slot) => {
          const placeholder = document.createElement("div");
          placeholder.className = "outfit-piece outfit-piece-placeholder";
          const placeholderThumb = document.createElement("div");
          placeholderThumb.className = "piece-thumb missing-piece-thumb";
          placeholderThumb.textContent = "+";
          placeholderThumb.setAttribute("aria-hidden", "true");
          const placeholderInfo = document.createElement("div");
          placeholderInfo.className = "piece-info";
          const placeholderName = document.createElement("h4");
          placeholderName.className = "piece-name";
          placeholderName.textContent = "Vêtement manquant";
          const placeholderCategory = document.createElement("p");
          placeholderCategory.className = "piece-category";
          placeholderCategory.textContent = slot;
          placeholderInfo.append(placeholderName, placeholderCategory);
          placeholder.append(placeholderThumb, placeholderInfo);
          piecesContainer.appendChild(placeholder);
        });
      }
      card.appendChild(piecesContainer);

      if (outfit.manque) {
        const missingInfo = document.createElement("div");
        missingInfo.className = "outfit-missing";
        missingInfo.textContent = `Il manque : ${outfit.manque}.`;
        card.appendChild(missingInfo);
      } else if (outfit.description && !isSkipped) {
        const desc = document.createElement("div");
        desc.className = "outfit-description";
        desc.textContent = outfit.description;
        card.appendChild(desc);
      }

      if (outfit.weatherSummary) {
        const weatherInfo = document.createElement("div");
        weatherInfo.className = "outfit-weather";
        weatherInfo.textContent = outfit.weatherSummary;
        card.appendChild(weatherInfo);
      }

      if (isError && outfit.dayKey) {
        const alternativeStyles = ALTERNATIVE_STYLES.filter((styleKey) => styleKey !== outfit.style);
        if (alternativeStyles.length > 0) {
          const alternativeBanner = document.createElement("section");
          alternativeBanner.className = "outfit-alternative-banner";
          alternativeBanner.setAttribute("aria-label", "Styles alternatifs disponibles");
          const alternativeMessage = document.createElement("p");
          alternativeMessage.textContent = "Il manque des vêtements compatibles avec ce style. Essaie plutôt :";
          const alternativeActions = document.createElement("div");
          alternativeActions.className = "outfit-alternative-actions";
          for (const styleKey of alternativeStyles) {
            const alternativeButton = document.createElement("button");
            alternativeButton.type = "button";
            alternativeButton.className = "outfit-alternative-btn";
            alternativeButton.textContent = getStyleLabel(styleKey);
            alternativeButton.addEventListener("click", () => {
              void generateDayWithAlternativeStyle(outfit.dayKey, styleKey);
            });
            alternativeActions.appendChild(alternativeButton);
          }
          alternativeBanner.append(alternativeMessage, alternativeActions);
          card.appendChild(alternativeBanner);
        }

        const retryCardBtn = document.createElement("button");
        retryCardBtn.type = "button";
        retryCardBtn.className = "btn btn-secondary retry-card-btn";
        retryCardBtn.textContent = "Réessayer cette journée";
        retryCardBtn.addEventListener("click", () => {
          void generateSingleDayOutfit(outfit.dayKey);
        });
        card.appendChild(retryCardBtn);
      }
    }

    outfitsGrid.appendChild(card);
  });
}

function renderWeeklyOutfits(outfits) {
  renderOutfits(outfits, "", `Ta semaine — 7 jours`);
}
