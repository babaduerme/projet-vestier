import test from "node:test";
import assert from "node:assert/strict";
import { weatherType, weatherEmoji, weatherIconSvg, DEFAULT_WEATHER_LOCATION } from "../public/js/weather.js";
import { canonicalStyleKey, STYLE_RULES, STYLE_COLOR_PALETTES } from "../public/js/style-rules.js";

test("weatherType identifie correctement la pluie, la tempête, la neige et le vent", () => {
  assert.equal(weatherType(61), "rain");
  assert.equal(weatherType(95), "storm");
  assert.equal(weatherType(71), "snow");
  assert.equal(weatherType(0), "clear");
  assert.equal(weatherType(2), "partlyCloudy");
  assert.equal(weatherType(0, 60), "wind");
});

test("weatherIconSvg et weatherEmoji fournissent des icônes valides", () => {
  assert.match(weatherIconSvg("clear"), /<svg/);
  assert.match(weatherIconSvg("rain"), /<svg/);
  assert.match(weatherIconSvg("wind"), /<svg/);
  assert.equal(weatherEmoji("clear"), "☀️");
  assert.equal(weatherEmoji("rain"), "🌧️");
});

test("DEFAULT_WEATHER_LOCATION pointe sur Paris", () => {
  assert.equal(DEFAULT_WEATHER_LOCATION.name, "Paris, France");
  assert.equal(DEFAULT_WEATHER_LOCATION.coordinates.latitude, 48.8566);
  assert.equal(DEFAULT_WEATHER_LOCATION.coordinates.longitude, 2.3522);
});

test("canonicalStyleKey normalise les styles conservés", () => {
  assert.equal(canonicalStyleKey("casual"), "casual");
  assert.equal(canonicalStyleKey("Casual"), "casual");
  assert.equal(canonicalStyleKey("Rock"), "rock");
  assert.equal(canonicalStyleKey("Streetwear"), "streetwear");
  assert.equal(canonicalStyleKey("Minimaliste"), "minimaliste");
  assert.equal(canonicalStyleKey("Chic"), "chic");
});
