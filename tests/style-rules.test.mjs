import test from "node:test";
import assert from "node:assert/strict";
import {
  STYLE_RULES,
  canonicalStyleKey,
} from "../public/js/style-rules.js";

test("normalise les cinq styles conservés", () => {
  assert.equal(canonicalStyleKey("Casual"), "casual");
  assert.equal(canonicalStyleKey("Minimaliste"), "minimaliste");
});

test("Rock accepte un t-shirt, un hoodie et un pull (couche chaude obligatoire)", () => {
  assert.match("t-shirt noir", STYLE_RULES.rock.allowed);
  assert.match("hoodie noir", STYLE_RULES.rock.allowed);
  assert.match("pull bordeaux", STYLE_RULES.rock.allowed);
  assert.doesNotMatch("pull bordeaux", STYLE_RULES.rock.forbidden);
});

test("Chic refuse les t-shirts et les hoodies", () => {
  assert.doesNotMatch("t-shirt blanc", STYLE_RULES.chic.allowed);
  assert.match("t-shirt blanc", STYLE_RULES.chic.forbidden);
  assert.doesNotMatch("hoodie noir", STYLE_RULES.chic.allowed);
  assert.match("hoodie noir", STYLE_RULES.chic.forbidden);
});

test("Minimaliste hérite des interdictions de Chic", () => {
  assert.doesNotMatch("t-shirt blanc", STYLE_RULES.minimaliste.allowed);
  assert.match("t-shirt blanc", STYLE_RULES.minimaliste.forbidden);
  assert.doesNotMatch("hoodie noir", STYLE_RULES.minimaliste.allowed);
  assert.match("hoodie noir", STYLE_RULES.minimaliste.forbidden);
  assert.match("chemise blanche", STYLE_RULES.minimaliste.allowed);
  assert.match("pull beige", STYLE_RULES.minimaliste.allowed);
});

test("le style Chic refuse les vêtements de sport", () => {
  assert.match("basket de sport", STYLE_RULES.chic.forbidden);
  assert.match("jogging", STYLE_RULES.chic.forbidden);
});
