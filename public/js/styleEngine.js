// styleEngine.js – logique pure du catalogue de styles
// Aucun accès au DOM, uniquement des fonctions testables.
import { styles } from "./styles.config.js";
import {
  GARMENT_TYPES,
  STREETWEAR_BASE_TYPES,
  detectGarmentType,
} from "./outfit-matcher.js";

function normalizeLabel(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Fusionne un style parent et son enfant (héritage `extends`).
 * Les exclusions sont cumulatives : Minimaliste hérite ainsi des interdictions
 * de Chic (t-shirt, hoodie) tout en ajoutant les siennes (cravate, etc.).
 */
function mergeStyles(parent, child) {
  return {
    ...parent,
    ...child,
    id: child.id,
    label: child.label,
    extends: child.extends,
    allow: {
      ...parent.allow,
      ...child.allow,
      categories: child.allow?.categories ?? parent.allow?.categories ?? [],
      keywords: [...new Set([...(parent.allow?.keywords || []), ...(child.allow?.keywords || [])])],
      motifs: child.allow?.motifs ?? parent.allow?.motifs,
      colors: child.allow?.colors ?? parent.allow?.colors,
    },
    exclude: {
      ...parent.exclude,
      ...child.exclude,
      categories: [
        ...new Set([
          ...(parent.exclude?.categories || []),
          ...(child.exclude?.categories || []),
        ]),
      ],
      keywords: [
        ...new Set([
          ...(parent.exclude?.keywords || []),
          ...(child.exclude?.keywords || []),
        ]),
      ],
      types: [
        ...new Set([
          ...(parent.exclude?.types || []),
          ...(child.exclude?.types || []),
        ]),
      ],
      colors: [
        ...new Set([
          ...(parent.exclude?.colors || []),
          ...(child.exclude?.colors || []),
        ]),
      ],
    },
    prefer: {
      ...parent.prefer,
      ...child.prefer,
      keywords: [
        ...new Set([...(parent.prefer?.keywords || []), ...(child.prefer?.keywords || [])]),
      ],
    },
    constraints: {
      ...parent.constraints,
      ...child.constraints,
    },
  };
}

function resolveStyleById(id, visited = new Set()) {
  const style = styles.find((candidate) => candidate.id === id);
  if (!style) return null;
  if (!style.extends || visited.has(style.id)) return style;
  const nextVisited = new Set([...visited, style.id]);
  const parent = resolveStyleById(style.extends, nextVisited);
  return parent ? mergeStyles(parent, style) : style;
}

/**
 * Résout un identifiant ou un alias vers le style complet, héritage compris.
 * Retourne le style object ou `null` si non trouvé.
 */
export function resolveStyle(idOrAlias) {
  const norm = normalizeLabel(idOrAlias);
  if (!norm) return null;
  // recherche directe
  const direct = styles.find((style) => style.id === norm);
  if (direct) return resolveStyleById(direct.id);
  // recherche alias
  const byAlias = styles.find((style) => (style.aliases || []).includes(norm));
  return byAlias ? resolveStyleById(byAlias.id) : null;
}

function resolveStyleObject(styleOrId) {
  if (!styleOrId) return null;
  if (typeof styleOrId === "string") return resolveStyle(styleOrId);
  if (styleOrId.id && styleOrId.extends) return resolveStyle(styleOrId.id) || styleOrId;
  return styleOrId;
}

/**
 * Normalise la catégorie d'une pièce de vêtement.
 * Fusionne les variantes (t‑shirt, tee‑shirt, tshirt) → "top"
 * bas, dress, coat, shoes, layer, accessory, etc.
 */
export function normalizeCategory(piece) {
  if (!piece) return null;
  const name = (piece.name || "").toString().toLowerCase();
  const category = (piece.category || "").toString().toLowerCase();
  const text = `${name} ${category}`;
  // top (t‑shirt, tee‑shirt, tshirt, polo, chemise, débardeur)
  if (/\b(t[- ]?shirt|tshirt|tee[- ]?shirt|tee|polo|chemise|debardeur|tank|top)\b/.test(text)) return "top";
  // bottom (pantalon, jean, short, short, jupe, skirt)
  if (/\b(pantalon|jean|short|bermuda|jupe|skirt|trousers)\b/.test(text)) return "bottom";
  // dress
  if (/\b(robe|dress)\b/.test(text)) return "dress";
  // layer (pull, sweater, hoodie, gilet)
  if (/\b(pull|sweater|maille|tricot|hoodie|sweat|sweatshirt|gilet)\b/.test(text)) return "layer";
  // coat (veste, blazer, manteau, parka, doudoune, bomber, perfecto)
  if (/\b(veste|blazer|manteau|parka|doudoune|bomber|coat|impermeable|jacket)\b/.test(text)) return "coat";
  // shoes (basket, sneaker, chaussure, bottes, bottine)
  if (/\b(basket|sneaker|chaussure|bottes?|boot)\b/.test(text)) return "shoes";
  // accessory (cravate, noeud[-]papillon, pochette, bretelles)
  if (/\b(cravate|noeud[-]?papillon|pochette|bretelles|accessoire)\b/.test(text)) return "accessory";
  return "other";
}

function isExcludedByKeyword(piece, excludedKeywords) {
  if (!excludedKeywords.length) return false;
  const text = normalizeLabel(`${piece?.name || ""} ${piece?.description || ""}`);
  return excludedKeywords.some((keyword) => text.includes(keyword));
}

/**
 * Filtre la garde‑robe selon les règles d'un style.
 * Applique les catégories autorisées ET les exclusions dures (mots-clés, types).
 * Contrairement à l'ancienne version, la passe assouplie ne réintroduit jamais
 * un vêtement explicitement exclu : elle ne servait qu'à faire passer les
 * t-shirts en Chic.
 */
export function filterWardrobe(wardrobe, style) {
  const resolved = resolveStyleObject(style);
  if (!resolved) return [];
  const allowed = new Set(resolved.allow?.categories || []);
  const excludedKeywords = (resolved.exclude?.keywords || []).map(normalizeLabel);
  const excludedTypes = new Set(resolved.exclude?.types || []);

  return (wardrobe || []).filter((piece) => {
    const category = normalizeCategory(piece);
    if (!allowed.has(category)) return false;
    const type = detectGarmentType(piece?.name, piece?.category);
    if (excludedTypes.has(type)) return false;
    if (isExcludedByKeyword(piece, excludedKeywords)) return false;
    return true;
  });
}

/**
 * Vérifie la présence des pièces obligatoires pour une tenue.
 * Retourne { missing: [], reason: string }
 */
export function missingMandatoryPieces(selection) {
  const hasTop = selection.some((piece) => {
    const cat = normalizeCategory(piece);
    return cat === "top";
  });
  const hasBottom = selection.some((piece) => {
    const cat = normalizeCategory(piece);
    return cat === "bottom" || cat === "dress";
  });
  const missing = [];
  if (!hasTop) missing.push("haut de base");
  if (!hasBottom) missing.push("bas");
  const reason = missing.length ? `il manque ${missing.join(" et ")}` : "";
  return { missing, reason };
}

/**
 * Score d'une pièce pour un style (simple). Plus le score est haut, plus la pièce est prioritaire.
 */
export function scorePiece(piece, style) {
  const resolved = resolveStyleObject(style);
  if (!resolved) return 0;
  let score = 0;
  const lower = normalizeLabel(`${piece?.name || ""} ${piece?.description || ""}`);
  const type = detectGarmentType(piece?.name, piece?.category);
  // préférences définies dans style.prefer.keywords
  if (resolved.prefer?.keywords) {
    for (const kw of resolved.prefer.keywords) {
      if (lower.includes(normalizeLabel(kw))) score += 2;
    }
  }
  // Les styles formels privilégient chemise / polo et pull.
  if (resolved.id === "chic" || resolved.id === "minimaliste") {
    if (type === GARMENT_TYPES.CHEMISE) score += 2;
    if (type === GARMENT_TYPES.POLO) score += 1;
    if (type === GARMENT_TYPES.PULL) score += 1;
  }
  // pénalités pour motifs interdits (style.constraints.motifs)
  if (resolved.constraints?.motifs === "aucun" && /logo|print|graphic|motif/.test(lower)) {
    score -= 2;
  }
  return score;
}

function isFormalStyleId(styleId) {
  return styleId === "chic" || styleId === "minimaliste";
}

/**
 * Sélectionne les pièces les plus appropriées pour composer une tenue.
 * La couche chaude (pull, ou hoodie sur t-shirt) est toujours ajoutée.
 */
export function composeOutfit(filteredWardrobe, style, weather) {
  const resolved = resolveStyleObject(style);
  if (!resolved) return [];
  const formal = isFormalStyleId(resolved.id);
  // Trier par score décroissant (préférences de style)
  const sorted = (filteredWardrobe || [])
    .slice()
    .sort((a, b) => scorePiece(b, resolved) - scorePiece(a, resolved));
  const outfit = [];

  // ---------- Top de base ----------
  const streetwear = resolved.id === "streetwear";
  const baseCandidates = sorted.filter((piece) => {
    const type = detectGarmentType(piece?.name, piece?.category);
    if (formal) return type === GARMENT_TYPES.CHEMISE || type === GARMENT_TYPES.POLO;
    if (streetwear) return STREETWEAR_BASE_TYPES.has(type);
    return [GARMENT_TYPES.TSHIRT, GARMENT_TYPES.POLO, GARMENT_TYPES.CHEMISE].includes(type);
  });
  const baseTop = formal
    ? baseCandidates.find((piece) => detectGarmentType(piece?.name, piece?.category) === GARMENT_TYPES.CHEMISE) ||
      baseCandidates.find((piece) => detectGarmentType(piece?.name, piece?.category) === GARMENT_TYPES.POLO) ||
      baseCandidates[0]
    : streetwear
      ? baseCandidates.find((piece) => detectGarmentType(piece?.name, piece?.category) === GARMENT_TYPES.TSHIRT) ||
        baseCandidates.find((piece) => detectGarmentType(piece?.name, piece?.category) === GARMENT_TYPES.DEBARDEUR) ||
        baseCandidates[0]
      : baseCandidates.find((piece) => detectGarmentType(piece?.name, piece?.category) === GARMENT_TYPES.TSHIRT) ||
        baseCandidates.find((piece) => detectGarmentType(piece?.name, piece?.category) === GARMENT_TYPES.POLO) ||
        baseCandidates.find((piece) => detectGarmentType(piece?.name, piece?.category) === GARMENT_TYPES.CHEMISE);

  if (baseTop) outfit.push(baseTop);

  // ---------- Couche chaude obligatoire (pull ou hoodie) ----------
  const baseType = baseTop ? detectGarmentType(baseTop?.name, baseTop?.category) : null;
  const layer = sorted.find((piece) => {
    const type = detectGarmentType(piece?.name, piece?.category);
    if (type !== GARMENT_TYPES.PULL && type !== GARMENT_TYPES.HOODIE) return false;
    if (formal && type !== GARMENT_TYPES.PULL) return false;
    if (type === GARMENT_TYPES.HOODIE) {
      return baseType === GARMENT_TYPES.TSHIRT;
    }
    return true;
  });
  if (layer && (baseTop || sorted.some((piece) => normalizeCategory(piece) === "dress"))) {
    outfit.push(layer);
  }

  // ---------- Veste / manteau selon météo ----------
  if (weather && weather.type === "rain" && sorted.some((p) => /impermeable|parka|doudoune/.test((p.name || "").toLowerCase()))) {
    const coat = sorted.find((p) => /impermeable|parka|doudoune/.test((p.name || "").toLowerCase()));
    if (coat) outfit.push(coat);
  } else {
    const coat = sorted.find((p) => normalizeCategory(p) === "coat");
    if (coat) outfit.push(coat);
  }

  // ---------- Bas ou robe ----------
  const bottom = sorted.find((p) => ["bottom", "dress"].includes(normalizeCategory(p)));
  if (bottom) outfit.push(bottom);

  // ---------- Chaussures ----------
  const shoes = sorted.find((p) => normalizeCategory(p) === "shoes");
  if (shoes) outfit.push(shoes);

  // ---------- Cravate (Chic uniquement, avec chemise) ----------
  if (resolved.id === "chic") {
    const chemise = outfit.find(
      (p) => normalizeCategory(p) === "top" && detectGarmentType(p?.name, p?.category) === GARMENT_TYPES.CHEMISE,
    );
    if (chemise) {
      const tie = sorted.find(
        (p) => normalizeCategory(p) === "accessory" && /cravate|noeud[-]?papillon/.test((p.name || "").toLowerCase()),
      );
      if (tie) outfit.push(tie);
    }
  }

  return outfit;
}

export { styles };
