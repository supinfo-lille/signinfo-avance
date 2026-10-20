// ÉTAPE 4 — Classification par k plus proches voisins (KNN), sans bibliothèque

export const K = 5;
export const DISTANCE_MAX = 1.5; // seuil de rejet : au-delà, aucune lettre connue

// Distance euclidienne entre deux vecteurs de même longueur
export function distance(a, b) {
  // TODO
  return 0;
}

// exemples : { "A": [[...63 nombres], ...], ... }
// Renvoie { lettre, confiance } (confiance = part des k voisins qui ont voté pour la lettre),
// ou null s'il y a moins de k exemples ou si le plus proche voisin est au-delà de DISTANCE_MAX.
export function predire(exemples, vecteur, k = K) {
  // TODO
  return null;
}
