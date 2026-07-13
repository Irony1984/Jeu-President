/* ============================================================
   managers/season.js — Orchestration des saisons (Phase 1)
   ------------------------------------------------------------
   Met en place une saison : championnat + calendrier des journées.
   Gère aussi l'ENCHAÎNEMENT vers la saison suivante (nextSeason).
   ============================================================ */

const SeasonManager = (function () {

  /* Démarre la PREMIÈRE saison : crée la ligue (club du joueur ajouté),
     puis entre en PRÉ-SAISON (intersaison avec stage) avant la saison 1.
     Uniformise le déroulé : toute saison commence par une pré-saison. */
  function startSeason(gs, clubList, playerClubInfo) {
    WorldManager.setupLeague(gs, clubList, playerClubInfo);
    // On entre en pré-saison au lieu de programmer les matchs tout de suite.
    // La saison 1 sera programmée à la fin de la pré-saison (goToPreseason).
    gs.world.firstSeasonPending = true;
    startIntersaison(gs);
  }

  /* Programme la saison 1 après la pré-saison initiale (sans incrémenter
     le numéro de saison ni vieillir les joueurs — c'est la 1re saison). */
  function beginFirstSeason(gs) {
    // Appliquer le bonus de forme du stage de pré-saison, s'il y en a un.
    let bonus = gs.world.pendingFormBonus || 0;
    if (window.StaffManager) bonus += StaffManager.formBonus(gs);
    if (bonus > 0) {
      for (const p of gs.players) {
        if (p.clubId === gs.club.id) {
          p.forme = Math.min(100, (p.forme || 50) + bonus);
        }
      }
    }
    gs.world.pendingFormBonus = 0;
    gs.world.firstSeasonPending = false;
    gs.time.phase = "season";
    gs.world.tvPaidSeason = false;
    if (window.FinanceManager) FinanceManager.resetSeasonCounters(gs);
    if (window.BoardManager) BoardManager.resetForNewSeason(gs);
    scheduleSeason(gs);
  }

  /* Démarre la saison SUIVANTE : on garde les clubs et les joueurs,
     on vieillit les joueurs d'un an, on remet le classement à zéro
     et on reprogramme un nouveau calendrier. */
  function nextSeason(gs) {
    gs.time.season += 1;

    // Vieillir tous les joueurs d'un an (léger, Phase 1).
    for (const p of gs.players) {
      p.age += 1;
      // Statistiques par saison : on repart de zéro.
      p.stats = { apps: 0, goals: 0, assists: 0, cards: 0, cleansheets: 0 };
    }

    // Appliquer le bonus de forme du stage de préparation (s'il y en a un)
    // aux joueurs du club du joueur, pour bien démarrer la saison.
    let bonus = gs.world.pendingFormBonus || 0;
    if (window.StaffManager) bonus += StaffManager.formBonus(gs);
    if (bonus > 0) {
      for (const p of gs.players) {
        if (p.clubId === gs.club.id) {
          p.forme = Math.min(100, (p.forme || 50) + bonus);
        }
      }
    }
    gs.world.pendingFormBonus = 0;

    // Remettre les compteurs du classement à zéro.
    gs.world.standings = {};
    for (const c of gs.clubs) {
      gs.world.standings[c.id] = {
        clubId: c.id, played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, points: 0,
      };
    }

    // Nouveau calendrier de la saison.
    gs.world.fixtures = WorldManager.buildFixtures(gs.clubs.map(c => c.id));
    gs.world.currentMatchday = 0;

    gs.time.phase = "season";
    gs.world.tvPaidSeason = false;
    if (window.FinanceManager) FinanceManager.resetSeasonCounters(gs);
    if (window.BoardManager) BoardManager.resetForNewSeason(gs);
    scheduleSeason(gs);
  }

  /* Entre en INTERSAISON (après le bilan de fin de saison).
     Période creuse, fin mai -> mi-août, où le joueur avance semaine
     par semaine (ou saute à la pré-saison). Sème 2-3 messages simples
     de préparation. Ne recrée PAS encore la saison : ça se fait à la
     pré-saison via nextSeason(). */
  function startIntersaison(gs) {
    gs.time.phase = "intersaison";
    // La date courante est ~ la fin de saison (mai). On fixe la
    // reprise à la mi-août (pré-saison) de la même année civile.
    const year = Number(gs.time.currentDate.split("-")[0]);
    gs.time.preseasonDate = `${year}-08-15`;

    // Événements de préparation, répartis sur l'intersaison.
    // Le stage est une DÉCISION (écran de choix) ; les autres sont
    // de simples messages informatifs.
    const msgs = [
      { offsetDays: 7,  text: "Ouverture du mercato d'été", type: "mercato_open" },
      { offsetDays: 14, text: "Reprise de l'entraînement", type: "intersaison_msg" },
      { offsetDays: 35, text: "Stage de préparation", type: "training_camp" },
      { offsetDays: 56, text: "Matchs amicaux de pré-saison", type: "intersaison_msg" },
    ];
    for (const m of msgs) {
      const d = CalendarManager.addDays(gs.time.currentDate, m.offsetDays);
      // Ne pas dépasser la date de pré-saison.
      if (CalendarManager.compare(d, gs.time.preseasonDate) < 0) {
        CalendarManager.addEvent(gs, {
          date: d, type: m.type, label: m.text,
        });
      }
    }
  }

  /* Programme les événements d'une saison à partir de la date
     courante : une journée par semaine dès le ~20 août, puis un
     événement de fin de saison. Commun à startSeason/nextSeason. */
  function scheduleSeason(gs) {
    let date = firstMatchdayDate(gs.time.currentDate);
    const nbDays = gs.world.fixtures.length;

    // Table permanente des dates de journées (survit au retrait des
    // événements une fois les journées jouées) — utilisée par le calendrier.
    gs.world.matchdayDates = {};

    for (let md = 0; md < nbDays; md++) {
      gs.world.matchdayDates[md] = date;
      CalendarManager.addEvent(gs, {
        date: date,
        type: "matchday",
        matchday: md,
        label: `Journée ${md + 1}`,
      });
      date = CalendarManager.addDays(date, 7);
    }

    CalendarManager.addEvent(gs, {
      date: date,
      type: "season_end",
      label: "Fin de saison",
    });
    gs.world.seasonEndDate = date;

    // Événements de mercato (le mercato d'ÉTÉ est ouvert dès la pré-saison,
    // voir startIntersaison ; ici on programme sa fermeture + l'hiver).
    const y = Number(firstMatchdayDate(gs.time.currentDate).split("-")[0]);
    CalendarManager.addEvent(gs, { date: `${y}-09-01`, type: "mercato_close", label: "Fermeture du mercato d'été" });
    CalendarManager.addEvent(gs, { date: `${y + 1}-01-01`, type: "mercato_open", label: "Ouverture du mercato d'hiver" });
    CalendarManager.addEvent(gs, { date: `${y + 1}-02-01`, type: "mercato_close", label: "Fermeture du mercato d'hiver" });
  }

  /* Première journée : ~20 août de l'année qui SUIT la date courante
     si on est déjà en fin de saison (mai), sinon l'année courante. */
  function firstMatchdayDate(currentDate) {
    const [y, m] = currentDate.split("-").map(Number);
    // Si on est après juin, la saison démarre l'année suivante.
    const year = (m >= 6) ? y : y; // Phase 1 : garder simple, même année civile
    // Pour l'enchaînement, on part toujours du prochain 20 août
    // situé après la date courante.
    let target = `${y}-08-20`;
    if (CalendarManager.compare(target, currentDate) <= 0) {
      target = `${y + 1}-08-20`;
    }
    return target;
  }

  return { startSeason, beginFirstSeason, nextSeason, startIntersaison, scheduleSeason, firstMatchdayDate };
})();

window.SeasonManager = SeasonManager;
