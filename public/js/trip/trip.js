// trip.js – mode valise : formulaire, météo destination, planification,
// sauvegarde Firestore et rendu accessible.
import { db } from "../core/config.js";
import { initAuth } from "../auth/auth.js";
import { showToast } from "../core/ui-utils.js";
import { GARMENT_TYPES, migrateGarment } from "../shared/outfit-matcher.js";
import { fetchWeatherForDateRange, geocodeCity } from "../shared/weather/weather.js";
import { planTrip } from "./trip-planner.js";
import { getStyleLabel } from "../shared/styles/style-utils.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const MAX_TRIP_DAYS = 21;
const CATEGORY_LABELS = {
  haut: "Hauts",
  "premiere-couche": "Premières couches · t-shirts, polos et chemises",
  "seconde-couche": "Secondes couches · pulls et hoodies",
  bas: "Bas",
  robe: "Robes",
  manteau: "Manteaux et vestes",
  chaussures: "Chaussures",
  accessoires: "Accessoires",
  ensemble: "Ensembles",
  autre: "Autres",
};
const CATEGORY_EMOJIS = {
  haut: "👕",
  "premiere-couche": "👕",
  "seconde-couche": "🧥",
  bas: "👖",
  robe: "👗",
  manteau: "🧥",
  chaussures: "👟",
  accessoires: "👜",
  ensemble: "👘",
  autre: "👕",
};

const tripForm = document.getElementById("trip-form");
const destinationInput = document.getElementById("trip-destination");
const startInput = document.getElementById("trip-start");
const endInput = document.getElementById("trip-end");
const laundryInput = document.getElementById("trip-laundry");
const statusEl = document.getElementById("trip-status");
const generateBtn = document.getElementById("trip-generate-btn");
const resultsEl = document.getElementById("trip-results");
const summaryEl = document.getElementById("trip-summary");
const weatherWarningEl = document.getElementById("trip-weather-warning");
const missingEl = document.getElementById("trip-missing");
const suitcaseEl = document.getElementById("trip-suitcase");
const pieceCountEl = document.getElementById("trip-piece-count");
const daysEl = document.getElementById("trip-days");
const combinationCountEl = document.getElementById("trip-combination-count");
const saveBtn = document.getElementById("trip-save-btn");
const savedTripsList = document.getElementById("saved-trips-list");
const savedTripsCount = document.getElementById("saved-trips-count");

let currentUser = null;
let clothes = [];
let savedTrips = [];
let currentPlan = null;
let currentTripId = null;
let checkedPieceIds = new Set();
let planDirty = false;
let restoringForm = false;
let resolveClothesReady;
const clothesReady = new Promise((resolve) => {
  resolveClothesReady = resolve;
});

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", isError);
}

function setBusy(isBusy) {
  if (generateBtn) {
    generateBtn.disabled = isBusy;
    generateBtn.textContent = isBusy ? "Génération..." : "Générer ma valise";
  }
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(isoDate) {
  if (!isoDate) return "information manquante";
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function getSelectedStyles() {
  return [...document.querySelectorAll('input[name="trip-style"]:checked')].map(
    (input) => input.value,
  );
}

function getDateRange(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "Renseigne des dates valides." };
  }
  if (end < start) {
    return { error: "La date de fin doit être après la date de début." };
  }
  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push({ date: toIsoDate(cursor), weather: null });
    if (days.length > MAX_TRIP_DAYS) {
      return { error: `Le séjour est limité à ${MAX_TRIP_DAYS} jours pour cette version.` };
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { days };
}

function getWeatherSummary(days) {
  const weatherDays = (days || []).filter((day) => day.weather);
  if (weatherDays.length === 0) return "information manquante";
  const min = Math.min(...weatherDays.map((day) => day.weather.min));
  const max = Math.max(...weatherDays.map((day) => day.weather.max));
  const rain = Math.max(...weatherDays.map((day) => day.weather.rain ?? 0));
  return `${min}–${max} °C · pluie max ${rain}%`;
}

function updatePackedCount() {
  if (!currentPlan || !pieceCountEl) return;
  const pieces = (currentPlan.pieces || []).filter(isPackablePiece);
  const checked = pieces.filter((piece) =>
    checkedPieceIds.has(String(piece.id)),
  ).length;
  pieceCountEl.textContent = `${pieces.length} pièces · ${checked} déjà cochée${checked > 1 ? "s" : ""}`;
}

function isPackablePiece(piece) {
  return piece?.category !== "autre" && piece?.type !== GARMENT_TYPES.AUTRE && piece?.type !== GARMENT_TYPES.SAC;
}

function getPackingCategory(piece) {
  if (piece?.packingCategory) return piece.packingCategory;
  if ([GARMENT_TYPES.TSHIRT, GARMENT_TYPES.POLO, GARMENT_TYPES.CHEMISE, GARMENT_TYPES.DEBARDEUR].includes(piece?.type)) return "premiere-couche";
  if ([GARMENT_TYPES.PULL, GARMENT_TYPES.HOODIE].includes(piece?.type)) return "seconde-couche";
  return piece?.category || "autre";
}

function appendSummaryItem(label, value) {
  const item = document.createElement("div");
  item.className = "trip-summary-item";
  const labelEl = document.createElement("span");
  labelEl.className = "trip-summary-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("span");
  valueEl.className = "trip-summary-value";
  valueEl.textContent = value || "information manquante";
  item.append(labelEl, valueEl);
  summaryEl.appendChild(item);
}

function renderSummary(plan) {
  if (!summaryEl) return;
  summaryEl.replaceChildren();
  appendSummaryItem("Destination", plan.destination);
  appendSummaryItem("Dates", `${formatDate(plan.startDate)} → ${formatDate(plan.endDate)}`);
  appendSummaryItem(
    "Styles",
    (plan.styles || []).map((style) => getStyleLabel(style)).join(", "),
  );
  appendSummaryItem(
    "Pièces",
    `${plan.totalPieces || 0} pièces sélectionnées`,
  );
  appendSummaryItem("Combinaisons", `${plan.combinations || 0} tenues possibles`);
  appendSummaryItem("Météo", getWeatherSummary(plan.days));
}

function renderSuitcase(plan) {
  if (!suitcaseEl) return;
  suitcaseEl.replaceChildren();

  const grouped = new Map();
  for (const piece of (plan.pieces || []).filter(isPackablePiece)) {
    const categoryKey = getPackingCategory(piece);
    const category = CATEGORY_LABELS[categoryKey] ? categoryKey : "autre";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(piece);
  }

  for (const [category, pieces] of grouped.entries()) {
    const group = document.createElement("div");
    group.className = "trip-category-group";
    const title = document.createElement("h4");
    title.className = "trip-category-title";
    title.textContent = CATEGORY_LABELS[category] || category;
    group.appendChild(title);

    for (const piece of pieces) {
      const item = document.createElement("div");
      item.className = "trip-suitcase-item";

      if (piece.imageUrl) {
        const image = document.createElement("img");
        image.className = "trip-suitcase-thumb";
        image.src = piece.imageUrl;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        item.appendChild(image);
      } else {
        const thumb = document.createElement("div");
        thumb.className = "trip-suitcase-thumb";
        thumb.textContent = CATEGORY_EMOJIS[piece.category] || "👕";
        thumb.setAttribute("aria-hidden", "true");
        item.appendChild(thumb);
      }

      const info = document.createElement("div");
      info.className = "trip-suitcase-info";
      const name = document.createElement("p");
      name.className = "trip-suitcase-name";
      name.textContent = piece.name || "Vêtement";
      const meta = document.createElement("p");
      meta.className = "trip-suitcase-meta";
      meta.textContent = [piece.type, piece.colors].filter(Boolean).join(" · ");
      info.append(name, meta);
      item.appendChild(info);

      const checkLabel = document.createElement("label");
      checkLabel.className = "trip-suitcase-check";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.pieceCheck = String(piece.id);
      checkbox.checked = checkedPieceIds.has(String(piece.id));
      checkbox.setAttribute("aria-label", `Déjà dans la valise : ${piece.name || "vêtement"}`);
      const checkText = document.createElement("span");
      checkText.textContent = "Déjà dans la valise";
      checkLabel.append(checkbox, checkText);
      item.appendChild(checkLabel);

      group.appendChild(item);
    }
    suitcaseEl.appendChild(group);
  }

  if (grouped.size === 0) {
    const empty = document.createElement("p");
    empty.className = "trip-empty";
    empty.textContent = "Aucune pièce sélectionnée.";
    suitcaseEl.appendChild(empty);
  }
  updatePackedCount();
}

function renderDays(plan) {
  if (!daysEl) return;
  daysEl.replaceChildren();
  for (const day of plan.days || []) {
    const card = document.createElement("article");
    card.className = "trip-day-card";
    card.tabIndex = 0;

    const head = document.createElement("div");
    head.className = "trip-day-head";
    const date = document.createElement("p");
    date.className = "trip-day-date";
    date.textContent = formatDate(day.date);
    const weather = document.createElement("span");
    weather.className = "trip-day-weather";
    weather.textContent = day.weather
      ? `${day.weather.emoji || ""} ${day.weather.label || ""} · ${day.weather.min}–${day.weather.max} °C`
      : "Météo indisponible";
    head.append(date, weather);
    card.appendChild(head);

    const style = document.createElement("span");
    style.className = "trip-day-style";
    style.textContent = day.styleLabel || getStyleLabel(day.style);
    card.appendChild(style);

    const list = document.createElement("ul");
    list.className = "trip-day-pieces";
    const pieces = day.outfit?.pieces || [];
    for (const piece of pieces.slice(0, 6)) {
      const item = document.createElement("li");
      item.className = "trip-day-piece";
      item.textContent = piece.name || piece.category || "Vêtement";
      list.appendChild(item);
    }
    card.appendChild(list);
    if (pieces.length > 6) {
      const more = document.createElement("p");
      more.className = "trip-day-more";
      more.textContent = `+ ${pieces.length - 6} autre(s) pièce(s)`;
      card.appendChild(more);
    }
    if (day.possibleCount > 1) {
      const more = document.createElement("p");
      more.className = "trip-day-more";
      more.textContent = `${day.possibleCount} combinaisons possibles avec cette valise.`;
      card.appendChild(more);
    }
    daysEl.appendChild(card);
  }
}

function renderPlan(plan) {
  currentPlan = plan;
  if (!resultsEl) return;
  resultsEl.classList.remove("hidden");
  renderSummary(plan);

  if (plan.weatherMissingDates?.length) {
    weatherWarningEl.textContent = `Météo indisponible pour ${plan.weatherMissingDates.length} jour(s) (${plan.weatherMissingDates.map(formatDate).join(", ")}). La sélection n'a pas pu être ajustée à la température pour ces dates.`;
    weatherWarningEl.classList.remove("hidden");
  } else {
    weatherWarningEl.classList.add("hidden");
  }

  if (!plan.success) {
    missingEl.textContent = plan.message || "information manquante : aucune sélection valide.";
    missingEl.classList.remove("hidden");
  } else {
    missingEl.classList.add("hidden");
  }

  renderSuitcase(plan);
  renderDays(plan);
  if (combinationCountEl) {
    combinationCountEl.textContent = `${plan.combinations || 0} combinaisons`;
  }
  if (saveBtn) {
    saveBtn.disabled = !plan.success;
    saveBtn.textContent = currentTripId ? "Mettre à jour la valise" : "Sauvegarder la valise";
  }
  planDirty = false;
}

function clearResults() {
  currentPlan = null;
  currentTripId = null;
  checkedPieceIds = new Set();
  resultsEl?.classList.add("hidden");
  summaryEl?.replaceChildren();
  suitcaseEl?.replaceChildren();
  daysEl?.replaceChildren();
  missingEl?.classList.add("hidden");
  weatherWarningEl?.classList.add("hidden");
}

function markFormDirty() {
  if (restoringForm || !currentPlan) return;
  planDirty = true;
  if (saveBtn) saveBtn.disabled = true;
  setStatus("Formulaire modifié : relance la génération pour mettre à jour la valise.");
}

async function generateTripPlan(event) {
  event?.preventDefault();
  const destination = destinationInput?.value.trim() || "";
  const startDate = startInput?.value || "";
  const endDate = endInput?.value || "";
  const styles = getSelectedStyles();
  const laundryAvailable = Boolean(laundryInput?.checked);
  const dateRange = getDateRange(startDate, endDate);

  if (!destination) {
    setStatus("Renseigne une destination.", true);
    destinationInput?.focus();
    return;
  }
  if (dateRange.error) {
    setStatus(dateRange.error, true);
    return;
  }
  if (styles.length === 0) {
    setStatus("Choisis au moins un style.", true);
    return;
  }

  setBusy(true);
  setStatus("Recherche de la ville et de la météo...");
  try {
    const location = await geocodeCity(destination);
    if (!location) {
      setStatus(`Ville « ${destination} » introuvable. Vérifie l'orthographe.`, true);
      return;
    }

    let weatherError = false;
    let weatherByDate = new Map();
    try {
      const weatherDays = await fetchWeatherForDateRange(
        location.coordinates,
        startDate,
        endDate,
      );
      weatherByDate = new Map(weatherDays.map((day) => [day.date, day]));
    } catch (error) {
      weatherError = true;
      console.warn("[Mode valise] Météo indisponible :", error);
    }

    const tripDays = dateRange.days.map((day) => ({
      ...day,
      weather: weatherByDate.get(day.date) || null,
    }));

    setStatus("Sélection des pièces...");
    await clothesReady;
    const plan = planTrip({
      wardrobe: clothes,
      days: tripDays,
      styles,
      laundryAvailable,
    });
    plan.destination = location.name || destination;
    plan.startDate = startDate;
    plan.endDate = endDate;
    plan.styles = styles;
    plan.weatherLocation = location.name;
    plan.weatherMissingDates = tripDays
      .filter((day) => !day.weather)
      .map((day) => day.date);
    plan.weatherError = weatherError;

    const existingTrip = savedTrips.find((trip) =>
      String(trip.destination || "").trim().toLocaleLowerCase("fr") ===
        String(plan.destination || destination).trim().toLocaleLowerCase("fr") &&
      trip.startDate === startDate && trip.endDate === endDate,
    );
    currentTripId = existingTrip?.id || null;
    const availableIds = new Set((plan.pieceIds || []).map(String));
    checkedPieceIds = new Set((existingTrip?.checkedPieceIds || []).map(String)
      .filter((id) => availableIds.has(id)));
    renderPlan(plan);
    if (plan.success) {
      setStatus(
        `Valise prête : ${plan.totalPieces} pièces pour ${plan.days.length} jour(s), ${plan.combinations} combinaison(s) possible(s).`,
      );
      resultsEl?.scrollIntoView({ behavior: "smooth", block: "start" });
      resultsEl?.focus();
    } else {
      setStatus(plan.message || "Aucune valise valide.", true);
    }
  } catch (error) {
    console.error("[Mode valise] Erreur :", error);
    setStatus("Impossible de préparer la valise. Réessaie dans un instant.", true);
  } finally {
    setBusy(false);
  }
}

function buildTripData() {
  if (!currentPlan) return null;
  return {
    destination: currentPlan.destination || destinationInput?.value.trim() || "",
    startDate: currentPlan.startDate || startInput?.value || "",
    endDate: currentPlan.endDate || endInput?.value || "",
    styles: currentPlan.styles || getSelectedStyles(),
    laundryAvailable: Boolean(laundryInput?.checked),
    pieceIds: currentPlan.pieceIds || [],
    checkedPieceIds: [...checkedPieceIds],
    weatherSnapshot: (currentPlan.days || []).map((day) => ({
      date: day.date,
      weather: day.weather || null,
    })),
    plan: {
      pieces: currentPlan.pieces || [],
      days: (currentPlan.days || []).map((day) => ({
        date: day.date,
        weather: day.weather || null,
        weatherMissing: Boolean(day.weatherMissing),
        style: day.style,
        styleLabel: day.styleLabel,
        outfit: day.outfit,
        alternatives: day.alternatives || [],
        possibleCount: day.possibleCount || 0,
      })),
      totalPieces: currentPlan.totalPieces || 0,
      combinations: currentPlan.combinations || 0,
      pieceIds: currentPlan.pieceIds || [],
    },
  };
}

async function saveTrip() {
  if (!currentUser || !currentPlan?.success) return;
  const data = buildTripData();
  if (!data) return;
  if (saveBtn) saveBtn.disabled = true;
  try {
    if (currentTripId) {
      await updateDoc(doc(db, `users/${currentUser.uid}/trips`, currentTripId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      showToast("Valise mise à jour !");
    } else {
      const ref = await addDoc(collection(db, `users/${currentUser.uid}/trips`), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      currentTripId = ref.id;
      showToast("Valise sauvegardée !");
    }
    if (saveBtn) saveBtn.textContent = "Mettre à jour la valise";
  } catch (error) {
    console.error("[Mode valise] Sauvegarde impossible :", error);
    showToast("Impossible de sauvegarder la valise.", "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function setFormFromTrip(trip) {
  restoringForm = true;
  if (destinationInput) destinationInput.value = trip.destination || "";
  if (startInput) startInput.value = trip.startDate || "";
  if (endInput) endInput.value = trip.endDate || "";
  const styles = new Set(trip.styles || []);
  document.querySelectorAll('input[name="trip-style"]').forEach((input) => {
    input.checked = styles.has(input.value);
  });
  if (laundryInput) laundryInput.checked = Boolean(trip.laundryAvailable);
  restoringForm = false;
}

function openSavedTrip(trip) {
  if (!trip?.plan?.days?.length) {
    showToast("information manquante : cette valise n'a pas de plan enregistré.", "error");
    return;
  }
  setFormFromTrip(trip);
  currentTripId = trip.id;
  const savedPieces = (trip.plan.pieces || []).filter(isPackablePiece);
  const savedPieceIds = new Set(savedPieces.map((piece) => String(piece.id)));
  checkedPieceIds = new Set((trip.checkedPieceIds || []).map(String).filter((id) => savedPieceIds.has(id)));
  currentPlan = {
    ...trip.plan,
    pieces: savedPieces,
    pieceIds: (trip.pieceIds || trip.plan.pieceIds || []).map(String).filter((id) => savedPieceIds.has(id)),
    totalPieces: savedPieces.length,
    success: true,
    missing: [],
    message: null,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    styles: trip.styles || [],
    totalPieces: savedPieces.length,
    combinations: trip.plan.combinations ?? 0,
    weatherMissingDates: (trip.plan.days || [])
      .filter((day) => !day.weather)
      .map((day) => day.date),
  };
  renderPlan(currentPlan);
  saveBtn && (saveBtn.textContent = "Mettre à jour la valise");
  resultsEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus(`Valise « ${trip.destination || "sans destination"} » rouverte.`);
}

async function removeTrip(trip) {
  if (!currentUser) return;
  if (!window.confirm(`Supprimer la valise « ${trip.destination || "sans destination"} » ?`)) {
    return;
  }
  try {
    await deleteDoc(doc(db, `users/${currentUser.uid}/trips`, trip.id));
    if (currentTripId === trip.id) clearResults();
    showToast("Valise supprimée.");
  } catch (error) {
    console.error("[Mode valise] Suppression impossible :", error);
    showToast("Impossible de supprimer la valise.", "error");
  }
}

function renderSavedTrips() {
  if (!savedTripsList) return;
  savedTripsList.replaceChildren();
  if (savedTripsCount) savedTripsCount.textContent = String(savedTrips.length);

  if (savedTrips.length === 0) {
    const empty = document.createElement("p");
    empty.className = "trip-empty";
    empty.textContent = "Aucune valise sauvegardée pour le moment.";
    savedTripsList.appendChild(empty);
    return;
  }

  for (const trip of savedTrips) {
    const item = document.createElement("article");
    item.className = "saved-trip-item";
    const title = document.createElement("h3");
    title.className = "saved-trip-title";
    title.textContent = trip.destination || "Destination non renseignée";
    const meta = document.createElement("p");
    meta.className = "saved-trip-meta";
    meta.textContent = `${formatDate(trip.startDate)} → ${formatDate(trip.endDate)} · ${trip.pieceIds?.length || 0} pièces`;
    const actions = document.createElement("div");
    actions.className = "saved-trip-actions";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "saved-trip-btn";
    openBtn.dataset.openTrip = trip.id;
    openBtn.textContent = "Rouvrir";
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "saved-trip-btn is-danger";
    deleteBtn.dataset.deleteTrip = trip.id;
    deleteBtn.textContent = "Supprimer";
    actions.append(openBtn, deleteBtn);
    item.append(title, meta, actions);
    savedTripsList.appendChild(item);
  }
}

function loadClothes() {
  if (!currentUser) return;
  onSnapshot(
    collection(db, `users/${currentUser.uid}/clothes`),
    (snapshot) => {
      clothes = snapshot.docs
        .map((clothDoc) => migrateGarment({ id: clothDoc.id, ...clothDoc.data() }))
        .filter((piece) => piece && piece.type !== GARMENT_TYPES.AUTRE);
      resolveClothesReady?.();
    },
    (error) => {
      console.error("[Mode valise] Garde-robe indisponible :", error);
      setStatus("Impossible de charger la garde-robe.", true);
      resolveClothesReady?.();
    },
  );
}

function loadTrips() {
  if (!currentUser) return;
  onSnapshot(
    query(collection(db, `users/${currentUser.uid}/trips`), orderBy("createdAt", "desc")),
    (snapshot) => {
      savedTrips = snapshot.docs.map((tripDoc) => ({
        id: tripDoc.id,
        ...tripDoc.data(),
      }));
      renderSavedTrips();
    },
    (error) => {
      console.error("[Mode valise] Valises sauvegardées indisponibles :", error);
      showToast("Impossible de charger les valises sauvegardées.", "error");
    },
  );
}

savedTripsList?.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-trip]");
  if (openButton) {
    const trip = savedTrips.find((item) => item.id === openButton.dataset.openTrip);
    if (trip) openSavedTrip(trip);
    return;
  }
  const deleteButton = event.target.closest("[data-delete-trip]");
  if (deleteButton) {
    const trip = savedTrips.find((item) => item.id === deleteButton.dataset.deleteTrip);
    if (trip) void removeTrip(trip);
  }
});

suitcaseEl?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-piece-check]");
  if (!checkbox) return;
  const id = String(checkbox.dataset.pieceCheck);
  if (checkbox.checked) checkedPieceIds.add(id);
  else checkedPieceIds.delete(id);
  updatePackedCount();
});

tripForm?.addEventListener("submit", generateTripPlan);
tripForm?.addEventListener("input", markFormDirty);
tripForm?.addEventListener("change", markFormDirty);
saveBtn?.addEventListener("click", () => {
  void saveTrip();
});

const todayIso = toIsoDate(new Date());
if (startInput) startInput.min = todayIso;
if (endInput) endInput.min = todayIso;

initAuth((user) => {
  currentUser = user;
  loadClothes();
  loadTrips();
});
