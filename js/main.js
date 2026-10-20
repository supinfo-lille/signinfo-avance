// main.js — le « chef d'orchestre ». Ce fichier est fourni : il relie l'interface
// aux modules que vous complétez étape par étape (camera, features, dataset, knn, game, bonus).
import { creerDetecteur, demarrerWebcam, lancerBoucle, creerDessinateur } from "./camera.js";
import { normaliser } from "./features.js";
import { Dataset } from "./dataset.js";
import { predire } from "./knn.js";
import { Partie, normaliserMot } from "./game.js";
import { evaluer, enregistrerRecord, bip } from "./bonus.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LETTRES_DYNAMIQUES = ["J", "Z"]; // signes avec mouvement : non reconnus par notre IA « image par image »
const EXEMPLES_PAR_SESSION = 40;
const MOTS = ["LILLE", "CODE", "MAIN", "SIGNE", "ROBOT", "PIXEL", "CHAT", "VAUBAN", "BONJOUR", "MERCI", "SALUT", "IA"];

const $ = (id) => document.getElementById(id);
const video = $("webcam");
const calque = $("calque");
const ctx = calque.getContext("2d");
const dataset = new Dataset();

let dessiner = null;
let pointsCourants = null;   // les 21 points bruts de MediaPipe
let vecteurCourant = null;   // les 63 nombres normalisés
let lettreChoisie = "A";
let enregistrement = null;   // { lettre, restant, image, depart }
let partie = null;
let instantPrecedent = performance.now();
let ongletActif = "entrainer";

/* ---------- Onglets ---------- */
document.querySelectorAll(".onglet").forEach((btn) =>
  btn.addEventListener("click", () => {
    ongletActif = btn.dataset.onglet;
    document.querySelectorAll(".onglet").forEach((b) => b.classList.toggle("actif", b === btn));
    for (const nom of ["entrainer", "jouer", "evaluer"]) $(`panneau-${nom}`).classList.toggle("cache", nom !== ongletActif);
    if (ongletActif === "jouer") afficherAlphabetReference();
  })
);

/* ---------- Caméra (étape 1) ---------- */
function etat(texte, erreur = false) {
  $("etat-camera").textContent = texte;
  $("etat-camera").classList.toggle("erreur", erreur);
}

$("btn-camera").addEventListener("click", async () => {
  $("btn-camera").disabled = true;
  try {
    etat("Chargement du modèle MediaPipe…");
    const detecteur = await creerDetecteur();
    etat("Autorisez l'accès à la caméra…");
    await demarrerWebcam(video);
    calque.width = video.videoWidth;
    calque.height = video.videoHeight;
    dessiner = creerDessinateur(ctx);
    lancerBoucle(video, detecteur, surResultat);
    etat("Caméra active : montrez votre main");
    $("btn-camera").hidden = true;
  } catch (e) {
    console.error(e);
    etat(e.message || "La caméra n'a pas pu démarrer", true);
    $("btn-camera").disabled = false;
  }
});

// Appelée par la boucle à chaque image analysée
function surResultat(resultat) {
  const maintenant = performance.now();
  const dt = (maintenant - instantPrecedent) / 1000;
  instantPrecedent = maintenant;

  dessiner?.(resultat);

  if (resultat.landmarks?.length) {
    pointsCourants = resultat.landmarks[0];
    const cote = resultat.handednesses?.[0]?.[0]?.categoryName ?? "Right";
    vecteurCourant = normaliser(pointsCourants, cote, video.videoWidth / video.videoHeight); // étape 2
  } else {
    pointsCourants = null;
    vecteurCourant = null;
  }

  if (enregistrement) gererEnregistrement();

  const prediction = vecteurCourant ? predire(dataset.exemples, vecteurCourant) : null; // étape 4
  afficherPrediction(prediction);

  if (partie && ongletActif === "jouer") gererPartie(prediction, dt);
}

function afficherPrediction(p) {
  $("prediction-lettre").textContent = p ? p.lettre : pointsCourants ? "?" : "–";
  $("prediction-jauge").style.width = `${(p?.confiance ?? 0) * 100}%`;
}

/* ---------- Entraînement (étape 3) ---------- */
function afficherAlphabetEntrainement() {
  const grille = $("alphabet-entrainer");
  grille.innerHTML = "";
  for (const lettre of ALPHABET) {
    const n = dataset.nombre(lettre);
    const b = document.createElement("button");
    b.className = "touche";
    b.classList.toggle("choisie", lettre === lettreChoisie);
    b.classList.toggle("prete", n >= EXEMPLES_PAR_SESSION);
    b.classList.toggle("dynamique", LETTRES_DYNAMIQUES.includes(lettre));
    b.innerHTML = `${lettre}<small>${n}</small>`;
    b.title = LETTRES_DYNAMIQUES.includes(lettre) ? "Lettre avec mouvement : voir les bonus" : `${n} exemples`;
    b.addEventListener("click", () => {
      lettreChoisie = lettre;
      $("btn-enregistrer").textContent = `Enregistrer ${EXEMPLES_PAR_SESSION} exemples de « ${lettre} »`;
      afficherAlphabetEntrainement();
    });
    grille.appendChild(b);
  }
  const lettres = ALPHABET.filter((l) => dataset.nombre(l) > 0).length;
  $("resume-dataset").textContent = `${dataset.total()} exemples au total, ${lettres} lettres sur 26.`;
}

$("btn-enregistrer").addEventListener("click", () => {
  if (!dessiner) return statut("Démarrez d'abord la caméra.");
  enregistrement = { lettre: lettreChoisie, restant: EXEMPLES_PAR_SESSION, image: 0, depart: performance.now() + 2000 };
  $("btn-enregistrer").disabled = true;
});

function statut(texte) { $("etat-enregistrement").textContent = texte; }

function gererEnregistrement() {
  const e = enregistrement;
  const attente = (e.depart - performance.now()) / 1000;
  if (attente > 0) return statut(`Préparez le signe « ${e.lettre} »… ${Math.ceil(attente)}`);
  if (!pointsCourants) return statut("Je ne vois pas votre main.");
  if (!vecteurCourant) return statut("Complétez l'étape 2 (features.js) pour pouvoir enregistrer.");
  if (++e.image % 3 !== 0) return; // un exemple toutes les 3 images, pour varier un peu

  if (e.restant === EXEMPLES_PAR_SESSION) dataset.vignettes[e.lettre] = capturerVignette();
  dataset.ajouter(e.lettre, vecteurCourant);
  e.restant--;
  statut(`Enregistrement de « ${e.lettre} » : ${EXEMPLES_PAR_SESSION - e.restant} / ${EXEMPLES_PAR_SESSION}`);

  if (e.restant === 0) {
    dataset.sauver();
    enregistrement = null;
    $("btn-enregistrer").disabled = false;
    statut(dataset.nombre(e.lettre) ? `« ${e.lettre} » enregistrée !` : "Rien n'a été mémorisé : complétez l'étape 3 (dataset.js).");
    afficherAlphabetEntrainement();
  }
}

// Petite photo de la main, recadrée, qui servira d'alphabet de référence
function capturerVignette() {
  const xs = pointsCourants.map((p) => p.x * video.videoWidth);
  const ys = pointsCourants.map((p) => p.y * video.videoHeight);
  const cote = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.4;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const c = document.createElement("canvas");
  c.width = c.height = 120;
  const g = c.getContext("2d");
  g.translate(120, 0);
  g.scale(-1, 1); // même effet miroir que l'écran
  g.drawImage(video, cx - cote / 2, cy - cote / 2, cote, cote, 0, 0, 120, 120);
  return c.toDataURL("image/jpeg", 0.7);
}

$("btn-effacer-lettre").addEventListener("click", () => {
  if (confirm(`Effacer tous les exemples de « ${lettreChoisie} » ?`)) {
    dataset.effacerLettre(lettreChoisie);
    afficherAlphabetEntrainement();
  }
});
$("btn-tout-effacer").addEventListener("click", () => {
  if (confirm("Effacer toutes les données enregistrées ?")) {
    dataset.toutEffacer();
    afficherAlphabetEntrainement();
  }
});
$("btn-exporter").addEventListener("click", () => dataset.exporter());
$("fichier-import").addEventListener("change", async (ev) => {
  const fichier = ev.target.files[0];
  if (!fichier) return;
  try {
    await dataset.importer(fichier);
    statut("Données importées.");
  } catch {
    statut("Ce fichier n'est pas un export SignINFO valide.");
  }
  ev.target.value = "";
  afficherAlphabetEntrainement();
});

/* ---------- Jeu (étape 5) ---------- */
function afficherAlphabetReference() {
  const grille = $("alphabet-reference");
  grille.innerHTML = "";
  for (const lettre of ALPHABET) {
    const d = document.createElement("div");
    d.className = "touche";
    const img = dataset.vignettes[lettre];
    d.innerHTML = img ? `<img src="${img}" alt="Signe ${lettre}">${lettre}` : `${lettre}<small>à enregistrer</small>`;
    grille.appendChild(d);
  }
}

function lancerPartie(texte) {
  const mot = normaliserMot(texte);
  if (!mot) return ($("alerte-mot").textContent = "Saisissez un mot (lettres A à Z).");
  const manquantes = [...new Set(mot)].filter((l) => !dataset.nombre(l));
  $("alerte-mot").textContent = manquantes.length
    ? `L'IA ne connaît pas encore : ${manquantes.join(", ")}. Entraînez-la ou utilisez « Passer ».`
    : "";
  partie = new Partie(mot);
  $("btn-passer").disabled = false;
  $("record").textContent = "";
  afficherPartie();
}

$("btn-lancer").addEventListener("click", () => lancerPartie($("saisie-mot").value));
$("saisie-mot").addEventListener("keydown", (e) => e.key === "Enter" && lancerPartie(e.target.value));
$("btn-hasard").addEventListener("click", () => {
  const mot = MOTS[Math.floor(Math.random() * MOTS.length)];
  $("saisie-mot").value = mot;
  lancerPartie(mot);
});
$("btn-passer").addEventListener("click", () => {
  if (!partie || partie.finie) return;
  partie.lettreSuivante();
  partie.passees = (partie.passees ?? 0) + 1;
  afficherPartie();
});

function gererPartie(prediction, dt) {
  const evenement = partie.mettreAJour(prediction, dt);
  if (evenement === "validee") bip(880);
  if (evenement === "gagne") {
    bip(660, 0.1);
    setTimeout(() => bip(990, 0.25), 120);
    const temps = partie.duree;
    if (!partie.passees) {
      const ancien = enregistrerRecord(partie.mot, temps);
      $("record").textContent = ancien === null || temps < ancien
        ? "Nouveau record pour ce mot !"
        : `Record à battre : ${ancien.toFixed(1).replace(".", ",")} s`;
    }
  }
  afficherPartie();
}

function afficherPartie() {
  if (!partie) return;
  $("mot").innerHTML = [...partie.mot]
    .map((l, i) => `<span class="${i < partie.index ? "faite" : i === partie.index ? "en-cours" : ""}">${l}</span>`)
    .join("");
  $("anneau").style.setProperty("--p", partie.progression);
  $("anneau").classList.toggle("reussi", partie.finie);
  $("chrono").textContent = `${partie.duree.toFixed(1).replace(".", ",")} s`;

  if (partie.finie) {
    $("lettre-cible").textContent = "✓";
    $("consigne").textContent = `Bravo, « ${partie.mot} » est signé !`;
    $("vignette-cible").hidden = true;
    $("btn-passer").disabled = true;
    return;
  }
  const lettre = partie.lettreCourante;
  $("lettre-cible").textContent = lettre;
  const img = dataset.vignettes[lettre];
  $("vignette-cible").hidden = !img;
  if (img) $("vignette-cible").src = img;
  $("consigne").textContent = LETTRES_DYNAMIQUES.includes(lettre)
    ? `« ${lettre} » se signe avec un mouvement : faites-le, puis cliquez sur « Passer ».`
    : `Faites le signe « ${lettre} » et tenez-le jusqu'à ce que l'anneau soit plein.`;
}

/* ---------- Bonus : évaluation ---------- */
$("btn-evaluer").addEventListener("click", () => {
  const zone = $("resultat-evaluation");
  if (dataset.total() < 10) return (zone.textContent = "Enregistrez d'abord quelques lettres.");
  const r = evaluer(dataset.exemples);
  if (!r) return (zone.textContent = "Bonus à compléter : evaluer() dans bonus.js.");
  const lignes = Object.entries(r.parLettre)
    .sort((a, b) => a[1].bons / a[1].total - b[1].bons / b[1].total)
    .map(([l, s]) => `<tr><td>${l}</td><td>${Math.round((100 * s.bons) / s.total)} %</td><td>${s.total}</td></tr>`)
    .join("");
  const pires = Object.entries(r.confusions).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([c, n]) => `${c} (${n} fois)`).join(", ");
  zone.innerHTML = `
    <p class="eval-score">${Math.round(r.taux * 100)} %</p>
    <p>d'exemples bien reconnus sur ${r.total}.</p>
    <p><strong>Confusions les plus fréquentes :</strong> ${pires || "aucune"}</p>
    <table class="eval-table"><thead><tr><th>Lettre</th><th>Réussite</th><th>Exemples</th></tr></thead><tbody>${lignes}</tbody></table>`;
});

afficherAlphabetEntrainement();
