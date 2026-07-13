/* ============================================================
   managers/staff.js — Le StaffManager (Phase 3)
   ------------------------------------------------------------
   Le staff du club : entraîneur principal, recruteur, médecin.
   Noté en étoiles (1-5). Recruté à tout moment (salaire annuel).
   On démarre sans staff : chaque poste vacant est tenu par un
   INTÉRIMAIRE de très bas niveau (dépannage), jusqu'au recrutement
   d'un titulaire. Réf : ch. 9 (détaillé dans l'addendum A9).

   Effets (Phase 3) :
   - Entraîneur : bonus de forme/progression + bilan de pré-saison.
   - Recruteur : révèle le potentiel + oriente les offres (à venir).
   - Médecin : améliore forme/récupération (blessures plus tard).
   ============================================================ */

const StaffManager = (function () {

  const ROLES = ["coach", "scout", "medic"];
  const ROLE_LABEL = { coach: "Entraîneur principal", scout: "Recruteur", medic: "Médecin" };

  const PRENOMS = ["Alberto", "Gianni", "Marcello", "Ottavio", "Paolo", "Sergio",
    "Enzo", "Fabio", "Guido", "Renato", "Vittorio", "Cesare", "Aldo", "Bruno"];
  const NOMS = ["Ancelli", "Bianco", "De Luca", "Ferraro", "Gallo", "Marino",
    "Neri", "Palermo", "Riva", "Sacchi", "Tardelli", "Vialli", "Zoff", "Baggio"];

  function _rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function _round(x) { return Math.round(x * 100) / 100; }

  /* Salaire annuel selon les étoiles (~0,2 M pour 1★ à ~1,5 M pour 5★). */
  function starSalary(stars) {
    const table = { 1: 0.2, 2: 0.45, 3: 0.75, 4: 1.1, 5: 1.5 };
    return table[stars] || 0.2;
  }

  /* Intérimaire d'un poste vacant : 1 étoile, quasi gratuit, effet minime. */
  function interim(role) {
    const base = { role, name: "Intérimaire", stars: 1, salary: 0.05, interim: true };
    if (role === "coach") base.style = "eq"; // intérimaire : style neutre
    return base;
  }

  /* Initialise le staff : tous les postes vacants (donc intérimaires). */
  function init(gs) {
    if (!gs.staff) gs.staff = { coach: null, scout: null, medic: null };
    for (const r of ROLES) if (!gs.staff[r]) gs.staff[r] = null;
  }

  /* Renvoie le membre effectif d'un poste : le titulaire recruté, ou
     l'intérimaire par défaut si le poste est vacant. */
  function current(gs, role) {
    init(gs);
    return gs.staff[role] || interim(role);
  }

  /* Étoiles effectives d'un poste (intérimaire = 1). */
  function stars(gs, role) { return current(gs, role).stars; }

  /* Plafond d'étoiles atteignable selon la réputation du président.
     Un club modeste n'attire pas les meilleurs profils : un 5★ refuse
     carrément un club amateur (il n'apparaît pas). Réf : R019. */
  function starCap(gs) {
    const rep = (gs.president && gs.president.reputation) || "amateur";
    if (rep === "legende") return 5;
    if (rep === "confirme") return 4;
    return 3; // amateur
  }

  /* Tire un nombre d'étoiles pondéré : sous le plafond, les hautes
     étoiles sont plus rares (rareté progressive). */
  function _drawStars(cap) {
    // Poids décroissants vers le haut ; tronqués au plafond.
    const baseWeights = { 1: 5, 2: 5, 3: 4, 4: 2, 5: 1 };
    const pool = [];
    for (let s = 1; s <= cap; s++) {
      for (let i = 0; i < baseWeights[s]; i++) pool.push(s);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const STYLES = ["off", "def", "eq"];
  const STYLE_LABEL = { off: "Offensif", def: "Défensif", eq: "Équilibré" };

  /* Génère une liste de candidats variés pour un poste, bornée par la
     réputation du club (plafond + rareté progressive). */
  function generateCandidates(gs, role, n) {
    const list = [];
    n = n || 4;
    const cap = starCap(gs);
    for (let i = 0; i < n; i++) {
      const st = _drawStars(cap);
      const cand = {
        role,
        name: _pick(PRENOMS) + " " + _pick(NOMS),
        stars: st,
        salary: _round(starSalary(st) * _rand(90, 115) / 100),
        interim: false,
      };
      // L'entraîneur a un style de jeu.
      if (role === "coach") cand.style = _pick(STYLES);
      list.push(cand);
    }
    return list.sort((a, b) => b.stars - a.stars);
  }

  /* Recrute un candidat pour son poste (remplace le titulaire éventuel).
     Pas d'indemnité : on prend en charge son salaire (masse salariale). */
  function hire(gs, candidate) {
    init(gs);
    gs.staff[candidate.role] = {
      role: candidate.role, name: candidate.name,
      stars: candidate.stars, salary: candidate.salary, interim: false,
      style: candidate.style, // pour l'entraîneur
    };
    return gs.staff[candidate.role];
  }

  /* Licencie le titulaire d'un poste : il redevient vacant (intérimaire). */
  function dismiss(gs, role) {
    init(gs);
    gs.staff[role] = null;
  }

  /* Masse salariale annuelle du staff (titulaires seulement ; les
     intérimaires ont un coût symbolique compté aussi). */
  function annualStaffWages(gs) {
    init(gs);
    let total = 0;
    for (const r of ROLES) total += current(gs, r).salary;
    return _round(total);
  }

  /* --- EFFETS DU STAFF (Phase 3) --- */

  /* Bonus de forme apporté par l'entraîneur + le médecin au démarrage
     de saison (s'ajoute au stage). ~ +1 par étoile au-dessus de 1. */
  function formBonus(gs) {
    const coach = stars(gs, "coach");
    const medic = stars(gs, "medic");
    return (coach - 1) * 1.2 + (medic - 1) * 0.8;
  }

  /* Le recruteur révèle-t-il le potentiel d'un joueur proposé ?
     3★+ : potentiel estimé avec précision ; sinon fourchette floue. */
  function scoutRevealsPotential(gs) {
    return stars(gs, "scout") >= 3;
  }

  /* --- STYLES : bonus d'équipe & évolution ---
     Plus il y a de joueurs partageant le style de l'entraîneur, plus
     l'équipe reçoit un bonus global de performance (le plus simple :
     proportionnel à la part de joueurs alignés). Peu importe le style. */
  function teamStyleBonus(gs) {
    const coach = current(gs, "coach");
    const coachStyle = coach.style || "eq";
    const squad = gs.players.filter(p => p.clubId === gs.club.id);
    if (squad.length === 0) return 0;
    const aligned = squad.filter(p => p.style === coachStyle).length;
    const ratio = aligned / squad.length;
    // Bonus jusqu'à +6 points de force si toute l'équipe est alignée.
    return _round(ratio * 6);
  }

  /* Évolution de style en fin de saison : l'entraîneur convertit
     progressivement des joueurs vers son style. Plus le joueur est
     jeune et plus l'entraîneur est fort, plus la conversion est probable.
     Renvoie la liste des joueurs convertis (pour information). */
  function evolveStyles(gs) {
    const coach = current(gs, "coach");
    const coachStyle = coach.style || "eq";
    const coachStars = coach.stars || 1;
    const squad = gs.players.filter(p => p.clubId === gs.club.id);
    const converted = [];
    for (const p of squad) {
      if (p.style === coachStyle) continue;
      let chance = 0;
      if (p.age <= 21) chance = 0.30;
      else if (p.age <= 25) chance = 0.20;
      else if (p.age <= 29) chance = 0.10;
      else chance = 0.04;
      chance *= (0.4 + 0.15 * coachStars);
      if (Math.random() < chance) {
        p.style = coachStyle;
        converted.push(p.name);
      }
    }
    return converted;
  }

  /* --- BILAN DE PRÉ-SAISON DE L'ENTRAÎNEUR ---
     S'appuie sur l'analyse d'effectif (TransferManager.analyzeSquad).
     La qualité/précision du bilan dépend des étoiles de l'entraîneur. */
  function preseasonReport(gs) {
    const coachStars = stars(gs, "coach");
    const analysis = TransferManager.analyzeSquad(gs, gs.club.id);
    const clubStrength = gs.clubs.find(c => c.id === gs.club.id).strength || 55;
    const MIN = TransferManager.MIN_PER_POSTE;
    const posteNom = { G: "gardiens", D: "défenseurs", M: "milieux", A: "attaquants" };

    const points = [];
    for (const poste of ["G", "D", "M", "A"]) {
      const info = analysis[poste];
      if (info.count < MIN[poste]) {
        points.push(`Effectif trop court chez les ${posteNom[poste]} (${info.count}).`);
      } else if (info.avg < clubStrength - 3) {
        points.push(`Le niveau des ${posteNom[poste]} est en dessous du reste de l'équipe.`);
      }
      // Vieillissement : signalé si entraîneur suffisamment bon.
      if (coachStars >= 2) {
        const vieux = info.players.filter(p => p.age >= 31).length;
        if (vieux >= 2) points.push(`Le secteur des ${posteNom[poste]} vieillit (${vieux} joueurs de 31 ans ou plus).`);
      }
    }

    let intro;
    if (coachStars <= 1) intro = "Bilan sommaire (entraîneur intérimaire) :";
    else if (coachStars <= 3) intro = "Bilan de pré-saison de l'entraîneur :";
    else intro = "Analyse détaillée de l'entraîneur :";

    if (points.length === 0) points.push("L'effectif est équilibré, pas de faiblesse majeure détectée.");
    // Un bon entraîneur ajoute une recommandation de priorité.
    if (coachStars >= 4 && points.length > 1) {
      points.push("Priorité recommandée : traiter d'abord le secteur le plus court.");
    }
    return { intro, points, coachStars };
  }

  return {
    ROLES, ROLE_LABEL, STYLES, STYLE_LABEL, starSalary, interim, init, current, stars,
    generateCandidates, starCap, hire, dismiss, annualStaffWages,
    formBonus, scoutRevealsPotential, preseasonReport,
    teamStyleBonus, evolveStyles,
  };
})();

window.StaffManager = StaffManager;
