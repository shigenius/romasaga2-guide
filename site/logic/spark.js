/** Shared spark-coverage derivation. No counts or ratios are persisted. */

export function createSparkIndex({ techniques, sparkTypes }) {
  return {
    techniqueById: new Map(techniques.map((technique) => [technique.id, technique])),
    sparkTypeById: new Map(sparkTypes.map((sparkType) => [sparkType.id, sparkType])),
    sparkTypes,
  };
}

export function getSparkCoverage(character, weaponId, index) {
  const sparkType = index.sparkTypeById.get(character.sparkTypeId);
  if (!sparkType) throw new Error(`Unknown spark type '${character.sparkTypeId}'`);

  const techniqueMatchesWeapon = (techniqueId) => {
    const technique = index.techniqueById.get(techniqueId);
    if (!technique) throw new Error(`Unknown technique '${techniqueId}'`);
    return technique.weaponId === weaponId;
  };

  const ownTechniqueIds = new Set(sparkType.techniqueIds.filter(techniqueMatchesWeapon));
  const allTechniqueIds = new Set(
    index.sparkTypes.flatMap((type) => type.techniqueIds.filter(techniqueMatchesWeapon)),
  );

  return {
    sparkable: ownTechniqueIds.size,
    total: allTechniqueIds.size,
    ratio: allTechniqueIds.size ? ownTechniqueIds.size / allTechniqueIds.size : null,
  };
}
