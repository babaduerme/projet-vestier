import { readdir } from "node:fs/promises";

// Exécute tous les fichiers de test dans le même processus.
// Ce lanceur évite `node --test`, qui ouvre des sous-processus bloqués par
// certains environnements sandboxés, tout en conservant node:test.
const testsDirectory = new URL(".", import.meta.url);
const testFiles = (await readdir(testsDirectory))
  .filter((file) => file.endsWith(".test.mjs"))
  .sort();

for (const file of testFiles) {
  await import(new URL(file, testsDirectory));
}
