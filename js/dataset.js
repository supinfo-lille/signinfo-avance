// ÉTAPE 3 — Mémoriser les exemples enregistrés pour chaque lettre
const CLE_STOCKAGE = "signinfo-donnees-v1";

export class Dataset {
  constructor() {
    this.exemples = {};  // { "A": [[63 nombres], [63 nombres], ...], "B": [...] }
    this.vignettes = {}; // { "A": "data:image/jpeg;base64,..." } photo de référence
    this.charger();
  }

  // Ajoute un exemple ; on arrondit à 4 décimales pour alléger le stockage
  ajouter(lettre, vecteur) {
    if (!this.exemples[lettre]) this.exemples[lettre] = [];
    this.exemples[lettre].push(vecteur.map((n) => Math.round(n * 10000) / 10000));
  }

  nombre(lettre) {
    return this.exemples[lettre]?.length ?? 0;
  }

  total() {
    return Object.values(this.exemples).reduce((somme, liste) => somme + liste.length, 0);
  }

  effacerLettre(lettre) {
    delete this.exemples[lettre];
    delete this.vignettes[lettre];
    this.sauver();
  }

  toutEffacer() {
    this.exemples = {};
    this.vignettes = {};
    this.sauver();
  }

  // localStorage : les données restent dans le navigateur même après rechargement
  sauver() {
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ exemples: this.exemples, vignettes: this.vignettes }));
    } catch (e) {
      console.warn("Sauvegarde impossible (stockage plein ?)", e);
    }
  }

  charger() {
    try {
      const texte = localStorage.getItem(CLE_STOCKAGE);
      if (!texte) return;
      const donnees = JSON.parse(texte);
      this.exemples = donnees.exemples ?? {};
      this.vignettes = donnees.vignettes ?? {};
    } catch (e) {
      console.warn("Lecture des données impossible", e);
    }
  }

  // --- Fourni : export / import pour partager un jeu de données entre postes ---
  exporter() {
    const blob = new Blob([JSON.stringify({ exemples: this.exemples, vignettes: this.vignettes })], { type: "application/json" });
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(blob);
    lien.download = "signinfo-donnees.json";
    lien.click();
    URL.revokeObjectURL(lien.href);
  }

  async importer(fichier) {
    const donnees = JSON.parse(await fichier.text());
    for (const [lettre, liste] of Object.entries(donnees.exemples ?? {})) {
      this.exemples[lettre] = [...(this.exemples[lettre] ?? []), ...liste];
    }
    Object.assign(this.vignettes, donnees.vignettes ?? {});
    this.sauver();
  }
}
