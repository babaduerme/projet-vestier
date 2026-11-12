# Revue critique — refonte StyleAI

## Grill du plan avant modification

1. **Comment garder les contrats du JavaScript ?** Les scripts sélectionnent beaucoup d’IDs, `.nav-links`, `.filter-pill`, `.modal`, `.tab` et attributs `data-*`. On conserve ces noms et l’ordre des scripts. Les scripts métier et les schémas Firestore ne sont pas modifiés.
2. **Comment composer le responsive sans casser la semaine ?** Les sept cartes sont produites dynamiquement ; CSS Grid les place en bureau et un conteneur scroll-snap local les rend parcourables au téléphone. La page ne gagne pas de débordement horizontal global.
3. **Quels composants sont partagés ?** `base.css` porte les tokens, la typographie, les états et la navigation ; `components.css` les contrôles, formulaires, badges, cartes et dialogues ; les six feuilles `pages/*.css` règlent les layouts spécifiques.
4. **Quels risques métier ?** Auth, Firestore, Cloudinary, météo, génération, sauvegarde/chargement/suppression restent dans leurs modules actuels. Le changement se limite au balisage de présentation, au style et à un module d’animations sans effet sur données ni événements métier.
5. **Où les photos seront-elles conservées ?** Photos d’ambiance locales et optimisées dans `public/assets/img/`; les photos de la garde-robe continuent à provenir de Cloudinary. Aucun compte ni donnée distante n’est modifié.
6. **Quelle navigation mobile est réellement disponible ?** Le produit n’a pas de page Profil. Le menu présente donc les trois pages existantes ; le contrôle de déconnexion reste dans la zone utilisateur existante.
7. **Quel prototype valide la direction ?** Hero photo local, titre serif, deux CTA et une carte lookbook. On vérifie le contraste et la composition avant de décliner les tokens sur les autres vues.

## Recherche

Les images responsives réservent leur espace via dimensions et `srcset/sizes`. Les animations privilégient transform/opacity et le réglage de mouvement réduit. Les focus clavier restent très visibles. Références détaillées dans `design-system.md`.

## Hypothèses retenues

- « Entièrement animé » signifie des transitions utiles et des apparitions discrètes, pas un mouvement continu qui gênerait la lecture.
- La photo du hero est chargée sans lazy-loading ; les médias hors écran sont différés.
- Les limites et règles existantes de validation métier sont hors périmètre même si elles influencent l’affichage.
- Les tests natifs existants protègent les principaux flux ; on ajoute un test statique des contrats HTML et on lance la suite complète.
