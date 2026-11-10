# Spécification finale — StyleAI / AI Wardrobe

- **Projet** : StyleAI, garde-robe personnelle assistée par IA.
- **Cours** : 3A DW — Coder à l'ère de l'IA, projet fil rouge.
- **Date de cette version** : 10/11/2026.
- **Source** : cahier des charges `5ef268df-bf15-4107-89a2-eefa82ad70aa.docx`
  (document de cadrage du module).
- **Statut** : version de travail alignée sur le cahier des charges.

## 1. Problème et public

Choisir une tenue chaque matin demande du temps et de la mémoire : les
vêtements sont dispersés, les combinaisons ne sont pas toujours cohérentes et la
météo change. StyleAI centralise la garde-robe, aide à la remplir par photo et
propose des tenues complètes pour la semaine.

Public : une personne seule, sur son navigateur, avec un compte Firebase. Le
projet n'est pas multi-utilisateur partagé et ne vise pas les équipes.

## 2. Périmètre inclus

1. Authentification Firebase (connexion et inscription).
2. Garde-robe personnelle : ajouter, lister, modifier et supprimer un vêtement.
3. Classification d'une photo de vêtement (type, catégorie, couleurs, motif).
4. Génération de tenues déterministes à partir de la garde-robe et de la météo.
5. Règles de compatibilité : couche chaude obligatoire, hoodie uniquement sur
   t-shirt, Chic/Minimaliste sans t-shirt ni hoodie.
6. Planning hebdomadaire : un style par jour, génération des sept tenues,
   sauvegarde locale et Firestore.
7. API locale de validation métier et de composition formelle.
8. Validation serveur des payloads API et validation Firestore des vêtements.
9. Documentation de conception, journal de prompts et revue critique.

## 3. Périmètre exclu

- Application mobile native.
- Partage de garde-robe entre utilisateurs, groupes ou foyers.
- Paiement, abonnement, marketplace.
- Réseau social, commentaires, likes.
- Recommandations par apprentissage automatique à partir des goûts.
- Déploiement en ligne obligatoire : la démonstration locale suffit.
- Reconnaissance d'image parfaite : l'IA peut se tromper, l'utilisateur corrige.
- Gestion de plusieurs garde-robes par compte.
- Notifications push, e-mails, rappels.

## 4. Version minimale livrable (MVP)

Le MVP est terminé quand un utilisateur peut, sur une machine vierge :

1. lancer `npm install` puis `npm start` ;
2. ouvrir l'application et se connecter ;
3. ajouter un vêtement avec nom, catégorie, couleur et, si possible, photo ;
4. voir le vêtement dans sa garde-robe ;
5. le modifier puis le supprimer ;
6. choisir un style pour un jour et générer une tenue valide ;
7. voir que chaque tenue contient un pull ou un hoodie et qu'aucun hoodie
   n'est associé à un polo ou à une chemise ;
8. voir Chic et Minimaliste proposer chemise/polo + pull, jamais de t-shirt ;
9. consulter le README et les dix cas de vérification.

Le MVP ne dépend pas des Cloud Functions et ne nécessite pas de déploiement.

## 5. Récits utilisateurs

- **US-01** : en tant qu'utilisateur, je veux créer un compte et me connecter
  pour retrouver ma garde-robe.
- **US-02** : je veux ajouter un vêtement avec une photo pour ne pas tout saisir.
- **US-03** : je veux consulter, filtrer et supprimer mes vêtements.
- **US-04** : je veux modifier un vêtement existant sans le supprimer.
- **US-05** : je veux choisir un style par jour et générer mes tenues.
- **US-06** : je veux que les tenues respectent des règles de compatibilité.
- **US-07** : je veux un message clair quand une pièce manque.
- **US-08** : je veux que mes données persistent après rechargement.

## 6. Exigences fonctionnelles

| ID | Exigence | Critère d'acceptation |
| --- | --- | --- |
| RF-01 | Authentification | Un utilisateur non connecté est redirigé vers `login.html`. |
| RF-02 | Création d'un vêtement | Nom obligatoire (1–80 caractères), catégorie valide, au moins une couleur. |
| RF-03 | Lecture | La garde-robe liste les vêtements de l'utilisateur connecté. |
| RF-04 | Modification | Le bouton « Modifier » préremplit la modale et met à jour le document. |
| RF-05 | Suppression | La suppression demande confirmation et retire le document. |
| RF-06 | Persistance | Les données restent présentes après rechargement et redémarrage du serveur. |
| RF-07 | Analyse d'image | La photo est classée par type/catégorie, l'utilisateur peut corriger. |
| RF-08 | Couche chaude | Toute tenue contient exactement un pull ou un hoodie. |
| RF-09 | Hoodie | Un hoodie n'est accepté qu'avec un t-shirt dessous. |
| RF-10 | Pull | Un pull est accepté avec chemise, polo, t-shirt ou robe. |
| RF-11 | Chic | Chic n'utilise que chemise/polo + pull, jamais t-shirt ni hoodie. |
| RF-12 | Minimaliste | Minimaliste hérite des règles de Chic, sans cravate ni fioritures. |
| RF-13 | Messages | Une combinaison impossible affiche la pièce manquante précise. |
| RF-14 | API | Les routes `/api/outfits/*` valident leurs entrées côté serveur. |
| RF-15 | Validation Firestore | Une écriture de vêtement invalide est refusée par les règles. |

## 7. Règles métier détaillées

### 7.1 Structure d'une tenue

- Formule classique : `BASE + BAS + CHAUSSURES + COUCHE CHAUDE`.
- Formule robe : `ROBE + CHAUSSURES + PULL`.
- Une robe ne se combine pas avec un `BAS` ni avec une `BASE`.
- Une `VESTE` est optionnelle ; elle ne remplace jamais la couche chaude.
- Un seul élément par slot, sauf accessoires (3 maximum).

### 7.2 Couche chaude

- Types autorisés : `pull`, `hoodie`.
- Un `sweat` ou un `gilet` ne satisfait pas la règle.
- La règle s'applique à tous les styles et à toutes les météos.

### 7.3 Compatibilités

- Hoodie → uniquement avec un t-shirt dessous.
- Hoodie → interdit avec polo, chemise, débardeur ou robe.
- Pull → compatible chemise, polo, t-shirt et robe.
- Cravate/nœud papillon → uniquement avec une chemise, uniquement en Chic.

### 7.4 Chic et Minimaliste

- Base autorisée : chemise ou polo. T-shirt et débardeur refusés.
- Couche chaude : pull uniquement. Hoodie refusé.
- Chic : chaussures habillées exigées par le résolveur strict.
- Minimaliste : chaussures libres, pas de cravate, pas de nœud papillon, pas de
  fioritures.

## 8. Exigences non fonctionnelles

- **Démarrage** : `npm start` sur une machine vierge, sans configuration secrète.
- **Validation** : côté serveur pour l'API et Firestore ; côté client en confort.
- **Sécurité** : chaque utilisateur ne lit et n'écrit que sous `users/{uid}`.
- **Erreurs** : messages visibles, pas de bouton mort ni d'écran vide.
- **Performance** : chargement initial raisonnable, images lazy.
- **Accessibilité** : libellés, `aria-*`, navigation clavier sur les contrôles.
- **Maintenabilité** : modules purs testés, séparation interface / métier.
- **Traçabilité** : journal de prompts et revue critique fournis.

## 9. Architecture technique

```text
Navigateur
  ├─ HTML/CSS/JS (public/)
  ├─ Firebase Auth + Firestore (SDK client)
  ├─ Cloudinary (upload photo)
  └─ fetch /api/outfits/validate
        │
Serveur Node (server.js)
  ├─ fichiers statiques public/
  ├─ API JSON /api/outfits/*
  └─ importe public/js/outfit-matcher.js (règles pures)
        │
Firestore
  └─ users/{uid}/clothes, outfits, settings
```

Le serveur ne stocke pas les vêtements : Firestore reste la base de données.
L'API porte la logique métier de validation et de composition formelle, et
valide ses entrées. C'est un choix assumé : le cahier des charges exige un
serveur avec logique métier, pas nécessairement que tout le CRUD passe par lui.

## 10. Données

Voir [DATA_MODEL.md](DATA_MODEL.md).

## 11. Vérification

Voir [TESTS.md](../TESTS.md) pour les dix cas et leurs résultats, et
[COMPLIANCE.md](COMPLIANCE.md) pour la correspondance avec le cahier des charges.

## 12. Risques et parades

| Risque | Parade |
| --- | --- |
| L'IA classe mal une photo | L'utilisateur corrige le nom, la catégorie et les couleurs. |
| Firestore indisponible | Message d'erreur explicite, pas de perte silencieuse. |
| API locale arrêtée | Repli sur la validation locale, signalé dans le README. |
| Règles Firestore trop strictes | Champs optionnels, tests manuels après déploiement. |
| Dérive du périmètre | Ce document et la section « exclu » font foi. |

## 13. Information manquante

La photo de la spécification manuscrite de la séance 1 n'est pas fournie dans le
dépôt. Elle doit être ajoutée sous `docs/specification-manuscrite.jpg` avant le
rendu. Aucune date de prise de vue ne peut être inventée.
