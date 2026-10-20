// ÉTAPE 2 — Transformer les 21 points en un vecteur comparable
//
// MediaPipe donne la position de chaque point dans l'image (entre 0 et 1).
// Deux mêmes signes faits à des endroits ou à des distances différentes
// donneraient des nombres très différents : on « normalise ».

const POIGNET = 0;
const BASE_MAJEUR = 9;

export function normaliser(points, cote = "Right", ratio = 1) {
  const origine = points[POIGNET];
  // 1. On mesure la taille de la main : distance poignet → base du majeur
  const ref = points[BASE_MAJEUR];
  const taille = Math.hypot((ref.x - origine.x) * ratio, ref.y - origine.y, (ref.z - origine.z) * ratio) || 1;
  // 2. Main gauche : on retourne horizontalement pour qu'elle ressemble à une main droite
  const miroir = cote === "Left" ? -1 : 1;
  const vecteur = [];
  for (const p of points) {
    // 3. Chaque point devient relatif au poignet, puis divisé par la taille de la main
    vecteur.push(
      (miroir * (p.x - origine.x) * ratio) / taille,
      (p.y - origine.y) / taille,
      ((p.z - origine.z) * ratio) / taille
    );
  }
  return vecteur; // 21 points × 3 coordonnées = 63 nombres
}
