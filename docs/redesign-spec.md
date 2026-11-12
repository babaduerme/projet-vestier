# Spécification — refonte StyleAI

## Objectifs

Remplacer le langage visuel crème/terracotta illustré par une expérience responsive et accessible de maison de couture nocturne. Préserver intégralement les comportements métier de l’authentification, du dressing, des tenues, des voyages, de la météo et des sauvegardes.

## Utilisateurs et histoires

- Comme visiteur, je comprends rapidement la proposition grâce à une landing éditoriale et je peux rejoindre l’inscription/connexion.
- Comme membre, je retrouve la garde-robe, peux filtrer/ajouter/modifier/supprimer un vêtement et lancer les tenues.
- Comme membre, je choisis les styles de la semaine, génère, sauvegarde, rouvre et supprime une semaine.
- Comme voyageur, je renseigne destination/dates/styles/lessive, génère puis sauvegarde, rouvre, modifie ou supprime une valise.
- Comme utilisateur mobile ou clavier, j’accède aux pages existantes depuis une navigation fixe en bas avec contrôles visibles, tailles tactiles confortables et focus perceptible.

## Direction et comportement

Les tokens, composants, états et breakpoints sont définis dans `design-system.md`. Photos d’ambiance réelles et optimisées, médias de vêtements au ratio 3:4, aucun emoji ou dessin décoratif. Les animations ne changent pas les données ni les règles de génération.

## Critères d’acceptation

1. Les cinq pages principales utilisent le même système encre/vert/champagne et ne conservent pas l’ancien fond clair, terracotta ou dessins de vêtements.
2. Les photos possèdent texte alternatif, dimensions réservées, variantes responsives et chargement adapté à leur position.
3. Les parcours existants et identifiants JS restent opérationnels.
4. De 360 à 1920 px, aucune barre horizontale globale ; planification utilisable sur mobile.
5. Le clavier, focus visible et mouvement réduit sont pris en charge.
6. Les tests existants et le nouveau contrôle des contrats passent.

## Hors périmètre

Tout changement de génération, de règles de tenue, de météo, de persistance, d’authentification ou de modèle Firestore ; ajout de framework/dépendance métier ; nouvelle page Profil.
