import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveStyle,
  filterWardrobe,
  normalizeCategory,
  composeOutfit,
} from "../public/js/shared/styles/style-engine.js";
import { GARMENT_TYPES, detectGarmentType } from "../public/js/shared/outfit-matcher.js";

const wardrobe = [
  { id: "tee", name: "t-shirt blanc" },
  { id: "polo", name: "polo bleu marine" },
  { id: "shirt", name: "chemise blanche" },
  { id: "pull", name: "pull beige" },
  { id: "hoodie", name: "hoodie noir" },
  { id: "jeans", name: "jean brut" },
  { id: "loafers", name: "mocassins noirs" },
];

test("Minimaliste hérite des exclusions de Chic", () => {
  const chic = resolveStyle("chic");
  const minimaliste = resolveStyle("minimaliste");

  assert.ok(chic.exclude.types.includes("t-shirt"));
  assert.ok(chic.exclude.types.includes("hoodie"));
  assert.ok(minimaliste.exclude.types.includes("t-shirt"));
  assert.ok(minimaliste.exclude.types.includes("hoodie"));
  assert.ok(minimaliste.exclude.keywords.includes("cravate"));
});

test("le filtre Chic exclut les t-shirts et les hoodies", () => {
  const filtered = filterWardrobe(wardrobe, resolveStyle("chic"));
  const types = filtered.map((piece) => detectGarmentType(piece.name, piece.category));

  assert.ok(!types.includes(GARMENT_TYPES.TSHIRT));
  assert.ok(!types.includes(GARMENT_TYPES.HOODIE));
  assert.ok(types.includes(GARMENT_TYPES.CHEMISE));
  assert.ok(types.includes(GARMENT_TYPES.POLO));
  assert.ok(types.includes(GARMENT_TYPES.PULL));
});

test("le filtre Minimaliste exclut aussi les t-shirts et les hoodies", () => {
  const filtered = filterWardrobe(wardrobe, resolveStyle("minimaliste"));
  const types = filtered.map((piece) => detectGarmentType(piece.name, piece.category));

  assert.ok(!types.includes(GARMENT_TYPES.TSHIRT));
  assert.ok(!types.includes(GARMENT_TYPES.HOODIE));
  assert.ok(types.includes(GARMENT_TYPES.CHEMISE));
  assert.ok(types.includes(GARMENT_TYPES.PULL));
});

test("la passe assouplie ne réintroduit pas un vêtement exclu", () => {
  const onlyExcluded = [
    { id: "tee", name: "t-shirt blanc" },
    { id: "hoodie", name: "hoodie noir" },
  ];
  assert.deepEqual(filterWardrobe(onlyExcluded, resolveStyle("chic")), []);
});

test("Casual, Rock et Streetwear conservent t-shirt et hoodie", () => {
  for (const styleId of ["casual", "rock", "streetwear"]) {
    const filtered = filterWardrobe(wardrobe, resolveStyle(styleId));
    const types = filtered.map((piece) => detectGarmentType(piece.name, piece.category));
    assert.ok(types.includes(GARMENT_TYPES.TSHIRT), `${styleId} doit accepter un t-shirt`);
    assert.ok(types.includes(GARMENT_TYPES.HOODIE), `${styleId} doit accepter un hoodie`);
  }
});

test("Streetwear exclut polo et chemise et compose avec un t-shirt", () => {
  const filtered = filterWardrobe(wardrobe, resolveStyle("streetwear"));
  const types = filtered.map((piece) => detectGarmentType(piece.name, piece.category));
  assert.ok(!types.includes(GARMENT_TYPES.POLO));
  assert.ok(!types.includes(GARMENT_TYPES.CHEMISE));
  assert.ok(types.includes(GARMENT_TYPES.TSHIRT));

  const outfit = composeOutfit(filtered, resolveStyle("streetwear"), null);
  const outfitTypes = outfit.map((piece) => detectGarmentType(piece.name, piece.category));
  assert.ok(outfitTypes.includes(GARMENT_TYPES.TSHIRT));
  assert.ok(!outfitTypes.includes(GARMENT_TYPES.POLO));
  assert.ok(!outfitTypes.includes(GARMENT_TYPES.CHEMISE));
  assert.ok(outfitTypes.includes(GARMENT_TYPES.PULL) || outfitTypes.includes(GARMENT_TYPES.HOODIE));
});

test("composeOutfit Chic produit un polo/chemise avec un pull, jamais un t-shirt ou un hoodie", () => {
  const outfit = composeOutfit(
    filterWardrobe(wardrobe, resolveStyle("chic")),
    resolveStyle("chic"),
    null,
  );
  const types = outfit.map((piece) => detectGarmentType(piece.name, piece.category));

  assert.ok(types.includes(GARMENT_TYPES.CHEMISE) || types.includes(GARMENT_TYPES.POLO));
  assert.ok(types.includes(GARMENT_TYPES.PULL));
  assert.ok(!types.includes(GARMENT_TYPES.TSHIRT));
  assert.ok(!types.includes(GARMENT_TYPES.HOODIE));
});

test("normalizeCategory continue de fusionner les hauts en top", () => {
  assert.equal(normalizeCategory({ name: "t-shirt" }), "top");
  assert.equal(normalizeCategory({ name: "chemise" }), "top");
  assert.equal(normalizeCategory({ name: "pull" }), "layer");
});
