import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createStyleAiServer } from "../server.js";

let server;
let baseUrl;

before(async () => {
  server = createStyleAiServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function postJson(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const casualPieces = [
  { name: "t-shirt blanc", category: "haut", colors: "blanc" },
  { name: "pull beige", category: "haut", colors: "beige" },
  { name: "jean brut", category: "bas", colors: "bleu" },
  { name: "baskets blanches", category: "chaussures", colors: "blanc" },
];

test("GET /api/health répond 200 avec le statut ok", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "ok");
  assert.equal(payload.service, "styleai-api");
});

test("le serveur sert l'application statique", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  const html = await response.text();
  assert.match(html, /StyleAI/);
});

test("POST /api/outfits/validate accepte une tenue valide", async () => {
  const response = await postJson("/api/outfits/validate", {
    pieces: casualPieces,
    style: "casual",
    weather: { min: 12, max: 18, rain: 0 },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.isValid, true);
  assert.deepEqual(payload.errors, []);
});

test("POST /api/outfits/validate refuse un t-shirt en Chic", async () => {
  const response = await postJson("/api/outfits/validate", {
    pieces: [
      casualPieces[0],
      casualPieces[1],
      casualPieces[2],
      { name: "mocassins noirs", category: "chaussures", colors: "noir" },
    ],
    style: "chic",
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.isValid, false);
  assert.ok(payload.errors.some((error) => error.toLowerCase().includes("t-shirt")));
});

test("POST /api/outfits/validate valide les entrées côté serveur", async () => {
  const response = await postJson("/api/outfits/validate", {
    pieces: [{ category: "haut" }],
    style: "casual",
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error, "invalid_request");
  assert.match(payload.message, /name/i);
});

test("POST /api/outfits/validate refuse un style inconnu", async () => {
  const response = await postJson("/api/outfits/validate", {
    pieces: casualPieces,
    style: "inconnu",
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.message, /style inconnu/i);
});

test("POST /api/outfits/check-wardrobe signale la couche chaude manquante", async () => {
  const response = await postJson("/api/outfits/check-wardrobe", {
    wardrobe: [
      { name: "t-shirt blanc", category: "haut" },
      { name: "jean brut", category: "bas" },
      { name: "baskets blanches", category: "chaussures" },
    ],
    style: "casual",
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.canCompose, false);
  assert.match(payload.message, /aucun pull ou hoodie disponible/i);
});

test("une route API inconnue renvoie un JSON 404", async () => {
  const response = await fetch(`${baseUrl}/api/inconnue`);
  assert.equal(response.status, 404);
  const payload = await response.json();
  assert.equal(payload.error, "not_found");
});
