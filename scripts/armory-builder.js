/**
 * Axecleft's Armory — the builder.
 *
 * Turns a spec (base item + masterwork + special material + enhancement bonus + special abilities)
 * into finished D35E item data, priced and named by the SRD:
 *   const data = await builder.build({ base: { pack, id }, bonus: 2, abilities: [{ name: "Flaming" }], material: "Cold iron" });
 * The item starts unidentified: players see the mundane item (name and price) until it is identified.
 */
import * as D from "./armory-d35e.js";

const T = () => globalThis.AxecleftTreasure;
const MOD = "axeclefts-armory";
/** Abilities whose extra damage only applies against some foes (SRD). */
const AGAINST = { holy: /*t*/"evil creatures", unholy: /*t*/"good creatures", anarchic: /*t*/"lawful creatures", axiomatic: /*t*/"chaotic creatures" };
/** SRD Armor for Unusual Creatures (humanoid) and weapon size: cost and weight multipliers. D35E size keys. */
export const SIZES = { sm: { cost: 1, weight: 0.5, label: /*t*/"Small" }, med: { cost: 1, weight: 1, label: /*t*/"Medium" }, lg: { cost: 2, weight: 2, label: /*t*/"Large" } };
/** Names of built arms (patterns translated in lang/<code>.json; Axecleft's Tools 8.3 grammar): "+1 Flaming Longsword of Speed (Small)". */
export const ARMS_NAME = /*t*/"{bonus} {adj} {masterwork} {material} {base}[ of {of:and}][ ({size})]";
export const PLAIN_ARMS_NAME = /*t*/"{masterwork} {material} {base}[ ({size})]";
const MW_WORD = /*t*/"Masterwork";
const normName = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const { gp, t } = D;
const KIND_WORD = { weapon: /*t*/"weapon", armor: /*t*/"armor", shield: /*t*/"shield", ammo: /*t*/"ammunition" };
const title = (s) => String(s).replace(/(^|[\s(-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

/** "Slick, improved" -> "Improved Slick"; "Spell resistance (13)" -> "Spell Resistance 13"; "Fortification, light" -> "Light Fortification". */
export function abilityTitle(name) {
  const m = String(name).match(/^(.*?),\s*(improved|greater|light|moderate|heavy)$/i);
  const base = m ? `${m[2]} ${m[1]}` : String(name);
  return title(base.replace(/\((\d+)\)/, "$1").replace(/\s+/g, " ").trim()).replace(/(?<=\S) (De|Of|The) /g, (m, w) => ` ${w.toLowerCase()} `); // "Coup de Grace"
}
/** "Humanoids (orc)" -> "Orc"; "Undead" -> "Undead"; "Outsiders (evil)" -> "Evil Outsider". */
export function foeTitle(foe) {
  const m = String(foe).match(/^(\w[\w ]*?)s?\s*\((\w+)\)$/i);
  if (m) return /humanoid/i.test(m[1]) ? title(m[2]) : `${title(m[2])} ${title(m[1].replace(/s$/, ""))}`;
  return title(String(foe).replace(/s$/i, (x) => (/(undead|fey|vermin)$/i.test(foe) ? x : "")));
}

export class ArmoryBuilder {
  constructor(data) {
    this.data = data;
    this.materials = new Map(data.materials.map((m) => [normName(m.name), m]));
    this.docCache = new Map();
  }

  /* ---------- finding things in compendiums ---------- */

  async doc(pack, id) {
    const key = `${pack}.${id}`;
    if (!this.docCache.has(key)) this.docCache.set(key, game.packs.get(pack)?.getDocument(id) ?? Promise.resolve(null));
    return this.docCache.get(key);
  }
  /** A source-kind item by name (D35E's compendium first, then the GM's other sources). */
  async kindDoc(kind, name) {
    const items = await (T()?.kindItems?.(`${MOD}.${kind}`) ?? []);
    const n = normName(name);
    const hits = items.filter((x) => normName(x.name) === n);
    const hit = hits.find((x) => x.pack.startsWith("D35E.")) ?? hits[0];
    return hit ? this.doc(hit.pack, hit.id) : null;
  }
  enhancementDoc(name) { return this.kindDoc("enhancements", name); }
  async materialDoc(m) {
    const items = await (T()?.kindItems?.(`${MOD}.materials`) ?? []);
    const hit = items.find((x) => x.entry?.system?.uniqueId === m.uniqueId) ?? items.find((x) => normName(x.name) === normName(m.d35e));
    return hit ? this.doc(hit.pack, hit.id) : null;
  }
  /** A base item: { pack, id } | { name } (D35E name, searched in the item sources, D35E first) | item data. */
  async baseDoc(ref) {
    if (!ref) throw new Error(t("No base item."));
    if (ref.system) return ref;
    if (ref.pack && ref.id) return this.doc(ref.pack, ref.id);
    const n = normName(ref.name);
    const packs = [...new Set(["D35E.weapons-and-ammo", "D35E.armors-and-shields", ...(T()?.itemSources?.().packs ?? [])])];
    for (const id of packs) {
      const pack = game.packs.get(id);
      if (!pack) continue;
      const index = await D.enIndex(pack, { fields: ["type", "system.equipmentType", "system.subType", "system.enh", "system.armor.enh"] });
      const e = index.find((x) => (normName(x.name) === n || normName(x.display) === n) && D.armsKind(x) && !(Number(x.system?.enh) > 0) && !(Number(x.system?.armor?.enh) > 0));
      if (e) return this.doc(id, e._id);
    }
    throw new Error(t("Base item \"{name}\" not found in your item sources.", { name: ref.name }));
  }

  /** The SRD rule entry for an ability (weapon or armor table), or null for a non-SRD enhancement. */
  abilityRule(kind, name) {
    const ov = this.data.abilities[kind === "weapon" || kind === "ammo" ? "weapon" : "armor"];
    const key = Object.keys(ov).find((k) => normName(k) === normName(name));
    return key ? { key, ...ov[key] } : null;
  }

  /* ---------- rules ---------- */

  /** Why an ability can't go on this base (or null). */
  abilityProblem(facts, ab) {
    const rule = this.abilityRule(facts.kind, ab.name);
    if (!rule) return null; // a GM's own enhancement: no SRD restrictions known
    if (rule.epic && T()?.rules?.()?.epic !== true) return t("{ability} is an epic ability, and Epic items is off (Treasure Generator → Generation settings)", { ability: ab.name });
    if (rule.psionic && T()?.rules?.()?.psionics === false) return t("{ability} is a psionic ability, and Psionics is off (Treasure Generator → Generation settings)", { ability: ab.name });
    const ap = rule.applies ?? [];
    const k = facts.kind;
    if (k === "armor" || k === "shield") return ap.includes(k) ? null : t(k === "armor" ? "{ability} can't go on armor" : "{ability} can't go on a shield", { ability: ab.name });
    if (k === "ammo") { if (!ap.includes("ammo")) return t("{ability} can't go on ammunition", { ability: ab.name }); }
    else if (facts.ranged) { if (!ap.includes("ranged") && !(ap.includes("thrown") && facts.thrown)) return t("{ability} can't go on a ranged weapon", { ability: ab.name }); }
    else if (!ap.includes("melee") && !(ap.includes("thrown") && facts.thrown)) return t("{ability} can't go on a melee weapon", { ability: ab.name });
    if (rule.damageTypes?.length && !facts.damageTypes.some((x) => rule.damageTypes.includes(x))) return t("{ability} needs a {types} weapon", { ability: ab.name, types: rule.damageTypes.map((x) => t({ B: /*t*/"bludgeoning", P: /*t*/"piercing", S: /*t*/"slashing" }[x])).join(t(" or ")) });
    return null;
  }
  materialProblem(facts, m) {
    if (!m) return null;
    const k = facts.kind;
    if (!m.applies.includes(k)) return t(k === "ammo" ? "{material} can't be used for ammunition" : k === "armor" ? "{material} can't be used for armor" : k === "shield" ? "{material} can't be used for shields" : "{material} can't be used for weapons", { material: m.name });
    if (m.metalOnly && !facts.metal) return t("{item} has no metal parts to make of {material}", { item: facts.name, material: m.name.toLowerCase() });
    if (m.woodOnly && !facts.wooden) return t("{item} isn't made of wood", { item: facts.name });
    return null;
  }

  /* ---------- price ---------- */

  /**
   * SRD price. Returns { each, mundaneEach, parts: [[label, gp]] } — per piece for ammunition (a magic batch is 50).
   */
  price(facts, { masterwork, material, bonus = 0, abilityCosts = [], quantity = 1 }) {
    const k = facts.kind, ammo = k === "ammo", weaponish = k === "weapon" || ammo;
    const base = facts.price, parts = [["base", base]];
    const m = material ? this.materials.get(normName(material)) : null;
    const mp = m?.price ?? {};
    let matCost = 0;
    if (m) {
      if (ammo) matCost += (mp.ammo ?? 0) + (mp.baseMultiplier ? (mp.baseMultiplier - 1) * base : 0) + (mp.perLb ? mp.perLb * facts.weight : 0);
      else if (k === "weapon") {
        matCost += (mp.weapon ?? 0) + (mp.weaponPerLb ? mp.weaponPerLb * facts.weight : 0) + (mp.perLb ? mp.perLb * facts.weight : 0)
          + (mp.baseMultiplier ? (mp.baseMultiplier - 1) * base : 0)
          + (facts.subtype === "light" ? mp.light ?? 0 : facts.subtype === "2h" ? mp["2h"] ?? 0 : facts.subtype ? mp["1h"] ?? 0 : 0);
      } else {
        matCost += (k === "armor" ? mp[facts.armorClass] ?? 0 : mp.shield ?? 0) + (mp.perLb ? mp.perLb * facts.weight : 0)
          + (mp.masterworkMultiplier ? mp.masterworkMultiplier * (base + 150) - base : 0); // dragonhide: twice the masterwork price, masterwork included
      }
      parts.push([m.name.toLowerCase(), matCost]);
    }
    const mwCost = masterwork && !m?.includesMasterwork ? (ammo ? 6 : k === "weapon" ? (facts.double ? 600 : 300) : 150) : 0;
    if (mwCost) parts.push(["masterwork", mwCost]);
    const mundaneEach = base + matCost + mwCost;
    const eff = bonus + abilityCosts.reduce((a, c) => a + c.bonus, 0);
    const flat = abilityCosts.reduce((a, c) => a + c.gp, 0);
    // SRD epic magic items (enhancement above +5 or total above +10): the square of the total × 20,000 gp (weapons) or × 10,000 gp (armor)
    const epic = bonus > 5 || eff > 10 || abilityCosts.some((c) => c.epic);
    let magic = (eff > 0 ? eff * eff * (weaponish ? 2000 : 1000) * (epic ? 10 : 1) : 0) + flat;
    if (m && mp.magic && eff > 0) magic += mp.magic; // cold iron: enhancing costs 2,000 gp more
    if (magic) parts.push([t("magic ({what})", { what: `+${eff}${epic ? t(", epic") : ""}${flat ? t(" and {gp}", { gp: gp(flat) }) : ""}` }), magic]);
    const each = ammo ? mundaneEach + magic / 50 : mundaneEach + magic; // magic ammunition is priced per 50
    return { each: Math.round(each * 100) / 100, mundaneEach: Math.round(mundaneEach * 100) / 100, parts, effective: eff };
  }

  /* ---------- the build ---------- */

  /**
   * spec: { base, masterwork?, material?, bonus?, abilities?: [{ name, foe?, level?, d35e? }], quantity?, size? ("sm" | "med" | "lg"), light?, hint?, identified?, note? }
   * Returns { data, name, price, summary }. Throws an Error explaining any rule it breaks.
   */
  async build(spec) {
    const baseDoc = await this.baseDoc(spec.base);
    if (!baseDoc) throw new Error(t("Base item not found."));
    const data = D.cleanCopy(baseDoc);
    const facts = D.baseFacts(data);
    if (!facts.kind) throw new Error(t("{item} is not a weapon, armor, shield or ammunition.", { item: data.name }));
    if (facts.enh > 0) throw new Error(t("{item} is already magic; choose a mundane base item.", { item: data.name }));
    const k = facts.kind;
    // Size (SRD): Small arms cost the same and weigh half; Large cost twice and weigh twice. Masterwork and magic cost the same.
    const size = k === "ammo" ? null : SIZES[spec.size] && spec.size !== "med" ? spec.size : null;
    if (size) {
      facts.price = Math.round(facts.price * SIZES[size].cost * 100) / 100;
      facts.weight = Math.round(facts.weight * SIZES[size].weight * 100) / 100;
      D.setWeight(data, facts.weight);
      if (k === "weapon") foundry.utils.setProperty(data, "system.weaponData.size", size); // D35E scales the damage dice
    }
    const bonus = Math.max(0, Math.round(Number(spec.bonus) || 0));
    const abilities = (spec.abilities ?? []).filter((a) => a?.name || a?.d35e);
    const m = spec.material ? this.materials.get(normName(spec.material)) : null;
    if (spec.material && !m) throw new Error(t("Unknown material \"{material}\".", { material: spec.material }));
    const mProblem = this.materialProblem(facts, m);
    if (mProblem) throw new Error(mProblem);
    if (abilities.length && bonus < 1) throw new Error(t("A special ability needs at least a +1 enhancement bonus."));
    const epicOK = !!spec.epic; // the GM allows epic items (past +5 bonus or +10 total)
    if (bonus > 5 && !epicOK) throw new Error(t("Enhancement bonuses go up to +5 (allow epic items to go higher)."));
    const masterwork = !!(spec.masterwork || bonus > 0 || abilities.length || m?.masterwork);

    // Special abilities: D35E enhancement copies at the right level
    const enhancements = [], costs = [], words = { prefix: [], suffix: [] }, shown = { prefix: [], suffix: [] }, abilityNotes = [];
    const seen = new Set();
    for (const ab of abilities) {
      const label = ab.name ?? ab.d35e;
      if (seen.has(normName(label))) throw new Error(t("{ability} is listed twice.", { ability: label }));
      seen.add(normName(label));
      const problem = this.abilityProblem(facts, ab);
      if (problem) throw new Error(problem);
      const rule = this.abilityRule(k, label);
      let d35eName = ab.d35e ?? rule?.d35e ?? null, foe = null;
      if (rule?.key === "Bane") {
        foe = ab.foe ? this.data.tables.baneFoes.find((f) => normName(f.foe) === normName(ab.foe)) : null;
        if (!foe) foe = this.data.tables.baneFoes[0];
        d35eName = foe.d35e;
      }
      let enhDoc = d35eName ? await this.enhancementDoc(d35eName) : null;
      let enh;
      if (enhDoc) enh = D.enhancementCopy(enhDoc, ab.level ?? rule?.level ?? 1);
      else if (rule?.build) {
        // No D35E enhancement (armor Ghost Touch, the SRD psionic abilities): copy a plain D35E ability of the same type and make it this one
        const b = rule.build, weaponish = b.enhancementType === "weapon";
        const like = await this.enhancementDoc(weaponish ? "Defending" : "Invulnerability");
        if (!like) throw new Error(t("No enhancement to build {ability} from (D35E's {from} is missing from your enhancement sources).", { ability: label, from: weaponish ? "Defending" : "Invulnerability" }));
        enh = D.enhancementCopy(like, 0);
        enh.name = b.name;
        const blankWeapon = { alignment: { chaotic: false, evil: false, good: false, lawful: false }, attackRoll: "", damageRoll: "", damageType: "", damageTypeId: "", optionalDamage: false };
        Object.assign(enh.system, { enh: 1, enhIncrease: Number(b.enhIncrease) || 0, enhIncreaseFormula: String(Number(b.enhIncrease) || 0), price: Number(b.price) || 0, priceFormula: "",
          nameExtension: { prefix: b.prefix ?? "", suffix: b.suffix ?? "" }, changes: [], contextNotes: [], damageReduction: [], resistances: [], combatChanges: [],
          weaponData: blankWeapon, allowedTypes: weaponish ? [["weapon"]] : [], enhancementRequirements: rule.craft?.text ?? "", psionic: !!rule.psionic,
          description: { value: b.description ?? "", chat: "", unidentified: "" } });
      } else if (rule) throw new Error(t("The D35E enhancement \"{enhancement}\" for {ability} isn't in your enhancement sources.", { enhancement: d35eName, ability: label }));
      else throw new Error(t("Enhancement \"{ability}\" not found.", { ability: label }));
      const c = D.enhancementCost(enh);
      if (rule && !rule.build) {
        // SRD price from the table wins if D35E's item disagrees (D35E data can be wrong; the SRD can't)
        const row = this.tableRow(k, rule.key === "Bane" ? "Bane" : rule.key);
        if (row?.bonus !== undefined && row.bonus !== c.bonus) { c.bonus = row.bonus; enh.system.enhIncrease = row.bonus; }
        if (row?.gp !== undefined && row.gp !== c.gp) { c.gp = row.gp; enh.system.price = row.gp; }
      }
      c.epic = !!rule?.epic; // SRD epic special ability (price modifier above +5): the whole magic price ×10
      costs.push(c);
      enhancements.push(enh);
      const word = foe ? `${foeTitle(foe.foe)} Bane` : rule ? abilityTitle(rule.key) : title(label); // the item name's word (names stay English until the grammar files)
      const ne = enh.system?.nameExtension ?? {};
      // Heading in the world's language when Babele translated D35E's enhancement ("Feu"; "Défense (Light Fortification)" when one item covers several grades)
      const enhEn = enh.flags?.babele?.originalName ?? enh.originalName ?? null;
      // The name's word: the language file's ("Flaming": "de feu"), else Babele's name for the enhancement, else the English
      const wordShown = D.hasT(word) ? D.t(word) : enhEn && enh.name !== enhEn ? enh.name : word;
      // English word order: "Flaming Longsword", "Longsword of Speed" (armory.json marks the "of" abilities, as D35E's English items have them:
      // a translated enhancement's own name extension can't be used). A GM's own enhancement: by its name extension.
      const where = foe ? "prefix" : rule ? (rule.of ? "suffix" : "prefix") : String(ne.suffix ?? "").trim() && !String(ne.prefix ?? "").trim() ? "suffix" : "prefix";
      words[where].push(word); shown[where].push(D.W(word, wordShown));
      const enTitle = foe ? `Bane (${foe.foe})` : rule ? abilityTitle(rule.key) : label;
      const shownTitle = enhEn && enh.name !== enhEn ? (foe || normName(enhEn) === normName(rule?.key ?? label) ? enh.name : `${enh.name} (${enTitle})`) : enTitle;
      abilityNotes.push({ title: shownTitle, en: enTitle, html: D.descriptionOf(enh), cost: c, craft: rule?.craft ?? null, enh, psionic: !!rule?.psionic,
        against: foe ? foe.foe.toLowerCase() : AGAINST[normName(rule?.key ?? label)] ?? null });
    }
    const eff = bonus + costs.reduce((a, c) => a + c.bonus, 0);
    if (costs.some((c) => c.epic) && !epicOK) throw new Error(t("Epic special abilities make an epic item (allow epic items)."));
    if (eff > 10 && !epicOK) throw new Error(t("Enhancement bonus and abilities total +{n}; the most is +10 (allow epic items to go higher).", { n: eff }));

    // Base enhancement bonus: D35E's "+1 Weapon/Armor Enhancement" item at the bonus, plus the item's own field
    if (bonus > 0 && k !== "ammo") {
      const baseEnh = await this.enhancementDoc(k === "weapon" ? "+1 Weapon Enhancement" : "+1 Armor Enhancement");
      if (baseEnh) enhancements.unshift(D.enhancementCopy(baseEnh, bonus));
    }
    if (bonus > 0) D.setEnhancementBonus(data, k, bonus);
    if (masterwork && k !== "ammo") D.setMasterwork(data);
    if (k !== "ammo" && enhancements.length) D.setEnhancements(data, enhancements);
    if (k === "ammo" && abilityNotes.length) D.setAmmoAbilities(data, abilityNotes);

    // Special material: D35E's material item (hardness, DR) plus SRD effects
    let matDoc = null;
    if (m) {
      matDoc = await this.materialDoc(m);
      if (matDoc) D.setMaterial(data, matDoc);
      const fx = m.effect ?? {};
      if (fx.weight) D.setWeight(data, facts.weight * fx.weight);
      if (k === "armor" || k === "shield") D.adjustArmor(data, { acp: (fx.acp ?? 0) + (k === "shield" ? fx.shieldAcp ?? 0 : 0), maxDex: fx.maxDex ?? 0, asf: fx.asf ?? 0, category: fx.category ?? 0 });
    }

    // Price
    const quantity = Math.max(1, Math.round(Number(spec.quantity) || (k === "ammo" && eff > 0 ? 50 : facts.quantity)));
    const pr = this.price(facts, { masterwork, material: m?.name, bonus, abilityCosts: costs, quantity });
    D.setPrice(data, pr.each);
    D.setQuantity(data, quantity);

    // Names: the full one, and what players see before it is identified
    const matWord = m ? title(m.name) : "";
    const mwWord = masterwork && !m?.masterwork && !eff ? MW_WORD : ""; // adamantine, mithral, darkwood, dragonhide are masterwork by nature
    const baseName = String(facts.name ?? "").replace(/^masterwork\s+/i, ""); // "Masterwork Longsword" from an inventory is a Longsword
    const baseEn = String(D.enName(baseDoc) || facts.name || "").replace(/^masterwork\s+/i, "");
    const sizeWord = size ? SIZES[size].label : "";
    // The name in this world's language (word order and agreement from its grammar file), and the English one for matching
    const parts = (lang) => (lang === "en"
      ? { bonus: bonus ? `+${bonus}` : "", adj: words.prefix, masterwork: mwWord, material: matWord, base: baseEn, of: words.suffix, size: sizeWord }
      : { bonus: bonus ? `+${bonus}` : "", adj: shown.prefix, masterwork: mwWord ? D.W(mwWord, D.t(mwWord)) : "", material: matWord ? D.W(matWord, D.t(matWord)) : "", base: D.W(baseEn, baseName), of: shown.suffix, size: sizeWord ? D.W(sizeWord, D.t(sizeWord)) : "" });
    const name = D.N(ARMS_NAME, parts());
    const nameEn = D.N(ARMS_NAME, parts("en"), { lang: "en" });
    const plain = (lang) => ({ ...parts(lang), masterwork: masterwork && !m?.masterwork ? (lang === "en" ? MW_WORD : D.W(MW_WORD, D.t(MW_WORD))) : "" });
    const plainName = D.N(PLAIN_ARMS_NAME, plain());
    const magic = eff > 0;
    D.setIdentity(data, { name, unidentifiedName: magic ? plainName : name, unidentifiedPrice: magic ? pr.mundaneEach : pr.each, identified: spec.identified ?? !magic });

    // Description
    const baseDesc = D.descriptionOf(baseDoc);
    const lines = [];
    if (magic || m || masterwork) lines.push(`<p><strong>${esc(name)}</strong>${quantity > 1 ? ` (${quantity})` : ""}: ${esc(this.summary(facts, { bonus, m, masterwork, abilityNotes }))}. ${esc(t(k === "ammo" ? "Price {price} each." : "Price {price}.", { price: gp(pr.each) }))}</p>`);
    if (spec.hint) lines.push(`<p><em>${esc(abilityNotes.length ? t("A design or inscription on it hints at its power: {abilities}.", { abilities: abilityNotes.map((a) => a.title).join(", ").toLowerCase() }) : t("A design or inscription on it hints at its power."))}</em></p>`);
    if (spec.light) lines.push(`<p><em>${esc(t("It sheds light ({bright} ft. bright, {dim} ft. dim).", { bright: spec.light.bright, dim: spec.light.dim }))}</em></p>`);
    if (k === "ammo" && abilityNotes.length) lines.push(`<p><em>${esc(t("The abilities' extra damage is rolled with the ammunition; damage that only applies against some foes is in its attack note."))}</em></p>`);
    for (const a of abilityNotes) lines.push(`<h3>${esc(a.title)}</h3>${a.html || ""}`);
    if (m) lines.push(`<h3>${esc(title(m.name))}</h3><p>${esc(m.effects)}.</p>`);
    if (spec.note) lines.push(`<p>${esc(spec.note)}</p>`);
    if (baseDesc) lines.push(`<hr>${baseDesc}`);
    const unidLines = [m ? `<p>${esc(t("Made of {material}: {effects}.", { material: m.name.toLowerCase(), effects: m.effects }))}</p>` : "", spec.light ? `<p><em>${esc(t("It sheds light."))}</em></p>` : "", spec.hint ? `<p><em>${esc(t("A design or inscription on it hints at some power."))}</em></p>` : "", baseDesc].filter(Boolean).join("");
    D.setDescription(data, lines.join(""), magic ? unidLines : null);
    if (spec.light) D.setLight(data, spec.light);

    data.flags ??= {};
    foundry.utils.setProperty(data, "flags.world.axecleftEn", nameEn); // its English identity (Axecleft's Tools 8)
    data.flags[MOD] = { spec: { ...spec, base: spec.base?.system ? { name: baseName } : spec.base }, price: pr.parts };
    // SRD psionic abilities make it a psionic item (the shared Psionics switch hides it while off)
    const psionic = abilityNotes.some((a) => a.psionic);
    if (psionic) { data.system.psionic = true; data.flags[MOD].psionic = true; }
    // SRD epic magic items (enhancement above +5, total above +10, or an epic special ability): marked epic (the shared Epic items switch)
    if (bonus > 5 || eff > 10 || costs.some((c) => c.epic)) { data.system.epic = true; data.flags[MOD].epic = true; }
    // For crafting: the SRD splits the price into the base price (the magic) and the item cost (masterwork item and material)
    const magicEach = Math.round((pr.each - pr.mundaneEach) * 100) / 100;
    const craft = { facts, mundaneEach: pr.mundaneEach, magicEach, parts: pr.parts, casterLevel: Math.max(3 * bonus, ...abilityNotes.map((a) => a.craft?.cl ?? 0), 0),
      abilities: abilityNotes.map((a) => ({ title: a.title, en: a.en ?? a.title, craft: a.craft ?? null, html: a.html ?? "" })), material: m?.name ?? null, masterwork, bonus };
    return { data, name, nameEn, baseEn, price: pr.each, quantity, effective: eff, craft, psionic, summary: this.summary(facts, { bonus, m, masterwork, abilityNotes }) };
  }

  /** The SRD ability table row for a name (bonus or gp), any grade. */
  tableRow(kind, name) {
    const tb = this.data.tables;
    const tables = kind === "weapon" || kind === "ammo" ? [tb.meleeAbilities, tb.rangedAbilities, tb.psionicMeleeAbilities, tb.psionicRangedAbilities, tb.epicMeleeAbilities, tb.epicRangedAbilities] : [tb.armorAbilities, tb.shieldAbilities, tb.psionicArmorAbilities, tb.psionicShieldAbilities, tb.epicArmorAbilities, tb.epicShieldAbilities];
    for (const rows of tables) { if (!rows) continue; const r = rows.find((x) => normName(x.name) === normName(name)); if (r) return r; }
    return null;
  }

  summary(facts, { bonus, m, masterwork, abilityNotes }) {
    const kind = t(KIND_WORD[facts.kind] ?? facts.kind);
    const bits = [];
    if (bonus) bits.push(t(bonus > 5 || bonus + abilityNotes.reduce((a, n) => a + (n.cost.bonus ?? 0), 0) > 10 || abilityNotes.some((n) => n.cost?.epic) ? "+{n} epic {kind}" : "+{n} {kind}", { n: bonus, kind }));
    else bits.push(masterwork ? t("masterwork {kind}", { kind }) : kind);
    if (abilityNotes.length) bits.push(abilityNotes.map((a) => `${a.title.toLowerCase()} (${a.cost.bonus ? `+${a.cost.bonus}` : gp(a.cost.gp)})`).join(", "));
    if (m) bits.push(m.name.toLowerCase());
    return bits.join("; ");
  }
}
