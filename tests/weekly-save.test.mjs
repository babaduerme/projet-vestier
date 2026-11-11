import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/outfits.html", import.meta.url), "utf8");
const script = await readFile(new URL("../public/js/outfits/index.js", import.meta.url), "utf8");

test("le planning propose une sauvegarde manuelle de la semaine", () => {
  assert.match(html, /id="save-week-btn"/);
  assert.match(html, /Sauvegarder ma semaine/);
  assert.match(script, /saveWeekButton\?\.addEventListener\("click"/);
  assert.match(script, /saveWeeklyOutfits\(latestGeneratedOutfits, true\)/);
  const generateWeek = script.match(/async function generateWeeklyOutfitsReliable\(\) \{([\s\S]*?)\ngenerateBtn\?\.addEventListener/)?.[1] || "";
  const retryDay = script.match(/async function generateSingleDayOutfit\(dayKey\) \{([\s\S]*?)\n\/\*\*/)?.[1] || "";
  assert.doesNotMatch(generateWeek, /saveWeeklyOutfits\(/);
  assert.doesNotMatch(retryDay, /saveWeeklyOutfits\(/);
  assert.match(generateWeek, /failedDayKeys\.length > 0/);
  assert.match(generateWeek, /generateSingleDayOutfit\(dayKey, \{ silent: true \}\)/);
  assert.match(script, /Semaine non sauvegardée/);
  assert.match(script, /Modifications non enregistrées/);
  assert.match(script, /addDoc\(savedWeeksRef, payload\)/);
  assert.match(script, /updateDoc\(doc\(db, `users\/\$\{currentUser\.uid\}\/outfits`, activeSavedWeekId\), payload\)/);
  assert.match(html, /id="saved-week-panel"/);
  assert.match(html, /Mes semaines sauvegardées/);
  assert.match(script, /function renderSavedWeeks\(\)/);
  assert.match(script, /textContent = "Rouvrir"/);
  assert.match(script, /textContent = "Supprimer"/);
  assert.match(script, /deleteDoc\(doc\(db, `users\/\$\{currentUser\.uid\}\/outfits`, savedWeek\.id\)\)/);
  assert.match(script, /onSnapshot\(\s*collection\(db, `users\/\$\{currentUser\.uid\}\/outfits`\)/);
  assert.match(script, /generateBtn\?\.addEventListener\("click"/);
  assert.match(script, /activeSavedWeekId = null;/);
  assert.match(script, /activeSavedWeekId = savedWeek\.id === "local-cache" \? null : savedWeek\.id/);
  const loadSavedOutfits = script.match(/async function loadSavedOutfits\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.doesNotMatch(loadSavedOutfits, /renderWeeklyOutfits\(/);
  assert.match(script, /savedWeekList\?\.addEventListener\("click"/);
});

test("une erreur de sauvegarde est signalée et permet de réessayer", () => {
  assert.match(script, /Semaine non sauvegardée/);
  assert.match(script, /Impossible de sauvegarder ta semaine\. Réessaie\./);
  assert.match(script, /saveWeekButton\.disabled = !currentUser \|\| latestGeneratedOutfits\.length === 0/);
});

test("un échec Chic affiche le vrai emplacement manquant fourni par le résolveur", () => {
  assert.match(script, /resolverMissingSlot = chicRes\.missingSlot/);
  assert.match(script, /resolverMissingSlot \? \[resolverMissingSlot\] : partial\.missingSlots/g);
});

test("une journée impossible propose uniquement Casual, Rock ou Streetwear", () => {
  assert.match(script, /const ALTERNATIVE_STYLES = \["casual", "rock", "streetwear"\]/);
  assert.match(script, /outfit-alternative-banner/);
  assert.match(script, /generateDayWithAlternativeStyle\(outfit\.dayKey, styleKey\)/);
  assert.match(script, /async function generateDayWithAlternativeStyle/);
});

test("les tenues distinguent visuellement la première et la seconde couche", () => {
  assert.match(script, /\[SLOTS\.BASE\]: "Première couche"/);
  assert.match(script, /\[SLOTS\.COUCHE\]: "Seconde couche"/);
  assert.match(script, /pieceCategory\.textContent = getOutfitPieceLabel\(piece\)/);
});
