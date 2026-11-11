import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/trip.html", import.meta.url), "utf8");
const script = await readFile(new URL("../public/js/trip/trip.js", import.meta.url), "utf8");

test("le formulaire valise est accessible et complet", () => {
  assert.match(html, /<label for="trip-destination">/);
  assert.match(html, /<label for="trip-start">/);
  assert.match(html, /<label for="trip-end">/);
  assert.match(html, /<fieldset[^>]*trip-fieldset/);
  assert.match(html, /name="trip-style"/);
  assert.doesNotMatch(html, /name="trip-capacity"|trip-max-pieces/);
  assert.match(html, /id="trip-laundry"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="saved-trips-list"/);
  assert.match(html, /id="trip-save-btn"/);
});

test("le mode valise réutilise la météo et le planificateur", () => {
  assert.match(script, /geocodeCity/);
  assert.match(script, /fetchWeatherForDateRange/);
  assert.match(script, /planTrip/);
  assert.match(script, /users\/\$\{currentUser\.uid\}\/trips/);
});

test("les actions Sauvegarder, Rouvrir et Supprimer sont branchées", () => {
  assert.match(script, /function saveTrip/);
  assert.match(script, /function openSavedTrip/);
  assert.match(script, /function removeTrip/);
  assert.match(script, /data-open-trip/);
  assert.match(script, /data-delete-trip/);
});
