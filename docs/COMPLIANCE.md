# Conformité au cahier des charges

Référence : `5ef268df-bf15-4107-89a2-eefa82ad70aa.docx` — 3A DW, projet fil rouge.
Cette matrice dit ce qui est fait, ce qui est partiel et ce qui manque encore.

## 1. Périmètre technique

| Exigence | Statut | Preuve / action |
| --- | --- | --- |
| Interface web avec plusieurs écrans et navigation cohérente | Conforme | `index.html`, `login.html`, `wardrobe.html`, `outfits.html`, `404.html`, `auth.js`. |
| Serveur applicatif exposant une API, logique métier côté serveur | Conforme | `server.js` expose `/api/health`, `/api/outfits/validate`, `/api/outfits/check-wardrobe`, `/api/outfits/chic`, `/api/outfits/validate-response`. Il importe les règles métier de `outfit-matcher.js`. |
| Base de données et données persistantes | Conforme | Firestore : `users/{uid}/clothes`, `outfits/currentWeek`, `settings/weeklyStyles`. |
| CRUD complet sur au moins une entité | Conforme | Garde-robe : création, lecture, modification (bouton « Modifier » + `updateDoc`), suppression. |
| Validation des entrées côté serveur | Conforme | `server.js` valide types, longueurs, styles, météo. `firestore.rules` valide les vêtements avant écriture. |
| Dépôt Git avec historique lisible | Conforme | Cinq commits de construction : cadrage documentaire, règles de tenues, API/CRUD, nettoyage du dépôt, conformité. |
| README d'installation | Conforme | `README.md` : prérequis, `npm install`, `npm start`, tests, API, structure. |

## 2. Les sept critères du fini

| Critère | Statut | Détail |
| --- | --- | --- |
| Aucun bouton mort, lien sans destination, écran vide sans explication | Partiel | Les états vides de garde-robe et de planning sont traités. La modale de confirmation de suppression existe mais `deleteCloth` utilise encore `confirm()` : doublon d'interface à nettoyer. |
| Aucun TODO, code commenté, fonctionnalité à moitié branchée | Partiel | Le squelette `functions/` et les helpers non appelés ont été retirés. Reste la modale de suppression non branchée. |
| Chaque opération va jusqu'au bout | Conforme | CRUD garde-robe, génération, sauvegarde de semaine. |
| Cas d'erreur traités et affichés | Partiel | Erreurs Firebase, Cloudinary, API et tenues impossibles affichées. Tous les chemins réseau ne sont pas couverts par un test navigateur. |
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
| Droits vérifiés côté serveur | Conforme | `firestore.rules` : `request.auth.uid == userId`. |
| Le code fait ce que la spec demande | Partiel | Le CRUD passe par Firestore, pas par l'API HTTP. C'est documenté et assumé ; l'API porte la logique de tenue. |
| Code mort / dupliqué | Partiel | `functions/index.js` squelette, helpers non utilisés, doublon de bouton supprimé. |
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
2. **Pas de Cloud Functions déployées.** `functions/index.js` est un squelette.
3. **Photo manuscrite absente.** À ajouter avant le rendu.
4. **Parcours navigateur non exécuté dans cet environnement.** Les tests
   automatisés couvrent les règles et l'API ; la connexion Firebase réelle, le
   upload Cloudinary et l'analyse d'image restent à valider manuellement.
5. **Historique Git.** À compléter par des commits lisibles ; un commit unique
   n'est pas acceptable pour le critère « historique lisible ».
