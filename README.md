# SignINFO — parcours avancé

Application web de reconnaissance de l'alphabet dactylologique de la LSF à la webcam,
en JavaScript (modules ES, sans build) avec MediaPipe Hand Landmarker, puis jeu d'épellation.

Ce dépôt s'adresse aux participants qui ont déjà de bonnes bases en programmation :
les `TODO` indiquent l'emplacement et l'objectif, pas la solution. À vous de lire la
documentation, de concevoir et de tester.

## Lancer le projet

Serveur local obligatoire (modules ES + `getUserMedia`) : Live Server dans VS Code,
`python -m http.server 8000` ou `npx serve .`. Chrome ou Edge récent, accès Internet (CDN).

## Architecture

`js/main.js` (fourni) gère l'interface et appelle vos modules à chaque image analysée. Il tolère
des modules incomplets : tant qu'une fonction renvoie `null`, l'application affiche « Étape N à compléter ».

| Étape | Fichier          | Contrat |
|-------|------------------|---------|
| 1     | `js/camera.js`   | `creerDetecteur()`, `demarrerWebcam(video)`, `lancerBoucle(video, detecteur, surResultat)`, `creerDessinateur(ctx)` |
| 2     | `js/features.js` | `normaliser(points, cote, ratio)` → 63 nombres invariants à la position, à l'échelle et à la main utilisée |
| 3     | `js/dataset.js`  | `ajouter`, `nombre`, `total`, `sauver`, `charger` (persistance entre deux rechargements) |
| 4     | `js/knn.js`      | `distance(a, b)`, `predire(exemples, vecteur, k)` → `{ lettre, confiance }` ou `null` |
| 5     | `js/game.js`     | `normaliserMot(texte)`, `Partie.mettreAJour(prediction, dt)` → `"validee"`, `"gagne"` ou `null` |
| Bonus | `js/bonus.js`    | `evaluer` (leave-one-out), `enregistrerRecord`, `bip` |
| Bonus mouvement | `js/mouvement.js` | reconnaître J et Z par leur trajectoire (rééchantillonnage, vectorisation, segmentation du flux) |

Les signatures, entrées et sorties attendues sont décrites en commentaire au-dessus de chaque fonction.

## Branches

`main` est le point de départ. `etape-1` à `etape-5` et `bonus` contiennent chacune la solution de
l'étape. Pour le bonus mouvement, partez de `bonus-mouvement-depart` ; la solution est sur `bonus-mouvement`.

```bash
git stash
git checkout etape-3
```

## Pistes pour aller plus loin

- Comparer KNN et un petit réseau de neurones (TensorFlow.js) avec la même évaluation leave-one-out.
- Mesurer honnêtement : évaluer sur les données d'une personne absente de l'entraînement.
- Remplacer le rééchantillonnage des gestes par du DTW sur les séquences complètes de 63 nombres.
- Reconnaître de vrais signes LSF en mouvement : quelles données, quel modèle ?

Documentation MediaPipe : https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js
