# Formation Réseau pour l'audio-vidéo

Formation complète sur le réseau appliqué à l'audio-vidéo (Dante, AES67, NDI, SMPTE ST 2110, SRT), accompagnée d'un simulateur de switch en syntaxe Cisco.

## Fichiers

| Fichier | Contenu |
| --- | --- |
| `formation-reseau-av.html` | L'application de formation : tableau de bord et mode suivi (objectifs du jour, série, frise), programme sur 5 jours, 12 modules en volets (cours, antisèche, pièges, pratique), 2 études de conception, 32 flashcards, 36 questions de quiz, examen blanc, 7 scénarios de panne, ressources. |
| `regie-ip-lab.html` | Régie IP Lab : simulateur de deux switchs en syntaxe Cisco IOS, avec 7 missions guidées et l'état du son, de la vidéo et de la lumière calculé en direct. |
| `source/app-template.html` | Structure, style et logique de l'application de formation. |
| `source/data.js` | Contenu pédagogique : domaines, antisèches, pièges, pratique, questions, flashcards, pannes, schémas. |
| `source/secs.json` | Texte des cours de chaque module. |
| `source/build.py` | Reconstruit `formation-reseau-av.html` à partir des trois fichiers ci-dessus. |

## Utilisation

Ouvrez simplement les fichiers `.html` dans un navigateur, sur ordinateur ou sur téléphone. Aucune installation n'est nécessaire ; une connexion Internet sert seulement à charger les polices.

Hors de claude.ai, la progression est gardée dans le navigateur utilisé. La synchronisation entre appareils ne fonctionne que dans la version en ligne sur claude.ai.

## Modifier la formation

1. Modifiez le contenu dans `source/data.js` ou `source/secs.json`, ou la présentation dans `source/app-template.html`.
2. Depuis ce dossier, lancez `python3 source/build.py` (Node.js est nécessaire).
3. Ouvrez `formation-reseau-av.html` pour vérifier le résultat.

## Versions en ligne

- Formation : https://claude.ai/artifact/57WMgYHw3AVoSQo6rR41KM
- Simulateur : https://claude.ai/artifact/YFkf6jVmNth2steH57bQQE

Ces liens sont privés : pour les partager, utilisez le menu Partager de chaque page.
