# Conformité au cahier des charges

Référence : `Projet_fil_rouge_consignes.docx`, fourni le 17 novembre 2026.
Cette matrice distingue les éléments vérifiés dans le dépôt des parcours qui
nécessitent l'environnement Firebase réel ou une pièce fournie par le binôme.

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
| Aucun bouton mort, lien sans destination, écran vide sans explication | Partiel | Les états vides sont traités et les suppressions utilisent une modale intégrée. Les parcours complets de toutes les pages n'ont pas été testés dans un navigateur connecté. |
| Aucun TODO, code commenté, fonctionnalité à moitié branchée | Partiel | Aucun TODO/FIXME actif repéré. L'ancienne modale de suppression inutilisée a été retirée ; les parcours Firebase et Cloudinary restent à valider en réel. |
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
| Validation serveur et échappement | Partiel | API + règles Firestore ; les règles Firestore ne rejouent pas toute la validation métier des tenues. `escapeHtml` et `textContent` majoritaires. |
| Aucun secret dans le dépôt | Conforme | `firebase-debug.log` retiré du suivi et ignoré ; clé Web Firebase et preset Cloudinary publics par nature. |
| Erreurs jusqu'à l'utilisateur | Partiel | Toasts et cartes d'erreur ; certains `catch` silencieux restent à instrumenter. |
| Droits vérifiés côté serveur | Conforme | Les règles Firestore réservent lecture et écriture à `request.auth.uid == userId`. |
| Le code fait ce que la spec demande | Partiel | Le CRUD passe par Firestore, pas par l'API HTTP. C'est documenté et assumé ; l'API porte la logique de tenue. |
| Code mort / dupliqué | Partiel | L'ancienne modale inutilisée a été supprimée. Les helpers historiques signalés dans la revue sont à vérifier à nouveau avant toute suppression. |
| Capacité à expliquer chaque fichier | Conforme | `README.md`, `AGENTS.md`, `docs/CODE_REVIEW.md`. |

## 6. Sécurité et données personnelles

- Les règles Firestore isolent chaque utilisateur.
- Les images sont envoyées à Cloudinary avec un preset non signé public ; aucune
  clé secrète Cloudinary n'est dans le dépôt.
- Les prompts et journaux ne contiennent pas de données personnelles réelles.
- `firebase-debug.log` ne doit plus être commité.

## 7. Écarts résiduels à assumer

1. **CRUD Firestore côté navigateur.** Le cahier exige un serveur applicatif
   avec API et logique métier, ainsi qu'un CRUD complet sur une entité ; il ne
   dit pas que les écritures de vêtements doivent passer par l'API HTTP. Le
   choix actuel utilise le SDK Firestore et les règles de sécurité côté serveur.
   Ajouter une API `/api/clothes` n'est donc pas nécessaire au périmètre décrit.
2. **Photo manuscrite absente.** À ajouter avant le rendu.
3. **Parcours navigateur non exécuté dans cet environnement.** Les tests
   automatisés couvrent les règles et l'API ; la connexion Firebase réelle, le
   upload Cloudinary et l'analyse d'image restent à valider manuellement.
4. **Émulateur Firestore indisponible.** La compilation des règles n'a pas pu
   démarrer car Java n'est pas installé ou accessible dans cet environnement.
5. **Chronologie des dix cas.** `TESTS.md` contient les dix cas principaux et
   des cas supplémentaires, mais l'historique disponible ne permet pas de
   prouver qu'ils ont tous été écrits et figés avant le code.
6. **Validation métier Firestore.** Les règles contrôlent les schémas, tailles,
   styles et dates, mais ne rejouent pas les règles de composition d'une tenue.
   Le validateur métier et l'API restent nécessaires avant sauvegarde/affichage.

## 8. Vérification actualisée

- `npm test` : 111 tests réussis, 0 échec (vérifié le 17 novembre 2026).
- Le nom de ville météo mémorisé est affiché avec `textContent`, pas interprété
  comme du HTML.
- Le parcours Firebase/Cloudinary dans un navigateur connecté et l'installation
  sur une machine vierge restent à vérifier manuellement.
- La photo de la spécification manuscrite est le seul livrable de conception
  absent qui ne peut pas être recréé à partir du code : elle doit venir du binôme.

## 9. Refonte visuelle StyleAI — 12 novembre 2026

- La direction « Maison de couture nocturne » remplace la palette claire précédente sur la landing, l’authentification, le dressing, les tenues et le mode valise.
- État au 12 novembre : les contrats JavaScript des fonctionnalités existantes étaient vérifiés par `tests/redesign-contracts.test.mjs` ; la suite comptait alors 107 tests. La vérification du 17 novembre en compte 111.
- Les photos d’ambiance sont servies en WebP local depuis `public/assets/img/`, avec variantes responsives et attribution dans `docs/design-system.md`.
- Les styles de mouvement réduit, navigation mobile, focus, images manquantes et placeholders de chargement sont prévus.
- La connexion réelle, l’envoi photo vers Cloudinary et le parcours connecté doivent être essayés sur l’installation de présentation.

## 10. Alignement avec le cahier des charges fourni — 17 novembre 2026

- La source de la spécification et de cette matrice est maintenant le document
  fourni `Projet_fil_rouge_consignes.docx`.
- Les confirmations de suppression de vêtements, semaines et valises utilisent
  une modale intégrée avec un texte adapté à l'élément. Le vieux HTML et les
  styles de la modale non branchée ont été supprimés.
- La suite de tests a été relancée : 111 tests réussis, aucun échec. Le parcours
  Firebase/Cloudinary et la photo manuscrite restent à valider ou à fournir.
