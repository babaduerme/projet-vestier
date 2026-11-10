# TESTS.md — Cas de vérification et résultats

Dix cas principaux, plus deux cas API bonus. Les cas automatisés sont exécutés
par `npm test`. Les cas navigateur sont marqués honnêtement « non exécuté »
lorsqu'ils n'ont pas été joués dans cet environnement.

## Synthèse

| # | Cas | Type | Résultat |
| --- | --- | --- | --- |
| 1 | Démarrage sur machine vierge | Automatisé + manuel | Pass (serveur) |
| 2 | Pages et assets servis | Automatisé | Pass |
| 3 | Authentification et redirection | Manuel navigateur | Non exécuté |
| 4 | Création d'un vêtement valide | Manuel Firestore | Non exécuté |
| 5 | Rejet d'un vêtement sans nom/couleur | Manuel + règles | Non exécuté |
| 6 | Lecture et filtrage de la garde-robe | Manuel navigateur | Non exécuté |
| 7 | Modification d'un vêtement | Manuel navigateur | Non exécuté |
| 8 | Suppression d'un vêtement | Manuel navigateur | Non exécuté |
| 9 | Couche chaude obligatoire | Automatisé | Pass |
| 10 | Hoodie interdit avec polo/chemise | Automatisé | Pass |
| 11 | Chic et Minimaliste sans t-shirt | Automatisé | Pass |
| 12 | API : payload invalide rejeté | Automatisé | Pass |

## Cas détaillés

### Cas 1 — Démarrage sur machine vierge

- **Précondition** : Node.js 20+, dépôt cloné, aucune dépendance installée.
- **Action** : `npm install` puis `npm start`.
- **Attendu** : le serveur écoute sur `http://127.0.0.1:5000`, `/api/health`
  répond `200` avec `status: "ok"`.
- **Résultat** : Pass pour le serveur et l'API. Le parcours navigateur complet
  (connexion Firebase) n'a pas été exécuté dans cet environnement.
- **Référence** : `tests/server-api.test.mjs`, cas « GET /api/health ».

### Cas 2 — Pages et assets servis

- **Action** : `GET /`, `GET /outfits.html`, `GET /js/outfit-matcher.js`.
- **Attendu** : `200`, types MIME corrects, HTML contenant `StyleAI`.
- **Résultat** : Pass.
- **Référence** : test « le serveur sert l'application statique ».

### Cas 3 — Authentification et redirection

- **Action** : ouvrir `outfits.html` sans session.
- **Attendu** : redirection vers `login.html`, pas d'accès aux données.
- **Résultat** : non exécuté — information manquante (pas de navigateur piloté
  dans cet environnement). Le code `auth.js` implémente `initAuth` et les pages
  appellent la redirection.

### Cas 4 — Création d'un vêtement valide

- **Action** : ouvrir la modale, saisir un nom, une catégorie, une couleur,
  valider.
- **Attendu** : document créé sous `users/{uid}/clothes`, toast de succès,
  carte visible.
- **Résultat** : non exécuté — dépend de Firebase Auth/Firestore réels.
  La validation Firestore est prête dans `firestore.rules`.

### Cas 5 — Rejet d'un vêtement sans nom/couleur

- **Action** : soumettre le formulaire avec un nom vide ou sans couleur.
- **Attendu** : message explicite, aucune écriture.
- **Résultat** : non exécuté côté navigateur. La validation client existe
  (`wardrobe.js`) et les règles Firestore refusent un document sans `name` ou
  `colors`.

### Cas 6 — Lecture et filtrage

- **Action** : ajouter plusieurs vêtements, filtrer par catégorie.
- **Attendu** : seuls les vêtements de la catégorie sont affichés, compteur à jour.
- **Résultat** : non exécuté — navigateur/Firebase requis.

### Cas 7 — Modification

- **Action** : cliquer sur « Modifier », changer le nom, enregistrer.
- **Attendu** : le document est mis à jour, `updatedAt` est renseigné, la carte
  reflète le nouveau nom.
- **Résultat** : non exécuté — navigateur/Firebase requis. Le bouton et
  `updateDoc` sont implémentés.

### Cas 8 — Suppression

- **Action** : cliquer sur la corbeille, confirmer.
- **Attendu** : document supprimé, carte retirée, toast.
- **Résultat** : non exécuté — navigateur/Firebase requis.

### Cas 9 — Couche chaude obligatoire

- **Action** : valider une tenue sans pull ni hoodie.
- **Attendu** : refus avec message « chaque tenue doit contenir une couche
  chaude : un pull ou un hoodie ».
- **Résultat** : Pass (tests `outfit-rules-chic.test.mjs`, `outfit-matcher.test.mjs`).

### Cas 10 — Hoodie interdit avec polo/chemise

- **Action** : valider polo + hoodie, puis chemise + hoodie.
- **Attendu** : refus dans les deux cas ; hoodie accepté uniquement avec t-shirt.
- **Résultat** : Pass.

### Cas 11 — Chic et Minimaliste sans t-shirt

- **Action** : valider t-shirt + pull en Chic, puis en Minimaliste ; tester
  chemise + pull.
- **Attendu** : t-shirt refusé, chemise/polo + pull accepté, hoodie refusé,
  Minimaliste identique à Chic sur ces règles.
- **Résultat** : Pass.

### Cas 12 — API : payload invalide rejeté

- **Action** : `POST /api/outfits/validate` avec `{ pieces: [{category:"haut"}],
  style:"casual" }`.
- **Attendu** : `400`, `error: "invalid_request"`, message sur `name`.
- **Résultat** : Pass.

## Commandes et résultats

```text
npm test
ℹ tests 68
ℹ pass 68
ℹ fail 0
```

## Ce qui n'est pas couvert

- Parcours navigateur complet avec Firebase réel (connexion, upload Cloudinary,
  analyse d'image) : information manquante dans cet environnement.
- Rendu visuel et responsive : non exécuté.
- Déploiement Firebase/Cloud Functions : non exécuté.
