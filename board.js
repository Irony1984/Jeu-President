/* ============================================================
   managers/board.js — Le BoardManager (Phase 2)
   ------------------------------------------------------------
   Le Board (conseil d'administration) fixe des objectifs en
   début de saison, suit leur progression, et évalue le président
   en fin de saison. La confiance monte/descend selon les
   objectifs atteints ; sous un seuil (selon réputation), le
   président est licencié. Réf : Chapitre 5.

   En Phase 2 : objectifs SPORTIF + ATTAQUE actifs. L'objectif
   FINANCIER est défini mais activé quand les finances existeront.
   ============================================================ */

const BoardManager = (function () {

  /* Catalogue des objectifs proposables, avec 3 niveaux d'ambition.
     Chaque niveau : un seuil à atteindre, et le gain de confiance
     si réussi. La pénalité en cas d'échec est fixe (-10, ch. 5). */
  const MISS_PENALTY = -10;

  function catalogue(gs) {
    const nbClubs = gs.clubs ? gs.clubs.length : 19;
    return {
      sportif: {
        label: "Objectif sportif (classement)",
        levels: [
          { key: "prudent",   label: "Maintien",  desc: `Finir ${nbClubs - 3}ᵉ ou mieux`, target: nbClubs - 3, reward: 5 },
          { key: "moyen",     label: "Milieu de tableau", desc: "Finir 10ᵉ ou mieux", target: 10, reward: 10 },
          { key: "ambitieux", label: "Podium",    desc: "Finir 3ᵉ ou mieux", target: 3, reward: 15 },
        ],
      },
      attaque: {
        label: "Objectif offensif (buts marqués)",
        levels: [
          { key: "prudent",   label: "Correct",   desc: "Marquer 30 buts ou plus", target: 30, reward: 5 },
          { key: "moyen",     label: "Bon",       desc: "Marquer 45 buts ou plus", target: 45, reward: 10 },
          { key: "ambitieux", label: "Prolifique",desc: "Marquer 60 buts ou plus", target: 60, reward: 15 },
        ],
      },
      // FINANCIER : actif depuis la Phase 2 (finances de base).
      financier: {
        label: "Objectif financier (trésorerie en fin de saison)",
        levels: [
          { key: "prudent",   label: "Équilibre", desc: "Trésorerie positive", target: 0, reward: 5 },
          { key: "moyen",     label: "Sain",      desc: "Garder 5 M ou plus", target: 5, reward: 10 },
          { key: "ambitieux", label: "Prospère",  desc: "Garder 10 M ou plus", target: 10, reward: 15 },
        ],
      },
    };
  }

  /* Liste des objectifs ACTIFS en Phase 2 (financier désactivé). */
  function activeObjectiveKeys(gs) {
    const cat = catalogue(gs);
    return Object.keys(cat).filter(k => !cat[k].disabled);
  }

  /* Enregistre les choix d'ambition du président pour la saison.
     choices = { sportif: "moyen", attaque: "prudent", ... } */
  function setObjectives(gs, choices) {
    const cat = catalogue(gs);
    const objectives = [];
    for (const key of activeObjectiveKeys(gs)) {
      const chosen = choices[key];
      const level = cat[key].levels.find(l => l.key === chosen) || cat[key].levels[0];
      objectives.push({
        key: key,
        label: cat[key].label,
        levelKey: level.key,
        levelLabel: level.label,
        desc: level.desc,
        target: level.target,
        reward: level.reward,
        met: null, // évalué en fin de saison
      });
    }
    gs.board.objectives = objectives;
    gs.board.objectivesSet = true;
  }

  /* Valeur courante d'un objectif (pour le suivi en cours de saison). */
  function currentValue(gs, key) {
    if (key === "sportif") {
      const rows = WorldManager.getStandings(gs);
      const me = rows.find(r => r.isPlayer);
      return me ? me.rank : null;
    }
    if (key === "attaque") {
      const s = gs.world.standings[gs.club.id];
      return s ? s.gf : 0;
    }
    if (key === "financier") {
      return gs.club.cash;
    }
    return null;
  }

  /* Un objectif est-il rempli, vu sa valeur courante ?
     Sportif : rang <= cible (plus petit = mieux).
     Attaque / financier : valeur >= cible. */
  function isMet(key, value, target) {
    if (value === null || value === undefined) return false;
    if (key === "sportif") return value <= target;
    return value >= target;
  }

  /* Évalue tous les objectifs en fin de saison, ajuste la confiance,
     et détermine si le président est licencié. Retourne un rapport. */
  function evaluate(gs) {
    let delta = 0;
    const results = [];
    for (const obj of gs.board.objectives) {
      const val = currentValue(gs, obj.key);
      const met = isMet(obj.key, val, obj.target);
      obj.met = met;
      const change = met ? obj.reward : MISS_PENALTY;
      delta += change;
      results.push({
        key: obj.key, label: obj.label, levelLabel: obj.levelLabel,
        desc: obj.desc, value: val, target: obj.target, met, change,
      });
    }

    gs.board.confidence = Math.max(0, Math.min(100, gs.board.confidence + delta));

    // Seuil de licenciement selon la réputation (ch. 5 & 17).
    const thresholds = { amateur: 20, confirme: 30, legende: 40 };
    const threshold = thresholds[gs.president.reputation] ?? 20;
    const fired = gs.board.confidence < threshold;

    return {
      results,
      delta,
      confidence: gs.board.confidence,
      threshold,
      fired,
    };
  }

  /* Réinitialise le drapeau d'objectifs pour la nouvelle saison. */
  function resetForNewSeason(gs) {
    gs.board.objectivesSet = false;
    gs.board.objectives = [];
  }

  return {
    catalogue, activeObjectiveKeys, setObjectives,
    currentValue, isMet, evaluate, resetForNewSeason,
  };
})();

window.BoardManager = BoardManager;
