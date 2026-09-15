import { getStatHeatLevel } from "./logic/character.js";
import { loadGuideData } from "./logic/data.js";
import {
  getMagicRecommendations,
  getScoreHeatLevel,
  getWeaponRecommendations,
} from "./logic/recommendations.js";

const STAT_ORDER = ["str", "dex", "mag", "logic", "spd", "vit"];
const RECOMMENDATION_MIN_SCORE = 30;
const searchInput = document.querySelector("#search");
const sortButtons = [...document.querySelectorAll(".header-sort")];
const resetButton = document.querySelector("#reset");
const list = document.querySelector("#character-list");
const summary = document.querySelector("#result-summary");
const template = document.querySelector("#character-template");
let guide;
let expandedRecommendation = null;
let sortState = { key: "class", direction: "asc" };

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function formatStats(stats) {
  return stats.map(({ label, value }) => `${label}：${value}`).join("　");
}

function topThreeIncludingTies(recommendations) {
  const cutoff = recommendations[2]?.score;
  if (cutoff == null) return recommendations;
  return recommendations.filter(({ score }) => score >= cutoff - 1e-9);
}

function visibleRecommendations(recommendations, includeThirdPlaceTies = false) {
  const ranked = includeThirdPlaceTies ? topThreeIncludingTies(recommendations) : recommendations.slice(0, 3);
  return ranked.filter(({ score }) => score >= RECOMMENDATION_MIN_SCORE);
}

function points(value) {
  return Number(value.toFixed(1));
}

function placePopover(item, evidence) {
  const gap = 6;
  const edge = 8;
  const itemBounds = item.getBoundingClientRect();
  const width = evidence.offsetWidth;
  const height = evidence.offsetHeight;
  const left = Math.min(Math.max(edge, itemBounds.left), window.innerWidth - width - edge);
  let top = itemBounds.bottom + gap;
  if (top + height > window.innerHeight - edge && itemBounds.top - height - gap >= edge) {
    top = itemBounds.top - height - gap;
  }
  evidence.style.left = `${left}px`;
  evidence.style.top = `${top}px`;
}

function showPopover(item, evidence) {
  evidence.hidden = false;
  placePopover(item, evidence);
}

function appendRecommendation(container, recommendation, character) {
  const key = `${character.id}:${recommendation.weapon.id}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `recommendation-button stat-heat-${getScoreHeatLevel(recommendation.score)}`;
  button.setAttribute("aria-expanded", String(expandedRecommendation === key));
  button.textContent = recommendation.weapon.name;

  const evidence = document.createElement("div");
  evidence.className = "recommendation-evidence";
  evidence.hidden = expandedRecommendation !== key;
  evidence.innerHTML = `
    <p>${formatStats(recommendation.relevantStats)}</p>
    <p>閃き：${recommendation.sparkCoverage.sparkable} / ${recommendation.sparkCoverage.total}技</p>
    <p>加入時技Lv補正：${signed(recommendation.initialLevelModifier)}</p>
    <p class="recommendation-score">進行用スコア（独自指標）：${points(recommendation.score)} / 100</p>`;

  const item = document.createElement("div");
  item.className = "recommendation-item";
  item.append(button, evidence);

  const revealPopover = () => showPopover(item, evidence);
  const hidePopoverUnlessPinned = () => {
    if (expandedRecommendation !== key) evidence.hidden = true;
  };
  item.addEventListener("pointerenter", revealPopover);
  item.addEventListener("pointerleave", hidePopoverUnlessPinned);
  item.addEventListener("focusin", revealPopover);
  item.addEventListener("focusout", hidePopoverUnlessPinned);
  button.addEventListener("click", () => {
    expandedRecommendation = expandedRecommendation === key ? null : key;
    render();
  });
  container.append(item);
  if (expandedRecommendation === key) requestAnimationFrame(() => placePopover(item, evidence));
}

function appendMagicRecommendation(container, recommendation, character) {
  const key = `${character.id}:magic:${recommendation.school.id}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `recommendation-button stat-heat-${getScoreHeatLevel(recommendation.score)}`;
  button.setAttribute("aria-expanded", String(expandedRecommendation === key));
  button.textContent = recommendation.school.name;

  const evidence = document.createElement("div");
  evidence.className = "recommendation-evidence";
  evidence.hidden = expandedRecommendation !== key;
  evidence.innerHTML = `
    <p>${formatStats(recommendation.relevantStats)}</p>
    <p>加入時術Lv補正：${signed(recommendation.initialLevelModifier)}</p>
    <p class="recommendation-score">進行用スコア（独自指標）：${points(recommendation.score)} / 100</p>`;

  const item = document.createElement("div");
  item.className = "recommendation-item";
  item.append(button, evidence);
  const revealPopover = () => showPopover(item, evidence);
  const hidePopoverUnlessPinned = () => {
    if (expandedRecommendation !== key) evidence.hidden = true;
  };
  item.addEventListener("pointerenter", revealPopover);
  item.addEventListener("pointerleave", hidePopoverUnlessPinned);
  item.addEventListener("focusin", revealPopover);
  item.addEventListener("focusout", hidePopoverUnlessPinned);
  button.addEventListener("click", () => {
    expandedRecommendation = expandedRecommendation === key ? null : key;
    render();
  });
  container.append(item);
  if (expandedRecommendation === key) requestAnimationFrame(() => placePopover(item, evidence));
}

function appendNoRecommendation(container) {
  const empty = document.createElement("span");
  empty.className = "no-recommendation";
  empty.textContent = "—";
  container.append(empty);
}

function createRow(character) {
  const fragment = template.content.cloneNode(true);
  const classInfo = guide.classById.get(character.classId);
  fragment.querySelector(".class-name").textContent = classInfo.name;
  const name = fragment.querySelector(".character-name");
  name.textContent = character.name;
  name.href = `character.html?id=${encodeURIComponent(character.id)}`;

  for (const statId of STAT_ORDER) {
    const value = character.stats[statId];
    const heatLevel = getStatHeatLevel(statId, value, guide.characters, 16);
    const cell = fragment.querySelector(`[data-stat="${statId}"]`);
    cell.classList.add(`stat-heat-${heatLevel}`);
    cell.textContent = value;
  }
  const lpValue = fragment.querySelector(".lp-value");
  lpValue.classList.add(`stat-heat-${getStatHeatLevel("lp", character.lp, guide.characters, 16)}`);
  lpValue.textContent = character.lp;
  const recommendationArea = fragment.querySelector(".recommendations");
  const recommendations = visibleRecommendations(getWeaponRecommendations(
    character, guide.weapons, guide.sparkIndex, guide.characters,
  ));
  if (recommendations.length) {
    for (const recommendation of recommendations) appendRecommendation(recommendationArea, recommendation, character);
  } else {
    appendNoRecommendation(recommendationArea);
  }
  const magicRecommendationArea = fragment.querySelector(".magic-recommendations");
  const magicRecommendations = visibleRecommendations(getMagicRecommendations(character, guide.characters), true);
  if (magicRecommendations.length) {
    for (const recommendation of magicRecommendations) appendMagicRecommendation(magicRecommendationArea, recommendation, character);
  } else {
    appendNoRecommendation(magicRecommendationArea);
  }
  return fragment;
}

function filteredCharacters() {
  const keyword = searchInput.value.trim().toLocaleLowerCase("ja-JP");
  const characters = guide.characters.filter((character) => {
    const className = guide.classById.get(character.classId).name;
    return !keyword || `${character.name} ${className}`.toLocaleLowerCase("ja-JP").includes(keyword);
  });
  const { key: sortKey, direction } = sortState;
  const multiplier = direction === "asc" ? 1 : -1;
  return characters.sort((left, right) => {
    if (sortKey === "class") {
      const classDifference = guide.classById.get(left.classId).displayOrder - guide.classById.get(right.classId).displayOrder;
      return multiplier * (classDifference || left.classOrder - right.classOrder);
    }
    if (sortKey === "name") return multiplier * left.name.localeCompare(right.name, "ja");
    const difference = sortKey === "lp" ? left.lp - right.lp : left.stats[sortKey] - right.stats[sortKey];
    return multiplier * (difference || left.name.localeCompare(right.name, "ja"));
  });
}

function updateSortHeaders() {
  for (const button of sortButtons) {
    const active = button.dataset.sort === sortState.key;
    const arrow = active ? (sortState.direction === "asc" ? " ↑" : " ↓") : "";
    button.textContent = `${button.dataset.label}${arrow}`;
    button.closest("th").setAttribute("aria-sort", active ? (sortState.direction === "asc" ? "ascending" : "descending") : "none");
  }
}

function render() {
  const characters = filteredCharacters();
  list.replaceChildren();
  updateSortHeaders();
  summary.textContent = `${characters.length}人`;
  if (!characters.length) {
    list.innerHTML = '<tr><td class="empty" colspan="11">一致するキャラクターはいません。</td></tr>';
    return;
  }
  for (const character of characters) list.append(createRow(character));
}

try {
  guide = await loadGuideData();
  render();
  window.addEventListener("scroll", () => {
    expandedRecommendation = null;
    document.querySelectorAll(".recommendation-evidence").forEach((evidence) => { evidence.hidden = true; });
  }, { capture: true, passive: true });
  window.addEventListener("resize", () => {
    expandedRecommendation = null;
    document.querySelectorAll(".recommendation-evidence").forEach((evidence) => { evidence.hidden = true; });
  }, { passive: true });
  searchInput.addEventListener("input", render);
  for (const button of sortButtons) {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      const defaultDirection = ["class", "name"].includes(key) ? "asc" : "desc";
      sortState = sortState.key === key
        ? { key, direction: sortState.direction === "asc" ? "desc" : "asc" }
        : { key, direction: defaultDirection };
      expandedRecommendation = null;
      render();
    });
  }
  resetButton.addEventListener("click", () => {
    searchInput.value = "";
    sortState = { key: "class", direction: "asc" };
    expandedRecommendation = null;
    render();
  });
} catch (error) {
  console.error(error);
  list.innerHTML = '<tr><td class="empty" colspan="11">データを読み込めませんでした。</td></tr>';
}
