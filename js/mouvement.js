// BONUS MOUVEMENT — Reconnaître J et Z, les lettres qui se tracent dans l'air
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

// --- Étape M1 : rééchantillonner une trajectoire en n points également espacés ---
// Un geste lent donne 60 positions, un geste rapide 15 : pour les comparer,
// on les ramène toutes au même nombre de points, répartis le long du tracé.
export function reechantillonner(trace, n = NB_POINTS) {
  const cumul = [0];
  for (let i = 1; i < trace.length; i++)
    cumul.push(cumul[i - 1] + Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y));
  const total = cumul.at(-1) || 1;
  const resultat = [];
  for (let k = 0; k < n; k++) {
    const cible = (k / (n - 1)) * total;
    let i = cumul.findIndex((c) => c >= cible);
    if (i <= 0) i = 1;
    const segment = cumul[i] - cumul[i - 1] || 1;
    const t = Math.min(1, (cible - cumul[i - 1]) / segment);
    resultat.push({
      x: trace[i - 1].x + t * (trace[i].x - trace[i - 1].x),
      y: trace[i - 1].y + t * (trace[i].y - trace[i - 1].y),
    });
  }
  return resultat;
}

// --- Étape M2 : transformer les deux tracés (index + auriculaire) en un vecteur ---
// Comme pour les lettres fixes : départ à (0, 0), divisé par la taille de la main,
// main gauche retournée. 2 doigts × 16 points × 2 coordonnées = 64 nombres.
export function vecteurDuGeste(geste) {
  const vecteur = [];
  for (const brut of [geste.index, geste.auriculaire]) {
    const depart = brut[0];
    const trace = brut.map((p) => ({
      x: (geste.miroir * (p.x - depart.x) * geste.ratio) / geste.taille,
      y: (p.y - depart.y) / geste.taille,
    }));
    for (const p of reechantillonner(trace)) vecteur.push(Math.round(p.x * 1e4) / 1e4, Math.round(p.y * 1e4) / 1e4);
  }
  return vecteur;
}

// --- Fourni : la main est-elle entièrement visible ? ---
// Quand la main sort en partie du cadre, MediaPipe « devine » les points manquants :
// ces positions inventées faussent le tracé, on préfère annuler le geste.
export function mainVisible(points) {
  return points.every((p) => p.x > MARGE && p.x < 1 - MARGE && p.y > MARGE && p.y < 1 - MARGE);
}

// --- Étape M3 : découper le flux vidéo en gestes ---
// Trois états :
//   "attente" : la main vient d'apparaître ou de finir un geste, on attend qu'elle s'immobilise ;
//   "pret"    : la main est immobile en position de départ, le prochain mouvement est un geste ;
//   "trace"   : le geste est en cours, il se termine quand la main s'immobilise à nouveau.
// Si la main sort de l'image pendant le tracé, le geste est annulé (pas de tracé tronqué).
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

  // Appelée à chaque image ; renvoie { vecteur, duree, longueur } quand un geste se termine
  mettreAJour(points, cote, ratio, t) {
    // 1. Main absente ou coupée par le bord : on annule tout et on repart de zéro
    if (!points || !mainVisible(points)) {
      if (this.enCours) this.annulations++;
      this.reinitialiser();
      return null;
    }
    const taille = tailleMain(points, ratio);
    const index = points[BOUT_INDEX], auriculaire = points[BOUT_AURICULAIRE];
    const dtImage = this.historique.length ? t - this.historique.at(-1).t : 0;

    // 2. Vitesse mesurée sur une petite fenêtre : le léger tremblement de MediaPipe
    //    s'annule, seul un vrai déplacement compte.
    this.historique.push({ t, index, auriculaire });
    while (this.historique.length > 2 && t - this.historique[0].t > FENETRE) this.historique.shift();
    const ancien = this.historique[0];
    let vitesse = 0;
    if (ancien.t < t) {
      const d = (a, b) => Math.hypot((a.x - b.x) * ratio, a.y - b.y);
      vitesse = Math.max(d(index, ancien.index), d(auriculaire, ancien.auriculaire)) / taille / (t - ancien.t);
    }
    this.calme = vitesse < VITESSE_FIN ? this.calme + dtImage : 0;

    if (!this.enCours) {
      // 3. Attente : la main doit d'abord rester immobile (position de départ)
      if (!this.pret) {
        if (t >= this.pauseJusqua && this.calme >= DUREE_ARMEMENT) this.pret = true;
        return null;
      }
      // 4. Prêt : le premier vrai mouvement démarre le geste
      if (vitesse > VITESSE_DEBUT) {
        this.enCours = {
          debut: ancien.t, fin: t, taille, ratio,
          miroir: cote === "Left" ? -1 : 1,
          index: this.historique.map((h) => h.index),
          auriculaire: this.historique.map((h) => h.auriculaire),
        };
        this.calme = 0;
      }
      return null;
    }

    // 5. Tracé en cours : on enregistre, et on termine quand la main s'immobilise
    this.enCours.index.push(index);
    this.enCours.auriculaire.push(auriculaire);
    this.enCours.fin = t;
    if (this.calme >= DUREE_CALME || t - this.enCours.debut > DUREE_MAX) {
      this.pret = false;
      this.pauseJusqua = t + PAUSE_APRES_GESTE;
      return this.terminer();
    }
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
