import test from "node:test";
import assert from "node:assert/strict";
import { buildClothesQuery } from "../public/js/wardrobe/wardrobe-query.js";

function createFirestoreFake() {
  return {
    query: (collectionRef, ...constraints) => ({ collectionRef, constraints }),
    where: (...args) => ({ type: "where", args }),
    limit: (value) => ({ type: "limit", value }),
  };
}

test("un filtre de catégorie interroge tous les vêtements de cette catégorie", () => {
  const firestore = createFirestoreFake();
  const query = buildClothesQuery("clothes", "chaussures", 6, firestore);

  assert.deepEqual(query.constraints, [
    { type: "where", args: ["category", "==", "chaussures"] },
  ]);
});

test("la vue complète conserve la pagination", () => {
  const firestore = createFirestoreFake();
  const query = buildClothesQuery("clothes", "tous", 6, firestore);

  assert.deepEqual(query.constraints, [{ type: "limit", value: 6 }]);
});
