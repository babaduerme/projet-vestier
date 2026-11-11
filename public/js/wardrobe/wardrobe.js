import {
  db,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
} from "../core/config.js";
import { initAuth } from "../auth/auth.js";
import { showToast } from "../core/ui-utils.js";
import { extractDominantColors } from "./color-analysis.js";
import { classifyGarment } from "./garment-classifier.js";
import {
  GARMENT_TYPES,
  SLOTS,
  TYPE_TO_SLOT,
  detectGarmentType,
  migrateGarment,
  normalizeGarmentSlot,
  resolveGarmentColors,
} from "../shared/outfit-matcher.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Éléments DOM
const modalOverlay = document.getElementById("add-modal");
const openModalBtn = document.getElementById("open-modal-btn");
const emptyWardrobeAddBtn = document.getElementById("empty-wardrobe-add-btn");
const closeBtns = document.querySelectorAll(".close-modal, .close-modal-btn");
const uploadArea = document.getElementById("upload-area");
const fileInput = document.getElementById("file-input");
const cameraInput = document.getElementById("camera-input");
const cameraTrigger = document.getElementById("camera-trigger");
const galleryTrigger = document.getElementById("gallery-trigger");
const cameraModal = document.getElementById("camera-modal");
const cameraVideo = document.getElementById("camera-video");
const cameraStatus = document.getElementById("camera-status");
const cameraCaptureBtn = document.getElementById("camera-capture-btn");
const cameraCancelBtn = document.getElementById("camera-cancel-btn");
const imgPreview = document.getElementById("img-preview");
const addClothForm = document.getElementById("add-cloth-form");
const submitBtn = document.getElementById("submit-cloth-btn");
const clothesGrid = document.getElementById("clothes-grid");
const loadMoreBtn = document.getElementById("load-more-clothes-btn");
const emptyState = document.getElementById("empty-state");
const clothCountSpan = document.getElementById("cloth-count");
const filterPills = document.querySelectorAll(".filter-pill");

emptyWardrobeAddBtn?.addEventListener("click", () => openModalBtn?.click());

let currentUser = null;
let allClothes = [];
let currentFilter = "tous";
let selectedFile = null;
let previewObjectUrl = null;
let analysisVersion = 0;
let stopClothesListener = null;
let clothesCursor = null;
let hasMoreClothes = false;
let clothesPageSize = 6;
let editingClothId = null;
let editingClothImageUrl = null;
let cameraStream = null;

/**
 * Calcule la taille d'une page de vêtements selon la largeur de l'écran (2 rangées complètes).
 * @returns {number}
 */
function getClothesPageSize() {
  const viewportWidth = window.innerWidth || 1024;
  const columns =
    viewportWidth <= 560
      ? 1
      : viewportWidth <= 980
        ? 2
        : viewportWidth >= 1300
          ? 4
          : 3;
  return columns * 2;
}

const categoryLabels = {
  haut: "Haut",
  bas: "Bas",
  robe: "Robe",
  manteau: "Manteau",
  chaussures: "Chaussures",
  accessoires: "Accessoires",
  ensemble: "Ensemble",
};
const VALID_CATEGORIES = Object.keys(categoryLabels);

function isValidClassification(result) {
  return (
    result?.status === "confident" &&
    typeof result.itemName === "string" &&
    result.itemName.trim() !== "" &&
    VALID_CATEGORIES.includes(result.category)
  );
}

// Initialisation de l'authentification avec redirection automatique
initAuth((user) => {
  stopClothesListener?.();
  currentUser = user;
  loadClothes();
});

// Gestion des motifs (Uni / Motif)
const btnPatternUni = document.getElementById("btn-pattern-uni");
const btnPatternMotif = document.getElementById("btn-pattern-motif");
const clothPatternInput = document.getElementById("cloth-pattern");

function setPattern(pattern) {
  if (!clothPatternInput) return;
  clothPatternInput.value = pattern;
  if (pattern === "uni") {
    btnPatternUni?.classList.add("active");
    btnPatternMotif?.classList.remove("active");
  } else {
    btnPatternMotif?.classList.add("active");
    btnPatternUni?.classList.remove("active");
  }
}

if (btnPatternUni && btnPatternMotif) {
  btnPatternUni.addEventListener("click", () => setPattern("uni"));
  btnPatternMotif.addEventListener("click", () => setPattern("motif"));
}

// Sélection des couleurs dans la palette
const colorSwatches = document.querySelectorAll(".color-swatch");
const clothColorsInput = document.getElementById("cloth-colors");
const selectedColorsLabel = document.getElementById("selected-colors-label");

function getSelectedColors() {
  return Array.from(document.querySelectorAll(".color-swatch.selected")).map(
    (el) => el.dataset.color,
  );
}

function updateColorsState() {
  const selected = getSelectedColors();
  if (clothColorsInput) clothColorsInput.value = selected.join(", ");
  if (selectedColorsLabel) {
    selectedColorsLabel.textContent = selected.length
      ? `(${selected.join(", ")})`
      : "(Clique pour cocher)";
  }
}

function selectColorsByName(colorNames) {
  if (!colorNames) return;
  const names = Array.isArray(colorNames)
    ? colorNames.map((c) => c.trim().toLowerCase())
    : colorNames.split(",").map((c) => c.trim().toLowerCase());

  colorSwatches.forEach((swatch) => {
    const swatchColor = (swatch.dataset.color || "").trim().toLowerCase();
    if (names.includes(swatchColor)) {
      swatch.classList.add("selected");
    }
  });
  updateColorsState();
}

function clearColorSelection() {
  colorSwatches.forEach((s) => s.classList.remove("selected"));
  updateColorsState();
}

colorSwatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    swatch.classList.toggle("selected");
    updateColorsState();
  });
});

// Fonctions de modale d'ajout
function openModal() {
  closeCameraCapture();
  editingClothId = null;
  editingClothImageUrl = null;
  analysisVersion += 1;
  modalOverlay.classList.add("active");
  addClothForm.reset();
  setPattern("uni");
  clearColorSelection();
  imgPreview.style.display = "none";
  selectedFile = null;
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
  const modalTitle = document.getElementById("add-modal-title");
  if (modalTitle) modalTitle.textContent = "Ajouter un vêtement";
  if (submitBtn) submitBtn.textContent = "Ajouter";
  Array.from(uploadArea.children).forEach((child) => {
    if (
      child.id !== "img-preview" &&
      child.id !== "file-input" &&
      child.id !== "camera-input" &&
      child.id !== "ai-analyzing"
    ) {
      child.style.display = "";
    }
  });
}

/**
 * Ouvre la modale en mode modification, préremplie avec le vêtement choisi.
 * @param {object} cloth
 */
function openEditModal(cloth) {
  if (!cloth) return;
  openModal();
  editingClothId = cloth.id;
  editingClothImageUrl = cloth.imageUrl || null;

  const modalTitle = document.getElementById("add-modal-title");
  if (modalTitle) modalTitle.textContent = "Modifier un vêtement";
  if (submitBtn) submitBtn.textContent = "Enregistrer";

  document.getElementById("cloth-name").value = cloth.name || "";
  document.getElementById("cloth-category").value = cloth.category || "haut";
  document.getElementById("cloth-desc").value = cloth.description || "";
  setPattern(cloth.pattern === "motif" ? "motif" : "uni");
  selectColorsByName(cloth.colors);

  if (cloth.imageUrl) {
    imgPreview.src = cloth.imageUrl;
    imgPreview.style.display = "block";
  }
}

function closeModal() {
  modalOverlay.classList.remove("active");
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

openModalBtn?.addEventListener("click", openModal);
closeBtns.forEach((btn) => btn.addEventListener("click", closeModal));

uploadArea?.addEventListener("click", (event) => {
  // Les boutons « photo » et « image » gèrent leur propre sélecteur.
  if (event.target.closest("button")) return;
  fileInput.click();
});

cameraTrigger?.addEventListener("click", (event) => {
  event.stopPropagation();
  void openCameraCapture();
});

galleryTrigger?.addEventListener("click", (event) => {
  event.stopPropagation();
  fileInput.click();
});

function stopCameraStream() {
  if (cameraVideo) {
    cameraVideo.pause();
    cameraVideo.srcObject = null;
  }
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
}

function closeCameraCapture() {
  stopCameraStream();
  cameraModal?.classList.remove("active");
  cameraModal?.setAttribute("aria-hidden", "true");
  if (cameraCaptureBtn) cameraCaptureBtn.disabled = true;
}

/**
 * Ouvre la vraie caméra via getUserMedia. Le champ fichier `capture` n'est pas
 * fiable sur ordinateur : le navigateur peut ouvrir le sélecteur de documents.
 */
async function openCameraCapture() {
  if (!cameraModal || !cameraVideo) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    showToast(
      "Caméra directe indisponible sur ce navigateur. Ouverture de l'appareil photo ou des documents.",
      "error",
    );
    cameraInput.click();
    return;
  }

  cameraModal.classList.add("active");
  cameraModal.setAttribute("aria-hidden", "false");
  if (cameraStatus) cameraStatus.textContent = "Initialisation de la caméra...";
  if (cameraCaptureBtn) cameraCaptureBtn.disabled = true;

  try {
    stopCameraStream();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 1280 },
      },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    if (cameraStatus) cameraStatus.textContent = "Cadre le vêtement puis appuie sur Capturer.";
    if (cameraCaptureBtn) cameraCaptureBtn.disabled = false;
  } catch (error) {
    console.warn("Caméra indisponible :", error);
    closeCameraCapture();
    showToast(
      "Caméra indisponible ou refusée. Ouvre l'appareil photo ou tes documents.",
      "error",
    );
    cameraInput.click();
  }
}

async function captureCameraPhoto() {
  if (!cameraStream || !cameraVideo?.videoWidth) {
    showToast("La caméra n'est pas encore prête.", "error");
    return;
  }

  if (cameraCaptureBtn) cameraCaptureBtn.disabled = true;
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(cameraVideo.videoWidth, cameraVideo.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cameraVideo.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(cameraVideo.videoHeight * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    closeCameraCapture();
    showToast("Impossible de capturer la photo.", "error");
    return;
  }
  context.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) {
    closeCameraCapture();
    showToast("Impossible de capturer la photo.", "error");
    return;
  }

  const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
  closeCameraCapture();
  processSelectedFile(file);
}

/**
 * Traite un fichier image, qu'il vienne de la caméra ou des documents.
 * @param {File} file
 * @returns {boolean}
 */
function processSelectedFile(file) {
  if (!file) return false;

  analysisVersion += 1;
  const currentAnalysisVersion = analysisVersion;
  selectedFile = file;

  if (!selectedFile.type.startsWith("image/")) {
    showToast("Sélectionne un fichier image valide.", "error");
    selectedFile = null;
    return false;
  }

  if (selectedFile.size > 5 * 1024 * 1024) {
    showToast("L'image est trop grande (max 5MB)", "error");
    selectedFile = null;
    return false;
  }

  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(selectedFile);
  Array.from(uploadArea.children).forEach((child) => {
    if (
      child.id !== "img-preview" &&
      child.id !== "file-input" &&
      child.id !== "camera-input" &&
      child.id !== "ai-analyzing"
    ) {
      child.style.display = "none";
    }
  });

  imgPreview.src = previewObjectUrl;
  imgPreview.style.display = "block";

  imgPreview.onload = () => {
    analyzeUploadedImageWithClassifier(imgPreview, currentAnalysisVersion);
  };
  return true;
}

cameraCancelBtn?.addEventListener("click", closeCameraCapture);
cameraCaptureBtn?.addEventListener("click", () => {
  void captureCameraPhoto();
});
cameraModal?.addEventListener("click", (event) => {
  if (event.target === cameraModal) closeCameraCapture();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cameraModal?.classList.contains("active")) {
    closeCameraCapture();
  }
});

// Analyse IA d'une photo téléversée
async function analyzeUploadedImageWithClassifier(imgElement, version = analysisVersion) {
  const aiIndicator = document.getElementById("ai-analyzing");
  const nameInput = document.getElementById("cloth-name");
  const categorySelect = document.getElementById("cloth-category");
  if (aiIndicator) {
    aiIndicator.textContent = "✨ Analyse IA en cours...";
    aiIndicator.style.display = "block";
  }

  try {
    const result = await classifyGarment(imgElement, (message) => {
      if (aiIndicator) aiIndicator.textContent = message;
    });

    if (version !== analysisVersion) return;
    let isConfident = isValidClassification(result);
    if (isConfident) {
      categorySelect.value = result.category;
      if (categorySelect.value !== result.category) isConfident = false;
    }
    const categoryHint = isConfident ? result.category : null;
    const { colors, pattern } = extractDominantColors(imgElement, categoryHint);
    clearColorSelection();
    selectColorsByName(colors);
    setPattern(pattern);

    if (isConfident) {
      const patternText = pattern === "motif" ? " à motifs" : "";
      const colorDisplay = colors ? colors.replace(",", " et") : "";
      nameInput.value = `${result.itemName} ${colorDisplay}${patternText}`.trim();
      showToast(`IA : ${result.itemName} (${colors}, ${pattern}) détecté ! ✨`);
    } else {
      nameInput.value = "";
      if (
        Array.from(categorySelect.options).some((option) => option.value === "")
      ) {
        categorySelect.value = "";
      }
      showToast(
        "IA : type de vêtement incertain. Vérifie la catégorie et le nom.",
        "error",
      );
    }
  } catch (error) {
    if (version !== analysisVersion) return;
    console.error("Erreur classification de vêtement :", error);
    showToast("Analyse impossible. Choisis la catégorie et le nom.", "error");
  } finally {
    if (version === analysisVersion && aiIndicator) {
      aiIndicator.style.display = "none";
    }
  }
}

function handleSelectedImage(event) {
  const input = event.currentTarget;
  const file = event.target.files?.[0];
  // Réinitialiser permet de resélectionner le même fichier plus tard.
  input.value = "";
  if (file) processSelectedFile(file);
}

fileInput?.addEventListener("change", handleSelectedImage);
cameraInput?.addEventListener("change", handleSelectedImage);

// Optimisation d'image (redimensionnement WebP avant upload)
async function optimizeImageForUpload(file) {
  if (!file || !file.type.startsWith("image/")) return file;

  const maxSide = 1280;
  let bitmap = null;
  let objectUrl = null;
  try {
    if ("createImageBitmap" in window) {
      bitmap = await createImageBitmap(file);
    } else {
      objectUrl = URL.createObjectURL(file);
      bitmap = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = objectUrl;
      });
    }

    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82),
    );
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "vetement";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

// Upload Cloudinary
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Cloudinary upload failed");
    }
    if (data.secure_url) {
      return data.secure_url;
    }
    throw new Error("Upload failed");
  } catch (error) {
    console.error("Erreur upload Cloudinary :", error);
    throw error;
  }
}

// Ajout ou modification d'un vêtement dans Firestore
addClothForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = editingClothId ? "Enregistrement..." : "Ajout...";

  const restoreSubmitLabel = () => {
    submitBtn.disabled = false;
    submitBtn.textContent = editingClothId ? "Enregistrer" : "Ajouter";
  };

  try {
    let imageUrl = editingClothId ? editingClothImageUrl : null;
    if (selectedFile) {
      const optimizedFile = await optimizeImageForUpload(selectedFile);
      imageUrl = await uploadToCloudinary(optimizedFile);
    }

    const selectedColors = document.getElementById("cloth-colors").value;
    if (!selectedColors) {
      showToast(
        "Veuillez sélectionner au moins une couleur sur la palette.",
        "error",
      );
      restoreSubmitLabel();
      return;
    }

    const nameValue = document.getElementById("cloth-name").value.trim();
    const categoryValue = document.getElementById("cloth-category").value;
    if (!nameValue || !VALID_CATEGORIES.includes(categoryValue)) {
      showToast("Renseigne un nom et une catégorie valides.", "error");
      restoreSubmitLabel();
      return;
    }

    if (nameValue.length > 80) {
      showToast("Le nom ne doit pas dépasser 80 caractères.", "error");
      restoreSubmitLabel();
      return;
    }

    const descriptionValue = document.getElementById("cloth-desc").value.trim();
    if (descriptionValue.length > 500) {
      showToast("La description ne doit pas dépasser 500 caractères.", "error");
      restoreSubmitLabel();
      return;
    }

    const detectedType = detectGarmentType(nameValue, categoryValue);
    const resolvedSlot = TYPE_TO_SLOT[detectedType] || null;
    const colorResolution = resolveGarmentColors(
      { name: nameValue, colors: selectedColors },
      selectedColors,
    );

    const clothData = {
      name: nameValue,
      type: detectedType,
      slot: resolvedSlot,
      category: categoryValue,
      pattern: document.getElementById("cloth-pattern").value || "uni",
      colors: selectedColors,
      colorSource: "user",
      colorConfidence: colorResolution.colorConfidence,
      description: descriptionValue,
      imageUrl: imageUrl,
    };

    if (editingClothId) {
      await updateDoc(doc(db, `users/${currentUser.uid}/clothes`, editingClothId), {
        ...clothData,
        updatedAt: serverTimestamp(),
      });
      closeModal();
      showToast("Vêtement modifié avec succès !");
    } else {
      await addDoc(collection(db, `users/${currentUser.uid}/clothes`), {
        ...clothData,
        createdAt: serverTimestamp(),
      });
      closeModal();
      showToast("Vêtement ajouté avec succès !");
    }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement Firestore :", error);
    showToast(
      editingClothId ? "Erreur lors de la modification" : "Erreur lors de l'ajout",
      "error",
    );
  } finally {
    restoreSubmitLabel();
  }
});

// Chargement des vêtements Firestore
function loadClothes() {
  const clothesRef = collection(db, `users/${currentUser.uid}/clothes`);
  clothesPageSize = getClothesPageSize();
  clothesGrid.style.display = "none";
  emptyState.style.display = "block";
  emptyState.querySelector("h2").textContent = "Chargement de ta garde-robe...";
  emptyState.querySelector("p").textContent =
    "Récupération de tes vêtements en cours.";

  stopClothesListener?.();
  clothesCursor = null;
  hasMoreClothes = false;
  if (loadMoreBtn) loadMoreBtn.hidden = true;
  stopClothesListener = onSnapshot(
    query(clothesRef, limit(clothesPageSize)),
    (snapshot) => {
      allClothes = snapshot.docs.map((clothDoc) => {
        const raw = { id: clothDoc.id, ...clothDoc.data() };
        const migrated = migrateGarment(raw);
        if (
          migrated &&
          ["type", "slot", "colors", "colorConfidence", "isContradictory"].some(
            (field) => raw[field] !== migrated[field],
          )
        ) {
          void setDoc(
            doc(db, `users/${currentUser.uid}/clothes`, clothDoc.id),
            {
              type: migrated.type,
              slot: migrated.slot,
              colors: migrated.colors,
              colorConfidence: migrated.colorConfidence,
              isContradictory: migrated.isContradictory,
            },
            { merge: true },
          );
        }
        return migrated;
      });
      allClothes.sort((a, b) => getCreatedAtMillis(b) - getCreatedAtMillis(a));
      clothesCursor = snapshot.docs.at(-1) || null;
      hasMoreClothes = snapshot.size === clothesPageSize;
      if (loadMoreBtn) loadMoreBtn.hidden = !hasMoreClothes;
      renderClothes();
    },
    (error) => {
      console.error("Erreur chargement Firestore :", error);
      emptyState.querySelector("h2").textContent =
        "Impossible de charger ta garde-robe";
      emptyState.querySelector("p").textContent =
        "Vérifie ta connexion puis recharge la page.";
      showToast("Erreur lors du chargement de la garde-robe", "error");
    },
  );
}

async function loadMoreClothes() {
  if (!currentUser || !clothesCursor || !hasMoreClothes) return;
  loadMoreBtn?.setAttribute("aria-busy", "true");
  try {
    const clothesRef = collection(db, `users/${currentUser.uid}/clothes`);
    const snapshot = await getDocs(
      query(clothesRef, startAfter(clothesCursor), limit(clothesPageSize)),
    );
    const nextPage = snapshot.docs.map((clothDoc) =>
      migrateGarment({
        id: clothDoc.id,
        ...clothDoc.data(),
      }),
    );
    const knownIds = new Set(allClothes.map((cloth) => cloth.id));
    allClothes.push(...nextPage.filter((cloth) => !knownIds.has(cloth.id)));
    allClothes.sort((a, b) => getCreatedAtMillis(b) - getCreatedAtMillis(a));
    clothesCursor = snapshot.docs.at(-1) || clothesCursor;
    hasMoreClothes = snapshot.size === clothesPageSize;
    if (loadMoreBtn) loadMoreBtn.hidden = !hasMoreClothes;
    renderClothes();
  } catch (error) {
    console.error("Erreur chargement page suivante :", error);
    showToast("Impossible de charger davantage de vêtements", "error");
  } finally {
    loadMoreBtn?.removeAttribute("aria-busy");
  }
}

loadMoreBtn?.addEventListener("click", loadMoreClothes);

function getCreatedAtMillis(cloth) {
  if (!cloth?.createdAt) return 0;
  if (typeof cloth.createdAt.toMillis === "function") {
    return cloth.createdAt.toMillis();
  }
  if (typeof cloth.createdAt.seconds === "number") {
    return cloth.createdAt.seconds * 1000;
  }
  return typeof cloth.createdAt === "number" ? cloth.createdAt : 0;
}

// Suppression d'un vêtement
window.deleteCloth = async (clothId) => {
  if (!confirm("Voulez-vous vraiment supprimer ce vêtement ?")) return;

  try {
    await deleteDoc(doc(db, `users/${currentUser.uid}/clothes`, clothId));
    showToast("Vêtement supprimé");
  } catch (error) {
    console.error("Erreur lors de la suppression :", error);
    showToast("Erreur lors de la suppression", "error");
  }
};

function createDeleteButton(clothId, title) {
  const button = document.createElement("button");
  button.className = "delete-btn";
  button.type = "button";
  button.dataset.deleteCloth = clothId;
  button.title = title;
  const icon = document.createElement("span");
  icon.className = "delete-icon";
  icon.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M8 4h8l1 2h4v2H3V6h4l1-2Zm-2 5h12l-1 12H7L6 9Zm3 2v7h2v-7H9Zm4 0v7h2v-7h-2Z",
  );
  svg.appendChild(path);
  icon.appendChild(svg);
  const hiddenText = document.createElement("span");
  hiddenText.className = "visually-hidden";
  hiddenText.textContent = title;
  button.append(icon, hiddenText);
  return button;
}

// Mise à jour intelligente de la suggestion de l'IA depuis les tenues enregistrées ou le dressing
async function updateWardrobeSuggestion() {
  const suggestionList = document.getElementById("suggestion-pieces-list");
  const suggestionTitle = document.getElementById("suggestion-title");
  if (!suggestionList) return;

  const weekDays = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const todayLabel = weekDays[new Date().getDay()];

  let todayOutfit = null;
  const storageKey = currentUser
    ? `styleai_weekly_outfits_${currentUser.uid}`
    : "styleai_weekly_outfits_guest";

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data?.outfits)) {
        todayOutfit =
          data.outfits.find((o) => o.name?.toLowerCase().includes(todayLabel.toLowerCase())) ||
          data.outfits.find((o) => !o.isSkipped && !o.isError && o.pieces?.length);
      }
    }
  } catch {
    // ignore
  }

  if (!todayOutfit && currentUser) {
    try {
      const snap = await getDoc(
        doc(db, `users/${currentUser.uid}/outfits`, "currentWeek"),
      );
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.outfits)) {
          todayOutfit =
            data.outfits.find((o) => o.name?.toLowerCase().includes(todayLabel.toLowerCase())) ||
            data.outfits.find((o) => !o.isSkipped && !o.isError && o.pieces?.length);
        }
      }
    } catch {
      // ignore
    }
  }

  if (todayOutfit?.pieces?.length) {
    if (suggestionTitle) {
      suggestionTitle.textContent = `${todayLabel} · ${todayOutfit.styleBadge || "Tenue"}`;
    }
    suggestionList.replaceChildren();
    todayOutfit.pieces.forEach((piece) => {
      const li = document.createElement("li");
      const swatch = document.createElement("span");
      swatch.className = "suggestion-swatch swatch-gray";
      li.append(swatch, document.createTextNode(piece.name || piece.category || "Vêtement"));
      suggestionList.appendChild(li);
    });
    return;
  }

  // 2. Si aucune semaine générée mais présence de vêtements, composer une suggestion
  if (allClothes.length >= 2) {
    const haut = allClothes.find((c) => c.category === "haut" || normalizeGarmentSlot(c) === SLOTS.BASE);
    const bas = allClothes.find((c) => c.category === "bas" || normalizeGarmentSlot(c) === SLOTS.BAS);
    const chaussures = allClothes.find((c) => c.category === "chaussures" || normalizeGarmentSlot(c) === SLOTS.CHAUSSURES);
    const manteau = allClothes.find((c) => c.category === "manteau" || normalizeGarmentSlot(c) === SLOTS.VESTE);

    const pieces = [manteau, haut, bas, chaussures].filter(Boolean);
    if (pieces.length >= 2) {
      if (suggestionTitle) {
        suggestionTitle.textContent = `Suggestion pour ${todayLabel}`;
      }
      suggestionList.replaceChildren();
      pieces.forEach((piece) => {
        const li = document.createElement("li");
        const swatch = document.createElement("span");
        swatch.className = "suggestion-swatch swatch-gray";
        li.append(swatch, document.createTextNode(piece.name || piece.category));
        suggestionList.appendChild(li);
      });
      return;
    }
  }

  if (allClothes.length === 0) {
    if (suggestionTitle) suggestionTitle.textContent = "Suggestion du jour";
    suggestionList.innerHTML = "<li>Ajoute des vêtements à ton dressing pour voir la suggestion.</li>";
  }
}

// Rendu de la grille de vêtements
function renderClothes() {
  updateWardrobeSuggestion();
  const filteredClothes =
    currentFilter === "tous"
      ? allClothes
      : allClothes.filter((c) => c.category === currentFilter);

  clothCountSpan.textContent = `(${filteredClothes.length})`;

  if (filteredClothes.length === 0) {
    clothesGrid.style.display = "none";
    emptyState.style.display = "block";
    if (currentFilter !== "tous") {
      emptyState.querySelector("h2").textContent =
        "Aucun vêtement dans cette catégorie";
      emptyState.querySelector("p").textContent =
        "Change de filtre ou ajoute un vêtement.";
    } else {
      emptyState.querySelector("h2").textContent =
        "Commence par ajouter des vêtements";
      emptyState.querySelector("p").textContent =
        "Ta garde-robe est vide pour le moment.";
    }
  } else {
    emptyState.style.display = "none";
    clothesGrid.style.display = "grid";
    const fragment = document.createDocumentFragment();
    filteredClothes.forEach((cloth) => {
      const card = document.createElement("div");
      card.className = "cloth-card";
      const imageContainer = document.createElement("div");
      imageContainer.className = "cloth-img";
      if (cloth.imageUrl) {
        const image = document.createElement("img");
        image.className = "cloth-image";
        image.loading = "lazy";
        image.decoding = "async";
        image.src = cloth.imageUrl;
        image.alt = cloth.name || "Vêtement";
        imageContainer.appendChild(image);
      } else {
        imageContainer.textContent = "👕";
      }
      const info = document.createElement("div");
      info.className = "cloth-info";
      const meta = document.createElement("div");
      meta.className = "cloth-meta";
      const category = document.createElement("span");
      category.className = "cloth-badge";
      category.textContent =
        categoryLabels[cloth.category] || cloth.category || "";
      const pattern = document.createElement("span");
      pattern.className = `cloth-badge cloth-pattern-badge ${cloth.pattern === "motif" ? "is-pattern" : "is-plain"}`;
      pattern.textContent = cloth.pattern === "motif" ? "🎨 Motif" : "⚪ Uni";
      meta.append(category, pattern);
      if (cloth.type && cloth.type !== "autre") {
        const typeBadge = document.createElement("span");
        typeBadge.className = "cloth-badge cloth-type-badge";
        typeBadge.textContent = cloth.type;
        meta.appendChild(typeBadge);
      }
      if (cloth.colorConfidence === "incertain" || cloth.isContradictory) {
        const warningBadge = document.createElement("span");
        warningBadge.className = "cloth-badge cloth-warning-badge";
        warningBadge.title = "Couleur incertaine par rapport au nom du vêtement (modifiable)";
        warningBadge.textContent = "⚠️ Couleur ?";
        meta.appendChild(warningBadge);
      }
      const name = document.createElement("h3");
      name.className = "cloth-name";
      name.textContent = cloth.name || "Vêtement";
      info.appendChild(meta);
      info.appendChild(name);
      if (cloth.colors) {
        const colors = document.createElement("p");
        colors.className = "cloth-colors";
        colors.textContent = `Couleur(s): ${cloth.colors}`;
        info.appendChild(colors);
      }
      if (cloth.description) {
        const description = document.createElement("p");
        description.className = "cloth-desc";
        description.textContent = cloth.description;
        info.appendChild(description);
      }
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "edit-cloth-btn";
      editButton.dataset.editCloth = cloth.id;
      editButton.textContent = "Modifier";
      editButton.title = "Modifier ce vêtement";
      info.appendChild(editButton);

      const cardDeleteButton = createDeleteButton(
        cloth.id,
        "Supprimer ce vêtement",
      );
      cardDeleteButton.className = "delete-btn delete-card-action";
      info.appendChild(cardDeleteButton);
      card.append(imageContainer, info);
      fragment.appendChild(card);
    });
    clothesGrid.replaceChildren(fragment);
  }
}

clothesGrid?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-cloth]");
  if (editButton) {
    const cloth = allClothes.find((item) => item.id === editButton.dataset.editCloth);
    openEditModal(cloth);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-cloth]");
  if (deleteButton) deleteCloth(deleteButton.dataset.deleteCloth);
});

// Filtrage
filterPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    filterPills.forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    currentFilter = pill.dataset.category;
    renderClothes();
  });
});
