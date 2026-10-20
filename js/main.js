// main.js — le « chef d'orchestre ». Ce fichier est fourni : il relie l'interface
// aux modules que vous complétez étape par étape (camera, features, dataset, knn, game, bonus).
import { creerDetecteur, demarrerWebcam, lancerBoucle, creerDessinateur } from "./camera.js";
import { normaliser } from "./features.js";
import { Dataset } from "./dataset.js";
import { predire } from "./knn.js";
import { Partie, normaliserMot } from "./game.js";
import { evaluer, enregistrerRecord, bip } from "./bonus.js";
import { DetecteurGeste, DISTANCE_MAX_GESTE, svgTrajectoire } from "./mouvement.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LETTRES_DYNAMIQUES = ["J", "Z"]; // signes avec mouvement : reconnus par leur tracé (bonus mouvement)
const GESTES_PAR_SESSION = 10;
const EXEMPLES_PAR_SESSION = 40;
const MOTS = ["LILLE", "CODE", "MAIN", "SIGNE", "ROBOT", "PIXEL", "CHAT", "VAUBAN", "BONJOUR", "MERCI", "SALUT", "IA"];

const $ = (id) => document.getElementById(id);
const video = $("webcam");
const calque = $("calque");
const ctx = calque.getContext("2d");
const dataset = new Dataset();
const detecteurGeste = new DetecteurGeste();
const estDynamique = (lettre) => LETTRES_DYNAMIQUES.includes(lettre);
// Une lettre est « connue » si l'IA a des exemples : images pour les lettres fixes, gestes pour J et Z
const connue = (lettre) => (estDynamique(lettre) ? dataset.nombreGestes(lettre) : dataset.nombre(lettre)) > 0;

let dessiner = null;
let pointsCourants = null;   // les 21 points bruts de MediaPipe
let vecteurCourant = null;   // les 63 nombres normalisés
let coteCourant = "Right";
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
    coteCourant = resultat.handednesses?.[0]?.[0]?.categoryName ?? "Right";
    vecteurCourant = normaliser(pointsCourants, coteCourant, video.videoWidth / video.videoHeight); // étape 2
  } else {
    pointsCourants = null;
    vecteurCourant = null;
  }

  // Bonus mouvement : on suit les gestes seulement quand on en a besoin
  const besoinGeste = enregistrement?.dynamique ||
    (partie && ongletActif === "jouer" && !partie.finie && estDynamique(partie.lettreCourante));
  let geste = null;
  if (besoinGeste) {
    geste = detecteurGeste.mettreAJour(pointsCourants, coteCourant, video.videoWidth / video.videoHeight, maintenant / 1000);
    dessinerTrace();
  } else detecteurGeste.reinitialiser();

  if (enregistrement) gererEnregistrement(geste);

  const prediction = vecteurCourant ? predire(dataset.exemples, vecteurCourant) : null; // étape 4
  afficherPrediction(prediction);

  if (partie && ongletActif === "jouer") gererPartie(prediction, dt, geste);
}

// Signale une annulation (main sortie de l'image) pendant 2 secondes
let annulationsVues = 0, finAlerteSortie = 0;
function mainSortie() {
  if (detecteurGeste.annulations !== annulationsVues) {
    annulationsVues = detecteurGeste.annulations;
    finAlerteSortie = performance.now() + 2000;
    bip(220, 0.2);
  }
  return performance.now() < finAlerteSortie;
}
const MESSAGE_SORTIE = "Geste annulé : la main est sortie de l'image. Reculez un peu pour la garder entière.";

// Dessine le tracé du geste en cours, et un repère sur les bouts de doigts :
// gris = immobilisez-vous, vert = prêt à tracer
function dessinerTrace() {
  if (pointsCourants && !detecteurGeste.enCours) {
    const pret = detecteurGeste.etat === "pret";
    for (const i of [8, 20]) {
      ctx.beginPath();
      ctx.arc(pointsCourants[i].x * calque.width, pointsCourants[i].y * calque.height, 14, 0, 2 * Math.PI);
      ctx.fillStyle = pret ? "rgba(15, 159, 120, 0.85)" : "rgba(150, 150, 160, 0.6)";
      ctx.fill();
    }
  }
  const g = detecteurGeste.enCours;
  if (!g) return;
  for (const [trace, couleur] of [[g.index, "#2EE6B0"], [g.auriculaire, "#F15A4F"]]) {
    ctx.beginPath();
    trace.forEach((p, i) => ctx[i ? "lineTo" : "moveTo"](p.x * calque.width, p.y * calque.height));
    ctx.strokeStyle = couleur;
    ctx.lineWidth = 6;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.stroke();
  }
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
    const dyn = estDynamique(lettre);
    const n = dyn ? dataset.nombreGestes(lettre) : dataset.nombre(lettre);
    const b = document.createElement("button");
    b.className = "touche";
    b.classList.toggle("choisie", lettre === lettreChoisie);
    b.classList.toggle("prete", n >= (dyn ? GESTES_PAR_SESSION : EXEMPLES_PAR_SESSION));
    b.classList.toggle("dynamique", dyn);
    b.innerHTML = `${lettre}<small>${n}</small>`;
    b.title = dyn ? `Lettre avec mouvement : ${n} gestes` : `${n} exemples`;
    b.addEventListener("click", () => {
      lettreChoisie = lettre;
      $("btn-enregistrer").textContent = estDynamique(lettre)
        ? `Enregistrer ${GESTES_PAR_SESSION} gestes de « ${lettre} »`
        : `Enregistrer ${EXEMPLES_PAR_SESSION} exemples de « ${lettre} »`;
      afficherAlphabetEntrainement();
    });
    grille.appendChild(b);
  }
  const lettres = ALPHABET.filter(connue).length;
  const gestes = LETTRES_DYNAMIQUES.reduce((s, l) => s + dataset.nombreGestes(l), 0);
  $("resume-dataset").textContent = `${dataset.total()} exemples et ${gestes} gestes au total, ${lettres} lettres sur 26.`;
}

$("btn-enregistrer").addEventListener("click", () => {
  if (!dessiner) return statut("Démarrez d'abord la caméra.");
  const dynamique = estDynamique(lettreChoisie);
  enregistrement = {
    lettre: lettreChoisie, dynamique, image: 0, depart: performance.now() + 2000,
    restant: dynamique ? GESTES_PAR_SESSION : EXEMPLES_PAR_SESSION,
  };
  detecteurGeste.reinitialiser();
  $("btn-enregistrer").disabled = true;
});

function statut(texte) { $("etat-enregistrement").textContent = texte; }

function gererEnregistrement(geste) {
  const e = enregistrement;
  const attente = (e.depart - performance.now()) / 1000;
  if (attente > 0) return statut(`Préparez le signe « ${e.lettre} »… ${Math.ceil(attente)}`);
  if (e.dynamique) return enregistrerGeste(e, geste);
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

// Bonus mouvement : un exemple = un geste complet (on attend que la main s'immobilise)
function enregistrerGeste(e, geste) {
  const fait = GESTES_PAR_SESSION - e.restant;
  if (!geste) {
    if (mainSortie()) return statut(MESSAGE_SORTIE);
    const n = `Geste ${fait + 1} / ${GESTES_PAR_SESSION}`;
    return statut({
      attente: `${n} : prenez la position de départ et immobilisez la main.`,
      pret: `${n} : prêt (points verts) ! Tracez « ${e.lettre} », puis immobilisez la main.`,
      trace: `${n} : je suis le tracé… immobilisez la main à la fin.`,
    }[detecteurGeste.etat]);
  }
  dataset.ajouterGeste(e.lettre, geste.vecteur);
  e.restant--;
  bip(880);
  if (e.restant > 0) return statut(`Geste ${fait + 1} enregistré. Reprenez la position de départ.`);
  dataset.sauver();
  enregistrement = null;
  $("btn-enregistrer").disabled = false;
  statut(`« ${e.lettre} » enregistrée : ${GESTES_PAR_SESSION} gestes.`);
  afficherAlphabetEntrainement();
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
    const trace = estDynamique(lettre) && dataset.gestes[lettre]?.[0];
    if (trace) d.innerHTML = `${svgTrajectoire(trace)}${lettre}`;
    else d.innerHTML = img ? `<img src="${img}" alt="Signe ${lettre}">${lettre}` : `${lettre}<small>à enregistrer</small>`;
    grille.appendChild(d);
  }
}

function lancerPartie(texte) {
  const mot = normaliserMot(texte);
  if (!mot) return ($("alerte-mot").textContent = "Saisissez un mot (lettres A à Z).");
  const manquantes = [...new Set(mot)].filter((l) => !connue(l));
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
  partie.messageGeste = null;
  partie.passees = (partie.passees ?? 0) + 1;
  afficherPartie();
});

function gererPartie(prediction, dt, geste) {
  const evenement = estDynamique(partie.lettreCourante)
    ? verifierGeste(geste)
    : partie.mettreAJour(prediction, dt);
  if (evenement) partie.messageGeste = null;
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

function consigneGeste(lettre) {
  if (!dataset.nombreGestes(lettre)) return `L'IA ne connaît pas encore le geste « ${lettre} » : entraînez-la ou cliquez sur « Passer ».`;
  if (mainSortie()) return MESSAGE_SORTIE;
  const etat = detecteurGeste.etat;
  if (etat === "trace") return "Je suis le tracé… immobilisez la main à la fin.";
  const prefixe = partie.messageGeste ? `${partie.messageGeste} ` : "";
  return etat === "pret"
    ? `${prefixe}Prêt (points verts) : tracez « ${lettre} », puis immobilisez la main.`
    : `${prefixe}Prenez la position de départ de « ${lettre} » et immobilisez la main.`;
}

// Bonus mouvement : une lettre dynamique est validée par un geste complet reconnu
function verifierGeste(geste) {
  if (!geste) return null;
  const cible = partie.lettreCourante;
  const p = predire(dataset.gestes, geste.vecteur, 3, DISTANCE_MAX_GESTE);
  if (p && p.lettre === cible && p.confiance >= 0.6) return partie.lettreSuivante();
  partie.messageGeste = p ? `Tracé reconnu comme « ${p.lettre} ».` : "Tracé non reconnu.";
  bip(220, 0.2);
  return null;
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
  const trace = estDynamique(lettre) && dataset.gestes[lettre]?.[0];
  if (trace) {
    // pour J et Z, la référence est le tracé du premier geste enregistré
    $("vignette-cible").src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTrajectoire(trace));
    $("vignette-cible").hidden = false;
  }
  $("consigne").textContent = estDynamique(lettre)
    ? consigneGeste(lettre)
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
  const nbGestes = LETTRES_DYNAMIQUES.reduce((s, l) => s + dataset.nombreGestes(l), 0);
  const rg = nbGestes >= 4 ? evaluer(dataset.gestes, 3, DISTANCE_MAX_GESTE) : null;
  const ligneGestes = rg
    ? `<p><strong>Gestes J et Z :</strong> ${Math.round(rg.taux * 100)} % de ${rg.total} gestes bien reconnus.</p>`
    : "";
  zone.innerHTML = `
    <p class="eval-score">${Math.round(r.taux * 100)} %</p>
    <p>d'exemples bien reconnus sur ${r.total}.</p>
    <p><strong>Confusions les plus fréquentes :</strong> ${pires || "aucune"}</p>
    ${ligneGestes}
    <table class="eval-table"><thead><tr><th>Lettre</th><th>Réussite</th><th>Exemples</th></tr></thead><tbody>${lignes}</tbody></table>`;
});

afficherAlphabetEntrainement();
