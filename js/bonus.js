// BONUS — Évaluation, records, son
import { predire } from "./knn.js";

// Validation leave-one-out : chaque exemple est prédit à partir de tous les autres.
// Renvoie { taux, total, parLettre: { A: { bons, total } }, confusions: { "M → N": 3 } }
export function evaluer(exemples) {
  // TODO
  return null;
}

// Garde le meilleur temps par mot (persistant) ; renvoie l'ancien record ou null
export function enregistrerRecord(mot, secondes) {
  // TODO
  return null;
}

// Joue un bip (Web Audio API)
export function bip(frequence = 880, duree = 0.12) {
  // TODO
}
