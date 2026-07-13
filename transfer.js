/* ============================================================
   managers/world.js — Le WorldManager (Phase 1)
   ------------------------------------------------------------
   Construit le championnat de 2e division : clubs, effectifs,
   calendrier (round-robin aller-retour), classement. Simule
   les matchs des clubs IA journée par journée (ch. 6).
   ============================================================ */

const WorldManager = (function () {

  /* Construit le monde de Phase 1 à partir d'une liste de clubs.
     Remplit gs.clubs, gs.players, le calendrier et le classement.
     playerClubInfo : { name, city } — le club du joueur, qui est
     AJOUTÉ au championnat (nouvelle entité, pas un club existant).
     Sa force est générée automatiquement (modeste, D2 réaliste).
     Retourne l'id du club du joueur. */
  function setupLeague(gs, clubList, playerClubInfo) {
    gs.clubs = [];
    gs.players = [];

    // 1. Créer les clubs existants + leurs effectifs.
    clubList.forEach((c, idx) => {
      const clubId = idx + 1;
      gs.clubs.push({
        id: clubId,
        name: c.name,
        city: c.city || "",
        strength: c.strength,
        isPlayer: false,
      });
      const squad = PlayerManager.generateSquad(clubId, c.strength);
      gs.players.push(...squad);
    });

    // 2. AJOUTER le club du joueur au championnat (nouvelle entité).
    //    Force modeste générée automatiquement : un nouveau venu en D2.
    const playerId = gs.clubs.length + 1;
    const playerStrength = 50 + Math.floor(Math.random() * 7); // 50-56
    const playerClub = {
      id: playerId,
      name: playerClubInfo.name,
      city: playerClubInfo.city || "",
      strength: playerStrength,
      isPlayer: true,
    };
    gs.clubs.push(playerClub);
    gs.players.push(...PlayerManager.generateSquad(playerId, playerStrength));

    gs.club.id = playerId;
    gs.club.name = playerClub.name;
    gs.club.city = playerClub.city;

    // 3. Générer le calendrier (round-robin aller-retour).
    gs.world.competitions = [{
      id: "d2",
      name: "2e Division",
      type: "league",
      clubIds: gs.clubs.map(c => c.id),
    }];
    gs.world.fixtures = buildFixtures(gs.clubs.map(c => c.id));
    gs.world.currentMatchday = 0;

    // 4. Initialiser le classement.
    gs.world.standings = {};
    for (const c of gs.clubs) {
      gs.world.standings[c.id] = {
        clubId: c.id, played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, points: 0,
      };
    }

    return playerClub.id;
  }

  /* Algorithme du "cercle" (round-robin) : génère les journées
     aller, puis retour (matchs inversés). Renvoie un tableau de
     journées, chaque journée = tableau de {home, away}. */
  function buildFixtures(clubIds) {
    const ids = clubIds.slice();
    if (ids.length % 2 !== 0) ids.push(null); // bye si impair
    const n = ids.length;
    const rounds = n - 1;
    const half = n / 2;
    const days = [];

    let arr = ids.slice();
    for (let r = 0; r < rounds; r++) {
      const day = [];
      for (let i = 0; i < half; i++) {
        const home = arr[i];
        const away = arr[n - 1 - i];
        if (home !== null && away !== null) {
          // alterner domicile/extérieur pour l'équité
          if (r % 2 === 0) day.push({ home, away });
          else day.push({ home: away, away: home });
        }
      }
      days.push(day);
      // rotation (on fixe le 1er élément)
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr = [fixed, ...rest];
    }

    // Matchs retour = aller inversés.
    const returnDays = days.map(day =>
      day.map(m => ({ home: m.away, away: m.home }))
    );
    return days.concat(returnDays);
  }

  /* Simule un match entre deux clubs à partir de leur force.
     Renvoie { homeGoals, awayGoals }. Modèle simple : la force
     relative augmente le nombre de buts espérés, avec de l'aléa. */
  function simulateMatch(gs, homeId, awayId) {
    const rh = PlayerManager.teamRating(gs, homeId) + 4; // avantage domicile
    const ra = PlayerManager.teamRating(gs, awayId);
    const diff = rh - ra;
    // buts espérés : base 1.3, modulée par l'écart de niveau
    const lambdaH = Math.max(0.2, 1.3 + diff * 0.04);
    const lambdaA = Math.max(0.2, 1.3 - diff * 0.04);
    return {
      homeGoals: poisson(lambdaH),
      awayGoals: poisson(lambdaA),
    };
  }

  /* Tirage de Poisson (nombre de buts) — algorithme de Knuth. */
  function poisson(lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  /* Applique un résultat au classement. */
  function applyResult(gs, homeId, awayId, hg, ag) {
    const S = gs.world.standings;
    const h = S[homeId], a = S[awayId];
    h.played++; a.played++;
    h.gf += hg; h.ga += ag;
    a.gf += ag; a.ga += hg;
    if (hg > ag) { h.won++; h.points += 3; a.lost++; }
    else if (hg < ag) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }

  /* Simule TOUTE une journée SAUF le match du club du joueur
     (celui-ci est joué via le MatchManager / écran de match).
     Renvoie la liste des résultats + le match du joueur éventuel. */
  function playMatchday(gs, matchdayIndex) {
    const fixtures = gs.world.fixtures[matchdayIndex];
    if (!fixtures) return { results: [], playerMatch: null };

    const results = [];
    let playerMatch = null;

    for (const m of fixtures) {
      const involvesPlayer = (m.home === gs.club.id || m.away === gs.club.id);
      if (involvesPlayer) {
        playerMatch = m; // sera résolu par l'écran de match
        continue;
      }
      const r = simulateMatch(gs, m.home, m.away);
      applyResult(gs, m.home, m.away, r.homeGoals, r.awayGoals);
      results.push({ ...m, ...r });
    }
    return { results, playerMatch };
  }

  /* Construit le calendrier du joueur : pour chaque journée, la date,
     l'adversaire, domicile/extérieur, et le résultat si déjà joué.
     S'appuie sur les événements "matchday" (datés) et les fixtures. */
  function getPlayerCalendar(gs) {
    const out = [];
    const myId = gs.club.id;
    // Dates des journées : table permanente (remplie à la programmation),
    // avec repli sur les événements encore en file.
    const dateByMatchday = Object.assign({}, gs.world.matchdayDates || {});
    for (const ev of gs.events) {
      if (ev.type === "matchday" && !dateByMatchday[ev.matchday]) {
        dateByMatchday[ev.matchday] = ev.date;
      }
    }
    const results = gs.world.playerResults || {};

    for (let md = 0; md < gs.world.fixtures.length; md++) {
      const day = gs.world.fixtures[md];
      const m = day.find(x => x.home === myId || x.away === myId);
      if (!m) continue; // journée de repos (nombre impair de clubs)

      const isHome = m.home === myId;
      const oppId = isHome ? m.away : m.home;
      const opp = gs.clubs.find(c => c.id === oppId);
      const res = results[md] || null;

      out.push({
        matchday: md,
        date: dateByMatchday[md] || null,
        opponent: opp ? opp.name : "?",
        isHome: isHome,
        played: !!res,
        result: res,
      });
    }
    return out;
  }

  /* Renvoie le prochain match du joueur (non encore joué). */
  function getNextPlayerMatch(gs) {
    const cal = getPlayerCalendar(gs);
    return cal.find(m => !m.played) || null;
  }
  function getStandings(gs) {
    const rows = Object.values(gs.world.standings);
    rows.sort((x, y) =>
      y.points - x.points ||
      (y.gf - y.ga) - (x.gf - x.ga) ||
      y.gf - x.gf
    );
    return rows.map((row, i) => {
      const club = gs.clubs.find(c => c.id === row.clubId);
      return { rank: i + 1, name: club.name, isPlayer: club.isPlayer, ...row };
    });
  }

  return {
    setupLeague, buildFixtures, simulateMatch, applyResult,
    playMatchday, getStandings, poisson,
    getPlayerCalendar, getNextPlayerMatch,
  };
})();

window.WorldManager = WorldManager;
