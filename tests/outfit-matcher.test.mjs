import test from "node:test";
import assert from "node:assert/strict";
import {
  GARMENT_TYPES,
  SLOTS,
  TYPE_TO_SLOT,
  detectGarmentType,
  migrateGarment,
  scoreStyle,
  buildOutfit,
  normalizeGarmentSlot,
  resolveGarmentColors,
  validateOutfit,
  repairOrDiscardOutfit,
  resolveChicOutfit,
  checkWardrobeCompleteness,
  OUTFIT_MATCHER_PROMPT,
} from "../public/js/shared/outfit-matcher.js";

// ============================================================================
// DRESSING DE TEST OFFICIEL (ÉTAPE 2)
// 17 pièces sans chemise
// ============================================================================
const TEST_WARDROBE = [
  { id: "w1", name: "pull zippé bordeaux", colors: "bordeaux" },
  { id: "w2", name: "pull zippé beige", colors: "beige" },
  { id: "w3", name: "polo bleu marine", colors: "bleu marine" },
  { id: "w4", name: "t-shirt blanc", colors: "blanc" },
  { id: "w5", name: "t-shirt noir imprimé", colors: "noir" },
  { id: "w6", name: "hoodie noir", colors: "noir" },
  { id: "w7", name: "manteau gris", colors: "gris" },
  { id: "w8", name: "jupe marron plissée", colors: "marron" },
  { id: "w9", name: "pantalon vert kaki large", colors: "vert kaki" },
  { id: "w10", name: "robe verte", colors: "vert" },
  { id: "w11", name: "robe noire", colors: "noir" },
  { id: "w12", name: "baskets noir/rose", colors: "noir, rose" },
  { id: "w13", name: "baskets blanches", colors: "blanc" },
  { id: "w14", name: "nœud papillon gris", colors: "gris" },
  { id: "w15", name: "nœud papillon rouge", colors: "rouge" },
  { id: "w16", name: "cravate bleu marine", colors: "bleu marine" },
  { id: "w17", name: "sac en cuir noir", colors: "noir" },
];

const pieceMap = Object.fromEntries(
  TEST_WARDROBE.map((p) => [p.name, migrateGarment(p)]),
);

// ============================================================================
// ÉTAPE 1 — MODÈLE DE DONNÉES & MIGRATION (B1, B6)
// ============================================================================

test("ÉTAPE 1 : Déduction stricte de type et slot sur le dressing de test", () => {
  assert.equal(pieceMap["pull zippé bordeaux"].type, GARMENT_TYPES.PULL);
  assert.equal(pieceMap["pull zippé bordeaux"].slot, SLOTS.COUCHE);

  assert.equal(pieceMap["polo bleu marine"].type, GARMENT_TYPES.POLO);
  assert.equal(pieceMap["polo bleu marine"].slot, SLOTS.BASE);

  assert.equal(pieceMap["t-shirt blanc"].type, GARMENT_TYPES.TSHIRT);
  assert.equal(pieceMap["t-shirt blanc"].slot, SLOTS.BASE);

  assert.equal(pieceMap["hoodie noir"].type, GARMENT_TYPES.HOODIE);
  assert.equal(pieceMap["hoodie noir"].slot, SLOTS.COUCHE);

  assert.equal(pieceMap["manteau gris"].type, GARMENT_TYPES.MANTEAU);
  assert.equal(pieceMap["manteau gris"].slot, SLOTS.VESTE);

  assert.equal(pieceMap["jupe marron plissée"].type, GARMENT_TYPES.JUPE);
  assert.equal(pieceMap["jupe marron plissée"].slot, SLOTS.BAS);

  assert.equal(pieceMap["pantalon vert kaki large"].type, GARMENT_TYPES.PANTALON);
  assert.equal(pieceMap["pantalon vert kaki large"].slot, SLOTS.BAS);

  assert.equal(pieceMap["robe noire"].type, GARMENT_TYPES.ROBE);
  assert.equal(pieceMap["robe noire"].slot, SLOTS.ROBE);

  assert.equal(pieceMap["baskets blanches"].type, GARMENT_TYPES.BASKETS);
  assert.equal(pieceMap["baskets blanches"].slot, SLOTS.CHAUSSURES);

  assert.equal(pieceMap["nœud papillon rouge"].type, GARMENT_TYPES.NOEUD_PAPILLON);
  assert.equal(pieceMap["nœud papillon rouge"].slot, SLOTS.ACCESSOIRE);

  assert.equal(pieceMap["cravate bleu marine"].type, GARMENT_TYPES.CRAVATE);
  assert.equal(pieceMap["cravate bleu marine"].slot, SLOTS.ACCESSOIRE);

  assert.equal(pieceMap["sac en cuir noir"].type, GARMENT_TYPES.SAC);
  assert.equal(pieceMap["sac en cuir noir"].slot, SLOTS.ACCESSOIRE);
});

test("ÉTAPE 1 : Distinction pull vs t-shirt (corrige B1)", () => {
  const pull = migrateGarment({ name: "Pull col rond", category: "haut" });
  const tshirt = migrateGarment({ name: "T-shirt coton", category: "haut" });

  assert.equal(pull.type, GARMENT_TYPES.PULL);
  assert.equal(pull.slot, SLOTS.COUCHE);

  assert.equal(tshirt.type, GARMENT_TYPES.TSHIRT);
  assert.equal(tshirt.slot, SLOTS.BASE);

  assert.notEqual(pull.type, tshirt.type);
  assert.notEqual(pull.slot, tshirt.slot);
});

test("ÉTAPE 1 : Gestion des synonymes et des cas composés", () => {
  assert.equal(detectGarmentType("tee-shirt uni"), GARMENT_TYPES.TSHIRT);
  assert.equal(detectGarmentType("t shirt oversize"), GARMENT_TYPES.TSHIRT);
  assert.equal(detectGarmentType("pullover laine"), GARMENT_TYPES.PULL);
  assert.equal(detectGarmentType("sweater maille"), GARMENT_TYPES.PULL);
  assert.equal(detectGarmentType("veste en jean"), GARMENT_TYPES.VESTE); // priorité VESTE sur jean
  assert.equal(detectGarmentType("sneakers vintage"), GARMENT_TYPES.BASKETS);
  assert.equal(detectGarmentType("objet inconnu"), GARMENT_TYPES.AUTRE);
  assert.equal(TYPE_TO_SLOT[GARMENT_TYPES.AUTRE], null);
});

test("C2 : Les anciennes pièces haut sont résolues par leur nom", () => {
  const legacyPull = migrateGarment({ id: "legacy-pull", category: "haut", name: "Pull beige" });
  const legacyTshirt = migrateGarment({ id: "legacy-shirt", category: "haut", name: "T-shirt beige" });
  assert.equal(legacyPull.slot, SLOTS.COUCHE);
  assert.equal(legacyTshirt.slot, SLOTS.BASE);
});

test("C2 bis : un ancien blouson stocké en type 'autre' est reclassé en veste", () => {
  const legacyBlouson = migrateGarment({
    id: "legacy-blouson",
    name: "blouson noir",
    category: "manteau",
    type: "autre",
    slot: null,
  });
  assert.equal(legacyBlouson.type, GARMENT_TYPES.VESTE);
  assert.equal(legacyBlouson.slot, SLOTS.VESTE);
});

test("C3 : Le score de style classe sans éliminer les pièces sans tags", () => {
  assert.equal(scoreStyle({ type: GARMENT_TYPES.HOODIE, name: "hoodie noir" }, "rock"), 3);
  assert.ok(scoreStyle({ type: GARMENT_TYPES.TSHIRT, name: "t-shirt blanc" }, "casual") > 0);
  assert.equal(scoreStyle({ type: GARMENT_TYPES.TSHIRT, name: "t-shirt blanc" }, "chic"), 0);
});

test("ÉTAPE 1 : Contradiction nom vs couleur détectée (corrige B6)", () => {
  // Cas sans choix explicite utilisateur : le nom explicite prime, marqué 'incertain'
  const autoResolved = resolveGarmentColors({
    name: "T-shirt beige",
    detectedColor: "blanc",
  });
  assert.equal(autoResolved.colors, "beige");
  assert.equal(autoResolved.colorConfidence, "incertain");
  assert.equal(autoResolved.isContradictory, true);

  // Cas avec choix explicite utilisateur : le choix utilisateur est toujours préservé
  const userExplicit = resolveGarmentColors(
    { name: "T-shirt beige", detectedColor: "blanc" },
    "blanc",
  );
  assert.equal(userExplicit.colors, "blanc");
  assert.equal(userExplicit.colorConfidence, "confirme");
  assert.equal(userExplicit.isContradictory, false);
});

test("ÉTAPE 1 : La migration corrige la couleur persistée et respecte le choix utilisateur", () => {
  const migrated = migrateGarment({
    name: "T-shirt beige",
    category: "haut",
    colors: "blanc",
  });
  assert.equal(migrated.colors, "beige");
  assert.equal(migrated.colorConfidence, "incertain");
  assert.equal(migrated.isContradictory, true);

  const confirmed = migrateGarment({
    name: "T-shirt beige",
    category: "haut",
    colors: "blanc",
    colorSource: "user",
  });
  assert.equal(confirmed.colors, "blanc");
  assert.equal(confirmed.colorConfidence, "confirme");
  assert.equal(confirmed.isContradictory, false);
});

// ============================================================================
// ÉTAPE 2 — TESTS DU DRESSING (CAS REJETÉS ET ACCEPTÉS)
// ============================================================================

test("ÉTAPE 2 (REJET 1) : pull sans BASE (corrige B2)", () => {
  const outfit = [
    pieceMap["pull zippé beige"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
  ];
  const res = validateOutfit(outfit, "casual");
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some((e) => e.includes("BASE")));
});

test("ÉTAPE 2 (REJET 2) : t-shirt seul à 8 °C sans COUCHE ou VESTE (corrige B3)", () => {
  const outfit = [
    pieceMap["t-shirt blanc"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
  ];
  const res = validateOutfit(outfit, "casual", { temp: 8 });
  assert.equal(res.isValid, false);
  assert.ok(
    res.errors.some((e) => e.includes("< 12 °C") || e.includes("froid")),
    "Doit rejeter un t-shirt seul par temps froid sans couche ni veste",
  );

  // Plage 4-11 °C
  const resRange = validateOutfit(outfit, "casual", { min: 4, max: 11 });
  assert.equal(resRange.isValid, false);
  assert.ok(resRange.errors.some((e) => e.includes("< 12 °C") || e.includes("froid")));
});

test("ÉTAPE 2 (REJET) : un polo ne peut pas être associé à un hoodie", () => {
  const outfit = [
    pieceMap["polo bleu marine"],
    pieceMap["hoodie noir"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
  ];
  const res = validateOutfit(outfit, "streetwear");
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some((error) => error.includes("polo") && error.includes("hoodie")));
});

test("ÉTAPE 2 (REJET 3 & 4) : cravate ou nœud papillon sans chemise / avec t-shirt, polo, sweat", () => {
  // Cravate avec polo
  const tieWithPolo = [
    pieceMap["polo bleu marine"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
    pieceMap["cravate bleu marine"],
  ];
  const resPolo = validateOutfit(tieWithPolo, "chic");
  assert.equal(resPolo.isValid, false);
  assert.ok(resPolo.errors.some((e) => e.includes("CHEMISE")));

  // Nœud papillon avec t-shirt
  const bowWithTshirt = [
    pieceMap["t-shirt blanc"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
    pieceMap["nœud papillon gris"],
  ];
  const resBow = validateOutfit(bowWithTshirt, "chic");
  assert.equal(resBow.isValid, false);
  assert.ok(resBow.errors.some((e) => e.includes("CHEMISE")));

  // Cravate avec hoodie
  const tieWithHoodie = [
    pieceMap["t-shirt blanc"],
    pieceMap["hoodie noir"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
    pieceMap["cravate bleu marine"],
  ];
  const resHoodie = validateOutfit(tieWithHoodie, "chic");
  assert.equal(resHoodie.isValid, false);
  assert.ok(resHoodie.errors.some((e) => e.includes("CHEMISE")));
});

test("ÉTAPE 2 (REJET 5) : deux BAS", () => {
  const outfit = [
    pieceMap["t-shirt blanc"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["jupe marron plissée"],
    pieceMap["baskets blanches"],
  ];
  const res = validateOutfit(outfit, "casual");
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some((e) => e.includes("BAS")));
});

test("ÉTAPE 2 (REJET 6) : ROBE + BAS", () => {
  const outfit = [
    pieceMap["robe noire"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
  ];
  const res = validateOutfit(outfit, "casual");
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some((e) => e.includes("ROBE")));
});

test("ÉTAPE 2 (ACCEPTÉ 1) : polo marine + pull beige + pantalon kaki + baskets + manteau", () => {
  const outfit = [
    pieceMap["polo bleu marine"],
    pieceMap["pull zippé beige"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
    pieceMap["manteau gris"],
  ];
  const res = validateOutfit(outfit, "chic");
  assert.equal(res.isValid, true);
  assert.equal(res.errors.length, 0);
});

test("ÉTAPE 2 (ACCEPTÉ 2) : robe noire + pull beige + manteau gris + baskets noires", () => {
  const outfit = [
    pieceMap["robe noire"],
    pieceMap["pull zippé beige"],
    pieceMap["manteau gris"],
    pieceMap["baskets noir/rose"],
  ];
  const res = validateOutfit(outfit, "casual");
  assert.equal(res.isValid, true);
  assert.equal(res.errors.length, 0);
});

test("ÉTAPE 2 (ACCEPTÉ 3) : polo + pull beige + jupe marron + baskets (Minimaliste)", () => {
  const outfit = [
    pieceMap["polo bleu marine"],
    pieceMap["pull zippé beige"],
    pieceMap["jupe marron plissée"],
    pieceMap["baskets blanches"],
  ];
  const res = validateOutfit(outfit, "minimaliste");
  assert.equal(res.isValid, true);
  assert.equal(res.errors.length, 0);
});

// ============================================================================
// ÉTAPE 3 — VALIDATEUR DÉTERMINISTE UNIQUE (MÉTÉO, RESTRICTIONS)
// ============================================================================

test("ÉTAPE 3 : Temps chaud (> 24 °C) conserve la couche chaude obligatoire", () => {
  const hotOutfitWithSweater = [
    pieceMap["t-shirt blanc"],
    pieceMap["pull zippé beige"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
  ];
  const res = validateOutfit(hotOutfitWithSweater, "casual", { temp: 28 });
  assert.equal(res.isValid, true);
  assert.ok(!res.errors.some((e) => e.includes("> 24 °C") || e.includes("chaud")));

  const hotOutfitWithoutLayer = [
    pieceMap["t-shirt blanc"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
  ];
  const withoutLayer = validateOutfit(hotOutfitWithoutLayer, "casual", { temp: 28 });
  assert.equal(withoutLayer.isValid, false);
  assert.ok(withoutLayer.errors.some((e) => e.includes("pull") || e.includes("hoodie")));
});

test("C4 : La couche chaude est obligatoire ; une veste reste optionnelle", () => {
  const base = pieceMap["polo bleu marine"];
  const trousers = { id: "marine", name: "pantalon marine", type: GARMENT_TYPES.PANTALON, colors: "bleu marine" };
  const shoes = pieceMap["baskets blanches"];
  const layer = pieceMap["pull zippé beige"];
  const coat = pieceMap["manteau gris"];

  assert.equal(validateOutfit([base, trousers, shoes], "chic", { min: 8, max: 13, rain: 89 }).isValid, false);
  assert.equal(validateOutfit([base, layer, trousers, shoes], "chic", { min: 8, max: 13, rain: 89 }).isValid, true);
  assert.equal(validateOutfit([base, layer, trousers, shoes, coat], "chic", { min: 8, max: 13, rain: 89 }).isValid, true);
  assert.equal(validateOutfit([base, layer, trousers, shoes, coat], "rock", { min: 12, max: 18, rain: 78 }).isValid, true);
});

test("C1 : buildOutfit refuse toute tenue invalide et retourne une tenue complète", () => {
  const outfit = buildOutfit(
    [
      pieceMap["polo bleu marine"],
      pieceMap["pull zippé beige"],
      pieceMap["pantalon vert kaki large"],
      pieceMap["baskets blanches"],
    ],
    "minimaliste",
    { min: 16, max: 20, rain: 0 },
  );
  assert.ok(outfit);
  assert.equal(outfit.pieces.length, 4);
  assert.equal(buildOutfit([pieceMap["pull zippé beige"]], "casual"), null);
});

test("ÉTAPE 3 : Pluie (>= 40 %) exclut les chaussures en daim ou en toile", () => {
  const rainyOutfit = [
    pieceMap["t-shirt blanc"],
    pieceMap["pantalon vert kaki large"],
    { id: "suede1", name: "Mocassins en daim", category: "chaussures" },
  ];
  const res = validateOutfit(rainyOutfit, "casual", { rain: 60 });
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some((e) => e.includes("daim") || e.includes("toile")));
});

test("ÉTAPE 3 : Pièce de type 'autre' rejetée d'une tenue", () => {
  const outfitWithAutre = [
    pieceMap["t-shirt blanc"],
    pieceMap["pantalon vert kaki large"],
    pieceMap["baskets blanches"],
    { id: "other1", name: "Gadget inconnu", type: "autre", category: "autre" },
  ];
  const res = validateOutfit(outfitWithAutre, "casual");
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some((e) => e.includes("'autre'")));
});

// ============================================================================
// ÉTAPE 4 — CHIC STRICT
// ============================================================================

test("ÉTAPE 4 : Chic exige des chaussures habillées", () => {
  const res = resolveChicOutfit(TEST_WARDROBE, { weather: { min: 6, max: 10 } });
  assert.equal(res.success, false);
  assert.ok(res.message.includes("chaussures habillées"));
});

test("ÉTAPE 4 : Signalement précis du slot manquant si aucune chaussure", () => {
  const wardrobeNoShoes = TEST_WARDROBE.filter((p) => !p.name.includes("basket"));
  const res = resolveChicOutfit(wardrobeNoShoes);
  assert.equal(res.success, false);
  assert.ok(res.message.includes("chaussures"));
});

test("ÉTAPE 4 : Évite deux tenues Chic consécutives identiques si alternative valide", () => {
  const formalWardrobe = [
    ...TEST_WARDROBE,
    { id: "formal-shirt", name: "chemise blanche", colors: "blanc" },
    { id: "formal-shoes", name: "mocassins noirs", colors: "noir" },
  ];
  const day1 = resolveChicOutfit(formalWardrobe, { weather: { min: 6, max: 10 } });
  assert.equal(day1.success, true);
  const baseDay1 = day1.pieces.find((p) => p.slot === SLOTS.BASE);
  assert.ok([GARMENT_TYPES.CHEMISE, GARMENT_TYPES.POLO].includes(baseDay1?.type));

  // Si on demande une alternative pour le jour suivant en évitant le même haut
  const day2 = resolveChicOutfit(formalWardrobe, {
    weather: { min: 6, max: 10 },
    avoidIds: new Set([baseDay1?.id].filter(Boolean)),
  });
  assert.equal(day2.success, true);
  const baseDay2 = day2.pieces.find((p) => p.slot === SLOTS.BASE);
  assert.ok([GARMENT_TYPES.CHEMISE, GARMENT_TYPES.POLO].includes(baseDay2?.type));
  assert.notEqual(baseDay1?.id, baseDay2?.id);
  assert.ok(day2.pieces.some((p) => p.type === GARMENT_TYPES.PULL));
  assert.ok(!day2.pieces.some((p) => p.type === GARMENT_TYPES.HOODIE));
});

// ============================================================================
// ÉTAPE 5 — PROMPT DE L'AGENT OUTFIT MATCHER
// ============================================================================

test("ÉTAPE 5 : Vérification de la complétude du prompt Outfit Matcher", () => {
  assert.ok(OUTFIT_MATCHER_PROMPT.includes("BASE"));
  assert.ok(OUTFIT_MATCHER_PROMPT.includes("COUCHE"));
  assert.ok(OUTFIT_MATCHER_PROMPT.includes("cravate"));
  assert.ok(OUTFIT_MATCHER_PROMPT.includes("STYLE CHIC STRICT"));
  assert.ok(OUTFIT_MATCHER_PROMPT.includes("EXEMPLES VALIDES"));
  assert.ok(OUTFIT_MATCHER_PROMPT.includes("EXEMPLES INVALIDES"));
});
