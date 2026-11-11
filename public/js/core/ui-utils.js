/**
 * Fonctions utilitaires d'interface utilisateur partagées (toasts, échappement HTML).
 */

/**
 * Échappe les caractères HTML dangereux pour éviter les injections XSS lors de l'insertion dans le DOM.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let activeToastTimeout = null;

/**
 * Affiche une notification toast. Supporte à la fois le conteneur statique (#toast)
 * et le conteneur empilable (#toast-container).
 * @param {string} message - Message à afficher.
 * @param {"success"|"error"} [type="success"] - Type de message.
 */
export function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toast-container");
  if (toastContainer) {
    const toastItem = document.createElement("div");
    toastItem.className = `toast ${type}`;
    toastItem.textContent = message;
    toastContainer.appendChild(toastItem);

    setTimeout(() => {
      toastItem.classList.add("fade-out");
      setTimeout(() => {
        if (toastItem.parentElement) {
          toastItem.parentElement.removeChild(toastItem);
        }
      }, 300);
    }, 3000);
    return;
  }

  const toastElement = document.getElementById("toast");
  if (toastElement) {
    if (activeToastTimeout) {
      clearTimeout(activeToastTimeout);
      activeToastTimeout = null;
    }
    toastElement.textContent = message;
    toastElement.className = `toast ${type}`;
    toastElement.style.display = "block";
    activeToastTimeout = setTimeout(() => {
      toastElement.style.display = "none";
      activeToastTimeout = null;
    }, 4000);
  }
}
