/* ============================================================
   ui/app.js — Interface (Phase 1)
   ------------------------------------------------------------
   Le Bureau + le classement + l'écran de match (fil d'événements
   avec bouton "Simuler"). Boucle de saison jouable.
   ============================================================ */

(function () {
  const $ = (sel) => document.querySelector(sel);
  const round2 = (x) => Math.round(x * 100) / 100;

  const setupEl = $("#setup");
  const gameEl = $("#game");
  const logEl = $("#log");
  const matchEl = $("#matchScreen");
  const homeEl = $("#home");
  const bilanEl = $("#bilanScreen");

  let pendingMatch = null; // match du joueur en attente d'affichage
  let pendingSlot = 1;     // slot ciblé pour une nouvelle partie
  let matchJustFinished = false; // vrai juste après un match, pour le retour Bureau
  let objChoiceState = {};       // choix d'ambition des objectifs en cours
  let skipAfterCamp = false;     // vrai si "Pré-saison ⏭" attend le choix du stage

  /* --- Rendu du Bureau --- */
  function render(report) {
    const gs = GameEngine.getState();
    if (!gs) return;

    // Barre d'action selon la phase (saison ou intersaison).
    const phase = gs.time.phase || "season";
    const btnContinue = $("#btnContinue");
    const btnWeek = $("#btnWeek");
    const btnPreseason = $("#btnPreseason");
    $("#btnSimulate").classList.add("hidden");
    if (phase === "intersaison") {
      btnContinue.classList.add("hidden");
      btnWeek.classList.remove("hidden");
      btnPreseason.classList.remove("hidden");
    } else {
      btnContinue.classList.remove("hidden");
      btnWeek.classList.add("hidden");
      btnPreseason.classList.add("hidden");
    }

    $("#clubName").textContent = gs.club.name || "—";
    $("#reputation").textContent = labelRep(gs.president.reputation);
    $("#date").textContent = formatDate(gs.time.currentDate);
    $("#cash").textContent = gs.club.cash + " M";
    $("#confidence").textContent = gs.board.confidence + "/100";
    $("#season").textContent = "Saison " + gs.time.season;

    const badge = $("#mercatoBadge");
    const navTr = $("#navTransfers");
    if (phase === "intersaison") {
      badge.textContent = gs.time.inMercato ? "Pré-saison · Mercato" : "Intersaison";
      badge.classList.remove("off");
      // Le mercato d'été ouvre pendant la pré-saison : montrer Transferts.
      navTr.classList.toggle("hidden", !gs.time.inMercato);
    } else if (gs.time.inMercato) {
      badge.textContent = "Mercato ouvert"; badge.classList.remove("off");
      navTr.classList.remove("hidden");
    } else {
      badge.textContent = "Hors mercato"; badge.classList.add("off");
      navTr.classList.add("hidden");
    }

    // Pastille de notification sur l'onglet Transferts : nombre d'offres
    // ouvertes en attente d'une décision du président.
    const notif = $("#trNotif");
    if (notif) {
      const openOffers = (gs.transfers && gs.transfers.offers || [])
        .filter(o => o.status === "open").length;
      const openLoans = (gs.transfers && gs.transfers.loans || [])
        .filter(l => l.status === "open").length;
      const totalOpen = openOffers + openLoans;
      if (gs.time.inMercato && totalOpen > 0) {
        notif.textContent = totalOpen;
        notif.classList.remove("hidden");
      } else {
        notif.classList.add("hidden");
      }
    }

    if (report) addLogLine(report);

    // Cadre "prochain match" (masqué en intersaison).
    const nmCard = $("#nextMatchCard");
    const nm = $("#nextMatch");
    if (phase === "intersaison") {
      nmCard.classList.add("hidden");
    } else {
      nmCard.classList.remove("hidden");
      const next = WorldManager.getNextPlayerMatch(gs);
      if (next) {
        const lieu = next.isHome ? "à domicile" : "à l'extérieur";
        nm.innerHTML =
          `<span class="nm-opp">${next.opponent}</span>` +
          `<span class="nm-info">${lieu} · ${formatDate(next.date)} · J${next.matchday + 1}</span>`;
      } else {
        nm.textContent = "Aucun match à venir cette saison.";
      }
    }

    // Suivi des objectifs du Board.
    const objCard = $("#objCard");
    const tracker = $("#objTracker");
    if (gs.board && gs.board.objectivesSet && gs.board.objectives.length && phase === "season") {
      objCard.classList.remove("hidden");
      tracker.innerHTML = "";
      for (const obj of gs.board.objectives) {
        const val = BoardManager.currentValue(gs, obj.key);
        const onTrack = BoardManager.isMet(obj.key, val, obj.target);
        let valStr;
        if (obj.key === "sportif") valStr = val ? `${val}ᵉ` : "—";
        else if (obj.key === "attaque") valStr = `${val} buts`;
        else valStr = `${val} M`;
        const row = document.createElement("div");
        row.className = "obj-track-row";
        row.innerHTML =
          `<span class="ot-status ${onTrack ? "ok" : "no"}">${onTrack ? "✓" : "•"}</span>` +
          `<span class="ot-label">${obj.levelLabel} — ${obj.desc}</span>` +
          `<span class="ot-val ${onTrack ? "ok" : ""}">${valStr}</span>`;
        tracker.appendChild(row);
      }
    } else {
      objCard.classList.add("hidden");
    }
  }

  /* --- Classement (rendu dans une table cible) --- */
  function renderStandingsInto(selector) {
    const gs = GameEngine.getState();
    if (!gs || !gs.world || !gs.world.standings) return;
    const rows = WorldManager.getStandings(gs);
    const body = $(selector);
    body.innerHTML = "";
    for (const r of rows) {
      const tr = document.createElement("tr");
      if (r.isPlayer) tr.className = "me";
      tr.innerHTML =
        `<td>${r.rank}</td>` +
        `<td class="tname">${r.name}</td>` +
        `<td>${r.played}</td>` +
        `<td>${r.won}-${r.drawn}-${r.lost}</td>` +
        `<td>${r.gf - r.ga >= 0 ? "+" : ""}${r.gf - r.ga}</td>` +
        `<td class="pts">${r.points}</td>`;
      body.appendChild(tr);
    }
  }

  /* --- Calendrier regroupé par mois --- */
  function renderCalendar() {
    const gs = GameEngine.getState();
    const body = $("#calendarBody");
    body.innerHTML = "";

    const MOIS = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    // 1. Rassembler tous les éléments datés : matchs, mercato, fin de saison.
    const items = [];

    // Matchs du joueur.
    const cal = WorldManager.getPlayerCalendar(gs);
    for (const m of cal) {
      if (!m.date) continue;
      items.push({
        date: m.date,
        kind: "match",
        played: m.played,
        text: m.isHome ? `vs ${m.opponent} (dom.)` : `à ${m.opponent} (ext.)`,
        score: m.played && m.result
          ? (m.isHome
              ? `${m.result.homeGoals}-${m.result.awayGoals}`
              : `${m.result.awayGoals}-${m.result.homeGoals}`)
          : null,
      });
    }

    // Fenêtres de mercato (été : juil-août ; hiver : janvier) de la saison.
    // On repère l'année de la saison à partir du 1er match.
    const firstDate = cal.find(m => m.date)?.date;
    if (firstDate) {
      const y = Number(firstDate.split("-")[0]);
      items.push({ date: `${y}-07-01`, kind: "mercato", text: "Ouverture du mercato d'été" });
      items.push({ date: `${y}-08-31`, kind: "mercato", text: "Fermeture du mercato d'été" });
      items.push({ date: `${y + 1}-01-01`, kind: "mercato", text: "Ouverture du mercato d'hiver" });
      items.push({ date: `${y + 1}-01-31`, kind: "mercato", text: "Fermeture du mercato d'hiver" });
    }

    // Fin de saison.
    if (gs.world.seasonEndDate) {
      items.push({ date: gs.world.seasonEndDate, kind: "end", text: "Fin de saison" });
    }

    // 2. Trier par date et regrouper par mois (année-mois).
    items.sort((a, b) => CalendarManager.compare(a.date, b.date));
    const curYM = gs.time.currentDate.slice(0, 7);

    let currentGroup = null;
    let groupEl = null;
    for (const it of items) {
      const ym = it.date.slice(0, 7);
      if (ym !== currentGroup) {
        currentGroup = ym;
        const [yy, mm] = ym.split("-");
        const header = document.createElement("div");
        header.className = "cal-month" + (ym === curYM ? " current" : "");
        header.textContent = `${MOIS[Number(mm)]} ${yy}` + (ym === curYM ? "  • en cours" : "");
        body.appendChild(header);
        groupEl = document.createElement("div");
        groupEl.className = "cal-items";
        body.appendChild(groupEl);
      }
      const row = document.createElement("div");
      row.className = "cal-row " + it.kind + (it.played ? " played" : "");
      const day = Number(it.date.split("-")[2]);
      let icon = it.kind === "match" ? "⚽" : it.kind === "mercato" ? "🔁" : "🏁";
      let right = "";
      if (it.kind === "match" && it.played) right = `<span class="cal-score">${it.score}</span>`;
      row.innerHTML =
        `<span class="cal-day">${day}</span>` +
        `<span class="cal-icon">${icon}</span>` +
        `<span class="cal-text">${it.text}</span>` +
        right;
      groupEl.appendChild(row);
    }

    if (items.length === 0) {
      body.innerHTML = `<p class="soon">Aucun événement au calendrier pour le moment.</p>`;
    }
  }

  /* --- Écran Marché des transferts --- */
  function renderTransfers() {
    const gs = GameEngine.getState();
    $("#trCash").textContent = gs.club.cash + " M";
    const wrap = $("#trOffers");
    wrap.innerHTML = "";

    const offers = (gs.transfers && gs.transfers.offers) || [];
    const open = offers.filter(o => o.status === "open");
    if (!gs.time.inMercato) {
      wrap.innerHTML = `<p class="soon">Le marché est fermé. Les offres arrivent pendant les mercatos (été et hiver).</p>`;
      return;
    }

    // Séparer achats et ventes.
    const buys = open.filter(o => o.type === "buy");
    const sells = open.filter(o => o.type === "sell");

    if (buys.length) {
      const h = document.createElement("h3");
      h.className = "tr-h3"; h.textContent = "Joueurs proposés (achats)";
      wrap.appendChild(h);
      for (const o of buys) wrap.appendChild(buildBuyCard(gs, o));
    }
    if (sells.length) {
      const h = document.createElement("h3");
      h.className = "tr-h3"; h.textContent = "Offres pour vos joueurs (ventes)";
      wrap.appendChild(h);
      for (const o of sells) wrap.appendChild(buildSellCard(gs, o));
    }

    // --- Prêts ---
    const loans = ((gs.transfers && gs.transfers.loans) || []).filter(l => l.status === "open");
    const loansIn = loans.filter(l => l.dir === "in");
    const loansOut = loans.filter(l => l.dir === "out");
    if (loansIn.length) {
      const h = document.createElement("h3");
      h.className = "tr-h3"; h.textContent = "Joueurs proposés en prêt (entrants)";
      wrap.appendChild(h);
      for (const l of loansIn) wrap.appendChild(buildLoanInCard(gs, l));
    }
    if (loansOut.length) {
      const h = document.createElement("h3");
      h.className = "tr-h3"; h.textContent = "Demandes de prêt pour vos joueurs (sortants)";
      wrap.appendChild(h);
      for (const l of loansOut) wrap.appendChild(buildLoanOutCard(gs, l));
    }

    if (open.length === 0 && loans.length === 0) {
      wrap.innerHTML = `<p class="soon">Aucune offre en cours pour le moment.</p>`;
    }
  }

  const posteNomMap = { G: "Gardien", D: "Défenseur", M: "Milieu", A: "Attaquant" };

  function buildLoanInCard(gs, l) {
    const card = document.createElement("div");
    card.className = "tr-card loan";
    const p = l.player;
    let status = l.dealDone ? `<div class="tr-ok">Accord : vous prenez ${l.agreedShare}% du salaire — prêt à finaliser</div>` : "";
    card.innerHTML =
      `<div class="tr-name">${p.name} <span class="tr-tag">PRÊT</span></div>` +
      `<div class="tr-meta">${posteNomMap[p.poste]} · ${p.age} ans · niveau ${p.level}</div>` +
      `<div class="tr-meta">Proposé par ${l.fromClub} · salaire ${l.wage} M/an</div>` +
      `<div class="tr-meta">Ils demandent que vous preniez <b>${l.askShare}%</b> du salaire</div>` +
      status;
    const actions = document.createElement("div");
    actions.className = "tr-actions";
    if (!l.dealDone) {
      const b = document.createElement("button");
      b.className = "primary small"; b.textContent = "Négocier la part";
      b.onclick = () => negotiateLoanInUI(l);
      actions.appendChild(b);
    } else {
      const b = document.createElement("button");
      b.className = "primary small"; b.textContent = "Finaliser le prêt";
      b.onclick = () => {
        const r = TransferManager.finalizeLoanIn(gs, l);
        if (r.ok) addLogLine({ date: gs.time.currentDate, label: `Prêt entrant : ${p.name} (${l.agreedShare}% du salaire)` });
        saveAndRefreshTransfers();
      };
      actions.appendChild(b);
    }
    const bR = document.createElement("button");
    bR.className = "ghost small"; bR.textContent = "Refuser";
    bR.onclick = () => { TransferManager.rejectOffer(gs, l); saveAndRefreshTransfers(); };
    actions.appendChild(bR);
    card.appendChild(actions);
    return card;
  }

  function buildLoanOutCard(gs, l) {
    const card = document.createElement("div");
    card.className = "tr-card loan";
    const p = l.player;
    let status = l.dealDone ? `<div class="tr-ok">Accord : ${l.fromClub} prend ${l.agreedShare}% du salaire — prêt à finaliser</div>` : "";
    card.innerHTML =
      `<div class="tr-name">${p.name} <span class="tr-tag">PRÊT</span></div>` +
      `<div class="tr-meta">${posteNomMap[p.poste]} · ${p.age} ans · niveau ${p.level}</div>` +
      `<div class="tr-meta">${l.fromClub} veut l'emprunter · salaire ${l.wage} M/an</div>` +
      `<div class="tr-meta">Ils proposent de prendre <b>${l.offeredShare}%</b> du salaire</div>` +
      status;
    const actions = document.createElement("div");
    actions.className = "tr-actions";
    if (!l.dealDone) {
      const b = document.createElement("button");
      b.className = "primary small"; b.textContent = "Négocier la part";
      b.onclick = () => negotiateLoanOutUI(l);
      actions.appendChild(b);
    } else {
      const b = document.createElement("button");
      b.className = "primary small"; b.textContent = "Finaliser le prêt";
      b.onclick = () => {
        const r = TransferManager.finalizeLoanOut(gs, l);
        if (r.ok) addLogLine({ date: gs.time.currentDate, label: `Prêt sortant : ${p.name} (${l.fromClub} paie ${l.agreedShare}%)` });
        saveAndRefreshTransfers();
      };
      actions.appendChild(b);
    }
    const bR = document.createElement("button");
    bR.className = "ghost small"; bR.textContent = "Refuser";
    bR.onclick = () => { TransferManager.rejectOffer(gs, l); saveAndRefreshTransfers(); };
    actions.appendChild(bR);
    card.appendChild(actions);
    return card;
  }

  function negotiateLoanInUI(l) {
    // On propose la part qu'on accepte de payer : 3 options croissantes.
    const opts = [Math.max(0, l.askShare - 50), Math.max(0, l.askShare - 25), l.askShare]
      .filter((v, i, a) => a.indexOf(v) === i);
    showNegotiation(
      `Ils demandent que vous preniez ${l.askShare}% du salaire (${l.wage} M/an)`,
      opts.map(share => ({
        label: `Prendre ${share}% du salaire`,
        onPick: () => {
          const r = TransferManager.negotiateLoanIn(l, share);
          if (r.ok) { toast(`Accord ! Vous prenez ${r.share}%.`); saveAndRefreshTransfers(); }
          else { toast(`Refusé (ils veulent ≥ ${r.counter}%). Réessayez.`); }
        },
      }))
    );
  }

  function negotiateLoanOutUI(l) {
    // On demande la part que le club d'accueil paie : 3 options croissantes.
    const opts = [l.offeredShare, Math.min(100, l.offeredShare + 25), Math.min(100, l.offeredShare + 50)]
      .filter((v, i, a) => a.indexOf(v) === i);
    showNegotiation(
      `Ils proposent de prendre ${l.offeredShare}% du salaire (${l.wage} M/an)`,
      opts.map(share => ({
        label: `Leur demander ${share}%`,
        onPick: () => {
          const r = TransferManager.negotiateLoanOut(l, share);
          if (r.ok) { toast(`Accord ! ${l.fromClub} prend ${r.share}%.`); saveAndRefreshTransfers(); }
          else { toast(`Refusé (ils prennent ≤ ${r.counter}%). Réessayez.`); }
        },
      }))
    );
  }

  /* Panneau de négociation générique : un titre + des boutons de choix.
     Reste ouvert après un refus pour permettre de réessayer. */
  function showNegotiation(title, choices) {
    $("#negTitle").textContent = title;
    const box = $("#negChoices");
    box.innerHTML = "";
    for (const c of choices) {
      const b = document.createElement("button");
      b.className = "primary neg-choice";
      b.textContent = c.label;
      b.onclick = c.onPick;
      box.appendChild(b);
    }
    $("#negModal").classList.remove("hidden");
  }

  function closeNegotiation() { $("#negModal").classList.add("hidden"); }

  /* Petit message éphémère (remplace les alertes bloquantes). */
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.add("hidden"), 2600);
  }

  function buildBuyCard(gs, o) {
    const card = document.createElement("div");
    card.className = "tr-card buy";
    const p = o.player;
    const posteNom = { G: "Gardien", D: "Défenseur", M: "Milieu", A: "Attaquant" };
    let status = "";
    if (o.clubDeal && o.playerDeal) status = `<div class="tr-ok">Accord total — prêt à finaliser (${o.agreedPrice} M)</div>`;
    else if (o.clubDeal) status = `<div class="tr-ok">Accord club à ${o.agreedPrice} M — reste le joueur</div>`;
    card.innerHTML =
      `<div class="tr-name">${p.name}</div>` +
      `<div class="tr-meta">${posteNom[p.poste]} · ${p.age} ans · niveau ${p.level}</div>` +
      `<div class="tr-meta">Vendeur : ${o.fromClub} · demande <b>${o.askPrice} M</b></div>` +
      `<div class="tr-meta">Salaire souhaité : ${o.askWage} M/an sur ${o.askYears} ans</div>` +
      status;
    const actions = document.createElement("div");
    actions.className = "tr-actions";
    // Négociation club (si pas encore d'accord club).
    if (!o.clubDeal) {
      const bNeg = document.createElement("button");
      bNeg.className = "primary small";
      bNeg.textContent = "Négocier le prix";
      bNeg.onclick = () => negotiateBuyClub(o);
      actions.appendChild(bNeg);
    } else if (!o.playerDeal) {
      const bP = document.createElement("button");
      bP.className = "primary small";
      bP.textContent = "Négocier le salaire";
      bP.onclick = () => negotiateBuyPlayer(o);
      actions.appendChild(bP);
    } else {
      const bF = document.createElement("button");
      bF.className = "primary small";
      bF.textContent = "Finaliser l'achat";
      bF.onclick = () => finalizeBuy(o);
      actions.appendChild(bF);
    }
    const bR = document.createElement("button");
    bR.className = "ghost small";
    bR.textContent = "Refuser";
    bR.onclick = () => { TransferManager.rejectOffer(gs, o); saveAndRefreshTransfers(); };
    actions.appendChild(bR);
    card.appendChild(actions);
    return card;
  }

  function buildSellCard(gs, o) {
    const card = document.createElement("div");
    card.className = "tr-card sell";
    const p = o.player;
    const posteNom = { G: "Gardien", D: "Défenseur", M: "Milieu", A: "Attaquant" };
    card.innerHTML =
      `<div class="tr-name">${p.name}</div>` +
      `<div class="tr-meta">${posteNom[p.poste]} · ${p.age} ans · niveau ${p.level}</div>` +
      `<div class="tr-meta">${o.fromClub} propose <b>${o.bidPrice} M</b></div>` +
      (o.sellAgreed ? `<div class="tr-ok">Prix négocié : ${o.bidPrice} M</div>` : "");
    const actions = document.createElement("div");
    actions.className = "tr-actions";
    // Négocier le prix (demander plus).
    const bN = document.createElement("button");
    bN.className = "primary small";
    bN.textContent = "Négocier le prix";
    bN.onclick = () => negotiateSellPrice(o);
    actions.appendChild(bN);
    // Vendre au prix courant.
    const bA = document.createElement("button");
    bA.className = "primary small";
    bA.textContent = `Vendre (+${o.bidPrice} M)`;
    bA.onclick = () => {
      const r = TransferManager.acceptSell(gs, o);
      if (r.ok) { addLogLine({ date: gs.time.currentDate, label: `Vente de ${p.name} (+${r.amount} M)` }); }
      saveAndRefreshTransfers();
    };
    actions.appendChild(bA);
    const bR = document.createElement("button");
    bR.className = "ghost small";
    bR.textContent = "Refuser";
    bR.onclick = () => { TransferManager.rejectOffer(gs, o); saveAndRefreshTransfers(); };
    actions.appendChild(bR);
    card.appendChild(actions);
    return card;
  }

  /* Négociation du prix de vente : 3 contre-propositions (demander plus). */
  function negotiateSellPrice(o) {
    const base = o.baseBid !== undefined ? o.baseBid : o.bidPrice;
    const choices = [
      { label: `Demander ${round2(base * 1.05)} M (+5%)`, value: round2(base * 1.05) },
      { label: `Demander ${round2(base * 1.10)} M (+10%)`, value: round2(base * 1.10) },
      { label: `Demander ${round2(base * 1.20)} M (+20%)`, value: round2(base * 1.20) },
    ];
    showNegotiation(
      `${o.fromClub} propose ${base} M pour ${o.player.name}`,
      choices.map(c => ({
        label: c.label,
        onPick: () => {
          const r = TransferManager.negotiateSell(o, c.value);
          if (r.ok) { toast(`Accord ! Le club monte à ${r.price} M.`); saveAndRefreshTransfers(); }
          else { toast(`Refusé (ils ne dépassent pas ${r.counter} M). Réessayez ou vendez au prix.`); }
        },
      }))
    );
  }

  /* Négociation du prix (club vendeur) : 3 propositions au choix. */
  function negotiateBuyClub(o) {
    const ask = o.askPrice;
    const choices = [
      { label: "Offre basse", pct: 80, value: round2(ask * 0.80) },
      { label: "Offre correcte", pct: 92, value: round2(ask * 0.92) },
      { label: "Prix plein", pct: 100, value: ask },
    ];
    showNegotiation(
      `Prix demandé : ${ask} M`,
      choices.map(c => ({
        label: `${c.label} — ${c.value} M (${c.pct}%)`,
        onPick: () => {
          const r = TransferManager.negotiateClub(o, c.value);
          if (r.ok) {
            toast(`Accord trouvé à ${r.agreedPrice} M !`);
            saveAndRefreshTransfers();
          } else if (r.broken) {
            // Le club vendeur, excédé, met fin aux négociations : l'offre
            // passe en "broken" et disparaît de la liste au rafraîchissement.
            toast(`💢 ${o.fromClub} claque la porte : négociation rompue pour ${o.player.name}.`);
            saveAndRefreshTransfers();
          } else {
            const warn = r.loweredBid
              ? " 😠 Offrir moins les vexe !"
              : (r.annoyed ? " ⚠️ Ils commencent à s'agacer." : "");
            toast(`Refusé (le club veut ${r.counter} M).${warn} Réessayez.`);
          }
        },
      }))
    );
  }

  /* Négociation salaire + durée (joueur) : 3 combinaisons au choix. */
  function negotiateBuyPlayer(o) {
    const want = o.askWage;
    const years = o.askYears;
    // 3 combinaisons : salaire demandé sur durée demandée ; salaire un
    // peu plus élevé mais contrat plus court ; salaire correct, durée demandée.
    const combos = [
      { wage: want, years: years, label: `${want} M/an · ${years} ans (demandé)` },
      { wage: round2(want * 0.95), years: years, label: `${round2(want * 0.95)} M/an · ${years} ans (−5%)` },
      { wage: round2(want * 1.1), years: Math.max(1, years - 1), label: `${round2(want * 1.1)} M/an · ${Math.max(1, years - 1)} ans (court, +10%)` },
    ];
    showNegotiation(
      `Le joueur souhaite ${want} M/an sur ${years} ans`,
      combos.map(c => ({
        label: c.label,
        onPick: () => {
          const r = TransferManager.negotiatePlayer(o, c.wage, c.years);
          if (r.ok) { toast(`Le joueur accepte (${c.wage} M/an, ${c.years} ans) ! Finalisez.`); saveAndRefreshTransfers(); }
          else { toast(`Refusé : il veut ~${r.counterWage} M/an pour cette durée. Réessayez.`); }
        },
      }))
    );
  }

  function finalizeBuy(o) {
    const gs = GameEngine.getState();
    const r = TransferManager.finalizeBuy(gs, o);
    if (!r.ok) {
      alert(r.reason === "cash" ? "Trésorerie insuffisante." : "Négociation incomplète.");
      return;
    }
    addLogLine({ date: gs.time.currentDate, label: `Achat de ${o.player.name} (-${o.agreedPrice} M)` });
    saveAndRefreshTransfers();
  }

  function saveAndRefreshTransfers() {
    const gs = GameEngine.getState();
    Storage.saveSlot(GameEngine.getSlot(), gs).catch(e => console.error(e));
    closeNegotiation();
    renderTransfers();
  }

  /* --- Écran Staff EN POSTE (consultation + licenciement) --- */
  function stars(n) { return "★".repeat(n) + "☆".repeat(5 - n); }

  function renderStaff() {
    const gs = GameEngine.getState();
    StaffManager.init(gs);
    $("#staffCash").textContent = gs.club.cash + " M";
    $("#staffWages").textContent = StaffManager.annualStaffWages(gs) + " M";
    const wrap = $("#staffList");
    wrap.innerHTML = "";

    for (const role of StaffManager.ROLES) {
      const cap = StaffManager.ROLE_CAP[role];
      const mem = StaffManager.members(gs, role);
      const block = document.createElement("div");
      block.className = "staff-block";

      let body = `<div class="staff-role">${StaffManager.ROLE_LABEL[role]} ` +
        `<span class="staff-count">${mem.length}/${cap}</span></div>`;
      if (mem.length === 0) {
        body += `<div class="staff-cur"><span class="staff-vacant">` +
          `Poste vacant — Intérimaire (${stars(1)})</span></div>`;
      } else {
        for (const m of mem) {
          const styleTxt = (role === "coach" && m.style)
            ? ` · <b>${StaffManager.STYLE_LABEL[m.style]}</b>` : "";
          body += `<div class="staff-cur"><span class="staff-holder">` +
            `${m.name} · ${stars(m.stars)}${styleTxt} · ${m.salary} M/an</span></div>`;
        }
      }
      block.innerHTML = body;

      // Un bouton "Licencier" par titulaire en poste.
      if (mem.length) {
        const actions = document.createElement("div");
        actions.className = "tr-actions";
        mem.forEach((m, idx) => {
          const bFire = document.createElement("button");
          bFire.className = "ghost small";
          bFire.textContent = mem.length > 1
            ? `Licencier ${m.name.split(" ")[0]}` : "Licencier";
          bFire.onclick = () => {
            StaffManager.dismiss(gs, role, idx);
            Storage.saveSlot(GameEngine.getSlot(), gs).catch(e => console.error(e));
            renderStaff();
          };
          actions.appendChild(bFire);
        });
        block.appendChild(actions);
      }
      wrap.appendChild(block);
    }
  }

  /* --- Écran RECRUTER DU STAFF (postes libres + candidats) --- */
  function renderStaffHire() {
    const gs = GameEngine.getState();
    StaffManager.init(gs);
    $("#staffHireCash").textContent = gs.club.cash + " M";
    const wrap = $("#staffHireBody");
    wrap.innerHTML = "";

    for (const role of StaffManager.ROLES) {
      const cap = StaffManager.ROLE_CAP[role];
      const cnt = StaffManager.count(gs, role);
      const full = cnt >= cap;
      const block = document.createElement("div");
      block.className = "staff-block";
      block.innerHTML =
        `<div class="staff-role">${StaffManager.ROLE_LABEL[role]} ` +
        `<span class="staff-count">${cnt}/${cap}</span></div>` +
        (full ? `<div class="staff-cur staff-vacant">Effectif complet à ce poste.</div>` : "");
      if (!full) {
        const actions = document.createElement("div");
        actions.className = "tr-actions";
        const bVoir = document.createElement("button");
        bVoir.className = "primary small";
        bVoir.textContent = "Voir les candidats";
        bVoir.onclick = () => openStaffCandidates(role);
        actions.appendChild(bVoir);
        block.appendChild(actions);
      }
      wrap.appendChild(block);
    }
  }

  /* Liste de candidats à comparer pour un poste (dans la modale). */
  function openStaffCandidates(role) {
    const gs = GameEngine.getState();
    if (!StaffManager.canHire(gs, role)) { toast("Effectif complet à ce poste."); return; }
    const candidates = StaffManager.generateCandidates(gs, role, 4);
    $("#negTitle").textContent = `Recruter — ${StaffManager.ROLE_LABEL[role]} (max ${StaffManager.starCap(gs)}★ pour votre réputation)`;
    const box = $("#negChoices");
    box.innerHTML = "";
    for (const c of candidates) {
      const b = document.createElement("button");
      b.className = "primary neg-choice";
      const styleTxt = (role === "coach" && c.style) ? ` · ${StaffManager.STYLE_LABEL[c.style]}` : "";
      b.innerHTML = `<b>${c.name}</b> — ${stars(c.stars)}${styleTxt} · ${c.salary} M/an`;
      b.onclick = () => {
        const res = StaffManager.hire(gs, c);
        if (!res.ok) { toast("Effectif complet à ce poste."); return; }
        addLogLine({ date: gs.time.currentDate, label: `${StaffManager.ROLE_LABEL[role]} recruté : ${c.name} (${c.stars}★)` });
        Storage.saveSlot(GameEngine.getSlot(), gs).catch(e => console.error(e));
        closeNegotiation();
        renderStaffHire();
      };
      box.appendChild(b);
    }
    $("#negModal").classList.remove("hidden");
  }

  /* --- Écran Finances --- */
  function renderFinances() {
    const gs = GameEngine.getState();
    FinanceManager.init(gs);
    $("#finCash").textContent = gs.club.cash + " M";
    $("#finWages").textContent = FinanceManager.annualWageBill(gs) + " M";
    $("#finIncome").textContent = (gs.finance.seasonIncome || 0) + " M";
    $("#finExpense").textContent = (gs.finance.seasonExpense || 0) + " M";

    // Projection de fin de saison.
    const proj = FinanceManager.projectSeasonEnd(gs);
    const projEl = $("#finProjection");
    const sign = proj.projected >= 0 ? "pos" : "neg";
    projEl.innerHTML =
      `<div class="proj-row"><span>Trésorerie actuelle</span><b>${proj.cash} M</b></div>` +
      `<div class="proj-row"><span>Billetterie à venir (${proj.homeMatchesLeft} matchs domicile)</span><b class="pos">+${proj.gateLeft} M</b></div>` +
      (proj.tvLeft > 0 ? `<div class="proj-row"><span>Droits TV à venir</span><b class="pos">+${proj.tvLeft} M</b></div>` : "") +
      `<div class="proj-row"><span>Salaires annuels à payer</span><b class="neg">-${proj.wages} M</b></div>` +
      `<div class="proj-total"><span>Projection fin de saison</span><b class="${sign}">${proj.projected} M</b></div>`;

    const led = $("#finLedger");
    led.innerHTML = "";
    const items = (gs.finance.ledger || []).slice().reverse().slice(0, 20);
    if (items.length === 0) {
      led.innerHTML = `<li class="empty">Aucune opération pour le moment.</li>`;
      return;
    }
    for (const op of items) {
      const li = document.createElement("li");
      const pos = op.amount >= 0;
      li.innerHTML =
        `<span class="led-date">${formatDate(op.date)}</span>` +
        `<span class="led-label">${op.label}</span>` +
        `<span class="led-amount ${pos ? "pos" : "neg"}">${pos ? "+" : ""}${op.amount} M</span>`;
      led.appendChild(li);
    }
  }

  function renderSquad() {
    const gs = GameEngine.getState();
    const body = $("#squadBody");
    body.innerHTML = "";
    const squad = gs.players
      .filter(p => p.clubId === gs.club.id)
      .sort((a, b) => b.level - a.level);
    const ordre = { G: 0, D: 1, M: 2, A: 3 };
    squad.sort((a, b) => (ordre[a.poste] - ordre[b.poste]) || (b.level - a.level));
    for (const p of squad) {
      const tr = document.createElement("tr");
      tr.className = "clickable";
      const styleLabel = { off: "Off", def: "Déf", eq: "Équi" }[p.style] || "—";
      const coach = StaffManager.coach(gs);
      const aligned = coach.style === p.style ? " ot-val ok" : "";
      tr.innerHTML =
        `<td>${p.poste}</td>` +
        `<td class="tname">${p.name}${p.onLoan ? ' <span class="tr-tag">PRÊT</span>' : ""}</td>` +
        `<td>${p.age}</td>` +
        `<td class="pts">${p.level}</td>` +
        `<td class="${aligned}">${styleLabel}</td>`;
      tr.addEventListener("click", () => openPlayerDetail(p));
      body.appendChild(tr);
    }
  }

  /* Fiche détaillée d'un joueur (Phase 1 : données de base). */
  function openPlayerDetail(p) {
    hideAll();
    const posteNom = { G: "Gardien", D: "Défenseur", M: "Milieu", A: "Attaquant" };
    const styleNom = { off: "Offensif", def: "Défensif", eq: "Équilibré" };
    $("#pdName").textContent = p.name;
    const st = p.stats || { apps: 0, goals: 0, assists: 0, cards: 0, cleansheets: 0 };
    let statsHtml =
      `<div class="pd-row"><span>Matchs joués</span><b>${st.apps}</b></div>` +
      `<div class="pd-row"><span>Buts</span><b>${st.goals}</b></div>` +
      `<div class="pd-row"><span>Passes décisives</span><b>${st.assists}</b></div>` +
      `<div class="pd-row"><span>Cartons</span><b>${st.cards}</b></div>`;
    if (p.poste === "G") {
      statsHtml += `<div class="pd-row"><span>Clean sheets</span><b>${st.cleansheets}</b></div>`;
    }
    $("#pdBody").innerHTML =
      `<div class="pd-row"><span>Poste</span><b>${posteNom[p.poste] || p.poste}</b></div>` +
      `<div class="pd-row"><span>Âge</span><b>${p.age} ans</b></div>` +
      `<div class="pd-row"><span>Niveau</span><b>${p.level}</b></div>` +
      `<div class="pd-row"><span>Style de jeu</span><b>${styleNom[p.style] || "—"}</b></div>` +
      (p.onLoan ? `<div class="pd-row"><span>Statut</span><b>En prêt (de ${p.loanFrom || "?"})</b></div>` : "") +
      `<h3 class="pd-stats-title">Statistiques de la saison</h3>` +
      statsHtml;
    $("#screenPlayer").classList.remove("hidden");
  }

  /* --- Journal --- */
  function addLogLine(report) {
    const empty = logEl.querySelector(".empty");
    if (empty) empty.remove();
    const li = document.createElement("li");
    li.innerHTML = `<span class="when">${formatDate(report.date)}</span>` +
                   `<span class="what">${report.label || "…"}</span>`;
    logEl.prepend(li);
    while (logEl.children.length > 12) logEl.removeChild(logEl.lastChild);
  }

  function labelRep(r) {
    return r === "legende" ? "Légende" : r === "confirme" ? "Confirmé" : "Amateur";
  }
  function formatDate(str) {
    if (!str) return "—";
    const [y, m, d] = str.split("-");
    const mois = ["", "janv.", "févr.", "mars", "avr.", "mai", "juin",
      "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    return `${Number(d)} ${mois[Number(m)]} ${y}`;
  }

  /* --- Écran de match : fil d'événements + Simuler --- */
  function openMatchScreen(playerMatch) {
    pendingMatch = playerMatch;
    const gs = GameEngine.getState();
    // Résoudre le match maintenant (résultat déjà calculé) ;
    // on déroule ensuite le fil, ou on saute au résultat.
    GameEngine.resolvePlayerMatch(playerMatch).then((result) => {
      showMatch(result);
    });
  }

  function showMatch(result) {
    gameEl.classList.add("hidden");
    matchEl.classList.remove("hidden");
    $("#actionbar").classList.remove("hidden");
    $("#matchTitle").textContent = `${result.homeName} — ${result.awayName}`;
    $("#matchScore").textContent = "0 - 0";
    const feedEl = $("#matchFeed");
    feedEl.innerHTML = "";

    // Pendant le match : seul "Simuler" est visible. "Continuer" et
    // les boutons d'intersaison sont cachés.
    const btnContinue = $("#btnContinue");
    const btnSimulate = $("#btnSimulate");
    $("#btnWeek").classList.add("hidden");
    $("#btnPreseason").classList.add("hidden");
    btnContinue.classList.add("hidden");
    btnSimulate.classList.remove("hidden");

    let i = 0;
    let timer = null;
    let finished = false;
    const feed = result.feed;

    function step() {
      if (i >= feed.length) { finishMatch(result); return; }
      const e = feed[i++];
      const li = document.createElement("li");
      li.textContent = e.text;
      feedEl.appendChild(li);
      feedEl.scrollTop = feedEl.scrollHeight;
      const mm = e.text.match(/\[(\d+)-(\d+)\]/);
      if (mm) $("#matchScore").textContent = `${mm[1]} - ${mm[2]}`;
    }

    // Déroulé automatique (1 ligne / 700ms)
    timer = setInterval(step, 700);

    // "Simuler" : saute directement au résultat final.
    btnSimulate.onclick = () => {
      clearInterval(timer);
      while (i < feed.length) {
        const e = feed[i++];
        const li = document.createElement("li");
        li.textContent = e.text;
        feedEl.appendChild(li);
      }
      $("#matchScore").textContent = `${result.homeGoals} - ${result.awayGoals}`;
      feedEl.scrollTop = feedEl.scrollHeight;
      finishMatch(result);
    };

    // Quand le match est fini : cacher "Simuler", remontrer "Continuer"
    // qui, cette fois, ferme l'écran de match et revient au Bureau.
    function finishMatch(res) {
      if (finished) return;
      finished = true;
      if (timer) clearInterval(timer);
      $("#matchScore").textContent = `${res.homeGoals} - ${res.awayGoals}`;
      btnSimulate.classList.add("hidden");
      btnContinue.classList.remove("hidden");
      // On passe en mode "match terminé" : le prochain clic sur
      // Continuer FERME le match et revient au Bureau, sans avancer
      // le temps (c'est onContinue qui vérifie ce drapeau).
      matchJustFinished = true;
    }
  }

  /* --- Navigation entre écrans --- */
  function hideAll() {
    homeEl.classList.add("hidden");
    setupEl.classList.add("hidden");
    matchEl.classList.add("hidden");
    gameEl.classList.add("hidden");
    bilanEl.classList.add("hidden");
    $("#campScreen").classList.add("hidden");
    $("#objScreen").classList.add("hidden");
    document.querySelectorAll(".subscreen").forEach(el => el.classList.add("hidden"));
    $("#actionbar").classList.add("hidden");
  }

  /* Ouvre un sous-écran depuis le Bureau (classement, équipe, etc.). */
  function openScreen(name) {
    hideAll();
    const map = {
      calendar: "#screenCalendar",
      transfers: "#screenTransfers",
      standings: "#screenStandings",
      squad: "#screenSquad",
      staff: "#screenStaff",
      staffHire: "#screenStaffHire",
      infra: "#screenInfra",
      finances: "#screenFinances",
    };
    const sel = map[name];
    if (!sel) { showGame(); return; }
    if (name === "calendar") renderCalendar();
    if (name === "transfers") renderTransfers();
    if (name === "standings") renderStandingsInto("#standingsBody");
    if (name === "squad") renderSquad();
    if (name === "finances") renderFinances();
    if (name === "staff") renderStaff();
    if (name === "staffHire") renderStaffHire();
    $(sel).classList.remove("hidden");
  }
  function showHome() {
    hideAll();
    homeEl.classList.remove("hidden");
    renderHome();
  }
  async function showSetup(slot) {
    hideAll();
    pendingSlot = slot;
    setupEl.classList.remove("hidden");

    // Verrouiller les niveaux de réputation selon l'XP globale.
    let total = 0;
    try { total = (await Storage.getProfile()).totalSeasons || 0; } catch (_) {}
    const sel = $("#inReputation");
    const levels = [
      { value: "amateur", label: "Amateur", need: 0 },
      { value: "confirme", label: "Confirmé", need: 5 },
      { value: "legende", label: "Légende", need: 10 },
    ];
    sel.innerHTML = "";
    for (const lv of levels) {
      const unlocked = total >= lv.need;
      const opt = document.createElement("option");
      opt.value = lv.value;
      opt.textContent = unlocked
        ? lv.label
        : `${lv.label} 🔒 (${lv.need} saisons)`;
      opt.disabled = !unlocked;
      sel.appendChild(opt);
    }
    sel.value = "amateur";
    // Petit rappel d'XP sous le sélecteur.
    const hint = $("#repHint");
    if (hint) {
      hint.textContent = total >= 10
        ? "Tous les niveaux sont débloqués."
        : total >= 5
        ? `Expérience : ${total} saisons. « Légende » à 10 saisons.`
        : `Expérience : ${total} saison(s). « Confirmé » à 5, « Légende » à 10.`;
    }
  }
  function showGame() {
    hideAll();
    gameEl.classList.remove("hidden");
    $("#actionbar").classList.remove("hidden");
  }

  /* Entrée dans le jeu : si les objectifs de la saison ne sont pas
     encore fixés, on présente d'abord l'écran des objectifs du Board.
     Vrai aussi bien en début de saison qu'avant la pré-saison initiale. */
  function enterGame() {
    const gs = GameEngine.getState();
    const needObjectives = gs && gs.board && !gs.board.objectivesSet &&
      (gs.time.phase === "season" ||
       (gs.time.phase === "intersaison" && gs.world.firstSeasonPending));
    if (needObjectives) {
      showObjectivesScreen();
    } else {
      showGame();
      render(null);
    }
  }

  /* Écran de choix des objectifs (début de saison). */
  function showObjectivesScreen() {
    hideAll();
    const gs = GameEngine.getState();
    const cat = BoardManager.catalogue(gs);
    const keys = BoardManager.activeObjectiveKeys(gs);
    const wrap = $("#objChoices");
    wrap.innerHTML = "";
    objChoiceState = {};

    for (const key of keys) {
      const obj = cat[key];
      objChoiceState[key] = "moyen"; // défaut

      const block = document.createElement("div");
      block.className = "obj-block";
      block.innerHTML = `<div class="obj-title">${obj.label}</div>`;

      const opts = document.createElement("div");
      opts.className = "obj-levels";
      for (const lv of obj.levels) {
        const b = document.createElement("button");
        b.className = "obj-level" + (lv.key === "moyen" ? " selected" : "");
        b.innerHTML =
          `<span class="obj-lvl-name">${lv.label}</span>` +
          `<span class="obj-lvl-desc">${lv.desc}</span>` +
          `<span class="obj-lvl-reward">+${lv.reward} si réussi</span>`;
        b.onclick = () => {
          objChoiceState[key] = lv.key;
          // Mettre à jour la sélection visuelle.
          opts.querySelectorAll(".obj-level").forEach(el => el.classList.remove("selected"));
          b.classList.add("selected");
        };
        opts.appendChild(b);
      }
      block.appendChild(opts);
      wrap.appendChild(block);
    }
    $("#objScreen").classList.remove("hidden");
  }

  function onConfirmObjectives() {
    const gs = GameEngine.getState();
    BoardManager.setObjectives(gs, objChoiceState);
    Storage.saveSlot(GameEngine.getSlot(), gs).catch(e => console.error(e));
    // Bilan de pré-saison de l'entraîneur : affiché dans une fenêtre.
    if (window.StaffManager) {
      const rep = StaffManager.preseasonReport(gs);
      showCoachReport(rep);
    } else {
      showGame();
      render(null);
    }
  }

  /* Fenêtre : bilan de pré-saison de l'entraîneur. */
  function showCoachReport(rep) {
    $("#negTitle").textContent = rep.intro;
    const box = $("#negChoices");
    box.innerHTML = "";
    const list = document.createElement("div");
    list.className = "coach-report";
    list.innerHTML = rep.points.map(p => `<div class="cr-line">• ${p}</div>`).join("");
    box.appendChild(list);
    const b = document.createElement("button");
    b.className = "primary neg-choice";
    b.textContent = "Compris";
    b.onclick = () => { closeNegotiation(); showGame(); render(null); };
    box.appendChild(b);
    $("#negModal").classList.remove("hidden");
  }

  /* --- Écran d'accueil : liste des slots --- */
  async function renderHome() {
    const listEl = $("#slotList");
    listEl.innerHTML = "";
    const slots = await Storage.listSlots();
    for (const s of slots) {
      const card = document.createElement("div");
      card.className = "slot" + (s.empty ? " empty" : "");
      if (s.empty) {
        card.innerHTML =
          `<div class="slot-title">Slot ${s.slot}</div>` +
          `<div class="slot-sub">Emplacement vide</div>`;
        const btn = document.createElement("button");
        btn.className = "primary";
        btn.textContent = "Nouvelle partie";
        btn.onclick = () => showSetup(s.slot);
        card.appendChild(btn);
      } else {
        const sm = s.summary;
        card.innerHTML =
          `<div class="slot-title">${sm.clubName}</div>` +
          `<div class="slot-sub">${capitalize(sm.country)} · Saison ${sm.season} · ${formatDate(sm.date)}</div>`;
        const row = document.createElement("div");
        row.className = "slot-actions";
        const bResume = document.createElement("button");
        bResume.className = "primary";
        bResume.textContent = "Reprendre";
        bResume.onclick = () => resumeSlot(s.slot);
        const bDel = document.createElement("button");
        bDel.className = "ghost danger";
        bDel.textContent = "Supprimer";
        bDel.onclick = () => deleteSlot(s.slot);
        row.appendChild(bResume);
        row.appendChild(bDel);
        card.appendChild(row);
      }
      listEl.appendChild(card);
    }
  }

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—"; }

  /* --- Créer une nouvelle partie dans le slot choisi --- */
  async function startNewGame() {
    const clubName = $("#inClub").value.trim() || "FC Vallonne";
    const city = $("#inCity").value.trim() || "";
    const gs = createNewGame({
      presidentName: $("#inPresident").value.trim() || "Président",
      clubName: clubName,
      country: "italie",
      reputation: $("#inReputation").value,
    });
    SeasonManager.startSeason(gs, CLUBS_SERIE_B, { name: clubName, city: city });
    GameEngine.attach(gs, pendingSlot);
    await Storage.saveSlot(pendingSlot, gs);
    enterGame();
  }

  /* --- Reprendre une partie existante --- */
  async function resumeSlot(slot) {
    const gs = await Storage.loadSlot(slot);
    if (!gs) { showHome(); return; }
    GameEngine.attach(gs, slot);
    enterGame();
  }

  /* --- Supprimer une partie (le vrai "recommencer") --- */
  async function deleteSlot(slot) {
    if (!confirm(`Supprimer définitivement la partie du slot ${slot} ?`)) return;
    await Storage.deleteSlot(slot);
    renderHome();
  }

  /* --- Bouton Continuer --- */
  async function onContinue() {
    // Si un match vient de se terminer, ce clic FERME le match et
    // revient au Bureau — SANS avancer le temps (1 clic = 1 match).
    if (matchJustFinished) {
      matchJustFinished = false;
      matchEl.classList.add("hidden");
      showGame();
      render(null);
      return;
    }
    const btn = $("#btnContinue");
    btn.disabled = true;
    try {
      const report = await GameEngine.continueStep();
      if (report.openMatch && report.playerMatch) {
        addLogLine(report);
        openMatchScreen(report.playerMatch);
      } else if (report.seasonEnd) {
        addLogLine(report);
        showBilan(report.evaluation, report.wages, report.loanReturns, report.styleConverts);
      } else {
        render(report);
      }
    } catch (e) {
      console.error(e); alert("Erreur : " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* --- Écran de bilan de fin de saison --- */
  async function showBilan(evaluation, wages, loanReturns, styleConverts) {
    hideAll();
    bilanEl.classList.remove("hidden");
    const gs = GameEngine.getState();
    const rows = WorldManager.getStandings(gs);
    const me = rows.find(r => r.isPlayer);

    // Compter cette saison dans l'XP globale du joueur.
    let total = 0;
    try { total = await Storage.addSeasonPlayed(); } catch (_) {}

    $("#bilanTitle").textContent = `Fin de la saison ${gs.time.season}`;
    let summary = `${me.name} termine ${me.rank}ᵉ sur ${rows.length} avec ${me.points} points.`;
    if (wages) summary += `\nSalaires annuels versés : -${wages} M. Trésorerie : ${gs.club.cash} M.`;
    // Récapitulatif des prêts terminés.
    if (loanReturns && (loanReturns.in.length || loanReturns.out.length)) {
      if (loanReturns.out.length) summary += `\nRetour de prêt : ${loanReturns.out.join(", ")} (de retour au club).`;
      if (loanReturns.in.length) summary += `\nFin de prêt : ${loanReturns.in.join(", ")} (repartent dans leur club).`;
    }
    if (styleConverts && styleConverts.length) {
      summary += `\nÉvolution de style : ${styleConverts.join(", ")} adopte(nt) le style du coach.`;
    }
    if (total === 5) summary += ` 🎉 Vous avez débloqué le niveau « Confirmé » !`;
    if (total === 10) summary += ` 🏆 Vous avez débloqué le niveau « Légende » !`;
    summary += `\nExpérience : ${total} saison${total > 1 ? "s" : ""} jouée${total > 1 ? "s" : ""} au total.`;
    $("#bilanSummary").textContent = summary;

    // Évaluation du Board (objectifs + confiance + licenciement).
    const evalEl = $("#bilanEval");
    if (evaluation) {
      let html = `<h3 class="eval-title">Évaluation du Board</h3>`;
      for (const r of evaluation.results) {
        const valStr = r.key === "sportif" ? `${r.value}ᵉ`
          : r.key === "attaque" ? `${r.value} buts`
          : `${r.value} M`;
        html += `<div class="eval-row ${r.met ? "ok" : "no"}">` +
          `<span>${r.met ? "✓" : "✗"} ${r.label} — ${r.levelLabel}</span>` +
          `<span class="eval-change">${r.change > 0 ? "+" : ""}${r.change}</span></div>` +
          `<div class="eval-detail">Objectif : ${r.desc} · Réalisé : ${valStr}</div>`;
      }
      html += `<div class="eval-confidence">Confiance du Board : <b>${evaluation.confidence}/100</b> ` +
        `(${evaluation.delta > 0 ? "+" : ""}${evaluation.delta})</div>`;
      evalEl.innerHTML = html;
      evalEl.classList.remove("hidden");

      // Licenciement ?
      const nextBtn = $("#btnNextSeason");
      if (evaluation.fired) {
        evalEl.innerHTML += `<div class="eval-fired">⚠️ Le Board a perdu confiance (seuil ${evaluation.threshold}). Vous êtes démis de vos fonctions.</div>`;
        nextBtn.textContent = "Retour à l'accueil";
        nextBtn.onclick = async () => {
          await Storage.deleteSlot(GameEngine.getSlot());
          nextBtn.onclick = null;
          showHome();
        };
      } else {
        nextBtn.textContent = "Nouvelle saison ▶";
      }
    } else {
      evalEl.classList.add("hidden");
    }

    const body = $("#bilanStandings");
    body.innerHTML = "";
    for (const r of rows) {
      const tr = document.createElement("tr");
      if (r.isPlayer) tr.className = "me";
      tr.innerHTML =
        `<td>${r.rank}</td><td class="tname">${r.name}</td>` +
        `<td>${r.played}</td><td>${r.won}-${r.drawn}-${r.lost}</td>` +
        `<td>${r.gf - r.ga >= 0 ? "+" : ""}${r.gf - r.ga}</td>` +
        `<td class="pts">${r.points}</td>`;
      body.appendChild(tr);
    }
  }

  async function onNextSeason() {
    const btn = $("#btnNextSeason");
    btn.disabled = true;
    try {
      await GameEngine.enterIntersaison();
      showGame();
      render(null);
    } catch (e) {
      console.error(e); alert("Erreur : " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* Avancer d'une semaine pendant l'intersaison. */
  async function onAdvanceWeek() {
    const btn = $("#btnWeek");
    btn.disabled = true;
    try {
      const rep = await GameEngine.advanceWeek();
      // Un stage de préparation ? Ouvrir l'écran de décision.
      if (rep.trainingCamp) {
        showCampScreen();
        return;
      }
      for (const m of rep.messages) {
        addLogLine({ date: m.date, label: m.label });
      }
      if (rep.reachedPreseason) {
        await GameEngine.goToPreseason();
        addLogLine({ date: GameEngine.getState().time.currentDate, label: "Début de la pré-saison" });
        enterGame();
        return;
      }
      render(null);
    } catch (e) {
      console.error(e); alert("Erreur : " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* Écran de décision du stage de préparation. */
  function showCampScreen() {
    hideAll();
    const gs = GameEngine.getState();
    $("#campCash").textContent = gs.club.cash + " M";
    const opts = [
      { level: "eco", name: "Stage économique", cost: 1, desc: "Petit gain de forme" },
      { level: "standard", name: "Stage standard", cost: 2.5, desc: "Bon gain de forme" },
      { level: "luxe", name: "Stage de luxe", cost: 4, desc: "Fort gain de forme" },
      { level: "none", name: "Aucun stage", cost: 0, desc: "Aucun gain" },
    ];
    const wrap = $("#campOptions");
    wrap.innerHTML = "";
    for (const o of opts) {
      const affordable = o.cost <= gs.club.cash;
      const card = document.createElement("button");
      card.className = "camp-opt" + (affordable ? "" : " disabled");
      card.disabled = !affordable;
      card.innerHTML =
        `<div class="camp-opt-head"><span class="camp-name">${o.name}</span>` +
        `<span class="camp-cost">${o.cost === 0 ? "Gratuit" : o.cost + " M"}</span></div>` +
        `<div class="camp-desc">${o.desc}${affordable ? "" : " — trésorerie insuffisante"}</div>`;
      if (affordable) card.onclick = () => onChooseCamp(o.level);
      wrap.appendChild(card);
    }
    $("#campScreen").classList.remove("hidden");
  }

  async function onChooseCamp(level) {
    try {
      const res = await GameEngine.chooseTrainingCamp(level);
      if (!res.ok) { alert("Trésorerie insuffisante."); return; }
      const gs = GameEngine.getState();
      const label = level === "none"
        ? "Stage de préparation : aucun stage retenu"
        : `Stage de préparation effectué (-${res.cost} M, forme +${res.bonus})`;
      addLogLine({ date: gs.time.currentDate, label });

      // Si le joueur avait cliqué "Pré-saison ⏭", on file à la reprise
      // maintenant que le stage est décidé.
      if (skipAfterCamp) {
        skipAfterCamp = false;
        await GameEngine.goToPreseason();
        addLogLine({ date: GameEngine.getState().time.currentDate, label: "Reprise — pré-saison" });
        enterGame();
        return;
      }
      // Sinon, reprendre l'intersaison (retour au Bureau).
      showGame();
      render(null);
    } catch (e) {
      console.error(e); alert("Erreur : " + e.message);
    }
  }

  /* Passer directement à la pré-saison (saute l'intersaison).
     S'il reste un stage à décider, on s'arrête D'ABORD dessus. */
  async function onSkipToPreseason() {
    const btn = $("#btnPreseason");
    btn.disabled = true;
    try {
      const gs = GameEngine.getState();
      // Reste-t-il un stage de préparation non traité ?
      const campPending = gs.events.some(e => e.type === "training_camp");
      if (campPending) {
        // S'arrêter sur le stage ; on filera à la reprise après le choix.
        skipAfterCamp = true;
        showCampScreen();
        return;
      }
      await GameEngine.goToPreseason();
      addLogLine({ date: GameEngine.getState().time.currentDate, label: "Nouvelle saison — pré-saison" });
      enterGame();
    } catch (e) {
      console.error(e); alert("Erreur : " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* Bouton retour à l'accueil depuis une partie. */
  function onHome() {
    showHome();
  }

  async function init() {
    $("#btnStart").addEventListener("click", startNewGame);
    $("#btnSetupBack").addEventListener("click", showHome);
    $("#btnContinue").addEventListener("click", onContinue);
    $("#btnNextSeason").addEventListener("click", onNextSeason);
    $("#btnWeek").addEventListener("click", onAdvanceWeek);
    $("#btnPreseason").addEventListener("click", onSkipToPreseason);
    $("#btnReset").addEventListener("click", onHome);
    $("#btnPlayerBack").addEventListener("click", () => openScreen("squad"));
    $("#btnStaffHire").addEventListener("click", () => openScreen("staffHire"));
    $("#btnStaffHireBack").addEventListener("click", () => openScreen("staff"));
    $("#btnObjConfirm").addEventListener("click", onConfirmObjectives);
    $("#negClose").addEventListener("click", closeNegotiation);
    // Boutons de navigation du Bureau vers les sous-écrans.
    document.querySelectorAll(".navbtn").forEach(btn => {
      btn.addEventListener("click", () => openScreen(btn.dataset.screen));
    });
    // Boutons "retour au Bureau" des sous-écrans.
    document.querySelectorAll(".btnBack").forEach(btn => {
      btn.addEventListener("click", () => { showGame(); render(null); });
    });
    // Au lancement : toujours l'écran d'accueil (menu des slots).
    try {
      showHome();
    } catch (e) {
      console.error("Init :", e);
      showHome();
    }
  }

  // Le script est chargé en fin de <body> : DOMContentLoaded peut
  // avoir DÉJÀ été déclenché. On lance init() tout de suite dans ce
  // cas, sinon on attend l'événement.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
