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

### M10. Préférences Streetwear trop faibles — corrigé

- **Constat** : les règles Streetwear interdisaient les bases formelles, mais le
  score favorisait encore les t-shirts et pulls sobres autant que les pièces
  urbaines ; un t-shirt graphique pouvait même être pénalisé.
- **Risque** : une tenue portant le badge Streetwear ressemblait à une tenue
  neutre malgré la présence de pièces plus adaptées dans la garde-robe.
- **Correction** : le classement favorise t-shirts graphiques, hoodies, cargos,
  joggers, baskets et vestes urbaines, tout en respectant les règles de
  composition. Un test de reproduction vérifie le choix des pièces marquées.
- **Limite** : si la garde-robe ne contient que des basiques, le générateur ne
  peut pas inventer des pièces de style.
- **Statut** : corrigé.

### M8. Réessai d'une journée Chic sans chaussures habillées — ouvert

- **Constat** : lorsque la première composition échoue, il fallait cliquer sur
  « Réessayer cette journée » pour lancer une seconde tentative. La capture
  montre aussi le cas où les chaussures habillées sont réellement absentes.
- **Risque** : le bouton donne l'impression qu'une nouvelle tentative peut
  résoudre une pièce absente ; l'utilisateur reste bloqué sans indication
  d'action adaptée.
- **Contrainte** : la règle Chic exige des chaussures habillées ; accepter des
  baskets pour faire disparaître l'erreur serait contraire au cahier des charges.
- **Correction** : après la génération complète, chaque journée en échec est
  relancée une fois automatiquement par le même chemin que le bouton. La carte
  propose aussi Casual, Rock ou Streetwear, puis met à jour le planning du jour
  et tente la génération avec le style choisi.
- **Reste** : si aucune chaussure habillée n'existe réellement, le résolveur doit
  continuer à refuser la tenue Chic. Le parcours d'aide à la garde-robe ou au
  changement de style reste à améliorer.
- **Statut** : partiellement corrigé ; relance automatique couverte par test de
  branchement, parcours Firebase réel à valider.

### M9. Une seule semaine conservée — corrigé

- **Constat** : toutes les générations écrivaient dans `outfits/currentWeek`, ce
  qui écrasait la sauvegarde précédente ; la génération sauvegardait aussi sans
  action explicite.
- **Correction** : seule l'action « Sauvegarder ma semaine » écrit. Chaque semaine
  enregistrée utilise un document distinct ; la liste permet de rouvrir,
  modifier puis sauvegarder, ou supprimer chaque document. L'ancien `currentWeek`
  est toujours lu et peut être modifié ou supprimé.
- **Statut** : corrigé ; les règles Firestore autorisent déjà la validation de
  schéma pour tous les documents de la collection `outfits`.

### M1. `firebase-debug.log` suivi par Git — corrigé

- **Constat** : fichier de log commité, 32 Ko.
- **Risque** : fuite d'informations de debug, bruit dans le dépôt.
- **Correction** : `git rm --cached`, `.gitignore` mis à jour.
- **Statut** : corrigé.

### M2. Validation des données Firestore — corrigé en partie

- **Constat** : plusieurs écritures Firestore n'avaient que le contrôle de
  propriétaire, sans validation de schéma.
- **Correction** : `firestore.rules` valide les vêtements, les champs et tailles
  des tenues et voyages, et les styles hebdomadaires.
- **Reste** : Firestore ne rejoue pas le validateur métier de composition des
  tenues ; l'API et le verrou d'affichage restent nécessaires.
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
  `public/js/core/config.js`.
- **Analyse** : ce sont des identifiants publics côté client. La sécurité repose
  sur les règles Firestore et les restrictions de clé/domaine. Aucune clé privée
  n'est présente.
- **Action** : restreindre la clé Firebase aux domaines utilisés et documenter.
- **Statut** : assumé.

### M7. Données météo injectées dans `innerHTML` — corrigé

- **Constat** : le nom de ville météo issu de `localStorage` était interpolé
  dans `innerHTML`.
- **Risque** : une valeur modifiée dans le stockage local pouvait être
  interprétée comme du balisage.
- **Correction** : création du SVG avec l'API DOM et affichage du nom via
  `textContent` ; les détails météo utilisent aussi des nœuds texte.
- **Statut** : corrigé ; les autres `innerHTML` repérés servent des fragments
  statiques ou des valeurs déjà échappées.

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
| Entrées validées côté serveur et échappées ? | API et schémas Firestore validés ; validation métier Firestore des tenues encore partielle. Données affichées en texte sûr dans les vues inspectées. |
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
