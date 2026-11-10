import { auth } from "./config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

/**
 * Déconnecte l'utilisateur et redirige vers la page de connexion.
 */
export async function logout() {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Erreur lors de la déconnexion :", error);
  }
}

/**
 * Normalise et harmonise la barre de navigation sur toutes les pages connectées.
 * @param {"wardrobe"|"outfits"|"index"} [activePage]
 */
export function setupNavbar(activePage) {
  // Détection automatique de la page courante si non spécifiée
  if (!activePage) {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("outfits")) activePage = "outfits";
    else if (path.includes("wardrobe")) activePage = "wardrobe";
    else activePage = "index";
  }

  // Marque le lien actif avec classe et aria-current
  const navLinks = document.querySelectorAll(".nav-links a");
  navLinks.forEach((link) => {
    const href = link.getAttribute("href") || "";
    const isCurrent =
      (activePage === "wardrobe" && href.includes("wardrobe")) ||
      (activePage === "outfits" && href.includes("outfits"));

    link.classList.toggle("active", isCurrent);
    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  // Branchement du bouton déconnexion s'il existe
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "true";
    logoutBtn.addEventListener("click", logout);
  }
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

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
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
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    }
  });

  return unsubscribe;
}
