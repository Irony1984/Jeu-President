/* ============================================================
   managers/match.js — Le MatchManager (Phase 1)
   ------------------------------------------------------------
   Résout le match du club du joueur. Produit un RÉSULTAT et un
   FIL D'ÉVÉNEMENTS commenté (ch. 12). L'écran de match pourra
   dérouler le fil OU sauter au résultat via "Simuler" — dans
   les deux cas, le résultat final est le même (déjà calculé).
   Le Président observe : aucune action pendant le match (R001).
   ============================================================ */

const MatchManager = (function () {

  /* Résout le match du joueur.
     home/away = ids de club. Retourne :
       { homeId, awayId, homeName, awayName,
         homeGoals, awayGoals, feed: [ {minute, text}, ... ] } */
  function resolvePlayerMatch(gs, homeId, awayId) {
    const r = WorldManager.simulateMatch(gs, homeId, awayId);
    const homeName = clubName(gs, homeId);
    const awayName = clubName(gs, awayId);

    const feed = buildFeed(gs, homeId, awayId, r.homeGoals, r.awayGoals, homeName, awayName);

    // Appliquer le résultat au classement (comme pour les clubs IA).
    WorldManager.applyResult(gs, homeId, awayId, r.homeGoals, r.awayGoals);

    // Enregistrer le résultat du match du joueur (pour le calendrier).
    if (!gs.world.playerResults) gs.world.playerResults = {};
    gs.world.playerResults[gs.world.currentMatchday] = {
      matchday: gs.world.currentMatchday,
      homeId, awayId, homeName, awayName,
      homeGoals: r.homeGoals, awayGoals: r.awayGoals,
    };

    // Attribuer les statistiques individuelles aux joueurs du club.
    const myId = gs.club.id;
    const isHome = homeId === myId;
    const goalsFor = isHome ? r.homeGoals : r.awayGoals;
    const goalsAgainst = isHome ? r.awayGoals : r.homeGoals;
    recordPlayerStats(gs, myId, goalsFor, goalsAgainst);

    return {
      homeId, awayId, homeName, awayName,
      homeGoals: r.homeGoals, awayGoals: r.awayGoals,
      feed,
    };
  }

  /* Répartit les statistiques d'un match sur les joueurs du club :
     matchs joués (le onze), buts et passes décisives pondérés par poste
     et niveau, cartons au hasard, clean sheet au gardien si 0 encaissé. */
  function recordPlayerStats(gs, clubId, goalsFor, goalsAgainst) {
    const squad = gs.players.filter(p => p.clubId === clubId);
    if (squad.length === 0) return;
    // Le onze : 11 meilleurs par niveau.
    const eleven = squad.slice().sort((a, b) => b.level - a.level).slice(0, 11);
    for (const p of eleven) {
      p.stats = p.stats || { apps: 0, goals: 0, assists: 0, cards: 0, cleansheets: 0 };
      p.stats.apps += 1;
    }
    // Poids offensif par poste (les attaquants marquent le plus).
    const posteWeight = { A: 6, M: 3, D: 1, G: 0.05 };
    const weightOf = (p) => (posteWeight[p.poste] || 1) * (0.5 + p.level / 100);

    const pickWeighted = () => {
      const total = eleven.reduce((s, p) => s + weightOf(p), 0);
      let x = Math.random() * total;
      for (const p of eleven) { x -= weightOf(p); if (x <= 0) return p; }
      return eleven[0];
    };

    // Buts marqués -> buteur + éventuelle passe décisive (autre joueur).
    for (let i = 0; i < goalsFor; i++) {
      const scorer = pickWeighted();
      scorer.stats.goals += 1;
      if (Math.random() < 0.7) {
        let passer = pickWeighted();
        let tries = 0;
        while (passer === scorer && tries < 5) { passer = pickWeighted(); tries++; }
        if (passer !== scorer) passer.stats.assists += 1;
      }
    }

    // Clean sheet : si aucun but encaissé, le gardien (et la défense) en profite.
    if (goalsAgainst === 0) {
      const gk = eleven.find(p => p.poste === "G");
      if (gk) gk.stats.cleansheets += 1;
    }

    // Cartons : 0 à 2 par match, répartis au hasard dans le onze.
    const nbCards = Math.random() < 0.5 ? 0 : (Math.random() < 0.8 ? 1 : 2);
    for (let i = 0; i < nbCards; i++) {
      const p = eleven[Math.floor(Math.random() * eleven.length)];
      p.stats.cards += 1;
    }
  }

  /* Construit un fil d'événements plausible cohérent avec le score.
     On place les buts à des minutes aléatoires, triées, plus le
     coup d'envoi / mi-temps / coup de sifflet final. */
  function buildFeed(gs, homeId, awayId, hg, ag, homeName, awayName) {
    const goals = [];
    for (let i = 0; i < hg; i++) goals.push({ side: "home", minute: rndMinute() });
    for (let i = 0; i < ag; i++) goals.push({ side: "away", minute: rndMinute() });
    goals.sort((a, b) => a.minute - b.minute);

    const feed = [];
    feed.push({ minute: 0, text: `Coup d'envoi : ${homeName} — ${awayName}` });

    let h = 0, a = 0, halftimeInserted = false;
    for (const g of goals) {
      if (!halftimeInserted && g.minute > 45) {
        feed.push({ minute: 45, text: `Mi-temps : ${homeName} ${h} - ${a} ${awayName}` });
        halftimeInserted = true;
      }
      if (g.side === "home") h++; else a++;
      const scorer = randomScorer(gs, g.side === "home" ? homeId : awayId);
      const team = g.side === "home" ? homeName : awayName;
      feed.push({ minute: g.minute, text: `⚽ ${g.minute}' BUT pour ${team} ! (${scorer})  [${h}-${a}]` });
    }
    if (!halftimeInserted) {
      feed.push({ minute: 45, text: `Mi-temps : ${homeName} ${h} - ${a} ${awayName}` });
    }
    feed.push({ minute: 90, text: `Coup de sifflet final : ${homeName} ${hg} - ${ag} ${awayName}` });
    return feed;
  }

  function rndMinute() { return Math.floor(Math.random() * 90) + 1; }

  function randomScorer(gs, clubId) {
    // Un buteur plausible : plutôt un attaquant/milieu, sinon n'importe.
    const squad = gs.players.filter(p => p.clubId === clubId);
    const attackers = squad.filter(p => p.poste === "A" || p.poste === "M");
    const pool = attackers.length ? attackers : squad;
    if (!pool.length) return "un joueur";
    return pool[Math.floor(Math.random() * pool.length)].name;
  }

  function clubName(gs, clubId) {
    const c = gs.clubs.find(c => c.id === clubId);
    return c ? c.name : "?";
  }

  return { resolvePlayerMatch };
})();

window.MatchManager = MatchManager;
