/**
 * Module d'analyse de couleur et de motif à partir d'un élément image via Canvas.
 */

// Noms de couleurs de la palette et groupements
export const NEUTRAL_COLORS = ["blanc", "noir", "gris", "beige"];
export const VIVID_COLORS = [
  "rose",
  "rouge",
  "bordeaux",
  "bleu",
  "bleu ciel",
  "bleu marine",
  "vert",
  "kaki",
  "jaune",
  "orange",
  "marron",
  "violet",
];

// Familles de couleurs similaires (ne doivent jamais être considérées comme un motif multicolore ensemble)
export const SAME_COLOR_FAMILIES = {
  "bleu marine": ["bleu marine", "bleu", "bleu ciel", "noir"],
  bleu: ["bleu marine", "bleu", "bleu ciel"],
  "bleu ciel": ["bleu marine", "bleu", "bleu ciel"],
  vert: ["vert", "kaki"],
  kaki: ["vert", "kaki"],
  rouge: ["rouge", "bordeaux"],
  bordeaux: ["rouge", "bordeaux"],
  noir: ["noir", "gris", "bleu marine"],
  blanc: ["blanc", "beige", "gris"],
  gris: ["gris", "noir", "blanc"],
  orange: ["orange", "jaune"],
  jaune: ["jaune", "orange"],
};

/**
 * Classifie un pixel RGB dans l'une des 16 couleurs de la garde-robe.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string} Nom de la couleur
 */
export function classifyPixelColor(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  // 1. Rose (placé en premier pour éviter que les logos roses soient assimilés au rouge)
  if (r > 115 && b > 75 && r > g + 15 && b > g - 25) {
    return "rose";
  }

  // 2. Kaki & Vert (vérifié avant gris et marron)
  if (
    g >= 24 &&
    g > b + 7 &&
    r > b + 7 &&
    g >= r - 4 &&
    Math.abs(r - g) <= 16 &&
    b < 110
  ) {
    return "kaki";
  }
  if (g >= 26 && g > b + 5 && g >= r + 2) {
    if (r >= 24 && Math.abs(r - g) <= 20 && b < 95) return "kaki";
    return "vert";
  }

  // Blanc cassé / crème
  if (r >= 150 && g >= 145 && b >= 125 && max - min <= 42 && r - g <= 20) {
    return "beige";
  }

  // 3. Orange / Jaune
  if (r >= 65 && g >= 40 && r > b + 18 && g > b + 8 && r >= g - 4) {
    return r > g + 10 ? "orange" : "jaune";
  }

  // 4. Rouge / Bordeaux
  if (r > 42 && r > g * 1.3 && r > b * 1.3) {
    return max < 120 ? "bordeaux" : "rouge";
  }

  // 5. Bleu marine / Bleu / Bleu ciel
  if (b >= 24 && b > r + 14 && b > g + 8) {
    if (max < 110) return "bleu marine";
    if (b > 145 && g > 125) return "bleu ciel";
    return "bleu";
  }

  // 6. Noir
  if (max < 38 || (max < 50 && diff < 10)) {
    return "noir";
  }

  // 7. Blanc
  if (diff < 26 && min > 190) {
    return "blanc";
  }

  // 8. Gris
  if (diff < 22 && max <= 190 && max >= 48) {
    return "gris";
  }

  // 9. Marron
  if (r > 60 && g > 28 && b < 60 && r > g + 12 && g > b && max < 140) {
    return "marron";
  }

  // 10. Beige
  if (r > 145 && g > 130 && b > 105 && r >= g && Math.abs(r - g) < 30) {
    return "beige";
  }

  // 11. Violet
  if (r > 60 && b > 70 && g < Math.min(r, b) - 16) {
    return "violet";
  }

  // Distance euclidienne en repli
  const paletteRef = [
    { name: "blanc", r: 245, g: 245, b: 245 },
    { name: "noir", r: 25, g: 25, b: 25 },
    { name: "gris", r: 140, g: 140, b: 140 },
    { name: "bleu ciel", r: 160, g: 195, b: 235 },
    { name: "bleu", r: 80, g: 120, b: 190 },
    { name: "bleu marine", r: 20, g: 30, b: 65 },
    { name: "rouge", r: 200, g: 30, b: 30 },
    { name: "bordeaux", r: 110, g: 15, b: 35 },
    { name: "vert", r: 34, g: 139, b: 34 },
    { name: "kaki", r: 80, g: 90, b: 45 },
    { name: "jaune", r: 240, g: 215, b: 30 },
    { name: "orange", r: 240, g: 120, b: 20 },
    { name: "rose", r: 245, g: 140, b: 170 },
    { name: "beige", r: 210, g: 195, b: 170 },
    { name: "marron", r: 110, g: 60, b: 30 },
    { name: "violet", r: 128, g: 40, b: 160 },
  ];

  let minDist = Infinity;
  let closest = "noir";
  for (const p of paletteRef) {
    const d = Math.hypot(r - p.r, g - p.g, b - p.b);
    if (d < minDist) {
      minDist = d;
      closest = p.name;
    }
  }
  return closest;
}

/**
 * Détecte les couleurs dominantes et le motif à partir de l'image du vêtement.
 * @param {HTMLImageElement} imgElement
 * @param {string|null} [categoryHint=null]
 * @returns {{ colors: string, pattern: "uni"|"motif" }}
 */
export function extractDominantColors(imgElement, categoryHint = null) {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const size = 160;
    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(imgElement, 0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size).data;

    // 1. Détection de l'arrière-plan à partir des coins
    const cornerCoords = [
      [2, 2],
      [size - 3, 2],
      [2, size - 3],
      [size - 3, size - 3],
      [6, 6],
      [size - 7, 6],
      [6, size - 7],
      [size - 7, size - 7],
    ];
    let cornerWhiteCount = 0;
    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    cornerCoords.forEach(([x, y]) => {
      const idx = (y * size + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      bgR += r;
      bgG += g;
      bgB += b;
      if (r > 215 && g > 215 && b > 215) {
        cornerWhiteCount++;
      }
    });
    bgR /= cornerCoords.length;
    bgG /= cornerCoords.length;
    bgB /= cornerCoords.length;

    const isWhiteBackground =
      cornerWhiteCount >= 4 || (bgR > 220 && bgG > 220 && bgB > 220);

    // 2. Zone d'échantillonnage adaptative selon la catégorie
    let yStart = Math.floor(size * 0.16);
    let yEnd = Math.floor(size * 0.84);
    let xStart = Math.floor(size * 0.16);
    let xEnd = Math.floor(size * 0.84);

    if (categoryHint === "bas") {
      yStart = Math.floor(size * 0.28);
      yEnd = Math.floor(size * 0.66);
      xStart = Math.floor(size * 0.24);
      xEnd = Math.floor(size * 0.76);
    } else if (categoryHint === "haut") {
      yStart = Math.floor(size * 0.16);
      yEnd = Math.floor(size * 0.48);
      xStart = Math.floor(size * 0.28);
      xEnd = Math.floor(size * 0.72);
    } else if (categoryHint === "chaussures") {
      yStart = Math.floor(size * 0.26);
      yEnd = Math.floor(size * 0.74);
      xStart = Math.floor(size * 0.18);
      xEnd = Math.floor(size * 0.82);
    }

    const subjectPixels = [];
    let highContrastEdges = 0;

    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const idx = (y * size + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const a = imgData[idx + 3];
        if (a < 128) continue;

        if (isWhiteBackground) {
          if (r > 215 && g > 215 && b > 215) continue;
          if (Math.hypot(r - bgR, g - bgG, b - bgB) < 35) continue;
        } else {
          const distToBg = Math.hypot(r - bgR, g - bgG, b - bgB);
          if (distToBg < 52) continue;
        }

        // Ignorer le teint de peau humain
        const isSkin =
          r > 120 &&
          g > 75 &&
          b > 55 &&
          r > g &&
          g > b &&
          r - b > 20 &&
          r - g < 75;
        if (isSkin) continue;

        subjectPixels.push({ r, g, b });

        // Contraste local pour motifs / textures
        if (x < xEnd - 1 && y < yEnd - 1) {
          const rRight = imgData[idx + 4];
          const gRight = imgData[idx + 5];
          const bRight = imgData[idx + 6];
          const rDown = imgData[((y + 1) * size + x) * 4];
          const gDown = imgData[((y + 1) * size + x) * 4 + 1];
          const bDown = imgData[((y + 1) * size + x) * 4 + 2];

          const diffX = Math.hypot(r - rRight, g - gRight, b - bRight);
          const diffY = Math.hypot(r - rDown, g - gDown, b - bDown);
          const isBgLike = (rr, gg, bb) =>
            isWhiteBackground
              ? rr > 215 && gg > 215 && bb > 215
              : Math.hypot(rr - bgR, gg - bgG, bb - bgB) < 52;
          const rightIsBg = isBgLike(rRight, gRight, bRight);
          const downIsBg = isBgLike(rDown, gDown, bDown);
          if (!rightIsBg && diffX > 45) {
            highContrastEdges += 0.5;
          }
          if (!downIsBg && diffY > 45) {
            highContrastEdges += 0.5;
          }
        }
      }
    }

    if (subjectPixels.length < 60) {
      for (let y = Math.floor(size * 0.2); y < Math.floor(size * 0.8); y++) {
        for (let x = Math.floor(size * 0.2); x < Math.floor(size * 0.8); x++) {
          const idx = (y * size + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const isSkin =
            r > 130 && g > 85 && b > 65 && r > g && g > b && r - b > 25;
          if (!isSkin) {
            subjectPixels.push({ r, g, b });
          }
        }
      }
    }

    // 3. Décompte des couleurs
    const colorCounts = {};
    for (const px of subjectPixels) {
      const colorName = classifyPixelColor(px.r, px.g, px.b);
      colorCounts[colorName] = (colorCounts[colorName] || 0) + 1;
    }

    const sortedColors = Object.entries(colorCounts).sort(
      (a, b) => b[1] - a[1],
    );
    const totalSampled = subjectPixels.length || 1;

    let primaryColor = sortedColors.length > 0 ? sortedColors[0][0] : "noir";
    let secondColorName = null;
    let detectedPattern = "uni";

    if (categoryHint === "accessoires" && primaryColor === "gris") {
      const darkNeutralPixels = subjectPixels.filter(({ r, g, b }) => {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return max < 115 && max - min < 28;
      });
      const darkNeutralRatio = darkNeutralPixels.length / totalSampled;
      const averageBrightness =
        subjectPixels.reduce((sum, { r, g, b }) => sum + (r + g + b) / 3, 0) /
        totalSampled;
      if (darkNeutralRatio >= 0.42 && averageBrightness < 135) {
        primaryColor = "noir";
      }
    }

    const orangeEntry = sortedColors.find(([name]) => name === "orange");
    const yellowEntry = sortedColors.find(([name]) => name === "jaune");
    const warmAccent = orangeEntry || yellowEntry;
    if (
      categoryHint === "haut" &&
      ["noir", "gris", "bleu marine"].includes(primaryColor) &&
      warmAccent &&
      warmAccent[1] / totalSampled >= 0.012
    ) {
      primaryColor = "noir";
      secondColorName = warmAccent[0] === "jaune" ? "orange" : "orange";
      detectedPattern = "motif";
    }

    const navyItem = sortedColors.find(
      (c) => c[0] === "bleu marine" && c[1] / totalSampled > 0.06,
    );
    if (
      navyItem &&
      (primaryColor === "noir" || primaryColor === "bleu marine")
    ) {
      primaryColor = "bleu marine";
    }

    const blackItem = sortedColors.find(([name]) => name === "noir");
    const whiteItem = sortedColors.find(([name]) => name === "blanc");
    if (
      categoryHint === "haut" &&
      whiteItem &&
      whiteItem[1] / totalSampled >= 0.16 &&
      ["beige", "gris"].includes(primaryColor)
    ) {
      primaryColor = "blanc";
      secondColorName = null;
    }
    if (
      (categoryHint === "haut" || categoryHint === "chaussures") &&
      primaryColor === "bleu marine" &&
      blackItem &&
      blackItem[1] >= (navyItem ? navyItem[1] : 0) * 0.75
    ) {
      primaryColor = "noir";
    }
    if (
      categoryHint === "chaussures" &&
      whiteItem &&
      whiteItem[1] / totalSampled >= 0.18 &&
      primaryColor !== "noir"
    ) {
      primaryColor = "blanc";
    }

    if (sortedColors.length > 0) {
      const edgeRatio = highContrastEdges / totalSampled;
      const primaryFamily = SAME_COLOR_FAMILIES[primaryColor] || [primaryColor];

      if (categoryHint === "chaussures" && primaryColor === "blanc") {
        const blackEntry = sortedColors.find(
          (c) => c[0] === "noir" && c[1] / totalSampled > 0.02,
        );
        if (blackEntry) {
          secondColorName = "noir";
        }
      }

      if (
        !secondColorName &&
        categoryHint === "haut" &&
        (primaryColor === "bleu ciel" || primaryColor === "bleu")
      ) {
        const whiteEntry = sortedColors.find(
          (c) => c[0] === "blanc" && c[1] / totalSampled > 0.03,
        );
        if (whiteEntry || edgeRatio > 0.04) {
          secondColorName = "blanc";
        }
      }

      if (categoryHint === "haut" && primaryColor === "blanc") {
        secondColorName = null;
      }

      if (!secondColorName) {
        for (const [colName, count] of sortedColors.slice(1)) {
          const ratio = count / totalSampled;
          if (primaryFamily.includes(colName)) continue;

          if (
            categoryHint === "haut" &&
            (primaryColor === "bleu" || primaryColor === "bleu ciel")
          ) {
            if (["orange", "marron", "beige"].includes(colName) && ratio < 0.2)
              continue;
          }
          if (
            categoryHint === "haut" &&
            ["beige", "gris", "blanc"].includes(primaryColor) &&
            ["orange", "jaune"].includes(colName) &&
            ratio < 0.18
          ) {
            continue;
          }
          if (
            categoryHint === "haut" &&
            primaryColor === "blanc" &&
            colName !== "noir"
          ) {
            continue;
          }
          if (
            categoryHint === "chaussures" &&
            primaryColor === "blanc" &&
            ["bleu", "bleu ciel", "gris", "beige"].includes(colName)
          ) {
            continue;
          }

          const isEarthToneBottom =
            categoryHint === "bas" &&
            ["marron", "bordeaux", "beige"].includes(primaryColor) &&
            ["orange", "rouge", "bordeaux", "marron", "beige"].includes(
              colName,
            );
          const minVividRatio =
            categoryHint === "chaussures"
              ? 0.025
              : categoryHint === "haut"
                ? 0.02
                : isEarthToneBottom
                  ? 0.12
                  : 0.004;
          if (VIVID_COLORS.includes(colName) && ratio > minVividRatio) {
            secondColorName = colName;
            break;
          }

          if (primaryColor === "blanc" && colName === "noir" && ratio > 0.03) {
            secondColorName = colName;
            break;
          }

          if (
            categoryHint !== "bas" &&
            primaryColor !== "blanc" &&
            colName === "blanc" &&
            ratio > 0.05
          ) {
            secondColorName = colName;
            break;
          }
        }
      }

      const isSolidEarthToneBottom =
        categoryHint === "bas" &&
        ["marron", "bordeaux", "beige"].includes(primaryColor);
      const isSolidKakiBottom =
        categoryHint === "bas" && primaryColor === "kaki";
      const isSolidAccessory =
        categoryHint === "accessoires" &&
        ((["rouge", "bordeaux", "rose"].includes(primaryColor) &&
          secondColorName &&
          ["rouge", "bordeaux", "rose"].includes(secondColorName)) ||
          (["bleu", "bleu ciel", "bleu marine"].includes(primaryColor) &&
            secondColorName &&
            ["bleu", "bleu ciel", "bleu marine"].includes(secondColorName)));
      const isNeutralSolidTop =
        categoryHint === "haut" &&
        ["blanc", "gris", "beige"].includes(primaryColor) &&
        (!secondColorName ||
          ["blanc", "gris", "beige"].includes(secondColorName));

      if (isSolidEarthToneBottom || isSolidKakiBottom) {
        if (primaryColor === "bordeaux" || primaryColor === "beige") {
          primaryColor = "marron";
        }
        secondColorName = null;
      }
      if (isSolidAccessory) {
        secondColorName = null;
      }

      const secondaryColorRatio = secondColorName
        ? (sortedColors.find(([name]) => name === secondColorName) || [
            null,
            0,
          ])[1] / totalSampled
        : 0;
      const isBroadRobeContrast =
        categoryHint === "robe" &&
        secondaryColorRatio >= 0.08 &&
        edgeRatio > 0.02;
      const isBroadAccessoryContrast =
        categoryHint === "accessoires" &&
        secondaryColorRatio >= 0.12 &&
        !isSolidAccessory;

      if (categoryHint === "robe" && !isBroadRobeContrast) {
        secondColorName = null;
      }
      if (categoryHint === "accessoires" && !isBroadAccessoryContrast) {
        secondColorName = null;
      }

      if (
        secondColorName &&
        !isSolidEarthToneBottom &&
        (categoryHint !== "robe" || isBroadRobeContrast) &&
        (categoryHint !== "accessoires" || isBroadAccessoryContrast)
      ) {
        detectedPattern = "motif";
      } else if (
        categoryHint === "haut" &&
        primaryColor !== "blanc" &&
        edgeRatio > 0.045 &&
        !isNeutralSolidTop
      ) {
        detectedPattern = "motif";
      } else if (
        categoryHint !== "bas" &&
        categoryHint !== "robe" &&
        edgeRatio > 0.16
      ) {
        detectedPattern = "motif";
      } else {
        detectedPattern = "uni";
      }

      if (
        categoryHint === "haut" &&
        primaryColor === "beige" &&
        !secondColorName
      ) {
        detectedPattern = "uni";
      }
    }

    const finalColors = secondColorName
      ? `${primaryColor}, ${secondColorName}`
      : primaryColor;
    return { colors: finalColors, pattern: detectedPattern };
  } catch (e) {
    console.error("Color extraction error:", e);
    return { colors: "noir", pattern: "uni" };
  }
}
