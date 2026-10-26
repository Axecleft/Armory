/**
 * Axecleft's Armory — crafting kinds for the shared Crafting window (axecleft-crafting.js).
 *
 *  - Magic arms and armor (Craft Magic Arms and Armor): a masterwork item from the inventory, bought, or made
 *    with Craft first; enhancement bonus and special abilities; SRD prerequisites from data/armory.json.
 *  - Arms and armor (Craft): mundane and masterwork weapons, armor, shields and ammunition, by the SRD Craft rules.
 */
import * as D from "./armory-d35e.js";
import { ArmoryForge } from "./armory-forge.js";
import { materialName } from "./armory-builder.js";

const MOD = "axeclefts-armory";
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const opt = (v, label, sel, extra = "") => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}${extra}>${esc(label)}</option>`;
const normName = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const { gp, num, t } = D;
const H = (s, d) => esc(t(s, d));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const KINDS = [["weapon", /*t*/"Weapons"], ["armor", /*t*/"Armor"], ["shield", /*t*/"Shields"], ["ammo", /*t*/"Ammunition"]];
const SLOTS = 4; // ability rows shown at first; another appears whenever every row is filled
/** The ability values in the form, in row order (craft.ab0, craft.ab1…; p "sb" for a double weapon's other end). */
const slotValues = (v, p = "ab") => Object.keys(v ?? {}).filter((k) => new RegExp(`^${p}\\d+$`).test(k)).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))).map((k) => v[k]).filter(Boolean);

export class ArmoryCraft {
  constructor(api) { this.api = api; this.forge = new ArmoryForge(api); }
  get b() { return this.api.builder; }
  get data() { return this.api.data; }
  get C() { return this.data.crafting; }

  async prepare() {
    await this.api.loaded;
    if (!this.forge.bases) await this.forge.prepare();
    else await this.forge.loadCustom(); // enhancements imported since the last window
  }

  /* ---------- shared form pieces ---------- */
  baseSelect(name, sel, { blank = t("Choose a base item…") } = {}) {
    const B = this.forge.bases ?? {};
    return `<select name="craft.${name}">${opt("", blank, sel)}${KINDS.map(([k, label]) => `<optgroup label="${H(label)}" data-kind="${k}">${(B[k] ?? [])
      .map((x) => opt(`${x.pack}|${x.id}`, x.name, sel, ` data-kind="${k}"${x.double ? ' data-double="1"' : ""}`)).join("")}</optgroup>`).join("")}</select>`;
  }
  sizeSelect(sel) {
    return `<div class="form-group" data-craft-show="light"><label>${H("Size")}</label><select name="craft.size">${opt("med", t("Medium"), sel)}${opt("sm", t("Small (same price, half the weight)"), sel)}${opt("lg", t("Large (twice the base price and weight)"), sel)}</select></div>`;
  }
  materialSelect(sel) {
    return `<select name="craft.material">${opt("", t("None (ordinary)"), sel)}${this.data.materials.map((m) => opt(m.name, materialName(m, { cap: true }), sel, ` data-kinds="${m.applies.join(" ")}"`)).join("")}</select>`;
  }
  /**
   * Arms in the crafter's inventory that can be enchanted: masterwork items, and (1.14.9.19; DMG, Adding New Abilities) magic
   * arms the Armory made, to add a higher bonus or new abilities for the difference in price. Their existing magic stays.
   * No body-slot surcharge: raising a bonus or adding an ability to arms and armor is the same kind of magic.
   * Cursed and intelligent items, and magic items the Armory didn't make (their magic can't be read back), aren't listed.
   */
  inventory(actor) {
    const out = [];
    for (const i of actor?.items ?? []) {
      const k = D.armsKind(i);
      if (!k) continue;
      const s = i.system ?? {};
      const spec = i.flags?.[MOD]?.spec;
      const magicData = Number(s.enh) > 0 || Number(s.armor?.enh) > 0 || (s.enhancements?.items ?? []).length
        || Number(s.bonusAmmoEnhancement) > 0 || /\d/.test(String(s.bonusAmmoAttack ?? "")) || (s.ammoDamageParts ?? []).length; // magic ammunition keeps its bonus in the ammunition fields
      const specMagic = Number(spec?.bonus) > 0 || (spec?.abilities ?? []).length > 0;
      const qty = Number(s.quantity ?? 1) || 1;
      if (magicData || specMagic) {
        if (!specMagic || !spec?.base || s.cursed || s.intelligent?.enabled || i.flags?.world?.axecleftCurse) continue;
        out.push({ id: i.id, name: i.name, kind: k, qty, double: !!s.properties?.dbl, magic: { bonus: Number(spec.bonus) || 0, abilities: spec.abilities ?? [], second: spec.second ?? null } });
        continue;
      }
      const mw = s.masterwork || spec?.masterwork || (spec?.material && this.data.materials.find((m) => normName(m.name) === normName(spec.material))?.masterwork) || /masterwork/i.test(i.name);
      if (mw) out.push({ id: i.id, name: i.name, kind: k, qty, double: !!s.properties?.dbl, magic: null });
    }
    return out;
  }
  catalogKind(ref) { const [pack, id] = String(ref ?? "").split("|"); for (const [k] of KINDS) if ((this.forge.bases?.[k] ?? []).some((x) => x.pack === pack && x.id === id)) return k; return null; }

  /** Show only what fits the chosen base (abilities, materials), and the right fields for each choice. */
  wireFilter(section, getKind) {
    const filter = () => {
      const k = getKind();
      section.querySelectorAll("option[data-kinds]").forEach((o) => { const fits = !k || o.dataset.kinds.split(" ").includes(k); o.hidden = !fits; o.disabled = !fits; });
      // Ability groups with nothing that fits (epic armor abilities on ammunition…) are hidden too
      section.querySelectorAll('select[name^="craft.ab"] optgroup, select[name^="craft.sb"] optgroup').forEach((g) => { const none = [...g.querySelectorAll("option")].every((o) => o.hidden); g.hidden = none; g.style.display = none ? "none" : ""; });
      for (const s of section.querySelectorAll('select[name^="craft.ab"], select[name^="craft.sb"]:not([name="craft.sbonus"]), select[name="craft.material"]')) if (s.selectedOptions[0]?.disabled) s.value = "";
      const show = (sel, on) => section.querySelectorAll(`[data-craft-show="${sel}"]`).forEach((x) => { x.style.display = on ? "" : "none"; });
      const src = section.querySelector('[name="craft.source"]')?.value;
      show("inv", src === "inventory"); show("catalog", src !== "inventory");
      show("bane", [...section.querySelectorAll('select[name^="craft.ab"], select[name^="craft.sb"]')].some((s) => s.value === "srd:Bane"));
      show("ammo", k === "ammo");
      show("light", k !== "ammo");
      show("theme", section.querySelector('[name="craft.light"]')?.value === "on");
      const epic = section.querySelector('[name="craft.epic"]')?.checked;
      section.querySelectorAll("option[data-epic]").forEach((o) => { o.hidden = !epic; o.disabled = !epic; });
      for (const b of section.querySelectorAll('[name="craft.bonus"], [name="craft.sbonus"]')) if (b?.selectedOptions[0]?.disabled) b.value = "5";
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
    const checks = [{ key: "item", label: `${built.baseShown ?? facts.name}${m ? ` (${materialName(m)})` : ""}`, craft: skill, dc, price: itemPrice, raw: round2(itemPrice / 3) }];
    if (mw) checks.push({ key: "masterwork", label: t("Masterwork component"), craft: skill, dc: this.C.craftDC.masterwork, price: round2(mw * qty), raw: round2((mw * qty) / 3) });
    return checks;
  }

  /* ---------- Magic arms and armor ---------- */
  magicContent({ actor, values: v }) {
    const inv = this.inventory(actor);
    const src = v.source ?? (inv.length ? "inventory" : "buy");
    const abOpts = this.forge.abilityOptions();
    const groups = [...new Set(abOpts.map((o) => o.group))];
    // "ab": the item's abilities (the main end of a double weapon); "sb": a double weapon's other end
    const abSelect = (i, p = "ab") => `<select name="craft.${p}${i}">${opt("", t("None"), v[`${p}${i}`])}${groups.map((g) => `<optgroup label="${esc(g)}">${abOpts.filter((o) => o.group === g).map((o) => opt(o.value, o.label, v[`${p}${i}`], ` data-kinds="${o.kinds.join(" ")}"`)).join("")}</optgroup>`).join("")}</select>`;
    this.abRow = (i, p = "ab") => `<div class="form-group"><label>${H("Ability {n}", { n: i + 1 })}</label>${abSelect(i, p)}</div>`;
    const rows = (p, min) => Array.from({ length: Math.max(min, slotValues(v, p).length + 1) }, (_, i) => this.abRow(i, p)).join("");
    const themes = Object.keys(this.data.generation.light.themes).map((k) => opt(k, k, v.theme)).join("");
    return `<p class="hint">${H("Craft Magic Arms and Armor (SRD): the base must be a masterwork item. Magic supplies cost half the base price in gp and 1/25 in XP; the masterwork item is the item cost. Caster level at least 3 × the enhancement bonus, and each ability's own caster level and spells.")}</p>
      <div class="form-group"><label>${H("Masterwork or magic item")}</label><select name="craft.source">${opt("inventory", actor?.name ? t("From {name}'s inventory", { name: actor.name }) : t("From the crafter's inventory"), src)}${opt("buy", t("Buy it (pay the item cost)"), src)}${opt("craft", t("Make it first with Craft"), src)}</select></div>
      <div class="form-group" data-craft-show="inv"><label>${H("Item")}</label><select name="craft.inv">${opt("", inv.length ? t("Choose…") : t("No masterwork or magic arms in the inventory"), v.inv)}${inv.map((i) => opt(i.id, `${i.name}${i.qty > 1 ? ` (${i.qty})` : ""}`, v.inv, ` data-kind="${i.kind}" data-qty="${i.qty}"${i.magic ? ` data-bonus="${i.magic.bonus}"` : ""}`)).join("")}</select></div>
      <p class="hint" data-craft-show="upgrade">${H("A magic item from the inventory keeps its magic: choose its new enhancement bonus (no lower) and the abilities to add. It needs every prerequisite of the new item; the cost, XP and time are the difference in price (DMG, Adding New Abilities).")}</p>
      <div class="form-group" data-craft-show="catalog"><label>${H("Base item")}</label>${this.baseSelect("base", v.base)}</div>
      <div class="form-group" data-craft-show="catalog"><label>${H("Material")}</label>${this.materialSelect(v.material)}</div>
      <div data-craft-show="catalog">${this.sizeSelect(v.size)}</div>
      <div class="form-group"><label>${H("Enhancement")}</label><select name="craft.bonus">${[1, 2, 3, 4, 5].map((n) => opt(n, `+${n}`, v.bonus ?? "1")).join("")}${Array.from({ length: 15 }, (_, i) => i + 6).map((n) => opt(n, t("+{n} (epic)", { n }), v.bonus, ' data-epic="1"')).join("")}</select>
        ${globalThis.AxecleftTreasure?.rules?.()?.epic ? `<label class="acr-cb" style="flex:0 0 auto;margin-left:8px"><input type="checkbox" name="craft.epic" ${v.epic ? "checked" : ""}> ${H("Epic")}</label>` : ""}</div>
      <fieldset><legend>${H("Special abilities")}</legend>
        <div data-craft-slots="ab">${rows("ab", SLOTS)}</div>
        <div class="form-group" data-craft-show="bane"><label>${H("Bane foe")}</label><select name="craft.foe">${this.data.tables.baneFoes.map((f) => opt(f.foe, f.foe, v.foe)).join("")}</select></div>
        <p class="hint">${H("SRD abilities carry their prerequisites in the Armory's data (psionic ones need Craft Psionic Arms and Armor, with powers in place of spells). Custom abilities (Shared Data or your own enhancement items) are read from their description:")}</p>
        ${globalThis.AxecleftCrafting?.prereqHelp?.("abilities") ?? ""}
      </fieldset>
      <fieldset data-craft-show="double"><legend>${H("Other end (double weapons)")}</legend>
        <div class="form-group"><label>${H("Enhancement")}</label><select name="craft.sbonus">${opt("", t("None (masterwork)"), v.sbonus)}${opt("same", t("Same as the main end"), v.sbonus)}${[1, 2, 3, 4, 5].map((n) => opt(n, `+${n}`, v.sbonus)).join("")}${Array.from({ length: 15 }, (_, i) => i + 6).map((n) => opt(n, t("+{n} (epic)", { n }), v.sbonus, ' data-epic="1"')).join("")}</select></div>
        <div data-craft-slots="sb">${rows("sb", 1)}</div>
        <p class="hint">${H("SRD: each end of a double weapon is enchanted separately, at the price of a weapon of its own (gp, XP and time); its abilities need their own prerequisites. D35E keeps one set of enhancements per item, so the other end goes in the item's attack note and description.")}</p>
      </fieldset>
      <div class="form-group" data-craft-show="light"><label>${H("Sheds light")}</label><select name="craft.light">${opt("none", t("No"), v.light)}${opt("on", t("Yes"), v.light)}</select><span class="hint" style="flex:1">${H("SRD: the creator decides now; it can't be changed later.")}</span></div>
      <div class="form-group" data-craft-show="theme"><label>${H("Look")}</label><select name="craft.theme">${opt("", t("From its abilities (or neutral)"), v.theme)}${themes}</select></div>
      ${this.api.intelligence ? `<div class="form-group" data-craft-show="light"><label>${H("Intelligent")}</label><label class="acr-cb" style="flex:1"><input type="checkbox" name="craft.intel" ${v.intel ? "checked" : ""}> ${H("Make it intelligent (SRD: caster level 15; it takes your alignment; its other features are rolled when the GM approves, and their price is added)")}</label></div>` : ""}
      <div class="form-group" data-craft-show="ammo"><label>${H("Pieces")}</label><input type="number" name="craft.qty" value="${esc(v.qty ?? 50)}" min="1" max="50" step="1"><span class="hint" style="flex:1" data-qty-hint="free">${H("magic ammunition is made 50 at a time; fewer pieces cost proportionally less")}</span><span class="hint" style="flex:1" data-qty-hint="inv">${H("the pieces in the inventory (50 at most at a time)")}</span></div>`;
  }
  /** At approval the GM's client rolls an intelligent item's features (the SRD: "Determine other features randomly"). */
  async magicBeforeApprove({ actor, values }) {
    if (!values?.intel || values.intelData) return null;
    const p = await this.magicEvaluate({ actor, values: { ...values, intelRoll: true } });
    return p.intelData ? { ...values, intelData: p.intelData } : null;
  }
  magicWire(section, { actor }) {
    const inv = this.inventory(actor);
    // Ammunition from the inventory: the pieces are the stack's (up to 50), not a free choice (1.14.9.18)
    const pieces = () => {
      const q = section.querySelector('[name="craft.qty"]');
      if (!q) return;
      const fromInv = section.querySelector('[name="craft.source"]')?.value === "inventory";
      const it = fromInv ? inv.find((i) => i.id === section.querySelector('[name="craft.inv"]')?.value) : null;
      const stack = it?.kind === "ammo" ? Math.min(50, it.qty) : null;
      if (stack) { q.value = String(stack); q.max = String(stack); }
      else q.max = "50";
      q.readOnly = !!stack;
      section.querySelectorAll("[data-qty-hint]").forEach((h) => { h.style.display = (h.dataset.qtyHint === "inv") === !!stack ? "" : "none"; });
      // A magic item: no lower bonus than it has; light is already decided (SRD: at creation)
      const min = it?.magic ? Math.max(1, it.magic.bonus) : 0;
      const b = section.querySelector('[name="craft.bonus"]');
      b?.querySelectorAll("option").forEach((o) => { const low = Number(o.value) < min; o.disabled = low || (o.dataset.epic && o.hidden); if (low) o.hidden = true; else if (!o.dataset.epic) o.hidden = false; });
      if (b && Number(b.value) < min) b.value = String(min);
      section.querySelectorAll('[data-craft-show="upgrade"]').forEach((x) => { x.style.display = it?.magic ? "" : "none"; });
      section.querySelectorAll('[data-craft-show="light"]').forEach((x) => { if (it?.magic) x.style.display = "none"; });
    };
    this.wireFilter(section, () => {
      const src = section.querySelector('[name="craft.source"]')?.value;
      if (src === "inventory") return inv.find((i) => i.id === section.querySelector('[name="craft.inv"]')?.value)?.kind ?? null;
      return section.querySelector('[name="craft.base"]')?.selectedOptions?.[0]?.dataset?.kind ?? null;
    });
    section.addEventListener("change", pieces); // after the filter, which shows the light rows again
    // Ability rows: another appears whenever every row is filled; the other end only for double weapons
    const grow = () => {
      for (const box of section.querySelectorAll("[data-craft-slots]")) {
        const p = box.dataset.craftSlots, sels = [...box.querySelectorAll("select")];
        if (sels.length && sels.every((x) => x.value) && this.abRow) box.insertAdjacentHTML("beforeend", this.abRow(sels.length, p));
      }
      const src = section.querySelector('[name="craft.source"]')?.value;
      const dbl = src === "inventory" ? inv.find((i) => i.id === section.querySelector('[name="craft.inv"]')?.value)?.double : section.querySelector('[name="craft.base"]')?.selectedOptions?.[0]?.dataset?.double === "1";
      section.querySelectorAll('[data-craft-show="double"]').forEach((x) => { x.style.display = dbl ? "" : "none"; });
    };
    section.addEventListener("change", grow);
    pieces(); grow();
  }
  async magicEvaluate({ actor, values: v }) {
    await this.prepare();
    const src = v.source || "inventory";
    let base, baseKind, material = null, consume = [], spec0 = null, upgrade = null;
    if (src === "inventory") {
      const it = actor?.items?.get(v.inv);
      if (!it) throw new Error(t("Choose a masterwork item from the inventory, or buy or make one."));
      const spec = it.flags?.[MOD]?.spec;
      spec0 = spec;
      baseKind = D.armsKind(it);
      if (spec?.base && !spec.base.system) { base = spec.base; material = spec.material ?? null; } else base = D.cleanCopy(it);
      upgrade = this.inventory(actor).find((i) => i.id === it.id)?.magic ?? null;
      // Ammunition: the stack's pieces, 50 at most at a time; arms and armor: one item from its stack (1.14.9.18)
      const stack = Number(it.system?.quantity ?? 1) || 1;
      if (baseKind === "ammo") v = { ...v, qty: Math.min(50, stack) };
      consume = [{ id: it.id, qty: baseKind === "ammo" ? v.qty : 1 }];
    } else {
      if (!v.base) throw new Error(t("Choose a base item."));
      const [pack, id] = v.base.split("|");
      base = { pack, id };
      baseKind = this.catalogKind(v.base);
      material = v.material || null;
    }
    const abilities = slotValues(v, "ab");
    const sabilities = slotValues(v, "sb");
    const f = { kind: baseKind, sbonus: v.sbonus || "none", sabilities, base, baseKind, grade: "medium", bonus: String(Number(v.bonus) || 1), masterwork: true, material: material ?? "", epic: (!!v.epic || abilities.some((x) => /^srd:/.test(x) && (this.data.abilities.weapon[x.slice(4)]?.epic || this.data.abilities.armor[x.slice(4)]?.epic))) && !!globalThis.AxecleftTreasure?.rules?.()?.epic, // an epic ability makes it epic
      size: src === "inventory" ? (spec0?.size ?? "med") : v.size || "med",
      abilities, foe: v.foe || this.data.tables.baneFoes[0].foe, light: v.light === "on" ? "on" : "none", theme: v.theme ?? "", color: "", anim: "", speed: 3, intensity: 4,
      bright: "", dim: "", hint: "no", identified: true, qty: Math.max(1, Math.min(50, Number(v.qty) || 50)), count: 1 };
    const { spec } = await this.forge.resolve(f);
    // Upgrading a magic item (house rule): its bonus can only go up, its abilities stay, and its light and look were
    // decided when it was made; the new abilities are added to them
    let oldBuilt = null;
    if (upgrade) {
      const have = new Set(upgrade.abilities.map((a) => normName(a.name)));
      const twice = spec.abilities.filter((a) => have.has(normName(a.name)));
      if (twice.length) throw new Error(t("It already has {abilities}.", { abilities: twice.map((a) => a.name).join(", ") }));
      if (Number(spec.bonus) < upgrade.bonus) throw new Error(t("Its enhancement bonus can't go below +{n}.", { n: upgrade.bonus }));
      // A double weapon's other end: its bonus can only go up too, and its abilities stay
      const os = upgrade.second ?? null, ns = spec.second ?? null;
      const secondChanged = !!ns && ((Number(ns.bonus) || 0) > (Number(os?.bonus) || 0) || (ns.abilities ?? []).length > 0);
      if (os || ns) spec.second = { bonus: Math.max(Number(os?.bonus) || 0, Number(ns?.bonus) || 0), abilities: [...(os?.abilities ?? []), ...(ns?.abilities ?? []).filter((a) => !(os?.abilities ?? []).some((o) => normName(o.name) === normName(a.name)))] };
      if (Number(spec.bonus) === upgrade.bonus && !spec.abilities.length && !secondChanged) throw new Error(t("Raise its enhancement bonus or add an ability."));
      Object.assign(spec, { abilities: [...upgrade.abilities, ...spec.abilities], light: spec0.light ?? null, hint: spec0.hint ?? false, material: spec0.material ?? null,
        epic: spec.epic || spec0.epic || undefined, size: spec0.size });
      oldBuilt = await this.b.build({ ...spec0, identified: true, quantity: spec.quantity });
    }
    const built = await this.b.build(spec);
    const k = built.craft.facts.kind, ammo = k === "ammo";
    // Intelligent item: rolled by the GM at approval (kept in values.intelData), then priced like any other feature
    let intelData = null, intel = null;
    if (v.intel && !ammo && this.api.intelligence) {
      if (v.intelData) intel = JSON.parse(v.intelData);
      else if (v.intelRoll) {
        const al = globalThis.AxecleftCrafting?.actor?.alignment(actor) ?? { lc: "n", ge: "n" };
        intel = await this.api.intelligence.roll({ alignment: `${al.lc}${al.ge}`, abilities: built.craft.abilities.map((a) => ({ name: a.en ?? a.title })), bonus: Number(v.bonus) || 1, effective: built.effective });
        intelData = JSON.stringify(intel);
      }
      if (intel) this.api.intelligence.apply(built, intel);
    }
    const qty = ammo ? built.quantity : 1;
    // An upgrade costs the difference between the new magic and the magic it already has
    const basePrice = round2((built.craft.magicEach - (oldBuilt?.craft.magicEach ?? 0)) * qty);
    const mundane = round2(built.craft.mundaneEach * qty);
    const plan = {
      // Epic (enhancement above +5, total above +10, or an epic ability): the engine (1.6) adds Craft Epic Magic Arms and Armor and the epic XP
      magic: true, feat: "Craft Magic Arms and Armor", epic: built.data?.system?.epic === true,
      name: built.name, img: built.data.img, data: built.data, quantity: qty, market: round2(built.price * qty), base: basePrice,
      summary: built.summary, consume, notes: [], requirements: [], checks: [], spells: [],
    };
    plan.data.system.identified = true;
    if (src === "buy") { plan.itemCost = mundane; plan.itemCostLabel = t(material ? "Masterwork {item} ({material}), bought" : "Masterwork {item}, bought", { item: built.baseShown ?? built.craft.facts.name, material: material ? materialName(material) : "" }); }
    for (const w of built.warnings ?? []) plan.notes.push(w);
    if (src === "craft") { plan.checks = this.craftChecks(built, qty); plan.raw = round2(plan.checks.reduce((s, c) => s + c.raw, 0)); plan.notes.push(t("The masterwork item is made with Craft first (raw materials ⅓ of its price); the magic is added when the checks succeed.")); }
    if (upgrade) plan.notes.push(t(ammo ? "{item} becomes {new} ({n} pieces); the cost is the difference in price (DMG, Adding New Abilities)." : "{item} becomes {new}; the cost is the difference in price (DMG, Adding New Abilities).", { item: actor.items.get(v.inv)?.name, new: built.name, n: qty }));
    else if (src === "inventory") plan.notes.push(t(ammo ? "{item} becomes the magic item ({n} pieces used)." : "{item} becomes the magic item.", { item: actor.items.get(v.inv)?.name, n: qty }));
    // Caster level and prerequisites (SRD Magic Items)
    const bonus = Number(v.bonus) || 1;
    const why = [`3 × +${bonus} = ${3 * bonus}`];
    plan.casterLevel = Math.max(3 * bonus, 1);
    const b2 = built.craft.second?.bonus ?? 0;
    if (b2 > bonus) { why.push(t("other end {why}", { why: `3 × +${b2} = ${3 * b2}` })); plan.casterLevel = 3 * b2; }
    // An upgrade needs every prerequisite of the new item, old abilities included, as if it were made from scratch
    // (1.14.9.20: the crafter must work with the magic already in it without harming it)
    for (const a of built.craft.abilities) {
      if (!a.craft) {
        // A custom ability (Shared Data, the GM's own): read the SRD construction line from its description (Crafting engine 1.2)
        const C = globalThis.AxecleftCrafting;
        const curios = game.modules.get("axeclefts-curios")?.api?.spells;
        const pre = C?.parsePrereqs?.(a.html ?? "", { spell: (x) => curios?.resolveName?.(x) ?? (/^[a-z][a-z' ,]+$/i.test(x) && !/creator|caster|must|rank|level/i.test(x) ? x : null), isFeat: (x) => /^craft |^forge |^scribe |^brew |spell$/i.test(x), itemName: a.title });
        if (!pre) { plan.requirements.push({ key: `custom.${a.title}`, label: t("{ability}: prerequisites", { ability: a.title }), ok: "warn", detail: t("no construction line in its description; the GM decides (see How requirements are found)"), waivable: true }); continue; }
        if (pre.cl > plan.casterLevel) plan.casterLevel = pre.cl;
        if (pre.cl) why.push(`${a.title} CL ${pre.cl}`);
        for (const g of pre.spells) plan.spells.push({ any: g, for: a.title });
        if (pre.align.length) plan.align = [...new Set([...(plan.align ?? []), ...pre.align])];
        for (const o of pre.other) plan.requirements.push({ key: `custom.${a.title}.${o}`, label: `${a.title}: ${o}`, ok: "warn", detail: t("the GM checks this"), waivable: true });
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
        plan.requirements.push({ key: "feat.psionic", label: "Craft Psionic Arms and Armor", ok: has === undefined ? "warn" : has, detail: has === undefined ? t("the GM checks this") : t(has ? "has the feat (for {abilities})" : "doesn't have the feat (needed for {abilities})", { abilities: psi.map((a) => a.title).join(", ") }), waivable: false });
      }
      plan.notes.push(t("Psionic abilities: the powers listed stand in for spells, and manifester level for caster level (SRD Psionic Items)."));
    }
    if (v.intel && !ammo) {
      plan.casterLevel = Math.max(plan.casterLevel, 15);
      why.push(t("an intelligent item (caster level {n})", { n: 15 }));
      if (intel) plan.notes.push(t("Intelligent: {lines}; adds {gp} to the base price.", { lines: intel.lines.join(" · "), gp: gp(intel.price) }));
      else plan.notes.push(t("Intelligent: it takes the crafter's alignment; its mind, powers and any special purpose are rolled when the GM approves, and their price (from +1,000 gp) is added to the base price, so the gp, XP and time rise."));
    }
    if (intelData) plan.intelData = intelData;
    plan.casterNote = t("item needs {why}", { why: why.join("; ") });
    if (built.craft.second) plan.notes.push(t("Double weapon: the other end ({other}) is priced as a weapon of its own and included in the cost, XP and time.", { other: built.craft.second.text }));
    else if (built.craft.facts.double) plan.notes.push(t("SRD: a double weapon counts as two weapons for cost, time, XP and abilities; enchant each head separately."));
    if (v.light === "on" && !upgrade) plan.notes.push(t("Sheds light (decided at creation)."));
    return plan;
  }

  /* ---------- Mundane and masterwork arms (Craft) ---------- */
  mundaneContent({ values: v }) {
    return `<p class="hint">${H("Craft (SRD): raw materials cost ⅓ of the price; the DC comes from the Craft table. A masterwork item has a separate masterwork component (DC 20). Each check failed by 5 or more ruins half that part's raw materials.")}</p>
      <div class="form-group"><label>${H("Item")}</label>${this.baseSelect("base", v.base)}</div>
      <div class="form-group"><label>${H("Masterwork")}</label><label class="acr-cb" style="flex:1"><input type="checkbox" name="craft.masterwork" ${v.masterwork ? "checked" : ""}> ${H("Masterwork (adamantine, mithral, darkwood and dragonhide always are)")}</label></div>
      <div class="form-group"><label>${H("Material")}</label>${this.materialSelect(v.material)}</div>
      ${this.sizeSelect(v.size)}
      <div class="form-group" data-craft-show="ammo"><label>${H("Pieces")}</label><input type="number" name="craft.qty" value="${esc(v.qty ?? 20)}" min="1" step="1"></div>`;
  }
  mundaneWire(section) {
    this.wireFilter(section, () => section.querySelector('[name="craft.base"]')?.selectedOptions?.[0]?.dataset?.kind ?? null);
  }
  async mundaneEvaluate({ values: v }) {
    await this.prepare();
    if (!v.base) throw new Error(t("Choose an item to make."));
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

// [key, label, one item's label]
const SPEC_KINDS = [["weapon", /*t*/"Weapons", /*t*/"Weapon"], ["armor", /*t*/"Armor and shields", /*t*/"Armor or shield"], ["ammo", /*t*/"Ammunition", /*t*/"Ammunition"]];
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
      const magicPack = /magic|wondrous|enchant/i.test(pack.metadata?.originalLabel ?? pack.metadata?.label ?? "") || id === "D35E.magicitems";
      let index;
      try { index = await D.enIndex(pack, { fields: ["type", "system.subType", "system.equipmentType", "system.equipmentSubtype", "system.weaponSubtype", "system.masterwork", "system.enh", "system.armor.enh", "system.price", "system.epic", "system.tags"] }); } catch (e) { continue; }
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
        if (!out.has(k)) out.set(k, { name: e.display ?? e.name, en: e.name, kind, pack: id, id: e._id }); // shown as named in this world
      }
    }
    this.list = [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** D35E's English construction line for a specific item (data/prereqs.json), or null. */
  async englishLine(name) {
    this.lines ??= foundry.utils.fetchJsonWithTimeout(`modules/${MOD}/data/prereqs.json`).then((d) => {
      const m = new Map(); for (const [k, v] of Object.entries(d.lines ?? {})) m.set(normName(k), v); return m;
    }).catch(() => new Map());
    return (await this.lines).get(normName(name)) ?? null;
  }

  async featNames() {
    if (this.feats) return this.feats;
    const out = new Set();
    for (const pack of game.packs ?? []) {
      if (pack.documentName !== "Item" || !(pack.collection === "D35E.feats" || /\bfeats?\b/i.test(pack.metadata?.originalLabel ?? pack.metadata?.label ?? ""))) continue;
      try { for (const e of await D.enIndex(pack)) { out.add(normName(e.name)); if (e.display) out.add(normName(e.display)); } } catch (e) { /* unreadable */ }
    }
    return (this.feats = out);
  }

  content({ values: v }) {
    const k = v.skind ?? "weapon";
    return `<p class="hint">${H("Specific magic weapons, armor, shields and ammunition (Flame Tongue, Celestial Armor…) from your item compendiums, by the SRD statblock in each item's description: its caster level, spells and other prerequisites, and its cost (the masterwork item plus half the magic's price, and 1/25 of that in XP).")}</p>
      <div class="form-group"><label>${H("Kind")}</label><select name="craft.skind">${SPEC_KINDS.map(([x, l]) => opt(x, t(l), k)).join("")}</select></div>
      <div class="form-group"><label>${H("Item")}</label><input type="text" name="craft.sname" list="ac-specific" value="${esc(v.sname ?? "")}" placeholder="${H("Type to search")}"><datalist id="ac-specific"></datalist></div>
      <div class="form-group" data-spec-qty><label>${H("How many")}</label><input type="number" name="craft.sqty" value="${esc(v.sqty ?? 1)}" min="1" max="50" step="1"><span class="hint" style="flex:1">${H("pieces; the cost, XP and time are for all of them")}</span></div>
      ${globalThis.AxecleftCrafting?.prereqHelp?.("arms") ?? ""}`;
  }

  wire(section) {
    const fill = () => {
      const k = section.querySelector('[name="craft.skind"]')?.value ?? "weapon";
      const dl = section.querySelector("#ac-specific");
      if (dl) dl.innerHTML = (this.list ?? []).filter((x) => x.kind === k).map((x) => `<option value="${esc(x.name)}">`).join("");
    };
    const qty = () => { const k = section.querySelector('[name="craft.skind"]')?.value; section.querySelectorAll("[data-spec-qty]").forEach((x) => { x.style.display = k === "ammo" ? "" : "none"; }); };
    section.querySelector('[name="craft.skind"]')?.addEventListener("change", () => { const n = section.querySelector('[name="craft.sname"]'); if (n) n.value = ""; fill(); qty(); });
    fill(); qty();
  }

  async evaluate({ actor, values: v }) {
    if (!this.list) await this.prepare();
    const name = String(v.sname ?? "").trim();
    if (!name) throw new Error(t("Choose an item to make."));
    const hit = this.list.find((x) => normName(x.name) === normName(name) || normName(x.en) === normName(name));
    if (!hit) throw new Error(t("{name} is not a specific magic weapon or armor in your item compendiums.", { name }));
    const hub = globalThis.AxecleftTreasure, C = globalThis.AxecleftCrafting;
    const doc = await game.packs.get(hit.pack)?.getDocument(hit.id);
    if (!doc) throw new Error(t("Could not read {name}.", { name }));
    const data = doc.toObject();
    delete data._id; delete data.folder; delete data.sort;
    const fix = hub?.applyPriceCorrection?.(hit.pack, data);
    let html = data.system?.description?.value ?? "";
    const link = C?.linkedDescription?.(html);
    if (link) { try { html = (await fromUuid(link.startsWith("Compendium.") ? link : `Compendium.${link}`))?.system?.description?.value ?? html; } catch (e) { /* keep */ } }
    // A translated description (Babele) can't be read: D35E's English line for the item, by its English name (data/prereqs.json, 1.14.9)
    const enItem = D.enName(data, { pack: hit.pack });
    const english = await this.englishLine(enItem);
    if (english && (!/^en\b/i.test(game.i18n?.lang ?? "en") || !C?.parsePrereqs?.(html, { itemName: enItem }))) html = english;
    const curios = game.modules.get("axeclefts-curios")?.api?.spells;
    try { await curios?.index?.(); } catch (e) { /* Curios not loaded */ }
    const myFeats = C?.actor?.feats(actor) ?? new Set(), known = await this.featNames();
    const pre = C?.parsePrereqs?.(html, {
      spell: (x) => curios?.resolveName?.(x) ?? (/^[a-z][a-z' ,/-]+$/i.test(x) && !/creator|caster|must|rank|level|bonus/i.test(x) ? x : null),
      isFeat: (x) => myFeats.has(normName(x)) || known.has(normName(x)), itemName: enItem,
    });
    if (/minor artifact|major artifact|cannot be created/i.test(C?.plainText?.(html) ?? "")) throw new Error(t("{name} is an artifact; it can't be made.", { name: data.name }));
    // Price: a price correction first, then the statblock's own price when the compendium's is missing or different
    let price = Number(data.system?.price) || 0;
    const notes = [];
    if (fix) notes.push(t("Price corrected to {price} ({note}).", { price: gp(price), note: fix.note || t("price correction") }));
    else if (pre?.price && pre.price !== price) { notes.push(t("Price {price} from its statblock (the compendium says {old}).", { price: gp(pre.price), old: gp(price) })); price = pre.price; }
    if (!(price > 0)) throw new Error(t("{name} has no price; add one on the Price Corrections page of the Treasure Lists journal.", { name: data.name }));
    data.system.price = price;
    data.system.identified = true;
    const plan = { magic: true, name: data.name, img: data.img, data, quantity: 1, market: price, requirements: [], checks: [], notes, spells: [] };
    const enh = Math.max(Number(data.system?.enh) || 0, Number(data.system?.armor?.enh) || 0);
    if (!pre) {
      plan.feat = "Craft Magic Arms and Armor";
      plan.base = price;
      plan.casterLevel = Math.max(5, 3 * enh);
      plan.casterNote = `Craft Magic Arms and Armor 5${enh ? `; 3 × +${enh}` : ""}`;
      plan.requirements.push({ key: "line", label: t("Prerequisites"), ok: "warn", detail: t("no construction line in its description; the GM decides (see How requirements are found)"), waivable: true });
      return this.forQuantity(plan, hit.kind, v);
    }
    const creation = pre.feats.filter((f) => CRAFT_MIN[normName(f)] !== undefined || /^(craft|forge|scribe|brew)\b/i.test(f));
    plan.feat = creation.find((f) => !/epic/i.test(f)) ?? "Craft Magic Arms and Armor";
    const why = [];
    let cl = 5;
    for (const f of creation) { const m = CRAFT_MIN[normName(f)] ?? 0; if (m > cl) { cl = m; why.push(`${f} ${m}`); } }
    if (enh && 3 * enh > cl) { cl = 3 * enh; why.push(`3 × +${enh}`); }
    if (pre.minCl && pre.minCl > cl) { cl = pre.minCl; why.push(t("the item needs {n}", { n: pre.minCl })); }
    // SRD: never lower than the minimum caster level that can cast the required spells (needs Curios' spell data)
    const sp = await curios?.minClOfGroups?.(pre.spells)?.catch?.(() => null);
    if (sp && sp.cl > cl) { cl = sp.cl; why.push(t("{spell} needs caster level {n}", { spell: curios?.shownName?.(sp.spell) ?? sp.spell, n: sp.cl })); }
    plan.casterLevel = cl;
    plan.casterNote = `${why.join("; ") || `${plan.feat} 5`}${pre.cl ? t("; the item works at caster level {n}", { n: pre.cl }) : ""}`;
    for (const f of pre.feats) if (normName(f) !== normName(plan.feat)) {
      const has = myFeats.has(normName(f));
      plan.requirements.push({ key: `feat.${f}`, label: f, ok: has, detail: has ? t("has the feat") : t("doesn't have the feat"), waivable: !/^(craft|forge|scribe|brew)\b/i.test(f) });
    }
    plan.spells = pre.spells.map((g) => ({ any: g, for: data.name }));
    if (pre.align.length) plan.align = [...new Set(pre.align)];
    if (pre.minLevel) plan.minLevel = pre.minLevel;
    for (const sk of pre.skills) plan.requirements.push({ key: `skill.${sk.skill}`, label: t("{n} ranks in {skill}", { n: sk.ranks, skill: sk.skill }), ok: "warn", detail: t("the GM checks"), waivable: true });
    for (const o of pre.other) plan.requirements.push({ key: `other.${o}`, label: o[0].toUpperCase() + o.slice(1), ok: "warn", detail: t("the GM checks this"), waivable: true });
    // SRD cost: the XP gives the magic's base price (XP × 25); the rest of the gp is the masterwork item and material
    if (pre.cost) {
      const base = pre.cost.xp * 25, item = Math.round((pre.cost.gp - base / 2) * 100) / 100;
      if (item >= 0) { plan.base = base; plan.itemCost = item; plan.itemCostLabel = t("Masterwork item and materials (from the SRD cost)"); }
      else { plan.base = pre.cost.gp * 2; plan.xpExtra = Math.max(0, pre.cost.xp - plan.base / 25); }
      notes.push(t("SRD cost: {gp} and {xp} XP.", { gp: gp(pre.cost.gp), xp: num(pre.cost.xp) }));
    } else {
      plan.base = price;
      notes.push(t("Its statblock gives no Cost, so the whole price counts as magic (the SRD would charge the masterwork item at full price and only the rest at half)."));
    }
    plan.summary = `${t(SPEC_KINDS.find(([x]) => x === hit.kind)?.[2] ?? "Item")}${pre.cl ? t("; caster level {n}", { n: pre.cl }) : ""}${pre.text ? t("; prerequisites: {text}", { text: pre.text }) : ""}`;
    return this.forQuantity(plan, hit.kind, v);
  }

  /** Specific magic ammunition (screaming bolts, slaying arrows) is priced per piece: several at once multiply the cost, XP and time. */
  forQuantity(plan, kind, v) {
    const n = kind === "ammo" ? Math.max(1, Math.min(50, Math.round(Number(v.sqty) || 1))) : 1;
    if (n === 1) return plan;
    const x = (k) => { if (Number(plan[k]) > 0) plan[k] = round2(plan[k] * n); };
    ["market", "base", "itemCost", "xpExtra", "raw"].forEach(x);
    plan.quantity = n;
    if (plan.data?.system) plan.data.system.quantity = n;
    plan.notes.push(t("{n} pieces: the price, cost, XP and time are for all of them.", { n }));
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
    module: MOD, key: "magic-arms", label: /*t*/"Magic arms and armor", icon: "fas fa-wand-sparkles", order: 20, magic: true, feat: "Craft Magic Arms and Armor",
    prepare: () => craft.prepare(), content: (ctx) => craft.magicContent(ctx), wire: (s, ctx) => craft.magicWire(s, ctx), evaluate: (ctx) => craft.magicEvaluate(ctx),
    beforeApprove: (ctx) => craft.magicBeforeApprove(ctx),
  });
  const specific = new ArmorySpecificCraft(api);
  api.specificCraft = specific;
  C.registerKind({
    module: MOD, key: "specific-arms", label: /*t*/"Specific magic arms", icon: "fas fa-khanda", order: 20.5, magic: true,
    prepare: () => specific.prepare(), content: (ctx) => specific.content(ctx), wire: (s) => specific.wire(s), evaluate: (ctx) => specific.evaluate(ctx),
  });
  C.registerKind({
    module: MOD, key: "arms", label: /*t*/"Arms and armor (Craft)", icon: "fas fa-hammer", order: 21, magic: false,
    prepare: () => craft.prepare(), content: (ctx) => craft.mundaneContent(ctx), wire: (s) => craft.mundaneWire(s), evaluate: (ctx) => craft.mundaneEvaluate(ctx),
  });
  return craft;
}
