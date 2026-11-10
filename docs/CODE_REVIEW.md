# Revue critique du code

Revue du dépôt après la mise en ordre. Les défauts corrigés sont indiqués ;
les défauts assumés restent listés et hiérarchisés.

## 1. Défauts critiques / élevés

### C1. Règle Chic non déterministe — corrigé

- **Constat** : `resolveChicOutfit` retombait sur `candidatesBase[0]` quand aucune
  chemise/polo n'était trouvée. `validateOutfit` n'interdisait pas le t-shirt en
  Chic. Le prompt ne l'interdisait pas non plus.
- **Risque** : tenue Chic affichée avec un t-shirt, contraire au besoin.
- **Correction** : base limitée à chemise/polo, couche limitée au pull, règles
  ajoutées dans `validateOutfit`, `generateOutfits`, `styleEngine`, prompt et
  tests.
- **Statut** : corrigé.

### C2. Aucune couche chaude obligatoire — corrigé

- **Constat** : `generateOutfits` n'ajoutait une couche qu'un tour sur deux ou
  par temps froid. `validateOutfit` ne l'exigeait jamais.
- **Risque** : tenues sans pull/hoodie, contraires au besoin.
- **Correction** : couche chaude obligatoire dans le validateur, le générateur,
  le résolveur formel et le verrou d'affichage.
- **Statut** : corrigé.

### C3. `styleEngine.js` syntaxiquement cassé — corrigé

- **Constat** : blocs dupliqués orphelins avec `return` hors fonction ;
  `node --check` échouait.
- **Risque** : module impossible à charger, filtre de style inutilisable.
- **Correction** : fichier réécrit, héritage `extends` résolu, exclusions dures,
  `composeOutfit` avec couche chaude.
- **Statut** : corrigé.

### C4. Absence de serveur/API — partiellement corrigé

- **Constat** : `functions/index.js` était un squelette et le CRUD passait
  directement par Firestore.
- **Risque** : non-conformité à l'exigence « serveur applicatif exposant une API,
  logique métier côté serveur ».
- **Correction** : `server.js` sert l'application et expose une API de validation
  et de composition. Le client l'appelle après génération, avec repli local.
- **Reste** : le CRUD garde-robe n'est pas exposé par l'API HTTP ; il passe par
  Firestore et les règles de sécurité. Si le correcteur exige un CRUD 100 %
  serveur, ajouter `/api/clothes` avec Firebase Admin.
- **Statut** : partiel, assumé.

### C5. Modification d'un vêtement absente — corrigé

- **Constat** : création, lecture et suppression existaient ; pas de modification.
- **Correction** : bouton « Modifier », modale préremplie, `updateDoc`,
  `updatedAt`.
- **Statut** : corrigé.

## 2. Défauts moyens

### M1. `firebase-debug.log` suivi par Git — corrigé

- **Constat** : fichier de log commité, 32 Ko.
- **Risque** : fuite d'informations de debug, bruit dans le dépôt.
- **Correction** : `git rm --cached`, `.gitignore` mis à jour.
- **Statut** : corrigé.

### M2. Validation majoritairement côté client — corrigé en partie

- **Constat** : le formulaire validait dans le navigateur ; Firestore acceptait
  largement les écritures.
- **Correction** : `firestore.rules` valide les champs des vêtements ; l'API
  valide ses payloads.
- **Reste** : les règles Firestore ne couvrent pas les tenues sauvegardées.
- **Statut** : partiel.

### M3. Bouton de suppression dupliqué — corrigé

- **Constat** : `renderClothes` créait un bouton puis un second dans `info`.
- **Correction** : un seul bouton, ajout du bouton « Modifier ».
- **Statut** : corrigé.

### M4. Modale de confirmation de suppression inutilisée — ouvert

- **Constat** : le HTML contient `#delete-confirm-modal`, mais `deleteCloth`
  utilise `window.confirm`.
- **Risque** : incohérence d'interface, code mort.
- **Action** : soit brancher la modale, soit retirer le HTML. Faible priorité.
- **Statut** : ouvert.

### M5. `functions/index.js` squelette — corrigé

- **Constat** : boilerplate Firebase Functions non utilisé.
- **Risque** : code mort, confusion sur l'architecture.
- **Correction** : dossier `functions/` retiré du suivi et bloc `functions`
  supprimé de `firebase.json`. Le serveur Node local porte l'API.
- **Statut** : corrigé.

### M6. Identifiants publics dans le code — assumé

- **Constat** : clé Web Firebase et preset Cloudinary non signé dans
  `public/js/config.js`.
- **Analyse** : ce sont des identifiants publics côté client. La sécurité repose
  sur les règles Firestore et les restrictions de clé/domaine. Aucune clé privée
  n'est présente.
- **Action** : restreindre la clé Firebase aux domaines utilisés et documenter.
- **Statut** : assumé.

### M7. `innerHTML` dans quelques rendus — à surveiller

- **Constat** : plusieurs endroits utilisent `innerHTML` avec des données
  contrôlées (icônes, libellés statiques). `escapeHtml` est utilisé pour les
  styles.
- **Risque** : XSS si une donnée utilisateur non échappée y arrive.
- **Action** : préférer `textContent` / `replaceChildren` pour les données
  utilisateur. Déjà le cas pour les noms de vêtements et les cartes.
- **Statut** : à surveiller.

## 3. Défauts bas

- `scorePieceForWeather` et `isOuterwear` ne sont plus appelés après le
  changement de règle météo. Code mort à supprimer ou à réutiliser.
- `styleEngine.js` n'est pas branché au générateur actif ; il est testé comme
  module de référence. À terme, factoriser avec `outfits.js`.
- La modale `#delete-confirm-modal` existe mais `deleteCloth` utilise encore
  `window.confirm`. Faible priorité.
- Le README mentionne Firebase Hosting Emulator comme variante statique ; l'API
  n'y est pas disponible. C'est explicite.

## 4. Checklist du cahier des charges

| Point | Réponse |
| --- | --- |
| Chaque dépendance existe et est légitime ? | Oui : Firebase, `@lhci/cli`, CDN Firebase/Cloudinary/Transformers. |
| Entrées validées côté serveur et échappées ? | Oui pour l'API et Firestore ; échappement majoritaire côté UI. |
| Aucun secret dans le dépôt ? | Oui après retrait du log ; clé Web publique assumée. |
| Erreurs gérées jusqu'à l'utilisateur ? | Partiellement : toasts et cartes d'erreur ; quelques `catch` silencieux. |
| Droits vérifiés côté serveur ? | Oui : `firestore.rules`. |
| Le code fait exactement la spec ? | Partiellement : CRUD via Firestore, API pour la logique de tenue. |
| Code mort / dupliqué ? | Partiel : `functions/`, helpers non utilisés, doublon corrigé. |
| Chaque fichier explicable ? | Oui : `README.md`, `AGENTS.md`, cette revue. |

## 5. Conclusion

Les défauts qui touchaient le besoin principal (couche chaude, Chic sans
t-shirt, hoodie incompatible, Minimaliste) sont corrigés et couverts par des
tests. Les écarts restants sont surtout architecturaux : CRUD direct Firestore,
Cloud Functions non utilisées, photo manuscrite absente et parcours navigateur
non exécuté dans cet environnement. Ils sont documentés plutôt que masqués.
