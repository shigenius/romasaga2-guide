import { createSparkIndex } from "./spark.js";

/** Loads the canonical package once and builds only in-memory lookup indexes. */
export async function loadGuideData(dataBaseUrl = new URL("../../", import.meta.url)) {
  const load = async (filename) => {
    const response = await fetch(new URL(filename, dataBaseUrl));
    if (!response.ok) throw new Error(`Could not load ${filename}: ${response.status}`);
    return response.json();
  };

  const [charactersFile, classesFile, weaponsFile, techniquesFile, sparkTypesFile, sourcesFile] = await Promise.all([
    load("characters.json"),
    load("classes.json"),
    load("weapons.json"),
    load("techniques.json"),
    load("spark_types.json"),
    load("sources.json"),
  ]);

  return {
    characters: charactersFile.characters,
    classes: classesFile.classes,
    weapons: weaponsFile.weapons,
    techniques: techniquesFile.techniques,
    sparkTypes: sparkTypesFile.sparkTypes,
    sources: sourcesFile.sources,
    classById: new Map(classesFile.classes.map((item) => [item.id, item])),
    weaponById: new Map(weaponsFile.weapons.map((item) => [item.id, item])),
    sparkIndex: createSparkIndex({
      techniques: techniquesFile.techniques,
      sparkTypes: sparkTypesFile.sparkTypes,
    }),
  };
}
