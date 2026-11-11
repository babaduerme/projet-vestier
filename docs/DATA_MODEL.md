# Modèle de données — StyleAI

## 1. Vue d'ensemble

Firestore est la base de données. Chaque utilisateur Firebase possède un
sous-arbre isolé :

```text
users/{uid}
├── clothes/{clothId}
├── outfits/{weekId}
├── settings/weeklyStyles
└── trips/{tripId}
```

Il n'y a pas de collection globale partagée. Les règles de sécurité imposent
`request.auth.uid == uid`.

## 2. Entité `clothes` (vêtement)

Chemin : `users/{uid}/clothes/{clothId}`

| Champ | Type | Obligatoire | Contrainte |
| --- | --- | --- | --- |
| `id` | string | oui (doc id) | Identifiant Firestore. |
| `name` | string | oui | 1 à 80 caractères après trim. |
| `category` | string | oui | `haut`, `bas`, `robe`, `manteau`, `chaussures`, `accessoires`, `ensemble`. |
| `type` | string | oui | Type précis déduit : `t-shirt`, `polo`, `chemise`, `pull`, `hoodie`, `jean`, etc. |
| `slot` | string \| null | oui | `BASE`, `COUCHE`, `VESTE`, `BAS`, `ROBE`, `CHAUSSURES`, `ACCESSOIRE`, ou `null` si type `autre`. |
| `pattern` | string | oui | `uni` ou `motif` (30 caractères max). |
| `colors` | string | oui | Couleurs séparées par des virgules, 1 à 200 caractères. |
| `colorSource` | string | non | `user` ou source d'analyse. |
| `colorConfidence` | string | non | `confirme` ou `incertain`. |
| `isContradictory` | boolean | non | Couleur du nom en contradiction avec la couleur détectée. |
| `description` | string | non | 500 caractères max. |
| `imageUrl` | string \| null | non | URL Cloudinary, 1000 caractères max. |
| `createdAt` | timestamp | oui à la création | `serverTimestamp()`. |
| `updatedAt` | timestamp | non | `serverTimestamp()` à la modification. |

### Contraintes métier

- `type` et `slot` sont dérivés du nom et de la catégorie par
  `detectGarmentType` + `TYPE_TO_SLOT`. Le client ne peut pas les inventer
  arbitrairement : les règles Firestore vérifient leur présence et leur domaine.
- Un vêtement de type `autre` a un `slot` nul et est exclu des tenues.
- Les couleurs sont obligatoires : un vêtement sans couleur n'entre pas dans
  l'analyse de tenue.
- La suppression est définitive (pas de corbeille dans le MVP).

### Index

Aucun index composite n'est nécessaire pour le MVP : la lecture se fait par
collection `users/{uid}/clothes` avec `limit`, puis pagination par curseur sur
`createdAt` implicite du snapshot. Pour un volume important, ajouter un index
`createdAt DESC`.

## 3. Entité `outfits/{weekId}` (semaine sauvegardée)

Chemin : `users/{uid}/outfits/{weekId}`. Chaque sauvegarde créée par l'utilisateur
est conservée indépendamment pour pouvoir la rouvrir ou la supprimer. L'ancien
document fixe `outfits/currentWeek` reste lisible et modifiable pour compatibilité.

| Champ | Type | Contrainte |
| --- | --- | --- |
| `outfits` | array | 0 à 7 éléments. |
| `updatedAt` | string | timestamp | Date de création ou de dernière modification de la sauvegarde. |
| `outfits[].id` | string | Identifiant d'affichage. |
| `outfits[].dayKey` | string | `monday` … `sunday`. |
| `outfits[].name` | string | Libellé du jour. |
| `outfits[].style` | string | Style demandé. |
| `outfits[].styleBadge` | string | Libellé affiché. |
| `outfits[].pieces` | array | Pièces complètes (snapshot du vêtement). |
| `outfits[].missingSlots` | array | Slots manquants si erreur. |
| `outfits[].description` | string | Justification ou message d'erreur. |
| `outfits[].weather` | object \| null | Météo du jour. |
| `outfits[].weatherSummary` | string | Résumé lisible. |
| `outfits[].isError` | boolean | Tenue impossible. |
| `outfits[].isSkipped` | boolean | Aucun style choisi. |

### Contraintes métier

- Une tenue valide contient exactement un `pull` ou un `hoodie`.
- Un `hoodie` n'est présent qu'avec un `t-shirt` en `BASE`.
- Chic et Minimaliste ne contiennent ni `t-shirt` ni `hoodie`.
- Les pièces sont stockées en snapshot : si un vêtement est supprimé, la tenue
  sauvegardée reste lisible mais peut être revalidée à l'affichage.
- `firestore.rules` vérifie le format des entrées, les jours, les styles, les
  champs autorisés et les tailles maximales avant la sauvegarde.

## 4. Entité `settings/weeklyStyles`

Chemin : `users/{uid}/settings/weeklyStyles`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `styles` | map | Clé = `monday` … `sunday`, valeur = `casual`, `chic`, `minimaliste`, `rock`, `streetwear` ou `""`. |

Le planning local utilise aussi `localStorage` pour un affichage immédiat avant
la synchronisation Firestore.

## 5. Entité `trips` (valise sauvegardée)

Chemin : `users/{uid}/trips/{tripId}`

| Champ | Type | Contrainte |
| --- | --- | --- |
| `destination` | string | 1 à 200 caractères. |
| `startDate` / `endDate` | string | Dates `YYYY-MM-DD`, séjour de 21 jours maximum. |
| `styles` | array | 1 à 5 styles du catalogue. |
| `laundryAvailable` | boolean | Indique si une lessive est possible pendant le séjour. |
| `pieceIds` | array | IDs des pièces sélectionnées, 100 maximum. |
| `checkedPieceIds` | array | IDs cochés « déjà dans la valise », 100 maximum. |
| `weatherSnapshot` | array | `{ date, weather }` par jour. |
| `plan` | map | Pièces sélectionnées, tenues jour par jour et compteurs. |
| `createdAt` / `updatedAt` | timestamp | `serverTimestamp()`. |

### Contraintes métier

- Le plan est un snapshot : rouvrir une valise ne dépend pas d'une régénération.
- Les IDs de pièces et les cases cochées sont séparés pour que l'état de
  préparation de la valise soit persisté.
- Les anciennes propriétés `maxPieces` et `cabin` sont ignorées à l'ouverture ;
  les nouveaux plans ne dépendent d'aucune capacité de stockage.
- Les règles Firestore valident les champs racine et la taille des listes.

## 6. Relations

```text
Utilisateur Firebase 1 ─── N Vêtements
Utilisateur Firebase 1 ─── 1 Tenues de la semaine
Utilisateur Firebase 1 ─── 1 Styles de la semaine
Tenue 1 ─── N Pièces (snapshot)
```

- Un vêtement appartient à un seul utilisateur.
- Une tenue référence des snapshots de vêtements, pas des IDs seuls : l'affichage
  reste possible même après modification ou suppression.
- Aucune relation inter-utilisateurs.

## 7. Règles de sécurité et validation

`firestore.rules` :

- `read`, `create`, `update`, `delete` sur `clothes` : propriétaire uniquement.
- `create`/`update` : `isValidCloth(request.resource.data)` vérifie les types,
  longueurs et domaines.
- `outfits` : propriétaire uniquement ; schéma et taille des listes vérifiés.
- `settings/weeklyStyles` : propriétaire uniquement ; les sept jours et les
  styles autorisés sont vérifiés.
- `trips` : propriétaire uniquement ; dates ISO ordonnées, styles, lessive,
  plan et tailles des listes sont vérifiés.
- Tout autre chemin : refusé.

La validation côté client reste présente pour l'expérience utilisateur, mais
elle n'est pas la seule barrière : Firestore refuse une écriture dont le schéma
est invalide. La validation des règles métier de composition reste faite par
`outfit-matcher.js` et l'API ; les règles Firestore ne rejouent pas ce validateur.

## 8. Volumétrie et évolution

- Un utilisateur typique : 20 à 150 vêtements, 7 tenues.
- Pagination de la garde-robe par pages de 6 à 8 éléments selon l'écran.
- Évolutions possibles : collections `history`, `favorites`, `sharedWardrobes`,
  mais hors périmètre du MVP.
