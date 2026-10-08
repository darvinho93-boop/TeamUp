# Team Up! — kit de marque pour l'app web

Tout ce qu'il faut pour habiller l'app à partir de la planche de logo.

## Contenu

```
teamup-brand/
├── README.md
├── preview.html              # ouvre ce fichier pour voir la charte appliquée
├── manifest.webmanifest      # PWA
├── tokens/
│   ├── tokens.css            # variables CSS — source de vérité
│   └── tokens.json           # mêmes valeurs, pour JS / Tailwind / Figma
├── logo/
│   ├── teamup-mark.svg               # rosace seule, couleur
│   ├── teamup-mark-white.svg         # rosace blanche (fond sombre)
│   ├── teamup-mark-navy.svg          # rosace monochrome navy
│   ├── teamup-horizontal.svg         # lockup principal + baseline
│   ├── teamup-horizontal-white.svg   # lockup fond sombre
│   ├── teamup-horizontal-navy.svg    # lockup monochrome
│   ├── teamup-stacked.svg            # version empilée
│   └── png/                          # exports @2x pour mail, docs, réseaux
└── icons/
    ├── favicon.svg, favicon-16.png, favicon-32.png
    ├── apple-touch-icon.png (180)
    ├── icon-192.png, icon-512.png
    └── icon-maskable.svg, icon-maskable-512.png
```

## À savoir avant d'utiliser

Le mark SVG est **vectorisé depuis ton image** : chaque couleur a été isolée puis tracée
en courbes de Bézier (potrace), donc les silhouettes sont celles de ton logo, pas un
redessin approchant. Reste la limite inhérente au point de départ : l'image est un PNG,
donc les contours portent un très léger lissage hérité du bitmap. Pour un usage grand
format (bâche, kakémono), fais repasser un graphiste sur les courbes, ou remplace
`logo/teamup-mark.svg` si tu récupères un jour le vectoriel d'origine — le reste du kit
se régénère à partir de ce seul fichier.

Les lockups utilisent **Poppins Bold** en `<text>` : la police doit être chargée pour
que le SVG s'affiche correctement. Pour un usage hors de ton site (presse-papier, PDF,
partenaires), sers-toi des PNG de `logo/png/`, ou fais vectoriser le texte.

## Brancher dans l'app

```html
<link rel="stylesheet" href="/tokens/tokens.css">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0F2D5B">
```

Polices (Google Fonts) :

```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600&family=Noto+Sans+Tamil:wght@400;600&display=swap" rel="stylesheet">
```

`Noto Sans Tamil` est indispensable pour le tamoul : sans elle, les glyphes tombent sur
une fallback système illisible sur une partie des appareils.

Tailwind, si tu l'utilises :

```js
// tailwind.config.js
import tokens from './tokens/tokens.json'
export default {
  theme: { extend: {
    colors: { ...tokens.color.brand, ...tokens.color.semantic },
    fontFamily: {
      display: [tokens.font.display, 'sans-serif'],
      body: [tokens.font.body, 'sans-serif'],
      tamil: [tokens.font.tamil, 'sans-serif'],
    },
    borderRadius: tokens.radius,
  }},
}
```

## Deux thèmes

- **Par défaut** (toute l'app et la vitrine) : fond beige du logo `#F7F3E6`, texte navy.
  Depuis le 9 octobre 2026, l'écran commun, la régie et le back-office sont eux aussi sur ce
  fond : un écran projeté clair, c'est un choix assumé.
- **`data-theme="stage"`** : fond navy profond, texte blanc, primaire en vert sauge. Il ne
  sert plus qu'aux blocs marine de la vitrine.

Le pictogramme existe en quatre calques (`logo/calques/`, un par couleur) : l'app les empile
et les anime pour l'écran de chargement.

## Choix faits, et pourquoi

- **Pierre claire écartée des couleurs d'équipe.** `#EAE3D7` sur fond crème n'a pas assez
  de contraste pour identifier une équipe à 10 mètres. La 4e équipe passe en ambre
  `#E0A100`. Le stone reste une couleur de surface.
- **Cibles tactiles à 56 px** (`--tu-tap-min`), pas 44. Les invités jouent debout, un
  verre à la main, dans une salle mal éclairée.
- **Type display à 6 rem** pour les timers et le podium : lisible depuis le fond de salle.
- **Corail réservé à l'action**, jamais au décor : c'est le seul signal « c'est à toi de
  jouer » dans une interface qui doit se comprendre en deux secondes.
