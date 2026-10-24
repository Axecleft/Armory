/**
 * Axecleft's Armory — socket crystals (1.14.9.26).
 *
 * A world setting (off by default) lets owners set one crystal into a magic weapon, armor or shield their character
 * carries, and take it out again. Setting a crystal adds one D35E enhancement entry to the item (marked as the
 * crystal's), so D35E applies its changes, resistances, damage reduction and weapon damage the way it applies the
 * item's other enhancements; the crystal's context notes are added to the item's notes. Taking it out removes exactly
 * those and gives the crystal back. Compendium items and items in the sidebar are never touched.
 *
 * Crystals: the Armory's homebrew examples (data/socket-crystals.json, flags["axeclefts-armory"].crystal) and any item
 * with the Magic Item Compendium import's crystal data (flags.world.mic.crystal).
 *
 * Switching the setting off hides the buttons for setting crystals and the crafting and generator pages; items that
 * already hold a crystal keep it (and can still have it taken out). api.sockets.detachAll() takes every crystal out.
 *
 *   const S = game.modules.get("axeclefts-armory").api.sockets;
 *   await S.attach(weapon, crystal);  await S.detach(weapon);  await S.detachAll();
 *   S.register({ key, name, slot: ["weapon"], rank: "least", price, cl, aura, spells, look, text, effect });  // your own
 *   S.itemData("cinder-shard")  // a crystal's item data, ready for Item.create
 */
import * as D from "./armory-d35e.js";

const MOD = "axeclefts-armory";
const { gp, num, t } = D;
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const H = (s, d) => esc(t(s, d));
const opt = (v, label, sel, extra = "") => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}${extra}>${esc(label)}</option>`;
const ordn = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
const clone = (v) => foundry.utils.deepClone(v);
const RANK_MIN = { least: 0, lesser: 1, greater: 3 };
const RANKS = { least: /*t*/"least", lesser: /*t*/"lesser", greater: /*t*/"greater" };
const SLOT_WORD = { weapon: /*t*/"weapon", armor: /*t*/"armor", shield: /*t*/"shield" };
const SLOT_A = { weapon: /*t*/"a weapon", armor: /*t*/"armor", shield: /*t*/"a shield" };
const SLOT_PL = { weapon: /*t*/"weapons", armor: /*t*/"armor", shield: /*t*/"shields" };
const ARMOR_WORD = { lightArmor: /*t*/"light armor", mediumArmor: /*t*/"medium armor", heavyArmor: /*t*/"heavy armor" };
const STORE = "axeclefts-armory.sockets.";
const recall = (k, d) => { try { return localStorage.getItem(STORE + k) ?? d; } catch (e) { return d; } };
const remember = (k, v) => { try { localStorage.setItem(STORE + k, v); } catch (e) { /* private mode */ } };
const Dlg = () => globalThis.AxecleftTools?.DialogV2 ?? foundry.applications?.api?.DialogV2;

/** A name from this module's English data as shown in the world's language: the word file's entry, else the name given
 *  (Babele's), else the English; first letter capitalised for lists. */
const dn = (en, shown) => {
  const s = String(globalThis.AxecleftTools?.word?.(en, { text: shown ?? null })?.text || shown || en || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export class ArmorySockets {
  constructor(api) { this.api = api; this.examples = []; this.custom = []; this.found = []; this.loaded = null; }

  /* ---------- Setting ---------- */
  enabled() { try { return !!game.settings.get(MOD, "sockets"); } catch (e) { return false; } }

  load() {
    this.loaded ??= foundry.utils.fetchJsonWithTimeout(`modules/${MOD}/data/socket-crystals.json`)
      .then((d) => { this.examples = (d.crystals ?? []).map((c) => ({ ...c, example: true })); return this.examples; })
      .catch((err) => { console.error(`${MOD} | could not load data/socket-crystals.json`, err); return []; });
    return this.loaded;
  }

  /** Every crystal: the examples, the world's own (register) and the crystals in the item sources (the MIC import…). */
  get list() { return [...this.examples, ...this.custom, ...this.found]; }

  /** The examples, then a fresh read of the item sources (Treasure Lists → item sources), so newly imported crystals show up. */
  async prepare() { await this.load(); await this.scan(); }

  /**
   * Socket crystals in the item compendiums the Treasure Generator reads: any item with crystal data
   * (the Magic Item Compendium import's flags.world.mic.crystal, or the Armory's own flags["axeclefts-armory"].crystal).
   */
  async scan() {
    const hub = globalThis.AxecleftTreasure;
    const packs = [...new Set(hub?.itemSources?.().packs ?? [])];
    const out = new Map();
    let tagged = 0;
    for (const id of packs) {
      const pack = game.packs.get(id);
      if (!pack || pack.documentName !== "Item") continue;
      let index;
      try { index = await D.enIndex(pack, { fields: ["system.price", "system.tags", `flags.${MOD}.crystal`, "flags.world.mic.crystal"] }); } catch (e) { continue; }
      for (const e of index) {
        if (e.type === "Folder") continue;
        const c = e.flags?.[MOD]?.crystal ?? e.flags?.world?.mic?.crystal;
        if (!c || !Array.isArray(c.slot) || !c.slot.length) {
          if ((e.system?.tags ?? []).some((tg) => /augment crystal|socket crystal/i.test(String(tg?.[0] ?? tg)))) tagged++;
          continue;
        }
        const name = e.display ?? e.name, k = name.toLowerCase();
        if (out.has(k) || this.examples.some((x) => x.name.toLowerCase() === k) || this.custom.some((x) => x.name.toLowerCase() === k)) continue;
        out.set(k, { key: `${id}.${e._id}`, name, en: e.name, slot: [...c.slot], rank: RANK_MIN.hasOwnProperty(c.rank) ? c.rank : "least", minEnhancement: c.minEnhancement,
          meleeOnly: !!c.meleeOnly, armorTypes: [...(c.armorTypes ?? [])], price: Number(e.system?.price) || 0, pack: id, id: e._id, from: pack.metadata?.label ?? id });
      }
    }
    this.found = [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (tagged) console.warn(`${MOD} | ${tagged} item(s) tagged Augment crystal in your item sources have no crystal data (flags.world.mic.crystal); they can't be set into items. Re-import them from the MIC repository.`);
    return this.found;
  }

  /** Item data for any crystal: an example or your own (built), or a compendium crystal (copied). */
  async dataFor(c, { identified = true } = {}) {
    if (!c.pack) return this.itemData(c, { identified });
    const doc = await game.packs.get(c.pack)?.getDocument(c.id);
    if (!doc) throw new Error(t("Could not read {name}.", { name: c.name }));
    const data = doc.toObject();
    delete data._id; delete data.folder; delete data.sort; delete data.ownership;
    data._stats = { compendiumSource: doc.uuid };
    foundry.utils.setProperty(data, "system.quantity", 1);
    foundry.utils.setProperty(data, "system.equipped", false);
    foundry.utils.setProperty(data, "system.identified", identified);
    return data;
  }

  /** Add a crystal definition of your own (same fields as data/socket-crystals.json). */
  register(def) {
    if (!def?.name || !Array.isArray(def.slot) || !RANK_MIN.hasOwnProperty(def.rank)) throw new Error(t("A socket crystal needs a name, a slot list and a rank (least, lesser or greater)."));
    const key = def.key ?? def.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    this.custom = this.custom.filter((c) => c.key !== key);
    this.custom.push({ ...def, key });
    return key;
  }

  find(keyOrName) {
    const k = String(keyOrName ?? "").toLowerCase();
    return this.list.find((c) => c.key.toLowerCase() === k || c.name.toLowerCase() === k || c.en?.toLowerCase() === k) ?? null;
  }

  /* ---------- Crystal items ---------- */
  /** A crystal definition → D35E equipment item data (slotless; the crystal data in flags["axeclefts-armory"].crystal). */
  itemData(defOrKey, { identified = true } = {}) {
    const c = typeof defOrKey === "string" ? this.find(defOrKey) : defOrKey;
    if (!c) throw new Error(t("Unknown socket crystal \"{name}\".", { name: defOrKey }));
    const e = c.effect ?? {};
    const minEnh = Number.isFinite(Number(c.minEnhancement)) ? Number(c.minEnhancement) : RANK_MIN[c.rank];
    const uses = e.uses?.max ? { per: e.uses.per ?? "day", value: Number(e.uses.max), max: Number(e.uses.max), maxFormula: String(e.uses.max), autoDeductCharges: false } : { per: "", value: 0, max: 0, maxFormula: "" };
    const activation = e.activation ? { type: e.activation.type ?? "", cost: e.activation.cost ?? 1 } : { type: "", cost: 1 };
    const fits = this.fitsText(c, minEnh);
    const act = e.activation?.type ? t("{type} action", { type: t(e.activation.type) }) : "—";
    const line = `${c.aura ?? ""}; ${t("CL {cl}", { cl: ordn(Number(c.cl) || 1) })}; ${["Craft Magic Arms and Armor", ...(c.spells ?? []).map((g) => g.join(t(" or ")))].join(", ")}; `
      + `${t("Price {price}", { price: gp(c.price) })}; ${t("Cost {gp} + {xp} XP", { gp: gp(c.price / 2), xp: num(Math.round(c.price / 25)) })}.`;
    const html = `<p><strong>${H("Rank")}</strong> ${H("{rank} socket crystal", { rank: t(RANKS[c.rank]) })}<br><strong>${H("Fits")}</strong> ${esc(fits)}<br>`
      + `<strong>${H("Price")}</strong> ${esc(gp(c.price))}<br><strong>${H("Caster level")}</strong> ${esc(ordn(Number(c.cl) || 1))}<br><strong>${H("Aura")}</strong> ${esc(c.aura ?? "—")}<br>`
      + `<strong>${H("Activation")}</strong> ${esc(act)}<br><strong>${H("Weight")}</strong> —</p>`
      + (c.look ? `<p><em>${esc(c.look)}</em></p>` : "") + `<p>${esc(c.text ?? "")}</p>`
      + `<p><strong>${H("Socket crystal.")}</strong> ${H("Set it into {fits}: open that item's sheet on your character and use Socket crystal (or this crystal's Set into… button). An item holds one crystal; taking it out gives the crystal back. While it is set, its effects work like the item's own enhancements.", { fits })}</p>`
      + `<p><em>${esc(line)}</em></p><p><small>${H(c.example ? "Axecleft's Armory: a homebrew example socket crystal." : "A socket crystal.")}</small></p>`;
    const notes = (e.contextNotes ?? []).map((n) => [...n]);
    return {
      name: dn(c.en ?? c.name, c.name), type: "equipment", img: c.img ?? "systems/D35E/icons/items/magic/gems/Jewelry_06_bluecrystal.png",
      system: {
        equipmentType: "misc", equipmentSubtype: "wondrous", slot: "slotless", price: Number(c.price) || 0, weight: 0, quantity: 1, equipped: false,
        identified, identifiedName: dn(c.en ?? c.name, c.name), unidentified: { name: t("Socket crystal"), price: Number(c.price) || 0 },
        // Equipped on its own (sockets off, or by hand), it still works like the Magic Item Compendium's crystals: changes, notes, resistances
        changes: clone(e.changes ?? []), contextNotes: notes, resistances: clone(e.resistances ?? []), damageReduction: clone(e.damageReduction ?? []),
        uses, activation, effectNotes: e.effectNotes ?? "",
        description: { value: html, chat: "", unidentified: `<p>${H("A small crystal shaped to be set into a weapon, armor or shield.")}</p>` },
        tags: [[c.slot.includes("weapon") ? "Shop: Magic weapons" : "Shop: Magic armor"], ["Augment crystal"], ["Socket crystal"]],
        source: c.example ? "Axecleft's Armory (homebrew example)" : (c.source ?? ""),
      },
      flags: { [MOD]: { crystal: { key: c.key, slot: [...c.slot], rank: c.rank, minEnhancement: minEnh, masterwork: true,
        armorTypes: [...(c.armorTypes ?? [])], meleeOnly: !!c.meleeOnly, effect: { ...clone(e), contextNotes: notes, uses, activation } } } },
    };
  }

  fitsText(c, minEnh) {
    const slots = c.slot.map((s) => t(SLOT_A[s] ?? s)).join(t(" or "));
    const need = minEnh > 0 ? t("{slots} with an enhancement bonus of +{n} or better", { slots, n: minEnh }) : t("{slots} (masterwork or magic)", { slots });
    const extra = [];
    if (c.meleeOnly) extra.push(t("melee weapons only"));
    if (c.armorTypes?.length) extra.push(t("{types} only", { types: c.armorTypes.map((a) => t(ARMOR_WORD[a] ?? a)).join(t(" or ")) }));
    return extra.length ? `${need} (${extra.join("; ")})` : need;
  }

  /** The crystal data of an item (the Armory's or the Magic Item Compendium import's), or null. */
  crystalOf(item) {
    const c = item?.flags?.[MOD]?.crystal ?? item?.flags?.world?.mic?.crystal ?? null;
    return c && Array.isArray(c.slot) && c.effect ? c : null;
  }

  /* ---------- Host items ---------- */
  hostKind(item) { const k = D.armsKind(item); return k === "weapon" || k === "armor" || k === "shield" ? k : null; }
  socketOf(item) { return item?.flags?.[MOD]?.socket ?? null; }
  /** Only items on a character, never compendium or sidebar items. */
  onActor(item) { return !!(item?.actor && !item.pack && !item.actor.pack); }

  bonusOf(item) {
    const k = this.hostKind(item);
    return k === "weapon" ? Number(item.system?.enh) || 0 : Number(item.system?.armor?.enh) || 0;
  }

  /** Why this crystal can't go into this item (text), or null when it fits. */
  problem(host, crystalItem) {
    const c = this.crystalOf(crystalItem);
    if (!c) return t("{name} is not a socket crystal.", { name: crystalItem?.name ?? "?" });
    const k = this.hostKind(host);
    if (!k) return t("{name} is not a weapon, armor or shield.", { name: host?.name ?? "?" });
    if (!this.onActor(host)) return t("Crystals are set into items a character carries, not compendium or sidebar items.");
    if (crystalItem.actor && crystalItem.actor !== host.actor) return t("The crystal and the item must be on the same character.");
    if (this.socketOf(host)) return t("{name} already holds a crystal ({crystal}); take it out first.", { name: host.name, crystal: this.socketOf(host).name });
    if (!c.slot.includes(k)) return t("{crystal} fits {slots}, not {kind}.", { crystal: crystalItem.name, slots: c.slot.map((s) => t(SLOT_PL[s] ?? s)).join(t(" or ")), kind: t(SLOT_PL[k]) });
    const bonus = this.bonusOf(host), min = Number.isFinite(Number(c.minEnhancement)) ? Number(c.minEnhancement) : RANK_MIN[c.rank] ?? 0;
    if (min > 0 && bonus < min) return t("{crystal} needs an item with an enhancement bonus of +{n} or better ({name} has +{bonus}; special abilities don't count).", { crystal: crystalItem.name, n: min, name: host.name, bonus });
    if (!host.system?.masterwork && bonus < 1) return t("{crystal} needs a masterwork or magic item.", { crystal: crystalItem.name });
    if (k === "weapon" && c.meleeOnly && host.system?.weaponSubtype === "ranged") return t("{crystal} works only in melee weapons.", { crystal: crystalItem.name });
    if (k === "armor" && c.armorTypes?.length && !c.armorTypes.includes(host.system?.equipmentSubtype)) return t("{crystal} works only in {types}.", { crystal: crystalItem.name, types: c.armorTypes.map((a) => t(ARMOR_WORD[a] ?? a)).join(t(" or ")) });
    return null;
  }

  /** The D35E enhancement entry that carries the crystal's effects on the host item. */
  async entry(host, crystalItem, c, kind) {
    const weaponish = kind === "weapon", e = c.effect ?? {};
    let like = null;
    try { await this.api.loaded; } catch (err) { /* armory.json missing */ }
    try { like = await this.api.builder?.enhancementDoc?.(weaponish ? "Defending" : "Invulnerability"); } catch (err) { /* no enhancement sources: a plain entry */ }
    const en = like ? D.enhancementCopy(like, 0) : { id: `${foundry.utils.randomID()}-${foundry.utils.randomID()}`, type: "enhancement", system: {} };
    en.name = crystalItem.name;
    en.img = crystalItem.img;
    const blankWeapon = { alignment: { chaotic: false, evil: false, good: false, lawful: false }, attackRoll: "", damageRoll: "", damageType: "", damageTypeId: "", optionalDamage: false };
    const u = e.uses ?? {};
    Object.assign(en.system, {
      enhancementType: weaponish ? "weapon" : "armor", enh: 0, enhIsLevel: false, enhIncrease: 0, enhIncreaseFormula: "0", price: 0, priceFormula: "",
      properties: {}, nameExtension: { prefix: "", suffix: "" },
      changes: clone(e.changes ?? []), contextNotes: [], resistances: clone(e.resistances ?? []), damageReduction: clone(e.damageReduction ?? []), combatChanges: [],
      weaponData: { ...blankWeapon, ...(weaponish ? clone(e.weaponData ?? {}) : {}) }, weaponAttackNotes: [], allowedTypes: weaponish ? [["weapon"]] : [],
      uses: { ...(en.system.uses ?? {}), ...clone(u), value: Number(u.max) ? Number(u.value ?? u.max) : 0, max: Number(u.max) || 0, maxFormula: String(u.maxFormula ?? (Number(u.max) || "")), per: Number(u.max) ? (u.per || "day") : "" },
      activation: { ...(en.system.activation ?? {}), ...clone(e.activation ?? { type: "", cost: 1 }) },
      effectNotes: e.effectNotes ?? "",
      description: { value: crystalItem.system?.description?.value ?? "", chat: "", unidentified: "" },
    });
    en.flags = { ...(en.flags ?? {}), [MOD]: { socket: true } };
    return en;
  }

  /** Set a crystal (an item on the same character) into a weapon, armor or shield. */
  async attach(host, crystalItem, { remakeAttack = true, quiet = false } = {}) {
    if (!this.enabled()) throw new Error(t("Socket crystals are switched off in this world (Axecleft's Armory settings)."));
    const why = this.problem(host, crystalItem);
    if (why) throw new Error(why);
    const c = this.crystalOf(crystalItem), kind = this.hostKind(host), e = c.effect ?? {};
    const en = await this.entry(host, crystalItem, c, kind);
    const named = (txt) => (String(txt).startsWith(crystalItem.name) ? String(txt) : `${crystalItem.name}: ${txt}`);
    const notes = (e.contextNotes ?? []).map((n) => [named(n[0]), n[1], n[2]]);
    const crystal = crystalItem.toObject();
    delete crystal._id; delete crystal.folder; delete crystal.sort;
    crystal.system.quantity = 1; crystal.system.equipped = false;
    const update = {
      "system.enhancements.items": [...(host.system?.enhancements?.items ?? []).map(clone), en],
      "system.contextNotes": [...(host.system?.contextNotes ?? []).map(clone), ...notes],
      [`flags.${MOD}.socket`]: { entryId: en.id, name: crystalItem.name, img: crystalItem.img, notes, crystal, light: null },
    };
    if (e.light && kind === "weapon") {
      update[`flags.${MOD}.socket`].light = clone(host.system?.light ?? {});
      const l = { ...(host.system?.light ?? {}), emitLight: true, radius: e.light.bright ?? 0, dimRadius: e.light.dim ?? "", lightAngle: 360 };
      update["system.light"] = l;
    }
    await host.update(update, { axecleft: true });
    const q = Number(crystalItem.system?.quantity) || 1;
    if (q > 1) await crystalItem.update({ "system.quantity": q - 1 }, { axecleft: true });
    else await crystalItem.delete();
    if (remakeAttack) await this.remakeAttack(host);
    if (!quiet) ui.notifications.info(t("{crystal} is set into {name}.", { crystal: crystal.name, name: host.name }));
    return host;
  }

  /** Take the crystal out of an item and give it back to the character. Works whether the setting is on or off. */
  async detach(host, { remakeAttack = true, quiet = false } = {}) {
    const s = this.socketOf(host);
    if (!s) throw new Error(t("{name} holds no crystal.", { name: host?.name ?? "?" }));
    const items = (host.system?.enhancements?.items ?? []).filter((x) => x.id !== s.entryId && !x.flags?.[MOD]?.socket).map(clone);
    const notes = (host.system?.contextNotes ?? []).map(clone);
    for (const n of s.notes ?? []) {
      const i = notes.findIndex((x) => x[0] === n[0] && x[1] === n[1] && x[2] === n[2]);
      if (i >= 0) notes.splice(i, 1);
    }
    const update = { "system.enhancements.items": items, "system.contextNotes": notes, [`flags.${MOD}.-=socket`]: null };
    if (s.light) update["system.light"] = s.light;
    await host.update(update, { axecleft: true });
    let crystal = null;
    if (s.crystal && host.actor) [crystal] = await host.actor.createEmbeddedDocuments("Item", [s.crystal]);
    if (remakeAttack) await this.remakeAttack(host);
    if (!quiet) ui.notifications.info(t("{crystal} is taken out of {name}.", { crystal: s.name, name: host.name }));
    return crystal;
  }

  /** A weapon's D35E attack item, if it has one, is made again so it picks up (or drops) the crystal's damage. */
  async remakeAttack(host) {
    const actor = host?.actor;
    if (host?.type !== "weapon" || typeof actor?.createAttackFromWeapon !== "function") return;
    const old = actor.items.find((i) => i.type === "attack" && i.system?.originalWeaponId === host.id);
    if (!old) return;
    try { await old.delete(); await actor.createAttackFromWeapon(actor.items.get(host.id) ?? host); }
    catch (err) { console.warn(`${MOD} | could not remake the attack for ${host.name}`, err); }
  }

  /** Take every crystal out of every item on every character and token in the world (GM). Returns how many. */
  async detachAll() {
    if (!game.user?.isGM) throw new Error(t("Only a GM can take out every crystal."));
    const actors = new Set(game.actors ?? []);
    for (const sc of game.scenes ?? []) for (const tk of sc.tokens ?? []) if (!tk.actorLink && tk.actor) actors.add(tk.actor);
    let n = 0;
    for (const a of actors) for (const it of [...(a.items ?? [])]) {
      if (!this.socketOf(it)) continue;
      try { await this.detach(it, { quiet: true }); n++; } catch (err) { console.warn(`${MOD} | could not take the crystal out of ${it.name} (${a.name})`, err); }
    }
    ui.notifications.info(t("{n} socket crystals taken out.", { n }));
    return n;
  }

  /* ---------- Sheets ---------- */
  /** Header button on a weapon, armor or shield sheet (and on a crystal's sheet) of a character's item. */
  headerButton(item) {
    if (!item || item.documentName !== "Item" || !item.isOwner || !this.onActor(item)) return null;
    if (this.hostKind(item)) {
      const held = this.socketOf(item);
      if (!held && !this.enabled()) return null; // switched off: only items that hold a crystal keep the button (to take it out)
      return { label: held ? t("Crystal: {name}", { name: held.name }) : t("Socket crystal"), icon: "fas fa-gem", run: () => this.hostDialog(item) };
    }
    if (this.crystalOf(item) && this.enabled()) return { label: t("Set into…"), icon: "fas fa-gem", run: () => this.crystalDialog(item) };
    return null;
  }

  async hostDialog(host) {
    const DV = Dlg();
    const held = this.socketOf(host);
    if (held) {
      const ok = await DV.confirm({ window: { title: t("Socket crystal") }, content: `<p>${H("{name} holds {crystal}.", { name: host.name, crystal: held.name })}</p><p>${H("Take it out? The crystal goes back into the inventory.")}</p>`,
        yes: { label: t("Take it out"), icon: "fas fa-gem" }, no: { label: t("Keep it"), icon: "fas fa-xmark" } });
      if (ok) await this.detach(host).catch((err) => ui.notifications.warn(err.message));
      return;
    }
    const crystals = host.actor.items.filter((i) => this.crystalOf(i));
    if (!crystals.length) return ui.notifications.warn(t("{actor} carries no socket crystals.", { actor: host.actor.name }));
    const rows = crystals.map((c) => ({ c, why: this.problem(host, c) }));
    const content = `<p>${H("Choose a crystal from {actor}'s inventory to set into {name}.", { actor: host.actor.name, name: host.name })}</p>
      <div class="form-group"><label>${H("Crystal")}</label><select name="crystal">${rows.map(({ c, why }) => opt(c.id, why ? `${dn(c.name)} — ${why}` : dn(c.name), rows.find((r) => !r.why)?.c.id, why ? " disabled" : "")).join("")}</select></div>`;
    if (!rows.some((r) => !r.why)) return ui.notifications.warn(rows[0].why);
    const id = await DV.wait({ window: { title: t("Socket crystal") }, content, rejectClose: false,
      buttons: [{ action: "set", label: t("Set it"), icon: "fas fa-gem", default: true, callback: (ev, button) => button.form?.elements?.crystal?.value ?? null },
        { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => null }] });
    if (!id || id === "cancel" || id === "set") return;
    const crystal = host.actor.items.get(id);
    if (crystal) await this.attach(host, crystal).catch((err) => ui.notifications.warn(err.message));
  }

  async crystalDialog(crystal) {
    const DV = Dlg();
    const hosts = crystal.actor.items.filter((i) => this.hostKind(i));
    const rows = hosts.map((h) => ({ h, why: this.problem(h, crystal) }));
    if (!rows.some((r) => !r.why)) return ui.notifications.warn(rows[0]?.why ?? t("{actor} carries no weapon, armor or shield this crystal fits.", { actor: crystal.actor.name }));
    const content = `<p>${H("Set {crystal} into:", { crystal: crystal.name })}</p>
      <div class="form-group"><label>${H("Item")}</label><select name="host">${rows.map(({ h, why }) => opt(h.id, why ? `${h.name} — ${why}` : h.name, rows.find((r) => !r.why)?.h.id, why ? " disabled" : "")).join("")}</select></div>`;
    const id = await DV.wait({ window: { title: t("Socket crystal") }, content, rejectClose: false,
      buttons: [{ action: "set", label: t("Set it"), icon: "fas fa-gem", default: true, callback: (ev, button) => button.form?.elements?.host?.value ?? null },
        { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => null }] });
    if (!id || id === "cancel" || id === "set") return;
    const host = crystal.actor.items.get(id);
    if (host) await this.attach(host, crystal).catch((err) => ui.notifications.warn(err.message));
  }

  /* ---------- Crafting (Crafting window) ---------- */
  craftContent({ values: v }) {
    const groups = [["weapon", /*t*/"Weapon crystals"], ["armor", /*t*/"Armor crystals"], ["shield", /*t*/"Shield crystals"]];
    const sel = v.crystal ?? this.list[0]?.key ?? "";
    const opts = groups.map(([s, l]) => {
      const list = this.list.filter((c) => c.slot[0] === s);
      return list.length ? `<optgroup label="${H(l)}">${list.map((c) => opt(c.key, `${dn(c.en ?? c.name, c.name)} (${t(RANKS[c.rank])}, ${gp(c.price)})${c.from ? ` — ${c.from}` : ""}`, sel)).join("")}</optgroup>` : "";
    }).join("");
    return `<p class="hint">${H("Socket crystals: small crystals an owner sets into a magic weapon, armor or shield (one per item) and can take out again. The Armory's are homebrew examples; see data/socket-crystals.json to make your own.")} ${H("Crystals in your item compendiums (such as the Magic Item Compendium's augment crystals) are listed too.")}</p>
      <div class="form-group"><label>${H("Crystal")}</label><select name="craft.crystal">${opts}</select></div>
      <div class="form-group"><label>${H("Quantity")}</label><input type="number" name="craft.cquantity" min="1" max="20" value="${esc(v.cquantity ?? 1)}"></div>`;
  }

  async craftEvaluate({ actor, values: v }) {
    await this.load();
    if (!this.found.length) await this.scan();
    const c = this.find(v.crystal);
    if (!c) throw new Error(t("Choose a crystal to make."));
    const quantity = Math.max(1, Math.min(20, Math.floor(Number(v.cquantity) || 1)));
    if (c.pack) return this.craftCompendium(c, actor, quantity);
    const data = this.itemData(c, { identified: true });
    const cl = Math.max(5, Number(c.cl) || 1);
    return {
      magic: true, feat: "Craft Magic Arms and Armor", name: dn(c.en ?? c.name, c.name), img: data.img, data, quantity, market: c.price, base: c.price,
      casterLevel: cl, casterNote: Number(c.cl) > 5 ? t("the crystal's caster level {n}", { n: c.cl }) : "Craft Magic Arms and Armor 5",
      spells: (c.spells ?? []).map((g) => ({ any: g, for: c.name })), requirements: [], checks: [],
      notes: [t("Homebrew socket crystal: half its price in gp and 1/25 in XP, by the SRD rules for magic items.")],
      summary: t("{rank} socket crystal; fits {fits}", { rank: t(RANKS[c.rank]), fits: this.fitsText(c, Number.isFinite(Number(c.minEnhancement)) ? Number(c.minEnhancement) : RANK_MIN[c.rank]) }),
    };
  }

  /** A compendium crystal (the MIC import…): its construction line gives the caster level, spells, other prerequisites and cost. */
  async craftCompendium(c, actor, quantity) {
    const C = globalThis.AxecleftCrafting;
    const data = await this.dataFor(c, { identified: true });
    const price = Number(data.system?.price) || c.price;
    if (!(price > 0)) throw new Error(t("{name} has no price.", { name: data.name }));
    const html = data.system?.description?.value ?? "";
    const curios = game.modules.get("axeclefts-curios")?.api?.spells;
    try { await curios?.index?.(); } catch (e) { /* Curios not loaded */ }
    const myFeats = C?.actor?.feats?.(actor) ?? new Set();
    let known = new Set();
    try { known = (await this.api.specificCraft?.featNames?.()) ?? known; } catch (e) { /* no feat list */ }
    const norm = (x) => String(x ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
    const pre = C?.parsePrereqs?.(html, {
      spell: (x) => curios?.resolveName?.(x) ?? (/^[a-z][a-z' ,/-]+$/i.test(x) && !/creator|caster|must|rank|level|bonus/i.test(x) ? x : null),
      isFeat: (x) => myFeats.has(norm(x)) || known.has(norm(x)), itemName: c.en ?? data.name,
    }) ?? null;
    const plan = { magic: true, feat: "Craft Magic Arms and Armor", name: data.name, img: data.img, data, quantity, market: price, requirements: [], checks: [], notes: [], spells: [] };
    let cl = 5;
    const why = [];
    if (pre?.minCl && pre.minCl > cl) { cl = pre.minCl; why.push(t("the item needs {n}", { n: pre.minCl })); }
    const sp = pre ? await curios?.minClOfGroups?.(pre.spells)?.catch?.(() => null) : null;
    if (sp && sp.cl > cl) { cl = sp.cl; why.push(t("{spell} needs caster level {n}", { spell: curios?.shownName?.(sp.spell) ?? sp.spell, n: sp.cl })); }
    plan.casterLevel = cl;
    plan.casterNote = `${why.join("; ") || "Craft Magic Arms and Armor 5"}${pre?.cl ? t("; the item works at caster level {n}", { n: pre.cl }) : ""}`;
    if (!pre) {
      plan.base = price;
      plan.requirements.push({ key: "line", label: t("Prerequisites"), ok: "warn", detail: t("no construction line in its description; the GM decides (see How requirements are found)"), waivable: true });
    } else {
      for (const f of pre.feats) if (norm(f) !== norm(plan.feat)) {
        const has = myFeats.has(norm(f));
        plan.requirements.push({ key: `feat.${f}`, label: f, ok: has, detail: has ? t("has the feat") : t("doesn't have the feat"), waivable: !/^(craft|forge|scribe|brew)\b/i.test(f) });
      }
      plan.spells = pre.spells.map((g) => ({ any: g, for: data.name }));
      for (const o of pre.other) plan.requirements.push({ key: `other.${o}`, label: o[0].toUpperCase() + o.slice(1), ok: "warn", detail: t("the GM checks this"), waivable: true });
      if (pre.cost?.xp) { plan.base = pre.cost.xp * 25; plan.notes.push(t("SRD cost: {gp} and {xp} XP.", { gp: gp(pre.cost.gp), xp: num(pre.cost.xp) })); }
      else plan.base = price;
    }
    plan.summary = t("{rank} socket crystal; fits {fits}", { rank: t(RANKS[c.rank]), fits: this.fitsText(c, Number.isFinite(Number(c.minEnhancement)) ? Number(c.minEnhancement) : RANK_MIN[c.rank]) });
    return plan;
  }

  /* ---------- Treasure Generator tab ---------- */
  pick(choice) {
    const list = choice === "random" ? this.list : choice.startsWith("random:") ? this.list.filter((c) => c.slot.includes(choice.slice(7))) : this.list.filter((c) => c.key === choice);
    if (!list.length) throw new Error(t("No socket crystal matches this choice."));
    return list[Math.floor(Math.random() * list.length)];
  }

  /** Item data for a generated crystal: "random", "random:weapon" / "random:armor" / "random:shield", or a crystal key. */
  async generate(choice = "random", { identified = false } = {}) {
    await this.load();
    if (!this.found.length) await this.scan();
    const c = this.pick(choice);
    return { c, data: await this.dataFor(c, { identified }) };
  }

  tabContent() {
    const sel = recall("choice", "random");
    const opts = [opt("random", t("Random (any)"), sel), opt("random:weapon", t("Random weapon crystal"), sel), opt("random:armor", t("Random armor crystal"), sel), opt("random:shield", t("Random shield crystal"), sel)]
      .concat(this.list.map((c) => opt(c.key, `${dn(c.en ?? c.name, c.name)} (${t(SLOT_WORD[c.slot[0]])}, ${t(RANKS[c.rank])}, ${gp(c.price)})${c.from ? ` — ${c.from}` : ""}`, sel))).join("");
    return `<p class="hint">${H("Socket crystals, set into a magic weapon, armor or shield by its owner (one per item). The Armory's are homebrew examples; see data/socket-crystals.json to make your own.")} ${H("Crystals in your item compendiums (such as the Magic Item Compendium's augment crystals) are listed too.")}</p>
      <div class="form-group"><label>${H("Crystal")}</label><select name="sockets.choice">${opts}</select></div>
      <div class="form-group"><label>${H("How many")}</label><input type="number" name="sockets.count" min="1" max="20" value="${esc(recall("count", "1"))}"></div>
      <div class="form-group"><label>${H("Identified")}</label><label class="atg-cb" style="flex:1"><input type="checkbox" name="sockets.identified" ${recall("identified", "0") === "1" ? "checked" : ""}> ${H("Players see the crystal's name (otherwise \"Socket crystal\" until identified)")}</label></div>`;
  }

  tabWire(section) {
    for (const [n, k] of [["sockets.choice", "choice"], ["sockets.count", "count"]]) section.querySelector(`[name="${n}"]`)?.addEventListener("change", (ev) => remember(k, ev.target.value));
    section.querySelector('[name="sockets.identified"]')?.addEventListener("change", (ev) => remember("identified", ev.target.checked ? "1" : "0"));
  }

  async tabGenerate(form) {
    const section = form.querySelector?.('section[data-tab="t-axeclefts-armory-sockets"]') ?? form;
    const choice = section.querySelector?.('[name="sockets.choice"]')?.value ?? "random";
    const count = Math.max(1, Math.min(20, Math.floor(Number(section.querySelector?.('[name="sockets.count"]')?.value) || 1)));
    const identified = !!section.querySelector?.('[name="sockets.identified"]')?.checked;
    const entries = [];
    for (let i = 0; i < count; i++) {
      const { c, data } = await this.generate(choice, { identified });
      entries.push({ name: c.name, data, summary: `${t("{rank} socket crystal for {slot}", { rank: t(RANKS[c.rank]), slot: c.slot.map((s) => t(SLOT_A[s])).join(t(" or ")) })}; ${gp(c.price)}` });
    }
    return { entries, note: count > 1 ? t("{n} socket crystals", { n: count }) : "" };
  }
}

/** Set up socket crystals: the world setting, sheet buttons, and (while on) the Crafting kind and the Treasure Generator tab. */
export function registerSockets(api) {
  const S = new ArmorySockets(api);
  api.sockets = S;
  Hooks.once("init", () => {
    game.settings.register(MOD, "sockets", {
      name: /*t*/"Socket crystals", scope: "world", config: true, type: Boolean, default: false, requiresReload: true,
      hint: /*t*/"Owners can set one crystal into a magic weapon, armor or shield their character carries, and take it out again (its effects then work like the item's enhancements). Adds the Armory's homebrew example crystals to Crafting and a Crystals tab to the Treasure Generator. Switched off: nothing new can be set, those pages are hidden, and items that already hold a crystal keep it (and can still have it taken out).",
    });
    S.load();
  });
  Hooks.once("ready", async () => {
    if (!S.enabled()) return;
    await S.load();
    globalThis.AxecleftCrafting?.registerKind?.({
      module: MOD, key: "socket-crystals", label: /*t*/"Socket crystals", icon: "fas fa-gem", order: 20.7, magic: true, feat: "Craft Magic Arms and Armor",
      prepare: () => S.prepare(), content: (ctx) => S.craftContent(ctx), evaluate: (ctx) => S.craftEvaluate(ctx),
    });
    globalThis.AxecleftTreasure?.registerTab?.({
      module: MOD, name: "sockets", title: /*t*/"Crystals", icon: "fas fa-gem", order: 41,
      prepare: () => S.prepare(), content: () => S.tabContent(), wire: (section) => S.tabWire(section), generate: (form) => S.tabGenerate(form), generateTitle: () => t("Crystals"),
    });
  });
  // Foundry v11/v12 sheets (and D35E's classic sheets on v13+)
  Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
    const b = S.headerButton(sheet.document ?? sheet.item ?? sheet.object);
    if (b) buttons.unshift({ label: b.label, class: "axeclefts-armory-socket", icon: b.icon, onclick: () => b.run() });
  });
  // Foundry v13+ ApplicationV2 item sheets
  const v2 = (sheet, controls) => {
    if (controls.some((c) => c.action === "axecleftsArmorySocket")) return;
    const b = S.headerButton(sheet.document);
    if (b) controls.unshift({ label: b.label, icon: b.icon, action: "axecleftsArmorySocket", onClick: () => b.run() });
  };
  Hooks.on("getHeaderControlsItemSheet", v2);
  Hooks.on("getHeaderControlsItemSheetV2", v2);
  return S;
}
