# StyleAI — AI Wardrobe

Application web de garde-robe personnelle : ajout de vêtements, classification
automatique par photo, génération de tenues cohérentes et planning hebdomadaire.
Le projet est réalisé en HTML/CSS/JavaScript vanilla avec Firebase pour
l'authentification et la persistance, et un petit serveur Node pour l'API de
validation métier.

## Fonctionnalités

- Authentification Firebase (connexion, inscription, déconnexion).
- Garde-robe : création, consultation, modification et suppression de vêtements.
- Ajout d'un vêtement par photo (caméra) ou par image choisie dans les documents.
- Analyse d'image : classification du type de vêtement et extraction des couleurs
  dominantes (Transformers.js / CLIP, avec repli MobileNet).
- Upload des photos vers Cloudinary.
- Générateur de tenues : règles métier déterministes, couche chaude obligatoire,
  compatibilité hoodie/pull, styles Casual, Chic, Minimaliste, Rock, Streetwear.
- Planning hebdomadaire : un style par jour, météo, génération et sauvegarde.
- Mode valise : destination, dates, styles, météo de la destination, sélection
  minimale de pièces réutilisées, tenues jour par jour, sauvegarde et reprise.
- API locale de validation métier et de composition formelle.
- Tests automatisés avec `node:test`.

## Prérequis

- Node.js 20 ou supérieur (testé avec Node 24).
- npm.
- Un navigateur moderne.
- Un projet Firebase configuré dans `public/js/core/config.js` (le projet
  `vestiairedevetement` est déjà utilisé par l'application).
- Une connexion Internet pour Firebase, Cloudinary et les modèles d'analyse
  d'image.

## Installation et lancement

```bash
npm install
npm start
```

L'application et l'API sont servies sur :

- Application : <http://127.0.0.1:5000>
- Santé de l'API : <http://127.0.0.1:5000/api/health>

Le port et l'hôte peuvent être changés :

```bash
PORT=8080 HOST=127.0.0.1 npm start
```

### Variante Firebase Hosting Emulator

Pour ne servir que les fichiers statiques avec Firebase :

```bash
firebase emulators:start --only hosting --project demo-styleai
```

Cette variante ne lance pas l'API Node ; l'application retombe alors sur sa
validation locale. Pour profiter de la validation serveur, utilisez `npm start`.

## Tests

```bash
npm test
```

La commande exécute tous les fichiers `tests/*.test.mjs` dans un seul processus.
Elle couvre les règles de tenues, les styles, le moteur de style, le serveur HTTP
et l'API.

Tests ciblés :

```bash
npm run test:matcher
npm run test:rules
npm run test:style-rules
```

## API

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/health` | État du serveur. |
| POST | `/api/outfits/validate` | Valide une tenue : `{ pieces, style, weather }`. |
| POST | `/api/outfits/check-wardrobe` | Vérifie si une garde-robe permet une tenue : `{ wardrobe, style }`. |
| POST | `/api/outfits/chic` | Compose une tenue Chic ou Minimaliste : `{ wardrobe, style, weather, avoidIds }`. |
| POST | `/api/outfits/validate-response` | Valide et corrige une réponse d'agent IA : `{ response, wardrobe, style, weather }`. |

Toutes les entrées sont validées côté serveur (types, longueurs, styles autorisés,
bornes météo). Les erreurs de payload renvoient un JSON `400` avec un message
explicite.

## Structure du projet

```text
.
├── public/                 Application statique
│   ├── js/
│   │   ├── core/               Configuration, API client, thème et UI
│   │   ├── auth/               Authentification et connexion
│   │   ├── wardrobe/           Garde-robe, classification et couleurs
│   │   ├── outfits/             Planning et entrée de la page tenues
│   │   ├── trip/                Page valise et planificateur de séjour
│   │   └── shared/              Météo, génération, validation et styles partagés
│   ├── css/
│   └── *.html
├── server.js               Serveur HTTP + API (Node natif)
├── tests/                  Tests node:test
├── firestore.rules         Règles de sécurité et validation Firestore
├── docs/                   Spécification, modèle de données, conformité, revue
├── AGENTS.md               Contexte projet pour les agents
├── TESTS.md                Dix cas de vérification et résultats
└── README.md
```

## Firestore

Les données sont stockées sous :

- `users/{uid}/clothes/{clothId}` : vêtements.
- `users/{uid}/outfits/{weekId}` : sauvegardes hebdomadaires (réouverture,
  modification et suppression). L'ancien document `currentWeek` reste pris en
  charge pour les données déjà enregistrées.
- `users/{uid}/settings/weeklyStyles` : styles choisis par jour.
- `users/{uid}/trips/{tripId}` : valises sauvegardées (destination, dates,
  styles, pièces, cases cochées, météo).

Les règles de `firestore.rules` limitent chaque utilisateur à ses propres données
et valident les champs des vêtements côté serveur (Firestore).

Déploiement des règles :

```bash
firebase deploy --only firestore:rules
```

## Configuration et secrets

- La clé Web Firebase et le preset Cloudinary non signé sont des identifiants
  publics côté client ; ils ne donnent pas accès aux données des autres
  utilisateurs grâce aux règles Firestore.
- Aucune clé privée, aucun mot de passe et aucun token ne doit être commité.
- `firebase-debug.log` est ignoré et retiré du suivi Git.

## Limites connues

- Le CRUD de la garde-robe passe directement par le SDK Firebase client ; les
  règles Firestore valident les écritures côté serveur, mais il n'existe pas
  encore d'API CRUD HTTP dédiée.
- Aucune Cloud Function n'est nécessaire ou déployée ; l'API locale est portée
  par `server.js`.
- La photo de la spécification manuscrite de la séance 1 est manquante
  (`docs/specification-manuscrite.jpg`).
- Le déploiement en ligne n'est pas requis par le cahier des charges ; le projet
  se lance en local avec `npm start`.

## Documentation

- [Spécification](docs/SPECIFICATION.md)
- [Modèle de données](docs/DATA_MODEL.md)
- [Conformité au cahier des charges](docs/COMPLIANCE.md)
- [Journal de prompts](docs/PROMPTS.md)
- [Revue critique](docs/CODE_REVIEW.md)
- [Cas de vérification](TESTS.md)
- [Contexte agent](AGENTS.md)
