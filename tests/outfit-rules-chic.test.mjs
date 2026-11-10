import test from "node:test";
import assert from "node:assert/strict";
import {
  GARMENT_TYPES,
  SLOTS,
  migrateGarment,
  validateOutfit,
  resolveChicOutfit,
  checkWardrobeCompleteness,
  validateMatcherResponse,
  OUTFIT_MATCHER_PROMPT,
} from "../public/js/outfit-matcher.js";

const wardrobe = [
  { id: "tee", name: "t-shirt blanc", colors: "blanc" },
  { id: "tee-print", name: "t-shirt noir imprimé", colors: "noir" },
  { id: "polo", name: "polo bleu marine", colors: "bleu marine" },
  { id: "shirt", name: "chemise blanche", colors: "blanc" },
  { id: "pull", name: "pull beige", colors: "beige" },
  { id: "hoodie", name: "hoodie noir", colors: "noir" },
  { id: "jeans", name: "jean brut", colors: "bleu" },
  { id: "skirt", name: "jupe marron", colors: "marron" },
  { id: "sneakers", name: "baskets blanches", colors: "blanc" },
  { id: "loafers", name: "mocassins noirs", colors: "noir" },
  { id: "coat", name: "manteau gris", colors: "gris" },
  { id: "dress", name: "robe noire", colors: "noir" },
];

const pieces = Object.fromEntries(wardrobe.map((piece) => [piece.id, migrateGarment(piece)]));

function outfit(ids) {
  return ids.map((id) => pieces[id]);
}

test("une tenue sans pull ni hoodie est rejetée, même par temps chaud", () => {
  const result = validateOutfit(outfit(["tee", "jeans", "sneakers"]), "casual", { temp: 28 });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.toLowerCase().includes("pull") || error.toLowerCase().includes("hoodie")));
});

test("chaque tenue valide contient exactement une couche chaude pull ou hoodie", () => {
  assert.equal(validateOutfit(outfit(["tee", "pull", "jeans", "sneakers"]), "casual").isValid, true);
  assert.equal(validateOutfit(outfit(["tee", "hoodie", "jeans", "sneakers"]), "casual").isValid, true);
  assert.equal(validateOutfit(outfit(["polo", "pull", "jeans", "sneakers"]), "casual").isValid, true);
  assert.equal(validateOutfit(outfit(["shirt", "pull", "jeans", "sneakers"]), "casual").isValid, true);
});

test("un hoodie est interdit avec un polo ou une chemise", () => {
  const withPolo = validateOutfit(outfit(["polo", "hoodie", "jeans", "sneakers"]), "streetwear");
  const withShirt = validateOutfit(outfit(["shirt", "hoodie", "jeans", "sneakers"]), "casual");

  assert.equal(withPolo.isValid, false);
  assert.equal(withShirt.isValid, false);
  assert.ok(withPolo.errors.some((error) => error.toLowerCase().includes("hoodie")));
  assert.ok(withShirt.errors.some((error) => error.toLowerCase().includes("hoodie")));
});

test("Chic refuse les t-shirts et exige une chemise ou un polo avec un pull", () => {
  const tshirt = validateOutfit(outfit(["tee", "pull", "jeans", "loafers"]), "chic");
  assert.equal(tshirt.isValid, false);
  assert.ok(tshirt.errors.some((error) => error.toLowerCase().includes("t-shirt")));

  assert.equal(validateOutfit(outfit(["shirt", "pull", "jeans", "loafers"]), "chic").isValid, true);
  assert.equal(validateOutfit(outfit(["polo", "pull", "jeans", "loafers"]), "chic").isValid, true);
});

test("Chic refuse le hoodie, y compris au-dessus d'un t-shirt", () => {
  const hoodieWithTshirt = validateOutfit(outfit(["tee", "hoodie", "jeans", "loafers"]), "chic");
  assert.equal(hoodieWithTshirt.isValid, false);
  assert.ok(hoodieWithTshirt.errors.some((error) => error.toLowerCase().includes("pull")));

  const hoodieWithShirt = validateOutfit(outfit(["shirt", "hoodie", "jeans", "loafers"]), "chic");
  assert.equal(hoodieWithShirt.isValid, false);
});

test("Minimaliste hérite de l'interdiction des t-shirts et du hoodie", () => {
  const tshirt = validateOutfit(outfit(["tee", "pull", "jeans", "sneakers"]), "minimaliste");
  assert.equal(tshirt.isValid, false);
  assert.ok(tshirt.errors.some((error) => error.toLowerCase().includes("t-shirt")));

  assert.equal(validateOutfit(outfit(["shirt", "pull", "jeans", "sneakers"]), "minimaliste").isValid, true);
  assert.equal(validateOutfit(outfit(["polo", "pull", "jeans", "sneakers"]), "minimaliste").isValid, true);
  assert.equal(validateOutfit(outfit(["tee", "hoodie", "jeans", "sneakers"]), "minimaliste").isValid, false);
  assert.equal(validateOutfit(outfit(["shirt", "hoodie", "jeans", "sneakers"]), "minimaliste").isValid, false);
});

test("une robe se porte avec un pull, jamais avec un hoodie", () => {
  assert.equal(validateOutfit(outfit(["dress", "pull", "loafers"]), "chic").isValid, true);
  const hoodie = validateOutfit(outfit(["dress", "hoodie", "loafers"]), "chic");
  assert.equal(hoodie.isValid, false);
});

test("resolveChicOutfit ne retourne jamais de t-shirt ni de hoodie", () => {
  const formalWardrobe = wardrobe.filter((piece) => piece.id !== "shirt");
  const res = resolveChicOutfit(formalWardrobe, { weather: { min: 14, max: 20 } });
  assert.equal(res.success, true);
  assert.ok(res.pieces.some((piece) => piece.type === GARMENT_TYPES.PULL));
  assert.ok(!res.pieces.some((piece) => piece.type === GARMENT_TYPES.HOODIE));
  assert.ok(!res.pieces.some((piece) => piece.type === GARMENT_TYPES.TSHIRT));
  assert.ok(res.pieces.some((piece) => piece.type === GARMENT_TYPES.POLO));
});

test("resolveChicOutfit signale précisément l'absence de chemise ou polo", () => {
  const noFormalBase = wardrobe.filter(
    (piece) => !["shirt", "polo", "dress"].includes(piece.id),
  );
  const res = resolveChicOutfit(noFormalBase, { weather: { min: 14, max: 20 } });
  assert.equal(res.success, false);
  assert.match(res.message, /aucun (polo|chemise)|aucune chemise|polo ou chemise/i);
});

test("resolveChicOutfit signale précisément l'absence de pull quand seul un hoodie existe", () => {
  const hoodieOnly = wardrobe.filter((piece) => piece.id !== "pull");
  const res = resolveChicOutfit(hoodieOnly, { weather: { min: 14, max: 20 } });
  assert.equal(res.success, false);
  assert.match(res.message, /aucun pull disponible/i);
});

test("resolveChicOutfit gère Minimaliste sans cravate ni hoodie", () => {
  const res = resolveChicOutfit(wardrobe, { style: "minimaliste", weather: { min: 14, max: 20 } });
  assert.equal(res.success, true);
  assert.equal(res.style, "Minimaliste");
  assert.ok(res.pieces.some((piece) => piece.type === GARMENT_TYPES.PULL));
  assert.ok(!res.pieces.some((piece) => piece.type === GARMENT_TYPES.HOODIE));
  assert.ok(!res.pieces.some((piece) => piece.type === GARMENT_TYPES.TSHIRT));
  assert.ok(!res.pieces.some((piece) => piece.type === GARMENT_TYPES.CRAVATE));
  assert.ok(!res.pieces.some((piece) => piece.type === GARMENT_TYPES.NOEUD_PAPILLON));
});

test("la réponse de l'IA est corrigée ou rejetée, jamais affichée invalide", () => {
  const response = {
    tenues: [
      {
        jour: "Lundi",
        style: "Chic",
        pieces: { base: "tee", couche: "hoodie", bas: "jeans", chaussures: "loafers" },
        justification: "tenue proposée par l'IA",
      },
      {
        jour: "Mardi",
        style: "Chic",
        pieces: { base: "shirt", couche: "pull", bas: "jeans", chaussures: "loafers" },
        justification: "tenue valide",
      },
    ],
  };

  const result = validateMatcherResponse(response, wardrobe);
  assert.equal(result.ok, true);
  assert.equal(result.outfits.length, 2);
  assert.equal(result.rejected.length, 0);

  for (const corrected of result.outfits) {
    assert.equal(validateOutfit(corrected, corrected.style, corrected.weather).isValid, true);
    assert.notEqual(
      corrected.pieces.find((piece) => piece.slot === SLOTS.BASE).type,
      GARMENT_TYPES.TSHIRT,
    );
    assert.notEqual(
      corrected.pieces.find((piece) => piece.slot === SLOTS.COUCHE).type,
      GARMENT_TYPES.HOODIE,
    );
  }
});

test("une tenue IA impossible à corriger est rejetée avec un message précis", () => {
  const limitedWardrobe = wardrobe.filter((piece) =>
    ["tee", "hoodie", "jeans", "loafers"].includes(piece.id),
  );
  const result = validateMatcherResponse(
    {
      tenues: [
        {
          jour: "Lundi",
          style: "Chic",
          pieces: { base: "tee", couche: "hoodie", bas: "jeans", chaussures: "loafers" },
        },
      ],
    },
    limitedWardrobe,
  );

  assert.equal(result.ok, false);
  assert.equal(result.outfits.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.match(result.rejected[0].message, /aucun (polo|chemise|pull)|t-shirt/i);
});

test("le prompt impose la couche chaude et le Chic sans t-shirt", () => {
  assert.match(OUTFIT_MATCHER_PROMPT, /pull ou un hoodie/i);
  assert.match(OUTFIT_MATCHER_PROMPT, /Chic[\s\S]*jamais de t-shirt|jamais de t-shirt[\s\S]*Chic/i);
  assert.match(OUTFIT_MATCHER_PROMPT, /hoodie[\s\S]*t-shirt/i);
});

test("un sweat ne remplace pas un pull ou un hoodie et peut être corrigé", () => {
  const sweatWardrobe = [
    ...wardrobe,
    { id: "sweat", name: "sweat gris", colors: "gris" },
  ];
  const sweatOnly = validateOutfit(
    [
      migrateGarment({ id: "tee", name: "t-shirt blanc" }),
      migrateGarment({ id: "sweat", name: "sweat gris" }),
      migrateGarment({ id: "jeans", name: "jean brut" }),
      migrateGarment({ id: "sneakers", name: "baskets blanches" }),
    ],
    "casual",
  );
  assert.equal(sweatOnly.isValid, false);

  const result = validateMatcherResponse(
    {
      tenues: [
        {
          jour: "Lundi",
          style: "Casual",
          pieces: { base: "tee", couche: "sweat", bas: "jeans", chaussures: "sneakers" },
        },
      ],
    },
    sweatWardrobe,
  );
  assert.equal(result.ok, true);
  assert.equal(result.outfits[0].pieces.find((piece) => piece.slot === SLOTS.COUCHE).type, GARMENT_TYPES.PULL);
});

test("avoidIds ne rend jamais la couche chaude ou les chaussures indispensables indisponibles", () => {
  const res = resolveChicOutfit(wardrobe, {
    weather: { min: 14, max: 20 },
    avoidIds: new Set(["shirt", "polo", "pull", "loafers"]),
  });
  assert.equal(res.success, true);
  assert.ok(res.pieces.some((piece) => piece.type === GARMENT_TYPES.PULL));
  assert.ok(res.pieces.some((piece) => piece.type === GARMENT_TYPES.CHEMISE || piece.type === GARMENT_TYPES.POLO));
});

test("la garde-robe signale précisément l'absence de pull ou de hoodie", () => {
  const completeness = checkWardrobeCompleteness(
    [
      { id: "tee", name: "t-shirt blanc" },
      { id: "jeans", name: "jean brut" },
      { id: "sneakers", name: "baskets blanches" },
    ],
    "casual",
  );
  assert.equal(completeness.canCompose, false);
  assert.match(completeness.message, /aucun pull ou hoodie disponible/i);
});

test("une tenue IA sans base est corrigée avec une chemise ou un polo", () => {
  const result = validateMatcherResponse(
    {
      tenues: [
        {
          jour: "Lundi",
          style: "Chic",
          pieces: { couche: "pull", bas: "jeans", chaussures: "loafers" },
        },
      ],
    },
    wardrobe,
  );
  assert.equal(result.ok, true);
  assert.ok(
    [GARMENT_TYPES.CHEMISE, GARMENT_TYPES.POLO].includes(
      result.outfits[0].pieces.find((piece) => piece.slot === SLOTS.BASE).type,
    ),
  );
  assert.equal(result.outfits[0].pieces.find((piece) => piece.slot === SLOTS.COUCHE).type, GARMENT_TYPES.PULL);
});

test("resolveChicOutfit ajoute un blouson quand il fait froid", () => {
  const coldWardrobe = [
    ...wardrobe,
    { id: "blouson", name: "blouson noir", category: "manteau", colors: "noir" },
  ];
  const res = resolveChicOutfit(coldWardrobe, { weather: { min: 3, max: 8 } });
  assert.equal(res.success, true);
  assert.ok(res.pieces.some((piece) => piece.slot === SLOTS.VESTE));
  assert.ok(res.pieces.some((piece) => piece.type === GARMENT_TYPES.VESTE || piece.type === GARMENT_TYPES.MANTEAU));
});

test("Streetwear refuse les polos et les chemises comme base", () => {
  const withPolo = validateOutfit(outfit(["polo", "pull", "jeans", "sneakers"]), "streetwear");
  assert.equal(withPolo.isValid, false);
  assert.ok(withPolo.errors.some((error) => error.toLowerCase().includes("polo")));

  const withShirt = validateOutfit(outfit(["shirt", "pull", "jeans", "sneakers"]), "streetwear");
  assert.equal(withShirt.isValid, false);
  assert.ok(withShirt.errors.some((error) => error.toLowerCase().includes("chemise")));

  assert.equal(validateOutfit(outfit(["tee", "pull", "jeans", "sneakers"]), "streetwear").isValid, true);
  assert.equal(validateOutfit(outfit(["tee", "hoodie", "jeans", "sneakers"]), "streetwear").isValid, true);
});

test("Streetwear corrige un polo en t-shirt et signale l'absence de t-shirt", () => {
  const corrected = validateMatcherResponse(
    {
      tenues: [
        {
          jour: "Lundi",
          style: "Streetwear",
          pieces: { base: "polo", couche: "pull", bas: "jeans", chaussures: "sneakers" },
        },
      ],
    },
    wardrobe,
  );
  assert.equal(corrected.ok, true);
  assert.equal(
    corrected.outfits[0].pieces.find((piece) => piece.slot === SLOTS.BASE).type,
    GARMENT_TYPES.TSHIRT,
  );

  const completeness = checkWardrobeCompleteness(
    [
      { id: "polo", name: "polo bleu marine", category: "haut" },
      { id: "pull", name: "pull beige", category: "haut" },
      { id: "jeans", name: "jean brut", category: "bas" },
      { id: "sneakers", name: "baskets blanches", category: "chaussures" },
    ],
    "streetwear",
  );
  assert.equal(completeness.canCompose, false);
  assert.match(completeness.message, /aucun t-shirt disponible/i);
});

test("Chic ajoute une cravate ou un nœud papillon avec une chemise", () => {
  const chicWardrobe = [
    ...wardrobe,
    { id: "tie", name: "cravate bleu marine", category: "accessoires", colors: "bleu marine" },
    { id: "bow", name: "nœud papillon noir", category: "accessoires", colors: "noir" },
  ];
  const res = resolveChicOutfit(chicWardrobe, { weather: { min: 14, max: 20 } });
  assert.equal(res.success, true);
  assert.ok(
    res.pieces.some(
      (piece) => piece.type === GARMENT_TYPES.CRAVATE || piece.type === GARMENT_TYPES.NOEUD_PAPILLON,
    ),
  );
  assert.equal(
    res.pieces.find((piece) => piece.slot === SLOTS.BASE).type,
    GARMENT_TYPES.CHEMISE,
  );
});

test("Chic n'ajoute pas de cravate avec un polo et Minimaliste n'en ajoute jamais", () => {
  const noShirt = wardrobe.filter((piece) => piece.id !== "shirt");
  const withTie = [
    ...noShirt,
    { id: "tie", name: "cravate bleu marine", category: "accessoires", colors: "bleu marine" },
  ];
  const chicPolo = resolveChicOutfit(withTie, { weather: { min: 14, max: 20 } });
  assert.equal(chicPolo.success, true);
  assert.equal(chicPolo.pieces.find((piece) => piece.slot === SLOTS.BASE).type, GARMENT_TYPES.POLO);
  assert.ok(!chicPolo.pieces.some((piece) => piece.type === GARMENT_TYPES.CRAVATE));

  const minimaliste = resolveChicOutfit(withTie, {
    style: "minimaliste",
    weather: { min: 14, max: 20 },
  });
  assert.equal(minimaliste.success, true);
  assert.ok(!minimaliste.pieces.some((piece) => piece.type === GARMENT_TYPES.CRAVATE));
});

test("une réponse IA absente ou illisible renvoie « information manquante »", () => {
  const invalidJson = validateMatcherResponse("ceci n'est pas du JSON", wardrobe);
  assert.equal(invalidJson.ok, false);
  assert.match(invalidJson.message, /information manquante/i);

  const empty = validateMatcherResponse({ tenues: [] }, wardrobe);
  assert.equal(empty.ok, false);
  assert.match(empty.message, /information manquante/i);

  const unknownPiece = validateMatcherResponse(
    {
      tenues: [
        {
          jour: "Lundi",
          style: "Casual",
          pieces: { base: "inconnu", couche: "pull", bas: "jeans", chaussures: "sneakers" },
        },
      ],
    },
    wardrobe,
  );
  assert.equal(unknownPiece.ok, false);
  assert.match(unknownPiece.rejected[0].message, /information manquante/i);
});

