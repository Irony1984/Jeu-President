/* ============================================================
   engine.js — Le Game Engine (orchestrateur)
   ------------------------------------------------------------
   Le chef d'orchestre. À chaque "Continuer", il exécute UNE
   itération, selon la séquence du chapitre 13 :
     1. Trouver le prochain événement
     2. Simuler le monde (matchs IA de la journée)   [Phase 1+]
     3. Traiter l'événement
     4. Sauvegarder (IndexedDB, asynchrone)
     5. Afficher (retour au Bureau)

   Les Managers ne s'appellent jamais entre eux : c'est ICI,
   et seulement ici, qu'on décide qui fait quoi et dans quel ordre.
   ============================================================ */

const GameEngine = (function () {

  let gs = null;                 // le GameState courant
  let activeSlot = 1;            // slot de sauvegarde de la partie en cours
  let listeners = [];            // abonnés aux mises à jour (l'UI)

  /* Démarre le moteur avec un GameState donné et son slot. */
  function attach(gameState, slot) {
    gs = gameState;
    if (slot) activeSlot = slot;
    else if (gs.meta && gs.meta.slot) activeSlot = gs.meta.slot;
  }

  function getSlot() { return activeSlot; }

  function getState() {
    return gs;
  }

  /* Permet à l'UI de réagir après chaque itération.
     callback(report) où report décrit ce qui s'est passé. */
  function onUpdate(callback) {
    listeners.push(callback);
  }

  function _notify(report) {
    for (const cb of listeners) cb(report, gs);
  }

  /* Traite un événement selon son type.
     En Phase 0, les types sont génériques ; les Managers de
     gameplay (match, board...) brancheront leur logique ici
     aux phases suivantes. Renvoie une description lisible. */
  function _handleEvent(event) {
    if (!event) return { handled: false, label: "Aucun événement" };

    switch (event.type) {
      // Journée de championnat : simuler les matchs IA, détecter
      // le match du club du joueur (qui ouvrira l'écran de match).
      case "matchday": {
        gs.world.currentMatchday = event.matchday;

        // Droits TV versés au coup d'envoi de la saison (1re journée).
        if (event.matchday === 0 && window.FinanceManager && !gs.world.tvPaidSeason) {
          FinanceManager.payTvRights(gs, gs.time.currentDate);
          gs.world.tvPaidSeason = true;
        }

        const { results, playerMatch } =
          WorldManager.playMatchday(gs, event.matchday);

        // Marché actif : de nouvelles offres peuvent tomber à chaque
        // journée pendant le mercato (et les anciennes expirent).
        if (gs.time.inMercato && window.TransferManager) {
          TransferManager.tickMarket(gs);
        }

        if (playerMatch) {
          // Le match du joueur est un événement qui ouvre l'UI.
          return {
            handled: true,
            label: `Journée ${event.matchday + 1} — votre match`,
            openMatch: true,
            playerMatch,
            results,
            event,
          };
        }
        return {
          handled: true,
          label: `Journée ${event.matchday + 1} jouée`,
          results,
          event,
        };
      }

      // Fin de saison : d'abord les salaires (trésorerie nette), PUIS
      // l'évaluation du Board (objectifs, confiance, licenciement).
      case "season_end": {
        let wages = 0;
        if (window.FinanceManager) {
          wages = FinanceManager.payAnnualWages(gs, gs.time.currentDate);
        }
        // Retours de prêts en fin de saison (récap pour l'UI).
        let loanReturns = null;
        if (window.TransferManager) {
          loanReturns = TransferManager.processLoanReturns(gs);
        }
        // Évolution des styles de jeu (l'entraîneur convertit des joueurs).
        let styleConverts = null;
        if (window.StaffManager && StaffManager.evolveStyles) {
          styleConverts = StaffManager.evolveStyles(gs);
        }
        let evaluation = null;
        if (window.BoardManager && gs.board.objectivesSet) {
          evaluation = BoardManager.evaluate(gs);
        }
        return { handled: true, label: "Fin de saison", seasonEnd: true, evaluation, wages, loanReturns, styleConverts, event };
      }

      // Événements du Board (Phase 2).
      case "board_objectives":
        return { handled: true, label: "Le Board fixe les objectifs", event };
      case "board_report":
        return { handled: true, label: "Rapport annuel du Board", event };

      // Ouverture / fermeture de mercato.
      case "mercato_open":
        gs.time.inMercato = true;
        if (window.TransferManager) TransferManager.generateOffers(gs);
        return { handled: true, label: "Ouverture du mercato", event };
      case "mercato_close":
        gs.time.inMercato = false;
        if (window.TransferManager) TransferManager.closeWindow(gs);
        return { handled: true, label: "Fermeture du mercato", event };

      // Type inconnu ou générique (utile pour tester la Phase 0).
      default:
        return { handled: true, label: event.label ?? ("Événement : " + event.type), event };
    }
  }

  /* UNE itération de "Continuer".
     Renvoie une Promise qui se résout avec le rapport d'étape. */
  async function continueStep() {
    if (!gs) throw new Error("GameEngine : aucun GameState attaché.");

    // 1. Avancer le temps jusqu'au prochain événement (selon régime).
    const { newDate, reachedEvent } = CalendarManager.advance(gs);

    // 2. La simulation du monde (matchs IA) se fait dans le
    //    traitement de l'événement "matchday" (voir _handleEvent).

    // 3. Traiter l'événement atteint (s'il y en a un).
    let handling = { handled: false, label: "Le temps avance…" };
    if (reachedEvent) {
      handling = _handleEvent(reachedEvent);
      CalendarManager.removeEvent(gs, reachedEvent);
    }

    // 4. Sauvegarder (asynchrone, ne bloque pas l'interface).
    try {
      await Storage.saveSlot(activeSlot, gs);
    } catch (e) {
      console.error("Échec de sauvegarde :", e);
    }

    // 5. Notifier l'UI (retour au Bureau, affichage de l'événement).
    const report = {
      date: newDate,
      inMercato: gs.time.inMercato,
      event: reachedEvent,
      ...handling,
    };
    _notify(report);
    return report;
  }

  /* Résout le match du joueur (appelé par l'écran de match,
     que le joueur ait regardé le fil ou cliqué "Simuler").
     Applique le résultat au classement et sauvegarde. */
  async function resolvePlayerMatch(playerMatch) {
    const result = MatchManager.resolvePlayerMatch(
      gs, playerMatch.home, playerMatch.away
    );
    // Billetterie si le match est à domicile (le club du joueur reçoit).
    if (window.FinanceManager && playerMatch.home === gs.club.id) {
      FinanceManager.gateReceipts(gs, gs.time.currentDate, playerMatch.away);
    }
    try {
      await Storage.saveSlot(activeSlot, gs);
    } catch (e) {
      console.error("Échec de sauvegarde :", e);
    }
    return result;
  }

  /* Lance la saison suivante (appelé par l'UI après le bilan). */
  async function startNextSeason() {
    SeasonManager.nextSeason(gs);
    try {
      await Storage.saveSlot(activeSlot, gs);
    } catch (e) {
      console.error("Échec de sauvegarde :", e);
    }
    return gs.time.season;
  }

  /* Entre en intersaison (appelé depuis le bilan de fin de saison). */
  async function enterIntersaison() {
    SeasonManager.startIntersaison(gs);
    try { await Storage.saveSlot(activeSlot, gs); } catch (e) { console.error(e); }
    return gs;
  }

  /* Avance d'une semaine pendant l'intersaison. Traite les messages
     de préparation rencontrés. Renvoie un rapport { date, messages,
     reachedPreseason }. */
  async function advanceWeek() {
    const target = CalendarManager.addDays(gs.time.currentDate, 7);

    // Un stage de préparation dans la semaine à venir ? On s'arrête
    // dessus pour laisser le président décider (écran de choix).
    const camp = gs.events
      .filter(e => e.type === "training_camp" &&
                   CalendarManager.compare(e.date, target) <= 0)
      .sort((a, b) => CalendarManager.compare(a.date, b.date))[0];
    if (camp) {
      gs.time.currentDate = camp.date;
      try { await Storage.saveSlot(activeSlot, gs); } catch (e) { console.error(e); }
      return { date: camp.date, messages: [], reachedPreseason: false, trainingCamp: camp };
    }

    const messages = [];
    // Récupérer les messages d'intersaison dont la date <= cible.
    const pending = gs.events
      .filter(e => (e.type === "intersaison_msg" || e.type === "mercato_open") &&
                   CalendarManager.compare(e.date, target) <= 0)
      .sort((a, b) => CalendarManager.compare(a.date, b.date));
    for (const ev of pending) {
      messages.push({ date: ev.date, label: ev.label });
      // Ouverture du mercato d'été pendant la pré-saison : générer les offres.
      if (ev.type === "mercato_open") {
        gs.time.inMercato = true;
        if (window.TransferManager) TransferManager.generateOffers(gs);
      }
      CalendarManager.removeEvent(gs, ev);
    }

    // Marché actif pendant la pré-saison : de nouvelles offres au fil
    // des semaines (si le mercato est déjà ouvert).
    if (gs.time.inMercato && window.TransferManager) {
      TransferManager.tickMarket(gs);
    }
    // Avancer la date, sans dépasser la pré-saison.
    let newDate = target;
    let reachedPreseason = false;
    if (CalendarManager.compare(newDate, gs.time.preseasonDate) >= 0) {
      newDate = gs.time.preseasonDate;
      reachedPreseason = true;
    }
    gs.time.currentDate = newDate;
    try { await Storage.saveSlot(activeSlot, gs); } catch (e) { console.error(e); }
    return { date: newDate, messages, reachedPreseason };
  }

  /* Applique le choix de stage : déduit le coût de la trésorerie et
     enregistre le bonus de forme à appliquer au début de saison.
     level ∈ {none, eco, standard, luxe}. Retourne { ok, cost, bonus }. */
  async function chooseTrainingCamp(level) {
    const CAMPS = {
      none:     { cost: 0,   bonus: 0 },
      eco:      { cost: 1,   bonus: 4 },
      standard: { cost: 2.5, bonus: 8 },
      luxe:     { cost: 4,   bonus: 14 },
    };
    const choice = CAMPS[level] || CAMPS.none;

    // Vérifier les moyens (sécurité ; l'UI grise déjà les options).
    if (choice.cost > gs.club.cash) {
      return { ok: false, reason: "cash" };
    }
    gs.club.cash = Math.round((gs.club.cash - choice.cost) * 100) / 100;
    // Mémoriser le bonus de forme à appliquer au démarrage de la saison.
    gs.world.pendingFormBonus = choice.bonus;

    // Retirer l'événement de stage de la file.
    gs.events = gs.events.filter(e => e.type !== "training_camp");

    try { await Storage.saveSlot(activeSlot, gs); } catch (e) { console.error(e); }
    return { ok: true, cost: choice.cost, bonus: choice.bonus };
  }

  /* Saute directement à la pré-saison et démarre la saison suivante. */
  async function goToPreseason() {
    // Nettoyer les événements d'intersaison restants (messages + stage).
    gs.events = gs.events.filter(e =>
      e.type !== "intersaison_msg" && e.type !== "training_camp");
    gs.time.currentDate = gs.time.preseasonDate;
    // Première saison : on programme la saison 1 sans incrémenter.
    if (gs.world.firstSeasonPending) {
      SeasonManager.beginFirstSeason(gs);
    } else {
      SeasonManager.nextSeason(gs);
    }
    try { await Storage.saveSlot(activeSlot, gs); } catch (e) { console.error(e); }
    return gs.time.season;
  }

  return { attach, getState, getSlot, onUpdate, continueStep, resolvePlayerMatch, startNextSeason, enterIntersaison, advanceWeek, chooseTrainingCamp, goToPreseason };
})();

window.GameEngine = GameEngine;
