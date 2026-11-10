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
 * Styles formels : Chic et Minimaliste (Minimaliste = Chic sans cravate,
 * nœud papillon ni fioritures). Ils partagent les règles de base :
 * - jamais de t-shirt ;
 * - jamais de hoodie (un hoodie exige un t-shirt dessous) ;
 * - couche chaude obligatoire, et cette couche doit être un pull.
 */
export const FORMAL_STYLE_KEYS = new Set([
  "chic",
  "minimaliste",
]);

/**
 * Types qui satisfont la règle de la couche chaude obligatoire.
 * Un sweat ou un gilet ne suffit pas : la tenue doit contenir un pull ou un hoodie.
 */
export const WARM_LAYER_TYPES = new Set([
  GARMENT_TYPES.PULL,
  GARMENT_TYPES.HOODIE,
]);

/**
 * Types de base autorisés pour les styles formels (Chic / Minimaliste).
 */
export const FORMAL_BASE_TYPES = new Set([
  GARMENT_TYPES.CHEMISE,
  GARMENT_TYPES.POLO,
]);

/**
 * @param {string} style
 * @returns {boolean}
 */
export function isFormalStyle(style) {
  return FORMAL_STYLE_KEYS.has(cleanText(style));
}

/**
 * @param {object} piece
 * @returns {boolean}
 */
export function isWarmLayer(piece) {
  const type = piece?.type || detectGarmentType(piece?.name, piece?.category);
  return WARM_LAYER_TYPES.has(type);
}

/**
 * @param {object} piece
 * @returns {boolean}
 */
export function isPull(piece) {
  const type = piece?.type || detectGarmentType(piece?.name, piece?.category);
  return type === GARMENT_TYPES.PULL;
}

/**
 * @param {object} piece
 * @returns {boolean}
 */
export function isHoodie(piece) {
  const type = piece?.type || detectGarmentType(piece?.name, piece?.category);
  return type === GARMENT_TYPES.HOODIE;
}

/**
 * @param {object} piece
 * @returns {boolean}
 */
export function isTshirt(piece) {
  const type = piece?.type || detectGarmentType(piece?.name, piece?.category);
  return type === GARMENT_TYPES.TSHIRT;
}

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
 * Déduit le type précis d'un vêtement à partir d'un texte déjà normalisé.
 * @param {string} text
 * @returns {string} Valeur de GARMENT_TYPES
 */
function detectGarmentTypeFromText(text) {
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
 * Déduit le type précis d'un vêtement d'après son libellé, puis sa catégorie.
 * Le nom est prioritaire : une "veste en jean" rangée dans "manteau" reste une
 * veste, et un "blouson" rangé dans "manteau" reste un blouson.
 *
 * @param {string} name
 * @param {string} [category=""]
 * @returns {string} Valeur de GARMENT_TYPES
 */
export function detectGarmentType(name, category = "") {
  const fromName = detectGarmentTypeFromText(cleanText(name));
  if (fromName !== GARMENT_TYPES.AUTRE) return fromName;
  return detectGarmentTypeFromText(cleanText(category));
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
  // Un ancien document marqué "autre" ne doit pas rester bloqué : on retente
  // la classification depuis le nom et la catégorie. C'est ce qui permet à un
  // blouson importé avant la correction d'être reconnu comme VESTE.
  const type = (rawType && rawType !== GARMENT_TYPES.AUTRE && Object.values(GARMENT_TYPES).includes(rawType))
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
  const basePieces = bySlot[SLOTS.BASE];
  const couchePieces = bySlot[SLOTS.COUCHE];
  const warmLayerPieces = couchePieces.filter(isWarmLayer);
  const pullPieces = couchePieces.filter(isPull);
  const hoodiePieces = couchePieces.filter(isHoodie);
  const tshirtBasePieces = basePieces.filter(isTshirt);
  const hasTshirtBase = tshirtBasePieces.length > 0;
  const hasPoloBase = basePieces.some((piece) => piece.type === GARMENT_TYPES.POLO);
  const hasShirtBase = basePieces.some(isShirt);
  const styleLabel = cleanStyle === "minimaliste" ? "Minimaliste" : "Chic";

  // La couche chaude est obligatoire dans TOUTES les tenues, sans exception
  // météo. Un sweat ou un gilet ne remplace pas un pull ou un hoodie.
  if (warmLayerPieces.length === 0) {
    errors.push(
      "Chaque tenue doit contenir une couche chaude : un pull ou un hoodie (sans exception, même par temps chaud).",
    );
    missingSlots.push(SLOTS.COUCHE);
  }

  // Un hoodie ne se porte QUE sur un t-shirt : jamais sur un polo, une
  // chemise, un débardeur ou une robe.
  if (hoodiePieces.length > 0 && !hasTshirtBase) {
    errors.push(
      "Un hoodie ne peut être porté que par-dessus un t-shirt (jamais avec un polo, une chemise, un débardeur ou une robe).",
    );
  }


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

  // Un polo ou une chemise ont un col structuré qui ne se combine pas avec
  // la capuche d'un hoodie.
  if (hasPoloBase && hoodiePieces.length > 0) {
    errors.push("Un polo ne peut pas être associé à un hoodie.");
  }
  if (hasShirtBase && hoodiePieces.length > 0) {
    errors.push("Une chemise ne peut pas être associée à un hoodie.");
  }

  // 3. Styles formels (Chic / Minimaliste) : chemise ou polo, jamais de
  // t-shirt ; pull, jamais de hoodie.
  if (isFormalStyle(cleanStyle)) {
    const invalidBase = basePieces.find((piece) => !FORMAL_BASE_TYPES.has(piece.type));
    if (invalidBase) {
      errors.push(
        `Le style ${styleLabel} interdit les t-shirts et les débardeurs : utilise une chemise ou un polo.`,
      );
    }
    const invalidLayer = couchePieces.find((piece) => piece.type !== GARMENT_TYPES.PULL);
    if (invalidLayer) {
      errors.push(
        `Le style ${styleLabel} exige un pull : le hoodie est interdit car il exige un t-shirt, lui-même interdit en ${styleLabel}.`,
      );
    }
  }

  // 4. Unicité par slot (sauf ACCESSOIRE max 3)
  [SLOTS.BASE, SLOTS.COUCHE, SLOTS.VESTE, SLOTS.BAS, SLOTS.ROBE, SLOTS.CHAUSSURES].forEach((slot) => {
    if (bySlot[slot].length > 1) {
      errors.push(`Un seul élément est autorisé pour le slot ${slot} (${bySlot[slot].length} trouvés).`);
    }
  });

  if (bySlot[SLOTS.ACCESSOIRE].length > 3) {
    errors.push(`Maximum 3 accessoires autorisés (${bySlot[SLOTS.ACCESSOIRE].length} trouvés).`);
  }

  // 5. Météo : Froid (< 12 °C) -> couche chaude obligatoire (déjà imposée
  // plus haut). Une veste est ajoutée par le générateur si elle est
  // disponible, mais son absence ne rend pas une tenue avec pull invalide.
  const minTemp = weather?.min ?? weather?.temperature_min;
  const temp = typeof minTemp === "number" ? minTemp : getEffectiveTemperature(weather);
  const isCold = temp !== null && temp < 16;

  if (isCold && !hasCouche && !hasVeste) {
    errors.push("Par temps froid (< 16 °C), un pull ou un hoodie, ou une VESTE (manteau), est obligatoire.");
    if (!missingSlots.includes(SLOTS.COUCHE) && !missingSlots.includes(SLOTS.VESTE)) {
      missingSlots.push(SLOTS.COUCHE);
    }
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
 * Normalise une liste de pièces en catalogue migré (type + slot garantis).
 * @param {Array} pieces
 * @returns {Array}
 */
function toGarmentCatalog(pieces) {
  return (pieces || [])
    .map(migrateGarment)
    .filter((piece) => piece && piece.type !== GARMENT_TYPES.AUTRE);
}

/**
 * Ordonne les pièces selon l'ordre d'affichage des slots.
 * @param {Array} pieces
 * @returns {Array}
 */
function sortPiecesBySlot(pieces) {
  const order = [
    SLOTS.BASE,
    SLOTS.COUCHE,
    SLOTS.VESTE,
    SLOTS.BAS,
    SLOTS.ROBE,
    SLOTS.CHAUSSURES,
    SLOTS.ACCESSOIRE,
  ];
  return [...pieces].sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
}

/**
 * Dé-duplique les pièces par slot (3 accessoires maximum).
 * @param {Array} pieces
 * @returns {Array}
 */
function dedupePiecesBySlot(pieces) {
  const slotsCount = {};
  const cleanedPieces = [];
  for (const piece of pieces) {
    const migrated = migrateGarment(piece);
    if (!migrated || migrated.type === GARMENT_TYPES.AUTRE || !migrated.slot) continue;
    if (migrated.slot === SLOTS.ACCESSOIRE) {
      if ((slotsCount[migrated.slot] || 0) < 3) {
        slotsCount[migrated.slot] = (slotsCount[migrated.slot] || 0) + 1;
        cleanedPieces.push(migrated);
      }
    } else if (!slotsCount[migrated.slot]) {
      slotsCount[migrated.slot] = 1;
      cleanedPieces.push(migrated);
    }
  }
  return cleanedPieces;
}

/**
 * Corrige une tenue en puisant dans la garde-robe les pièces manquantes ou
 * incompatibles (couche chaude, remplacement d'un t-shirt en Chic, etc.).
 * Retourne toujours une tenue validée, ou null si aucune correction n'est
 * possible avec les vêtements disponibles.
 *
 * @param {object} outfit
 * @param {Array} wardrobe
 * @param {string} [style="casual"]
 * @param {object|null} [weather=null]
 * @returns {object|null}
 */
export function repairOutfitWithWardrobe(outfit, wardrobe = [], style = "casual", weather = null) {
  if (!outfit || !Array.isArray(outfit.pieces)) return null;

  const formal = isFormalStyle(style);
  const catalog = toGarmentCatalog([...(wardrobe || []), ...outfit.pieces]);
  let pieces = dedupePiecesBySlot(outfit.pieces);
  const usedIds = new Set(pieces.filter((piece) => piece.id != null).map((piece) => String(piece.id)));
  const hasId = (piece) => piece.id != null && usedIds.has(String(piece.id));
  const addFromCatalog = (predicate) => {
    const found = catalog.find((piece) => !hasId(piece) && predicate(piece));
    if (!found) return null;
    pieces.push(found);
    if (found.id != null) usedIds.add(String(found.id));
    return found;
  };

  // 1. Style formel : remplacer un t-shirt / débardeur par une chemise ou un polo.
  if (formal) {
    const invalidBases = pieces.filter(
      (piece) => piece.slot === SLOTS.BASE && !FORMAL_BASE_TYPES.has(piece.type),
    );
    if (invalidBases.length > 0) {
      pieces = pieces.filter((piece) => !invalidBases.includes(piece));
      invalidBases.forEach((piece) => {
        if (piece.id != null) usedIds.delete(String(piece.id));
      });
      addFromCatalog((piece) => piece.slot === SLOTS.BASE && FORMAL_BASE_TYPES.has(piece.type));
    }
  }

  // 1 bis. Ajouter une base si elle manque (hors robe), pour réparer une
  // réponse d'IA incomplète sans jamais afficher une tenue invalide.
  const hasRobe = pieces.some((piece) => piece.slot === SLOTS.ROBE);
  const hasBase = pieces.some((piece) => piece.slot === SLOTS.BASE);
  if (!hasBase && !hasRobe) {
    const rockStyle = cleanText(style) === "rock";
    addFromCatalog((piece) => {
      if (piece.slot !== SLOTS.BASE) return false;
      if (formal) return FORMAL_BASE_TYPES.has(piece.type);
      if (rockStyle) return piece.type !== GARMENT_TYPES.CHEMISE;
      return true;
    });
  }

  // 2. Une seule couche : si elle est invalide (hoodie sur polo/chemise,
  // hoodie en Chic), on la retire puis on cherche un remplacement.
  const layers = pieces.filter((piece) => piece.slot === SLOTS.COUCHE);
  if (layers.length > 1) {
    const preferredLayer =
      layers.find((piece) => piece.type === GARMENT_TYPES.PULL) ||
      (!formal && layers.find((piece) => piece.type === GARMENT_TYPES.HOODIE)) ||
      layers[0];
    pieces = pieces.filter(
      (piece) => piece.slot !== SLOTS.COUCHE || piece === preferredLayer,
    );
  }

  let base = pieces.find((piece) => piece.slot === SLOTS.BASE) || null;
  let layer = pieces.find((piece) => piece.slot === SLOTS.COUCHE) || null;
  const layerIsInvalid =
    layer &&
    (!WARM_LAYER_TYPES.has(layer.type) ||
      (formal && layer.type !== GARMENT_TYPES.PULL) ||
      (layer.type === GARMENT_TYPES.HOODIE && (!base || base.type !== GARMENT_TYPES.TSHIRT)));
  if (layerIsInvalid) {
    pieces = pieces.filter((piece) => piece !== layer);
    if (layer.id != null) usedIds.delete(String(layer.id));
    layer = null;
  }

  if (!layer && (base || hasRobe)) {
    // Le pull est toujours préféré ; le hoodie n'est ajouté qu'en secours,
    // sur un t-shirt et hors style formel.
    layer = addFromCatalog(
      (piece) => piece.slot === SLOTS.COUCHE && piece.type === GARMENT_TYPES.PULL,
    );
    if (!layer && !formal && base && base.type === GARMENT_TYPES.TSHIRT) {
      layer = addFromCatalog(
        (piece) => piece.slot === SLOTS.COUCHE && piece.type === GARMENT_TYPES.HOODIE,
      );
    }
  }

  pieces = sortPiecesBySlot(dedupePiecesBySlot(pieces));

  const candidate = { ...outfit, style, weather, pieces };
  const validation = validateOutfit(candidate, style, weather);
  return validation.isValid ? candidate : null;
}

/**
 * Tente de réparer une tenue invalide ou l'écarte si irréparable.
 * Ne retourne jamais une tenue invalide.
 *
 * @param {object} outfit
 * @param {string} [style="casual"]
 * @param {object} [weather=null]
 * @param {Array} [wardrobe=null] Si fournie, permet d'ajouter la couche chaude
 *   manquante ou de remplacer une pièce incompatible.
 * @returns {object|null} Tenue réparée ou null
 */
export function repairOrDiscardOutfit(outfit, style = "casual", weather = null, wardrobe = null) {
  if (!outfit) return null;
  const validation = validateOutfit(outfit, style, weather);
  if (validation.isValid) return outfit;

  if (Array.isArray(wardrobe) && wardrobe.length > 0) {
    return repairOutfitWithWardrobe(outfit, wardrobe, style, weather);
  }

  let pieces = Array.isArray(outfit.pieces) ? toGarmentCatalog(outfit.pieces) : [];
  if (!pieces.length) return null;

  // Tentative 1 : Retirer les cravates/nœuds papillon si incompatibles avec le haut ou le style
  const neckwearIncompat = validation.errors.some(
    (err) => err.includes("cravate") || err.includes("nœud papillon"),
  );
  if (neckwearIncompat) {
    pieces = pieces.filter((piece) => !isFormalNeckwear(piece));
  }

  // Tentative 2 : Retirer une couche chaude incompatible (hoodie sur polo/chemise,
  // hoodie en Chic) ou une couche qui n'est ni un pull ni un hoodie.
  const formal = isFormalStyle(style);
  const base = pieces.find((piece) => piece.slot === SLOTS.BASE) || null;
  pieces = pieces.filter((piece) => {
    if (piece.slot !== SLOTS.COUCHE) return true;
    if (!WARM_LAYER_TYPES.has(piece.type)) return false;
    if (formal && piece.type !== GARMENT_TYPES.PULL) return false;
    if (piece.type === GARMENT_TYPES.HOODIE && (!base || base.type !== GARMENT_TYPES.TSHIRT)) {
      return false;
    }
    return true;
  });

  const repairedOutfit = { ...outfit, pieces: dedupePiecesBySlot(pieces) };
  const secondValidation = validateOutfit(repairedOutfit, style, weather);
  return secondValidation.isValid ? repairedOutfit : null;
}

/**
 * Compose une tenue formelle (Chic ou Minimaliste) :
 * - base chemise ou polo, jamais de t-shirt ;
 * - pull obligatoire, jamais de hoodie ;
 * - Chic : chaussures habillées ; Minimaliste : chaussures libres.
 *
 * @param {Array} wardrobe
 * @param {object} [options={}]
 * @returns {{ success: boolean, pieces: Array, style: string, niveau_assouplissement: number, message: string|null, missingSlot: string|null }}
 */
export function resolveFormalOutfit(wardrobe, options = {}) {
  const {
    weather = null,
    avoidIds = new Set(),
    style = "chic",
  } = options;
  const styleKey = cleanText(style) === "minimaliste" ? "minimaliste" : "chic";
  const strictShoes = styleKey === "chic";
  const targetStyle = styleKey === "minimaliste" ? "Minimaliste" : "Chic";
  const migrated = toGarmentCatalog(wardrobe);
  const isAvailable = (piece) => !avoidIds.has(piece.id);
  const pickPool = (predicate) => {
    const all = migrated.filter(predicate);
    const notAvoided = all.filter(isAvailable);
    // `avoidIds` exprime une préférence (éviter les répétitions), jamais une
    // indisponibilité : s'il ne reste aucune alternative, on réutilise.
    return notAvoided.length > 0 ? notAvoided : all;
  };

  const candidatesRobes = pickPool((p) => p.slot === SLOTS.ROBE);
  const candidatesBase = pickPool(
    (p) => p.slot === SLOTS.BASE && FORMAL_BASE_TYPES.has(p.type),
  );
  const candidatesBas = pickPool((p) => p.slot === SLOTS.BAS);
  const candidatesVeste = pickPool((p) => p.slot === SLOTS.VESTE);
  const candidatesPull = pickPool(
    (p) => p.slot === SLOTS.COUCHE && p.type === GARMENT_TYPES.PULL,
  );
  const candidatesChaussures = pickPool((p) =>
    strictShoes
      ? p.slot === SLOTS.CHAUSSURES &&
        (p.type === GARMENT_TYPES.CHAUSSURES_VILLE || p.type === GARMENT_TYPES.BOTTES)
      : p.slot === SLOTS.CHAUSSURES,
  );

  const targetShoes = candidatesChaussures;

  const failure = (message, missingSlot) => ({
    success: false,
    pieces: [],
    style: targetStyle,
    niveau_assouplissement: 0,
    missingSlot,
    message,
  });

  // Diagnostic précis, dans l'ordre où les pièces sont nécessaires.
  if (!targetShoes.length) {
    return failure(
      strictShoes ? "il manque : des chaussures habillées" : "il manque : des chaussures",
      strictShoes ? "des chaussures habillées" : "des chaussures",
    );
  }

  const hasRobe = candidatesRobes.length > 0;
  if (!hasRobe && !candidatesBase.length) {
    return failure(
      "il manque : aucun polo ou chemise disponible (les t-shirts sont interdits pour ce style)",
      "un polo ou une chemise",
    );
  }
  if (!candidatesPull.length) {
    return failure(
      "il manque : aucun pull disponible (le hoodie est interdit car il exige un t-shirt)",
      "un pull",
    );
  }
  if (!hasRobe && !candidatesBas.length) {
    return failure("il manque : un pantalon ou une jupe", "un pantalon ou une jupe");
  }

  const pieces = [];
  const useRobe = hasRobe && (!candidatesBase.length || !candidatesBas.length);
  if (useRobe) {
    pieces.push(candidatesRobes[0]);
  } else {
    const preferredBase =
      candidatesBase.find((p) => p.type === GARMENT_TYPES.CHEMISE) ||
      candidatesBase.find((p) => p.type === GARMENT_TYPES.POLO) ||
      candidatesBase[0];
    const preferredBas =
      candidatesBas.find((p) => p.type === GARMENT_TYPES.PANTALON) ||
      candidatesBas.find((p) => p.type === GARMENT_TYPES.JUPE) ||
      candidatesBas[0];
    pieces.push(preferredBase, preferredBas);
  }

  // Couche chaude obligatoire : TOUJOURS un pull, jamais un hoodie.
  pieces.push(candidatesPull[0]);
  pieces.push(targetShoes[0]);

  const temp = getEffectiveTemperature(weather);
  const maxTemp = weather?.max ?? weather?.temperature_max;
  const minTemp = typeof weather?.min === "number" ? weather.min : temp;
  const isCold = (minTemp !== null && minTemp < 16) || (typeof maxTemp === "number" && maxTemp < 16);

  const rainProb = getRainProbability(weather);
  const shouldAddVeste = !weather || isCold || rainProb >= 40;
  if (shouldAddVeste && candidatesVeste.length) {
    pieces.push(candidatesVeste[0]);
  }

  const orderedPieces = sortPiecesBySlot(dedupePiecesBySlot(pieces));
  const validation = validateOutfit(orderedPieces, targetStyle, weather);
  if (!validation.isValid) {
    return failure(
      `il manque : ${validation.errors[0] || "une pièce compatible"}`,
      validation.missingSlots[0] || "une pièce compatible",
    );
  }

  return {
    success: true,
    pieces: orderedPieces,
    style: targetStyle,
    niveau_assouplissement: 0,
    message: null,
    missingSlot: null,
    justification:
      styleKey === "minimaliste"
        ? "Tenue minimaliste épurée avec chemise ou polo et pull."
        : "Tenue chic et raffinée avec chemise ou polo, pull et chaussures habillées.",
  };
}

/**
 * Compose une tenue de style Chic stricte.
 * @param {Array} wardrobe
 * @param {object} [options={}]
 * @returns {object}
 */
export function resolveChicOutfit(wardrobe, options = {}) {
  return resolveFormalOutfit(wardrobe, { ...options, style: options.style || "chic" });
}

/**
 * Explique précisément pourquoi aucune tenue ne peut être composée.
 * Retourne null si les pièces indispensables sont présentes.
 *
 * @param {Array} clothes
 * @param {string} [style="casual"]
 * @returns {string|null}
 */
export function explainMissingPieces(clothes, style = "casual") {
  if (!Array.isArray(clothes) || clothes.length === 0) {
    return "garde-robe vide";
  }
  const migrated = toGarmentCatalog(clothes);
  const styleKey = cleanText(style || "casual");
  const strictChic = styleKey === "chic";
  const formalFamily = isFormalStyle(styleKey);

  const bases = migrated.filter((piece) => piece.slot === SLOTS.BASE);
  const couches = migrated.filter((piece) => piece.slot === SLOTS.COUCHE);
  const pulls = couches.filter((piece) => piece.type === GARMENT_TYPES.PULL);
  const hoodies = couches.filter((piece) => piece.type === GARMENT_TYPES.HOODIE);
  const tshirts = bases.filter((piece) => piece.type === GARMENT_TYPES.TSHIRT);
  const formalBases = bases.filter((piece) => FORMAL_BASE_TYPES.has(piece.type));
  const bas = migrated.filter((piece) => piece.slot === SLOTS.BAS);
  const robes = migrated.filter((piece) => piece.slot === SLOTS.ROBE);
  const shoes = migrated.filter((piece) => piece.slot === SLOTS.CHAUSSURES);
  const formalShoes = shoes.filter(
    (piece) =>
      piece.type === GARMENT_TYPES.CHAUSSURES_VILLE || piece.type === GARMENT_TYPES.BOTTES,
  );

  if (strictChic && formalShoes.length === 0) {
    return "des chaussures habillées";
  }
  if (!strictChic && shoes.length === 0) {
    return "des chaussures";
  }

  if (formalFamily) {
    if (robes.length === 0 && formalBases.length === 0) {
      return "aucun polo ou chemise disponible (les t-shirts sont interdits pour ce style)";
    }
    if (pulls.length === 0) {
      return "aucun pull disponible";
    }
  } else {
    if (pulls.length === 0 && hoodies.length === 0) {
      return "aucun pull ou hoodie disponible";
    }
    if (pulls.length === 0 && hoodies.length > 0 && tshirts.length === 0) {
      return "aucun pull disponible (un hoodie exige un t-shirt dessous)";
    }
    if (robes.length === 0 && bases.length === 0) {
      return "un t-shirt, un polo ou une chemise";
    }
  }

  if (robes.length === 0 && bas.length === 0) {
    return "un pantalon, un jean ou une jupe";
  }

  return null;
}

/**
 * Vérifie si une garde-robe possède les éléments nécessaires pour composer au moins une tenue valide.
 * Si non, identifie précisément la pièce manquante.
 *
 * @param {Array} clothes
 * @param {string} [style="casual"]
 * @returns {{ canCompose: boolean, missingSlots: string[], message: string|null }}
 */
export function checkWardrobeCompleteness(clothes, style = "casual") {
  if (!Array.isArray(clothes) || clothes.length === 0) {
    return {
      canCompose: false,
      missingSlots: [SLOTS.BASE, SLOTS.BAS, SLOTS.CHAUSSURES, SLOTS.COUCHE],
      message: "information manquante : garde-robe vide",
    };
  }

  const reason = explainMissingPieces(clothes, style);
  if (!reason) {
    return { canCompose: true, missingSlots: [], message: null };
  }

  const migrated = toGarmentCatalog(clothes);
  const availableSlots = new Set(migrated.map((piece) => piece.slot).filter(Boolean));
  const missing = [];
  if (!availableSlots.has(SLOTS.CHAUSSURES)) missing.push(SLOTS.CHAUSSURES);
  if (!availableSlots.has(SLOTS.COUCHE)) missing.push(SLOTS.COUCHE);
  const hasRobe = availableSlots.has(SLOTS.ROBE);
  if (!hasRobe && !availableSlots.has(SLOTS.BASE)) missing.push(SLOTS.BASE);
  if (!hasRobe && !availableSlots.has(SLOTS.BAS)) missing.push(SLOTS.BAS);

  return {
    canCompose: false,
    missingSlots: [...new Set(missing)],
    message: `information manquante : ${reason}`,
  };
}

/**
 * Résout les références de pièces d'une tenue renvoyée par l'agent
 * (IDs ou objets complets) vers les vêtements réels de la garde-robe.
 *
 * @param {object|Array} rawPieces
 * @param {Map<string, object>} byId
 * @returns {{ pieces: Array, error?: string }}
 */
function resolveTenuePieces(rawPieces, byId) {
  if (!rawPieces) {
    return { pieces: [], error: "information manquante : aucune pièce dans la tenue" };
  }

  const references = [];
  if (Array.isArray(rawPieces)) {
    references.push(...rawPieces);
  } else if (typeof rawPieces === "object") {
    ["base", "couche", "veste", "bas", "robe", "chaussures"].forEach((slot) => {
      if (rawPieces[slot]) references.push(rawPieces[slot]);
    });
    if (Array.isArray(rawPieces.accessoires)) references.push(...rawPieces.accessoires);
  }

  if (references.length === 0) {
    return { pieces: [], error: "information manquante : aucune pièce dans la tenue" };
  }

  const pieces = [];
  for (const reference of references) {
    if (typeof reference === "string") {
      const found = byId.get(String(reference));
      if (!found) {
        return { pieces: [], error: `information manquante : pièce introuvable (${reference})` };
      }
      pieces.push(found);
      continue;
    }
    if (reference && typeof reference === "object") {
      if (reference.id != null && byId.has(String(reference.id))) {
        pieces.push(byId.get(String(reference.id)));
      } else if (reference.name) {
        pieces.push(migrateGarment(reference));
      } else {
        return { pieces: [], error: "information manquante : référence de pièce invalide" };
      }
      continue;
    }
    return { pieces: [], error: "information manquante : référence de pièce invalide" };
  }

  return { pieces };
}

/**
 * Validation déterministe de la réponse de l'IA, APRÈS sa génération.
 * Chaque tenue est résolue contre la garde-robe réelle, corrigée si possible,
 * puis revalidée. Une tenue invalide n'est jamais retournée dans `outfits`.
 *
 * @param {object|Array|string} response
 * @param {Array} wardrobe
 * @param {object} [options={}]
 * @returns {{ ok: boolean, outfits: Array, rejected: Array, message: string|null }}
 */
export function validateMatcherResponse(response, wardrobe, options = {}) {
  let payload = response;
  if (typeof response === "string") {
    try {
      payload = JSON.parse(response);
    } catch {
      return {
        ok: false,
        outfits: [],
        rejected: [],
        message: "information manquante : réponse de l'agent en JSON invalide",
      };
    }
  }

  const tenues = Array.isArray(payload) ? payload : payload?.tenues;
  if (!Array.isArray(tenues) || tenues.length === 0) {
    return {
      ok: false,
      outfits: [],
      rejected: [],
      message: "information manquante : aucune tenue dans la réponse de l'agent",
    };
  }

  const catalog = toGarmentCatalog(wardrobe);
  const byId = new Map(catalog.filter((piece) => piece.id != null).map((piece) => [String(piece.id), piece]));
  const outfits = [];
  const rejected = [];

  tenues.forEach((tenue, index) => {
    const style = tenue?.style || options.style || "casual";
    const weather = tenue?.weather ?? options.weather ?? null;
    const resolved = resolveTenuePieces(tenue?.pieces, byId);
    if (resolved.error) {
      rejected.push({ index, jour: tenue?.jour || null, style, message: resolved.error });
      return;
    }

    const candidate = { ...tenue, style, weather, pieces: resolved.pieces };
    const repaired = repairOutfitWithWardrobe(candidate, catalog, style, weather);
    if (!repaired) {
      rejected.push({
        index,
        jour: tenue?.jour || null,
        style,
        message:
          explainMissingPieces(catalog.length ? catalog : resolved.pieces, style) ||
          "aucune combinaison valide avec les vêtements disponibles",
      });
      return;
    }

    const validation = validateOutfit(repaired, style, weather);
    if (!validation.isValid) {
      rejected.push({
        index,
        jour: tenue?.jour || null,
        style,
        message: validation.errors[0] || "tenue invalide",
      });
      return;
    }

    const beforeIds = resolved.pieces.map((piece) => piece.id).join("|");
    const afterIds = repaired.pieces.map((piece) => piece.id).join("|");
    outfits.push({ ...repaired, repaired: beforeIds !== afterIds || resolved.pieces.length !== repaired.pieces.length });
  });

  return {
    ok: rejected.length === 0 && outfits.length > 0,
    outfits,
    rejected,
    message: rejected.length > 0 ? rejected[0].message : null,
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
   - Formule classique : 1 BASE (t-shirt, polo, chemise, debardeur) + 1 BAS (pantalon, jean, jupe, short) + 1 CHAUSSURES + 1 COUCHE CHAUDE OBLIGATOIRE (pull ou hoodie) (+ optionnellement 1 VESTE, 0 à 3 ACCESSOIRE).
   - Formule robe : 1 ROBE + 1 CHAUSSURES + 1 PULL OBLIGATOIRE (JAMAIS de hoodie sur une robe, JAMAIS de pièce BAS sous une robe).
3. RÈGLE DE LA COUCHE CHAUDE : chaque tenue doit contenir un pull ou un hoodie, sans exception, même par temps chaud. Un sweat ou un gilet ne suffit pas.
4. RÈGLE DU HOODIE : un hoodie ne se porte QUE par-dessus un t-shirt. Un hoodie ne peut jamais être associé à un polo ou à une chemise (ni à un débardeur ou une robe). Un hoodie à motif peut se superposer à un t-shirt à motif.
5. RÈGLE DU PULL : un pull est compatible avec une chemise, un polo ou un t-shirt (et avec une robe).
6. RÈGLE DES COUCHES : une pièce de slot COUCHE ou VESTE (veste, manteau) ne se porte JAMAIS seule : une pièce de slot BASE est OBLIGATOIRE dessous.
7. MÉTÉO :
   - Par temps froid (< 16 °C) : une VESTE (manteau) est recommandée si elle est disponible, mais la couche chaude pull/hoodie reste obligatoire.
   - Par temps de pluie (>= 40 %) : privilégie une veste ou un manteau imperméable et évite daim/toile.
   - Par temps chaud (> 24 °C) : le pull ou le hoodie reste obligatoire ; choisis une matière légère si possible.
8. RÈGLE DE LA CRAVATE : Une cravate ou un nœud papillon se porte UNIQUEMENT avec une CHEMISE (jamais avec t-shirt, polo, sweat ou hoodie) et EXCLUSIVEMENT pour le style 'Chic'.
9. RÈGLE D'UNICITÉ : Un seul élément par slot, sauf ACCESSOIRE (maximum 3). Aucun vêtement de type 'autre'.
10. STYLE CHIC STRICT : En Chic, jamais de t-shirt : utilise une chemise ou un polo. La couche chaude est TOUJOURS un pull, jamais un hoodie. Utilise des chaussures habillées. S'il manque une pièce, indique précisément « aucun pull disponible » ou « aucun polo ou chemise disponible » ; ne remplace jamais le style Chic par « Chic décontracté ».
11. MINIMALISTE : hérite de Chic (chemise ou polo, pull, jamais de t-shirt, jamais de hoodie) mais sans cravate, nœud papillon ni fioritures.
12. Tu ne choisis QUE des IDs existants fournis. N'invente JAMAIS d'ID ni de vêtement.
13. Toute donnée absente ou composition impossible : "information manquante : [pièce précise manquante]".

EXEMPLES VALIDES (tirés des tests) :
- Exemple 1 (Chic) : chemise blanche [BASE] + pull beige [COUCHE] + pantalon marine [BAS] + mocassins noirs [CHAUSSURES] + manteau gris [VESTE] -> Valide
- Exemple 2 (Minimaliste) : polo marine [BASE] + pull gris [COUCHE] + jupe noire [BAS] + baskets blanches [CHAUSSURES] -> Valide (niveau_assouplissement: 0)
- Exemple 3 (Casual) : t-shirt blanc [BASE] + hoodie noir [COUCHE] + jean brut [BAS] + baskets blanches [CHAUSSURES] -> Valide (niveau_assouplissement: 0)
- Exemple 4 (Robe) : robe noire [ROBE] + pull beige [COUCHE] + mocassins noirs [CHAUSSURES] -> Valide

EXEMPLES INVALIDES (tirés des tests) :
- Invalide 1 : t-shirt blanc + jean + baskets -> REJETÉ : aucune couche chaude (il manque un pull ou un hoodie).
- Invalide 2 : polo bleu marine + hoodie noir + jean + baskets -> REJETÉ : hoodie avec polo (un hoodie exige un t-shirt dessous).
- Invalide 3 : chemise blanche + hoodie noir + jean + mocassins -> REJETÉ : hoodie avec chemise.
- Invalide 4 (Chic) : t-shirt blanc + pull beige + jean + mocassins -> REJETÉ : t-shirt en Chic (chemise ou polo obligatoire).
- Invalide 5 (Chic) : chemise blanche + hoodie noir + jean + mocassins -> REJETÉ : hoodie en Chic (pull obligatoire).

FORMAT DE RÉPONSE EXCLUSIF (JSON STRICT VALIDE SANS TEXTE AVANT NI APRÈS) :
{
  "tenues": [
    {
      "jour": "Lundi",
      "style": "Chic",
      "pieces": {
        "base": "id_existant",
        "couche": "id_existant",
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
