# 株式会社オールライト コーポレートサイト

公共工事（電気設備工事）をメインに、**発注者からの信頼**と**施工管理の採用**を最大化するために設計した、フルSEO対応のコーポレートサイトです。

- コンセプト：**「公共工事で、まちに光を灯す。」** — 発注者に信頼される公共性 × 採用ページの“ブチアゲ”熱量
- 技術：静的HTML + TailwindCSS(CDN) + Noto Serif/Sans JP。ビルド不要でそのまま公開可能（ブログ自動連携のみ Node を使用）
- ホスティング想定：Netlify（お問い合わせは Netlify Forms、`action="/thanks.html"`）

---

## 🎯 このサイトで最大限アピールしていること（ご要望への対応）

| ご要望 | 対応箇所 |
|---|---|
| 公共工事を全国でしていることをアピール | 全ページのコピー／トップのヒーロー・信頼バー／`about`の沿革（全国展開）|
| 発注者への信頼感（検索されたときに信頼される） | 落ち着いたネイビー×ゴールド、構造化データ、`works`の工事の流れ |
| 工事点数（工事成績評定点）をアピール | トップ「数字で見る」／`works`の評定点セクション／ブログ解説記事 |
| 入札本数をアピール | トップ・`works`の「年間入札参加本数」カウンター |
| 社内体制をアピール | `about`「積算〜書類まで自社一気通貫」セクション |
| 採用ページ（施工管理をめちゃ推す。工事士も募集） | `recruit.html`（施工管理をイチオシ表示、電気工事士も同時募集）|
| ブチアゲをテーマに | 採用ページ・CTAの `bg-hype` / `hype-title` 演出 |
| 社内SNSアプリ → ブログ自動アップロードでSEO | `blog/` + `scripts/generate-blog.mjs` + GitHub Actions（下記）|

---

## 📁 ファイル構成

```
alllight-website/
├─ index.html              トップ（公共工事アピール中心）
├─ about.html              会社案内・社内体制
├─ works.html              公共工事実績・工事点数・施工の流れ
├─ recruit.html            採用（施工管理 大募集／ブチアゲ）
├─ contact.html            お問い合わせ（Netlify Forms・種別4区分・地図）
├─ thanks.html             送信完了
├─ 404.html
├─ robots.txt / sitemap.xml
├─ netlify.toml            Netlifyビルド設定
├─ assets/
│  ├─ site.css             ブランドCSS（カラー・演出・記事スタイル）
│  └─ site.js              メニュー/スクロール演出/数字カウント/実績フィルタ
├─ blog/
│  ├─ index.html           ブログ一覧（コラム＋現場レポート自動枠）
│  ├─ koukyou-kouji-denki-setsubi.html   コラム①公共工事の電気設備工事
│  ├─ koujiseiseki-hyoutei.html          コラム②工事成績評定点（工事点数）
│  └─ sekou-kanri-miryoku.html           コラム③施工管理の仕事
├─ area/                   ★地域SEOページ（自動生成）神戸市・明石市…＋エリアハブ
├─ data/
│  ├─ areas.json           地域ページの元データ（自治体を足すとページが増える）
│  └─ instagram.json       Instagram投稿データ（自動更新＋フォールバック）
├─ scripts/
│  ├─ generate-seo-pages.mjs  ★地域ページ生成＋Instagram差し込み
│  ├─ generate-blog.mjs       社内アプリ→ブログ自動生成＋サイトマップ
│  └─ fetch-instagram.mjs     Instagram Graph API取得
├─ supabase/migrations/
│  └─ 0001_blog_posts.sql  公開用テーブル定義（要適用）
└─ .github/workflows/
   └─ blog-sync.yml        自動連携ワークフロー（ビルド＝地域＋IG＋ブログ）
```

---

## ✅ 公開前に差し替える項目（重要）

デザイン・文章は完成しています。**以下の「仮の値」を正式値に差し替えてから公開**してください。
`※差し替え` コメントや `XXXXXX` を検索すると該当箇所が見つかります。

- [ ] **建設業許可番号**（全ページのフッター：`第XXXXXX号`）
- [ ] **電話番号**（`078-000-0000` → 実番号）
- [ ] **数字**（工事成績評定点・年間入札本数・施工実績件数・有資格者数・完成工事高）
      → `index.html` / `works.html` / `recruit.html` の `data-count="..."`
- [ ] **従業員数**（`about.html`：15名 → 実数）
- [ ] **経営事項審査の評点・ランク**（`about.html`）
- [ ] **施工実績の案件**（`works.html`：案件名・発注者・年度・工種）
- [ ] **社員インタビュー**（`recruit.html`：写真・氏名・コメント）
- [ ] **代表写真**（`about.html`）
- [ ] **給与・待遇**（`recruit.html`：月給・年収）
- [ ] **画像**：現在は Unsplash のイメージ写真。自社の現場写真に差し替えると信頼感・SEOともに向上します。
- [ ] **OGP画像**：`assets/ogp.jpg` / `assets/ogp-recruit.jpg` / `assets/logo.png` を用意

> ⚠️ 工事成績評定点・入札本数・施工実績は、発注者が見る重要な信頼情報です。**必ず実績に基づく正確な数値**に差し替えてください（現状は表示サンプルです）。

---

## 🔍 SEO 設計（実装済み）

- 各ページ固有の `title` / `meta description` / `canonical` / OGP・Twitterカード
- 構造化データ（JSON-LD）：`GeneralContractor/ElectricalContractor/LocalBusiness`、`WebSite`、`BreadcrumbList`、`JobPosting`（採用）、`Article`（ブログ）
- 見出し階層（h1→h2→h3）とセマンティックHTML、パンくず
- `sitemap.xml` / `robots.txt`
- 内部リンク設計（トップ→実績・採用・ブログ、記事間の関連リンク）
- 表示速度：CDN・`preconnect`・画像 `loading="lazy"`

### 想定キーワード（発注者・求職者）
`公共工事 電気工事 / 官公庁 電気設備工事 / 電気設備工事 施工管理 求人 神戸 / 入札 電気工事 実績 / 工事成績評定点 / LED照明改修 公共施設`

### 公開後にやること
1. **Google Search Console** に `alllight2018.com` を登録し、`sitemap.xml` を送信
2. **Googleビジネスプロフィール**（MEO）を整備（所在地・電話・写真）
3. コラムを月1〜2本追加（下の自動連携＋手動記事の両輪で更新頻度を確保）

---

## 🔄 社内アプリ → ブログ 自動連携（SEO対策）

社内アプリ（Supabase: `keiei-os`）で書いた投稿のうち、**「Webに公開」に設定したものだけ**を、自動でブログ記事化して公開します。

> 🔒 **安全設計**：財務・従業員・案件明細などの内部データは**一切公開しません**。公開対象は専用テーブル `blog_posts` の `is_public = true` の行のみ。RLS（行レベルセキュリティ）でも二重に保護し、本文はデフォルトでHTMLエスケープします。

### セットアップ手順

1. **公開用テーブルを作成**
   `supabase/migrations/0001_blog_posts.sql` を Supabase（keiei-os）に適用します。
   ```bash
   supabase db push          # CLIの場合
   # もしくは Supabase ダッシュボードのSQL Editorに貼り付けて実行
   ```
2. **社内アプリに「Webに公開」導線を追加**
   投稿を公開したいとき、`blog_posts` に以下を INSERT/UPSERT（`is_public=true`）します。
   `slug`（英数ハイフン）, `title`, `excerpt`, `body`, `cover_image_url`, `category`, `published_at`
   （site_reports から流すSQL例は migration ファイル末尾のコメント参照）
3. **環境変数を設定**（GitHub Secrets / Netlify 環境変数）
   - `SUPABASE_URL`（例：`https://brlvorktqvnoajyycxfy.supabase.co`）
   - `SUPABASE_ANON_KEY`（anonキーでOK。RLSで公開行のみ取得されます）
4. **自動生成の実行**
   - ローカル：`SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run build:blog`
   - 自動：`.github/workflows/blog-sync.yml` が **6時間ごと**に実行。
     即時反映したい場合は、Supabase の Database Webhook / Edge Function から
     GitHub の `repository_dispatch`（type: `blog-updated`）を叩くと数十秒で公開されます。
   - Netlifyのビルドコマンド（`npm run build:blog`）でも生成されます。

### スクリプトが行うこと
- `blog_posts`（is_public=true）を取得 → `blog/report-<slug>.html` を生成
- `blog/index.html` の「現場レポート」枠を再構築
- `sitemap.xml` を再生成（新記事を検索エンジンへ通知）

> 認証情報が無い環境ではブログ生成をスキップし、ビルドは正常終了します（サイト自体は静的に動作）。

---

## 🚀 デプロイ

### Netlify（推奨）
1. このリポジトリを Netlify に接続
2. Build command：`npm run build:blog` ／ Publish directory：`.`
3. 環境変数 `SUPABASE_URL` / `SUPABASE_ANON_KEY` を設定（任意）
4. Forms：`contact.html` は Netlify Forms 対応済み（`data-netlify="true"`）。
   通知先メールは Netlify管理画面 → Forms から設定してください。

### そのまま静的公開でもOK
Node を使わない場合、HTMLファイル群をそのままサーバーへアップロードするだけで動作します
（ブログ自動連携のみ Node が必要）。

---

## 🥇 対ライバル戦略：東洋電気工事に検索で勝つ（自動化）

同じ神戸市兵庫区の競合 **東洋電気工事（to-tec.com）** を、同じ商圏のキーワードで上回るための設計です。
考え方は **お手本＝小田島組（岩手）** に学び、「コンテンツ量 × 鮮度 × 人の発信」で面を取ります。

| 施策 | 実装 | なぜ勝てるか |
|---|---|---|
| **地域ページの面制圧** | `data/areas.json` → `scripts/generate-seo-pages.mjs` が `area/<市区>.html` を自動生成（**現在25ページ**：神戸市9区＋兵庫県16市） | 競合が1枚の会社サイトなのに対し、「神戸市兵庫区 電気工事」「明石市 公共工事」等をページ単位で網羅。ライバル本拠地=兵庫区もピンポイントで狙う |
| **サービス別ページ** | `data/services.json` → `service/<工種>.html`（6ページ：電気設備/受変電/LED/内線/防災弱電/空調） | 「受変電 工事 神戸」「LED改修 兵庫」等の工種×地域を面で獲得。地域ページと相互リンク |
| **高意図ブログ** | 電気工事会社の選び方/入札の参加方法/キュービクル更新費用/施工管理は未経験できつい？等 | 検索意図の強いワードで指名・比較検討・採用の流入を獲得 |
| **FAQ構造化データ** | 各地域ページに `FAQPage` / 地域 `ElectricalContractor` schema | 検索結果でFAQリッチリザルト・地図表示を狙える |
| **コンテンツ鮮度** | 社内アプリ→ブログ自動連携（6時間ごと） | 更新頻度でGoogleの評価を継続的に獲得。競合は静的で更新が止まりがち |
| **Instagram連携** | `@alllight2018` をトップ・採用に埋め込み（`data/instagram.json`） | 「人が主役」の発信＝小田島組式。指名検索・回遊・採用に効く |
| **採用×地域×職種** | 地域ページ・採用ページ・JobPosting schema を相互リンク | 「電気工事 求人 神戸」「施工管理 求人 兵庫」で採用流入を獲得 |
| **内部リンク網** | 全ページに「対応エリア」ナビ＋地域間リンク | サイト全体の評価を地域ページへ流し込む |

### 地域を増やす（＝ページを増やす）方法
`data/areas.json` の `areas` に自治体を1つ追加して `npm run build` するだけ。
`area/<slug>.html` とサイトマップ、エリアハブ、内部リンクが自動更新されます。

### Instagram を実データに自動連携する
1. Instagramを**プロアカウント（ビジネス）**にし、Facebookページと連携
2. Instagram Graph API の **長期トークン**と**ユーザーID**を取得
3. GitHub Secrets / Netlify環境変数に `IG_TOKEN` / `IG_USER_ID` を設定
4. `npm run build:instagram`（または通常ビルド）で `data/instagram.json` が最新6件に更新され、トップ・採用へ自動反映

> トークン未設定の間は `data/instagram.json` の注目投稿（プレースホルダ）が表示されます。画像は自社の実写真に差し替えると効果的です。

### 検索で勝つための運用（公開後すぐ）
1. **Googleビジネスプロフィール**を整備（本社＝神戸市兵庫区）。地域ページとNAP（名称・住所・電話）を一致させる → ローカル検索で競合に対抗
2. **Search Console**に `sitemap.xml` を送信（地域・ブログが自動で載る）
3. 地域ごとの**実績・写真**を各 `area/<市>.html` に追記（一意性が上がるほど順位が安定）
4. ブログを止めない（自動連携＋月1〜2本の手動記事）

> ⚠️ 地域ページは「固有情報を持つ質の高いページ」であることが前提です。各エリアに実際の施工実績・写真・お客様の声を足していくほど、競合との差が開きます（薄いまま量産しないこと）。

---

## 🎨 ブランド
- メイン：`#15263d`（ネイビー・信頼／公共性）
- アクセント：`#f0b400`（ゴールド）〜`#ff7a18`（オレンジ）＝“ALL LIGHT”＝光・ブチアゲ
- 見出し：Noto Serif JP ／ 本文：Noto Sans JP
- スマホ完全対応（レスポンシブ・ハンバーガーメニュー）
