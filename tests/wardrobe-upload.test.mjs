import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/wardrobe.html", import.meta.url), "utf8");
const script = await readFile(new URL("../public/js/wardrobe.js", import.meta.url), "utf8");

test("la modale propose la caméra et le sélecteur de documents", () => {
  assert.match(html, /id="camera-trigger"/);
  assert.match(html, /id="gallery-trigger"/);
  assert.match(html, /Prendre une photo/);
  assert.match(html, /Choisir une image/);
});

test("le champ caméra utilise capture=environment et le champ galerie est libre", () => {
  const cameraInput = html.match(/<input[^>]*id="camera-input"[^>]*>/)?.[0] || "";
  const galleryInput = html.match(/<input[^>]*id="file-input"[^>]*>/)?.[0] || "";

  assert.match(cameraInput, /capture="environment"/);
  assert.doesNotMatch(galleryInput, /capture=/);
});

test("les deux champs déclenchent le même traitement d'image", () => {
  assert.match(script, /cameraInput\?\.addEventListener\("change", handleSelectedImage\)/);
  assert.match(script, /fileInput\?\.addEventListener\("change", handleSelectedImage\)/);
});
