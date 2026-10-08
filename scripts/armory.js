/**
 * Axecleft's Armory — 1.14.8 (builder, random generation, the Forge tab, crafting, intelligent items and the SRD
 * psionic weapon, armor and shield abilities).
 *
 * Loads data/armory.json, registers the Armory's compendium sources (enhancements, special materials),
 * its price corrections, and an item provider for the Treasure Generator and Merchant Generator
 * (masterwork and magic weapons, armor, shields and ammunition by the SRD tables).
 *
 * Macros:
 *   const A = game.modules.get("axeclefts-armory").api;
 *   await A.build({ base: { name: "Longsword" }, bonus: 1, abilities: [{ name: "Flaming" }] });   // { data, name, price, ... }
 *   await A.generate("magic:weapon", { grade: "medium" });                                         // [{ name, data, summary }]
 */
import { ArmoryBuilder } from "./armory-builder.js";
import { ArmoryGenerator } from "./armory-generate.js";
import { registerForge } from "./armory-forge.js";
import { registerCrafting } from "./armory-craft.js";
import { ArmoryIntelligence } from "./armory-intelligent.js";

const MOD = "axeclefts-armory";
const T = globalThis.AxecleftTreasure;
const api = { MOD, data: null, ready: false, builder: null, generator: null, loaded: null };

if (T?.registerSourceKind) {
  T.registerSourceKind({
    module: MOD, key: "enhancements", label: "Enhancements",
    hint: "Special abilities for magic weapons, armor and shields (Flaming, Keen, Fortification…). D35E's Enhancements compendium and any compendium with enhancement items, such as Axecleft's Shared Data.",
    match: (label) => /\benhancements?\b/i.test(label),
    accept: (e) => e.type === "enhancement",
    fields: ["system.enhancementType", "system.enhIncrease", "system.allowedTypes", "system.nameExtension"],
  });
  T.registerSourceKind({
    module: MOD, key: "materials", label: "Special materials",
    hint: "Materials for arms and armor (adamantine, mithral, darkwood…). Costs and effects follow the SRD; D35E's material items supply hardness and damage-reduction properties.",
    match: (label) => /\bmaterials?\b/i.test(label),
    accept: (e) => e.type === "material",
    fields: ["system.hardness", "system.uniqueId"],
  });
  T.registerProvider({
    module: MOD, name: "arms", label: "Axecleft's Armory",
    categories: ["mundane:weapon", "mundane:armor", "magic:weapon", "magic:armor"],
    async roll({ category, grade, tags = [], exclude = null }) {
      await api.loaded;
      if (!api.generator) throw new Error("armory.json did not load");
      // grade "epic" (Treasure Generator 9.9): the SRD epic tables, only while Epic items is on
      return api.generator.generate(category, { grade: grade ?? "minor", ranged: tags.includes("ranged"), psionic: tags.includes("psionic"), exclude });
    },
  });
  registerForge(api);
} else {
  console.warn(`${MOD} | the Treasure Generator script version 9 or later is not loaded; the Armory can't supply treasure or merchants.`);
}

registerCrafting(api); // the shared Crafting window (magic and mundane arms and armor)

Hooks.once("init", () => {
  game.modules.get(MOD).api = api;
  game.settings.register(MOD, "psionicShare", {
    name: "Psionic share of magic arms and armor (%)", scope: "world", config: true, type: Number, default: 10, range: { min: 0, max: 100, step: 5 },
    hint: "House rule, while Psionics is on (Treasure Generator → Generation settings): this share of random magic weapons, armor and shields that get special abilities roll them on the SRD psionic ability tables instead. 0 = none.",
  });
  api.loaded = foundry.utils.fetchJsonWithTimeout(`modules/${MOD}/data/armory.json`)
    .then((data) => {
      api.data = data;
      api.builder = new ArmoryBuilder(data);
      api.generator = new ArmoryGenerator(api.builder);
      api.generator.setting = api.setting;
      api.intelligence = new ArmoryIntelligence(api);
      api.generator.intel = api.intelligence;
      api.ready = true;
      if (T?.registerPriceCorrections) {
        T.registerPriceCorrections({ module: MOD, corrections: data.priceCorrections ?? [] });
        if (game.ready && game.user?.isGM) T.scanCompendiums?.(); // the scan may already have run
      }
      const t = data.tables;
      console.log(`${MOD} | armory.json loaded: ${t.commonMelee.length + t.uncommon.length + t.commonRanged.length} weapon rows, `
        + `${t.meleeAbilities.length + t.rangedAbilities.length + t.armorAbilities.length + t.shieldAbilities.length} ability rows, `
        + `${data.materials.length} materials, ${data.priceCorrections.length} price corrections`);
      return data;
    })
    .catch((err) => console.error(`${MOD} | could not load data/armory.json`, err));
});

api.setting = (k) => { try { return game.settings.get(MOD, k); } catch (e) { return { psionicShare: 10 }[k]; } };
api.build = async (spec) => { await api.loaded; return api.builder.build(spec); };
api.generate = async (category, opts = {}) => { await api.loaded; return api.generator.generate(category, opts); };
