# Conformité au cahier des charges

Référence : `5ef268df-bf15-4107-89a2-eefa82ad70aa.docx` — 3A DW, projet fil rouge.
Cette matrice dit ce qui est fait, ce qui est partiel et ce qui manque encore.

## 1. Périmètre technique

| Exigence | Statut | Preuve / action |
| --- | --- | --- |
| Interface web avec plusieurs écrans et navigation cohérente | Conforme | `index.html`, `login.html`, `wardrobe.html`, `outfits.html`, `trip.html`, `404.html`, `auth.js`. |
| Serveur applicatif exposant une API, logique métier côté serveur | Conforme | `server.js` expose `/api/health`, `/api/outfits/validate`, `/api/outfits/check-wardrobe`, `/api/outfits/chic`, `/api/outfits/validate-response`. Il importe les règles métier de `outfit-matcher.js`. |
| Base de données et données persistantes | Conforme | Firestore : `users/{uid}/clothes`, `outfits/{weekId}`, `settings/weeklyStyles` ; l'ancien `outfits/currentWeek` reste compatible. |
| CRUD complet sur au moins une entité | Conforme | Garde-robe : création, lecture, modification (bouton « Modifier » + `updateDoc`), suppression. |
| Mode valise et sauvegarde des voyages | Conforme | `trip.html`, `trip.js`, `trip-planner.js`, collection `users/{uid}/trips`, règles Firestore dédiées. |
| Validation des entrées côté serveur | Partiel | `server.js` valide types, longueurs, styles et météo ; Firestore valide les vêtements, le schéma des tenues/réglages et les champs, dates et listes des voyages. Les règles ne rejouent pas la validation métier de chaque tenue enregistrée. |
| Dépôt Git avec historique lisible | Conforme | Plusieurs commits de construction : cadrage documentaire, règles de tenues, API/CRUD, nettoyage du dépôt, conformité. |
| README d'installation | Conforme | `README.md` : prérequis, `npm install`, `npm start`, tests, API, structure. |

## 2. Les sept critères du fini

| Critère | Statut | Détail |
| --- | --- | --- |
| Aucun bouton mort, lien sans destination, écran vide sans explication | Partiel | Les états vides de garde-robe et de planning sont traités. La modale de confirmation de suppression existe mais `deleteCloth` utilise encore `confirm()` : doublon d'interface à nettoyer. |
| Aucun TODO, code commenté, fonctionnalité à moitié branchée | Partiel | Aucun TODO/FIXME actif repéré ; la modale de confirmation de suppression reste inutilisée (`deleteCloth` utilise `confirm()`). |
| Chaque opération va jusqu'au bout | Conforme | CRUD garde-robe, génération, sauvegarde de semaine. |
| Cas d'erreur traités et affichés | Partiel | Erreurs Firebase, Cloudinary, API et tenues impossibles affichées. Les journées en échec sont relancées une fois et proposent Casual, Rock ou Streetwear ; si une pièce obligatoire manque réellement, voir M8 dans `docs/CODE_REVIEW.md`. Tous les chemins réseau ne sont pas couverts par un test navigateur. |
| État vide soigné | Conforme | Messages et boutons d'ajout dans `wardrobe.html` / `outfits.html`. |
| Un inconnu installe et lance via le README | Conforme | `npm install` + `npm start` ; test serveur automatisé. La connexion Firebase réelle reste à vérifier sur un poste vierge. |
| Utilisable dix minutes sans casser | Partiel | Parcours principal stable et testé unitairement ; parcours navigateur complet non exécuté dans cet environnement. |

## 3. Livrables de conception

| Livrable | Statut | Fichier |
| --- | --- | --- |
| Spécification finale, périmètre exclu, MVP | Conforme | `docs/SPECIFICATION.md` |
| Photo de la spécification manuscrite | Non conforme | `docs/specification-manuscrite.jpg` manquante — information manquante. |
| Modèle de données | Conforme | `docs/DATA_MODEL.md` |
| Fichier de contexte projet | Conforme | `AGENTS.md` |
| Dix cas de vérification et résultats | Conforme | `TESTS.md` |
| Journal de prompts | Conforme | `docs/PROMPTS.md` |
| Revue critique | Conforme | `docs/CODE_REVIEW.md` |

## 4. Journal de prompts et traçabilité

| Exigence | Statut | Détail |
| --- | --- | --- |
| Une entrée par prompt significatif | Conforme | `docs/PROMPTS.md` contient les prompts de diagnostic, de règles, de serveur et de documentation, avec verdicts et corrections. |
| Échecs consignés | Conforme | Échec du premier diagnostic, fichier `styleEngine.js` cassé, doublons d'interface. |
| Cinq prompts réutilisables | Conforme | Section finale de `docs/PROMPTS.md`. |

## 5. Revue critique

| Point de la checklist | Statut | Détail |
| --- | --- | --- |
| Dépendances réelles, légitimes, à jour | Conforme | `firebase`, `@lhci/cli` ; CDN Firebase/Cloudinary/Transformers. Pas de dépendance inventée. |
| Validation serveur et échappement | Conforme | API + règles Firestore ; `escapeHtml` et `textContent` majoritaires. |
| Aucun secret dans le dépôt | Conforme | `firebase-debug.log` retiré du suivi et ignoré ; clé Web Firebase et preset Cloudinary publics par nature. |
| Erreurs jusqu'à l'utilisateur | Partiel | Toasts et cartes d'erreur ; certains `catch` silencieux restent à instrumenter. |
| Droits vérifiés côté serveur | Conforme | Les règles Firestore réservent lecture et écriture à `request.auth.uid == userId`. |
| Le code fait ce que la spec demande | Partiel | Le CRUD passe par Firestore, pas par l'API HTTP. C'est documenté et assumé ; l'API porte la logique de tenue. |
| Code mort / dupliqué | Partiel | La modale de suppression et quelques helpers restent à nettoyer ; le doublon de bouton a été supprimé. |
| Capacité à expliquer chaque fichier | Conforme | `README.md`, `AGENTS.md`, `docs/CODE_REVIEW.md`. |

## 6. Sécurité et données personnelles

- Les règles Firestore isolent chaque utilisateur.
- Les images sont envoyées à Cloudinary avec un preset non signé public ; aucune
  clé secrète Cloudinary n'est dans le dépôt.
- Les prompts et journaux ne contiennent pas de données personnelles réelles.
- `firebase-debug.log` ne doit plus être commité.

## 7. Écarts résiduels à assumer

1. **Pas d'API CRUD HTTP pour la garde-robe.** Le CRUD passe par le SDK Firebase
   client et les règles Firestore. Si l'enseignant exige que tout le CRUD passe
   par le serveur, il faudra ajouter des routes `/api/clothes` et un backend
   Firebase Admin ou REST.
2. **Photo manuscrite absente.** À ajouter avant le rendu.
3. **Parcours navigateur non exécuté dans cet environnement.** Les tests
   automatisés couvrent les règles et l'API ; la connexion Firebase réelle, le
   upload Cloudinary et l'analyse d'image restent à valider manuellement.
4. **Émulateur Firestore indisponible.** La compilation des règles n'a pas pu
   démarrer car Java n'est pas installé ou accessible dans cet environnement.
5. **Modifications non commitées.** Plusieurs fichiers restent modifiés dans
   l'espace de travail ; il faudra les committer avant le dépôt final.
6. **Validation métier Firestore.** Les règles contrôlent les schémas, tailles,
   styles et dates, mais ne rejouent pas les règles de composition d'une tenue.
   Le validateur métier et l'API restent nécessaires avant sauvegarde/affichage.

## 8. Vérification actualisée

- `npm test` : 107 tests réussis, 0 échec (vérifié le 12 novembre 2026).
- Le nom de ville météo mémorisé est affiché avec `textContent`, pas interprété
  comme du HTML.
- Le parcours Firebase/Cloudinary dans un navigateur connecté et l'installation
  sur une machine vierge restent à vérifier manuellement.
- Les modifications présentes dans l'espace de travail doivent être commités
  avant le dépôt final.

## 9. Refonte visuelle StyleAI — 12 novembre 2026

- La direction « Maison de couture nocturne » remplace la palette claire précédente sur la landing, l’authentification, le dressing, les tenues et le mode valise.
- Les contrats JavaScript des fonctionnalités existantes sont vérifiés par `tests/redesign-contracts.test.mjs` ; la suite totale passe à 107 tests.
- Les photos d’ambiance sont servies en WebP local depuis `public/assets/img/`, avec variantes responsives et attribution dans `docs/design-system.md`.
- Les styles de mouvement réduit, navigation mobile, focus, images manquantes et placeholders de chargement sont prévus.
- La connexion réelle, l’envoi photo vers Cloudinary et le parcours connecté doivent être essayés sur l’installation de présentation.
