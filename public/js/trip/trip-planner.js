// trip-planner.js – sélection d'une valise minimale et cohérente.
// Réutilise generateOutfits et le validateur déterministe. Aucun accès DOM.
import { generateOutfits } from "./outfit-generator.js";
import {
  GARMENT_TYPES,
  explainMissingPieces,
  migrateGarment,
  validateOutfit,
} from "./outfit-matcher.js";
import { getStyleLabel, normalizeRequestedStyle } from "./style-utils.js";

export const CABIN_MAX_PIECES = 10;
const MAX_CANDIDATES_PER_STYLE = 10;
const BEAM_WIDTH = 70;

const CATEGORY_ORDER = [
  "haut",
  "bas",
  "robe",
  "manteau",
  "chaussures",
  "accessoires",
  "ensemble",
];

function pieceId(piece) {
  return String(piece?.id ?? piece?.name ?? "");
}

function outfitKey(outfit) {
  return (outfit?.pieces || [])
    .map(pieceId)
    .sort()
    .join("|");
}

function buildCandidates(wardrobe, style, weather, dayIndex, styleIndex) {
  const outfits = generateOutfits(
    wardrobe,
    style,
    MAX_CANDIDATES_PER_STYLE,
    dayIndex * 17 + styleIndex * 5,
    weather,
  );
  const seen = new Set();
  const candidates = [];
  for (const outfit of outfits) {
    const key = outfitKey(outfit);
    if (!key || seen.has(key)) continue;
    const validation = validateOutfit(outfit, outfit.style || style, weather);
    if (!validation.isValid) continue;
    seen.add(key);
    candidates.push({
      key,
      style: normalizeRequestedStyle(outfit.style || style) || style,
      outfit,
      pieceIds: (outfit.pieces || []).map(pieceId).filter(Boolean),
    });
  }
  return candidates;
}

function compareStates(a, b) {
  if (a.pieceCount !== b.pieceCount) return a.pieceCount - b.pieceCount;
  const aKey = [...a.pieceIds].sort().join("|");
  const bKey = [...b.pieceIds].sort().join("|");
  return aKey.localeCompare(bKey);
}

function sortPieces(pieces) {
  return [...pieces].sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a.category || "");
    const bIndex = CATEGORY_ORDER.indexOf(b.category || "");
    if (aIndex !== bIndex) return aIndex - bIndex;
    return String(a.name || "").localeCompare(String(b.name || ""), "fr");
  });
}

/**
 * Planifie une valise pour une liste de jours.
 *
 * @param {object} input
 * @param {Array} input.wardrobe
 * @param {Array<{date: string, weather: object|null}>} input.days
 * @param {string[]} input.styles
 * @param {number|null} [input.maxPieces]
 * @param {boolean} [input.cabin]
 * @returns {object}
 */
export function planTrip({ wardrobe, days, styles, maxPieces = null, cabin = false }) {
  const migrated = (wardrobe || [])
    .map(migrateGarment)
    .filter((piece) => piece && piece.type !== GARMENT_TYPES.AUTRE);
  const styleKeys = [...new Set((styles || []).map(normalizeRequestedStyle).filter(Boolean))];
  const tripDays = Array.isArray(days) ? days : [];
  const effectiveMax = cabin ? CABIN_MAX_PIECES : maxPieces;

  if (migrated.length === 0) {
    return {
      success: false,
      pieces: [],
      pieceIds: [],
      days: [],
      missing: ["garde-robe vide"],
      message: "information manquante : garde-robe vide",
      totalPieces: 0,
      maxPieces: effectiveMax,
      cabin,
      combinations: 0,
    };
  }

  if (tripDays.length === 0) {
    return {
      success: false,
      pieces: [],
      pieceIds: [],
      days: [],
      missing: ["aucune date de séjour"],
      message: "information manquante : aucune date de séjour",
      totalPieces: 0,
      maxPieces: effectiveMax,
      cabin,
      combinations: 0,
    };
  }

  if (styleKeys.length === 0) {
    return {
      success: false,
      pieces: [],
      pieceIds: [],
      days: [],
      missing: ["aucun style sélectionné"],
      message: "information manquante : aucun style sélectionné",
      totalPieces: 0,
      maxPieces: effectiveMax,
      cabin,
      combinations: 0,
    };
  }

  const candidatesByDay = [];
  const missing = [];
  for (let dayIndex = 0; dayIndex < tripDays.length; dayIndex += 1) {
    const day = tripDays[dayIndex];
    // Les styles sont répartis dans l'ordre choisi, un style par jour. Cela
    // garantit que chaque style demandé apparaît si le séjour est assez long.
    const dayStyle = styleKeys[dayIndex % styleKeys.length];
    const candidates = buildCandidates(
      migrated,
      dayStyle,
      day.weather || null,
      dayIndex,
      dayIndex % styleKeys.length,
    );
    if (candidates.length === 0) {
      const reason = explainMissingPieces(migrated, dayStyle);
      if (reason) missing.push(`${getStyleLabel(dayStyle)} : ${reason}`);
    }
    candidatesByDay.push(candidates);
  }

  const emptyDayIndex = candidatesByDay.findIndex((candidates) => candidates.length === 0);
  if (emptyDayIndex !== -1) {
    const uniqueMissing = [...new Set(missing)];
    return {
      success: false,
      pieces: [],
      pieceIds: [],
      days: [],
      missing: uniqueMissing,
      message:
        uniqueMissing[0] ||
        `information manquante : aucune tenue valide pour le ${tripDays[emptyDayIndex].date}`,
      totalPieces: 0,
      maxPieces: effectiveMax,
      cabin,
      combinations: 0,
    };
  }

  // Beam search : chaque état garde une tenue par jour et l'union de ses pièces.
  let states = [{ chosen: [], pieceIds: new Set(), pieceCount: 0 }];
  for (let dayIndex = 0; dayIndex < candidatesByDay.length; dayIndex += 1) {
    const seen = new Map();
    for (const state of states) {
      for (const candidate of candidatesByDay[dayIndex]) {
        const ids = new Set(state.pieceIds);
        candidate.pieceIds.forEach((id) => ids.add(id));
        const stateKey = `${[...ids].sort().join("|")}::${[...state.chosen, candidate].map((c) => c.key).join(";")}`;
        if (seen.has(stateKey)) continue;
        seen.set(stateKey, {
          chosen: [...state.chosen, candidate],
          pieceIds: ids,
          pieceCount: ids.size,
        });
      }
    }
    states = [...seen.values()].sort(compareStates).slice(0, BEAM_WIDTH);
    if (states.length === 0) break;
  }

  if (states.length === 0) {
    return {
      success: false,
      pieces: [],
      pieceIds: [],
      days: [],
      missing: ["aucune combinaison valide"],
      message: "information manquante : aucune combinaison valide avec cette garde-robe",
      totalPieces: 0,
      maxPieces: effectiveMax,
      cabin,
      combinations: 0,
    };
  }

  // Parmi les meilleures sélections, privilégier celle qui laisse le plus de
  // combinaisons possibles avec les pièces retenues.
  const ranked = states.map((state) => {
    let combinations = 0;
    for (let dayIndex = 0; dayIndex < candidatesByDay.length; dayIndex += 1) {
      combinations += candidatesByDay[dayIndex].filter((candidate) =>
        candidate.pieceIds.every((id) => state.pieceIds.has(id)),
      ).length;
    }
    return { ...state, combinations };
  });
  ranked.sort((a, b) => {
    if (a.pieceCount !== b.pieceCount) return a.pieceCount - b.pieceCount;
    if (a.combinations !== b.combinations) return b.combinations - a.combinations;
    return compareStates(a, b);
  });
  const best = ranked[0];

  const selectedPieces = migrated.filter((piece) => best.pieceIds.has(pieceId(piece)));
  const selectedPieceIds = selectedPieces.map(pieceId);
  const selectedSet = new Set(selectedPieceIds);
  const plannedDays = tripDays.map((day, dayIndex) => {
    const chosen = best.chosen[dayIndex];
    const possible = candidatesByDay[dayIndex].filter((candidate) =>
      candidate.pieceIds.every((id) => selectedSet.has(id)),
    );
    return {
      date: day.date,
      weather: day.weather || null,
      weatherMissing: !day.weather,
      style: chosen.style,
      styleLabel: getStyleLabel(chosen.style),
      outfit: chosen.outfit,
      possibleCount: possible.length,
      alternatives: possible
        .filter((candidate) => candidate.key !== chosen.key)
        .slice(0, 4)
        .map((candidate) => candidate.outfit),
    };
  });

  if (effectiveMax && best.pieceCount > effectiveMax) {
    return {
      success: false,
      pieces: sortPieces(selectedPieces).map((piece) => ({ ...piece, selected: true })),
      pieceIds: selectedPieceIds,
      days: plannedDays,
      missing: [`${best.pieceCount} pièces nécessaires pour ${effectiveMax} maximum`],
      message: `La sélection minimale nécessite ${best.pieceCount} pièces, au-dessus de la limite de ${effectiveMax}.`,
      totalPieces: best.pieceCount,
      maxPieces: effectiveMax,
      cabin,
      combinations: best.combinations,
    };
  }

  return {
    success: true,
    pieces: sortPieces(selectedPieces).map((piece) => ({ ...piece, selected: true })),
    pieceIds: selectedPieceIds,
    days: plannedDays,
    missing: [],
    message: null,
    totalPieces: best.pieceCount,
    maxPieces: effectiveMax,
    cabin,
    combinations: best.combinations,
    weatherMissingDates: tripDays.filter((day) => !day.weather).map((day) => day.date),
  };
}
