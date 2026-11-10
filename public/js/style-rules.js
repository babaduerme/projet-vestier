const STYLE_RULES = {
  // Five core styles – simplified from the original catalogue
  rock: {
    // Rock: pièces audacieuses, couleurs sombres ou vives, textures cuir/denim
    // Le pull est autorisé : la couche chaude obligatoire peut être un pull ou un hoodie.
    allowed: /t[- ]?shirt|tshirt|tee\b|d[ée]bardeur|hoodie|perfecto|cuir|veste|jean|pantalon|boots|bottine|basket|manteau|accessoire|m[ée]tal|metal|chaussure|pull|sweat/,
    forbidden: /chemise|polo|blazer|costume|pantalon de costume|cravate|mocassin|chaussure de ville|pastel/,
  },
  chic: {
    // Chic: chemises et polos uniquement, jamais de t-shirt. La couche chaude
    // est un pull (un hoodie exige un t-shirt, lui-même interdit).
    allowed: /robe|chemise|polo|blazer|pantalon|jupe|pull|chaussure|talon|mocassin|bijou|manteau|accessoire/,
    forbidden: /t[- ]?shirt|tshirt|tee\b|hoodie|jogging|short|sweat [àa] capuche|basket de sport|us[ée]/,
  },
  casual: {
    // Casual: pièces décontractées, polyvalentes
    allowed: /t[- ]?shirt|tshirt|tee\b|polo|sweat|pull|hoodie|chemise|jean|pantalon|chino|basket|robe|manteau|veste|accessoire|chaussure/,
    forbidden: /costume|cravate|chaussure de ville|tenue de soir[ée]e?/, 
  },
  streetwear: {
    // Streetwear: style urbain, sneakers, hoodies, vêtements oversize
    allowed: /hoodie|sweat|pull|t[- ]?shirt|tshirt|tee\b|oversize|cargo|jean|sneaker|basket|casquette|manteau|accessoire/,
    forbidden: /costume|cravate|chaussure de ville|chemise formelle/,
  },
  minimaliste: {
    // Minimaliste = Chic sans cravate, nœud papillon ni fioritures :
    // chemise ou polo, pull, jamais de t-shirt ni de hoodie.
    allowed: /chemise|polo|pull|pantalon|jean|robe|jupe|chaussure|manteau|accessoire/,
    forbidden: /t[- ]?shirt|tshirt|tee\b|hoodie|logo|paillettes|slogan|motif tr[ée]s vif/,
  },
};

// Color palettes for the five core styles
const STYLE_COLOR_PALETTES = {
  rock: new Set(["noir", "gris", "gris foncé", "bordeaux", "kaki", "blanc cassé"]),
  chic: new Set(["noir", "blanc", "bleu nuit", "rouge profond", "argent", "doré", "or"]),
  casual: new Set(["bleu", "gris", "beige", "blanc", "noir"]),
  streetwear: new Set(["noir", "gris", "blanc", "bleu", "rouge"]),
  minimaliste: new Set(["noir", "blanc", "gris", "beige", "camel"]),
};

function canonicalStyleKey(value) {
  const name = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return name;
}

export { STYLE_RULES, STYLE_COLOR_PALETTES, canonicalStyleKey };
