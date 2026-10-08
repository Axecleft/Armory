# Axecleft's Armory — design

Module id `axeclefts-armory`, title "Axecleft's Armory". Requires the D35E system.
Targets Foundry v14 / D35E 3.1.0 first. A legacy build (Foundry 11.315 / D35E 2.4.3) comes only after
Armory and Curios are finished and all Axecleft modules have had a final integration pass.

## Versions

- Start at `1.14.0`. Minor updates: `1.14.0.1`, `1.14.0.2` … Major updates: `1.14.1`, then `1.14.1.1` …
- Foundry compares each dot-separated part as a number, so never use leading zeros (`1.14.01` equals `1.14.1`).
- The `.14.` keeps the target Foundry version visible. Legacy builds will use `1.11.x`.
- No manifest or download URL until a GitHub repository exists.

## What the Armory does

Builds 3.5 SRD weapons, armor, shields and ammunition — mundane, masterwork, special material and magic —
for the shared Treasure Generator (Treasure by Level), the Merchant Generator, and its own Forge tab.
Nothing is stored as finished items: every piece is assembled from a base item plus data, as in Gemstones.

## Where things come from

| Piece | Source |
|---|---|
| Base weapons, armor, shields, ammunition | Item compendiums chosen on the Item Sources tab (Treasure script v7 scanner). D35E's `weapons-and-ammo` and `armors-and-shields` by default; any GM compendium works for custom mundane items. |
| Special abilities (Flaming, Fortification…) | D35E `enhancement` items from chosen enhancement sources (D35E `enhancements`, Shared Data, others). |
| Special materials | D35E `material` items (hardness, DR flags) **plus** `data/armory.json` for SRD cost and effects, because D35E materials carry no price or effects. |
| SRD random tables, prices, applies-to rules, specific-item prices | `data/armory.json` (ships with the module). |
| GM additions to lists | Shared lists (`registerList`, Treasure script v8+): one journal "Axecleft's Treasure Lists" and the library file `Data/axecleft-treasure/treasure-lists.json`. |

Lookup order for anything the Armory needs to know about an enhancement or material:
1. Flags on the item (`flags.axeclefts-armory`), written by an Armory tab that works like Shop Tags.
2. `armory.json`, matched by name (SRD entries). Nothing is written into D35E's compendiums.
3. The item's own D35E data (`enhIncrease`, `price`, `priceFormula`, `allowedTypes`, `nameExtension`).
4. None of these: usable in the Forge, never rolled randomly.

## D35E 3.1.0 facts the build relies on

Read all of these through one adapter file (`scripts/armory-d35e.js`) so the legacy port only edits one place.

- Weapons: `system.enh` (enhancement bonus), `system.masterwork`, `system.weaponType` (simple/martial/exotic),
  `system.weaponSubtype` (light/1h/2h/ranged), `system.properties` (`thr` thrown, `inc` ghost touch, `dbl` double,
  `kee`, `spd`, `def`, `dis`, `mnk`, `brc`, `rch`, `trp`, `fin`, `nnl`…), `system.weaponData.damageType`
  ("S", "P or S", "B and P"…).
- Armor and shields: `system.equipmentType` (armor/shield), `system.equipmentSubtype`
  (lightArmor/mediumArmor/heavyArmor/lightShield/heavyShield/towerShield/other), `system.armor.{value,dex,acp,enh}`,
  `system.spellFailure`.
- Enhancements are embedded copies in `system.enhancements.items`: `{ _id: "<itemId>-<sourceId>", name, type:"enhancement",
  img, data: {…enhancement system data, enh: <level>} }`. `system.enhancements.automation.updateName/updatePrice`
  let D35E name and price the item itself. Abilities with `enhIsLevel` (Flaming, Fortification, Shadow…) must be
  given level ≥ 1 or they cost nothing.
- Materials: `system.material.data` holds the material item's data.
- Magic ammunition is a `loot` item, `subType: "ammo"`, with `bonusAmmoAttack`, `bonusAmmoDamage` and
  `bonusAmmoEnhancement` — not enhancements.
- Light: `system.light.{emitLight, radius (bright), dimRadius, color, alpha, lightAngle, type (animation),
  animationSpeed 1-10, animationIntensity 1-10}`. Animation types: flame (Torch), torch (Flickering), pulse,
  chroma, wave, fog, sunburst, dome, emanation, hexa, ghost, energy.
- Intelligence: `system.intelligent.{enabled, int, wis, cha, alignment, empathy, speech, telepathy, readLanguages,
  readMagic, languages, senses.*, powers, specialPurpose, hasSpecialPurpose, dedicatedPower, personality, egoOverride}`.
  Tables in D35E compendium "Intelligent Item Tables"; 44 power items in "Intelligent Item Powers".

## Known D35E data problems

- Specific magic arms in `D35E.magicitems` have wrong prices (e.g. Mithral Full Plate of Speed 1,500 vs SRD 26,500)
  and non-SRD items are mixed in. Fixed by the price-correction layer, never by editing D35E.
- About 30 enhancements have empty or wrong `allowedTypes`; `armory.json` supplies applies-to for SRD names.
- Armor Ghost Touch has no D35E enhancement; the Armory builds that one from its own data.
- D35E has no SRD treasure tables; they ship in `armory.json`.
- D35E has no composite bows with +0 Strength rating; SRD rows for those fall back as noted in `armory.json`.
- ETtoD35E compendiums are a work in progress and should not be item sources yet.

## Shared Treasure script v9 (planned)

- `registerSourceKind({ module, key, label, match, accept })`: extra sections on the Item Sources tab (Enhancements,
  Materials; Curios later adds spell sources). Each has automatic matching or the GM's own selection, saved per world.
- Price corrections: a table matched by compendium + item name (not id, so it works on 2.4.3 and 3.1.0). Applied in
  memory at scan time (grading, gp limits, stock) and on the copy when an item is created. A correction only applies
  when the compendium price differs, so upstream fixes make it a no-op. GM additions through a shared list
  "Price Corrections". A Price Check report with export, to send to the D35E developer.
- Generation Settings (collapsible section, saved per world under the `world` namespace):
  master switches for random light and random intelligence; per-category on/off, chance and radii; reset to defaults.
- Intelligence and light are shared services so Curios uses the same code.

## Random generation defaults (all GM-editable or switchable off)

| Category | Light chance | Bright / Dim | Intelligence | Other |
|---|---|---|---|---|
| Magic melee weapons | 30% (SRD) | 20 / 40 ft (light spell) | 1% | 15% inscription hint (SRD: 31-45 on the light roll) |
| Magic ranged weapons | 0% (SRD) | — | 1% | 15% inscription hint (SRD) |
| Magic armor and shields | 5% (house rule) | 10 / 20 ft | 1% | — |
| Other permanent magic items (Curios) | 1% (house rule) | 5 / 10 ft | 1% | — |
| Ammunition, potions, scrolls, wands | 0% | — | never (SRD: not permanent) | — |

Intelligence: SRD says "less than 1% of magic items have intelligence"; only permanent items. The default is 1%;
per-category overrides allow house rules (e.g. AD&D-style swords 25%, other weapons 5%).

Light: color and animation follow the item's abilities (Flaming orange-red flame; Frost/Icy Burst pale blue pulse;
Shock blue-white torch flicker; Holy gold sunburst; Unholy violet ghost; Brilliant Energy white energy; Anarchic
chroma; Axiomatic silver dome; otherwise a neutral white, pale blue or soft gold). Power level raises alpha and
animation intensity; optional setting scales radii (+5 ft per +1 above +2), off by default.
Light dialog: color picker, theme presets, Bright/Dim radii, animation type/speed/intensity, opacity, angle,
Random and No light.

Intelligent items: roll D35E's tables (alignment, scores & communication, lesser and greater powers, special
purpose, dedicated power), attach D35E's power items, fill `system.intelligent`, add the SRD price increases,
compute Ego (shown; D35E's Ego override left alone unless the GM sets it). The Forge offers every step as Random or
a dropdown.

## Poisons (shared script v9, not Armory-specific)

- Source: any item compendium. Axecleft's Traps, Poisons and Diseases does not need to be loaded as a script
  provider; its "Poison Consumables" compendium is auto-included as an item source (the generic
  "poison/disease/trap" name exclusion is lifted for it).
- Recognition: D35E `consumable` with `system.consumableType === "poison"` → new category **Poison**
  (shop tag "Shop: Poison" also works). Delivery (contact/ingested/inhaled/injury) read from the description.
- Diseases made by the Poison and Disease generator inherit consumableType "poison"; they are told apart by the
  incubation line in the description and are left out of shops and treasure unless tagged "Shop: Poison".
- Random treasure: 1% of SRD mundane item rolls become a poison (house rule; GM setting, 0 = off, raise it for
  worlds or locations where poison is common).
- Merchants: new **Black market** shop type and poisons in the **Fence**. Alchemists do not stock poisons by default.

## Materials

Handled as in the SRD (see `armory.json`). Cost text syntax, one column:
`light 1000; medium 4000; heavy 9000; shield 1000` · `weapon 3000; ammo 60` · `per lb 500` · `x2` · `500`.
Effects text: `weight x0.5; acp -3; maxdex +2; asf -10; masterwork`. The material-as-enhancement items in
Shared Data (Mithral, Dragonhide, Bluewood) are superseded by this approach.

## Masterwork and qualities

SRD only: normal and masterwork. All magic arms are masterwork. Adamantine, mithral, darkwood and dragonhide
are always masterwork (their cost includes it).

## Status

- 1.14.8–1.14.8.3: SRD epic arms tables and abilities (armory.json epic* tables; abilities with epic: true), Forge Epic grade, epic crafting through the Crafting engine 1.6.
- 1.14.7: SRD psionic weapon, armor and shield abilities (armory.json `abilities.*` entries with `psionic: true` and a `build` block; tables `psionic{Melee,Ranged,Armor,Shield}Abilities`). D35E has no enhancement items for them, so the builder copies Defending (weapons) or Invulnerability (armor) and turns it into the ability (name, bonus or gp, prefix/suffix, description, requirements). Items with them get `system.psionic` and are hidden while Psionics is off. Random: the "Psionic share of magic arms and armor" setting (10%) swaps the ability tables; psionic shops force them. Crafting: Craft Psionic Arms and Armor, powers as spells, minimum level.
- 1.14.6: specific magic arms craftable from their SRD statblock (ArmorySpecificCraft in scripts/armory-craft.js; Crafting engine 1.3 reads the line, price and Cost).
- 1.14.5.1: Epic is a world switch (Treasure Generator 9.5 Generation settings, shared with Curios); the Forge and Crafting show their Epic options only while it is on. Psionic arms (psionic weapon and armor abilities, Craft Psionic Arms and Armor) are still to do: D35E's Enhancements compendium has none.

- 1.14.5: ammunition ability damage (system.ammoDamageParts, notes for foe-only damage, bonusAmmoEnhancement) and sizes (spec.size sm/med/lg; SRD 30/60/10 in Generation settings). The Armory's planned features are complete; next is Curios, then the final integration pass and the legacy port.

- 1.14.4: intelligent items (scripts/armory-intelligent.js): D35E tables and power items, SRD prices, Ego in the description; random at the Generation settings chance; Forge choices; crafting rolls features at approval. Special purpose rule is a Generation setting (default: items with greater powers).

- 1.14.3: crafting (scripts/axecleft-crafting.js shared engine v1, scripts/armory-craft.js kinds). See CRAFTING-DESIGN.md. Ability prerequisites in armory.json abilities.*.craft; Craft DCs in armory.json crafting. 

- 1.14.2.1: epic option (`spec.epic`; Forge checkbox): no +5/+10 limits, SRD epic prices (total² × 20,000 weapons / × 10,000 armor). Random treasure never epic.

- 1.14.2: the Forge tab (scripts/armory-forge.js), registered with the Treasure Generator's `registerTab`. Next: intelligent items, then ammunition ability damage.

- Identification (decided): treasure and loot are generated unidentified; D35E then builds a weapon's attack without its enhancement until identified, by design. Merchants stock items identified, and the GM toggles identification per item or for all items on D35E's merchant sheet. No Armory setting for this.

- 1.14.1: data, sources, price corrections, builder and random generation done (scripts/armory-d35e.js, armory-builder.js, armory-generate.js). Names follow D35E's prefix/suffix choice for each ability ("+1 Full Plate of Acid Resistance"). 

## Build plan

1. `DESIGN.md` (this file) and `data/armory.json`.
2. Shared Treasure script v9: source kinds, price corrections, Generation Settings, light and intelligence services.
3. Armory script: D35E adapter, builder (base + masterwork + material + bonus + abilities + light + intelligence),
   provider for Treasure by Level and merchants (ranged hint), ammunition as loot items.
4. Forge tab (dropdowns, Random everywhere, light dialog, intelligence section).
5. Specific items matched to D35E's items with corrected prices.

## Integration with other Axecleft modules

- Ship `axecleft-tools.js`, `axecleft-treasure.js` and `axecleft-merchants.js` (same copies as Gemstones; the
  highest version runs), listed first in `esmodules`.
- Provider categories: `standard:weapon|armor|shield|ammo`, `mundane:weapon|armor` (masterwork),
  `magic:weapon|armor`. Honors the `ranged` hint (Bowyer).
- Curios (next module) will supply rings, rods, staffs, wondrous items and consumables the same way.
