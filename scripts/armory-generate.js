/**
 * Axecleft's Armory — random generation by the SRD tables.
 *
 * rollMagicWeapon(grade), rollMagicArmor(grade), rollMundane("weapon" | "armor") return a spec for the
 * builder (or a specific item), then generate() builds it. Light, inscription hints and (later)
 * intelligence follow the Treasure Generator's Generation settings.
 */
import * as D from "./armory-d35e.js";

const T = () => globalThis.AxecleftTreasure;
const d100 = () => 1 + Math.floor(Math.random() * 100);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const normName = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const inD = (rows, r, key = "d") => rows.find((x) => x[key] && r >= x[key][0] && r <= x[key][1]);
const inGrade = (rows, grade, r) => rows.find((x) => x[grade] && r >= x[grade][0] && r <= x[grade][1]);
/** An ability family, so "Slick" and "Slick, improved" count as one ("use the better"). */
const family = (n) => normName(String(n).replace(/,\s*(improved|greater|light|moderate|heavy)$/i, "").replace(/\(\d+\)/, ""));

export class ArmoryGenerator {
  constructor(builder) { this.b = builder; this.t = builder.data.tables; }

  /* ---------- base items from the type tables ---------- */
  weaponBase(forceRanged = false) {
    const table = forceRanged ? "commonRanged" : inD(this.t.weaponType, d100()).table;
    let row = inD(this.t[table], d100());
    if (row.table === "ammunition") row = inD(this.t.ammunition, d100());
    const base = row.d35e ? { name: row.d35e } : { name: row.d35e ?? row.name };
    return { row, base, quantity: row.quantity ?? null, rename: row.rename ?? null, renamePrice: row.price ?? null };
  }

  /* ---------- special abilities ---------- */
  async rollAbilities(facts, table, grade, count, bonus, { limit = 10 } = {}) {
    const out = [];
    let pending = count, guard = 0;
    while (pending > 0 && guard++ < 60) {
      const row = inGrade(table, grade, d100());
      if (!row) continue;
      if (row.name === "rollTwice") { pending += 1; continue; } // this roll becomes two
      const ab = { name: row.name };
      if (row.name === "Bane") ab.foe = inD(this.t.baneFoes, d100()).foe;
      if (this.b.abilityProblem(facts, ab)) continue;               // reroll: wrong weapon or armor
      if (out.some((x) => normName(x.name) === normName(ab.name))) continue; // duplicate
      const cost = (r) => (r.bonus ?? 0) * 1000 + (r.gp ?? 0) / 10;
      const same = out.findIndex((x) => family(x.name) === family(ab.name));
      if (same >= 0) { // two versions of one ability: keep the better
        const a = this.b.tableRow(facts.kind, out[same].name), c = this.b.tableRow(facts.kind, ab.name);
        if (cost(c) > cost(a)) out[same] = ab;
        pending--; continue;
      }
      const total = bonus + [...out, ab].reduce((a, x) => a + (this.b.tableRow(facts.kind, x.name)?.bonus ?? 0), 0);
      if (total > limit) continue; // over the +10 limit (or none for epic items): reroll
      out.push(ab); pending--;
    }
    return out;
  }

  /** Psionic abilities this time? (Psionics on and the Armory's "Psionic share" roll; the SRD psionic tables then replace the normal ones.) */
  psionicRoll() {
    if (T()?.rules?.()?.psionics === false) return false;
    const share = Number(this.setting?.("psionicShare") ?? 10) || 0;
    return share > 0 && Math.random() * 100 < share;
  }

  /** Abilities the psionic table couldn't give (nothing fits this base): roll the rest on the normal table. */
  async fill(facts, table, grade, count, bonus, have) {
    const used = bonus + have.reduce((a, x) => a + (this.b.tableRow(facts.kind, x.name)?.bonus ?? 0), 0);
    const more = await this.rollAbilities(facts, table, grade, count, used);
    return more.filter((x) => !have.some((h) => normName(h.name) === normName(x.name)));
  }

  /* ---------- epic arms (SRD Epic Magic Items; grade "epic", only while Epic items is on) ---------- */
  /** +11 and up: the SRD Epic Weapons / Epic Armor and Shields table (100: roll again and add +10). */
  epicBonus(table) {
    let add = 0;
    for (let i = 0; i < 10; i++) {
      const row = inD(this.t[table], d100());
      if (row?.rollAgainAdd) { add += row.rollAgainAdd; continue; }
      return (row?.bonus ?? 11) + add;
    }
    return 11 + add;
  }
  /** Epic special abilities: the epic table, with its "roll on the nonepic table" rows (major grade). */
  async rollEpicAbilities(facts, epicTable, nonepicTable, count, bonus) {
    const out = [];
    let pending = count, nonepic = 0, guard = 0;
    while (pending > 0 && guard++ < 60) {
      const row = inGrade(epicTable, "epic", d100());
      if (!row) continue;
      if (row.name === "rollTwice") { pending += 1; continue; }
      if (row.name === "nonepicThenAgain") { nonepic += 1; continue; }
      if (row.name === "twiceNonepic") { nonepic += 2; pending -= 1; continue; }
      const ab = { name: row.name };
      if (this.b.abilityProblem(facts, ab)) continue;
      if (out.some((x) => normName(x.name) === normName(ab.name))) continue;
      const same = out.findIndex((x) => family(x.name) === family(ab.name));
      if (same >= 0) { if ((this.b.tableRow(facts.kind, ab.name)?.bonus ?? 0) > (this.b.tableRow(facts.kind, out[same].name)?.bonus ?? 0)) out[same] = ab; pending--; continue; }
      out.push(ab); pending--;
    }
    if (nonepic) {
      const used = bonus + out.reduce((a, x) => a + (this.b.tableRow(facts.kind, x.name)?.bonus ?? 0), 0);
      const more = await this.rollAbilities(facts, nonepicTable, "major", nonepic, used, { limit: Infinity });
      for (const m of more) if (!out.some((x) => family(x.name) === family(m.name))) out.push(m);
    }
    return out;
  }
  async rollEpicWeapon({ ranged = false } = {}) {
    let bonus = 0, abilities = 0, guard = 0, kind = ranged ? "ranged" : null;
    for (;;) {
      if (guard++ > 20) { bonus = 6; break; }
      const row = inGrade(this.t.epicWeapons, "epic", d100());
      if (!row) continue;
      if (row.result === "specificWeapon") return { specific: inD(this.t.epicSpecificWeapons, d100()), table: "epicSpecificWeapons" };
      if (row.result === "meleeAbilityAndRollAgain") { if (ranged) continue; abilities++; kind ??= "melee"; continue; }
      if (row.result === "rangedAbilityAndRollAgain") { abilities++; kind ??= "ranged"; continue; }
      bonus = row.result === "epicBonus" ? this.epicBonus("epicWeaponBonus") : row.bonus; break;
    }
    // A base that fits the abilities' table: melee or ranged
    let pickBase, baseDoc, facts;
    for (let i = 0; i < 12; i++) {
      pickBase = this.weaponBase(kind === "ranged");
      baseDoc = await this.b.baseDoc(pickBase.base);
      facts = D.baseFacts(D.cleanCopy(baseDoc));
      if (facts.kind === "ammo" && abilities) continue; // epic abilities go on the weapon, not single arrows
      if (!kind || (kind === "ranged") === !!facts.ranged) break;
    }
    const abs = abilities ? await this.rollEpicAbilities(facts, facts.ranged ? this.t.epicRangedAbilities : this.t.epicMeleeAbilities, facts.ranged ? this.t.rangedAbilities : this.t.meleeAbilities, abilities, bonus) : [];
    return { base: { pack: baseDoc.pack ?? baseDoc.compendium?.collection ?? null, id: baseDoc._id ?? baseDoc.id, name: baseDoc.name }, baseDoc, bonus: Math.max(1, bonus), abilities: abs, quantity: pickBase.quantity, rename: pickBase.rename, renamePrice: pickBase.renamePrice, kind: facts.kind, facts, epic: true };
  }
  async rollEpicArmor() {
    let bonus = 0, abilities = 0, kind = null, guard = 0;
    for (;;) {
      if (guard++ > 20) { bonus = 6; kind ??= "armor"; break; }
      const row = inGrade(this.t.epicArmorAndShields, "epic", d100());
      if (!row) continue;
      if (row.result === "specificArmorOrShield") return { specific: inD(this.t.epicSpecificArmors, d100()), table: "epicSpecificArmors" };
      if (row.result === "armorAbilityAndRollAgain") { abilities++; kind ??= "armor"; continue; }
      if (row.result === "shieldAbilityAndRollAgain") { abilities++; kind ??= "shield"; continue; }
      if (row.result === "epicShield" || row.result === "epicArmor") { bonus = this.epicBonus("epicArmorBonus"); kind ??= row.result === "epicShield" ? "shield" : "armor"; break; }
      bonus = row.bonus; kind ??= row.result; break;
    }
    const typeRow = inD(kind === "shield" ? this.t.shieldType : this.t.armorType, d100());
    const baseDoc = await this.b.baseDoc({ name: typeRow.d35e });
    const facts = D.baseFacts(D.cleanCopy(baseDoc));
    const abs = abilities ? await this.rollEpicAbilities(facts, kind === "shield" ? this.t.epicShieldAbilities : this.t.epicArmorAbilities, kind === "shield" ? this.t.shieldAbilities : this.t.armorAbilities, abilities, bonus) : [];
    return { base: { pack: baseDoc.pack ?? baseDoc.compendium?.collection ?? null, id: baseDoc._id ?? baseDoc.id, name: baseDoc.name }, baseDoc, bonus: Math.max(1, bonus), abilities: abs, kind, facts, epic: true };
  }

  /* ---------- magic weapons ---------- */
  async rollMagicWeapon(grade = "minor", { ranged = false, psionic = false } = {}) {
    let bonus = 0, abilities = 0, guard = 0;
    for (;;) {
      if (guard++ > 20) { bonus = 1; break; }
      const row = inGrade(this.t.weapons, grade, d100());
      if (!row) continue;
      if (psionic && /^specific/.test(row.result)) continue; // no SRD specific psionic arms in D35E
      if (row.result === "specificWeapon") return this.specific("specificWeapons", grade, { ranged });
      if (row.result === "abilityAndRollAgain") { abilities++; continue; }
      bonus = row.bonus; break;
    }
    const pickBase = this.weaponBase(ranged);
    const baseDoc = await this.b.baseDoc(pickBase.base);
    const facts = D.baseFacts(D.cleanCopy(baseDoc));
    if (psionic && T()?.rules?.()?.psionics !== false) abilities = Math.max(1, abilities); // a psionic shop's stock
    const psi = abilities > 0 && (psionic || this.psionicRoll());
    const table = facts.ranged ? (psi ? this.t.psionicRangedAbilities : this.t.rangedAbilities) : (psi ? this.t.psionicMeleeAbilities : this.t.meleeAbilities);
    const abs = abilities ? await this.rollAbilities(facts, table, grade, abilities, bonus) : [];
    if (psi && abs.length < abilities) abs.push(...await this.fill(facts, facts.ranged ? this.t.rangedAbilities : this.t.meleeAbilities, grade, abilities - abs.length, bonus, abs));
    return { base: { pack: baseDoc.pack ?? baseDoc.compendium?.collection ?? null, id: baseDoc._id ?? baseDoc.id, name: baseDoc.name }, baseDoc, bonus, abilities: abs, quantity: pickBase.quantity, rename: pickBase.rename, renamePrice: pickBase.renamePrice, kind: facts.kind, facts };
  }

  /* ---------- magic armor and shields ---------- */
  async rollMagicArmor(grade = "minor", { psionic = false } = {}) {
    let bonus = 0, abilities = 0, kind = "armor", guard = 0;
    for (;;) {
      if (guard++ > 20) { bonus = 1; break; }
      const row = inGrade(this.t.armorAndShields, grade, d100());
      if (!row) continue;
      if (psionic && /^specific/.test(row.result)) continue; // no SRD specific psionic arms in D35E
      if (row.result === "specificArmor") return this.specific("specificArmors", grade);
      if (psionic && /^specific/.test(row.result)) continue; // no SRD specific psionic arms in D35E
      if (row.result === "specificShield") return this.specific("specificShields", grade);
      if (row.result === "abilityAndRollAgain") { abilities++; continue; }
      bonus = row.bonus; kind = row.result; break;
    }
    const typeRow = inD(kind === "shield" ? this.t.shieldType : this.t.armorType, d100());
    const baseDoc = await this.b.baseDoc({ name: typeRow.d35e });
    const facts = D.baseFacts(D.cleanCopy(baseDoc));
    if (psionic && T()?.rules?.()?.psionics !== false) abilities = Math.max(1, abilities);
    const psi = abilities > 0 && (psionic || this.psionicRoll());
    const table = kind === "shield" ? (psi ? this.t.psionicShieldAbilities : this.t.shieldAbilities) : (psi ? this.t.psionicArmorAbilities : this.t.armorAbilities);
    const abs = abilities ? await this.rollAbilities(facts, table, grade, abilities, bonus) : [];
    if (psi && abs.length < abilities) abs.push(...await this.fill(facts, kind === "shield" ? this.t.shieldAbilities : this.t.armorAbilities, grade, abilities - abs.length, bonus, abs));
    return { base: { pack: baseDoc.pack ?? baseDoc.compendium?.collection ?? null, id: baseDoc._id ?? baseDoc.id, name: baseDoc.name }, baseDoc, bonus, abilities: abs, kind, facts };
  }

  /* ---------- specific items (D35E's Magic Items, SRD prices) ---------- */
  async specific(tableKey, grade, { ranged = false } = {}) {
    let rows = this.t[tableKey].filter((x) => x[grade]);
    let row = inGrade(this.t[tableKey], grade, d100());
    if (ranged && tableKey === "specificWeapons") { // a bowyer: only ranged specific weapons
      const r = rows.filter((x) => /arrow|bolt|bow|javelin/i.test(x.name));
      if (r.length) row = pick(r);
    }
    return { specific: row, table: tableKey };
  }
  async buildSpecific(row) {
    const pack = game.packs.get("D35E.magicitems");
    if (!pack || !row.d35e) return { placeholder: true, name: row.name, summary: `specific item; ${row.price.toLocaleString("en-US")} gp; not found in D35E's Magic Items` };
    const index = await pack.getIndex({ fields: ["system.price"] });
    const e = [...index].find((x) => normName(x.name) === normName(row.d35e));
    if (!e) return { placeholder: true, name: row.name, summary: `specific item; ${row.price.toLocaleString("en-US")} gp; not found in D35E's Magic Items` };
    const data = D.cleanCopy(await pack.getDocument(e._id));
    const name = /^luck blade/i.test(row.name) ? `Luck Blade (${row.name.match(/\((.*)\)/)?.[1] ?? "0 wishes"})` : data.name;
    data.name = name;
    if (data.system) {
      data.system.identifiedName = name;
      D.setPrice(data, row.price); // SRD price (D35E's can be wrong; legacy versions never get fixed)
      data.system.identified = false;
    }
    return { name, data, summary: `specific item, ${row.price.toLocaleString("en-US")} gp (SRD price)` };
  }

  /* ---------- the mundane table (masterwork arms, darkwood, armor) ---------- */
  async rollMundane(kind, { ranged = false } = {}) {
    const m = this.t.mundane;
    if (kind === "weapon") {
      const sub = ranged ? { table: "commonRanged" } : inD(m.weapons, d100());
      let row = inD(this.t[sub.table], d100());
      if (row.table === "ammunition") row = inD(this.t.ammunition, d100());
      return { base: { name: row.d35e }, masterwork: true, quantity: row.quantity ?? null, rename: row.rename ?? null, renamePrice: row.price ?? null };
    }
    let row = inD(m.armor, d100());
    if (row.table === "darkwood") { const s = inD(m.darkwood, d100()); return { specific: this.t.specificShields.find((x) => normName(x.name) === normName(s.specific)), table: "specificShields" }; }
    if (row.table === "masterworkShield") row = inD(m.masterworkShield, d100());
    return { base: { name: row.d35e }, masterwork: !!row.masterwork };
  }

  /* ---------- light and hints (Generation settings) ---------- */
  light(facts, abilities, bonus) {
    const hub = T();
    if (!hub?.genChance) return null;
    const cat = facts.kind === "armor" || facts.kind === "shield" ? "armor" : facts.kind === "ammo" ? null : facts.ranged ? "ranged" : "melee";
    if (!cat || !hub.genChance("light", cat)) return null;
    const g = hub.generation().light, L = this.b.data.generation.light;
    const themed = g.themes ? abilities.map((a) => L.themes[Object.keys(L.themes).find((k) => normName(k) === normName(a.name))]).find(Boolean) : null;
    const th = themed ?? pick(L.neutral);
    const extra = g.scaleRadii ? Math.max(0, bonus - 2) * (Number(g.scaleFeet) || 0) : 0;
    const power = g.powerBrightness ? bonus : 0;
    return {
      color: th.color, type: th.type ?? "", speed: th.speed ?? 3,
      intensity: Math.min(10, (th.intensity ?? 3) + Math.floor(power / 2)),
      alpha: Math.min(0.9, 0.4 + 0.05 * power),
      bright: (Number(g[cat].bright) || 0) + extra, dim: (Number(g[cat].dim) || 0) + extra * 2,
    };
  }
  /** Generation settings (SRD): random arms are Small 30%, Medium 60%, another size (Large) 10%. */
  size() {
    const g = T()?.generation?.()?.size;
    if (!g || g.enabled === false) return "med";
    const w = [["sm", Number(g.small) || 0], ["med", Number(g.medium) || 0], ["lg", Number(g.large) || 0]];
    const total = w.reduce((s, [, n]) => s + n, 0);
    if (total <= 0) return "med";
    let r = Math.random() * total;
    for (const [k, n] of w) { if (r < n) return k; r -= n; }
    return "med";
  }
  /** Generation settings: under 1% of permanent magic items are intelligent (SRD). Never ammunition. Returns true if it became intelligent. */
  async maybeIntelligent(built, facts, bonus) {
    const hub = T();
    if (!this.intel || !hub?.genChance || facts.kind === "ammo") return false;
    const cat = facts.kind === "armor" || facts.kind === "shield" ? "armor" : facts.ranged ? "ranged" : "melee";
    if (!hub.genChance("intelligence", cat)) return false;
    try {
      const intel = await this.intel.roll({ abilities: (built.craft?.abilities ?? []).map((a) => ({ name: a.title })), bonus, effective: built.effective ?? bonus });
      this.intel.apply(built, intel);
      return true;
    } catch (err) { console.warn("axeclefts-armory | intelligence not added", err); return false; }
  }
  hint(facts) {
    const hub = T();
    if (!hub?.genChance || facts.kind === "armor" || facts.kind === "shield" || facts.kind === "ammo") return false;
    return hub.genChance("hints", facts.ranged ? "ranged" : "melee");
  }

  /* ---------- whole items for the Treasure Generator and merchants ---------- */
  /** category: "magic:weapon" | "magic:armor" | "mundane:weapon" | "mundane:armor". Returns [entry] for the hub. */
  async generate(category, { grade = "minor", ranged = false, psionic = false, exclude = null } = {}) {
    const epic = grade === "epic";
    if (epic && (T()?.rules?.()?.epic !== true || !/^magic:(weapon|armor)$/.test(category))) return []; // no epic arms while Epic items is off
    for (let tries = 0; tries < 8; tries++) {
      try {
        const roll = epic ? (category === "magic:weapon" ? await this.rollEpicWeapon({ ranged }) : await this.rollEpicArmor())
          : category === "magic:weapon" ? await this.rollMagicWeapon(grade, { ranged, psionic })
          : category === "magic:armor" ? await this.rollMagicArmor(grade, { psionic })
          : await this.rollMundane(category === "mundane:weapon" ? "weapon" : "armor", { ranged });
        if (roll.specific) {
          if (exclude?.has?.(normName(roll.specific.name)) && tries < 7) continue; // already in this treasure: roll again
          const sp = await this.buildSpecific(roll.specific);
          if (sp.data && /^epic/.test(roll.table ?? "")) foundry.utils.setProperty(sp.data, "system.epic", true);
          if (sp.data) {
            const k = D.armsKind(sp.data), facts = { kind: k, ranged: sp.data.system?.weaponSubtype === "ranged" };
            const bonus = Number(sp.data.system?.enh ?? sp.data.system?.armor?.enh ?? 0) || 0;
            const b = { data: sp.data, price: Number(sp.data.system?.price) || 0, summary: sp.summary };
            if (await this.maybeIntelligent(b, facts, bonus)) sp.summary = b.summary;
          }
          return [sp];
        }
        const magic = category.startsWith("magic:");
        const facts = roll.facts ?? D.baseFacts(D.cleanCopy(await this.b.baseDoc(roll.base)));
        const spec = {
          base: roll.base, bonus: roll.bonus ?? 0, abilities: roll.abilities ?? [], masterwork: roll.masterwork ?? magic,
          quantity: roll.quantity ?? undefined, size: facts.kind === "ammo" ? undefined : this.size(),
          light: magic ? this.light(facts, roll.abilities ?? [], roll.bonus ?? 0) : null,
          hint: magic ? this.hint(facts) : false,
          epic: epic || undefined,
        };
        const built = await this.b.build(spec);
        // The SRD epic tables also hold +1 to +5 items: an epic roll keeps going until the item really is epic
        if (epic && built.data?.system?.epic !== true && tries < 7) continue;
        if (roll.rename) this.renameBase(built, roll.rename, roll.renamePrice, facts);
        if (magic) await this.maybeIntelligent(built, facts, roll.bonus ?? 0);
        return [{ name: built.quantity > 1 ? `${built.name} (${built.quantity})` : built.name, data: built.data,
          summary: `${epic ? "SRD epic table:" : magic ? `${grade[0].toUpperCase()}${grade.slice(1)} magic` : "Mundane"} ${built.summary}; ${built.price.toLocaleString("en-US")} gp${built.quantity > 1 ? " each" : ""}${spec.light ? "; sheds light" : ""}` }];
      } catch (err) {
        if (tries === 7) throw err;
      }
    }
    return [];
  }

  /** SRD rows with no D35E base (composite bows with no Strength rating): rename and reprice the built item. */
  renameBase(built, rename, price, facts) {
    const d = built.data, s = d.system;
    const fix = (n) => String(n ?? "").replace(facts.name, rename);
    d.name = fix(d.name); s.identifiedName = fix(s.identifiedName);
    if (s.unidentified) s.unidentified.name = fix(s.unidentified.name);
    const diff = (price ?? facts.price) - facts.price;
    s.price = Math.round((Number(s.price) + diff) * 100) / 100;
    if (s.unidentified) s.unidentified.price = Math.round((Number(s.unidentified.price) + diff) * 100) / 100;
    built.name = d.name; built.price = s.price;
  }
}
