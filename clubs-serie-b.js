/* ============================================================
   data/clubs-serie-b.js — Données des clubs (ÉDITABLE)
   ------------------------------------------------------------
   Liste des clubs de 2e division (exemple : Serie B italienne).
   Ces noms proviennent d'une connaissance datée (début 2025) :
   ILS SONT À VÉRIFIER / CORRIGER librement. Le moteur du jeu
   se contente de lire ce fichier — tu peux remplacer les noms
   et ajuster les forces sans toucher au code.

   Champs par club :
     name     : nom affiché
     strength : force moyenne du club (0-100). Sert à générer
                les joueurs autour de ce niveau et à simuler les
                matchs. Un club "fort" a une strength plus haute.
   ============================================================ */

const CLUBS_SERIE_B = [
  { name: "US Sassuolo",        strength: 68 },
  { name: "US Cremonese",       strength: 66 },
  { name: "Palermo FC",         strength: 65 },
  { name: "US Catanzaro",       strength: 62 },
  { name: "Brescia Calcio",     strength: 61 },
  { name: "SS Juve Stabia",     strength: 60 },
  { name: "Spezia Calcio",      strength: 63 },
  { name: "Pisa SC",            strength: 64 },
  { name: "Modena FC",          strength: 59 },
  { name: "AC Reggiana",        strength: 58 },
  { name: "US Salernitana",     strength: 62 },
  { name: "Frosinone Calcio",   strength: 60 },
  { name: "Cesena FC",          strength: 57 },
  { name: "SC Bari",            strength: 59 },
  { name: "Carrarese Calcio",   strength: 54 },
  { name: "US Cittadella",      strength: 55 },
  { name: "Cosenza Calcio",     strength: 53 },
  { name: "Mantova 1911",       strength: 52 },
];

window.CLUBS_SERIE_B = CLUBS_SERIE_B;
