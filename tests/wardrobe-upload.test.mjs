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

test("la caméra utilise getUserMedia et une modale de capture", () => {
  assert.match(html, /id="camera-modal"/);
  assert.match(html, /id="camera-video"/);
  assert.match(html, /id="camera-capture-btn"/);
  assert.match(html, /id="camera-input"[^>]*capture="environment"/);
  assert.match(script, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(script, /captureCameraPhoto/);
});

test("le bouton caméra ouvre la capture, pas le sélecteur de documents", () => {
  assert.match(
    script,
    /cameraTrigger\?\.addEventListener\("click", \(event\) => \{[\s\S]*?openCameraCapture\(\)/,
  );
  assert.match(script, /galleryTrigger\?\.addEventListener\("click", \(event\) => \{[\s\S]*?fileInput\.click\(\)/);
});

test("caméra et documents alimentent le même traitement d'image", () => {
  assert.match(script, /processSelectedFile\(file\)/);
  assert.match(script, /fileInput\?\.addEventListener\("change", handleSelectedImage\)/);
  assert.match(script, /cameraInput\?\.addEventListener\("change", handleSelectedImage\)/);
  assert.match(script, /processSelectedFile\(file\);\n\}/);
});
