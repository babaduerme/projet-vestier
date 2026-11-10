// Catalogue de styles piloté par les données
// Chaque style possède un ID normalisé (slug minuscule, sans accent) et les règles de composition utilisées par le moteur de génération.
export const styles = [
  {
    id: "casual",
    label: "Casual",
    aliases: [],
    extends: null,
    allow: {
      categories: ["top", "bottom", "layer", "coat", "shoes"],
      keywords: [],
      motifs: "libre",
      colors: "libre",
    },
    exclude: {
      categories: [],
      keywords: ["cravate", "costume"],
      colors: [],
    },
    prefer: {},
    constraints: {},
  },
  {
    id: "chic",
    label: "Chic",
    aliases: [],
    extends: null,
    allow: {
      categories: ["top", "bottom", "layer", "coat", "shoes"],
      keywords: [],
      motifs: "libre",
      colors: "libre",
    },
    exclude: {
      categories: [],
      keywords: [],
      colors: [],
    },
    prefer: {},
    constraints: {},
  },
  {
    id: "minimaliste",
    label: "Minimaliste",
    aliases: [],
    extends: "chic",
    allow: {
      categories: ["top", "bottom", "layer", "coat", "shoes"],
      keywords: [],
      motifs: "aucun",
      colors: "neutre",
    },
    exclude: {
      categories: [],
      keywords: ["cravate", "noeud-papillon", "pochette", "bretelles", "gilet"],
      colors: [],
    },
    prefer: {},
    constraints: {},
  },
  {
    id: "rock",
    label: "Rock",
    aliases: [],
    extends: null,
    allow: {
      categories: ["top", "bottom", "layer", "coat", "shoes"],
      keywords: [],
      motifs: "libre",
      colors: "libre",
    },
    exclude: {
      categories: [],
      keywords: ["chemise", "cravate", "blazer", "costume"],
      colors: [],
    },
    prefer: {
      // Priorité aux vêtements à motifs métal ou groupes musicaux
      keywords: ["metal", "metallic", "group", "logo", "graphic"],
    },
    constraints: {},
  },
  {
    id: "streetwear",
    label: "Streetwear",
    aliases: [],
    extends: null,
    allow: {
      categories: ["top", "bottom", "layer", "coat", "shoes"],
      keywords: [],
      motifs: "libre",
      colors: "libre",
    },
    exclude: {},
    prefer: {},
    constraints: {},
  },
];
