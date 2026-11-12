const TRANSFORMERS_URL =
  "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
const CLIP_MODEL = "Xenova/clip-vit-base-patch32";

// [nom affiché, catégorie (valeur de #cloth-category), prompts CLIP]
const ITEMS = [
  ["T-shirt", "haut", ["a t-shirt", "a short-sleeved crew neck tee shirt"]],
  ["Chemise", "haut", ["a button-up shirt with a collar", "a plaid shirt"]],
  [
    "Pull",
    "haut",
    [
      "a knitted sweater",
      "a pullover jumper",
      "a quarter zip sweater worn over a collared shirt",
      "a long sleeve knit pullover",
    ],
  ],
  ["Hoodie", "haut", ["a hoodie with a hood"]],
  ["Blouse", "haut", ["a women's blouse"]],
  ["Polo", "haut", ["a polo shirt"]],
  ["Veste", "manteau", ["a jacket", "a blazer"]],
  ["Manteau", "manteau", ["a long winter coat", "a trench coat"]],
  ["Pantalon", "bas", ["a pair of trousers", "a pair of chino pants"]],
  ["Jean", "bas", ["a pair of blue jeans"]],
  ["Short", "bas", ["a pair of shorts"]],
  ["Jupe", "bas", ["a skirt"]],
  ["Legging", "bas", ["a pair of leggings"]],
  ["Robe", "robe", ["a dress", "a long dress", "a summer dress"]],
  ["Baskets", "chaussures", ["sneakers", "running shoes"]],
  ["Chaussures", "chaussures", ["a pair of leather dress shoes"]],
  ["Bottes", "chaussures", ["a pair of tall boots"]],
  ["Sandales", "chaussures", ["a pair of sandals", "flip flops"]],
  [
    "Cravate",
    "accessoires",
    ["a necktie", "a men's tie", "a narrow necktie hanging vertically"],
  ],
  ["Nœud papillon", "accessoires", ["a bow tie"]],
  ["Sac", "accessoires", ["a handbag", "a backpack", "a tote bag"]],
  ["Chapeau", "accessoires", ["a hat"]],
  ["Casquette", "accessoires", ["a baseball cap"]],
  ["Écharpe", "accessoires", ["a wool scarf"]],
  ["Foulard", "accessoires", ["a silk neck scarf", "a bandana"]],
];

const NON_GARMENT_PROMPTS = [
  "a person's face portrait",
  "a landscape",
  "a piece of furniture",
  "an animal",
  "a car",
  "an empty room or a blank wall",
];

const PROMPTS = [
  ...ITEMS.flatMap(([, , prompts]) => prompts),
  ...NON_GARMENT_PROMPTS,
];

const MIN_SCORE = 0.22;
const MIN_MARGIN = 0.06;
const TIE_SCORE = 0.2;
const NARROW_ACCESSORY_SCORE = 0.08;
const DRESS_MARGIN = 0.15;
const NARROW_TIE_MIN = 0.04;
const KNOWN_ITEMS = new Map(ITEMS.map(([name, category]) => [name, category]));

let classifierPromise = null;
let classifierProgressCallback = null;

function confident(itemName, extra = {}) {
  const category = KNOWN_ITEMS.get(itemName);
  if (!category) return { status: "uncertain", reason: "unknown-item" };
  return { status: "confident", itemName, category, ...extra };
}

function getClassifier(onProgress) {
  if (onProgress) classifierProgressCallback = onProgress;
  if (!classifierPromise) {
    classifierPromise = import(TRANSFORMERS_URL)
      .then(({ env, pipeline }) => {
        env.allowLocalModels = false;
        return pipeline("zero-shot-image-classification", CLIP_MODEL, {
          progress_callback: (progress) => {
            if (progress?.status === "progress" && classifierProgressCallback) {
              classifierProgressCallback(Math.round(progress.progress || 0));
            }
          },
        });
      })
      .catch((error) => {
        classifierPromise = null;
        console.warn("CLIP load error:", error);
        return null;
      });
  }
  return classifierPromise;
}

/** Précharge le modèle pendant que la personne choisit sa photo. */
export function preloadGarmentClassifier() {
  void getClassifier();
}

function buildViews(image) {
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) return [image.src];

  // Une seule image entière et réduite suffit au modèle, sans doubler
  // l'inférence avec un second cadrage central.
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return [image.src];
  drawContain(context, image, 512);
  return [canvas.toDataURL("image/jpeg", 0.85)];
}

function drawContain(context, image, size) {
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size, size);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return;
  const scale = Math.min(size / width, size / height);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  context.drawImage(
    image,
    (size - drawnWidth) / 2,
    (size - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  );
}

function detectShape(image) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  canvas.width = 64;
  canvas.height = 64;
  drawContain(context, image, 64);
  const pixels = context.getImageData(0, 0, 64, 64).data;
  const samples = [
    [1, 1],
    [32, 1],
    [62, 1],
    [1, 32],
    [62, 32],
    [1, 62],
    [32, 62],
    [62, 62],
  ];
  const background = { r: 0, g: 0, b: 0 };
  for (const [x, y] of samples) {
    const offset = (y * 64 + x) * 4;
    background.r += pixels[offset];
    background.g += pixels[offset + 1];
    background.b += pixels[offset + 2];
  }
  background.r /= samples.length;
  background.g /= samples.length;
  background.b /= samples.length;
  const columnCounts = new Array(64).fill(0);
  const rowCounts = new Array(64).fill(0);
  let total = 0;
  for (let y = 2; y < 62; y++) {
    for (let x = 2; x < 62; x++) {
      const offset = (y * 64 + x) * 4;
      const distance = Math.hypot(
        pixels[offset] - background.r,
        pixels[offset + 1] - background.g,
        pixels[offset + 2] - background.b,
      );
      if (distance > 50) {
        columnCounts[x]++;
        rowCounts[y]++;
        total++;
      }
    }
  }
  if (total < 40) return null;

  const span = (counts, ratio) => {
    const threshold = Math.max(...counts) * ratio;
    let first = -1;
    let last = -1;
    counts.forEach((count, index) => {
      if (count >= threshold) {
        if (first < 0) first = index;
        last = index;
      }
    });
    return [first, last];
  };
  const [left, right] = span(columnCounts, 0.25);
  const [top, bottom] = span(rowCounts, 0.1);
  if (left < 0 || right < left || top < 0 || bottom < top) return null;
  const width = right - left + 1;
  const height = bottom - top + 1;
  return {
    topRatio: top / 64,
    bottomRatio: (bottom + 1) / 64,
    widthRatio: width / 64,
    heightRatio: height / 64,
    aspect: width / height,
  };
}

function detectColoredTie(image) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  canvas.width = 64;
  canvas.height = 64;
  drawContain(context, image, 64);
  const pixels = context.getImageData(0, 0, 64, 64).data;
  let left = 64;
  let right = -1;
  let top = 64;
  let bottom = -1;
  let coloredPixels = 0;

  for (let y = 2; y < 62; y++) {
    for (let x = 2; x < 62; x++) {
      const offset = (y * 64 + x) * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const brightness = (red + green + blue) / 3;
      const saturation =
        Math.max(red, green, blue) - Math.min(red, green, blue);
      if (saturation > 40 && brightness < 200) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        coloredPixels++;
      }
    }
  }

  if (right < 0 || coloredPixels < 40) return false;
  const width = right - left + 1;
  const height = bottom - top + 1;
  return height / width >= 1.8 && width / 64 <= 0.4 && height / 64 >= 0.5;
}

async function classifyWithMobileNetFallback(image) {
  if (!window.mobilenet) {
    return { status: "uncertain", reason: "no-model" };
  }
  try {
    const model = await Promise.race([
      window.mobilenet.load(),
      new Promise((resolve) => setTimeout(() => resolve(null), 12000)),
    ]);
    if (!model) return { status: "uncertain", reason: "no-model" };
    const predictions = await Promise.race([
      model.classify(image),
      new Promise((resolve) => setTimeout(() => resolve([]), 5000)),
    ]);
    const neckwearRules = [
      [/\bbow[\s-]?tie\b|\bbowtie\b/, "Nœud papillon"],
      [/\b(necktie|neck tie|windsor tie|bolo tie|tie)\b/, "Cravate"],
    ];
    const generalRules = [
      [/\b(jean|jeans|denim)\b/, "Jean", "bas"],
      [/\b(skirt|hoopskirt)\b/, "Jupe", "bas"],
      [/\b(running shoe|sneaker)\b/, "Baskets", "chaussures"],
      [/\b(hoodie|sweatshirt)\b/, "Hoodie", "haut"],
      [/\b(sweater|pullover|cardigan|fleece|knit|wool)\b/, "Pull", "haut"],
      [/\b(jersey|t-shirt|tee shirt)\b/, "T-shirt", "haut"],
      [/\b(gown|sari|dress(?!\s+shirt))\b/, "Robe", "robe"],
    ];
    const labels = predictions
      .slice(0, 5)
      .map((prediction) => prediction.className.toLowerCase());
    for (const [regex, itemName] of neckwearRules) {
      if (labels.some((label) => regex.test(label))) return confident(itemName);
    }
    for (const label of labels.slice(0, 3)) {
      const match = generalRules.find(([regex]) => regex.test(label));
      if (match) return confident(match[1]);
    }
  } catch (error) {
    console.warn("MobileNet fallback error:", error);
  }
  return { status: "uncertain", reason: "unsupported" };
}

export async function classifyGarment(image, onStatus) {
  const initialShape = detectShape(image);
  const isNarrowTie =
    initialShape &&
    initialShape.aspect <= 0.45 &&
    initialShape.widthRatio <= 0.35 &&
    initialShape.heightRatio >= 0.55;
  const isColoredTie = detectColoredTie(image);
  if (isNarrowTie || isColoredTie) {
    return confident("Cravate");
  }

  const classifier = await getClassifier((progress) =>
    onStatus?.(`✨ Téléchargement du modèle IA : ${progress} %`),
  );
  if (!classifier) {
    onStatus?.("✨ Analyse rapide de l’image...");
    const fallback = await classifyWithMobileNetFallback(image);
    return fallback.status === "confident"
      ? fallback
      : isNarrowTie || isColoredTie
        ? confident("Cravate")
        : fallback;
  }

  const views = buildViews(image);
  const scores = new Map();
  for (const view of views) {
    const result = await classifier(view, PROMPTS, {
      hypothesis_template: "a photo of {}.",
    });
    for (const prediction of result) {
      scores.set(
        prediction.label,
        (scores.get(prediction.label) || 0) + prediction.score / views.length,
      );
    }
  }

  const ranked = ITEMS.map(([name, category, prompts]) => ({
    name,
    category,
    score: Math.max(...prompts.map((prompt) => scores.get(prompt) || 0)),
  })).sort((a, b) => b.score - a.score);
  const shape = initialShape;
  const narrow =
    shape &&
    shape.aspect <= 0.45 &&
    shape.widthRatio <= 0.35 &&
    shape.heightRatio >= 0.55;
  let best = ranked[0];
  const pull = ranked.find((item) => item.name === "Pull");
  const neckTie = ranked.find((item) => item.name === "Cravate");
  const bestAccessory = ranked.find((item) => item.category === "accessoires");

  if (
    best &&
    best.category !== "accessoires" &&
    neckTie &&
    (narrow || neckTie.score >= TIE_SCORE)
  ) {
    best = neckTie;
  }
  if (best?.name === "Cravate" && narrow && best.score >= NARROW_TIE_MIN) {
    return confident("Cravate", { score: best.score });
  }

  // Les pulls col zippé ou portés sur une chemise sont souvent classés
  // comme "Chemise" par CLIP : privilégier Pull quand les scores sont proches.
  if (best?.name === "Chemise" && pull && pull.score >= best.score - 0.08) {
    best = pull;
  }

  const second = ranked.find((item) => item !== best);

  if (
    best &&
    second &&
    best.category !== "accessoires" &&
    [best.name, second.name].sort().join("|") === "Jupe|Robe" &&
    shape
  ) {
    const skirtShape = shape.topRatio >= 0.12 && shape.bottomRatio >= 0.65;
    best = ranked.find((item) => item.name === (skirtShape ? "Jupe" : "Robe"));
  }

  if (
    best &&
    best.name === "Robe" &&
    shape &&
    shape.heightRatio >= 0.55 &&
    shape.aspect >= 0.35 &&
    shape.aspect <= 0.8
  ) {
    return {
      status: "confident",
      itemName: "Robe",
      category: "robe",
      score: best.score,
    };
  }

  if (!best || best.score < MIN_SCORE) {
    return { status: "uncertain", reason: "low-confidence" };
  }
  const rival = ranked.find(
    (item) => item !== best && item.category !== best.category,
  );
  if (rival && best.score - rival.score < MIN_MARGIN) {
    return { status: "uncertain", reason: "ambiguous" };
  }
  if (
    best.name === "Robe" &&
    (!shape || shape.aspect < 0.35) &&
    (!rival || best.score - rival.score < DRESS_MARGIN)
  ) {
    return { status: "uncertain", reason: "dress-not-confirmed" };
  }
  return confident(best.name, { score: best.score });
}
