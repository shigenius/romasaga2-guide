import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getInitialWeaponLevelModifier,
  getRelevantDamageStats,
  getStatHeatLevel,
  resolveCharacterState,
} from "./character.js";
import { createSparkIndex, getSparkCoverage } from "./spark.js";
import {
  compareWeaponEvidence,
  getWeaponCapability,
  getWeaponRecommendations,
  getMagicRecommendations,
  getScoreHeatLevel,
} from "./recommendations.js";

const load = async (filename, property) =>
  JSON.parse(await readFile(new URL(`../../${filename}`, import.meta.url), "utf8"))[property];
const [characters, weapons, techniques, sparkTypes] = await Promise.all([
  load("characters.json", "characters"),
  load("weapons.json", "weapons"),
  load("techniques.json", "techniques"),
  load("spark_types.json", "sparkTypes"),
]);

const jubei = characters.find(({ name }) => name === "ジュウベイ");
const bear = characters.find(({ name }) => name === "ベア");
const cat = characters.find(({ name }) => name === "キャット");
const gerard = characters.find(({ name }) => name === "ジェラール");
const koumei = characters.find(({ name }) => name === "コウメイ");
const greatsword = weapons.find(({ id }) => id === "greatsword");
const martial = weapons.find(({ id }) => id === "martial");
const sparkIndex = createSparkIndex({ techniques, sparkTypes });

assert.deepEqual(getRelevantDamageStats(greatsword, jubei), [{ id: "str", label: "腕力", value: jubei.stats.str }]);
assert.deepEqual(getRelevantDamageStats(martial, jubei).map(({ id }) => id), ["str", "spd"]);
assert.equal(getInitialWeaponLevelModifier(jubei, greatsword), jubei.initialLevelOffsets.slash);
assert.deepEqual(getSparkCoverage(jubei, "greatsword", sparkIndex), { sparkable: 18, total: 19, ratio: 18 / 19 });

const armoredGerard = resolveCharacterState(gerard, "armored");
assert.equal(armoredGerard.lp, 9);
assert.equal(armoredGerard.stats.str, gerard.stats.str);
assert.equal(armoredGerard.initialLevelOffsets.slash, 22);
assert.equal(armoredGerard.initialLevelOffsets.shoot, gerard.initialLevelOffsets.shoot);
assert.equal(armoredGerard.sparkTypeId, "nothing");
assert.equal(getStatHeatLevel("str", 10, characters), 1);
assert.equal(getStatHeatLevel("str", 25, characters), 5);
assert.equal(getStatHeatLevel("lp", 1, characters), 1);
assert.equal(getStatHeatLevel("lp", 25, characters), 4);
assert.ok(getStatHeatLevel("lp", 15, characters, 16) > getStatHeatLevel("lp", 8, characters, 16));
assert.equal(getStatHeatLevel("lp", 28, characters, 16), 16);
assert.equal(getStatHeatLevel("lp", 99, characters, 16), 16);
assert.notEqual(getStatHeatLevel("str", 20, characters, 16), getStatHeatLevel("str", 25, characters, 16));

const recommendations = getWeaponRecommendations(jubei, weapons, sparkIndex, characters);
assert.equal(recommendations.length, weapons.length);
for (let index = 1; index < recommendations.length; index += 1) {
  assert.ok(
    compareWeaponEvidence(recommendations[index - 1], recommendations[index]) <= 0,
    "recommendations must remain in score order",
  );
}
assert.ok(
  recommendations[0].score >= recommendations.at(-1).score,
  "score is the primary ranking criterion",
);
assert.equal(
  getWeaponRecommendations(bear, weapons, sparkIndex, characters)[0].weapon.id,
  "sword",
  "Bear's +3 slash offset should beat spear's stronger spark coverage",
);
assert.equal(getWeaponCapability(jubei, martial, characters).capabilityBand, 5);
const catRecommendations = getWeaponRecommendations(cat, weapons, sparkIndex, characters);
const catBow = catRecommendations.find(({ weapon }) => weapon.id === "bow");
const catShortsword = catRecommendations.find(({ weapon }) => weapon.id === "shortsword");
const catMartial = catRecommendations.find(({ weapon }) => weapon.id === "martial");
assert.equal(catBow.initialLevelModifier, -7);
assert.equal(catBow.factors.initialLevel, 0.1);
assert.ok(catBow.score < catShortsword.score, "Cat's −7 bow modifier must materially lower its road score");
assert.ok(catMartial.score > catShortsword.score, "Cat's Martial Arts aptitude must use both STR and SPD");
assert.equal(getScoreHeatLevel(100), 16);
assert.equal(getScoreHeatLevel(0), 1);
const koumeiMagic = getMagicRecommendations(koumei, characters);
assert.deepEqual(
  koumeiMagic.slice(0, 3).map(({ school }) => school.id),
  ["fire", "earth", "light"],
  "Koumei's +5 normal schools should share the top magic score",
);
assert.equal(koumeiMagic[0].score, koumeiMagic[2].score);
assert.deepEqual(koumeiMagic[0].relevantStats.map(({ label }) => label), ["魔力", "理力", "術威力"]);
assert.deepEqual(
  koumeiMagic.find(({ school }) => school.id === "dark").relevantStats.map(({ label }) => label),
  ["理力"],
);
assert.ok(
  compareWeaponEvidence(
    { score: 20, sparkCoverage: { sparkable: 1 }, initialLevelModifier: -7, weapon: { id: "a" } },
    { score: 10, sparkCoverage: { sparkable: 99 }, initialLevelModifier: 15, weapon: { id: "b" } },
  ) < 0,
  "a higher score must outrank better secondary evidence",
);

console.log("shared derivation logic: OK");
