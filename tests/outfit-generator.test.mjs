import test from "node:test";
import assert from "node:assert/strict";
import { generateOutfits } from "../public/js/outfit-generator.js";
import {
  GARMENT_TYPES,
  SLOTS,
  validateOutfit,
} from "../public/js/outfit-matcher.js";

const wardrobe = [
  { id: "tee", name: "t-shirt blanc", colors: "blanc" },
  { id: "tee2", name: "t-shirt noir", colors: "noir" },
  { id: "polo", name: "polo bleu marine", colors: "bleu marine" },
  { id: "shirt", name: "chemise blanche", colors: "blanc" },
  { id: "pull", name: "pull beige", colors: "beige" },
  { id: "hoodie", name: "hoodie noir", colors: "noir" },
  { id: "jean", name: "jean brut", colors: "bleu" },
  { id: "pant", name: "pantalon noir", colors: "noir" },
  { id: "sneakers", name: "baskets blanches", colors: "blanc" },
  { id: "loafers", name: "mocassins noirs", colors: "noir" },
  { id: "coat", name: "manteau gris", colors: "gris" },
  { id: "tie", name: "cravate bleu marine", colors: "bleu marine" },
];

test("generateOutfits produit des tenues valides avec couche chaude", () => {
  const weather = { min: 8, max: 14, rain: 20 };
  for (const style of ["casual", "chic", "minimaliste", "streetwear"]) {
    const outfits = generateOutfits(wardrobe, style, 6, 0, weather);
    assert.ok(outfits.length > 0, `${style} doit produire des tenues`);
    for (const outfit of outfits) {
      const validation = validateOutfit(outfit, outfit.style || style, weather);
      assert.equal(validation.isValid, true, `${style} : ${validation.errors.join(" ")}`);
      const types = outfit.pieces.map((piece) => piece.type);
      assert.ok(
        types.includes(GARMENT_TYPES.PULL) || types.includes(GARMENT_TYPES.HOODIE),
        `${style} doit contenir un pull ou un hoodie`,
      );
      assert.ok(outfit.pieces.some((piece) => piece.slot === SLOTS.VESTE));
    }
  }
});

test("generateOutfits respecte les bases de Chic, Minimaliste et Streetwear", () => {
  for (const style of ["chic", "minimaliste"]) {
    const outfits = generateOutfits(wardrobe, style, 6, 2, { min: 12, max: 18 });
    for (const outfit of outfits) {
      const types = outfit.pieces.map((piece) => piece.type);
      assert.ok(!types.includes(GARMENT_TYPES.TSHIRT), `${style} ne doit pas sortir de t-shirt`);
      assert.ok(!types.includes(GARMENT_TYPES.HOODIE), `${style} ne doit pas sortir de hoodie`);
      assert.ok(
        types.includes(GARMENT_TYPES.CHEMISE) || types.includes(GARMENT_TYPES.POLO),
        `${style} doit utiliser chemise ou polo`,
      );
    }
  }

  const streetwearOutfits = generateOutfits(wardrobe, "streetwear", 8, 3, { min: 12, max: 18 });
  for (const outfit of streetwearOutfits) {
    const types = outfit.pieces.map((piece) => piece.type);
    assert.ok(!types.includes(GARMENT_TYPES.POLO), "Streetwear ne doit pas sortir de polo");
    assert.ok(!types.includes(GARMENT_TYPES.CHEMISE), "Streetwear ne doit pas sortir de chemise");
    assert.ok(types.includes(GARMENT_TYPES.TSHIRT), "Streetwear doit utiliser un t-shirt");
  }
});
