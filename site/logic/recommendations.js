import {
  getInitialWeaponLevelModifier,
  getRelevantDamageStats,
} from "./character.js";
import { getSparkCoverage } from "./spark.js";

const SCORE_EXPONENTS = Object.freeze({
  ability: 0.25,
  initialLevel: 0.45,
  sparkCoverage: 0.30,
});

const INITIAL_LEVEL_SUITABILITY = Object.freeze([
  [-7, 0.10],
  [-3, 0.25],
  [0, 0.45],
  [1, 0.55],
  [5, 0.75],
  [15, 1.00],
]);

const MAGIC_SCHOOLS = Object.freeze([
  { id: "fire", name: "火" },
  { id: "water", name: "水" },
  { id: "wind", name: "風" },
  { id: "earth", name: "地" },
  { id: "light", name: "天" },
  { id: "dark", name: "冥" },
]);

// A shared, comparison-only situation for Martial Arts aptitude. It uses the
// SFC formula's stat-dependent terms at Martial Arts Lv20 and tech power 10;
// defense and random variation are intentionally omitted because they are the
// same for every character in this aptitude comparison.
const MARTIAL_STANDARD = Object.freeze({ level: 20, techPower: 10 });

function percentile(statId, value, characters) {
  const atOrBelow = characters.filter((character) => character.stats[statId] <= value).length;
  return atOrBelow / characters.length;
}

function martialCoefficient(level) {
  return Math.floor((2500 - (49 - level) ** 2) / 128) + Math.floor(level / 4);
}

function martialStatValue(str, spd) {
  const { level, techPower } = MARTIAL_STANDARD;
  const coefficient = martialCoefficient(level);
  return (coefficient * (str + spd) * (techPower - 1)) / 8
    + Math.max(str - 10, 0) * (coefficient + techPower);
}

function statPercentile(relevantStats, characters) {
  const values = relevantStats.map(({ id, value }) => percentile(id, value, characters));
  if (relevantStats.length === 1) return values[0];

  const [str, spd] = relevantStats.map(({ value }) => value);
  const value = martialStatValue(str, spd);
  const atOrBelow = characters.filter((character) =>
    martialStatValue(character.stats.str, character.stats.spd) <= value,
  ).length;
  return atOrBelow / characters.length;
}

export function getInitialLevelSuitability(modifier) {
  const first = INITIAL_LEVEL_SUITABILITY[0];
  const last = INITIAL_LEVEL_SUITABILITY.at(-1);
  if (modifier <= first[0]) return first[1];
  if (modifier >= last[0]) return last[1];

  for (let index = 1; index < INITIAL_LEVEL_SUITABILITY.length; index += 1) {
    const [upperModifier, upperSuitability] = INITIAL_LEVEL_SUITABILITY[index];
    if (modifier > upperModifier) continue;
    const [lowerModifier, lowerSuitability] = INITIAL_LEVEL_SUITABILITY[index - 1];
    const ratio = (modifier - lowerModifier) / (upperModifier - lowerModifier);
    return lowerSuitability + (upperSuitability - lowerSuitability) * ratio;
  }
  throw new Error("Unable to derive joining-level suitability");
}

/**
 * Derives a non-compensatory road-progression score from canonical data.
 * A weak joining level or a narrow spark pool pulls the whole score down;
 * high relevant stats cannot simply cancel either shortcoming. This is not an
 * end-game damage calculation with fully trained skill levels and equipment.
 */
export function getWeaponScore({ relevantStats, initialLevelModifier, sparkCoverage }, context) {
  const abilityPercentile = statPercentile(relevantStats, context.characters);
  const coverageRatio = sparkCoverage.ratio ?? 0;
  const factors = {
    ability: abilityPercentile,
    initialLevel: getInitialLevelSuitability(initialLevelModifier),
    sparkCoverage: coverageRatio ** 1.5,
  };
  const score = 100 * factors.ability ** SCORE_EXPONENTS.ability
    * factors.initialLevel ** SCORE_EXPONENTS.initialLevel
    * factors.sparkCoverage ** SCORE_EXPONENTS.sparkCoverage;
  return {
    score,
    factors,
    abilityPercentile,
  };
}

/** Score is primary; sparkable count only makes equal scores stable. */
export function compareWeaponEvidence(left, right) {
  if (right.score !== left.score) return right.score - left.score;
  if (right.sparkCoverage.sparkable !== left.sparkCoverage.sparkable) {
    return right.sparkCoverage.sparkable - left.sparkCoverage.sparkable;
  }
  return left.weapon.id.localeCompare(right.weapon.id);
}

export function getWeaponCapability(character, weapon, characters) {
  const relevantStats = getRelevantDamageStats(weapon, character);
  const abilityPercentile = statPercentile(relevantStats, characters);
  return {
    relevantStats,
    abilityPercentile,
    capabilityBand: Math.max(1, Math.ceil(abilityPercentile * 5)),
    visualHeatLevel: Math.max(1, Math.ceil(abilityPercentile * 16)),
  };
}

/** Converts a 0–100 road score to the existing sixteen-step heat-map scale. */
export function getScoreHeatLevel(score, bucketCount = 16) {
  return Math.min(bucketCount, Math.max(1, Math.ceil((score / 100) * bucketCount)));
}

export function getWeaponRecommendations(character, weapons, sparkIndex, characters) {
  if (!characters?.length) throw new Error("A character population is required to derive capability bands");
  const context = { characters };
  return weapons
    .map((weapon) => {
      const capability = getWeaponCapability(character, weapon, characters);
      const sparkCoverage = getSparkCoverage(character, weapon.id, sparkIndex);
      const initialLevelModifier = getInitialWeaponLevelModifier(character, weapon);
      return {
        weapon,
        ...capability,
        sparkCoverage,
        initialLevelModifier,
        ...getWeaponScore({
          relevantStats: capability.relevantStats,
          initialLevelModifier,
          sparkCoverage,
        }, context),
      };
    })
    .sort(compareWeaponEvidence)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
}

function normalMagicPower(character) {
  const { mag, logic } = character.stats;
  return mag + 2 * Math.max(mag - logic, 0);
}

function darkMagicPower(character) {
  return character.stats.logic * 2;
}

function magicAbilityPercentile(character, schoolId, characters) {
  const power = schoolId === "dark" ? darkMagicPower : normalMagicPower;
  const characterPower = power(character);
  const atOrBelow = characters.filter((candidate) => power(candidate) <= characterPower).length;
  return { value: characterPower, percentile: atOrBelow / characters.length };
}

/**
 * Ranks schools for road progression. Non-dark schools use the normal spell
 * power formula; Dark uses its distinct Logic-based formula. There is no
 * spark factor for spells, so aptitude and joining spell level are multiplied.
 */
export function getMagicRecommendations(character, characters) {
  if (!characters?.length) throw new Error("A character population is required to derive magic aptitude");
  return MAGIC_SCHOOLS
    .map((school, order) => {
      const initialLevelModifier = character.initialLevelOffsets[school.id];
      const ability = magicAbilityPercentile(character, school.id, characters);
      const factors = {
        ability: ability.percentile,
        initialLevel: getInitialLevelSuitability(initialLevelModifier),
      };
      const score = 100 * factors.ability ** 0.55 * factors.initialLevel ** 0.45;
      return {
        school,
        order,
        relevantStats: school.id === "dark"
          ? [{ id: "logic", label: "理力", value: character.stats.logic }]
          : [
            { id: "mag", label: "魔力", value: character.stats.mag },
            { id: "logic", label: "理力", value: character.stats.logic },
            { id: "spellPower", label: "術威力", value: ability.value },
          ],
        abilityValue: ability.value,
        initialLevelModifier,
        factors,
        score,
      };
    })
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
}
