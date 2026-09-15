# 共有導出ロジック

ここは一覧・詳細ページが共通で使うブラウザESモジュールです。canonical JSONは親ディレクトリに一度だけ置き、ここでは導出値を保存しません。

- `logic/character.js` — 状態差分の解決、武器の関連能力値、加入時技Lv補正、能力値ヒートマップ
- `logic/spark.js` — 閃き可能数・総数・比率の都度計算
- `logic/data.js` — canonical JSONの読込とメモリ上の索引化
- `logic/recommendations.js` — 道中向けの武器・術スコアを導出。武器は能力値・加入時技Lv・閃き率、術は術向け能力値・加入時術Lvを掛け合わせる

スコアは加入後から道中で使いやすい系統の独自指標です。式・表示の足切り・体術／術の参照値は `site/formula.html` に記載しています。最終装備・十分な技Lv・敵防御を固定した実ダメージ順位ではありません。

検証はプロジェクトルートで次を実行します。

```bash
python3 validate_data.py
node site/logic/character.test.mjs
```
