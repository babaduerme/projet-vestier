import test from "node:test";
import assert from "node:assert/strict";
import { planTrip } from "../public/js/trip/trip-planner.js";
import {
  GARMENT_TYPES,
  validateOutfit,
} from "../public/js/shared/outfit-matcher.js";

const wardrobe = [
  { id: "tee", name: "t-shirt blanc", category: "haut", colors: "blanc" },
  { id: "tee2", name: "t-shirt noir", category: "haut", colors: "noir" },
  { id: "shirt", name: "chemise blanche", category: "haut", colors: "blanc" },
  { id: "polo", name: "polo marine", category: "haut", colors: "bleu marine" },
  { id: "pull", name: "pull beige", category: "haut", colors: "beige" },
  { id: "hoodie", name: "hoodie noir", category: "haut", colors: "noir" },
  { id: "jean", name: "jean brut", category: "bas", colors: "bleu" },
  { id: "pant", name: "pantalon noir", category: "bas", colors: "noir" },
  { id: "skirt", name: "jupe marron", category: "bas", colors: "marron" },
  { id: "sneakers", name: "baskets blanches", category: "chaussures", colors: "blanc" },
  { id: "boots", name: "bottes noires", category: "chaussures", colors: "noir" },
  { id: "coat", name: "manteau gris", category: "manteau", colors: "gris" },
  { id: "tie", name: "cravate bleue", category: "accessoires", colors: "bleu" },
];

const coldDays = [10, 11, 12, 13, 14].map((day) => ({
  date: `2026-11-${day}`,
  weather: { min: 5, max: 12, rain: 20, label: "Nuageux" },
}));

test("planTrip minimise les pièces et réutilise les vêtements", () => {
  const result = planTrip({ wardrobe, days: coldDays, styles: ["casual"] });
  assert.equal(result.success, true);
  assert.ok(result.totalPieces > 0);
  assert.ok(result.totalPieces <= CABIN_MAX_PIECES);

  const selected = new Set(result.pieceIds);
  for (const day of result.days) {
    const validation = validateOutfit(day.outfit, day.style, day.weather);
    assert.equal(validation.isValid, true);
    for (const piece of day.outfit.pieces) {
      assert.ok(selected.has(String(piece.id)), `${piece.name} doit être dans la valise`);
    }
  }

  const usage = new Map();
  for (const day of result.days) {
    for (const piece of day.outfit.pieces) {
      usage.set(piece.id, (usage.get(piece.id) || 0) + 1);
    }
  }
  assert.ok([...usage.values()].some((count) => count >= 2), "au moins une pièce doit servir plusieurs jours");
});

test("planTrip couvre plusieurs styles avec des tenues validées", () => {
  const styles = ["casual", "chic", "streetwear"];
  const result = planTrip({ wardrobe, days: coldDays, styles });
  assert.equal(result.success, true);
  assert.deepEqual(
    [...new Set(result.days.map((day) => day.style))].sort(),
    [...styles].sort(),
  );
  for (const day of result.days) {
    assert.ok(styles.includes(day.style));
    assert.equal(validateOutfit(day.outfit, day.style, day.weather).isValid, true);
  }
});

test("planTrip refuse Streetwear avec un polo et garde le t-shirt", () => {
  const result = planTrip({ wardrobe, days: coldDays, styles: ["streetwear"] });
  assert.equal(result.success, true);
  for (const piece of result.pieces) {
    assert.notEqual(piece.type, GARMENT_TYPES.POLO);
    assert.notEqual(piece.type, GARMENT_TYPES.CHEMISE);
  }
  for (const day of result.days) {
    const types = day.outfit.pieces.map((piece) => piece.type);
    assert.ok(types.includes(GARMENT_TYPES.TSHIRT));
    assert.ok(!types.includes(GARMENT_TYPES.POLO));
  }
});

test("planTrip signale précisément l'absence de pull ou de chemise", () => {
  const noWarmLayer = wardrobe.filter(
    (piece) => piece.id !== "pull" && piece.id !== "hoodie",
  );
  const noLayerResult = planTrip({ wardrobe: noWarmLayer, days: coldDays, styles: ["casual"] });
  assert.equal(noLayerResult.success, false);
  assert.match(noLayerResult.message, /pull|hoodie/i);

  const noFormalBase = wardrobe.filter(
    (piece) => piece.id !== "shirt" && piece.id !== "polo",
  );
  const noBaseResult = planTrip({ wardrobe: noFormalBase, days: coldDays, styles: ["chic"] });
  assert.equal(noBaseResult.success, false);
  assert.match(noBaseResult.message, /polo|chemise/i);
});

test("planTrip respecte la limite de pièces", () => {
  const result = planTrip({
    wardrobe,
    days: coldDays,
    styles: ["casual"],
    maxPieces: 3,
  });
  assert.equal(result.success, false);
  assert.match(result.message, /au-dessus de la limite/i);
  assert.ok(result.totalPieces > 3);
});

test("planTrip applique la capacité cabine", () => {
  const result = planTrip({
    wardrobe,
    days: coldDays,
    styles: ["casual"],
    cabin: true,
  });
  assert.equal(result.maxPieces, CABIN_MAX_PIECES);
  assert.equal(result.cabin, true);
  if (result.success) {
    assert.ok(result.totalPieces <= CABIN_MAX_PIECES);
  }
});
