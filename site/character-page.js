import {
  getStatHeatLevel,
  resolveCharacterState,
  STAT_LABELS,
} from "./logic/character.js";
import { loadGuideData } from "./logic/data.js";
import { getMagicRecommendations, getWeaponRecommendations } from "./logic/recommendations.js";

const STAT_ORDER = ["str", "dex", "mag", "logic", "spd", "vit"];
const detail = document.querySelector("#character-detail");
const pageTitle = document.querySelector("#page-title");

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function statText(stats) {
  return stats.map(({ label, value }) => `${label} ${value}`).join("　");
}

function points(value) {
  return Number(value.toFixed(1));
}

function createStats(character, characters) {
  const grid = document.createElement("dl");
  grid.className = "stat-grid detail-stats";
  const lp = document.createElement("div");
  lp.className = `stat stat-heat-${getStatHeatLevel("lp", character.lp, characters, 16)}`;
  lp.innerHTML = `<dt>LP</dt><dd>${character.lp}</dd>`;
  grid.append(lp);
  for (const statId of STAT_ORDER) {
    const value = character.stats[statId];
    const item = document.createElement("div");
    item.className = `stat stat-heat-${getStatHeatLevel(statId, value, characters, 16)}`;
    item.innerHTML = `<dt>${STAT_LABELS[statId]}</dt><dd>${value}</dd>`;
    grid.append(item);
  }
  return grid;
}

function createWeaponRecommendations(character, guide) {
  const section = document.createElement("section");
  section.className = "detail-section";
  section.innerHTML = "<h2>おすすめ武器</h2>";
  const list = document.createElement("ol");
  list.className = "detail-recommendations";
  for (const recommendation of getWeaponRecommendations(character, guide.weapons, guide.sparkIndex, guide.characters)) {
    const item = document.createElement("li");
    item.innerHTML = `
      <h3>${recommendation.weapon.name}</h3>
      <p>${statText(recommendation.relevantStats)}</p>
      <p>閃き：${recommendation.sparkCoverage.sparkable} / ${recommendation.sparkCoverage.total}技</p>
      <p>加入時技Lv補正：${signed(recommendation.initialLevelModifier)}</p>
      <p class="detail-score">進行用スコア（独自指標）：${points(recommendation.score)} / 100</p>`;
    list.append(item);
  }
  section.append(list);
  return section;
}

function createMagicRecommendations(character, guide) {
  const section = document.createElement("section");
  section.className = "detail-section";
  section.innerHTML = "<h2>おすすめ術</h2>";
  const list = document.createElement("ol");
  list.className = "detail-recommendations";
  for (const recommendation of getMagicRecommendations(character, guide.characters)) {
    const item = document.createElement("li");
    item.innerHTML = `
      <h3>${recommendation.school.name}</h3>
      <p>${statText(recommendation.relevantStats)}</p>
      <p>加入時術Lv補正：${signed(recommendation.initialLevelModifier)}</p>
      <p class="detail-score">進行用スコア（独自指標）：${points(recommendation.score)} / 100</p>`;
    list.append(item);
  }
  section.append(list);
  return section;
}

function createSources(character, guide) {
  const section = document.createElement("section");
  section.className = "detail-section sources";
  section.innerHTML = "<h2>出典</h2>";
  const list = document.createElement("ul");
  for (const sourceId of character.provenance) {
    const source = guide.sources.find(({ id }) => id === sourceId);
    if (!source) continue;
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = source.url;
    link.textContent = source.name;
    link.target = "_blank";
    link.rel = "noreferrer";
    item.append(link);
    list.append(item);
  }
  section.append(list);
  return section;
}

function createStateChooser(baseCharacter, selectedState) {
  if (!baseCharacter.variants?.length) return null;
  const label = document.createElement("label");
  label.className = "state-select";
  label.textContent = "状態";
  const select = document.createElement("select");
  select.innerHTML = `<option value="">通常</option>${baseCharacter.variants.map(({ id, name }) => `<option value="${id}">${name}</option>`).join("")}`;
  select.value = selectedState ?? "";
  select.addEventListener("change", () => {
    const query = new URLSearchParams({ id: baseCharacter.id });
    if (select.value) query.set("state", select.value);
    window.location.search = query;
  });
  label.append(select);
  return label;
}

async function render() {
  const guide = await loadGuideData();
  const query = new URLSearchParams(window.location.search);
  const baseCharacter = guide.characters.find(({ id }) => id === query.get("id"));
  if (!baseCharacter) {
    detail.innerHTML = '<p class="empty">キャラクターが見つかりません。</p>';
    return;
  }
  const stateId = query.get("state") || null;
  const character = resolveCharacterState(baseCharacter, stateId);
  const classInfo = guide.classById.get(character.classId);
  const sparkType = guide.sparkIndex.sparkTypeById.get(character.sparkTypeId);
  pageTitle.textContent = character.resolvedState?.name ?? character.name;
  document.title = `${pageTitle.textContent} · RS2 キャラクターガイド`;
  detail.replaceChildren();

  const heading = document.createElement("section");
  heading.className = "detail-heading";
  heading.innerHTML = `<p class="class-name">${classInfo.name}</p><h2>${pageTitle.textContent}</h2>`;
  const chooser = createStateChooser(baseCharacter, stateId);
  if (chooser) heading.append(chooser);
  detail.append(heading);

  const statSection = document.createElement("section");
  statSection.className = "detail-section";
  statSection.innerHTML = "<h2>能力値</h2>";
  statSection.append(createStats(character, guide.characters));
  detail.append(statSection, createWeaponRecommendations(character, guide), createMagicRecommendations(character, guide));

  const spark = document.createElement("section");
  spark.className = "detail-section";
  spark.innerHTML = `<h2>閃きタイプ</h2><p class="magic-detail">${sparkType.sourceLabel ?? sparkType.id}</p>`;
  detail.append(spark, createSources(baseCharacter, guide));
}

render().catch((error) => {
  console.error(error);
  detail.innerHTML = '<p class="empty">データを読み込めませんでした。</p>';
});
