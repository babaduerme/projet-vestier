# AGENTS.md — Contexte projet StyleAI

## Mission
Application web de garde-robe personnelle : CRUD de vêtements, classification
d'images, génération de tenues, planning hebdomadaire et mode valise. Projet fil
rouge « Coder à l'ère de l'IA » : application complète, terminée, explicable.

## Stack
HTML/CSS/JavaScript ES modules, Firebase Auth + Firestore, Cloudinary pour les
images, Node natif pour le serveur/API, `node:test` pour les tests.

## Commandes
- `npm start` : serveur app + API sur `http://127.0.0.1:5000`.
- `npm test` : tous les tests dans un seul processus.
- `npm run test:matcher` / `npm run test:rules` / `npm run test:style-rules` : tests ciblés.
- `firebase emulators:start --only hosting --project demo-styleai` : statique seul.

## Architecture
- `public/js/outfit-matcher.js` : règles métier pures (types, slots, validation,
  réparation, résolveur Chic/Minimaliste, validation des réponses IA).
- `public/js/outfit-generator.js` : génération pure partagée semaine + valise.
- `public/js/trip-planner.js` : sélection minimale des pièces d'une valise.
- `public/js/trip.js` : page mode valise, météo destination et Firestore trips.
- `public/js/outfits.js` : planning, génération, verrou d'affichage final.
- `public/js/wardrobe.js` : CRUD Firestore de la garde-robe (create/read/update/delete).
- `server.js` : serveur HTTP, fichiers statiques, API de validation métier.
- `public/js/api-client.js` : appel de l'API depuis le navigateur.
- `firestore.rules` : sécurité et validation serveur Firestore.

## Règles métier non négociables
Toute tenue contient exactement un pull ou un hoodie. Un hoodie n'est compatible
qu'avec un t-shirt (jamais polo, chemise, débardeur ou robe). Chic et Minimaliste
n'utilisent que chemise/polo + pull ; jamais de t-shirt ni de hoodie. Streetwear
n'utilise que t-shirt/débardeur comme base, jamais polo ni chemise. Une tenue
invalide est corrigée ou remplacée par une erreur explicite, jamais affichée.

## Conventions
Français pour l'interface et les messages, anglais pour les identifiants de code.
Pas de secret dans le dépôt. Valider les entrées côté serveur. Tester avant de
livrer. Documenter les écarts dans `docs/COMPLIANCE.md`.
