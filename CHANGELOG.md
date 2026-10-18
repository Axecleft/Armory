# Axecleft's Armory — changelog

## 1.14.9.24

- Ships Axecleft's Tools 9.2: the User Guide button opens the Tool Suite's wiki in Foundry's language: French, Spanish, Brazilian Portuguese or European Portuguese when you play in one of them, English otherwise.

## 1.14.9.23

- Ships Axecleft's Tools 9.1: a User Guide button at the end of the Axecleft's Tools toolbar group (and menu), for GMs and players. It opens the Tool Suite's wiki (https://github.com/Axecleft/Axecleft-s-Tools-Suite/wiki/Home) in your web browser.

## 1.14.9.22

- Ships the Crafting engine 1.94: crafting time estimates use each skill's full bonus, as the character sheet shows it.

## 1.14.9.21

- Ships the Crafting engine 1.93: a Craft check's weekly progress can be counted in another coin (used by Traps' trap kits).

## 1.14.9.20

- Upgrading magic arms and armor follows the DMG's "Adding New Abilities" rule (p. 288), so it's no longer called a house rule. The upgrade now needs every prerequisite of the new item, old abilities included, as if it were made from scratch; the cost is still the difference in price. No 50% body-slot surcharge applies to arms and armor.

## 1.14.9.19

- Crafting, Magic arms and armor: magic weapons, armor, shields and ammunition the Armory made can be upgraded (house rule; the SRD only enchants masterwork items). Choose one from the inventory, give it a higher enhancement bonus and/or new abilities, and pay only the difference in price (gp, XP and time). Its existing bonus and abilities stay (a +2 flaming longsword can become a +2 flaming flaming burst longsword, not a +3 frost one), and its light was decided when it was made. Only the new abilities' prerequisites are needed. Cursed and intelligent items, and magic items the Armory didn't make, aren't offered.

## 1.14.9.18

- Crafting, Magic arms and armor: ammunition from the inventory uses the stack's own pieces (up to 50 at a time); the Pieces box is set to the stack and locked, and the price follows it. Before, any number up to 50 could be made from a few pieces. Magic ammunition is no longer offered as a masterwork base (+1 darts showed up in the list; magic arms and armor already didn't). Enchanting one item from a stack of masterwork arms or armor now uses one item, not the whole stack.

## 1.14.9.17

- Ships the Treasure Generator 9.98: a cursed item that sheds light keeps its own light until the curse is active ("Curse Active" ticked); only then does it glow with the curse's eerie light, and unticking it brings its own light back. Before, the eerie light was there from the start and gave the curse away. The eerie lights now use animations from D35E's item sheet, so saving the sheet no longer clears the animation.

## 1.14.9.16

- Ships the Treasure Generator 9.97: custom curses on a "Custom Curses" page of the Treasure Lists journal (your own curses, drawbacks, situations and specific cursed items, with weights, the items they fit and buff penalties); the SRD's curses can be switched off one by one.

## 1.14.9.15

- Crafting a specific magic item (Rings, rods, staffs, wondrous / Specific magic arms): the caster level needed is never lower than the minimum caster level that can cast the item's required spells (SRD), e.g. Ring Gates needs 17 for gate. The window says which spell sets it. Needs Curios for the spell data.
- Ships Crafting 1.92: a staff (or, for powers, a psicrown) can supply a spell; scrolls and wands name their psionic equivalents (power stone, dorje).

## 1.14.9.14

- Ships the Treasure Generator 9.96: cursed items (SRD tables; Generation settings: a flat rate, 1% by default, or by grade, 3% / 2% / 1%), with D35E's Cursed mark, buffs for active curses and an eerie light on cursed items that shed light.
- The Forge has a "Cursed" choice: no curse, a random SRD curse, or a chosen kind. A reversed curse turns the enhancement bonus into a penalty.

## 1.14.9.13

- The crafting window's caster-level reason for an intelligent item now reads "an intelligent item (caster level 15)" instead of "an intelligent item 15"; the number is filled in by the code, so translations keep the {n} placeholder (French: "un objet intelligent (NLS {n})").
- French words: Gilgalad's corrections to the Words tab are applied (Improved and Greater armor abilities in the right order, base ammunition named in the plural, shop words, gems, art objects and materials).

## 1.14.9.12

- Ships Axecleft's Tools 9.0, Treasure Generator 9.95, Merchant Generator 7.9, Crafting 1.91: the same scripts now run on Foundry v11 too (the Foundry v11 build of this module is 1.11 instead of 1.14). On v11, windows and dialogs use Foundry's classic ones; nothing changes on v13/v14.
- Intelligent items are offered only when the D35E system supports them (3.1.0 or later); with older D35E versions the Intelligent options are hidden.

## 1.14.9.11

- French draft, second pass: Gigalad's terminology corrections are applied (weapon and armor abilities, bane foes, metamagic words, item grades Faible/Puissant, Pierre psionique, Biens précieux, Token, Améliorer, Objet spécial, Grimoire).
- French weapon and armor names list their abilities after the bonus, each noun with its own "de": "Hache d'arme +2, sainte, de feu et de rapidité".
- Ships the Merchant Generator 7.8: shop-name words have their own lines in the word files (Shop: Anvil, Shop: Shadow), so a shop word can differ from the same English word in item names. English shop names are unchanged.

## 1.14.9.10

- French draft: lang/fr.json (buttons, menus, hints, messages and name patterns) and lang/fr.words.json (the words in item and shop names, with their genders) are filled in, and languages.json now lists fr, so worlds set to French show this module in French. A first draft for Gigalad to correct; English worlds are unchanged.

## 1.14.9.9

- Axecleft's Tools 8.4: word files. Each module's lang folder has words.template.json, every English word that goes into names (abilities, materials, base items, gems, art objects, item kinds, shop-name words); a translator copies it to <code>.words.json and writes each word with a short notation: "Épée longue (f)" (text and gender), "(f)" (gender only, keeping Babele's name), "acéré/acérée/acérés/acérées" (forms that agree with the noun), "de feu (of)" (a word that moves after the noun). Patterns can also hold agreeing words: {~sculpté/sculptée}. lang/README.md explains it. This module's template has 413 words.
- Ships the Merchant Generator 7.7: shop names ("The Gilded Anvil", "Garrick's Smithy") go through the grammar and the word files, so they can read "L'Enclume dorée" or "Forge de Garrick".
- Ability, material, size and base-item words come from the word file when it has them (with their genders, so abilities agree with the weapon or armor).
- English names are unchanged.

## 1.14.9.8

- Axecleft's Tools 8.3: names built from parts ("+1 Flaming Longsword of Speed", "Scroll of Fireball", "Gold Ring set with Ruby") follow the language's grammar: the name patterns are translated in lang/<code>.json like other texts (word order), and a new grammar file per language (lang/<code>.grammar.json) sets the word for "and", articles, agreement ("acérée" with "Épée longue"), elision (de → d'), contractions (de le → du) and capital letters. Drafts for French, Spanish and Portuguese are included (used once the language is listed in languages.json); lang/README.md explains patterns and grammar files.
- Built arms keep their English name (for matching) whatever language the world is in; armory.json marks which abilities go after "of" (as D35E's English items have them), since a translated enhancement's own name extension can't be used for that.
- English names are unchanged.

## 1.14.9.7

- The Armory's own windows are translatable: the Forge tab, the three crafting tabs (magic arms and armor, specific magic arms, arms and armor by Craft), rule messages, item descriptions and summaries, ammunition notes and intelligent items. Prices use the world's number format. lang/template.json now lists 1,068 texts.
- Fixed: crafting magic arms with a custom ability (Shared Data or your own enhancement item) stopped with an error.
- Fixed: in a translated world, making an item intelligent could add its intelligence section to the description twice.

## 1.14.9.6

- Axecleft's Tools 8.2: a language loader for Axecleft's modules. Each module has a lang folder (template.json to translate, one file per language, e.g. fr.json); texts not translated yet stay in English, Brazilian and European Portuguese fall back on each other, and setting names are translated too.
- Ships the Treasure Generator 9.94, Merchant Generator 7.6 and Crafting 1.9: their windows, chat cards and messages are translatable. The Armory's own windows follow next.

## 1.14.9.5

- Worlds in other languages: the special-ability dropdowns (Forge, Crafting) and the ability headings in an item's description use D35E's translated enhancement names ("Feu", "Froid"; "Défense (Light Fortification)" when one D35E item covers several grades). Abilities D35E has no item for stay in English. Item names keep the English ability words until the per-language grammar files.

## 1.14.9.4

- Ships Axecleft's Crafting 1.8: spell requirements in the world's language.

## 1.14.9.3

- Worlds in other languages: enhancement and material sources are found when Babele translates the compendium labels ("Propriétés spéciales", "Matériaux"); the forge and crafting lists use the English labels too. Ships the Treasure Generator 9.93.

## 1.14.9.2

- Axecleft's Tools 8.1: works with Babele 2.9 (Foundry 13/14), which keeps its translations in a new place; with it, translated compendium items are found by their English names again.

## 1.14.9.1

- Added module update function.

## 1.14.9

- **Worlds in other languages** (Babele-translated compendiums, French, Spanish, Portuguese…): base weapons and armor, enhancements, specific items and feats are found by their English names, so random arms, the Forge and crafting work there as in English. Wooden and metal parts are read from the English name (a "Bâton" is still a quarterstaff).
- Crafting specific magic arms and armor in a translated world reads D35E's English construction line for the item (new data/prereqs.json), since its translated description can't be read.
- Axecleft's Tools 8: in a world not in English, naming or renaming an item asks for its English name (optional; Skip / Don't ask again), and item sheets get an "English name" button, so items made in your language are recognized by the treasure, merchant and crafting tools.
- Ships the Treasure Generator 9.92 and the Crafting engine 1.7.
- Item names still mix languages ("+1 Épée longue of Flaming"); translated names come with the language files.

## 1.14.8.3

- Ships the Merchant Generator 7.5: epic stock in Epic campaign settlements of any size (about 1 magic item in 10, past the gp limit).

## 1.14.8.2

- Ships the Treasure Generator 9.91 (epic scrolls among the epic extra items at EL 21+).

## 1.14.8.1

- **Epic crafting** (Crafting engine 1.6): epic arms (enhancement above +5, total above +10, or an epic special ability) need Craft Magic Arms and Armor and Craft Epic Magic Arms and Armor, cost market price ÷ 100 + 10,000 XP, and take 1 day per 10,000 gp of base price (house rule, reported). Choosing an epic ability turns the item epic by itself. Only while Epic items is on.

## 1.14.8

- **SRD epic arms** (only while Epic items is on, Treasure Generator → Generation settings):
  - The SRD Epic Magic Items tables: epic weapons and armor/shields (+1 to +10, specific epic arms, epic special abilities, and +11 to +20 with "roll again and add +10"), epic weapon abilities (Acidic/Fiery/Icy/Lightning/Sonic Blast, Mighty Disruption, Dread, Anarchic/Axiomatic/Holy/Unholy Power, Everdancing, Distant Shot, Triple-Throw, Unerring Accuracy) and epic armor and shield abilities (Great Invulnerability, Great Spell Resistance 21–27, Negating, Acid/Cold/Fire/Lightning/Sonic Warding, Exceptional and Infinite Arrow Deflection, Great Reflection), with their "roll on the nonepic table" rows.
  - Specific epic arms: Stormbrand, Quarterstaff of Alacrity, Souldrinker, Backstabber, Mace of Ruin, Gripsoul, Elven Greatbow, Finaldeath, Chaosbringer, Holy Devastator, Unholy Despoiler, Everwhirling Chain; Shapeshifter's Armor, Warlord's Breastplate, Dragonskin Armor, Armor of the Celestial Battalion, Armor of the Abyssal Horde, Antimagic Armor, Bulwark of the Great Dragon (D35E's items at SRD prices; D35E has wrong prices for several).
  - Random treasure (Treasure Generator 9.9, EL 21+ epic items) and the Forge (new grade **Epic (SRD epic tables)**; epic abilities in their own groups). An epic roll keeps going until the item really is epic (the epic tables also hold +1 to +5 rows).
  - Price (SRD): an epic special ability (price modifier above +5) makes the item epic, so its whole magic price is ×10, as with an enhancement above +5 or a total above +10. Epic items are marked epic (system.epic).
- Ships the Treasure Generator 9.9.

## 1.14.7.3

- Ships the Treasure Generator 9.8: trap loot (incidental loot for trap tokens, ¼ to 1× by CR) and a fix for rolling loot by hand while Automatic loot is on.

## 1.14.7.2

- Ships the Crafting engine 1.5 (searchable lists without the Treasure Generator; also shipped by Axecleft's Traps, Poisons, and Diseases for its Trap kits tab).

## 1.14.7.1

- Ships Axecleft's Tools 7 (searchable lists that scroll, for modules without the Treasure Generator, such as Traps).
- Ships the Treasure Generator 9.7: **Token loot**, each NPC token's own treasure by its CR, by hand or automatically when an unlinked token is placed (see TREASURE-GENERATOR-CHANGELOG.md).

## 1.14.7

- **SRD psionic weapon, armor and shield abilities** (only while Psionics is on, Treasure Generator → Generation settings):
  - Weapons: Bodyfeeder, Collision, Coup de Grace, Dislocator, Dissipater, Great Dislocator, Lucky, Manifester, Mindcrusher, Mindfeeder, Parrying, Power Storing, Psibane, Psychic, Psychokinetic, Psychokinetic Burst, Soulbreaker, Sundering, Suppression, Teleporting.
  - Armor and shields: Aporter, Averter, Ectoplasmic, Floating, Gleaming, Heartening, Landing, Linked, Manifester, Mindarmor, Phasing, Power Resistance 13/15/17/19, Quickness, Radiant, Ranged, Seeing, Time Buttress, Vanishing, Wall.
  - D35E has no enhancement items for them, so the Armory builds each one from its SRD entry: name, +bonus or gp price, and a description with its construction line. The SRD effects aren't automated; the description says to see the SRD (as with Ghost Touch armor).
  - **Random treasure and merchants:** new world setting **Psionic share of magic arms and armor (%)** (default 10): that share of magic arms with special abilities roll on the SRD psionic ability tables instead. Curios' Psionic emporium now stocks a few psionic weapons and armor.
  - **Forge:** the ability lists have SRD psionic groups, and each slot has **Random psionic (by grade)**.
  - **Crafting:** psionic abilities need **Craft Psionic Arms and Armor**, with their powers in place of spells and manifester level as caster level (Power Storing: creator level 12). An item with only psionic abilities needs only that feat; mixed with ordinary abilities, both feats.
  - Items with psionic abilities are marked psionic (system.psionic), so they disappear while Psionics is off.
- Fixed: Flaming and Flaming Burst asked for flame blade *and* flame strike or fireball; the SRD needs any one of the three.
- Ghost Touch armor's description and name now come from armory.json like the psionic abilities (no change in play).
- "Coup de Grace": small words stay lowercase in ability names.

## 1.14.6.1

- The item boxes in the Crafting window (Specific magic arms) and the Treasure Generator now open a list that scrolls and stays on screen (Treasure Generator 9.6, Crafting engine 1.4).

## 1.14.6

- **Specific magic arms in the Crafting window** (new tab "Specific magic arms"): Flame Tongue, Celestial Armor, Holy Avenger, Javelin of Lightning, Lion's Shield… any named magic weapon, armor, shield or ammunition in your item compendiums (D35E's Magic Items by default). Epic ones are listed only while Epic items is on.
  - Requirements come from the item's **SRD construction line**: Craft Magic Arms and Armor (or the feat it names, e.g. Craft Rod for a rod of python), each spell with the SRD's "or", alignment, level, skills, and anything else for the GM.
  - Caster level: at least 5 and 3 × the item's enhancement bonus (SRD), or more where the line says so; the item's own caster level is shown.
  - **Cost by the SRD statblock:** "Cost 10,515 gp + 816 XP" is split the SRD way: the XP gives the magic's base price (816 × 25 = 20,400 gp, so supplies 10,200 gp) and the rest (315 gp) is the masterwork longsword the crafter supplies. Items without a Cost line count the whole price as magic (noted on the card).
  - **Price:** the Armory's price corrections first; otherwise, when the compendium's price is missing or differs from the statblock ("Price 26,500 gp"), the statblock wins.
  - A collapsible **How requirements are found** box explains the line, so custom specific items can be made craftable.
- Ships the Crafting engine 1.3.

## 1.14.5.2

- **Custom special abilities are now checked when crafting.** An enhancement that isn't an SRD ability (from Shared Data or your own compendium) has its prerequisites read from the SRD construction line in its description ("Moderate evocation; CL 10th; Craft Magic Arms and Armor, flame blade, flame strike or fireball; Price +1 bonus"): its caster level, spells (with "or") and alignment. Without the line, the GM still decides, as before.
- The Crafting window's magic arms tab has a collapsible **How requirements are found** box explaining the line's format.
- Ships the Crafting engine 1.2.

## 1.14.5.1

- **Epic is now a world switch.** The Forge's and the Crafting window's Epic options only appear while **Epic items** is ticked in the Treasure Generator's Generation settings (Treasure by Level tab). It is shared by every Axecleft module.
- Ships Treasure Generator 9.5 and Merchant Generator 7.4 (Psionics and Epic items switches, the Epic campaign settlement character).

## 1.14.5

Ammunition abilities and sizes. With this, the Armory's planned features are complete.

- **Special abilities on ammunition now work in D35E.**
  - Each ability's extra damage is added to the ammunition's own damage parts (D35E 3.1 "ammunition damage parts", mode add), so it is rolled whenever the ammunition is fired: flaming +1d6 fire, frost, shock, the bursts' critical dice, thundering.
  - Damage that only applies against some foes (holy, unholy, anarchic, axiomatic, bane) and other effects (thundering's deafness, wounding, merciful) go in the ammunition's attack note.
  - Magic ammunition also gets its enhancement as "ammunition enhancement", so it counts as magic against damage reduction.
- **Sizes (SRD):**
  - Small arms and armor cost the same and weigh half.
  - Large ones cost twice the base price and weigh twice as much; the masterwork and magic cost the same.
  - Weapons get D35E's weapon size, so D35E scales their damage dice itself.
  - Names show the size: "+1 Longsword (Small)".
  - Ammunition has no size.
  - Random treasure and merchants follow the SRD: 30% Small, 60% Medium, 10% another size (Large here). This is set in Generation settings (Treasure Generator 9.4) and can be changed or switched off.
  - The Forge and the Crafting window have a Size choice.
- Correction: earlier notes said Small armor costs half. That was 3.0; the 3.5 SRD keeps the price and halves the weight.

## 1.14.4

Intelligent items.

- **Intelligent arms and armor by the SRD**, built on D35E 3.1's own intelligent item support.
  - The Armory reads D35E's Intelligent Item Tables and doesn't post the table draws to chat. It rolls:
    - alignment (rerolled until it suits holy, unholy, axiomatic or anarchic);
    - the mind (two scores high, one 10, and which one is 10 is random);
    - communication, senses and languages (Common plus one per Intelligence bonus);
    - lesser and greater powers (no duplicates);
    - a special purpose and dedicated power.
  - Powers are attached as D35E powers: spells become spell-like powers with their uses per day, and the skill and alignment powers come from D35E's Intelligent Item Powers.
  - The SRD price of the mind, each power and the dedicated power is added to the item's base price.
  - The description lists every feature and the Ego (SRD Item Ego table); D35E keeps its own Ego on the sheet.
- **Random treasure and merchants:** magic weapons, armor and shields (specific items too, never ammunition) become intelligent at the Generation settings chance (SRD default 1%).
- **Special purpose** (Generation settings): the SRD doesn't say how often an item has one. By default, items with greater powers always have one; you can switch that off or add a chance for the others.
- **Forge:** "Intelligent" in the "Light, inscription and more" section: by Generation settings, no, random, or choose. Choosing lets you pick the alignment, the mind, each lesser and greater power, the special purpose and the dedicated power, each with Random.
- **Crafting:** "Make it intelligent" on magic arms and armor.
  - SRD: caster level 15, and the item takes the crafter's alignment.
  - The other features are rolled by the GM's client on approval ("Determine other features randomly"). Their price is added, so the gp, XP and time on the card rise accordingly before anything is charged.
  - If the crafter can't pay the new total, the card says so and stays pending.
- Shared scripts: Treasure Generator 9.3 (special purpose setting) and Crafting 1.1 (`beforeApprove` for features rolled at approval).

## 1.14.3

Crafting, by the SRD.

- **New Crafting window** (Axecleft's Tools, hammer icon), for players and the GM. It's the shared crafting engine (`axecleft-crafting.js`, version 1), so Curios, Gemstones and Traps, Poisons and Diseases can add their own items later.
  - **Magic arms and armor** (Craft Magic Arms and Armor):
    - The masterwork base can come from the crafter's inventory (it becomes the magic item), be bought (its price is the item cost), or be made with Craft first.
    - Choose the enhancement bonus (epic too), up to four special abilities with Bane's foe, and whether it sheds light. The SRD says the creator decides that at creation.
    - Costs follow the SRD. Magic supplies are ½ the base price in gp, and XP is 1/25 of the base price. The masterwork item is a separate item cost. A +1 flaming longsword is 4,000 gp and 320 XP plus the masterwork longsword.
    - Requirements are checked against the character:
      - the feat;
      - caster level, at least 3 × the bonus or the ability's own caster level if higher;
      - every required spell, which may also come from a helping caster, a scroll or a wand;
      - alignment (holy, unholy, anarchic, axiomatic);
      - the monk (ki focus);
      - gold;
      - XP, which can't cost a level.
    - Each SRD special ability's prerequisites come from the SRD and are now in `armory.json`.
  - **Arms and armor (Craft):**
    - Mundane and masterwork weapons, armor, shields and ammunition, with or without a special material.
    - The Craft DC comes from the SRD table, using weaponsmithing, armorsmithing or bowmaking.
    - The masterwork component is a separate DC 20 check.
    - Raw materials cost ⅓ of the price.
  - **Time** is shown, never enforced: 1 day per 1,000 gp of base price for magic items, and weeks from check × DC for Craft.
- **Requests and approval:**
  - A player's item goes to the GM as a private chat card with every cost, requirement (✔/✘), check, and the time required.
  - The GM chooses how the checks are rolled (public, private GM or blind GM), then **Approve**, **Edit** or **Reject**.
  - On approval the gp and XP are spent; the SRD spends them at the start of the work.
  - Then the player rolls the checks from the card. Craft rules apply:
    - Failing by 4 or less makes no progress; roll again.
    - Failing by 5 or more ruins half that part's raw materials; pay half again or abandon.
    - Blind rolls are resolved by the GM.
  - When every check succeeds, the item is created, identified, in the character's inventory, and the masterwork base it was made from is used up.
  - The GM can also **Approve and craft now**.
- **Settings** (Configure Settings → Axecleft's Armory):
  - Players may craft.
  - Magic item checks: SRD (no check, the default) or the Spellcraft house rule (DC 5 + caster level, +5 for each missing prerequisite instead of blocking; failing by 5 or more loses the gp and XP).
  - Poison crafting house rule, for later.
  - Default roll mode.
  - Charge gp, charge XP, and the XP level floor.
- An inventory item named "Masterwork Longsword" now enchants to "+1 Longsword", not "+1 Masterwork Longsword".

## 1.14.2.1

Epic items.

- **Epic option in the Forge:** a new "Epic" checkbox lifts the +5 enhancement and +10 total limits so the GM can craft high-powered items. The Enhancement dropdown then offers +6 to +20, and Random abilities may push the total past +10.
- Epic items are priced by the SRD's epic rules: the square of the total bonus × 20,000 gp for weapons and ammunition (per 50), × 10,000 gp for armor and shields. Examples: a +6 longsword is 720,315 gp, and a +6 full plate is 361,650 gp. An item at +5 / +10 or less keeps its normal price, even with Epic checked.
- In macros, pass `epic: true` to `api.build`. Random treasure and merchants never make epic items.

## 1.14.2

The Forge.

- **Forge tab** in the Treasure Generator (hammer icon): make weapons, armor, shields and ammunition by hand.
  - Dropdowns for kind, base item (the mundane arms in your item sources), grade, enhancement bonus (+1 to +5), masterwork, special material and up to four special abilities (SRD abilities plus any other enhancements in your Enhancements sources, under "Your enhancements"). Bane adds a foe dropdown.
  - Every choice can be Random. Random parts are rolled on the SRD tables for the chosen grade, and rolled again for each item when you make several.
  - Lists show only what fits the chosen kind or base item (no armor abilities on a sword, no darkwood on a chain shirt).
  - A live preview shows the name, the price with its parts, and what players see while the item is unidentified. Choices that break an SRD rule show the reason in red, and Generate refuses them.
  - "Light, inscription and more": light by Generation settings, none, or on (look from its abilities, a theme, or a custom color and animation, with bright and dim radii); inscription hint; start identified; number of ammunition pieces; items to make (1–10).
  - Items go wherever the window's destination says (Items folder, selected tokens or an actor), like the other tabs.
  - The Forge remembers your last kind, base, grade, bonus, material and light choice.

## 1.14.1

The builder and random generation.

- **Builder** (`game.modules.get("axeclefts-armory").api.build(spec)`): a mundane base item from your item sources plus masterwork, a special material, an enhancement bonus (+1 to +5) and special abilities becomes a finished D35E item.
  - Special abilities are D35E's own enhancement items (from your Enhancements sources), embedded at the right level (Flaming 1; Fortification, Shadow, Slick and Silent Moves 1–3; Spell Resistance 1–4). Bane takes a designated foe ("+1 Undead Bane Longsword", "+1 Orc Bane Dagger"). Armor Ghost Touch, which D35E lacks, is built from the Armory's data.
  - Special materials attach D35E's material item (hardness, damage-reduction properties) and apply the SRD: mithral (half weight, one category lighter, −10% spell failure, +2 max Dex, armor check penalty 3 less), darkwood (half weight; shields' penalty 2 less), adamantine, dragonhide, cold iron, alchemical silver.
  - SRD rules are enforced: abilities need at least +1, the total stays at +10 or less, keen and vorpal need the right damage type, disruption a bludgeoning weapon, throwing a melee weapon, returning a thrown one; metal materials need metal parts, darkwood needs wood; an ability listed twice is refused.
  - Priced by the SRD, materials included (D35E's automatic pricing leaves them out, so its name and price automation is switched off on Armory items). Examples: +1 longsword 2,315 gp; +1 flaming longsword 8,315; mithral chain shirt 1,100; dragonhide full plate 3,300; +1 cold iron longsword 4,330; 50 +1 arrows 2,302.5.
  - Magic items start unidentified: players see "Masterwork Longsword" at its mundane price until the item is identified. Masterwork and special-material items without magic are identified.
  - The description lists each ability with D35E's text, the material's effects, and any light or inscription.
  - Magic ammunition is a D35E ammunition item with its attack and damage bonus; abilities on ammunition are described (add their damage by hand for now).
- **Random generation by the SRD tables** for the Treasure Generator (Treasure by Level) and merchants:
  - Magic weapons, armor and shields by grade (minor, medium, major): enhancement bonus, "special ability and roll again", base item from the type tables, abilities from the melee, ranged, armor or shield tables (duplicates and invalid abilities rerolled, two versions of one ability keep the better, +10 limit), bane foes.
  - Specific weapons, armor and shields from D35E's Magic Items at their SRD prices (Luck Blade by wishes left).
  - Mundane items: the SRD Mundane Items table's armor and masterwork weapons, darkwood shields and masterwork shields.
  - A bowyer's (ranged) magic and masterwork weapons come from the ranged table.
  - Light and inscription hints follow the Generation settings (30% of magic melee weapons shed light, colored by their abilities; 15% of weapons carry a hint).
- Not yet: intelligent items, the Forge (crafting by hand), ammunition ability damage.

## 1.14.0.1

- Enhancement and special material sources (Item Sources tab), 17 price corrections for D35E's specific magic arms. Needs the Treasure Generator script version 9.

## 1.14.0

- First build: data/armory.json (SRD tables, D35E links, materials, generation defaults).
