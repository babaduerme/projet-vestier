/**
 * StyleAI – serveur applicatif local.
 *
 * Rôle :
 * - servir l'application statique (dossier public/) ;
 * - exposer une API HTTP qui porte la logique métier de validation et de
 *   composition des tenues, avec validation des entrées côté serveur.
 *
 * Lancement : `npm start` (ou `PORT=5000 node server.js`).
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  checkWardrobeCompleteness,
  resolveFormalOutfit,
  validateMatcherResponse,
  validateOutfit,
} from "./public/js/outfit-matcher.js";

const PUBLIC_DIR = resolve(fileURLToPath(new URL("./public/", import.meta.url)));
const DEFAULT_PORT = Number(process.env.PORT) || 5000;
const DEFAULT_HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY_BYTES = 1_000_000;
const ALLOWED_STYLES = new Set(["casual", "chic", "minimaliste", "rock", "streetwear"]);
const ALLOWED_CATEGORIES = new Set([
  "haut",
  "bas",
  "robe",
  "manteau",
  "chaussures",
  "accessoires",
  "ensemble",
]);
const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function sendText(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const contentType = String(request.headers["content-type"] || "");
    if (!contentType.toLowerCase().includes("application/json")) {
      rejectBody(new HttpError(415, "Content-Type application/json requis."));
      return;
    }

    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectBody(new HttpError(413, "Corps de requête trop volumineux."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(text));
      } catch {
        rejectBody(new HttpError(400, "Corps JSON invalide."));
      }
    });
    request.on("error", () => {
      rejectBody(new HttpError(400, "Lecture du corps impossible."));
    });
  });
}

function normalizeStyle(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validatePieceInput(piece, index) {
  if (!isPlainObject(piece)) {
    return `pieces[${index}] doit être un objet.`;
  }
  if (typeof piece.name !== "string" || piece.name.trim().length === 0) {
    return `pieces[${index}].name est obligatoire.`;
  }
  if (piece.name.length > 80) {
    return `pieces[${index}].name dépasse 80 caractères.`;
  }
  for (const field of ["category", "colors", "type", "slot", "description"]) {
    if (piece[field] != null && typeof piece[field] !== "string") {
      return `pieces[${index}].${field} doit être une chaîne.`;
    }
  }
  if (piece.description && piece.description.length > 500) {
    return `pieces[${index}].description dépasse 500 caractères.`;
  }
  if (piece.category && !ALLOWED_CATEGORIES.has(normalizeStyle(piece.category))) {
    return `pieces[${index}].category invalide.`;
  }
  return null;
}

function validatePiecesInput(pieces, { min = 1, max = 30 } = {}) {
  if (!Array.isArray(pieces)) {
    return "pieces doit être un tableau.";
  }
  if (pieces.length < min || pieces.length > max) {
    return `pieces doit contenir entre ${min} et ${max} éléments.`;
  }
  for (let index = 0; index < pieces.length; index += 1) {
    const error = validatePieceInput(pieces[index], index);
    if (error) return error;
  }
  return null;
}

function validateStyleInput(style, fallback = null) {
  const value = style == null || style === "" ? fallback : style;
  if (value == null) {
    return { error: "style est obligatoire.", style: null };
  }
  if (typeof value !== "string") {
    return { error: "style doit être une chaîne.", style: null };
  }
  const normalized = normalizeStyle(value);
  if (!ALLOWED_STYLES.has(normalized)) {
    return { error: `style inconnu : ${value}.`, style: null };
  }
  return { error: null, style: normalized };
}

function validateWeatherInput(weather) {
  if (weather == null) return null;
  if (!isPlainObject(weather)) {
    return "weather doit être un objet ou null.";
  }
  const numericFields = [
    "min",
    "max",
    "temp",
    "temperature",
    "temperature_min",
    "temperature_max",
    "rain",
    "probabilite_pluie",
    "precipitation_probability",
  ];
  for (const field of numericFields) {
    if (weather[field] == null) continue;
    if (typeof weather[field] !== "number" || !Number.isFinite(weather[field])) {
      return `weather.${field} doit être un nombre.`;
    }
    const isRain = field === "rain" || field === "probabilite_pluie" || field === "precipitation_probability";
    if (isRain && (weather[field] < 0 || weather[field] > 100)) {
      return `weather.${field} doit être compris entre 0 et 100.`;
    }
    if (!isRain && (weather[field] < -50 || weather[field] > 60)) {
      return `weather.${field} doit être compris entre -50 et 60.`;
    }
  }
  for (const field of ["type", "label"]) {
    if (weather[field] != null && (typeof weather[field] !== "string" || weather[field].length > 40)) {
      return `weather.${field} doit être une chaîne de 40 caractères maximum.`;
    }
  }
  return null;
}

async function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    sendText(response, 400, "Requête invalide.");
    return;
  }

  const target = decoded === "/" ? "" : decoded.replace(/^\/+/, "");
  let filePath = resolve(PUBLIC_DIR, target);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${sep}`)) {
    sendText(response, 403, "Accès interdit.");
    return;
  }

  try {
    let fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
      fileStat = await stat(filePath);
    }
    if (!fileStat.isFile()) throw new Error("not a file");
    const content = await readFile(filePath);
    const contentType = MIME_TYPES.get(extname(filePath).toLowerCase()) || "application/octet-stream";
    // Pas de cache HTTP pour le code applicatif : sinon le navigateur peut
    // garder un ancien module après une correction (cravate, Streetwear, etc.).
    const appCode = /\.(html|js|mjs|css|json)$/i.test(filePath);
    const cacheControl = appCode ? "no-cache" : "public, max-age=3600";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    response.end(content);
  } catch {
    try {
      const notFound = await readFile(join(PUBLIC_DIR, "404.html"));
      response.writeHead(404, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(notFound);
    } catch {
      sendText(response, 404, "Page introuvable.");
    }
  }
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      status: "ok",
      service: "styleai-api",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  if (pathname === "/api/outfits/validate" && request.method === "POST") {
    const body = await readJsonBody(request);
    const piecesError = validatePiecesInput(body.pieces, { min: 1, max: 20 });
    if (piecesError) throw new HttpError(400, piecesError);
    const styleResult = validateStyleInput(body.style);
    if (styleResult.error) throw new HttpError(400, styleResult.error);
    const weatherError = validateWeatherInput(body.weather);
    if (weatherError) throw new HttpError(400, weatherError);

    const result = validateOutfit(body.pieces, styleResult.style, body.weather ?? null);
    sendJson(response, 200, {
      isValid: result.isValid,
      errors: result.errors,
      missingSlots: result.missingSlots,
    });
    return true;
  }

  if (pathname === "/api/outfits/check-wardrobe" && request.method === "POST") {
    const body = await readJsonBody(request);
    const piecesError = validatePiecesInput(body.wardrobe, { min: 0, max: 200 });
    if (piecesError) throw new HttpError(400, piecesError);
    const styleResult = validateStyleInput(body.style, "casual");
    if (styleResult.error) throw new HttpError(400, styleResult.error);
    const result = checkWardrobeCompleteness(body.wardrobe, styleResult.style);
    sendJson(response, 200, result);
    return true;
  }

  if (pathname === "/api/outfits/chic" && request.method === "POST") {
    const body = await readJsonBody(request);
    const piecesError = validatePiecesInput(body.wardrobe, { min: 0, max: 200 });
    if (piecesError) throw new HttpError(400, piecesError);
    const styleResult = validateStyleInput(body.style, "chic");
    if (styleResult.error) throw new HttpError(400, styleResult.error);
    if (body.avoidIds != null && !Array.isArray(body.avoidIds)) {
      throw new HttpError(400, "avoidIds doit être un tableau.");
    }
    const weatherError = validateWeatherInput(body.weather);
    if (weatherError) throw new HttpError(400, weatherError);
    const result = resolveFormalOutfit(body.wardrobe, {
      style: styleResult.style,
      weather: body.weather ?? null,
      avoidIds: new Set((body.avoidIds || []).map(String)),
    });
    sendJson(response, 200, result);
    return true;
  }

  if (pathname === "/api/outfits/validate-response" && request.method === "POST") {
    const body = await readJsonBody(request);
    const piecesError = validatePiecesInput(body.wardrobe, { min: 0, max: 200 });
    if (piecesError) throw new HttpError(400, piecesError);
    const styleResult = body.style ? validateStyleInput(body.style) : { error: null, style: null };
    if (styleResult.error) throw new HttpError(400, styleResult.error);
    const weatherError = validateWeatherInput(body.weather);
    if (weatherError) throw new HttpError(400, weatherError);
    const result = validateMatcherResponse(body.response, body.wardrobe, {
      style: styleResult.style,
      weather: body.weather ?? null,
    });
    sendJson(response, 200, result);
    return true;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "not_found", message: "Route API inconnue." });
    return true;
  }

  return false;
}

/**
 * Crée le serveur HTTP sans l'écouter. Utile pour les tests.
 * @returns {import("node:http").Server}
 */
export function createStyleAiServer() {
  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`).pathname;
      const handled = await handleApi(request, response, pathname);
      if (handled) return;
      await serveStatic(request, response, pathname);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: "invalid_request", message: error.message });
        return;
      }
      console.error("[StyleAI] Erreur serveur :", error);
      sendJson(response, 500, {
        error: "server_error",
        message: "Erreur interne du serveur.",
      });
    }
  });
}

const isMain =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const server = createStyleAiServer();
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`StyleAI disponible sur http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
    console.log(`API : http://${DEFAULT_HOST}:${DEFAULT_PORT}/api/health`);
  });
  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
