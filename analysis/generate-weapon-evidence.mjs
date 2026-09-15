#!/usr/bin/env node
/**
 * Prints a temporary, developer-facing review table. It deliberately writes no
 * derived values back into canonical JSON; rerun after any data correction.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getInitialWeaponLevelModifier,
  getRelevantDamageStats,
} from "../site/logic/character.js";
import { createSparkIndex, getSparkCoverage } from "../site/logic/spark.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = async (filename, property) => {
  const json = JSON.parse(await readFile(resolve(root, filename), "utf8"));
  return json[property];
};

const [characters, classes, weapons, techniques, sparkTypes] = await Promise.all([
  load("characters.json", "characters"),
  load("classes.json", "classes"),
  load("weapons.json", "weapons"),
  load("techniques.json", "techniques"),
  load("spark_types.json", "sparkTypes"),
]);
const classById = new Map(classes.map((item) => [item.id, item]));
const sparkIndex = createSparkIndex({ techniques, sparkTypes });

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const score = (character, weapon) =>
  getRelevantDamageStats(weapon, character).reduce((sum, stat) => sum + stat.value, 0) /
  weapon.damageStatIds.length;
const row = (label, character, weapon) => {
  const coverage = getSparkCoverage(character, weapon.id, sparkIndex);
  const relevantStats = getRelevantDamageStats(weapon, character)
    .map((stat) => `${stat.label} ${stat.value}`)
    .join(" / ");
  return [
    label,
    character.name,
    classById.get(character.classId).name,
    weapon.name,
    relevantStats,
    `${coverage.sparkable} / ${coverage.total}`,
    `${getInitialWeaponLevelModifier(character, weapon) >= 0 ? "+" : ""}${getInitialWeaponLevelModifier(character, weapon)}`,
  ];
};

console.log("# 武器推薦ルール検討用・導出エビデンス表\n");
console.log("生成: `node analysis/generate-weapon-evidence.mjs`。この表はcanonicalデータに保存されず、順位も付けない。\n");
console.log("| 比較観点 | キャラクター | クラス | 武器 | 関連能力値 | 閃き | 加入時技Lv補正 |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");

for (const weapon of weapons) {
  const records = characters.map((character) => ({
    character,
    stat: score(character, weapon),
    coverage: getSparkCoverage(character, weapon.id, sparkIndex),
    offset: getInitialWeaponLevelModifier(character, weapon),
  }));
  const medianStat = median(records.map(({ stat }) => stat));
  const medianSpark = median(records.map(({ coverage }) => coverage.ratio));
  const medianOffset = median(records.map(({ offset }) => offset));
  const pick = (filter, sort) => records.filter(filter).sort(sort)[0].character;

  const cases = [
    [
      "高い関連能力値 / 低い閃き",
      pick(
        ({ stat, coverage }) => stat >= medianStat && coverage.ratio < medianSpark,
        (a, b) => b.stat - a.stat || a.coverage.ratio - b.coverage.ratio,
      ),
    ],
    [
      "高い閃き / 低い関連能力値",
      pick(
        ({ stat, coverage }) => stat < medianStat && coverage.ratio >= medianSpark,
        (a, b) => b.coverage.ratio - a.coverage.ratio || a.stat - b.stat,
      ),
    ],
    [
      "高い加入時補正 / 低い関連能力値",
      pick(
        ({ stat, offset }) => stat < medianStat && offset > medianOffset,
        (a, b) => b.offset - a.offset || a.stat - b.stat,
      ),
    ],
    [
      "高い関連能力値 / 低い加入時補正",
      pick(
        ({ stat, offset }) => stat >= medianStat && offset <= medianOffset,
        (a, b) => b.stat - a.stat || a.offset - b.offset,
      ),
    ],
  ];

  for (const [label, character] of cases) {
    console.log(`| ${row(label, character, weapon).join(" | ")} |`);
  }
}
