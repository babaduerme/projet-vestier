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
| 10 | Vérifier | « Ajoute des tests et vérifie. » | Correct | 92 tests passent, dont 8 tests d'API. Les cas navigateur non exécutés sont marqués « information manquante » dans `TESTS.md`. |
| 11 | Revoir la conformité au cahier | « Vérifie l'application contre le cahier joint, puis corrige les écarts confirmés. » | Correct après vérification | Remplacement d'une insertion météo `innerHTML` par des nœuds texte, validation de schéma Firestore pour les tenues/réglages/voyages, et mise à jour des documents de conformité. Les parcours Firebase réel et photo manuscrite restent à fournir/vérifier. |
| 12 | Rééquilibrer le mode valise | « Avec une machine, limite les bas et robes, évite les manteaux en double, puis vérifie un séjour de 15 jours. » | Correct après test de régression | Le complément automatique respectait mal le plafond pour 15 jours ; ajout de plafonds et de substitutions validées, puis couverture par un test dédié. |
| 13 | Sauvegarder le planning hebdomadaire | « Je veux pouvoir sauvegarder la semaine. » | Correct après branchement explicite | Ajout d'une action visible pour enregistrer la semaine dans Firestore, avec confirmation de succès, erreur visible et possibilité de réessayer. |
| 14 | Réessayer une journée Chic en échec | « Le bouton de réessai laisse une journée sans tenue. » | Diagnostic partiel, problème d'usage encore ouvert | Une première correction a aligné le libellé de la pièce manquante sur le résolveur. La capture suivante montre que la journée reste sans tenue faute de chaussures habillées. Le bouton relance une composition qui ne peut pas réussir tant que la garde-robe ou le style ne change pas ; ne pas contourner la règle Chic du fil rouge. |
| 15 | Respecter les livrables du fil rouge | « Tiens à jour le journal de prompts et la revue critique, qui sont des livrables. » | À maintenir | Cette ligne et l'écart de réessai sont consignés dans le journal et la revue critique ; les conclusions doivent rester alignées sur le cahier des charges. |
| 16 | Conserver plusieurs semaines | « Je veux pouvoir rouvrir ou supprimer une semaine même après en avoir régénéré une autre, comme pour les valises. » | Correct après évolution du stockage | Abandon du document unique comme destination des nouvelles sauvegardes : chaque semaine explicitement sauvegardée est conservée dans `outfits/{weekId}`. La liste expose Rouvrir/Supprimer ; les modifications d'une semaine rouverte mettent à jour son document. L'ancien `currentWeek` reste lisible. |
| 17 | Sauvegarde hebdomadaire manuelle | « Générer une semaine ne doit pas l'enregistrer ; c'est à moi de cliquer pour la sauvegarder. » | Correct | Retrait des écritures automatiques après génération, réessai et changement de tenue. Le bouton explicite crée une nouvelle sauvegarde ou met à jour celle qui a été rouverte ; l'interface indique les changements non enregistrés. |
| 18 | Réessai automatique des journées en échec | « Je veux que la tenue se génère sans cliquer sur “Réessayer cette journée”. » | Correct avec respect des contraintes | La génération complète relance une fois automatiquement chaque journée en échec, par le même chemin que le bouton. Les règles de style restent actives ; si une pièce obligatoire manque réellement, l'échec précis reste affiché. |
| 19 | Proposer un style de remplacement | « Si des vêtements manquent, afficher un bandeau et proposer un autre style, sauf Chic et Minimaliste. » | Correct | Les cartes en échec proposent Casual, Rock et Streetwear (sauf le style déjà tenté). Le choix met à jour le planning du jour puis relance sa génération, sans modifier les règles métier des styles. |
| 20 | Clarifier les couches dans une tenue | Capture d'une tenue Streetwear affichant le t-shirt et le pull tous deux comme « haut ». | Corrigé | L'affichage des vêtements utilise désormais leur slot normalisé : « Première couche » et « Seconde couche » sont distinguées même si leurs anciennes catégories stockées sont identiques. |
| 21 | Rendre le style Streetwear reconnaissable | « La génération Streetwear ressemble à du Minimaliste. » | Corrigé quand les pièces adaptées existent | Le classement Streetwear favorise maintenant les t-shirts graphiques/oversize, hoodies, bas cargo/jogger, baskets et vestes urbaines. Un test rouge puis vert vérifie le choix de pièces marquées face aux basiques. |
| 22 | Rendre le planning et les sauvegardes lisibles sur mobile | Captures : démarcation des jours faible, badge Aujourd'hui collé, tenues invisibles après génération, sauvegardes difficiles à rouvrir. | Corrigé côté interface | Cartes du planning uniformisées et renforcées, badge séparé, cartes de tenues ramenées sous le planning et défilement vers le résultat après génération/rouverture ; boutons de sauvegarde rapprochés et stylés. |
| 23 | Lire les tenues par couches | « Les vêtements sont plus lisibles en colonne et par section : première, seconde et troisième couche. » | Corrigé | Chaque tenue est rendue en sections verticales par slot normalisé : première couche, seconde couche, manteau/veste, puis bas, robe, chaussures et accessoires. Aucun changement au générateur. |
| 24 | Simplifier la photo et la palette de couleur | Captures : champs fichier natifs en double, pastilles toutes noires, icône de photo trop petite et mal placée. | Corrigé côté interface | Champs fichier masqués derrière les deux boutons existants, palette colorée par attribut `data-color`, bouton Modifier réduit et aligné avec Supprimer, icône SVG agrandie et centrée en arrière-plan. |
| 25 | Accélérer la reconnaissance d'un vêtement | « Le modèle IA met beaucoup trop de temps pour reconnaître un vêtement. » | Amélioré, avec limite de premier chargement | Le modèle démarre dès le choix de la caméra ou de la galerie ; une seule image entière redimensionnée à 512 px est maintenant classée au lieu de deux vues séquentielles. Le premier téléchargement réseau du modèle reste nécessaire. |

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
5. **Réessai d'une journée Chic avec chaussures manquantes.** Le premier correctif
   a réaligné le texte de l'emplacement manquant, mais la capture suivante montre
   que le réessai n'aboutit toujours pas. L'analyse du résolveur confirme qu'il
   refuse correctement les chaussures non habillées en Chic ; le bouton répète
   alors un échec sans aider à modifier le style ou la garde-robe. À résoudre côté
   parcours utilisateur sans affaiblir les règles du cahier des charges.

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

### 6. Refonte UI « Maison de couture nocturne » (12 novembre 2026)

- **Intention** : remplacer la direction claire crème/terracotta par l’univers encre, vert bouteille et champagne ; rendre les pages mobiles et animées.
- **Verdict** : implémentée côté présentation ; contrats HTML/JS et parcours métier préservés.
- **Preuves** : `docs/redesign-spec.md`, `docs/redesign-decisions.md`, huit issues locales et `tests/redesign-contracts.test.mjs` ; suite complète à 107 tests.
- **Limite assumée** : le menu mobile se limite aux trois pages réelles, car le produit n’a pas de page Profil. Le parcours Firebase connecté et le chargement hors ligne sont à vérifier sur le poste de présentation.
