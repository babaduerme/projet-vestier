import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");

test("la refonte conserve les points d’entrée utilisés par chaque page", async () => {
  const contracts = {
    "public/login.html": [
      "login-form",
      "signup-form",
      "error-message",
      "forgot-password",
    ],
    "public/wardrobe.html": [
      "open-modal-btn",
      "add-cloth-form",
      "file-input",
      "camera-input",
      "clothes-grid",
      "filter-pill",
    ],
    "public/outfits.html": [
      "generate-btn",
      "save-week-btn",
      "saved-week-list",
      "retry-generation-btn",
      "weekly-style-planner",
    ],
    "public/trip.html": [
      "trip-form",
      "trip-generate-btn",
      "trip-save-btn",
      "saved-trips-list",
      "trip-days",
    ],
  };
  for (const [page, ids] of Object.entries(contracts)) {
    const html = await read(page);
    for (const id of ids)
      assert.match(
        html,
        new RegExp(`(?:id|class)="[^"]*\\b${id}\\b[^"]*"`),
        `${page} doit conserver ${id}`,
      );
  }
});

test("la navigation mobile ne propose que les pages qui existent", async () => {
  for (const page of [
    "public/wardrobe.html",
    "public/outfits.html",
    "public/trip.html",
  ]) {
    const html = await read(page);
    assert.match(html, /href="wardrobe\.html"/);
    assert.match(html, /href="outfits\.html"/);
    assert.match(html, /href="trip\.html"/);
    assert.doesNotMatch(html, /href="#user-info"/);
    assert.equal((html.match(/class="nav-links"[\s\S]*?<\/div>/)?.[0].match(/<a\b/g) || []).length, 3);
  }
});

test("la garde-robe et le voyage restent pratiques sur téléphone", async () => {
  const wardrobeCss = await read("public/css/pages/wardrobe.css");
  const tripCss = await read("public/css/pages/trip.css");
  const tripScript = await read("public/js/trip/trip.js");
  assert.match(wardrobeCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(wardrobeCss, /#load-more-clothes-btn[\s\S]*?margin: 1\.5rem auto 0/);
  assert.match(wardrobeCss, /\.cloth-card-actions[\s\S]*?justify-content: space-between/);
  assert.match(wardrobeCss, /\.color-swatch\[data-color="bordeaux"\][\s\S]*?background:/);
  const wardrobeHtml = await read("public/wardrobe.html");
  assert.match(wardrobeHtml, /id="file-input"[^>]*class="visually-hidden"/);
  assert.match(wardrobeHtml, /id="camera-input"[^>]*class="visually-hidden"/);
  assert.match(wardrobeCss, /\.dashboard-intro \.btn-primary[\s\S]*?margin-top: 1\.25rem/);
  assert.match(tripCss, /\.trip-suitcase-check[\s\S]*?min-height: 44px/);
  assert.match(tripCss, /\.trip-day-piece[\s\S]*?border: 1px solid var\(--ui-line\)/);
  assert.match(tripScript, /trip-day-piece-name/);
});

test("les tenues s'affichent par couches et les semaines restent accessibles", async () => {
  const outfitsCss = await read("public/css/pages/outfits.css");
  const outfitsScript = await read("public/js/outfits/index.js");
  const outfitsHtml = await read("public/outfits.html");
  assert.match(outfitsScript, /Première couche[\s\S]*?Seconde couche[\s\S]*?Troisième couche/);
  assert.match(outfitsCss, /\.outfit-layer-section/);
  assert.match(outfitsCss, /\.saved-week-item > button\[data-delete-week\]/);
  assert.ok(outfitsHtml.indexOf('id="outfits-container"') < outfitsHtml.indexOf('id="saved-week-panel"'));
});

test("toutes les ressources photo responsive du redesign sont locales", async () => {
  const paths = [
    "public/assets/img/fashion-editorial-960.webp",
    "public/assets/img/fashion-editorial-1600.webp",
    "public/assets/img/tailor-atelier-640.webp",
    "public/assets/img/tailor-atelier-1200.webp",
  ];
  for (const path of paths) await access(resolve(root, path));
});

test("les pages chargent le système commun et son module visuel", async () => {
  for (const page of [
    "public/index.html",
    "public/login.html",
    "public/wardrobe.html",
    "public/outfits.html",
    "public/trip.html",
  ]) {
    const html = await read(page);
    assert.match(html, /css\/base\.css/);
    assert.match(html, /css\/components\.css/);
    assert.match(html, /js\/core\/visual-effects\.js/);
  }
});
