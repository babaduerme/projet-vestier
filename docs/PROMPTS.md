# Journal de prompts

Une entrée par prompt significatif. La dernière colonne est la plus importante :
ce que j'ai corrigé, et pourquoi. Les échecs sont conservés.

| # | Intention | Prompt (résumé) | Verdict | Ce que j'ai corrigé et pourquoi |
| --- | --- | --- | --- | --- |
| 1 | Diagnostiquer les t-shirts en Chic | « Le générateur Chic propose des t-shirts. Trouve la cause réelle dans le code, puis corrige et vérifie. » | Insuffisant au premier passage | Le premier diagnostic s'est arrêté à « le prompt est permissif ». En lisant `resolveChicOutfit`, la cause réelle était le repli `candidatesBase[0]`, qui acceptait n'importe quelle base, et l'absence de règle de style dans `validateOutfit`. |
| 2 | Imposer la couche chaude | « Chaque tenue doit contenir un pull ou un hoodie, sans exception ; hoodie uniquement avec t-shirt ; pull avec chemise/polo/t-shirt. » | Correct après tests | Ajout de constantes, de règles dans `validateOutfit`, de la réparation et d'un verrou d'affichage. Les tests ont d'abord été écrits au rouge. |
| 3 | Réparer le moteur de style | « Les t-shirts passent peut-être par des catégories fusionnées ou un filtre absent. » | Échec instructif | `styleEngine.js` était syntaxiquement cassé (blocs dupliqués avec `return` hors fonction). Il fallait d'abord réparer le fichier, puis résoudre `extends` et les exclusions dures. |
| 4 | Vérifier Minimaliste | « Minimaliste doit hériter de Chic sans cravate, nœud papillon ni fioritures. » | Correct | Minimaliste est routé vers `resolveFormalOutfit` avec `style: "minimaliste"`, et `styleEngine.resolveStyle` fusionne les exclusions du parent. |
| 5 | Aligner sur le cahier des charges | « Mets le projet en ordre avec ce cahier des charges. » | Partiel puis complété | Audit : README, spécification, modèle de données, AGENTS.md, TESTS.md, journal et revue manquaient. Ajout d'un serveur API, d'un runner de tests et de la modification des vêtements. |
| 6 | Ajouter une API | « Il faut un serveur applicatif avec une API et une validation côté serveur. » | Correct | `server.js` sert l'application et expose `/api/outfits/*`. L'API valide les payloads et réutilise les règles métier pures. Le client l'appelle après génération, avec repli local si l'API est absente. |
| 7 | Compléter le CRUD | « Il manque la modification d'un vêtement. » | Correct | Ajout du bouton « Modifier », de `openEditModal`, de `updateDoc` et de `updatedAt`. Suppression du doublon de bouton de suppression. |
| 8 | Sécuriser Firestore | « La validation doit être côté serveur, pas seulement dans le navigateur. » | Correct | `firestore.rules` valide les champs des vêtements et isole chaque utilisateur. |
| 9 | Nettoyer le dépôt | « Aucun secret, aucun log dans le dépôt. » | Correct | `firebase-debug.log` retiré du suivi Git et ajouté au `.gitignore`. |
| 10 | Vérifier | « Ajoute des tests et vérifie. » | Correct | 79 tests passent, dont 8 tests d'API. Les cas navigateur non exécutés sont marqués « information manquante » dans `TESTS.md`. |

## Échecs analysés

1. **Premier diagnostic trop court.** J'ai d'abord supposé que le prompt suffisait
   à expliquer les t-shirts en Chic. La lecture de `resolveChicOutfit` a montré
   un repli explicite vers `candidatesBase[0]`. Leçon : suivre la donnée jusqu'au
   point de décision, pas seulement le texte du prompt.
2. **`styleEngine.js` cassé.** Le fichier contenait deux blocs orphelins avec
   `return` hors fonction. Le test `node --check` a échoué immédiatement. Leçon :
   vérifier la syntaxe avant de diagnostiquer une logique.
3. **Règle météo contradictoire.** La règle « temps chaud interdit la couche »
   contredisait « couche chaude sans exception ». J'ai retiré l'interdiction et
   conservé la couche obligatoire. Leçon : une exigence globale doit primer sur
   une préférence locale.
4. **`avoidIds` trop strict.** Il rendait la seule couche chaude indisponible le
   deuxième jour. Corrigé en traitant `avoidIds` comme une préférence, pas comme
   une indisponibilité.

## Cinq prompts réutilisables

### 1. Diagnostic reproductible

```text
Tu es ingénieur debug. Pour le bug suivant : [symptôme exact].
1) Écris d'abord un test ou une commande qui échoue sur ce symptôme.
2) Minimise le cas.
3) Liste 3 hypothèses falsifiables, classées.
4) Instrumente une seule variable à la fois.
5) Corrige, puis ajoute le test de régression.
Ne propose aucune correction avant que le test rouge existe.
```

### 2. Règle métier déterministe

```text
Implémente la règle métier suivante : [règle].
Contraintes : validation dans le code après la réponse de l'IA, jamais
uniquement dans le prompt. Si une tenue est invalide, corrige-la ou rejette-la
avec un message précis. Ajoute des tests pour chaque cas limite.
```

### 3. API avec validation serveur

```text
Ajoute une API [routes] qui expose [logique métier].
Valide côté serveur : types, longueurs, enum, bornes numériques.
Réutilise les modules purs existants. Ajoute des tests HTTP avec des payloads
valides et invalides. N'ajoute aucun secret dans le dépôt.
```

### 4. Mise en conformité documentaire

```text
Compare le dépôt au cahier des charges [fichier]. Produis une matrice
Conforme / Partiel / Non conforme avec preuves et actions. Crée les livrables
manquants : README, spécification, modèle de données, AGENTS.md, TESTS.md,
journal de prompts, revue critique. Marque « information manquante » pour ce
que tu ne peux pas vérifier.
```

### 5. Revue critique honnête

```text
Fais une revue critique du diff depuis [commit]. Sépare Standards et Spec.
Cherche : dépendances inutiles, validation serveur absente, secrets, erreurs non
gérées, droits non vérifiés, code mort, duplication, écart au périmètre.
Classe par gravité et assume ce qui n'est pas corrigé.
```
