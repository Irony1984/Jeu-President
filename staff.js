/* ============================================================
   managers/finance.js — Le FinanceManager (Phase 2)
   ------------------------------------------------------------
   Gère l'argent du club : revenus (billetterie au match, droits
   TV en début de saison) et dépenses (salaires annuels des
   joueurs, prélevés en fin de saison). Réf : Chapitre 10.

   Toutes les opérations passent par gs.club.cash et sont
   journalisées dans gs.finance.ledger (pour l'écran Finances).
   ============================================================ */

const FinanceManager = (function () {

  /* Salaire ANNUEL d'un joueur selon son niveau (en M).
     Courbe croissante : ~0,05 M à niveau 50, ~0,5 M à niveau 85.
     On utilise une progression douce puis plus raide vers le haut. */
  function playerSalary(level) {
    // Base quadratique normalisée : (level/100)^3 * facteur.
    const s = Math.pow(level / 100, 3) * 0.85;
    // Arrondi à 0,01 M près, minimum 0,02 M.
    return Math.max(0.02, Math.round(s * 100) / 100);
  }

  /* Masse salariale annuelle du club du joueur (somme des salaires). */
  function annualWageBill(gs) {
    const squad = gs.players.filter(p => p.clubId === gs.club.id);
    const total = squad.reduce((sum, p) => sum + playerSalary(p.level), 0);
    return Math.round(total * 100) / 100;
  }

  /* Initialise l'état financier (appelé à la création de partie). */
  function init(gs) {
    if (!gs.finance) {
      gs.finance = { ledger: [], seasonIncome: 0, seasonExpense: 0 };
    }
  }

  /* Enregistre une opération dans le journal financier + applique
     au cash. amount > 0 = revenu, amount < 0 = dépense. */
  function record(gs, date, label, amount) {
    init(gs);
    gs.club.cash = Math.round((gs.club.cash + amount) * 100) / 100;
    gs.finance.ledger.push({ date, label, amount });
    if (amount >= 0) gs.finance.seasonIncome = Math.round((gs.finance.seasonIncome + amount) * 100) / 100;
    else gs.finance.seasonExpense = Math.round((gs.finance.seasonExpense - amount) * 100) / 100;
    // Limiter la taille du journal (on garde les 100 dernières lignes).
    if (gs.finance.ledger.length > 100) gs.finance.ledger.shift();
  }

  /* Droits TV versés en début de saison (bloc). Montant fixe D2. */
  function payTvRights(gs, date) {
    const amount = 4; // 4 M forfaitaires en 2e division
    record(gs, date, "Droits TV (saison)", amount);
    return amount;
  }

  /* Recette de billetterie pour un match à domicile. Modulée par la
     force de l'adversaire (une grosse affiche remplit le stade). */
  function gateReceipts(gs, date, opponentId) {
    const opp = gs.clubs.find(c => c.id === opponentId);
    const oppStrength = opp ? opp.strength : 55;
    // Base 0,25 M + bonus selon l'adversaire (0 à ~0,25 M).
    const bonus = Math.max(0, (oppStrength - 50)) * 0.012;
    const amount = Math.round((0.25 + bonus) * 100) / 100;
    record(gs, date, `Billetterie vs ${opp ? opp.name : "?"}`, amount);
    return amount;
  }

  /* Prélève la masse salariale annuelle (fin de saison, avant Board).
     Ajustée pour les prêts entrants (on ne paie que la part négociée). */
  function payAnnualWages(gs, date) {
    let bill = annualWageBill(gs);
    if (window.TransferManager && TransferManager.loanWageAdjustment) {
      bill = Math.round((bill + TransferManager.loanWageAdjustment(gs)) * 100) / 100;
    }
    bill = Math.max(0, bill);
    record(gs, date, "Salaires annuels des joueurs", -bill);

    // Salaires du staff (Phase 3), prélevés également en fin de saison.
    if (window.StaffManager) {
      const staffBill = StaffManager.annualStaffWages(gs);
      if (staffBill > 0) {
        record(gs, date, "Salaires du staff", -staffBill);
      }
      return Math.round((bill + staffBill) * 100) / 100;
    }
    return bill;
  }

  /* Réinitialise les compteurs de saison (revenus/dépenses). */
  function resetSeasonCounters(gs) {
    init(gs);
    gs.finance.seasonIncome = 0;
    gs.finance.seasonExpense = 0;
  }

  /* Projette la trésorerie de fin de saison à partir de l'état actuel.
     Détaille : trésorerie actuelle, billetterie restante estimée, droits
     TV encore à venir, salaires annuels à payer, et le solde projeté.
     Réf : aide à la décision du président (objectif financier). */
  function projectSeasonEnd(gs) {
    init(gs);
    const cash = gs.club.cash;

    // Matchs à domicile encore à jouer (billetterie à venir estimée).
    const cal = WorldManager.getPlayerCalendar(gs);
    const homeLeft = cal.filter(m => m.isHome && !m.played);
    let gateLeft = 0;
    for (const m of homeLeft) {
      // Réutiliser la même formule que gateReceipts (sans enregistrer).
      const opp = gs.clubs.find(c => c.name === m.opponent);
      const oppStrength = opp ? opp.strength : 55;
      const bonus = Math.max(0, (oppStrength - 50)) * 0.012;
      gateLeft += 0.25 + bonus;
    }
    gateLeft = Math.round(gateLeft * 100) / 100;

    // Droits TV encore à venir ? (0 s'ils sont déjà versés cette saison)
    const tvLeft = gs.world.tvPaidSeason ? 0 : 4;

    // Salaires annuels à payer en fin de saison.
    const wages = annualWageBill(gs);

    const projected = Math.round((cash + gateLeft + tvLeft - wages) * 100) / 100;

    return {
      cash,
      gateLeft,
      homeMatchesLeft: homeLeft.length,
      tvLeft,
      wages,
      projected,
    };
  }

  return {
    init, playerSalary, annualWageBill,
    record, payTvRights, gateReceipts, payAnnualWages,
    resetSeasonCounters, projectSeasonEnd,
  };
})();

window.FinanceManager = FinanceManager;
