// style-utils.js – normalisation des styles et libellés partagés.
import { styles as STYLE_CATALOG } from "./styles-config.js";
import { canonicalStyleKey } from "./style-rules.js";

export const CANONICAL_STYLES = STYLE_CATALOG.map((style) => ({
  key: style.id,
  label: style.label,
}));

export const STYLE_LABELS_MAP = new Map(
  CANONICAL_STYLES.map(({ key, label }) => [key, label]),
);

/**
 * Normalise un style demandé vers un id du catalogue.
 * "Chic décontracté" reste accepté comme alias historique de Chic.
 * @param {string} value
 * @returns {string}
 */
export function normalizeRequestedStyle(value) {
  if (!value || typeof value !== "string") return "";
  const key = canonicalStyleKey(value);
  if (key === "chic decontracte") return "chic";
  return STYLE_LABELS_MAP.has(key) ? key : "";
}

/**
 * @param {string} styleName
 * @returns {string}
 */
export function getStyleLabel(styleName) {
  const key = normalizeRequestedStyle(styleName);
  if (!key) return "Aucun style";
  return STYLE_LABELS_MAP.get(key) || key.charAt(0).toUpperCase() + key.slice(1);
}
