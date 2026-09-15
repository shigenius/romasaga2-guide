/** Shared character derivation functions used by both list and detail views. */

export const STAT_LABELS = Object.freeze({
  str: "腕力",
  dex: "器用さ",
  mag: "魔力",
  logic: "理力",
  spd: "素早さ",
  vit: "体力",
});

const MAGIC_SCHOOL_KEYS = Object.freeze(["fire", "water", "wind", "earth", "light", "dark"]);

function mergeCharacterOverride(character, overrides) {
  return {
    ...character,
    ...overrides,
    stats: { ...character.stats, ...(overrides.stats ?? {}) },
    initialLevelOffsets: {
      ...character.initialLevelOffsets,
      ...(overrides.initialLevelOffsets ?? {}),
    },
  };
}

/**
 * Resolves a base character plus an optional, sparse state variant.
 * Canonical data stores only the values that differ in `variant.overrides`.
 */
export function resolveCharacterState(character, stateId = null) {
  if (stateId == null) {
    return mergeCharacterOverride(character, {});
  }

  const variant = (character.variants ?? []).find(({ id }) => id === stateId);
  if (!variant) {
    throw new Error(`Unknown state '${stateId}' for ${character.id}`);
  }

  return {
    ...mergeCharacterOverride(character, variant.overrides ?? {}),
    resolvedState: { id: variant.id, name: variant.name },
  };
}

/** Returns the actual stat or stats relevant to the given weapon. */
export function getRelevantDamageStats(weapon, character) {
  return weapon.damageStatIds.map((id) => ({
    id,
    label: STAT_LABELS[id],
    value: character.stats[id],
  }));
}

/**
 * Uses the internal grouped key only for lookup. The caller displays this as
 * the evaluated weapon's joining-level modifier, never as 斬 / 突 / 殴 / 射 / 体.
 */
export function getInitialWeaponLevelModifier(character, weapon) {
  return character.initialLevelOffsets[weapon.initialLevelOffsetKey];
}

/** Magic evidence only. Ranking/effectiveness formulas remain intentionally unimplemented. */
export function getMagicEvidence(character) {
  return {
    stats: [
      { id: "mag", label: STAT_LABELS.mag, value: character.stats.mag },
      { id: "logic", label: STAT_LABELS.logic, value: character.stats.logic },
    ],
    initialLevelModifiers: MAGIC_SCHOOL_KEYS.map((id) => ({
      id,
      value: character.initialLevelOffsets[id],
    })),
  };
}

/**
 * Creates distribution-dependent heat levels. A level is a percentile bucket
 * in the supplied real character dataset, so no absolute stat cutoff is baked in.
 */
export function getStatHeatLevel(statId, value, characters, bucketCount = 5) {
  const values = characters
    .map((character) => statId === "lp" ? character.lp : character.stats[statId])
    .sort((a, b) => a - b);
  if (!values.length) throw new Error("Cannot calculate a heat level from an empty character list");

  if (statId === "lp") {
    // Coppelia's LP 99 is the single maximum and would flatten the ordinary
    // 1–28 range in a value-based heat map. Spread ordinary LP values across
    // the palette, while still saturating that exceptional maximum at red.
    const ordinaryMaximum = values.at(-2) ?? values.at(-1);
    const minimum = values[0];
    const clampedValue = Math.min(value, ordinaryMaximum);
    const ratio = ordinaryMaximum === minimum ? 1 : (clampedValue - minimum) / (ordinaryMaximum - minimum);
    return Math.min(bucketCount, Math.max(1, Math.floor(ratio * (bucketCount - 1)) + 1));
  }

  const atOrBelow = values.filter((candidate) => candidate <= value).length;
  return Math.min(bucketCount, Math.max(1, Math.ceil((atOrBelow / values.length) * bucketCount)));
}
