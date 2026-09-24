# Formation Écrans LED

Formation interactive sur l'installation de tous les types d'écrans LED et leur programmation (NovaStar, Colorlight, Huidu), sur 5 jours (35 h).

## Fichiers

| Fichier | Contenu |
| --- | --- |
| `formation-ecrans-led.html` | L'application de formation : accueil par jour, 15 modules découpés en étapes, 16 ateliers interactifs (simulateurs NovaLCT, LEDVISION et HDPlayer, jeu de câblage, recherche de défauts, arbre de dépannage, chiffrage…), quiz de validation par module, évaluation finale, projet de certification, glossaire, suivi des stagiaires et attestation. |
| `source/contenu.html` | Texte des cours de chaque module. |
| `source/extras.py` | Étapes complémentaires et module 14 (chiffrage, contrats, logistique). |
| `source/widgets.py` | Structure HTML des ateliers. |
| `source/app2.js` | Logique : navigation, quiz et banques de questions, ateliers, simulateurs, suivi, attestation, espace formateur. |
| `source/app.css` | Présentation. |
| `source/build.py` | Reconstruit `formation-ecrans-led.html` à partir des fichiers ci-dessus. |

## Utilisation

Ouvrez `formation-ecrans-led.html` dans un navigateur, sur ordinateur ou sur téléphone. Aucune installation n'est nécessaire ; une connexion Internet sert seulement à charger les polices.

Hors de claude.ai, la progression est gardée dans le navigateur utilisé. Le suivi des stagiaires par le formateur, l'espace formateur et le téléchargement de l'attestation ne fonctionnent que dans la version en ligne.

## Modifier la formation

1. Modifiez le contenu dans `source/contenu.html` ou `source/extras.py`, la logique dans `source/app2.js`, ou la présentation dans `source/app.css`.
2. Lancez `python3 source/build.py`.
3. Ouvrez `formation-ecrans-led.html` pour vérifier le résultat.

## Version en ligne

- Formation : https://claude.ai/artifact/BqXmqQSoraScvtrsRb2UYw

Ce lien est privé : pour le partager, utilisez le menu Partager de la page. Partagez-le en « Peut interagir » pour que la progression des stagiaires remonte dans l'espace formateur.
