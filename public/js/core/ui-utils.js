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

/** Retourne une confirmation adaptée à l'élément et aux données réellement supprimés. */
export function getDeletionConfirmationMessage(type, details = {}) {
  const name = String(details.name || "").trim() || "Sans nom";
  if (type === "garment") {
    const subjects = {
      haut: "ce haut",
      bas: "ce bas",
      robe: "cette robe",
      manteau: "ce manteau",
      chaussures: "cette paire de chaussures",
      accessoires: "cet accessoire",
      ensemble: "cet ensemble",
    };
    const subject = subjects[details.category] || "ce vêtement";
    return `Supprimer ${subject} « ${name} » ? Cette pièce sera retirée de ta garde-robe.`;
  }
  if (type === "savedWeek") {
    return `Supprimer la semaine « ${name} » ? Les tenues enregistrées pour cette semaine seront supprimées.`;
  }
  if (type === "localWeek") {
    return `Supprimer la semaine locale « ${name} » ? La copie conservée sur cet appareil sera effacée.`;
  }
  if (type === "trip") {
    return `Supprimer la valise « ${name} » ? Son plan de tenues et ses pièces seront retirés de tes voyages enregistrés.`;
  }
  if (type === "account") {
    return "Supprimer ton compte StyleAI ? Cette action est irréversible.";
  }
  return "Supprimer cet élément ? Cette action est définitive.";
}

let deletionDialog = null;

/** Affiche une confirmation intégrée au site et renvoie le choix de l'utilisateur. */
export function confirmDeletion(type, details = {}) {
  if (!deletionDialog) {
    deletionDialog = document.createElement("dialog");
    deletionDialog.id = "deletion-confirm-dialog";
    deletionDialog.className = "deletion-dialog";
    deletionDialog.setAttribute("aria-labelledby", "deletion-dialog-title");
    deletionDialog.setAttribute("aria-describedby", "deletion-dialog-message");
    deletionDialog.innerHTML = `<section class="deletion-dialog-card"><p class="deletion-dialog-kicker">Confirmation</p><h2 id="deletion-dialog-title">Confirmer la suppression</h2><p id="deletion-dialog-message"></p><div class="deletion-dialog-actions"><button type="button" class="deletion-cancel-btn">Annuler</button><button type="button" class="deletion-confirm-btn">Supprimer</button></div></section>`;
    document.body.append(deletionDialog);
  }

  if (deletionDialog.open) return Promise.resolve(false);
  deletionDialog.querySelector("#deletion-dialog-message").textContent =
    getDeletionConfirmationMessage(type, details);

  return new Promise((resolve) => {
    const finish = (confirmed) => {
      deletionDialog.removeEventListener("close", onClose);
      deletionDialog.removeEventListener("cancel", onCancel);
      deletionDialog.removeEventListener("click", onBackdropClick);
      cancelButton.removeEventListener("click", onCancelClick);
      confirmButton.removeEventListener("click", onConfirm);
      if (deletionDialog.open) deletionDialog.close(confirmed ? "confirm" : "cancel");
      resolve(confirmed);
    };
    const onClose = () => finish(deletionDialog.returnValue === "confirm");
    const onCancel = (event) => { event.preventDefault(); finish(false); };
    const cancelButton = deletionDialog.querySelector(".deletion-cancel-btn");
    const confirmButton = deletionDialog.querySelector(".deletion-confirm-btn");
    const onConfirm = () => finish(true);
    const onCancelClick = () => finish(false);
    const onBackdropClick = (event) => {
      if (event.target === deletionDialog) finish(false);
    };
    deletionDialog.addEventListener("close", onClose, { once: true });
    deletionDialog.addEventListener("cancel", onCancel, { once: true });
    cancelButton.addEventListener("click", onCancelClick, { once: true });
    confirmButton.addEventListener("click", onConfirm, { once: true });
    deletionDialog.addEventListener("click", onBackdropClick);
    deletionDialog.showModal();
    cancelButton.focus();
  });
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
