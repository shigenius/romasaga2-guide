#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def load(name):
    with (ROOT / name).open(encoding="utf-8") as f:
        return json.load(f)

characters = load("characters.json")["characters"]
classes = load("classes.json")["classes"]
weapons = load("weapons.json")["weapons"]
techniques = load("techniques.json")["techniques"]
spark_types = load("spark_types.json")["sparkTypes"]
sources = load("sources.json")["sources"]

def unique(values, label):
    values = list(values)
    assert len(values) == len(set(values)), f"duplicate {label}"

unique((c["id"] for c in characters), "character id")
unique((c["name"] for c in characters), "character name")
unique((c["id"] for c in classes), "class id")
unique((w["id"] for w in weapons), "weapon id")
unique((t["id"] for t in techniques), "technique id")
unique((s["id"] for s in spark_types), "spark type id")
unique((s["id"] for s in sources), "source id")

class_ids = {c["id"] for c in classes}
weapon_ids = {w["id"] for w in weapons}
technique_by_id = {t["id"]: t for t in techniques}
spark_by_id = {s["id"]: s for s in spark_types}
source_ids = {s["id"] for s in sources}
stat_ids = {"str", "dex", "mag", "logic", "spd", "vit"}
level_offset_ids = {
    "slash", "stab", "bash", "shoot", "martial",
    "fire", "water", "wind", "earth", "light", "dark",
}

for w in weapons:
    assert w.get("damageStatIds"), (w["id"], "missing damageStatIds")
    assert set(w["damageStatIds"]) <= stat_ids, (w["id"], w["damageStatIds"])
    assert w.get("initialLevelOffsetKey") in level_offset_ids, (w["id"], "invalid initialLevelOffsetKey")

for c in characters:
    assert c["classId"] in class_ids, (c["id"], c["classId"])
    assert c["sparkTypeId"] in spark_by_id, (c["id"], c["sparkTypeId"])
    assert set(c["provenance"]) <= source_ids, (c["id"], c["provenance"])
    assert set(c["stats"]) == stat_ids, (c["id"], "unexpected stats")
    assert set(c["initialLevelOffsets"]) == level_offset_ids, (c["id"], "unexpected initial level offsets")
    for variant in c.get("variants", []):
        spark = variant.get("overrides", {}).get("sparkTypeId")
        if spark is not None:
            assert spark in spark_by_id, (c["id"], variant["id"], spark)
        assert set(variant.get("provenance", [])) <= source_ids

for t in techniques:
    assert t["weaponId"] in weapon_ids, (t["id"], t["weaponId"])
    assert set(t["provenance"]) <= source_ids

for s in spark_types:
    missing = [tid for tid in s["techniqueIds"] if tid not in technique_by_id]
    assert not missing, (s["id"], missing)
    assert set(s["provenance"]) <= source_ids

def spark_coverage(character_id, weapon_id):
    """Derived every call; result is deliberately not persisted."""
    char = next(c for c in characters if c["id"] == character_id)
    spark = spark_by_id[char["sparkTypeId"]]

    # A technique belongs to the sparkable universe only if at least one
    # canonical spark type contains it. Normal attacks/non-spark techniques
    # therefore do not inflate the denominator.
    universe_ids = {
        tid
        for st in spark_types
        for tid in st["techniqueIds"]
        if technique_by_id[tid]["weaponId"] == weapon_id
    }
    own_ids = {
        tid
        for tid in spark["techniqueIds"]
        if technique_by_id[tid]["weaponId"] == weapon_id
    }
    return {
        "sparkable": len(own_ids),
        "total": len(universe_ids),
        "ratio": (len(own_ids) / len(universe_ids)) if universe_ids else None,
    }

print("validation: OK")
print("characters:", len(characters))
print("  standard classes:", sum(c["edition"] == "sfc_remaster_common" and c["classId"] != "special" for c in characters))
print("  remaster added:", sum(c["edition"] == "remaster_added" for c in characters))
print("  unique:", sum(c["classId"] == "special" for c in characters))
print("classes:", len(classes))
print("techniques:", len(techniques))
print("spark types:", len(spark_types))
print("example(dynamic only) Jubei/greatsword:", spark_coverage("base-112", "greatsword"))
