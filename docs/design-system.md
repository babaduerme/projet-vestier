# StyleAI — système visuel « Maison de couture nocturne »

## Décision de direction

Le générateur UI/UX Pro Max recommande une composition éditoriale minimaliste, une hiérarchie serif/sans serif et des mouvements sobres. Sa palette suggérée n’est pas retenue : le cahier des charges impose encre, vert bouteille et champagne.

## Tokens

| Rôle | Valeur |
| --- | --- |
| Encre | `#0B0B0C` |
| Surface | `#121415` |
| Surface élevée | `#1A1D1E` |
| Vert bouteille | `#0F2A24` → `#163A31` |
| Champagne | `#D8C3A0` / `#EADBC0` |
| Ivoire | `#F4EFE6` |
| Texte secondaire | `rgba(244,239,230,.72)` |
| Filet | `rgba(255,255,255,.10)` |
| Erreur | `#8C2F39` |

Titres : Cormorant Garamond, puis Georgia. Interface : Inter, puis system-ui. Échelle basée sur 4/8 px, conteneur maximal 1440 px. Rayons 2–4 px pour les composants, 0 pour les cadres éditoriaux. Mouvement : transform/opacity, courbe `cubic-bezier(.22,1,.36,1)`, arrêt via `prefers-reduced-motion`.

## Composants et états

- Boutons à libellé explicite, minimum 44 px de hauteur tactile, champagne pour l’action principale, contour fin pour l’action secondaire.
- Champs avec libellés persistants, fond encre et focus champagne nettement visible.
- Cartes et listes sur surfaces sombres, filets fins, sans ombre lourde ni grande forme arrondie.
- États vides avec icône SVG filaire, chargements réservant leur espace et erreurs textuelles près de l’action concernée.
- Images de vêtements cadrées en 3:4, objet `cover`, espace réservé pendant le chargement ; les images des utilisateurs restent leurs fichiers existants.
- Navigation bureau en en-tête ; navigation mobile fixe en bas avec les trois pages existantes, espace inférieur sûr. Aucun lien Profil n’est affiché car aucune page Profil n’existe.

## Responsive et accessibilité

Mobile-first : 360/480/768/1024/1280/1536 px. La garde-robe utilise deux colonnes au téléphone puis 3–5 colonnes. Le planning passe en rangée scroll-snap au mobile et 7 colonnes sur grand écran. Les modales deviennent des feuilles basses au téléphone. Aucun contenu essentiel ne repose uniquement sur la couleur, focus clavier visible et mouvements réduits pris en compte.

## Anti-patterns proscrits

Palette crème/terracotta/brun, cartes fortement arrondies, vêtements dessinés, emojis comme icônes, texte d’action seulement au survol, défilement horizontal de page, focus masqué, animations de dimensions, modification des règles métier ou identifiants consommés par le JavaScript.

## Références

- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- [MDN — images responsives](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images)
- [MDN — performance CSS et animations](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS)
- [WCAG 2.2 — Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance)

## Photographies

- Hero éditorial : [David Banjo, Unsplash](https://unsplash.com/photos/a-stylish-woman-in-a-dark-coat-and-boots-Y_BSnYYtU24), licence Unsplash. Variantes locales WebP 960 et 1600 px.
- Atelier : [Zainab Iqbal, Unsplash](https://unsplash.com/photos/tailor-shop-with-suits-and-fabric-lcI46gCA_6U), licence Unsplash. Variantes locales WebP 640 et 1200 px.
