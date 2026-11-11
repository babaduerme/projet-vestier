/* ===== Authentification ===== */
import { auth } from "./config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const errorDiv = document.getElementById("error-message");
const tabs = document.querySelectorAll(".tab");

// Redirige vers la garde-robe si l'utilisateur est déjà connecté
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "wardrobe.html";
});

/**
 * Affiche le formulaire demandé et synchronise l'état accessible des onglets.
 * @param {string} target - Identifiant du formulaire cible ("login-form" ou "signup-form")
 */
function showForm(target) {
  const isLogin = target === "login-form";
  if (loginForm) loginForm.style.display = isLogin ? "block" : "none";
  if (signupForm) signupForm.style.display = isLogin ? "none" : "block";

  tabs.forEach((tab) => {
    const active = tab.dataset.target === target;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  if (errorDiv) errorDiv.style.display = "none";
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.target) showForm(tab.dataset.target);
  });
});

document.querySelectorAll("[data-switch]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    if (link.dataset.switch) showForm(link.dataset.switch);
  });
});

/**
 * Traduit un code d'erreur Firebase et affiche un message lisible dans la zone d'alerte.
 * @param {string} code - Code d'erreur Firebase Auth
 */
function showError(code) {
  if (!errorDiv) return;
  errorDiv.style.display = "block";
  errorDiv.style.background = "#fff0f0";
  errorDiv.style.color = "#a53b35";

  const messages = {
    "auth/user-not-found": "Aucun compte avec cet email",
    "auth/wrong-password": "Mot de passe incorrect",
    "auth/email-already-in-use": "Email déjà utilisé",
    "auth/weak-password": "Mot de passe trop court (6 caractères min)",
    "auth/invalid-email": "Email invalide",
    "auth/invalid-credential": "Identifiants invalides",
  };

  errorDiv.textContent = messages[code] || `Une erreur est survenue : ${code}`;
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  if (!emailInput || !passwordInput) return;

  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value,
      passwordInput.value,
    );
    window.location.href = "wardrobe.html";
  } catch (error) {
    showError(error.code);
  }
});

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById("signup-name");
  const emailInput = document.getElementById("signup-email");
  const passwordInput = document.getElementById("signup-password");
  if (!nameInput || !emailInput || !passwordInput) return;

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      emailInput.value,
      passwordInput.value,
    );
    await updateProfile(credential.user, {
      displayName: nameInput.value,
    });
    window.location.href = "wardrobe.html";
  } catch (error) {
    showError(error.code);
  }
});

document.getElementById("forgot-password")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value;
  if (!email) {
    if (errorDiv) {
      errorDiv.style.display = "block";
      errorDiv.style.background = "#fff0f0";
      errorDiv.style.color = "#a53b35";
      errorDiv.textContent =
        "Veuillez entrer votre email pour réinitialiser le mot de passe.";
    }
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    if (errorDiv) {
      errorDiv.style.display = "block";
      errorDiv.style.background = "#e6fffa";
      errorDiv.style.color = "#319795";
      errorDiv.textContent = "Email de réinitialisation envoyé !";
    }
  } catch (error) {
    showError(error.code);
  }
});
