// BONUS — Évaluer le modèle, mémoriser les records, jouer un son
import { predire } from "./knn.js";

// Validation « leave-one-out » : chaque exemple est caché puis prédit à partir des autres
export function evaluer(exemples) {
  const parLettre = {};
  const confusions = {};
  let bons = 0, total = 0;
  for (const [lettre, liste] of Object.entries(exemples)) {
    parLettre[lettre] = { bons: 0, total: 0 };
    liste.forEach((ex, i) => {
      const autres = { ...exemples, [lettre]: liste.filter((_, j) => j !== i) };
      const p = predire(autres, ex);
      const trouve = p?.lettre ?? "?";
      parLettre[lettre].total++;
      total++;
      if (trouve === lettre) { parLettre[lettre].bons++; bons++; }
      else {
        const cle = `${lettre} → ${trouve}`;
        confusions[cle] = (confusions[cle] ?? 0) + 1;
      }
    });
  }
  return { taux: total ? bons / total : 0, total, parLettre, confusions };
}

const CLE_RECORDS = "signinfo-records-v1";

// Enregistre le temps si c'est un record ; renvoie l'ancien record (ou null)
export function enregistrerRecord(mot, secondes) {
  let records = {};
  try { records = JSON.parse(localStorage.getItem(CLE_RECORDS)) ?? {}; } catch {}
  const ancien = records[mot] ?? null;
  if (ancien === null || secondes < ancien) {
    records[mot] = secondes;
    try { localStorage.setItem(CLE_RECORDS, JSON.stringify(records)); } catch {}
  }
  return ancien;
}

let audio = null;
export function bip(frequence = 880, duree = 0.12) {
  audio ??= new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = frequence;
  gain.gain.setValueAtTime(0.15, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duree);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duree);
}
