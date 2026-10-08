# Axecleft Crafting — rough design

Status: the engine and the Armory's kinds are built (Armory 1.14.3). Decisions: SRD magic item checks by default with the Spellcraft house rule as an option; the poison house rule; checks are rolled by the player after the GM approves, in the roll mode the GM picks (public, private GM, blind GM). The rules below were checked against the 3.5 SRD
Cross-Linked Reference journal, on these pages:

- Magic Items: Creating Magic Items, and the creation sections for each item type
- Feats: Item Creation Feats
- Skills: Craft
- Traps: Designing a Trap

**House rule** marks every place where the design goes beyond the SRD.

## Goal

One crafting window for players and the GM. It follows the SRD for making magic items (feats, caster level, required
spells, gp, XP) and mundane items (Craft checks and raw materials).

A player's item is a **request**. The GM sees every requirement, roll and cost, and **the time the work takes**. The
GM then approves, edits or rejects it. Nothing is created or charged until the GM approves.

## Shared script, many modules

Crafting is a new shared script, **`axecleft-crafting.js`**. Each module ships a copy, and the highest version runs,
as with the Treasure and Merchant scripts. Each module registers the **craft kinds** it knows:

| Module | Craft kinds |
|---|---|
| Armory | Magic arms and armor (Craft Magic Arms and Armor). Mundane and masterwork arms and armor (Craft: weaponsmithing, armorsmithing, bowmaking). |
| Curios | Scrolls, potions, wands, staffs, rings, rods and wondrous items. Alchemical items (Craft: alchemy). |
| Gemstones | Jewelry and art objects (Craft: jewelry, gemcutting, sculpting…; the SRD generic Craft DCs). |
| Traps, Poisons and Diseases | Mechanical traps (Craft: trapmaking) and magic device traps, under the SRD Traps rules. Poisons (house rule, see below). |

```
AxecleftCrafting.registerKind({
  module, key, label, icon,
  type: "magic" | "mundane",
  feat: "Craft Magic Arms and Armor",   // magic: the item-creation feat
  skill: "crf.weaponsmithing",          // mundane: the Craft skill (a D35E subskill)
  form(actor)    -> HTML for the choices (the Armory reuses its Forge controls)
  resolve(form)  -> { item data, basePrice, itemCost, componentCosts, casterLevel, requirements[], craftDC, notes }
})
```

The window is one ApplicationV2 with a tab for each registered kind. The GM opens it from the Treasure Generator or
the Items sidebar. Players open it from a button on their character sheet or a macro.

## SRD rules for magic items

**Item creation feats.** The minimum caster level is the feat's prerequisite.

| Feat | Minimum caster level |
|---|---|
| Scribe Scroll | 1 |
| Brew Potion | 3 |
| Craft Wondrous Item | 3 |
| Craft Magic Arms and Armor | 5 |
| Craft Wand | 5 |
| Craft Rod | 9 |
| Forge Ring | 12 |
| Craft Staff | 12 |

**Costs.** The SRD splits the price into parts:

- **Base price**: the magic itself (for arms and armor, the value on Table: Weapons or Table: Armor and Shields).
  - **Magic supplies** cost ½ of the base price in gp.
  - The **XP cost** is 1/25 of the base price.
- **Item cost**: the masterwork weapon or armor, and a special material if any. It adds to the market price, but
  not to the base price, so it carries no XP and isn't halved. The crafter supplies it: bought, from their
  inventory, or made with Craft.
  - Example: a +1 longsword's base price is 2,000 gp, giving 1,000 gp in supplies and 80 XP. The masterwork longsword
    (315 gp) is the item cost. The market price is 2,315 gp.
- **Spell component costs**: only for items that **cast** a spell with a costly material component or an XP
  component. Having such a spell as a prerequisite doesn't add this cost.
  - Scroll or potion: the component, once.
  - Wand: 50 times the component.
  - Ring, rod, wondrous item, arms and armor: 50 times the component.
  - Staff: 50 ÷ the number of charges the spell uses.
  - Each XP in a component adds 5 gp to the market price.
- **XP floor**: "A character cannot spend so much XP on an item that he or she loses a level." The engine blocks
  this. XP gained toward the next level can be spent instead of leveling.

**Prerequisites** "must be met for the item to be created." Spell lists follow the SRD's own rule for "or": Flaming's "flame blade, flame strike, or fireball" is read as flame blade plus flame strike or fireball. The engine checks:

- **Required spells.** A spell can come from:
  - the crafter (prepared, or known for a sorcerer or bard);
  - a helping caster;
  - a scroll, which uses up **one per day** of work;
  - a wand, which uses **one charge per day**;
  - a spell-like ability.
- Prepared spells are spent each day of work, as if they had been cast. The engine notes this for the GM.
- **Spell lists.** When two spells at the end of a list are joined by "or", only one of them is needed.
- **Arms and armor caster level**: at least 3 × the enhancement bonus, or the special ability's requirement if that is
  higher.
- **Double weapons** cost, take time and need XP as two weapons.
- **Other requirements** (race, alignment, a skill) as written in the item.
- **Intelligent items**: caster level 15th or higher. The item's alignment is the creator's. Its Intelligence, Wisdom,
  Charisma and capabilities add their table prices to the gp, XP and time.

**Caster level**: chosen by the creator. It is never lower than the minimum needed to cast the spell, and never higher
than the creator's own. Scroll, potion, wand and staff prices scale with it.

**Spell-item prices** (base price; supplies are half). A 0-level spell counts as ½.

| Item | Base price | Notes |
|---|---|---|
| Scroll | 25 × spell level × caster level | |
| Potion | 50 × spell level × caster level | 3rd-level spells or lower. No spells with a range of personal. Every potion is paid in full (no economies of scale). |
| Wand | 750 × spell level × caster level | 4th-level spells or lower; 50 charges. |
| Staff | 750 × spell level × caster level for the highest spell | The next spell at 75% and the others at 50%. A spell can cost half and use 2 charges. Caster level at least 8. 50 charges. |
| Ring, rod, wondrous item | Table: Estimating Magic Item Gold Piece Values | Curios supplies the published prices. |

**Glow**: "At the time of creation, the creator must decide if the weapon glows or not." In the crafting window the
crafter chooses light on or off, so light is never random there.

**Time** (shown, not enforced): 1 day per 1,000 gp of base price, minimum 1 day. A potion always takes 1 day. The
crafter works 8 hours a day; the days needn't be consecutive. Starting another item wastes the gp and XP spent on the
first.

### Skill checks

**The SRD has no skill check for making a magic item.** If the feat, the caster level, the spells and the other
prerequisites are met, the item is made. The only rolls in the process are:

- the **Craft** checks for the masterwork item (the item cost);
- any check an item's own prerequisites name.

A GM setting, **Magic item checks**, chooses between:

| Option | Rule |
|---|---|
| SRD (default) | No check. A missing prerequisite blocks the item. |
| Spellcraft (house rule) | Spellcraft DC 5 + caster level. Each missing prerequisite, other than the feat and caster level, adds +5 instead of blocking. A failure by 5 or more wastes the gp and XP. |

## SRD rules for mundane items (Craft)

1. Raw materials cost **⅓ of the price**.
2. The DC comes from the Craft table:

   | Item | Craft DC |
   |---|---|
   | Simple melee or thrown weapon | 12 |
   | Martial melee or thrown weapon | 15 |
   | Exotic melee or thrown weapon | 18 |
   | Crossbow | 15 |
   | Longbow or shortbow | 12 |
   | Composite bow | 15, or 15 + 2 × the Strength rating for a high rating |
   | Armor or shield | 10 + its AC bonus |
   | Acid | 15 |
   | Alchemist's fire, smokestick, tindertwig | 20 |
   | Antitoxin, sunrod, tanglefoot bag, thunderstone | 25 |
   | Very simple item | 5 |
   | Typical item | 10 |
   | High-quality item | 15 |
   | Complex or superior item | 20 |

3. **Making the item:** the crafter makes one Craft check.
   - Meeting the DC succeeds.
   - Failing by 4 or less means no progress; try again.
   - Failing by 5 or more ruins half the raw materials; pay half again.
4. **Time (shown only):** each week, check × DC is the progress in silver pieces. The engine shows "about N weeks"
   from the roll.
5. **Faster work:** the crafter can add +10 (or more) to the DC to work faster.
6. **Masterwork items:** the masterwork component is a separate part. It costs 300 gp for a weapon, 150 gp for armor
   or a shield, and 6 gp per piece of ammunition, of which ⅓ is paid as raw materials. Its DC is 20. Both parts are
   rolled.
7. **Modifiers:**
   - Improvised tools: −2. Masterwork artisan's tools: +2.
   - Craft (alchemy) needs alchemical equipment and **a spellcaster**. An alchemist's lab gives +2.
   - Dwarves get +2 on stone and metal crafts. Gnomes get +2 on Craft (alchemy).
8. **Repair:** the same DC as making the item, for 1/5 of the price. Possible later.

**Traps** follow the SRD's own rules on the Traps page: Craft (trapmaking) DCs, mechanical trap costs, and gp plus XP
for magic device traps. They belong to the Traps, Poisons and Diseases module.

**Poisons: the SRD has no rule for making poison.** Proposed house rule, as a GM setting:

- Craft (alchemy), with the DC equal to the poison's save DC.
- Raw materials ⅓ of the price.
- The usual Craft check results apply.
- The crafter must be a spellcaster, as for alchemy; this can be switched off.

## The flow

1. **Crafter chooses.** A player or the GM picks the crafting character and the item, using the Forge's dropdowns.
2. **Check.** The engine reads the actor and marks each item met or missing:
   - feats (D35E `feat` items, matched by name);
   - caster level (the highest, or a chosen spellbook);
   - each required spell: from the spellbooks, or by ticking "helping caster", "scroll" or "wand", which count the
     scrolls or charges needed (one per day);
   - Craft and Spellcraft skills;
   - gp and XP, including the level floor;
   - the masterwork item: in the inventory, to buy, or to craft.
3. **Rolls.** The crafter rolls any Craft or Spellcraft check from the window, as a normal D35E skill roll in chat.
4. **Submit.** A whispered card goes to the GM with:
   - the item and its market price;
   - the costs: gp supplies, XP, item cost and components;
   - each requirement, ✔ or ✘;
   - the rolls;
   - **the time required, prominently**;
   - for each day of work: the prepared spells used, and the scrolls or wand charges spent;
   - the buttons **Approve**, **Edit** (opens the Forge) and **Reject**.
5. **GM approves.** The GM's client:
   - deducts the gp and XP;
   - uses up the masterwork base, components, scrolls or wand charges;
   - creates the item on the actor;
   - posts the result.

   This runs on the GM's side through the module socket (`"socket": true`), since players can't change other
   documents.
6. **The GM crafts directly.** The same checks show as warnings that the GM can override.

## Settings (GM, per world)

- **Players may craft:** on or off. Optionally only some players, or only some kinds.
- **Magic item checks:** SRD (default) or Spellcraft (house rule).
- **Poison crafting:** off, or the house rule above.
- **Costs:** charge gp, charge XP, enforce the XP level floor. Each can be switched off.
- **Time:** shown only (default).

## D35E data to confirm before coding

- **Actor:**
  - XP: `system.details.xp.value`, and the XP needed for the current level.
  - Gold: `system.currency.gp`.
  - Caster level per spellbook.
  - Prepared and known spells.
  - Skills: `system.skills.spl` (Spellcraft) and the names of the `system.skills.crf` subskills.
- **Spell items:** level by class, and material and XP component costs. These are text in D35E and may need parsing
  or a GM entry.
- **Magic item prerequisites:** D35E keeps them in the description text. Curios will carry the SRD prerequisites as
  data, as `armory.json` does for the arms tables.
- **Socket:** check that the D35E merchant sheet's own transactions don't conflict.

## Build order

1. **In the Armory:** the engine and window in `axecleft-crafting.js`, with the request card and GM approval, using the
   arms kinds. The Forge already has the builder and the SRD prices; only the base price and item cost need splitting.
2. **In the Armory:** mundane Craft for arms and armor, including the masterwork component.
3. **Curios:** scrolls, potions and wands first, then staffs, rings, rods and wondrous items. Then alchemical items.
4. **Gemstones and Traps, Poisons and Diseases**, at the final integration pass with the other shared scripts.
5. **Legacy port**, with the rest.
