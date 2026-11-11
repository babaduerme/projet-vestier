// outfit-generator.js – génération pure de tenues, partagée entre le planning
// hebdomadaire et le mode valise. Aucun accès au DOM ni à Firebase.
import {
  FORMAL_BASE_TYPES,
  FORMAL_NECKWEAR_STYLES,
  GARMENT_TYPES,
  SLOTS,
  STREETWEAR_BASE_TYPES,
  buildOutfit,
  isFormalNeckwear,
  isShirt,
  migrateGarment,
  normalizeGarmentSlot,
  repairOrDiscardOutfit,
  scoreStyle,
  validateOutfit,
} from "./outfit-matcher.js";
import { canonicalStyleKey as canonicalStyleKeyFromRules } from "./styles/style-rules.js";
import { getStyleLabel, normalizeRequestedStyle } from "./styles/style-utils.js";

function normalizeLabel(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const STYLEMATE_RULES = {
  rock: {
    vibe: "rock et affirmé",
    keywords: ["rock", "cuir", "noir", "denim", "biker", "clou"],
    palette: ["noir", "gris", "rouge", "blanc"],
  },
  streetwear: {
    vibe: "streetwear et urbain",
    keywords: ["hoodie", "sweat", "oversize", "sneaker", "jogger", "logo"],
    palette: ["noir", "blanc", "gris", "kaki", "bleu"],
  },
  casual: {
    vibe: "casual et confortable",
    keywords: ["jean", "coton", "simple", "confort", "basique", "t-shirt", "sneaker"],
    palette: ["bleu", "blanc", "gris", "beige", "noir"],
  },
  minimaliste: {
    vibe: "minimaliste et épuré",
    keywords: ["uni", "simple", "épuré", "basique", "clean", "neutre"],
    palette: ["noir", "blanc", "gris", "beige", "bleu marine"],
  },
  chic: {
    vibe: "chic et raffiné",
    keywords: ["soie", "satin", "blazer", "tailleur", "talon", "costume", "élégant"],
    palette: ["noir", "blanc", "rouge", "beige"],
  },
};

function styleMateRule(styleName) {
  return STYLEMATE_RULES[canonicalStyleKeyFromRules(styleName)] || null;
}

function styleMateText(piece) {
  return [
    piece.name,
    piece.description,
    piece.category,
    piece.type,
    piece.slot,
    piece.garmentType,
    piece.colors,
    piece.pattern,
    Array.isArray(piece.styles) ? piece.styles.join(" ") : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function classifyClothing(piece) {
  const migrated = migrateGarment(piece);
  const slot = migrated?.slot || null;
  const type = migrated?.type || GARMENT_TYPES.AUTRE;
  const categoryBySlot = {
    [SLOTS.BASE]: "haut",
    [SLOTS.COUCHE]: "haut",
    [SLOTS.VESTE]: "manteau",
    [SLOTS.BAS]: "bas",
    [SLOTS.ROBE]: "robe",
    [SLOTS.CHAUSSURES]: "chaussures",
    [SLOTS.ACCESSOIRE]: "accessoires",
  };
  return {
    type,
    category: categoryBySlot[slot] || "autre",
    layer: slot === SLOTS.BASE ? "base" : slot === SLOTS.COUCHE ? "warm" : null,
  };
}

function styleMateCompatibilityScore(piece, styleName) {
  const rule = styleMateRule(styleName);
  if (!rule) return 5;
  const text = styleMateText(piece);
  let score = 5;
  rule.keywords.forEach((keyword) => {
    if (text.includes(keyword.toLowerCase())) score += 3;
  });
  if (piece.colors) {
    const pieceColors = piece.colors.toLowerCase().split(/[,\s]+/);
    const hasMatchingColor = pieceColors.some((c) =>
      rule.palette.some((p) => p.includes(c) || c.includes(p)),
    );
    if (hasMatchingColor) score += 2;
  }
  return Math.min(score, 10);
}

function styleMateIsLayer(piece) {
  return (
    piece.category === "manteau" ||
    normalizeGarmentSlot(piece) === SLOTS.COUCHE ||
    normalizeGarmentSlot(piece) === SLOTS.VESTE ||
    /manteau|veste|blouson|parka|trench|jacket|coat|pull|sweater|sweat|hoodie|gilet|cardigan/.test(
      styleMateText(piece),
    )
  );
}

function styleMateIsPattern(piece) {
  return (
    piece.pattern === "motif" ||
    /motif|imprim[ée]|carreaux|rayure|ray[ée]|fleur|floral|pois|graphique|vichy|pied-de-poule|prince-de-galles/.test(
      styleMateText(piece),
    )
  );
}

function styleMateIsRockOrMetal(piece) {
  return /rock|m[ée]tal|metal|punk|goth|grunge|acdc|nirvana|metallica|ramones|iron maiden|motorhead|band tee/.test(
    styleMateText(piece),
  );
}

function styleMateIsGraphicTop(piece) {
  return (
    piece.category === "haut" &&
    /t[- ]?shirt|tee\b|hoodie|sweat/.test(styleMateText(piece)) &&
    (styleMateIsPattern(piece) || styleMateIsRockOrMetal(piece))
  );
}

function styleMateDescribe(outfit, rule) {
  const parts = [];
  if (rule?.vibe) parts.push(`Look ${rule.vibe}`);
  const patternCount = outfit.pieces.filter(styleMateIsPattern).length;
  if (patternCount === 1) parts.push("pièce forte mise en valeur");
  else if (patternCount === 0) parts.push("harmonie sobre et épurée");
  if (outfit.pieces.some(styleMateIsLayer)) parts.push("superposition soignée");
  return parts.length ? parts.join(" · ") : "Tenue équilibrée et adaptée";
}

function scoreOutfitForStyle(outfit, styleName) {
  const pieces = outfit.pieces || [];
  if (!pieces.length) return 0;
  const compatibilitySum = pieces.reduce(
    (sum, piece) => sum + styleMateCompatibilityScore(piece, styleName),
    0,
  );
  const avg = compatibilitySum / pieces.length;
  const isRock = canonicalStyleKeyFromRules(styleName) === "rock";
  const hasGraphicTop = pieces.some(styleMateIsGraphicTop);
  const hasRockAccessory = pieces.some(styleMateIsRockOrMetal);
  const rockBonus = isRock && hasGraphicTop && hasRockAccessory ? 1.5 : 0;
  return avg + rockBonus;
}

function isWarmWeather(weather) {
  return Number(weather?.max ?? weather?.temperature_max ?? 20) > 24;
}

function outfitRespectsWeather(pieces, weather) {
  if (!weather) return true;
  const rain = Number(weather.rain ?? weather.probabilite_pluie ?? 0);
  const precipitation = normalizeLabel(weather.precipitations || weather.type);
  const wet = rain > 50 || /bruine|pluie|neige|storm|orage/.test(precipitation);

  // La couche chaude (pull ou hoodie) est obligatoire dans toutes les tenues,
  // y compris par temps chaud : on ne rejette donc plus une tenue pour cause
  // de superposition. Seule la pluie reste un critère d'incompatibilité.
  if (
    wet &&
    pieces.some(
      (piece) =>
        piece.category === "chaussures" &&
        /daim|suede|sandale|toile/.test(styleMateText(piece)),
    )
  ) {
    return false;
  }
  return true;
}

const NEUTRAL_COLORS = new Set([
  "noir",
  "blanc",
  "gris",
  "beige",
  "écru",
  "blanc cassé",
  "marine",
  "bleu marine",
]);
const BRIGHT_COLORS = new Set([
  "rouge",
  "orange",
  "rose",
  "rose vif",
  "jaune",
  "vert vif",
  "bleu vif",
  "violet",
]);

function outfitRespectsColors(pieces, styleName) {
  const colors = pieces.flatMap((piece) =>
    String(piece.colors || "")
      .split(",")
      .flatMap((color) => {
        const normalized = normalizeLabel(color);
        // Conserver aussi les mots d'une couleur composée : « vert kaki » doit
        // pouvoir être rapproché de « vert » et de « kaki ».
        return [normalized, ...normalized.split(/[\s/]+/)].filter(Boolean);
      })
  );
  const uniqueColors = [...new Set(colors)];
  const nonNeutral = uniqueColors.filter((color) => !NEUTRAL_COLORS.has(color));
  const bright = uniqueColors.filter((color) => BRIGHT_COLORS.has(color));
  // Les palettes sont des préférences de style, pas des interdictions. Les
  // anciennes données contiennent souvent des couleurs composées ou absentes
  // du nuancier (p. ex. « vert kaki ») : les rejeter empêchait Casual et Rock
  // de produire une tenue pourtant valide. On écarte seulement les mélanges
  // manifestement trop chargés, avec une tolérance supérieure pour le Rock.
  const maxBrightColors = canonicalStyleKeyFromRules(styleName) === "rock" ? 2 : 1;
  return nonNeutral.length <= 5 && bright.length <= maxBrightColors;
}

function generateOutfits(
  clothes,
  styleName,
  count = 7,
  offsetSeed = 0,
  weather = null,
  avoidIds = new Set(),
) {
  const styleKey = normalizeRequestedStyle(styleName);
  if (!styleKey) return [];
  const rule = styleMateRule(styleKey);
  const classified = clothes.map((piece) => {
    const { category, layer, type } = classifyClothing(piece);
    return { ...piece, type, category, layer };
  });

  const availableRobes = classified.filter((p) => p.category === "robe");
  const availableHauts = classified.filter((p) => p.category === "haut");
  const availableBas = classified.filter((p) => p.category === "bas");
  const availableChaussures = classified.filter((p) => p.category === "chaussures");
  const availableAccessoires = classified.filter((p) => p.category === "accessoires");
  const availableManteaux = classified.filter((p) => p.category === "manteau");

  const outfits = [];
  const generatedSignatures = new Set();
  const pickCandidate = (pool, fallbackPool, step) => {
    let activePool = pool.filter((p) => !avoidIds.has(p.id));
    if (!activePool.length) activePool = pool.length ? pool : fallbackPool;
    if (!activePool.length) return null;
    activePool.sort((a, b) => scoreStyle(b, styleKey) - scoreStyle(a, styleKey));
    return activePool[(offsetSeed + step) % activePool.length] || activePool[0];
  };

  const isRockStyle = styleKey === "rock";
  const isFormalStyleKey = styleKey === "chic" || styleKey === "minimaliste";
  const isNeckwearStyle = FORMAL_NECKWEAR_STYLES.has(styleKey);
  const rockGraphicTops = availableHauts.filter(
    (p) => normalizeGarmentSlot(p) === SLOTS.BASE && styleMateIsGraphicTop(p),
  );
  const rockAccessories = availableAccessoires.filter(styleMateIsRockOrMetal);

  // Uniquement des couches chaudes : un sweat ou un gilet ne satisfait pas la
  // règle « pull ou hoodie ». En Chic/Minimaliste, seul le pull est autorisé.
  const basePool = availableHauts.filter((p) => normalizeGarmentSlot(p) === SLOTS.BASE);
  // Streetwear n'utilise que t-shirt/débardeur comme base. Rock exclut la
  // chemise formelle. Les styles formels utilisent chemise/polo.
  const styleBasePool = styleKey === "streetwear"
    ? basePool.filter((p) => STREETWEAR_BASE_TYPES.has(p.type))
    : isRockStyle
      ? basePool.filter((p) => p.type !== GARMENT_TYPES.CHEMISE)
      : basePool;
  const formalBasePool = basePool.filter((p) => FORMAL_BASE_TYPES.has(p.type));
  const warmLayerPool = availableHauts.filter(
    (p) =>
      normalizeGarmentSlot(p) === SLOTS.COUCHE &&
      (p.type === GARMENT_TYPES.PULL || p.type === GARMENT_TYPES.HOODIE),
  );
  const pullPool = warmLayerPool.filter((p) => p.type === GARMENT_TYPES.PULL);

  for (let index = 0; index < count * 8 && outfits.length < count; index += 1) {
    const pieces = [];
    const usableBasePool = isFormalStyleKey ? formalBasePool : styleBasePool;
    const hasUsableBase = usableBasePool.length > 0 && availableBas.length > 0;
    const useRobe =
      availableRobes.length > 0 &&
      (!hasUsableBase || (!isFormalStyleKey && index % 3 === 2));

    if (useRobe) {
      const robe = pickCandidate(availableRobes, [], index);
      if (robe) pieces.push(robe);
      // Une robe se porte avec un pull : un hoodie exige un t-shirt dessous.
      const pull = pickCandidate(pullPool, [], index + 1);
      if (pull) pieces.push(pull);
    } else {
      let baseHaut = null;
      if (isRockStyle && rockGraphicTops.length) {
        baseHaut = rockGraphicTops[(offsetSeed + index) % rockGraphicTops.length];
      } else {
        baseHaut = pickCandidate(
          isFormalStyleKey ? formalBasePool : styleBasePool,
          [],
          index,
        );
      }
      if (!baseHaut) continue;
      pieces.push(baseHaut);

      const baseIsTshirt = baseHaut.type === GARMENT_TYPES.TSHIRT;
      // Un hoodie n'est compatible qu'avec un t-shirt. Avec une chemise, un
      // polo ou un débardeur, seule une couche pull est valide.
      const compatibleLayers =
        !isFormalStyleKey && baseIsTshirt ? warmLayerPool : pullPool;
      const coucheHaut = pickCandidate(compatibleLayers, [], index + 1);
      if (coucheHaut) pieces.push(coucheHaut);

      const bas = pickCandidate(
        availableBas,
        classified.filter((p) => p.category === "bas"),
        index * 3 + 1,
      );
      if (bas) pieces.push(bas);
    }

    const hasWarmLayer = pieces.some(
      (piece) =>
        normalizeGarmentSlot(piece) === SLOTS.COUCHE &&
        (piece.type === GARMENT_TYPES.PULL || piece.type === GARMENT_TYPES.HOODIE),
    );
    if (!hasWarmLayer) continue;

    const chaussures = pickCandidate(
      availableChaussures,
      classified.filter((p) => p.category === "chaussures"),
      index * 5 + 2,
    );
    if (chaussures) pieces.push(chaussures);

    if (weather && !isWarmWeather(weather) && availableManteaux.length) {
      const manteau = pickCandidate(availableManteaux, [], index);
      if (manteau) pieces.push(manteau);
    }

    if (
      weather &&
      Number(weather.rain ?? weather.probabilite_pluie ?? 0) >= 40 &&
      availableManteaux.length &&
      !pieces.some((piece) => normalizeGarmentSlot(piece) === SLOTS.VESTE)
    ) {
      const manteau = pickCandidate(availableManteaux, [], index + 1);
      if (manteau) pieces.push(manteau);
    }

    const basePiece = pieces.find((p) => normalizeGarmentSlot(p) === SLOTS.BASE);
    const hasChemise = basePiece && isShirt(basePiece);

    const safeAccessories = availableAccessoires.filter((acc) => {
      if (isFormalNeckwear(acc)) {
        return hasChemise && isNeckwearStyle;
      }
      return true;
    });
    const neckwearAvailable = safeAccessories.filter(isFormalNeckwear);

    if (isRockStyle && rockAccessories.length) {
      const accessory = rockAccessories[(offsetSeed + index) % rockAccessories.length];
      if (accessory && !pieces.some((p) => p.id === accessory.id)) {
        pieces.push(accessory);
      }
    } else if (isNeckwearStyle && hasChemise && neckwearAvailable.length) {
      // Chic : cravate ou nœud papillon dès qu'une chemise est présente.
      const neckwear = pickCandidate(neckwearAvailable, [], index);
      if (neckwear && !pieces.some((p) => p.id === neckwear.id)) {
        pieces.push(neckwear);
      }
    } else if (safeAccessories.length && index % 2 === 1) {
      const accessory = pickCandidate(safeAccessories, [], index);
      if (accessory && !pieces.some((p) => p.id === accessory.id)) {
        pieces.push(accessory);
      }
    }

    const validation = validateOutfit({ pieces, style: styleKey, weather });
    let finalPieces = pieces;
    if (!validation.isValid) {
      const repaired = repairOrDiscardOutfit(
        { pieces, style: styleKey, weather },
        styleKey,
        weather,
        clothes,
      );
      if (!repaired) continue;
      finalPieces = repaired.pieces;
    }

    if (finalPieces.length < 2) continue;
    if (!outfitRespectsWeather(finalPieces, weather)) continue;
    if (!outfitRespectsColors(finalPieces, styleKey)) continue;

    const signature = finalPieces
      .map((piece) => piece.id)
      .sort()
      .join("|");
    if (generatedSignatures.has(signature)) continue;
    generatedSignatures.add(signature);

    const outfit = buildOutfit(finalPieces, styleKey, weather, {
      id: `outfit-${outfits.length + 1}`,
      name: `Tenue ${outfits.length + 1}`,
      styleBadge: getStyleLabel(styleKey),
      description: "",
    });
    if (!outfit) continue;
    outfit.description = styleMateDescribe(outfit, rule);
    outfits.push(outfit);
  }

  outfits.sort((a, b) => scoreOutfitForStyle(b, styleKey) - scoreOutfitForStyle(a, styleKey));
  return outfits.slice(0, count);
}

/**
 * Ajoute visuellement une cravate ou un nœud papillon à une tenue Chic déjà
 * sauvegardée, si la garde-robe en possède un et que la base est une chemise.
 * Cela évite qu'une ancienne tenue Chic reste sans accessoire de cou.
 */
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

export {
  classifyClothing,
  generateOutfits,
  isWarmWeather,
  outfitRespectsColors,
  outfitRespectsWeather,
  scoreOutfitForStyle,
  styleMateDescribe,
};
