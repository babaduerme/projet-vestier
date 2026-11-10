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

test("Rock accepte un t-shirt et un hoodie mais refuse un pull sobre", () => {
  assert.match("t-shirt noir", STYLE_RULES.rock.allowed);
  assert.match("hoodie noir", STYLE_RULES.rock.allowed);
  assert.match("pull bordeaux", STYLE_RULES.rock.forbidden);
});

test("le style Chic refuse les vêtements de sport", () => {
  assert.match("basket de sport", STYLE_RULES.chic.forbidden);
  assert.match("jogging", STYLE_RULES.chic.forbidden);
});
