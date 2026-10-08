/**
 * Axecleft's Armory — crafting kinds for the shared Crafting window (axecleft-crafting.js).
 *
 *  - Magic arms and armor (Craft Magic Arms and Armor): a masterwork item from the inventory, bought, or made
 *    with Craft first; enhancement bonus and special abilities; SRD prerequisites from data/armory.json.
 *  - Arms and armor (Craft): mundane and masterwork weapons, armor, shields and ammunition, by the SRD Craft rules.
 */
import * as D from "./armory-d35e.js";
import { ArmoryForge } from "./armory-forge.js";

const MOD = "axeclefts-armory";
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const opt = (v, label, sel, extra = "") => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}${extra}>${esc(label)}</option>`;
const normName = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const KINDS = [["weapon", "Weapons"], ["armor", "Armor"], ["shield", "Shields"], ["ammo", "Ammunition"]];
const SLOTS = 4;

export class ArmoryCraft {
  constructor(api) { this.api = api; this.forge = new ArmoryForge(api); }
  get b() { return this.api.builder; }
  get data() { return this.api.data; }
  get C() { return this.data.crafting; }

  async prepare() {
    await this.api.loaded;
    if (!this.forge.bases) await this.forge.prepare();
  }

  /* ---------- shared form pieces ---------- */
  baseSelect(name, sel, { blank = "Choose a base item…" } = {}) {
    const B = this.forge.bases ?? {};
    return `<select name="craft.${name}">${opt("", blank, sel)}${KINDS.map(([k, label]) => `<optgroup label="${esc(label)}" data-kind="${k}">${(B[k] ?? [])
      .map((x) => opt(`${x.pack}|${x.id}`, x.name, sel, ` data-kind="${k}"`)).join("")}</optgroup>`).join("")}</select>`;
  }
  sizeSelect(sel) {
    return `<div class="form-group" data-craft-show="light"><label>Size</label><select name="craft.size">${opt("med", "Medium", sel)}${opt("sm", "Small (same price, half the weight)", sel)}${opt("lg", "Large (twice the base price and weight)", sel)}</select></div>`;
  }
  materialSelect(sel) {
    return `<select name="craft.material">${opt("", "None (ordinary)", sel)}${this.data.materials.map((m) => opt(m.name, m.name[0].toUpperCase() + m.name.slice(1), sel, ` data-kinds="${m.applies.join(" ")}"`)).join("")}</select>`;
  }
  /** Masterwork arms in the crafter's inventory that can be enchanted. */
  inventory(actor) {
    return (actor?.items ?? []).filter((i) => {
      const k = D.armsKind(i);
      if (!k) return false;
      const s = i.system ?? {};
      if (Number(s.enh) > 0 || Number(s.armor?.enh) > 0 || (s.enhancements?.items ?? []).length) return false;
      const spec = i.flags?.[MOD]?.spec;
      return !!(s.masterwork || spec?.masterwork || (spec?.material && this.data.materials.find((m) => normName(m.name) === normName(spec.material))?.masterwork) || /masterwork/i.test(i.name));
    }).map((i) => ({ id: i.id, name: i.name, kind: D.armsKind(i), qty: Number(i.system?.quantity ?? 1) || 1 }));
  }
  catalogKind(ref) { const [pack, id] = String(ref ?? "").split("|"); for (const [k] of KINDS) if ((this.forge.bases?.[k] ?? []).some((x) => x.pack === pack && x.id === id)) return k; return null; }

  /** Show only what fits the chosen base (abilities, materials), and the right fields for each choice. */
  wireFilter(section, getKind) {
    const filter = () => {
      const k = getKind();
      section.querySelectorAll("option[data-kinds]").forEach((o) => { const fits = !k || o.dataset.kinds.split(" ").includes(k); o.hidden = !fits; o.disabled = !fits; });
      for (const s of section.querySelectorAll('select[name^="craft.ab"], select[name="craft.material"]')) if (s.selectedOptions[0]?.disabled) s.value = "";
      const show = (sel, on) => section.querySelectorAll(`[data-craft-show="${sel}"]`).forEach((x) => { x.style.display = on ? "" : "none"; });
      const src = section.querySelector('[name="craft.source"]')?.value;
      show("inv", src === "inventory"); show("catalog", src !== "inventory");
      show("bane", [...section.querySelectorAll('select[name^="craft.ab"]')].some((s) => s.value === "srd:Bane"));
      show("ammo", k === "ammo");
      show("light", k !== "ammo");
      show("theme", section.querySelector('[name="craft.light"]')?.value === "on");
      const epic = section.querySelector('[name="craft.epic"]')?.checked;
      section.querySelectorAll("option[data-epic]").forEach((o) => { o.hidden = !epic; o.disabled = !epic; });
      const b = section.querySelector('[name="craft.bonus"]');
      if (b?.selectedOptions[0]?.disabled) b.value = "5";
    };
    section.addEventListener("change", filter);
    filter();
  }

  /* ---------- SRD Craft checks for the mundane part ---------- */
  /** The Craft skill and DC for a base item (SRD Craft table). */
  craftFor(facts, data) {
    const C = this.C, n = facts.name ?? data?.name ?? "";
    const s = data?.system ?? {};
    if (facts.kind === "armor" || facts.kind === "shield") return { skill: C.craftSkill.armor, dc: C.craftDC.armorBase + (Number(s.armor?.value) || 0) };
    if (facts.kind === "ammo") return { skill: /arrow/i.test(n) ? C.craftSkill.arrow : C.craftSkill.ammo, dc: C.craftDC.simple };
    if (/crossbow/i.test(n)) return { skill: C.craftSkill.weapon, dc: C.craftDC.crossbow };
    if (/\bbow\b|longbow|shortbow/i.test(n)) {
      if (/composite/i.test(n)) { const r = Number(n.match(/\+\s*(\d+)/)?.[1] ?? 0); return { skill: C.craftSkill.bow, dc: C.craftDC.compositeBow + (r > 0 ? 2 * r : 0) }; }
      return { skill: C.craftSkill.bow, dc: C.craftDC.bow };
    }
    return { skill: C.craftSkill.weapon, dc: C.craftDC[s.weaponType] ?? C.craftDC.martial };
  }
  /**
   * The Craft checks for making the item (and its masterwork component, a separate part at DC 20).
   * Prices are for the whole batch. Raw materials are ⅓ of each part's price.
   */
  craftChecks(built, qty) {
    const facts = built.craft.facts, parts = Object.fromEntries(built.craft.parts.map(([l, n]) => [l, n]));
    const mwPrice = this.C.masterworkPrice[facts.kind] ?? 0;
    const m = built.craft.material ? this.data.materials.find((x) => normName(x.name) === normName(built.craft.material)) : null;
    const matCost = m ? parts[m.name.toLowerCase()] ?? 0 : 0;
    const mw = built.craft.masterwork ? (m?.includesMasterwork ? Math.min(mwPrice, matCost) : parts.masterwork ?? mwPrice) : 0;
    const itemPrice = round2(((parts.base ?? facts.price ?? 0) + matCost - (m?.includesMasterwork ? mw : 0)) * qty);
    const { skill, dc } = this.craftFor(facts, built.data);
    const checks = [{ key: "item", label: `${facts.name}${m ? ` (${m.name})` : ""}`, craft: skill, dc, price: itemPrice, raw: round2(itemPrice / 3) }];
    if (mw) checks.push({ key: "masterwork", label: "Masterwork component", craft: skill, dc: this.C.craftDC.masterwork, price: round2(mw * qty), raw: round2((mw * qty) / 3) });
    return checks;
  }

  /* ---------- Magic arms and armor ---------- */
  magicContent({ actor, values: v }) {
    const inv = this.inventory(actor);
    const src = v.source ?? (inv.length ? "inventory" : "buy");
    const abOpts = this.forge.abilityOptions();
    const groups = [...new Set(abOpts.map((o) => o.group))];
    const abSelect = (i) => `<select name="craft.ab${i}">${opt("", "None", v[`ab${i}`])}${groups.map((g) => `<optgroup label="${esc(g)}">${abOpts.filter((o) => o.group === g).map((o) => opt(o.value, o.label, v[`ab${i}`], ` data-kinds="${o.kinds.join(" ")}"`)).join("")}</optgroup>`).join("")}</select>`;
    const themes = Object.keys(this.data.generation.light.themes).map((k) => opt(k, k, v.theme)).join("");
    return `<p class="hint">Craft Magic Arms and Armor (SRD): the base must be a masterwork item. Magic supplies cost half the base price in gp and 1/25 in XP; the masterwork item is the item cost. Caster level at least 3 × the enhancement bonus, and each ability's own caster level and spells.</p>
      <div class="form-group"><label>Masterwork item</label><select name="craft.source">${opt("inventory", `From ${actor?.name ?? "the crafter"}'s inventory`, src)}${opt("buy", "Buy it (pay the item cost)", src)}${opt("craft", "Make it first with Craft", src)}</select></div>
      <div class="form-group" data-craft-show="inv"><label>Item</label><select name="craft.inv">${opt("", inv.length ? "Choose…" : "No masterwork arms in the inventory", v.inv)}${inv.map((i) => opt(i.id, `${i.name}${i.qty > 1 ? ` (${i.qty})` : ""}`, v.inv, ` data-kind="${i.kind}"`)).join("")}</select></div>
      <div class="form-group" data-craft-show="catalog"><label>Base item</label>${this.baseSelect("base", v.base)}</div>
      <div class="form-group" data-craft-show="catalog"><label>Material</label>${this.materialSelect(v.material)}</div>
      <div data-craft-show="catalog">${this.sizeSelect(v.size)}</div>
      <div class="form-group"><label>Enhancement</label><select name="craft.bonus">${[1, 2, 3, 4, 5].map((n) => opt(n, `+${n}`, v.bonus ?? "1")).join("")}${Array.from({ length: 15 }, (_, i) => i + 6).map((n) => opt(n, `+${n} (epic)`, v.bonus, ' data-epic="1"')).join("")}</select>
        ${globalThis.AxecleftTreasure?.rules?.()?.epic ? `<label class="acr-cb" style="flex:0 0 auto;margin-left:8px"><input type="checkbox" name="craft.epic" ${v.epic ? "checked" : ""}> Epic</label>` : ""}</div>
      <fieldset><legend>Special abilities</legend>
        ${Array.from({ length: SLOTS }, (_, i) => `<div class="form-group"><label>Ability ${i + 1}</label>${abSelect(i)}</div>`).join("")}
        <div class="form-group" data-craft-show="bane"><label>Bane foe</label><select name="craft.foe">${this.data.tables.baneFoes.map((f) => opt(f.foe, f.foe, v.foe)).join("")}</select></div>
        <p class="hint">SRD abilities carry their prerequisites in the Armory's data (psionic ones need Craft Psionic Arms and Armor, with powers in place of spells). Custom abilities (Shared Data or your own enhancement items) are read from their description:</p>
        ${globalThis.AxecleftCrafting?.prereqHelp?.("abilities") ?? ""}
      </fieldset>
      <div class="form-group" data-craft-show="light"><label>Sheds light</label><select name="craft.light">${opt("none", "No", v.light)}${opt("on", "Yes", v.light)}</select><span class="hint" style="flex:1">SRD: the creator decides now; it can't be changed later.</span></div>
      <div class="form-group" data-craft-show="theme"><label>Look</label><select name="craft.theme">${opt("", "From its abilities (or neutral)", v.theme)}${themes}</select></div>
      <div class="form-group" data-craft-show="light"><label>Intelligent</label><label class="acr-cb" style="flex:1"><input type="checkbox" name="craft.intel" ${v.intel ? "checked" : ""}> Make it intelligent (SRD: caster level 15; it takes your alignment; its other features are rolled when the GM approves, and their price is added)</label></div>
      <div class="form-group" data-craft-show="ammo"><label>Pieces</label><input type="number" name="craft.qty" value="${esc(v.qty ?? 50)}" min="1" max="50" step="1"><span class="hint" style="flex:1">magic ammunition is made 50 at a time; fewer pieces cost proportionally less</span></div>`;
  }
  /** At approval the GM's client rolls an intelligent item's features (the SRD: "Determine other features randomly"). */
  async magicBeforeApprove({ actor, values }) {
    if (!values?.intel || values.intelData) return null;
    const p = await this.magicEvaluate({ actor, values: { ...values, intelRoll: true } });
    return p.intelData ? { ...values, intelData: p.intelData } : null;
  }
  magicWire(section, { actor }) {
    const inv = this.inventory(actor);
    this.wireFilter(section, () => {
      const src = section.querySelector('[name="craft.source"]')?.value;
      if (src === "inventory") return inv.find((i) => i.id === section.querySelector('[name="craft.inv"]')?.value)?.kind ?? null;
      return section.querySelector('[name="craft.base"]')?.selectedOptions?.[0]?.dataset?.kind ?? null;
    });
  }
  async magicEvaluate({ actor, values: v }) {
    await this.prepare();
    const src = v.source || "inventory";
    let base, baseKind, material = null, consume = [], spec0 = null;
    if (src === "inventory") {
      const it = actor?.items?.get(v.inv);
      if (!it) throw new Error("Choose a masterwork item from the inventory, or buy or make one.");
      const spec = it.flags?.[MOD]?.spec;
      spec0 = spec;
      baseKind = D.armsKind(it);
      if (spec?.base && !spec.base.system) { base = spec.base; material = spec.material ?? null; } else base = D.cleanCopy(it);
      consume = [{ id: it.id, qty: baseKind === "ammo" ? Math.max(1, Number(v.qty) || 50) : 0 }];
    } else {
      if (!v.base) throw new Error("Choose a base item.");
      const [pack, id] = v.base.split("|");
      base = { pack, id };
      baseKind = this.catalogKind(v.base);
      material = v.material || null;
    }
    const abilities = Array.from({ length: SLOTS }, (_, i) => v[`ab${i}`]).filter(Boolean);
    const f = { kind: baseKind, base, baseKind, grade: "medium", bonus: String(Number(v.bonus) || 1), masterwork: true, material: material ?? "", epic: (!!v.epic || abilities.some((x) => /^srd:/.test(x) && (this.data.abilities.weapon[x.slice(4)]?.epic || this.data.abilities.armor[x.slice(4)]?.epic))) && !!globalThis.AxecleftTreasure?.rules?.()?.epic, // an epic ability makes it epic
      size: src === "inventory" ? (spec0?.size ?? "med") : v.size || "med",
      abilities, foe: v.foe || this.data.tables.baneFoes[0].foe, light: v.light === "on" ? "on" : "none", theme: v.theme ?? "", color: "", anim: "", speed: 3, intensity: 4,
      bright: "", dim: "", hint: "no", identified: true, qty: Math.max(1, Math.min(50, Number(v.qty) || 50)), count: 1 };
    const { spec } = await this.forge.resolve(f);
    const built = await this.b.build(spec);
    const k = built.craft.facts.kind, ammo = k === "ammo";
    // Intelligent item: rolled by the GM at approval (kept in values.intelData), then priced like any other feature
    let intelData = null, intel = null;
    if (v.intel && !ammo && this.api.intelligence) {
      if (v.intelData) intel = JSON.parse(v.intelData);
      else if (v.intelRoll) {
        const al = globalThis.AxecleftCrafting?.actor?.alignment(actor) ?? { lc: "n", ge: "n" };
        intel = await this.api.intelligence.roll({ alignment: `${al.lc}${al.ge}`, abilities: built.craft.abilities.map((a) => ({ name: a.title })), bonus: Number(v.bonus) || 1, effective: built.effective });
        intelData = JSON.stringify(intel);
      }
      if (intel) this.api.intelligence.apply(built, intel);
    }
    const qty = ammo ? built.quantity : 1;
    const basePrice = round2(built.craft.magicEach * qty);
    const mundane = round2(built.craft.mundaneEach * qty);
    const plan = {
      // Epic (enhancement above +5, total above +10, or an epic ability): the engine (1.6) adds Craft Epic Magic Arms and Armor and the epic XP
      magic: true, feat: "Craft Magic Arms and Armor", epic: built.data?.system?.epic === true,
      name: built.name, img: built.data.img, data: built.data, quantity: qty, market: round2(built.price * qty), base: basePrice,
      summary: built.summary, consume, notes: [], requirements: [], checks: [], spells: [],
    };
    plan.data.system.identified = true;
    if (src === "buy") { plan.itemCost = mundane; plan.itemCostLabel = `Masterwork ${built.craft.facts.name}${material ? ` (${material})` : ""}, bought`; }
    if (src === "craft") { plan.checks = this.craftChecks(built, qty); plan.raw = round2(plan.checks.reduce((s, c) => s + c.raw, 0)); plan.notes.push("The masterwork item is made with Craft first (raw materials ⅓ of its price); the magic is added when the checks succeed."); }
    if (src === "inventory") plan.notes.push(`${actor.items.get(v.inv)?.name} becomes the magic item${ammo ? ` (${qty} pieces used)` : ""}.`);
    // Caster level and prerequisites (SRD Magic Items)
    const bonus = Number(v.bonus) || 1;
    const why = [`3 × +${bonus} = ${3 * bonus}`];
    plan.casterLevel = Math.max(3 * bonus, 1);
    for (const a of built.craft.abilities) {
      if (!a.craft) {
        // A custom ability (Shared Data, the GM's own): read the SRD construction line from its description (Crafting engine 1.2)
        const C = globalThis.AxecleftCrafting;
        const curios = game.modules.get("axeclefts-curios")?.api?.spells;
        const pre = C?.parsePrereqs?.(a.html ?? "", { spell: (x) => curios?.resolveName?.(x) ?? (/^[a-z][a-z' ,]+$/i.test(x) && !/creator|caster|must|rank|level/i.test(x) ? x : null), isFeat: (x) => /^craft |^forge |^scribe |^brew |spell$/i.test(x), itemName: a.title });
        if (!pre) { plan.requirements.push({ key: `custom.${a.title}`, label: `${a.title}: prerequisites`, ok: "warn", detail: "no construction line in its description; the GM decides (see How requirements are found)", waivable: true }); continue; }
        if (pre.cl > plan.casterLevel) plan.casterLevel = pre.cl;
        if (pre.cl) why.push(`${a.title} CL ${pre.cl}`);
        for (const g of pre.spells) plan.spells.push({ any: g, for: a.title });
        if (pre.align.length) plan.align = [...new Set([...(plan.align ?? []), ...pre.align])];
        for (const o of pre.other) plan.requirements.push({ key: `custom.${a.title}.${o}`, label: `${a.title}: ${o}`, ok: "warn", detail: "the GM checks this", waivable: true });
        continue;
      }
      if (a.craft.cl > plan.casterLevel) plan.casterLevel = a.craft.cl;
      why.push(`${a.title} CL ${a.craft.cl}`);
      for (const g of a.craft.spells ?? []) plan.spells.push({ any: g, for: a.title });
      if (a.craft.align) plan.align = [...new Set([...(plan.align ?? []), a.craft.align])];
      if (a.craft.cls) plan.cls = [...new Set([...(plan.cls ?? []), a.craft.cls])];
      if (a.craft.minLevel) plan.minLevel = Math.max(plan.minLevel ?? 0, a.craft.minLevel);
    }
    // SRD psionic abilities: Craft Psionic Arms and Armor (the powers stand in for spells; manifester level for caster level).
    // All psionic: that feat alone makes the item, enhancement bonus included. Mixed: both feats.
    const psi = built.craft.abilities.filter((a) => a.craft?.feat === "Craft Psionic Arms and Armor");
    if (psi.length) {
      if (psi.length === built.craft.abilities.length) plan.feat = "Craft Psionic Arms and Armor";
      else {
        const has = globalThis.AxecleftCrafting?.actor?.feats?.(actor)?.has?.(normName("Craft Psionic Arms and Armor"));
        plan.requirements.push({ key: "feat.psionic", label: "Craft Psionic Arms and Armor", ok: has === undefined ? "warn" : has, detail: has === undefined ? "the GM checks this" : has ? `has the feat (for ${psi.map((a) => a.title).join(", ")})` : `doesn't have the feat (needed for ${psi.map((a) => a.title).join(", ")})`, waivable: false });
      }
      plan.notes.push("Psionic abilities: the powers listed stand in for spells, and manifester level for caster level (SRD Psionic Items).");
    }
    if (v.intel && !ammo) {
      plan.casterLevel = Math.max(plan.casterLevel, 15);
      why.push("an intelligent item 15");
      if (intel) plan.notes.push(`Intelligent: ${intel.lines.join(" · ")}; adds ${intel.price.toLocaleString("en-US")} gp to the base price.`);
      else plan.notes.push("Intelligent: it takes the crafter's alignment; its mind, powers and any special purpose are rolled when the GM approves, and their price (from +1,000 gp) is added to the base price, so the gp, XP and time rise.");
    }
    if (intelData) plan.intelData = intelData;
    plan.casterNote = `item needs ${why.join("; ")}`;
    if (built.craft.facts.double) plan.notes.push("SRD: a double weapon counts as two weapons for cost, time, XP and abilities; enchant each head separately.");
    if (v.light === "on") plan.notes.push("Sheds light (decided at creation).");
    return plan;
  }

  /* ---------- Mundane and masterwork arms (Craft) ---------- */
  mundaneContent({ values: v }) {
    return `<p class="hint">Craft (SRD): raw materials cost ⅓ of the price; the DC comes from the Craft table. A masterwork item has a separate masterwork component (DC 20). Each check failed by 5 or more ruins half that part's raw materials.</p>
      <div class="form-group"><label>Item</label>${this.baseSelect("base", v.base)}</div>
      <div class="form-group"><label>Masterwork</label><label class="acr-cb" style="flex:1"><input type="checkbox" name="craft.masterwork" ${v.masterwork ? "checked" : ""}> Masterwork (adamantine, mithral, darkwood and dragonhide always are)</label></div>
      <div class="form-group"><label>Material</label>${this.materialSelect(v.material)}</div>
      ${this.sizeSelect(v.size)}
      <div class="form-group" data-craft-show="ammo"><label>Pieces</label><input type="number" name="craft.qty" value="${esc(v.qty ?? 20)}" min="1" step="1"></div>`;
  }
  mundaneWire(section) {
    this.wireFilter(section, () => section.querySelector('[name="craft.base"]')?.selectedOptions?.[0]?.dataset?.kind ?? null);
  }
  async mundaneEvaluate({ values: v }) {
    await this.prepare();
    if (!v.base) throw new Error("Choose an item to make.");
    const [pack, id] = v.base.split("|");
    const kind = this.catalogKind(v.base);
    const m = v.material ? this.data.materials.find((x) => normName(x.name) === normName(v.material)) : null;
    const qty = kind === "ammo" ? Math.max(1, Number(v.qty) || 20) : 1;
    const built = await this.b.build({ base: { pack, id }, masterwork: !!v.masterwork || !!m?.masterwork, material: v.material || null, quantity: qty, size: v.size || "med", identified: true });
    const checks = this.craftChecks(built, qty);
    return {
      magic: false, name: built.name, img: built.data.img, data: built.data, quantity: qty, market: round2(built.price * qty),
      raw: round2(checks.reduce((s, c) => s + c.raw, 0)), checks, summary: built.summary, requirements: [], notes: [],
    };
  }
}

/* ---------- Specific magic arms (from their SRD statblock) ---------- */

const SPEC_KINDS = [["weapon", "Weapons"], ["armor", "Armor and shields"], ["ammo", "Ammunition"]];
const CRAFT_MIN = { "craft magic arms and armor": 5, "craft psionic arms and armor": 5, "craft epic magic arms and armor": 0, "craft rod": 9, "craft staff": 12, "craft wondrous item": 3 };

export class ArmorySpecificCraft {
  constructor(api) { this.api = api; this.list = null; this.feats = null; }

  /** Specific magic weapons, armor, shields and ammunition in the item sources (and D35E's Magic Items). */
  async prepare() {
    await this.api.loaded;
    const hub = globalThis.AxecleftTreasure;
    const rules = hub?.rules?.() ?? { psionics: true, epic: false };
    const key = `${rules.psionics}|${rules.epic}|${(hub?.itemSources?.().packs ?? []).join(",")}`;
    if (this.list && this.key === key) return; // the window prepares every tab on each render
    this.key = key;
    const out = new Map();
    const packs = [...new Set([...(hub?.itemSources?.().packs ?? []), "D35E.magicitems"])];
    for (const id of packs) {
      const pack = game.packs.get(id);
      if (!pack || pack.documentName !== "Item") continue;
      const magicPack = /magic|wondrous|enchant/i.test(pack.metadata?.label ?? "") || id === "D35E.magicitems";
      let index;
      try { index = await pack.getIndex({ fields: ["type", "system.subType", "system.equipmentType", "system.equipmentSubtype", "system.weaponSubtype", "system.masterwork", "system.enh", "system.armor.enh", "system.price", "system.epic", "system.tags"] }); } catch (e) { continue; }
      for (const e of index) {
        if (e.type === "Folder") continue;
        const cat = hub?.classifyItem?.({ ...e, system: { ...(e.system ?? {}), price: Math.max(1000, Number(e.system?.price) || 0) } }, magicPack, { allowEpic: true });
        if (cat !== "magic:weapon" && cat !== "magic:armor") continue;
        // Only named items: "+1 Longsword" is made on the other tab
        if (/^\+\d/.test(e.name)) continue;
        if (!rules.epic && hub?.isEpicItem?.(e)) continue;
        if (!rules.psionics && hub?.isPsionicItem?.(e)) continue;
        const kind = e.type === "loot" ? "ammo" : e.type === "weapon" ? "weapon" : "armor";
        const k = normName(e.name);
        if (!out.has(k)) out.set(k, { name: e.name, kind, pack: id, id: e._id });
      }
    }
    this.list = [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async featNames() {
    if (this.feats) return this.feats;
    const out = new Set();
    for (const pack of game.packs ?? []) {
      if (pack.documentName !== "Item" || !(pack.collection === "D35E.feats" || /\bfeats?\b/i.test(pack.metadata?.label ?? ""))) continue;
      try { for (const e of await pack.getIndex()) out.add(normName(e.name)); } catch (e) { /* unreadable */ }
    }
    return (this.feats = out);
  }

  content({ values: v }) {
    const k = v.skind ?? "weapon";
    return `<p class="hint">Specific magic weapons, armor, shields and ammunition (Flame Tongue, Celestial Armor…) from your item compendiums, by the SRD statblock in each item's description: its caster level, spells and other prerequisites, and its cost (the masterwork item plus half the magic's price, and 1/25 of that in XP).</p>
      <div class="form-group"><label>Kind</label><select name="craft.skind">${SPEC_KINDS.map(([x, l]) => opt(x, l, k)).join("")}</select></div>
      <div class="form-group"><label>Item</label><input type="text" name="craft.sname" list="ac-specific" value="${esc(v.sname ?? "")}" placeholder="Type to search"><datalist id="ac-specific"></datalist></div>
      ${globalThis.AxecleftCrafting?.prereqHelp?.("arms") ?? ""}`;
  }

  wire(section) {
    const fill = () => {
      const k = section.querySelector('[name="craft.skind"]')?.value ?? "weapon";
      const dl = section.querySelector("#ac-specific");
      if (dl) dl.innerHTML = (this.list ?? []).filter((x) => x.kind === k).map((x) => `<option value="${esc(x.name)}">`).join("");
    };
    section.querySelector('[name="craft.skind"]')?.addEventListener("change", () => { const n = section.querySelector('[name="craft.sname"]'); if (n) n.value = ""; fill(); });
    fill();
  }

  async evaluate({ actor, values: v }) {
    if (!this.list) await this.prepare();
    const name = String(v.sname ?? "").trim();
    if (!name) throw new Error("Choose an item to make.");
    const hit = this.list.find((x) => normName(x.name) === normName(name));
    if (!hit) throw new Error(`${name} is not a specific magic weapon or armor in your item compendiums.`);
    const hub = globalThis.AxecleftTreasure, C = globalThis.AxecleftCrafting;
    const doc = await game.packs.get(hit.pack)?.getDocument(hit.id);
    if (!doc) throw new Error(`Could not read ${name}.`);
    const data = doc.toObject();
    delete data._id; delete data.folder; delete data.sort;
    const fix = hub?.applyPriceCorrection?.(hit.pack, data);
    let html = data.system?.description?.value ?? "";
    const link = C?.linkedDescription?.(html);
    if (link) { try { html = (await fromUuid(link.startsWith("Compendium.") ? link : `Compendium.${link}`))?.system?.description?.value ?? html; } catch (e) { /* keep */ } }
    const curios = game.modules.get("axeclefts-curios")?.api?.spells;
    try { await curios?.index?.(); } catch (e) { /* Curios not loaded */ }
    const myFeats = C?.actor?.feats(actor) ?? new Set(), known = await this.featNames();
    const pre = C?.parsePrereqs?.(html, {
      spell: (x) => curios?.resolveName?.(x) ?? (/^[a-z][a-z' ,/-]+$/i.test(x) && !/creator|caster|must|rank|level|bonus/i.test(x) ? x : null),
      isFeat: (x) => myFeats.has(normName(x)) || known.has(normName(x)), itemName: data.name,
    });
    if (/minor artifact|major artifact|cannot be created/i.test(C?.plainText?.(html) ?? "")) throw new Error(`${data.name} is an artifact; it can't be made.`);
    // Price: a price correction first, then the statblock's own price when the compendium's is missing or different
    let price = Number(data.system?.price) || 0;
    const notes = [];
    if (fix) notes.push(`Price corrected to ${price.toLocaleString("en-US")} gp (${fix.note || "price correction"}).`);
    else if (pre?.price && pre.price !== price) { notes.push(`Price ${pre.price.toLocaleString("en-US")} gp from its statblock (the compendium says ${price.toLocaleString("en-US")} gp).`); price = pre.price; }
    if (!(price > 0)) throw new Error(`${data.name} has no price; add one on the Price Corrections page of the Treasure Lists journal.`);
    data.system.price = price;
    data.system.identified = true;
    const plan = { magic: true, name: data.name, img: data.img, data, quantity: 1, market: price, requirements: [], checks: [], notes, spells: [] };
    const enh = Math.max(Number(data.system?.enh) || 0, Number(data.system?.armor?.enh) || 0);
    if (!pre) {
      plan.feat = "Craft Magic Arms and Armor";
      plan.base = price;
      plan.casterLevel = Math.max(5, 3 * enh);
      plan.casterNote = `Craft Magic Arms and Armor 5${enh ? `; 3 × +${enh}` : ""}`;
      plan.requirements.push({ key: "line", label: "Prerequisites", ok: "warn", detail: "no construction line in its description; the GM decides (see How requirements are found)", waivable: true });
      return plan;
    }
    const creation = pre.feats.filter((f) => CRAFT_MIN[normName(f)] !== undefined || /^(craft|forge|scribe|brew)\b/i.test(f));
    plan.feat = creation.find((f) => !/epic/i.test(f)) ?? "Craft Magic Arms and Armor";
    const why = [];
    let cl = 5;
    for (const f of creation) { const m = CRAFT_MIN[normName(f)] ?? 0; if (m > cl) { cl = m; why.push(`${f} ${m}`); } }
    if (enh && 3 * enh > cl) { cl = 3 * enh; why.push(`3 × +${enh}`); }
    if (pre.minCl && pre.minCl > cl) { cl = pre.minCl; why.push(`the item needs ${pre.minCl}`); }
    plan.casterLevel = cl;
    plan.casterNote = `${why.join("; ") || `${plan.feat} 5`}${pre.cl ? `; the item works at caster level ${pre.cl}` : ""}`;
    for (const f of pre.feats) if (normName(f) !== normName(plan.feat)) {
      const has = myFeats.has(normName(f));
      plan.requirements.push({ key: `feat.${f}`, label: f, ok: has, detail: has ? "has the feat" : "doesn't have the feat", waivable: !/^(craft|forge|scribe|brew)\b/i.test(f) });
    }
    plan.spells = pre.spells.map((g) => ({ any: g, for: data.name }));
    if (pre.align.length) plan.align = [...new Set(pre.align)];
    if (pre.minLevel) plan.minLevel = pre.minLevel;
    for (const sk of pre.skills) plan.requirements.push({ key: `skill.${sk.skill}`, label: `${sk.ranks} ranks in ${sk.skill}`, ok: "warn", detail: "the GM checks", waivable: true });
    for (const o of pre.other) plan.requirements.push({ key: `other.${o}`, label: o[0].toUpperCase() + o.slice(1), ok: "warn", detail: "the GM checks this", waivable: true });
    // SRD cost: the XP gives the magic's base price (XP × 25); the rest of the gp is the masterwork item and material
    if (pre.cost) {
      const base = pre.cost.xp * 25, item = Math.round((pre.cost.gp - base / 2) * 100) / 100;
      if (item >= 0) { plan.base = base; plan.itemCost = item; plan.itemCostLabel = "Masterwork item and materials (from the SRD cost)"; }
      else { plan.base = pre.cost.gp * 2; plan.xpExtra = Math.max(0, pre.cost.xp - plan.base / 25); }
      notes.push(`SRD cost: ${pre.cost.gp.toLocaleString("en-US")} gp and ${pre.cost.xp.toLocaleString("en-US")} XP.`);
    } else {
      plan.base = price;
      notes.push("Its statblock gives no Cost, so the whole price counts as magic (the SRD would charge the masterwork item at full price and only the rest at half).");
    }
    plan.summary = `${SPEC_KINDS.find(([x]) => x === hit.kind)?.[1]?.replace(/s$/, "") ?? "Item"}${pre.cl ? `; caster level ${pre.cl}` : ""}${pre.text ? `; prerequisites: ${pre.text}` : ""}`;
    return plan;
  }
}

/** Register the Armory's kinds with the shared Crafting engine. */
export function registerCrafting(api) {
  const C = globalThis.AxecleftCrafting;
  if (!C?.registerKind) return null;
  const craft = new ArmoryCraft(api);
  api.craft = craft;
  C.registerKind({
    module: MOD, key: "magic-arms", label: "Magic arms and armor", icon: "fas fa-wand-sparkles", order: 20, magic: true, feat: "Craft Magic Arms and Armor",
    prepare: () => craft.prepare(), content: (ctx) => craft.magicContent(ctx), wire: (s, ctx) => craft.magicWire(s, ctx), evaluate: (ctx) => craft.magicEvaluate(ctx),
    beforeApprove: (ctx) => craft.magicBeforeApprove(ctx),
  });
  const specific = new ArmorySpecificCraft(api);
  api.specificCraft = specific;
  C.registerKind({
    module: MOD, key: "specific-arms", label: "Specific magic arms", icon: "fas fa-khanda", order: 20.5, magic: true,
    prepare: () => specific.prepare(), content: (ctx) => specific.content(ctx), wire: (s) => specific.wire(s), evaluate: (ctx) => specific.evaluate(ctx),
  });
  C.registerKind({
    module: MOD, key: "arms", label: "Arms and armor (Craft)", icon: "fas fa-hammer", order: 21, magic: false,
    prepare: () => craft.prepare(), content: (ctx) => craft.mundaneContent(ctx), wire: (s) => craft.mundaneWire(s), evaluate: (ctx) => craft.mundaneEvaluate(ctx),
  });
  return craft;
}
