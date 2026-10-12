# Toise — l'app de mesure pour iPhone

Application web installable (PWA), sans compte ni publicité, sans aucune bibliothèque externe. Tout fonctionne hors ligne ; le fond de carte de l'outil Terrain demande internet la première fois, puis les zones déjà vues restent disponibles sans réseau.

## Les outils

| Outil | Ce qu'il mesure | Précision |
|---|---|---|
| **Photo** | Longueurs, surfaces + périmètre, angles réels sur n'importe quelle photo, grâce à un objet de référence : carte bancaire, A4, A3, billet, carreau, **praticable de scène 2 × 1 m**, **palette**, rectangle ou longueur connue (mm, cm ou m). Correction de perspective par homographie. | Aimant sous-pixel : les bords de la référence sont ajustés par droites (insensible aux coins arrondis) et chaque point est recalé sur le bord ou le coin le plus net. Glissement démultiplié ×0,4, loupe en pixels réels, photo en pleine résolution. **Marge ± à 95 %** calculée pour chaque mesure. |
| **Visée › Hauteur** | Hauteur d'un mur, d'une voûte d'église, d'une structure, d'un arbre : on vise le pied puis le sommet. | Capture automatique quand le téléphone est immobile, moyenne de ~30 relevés, marge ± affichée. Saisir la distance au sol la rend encore plus précise. |
| **Visée › Distance** | Distance entre deux points au sol sans s'y rendre (largeur d'une scène, d'une nef, entre deux poteaux). | Inclinaison + cap gyroscopique, loi des cosinus, marge ± affichée. |
| **Visée › Surface au sol** | Surface d'une salle depuis un seul point : on vise chaque coin au ras du sol, dans n'importe quel ordre. Croquis vu de dessus avec la longueur de chaque côté. | Idéal jusqu'à ~15 m de portée avec le téléphone à 1,5 m. |
| **Terrain** | **Très grandes surfaces** : parcelle, parvis, champ de festival, toiture, chapiteau. On pose les coins sur une carte satellite intégrée, ou on ajoute sa position GPS à chaque coin, ou « Marche auto » en faisant le tour. Longueur affichée sur chaque côté ; toucher une étiquette insère un point ; les points sont gardés même si l'app se ferme. Résultat en m², ares, hectares, acres + périmètre. | Aire géodésique (courbure de la Terre). Points GPS moyennés 8 s et pondérés. Points posés au doigt glissés à mi-vitesse. Marge ± affichée. Export des coordonnées. |
| **Plan** | Surface d'un lieu entier par formes : nef, chœur, **abside** (demi-cercle), transepts (× 2), scène, piliers retirés… **Volume** (m³, avec une hauteur propre à chaque forme si besoin : nef haute, bas-côtés plus bas) et **capacité estimée** : debout, cocktail, bancs, théâtre, banquet, conférence. | Calcul exact à partir des cotes ; ajoute en un geste la dernière surface mesurée par les autres outils. |
| **Outils › Niveau** | Bulle 2D, chant, pente en % et mm/m, zéro relatif, figer, son. | Moyenne glissante, 2 décimales quand le téléphone est stable, calibrage par retournement à 180°. |
| **Outils › Règle** | Règle cm / pouces à l'échelle réelle, deux curseurs. | Modèle d'iPhone détecté, calibrage avec une carte bancaire au 0,1 pt près, curseurs démultipliés. |
| **Mesures** | Historique avec photo annotée, marge d'erreur, note et date ; copier ou partager. | |

Les estimations de capacité sont indicatives : la capacité autorisée d'un établissement recevant du public est fixée par la réglementation (issues de secours, commission de sécurité).

## Installer sur l'iPhone

L'app doit être servie en **HTTPS** (requis pour la caméra, les capteurs et le GPS).

1. Héberger le dossier `app-mesure/` (Vercel, Netlify, GitHub Pages… aucun build nécessaire).
2. Ouvrir l'adresse dans **Safari** › Partager › **Sur l'écran d'accueil**.
3. Au premier usage de la Visée ou du Niveau, autoriser « Mouvement et orientation » ; pour le Terrain, autoriser la localisation.

## Conseils de précision

- **Photo** : la référence doit être dans le même plan que l'objet (posée sur le mur, le sol, la scène). Plus elle est grande et proche de l'objet, plus la marge est faible : un praticable de 2 × 1 m pour mesurer une scène, une feuille A4 pour une porte. Photographiez de face, au zoom ×2 en reculant.
- **Visée** : réglez la hauteur de l'objectif (mesurez-la une fois), restez au même endroit pendant toute la mesure, sol plat. Pour les très grandes salles, rapprochez-vous ou tenez le téléphone plus haut.
- **Terrain** : zoomez au maximum avant de poser les coins ; en GPS, restez immobile à chaque coin et à découvert.
- **Niveau** : calibrez une fois sur une surface stable.

## Fichiers

`index.html`, `styles.css`, `app.js` (aucune dépendance), `manifest.webmanifest`, `sw.js` (hors ligne + cache de ~3 000 tuiles de carte), `icons/`. Fonds de carte : imagerie Esri World Imagery et OpenStreetMap.
