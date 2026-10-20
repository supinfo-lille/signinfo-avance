// ÉTAPE 1 — Webcam + détection de la main avec MediaPipe Hand Landmarker
import { HandLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODELE = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Charge le modèle de détection de la main (une seule main suffit pour l'alphabet)
export async function creerDetecteur() {
  const vision = await FilesetResolver.forVisionTasks(WASM);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODELE, delegate },
    runningMode: "VIDEO",
    numHands: 1,
  });
  try {
    return await HandLandmarker.createFromOptions(vision, options("GPU"));
  } catch (e) {
    console.warn("GPU indisponible, passage au CPU", e);
    return await HandLandmarker.createFromOptions(vision, options("CPU"));
  }
}

// Demande l'accès à la webcam et branche le flux sur la balise <video>
export async function demarrerWebcam(video) {
  const flux = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
    audio: false,
  });
  video.srcObject = flux;
  await new Promise((ok) => (video.onloadedmetadata = ok));
  await video.play();
}

// Analyse chaque nouvelle image de la vidéo et transmet le résultat
export function lancerBoucle(video, detecteur, surResultat) {
  let dernierTemps = -1;
  function tour() {
    if (video.currentTime !== dernierTemps) {
      dernierTemps = video.currentTime;
      const resultat = detecteur.detectForVideo(video, performance.now());
      surResultat(resultat);
    }
    requestAnimationFrame(tour);
  }
  tour();
}

// Dessine le squelette de la main (21 points + leurs liaisons) sur le canvas
export function creerDessinateur(ctx) {
  const outils = new DrawingUtils(ctx);
  return function dessiner(resultat) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const points of resultat.landmarks) {
      outils.drawConnectors(points, HandLandmarker.HAND_CONNECTIONS, { color: "#2EE6B0", lineWidth: 4 });
      outils.drawLandmarks(points, { color: "#FFFFFF", fillColor: "#5B3DF5", lineWidth: 2, radius: 5 });
    }
  };
}
