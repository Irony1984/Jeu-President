/* ============================================================
   managers/player.js — Le PlayerManager (Phase 1, minimal)
   ------------------------------------------------------------
   Gère les joueurs. En Phase 1, un joueur = un niveau global
   (ch. 16). Pas encore de progression, cycle de vie, potentiel :
   ça viendra en Phase 3. Ici on génère seulement des effectifs
   crédibles pour pouvoir jouer des matchs.
   ============================================================ */

const PlayerManager = (function () {

  const POSTES = ["G", "D", "D", "D", "D", "M", "M", "M", "A", "A", "A"];
  const PRENOMS = ["Luca", "Marco", "Matteo", "Andrea", "Davide", "Giulio",
    "Simone", "Alessio", "Francesco", "Lorenzo", "Nicolò", "Tommaso",
    "Riccardo", "Federico", "Antonio", "Giovanni", "Stefano", "Emanuele"];
  const NOMS = ["Rossi", "Bianchi", "Ferrari", "Esposito", "Romano", "Colombo",
    "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca",
    "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri"];

  let _idCounter = 1;

  function _rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* Génère un joueur autour d'un niveau cible. */
  function createPlayer(clubId, poste, targetLevel) {
    // niveau = cible ± 6, borné 30-95
    let level = targetLevel + _rand(-6, 6);
    level = Math.max(30, Math.min(95, level));
    const age = _rand(18, 33);

    // Potentiel (ch. 7) : niveau maximal théorique, caché.
    // Les jeunes ont une marge de progression ; les joueurs mûrs
    // ont un potentiel proche (ou égal) de leur niveau actuel.
    let margin;
    if (age <= 20) margin = _rand(6, 20);
    else if (age <= 24) margin = _rand(3, 12);
    else if (age <= 28) margin = _rand(0, 5);
    else margin = 0; // au pic ou en déclin : plus de marge
    const potential = Math.min(99, level + margin);

    return {
      id: _idCounter++,
      name: _pick(PRENOMS) + " " + _pick(NOMS),
      clubId: clubId,
      poste: poste,
      level: level,
      potential: potential,   // caché (ch. 7)
      age: age,
      forme: 50, // forme du moment (0-100), influe la performance
      style: _pick(["off", "def", "eq"]), // Offensif / Défensif / Équilibré
      stats: { apps: 0, goals: 0, assists: 0, cards: 0, cleansheets: 0 },
    };
  }

  /* Génère un effectif complet (18 joueurs) pour un club,
     centré sur la force du club. Retourne le tableau de joueurs. */
  function generateSquad(clubId, clubStrength) {
    const squad = [];
    // 11 titulaires suivant les postes types + 7 remplaçants
    for (const poste of POSTES) {
      squad.push(createPlayer(clubId, poste, clubStrength));
    }
    for (let i = 0; i < 7; i++) {
      squad.push(createPlayer(clubId, _pick(POSTES), clubStrength - 4));
    }
    return squad;
  }

  /* Force effective d'un club = moyenne des 11 meilleurs joueurs.
     Sert au calcul du résultat des matchs. */
  function teamRating(gs, clubId) {
    const squad = gs.players.filter(p => p.clubId === clubId);
    if (squad.length === 0) return 50;
    const top = squad.slice().sort((a, b) => b.level - a.level).slice(0, 11);
    const sum = top.reduce((s, p) => s + p.level, 0);
    let rating = sum / top.length;
    // Bonus de cohésion de style (uniquement pour le club du joueur,
    // qui a un entraîneur avec un style). Réf : styles, addendum A10.
    if (clubId === gs.club.id && window.StaffManager) {
      rating += StaffManager.teamStyleBonus(gs);
    }
    return Math.round(rating);
  }

  return { createPlayer, generateSquad, teamRating };
})();

window.PlayerManager = PlayerManager;
