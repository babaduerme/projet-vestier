import { auth } from "../core/config.js";
import { setupAccountSettings, startInactivityMonitor, logout } from "./account-settings.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
export { logout };

/**
 * Normalise et harmonise la barre de navigation sur toutes les pages connectées.
 * @param {"wardrobe"|"outfits"|"trip"|"index"} [activePage]
 */
export function setupNavbar(activePage) {
  // Détection automatique de la page courante si non spécifiée
  if (!activePage) {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("outfits")) activePage = "outfits";
    else if (path.includes("wardrobe")) activePage = "wardrobe";
    else if (path.includes("trip")) activePage = "trip";
    else activePage = "index";
  }

  // Marque le lien actif avec classe et aria-current
  const navLinks = document.querySelectorAll(".nav-links a");
  navLinks.forEach((link) => {
    const href = link.getAttribute("href") || "";
    const isCurrent =
      (activePage === "wardrobe" && href.includes("wardrobe")) ||
      (activePage === "outfits" && href.includes("outfits")) ||
      (activePage === "trip" && href.includes("trip"));

    link.classList.toggle("active", isCurrent);
    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  setupAccountSettings();
}

/**
 * Initialise l'écouteur d'état d'authentification pour une page protégée.
 * Met à jour les éléments d'affichage utilisateur dans la navbar et branche la déconnexion.
 * @param {(user: import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js").User) => void} onAuthenticated
 * @param {string} [redirectUrl="login.html"]
 * @returns {() => void} Fonction de désinscription de l'écouteur
 */
export function initAuth(onAuthenticated, redirectUrl = "login.html") {
  setupNavbar();

  const userDisplay = document.getElementById("user-display");
  const showAuthError = (message) => {
    if (userDisplay) userDisplay.textContent = message;
    const userInfo = document.getElementById("user-info");
    if (userInfo && !document.getElementById("auth-retry-btn")) {
      const retry = document.createElement("button");
      retry.id = "auth-retry-btn";
      retry.className = "btn";
      retry.type = "button";
      retry.textContent = "Réessayer";
      retry.addEventListener("click", () => window.location.reload());
      userInfo.append(retry);
    }
  };
  const authTimeout = window.setTimeout(() => {
    showAuthError("La vérification de la session prend trop de temps.");
  }, 10000);

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    window.clearTimeout(authTimeout);
    document.getElementById("auth-retry-btn")?.remove();
    if (user) {
      startInactivityMonitor(user);
      const userEmailSpan = document.getElementById("user-email");
      if (userEmailSpan) {
        userEmailSpan.textContent = user.email || "";
      }

      const userDisplay = document.getElementById("user-display");
      if (userDisplay) {
        userDisplay.textContent = user.displayName || user.email || "";
      }

      setupNavbar();

      if (typeof onAuthenticated === "function") {
        onAuthenticated(user);
      }
    } else {
      startInactivityMonitor(null);
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    }
  }, (error) => {
    window.clearTimeout(authTimeout);
    console.error("[Auth] Vérification de session impossible :", error);
    showAuthError("Impossible de vérifier la session.");
  });

  return unsubscribe;
}
