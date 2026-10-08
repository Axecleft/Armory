/**
 * Axecleft's Armory — D35E adapter.
 *
 * Every read or write of D35E item fields goes through here, so a port to another D35E version
 * (the legacy 2.4.3 build) only has to change this file. Written against D35E 3.1.0.
 */

/** What kind of arms an item is: "weapon", "armor", "shield", "ammo" or null. */
export function armsKind(e) {
  const s = e?.system ?? {};
  if (e?.type === "weapon") return "weapon";
  if (e?.type === "equipment" && s.equipmentType === "armor") return "armor";
  if (e?.type === "equipment" && s.equipmentType === "shield") return "shield";
  if (e?.type === "loot" && s.subType === "ammo") return "ammo";
  return null;
}

const NON_METAL = /\b(quarterstaff|club|greatclub|nunchaku|sap|(long|short)?bow|sling|blowgun|net|whip|bolas|padded|leather|hide|wooden|unarmed)\b/i;
const WOODEN = /\b(wood(en)?|quarterstaff|club|greatclub|nunchaku|(long|short)?bow|crossbow|spear|longspear|shortspear|javelin|lance|arrow|bolt|buckler)\b/i;

/** Facts the builder needs about a base item. */
export function baseFacts(e) {
  const s = e?.system ?? {}, kind = armsKind(e);
  const props = s.properties ?? {};
  const dmg = String(s.weaponData?.damageType ?? "").toUpperCase();
  return {
    kind,
    name: e?.name ?? "",
    price: Number(s.price) || 0,
    weight: Number(s.weight) || 0,
    quantity: Number(s.quantity) || 1,
    // weapons
    weaponType: s.weaponType ?? null,                 // simple | martial | exotic
    subtype: s.weaponSubtype ?? null,                 // light | 1h | 2h | ranged
    ranged: kind === "ammo" || s.weaponSubtype === "ranged",
    thrown: !!props.thr,
    double: !!props.dbl,
    damageTypes: ["B", "P", "S"].filter((t) => new RegExp(`\\b${t}\\b`).test(dmg)),
    // armor and shields
    armorClass: kind === "armor" ? ({ lightArmor: "lightArmor", mediumArmor: "mediumArmor", heavyArmor: "heavyArmor" }[s.equipmentSubtype] ?? "lightArmor") : null,
    shieldClass: kind === "shield" ? s.equipmentSubtype ?? null : null,
    enh: kind === "weapon" ? Number(s.enh) || 0 : kind === "armor" || kind === "shield" ? Number(s.armor?.enh) || 0 : 0,
    masterwork: s.masterwork === true,
    // Special materials: metal ones need metal parts (an arrow can be adamantine, a quarterstaff can't); darkwood needs wood
    metal: !NON_METAL.test(e?.name ?? ""),
    wooden: WOODEN.test(e?.name ?? ""),
  };
}

/** Strip a compendium copy down to new item data. */
export function cleanCopy(doc) {
  const d = typeof doc?.toObject === "function" ? doc.toObject() : foundry.utils.deepClone(doc);
  delete d._id; delete d.folder; delete d.sort; delete d.ownership;
  if (d._stats) d._stats = { compendiumSource: d._stats.compendiumSource ?? null };
  return d;
}

export const setMasterwork = (data) => { foundry.utils.setProperty(data, "system.masterwork", true); };

/** The enhancement bonus D35E uses for attack/damage (weapons) or armor/shield bonus. */
export function setEnhancementBonus(data, kind, bonus) {
  if (kind === "weapon") foundry.utils.setProperty(data, "system.enh", bonus);
  else if (kind === "armor" || kind === "shield") foundry.utils.setProperty(data, "system.armor.enh", bonus);
  else if (kind === "ammo") {
    const b = bonus ? `+${bonus}` : "";
    foundry.utils.setProperty(data, "system.bonusAmmoAttack", b);
    foundry.utils.setProperty(data, "system.bonusAmmoDamage", b);
    foundry.utils.setProperty(data, "system.bonusAmmoEnhancement", bonus ? String(bonus) : ""); // counts as magic (and +N) against damage reduction
  }
}

/**
 * Special abilities on ammunition (D35E 3.1): each ability's extra damage becomes an "add" ammunition damage part,
 * so it is rolled whenever the ammunition is fired. Damage that only applies against some foes (holy, bane…) and
 * other effects go in the ammunition's attack note instead.
 * list: [{ title, enh (the enhancement copy), against: "evil creatures" | null }]
 */
export function setAmmoAbilities(data, list) {
  const parts = [], notes = [];
  for (const { title, enh, against } of list) {
    const w = enh?.system?.weaponData ?? {};
    const roll = String(w.damageRoll ?? "").trim();
    const type = w.damageType || (w.damageTypeId && w.damageTypeId !== "damage-untyped" ? w.damageTypeId.replace(/^(energy|damage)-/, "") : "");
    if (roll && !w.optionalDamage && !against) parts.push([roll, type, w.damageTypeId ?? "", "add"]);
    else if (roll) notes.push(`${title}: +${roll}${type ? ` ${type.toLowerCase()}` : ""} damage${against ? ` against ${against}` : ""}${Number(w.attackRoll) ? ` and +${w.attackRoll} on attacks` : ""} (add it when it applies)`);
    const note = String(enh?.system?.attackNotes ?? "").replace(/\[\[\/r ([^\]#]+)#?([^\]]*)\]\]/g, "$1 $2").replace(/\[\[([^\]]+)\]\]/g, "$1").trim();
    if (note) notes.push(`${title}: ${note}`);
  }
  foundry.utils.setProperty(data, "system.ammoDamageParts", parts);
  foundry.utils.setProperty(data, "system.bonusAmmoAttackNote", notes.join("\n"));
  return { parts, notes };
}

/** Evaluate a D35E enhancement formula ("@enhancement*2-1", "3750+((@enhancement)-(1))*15000-…"). */
export function evalFormula(formula, vars) {
  let f = String(formula ?? "").trim();
  if (!f) return null;
  for (const [k, v] of Object.entries(vars)) f = f.replace(new RegExp(`@${k}\\b`, "g"), `(${Number(v) || 0})`);
  if (!/^[\d\s+\-*/().?:=<>!&|]+$/.test(f)) return null;
  try { const v = Function(`"use strict"; return (${f});`)(); return Number.isFinite(Number(v)) ? Number(v) : null; } catch (e) { return null; }
}

/** A D35E enhancement item, set to a level, ready to embed in system.enhancements.items. */
export function enhancementCopy(enhDoc, level) {
  const d = typeof enhDoc?.toObject === "function" ? enhDoc.toObject() : foundry.utils.deepClone(enhDoc);
  const s = d.system ?? (d.system = {});
  s.enh = level;
  const inc = evalFormula(s.enhIncreaseFormula, { enhancement: level });
  if (inc !== null) s.enhIncrease = inc;
  const price = evalFormula(s.priceFormula, { enhancement: level, enhIncrease: s.enhIncrease ?? 0 });
  if (price !== null) s.price = price;
  const source = d._id ?? foundry.utils.randomID();
  d.id = `${foundry.utils.randomID()}-${source}`;
  delete d.folder; delete d.sort; delete d.ownership;
  return d;
}
/** What an embedded enhancement adds: { bonus (equivalent), gp (flat) }. */
export const enhancementCost = (e) => ({ bonus: Number(e.system?.enhIncrease) || 0, gp: Number(e.system?.price) || 0 });

/** Put enhancements on the item, with D35E's name and price automation off (the Armory prices materials too). */
export function setEnhancements(data, list) {
  const s = data.system;
  s.enhancements ??= {};
  s.enhancements.items = list;
  s.enhancements.automation = { updateName: false, updatePrice: false };
}

/** Attach a D35E material item (hardness, DR flags) the way D35E's sheet does. */
export function setMaterial(data, matDoc) {
  const m = typeof matDoc?.toObject === "function" ? matDoc.toObject() : foundry.utils.deepClone(matDoc);
  delete m.folder; delete m.sort; delete m.ownership;
  foundry.utils.setProperty(data, "system.selectedMaterial", m.system?.uniqueId ?? "");
  foundry.utils.setProperty(data, "system.material", m);
  const hard = Number(m.system?.hardness);
  if (Number.isFinite(hard) && hard > 0 && data.system.hardness !== undefined) data.system.hardness = Math.max(Number(data.system.hardness) || 0, hard);
}

/** Armor/shield statistics changed by a material. */
export function adjustArmor(data, { acp = 0, maxDex = 0, asf = 0, category = 0 } = {}) {
  const s = data.system, a = s.armor ?? (s.armor = {});
  if (acp) a.acp = Math.max(0, (Number(a.acp) || 0) + acp);
  if (maxDex && a.dex !== null && a.dex !== undefined && a.dex !== "") a.dex = (Number(a.dex) || 0) + maxDex;
  if (asf) s.spellFailure = Math.max(0, (Number(s.spellFailure) || 0) + asf);
  if (category && s.equipmentType === "armor") {
    const order = ["lightArmor", "mediumArmor", "heavyArmor"];
    const i = order.indexOf(s.equipmentSubtype);
    if (i > 0) s.equipmentSubtype = order[Math.max(0, i + category)];
  }
}

export const setWeight = (data, w) => { data.system.weight = Math.round(w * 100) / 100; };
export const setPrice = (data, p) => { data.system.price = Math.round(p * 100) / 100; };
export const setQuantity = (data, q) => { data.system.quantity = q; };

/** Name, unidentified name/price and identified state (players see the unidentified side until identified). */
export function setIdentity(data, { name, unidentifiedName, unidentifiedPrice, identified = false }) {
  const s = data.system;
  data.name = name;
  s.identifiedName = name;
  s.unidentified = { ...(s.unidentified ?? {}), name: unidentifiedName, price: Math.round(unidentifiedPrice * 100) / 100 };
  s.identified = identified;
}

export function setDescription(data, html, unidentifiedHtml = null) {
  const d = data.system.description ?? (data.system.description = {});
  d.value = html;
  if (unidentifiedHtml !== null) d.unidentified = unidentifiedHtml;
}
export const descriptionOf = (e) => String(e?.system?.description?.value ?? "");

/** D35E item light: { color, bright, dim, alpha, type, speed, intensity }. */
export function setLight(data, l) {
  data.system.light = {
    ...(data.system.light ?? {}),
    emitLight: true, color: l.color ?? "", radius: l.bright ?? 0, dimRadius: l.dim ?? "",
    alpha: l.alpha ?? 0.5, type: l.type ?? "", animationSpeed: l.speed ?? 5, animationIntensity: l.intensity ?? 5, lightAngle: 360,
  };
}
