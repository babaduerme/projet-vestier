/**
 * Client de l'API StyleAI.
 * La validation serveur est utilisée comme second verrou après la génération
 * locale. Si l'API n'est pas disponible (hébergement statique), on retombe
 * silencieusement sur la validation locale déjà effectuée.
 */

const VALIDATION_ENDPOINT = "/api/outfits/validate";
const REQUEST_TIMEOUT_MS = 2500;

/**
 * Envoie une tenue au serveur pour validation métier.
 * @param {object} outfit
 * @returns {Promise<{isValid: boolean, errors: string[], missingSlots: string[]}|null>}
 */
export async function validateOutfitOnServer(outfit) {
  if (!outfit || !Array.isArray(outfit.pieces) || outfit.pieces.length === 0) {
    return null;
  }

  const payload = {
    style: outfit.style || "casual",
    weather: outfit.weather || null,
    pieces: outfit.pieces.map((piece) => ({
      name: piece.name,
      category: piece.category,
      colors: piece.colors,
      type: piece.type,
      slot: piece.slot,
      description: piece.description,
    })),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(VALIDATION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (typeof result?.isValid !== "boolean") return null;
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
