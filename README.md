# RS2 Guide Data

ロマンシング サ・ガ2（SFC／リマスター）向け個人用キャラクターガイドの **canonical data / Single Source of Truth** 候補です。

## 方針

- 元データは `characters.json` / `spark_types.json` / `techniques.json` / `classes.json` / `weapons.json` に一度だけ保持します。
- 閃き可能数・割合、おすすめ順位、おすすめ理由、能力値の段階表示など **計算で導ける値は保存しません**。
- 一覧画面と詳細画面は、将来同じデータと同じ計算関数を参照します。
- 状態違いは基礎キャラを複製せず、差分だけ `variants[].overrides` に保持します。
- 攻略サイト間で値が食い違った場合、勝手に平均・補間せず `validation_report.json` に記録します。
- 技名は内部計算用に保持しますが、ガイドUIで表示するかどうかは別問題です。現方針では閃き技の具体名を一覧には出しません。

## ファイル

- `characters.json` — キャラクターのLP、基礎能力値、加入時Lv補正、閃きタイプID
- `classes.json` — クラス名と表示順
- `weapons.json` — 武器種ID・名称・対応するダメージ関連能力値・加入時Lv補正の内部参照キー
- `techniques.json` — 技ID、名称、武器種など（閃き計算の元データ）
- `spark_types.json` — 閃きタイプと閃き可能技IDの集合
- `sources.json` — 出典と収集範囲
- `validation_report.json` — 出典間の既知の不一致・命名上の注意
- `validate_data.py` — 参照整合性を毎回計算して検証するスクリプト
- `site/` — canonical JSONを読み込む静的サイト。`index.html` は一覧、`character.html?id=<character-id>` は再利用する詳細テンプレート
- `analysis/` — 推薦ルール検討用の、一時的な導出表ジェネレーター

## `characters.json` の主要フィールド

```text
id
name
classId
classOrder
edition
lp
stats.str
stats.dex
stats.mag
stats.logic   # 理力
stats.spd
stats.vit
initialLevelOffsets.slash
initialLevelOffsets.stab
initialLevelOffsets.bash
initialLevelOffsets.shoot
initialLevelOffsets.martial
initialLevelOffsets.fire
initialLevelOffsets.water
initialLevelOffsets.wind
initialLevelOffsets.earth
initialLevelOffsets.light
initialLevelOffsets.dark
sparkTypeId
provenance
variants[]    # 必要なキャラのみ。基礎値との差分だけ。
```

`slash/stab/bash/shoot/martial` は内部データとして加入時Lv計算に必要なため保持しますが、ガイドUIに「斬・突・殴…」として表示する想定はありません。

`weapons.json` の `damageStatIds` と `initialLevelOffsetKey` は、各武器を評価するときにどのcanonical値を読むかを定義する機械データです。表示側はこのキー名を露出せず、武器名と実際の能力値・加入時技Lv補正だけを表示します。

## 閃き可能数の算出

`11/12` のような件数はどこにも保存しません。

1. キャラの `sparkTypeId` を読む
2. `spark_types.json` から `techniqueIds` を得る
3. `techniques.json` で武器種を絞る
4. 分母も、全閃きタイプの `techniqueIds` の和集合から同じ武器種だけを抽出して、その場で数える

このため、閃きタイプ側の技集合を直せば一覧・詳細の計算結果も同時に変わります。

## 収集上の注意

リマスター追加の陰陽師「ナカマロ」は、腕力・器用さが資料間で割れています。GameCenterGX／AppMedia と、攻略の手引き／Taumax／romasaga2apli Wiki が異なる値を掲載しています。canonical 値は後者3資料が一致する側を採用し、反対側の観測値は `validation_report.json` にだけ記録しています。

また「体術A/B」の呼び方は攻略サイト間で対応が揺れるため、内部IDでは `martial_1` / `martial_2` を使い、A/Bという表示名を固定していません。

## 検証

```bash
python validate_data.py
```

参照切れ、重複ID、閃きタイプから存在しない技への参照、キャラクター数などを実データから都度計算します。
