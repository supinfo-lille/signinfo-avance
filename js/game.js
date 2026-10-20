// ÉTAPE 5 — Logique du jeu

export const DUREE_MAINTIEN = 0.8; // secondes à tenir le bon signe
export const CONFIANCE_MIN = 0.6;

// "Élève !" → "ELEVE" : majuscules, sans accents, uniquement A à Z
export function normaliserMot(texte) {
  // TODO
  return texte.toUpperCase();
}

export class Partie {
  constructor(mot) {
    this.mot = normaliserMot(mot);
    this.index = 0;
    this.maintien = 0;
    this.debut = performance.now();
    this.fin = null;
  }

  get lettreCourante() { return this.mot[this.index]; }
  get finie() { return this.index >= this.mot.length; }
  get progression() { return Math.min(1, this.maintien / DUREE_MAINTIEN); }
  get duree() { return ((this.fin ?? performance.now()) - this.debut) / 1000; }

  // Appelée à chaque image (dt en secondes). Une lettre est validée quand le bon signe,
  // avec une confiance suffisante, est tenu DUREE_MAINTIEN secondes ; une prédiction
  // fugace ne doit pas suffire. Renvoie "validee", "gagne" ou null.
  mettreAJour(prediction, dt) {
    // TODO
    return null;
  }

  lettreSuivante() {
    this.index++;
    this.maintien = 0;
    if (this.finie) {
      this.fin = performance.now();
      return "gagne";
    }
    return "validee";
  }
}
