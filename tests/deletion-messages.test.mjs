import test from "node:test";
import assert from "node:assert/strict";
import { getDeletionConfirmationMessage } from "../public/js/core/ui-utils.js";

test("le message d'un vêtement précise sa catégorie et son nom", () => {
  assert.equal(
    getDeletionConfirmationMessage("garment", { name: "Baskets blanches", category: "chaussures" }),
    "Supprimer cette paire de chaussures « Baskets blanches » ? Cette pièce sera retirée de ta garde-robe.",
  );
});

test("les suppressions de semaine, valise et compte ont chacune leur message", () => {
  assert.match(getDeletionConfirmationMessage("savedWeek", { name: "Semaine de juin" }), /Semaine de juin.*tenues enregistrées/);
  assert.match(getDeletionConfirmationMessage("trip", { name: "Lisbonne" }), /Lisbonne.*plan de tenues/);
  assert.match(getDeletionConfirmationMessage("account"), /compte StyleAI.*irréversible/);
});
