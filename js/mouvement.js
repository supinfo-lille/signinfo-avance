// BONUS MOUVEMENT — Reconnaître J et Z, les lettres qui se tracent dans l'air
// À implémenter : M1, M2, M3. Le reste est fourni.
//
// Idée : au lieu d'une image, on enregistre une TRAJECTOIRE (le chemin du bout
// des doigts pendant le geste), on la transforme en une liste de nombres de
// taille fixe, puis on réutilise exactement le même KNN que pour les lettres fixes.

export const NB_POINTS = 16;           // points par trajectoire après rééchantillonnage
export const DISTANCE_MAX_GESTE = 3;   // au-delà, le tracé ne ressemble à rien de connu
const VITESSE_DEBUT = 1.5;             // en tailles de main par seconde
const VITESSE_FIN = 0.8;
const DUREE_CALME = 0.25;              // secondes immobile pour terminer le geste
const FENETRE = 0.25;                  // secondes sur lesquelles on mesure la vitesse
const DUREE_MIN = 0.3, DUREE_MAX = 3;  // secondes
const LONGUEUR_MIN = 0.8;              // en tailles de main

const DUREE_ARMEMENT = 0.3;           // secondes immobile avant de pouvoir tracer
const PAUSE_APRES_GESTE = 0.8;         // secondes ignorées après un geste (retour en position)
const MARGE = 0.02;                    // bord de l'image à ne pas toucher (2 %)

const BOUT_INDEX = 8, BOUT_AURICULAIRE = 20;

// --- Fournis ---
export function tailleMain(points, ratio) {
  const a = points[0], b = points[9];
  return Math.hypot((b.x - a.x) * ratio, b.y - a.y) || 1e-3;
}

export function longueurTrace(trace) {
  let l = 0;
  for (let i = 1; i < trace.length; i++) l += Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y);
  return l;
}

// --- Étape M1 : rééchantillonner un tracé [{x, y}, ...] en n points également espacés le long du chemin ---
export function reechantillonner(trace, n = NB_POINTS) {
  // TODO
  return [];
}

// --- Étape M2 : geste brut → vecteur de 64 nombres ---
// geste = { index: [{x, y}], auriculaire: [{x, y}], taille, ratio, miroir } (positions brutes, 0 à 1).
// Le vecteur doit être indépendant de l'endroit où le geste est fait, de la taille de la main,
// de la vitesse du geste et de la main utilisée.
export function vecteurDuGeste(geste) {
  // TODO
  return [];
}

// --- Fourni : la main est-elle entièrement visible ? ---
// Quand la main sort en partie du cadre, MediaPipe « devine » les points manquants :
// ces positions inventées faussent le tracé, on préfère annuler le geste.
export function mainVisible(points) {
  return points.every((p) => p.x > MARGE && p.x < 1 - MARGE && p.y > MARGE && p.y < 1 - MARGE);
}

// --- Étape M3 : découper le flux vidéo en gestes ---
// Contraintes : ignorer le tremblement de MediaPipe ; ne pas prendre l'entrée de la main dans
// l'image ni le retour en position de départ pour un geste ; annuler un geste si la main sort,
// même partiellement, de l'image (incrémenter this.annulations). La propriété etat
// ("attente", "pret", "trace") et this.enCours ({ index, auriculaire }) sont lus par main.js
// pour l'affichage. Les constantes en haut du fichier sont des valeurs de départ raisonnables.
export class DetecteurGeste {
  constructor() {
    this.annulations = 0; // nombre de gestes annulés (main sortie de l'image)
    this.reinitialiser();
  }

  reinitialiser() {
    this.enCours = null;    // le geste en train d'être tracé
    this.historique = [];   // les positions des 0,25 dernières secondes
    this.calme = 0;         // depuis combien de temps la main est immobile
    this.pret = false;      // la main a-t-elle été immobile assez longtemps ?
    this.pauseJusqua = 0;   // après un geste, on ignore le retour à la position de départ
  }

  get etat() {
    if (this.enCours) return "trace";
    return this.pret ? "pret" : "attente";
  }

  // Appelée à chaque image (t en secondes) ; renvoie { vecteur, duree, longueur } quand un geste se termine
  mettreAJour(points, cote, ratio, t) {
    // TODO
    return null;
  }

  terminer() {
    const g = this.enCours;
    this.enCours = null;
    this.calme = 0;
    const duree = g.fin - g.debut;
    const longueur = Math.max(longueurTrace(g.index), longueurTrace(g.auriculaire)) * g.ratio / g.taille;
    if (duree < DUREE_MIN || longueur < LONGUEUR_MIN) return null; // trop court : un simple tremblement
    return { vecteur: vecteurDuGeste(g), duree, longueur };
  }
}

// --- Fourni : dessin d'une trajectoire enregistrée, pour l'alphabet de référence ---
export function svgTrajectoire(vecteur) {
  const moitie = NB_POINTS * 2;
  const tracés = [vecteur.slice(0, moitie), vecteur.slice(moitie)];
  const etendue = (v) => { const xs = v.filter((_, i) => i % 2 === 0), ys = v.filter((_, i) => i % 2 === 1); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); };
  const v = etendue(tracés[0]) >= etendue(tracés[1]) ? tracés[0] : tracés[1];
  const pts = [];
  for (let i = 0; i < v.length; i += 2) pts.push({ x: -v[i], y: v[i + 1] }); // -x : comme dans le miroir de l'écran
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const e = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const P = pts.map((p) => ({ x: 15 + ((p.x - minX) / e) * 70, y: 15 + ((p.y - minY) / e) * 70 }));
  const chemin = P.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Tracé du geste"><path d="${chemin}" fill="none" stroke="#5B3DF5" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${P[0].x}" cy="${P[0].y}" r="7" fill="#0F9F78"/></svg>`;
}
