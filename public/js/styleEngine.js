// styleEngine.js – logique pure du catalogue de styles
// Aucun accès au DOM, uniquement des fonctions testables.
import { styles } from "./styles.config.js";

/**
 * Résout un identifiant ou un alias vers le style complet.
 * Retourne le style object ou `null` si non trouvé.
 */
export function resolveStyle(idOrAlias) {
  const norm = idOrAlias?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!norm) return null;
  // recherche directe
  let style = styles.find(s => s.id === norm);
  if (style) return style;
  // recherche alias
  style = styles.find(s => (s.aliases || []).includes(norm));
  return style || null;
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

/**
 * Filtre la garde‑robe selon les règles d'un style.
 * Retourne un tableau de pièces admissibles.
 * Applique deux passes : stricte puis assouplie (score).
 */
export function filterWardrobe(wardrobe, style) {
  if (!style) return [];
  const allowed = new Set(style.allow?.categories || []);
  const excludedKeywords = new Set(style.exclude?.keywords || []);

  // première passe stricte
  const strict = wardrobe.filter(p => {
    const cat = normalizeCategory(p);
    if (!allowed.has(cat)) return false;
    const lower = (p.name || "").toLowerCase();
    for (const kw of excludedKeywords) {
      if (lower.includes(kw)) return false;
    }
    return true;
  });

  if (strict.length > 0) return strict;

  // passe assouplie – on garde les pièces même si un mot‑clé exclu apparaît, mais on leur applique un malus de score.
  // Ici on renvoie simplement tout ce qui correspond à une catégorie autorisée.
  return wardrobe.filter(p => allowed.has(normalizeCategory(p)));
}

/**
 * Vérifie la présence des pièces obligatoires pour une tenue.
 * Retourne { missing: [], reason: string }
 */
export function missingMandatoryPieces(selection) {
  const hasTop = selection.some(p => {
    const cat = normalizeCategory(p);
    // any top counts as base top for all styles
    return cat === "top";
  });
  const hasBottom = selection.some(p => {
    const cat = normalizeCategory(p);
    return cat === "bottom" || cat === "dress";
  });
  const missing = [];
  if (!hasTop) missing.push("haut de base");
  if (!hasBottom) missing.push("bas");
  const reason = missing.length ? `il manque ${missing.join(' et ')}` : "";
  return { missing, reason };
}
  const hasTop = selection.some(p => {
    const cat = normalizeCategory(p);
    return cat === "top" && ["tshirt","polo","chemise"].some(k => (p.name || "").toLowerCase().includes(k));
  });
  const hasBottom = selection.some(p => {
    const cat = normalizeCategory(p);
    return cat === "bottom" || cat === "dress";
  });
  const missing = [];
  if (!hasTop) missing.push("haut de base");
  if (!hasBottom) missing.push("bas");
  const reason = missing.length ? `il manque ${missing.join(' et ')}` : "";
  return { missing, reason };
}

/**
 * Score d'une pièce pour un style (simple). Plus le score est haut, plus la pièce est prioritaire.
 */
export function scorePiece(piece, style) {
  let score = 0;
  const lower = (piece.name || "").toLowerCase();
  // préférences définies dans style.prefer.keywords
  if (style.prefer?.keywords) {
    for (const kw of style.prefer.keywords) {
      if (lower.includes(kw)) score += 2;
    }
  }
  // pénalités pour motifs interdits (style.constraints.motifs)
  if (style.constraints?.motifs === "aucun" && /logo|print|graphic|motif/.test(lower)) {
    score -= 2;
  }
  return score;
}

/**
 * Sélectionne les pièces les plus appropriées pour composer une tenue.
 * Simple heuristique : on garde le top prioritaire, un bottom, un layer si présent, un coat selon météo, des shoes.
 */
export function composeOutfit(filteredWardrobe, style, weather) {
  // Trier par score décroissant (préférences de style)
  const sorted = filteredWardrobe.slice().sort((a, b) => scorePiece(b, style) - scorePiece(a, style));
  const outfit = [];

  // ---------- Top de base (t‑shirt / polo / chemise) ----------
  const baseTopCandidates = sorted.filter(p =>
    normalizeCategory(p) === "top" && /t[- ]?shirt|polo|chemise/.test(p.name.toLowerCase())
  );
  // Priorité : t‑shirt > polo > chemise
  const baseTop = baseTopCandidates.find(p => /t[- ]?shirt/.test(p.name.toLowerCase()))
    || baseTopCandidates.find(p => /polo/.test(p.name.toLowerCase()))
    || baseTopCandidates.find(p => /chemise/.test(p.name.toLowerCase()));
  if (baseTop) outfit.push(baseTop);

  // ---------- Layer (pull ou hoodie) ----------
  // Recherche du meilleur layer compatible avec le top choisi
  if (baseTop) {
    const isTshirt = /t[- ]?shirt/.test(baseTop.name.toLowerCase());
    const layerCandidates = sorted.filter(p => normalizeCategory(p) === "layer");
    // Si le top est un t‑shirt, on accepte pull ou hoodie. Sinon, uniquement pull.
    const compatibleLayer = layerCandidates.find(p => {
      const name = p.name.toLowerCase();
      const isHoodie = /hoodie|sweat|sweatshirt/.test(name);
      const isPull = /pull/.test(name);
      if (isTshirt) return isPull || isHoodie;
      // polo ou chemise : seulement pull
      return isPull;
    });
    if (compatibleLayer) outfit.push(compatibleLayer);
  }

  // ---------- Veste / manteau selon météo ----------
  if (weather && weather.type === "rain" && sorted.some(p => /impermeable|parka|doudoune/.test(p.name.toLowerCase()))) {
    const coat = sorted.find(p => /impermeable|parka|doudoune/.test(p.name.toLowerCase()));
    if (coat) outfit.push(coat);
  } else {
    const coat = sorted.find(p => normalizeCategory(p) === "coat");
    if (coat) outfit.push(coat);
  }

  // ---------- Bas ou robe ----------
  const bottom = sorted.find(p => ["bottom", "dress"].includes(normalizeCategory(p)));
  if (bottom) outfit.push(bottom);

  // ---------- Chaussures ----------
  const shoes = sorted.find(p => normalizeCategory(p) === "shoes");
  if (shoes) outfit.push(shoes);

  // ---------- Cravate (style chic ou soirée) ----------
  if (style.id === "chic" || style.id === "soiree") {
    const chemise = outfit.find(p => normalizeCategory(p) === "top" && /chemise/.test(p.name.toLowerCase()));
    if (chemise) {
      const tie = sorted.find(p => normalizeCategory(p) === "accessory" && /cravate|noeud[-]?papillon/.test(p.name.toLowerCase()));
      if (tie) outfit.push(tie);
    }
  }

  return outfit;
}
  // trier par score décroissant
  const sorted = filteredWardrobe.slice().sort((a, b) => scorePiece(b, style) - scorePiece(a, style));
  const outfit = [];
  // haut de base
  const top = sorted.find(p => normalizeCategory(p) === "top" && /t[- ]?shirt|polo|chemise/.test(p.name.toLowerCase()));
  if (top) outfit.push(top);
  // layer (pull/hoodie) – uniquement si top présent
  const layer = sorted.find(p => normalizeCategory(p) === "layer");
  if (layer && top) outfit.push(layer);
  // coat selon météo
  if (weather && weather.type === "rain" && sorted.some(p => /impermeable|parka|doudoune/.test(p.name.toLowerCase()))) {
    const coat = sorted.find(p => /impermeable|parka|doudoune/.test(p.name.toLowerCase()));
    if (coat) outfit.push(coat);
  } else {
    const coat = sorted.find(p => normalizeCategory(p) === "coat");
    if (coat) outfit.push(coat);
  }
  // bottom ou dress
  const bottom = sorted.find(p => ["bottom", "dress"].includes(normalizeCategory(p)));
  if (bottom) outfit.push(bottom);
  // shoes (exclure les chaussures formelles si style le désire – géré par filter)
  const shoes = sorted.find(p => normalizeCategory(p) === "shoes");
  if (shoes) outfit.push(shoes);
  // accessoire cravate – uniquement si chemise présente et style autorise
  if (style.id === "chic") {
    const chemise = outfit.find(p => normalizeCategory(p) === "top" && /chemise/.test(p.name.toLowerCase()));
    if (chemise) {
      const tie = sorted.find(p => normalizeCategory(p) === "accessory" && /cravate|noeud[-]?papillon/.test(p.name.toLowerCase()));
      if (tie) outfit.push(tie);
    }
  }
  return outfit;
}

export { styles };
