/* ============================================================
   style.css — Feuille de style (mobile-first)
   Identité visuelle du projet : marine, or, fond clair.
   ============================================================ */

:root {
  --navy: #1B2A4A;
  --blue: #2E5A88;
  --gold: #B8862F;
  --light: #EEF2F7;
  --grey: #5A6472;
  --dark: #222B36;
  --bg: #F7F9FC;
  --card: #FFFFFF;
  --ok: #2E6B3E;
  --bad: #9E3B2E;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--dark);
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}

body {
  max-width: 640px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: 96px; /* place pour la barre d'action fixe */
}

/* --- En-tête --- */
header {
  border-bottom: 3px solid var(--gold);
  padding-bottom: 12px;
  margin-bottom: 16px;
}
header h1 {
  color: var(--navy);
  font-size: 22px;
  font-weight: 800;
}
header .subtitle {
  color: var(--blue);
  font-size: 13px;
}

/* --- Cartes / sections --- */
.card {
  background: var(--card);
  border: 1px solid #E2E8F0;
  border-left: 4px solid var(--blue);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.card h2 {
  color: var(--blue);
  font-size: 15px;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: .5px;
}

/* --- Grille d'indicateurs (le résumé chiffré du Bureau) --- */
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.stat {
  background: var(--light);
  border-radius: 6px;
  padding: 10px 12px;
}
.stat .label {
  font-size: 11px;
  color: var(--grey);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.stat .value {
  font-size: 20px;
  font-weight: 700;
  color: var(--navy);
}

/* --- Ligne date / mercato --- */
.timebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--navy);
  color: #fff;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
}
.timebar .date { font-weight: 700; font-size: 16px; }
.badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--gold);
  color: #fff;
  font-weight: 700;
  text-transform: uppercase;
}
.badge.off { background: #9AA3AF; }

/* --- Journal d'événements --- */
.log {
  list-style: none;
  font-size: 14px;
}
.log li {
  padding: 8px 0;
  border-bottom: 1px solid #EDF1F6;
  display: flex;
  gap: 10px;
}
.log li:last-child { border-bottom: none; }
.log .when {
  color: var(--gold);
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.log .what { color: var(--dark); }
.log li.empty { color: var(--grey); font-style: italic; }

/* --- Barre d'action fixe (le bouton Continuer) --- */
.actionbar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  background: rgba(247,249,252,.96);
  border-top: 1px solid #E2E8F0;
  padding: 12px 16px;
  display: flex;
  gap: 10px;
  max-width: 640px;
  margin: 0 auto;
}
button {
  flex: 1;
  font-size: 16px;
  font-weight: 700;
  padding: 14px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
}
button.primary { background: var(--navy); color: #fff; }
button.primary:active { background: #142038; }
button.ghost {
  flex: 0 0 auto;
  background: transparent;
  color: var(--grey);
  border: 1px solid #D3DBE5;
}

/* --- Écran de création de partie --- */
.setup label {
  display: block;
  font-size: 13px;
  color: var(--grey);
  margin: 12px 0 4px;
  font-weight: 600;
}
.setup input, .setup select {
  width: 100%;
  padding: 12px;
  font-size: 15px;
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  font-family: inherit;
  background: #fff;
}
.hidden { display: none !important; }

/* --- Classement (Phase 1) --- */
.standings {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.standings th {
  text-align: left;
  color: #fff;
  background: var(--navy);
  padding: 6px 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .3px;
}
.standings th:first-child, .standings td:first-child { width: 24px; text-align: center; }
.standings td {
  padding: 6px 6px;
  border-bottom: 1px solid #EDF1F6;
}
.standings .tname { font-weight: 600; color: var(--navy); }
.standings .pts { font-weight: 800; color: var(--navy); text-align: center; }
.standings tr:nth-child(even) td { background: var(--light); }
.standings tr.me td {
  background: #FBF3DE;
  border-top: 2px solid var(--gold);
  border-bottom: 2px solid var(--gold);
}
.standings tr.me .tname { color: var(--gold); }

/* --- Écran de match --- */
.matchhead {
  background: var(--navy);
  color: #fff;
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  margin-bottom: 14px;
}
.matchhead .matchtitle { font-size: 15px; opacity: .9; margin-bottom: 6px; }
.matchhead .matchscore { font-size: 40px; font-weight: 800; letter-spacing: 2px; font-variant-numeric: tabular-nums; }
.feed {
  list-style: none;
  font-size: 14px;
  max-height: 55vh;
  overflow-y: auto;
}
.feed li {
  padding: 9px 4px;
  border-bottom: 1px solid #EDF1F6;
  animation: fadein .3s ease;
}
.feed li:last-child { border-bottom: none; }
@keyframes fadein { from { opacity: 0; transform: translateY(4px);} to {opacity:1; transform:none;} }

/* --- Écran d'accueil : slots --- */
.slot-list { display: flex; flex-direction: column; gap: 12px; }
.slot {
  border: 1px solid #E2E8F0;
  border-left: 4px solid var(--blue);
  border-radius: 8px;
  padding: 14px;
  background: var(--card);
}
.slot.empty { border-left-color: #C3CCD8; background: var(--light); }
.slot-title { font-size: 18px; font-weight: 800; color: var(--navy); }
.slot-sub { font-size: 13px; color: var(--grey); margin: 2px 0 12px; }
.slot-actions { display: flex; gap: 10px; }
.slot button { padding: 12px; font-size: 15px; }
button.danger { color: var(--bad); border-color: #E4B4AC; }
button.danger:active { background: #FBECE9; }
.actionbar.hidden { display: none !important; }

/* --- Indices / hints --- */
.hint { font-size: 12px; color: var(--grey); margin-top: 6px; font-style: italic; }
.bilan-summary { font-size: 15px; color: var(--navy); margin-bottom: 14px; white-space: pre-line; font-weight: 600; }

/* --- Grille de navigation du Bureau --- */
.navgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.navbtn {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: var(--light); color: var(--navy);
  border: 1px solid #E2E8F0; border-radius: 10px;
  padding: 16px 10px; font-size: 22px; cursor: pointer;
}
.navbtn span { font-size: 13px; font-weight: 700; }
.navbtn:active { background: #E4EAF2; }

/* --- En-tête de sous-écran --- */
.subhead { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.subhead h2 { margin: 0; }
.subhead .btnBack { flex: 0 0 auto; padding: 8px 12px; font-size: 14px; }
.soon { color: var(--grey); font-style: italic; padding: 12px 0; }

/* --- Calendrier --- */
.cal-month {
  font-weight: 800; color: var(--navy); font-size: 15px;
  padding: 10px 4px 6px; border-bottom: 2px solid var(--gold); margin-top: 8px;
}
.cal-month.current { color: var(--gold); }
.cal-items { display: flex; flex-direction: column; }
.cal-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 4px; border-bottom: 1px solid #EDF1F6; font-size: 14px;
}
.cal-day {
  flex: 0 0 26px; text-align: center; font-weight: 700;
  color: var(--grey); font-variant-numeric: tabular-nums;
}
.cal-icon { flex: 0 0 auto; }
.cal-text { flex: 1; color: var(--dark); }
.cal-score {
  flex: 0 0 auto; font-weight: 800; color: var(--navy);
  background: var(--light); border-radius: 6px; padding: 2px 8px;
  font-variant-numeric: tabular-nums;
}
.cal-row.played .cal-text { color: var(--grey); }
.cal-row.mercato .cal-text { color: var(--blue); font-weight: 600; }
.cal-row.end .cal-text { color: var(--bad); font-weight: 700; }

/* --- Prochain match (Bureau) --- */
.nextmatch { display: flex; flex-direction: column; gap: 2px; }
.nm-opp { font-size: 20px; font-weight: 800; color: var(--navy); }
.nm-info { font-size: 13px; color: var(--grey); }
#nextMatchCard { border-left-color: var(--gold); }

/* --- Lignes cliquables + fiche joueur --- */
tr.clickable { cursor: pointer; }
tr.clickable:active td { background: #E4EAF2; }
.pd { display: flex; flex-direction: column; gap: 2px; }
.pd-row {
  display: flex; justify-content: space-between;
  padding: 10px 4px; border-bottom: 1px solid #EDF1F6; font-size: 15px;
}
.pd-row span { color: var(--grey); }
.pd-row b { color: var(--navy); }

/* --- Écran de décision : stage de préparation --- */
.camp-intro { font-size: 14px; color: var(--grey); margin-bottom: 14px; }
.camp-options { display: flex; flex-direction: column; gap: 10px; }
.camp-opt {
  text-align: left; background: var(--card); color: var(--dark);
  border: 1px solid #E2E8F0; border-left: 4px solid var(--blue);
  border-radius: 10px; padding: 14px; cursor: pointer; font-family: inherit;
}
.camp-opt:active { background: var(--light); }
.camp-opt.disabled { opacity: .5; border-left-color: #C3CCD8; cursor: not-allowed; }
.camp-opt-head { display: flex; justify-content: space-between; align-items: baseline; }
.camp-name { font-size: 16px; font-weight: 800; color: var(--navy); }
.camp-cost { font-size: 15px; font-weight: 700; color: var(--gold); }
.camp-desc { font-size: 13px; color: var(--grey); margin-top: 4px; }

/* --- Objectifs du Board : écran de choix --- */
.obj-block { margin-bottom: 18px; }
.obj-title { font-weight: 800; color: var(--navy); font-size: 15px; margin-bottom: 8px; }
.obj-levels { display: flex; flex-direction: column; gap: 8px; }
.obj-level {
  text-align: left; background: var(--card); color: var(--dark);
  border: 1px solid #E2E8F0; border-left: 4px solid #C3CCD8;
  border-radius: 8px; padding: 10px 12px; cursor: pointer; font-family: inherit;
  display: flex; flex-direction: column; gap: 2px;
}
.obj-level.selected { border-left-color: var(--gold); background: #FBF3DE; }
.obj-lvl-name { font-weight: 700; color: var(--navy); font-size: 14px; }
.obj-lvl-desc { font-size: 13px; color: var(--grey); }
.obj-lvl-reward { font-size: 12px; color: var(--gold); font-weight: 700; }

/* --- Objectifs : suivi sur le Bureau --- */
.obj-track-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 0; border-bottom: 1px solid #EDF1F6; font-size: 13px;
}
.obj-track-row:last-child { border-bottom: none; }
.ot-status { flex: 0 0 auto; font-weight: 800; }
.ot-status.ok { color: var(--ok); }
.ot-status.no { color: #C3CCD8; }
.ot-label { flex: 1; color: var(--dark); }
.ot-val { flex: 0 0 auto; font-weight: 700; color: var(--grey); }
.ot-val.ok { color: var(--ok); }

/* --- Évaluation du Board dans le bilan --- */
.bilan-eval { margin: 14px 0; padding: 12px; background: var(--light); border-radius: 8px; }
.eval-title { font-size: 14px; color: var(--navy); margin-bottom: 8px; }
.eval-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; margin-top: 6px; }
.eval-row.ok { color: var(--ok); }
.eval-row.no { color: var(--bad); }
.eval-change { font-weight: 800; }
.eval-detail { font-size: 12px; color: var(--grey); margin-bottom: 4px; }
.eval-confidence { margin-top: 10px; padding-top: 8px; border-top: 1px solid #D8E0EA; font-size: 14px; color: var(--navy); }
.eval-fired { margin-top: 10px; padding: 10px; background: #FBECE9; border-radius: 6px; color: var(--bad); font-weight: 700; font-size: 14px; }

/* --- Écran Finances --- */
.fin-h3 { font-size: 14px; color: var(--navy); margin: 16px 0 8px; }
.ledger { list-style: none; font-size: 13px; }
.ledger li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #EDF1F6; }
.ledger li:last-child { border-bottom: none; }
.led-date { flex: 0 0 auto; color: var(--gold); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.led-label { flex: 1; color: var(--dark); }
.led-amount { flex: 0 0 auto; font-weight: 800; font-variant-numeric: tabular-nums; }
.led-amount.pos { color: var(--ok); }
.led-amount.neg { color: var(--bad); }
.ledger .empty { color: var(--grey); font-style: italic; }

/* --- Projection budgétaire --- */
.projection { background: var(--light); border-radius: 8px; padding: 12px; }
.proj-row { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; color: var(--dark); }
.proj-row span { color: var(--grey); }
.proj-row b.pos, .proj-total b.pos { color: var(--ok); }
.proj-row b.neg, .proj-total b.neg { color: var(--bad); }
.proj-total { display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: var(--navy); margin-top: 8px; padding-top: 8px; border-top: 2px solid var(--gold); }

/* --- Marché des transferts --- */
.tr-cash { font-size: 14px; color: var(--grey); margin-bottom: 12px; }
.tr-h3 { font-size: 14px; color: var(--navy); margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid var(--gold); }
.tr-card {
  background: var(--card); border: 1px solid #E2E8F0; border-left: 4px solid var(--blue);
  border-radius: 10px; padding: 12px; margin-bottom: 10px;
}
.tr-card.sell { border-left-color: var(--gold); }
.tr-name { font-size: 16px; font-weight: 800; color: var(--navy); }
.tr-meta { font-size: 13px; color: var(--grey); margin-top: 2px; }
.tr-meta b { color: var(--navy); }
.tr-ok { font-size: 13px; color: var(--ok); font-weight: 700; margin-top: 6px; }
.tr-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
button.small { padding: 8px 12px; font-size: 13px; border-radius: 8px; }

/* --- Pastille de notification (onglet Transferts) --- */
.navbtn { position: relative; }
.notif {
  position: absolute; top: 6px; right: 10px;
  min-width: 20px; height: 20px; padding: 0 5px;
  background: var(--bad); color: #fff; border-radius: 10px;
  font-size: 12px; font-weight: 800; line-height: 20px; text-align: center;
}

/* --- Prêts (marché des transferts) --- */
.tr-card.loan { border-left-color: #7A5FBF; }
.tr-tag { font-size: 11px; font-weight: 800; color: #fff; background: #7A5FBF; border-radius: 4px; padding: 1px 6px; vertical-align: middle; }

/* --- Modale de négociation --- */
.modal {
  position: fixed; inset: 0; background: rgba(20,30,50,0.55);
  display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px;
}
.modal-box {
  background: var(--card); border-radius: 14px; padding: 20px;
  width: 100%; max-width: 380px; box-shadow: 0 12px 40px rgba(0,0,0,0.3);
}
.modal-box h3 { color: var(--navy); font-size: 16px; margin-bottom: 14px; }
.neg-choices { display: flex; flex-direction: column; gap: 10px; }
.neg-choice { text-align: left; padding: 14px; font-size: 14px; }

/* --- Toast --- */
.toast {
  position: fixed; left: 50%; bottom: 90px; transform: translateX(-50%);
  background: var(--navy); color: #fff; padding: 12px 18px; border-radius: 10px;
  font-size: 14px; font-weight: 600; z-index: 60; max-width: 88%;
  box-shadow: 0 6px 20px rgba(0,0,0,0.3); text-align: center;
}

/* --- Écran Staff --- */
.staff-block {
  background: var(--card); border: 1px solid #E2E8F0; border-left: 4px solid var(--navy);
  border-radius: 10px; padding: 12px; margin-bottom: 10px;
}
.staff-role { font-size: 15px; font-weight: 800; color: var(--navy); }
.staff-cur { font-size: 13px; margin-top: 4px; }
.staff-vacant { color: var(--grey); font-style: italic; }
.staff-holder { color: var(--dark); }

/* --- Bilan de l'entraîneur (fenêtre) --- */
.coach-report { margin-bottom: 12px; }
.cr-line { font-size: 14px; color: var(--dark); padding: 6px 0; border-bottom: 1px solid #EDF1F6; }
.pd-stats-title { font-size: 14px; color: var(--navy); margin: 14px 0 6px; }
