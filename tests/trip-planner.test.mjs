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
  assert.equal("maxPieces" in result, false);

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

test("planTrip ignore les anciennes options de capacité et distingue les couches", () => {
  const result = planTrip({ wardrobe, days: coldDays, styles: ["casual"], maxPieces: 1, cabin: true });
  assert.equal(result.success, true);
  assert.equal("maxPieces" in result, false);
  assert.ok(result.pieces.some((piece) => piece.packingCategory === "premiere-couche"));
  assert.ok(result.pieces.some((piece) => piece.packingCategory === "seconde-couche"));
});

test("planTrip exclut les sacs et les vêtements classés Autres", () => {
  const result = planTrip({
    wardrobe: [
      ...wardrobe,
      { id: "bag", name: "sac noir", category: "accessoires", type: GARMENT_TYPES.SAC, colors: "noir" },
      { id: "other", name: "vêtement inconnu", category: "autre", type: GARMENT_TYPES.AUTRE, colors: "noir" },
    ],
    days: coldDays,
    styles: ["casual"],
  });
  assert.equal(result.success, true);
  assert.ok(!result.pieceIds.includes("bag"));
  assert.ok(!result.pieceIds.includes("other"));
});

test("avec une machine, limite les bas et robes et ne prend qu'un manteau", () => {
  const variedWardrobe = [
    ...wardrobe,
    { id: "dress1", name: "robe noire", category: "robe", colors: "noir" },
    { id: "dress2", name: "robe bleue", category: "robe", colors: "bleu" },
    { id: "coat2", name: "manteau beige", category: "manteau", colors: "beige" },
  ];
  const days = Array.from({ length: 15 }, (_, index) => ({
    date: `2026-11-${String(index + 16).padStart(2, "0")}`,
    weather: { min: 5, max: 12, rain: 10 },
  }));
  const result = planTrip({ wardrobe: variedWardrobe, days, styles: ["casual"], laundryAvailable: true });
  assert.equal(result.success, true);
  assert.ok(result.pieces.filter((piece) => [GARMENT_TYPES.JEAN, GARMENT_TYPES.PANTALON, GARMENT_TYPES.JUPE, GARMENT_TYPES.SHORT].includes(piece.type)).length <= 2, JSON.stringify(result.pieces.map((piece) => [piece.name, piece.type, piece.category])));
  assert.ok(result.pieces.filter((piece) => piece.type === GARMENT_TYPES.ROBE).length <= 2);
  assert.ok(result.pieces.filter((piece) => [GARMENT_TYPES.VESTE, GARMENT_TYPES.MANTEAU].includes(piece.type)).length <= 1);
  for (const day of result.days) assert.equal(validateOutfit(day.outfit, day.style, day.weather).isValid, true);
});

test("un séjour de deux semaines prévoit plus de premières couches qu'une semaine", () => {
  const variedWardrobe = [
    ...wardrobe,
    { id: "tee3", name: "t-shirt vert", category: "haut", colors: "vert" },
    { id: "tee4", name: "t-shirt rouge", category: "haut", colors: "rouge" },
    { id: "tee5", name: "t-shirt gris", category: "haut", colors: "gris" },
  ];
  const days = (count) => Array.from({ length: count }, (_, index) => ({
    date: `2026-11-${String(index + 1).padStart(2, "0")}`,
    weather: { min: 9, max: 17, rain: 10 },
  }));
  const week = planTrip({ wardrobe: variedWardrobe, days: days(7), styles: ["casual"] });
  const fortnight = planTrip({ wardrobe: variedWardrobe, days: days(14), styles: ["casual"] });
  const fortnightWithLaundry = planTrip({ wardrobe: variedWardrobe, days: days(14), styles: ["casual"], laundryAvailable: true });
  const countFirstLayers = (plan) => plan.pieces.filter((piece) => piece.packingCategory === "premiere-couche").length;
  assert.equal(week.success, true);
  assert.equal(fortnight.success, true);
  assert.ok(fortnightWithLaundry.totalPieces < fortnight.totalPieces);
  assert.ok(countFirstLayers(fortnight) > countFirstLayers(week));
  assert.ok(countFirstLayers(fortnightWithLaundry) < countFirstLayers(fortnight));
});
