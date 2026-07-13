/* ============================================================
   gamestate.js — L'état central du jeu (GameState)
   ------------------------------------------------------------
   Un unique objet contient TOUTES les données du jeu.
   C'est le "contrat" que tous les Managers respectent :
   chaque Manager lit et écrit ici, et rien d'autre.
   C'est aussi cet objet, et lui seul, qui est sauvegardé.
   Réf : Chapitre 13 — Architecture technique.
   ============================================================ */

const GameState = {

  /* --- Métadonnées de la partie --- */
  meta: {
    version: 1,            // version du schéma (pour migrations futures)
    createdAt: null,       // date de création de la partie (timestamp)
    lastSaved: null,       // date de dernière sauvegarde (timestamp)
    seed: null,            // graine aléatoire (pour reproductibilité)
  },

  /* --- Le temps --- */
  time: {
    currentDate: null,     // date courante dans le jeu (AAAA-MM-JJ)
    season: 1,             // numéro de saison en cours
    inMercato: false,      // sommes-nous dans une fenêtre de mercato ?
    phase: "season",       // "season" | "intersaison"
  },

  /* --- Le Président (le joueur) --- */
  president: {
    name: "",
    reputation: "amateur", // "amateur" | "confirme" | "legende"
    personalWealth: 0,     // fortune personnelle (M), distincte du club
  },

  /* --- Le club du joueur --- */
  club: {
    id: null,
    name: "",
    country: null,         // pays choisi parmi les 5 grands
    division: 2,           // on démarre en 2e division
    cash: 0,               // trésorerie du club (M)
    reputation: 0,         // réputation du club (0-100)
    stadiumCapacity: 0,
    academyLevel: 1,       // niveau du centre de formation
    medicalLevel: 1,       // niveau du centre médical
  },

  /* --- Le Board --- */
  board: {
    confidence: 70,        // confiance sur 100 (départ : 70)
    objectives: [],        // 3 objectifs de la saison en cours
  },

  /* --- Le climat interne (jauges) --- */
  climate: {
    coachTrust: 70,        // confiance du coach (0-100)
    dressingRoom: 70,      // ambiance du vestiaire (0-100)
  },

  /* --- Les entités du monde --- */
  players: [],             // tous les joueurs (tous clubs confondus)
  clubs: [],               // tous les clubs (IA + joueur)
  staff: [],               // coach, scouts, médical

  /* --- Le monde / compétitions --- */
  world: {
    competitions: [],      // championnats, coupes, europe
    standings: {},         // classements par compétition
  },

  /* --- La file d'événements (moteur du temps) --- */
  events: [],              // événements datés, triés par date

  /* --- Historique (Hall of Fame, palmarès...) --- */
  history: {
    hallOfFame: [],
    seasons: [],
  },
};

/* ------------------------------------------------------------
   Fabrique d'une nouvelle partie vierge.
   Retourne un GameState frais (copie profonde du modèle),
   initialisé avec les quelques valeurs de départ nécessaires.
   ------------------------------------------------------------ */
function createNewGame(options = {}) {
  // Copie profonde du modèle pour ne jamais muter l'original.
  const gs = structuredClone(GameState);

  const now = Date.now();
  gs.meta.createdAt = now;
  gs.meta.lastSaved = now;
  gs.meta.seed = options.seed ?? now;

  // Le temps démarre à une date de pré-saison (1er juillet).
  // L'année est arbitraire ; seule la mécanique compte.
  gs.time.currentDate = options.startDate ?? "2025-07-01";
  gs.time.season = 1;
  gs.time.inMercato = false;
  gs.time.phase = "season";

  // Le Président.
  gs.president.name = options.presidentName ?? "Président";
  gs.president.reputation = options.reputation ?? "amateur";
  gs.president.personalWealth = 0;

  // Le club (valeurs d'équilibrage de départ, ch. 17).
  gs.club.name = options.clubName ?? "Club Sans Nom";
  gs.club.country = options.country ?? null;
  gs.club.division = 2;
  gs.club.cash = 15;          // 15 M de trésorerie de départ en D2
  gs.club.reputation = 20;
  gs.club.academyLevel = 1;
  gs.club.medicalLevel = 1;

  // Le Board démarre à 70 de confiance.
  gs.board.confidence = 70;
  gs.board.objectives = [];

  // État financier (journal des opérations, compteurs de saison).
  gs.finance = { ledger: [], seasonIncome: 0, seasonExpense: 0 };
  gs.world.tvPaidSeason = false;

  // État des transferts (offres du mercato en cours).
  gs.transfers = { offers: [], loans: [], active: [], window: false };

  // Staff : chaque poste est une liste de titulaires, vide au départ
  // (poste vacant tenu par un intérimaire). Jusqu'à 3 recruteurs et
  // 3 médecins ; un seul entraîneur.
  gs.staff = { coach: [], scout: [], medic: [] };

  return gs;
}

/* Rendre accessible globalement (chargement par <script>, sans modules). */
window.GameState = GameState;
window.createNewGame = createNewGame;
