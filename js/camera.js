// ÉTAPE 1 — Webcam + détection de la main
// Documentation : https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js
import { HandLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODELE = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Renvoie un HandLandmarker prêt à analyser un flux vidéo (une main). Prévoir un repli CPU si le GPU échoue.
export async function creerDetecteur() {
  // TODO
  throw new Error("Étape 1 à compléter : creerDetecteur() dans js/camera.js");
}

// Branche la webcam (640 × 480, caméra frontale) sur l'élément <video> et attend qu'elle joue.
export async function demarrerWebcam(video) {
  // TODO
}

// Analyse chaque NOUVELLE image de la vidéo et passe le résultat à surResultat(resultat).
export function lancerBoucle(video, detecteur, surResultat) {
  // TODO
}

// Renvoie une fonction dessiner(resultat) qui trace le squelette de la main sur ctx.
export function creerDessinateur(ctx) {
  // TODO
  return function dessiner(resultat) {};
}
