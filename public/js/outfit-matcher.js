/**
 * Outfit Matcher - Validateur déterministe et modèle de données par types & slots
 * 
 * Règles métier :
 * ÉTAPE 1 : Modèle de données précis (type précis -> slot déduit par table unique)
 * ÉTAPE 3 : Validateur déterministe unique validateOutfit(outfit, style, meteo)
 * ÉTAPE 4 : Chic strict avec chaussures habillées
 * ÉTAPE 5 : Prompt système de l'agent Outfit Matcher
 */

export const GARMENT_TYPES = Object.freeze({
  TSHIRT: "t-shirt",
  POLO: "polo",
  CHEMISE: "chemise",
  DEBARDEUR: "debardeur",
  PULL: "pull",
  SWEAT: "sweat",
  HOODIE: "hoodie",
  GILET: "gilet",
  VESTE: "veste",
  MANTEAU: "manteau",
  PANTALON: "pantalon",
  JEAN: "jean",
  JUPE: "jupe",
  SHORT: "short",
  ROBE: "robe",
  BASKETS: "baskets",
  CHAUSSURES_VILLE: "chaussures-ville",
  BOTTES: "bottes",
  CRAVATE: "cravate",
  NOEUD_PAPILLON: "noeud-papillon",
  SAC: "sac",
  CEINTURE: "ceinture",
  ECHARPE: "echarpe",
  AUTRE: "autre",
});

export const SLOTS = Object.freeze({
  BASE: "BASE",
  COUCHE: "COUCHE",
  VESTE: "VESTE",
  BAS: "BAS",
  ROBE: "ROBE",
  CHAUSSURES: "CHAUSSURES",
  ACCESSOIRE: "ACCESSOIRE",
});

/**
 * Table UNIQUE reliant chaque type à son slot (jamais l'inverse).
 * Si un vêtement est de type "autre", il n'a pas de slot et est exclu des tenues.
 */
export const TYPE_TO_SLOT = Object.freeze({
  [GARMENT_TYPES.TSHIRT]: SLOTS.BASE,
  [GARMENT_TYPES.POLO]: SLOTS.BASE,
  [GARMENT_TYPES.CHEMISE]: SLOTS.BASE,
  [GARMENT_TYPES.DEBARDEUR]: SLOTS.BASE,

  [GARMENT_TYPES.PULL]: SLOTS.COUCHE,
  [GARMENT_TYPES.SWEAT]: SLOTS.COUCHE,
  [GARMENT_TYPES.HOODIE]: SLOTS.COUCHE,
  [GARMENT_TYPES.GILET]: SLOTS.COUCHE,

  [GARMENT_TYPES.VESTE]: SLOTS.VESTE,
  [GARMENT_TYPES.MANTEAU]: SLOTS.VESTE,

  [GARMENT_TYPES.PANTALON]: SLOTS.BAS,
  [GARMENT_TYPES.JEAN]: SLOTS.BAS,
  [GARMENT_TYPES.JUPE]: SLOTS.BAS,
  [GARMENT_TYPES.SHORT]: SLOTS.BAS,

  [GARMENT_TYPES.ROBE]: SLOTS.ROBE,

  [GARMENT_TYPES.BASKETS]: SLOTS.CHAUSSURES,
  [GARMENT_TYPES.CHAUSSURES_VILLE]: SLOTS.CHAUSSURES,
  [GARMENT_TYPES.BOTTES]: SLOTS.CHAUSSURES,

  [GARMENT_TYPES.CRAVATE]: SLOTS.ACCESSOIRE,
  [GARMENT_TYPES.NOEUD_PAPILLON]: SLOTS.ACCESSOIRE,
  [GARMENT_TYPES.SAC]: SLOTS.ACCESSOIRE,
  [GARMENT_TYPES.CEINTURE]: SLOTS.ACCESSOIRE,
  [GARMENT_TYPES.ECHARPE]: SLOTS.ACCESSOIRE,

  [GARMENT_TYPES.AUTRE]: null,
});

/**
 * Styles autorisant le port de cravate ou nœud papillon
 */
export const FORMAL_NECKWEAR_STYLES = new Set([
  "chic",
]);

/**
 * Liste des couleurs reconnues pour l'analyse de contradiction
 */
export const KNOWN_COLORS = [
  "bleu marine",
  "vert kaki",
  "blanc casse",
  "noir",
  "blanc",
  "gris",
  "beige",
  "bordeaux",
  "rouge",
  "rose",
  "vert",
  "kaki",
  "bleu",
  "marine",
  "marron",
  "jaune",
  "orange",
  "violet",
  "ecru",
  "camel",
];

/**
 * Nettoie une chaîne pour analyse textuelle
 * @param {string} value
 * @returns {string}
 */
export function cleanText(value) {
  return String(value ?? "")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Extrait le texte combiné d'une pièce pour la classification
 * @param {object} piece
 * @returns {string}
 */
export function getPieceSearchText(piece) {
  if (!piece) return "";
  return cleanText(`${piece.name || ""} ${piece.description || ""} ${piece.category || ""}`);
}

/**
 * Déduit le type précis d'un vêtement d'après son libellé et/ou sa catégorie.
 * Priorise les mots-clés spécifiques (ex. "veste en jean" -> veste, "nœud papillon" -> noeud-papillon).
 * Si aucun mot-clé ne correspond, retourne "autre".
 * 
 * @param {string} name 
 * @param {string} [category=""] 
 * @returns {string} Valeur de GARMENT_TYPES
 */
export function detectGarmentType(name, category = "") {
  const text = cleanText(`${name || ""} ${category || ""}`);
  if (!text) return GARMENT_TYPES.AUTRE;

  // 1. Accessoires spécifiques (nœud papillon, cravate, sac, ceinture, écharpe)
  if (/\bnoeud[- ]papillon\b|\bnoeud pap\b|\bbow[- ]?tie\b/.test(text)) {
    return GARMENT_TYPES.NOEUD_PAPILLON;
  }
  if (/\bcravate\b|\bnecktie\b/.test(text)) {
    return GARMENT_TYPES.CRAVATE;
  }
  if (/\bsac\b|\bsacoche\b|\bbag\b|\bpochette\b/.test(text) && !/costume/.test(text)) {
    return GARMENT_TYPES.SAC;
  }
  if (/\bceinture\b|\bbelt\b/.test(text)) {
    return GARMENT_TYPES.CEINTURE;
  }
  if (/\becharpe\b|\bfoulard\b|\bchale\b|\bscarf\b/.test(text)) {
    return GARMENT_TYPES.ECHARPE;
  }

  // 2. Chaussures (bottes, baskets, chaussures de ville)
  if (/\bbotte\b|\bbottes\b|\bboots\b|\bbottine\b|\bbottines\b/.test(text)) {
    return GARMENT_TYPES.BOTTES;
  }
  if (/\bbasket\b|\bbaskets\b|\bsneaker\b|\bsneakers\b|\btennis\b|\brunning\b/.test(text)) {
    return GARMENT_TYPES.BASKETS;
  }
  if (
    /\bchaussure[- ]ville\b|\bchaussures? de ville\b|\bmocassin\b|\bmocassins\b|\bderbie\b|\bderbies\b|\bderby\b|\brichelieu\b|\bescarpin\b|\bescarpins\b|\btalon\b|\btalons\b|\bsandale\b|\bsandales\b|\bloafer\b|\bloafers\b/.test(text)
  ) {
    return GARMENT_TYPES.CHAUSSURES_VILLE;
  }
  // 3. Robes & combinaisons
  if (/\brobe\b|\bdress\b|\bcombinaison\b|\bcombishort\b/.test(text)) {
    return GARMENT_TYPES.ROBE;
  }

  // 4. Manteaux & Vestes (vérifier AVANT les bas car "veste en jean" contient "jean")
  if (/\bmanteau\b|\btrench\b|\bparka\b|\bdoudoune\b|\bcaban\b|\bcoat\b|\bimpermeable\b/.test(text)) {
    return GARMENT_TYPES.MANTEAU;
  }
  if (/\bveste\b|\bblazer\b|\bblouson\b|\bperfecto\b|\bbomber\b|\bjacket\b/.test(text)) {
    return GARMENT_TYPES.VESTE;
  }
  // 5. Couches : pull, sweat, hoodie, gilet (vérifier col zippé, hoodie avant t-shirt)
  if (/\bhoodie\b|\bsweat a capuche\b|\bsweat à capuche\b|\bcapuche\b/.test(text)) {
    return GARMENT_TYPES.HOODIE;
  }
  if (/\bpull zippe\b|\bcol zippe\b|\bpull\b|\bpullover\b|\bsweater\b|\bmaille\b|\btricot\b|\bjumper\b/.test(text)) {
    return GARMENT_TYPES.PULL;
  }
  if (/\bgilet\b|\bcardigan\b/.test(text)) {
    return GARMENT_TYPES.GILET;
  }
  if (/\bsweat\b|\bsweatshirt\b/.test(text)) {
    return GARMENT_TYPES.SWEAT;
  }

  // 6. Bas : pantalon, jean, jupe, short
  if (/\bjupe\b|\bskirt\b/.test(text)) {
    return GARMENT_TYPES.JUPE;
  }
  if (/\bshort\b|\bbermuda\b/.test(text)) {
    return GARMENT_TYPES.SHORT;
  }
  if (/\bjean\b|\bjeans\b|\bdenim\b/.test(text)) {
    return GARMENT_TYPES.JEAN;
  }
  if (/\bpantalon\b|\bchino\b|\bcargo\b|\bjogging\b|\bjogger\b|\blegging\b|\btrousers\b|\bpant\b/.test(text)) {
    return GARMENT_TYPES.PANTALON;
  }

  // 7. Base : t-shirt, polo, chemise, débardeur
  if (/\bt[- ]?shirt\b|\btshirt\b|\btee[- ]?shirt\b|\btee\b/.test(text)) {
    return GARMENT_TYPES.TSHIRT;
  }
  if (/\bpolo\b/.test(text)) {
    return GARMENT_TYPES.POLO;
  }
  if (/\bchemise\b|\bchemisier\b|\bbutton[- ]?down\b|\bbutton[- ]?up\b/.test(text)) {
    return GARMENT_TYPES.CHEMISE;
  }
  if (/\bdebardeur\b|\bcaraco\b|\btank[- ]?top\b|\btop\b/.test(text)) {
    return GARMENT_TYPES.DEBARDEUR;
  }
  return GARMENT_TYPES.AUTRE;
}

/**
 * Extrait une couleur mentionnée dans le nom d'un vêtement
 * @param {string} name 
 * @returns {string|null}
 */
export function extractColorFromName(name) {
  const clean = cleanText(name);
  for (const color of KNOWN_COLORS) {
    const regex = new RegExp(`\\b${color}\\b`, "i");
    if (regex.test(clean)) {
      return color;
    }
  }
  return null;
}

/**
 * Résout la couleur d'un vêtement et vérifie les contradictions éventuelles (B6).
 * Si le nom et la couleur détectée se contredisent (ex. « T-shirt beige » et « blanc ») :
 * - Si l'utilisateur a choisi la couleur, on garde son choix.
 * - Sinon on privilégie la couleur du nom et on marque le champ comme incertain et modifiable.
 * 
 * @param {object} garment
 * @param {string} [userExplicitColor=null]
 * @returns {{ colors: string, colorConfidence: string, isContradictory: boolean }}
 */
export function resolveGarmentColors(garment, userExplicitColor = null) {
  const nameColor = extractColorFromName(garment?.name);
  const detectedColor = cleanText(garment?.detectedColor || garment?.colors);

  if (userExplicitColor) {
    return {
      colors: userExplicitColor,
      colorConfidence: "confirme",
      isContradictory: false,
    };
  }

  if (nameColor && detectedColor && !detectedColor.includes(nameColor) && !nameColor.includes(detectedColor)) {
    return {
      colors: nameColor,
      colorConfidence: "incertain",
      isContradictory: true,
    };
  }

  return {
    colors: garment?.colors || nameColor || detectedColor || "non précisé",
    colorConfidence: "confirme",
    isContradictory: false,
  };
}

/**
 * Migre un vêtement existant vers le nouveau modèle de données :
 * - Déduit le champ type
 * - Déduit le champ slot d'après la table TYPE_TO_SLOT
 * - Résout la cohérence des couleurs (B6)
 * 
 * @param {object} piece
 * @returns {object} Pièce migrée
 */
export function migrateGarment(piece) {
  if (!piece) return null;
  const rawType = piece.type;
  const type = (rawType && Object.values(GARMENT_TYPES).includes(rawType))
    ? rawType
    : detectGarmentType(piece.name, piece.category);

  const slot = TYPE_TO_SLOT[type] || null;
  const explicitColor = piece.userExplicitColor || (piece.colorSource === "user" ? piece.colors : null);
  const colorRes = resolveGarmentColors(piece, explicitColor);

  return {
    ...piece,
    type,
    slot,
    colors: colorRes.colors,
    colorConfidence: piece.colorConfidence || colorRes.colorConfidence,
    isContradictory: Boolean(colorRes.isContradictory),
  };
}

export function scoreStyle(piece, style) {
  const text = cleanText(`${piece?.name || ""} ${piece?.description || ""} ${piece?.colors || ""}`);
  const type = piece?.type || detectGarmentType(piece?.name, piece?.category);
  const styleKey = cleanText(style);
  let score = 0;
  const add = (condition, points = 1) => {
    if (condition) score += points;
  };

  if (styleKey === "rock") {
    add(type === GARMENT_TYPES.TSHIRT && /noir|imprime|graphique/.test(text), 3);
    add(type === GARMENT_TYPES.HOODIE && /noir/.test(text), 3);
    add(type === GARMENT_TYPES.PULL && /noir|gris|bordeaux/.test(text), 2);
    add(type === GARMENT_TYPES.PANTALON || type === GARMENT_TYPES.JEAN, 1);
    add(type === GARMENT_TYPES.BASKETS && /noir|blanc/.test(text), 1);
    add((type === GARMENT_TYPES.VESTE || type === GARMENT_TYPES.MANTEAU) && /noir|gris|sombre/.test(text), 1);
  } else if (["casual", "minimaliste", "streetwear"].includes(styleKey)) {
    add([GARMENT_TYPES.TSHIRT, GARMENT_TYPES.PULL].includes(type) && !/imprime|logo voyant/.test(text), 2);
    add(type === GARMENT_TYPES.HOODIE && styleKey === "streetwear", 2);
    add(/noir|blanc|gris|beige|marine/.test(text), 1);
  } else if (styleKey === "chic") {
    add([GARMENT_TYPES.CHEMISE, GARMENT_TYPES.POLO, GARMENT_TYPES.ROBE].includes(type), 2);
    add([GARMENT_TYPES.CHAUSSURES_VILLE, GARMENT_TYPES.BOTTES].includes(type), 2);
    add(type === GARMENT_TYPES.MANTEAU && /noir|gris|marine|beige/.test(text), 1);
    add(type === GARMENT_TYPES.BASKETS && isSoberSneaker(piece), 1);
  } else {
    add(type !== GARMENT_TYPES.AUTRE, 1);
  }
  return Math.max(0, Math.min(3, score));
}

/**
 * Normalise et retourne le slot d'une pièce.
 * Passe toujours par le type (table unique, jamais l'inverse).
 * @param {object|string} pieceOrText
 * @returns {string|null} Slot normalisé (ou null si type "autre")
 */
export function normalizeGarmentSlot(pieceOrText) {
  if (typeof pieceOrText === "string") {
    const type = detectGarmentType(pieceOrText);
    return TYPE_TO_SLOT[type] || null;
  }
  const migrated = migrateGarment(pieceOrText);
  return migrated?.slot || null;
}

/**
 * Vérifie si la pièce est une chemise formelle
 * @param {object} piece
 * @returns {boolean}
 */
export function isShirt(piece) {
  const type = piece?.type || detectGarmentType(piece?.name, piece?.category);
  return type === GARMENT_TYPES.CHEMISE;
}

/**
 * Vérifie si la pièce est une cravate ou un nœud papillon
 * @param {object} piece
 * @returns {boolean}
 */
export function isFormalNeckwear(piece) {
  const type = piece?.type || detectGarmentType(piece?.name, piece?.category);
  return type === GARMENT_TYPES.CRAVATE || type === GARMENT_TYPES.NOEUD_PAPILLON;
}

/**
 * Vérifie si une basket est sobre (unie, neutre, sans motif voyant)
 * @param {object} piece
 * @returns {boolean}
 */
export function isSoberSneaker(piece) {
  const type = piece?.type || detectGarmentType(piece?.name, piece?.category);
  if (type !== GARMENT_TYPES.BASKETS) return false;
  const text = cleanText(`${piece?.name || ""} ${piece?.description || ""}`);
  return !/sport|running|flashy|fluo|multicolore|paillettes/.test(text);
}

/**
 * Calcule la température effective d'après un objet météo
 * @param {object|number} weather
 * @returns {number|null}
 */
export function getEffectiveTemperature(weather) {
  if (weather == null) return null;
  if (typeof weather === "number") return weather;
  if (typeof weather.temp === "number") return weather.temp;
  if (typeof weather.temperature === "number") return weather.temperature;
  const min = weather.min ?? weather.temperature_min;
  const max = weather.max ?? weather.temperature_max;
  if (typeof max === "number" && typeof min === "number") {
    return (Number(min) + Number(max)) / 2;
  }
  if (typeof max === "number") return Number(max);
  if (typeof min === "number") return Number(min);
  return null;
}

/**
 * Calcule la probabilité de pluie d'après un objet météo
 * @param {object} weather
 * @returns {number}
 */
export function getRainProbability(weather) {
  if (weather == null) return 0;
  if (typeof weather.rain === "number") return weather.rain;
  if (typeof weather.probabilite_pluie === "number") return weather.probabilite_pluie;
  if (typeof weather.precipitation_probability === "number") return weather.precipitation_probability;
  const text = cleanText(weather.type || weather.precipitations || "");
  if (/pluie|orage|storm|rain|bruine/.test(text)) return 80;
  return 0;
}

/**
 * Validateur déterministe UNIQUE pour toutes les tenues.
 * Utilisé à la fois pour filtrer les propositions de l'IA et pour décider de l'affichage.
 * 
 * Règles (Étape 3) :
 * - Tenue = (BASE + BAS) ou ROBE, plus CHAUSSURES
 * - COUCHE ou VESTE : jamais sans BASE dessous (sauf ROBE)
 * - Temps froid (< 12 °C) : COUCHE ou VESTE obligatoire
 * - Pluie >= 40 % : VESTE/manteau recommandé, pas de chaussures en daim/toile
 * - Chaud (> 24 °C) : pas de COUCHE
 * - Cravate / nœud papillon : uniquement avec une CHEMISE, en style Chic
 * - Un POLO ne se porte pas sous un HOODIE
 * - Un seul élément par slot, sauf ACCESSOIRE (3 max)
 * - Pas de vêtement de type "autre"
 * 
 * @param {object|Array} outfit - Objet tenue ou tableau de pièces
 * @param {string} [styleParam="casual"] - Style vestimentaire
 * @param {object} [weatherParam=null] - Données météo
 * @returns {{ isValid: boolean, errors: string[], missingSlots: string[], bySlot: object }}
 */
export function validateOutfit(outfit, styleParam = "casual", weatherParam = null) {
  const errors = [];
  const missingSlots = [];

  // Extraction uniforme des paramètres
  let pieceList = [];
  let style = styleParam;
  let weather = weatherParam;

  if (Array.isArray(outfit)) {
    pieceList = outfit;
  } else if (outfit && typeof outfit === "object") {
    if (outfit.style) style = outfit.style;
    if (outfit.weather) weather = outfit.weather;

    if (Array.isArray(outfit.pieces)) {
      pieceList = outfit.pieces;
    } else if (outfit.pieces && typeof outfit.pieces === "object") {
      const p = outfit.pieces;
      pieceList = [
        p.base,
        p.couche,
        p.veste,
        p.bas,
        p.robe,
        p.chaussures,
        ...(Array.isArray(p.accessoires) ? p.accessoires : []),
      ].filter(Boolean);
    }

  }

  const cleanStyle = cleanText(style || "casual");

  // Migration des pièces pour garantir type & slot
  const migratedPieces = pieceList.map(migrateGarment).filter(Boolean);

  // Vérification : rejet des pièces de type "autre"
  const piecesAutre = migratedPieces.filter((p) => p.type === GARMENT_TYPES.AUTRE);
  if (piecesAutre.length > 0) {
    errors.push("Les vêtements de type 'autre' ne peuvent pas être inclus dans une tenue.");
  }

  // Répartition par slots
  const bySlot = {
    [SLOTS.BASE]: [],
    [SLOTS.COUCHE]: [],
    [SLOTS.VESTE]: [],
    [SLOTS.BAS]: [],
    [SLOTS.ROBE]: [],
    [SLOTS.CHAUSSURES]: [],
    [SLOTS.ACCESSOIRE]: [],
  };

  migratedPieces.forEach((piece) => {
    if (piece.slot && bySlot[piece.slot]) {
      bySlot[piece.slot].push(piece);
    }
  });

  const hasRobe = bySlot[SLOTS.ROBE].length > 0;
  const hasBase = bySlot[SLOTS.BASE].length > 0;
  const hasBas = bySlot[SLOTS.BAS].length > 0;
  const hasShoes = bySlot[SLOTS.CHAUSSURES].length > 0;
  const hasCouche = bySlot[SLOTS.COUCHE].length > 0;
  const hasVeste = bySlot[SLOTS.VESTE].length > 0;

  // 1. Structure fondamentale : (BASE + BAS) ou ROBE, + CHAUSSURES
  if (!hasShoes) {
    errors.push("Le slot CHAUSSURES est obligatoire.");
    missingSlots.push(SLOTS.CHAUSSURES);
  }

  if (hasRobe) {
    if (hasBas) {
      errors.push("Une ROBE ne peut pas être combinée avec une pièce de slot BAS.");
    }
    if (hasBase) {
      errors.push("Une ROBE remplace la pièce de slot BASE.");
    }
  } else {
    if (!hasBase) {
      errors.push("Une pièce de slot BASE (t-shirt, polo, chemise, débardeur) est obligatoire.");
      missingSlots.push(SLOTS.BASE);
    }
    if (!hasBas) {
      errors.push("Une pièce de slot BAS (pantalon, jean, jupe, short) est obligatoire.");
      missingSlots.push(SLOTS.BAS);
    }
  }

  // 2. COUCHE ou VESTE ne se porte JAMAIS seule (une BASE est obligatoire dessous)
  if ((hasCouche || hasVeste) && !hasBase && !hasRobe) {
    errors.push("Une COUCHE ou VESTE ne se porte JAMAIS seule : une BASE est obligatoire dessous.");
  }

  // Un polo a un col structuré qui ne se combine pas avec la capuche d'un hoodie.
  const hasPolo = bySlot[SLOTS.BASE].some((piece) => piece.type === GARMENT_TYPES.POLO);
  const hasHoodie = bySlot[SLOTS.COUCHE].some((piece) => piece.type === GARMENT_TYPES.HOODIE);
  if (hasPolo && hasHoodie) {
    errors.push("Un polo ne peut pas être associé à un hoodie.");
  }

  // 3. Unicité par slot (sauf ACCESSOIRE max 3)
  [SLOTS.BASE, SLOTS.COUCHE, SLOTS.VESTE, SLOTS.BAS, SLOTS.ROBE, SLOTS.CHAUSSURES].forEach((slot) => {
    if (bySlot[slot].length > 1) {
      errors.push(`Un seul élément est autorisé pour le slot ${slot} (${bySlot[slot].length} trouvés).`);
    }
  });

  if (bySlot[SLOTS.ACCESSOIRE].length > 3) {
    errors.push(`Maximum 3 accessoires autorisés (${bySlot[SLOTS.ACCESSOIRE].length} trouvés).`);
  }

  // 4. Météo : Froid (< 12 °C) -> COUCHE ou VESTE obligatoire
  const minTemp = weather?.min ?? weather?.temperature_min;
  const maxTemp = weather?.max ?? weather?.temperature_max;
  const temp = typeof minTemp === "number" ? minTemp : getEffectiveTemperature(weather);
  const isCold = temp !== null && temp < 16;
  const isVeryCold = temp !== null && temp < 10;

  if (isCold) {
    if (!hasCouche && !hasVeste) {
      errors.push("Par temps froid (< 16 °C), une COUCHE (pull, sweat, hoodie, gilet) ou une VESTE (manteau) est obligatoire.");
      if (!missingSlots.includes(SLOTS.COUCHE) && !missingSlots.includes(SLOTS.VESTE)) {
        missingSlots.push(SLOTS.COUCHE);
      }
    }
    if (isVeryCold && !hasRobe && !hasCouche) {
      errors.push("Par temps très froid (< 10 °C), une COUCHE est obligatoire.");
    }
    if (isVeryCold && !hasRobe && hasCouche && !hasVeste) {
      errors.push("Par temps très froid (< 10 °C), une VESTE est obligatoire lorsqu'elle est disponible.");
    }
  }

  // 5. Météo : Chaud (> 24 °C) -> Pas de COUCHE
  const isHot = typeof maxTemp === "number" ? maxTemp > 24 : temp !== null && temp > 24;
  if (isHot && (hasCouche || hasVeste)) {
    errors.push("Par temps chaud (max > 24 °C), aucune COUCHE ni VESTE n'est autorisée.");
  }

  // 6. Météo : Pluie (>= 40 %) -> Chaussures en daim ou toile inadaptées
  const rainProb = getRainProbability(weather);
  if (rainProb >= 40) {
    const suedeShoes = bySlot[SLOTS.CHAUSSURES].some((p) =>
      /\bdaim\b|\bsuede\b|\btoile\b/.test(getPieceSearchText(p)),
    );
    if (suedeShoes) {
      errors.push("Chaussures en daim ou en toile inadaptées par temps de pluie.");
    }
  }

  // 7. Cravate / Nœud papillon : UNIQUEMENT avec une CHEMISE et dans un style formel
  const neckwearPieces = bySlot[SLOTS.ACCESSOIRE].filter(isFormalNeckwear);
  if (neckwearPieces.length > 0) {
    const hasRealShirt = bySlot[SLOTS.BASE].some(isShirt);
    if (!hasRealShirt) {
      errors.push(
        "Une cravate ou un nœud papillon se porte UNIQUEMENT avec une CHEMISE (jamais avec t-shirt, polo, sweat ou hoodie).",
      );
    }
    const isStyleAllowed = FORMAL_NECKWEAR_STYLES.has(cleanStyle);
    if (!isStyleAllowed) {
      errors.push(
        `Une cravate ou un nœud papillon est interdit dans le style '${style}' (autorisé uniquement en Chic).`,
      );
    }
  }

  // 8. Style Rock : exclut la chemise formelle
  if (cleanStyle === "rock") {
    const hasForbiddenShirt = bySlot[SLOTS.BASE].some(isShirt);
    if (hasForbiddenShirt) {
      errors.push("Le style Rock exclut le port de chemise formelle.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    missingSlots: [...new Set(missingSlots)],
    bySlot,
  };
}

export function buildOutfit(pieces, style = "casual", weather = null, metadata = {}) {
  const validation = validateOutfit({ pieces, style, weather });
  if (!validation.isValid) return null;
  return {
    ...metadata,
    style,
    weather,
    pieces: Object.values(validation.bySlot).flat(),
  };
}

/**
 * Tente de réparer une tenue invalide ou l'écarte si irréparable.
 * Ne retourne jamais une tenue invalide.
 * 
 * @param {object} outfit
 * @param {string} [style="casual"]
 * @param {object} [weather=null]
 * @returns {object|null} Tenue réparée ou null
 */
export function repairOrDiscardOutfit(outfit, style = "casual", weather = null) {
  const validation = validateOutfit(outfit, style, weather);
  if (validation.isValid) return outfit;

  let pieces = Array.isArray(outfit.pieces) ? [...outfit.pieces] : [];
  if (!pieces.length) return null;

  // Tentative 1 : Retirer les cravates/nœuds papillon si incompatibles avec le haut ou le style
  const neckwearIncompat = validation.errors.some((err) =>
    err.includes("cravate") || err.includes("nœud papillon"),
  );
  if (neckwearIncompat) {
    pieces = pieces.filter((p) => !isFormalNeckwear(p));
  }

  // Tentative 2 : Dé-dupliquer les pièces par slot
  const slotsCount = {};
  const cleanedPieces = [];
  pieces.forEach((piece) => {
    const slot = normalizeGarmentSlot(piece);
    if (!slot) return;
    if (slot === SLOTS.ACCESSOIRE) {
      if ((slotsCount[slot] || 0) < 3) {
        slotsCount[slot] = (slotsCount[slot] || 0) + 1;
        cleanedPieces.push(piece);
      }
    } else {
      if (!slotsCount[slot]) {
        slotsCount[slot] = 1;
        cleanedPieces.push(piece);
      }
    }
  });

  const repairedOutfit = { ...outfit, pieces: cleanedPieces };
  const secondValidation = validateOutfit(repairedOutfit, style, weather);

  if (!secondValidation.isValid) {
    return null;
  }

  return repairedOutfit;
}

/**
 * Compose une tenue de style Chic stricte.
 * Les chaussures habillées sont obligatoires ; aucune tenue n'est dégradée
 * vers un autre style lorsque la garde-robe ne le permet pas.
 * 
 * @param {Array} wardrobe 
 * @param {object} [options={}]
 * @returns {{ success: boolean, pieces: Array, style: string, niveau_assouplissement: number, message: string|null, missingSlot: string|null }}
 */
export function resolveChicOutfit(wardrobe, options = {}) {
  const { weather = null, avoidIds = new Set() } = options;
  const migrated = (wardrobe || []).map(migrateGarment).filter((p) => p.type !== GARMENT_TYPES.AUTRE);

  const candidatesRobes = migrated.filter((p) => p.slot === SLOTS.ROBE && !avoidIds.has(p.id));
  const candidatesBase = migrated.filter((p) => p.slot === SLOTS.BASE && !avoidIds.has(p.id));
  const candidatesBas = migrated.filter((p) => p.slot === SLOTS.BAS && !avoidIds.has(p.id));
  const candidatesChaussures = migrated.filter((p) => p.slot === SLOTS.CHAUSSURES && !avoidIds.has(p.id));
  const candidatesVeste = migrated.filter((p) => p.slot === SLOTS.VESTE && !avoidIds.has(p.id));
  const candidatesCouche = migrated.filter((p) => p.slot === SLOTS.COUCHE && !avoidIds.has(p.id));

  // Chaussures habillées strictes uniquement.
  const formalShoes = candidatesChaussures.filter(
    (p) => p.type === GARMENT_TYPES.CHAUSSURES_VILLE || p.type === GARMENT_TYPES.BOTTES,
  );
  const relaxationLevel = 0;
  const targetShoes = formalShoes;
  const targetStyle = "Chic";

  // Diagnostic précis des slots manquants (Étape 4.4)
  if (!targetShoes.length) {
    return {
      success: false,
      pieces: [],
      style: targetStyle,
      niveau_assouplissement: relaxationLevel,
      missingSlot: "des chaussures habillées",
      message: "il manque : des chaussures habillées",
    };
  }

  const hasRobe = candidatesRobes.length > 0;
  const hasBaseAndBas = candidatesBase.length > 0 && candidatesBas.length > 0;

  if (!hasRobe && !hasBaseAndBas) {
    if (!candidatesBase.length) {
      return {
        success: false,
        pieces: [],
        style: targetStyle,
        niveau_assouplissement: relaxationLevel,
        missingSlot: "une chemise ou un polo",
        message: "il manque : une chemise",
      };
    }
    if (!candidatesBas.length) {
      return {
        success: false,
        pieces: [],
        style: targetStyle,
        niveau_assouplissement: relaxationLevel,
        missingSlot: "un pantalon ou une jupe",
        message: "il manque : un pantalon ou une jupe",
      };
    }
  }

  // Composition de la tenue
  const pieces = [];
  if (hasRobe && (!hasBaseAndBas || candidatesRobes.length > candidatesBase.length)) {
    pieces.push(candidatesRobes[0]);
  } else {
    // Préférer chemise ou polo en chic
    const preferredBase = candidatesBase.find((p) => p.type === GARMENT_TYPES.CHEMISE)
      || candidatesBase.find((p) => p.type === GARMENT_TYPES.POLO)
      || candidatesBase[0];
    const preferredBas = candidatesBas.find((p) => p.type === GARMENT_TYPES.PANTALON)
      || candidatesBas.find((p) => p.type === GARMENT_TYPES.JUPE)
      || candidatesBas[0];
    pieces.push(preferredBase, preferredBas);
  }

  pieces.push(targetShoes[0]);

  // Si temps froid (< 12 °C), une veste ou un manteau est obligatoire
  const temp = getEffectiveTemperature(weather);
  const maxTemp = weather?.max ?? weather?.temperature_max;
  const minTemp = typeof weather?.min === "number" ? weather.min : temp;
  const isCold = (minTemp !== null && minTemp < 16) || (typeof maxTemp === "number" && maxTemp < 16);
  const isVeryCold = minTemp !== null && minTemp < 10;

  if (isCold) {
    if (isVeryCold && candidatesCouche.length && !pieces.some((piece) => piece.slot === SLOTS.COUCHE)) {
      pieces.push(candidatesCouche[0]);
    }
    if (candidatesVeste.length) {
      pieces.push(candidatesVeste[0]);
    } else if (candidatesCouche.length) {
      pieces.push(candidatesCouche[0]);
    } else {
      return {
        success: false,
        pieces: [],
        style: targetStyle,
        niveau_assouplissement: relaxationLevel,
        missingSlot: "un manteau ou une veste chaude",
        message: "il manque : un manteau",
      };
    }
  } else if (candidatesVeste.length && getRainProbability(weather) >= 40) {
    pieces.push(candidatesVeste[0]);
  } else if (candidatesVeste.length) {
    // Par temps tempéré, ajouter un manteau/veste si disponible
    pieces.push(candidatesVeste[0]);
  }

  const validation = validateOutfit(pieces, targetStyle, weather);
  if (!validation.isValid) {
    return {
      success: false,
      pieces: [],
      style: targetStyle,
      niveau_assouplissement: relaxationLevel,
      missingSlot: validation.missingSlots[0] || "une pièce compatible",
      message: `il manque : ${validation.errors[0] || "une pièce compatible"}`,
    };
  }

  return {
    success: true,
    pieces,
    style: targetStyle,
    niveau_assouplissement: relaxationLevel,
    message: null,
    missingSlot: null,
    justification: "Tenue chic et raffinée avec pièces habillées.",
  };
}

/**
 * Vérifie si une garde-robe possède les éléments nécessaires pour composer au moins une tenue valide.
 * Si non, identifie précisément le slot manquant.
 * 
 * @param {Array} clothes
 * @returns {{ canCompose: boolean, missingSlots: string[], message: string|null }}
 */
export function checkWardrobeCompleteness(clothes) {
  if (!Array.isArray(clothes) || clothes.length === 0) {
    return {
      canCompose: false,
      missingSlots: [SLOTS.BASE, SLOTS.BAS, SLOTS.CHAUSSURES],
      message: "information manquante : garde-robe vide",
    };
  }

  const migrated = clothes.map(migrateGarment).filter((p) => p.type !== GARMENT_TYPES.AUTRE);
  const availableSlots = new Set(migrated.map((p) => p.slot).filter(Boolean));
  const missing = [];

  if (!availableSlots.has(SLOTS.CHAUSSURES)) {
    missing.push(SLOTS.CHAUSSURES);
  }

  const hasRobe = availableSlots.has(SLOTS.ROBE);
  const hasBaseAndBas = availableSlots.has(SLOTS.BASE) && availableSlots.has(SLOTS.BAS);

  if (!hasRobe && !hasBaseAndBas) {
    if (!availableSlots.has(SLOTS.BASE)) missing.push(SLOTS.BASE);
    if (!availableSlots.has(SLOTS.BAS)) missing.push(SLOTS.BAS);
  }

  if (missing.length > 0) {
    return {
      canCompose: false,
      missingSlots: missing,
      message: `information manquante : slot(s) ${missing.join(", ")} manquant(s)`,
    };
  }

  return {
    canCompose: true,
    missingSlots: [],
    message: null,
  };
}

/**
 * PROMPT OFFICIEL DE L'AGENT OUTFIT MATCHER (ÉTAPE 5)
 */
export const OUTFIT_MATCHER_PROMPT = `Tu es l'agent Outfit Matcher d'AI Wardrobe, ingénieur styliste expert en composition vestimentaire.

MISSION :
Tu composes des tenues quotidiennes pour chaque jour de la semaine à partir STRICTEMENT des vêtements fournis dans la garde-robe de l'utilisateur.

RÈGLES STRICTES DE COMPOSITION :
1. Chaque vêtement fourni possède un id, un type précis, un slot déduit, ses couleurs et la météo du jour.
2. Structure d'une tenue valide :
   - Formule classique : 1 BASE (t-shirt, polo, chemise, debardeur) + 1 BAS (pantalon, jean, jupe, short) + 1 CHAUSSURES (+ optionnellement 1 COUCHE, 1 VESTE, 0 à 3 ACCESSOIRE).
   - Formule robe : 1 ROBE + 1 CHAUSSURES (+ optionnellement 1 VESTE ou COUCHE, 0 à 3 ACCESSOIRE ; JAMAIS de pièce BAS sous une robe).
3. RÈGLE DES COUCHES : Une pièce de slot COUCHE (pull, sweat, hoodie, gilet) ou VESTE (veste, manteau) ne se porte JAMAIS seule : une pièce de slot BASE est OBLIGATOIRE dessous.
4. MÉTÉO :
   - Par temps froid (< 12 °C) : une COUCHE ou une VESTE est OBLIGATOIRE.
   - Par temps de pluie (>= 40 %) : privilégie une veste ou un manteau imperméable et évite daim/toile.
   - Par temps chaud (> 24 °C) : aucune COUCHE n'est autorisée.
5. RÈGLE DE LA CRAVATE : Une cravate ou un nœud papillon se porte UNIQUEMENT avec une CHEMISE (jamais avec t-shirt, polo, sweat ou hoodie) et EXCLUSIVEMENT pour le style 'Chic'.
6. RÈGLE POLO : Un polo ne peut pas être associé à un hoodie.
7. RÈGLE D'UNICITÉ : Un seul élément par slot, sauf ACCESSOIRE (maximum 3). Aucun vêtement de type 'autre'.
8. STYLE CHIC STRICT : Utilise des chaussures habillées. S'il n'y en a pas, indique précisément qu'il manque des chaussures habillées ; ne remplace jamais le style Chic par « Chic décontracté ».
9. Tu ne choisis QUE des IDs existants fournis. N'invente JAMAIS d'ID ni de vêtement.
10. Toute donnée absente ou composition impossible : "information manquante : il manque [slot précis]".

EXEMPLES VALIDES (tirés des tests) :
- Exemple 1 (Chic) : chemise blanche [BASE] + pantalon marine [BAS] + mocassins noirs [CHAUSSURES] + manteau gris [VESTE] -> Valide
- Exemple 2 (Minimaliste) : robe noire [ROBE] + manteau gris [VESTE] + baskets noir/rose [CHAUSSURES] -> Valide (niveau_assouplissement: 0)
- Exemple 3 (Minimaliste) : t-shirt blanc [BASE] + pull beige [COUCHE] + jupe marron [BAS] + baskets blanches [CHAUSSURES] -> Valide (niveau_assouplissement: 0)

EXEMPLES INVALIDES (tirés des tests) :
- Invalide 1 : pull beige + pantalon kaki + baskets blanches -> REJETÉ : pull sans pièce de BASE dessous.
- Invalide 2 : t-shirt blanc + pantalon kaki + baskets blanches à 8 °C -> REJETÉ : t-shirt seul par temps froid (< 12 °C) sans pull ni manteau.
- Invalide 3 : t-shirt blanc + cravate marine + pantalon kaki + baskets -> REJETÉ : cravate avec t-shirt (chemise obligatoire).

FORMAT DE RÉPONSE EXCLUSIF (JSON STRICT VALIDE SANS TEXTE AVANT NI APRÈS) :
{
  "tenues": [
    {
      "jour": "Lundi",
      "style": "Chic",
      "pieces": {
        "base": "id_existant",
        "couche": "id_existant_ou_null",
        "veste": "id_existant_ou_null",
        "bas": "id_existant_ou_null",
        "robe": "id_existant_ou_null",
        "chaussures": "id_existant",
        "accessoires": ["id_existant"]
      },
      "niveau_assouplissement": 0,
      "justification": "Explication claire de l'harmonie des pièces et de l'adaptation à la météo."
    }
  ]
}`;
