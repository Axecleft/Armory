/**
 * Axecleft's Armory — the Forge: a Treasure Generator tab for making arms by hand.
 *
 * Every choice is a dropdown with Random; Random parts are rolled on the SRD tables at the chosen grade
 * when you press Generate. A live preview shows the name, price and any rule the choices break.
 */
import * as D from "./armory-d35e.js";
import { abilityTitle } from "./armory-builder.js";

const MOD = "axeclefts-armory";
const T = () => globalThis.AxecleftTreasure;
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const opt = (v, label, sel, extra = "") => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}${extra}>${esc(label)}</option>`;
const gp = (n) => `${Number(Math.round(n * 100) / 100).toLocaleString("en-US")} gp`;
const normName = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const d100 = () => 1 + Math.floor(Math.random() * 100);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const inGrade = (rows, grade, r) => rows.find((x) => x[grade] && r >= x[grade][0] && r <= x[grade][1]);
const SLOTS = 4;
const KINDS = [["weapon", "Weapon"], ["armor", "Armor"], ["shield", "Shield"], ["ammo", "Ammunition"]];
const KIND_LABEL = Object.fromEntries(KINDS);
const STORE = "axeclefts-armory.forge.";
const remember = (k, v) => { try { localStorage.setItem(STORE + k, v); } catch (e) { /* private mode */ } };
const recall = (k, d) => { try { return localStorage.getItem(STORE + k) ?? d; } catch (e) { return d; } };

export class ArmoryForge {
  constructor(api) { this.api = api; this.bases = null; this.custom = null; }
  get b() { return this.api.builder; }
  get g() { return this.api.generator; }
  get data() { return this.api.data; }

  /* ---------- catalogs ---------- */

  /** Mundane arms in the item sources (D35E's first), by kind: { weapon: [{ pack, id, name, label, ranged }], ... }. */
  async loadBases() {
    const out = { weapon: [], armor: [], shield: [], ammo: [] }, seen = new Set();
    const packs = [...new Set(["D35E.weapons-and-ammo", "D35E.armors-and-shields", ...(T()?.itemSources?.().packs ?? [])])]
      .filter((id) => id !== "D35E.magicitems" && !/magic|wondrous|enchant/i.test(game.packs.get(id)?.metadata?.label ?? ""));
    for (const id of packs) {
      const pack = game.packs.get(id);
      if (!pack) continue;
      let index = [];
      try { index = [...await pack.getIndex({ fields: ["type", "system.equipmentType", "system.subType", "system.enh", "system.armor.enh", "system.price", "system.weaponSubtype"] })]; } catch (e) { continue; }
      for (const e of index) {
        const kind = D.armsKind(e);
        if (!kind || Number(e.system?.enh) > 0 || Number(e.system?.armor?.enh) > 0 || /\bunarmed\b|\bspikes?\b/i.test(e.name)) continue;
        if (e.system?.price === null || e.system?.price === undefined) continue;
        const key = `${kind}|${normName(e.name)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out[kind].push({ pack: id, id: e._id, name: e.name, label: pack.metadata?.label ?? id, ranged: e.system?.weaponSubtype === "ranged" });
      }
    }
    for (const k of Object.keys(out)) out[k].sort((a, b) => a.name.localeCompare(b.name));
    this.bases = out;
    return out;
  }
  /** Enhancements from the sources that aren't SRD abilities the Armory knows (GM or Shared Data ones). */
  async loadCustom() {
    const items = await (T()?.kindItems?.(`${MOD}.enhancements`) ?? []);
    const known = new Set([...Object.values(this.data.abilities.weapon), ...Object.values(this.data.abilities.armor)].map((o) => normName(o.d35e)).filter(Boolean));
    for (const f of this.data.tables.baneFoes) known.add(normName(f.d35e));
    ["+1 weapon enhancement", "+1 armor enhancement"].forEach((n) => known.add(normName(n)));
    // Materials made as enhancements (Shared Data's Mithral, Dragonhide, Bluewood) are superseded by the Material dropdown
    for (const m of this.data.materials) known.add(normName(m.name));
    ["bluewood", "dragonhide", "mithral", "adamantine", "darkwood", "intelligence"].forEach((n) => known.add(n));
    this.custom = items.filter((x) => !known.has(normName(x.name)) && ["weapon", "armor"].includes(x.entry?.system?.enhancementType))
      .map((x) => ({ name: x.name, type: x.entry.system.enhancementType, pack: x.packLabel }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return this.custom;
  }
  async prepare() {
    await this.api.loaded;
    await Promise.all([this.loadBases(), this.loadCustom(), this.api.intelligence?.loadTables().catch((e) => console.warn(`${MOD} | intelligent item tables`, e))]);
  }

  /** Abilities for the slot dropdowns, with the kinds each fits: [{ value, label, kinds }]. */
  abilityOptions() {
    const out = [];
    const w = this.data.abilities.weapon, a = this.data.abilities.armor;
    const wKinds = (o) => [o.applies.some((x) => x === "melee" || x === "ranged" || x === "thrown") ? "weapon" : null, o.applies.includes("ammo") ? "ammo" : null].filter(Boolean);
    const psi = T()?.rules?.()?.psionics !== false; // the shared Psionics switch
    const epic = T()?.rules?.()?.epic === true;      // the shared Epic items switch
    const ok = (o) => (!o.psionic || psi) && (!o.epic || epic);
    for (const [k, o] of Object.entries(w)) if (ok(o)) out.push({ value: `srd:${k}`, label: abilityTitle(k), kinds: wKinds(o), group: o.psionic ? "SRD psionic weapon abilities" : o.epic ? "SRD epic weapon abilities" : "SRD weapon abilities" });
    for (const [k, o] of Object.entries(a)) if (ok(o)) out.push({ value: `srd:${k}`, label: abilityTitle(k), kinds: o.applies.filter((x) => x === "armor" || x === "shield"), group: o.psionic ? "SRD psionic armor and shield abilities" : o.epic ? "SRD epic armor and shield abilities" : "SRD armor and shield abilities" });
    for (const c of this.custom ?? []) out.push({ value: `custom:${c.name}`, label: `${c.name} (${c.pack})`, kinds: c.type === "weapon" ? ["weapon", "ammo"] : ["armor", "shield"], group: "Your enhancements" });
    return out;
  }

  /* ---------- intelligence ---------- */
  intelContent() {
    const I = this.api.intelligence;
    if (!I?.tables) return `<p class="hint">Intelligent items need D35E's Intelligent Item Tables compendium.</p>`;
    const sel = (name, kind, first = ["", "Random"]) => `<select name="forge.${name}">${opt(first[0], first[1], "")}${I.options(kind).map((o) => opt(o.value, o.label, "")).join("")}</select>`;
    const aligns = [["", "Random (suits holy, unholy, axiomatic, anarchic)"], ["lg", "Lawful good"], ["ng", "Neutral good"], ["cg", "Chaotic good"], ["ln", "Lawful neutral"], ["nn", "Neutral"], ["cn", "Chaotic neutral"], ["le", "Lawful evil"], ["ne", "Neutral evil"], ["ce", "Chaotic evil"]];
    return `<div class="form-group" data-forge="intel"><label>Intelligent</label><select name="forge.intel">${opt("settings", "By Generation settings (random)", recall("intel", "settings"))}${opt("none", "No", recall("intel", "settings"))}${opt("random", "Yes, all features random", recall("intel", "settings"))}${opt("choose", "Yes, choose the features", recall("intel", "settings"))}</select></div>
      <div data-forge="intel-choose">
        <div class="form-group"><label>Alignment</label><select name="forge.ialign">${aligns.map(([v, l]) => opt(v, l, "")).join("")}</select></div>
        <div class="form-group"><label>Mind</label>${sel("icap", "capabilities")}</div>
        ${[0, 1, 2, 3].map((i) => `<div class="form-group" data-forge-il="${i}"><label>Lesser power ${i + 1}</label>${sel(`il${i}`, "lesser")}</div>`).join("")}
        ${[0, 1, 2].map((i) => `<div class="form-group" data-forge-ig="${i}"><label>Greater power ${i + 1}</label>${sel(`ig${i}`, "greater")}</div>`).join("")}
        <div class="form-group"><label>Special purpose</label><select name="forge.ipurpose">${opt("rule", "By Generation settings", "")}${opt("none", "None", "")}${opt("random", "Random", "")}${I.options("purpose").map((o) => opt(o.value, o.label, "")).join("")}</select></div>
        <div class="form-group" data-forge="intel-dedicated"><label>Dedicated power</label>${sel("idedicated", "dedicated")}</div>
        <p class="hint">The mind sets how many lesser and greater powers it has. Prices follow the SRD and are added to the item's price.</p>
      </div>`;
  }
  /** Make the built item intelligent as the form says (Generation settings, random, or chosen). */
  async applyIntel(built, facts, spec, f) {
    const I = this.api.intelligence;
    if (!I || facts.kind === "ammo" || !f.intel || f.intel === "none") return;
    if (!(spec.bonus > 0 || (spec.abilities ?? []).length)) return; // only magic items can be intelligent
    if (f.intel === "settings") return this.g.maybeIntelligent(built, facts, spec.bonus);
    const choice = { abilities: (built.craft?.abilities ?? []).map((a) => ({ name: a.title })), bonus: spec.bonus, effective: built.effective };
    if (f.intel === "choose") Object.assign(choice, { alignment: f.ialign || null, capabilities: f.icap, lesser: f.ilesser, greater: f.igreater, purpose: f.ipurpose, dedicated: f.idedicated });
    I.apply(built, await I.roll(choice));
  }

  /* ---------- the tab ---------- */

  content() {
    if (!this.bases) return `<p class="hint">Loading the Forge…</p>`;
    const r = (k, d) => recall(k, d);
    const kind = r("kind", "weapon");
    const baseOpts = KINDS.map(([k, label]) => `<optgroup label="${esc(label)}" data-kind="${k}">${(this.bases[k] ?? []).map((b) => opt(`${b.pack}|${b.id}`, b.name, r("base", ""), ` data-kind="${k}"`)).join("")}</optgroup>`).join("");
    const mats = this.data.materials.map((m) => opt(m.name, `${m.name[0].toUpperCase()}${m.name.slice(1)}`, r("material", ""), ` data-kinds="${m.applies.join(" ")}"`)).join("");
    const abOpts = this.abilityOptions();
    const groups = [...new Set(abOpts.map((o) => o.group))];
    const abSelect = (i) => `<select name="forge.ab${i}">${opt("", "None")}${opt("random", "Random (by grade)")}${T()?.rules?.()?.psionics !== false ? opt("randompsi", "Random psionic (by grade)") : ""}${groups.map((g) => `<optgroup label="${esc(g)}">${abOpts.filter((o) => o.group === g).map((o) => opt(o.value, o.label, "", ` data-kinds="${o.kinds.join(" ")}"`)).join("")}</optgroup>`).join("")}</select>`;
    const foes = this.data.tables.baneFoes.map((f) => opt(f.foe, f.foe, "")).join("");
    const L = this.data.generation.light;
    const themes = Object.keys(L.themes).map((k) => opt(k, k, "")).join("");
    const anims = L.animationTypes.map((t) => opt(t, t ? t[0].toUpperCase() + t.slice(1) : "None", "")).join("");
    return `<p class="hint">Make weapons, armor, shields and ammunition by hand. Any choice can be Random: random parts are rolled on the SRD tables for the grade you pick. Prices follow the SRD; magic items start unidentified.</p>
      <div class="form-group"><label>Kind</label><select name="forge.kind">${opt("random", "Random", kind)}${KINDS.map(([k, l]) => opt(k, l, kind)).join("")}</select></div>
      <div class="form-group"><label>Base item</label><select name="forge.base">${opt("", "Random (SRD tables)", r("base", ""))}${baseOpts}</select></div>
      <div class="form-group"><label>Grade</label><select name="forge.grade">${["minor", "medium", "major"].map((g) => opt(g, g[0].toUpperCase() + g.slice(1), r("grade", "medium"))).join("")}${T()?.rules?.()?.epic ? opt("epic", "Epic (SRD epic tables)", r("grade", "medium")) : ""}</select><span class="hint" style="flex:1">for Random bonus and abilities</span></div>
      <div class="form-group"><label>Enhancement</label><select name="forge.bonus">${opt("", "None", r("bonus", "1"))}${opt("random", "Random (by grade)", r("bonus", "1"))}${[1, 2, 3, 4, 5].map((n) => opt(n, `+${n}`, r("bonus", "1"))).join("")}${Array.from({ length: 15 }, (_, i) => i + 6).map((n) => opt(n, `+${n} (epic)`, r("bonus", "1"), ' data-epic="1"')).join("")}</select></div>
      ${T()?.rules?.()?.epic ? `<div class="form-group"><label>Epic</label><label class="atg-cb" style="flex:1"><input type="checkbox" name="forge.epic" ${r("epic", "0") === "1" ? "checked" : ""}> Allow epic items: enhancement past +5 and a total past +10, at SRD epic prices (×10)</label></div>` : ""}
      <div class="form-group"><label>Masterwork</label><label class="atg-cb" style="flex:1"><input type="checkbox" name="forge.masterwork" ${r("masterwork", "1") === "1" ? "checked" : ""}> Masterwork (always, with a bonus, abilities or adamantine, mithral, darkwood, dragonhide)</label></div>
      <div class="form-group"><label>Material</label><select name="forge.material">${opt("", "None (ordinary)", r("material", ""))}${opt("random", "Random (one that fits)", r("material", ""))}${mats}</select></div>
      <div class="form-group"><label>Size</label><select name="forge.size">${opt("med", "Medium", r("size", "med"))}${opt("sm", "Small (same price, half the weight)", r("size", "med"))}${opt("lg", "Large (twice the base price and weight)", r("size", "med"))}${opt("random", "Random (Generation settings)", r("size", "med"))}</select></div>
      <fieldset><legend>Special abilities</legend>
        ${Array.from({ length: SLOTS }, (_, i) => `<div class="form-group"><label>Ability ${i + 1}</label>${abSelect(i)}</div>`).join("")}
        <div class="form-group" data-forge="bane"><label>Bane foe</label><select name="forge.foe">${opt("random", "Random (SRD table)")}${foes}</select></div>
        <p class="hint">Each ability needs at least +1; bonus plus abilities can't pass +10 unless epic items are allowed. Abilities that don't fit the base (keen on a mace, returning on a longsword) are refused.</p>
      </fieldset>
      <details class="atg-sec" data-sec="forge-extras" ${r("sec.extras", "0") === "1" ? "open" : ""}><summary>Light, inscription and more <small data-forge="extras-note"></small></summary>
        <div class="form-group"><label>Light</label><select name="forge.light">${opt("settings", "By Generation settings (random)", r("light", "settings"))}${opt("none", "None", r("light", "settings"))}${opt("on", "Sheds light", r("light", "settings"))}</select></div>
        <div data-forge="light">
          <div class="form-group"><label>Look</label><select name="forge.theme">${opt("", "From its abilities (or neutral)")}${themes}${opt("custom", "Custom")}</select></div>
          <div class="form-group" data-forge="custom-light"><label>Color</label><input type="color" name="forge.color" value="#ffd27f" style="flex:0 0 4em"><label style="flex:0 0 auto;margin-left:8px">Animation</label><select name="forge.anim">${anims}</select></div>
          <div class="form-group" data-forge="custom-light"><label>Speed / intensity</label><input type="number" name="forge.speed" value="3" min="1" max="10"><input type="number" name="forge.intensity" value="4" min="1" max="10"></div>
          <div class="form-group"><label>Bright / dim (ft)</label><input type="number" name="forge.bright" value="" min="0" step="5" placeholder="20"><input type="number" name="forge.dim" value="" min="0" step="5" placeholder="40"><span class="hint" style="flex:1">blank: from Generation settings</span></div>
        </div>
        ${this.intelContent()}
        <div class="form-group"><label>Inscription hint</label><select name="forge.hint">${opt("settings", "By Generation settings (random)")}${opt("yes", "Yes")}${opt("no", "No")}</select></div>
        <div class="form-group"><label>Identified</label><label class="atg-cb" style="flex:1"><input type="checkbox" name="forge.identified"> Start identified (magic items are unidentified otherwise)</label></div>
        <div class="form-group" data-forge="ammo"><label>Ammunition</label><input type="number" name="forge.qty" value="50" min="1" step="1"><span class="hint" style="flex:1">pieces (magic ammunition is priced per 50)</span></div>
        <div class="form-group"><label>Items to make</label><input type="number" name="forge.count" value="1" min="1" max="10" step="1"><span class="hint" style="flex:1">for each target; Random parts are rolled for each</span></div>
      </details>
      <div class="atg-preview" data-forge="preview"></div>`;
  }

  wire(section) {
    if (!section || !this.bases) return;
    const el = (n) => section.querySelector(`[name="forge.${n}"]`);
    const show = (sel, on) => section.querySelectorAll(`[data-forge="${sel}"]`).forEach((x) => { x.style.display = on ? "" : "none"; });
    const filter = () => {
      const kind = el("kind").value;
      // Base items, materials and abilities that fit the kind
      section.querySelectorAll('select[name="forge.base"] optgroup').forEach((g) => { g.style.display = kind === "random" || g.dataset.kind === kind ? "" : "none"; });
      const baseKind = el("base").selectedOptions[0]?.dataset.kind;
      if (kind !== "random" && baseKind && baseKind !== kind) el("base").value = "";
      const k = baseKind ?? (kind === "random" ? null : kind);
      const epic = !!el("epic")?.checked; // the Epic row only shows while the world's Epic items switch is on
      section.querySelectorAll("option[data-epic]").forEach((o) => { o.hidden = !epic; o.disabled = !epic; });
      if (el("bonus").selectedOptions[0]?.disabled) el("bonus").value = "5";
      section.querySelectorAll("option[data-kinds]").forEach((o) => { const fits = !k || o.dataset.kinds.split(" ").includes(k); o.hidden = !fits; o.disabled = !fits; });
      for (const s of section.querySelectorAll('select[name^="forge.ab"], select[name="forge.material"]')) if (s.selectedOptions[0]?.disabled) s.value = "";
      show("bane", [...section.querySelectorAll('select[name^="forge.ab"]')].some((s) => s.value === "srd:Bane"));
      show("light", el("light").value === "on");
      show("custom-light", el("light").value === "on" && el("theme").value === "custom");
      show("ammo", k === "ammo" || (kind === "ammo"));
      const intel = el("intel")?.value;
      show("intel", k !== "ammo" && kind !== "ammo");
      show("intel-choose", intel === "choose" && k !== "ammo");
      const cap = this.api.intelligence?.tables?.capabilities?.[Number(el("icap")?.value)];
      const nl = el("icap")?.value === "" || !cap ? 4 : Number(cap.flags.lesser) || 0, ng = el("icap")?.value === "" || !cap ? 3 : Number(cap.flags.greater) || 0;
      section.querySelectorAll("[data-forge-il]").forEach((x) => { x.style.display = intel === "choose" && Number(x.dataset.forgeIl) < nl ? "" : "none"; });
      section.querySelectorAll("[data-forge-ig]").forEach((x) => { x.style.display = intel === "choose" && Number(x.dataset.forgeIg) < ng ? "" : "none"; });
      show("intel-dedicated", intel === "choose" && el("ipurpose")?.value !== "none");
      const note = section.querySelector('[data-forge="extras-note"]');
      if (note) note.textContent = `(light ${el("light").selectedOptions[0]?.text.toLowerCase()}; ${el("identified").checked ? "identified" : "unidentified"}; ${el("count").value || 1} item${Number(el("count").value) > 1 ? "s" : ""})`;
      T()?.refreshSize?.();
    };
    let tmo = null;
    const changed = (ev) => {
      if (ev?.target?.name) { const k = ev.target.name.slice(6); if (["kind", "base", "grade", "bonus", "material", "light", "intel", "size"].includes(k)) remember(k, ev.target.value); if (k === "masterwork" || k === "epic") remember(k, ev.target.checked ? "1" : "0"); }
      filter();
      clearTimeout(tmo); tmo = setTimeout(() => this.preview(section), 250);
    };
    section.addEventListener("change", changed);
    section.addEventListener("input", (ev) => { if (ev.target.type === "number") changed(ev); });
    section.querySelector('details[data-sec="forge-extras"]')?.addEventListener("toggle", (ev) => { remember("sec.extras", ev.target.open ? "1" : "0"); T()?.refreshSize?.(); });
    filter();
    this.preview(section);
  }

  /** Read the form: what's chosen, with "random" left in place. */
  read(root) {
    const v = (n) => root.querySelector(`[name="forge.${n}"]`)?.value ?? "";
    const c = (n) => !!root.querySelector(`[name="forge.${n}"]`)?.checked;
    const [pack, id] = v("base").split("|");
    return {
      kind: v("kind"), base: v("base") ? { pack, id } : null, baseKind: root.querySelector('[name="forge.base"]')?.selectedOptions?.[0]?.dataset.kind ?? null,
      grade: v("grade") || "medium", bonus: v("bonus"), size: v("size") || "med", masterwork: c("masterwork"), epic: c("epic"), material: v("material"),
      abilities: Array.from({ length: SLOTS }, (_, i) => v(`ab${i}`)).filter(Boolean), foe: v("foe"),
      light: v("light"), theme: v("theme"), color: v("color"), anim: v("anim"), speed: Number(v("speed")) || 3, intensity: Number(v("intensity")) || 4,
      intel: v("intel") || "settings", ialign: v("ialign"), icap: v("icap"), ipurpose: v("ipurpose") || "rule", idedicated: v("idedicated"),
      ilesser: [0, 1, 2, 3].map((i) => v(`il${i}`)), igreater: [0, 1, 2].map((i) => v(`ig${i}`)),
      bright: v("bright"), dim: v("dim"), hint: v("hint"), identified: c("identified"), qty: Math.max(1, Number(v("qty")) || 50), count: Math.min(10, Math.max(1, Number(v("count")) || 1)),
    };
  }
  hasRandom(f) {
    return f.kind === "random" || !f.base || f.bonus === "random" || f.material === "random" || f.size === "random" || f.abilities.some((a) => a === "random" || a === "randompsi") || f.light === "settings" || f.hint === "settings" || ["settings", "random", "choose"].includes(f.intel)
      || (f.abilities.includes("srd:Bane") && f.foe === "random");
  }

  /**
   * Turn the form into a builder spec, rolling every Random part. Returns { spec, facts }.
   * Abilities that don't fit are rerolled (Random) or reported (chosen).
   */
  async resolve(f) {
    const t = this.data.tables;
    // Kind and base item
    let kind = f.baseKind ?? (f.kind === "random" ? null : f.kind);
    let base = f.base, rename = null;
    if (!base) {
      kind ??= pick(["weapon", "weapon", "weapon", "weapon", "armor", "armor", "shield", "ammo"]);
      if (kind === "weapon") { const w = this.g.weaponBase(false); if (w.row.table || /arrow|bolt|bullet/i.test(w.base.name)) return this.resolve({ ...f, kind: "weapon" }); base = w.base; rename = w.rename ? { to: w.rename, price: w.renamePrice } : null; }
      else if (kind === "ammo") base = { name: t.ammunition[Math.floor(Math.random() * t.ammunition.length)].d35e };
      else base = { name: (kind === "shield" ? t.shieldType : t.armorType).find((x) => d100() <= x.d[1])?.d35e ?? (kind === "shield" ? "Heavy Steel Shield" : "Chain Shirt") };
    }
    const baseDoc = await this.b.baseDoc(base);
    const facts = D.baseFacts(D.cleanCopy(baseDoc));
    kind = facts.kind;
    // Enhancement bonus: Random rolls the grade's table (specific-item and ability rows are rerolled)
    let bonus = f.bonus === "random" ? null : Number(f.bonus) || 0;
    const epicGrade = f.grade === "epic";
    if (epicGrade) f.epic = true; // the SRD epic tables make epic items
    if (bonus === null) {
      const table = epicGrade ? (kind === "armor" || kind === "shield" ? t.epicArmorAndShields : t.epicWeapons) : kind === "armor" || kind === "shield" ? t.armorAndShields : t.weapons;
      for (let i = 0; i < 50 && bonus === null; i++) {
        const row = inGrade(table, f.grade, d100());
        if (row?.bonus) bonus = row.bonus;
        else if (epicGrade && /^epic(Bonus|Armor|Shield)$/.test(row?.result ?? "")) bonus = this.g.epicBonus(kind === "armor" || kind === "shield" ? "epicArmorBonus" : "epicWeaponBonus");
      }
      bonus ??= 1;
    }
    // Abilities: chosen ones as they are; Random ones from the grade's table
    const chosen = [], randoms = f.abilities.filter((a) => a === "random").length, randomPsi = f.abilities.filter((a) => a === "randompsi").length;
    for (const a of f.abilities) {
      if (a === "random" || a === "randompsi") continue;
      if (a.startsWith("custom:")) { chosen.push({ d35e: a.slice(7), name: a.slice(7) }); continue; }
      const name = a.slice(4);
      const ab = { name };
      if (name === "Bane") ab.foe = f.foe === "random" ? t.baneFoes.find((x) => { const r = d100(); return r >= x.d[0] && r <= x.d[1]; })?.foe ?? pick(t.baneFoes).foe : f.foe;
      chosen.push(ab);
    }
    // Random psionic first (SRD psionic tables; a base nothing fits gets normal abilities instead), then Random
    let normal = randoms;
    if (randomPsi) {
      if (bonus < 1) bonus = 1;
      const table = kind === "armor" ? t.psionicArmorAbilities : kind === "shield" ? t.psionicShieldAbilities : facts.ranged ? t.psionicRangedAbilities : t.psionicMeleeAbilities;
      const rolled = await this.g.rollAbilities(facts, table, f.grade, randomPsi, bonus + chosen.reduce((s, x) => s + (this.b.tableRow(kind, x.name)?.bonus ?? 0), 0), { limit: f.epic ? Infinity : 10 });
      let got = 0;
      for (const r of rolled) if (!chosen.some((c) => normName(c.name) === normName(r.name))) { chosen.push(r); got++; }
      normal += randomPsi - got;
    }
    if (normal && epicGrade) {
      // SRD epic special ability tables (their "roll on the nonepic table" rows use the major table)
      if (bonus < 1) bonus = 1;
      const epicT = kind === "armor" ? t.epicArmorAbilities : kind === "shield" ? t.epicShieldAbilities : facts.ranged ? t.epicRangedAbilities : t.epicMeleeAbilities;
      const plainT = kind === "armor" ? t.armorAbilities : kind === "shield" ? t.shieldAbilities : facts.ranged ? t.rangedAbilities : t.meleeAbilities;
      const rolled = await this.g.rollEpicAbilities(facts, epicT, plainT, normal, bonus + chosen.reduce((s, x) => s + (this.b.tableRow(kind, x.name)?.bonus ?? 0), 0));
      for (const r of rolled) if (!chosen.some((c) => normName(c.name) === normName(r.name))) chosen.push(r);
      normal = 0;
    }
    if (normal) {
      if (bonus < 1) bonus = 1;
      const table = kind === "armor" ? t.armorAbilities : kind === "shield" ? t.shieldAbilities : facts.ranged ? t.rangedAbilities : t.meleeAbilities;
      const rolled = await this.g.rollAbilities(facts, table, f.grade, normal, bonus + chosen.reduce((s, x) => s + (this.b.tableRow(kind, x.name)?.bonus ?? 0), 0), { limit: f.epic ? Infinity : 10 });
      for (const r of rolled) if (!chosen.some((c) => normName(c.name) === normName(r.name))) chosen.push(r);
    }
    // Material: Random picks one that fits this base
    let material = f.material === "random" ? null : f.material || null;
    if (f.material === "random") {
      const fits = this.data.materials.filter((m) => !this.b.materialProblem(facts, m));
      material = fits.length ? pick(fits).name : null;
    }
    // Light and inscription
    let light = null;
    const magic = bonus > 0 || chosen.length;
    if (f.light === "settings") light = magic ? this.g.light(facts, chosen, bonus) : null;
    else if (f.light === "on" && kind !== "ammo") {
      const cat = kind === "armor" || kind === "shield" ? "armor" : facts.ranged ? "ranged" : "melee";
      const g = T()?.generation?.().light ?? {}, L = this.data.generation.light;
      const themeKey = f.theme && f.theme !== "custom" ? f.theme : null;
      const th = f.theme === "custom" ? { color: f.color, type: f.anim, speed: f.speed, intensity: f.intensity }
        : themeKey ? L.themes[themeKey]
        : chosen.map((a) => L.themes[Object.keys(L.themes).find((k) => normName(k) === normName(a.name))]).find(Boolean) ?? L.neutral[0];
      const dflt = g[cat] ?? { bright: 20, dim: 40 };
      light = { color: th.color, type: th.type ?? "", speed: th.speed ?? 3, intensity: th.intensity ?? 4, alpha: Math.min(0.9, 0.4 + 0.05 * bonus),
        bright: f.bright !== "" ? Number(f.bright) : Number(dflt.bright) || 20, dim: f.dim !== "" ? Number(f.dim) : Number(dflt.dim) || 40 };
    }
    const hint = f.hint === "yes" ? true : f.hint === "no" ? false : magic ? this.g.hint(facts) : false;
    const size = kind === "ammo" ? undefined : f.size === "random" ? this.g.size() : f.size || "med";
    const spec = { base, bonus, abilities: chosen, masterwork: f.masterwork, size, epic: f.epic || undefined, material, light, hint, identified: f.identified || undefined,
      quantity: kind === "ammo" ? f.qty : undefined };
    return { spec, facts, rename };
  }

  /** Build one item from the form (Random parts rolled). Returns the hub entry. */
  async makeOne(f) {
    let lastErr = null;
    for (let tries = 0; tries < (this.hasRandom(f) ? 10 : 1); tries++) {
      try {
        const { spec, facts, rename } = await this.resolve(f);
        const built = await this.b.build(spec);
        if (rename) this.g.renameBase(built, rename.to, rename.price, facts);
        await this.applyIntel(built, facts, spec, f);
        return { name: built.quantity > 1 ? `${built.name} (${built.quantity})` : built.name, data: built.data,
          summary: `Forge: ${built.summary}; ${gp(built.price)}${built.quantity > 1 ? " each" : ""}${spec.light ? "; sheds light" : ""}` };
      } catch (err) { lastErr = err; }
    }
    throw lastErr ?? new Error("Could not make an item with these choices.");
  }

  async preview(section) {
    const box = section.querySelector('[data-forge="preview"]');
    if (!box) return;
    const f = this.read(section);
    if (this.hasRandom(f) && (f.kind === "random" || !f.base || f.bonus === "random" || f.material === "random" || f.abilities.some((a) => a === "random" || a === "randompsi"))) {
      box.innerHTML = `<i class="fas fa-dice"></i> Random choices are rolled when you press Generate${f.count > 1 ? `, separately for each of the ${f.count} items` : ""}.`;
      return;
    }
    try {
      const { spec, facts, rename } = await this.resolve({ ...f, light: f.light === "settings" ? "none" : f.light, hint: f.hint === "settings" ? "no" : f.hint });
      const built = await this.b.build(spec);
      if (rename) this.g.renameBase(built, rename.to, rename.price, facts);
      if (f.intel === "choose") await this.applyIntel(built, facts, spec, f); // a sample roll for anything left Random
      const parts = (built.data.flags?.[MOD]?.price ?? []).map(([l, n]) => `${l} ${gp(n)}`).join(" + ");
      box.innerHTML = `<strong>${esc(built.name)}</strong>${built.quantity > 1 ? ` (${built.quantity})` : ""}: ${gp(built.price)}${built.quantity > 1 ? " each" : ""}<br><small>${esc(built.summary)}${parts ? ` — ${esc(parts)}` : ""}${built.data.system?.identified === false ? `; players see "${esc(built.data.system.unidentified?.name)}" until identified` : ""}</small>`;
    } catch (err) {
      box.innerHTML = `<span style="color:var(--color-level-error,#c33)"><i class="fas fa-triangle-exclamation"></i> ${esc(err.message)}</span>`;
    }
  }

  /** The hub calls this once per target actor. */
  async generate(form, ctx = {}) {
    const section = ctx.section ?? form.querySelector?.('section[data-tab="t-axeclefts-armory-forge"]') ?? form;
    const f = this.read(section);
    const entries = [];
    for (let i = 0; i < f.count; i++) entries.push(await this.makeOne(f));
    return { entries, note: f.count > 1 ? `${f.count} items from the Forge` : "" };
  }
}

/** Register the Forge as a Treasure Generator tab. */
export function registerForge(api) {
  const hub = T();
  if (!hub?.registerTab) return;
  const forge = new ArmoryForge(api);
  api.forge = forge;
  hub.registerTab({
    module: MOD, name: "forge", title: "Forge", icon: "fas fa-hammer", order: 40,
    prepare: () => forge.prepare(),
    content: () => forge.content(),
    wire: (section) => forge.wire(section),
    generate: (form) => forge.generate(form),
    generateTitle: () => "Forge",
  });
}
