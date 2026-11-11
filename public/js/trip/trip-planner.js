// trip-planner.js – sélection d'une valise minimale et cohérente.
// Réutilise generateOutfits et le validateur déterministe. Aucun accès DOM.
import { generateOutfits } from "../shared/outfit-generator.js";
import {
  GARMENT_TYPES,
  explainMissingPieces,
  migrateGarment,
  validateOutfit,
} from "../shared/outfit-matcher.js";
import { getStyleLabel, normalizeRequestedStyle } from "../shared/styles/style-utils.js";

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
    styleIndex * 5,
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
  if (a.reusePenalty !== b.reusePenalty) return a.reusePenalty - b.reusePenalty;
  if (a.pieceCount !== b.pieceCount) return a.pieceCount - b.pieceCount;
  const aKey = [...a.pieceIds].sort().join("|");
  const bKey = [...b.pieceIds].sort().join("|");
  return aKey.localeCompare(bKey);
}

function reusePenalty(chosen, laundryAvailable) {
  const uses = new Map();
  const pieces = new Map();
  for (const candidate of chosen) {
    for (const piece of candidate.outfit.pieces || []) {
      const id = pieceId(piece);
      uses.set(id, (uses.get(id) || 0) + 1);
      pieces.set(id, piece);
    }
  }
  return [...uses.entries()].reduce((penalty, [id, count]) => {
    const type = pieces.get(id)?.type || "";
    const maxUses = [GARMENT_TYPES.PULL, GARMENT_TYPES.HOODIE].includes(type) ? 6
      : [GARMENT_TYPES.JEAN, GARMENT_TYPES.PANTALON, GARMENT_TYPES.JUPE].includes(type) ? 4
        : [GARMENT_TYPES.CHAUSSURES_VILLE, GARMENT_TYPES.BASKETS, GARMENT_TYPES.BOTTES].includes(type) ? 7
          : laundryAvailable ? 3 : 2;
    return penalty + Math.max(0, count - maxUses) ** 2;
  }, 0);
}

function consolidateOutfitPieces(chosen, wardrobe, days, matches, limit) {
  const usage = new Map();
  for (const candidate of chosen) {
    for (const piece of candidate.outfit.pieces || []) {
      if (!matches(piece)) continue;
      const id = pieceId(piece);
      usage.set(id, (usage.get(id) || 0) + 1);
    }
  }
  const keep = [...usage.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id]) => wardrobe.find((piece) => pieceId(piece) === id))
    .filter(Boolean);
  if (keep.length === 0) return;

  chosen.forEach((candidate, dayIndex) => {
    const usedIndex = { value: 0 };
    const pieces = (candidate.outfit.pieces || []).map((piece) => {
      if (!matches(piece) || keep.some((item) => pieceId(item) === pieceId(piece))) return piece;
      const replacement = keep[usedIndex.value++ % keep.length];
      return replacement;
    });
    const outfit = { ...candidate.outfit, pieces };
    if (!validateOutfit(outfit, candidate.style, days[dayIndex].weather || null).isValid) return;
    candidate.outfit = outfit;
    candidate.pieceIds = pieces.map(pieceId).filter(Boolean);
    candidate.key = outfitKey(outfit);
  });
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
 * @param {boolean} [input.laundryAvailable]
 * @returns {object}
 */
export function planTrip({ wardrobe, days, styles, laundryAvailable = false }) {
  const migrated = (wardrobe || [])
    .map(migrateGarment)
    .filter((piece) => piece && piece.type !== GARMENT_TYPES.AUTRE && piece.type !== GARMENT_TYPES.SAC && piece.category !== "autre");
  const styleKeys = [...new Set((styles || []).map(normalizeRequestedStyle).filter(Boolean))];
  const tripDays = Array.isArray(days) ? days : [];

  if (migrated.length === 0) {
    return {
      success: false,
      pieces: [],
      pieceIds: [],
      days: [],
      missing: ["garde-robe vide"],
      message: "information manquante : garde-robe vide",
      totalPieces: 0,
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
      combinations: 0,
    };
  }

  // Beam search : chaque état garde une tenue par jour et l'union de ses pièces.
  let states = [{ chosen: [], pieceIds: new Set(), pieceCount: 0, reusePenalty: 0 }];
  for (let dayIndex = 0; dayIndex < candidatesByDay.length; dayIndex += 1) {
    const seen = new Map();
    for (const state of states) {
      for (const candidate of candidatesByDay[dayIndex]) {
        const ids = new Set(state.pieceIds);
        candidate.pieceIds.forEach((id) => ids.add(id));
        const stateKey = `${[...ids].sort().join("|")}::${[...state.chosen, candidate].map((c) => c.key).join(";")}`;
        if (seen.has(stateKey)) continue;
        const chosen = [...state.chosen, candidate];
        seen.set(stateKey, {
          chosen,
          pieceIds: ids,
          pieceCount: ids.size,
          reusePenalty: reusePenalty(chosen, laundryAvailable),
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
    if (a.reusePenalty !== b.reusePenalty) return a.reusePenalty - b.reusePenalty;
    if (a.pieceCount !== b.pieceCount) return a.pieceCount - b.pieceCount;
    if (a.combinations !== b.combinations) return b.combinations - a.combinations;
    return compareStates(a, b);
  });
  const best = ranked[0];

  if (laundryAvailable) {
    const isFirstLayer = (piece) => [GARMENT_TYPES.TSHIRT, GARMENT_TYPES.POLO, GARMENT_TYPES.CHEMISE].includes(piece.type);
    consolidateOutfitPieces(best.chosen, migrated, tripDays, isFirstLayer, 3);
    const isBottom = (piece) => [GARMENT_TYPES.JEAN, GARMENT_TYPES.PANTALON, GARMENT_TYPES.JUPE, GARMENT_TYPES.SHORT].includes(piece.type);
    consolidateOutfitPieces(best.chosen, migrated, tripDays, isBottom, 2);
    consolidateOutfitPieces(best.chosen, migrated, tripDays, (piece) => piece.type === GARMENT_TYPES.ROBE, 2);
  }
  consolidateOutfitPieces(
    best.chosen,
    migrated,
    tripDays,
    (piece) => [GARMENT_TYPES.VESTE, GARMENT_TYPES.MANTEAU].includes(piece.type),
    1,
  );
  best.pieceIds = new Set(best.chosen.flatMap((candidate) => candidate.pieceIds));
  best.pieceCount = best.pieceIds.size;

  const selectedIds = new Set(best.pieceIds);
  const piecesById = new Map(migrated.map((piece) => [pieceId(piece), piece]));
  const streetwearOnly = styleKeys.length === 1 && styleKeys[0] === "streetwear";
  const targets = [
    { matches: (piece) => streetwearOnly
      ? [GARMENT_TYPES.TSHIRT, GARMENT_TYPES.DEBARDEUR].includes(piece.type)
      : [GARMENT_TYPES.TSHIRT, GARMENT_TYPES.POLO, GARMENT_TYPES.CHEMISE].includes(piece.type), count: Math.ceil(tripDays.length / (laundryAvailable ? 5 : 2)) },
    { matches: (piece) => piece.type === GARMENT_TYPES.ROBE, count: laundryAvailable ? Math.min(2, Math.ceil(tripDays.length / 14)) : Math.ceil(tripDays.length / 5) },
  ];
  for (const target of targets) {
    const available = migrated.filter(target.matches);
    const included = available.filter((piece) => selectedIds.has(pieceId(piece))).length;
    for (const piece of available.filter((item) => !selectedIds.has(pieceId(item))).slice(0, Math.max(0, target.count - included))) {
      selectedIds.add(pieceId(piece));
    }
  }
  const selectedPieces = [...selectedIds].map((id) => piecesById.get(id)).filter(Boolean);
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

  return {
    success: true,
    pieces: sortPieces(selectedPieces).map((piece) => ({
      ...piece,
      packingCategory: [GARMENT_TYPES.TSHIRT, GARMENT_TYPES.POLO, GARMENT_TYPES.CHEMISE, GARMENT_TYPES.DEBARDEUR].includes(piece.type)
        ? "premiere-couche"
        : [GARMENT_TYPES.PULL, GARMENT_TYPES.HOODIE].includes(piece.type)
          ? "seconde-couche"
          : piece.category,
      selected: true,
    })),
    pieceIds: selectedPieceIds,
    days: plannedDays,
    missing: [],
    message: null,
    totalPieces: selectedPieceIds.length,
    combinations: best.combinations,
    weatherMissingDates: tripDays.filter((day) => !day.weather).map((day) => day.date),
  };
}
