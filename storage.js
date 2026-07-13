/* ============================================================
   storage.js — Sauvegarde persistante par SLOTS (IndexedDB)
   ------------------------------------------------------------
   Plusieurs parties en parallèle, chacune dans son slot.
   3 slots au départ, extensible (voir SLOT_COUNT).
   Réf : Chapitre 13 — Architecture technique.

   API publique :
     Storage.init()              -> prépare la base (Promise)
     Storage.SLOT_COUNT          -> nombre de slots
     Storage.saveSlot(n, gs)     -> sauvegarde la partie dans le slot n
     Storage.loadSlot(n)         -> charge le slot n, ou null
     Storage.deleteSlot(n)       -> vide le slot n
     Storage.listSlots()         -> [{slot, empty, summary}] pour l'accueil
   ============================================================ */

const Storage = (function () {

  const DB_NAME = "president_de_club";
  const DB_VERSION = 2;               // bump : passage aux slots
  const STORE = "slots";
  const SLOT_COUNT = 3;               // nombre de slots (extensible)

  let _db = null;

  function init() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Créer le store des slots s'il n'existe pas.
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
        // Nettoyer l'ancien store "saves" (Phase 0/1 mono-partie).
        if (db.objectStoreNames.contains("saves")) {
          db.deleteObjectStore("saves");
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => reject(new Error("IndexedDB indisponible : " + e.target.error));
    });
  }

  function _key(slot) { return "slot_" + slot; }

  function _get(key) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  function _put(key, value) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  function _del(key) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /* Sauvegarde le GameState dans le slot n. */
  async function saveSlot(slot, gs) {
    await init();
    gs.meta.lastSaved = Date.now();
    gs.meta.slot = slot;
    const snapshot = structuredClone(gs);
    await _put(_key(slot), snapshot);
    return true;
  }

  /* Charge la partie du slot n (ou null si vide). */
  async function loadSlot(slot) {
    await init();
    return await _get(_key(slot));
  }

  /* Vide le slot n (le vrai "recommencer"). */
  async function deleteSlot(slot) {
    await init();
    await _del(_key(slot));
    return true;
  }

  /* --- Profil joueur GLOBAL (XP), séparé des slots ---
     Persiste même si on supprime une partie. Compte le nombre
     total de saisons jouées, toutes parties confondues. */
  const PROFILE_KEY = "profile";

  async function getProfile() {
    await init();
    const p = await _get(PROFILE_KEY);
    return p || { totalSeasons: 0 };
  }

  async function saveProfile(profile) {
    await init();
    await _put(PROFILE_KEY, structuredClone(profile));
    return true;
  }

  /* Ajoute une saison jouée au compteur global et renvoie le total. */
  async function addSeasonPlayed() {
    const p = await getProfile();
    p.totalSeasons = (p.totalSeasons || 0) + 1;
    await saveProfile(p);
    return p.totalSeasons;
  }

  /* Résumé léger d'une partie, pour l'affichage sur l'accueil. */
  function summarize(gs) {
    if (!gs) return null;
    return {
      clubName: gs.club && gs.club.name ? gs.club.name : "—",
      country: gs.club && gs.club.country ? gs.club.country : "—",
      season: gs.time ? gs.time.season : 1,
      date: gs.time ? gs.time.currentDate : null,
      lastSaved: gs.meta ? gs.meta.lastSaved : null,
    };
  }

  /* Liste l'état des slots pour l'écran d'accueil. */
  async function listSlots() {
    await init();
    const out = [];
    for (let s = 1; s <= SLOT_COUNT; s++) {
      const gs = await _get(_key(s));
      out.push({
        slot: s,
        empty: gs === null,
        summary: gs ? summarize(gs) : null,
      });
    }
    return out;
  }

  return {
    init, SLOT_COUNT,
    saveSlot, loadSlot, deleteSlot, listSlots, summarize,
    getProfile, saveProfile, addSeasonPlayed,
  };
})();

window.Storage = Storage;
