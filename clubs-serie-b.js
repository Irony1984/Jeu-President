/* ============================================================
   managers/transfer.js — Le TransferManager (Phase 3)
   ------------------------------------------------------------
   Le marché des transferts. Le président REÇOIT des offres et
   décide (il ne cherche pas). Deux sens : vendre (des clubs
   veulent nos joueurs) et acheter (des joueurs nous sont
   proposés). Double négociation : club (prix) puis joueur
   (salaire + durée). Uniquement pendant les mercatos. Réf : ch. 8.

   Le volume d'offres dépend des besoins du club (ajout doc A8) :
   un club faible à un poste reçoit des propositions de renfort ;
   un club riche en bons joueurs est davantage sollicité (ventes).
   ============================================================ */

const TransferManager = (function () {

  const POSTES = ["G", "D", "M", "A"];
  const PRENOMS = ["Luca", "Marco", "Matteo", "Andrea", "Davide", "Giulio",
    "Simone", "Alessio", "Francesco", "Lorenzo", "Nicolò", "Tommaso",
    "Diego", "Pablo", "Bruno", "Thiago", "Rafael", "Yannick", "Karim", "Sven"];
  const NOMS = ["Rossi", "Bianchi", "Ferrari", "Esposito", "Romano", "Colombo",
    "Silva", "Costa", "Fernández", "Moreau", "Schmidt", "Novak",
    "Rizzo", "Lombardi", "Moretti", "Barbieri", "Conti", "Greco"];

  function _rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function _round(x) { return Math.round(x * 100) / 100; }

  /* --- VALORISATION (ch. 17 + âge + potentiel) ---
     Prix = fonction du niveau, du potentiel restant et de l'âge.
     Ancrages ch. 17 : espoir ~50 => 2-5 M ; bon ~70 => 15-25 M ;
     star 85+ => 60 M+. Un jeune à fort potentiel vaut plus cher. */
  function marketValue(player) {
    const lvl = player.level;
    // Base exponentielle sur le niveau, calibrée pour la 2e division
    // (budgets ~15 M) : un joueur niveau ~55 vaut ~1-2 M, ~70 ~5-7 M,
    // un crack ~85 ~20 M. Ordres de grandeur à ajuster au tuning.
    let base = Math.pow(Math.max(0, lvl - 35) / 50, 2.6) * 26;
    // Prime de potentiel restant (d'autant plus forte que jeune).
    const potentialLeft = Math.max(0, (player.potential || lvl) - lvl);
    const youthFactor = player.age <= 21 ? 1.0 : player.age <= 25 ? 0.6 : 0.25;
    base += potentialLeft * 0.35 * youthFactor;
    // Décote de l'âge (déclin après 30 ans).
    if (player.age >= 31) base *= (1 - (player.age - 30) * 0.12);
    if (player.age >= 34) base *= 0.5;
    return Math.max(0.2, _round(base));
  }

  /* --- ANALYSE DES BESOINS (par poste) ---
     Pour chaque poste, compte les joueurs et leur niveau moyen.
     Renvoie, par poste : { count, avg, need } où need indique
     un manque (peu de joueurs / faible niveau) => envie de recruter,
     ou un surplus de qualité => sollicitations de vente. */
  function analyzeSquad(gs, clubId) {
    const squad = gs.players.filter(p => p.clubId === clubId);
    const byPoste = {};
    for (const poste of POSTES) {
      const grp = squad.filter(p => p.poste === poste);
      const count = grp.length;
      const avg = count ? grp.reduce((s, p) => s + p.level, 0) / count : 0;
      byPoste[poste] = { count, avg: Math.round(avg), players: grp };
    }
    return byPoste;
  }

  /* Effectif "idéal" minimal par poste (pour juger manque/surplus). */
  const MIN_PER_POSTE = { G: 2, D: 6, M: 6, A: 4 };

  /* --- OUVERTURE DU MERCATO ---
     On ne génère plus tout d'un bloc : le marché s'ouvre vide, puis
     de nouvelles offres tombent au fil du temps (voir tickMarket).
     On mémorise le "potentiel" du club par poste pour pondérer. */
  function generateOffers(gs) {
    gs.transfers = gs.transfers || {};
    gs.transfers.offers = [];
    gs.transfers.loans = [];
    gs.transfers.window = true;
    gs.transfers._idc = 1;
    // Quelques offres d'emblée pour que le marché ne soit pas vide.
    for (let i = 0; i < 2; i++) tickMarket(gs);
    return gs.transfers.offers;
  }

  /* --- BATTEMENT DE MARCHÉ (appelé à chaque avancée de temps) ---
     1) Fait expirer les offres trop anciennes (2-3 avancées).
     2) Génère, avec une forte probabilité, de nouvelles offres
        pondérées par les besoins du club (par poste).
     Renvoie { added, expired } pour information. */
  function tickMarket(gs) {
    gs.transfers = gs.transfers || {};
    if (!gs.transfers.window) return { added: 0, expired: 0 };
    gs.transfers.offers = gs.transfers.offers || [];
    gs.transfers.loans = gs.transfers.loans || [];
    if (!gs.transfers._idc) gs.transfers._idc = 1;

    // 1) Expiration : chaque offre ouverte perd 1 point de "vie".
    let expired = 0;
    const expireList = (arr) => {
      for (const o of arr) {
        if (o.status !== "open") continue;
        o.ttl = (o.ttl === undefined ? _rand(2, 3) : o.ttl) - 1;
        if (o.ttl < 0) { o.status = "expired"; expired++; }
      }
    };
    expireList(gs.transfers.offers);
    expireList(gs.transfers.loans);

    // 2) Génération pondérée par les besoins.
    const analysis = analyzeSquad(gs, gs.club.id);
    const clubStrength = gs.clubs.find(c => c.id === gs.club.id).strength || 55;
    let added = 0;

    // Marché actif : souvent une nouvelle offre (parfois deux).
    const draws = Math.random() < 0.55 ? 2 : 1;
    for (let d = 0; d < draws; d++) {
      // Choisir un poste pondéré par le besoin (manque => achat/prêt in ;
      // surplus de qualité => vente/prêt out).
      const poste = _weightedPoste(analysis, clubStrength);
      const info = analysis[poste];
      const manque = info.count < MIN_PER_POSTE[poste] || info.avg < clubStrength - 2;
      const surplus = info.count > MIN_PER_POSTE[poste];

      // Décider du type d'offre selon la situation du poste.
      const roll = Math.random();
      if (manque && roll < 0.6) {
        _pushBuy(gs, poste, clubStrength); added++;
      } else if (manque) {
        _pushLoanIn(gs, poste, clubStrength); added++;
      } else if (surplus && roll < 0.5) {
        if (_pushSell(gs, poste, clubStrength, info)) added++;
      } else if (surplus) {
        if (_pushLoanOut(gs, poste, info)) added++;
      } else {
        // Poste équilibré : occasionnellement une offre d'achat d'opportunité.
        if (roll < 0.3) { _pushBuy(gs, poste, clubStrength); added++; }
      }
    }
    return { added, expired };
  }

  /* Choix d'un poste pondéré par le besoin (manque) ou le surplus. */
  function _weightedPoste(analysis, clubStrength) {
    const weights = [];
    for (const poste of POSTES) {
      const info = analysis[poste];
      let w = 1;
      if (info.count < MIN_PER_POSTE[poste]) w += 3;       // manque d'effectif
      if (info.avg < clubStrength - 2) w += 2;             // niveau faible
      if (info.count > MIN_PER_POSTE[poste]) w += 1;       // surplus (sollicitations)
      weights.push({ poste, w });
    }
    const total = weights.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const x of weights) { r -= x.w; if (r <= 0) return x.poste; }
    return POSTES[0];
  }

  function _pushBuy(gs, poste, clubStrength) {
    const p = _makeProspect(poste, clubStrength + _rand(-4, 6));
    gs.transfers.offers.push({
      id: gs.transfers._idc++, type: "buy", poste, player: p,
      askPrice: marketValue(p),
      askWage: _round(FinanceManager.playerSalary(p.level) * _rand(100, 140) / 100),
      askYears: _rand(2, 4),
      fromClub: _randomOtherClubName(gs), status: "open", ttl: _rand(2, 3),
    });
  }
  function _pushSell(gs, poste, clubStrength, info) {
    const best = info.players.slice().sort((a, b) => b.level - a.level)[0];
    if (!best || best.level < clubStrength) return false;
    gs.transfers.offers.push({
      id: gs.transfers._idc++, type: "sell", poste,
      player: _publicPlayer(best), playerId: best.id,
      bidPrice: _round(marketValue(best) * _rand(85, 120) / 100),
      fromClub: _randomOtherClubName(gs), status: "open", ttl: _rand(2, 3),
    });
    return true;
  }
  function _pushLoanIn(gs, poste, clubStrength) {
    const p = _makeProspect(poste, clubStrength + _rand(-2, 8));
    gs.transfers.loans.push({
      id: "L" + (gs.transfers._idc++), dir: "in", poste, player: p,
      wage: FinanceManager.playerSalary(p.level),
      fromClub: _randomOtherClubName(gs),
      askShare: _pick([50, 75, 100]), status: "open", ttl: _rand(2, 3),
    });
  }
  function _pushLoanOut(gs, poste, info) {
    const weakest = info.players.slice().sort((a, b) => a.level - b.level)[0];
    if (!weakest) return false;
    gs.transfers.loans.push({
      id: "L" + (gs.transfers._idc++), dir: "out", poste,
      player: _publicPlayer(weakest), playerId: weakest.id,
      wage: FinanceManager.playerSalary(weakest.level),
      fromClub: _randomOtherClubName(gs),
      offeredShare: _pick([0, 30, 50]), status: "open", ttl: _rand(2, 3),
    });
    return true;
  }

  /* --- GÉNÉRATION DES OFFRES DE PRÊT ---
     Prêt gratuit ; la négociation porte sur la PART du salaire prise
     en charge par le club d'accueil (0/30/50/75/100 %).
       - Prêt SORTANT : un club veut un de nos joueurs remplaçants
         (surplus au poste) pour lui donner du temps de jeu.
       - Prêt ENTRANT : un joueur (souvent jeune, à potentiel) nous
         est proposé en renfort temporaire là où on manque.
     Réf : ch. 8 (ajout doc A8). */
  function generateLoanOffers(gs) {
    gs.transfers = gs.transfers || {};
    gs.transfers.loans = [];
    let idc = 1;
    const analysis = analyzeSquad(gs, gs.club.id);
    const clubStrength = gs.clubs.find(c => c.id === gs.club.id).strength || 55;

    for (const poste of POSTES) {
      const info = analysis[poste];

      // SORTANT : surplus au poste -> un club veut emprunter notre
      // joueur le plus faible du poste (pour lui donner du temps de jeu).
      if (info.count > MIN_PER_POSTE[poste] && info.players.length) {
        const weakest = info.players.slice().sort((a, b) => a.level - b.level)[0];
        if (weakest) {
          gs.transfers.loans.push({
            id: "L" + (idc++), dir: "out", poste,
            player: _publicPlayer(weakest), playerId: weakest.id,
            wage: FinanceManager.playerSalary(weakest.level),
            fromClub: _randomOtherClubName(gs),
            // Part que le club d'accueil PROPOSE de prendre (à négocier).
            offeredShare: _pick([0, 30, 50]),
            status: "open",
          });
        }
      }

      // ENTRANT : manque au poste -> un joueur prêté nous est proposé.
      if (info.count <= MIN_PER_POSTE[poste]) {
        const p = _makeProspect(poste, clubStrength + _rand(-2, 8));
        gs.transfers.loans.push({
          id: "L" + (idc++), dir: "in", poste,
          player: p,
          wage: FinanceManager.playerSalary(p.level),
          fromClub: _randomOtherClubName(gs),
          // Part que le club propriétaire DEMANDE qu'on prenne.
          askShare: _pick([50, 75, 100]),
          status: "open",
        });
      }
    }
    return gs.transfers.loans;
  }

  /* Ferme le marché (fin de mercato) : plus d'offres actives. */
  function closeWindow(gs) {
    gs.transfers = gs.transfers || {};
    gs.transfers.offers = [];
    gs.transfers.window = false;
  }

  /* --- NÉGOCIATION D'ACHAT (double : club puis joueur) ---
     Étape club : proposer un prix. Le club vendeur accepte si l'offre
     est >= ~92% du prix demandé, sinon fait une contre-proposition. */
  function negotiateClub(offer, proposedPrice) {
    const ask = offer.askPrice;
    if (proposedPrice >= ask * 0.92) {
      offer.agreedPrice = _round(Math.max(proposedPrice, ask * 0.92));
      offer.clubDeal = true;
      return { ok: true, agreedPrice: offer.agreedPrice };
    }
    // Contre-proposition à mi-chemin.
    const counter = _round((proposedPrice + ask) / 2);
    return { ok: false, counter };
  }

  /* Étape joueur : proposer salaire + durée ensemble. Le joueur accepte
     si le salaire est >= ~95% de sa demande. Une durée plus courte que
     souhaitée exige un petit surplus de salaire (compensation). */
  function negotiatePlayer(offer, proposedWage, proposedYears) {
    const wantWage = offer.askWage;
    const wantYears = offer.askYears;
    // Seuil de salaire requis : relevé si la durée est plus courte.
    let threshold = wantWage * 0.95;
    if (proposedYears < wantYears) {
      threshold = wantWage * (0.95 + 0.08 * (wantYears - proposedYears));
    }
    if (proposedWage >= threshold && proposedYears >= 1) {
      offer.agreedWage = _round(proposedWage);
      offer.agreedYears = proposedYears;
      offer.playerDeal = true;
      return { ok: true };
    }
    const counter = _round(threshold);
    return { ok: false, counterWage: counter };
  }

  /* Finalise un ACHAT : débite le prix, ajoute le joueur à l'effectif. */
  function finalizeBuy(gs, offer) {
    if (!offer.clubDeal || !offer.playerDeal) return { ok: false, reason: "negociation" };
    if (offer.agreedPrice > gs.club.cash) return { ok: false, reason: "cash" };

    FinanceManager.record(gs, gs.time.currentDate,
      `Achat ${offer.player.name}`, -offer.agreedPrice);

    const np = offer.player;
    np.id = _nextPlayerId(gs);
    np.clubId = gs.club.id;
    np.forme = 50;
    gs.players.push(np);

    offer.status = "done";
    return { ok: true, player: np };
  }

  /* --- VENTE ---
     Accepter une offre de vente : créditer le prix, retirer le joueur. */
  function acceptSell(gs, offer) {
    const idx = gs.players.findIndex(p => p.id === offer.playerId);
    if (idx === -1) return { ok: false, reason: "introuvable" };

    FinanceManager.record(gs, gs.time.currentDate,
      `Vente ${offer.player.name}`, offer.bidPrice);
    gs.players.splice(idx, 1);
    offer.status = "done";
    return { ok: true, amount: offer.bidPrice };
  }

  function rejectOffer(gs, offer) { offer.status = "rejected"; }

  /* Négociation du prix de VENTE : le club acheteur accepte si le prix
     demandé ne dépasse pas ~110% de son offre initiale ; sinon il fait
     une contre-proposition à mi-chemin. */
  function negotiateSell(offer, askedPrice) {
    const bid = offer.baseBid !== undefined ? offer.baseBid : offer.bidPrice;
    if (offer.baseBid === undefined) offer.baseBid = bid;
    if (askedPrice <= bid * 1.10) {
      offer.bidPrice = _round(Math.min(askedPrice, bid * 1.10));
      offer.sellAgreed = true;
      return { ok: true, price: offer.bidPrice };
    }
    const counter = _round((askedPrice + bid) / 2);
    return { ok: false, counter };
  }

  /* --- PRÊTS : négociation de la part de salaire --- */
  const SHARES = [0, 30, 50, 75, 100];

  /* Prêt SORTANT : on propose la part que le club d'accueil doit payer.
     Il accepte si on ne demande pas plus que ce qu'il offrait +25 pts. */
  function negotiateLoanOut(loan, requestedShare) {
    if (requestedShare <= loan.offeredShare + 25) {
      loan.agreedShare = requestedShare;
      loan.dealDone = true;
      return { ok: true, share: requestedShare };
    }
    const counter = Math.min(100, loan.offeredShare + 25);
    return { ok: false, counter };
  }

  /* Prêt ENTRANT : on propose la part qu'on accepte de payer. Le club
     propriétaire accepte si on prend au moins sa demande -25 pts. */
  function negotiateLoanIn(loan, acceptedShare) {
    if (acceptedShare >= loan.askShare - 25) {
      loan.agreedShare = acceptedShare;
      loan.dealDone = true;
      return { ok: true, share: acceptedShare };
    }
    const counter = Math.max(0, loan.askShare - 25);
    return { ok: false, counter };
  }

  /* Finalise un prêt SORTANT : le joueur quitte l'effectif pour 1 saison.
     On mémorise pour le retour en fin de saison. La part de salaire prise
     par l'autre club allège notre masse salariale (géré au calcul finances). */
  function finalizeLoanOut(gs, loan) {
    if (!loan.dealDone) return { ok: false, reason: "negociation" };
    const idx = gs.players.findIndex(p => p.id === loan.playerId);
    if (idx === -1) return { ok: false, reason: "introuvable" };
    const player = gs.players[idx];
    gs.transfers.active = gs.transfers.active || [];
    gs.transfers.active.push({
      dir: "out", player: structuredClone(player),
      share: loan.agreedShare, toClub: loan.fromClub,
      returnSeason: gs.time.season + 1,
    });
    gs.players.splice(idx, 1);
    loan.status = "done";
    return { ok: true, player };
  }

  /* Finalise un prêt ENTRANT : le joueur rejoint l'effectif 1 saison.
     La part de salaire qu'on prend s'ajoutera à nos salaires. */
  function finalizeLoanIn(gs, loan) {
    if (!loan.dealDone) return { ok: false, reason: "negociation" };
    const np = loan.player;
    np.id = _nextPlayerId(gs);
    np.clubId = gs.club.id;
    np.forme = 50;
    np.onLoan = true;                 // joueur prêté chez nous
    np.loanShare = loan.agreedShare;  // part de salaire qu'on paie
    np.loanFrom = loan.fromClub;
    np.returnSeason = gs.time.season + 1;
    gs.players.push(np);
    gs.transfers.active = gs.transfers.active || [];
    gs.transfers.active.push({
      dir: "in", playerId: np.id, player: _publicPlayer(np),
      share: loan.agreedShare, fromClub: loan.fromClub,
      returnSeason: gs.time.season + 1,
    });
    loan.status = "done";
    return { ok: true, player: np };
  }

  /* Traite les retours de prêts en fin de saison. Renvoie un récap. */
  function processLoanReturns(gs) {
    const active = gs.transfers.active || [];
    const returned = { in: [], out: [] };
    const stillActive = [];
    for (const l of active) {
      if (l.returnSeason <= gs.time.season + 1) {
        if (l.dir === "in") {
          // Le joueur prêté chez nous repart : le retirer de l'effectif.
          const idx = gs.players.findIndex(p => p.id === l.playerId);
          if (idx !== -1) gs.players.splice(idx, 1);
          returned.in.push(l.player.name);
        } else {
          // Notre joueur revient : le réintégrer.
          l.player.onLoan = false;
          l.player.clubId = gs.club.id;
          gs.players.push(l.player);
          returned.out.push(l.player.name);
        }
      } else {
        stillActive.push(l);
      }
    }
    gs.transfers.active = stillActive;
    return returned;
  }

  /* Part de salaire des prêts à AJOUTER/RETRANCHER à la masse salariale.
     Prêts entrants : on paie loanShare% de leur salaire (déjà dans
     l'effectif). Prêts sortants : on économise (100-share)% — mais le
     joueur n'est plus dans l'effectif, donc rien à soustraire de plus. */
  function loanWageAdjustment(gs) {
    // Les joueurs prêtés entrants sont dans gs.players : leur salaire
    // plein serait compté par annualWageBill. On corrige pour ne compter
    // que la part qu'on paie réellement.
    let adjust = 0;
    for (const p of gs.players) {
      if (p.onLoan && typeof p.loanShare === "number") {
        const full = FinanceManager.playerSalary(p.level);
        adjust -= full * (1 - p.loanShare / 100); // on retire la part non payée
      }
    }
    return _round(adjust);
  }

  /* --- Helpers --- */
  function _makeProspect(poste, targetLevel) {
    let level = Math.max(35, Math.min(90, targetLevel + _rand(-3, 3)));
    const age = _rand(18, 31);
    let margin;
    if (age <= 20) margin = _rand(6, 18);
    else if (age <= 24) margin = _rand(3, 10);
    else if (age <= 28) margin = _rand(0, 4);
    else margin = 0;
    return {
      name: _pick(PRENOMS) + " " + _pick(NOMS),
      poste, level, potential: Math.min(99, level + margin), age, forme: 50,
    };
  }
  function _publicPlayer(p) {
    return { name: p.name, poste: p.poste, level: p.level, age: p.age };
  }
  function _randomOtherClubName(gs) {
    const others = gs.clubs.filter(c => c.id !== gs.club.id);
    return others.length ? _pick(others).name : "Club étranger";
  }
  function _nextPlayerId(gs) {
    let max = 0;
    for (const p of gs.players) if (p.id > max) max = p.id;
    return max + 1;
  }

  return {
    marketValue, analyzeSquad, generateOffers, generateLoanOffers, tickMarket, closeWindow,
    negotiateClub, negotiatePlayer, negotiateSell, finalizeBuy, acceptSell, rejectOffer,
    negotiateLoanOut, negotiateLoanIn, finalizeLoanOut, finalizeLoanIn,
    processLoanReturns, loanWageAdjustment,
    MIN_PER_POSTE, SHARES,
  };
})();

window.TransferManager = TransferManager;
