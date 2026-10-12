# Toise — l'app de mesure pour iPhone

Application web installable (PWA), 100 % hors ligne, sans compte ni publicité.

## Ce qu'elle fait de plus que « Mesures » d'Apple

| Outil | Toise | Mesures (iPhone) |
|---|---|---|
| **Photo** | Mesure sur n'importe quelle photo (même ancienne) grâce à un objet de référence. **Correction de perspective** par homographie à partir des 4 coins (carte bancaire, A4, billet, carreau ou taille personnalisée). Longueurs, **surfaces + périmètre**, **angles réels**. Loupe de précision, zoom par pincement, précision estimée affichée. | Uniquement en direct, en AR |
| **Hauteur** | Hauteur d'un arbre, d'un mur, d'un bâtiment par visée caméra + trigonométrie. Distance calculée automatiquement, ou saisie pour plus de précision. | Hauteur des personnes seulement |
| **Niveau** | Bulle 2D au 0,1°, mode chant, **pente en % et mm/m**, zéro relatif, figer la valeur, signal sonore, **calibrage par retournement à 180°** (supprime le défaut du capteur). | Pas de calibrage, pas de pente |
| **Règle** | Règle cm / pouces à l'échelle réelle (modèle d'iPhone détecté) avec deux curseurs ; calibrage avec une carte bancaire. | Absent |
| **Mesures** | Historique avec photo annotée, note et date ; copier ou partager. Unités : cm, mm, m, in, ft. | Limité |

## Installer sur l'iPhone

L'app doit être servie en **HTTPS** (requis pour la caméra et les capteurs).

1. Héberger le dossier `app-mesure/` (Vercel, Netlify, GitHub Pages… aucun build nécessaire).
2. Ouvrir l'adresse dans **Safari** › bouton Partager › **Sur l'écran d'accueil**.
3. Au premier usage du Niveau ou de la Hauteur, autoriser « Mouvement et orientation ».

## Conseils de précision

- Photo : la référence doit être **dans le même plan** que l'objet mesuré (posée sur le mur, le sol, la table). Plus la référence est grande (A4 plutôt que carte), plus la mesure est précise. Zoomez avant de placer les points.
- Hauteur : tenez le téléphone verticalement à la hauteur indiquée, sur un sol plat ; entrez la distance si vous la connaissez.
- Niveau : calibrez une fois sur une surface stable (posez, « Calibrer », tournez de 180°, « Étape 2 »).

## Fichiers

`index.html`, `styles.css`, `app.js` (aucune dépendance), `manifest.webmanifest`, `sw.js` (hors ligne), `icons/`.
