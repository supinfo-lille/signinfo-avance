// ÉTAPE 4 — Reconnaître une lettre avec les k plus proches voisins (KNN)
//
// Idée : on compare le signe actuel à TOUS les exemples enregistrés,
// on garde les k plus ressemblants, et chacun « vote » pour sa lettre.

export const K = 5;
export const DISTANCE_MAX = 1.5; // au-delà, le signe ne ressemble à rien de connu

// Distance euclidienne entre deux vecteurs de 63 nombres
export function distance(a, b) {
  let somme = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    somme += d * d;
  }
  return Math.sqrt(somme);
}

// exemples : { "A": [[...], ...], "B": [...] }
// distanceMax : seuil de rejet (les gestes du bonus mouvement en utilisent un autre)
export function predire(exemples, vecteur, k = K, distanceMax = DISTANCE_MAX) {
  const voisins = [];
  for (const [lettre, liste] of Object.entries(exemples)) {
    for (const ex of liste) voisins.push({ lettre, d: distance(vecteur, ex) });
  }
  if (voisins.length < k) return null;

  voisins.sort((a, b) => a.d - b.d);
  const proches = voisins.slice(0, k);
  if (proches[0].d > distanceMax) return null;

  const votes = {};
  for (const v of proches) votes[v.lettre] = (votes[v.lettre] ?? 0) + 1;
  const [lettre, nbVotes] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return { lettre, confiance: nbVotes / k };
}
