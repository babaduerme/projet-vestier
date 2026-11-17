import { auth } from "../core/config.js";
import { getDeletionConfirmationMessage } from "../core/ui-utils.js";
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  signOut,
  updateEmail,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const actionLabels = { email: "Modifier mon email", password: "Modifier mon mot de passe", delete: "Supprimer mon compte" };
const LOGOUT_EVENT_KEY = "styleai:logout-event";
// Expiration cliente : la session/JWT doit aussi avoir une durée de vie et un timeout côté serveur.
export const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const WARNING_PERIOD_MS = 60 * 1000;
const ACTIVITY_WRITE_INTERVAL_MS = 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
let stopInactivityMonitor = () => {};

/** Démarre le suivi uniquement après authentification Firebase. */
export function startInactivityMonitor(user) {
  stopInactivityMonitor();
  if (!user) return;
  const activityKey = `styleai:last-activity:${user.uid}`;
  const warning = document.getElementById("inactivity-warning");
  const countdown = document.getElementById("inactivity-countdown");
  const stayButton = document.getElementById("stay-connected");
  let lastWrite = 0;
  let timer = 0;
  let lastLogoutEvent = localStorage.getItem(LOGOUT_EVENT_KEY);
  const readActivity = () => Number(localStorage.getItem(activityKey)) || Date.now();
  const writeActivity = (force = false) => {
    const now = Date.now();
    if (force || now - lastWrite >= ACTIVITY_WRITE_INTERVAL_MS) {
      localStorage.setItem(activityKey, String(now));
      lastWrite = now;
    }
  };
  const hideWarning = () => { warning.hidden = true; };
  const onActivity = () => { writeActivity(); hideWarning(); tick(); };
  const onStorage = (event) => {
    if (event.key === activityKey) { hideWarning(); tick(); }
    if (event.key === LOGOUT_EVENT_KEY && event.newValue && event.newValue !== lastLogoutEvent) {
      lastLogoutEvent = event.newValue;
      let payload = {};
      try { payload = JSON.parse(event.newValue); } catch {}
      if (payload.reason === "inactivity") sessionStorage.setItem("styleai:logout-message", "Vous avez été déconnecté pour cause d’inactivité.");
      signOut(auth).finally(() => window.location.assign("login.html"));
    }
  };
  const tick = () => {
    const remaining = INACTIVITY_LIMIT_MS - (Date.now() - readActivity());
    if (remaining <= 0) {
      clearInterval(timer);
      logout({ reason: "inactivity" }).catch((error) => console.error("Échec de la déconnexion automatique :", error));
      return;
    }
    if (remaining <= WARNING_PERIOD_MS) {
      countdown.textContent = String(Math.ceil(remaining / 1000));
      const shouldShow = warning.hidden;
      warning.hidden = false;
      if (shouldShow && document.visibilityState === "visible") stayButton.focus();
    } else hideWarning();
  };
  writeActivity(true);
  ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", tick);
  stayButton.addEventListener("click", onActivity);
  timer = window.setInterval(tick, 1000);
  stopInactivityMonitor = () => {
    clearInterval(timer);
    ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("visibilitychange", tick);
    stayButton.removeEventListener("click", onActivity);
    hideWarning();
    stopInactivityMonitor = () => {};
  };
}

/** Authentifie à nouveau la session avant une opération sensible Firebase. */
async function confirmPassword(password) {
  if (!auth.currentUser?.email) throw new Error("Aucun utilisateur connecté.");
  const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
  await reauthenticateWithCredential(auth.currentUser, credential);
}

export async function logout({ reason = "manual", broadcast = true } = {}) {
  if (reason === "inactivity") sessionStorage.setItem("styleai:logout-message", "Vous avez été déconnecté pour cause d’inactivité.");
  if (broadcast) {
    localStorage.setItem(LOGOUT_EVENT_KEY, JSON.stringify({ at: Date.now(), reason }));
  }
  await signOut(auth);
  window.location.assign("login.html");
}

export async function updateAccountEmail(email, password) {
  await confirmPassword(password);
  await updateEmail(auth.currentUser, email);
}

export async function updateAccountPassword(currentPassword, newPassword) {
  await confirmPassword(currentPassword);
  await updatePassword(auth.currentUser, newPassword);
}

export async function deleteAccount(password) {
  await confirmPassword(password);
  await deleteUser(auth.currentUser);
  window.location.assign("index.html");
}

function ensureMarkup(userInfo) {
  let toggle = document.getElementById("account-settings-toggle");
  if (!toggle) {
    const wrapper = document.createElement("div");
    wrapper.className = "account-settings";
    wrapper.innerHTML = `<button id="account-settings-toggle" class="account-settings-toggle" type="button" aria-label="Paramètres du compte" aria-expanded="false" aria-haspopup="menu" aria-controls="account-settings-menu"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 13.5 1.1.9-1.5 2.6-1.4-.5a7.8 7.8 0 0 1-1.5.9l-.2 1.5h-3l-.3-1.5a7.8 7.8 0 0 1-1.5-.9l-1.4.5-1.5-2.6 1.1-.9a7 7 0 0 1 0-1.8l-1.1-.9 1.5-2.6 1.4.5a7.8 7.8 0 0 1 1.5-.9l.3-1.5h3l.2 1.5a7.8 7.8 0 0 1 1.5.9l1.4-.5 1.5 2.6-1.1.9a7 7 0 0 1 0 1.8Z" transform="translate(-1 -1)"/></svg></button><div id="account-settings-menu" class="account-settings-menu" role="menu" aria-label="Paramètres du compte" hidden><button type="button" role="menuitem" data-account-action="logout">Déconnexion</button><button type="button" role="menuitem" data-account-action="email">Modifier mon email</button><button type="button" role="menuitem" data-account-action="password">Modifier mon mot de passe</button><button type="button" role="menuitem" data-account-action="delete">Supprimer mon compte</button></div>`;
    const oldLogout = document.getElementById("logout-btn");
    if (oldLogout) oldLogout.replaceWith(wrapper);
    else userInfo.append(wrapper);
    toggle = wrapper.querySelector("button");
  }
  if (!document.getElementById("account-dialog")) {
    const dialog = document.createElement("div");
    dialog.id = "account-dialog";
    dialog.className = "account-dialog";
    dialog.hidden = true;
    dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-labelledby", "account-dialog-title"); dialog.setAttribute("aria-hidden", "true");
    dialog.innerHTML = `<section class="account-dialog-card" tabindex="-1"><button type="button" class="account-dialog-close" aria-label="Fermer">&times;</button><h2 id="account-dialog-title"></h2><p class="account-dialog-warning" hidden>Cette action est irréversible.</p><form id="account-action-form" novalidate><div id="account-form-fields"></div><p id="account-dialog-message" class="account-dialog-message" role="status" aria-live="polite"></p><div class="account-dialog-actions"><button type="button" class="btn btn-secondary" data-dialog-cancel>Annuler</button><button type="submit" class="btn btn-primary" id="account-dialog-submit"></button></div></form></section>`;
    document.body.append(dialog);
  }
  if (!document.getElementById("inactivity-warning")) {
    const warning = document.createElement("div");
    warning.id = "inactivity-warning";
    warning.className = "account-dialog inactivity-warning";
    warning.hidden = true;
    warning.setAttribute("role", "alertdialog"); warning.setAttribute("aria-modal", "true"); warning.setAttribute("aria-labelledby", "inactivity-warning-title");
    warning.innerHTML = `<section class="account-dialog-card" tabindex="-1"><h2 id="inactivity-warning-title">Déconnexion imminente</h2><p>Vous allez être déconnecté pour inactivité dans <strong id="inactivity-countdown" aria-live="off">60</strong> secondes.</p><button type="button" id="stay-connected" class="btn btn-primary">Rester connecté</button></section>`;
    document.body.append(warning);
  }
  return toggle;
}

function field(id, label, type = "password", autocomplete = "current-password") {
  const input = `<input id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}" required>`;
  return `<label class="account-dialog-field" for="${id}"><span>${label}</span>${type === "password" ? `<span class="account-password-wrap">${input}<button type="button" class="account-password-toggle" aria-label="Afficher le mot de passe">Afficher</button></span>` : input}</label>`;
}

function firebaseMessage(error) {
  return ({ "auth/wrong-password": "Mot de passe incorrect.", "auth/invalid-credential": "Mot de passe incorrect.", "auth/requires-recent-login": "Reconnectez-vous puis réessayez.", "auth/email-already-in-use": "Cette adresse email est déjà utilisée.", "auth/invalid-email": "Adresse email invalide.", "auth/weak-password": "Le mot de passe doit contenir au moins 8 caractères.", "auth/too-many-requests": "Trop de tentatives. Réessayez plus tard.", "auth/network-request-failed": "Connexion impossible. Vérifiez votre réseau." })[error?.code] || "Une erreur est survenue. Vérifiez vos informations puis réessayez.";
}

export function setupAccountSettings() {
  const userInfo = document.getElementById("user-info");
  if (!userInfo || userInfo.dataset.accountBound) return;
  userInfo.dataset.accountBound = "true";
  const toggle = ensureMarkup(userInfo);
  const menu = document.getElementById("account-settings-menu");
  const dialog = document.getElementById("account-dialog");
  const form = document.getElementById("account-action-form");
  const fields = document.getElementById("account-form-fields");
  const title = document.getElementById("account-dialog-title");
  const message = document.getElementById("account-dialog-message");
  const submit = document.getElementById("account-dialog-submit");
  let action = "", returnFocus = toggle;

  const closeMenu = (restore = false) => { menu.hidden = true; toggle.setAttribute("aria-expanded", "false"); if (restore) toggle.focus(); };
  const closeDialog = (restore = true) => { dialog.hidden = true; dialog.setAttribute("aria-hidden", "true"); dialog.classList.remove("account-dialog--danger"); if (restore) returnFocus.focus(); };
  const openDialog = (nextAction) => {
    action = nextAction; returnFocus = toggle; title.textContent = actionLabels[action];
    const warning = dialog.querySelector(".account-dialog-warning");
    warning.hidden = action !== "delete";
    if (action === "delete") warning.textContent = getDeletionConfirmationMessage("account");
    dialog.classList.toggle("account-dialog--danger", action === "delete");
    submit.textContent = action === "delete" ? "Supprimer définitivement" : "Enregistrer";
    submit.disabled = false; message.textContent = ""; message.className = "account-dialog-message";
    fields.innerHTML = action === "email" ? field("account-current-password", "Mot de passe actuel") + field("account-new-email", "Nouvel email", "email", "email") : action === "password" ? field("account-current-password", "Mot de passe actuel") + field("account-new-password", "Nouveau mot de passe", "password", "new-password") + field("account-confirm-password", "Confirmer le nouveau mot de passe", "password", "new-password") : field("account-current-password", "Mot de passe pour confirmer");
    dialog.hidden = false; dialog.setAttribute("aria-hidden", "false"); closeMenu();
    fields.querySelector("input")?.focus();
  };

  toggle.addEventListener("click", () => { const opening = menu.hidden; closeMenu(); if (opening) { menu.hidden = false; toggle.setAttribute("aria-expanded", "true"); menu.querySelector('[role="menuitem"]')?.focus(); } });
  menu.addEventListener("click", async (event) => {
    const item = event.target.closest("[data-account-action]"); if (!item) return;
    const choice = item.dataset.accountAction; closeMenu();
    if (choice === "logout") { try { await logout(); } catch (error) { alert(firebaseMessage(error)); } }
    else openDialog(choice);
  });
  menu.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll('[role="menuitem"]')]; const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") { event.preventDefault(); closeMenu(true); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus(); }
    if (event.key === "Home") { event.preventDefault(); items[0].focus(); } if (event.key === "End") { event.preventDefault(); items.at(-1).focus(); }
  });
  document.addEventListener("click", (event) => { if (!toggle.parentElement.contains(event.target) && !menu.hidden) closeMenu(); });
  const focusables = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter((el) => !el.closest('[hidden]'));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
  dialog.querySelector(".account-dialog-close").addEventListener("click", () => closeDialog());
  dialog.querySelector("[data-dialog-cancel]").addEventListener("click", () => closeDialog());
  dialog.addEventListener("click", (event) => { const button = event.target.closest(".account-password-toggle"); if (!button) return; const input = button.parentElement.querySelector("input"); const visible = input.type === "password"; input.type = visible ? "text" : "password"; button.textContent = visible ? "Masquer" : "Afficher"; button.setAttribute("aria-label", `${visible ? "Masquer" : "Afficher"} le mot de passe`); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) { event.preventDefault(); closeDialog(); return; }
    if (event.key === "Escape" && !menu.hidden) { event.preventDefault(); closeMenu(true); return; }
    if (!dialog.hidden && event.key === "Tab") { const list = focusables(); const first = list[0], last = list.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    if (!dialog.hidden && !focusables().includes(document.activeElement) && event.key === "Tab") { event.preventDefault(); focusables()[0]?.focus(); }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); const value = (id) => document.getElementById(id)?.value || "";
    const current = value("account-current-password");
    if (action === "password" && value("account-new-password") !== value("account-confirm-password")) { message.textContent = "Les deux nouveaux mots de passe ne correspondent pas."; message.classList.add("is-error"); return; }
    if (action === "password" && value("account-new-password").length < 8) { message.textContent = "Le nouveau mot de passe doit contenir au moins 8 caractères."; message.classList.add("is-error"); return; }
    const email = value("account-new-email"); if (action === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { message.textContent = "Saisissez une adresse email valide."; message.classList.add("is-error"); return; }
    submit.disabled = true; message.textContent = "";
    try {
      if (action === "email") await updateAccountEmail(email, current);
      if (action === "password") await updateAccountPassword(current, value("account-new-password"));
      if (action === "delete") await deleteAccount(current);
      message.textContent = "Modification enregistrée."; message.classList.add("is-success"); form.reset();
      window.setTimeout(() => closeDialog(), 900);
    } catch (error) { message.textContent = firebaseMessage(error); message.classList.add("is-error"); submit.disabled = false; }
  });
}
