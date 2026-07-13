/* ============================================================
   managers/calendar.js — Le CalendarManager
   ------------------------------------------------------------
   Gère le temps du jeu : une file d'événements datés, et
   l'avancement du temps selon DEUX régimes (ch. 4 & 13) :
     - hors mercato  : saut direct au prochain événement
     - en mercato    : jour par jour, pour ne rater aucune offre

   Un Manager ne s'appelle jamais lui-même un autre Manager :
   il agit sur le GameState, et c'est le Game Engine qui orchestre.
   ============================================================ */

const CalendarManager = (function () {

  /* --- Utilitaires de date (chaînes AAAA-MM-JJ) --- */

  function toDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function toStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDays(str, n) {
    const dt = toDate(str);
    dt.setDate(dt.getDate() + n);
    return toStr(dt);
  }

  function compare(a, b) {
    // -1 si a<b, 0 si égal, 1 si a>b (comparaison de chaînes triables)
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /* --- Gestion de la file d'événements --- */

  /* Ajoute un événement daté et garde la file triée par date. */
  function addEvent(gs, event) {
    // event = { date, type, payload?, id? }
    gs.events.push(event);
    gs.events.sort((a, b) => compare(a.date, b.date));
  }

  /* Renvoie le prochain événement à traiter (le plus proche
     dans le futur ou aujourd'hui), sans le retirer. */
  function peekNextEvent(gs) {
    const today = gs.time.currentDate;
    for (const ev of gs.events) {
      if (compare(ev.date, today) >= 0) return ev;
    }
    return null;
  }

  /* Retire un événement précis de la file (une fois traité). */
  function removeEvent(gs, event) {
    const i = gs.events.indexOf(event);
    if (i !== -1) gs.events.splice(i, 1);
  }

  /* --- Avancement du temps : les deux régimes --- */

  /* Détermine si une date tombe dans une fenêtre de mercato.
     Mercato d'été : juillet-août. Mercato d'hiver : janvier.
     (Valeurs simples de départ, ajustables plus tard.) */
  function isMercato(dateStr) {
    const month = Number(dateStr.split("-")[1]);
    return month === 7 || month === 8 || month === 1;
  }

  /* Avance le temps d'UN cran et renvoie ce qu'il s'est passé.
     - En mercato : +1 jour (on s'arrête sur chaque jour pour
       ne manquer aucune offre).
     - Hors mercato : saut direct à la date du prochain événement.
     Renvoie { newDate, reachedEvent | null }. */
  function advance(gs) {
    const today = gs.time.currentDate;
    const next = peekNextEvent(gs);

    // Régime mercato : avancer d'un seul jour.
    if (gs.time.inMercato) {
      const newDate = addDays(today, 1);
      gs.time.currentDate = newDate;
      gs.time.inMercato = isMercato(newDate);
      // L'événement n'est "atteint" que si sa date == aujourd'hui.
      const reached = (next && compare(next.date, newDate) === 0) ? next : null;
      return { newDate, reachedEvent: reached };
    }

    // Régime hors mercato : sauter directement au prochain événement.
    if (next) {
      gs.time.currentDate = next.date;
      gs.time.inMercato = isMercato(next.date);
      return { newDate: next.date, reachedEvent: next };
    }

    // Aucun événement en file : avancer d'un jour par défaut.
    const newDate = addDays(today, 1);
    gs.time.currentDate = newDate;
    gs.time.inMercato = isMercato(newDate);
    return { newDate, reachedEvent: null };
  }

  return {
    // dates
    toDate, toStr, addDays, compare,
    // file d'événements
    addEvent, peekNextEvent, removeEvent,
    // temps
    isMercato, advance,
  };
})();

window.CalendarManager = CalendarManager;
