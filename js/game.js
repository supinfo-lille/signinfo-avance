// ÉTAPE 5 — La logique du jeu : valider le mot lettre par lettre

export const DUREE_MAINTIEN = 0.8; // secondes à tenir le bon signe
export const CONFIANCE_MIN = 0.6;  // au moins 3 voisins sur 5 d'accord

// "Élève !" → "ELEVE" : majuscules, sans accents, uniquement A à Z
export function normaliserMot(texte) {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

export class Partie {
  constructor(mot) {
    this.mot = normaliserMot(mot);
    this.index = 0;      // position de la lettre à faire
    this.maintien = 0;   // temps passé à tenir le bon signe
    this.debut = performance.now();
    this.fin = null;
  }

  get lettreCourante() { return this.mot[this.index]; }
  get finie() { return this.index >= this.mot.length; }
  get progression() { return Math.min(1, this.maintien / DUREE_MAINTIEN); }
  get duree() { return ((this.fin ?? performance.now()) - this.debut) / 1000; }

  // Appelée à chaque image : renvoie "validee", "gagne" ou null
  mettreAJour(prediction, dt) {
    if (this.finie) return null;
    const bonSigne = prediction && prediction.lettre === this.lettreCourante && prediction.confiance >= CONFIANCE_MIN;
    // On remplit la jauge avec le bon signe, on la vide deux fois plus vite sinon
    this.maintien = bonSigne ? this.maintien + dt : Math.max(0, this.maintien - 2 * dt);
    if (this.maintien >= DUREE_MAINTIEN) return this.lettreSuivante();
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
