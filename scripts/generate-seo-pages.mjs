#!/usr/bin/env node
/**
 * generate-seo-pages.mjs
 * ------------------------------------------------------------------
 * 対ライバル（地域SEO）自動化エンジン。
 *   1) data/areas.json から地域ランディングページ area/<slug>.html を自動生成
 *   2) area/index.html（エリアハブ）を生成
 *   3) data/instagram.json を index.html / recruit.html の
 *      <!-- AUTO:INSTAGRAM:START/END --> ブロックへ差し込み
 *
 * ねらい：同一商圏（神戸市兵庫区）の競合が静的サイトの間に、
 *         「<地域> 電気工事 / <地域> 公共工事 / <地域> 電気工事 求人」を
 *         固有コンテンツのページで面制圧する。
 *
 * 実行： node scripts/generate-seo-pages.mjs
 * ------------------------------------------------------------------
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://alllight2018.com";

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* ===== 共通パーツ（相対パス prefix を渡す） ===== */
const header = (p, current) => `
<header class="site-header">
  <div class="wrap nav-inner">
    <a class="brand" href="${p}index.html" aria-label="株式会社オールライト トップへ">
      <img class="brand-logo brand-logo-dark" src="/assets/logo-white.svg" alt="株式会社オールライト" width="150" height="23" /><img class="brand-logo brand-logo-light" src="/assets/logo.svg" alt="株式会社オールライト" width="150" height="23" />
      
    </a>
    <nav class="nav-links" aria-label="グローバルナビゲーション">
      <a href="${p}index.html">トップ</a><a href="${p}about.html">会社案内</a>
      <a href="${p}works.html">公共工事実績</a><a href="${p}service/index.html"${current === "service" ? ' aria-current="page"' : ""}>施工内容</a>
      <a href="${p}area/index.html"${current === "area" ? ' aria-current="page"' : ""}>対応エリア</a>
      <a href="${p}recruit.html">採用情報</a><a href="${p}blog/index.html">現場ブログ</a>
      <a href="https://www.youtube.com/@all-light" target="_blank" rel="noopener" class="nav-youtube">YouTube</a><a href="${p}contact.html" class="btn btn-amber" style="padding:.6rem 1.3rem">お問い合わせ</a>
    </nav>
    <button class="nav-toggle" aria-label="メニューを開く" aria-controls="mmenu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
</header>
<div class="menu-backdrop"></div>
<nav id="mmenu" class="mobile-menu" aria-label="モバイルメニュー">
  <button class="menu-close" aria-label="メニューを閉じる">&times;</button>
  <a href="${p}index.html">トップ</a><a href="${p}about.html">会社案内</a><a href="${p}works.html">公共工事実績</a>
  <a href="${p}service/index.html">施工内容</a><a href="${p}area/index.html">対応エリア</a><a href="${p}recruit.html">採用情報</a><a href="${p}blog/index.html">現場ブログ</a>
  <a href="https://www.youtube.com/@all-light" target="_blank" rel="noopener" class="nav-youtube">YouTube</a><a href="${p}contact.html" class="btn btn-amber">お問い合わせ</a>
</nav>`;

const footer = (p) => `
<footer class="site-footer">
  <div class="wrap" style="padding-block:3.5rem;">
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:2rem;">
      <div><div class="brand" style="color:#fff;"><img class="brand-logo brand-logo-dark" src="/assets/logo-white.svg" alt="株式会社オールライト" width="150" height="23" /><img class="brand-logo brand-logo-light" src="/assets/logo.svg" alt="株式会社オールライト" width="150" height="23" /></div>
        <p style="margin-top:1rem; font-size:.86rem;">公共工事で、まちに光を灯す。<br />官公庁・公共施設の電気設備工事を全国で。</p>
        <div class="footer-social-links" style="display:flex; gap:.9rem; margin-top:1rem;"><a href="https://www.instagram.com/alllight2018/" target="_blank" rel="noopener" style="font-size:.86rem; color:#fff; text-decoration:underline;">Instagram</a><a href="https://www.youtube.com/@all-light" target="_blank" rel="noopener" style="font-size:.86rem; color:#fff; text-decoration:underline;">YouTube</a></div></div>
      <div><h4 style="color:#fff; font-weight:700; margin-bottom:.8rem;">サイトマップ</h4>
        <ul style="list-style:none; display:grid; gap:.5rem; font-size:.9rem;">
          <li><a href="${p}index.html">トップ</a></li><li><a href="${p}about.html">会社案内</a></li><li><a href="${p}works.html">公共工事実績</a></li>
          <li><a href="${p}service/index.html">施工内容</a></li><li><a href="${p}area/index.html">対応エリア</a></li><li><a href="${p}recruit.html">採用情報</a></li><li><a href="${p}hacchusha.html">発注担当者の方へ</a></li>
          <li><a href="${p}blog/index.html">現場ブログ</a></li><li><a href="${p}contact.html">お問い合わせ</a></li></ul></div>
      <div><h4 style="color:#fff; font-weight:700; margin-bottom:.8rem;">会社情報</h4>
        <p style="font-size:.9rem;">〒652-0823<br />兵庫県神戸市兵庫区東出町2丁目8-8<br />TEL：078-686-7328（代表）<br />info@alllight2018.com</p></div>
      <div><h4 style="color:#fff; font-weight:700; margin-bottom:.8rem;">許可・登録</h4>
        <div class="footer-license">建設業許可：兵庫県知事許可（特-5）第117719号（電気工事業）<br />兵庫県知事許可（般-5）第117719号（消防施設工事業）</div></div>
    </div>
    <div style="margin-top:2.5rem; padding-top:1.5rem; border-top:1px solid rgba(255,255,255,.12); display:flex; justify-content:space-between; flex-wrap:wrap; gap:1rem; font-size:.82rem;">
      <p>&copy; <span data-year>2026</span> ALLLIGHT CO., LTD. All rights reserved.</p>
      <p><a href="${p}contact.html">お問い合わせ</a>　/　<a href="${p}privacy.html">プライバシーポリシー</a></p>
    </div>
  </div>
</footer>`;

const head = ({ title, desc, canonical, ogimg }) => `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${canonical}" />
<meta name="theme-color" content="#15263d" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="株式会社オールライト" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ogimg.startsWith('http') ? ogimg : SITE_ORIGIN + ogimg}" />
<meta property="og:locale" content="ja_JP" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/favicon.svg" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Noto+Serif+JP:wght@600;700;900&display=swap" rel="stylesheet" />`;

const labelOf = (area) => area.isPrefecture ? area.name + "全域" : (area.parent ? area.parent + area.name : area.name);

/* ===== 地域ページ本体 ===== */
function renderAreaPage(area, allAreas, services = []) {
  const p = "../";
  const url = `${SITE_ORIGIN}/area/${area.slug}.html`;
  const label = labelOf(area);
  const kw = `${area.name} 電気工事`;
  const title = `${label}の電気工事・公共工事なら株式会社オールライト｜電気設備工事・施工管理`;
  const desc = `${label}で電気工事・公共工事の電気設備工事をお探しなら株式会社オールライトへ。${area.context} 受変電・内線・LED照明改修・施工管理まで自社一気通貫で対応。工事成績評定点でも高評価。無料お見積り・採用相談も受付中。`;
  const ogimg = "/assets/photos/building-night.jpg";

  const faqs = [
    { q: `${label}で公共工事の電気設備工事を依頼できますか？`, a: `はい。オールライトは神戸市を拠点に、${label}の官公庁・自治体・独立行政法人が発注する電気設備工事に対応しています。積算・入札から施工管理、完成書類の作成までを自社で一貫してお引き受けします。` },
    { q: `${label}でどんな電気工事に対応していますか？`, a: `${area.facilities.slice(0, 3).join("・")}などの電気設備工事をはじめ、受変電（キュービクル）、内線・幹線工事、LED照明・省エネ改修、空調・防犯・弱電設備まで幅広く対応します。` },
    { q: `${label}で電気工事・施工管理の求人はありますか？`, a: `はい。${label}エリアで働く電気工事士・施工管理を募集しています。未経験歓迎・資格取得支援・完全週休二日。詳しくは採用ページをご覧ください。` },
    { q: `見積りは無料ですか？`, a: `はい、お見積りは無料です。${label}の案件について、入札のご相談から民間工事のお見積りまでお気軽にお問い合わせください。3営業日以内にご返信します。` }
  ];
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  const bizSchema = {
    "@context": "https://schema.org", "@type": ["ElectricalContractor", "GeneralContractor"],
    name: "株式会社オールライト", url: SITE_ORIGIN, image: SITE_ORIGIN + ogimg,
    areaServed: { "@type": area.isPrefecture ? "State" : "City", name: label },
    address: { "@type": "PostalAddress", postalCode: "652-0823", addressRegion: "兵庫県", addressLocality: "神戸市兵庫区", streetAddress: "東出町2丁目8-8", addressCountry: "JP" },
    knowsAbout: ["公共工事", "電気設備工事", "受変電設備", "LED照明改修", "施工管理"]
  };
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "トップ", item: `${SITE_ORIGIN}/index.html` },
    { "@type": "ListItem", position: 2, name: "対応エリア", item: `${SITE_ORIGIN}/area/index.html` },
    { "@type": "ListItem", position: 3, name: label, item: url }
  ]};

  const neighbors = allAreas.filter((a) => a.slug !== area.slug).slice(0, 8);

  // ヒーロー写真を地域ごとにローテーション（毎回genba.jpgでなく変化をつける）
  const heroPhotos = [
    "/assets/photos/building-night.jpg", "/assets/photos/genba.jpg", "/assets/photos/work-cubicle.jpg",
    "/assets/photos/work-chuokansen-lightup.jpg", "/assets/photos/sekou-kanri.jpg", "/assets/photos/work-hiyodori-tunnel.jpg",
    "/assets/photos/work-higashinada-shomei.jpg", "/assets/photos/work-iwazono-cubicle.jpg"
  ];
  const heroImg = heroPhotos[Math.max(0, allAreas.indexOf(area)) % heroPhotos.length];

  return `${head({ title, desc, canonical: url, ogimg })}
<link rel="stylesheet" href="${p}assets/site.css" />
<script type="application/ld+json">${JSON.stringify(bizSchema)}</script>
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
</head>
<body>
${header(p)}

<section class="hero" style="min-height:52vh; display:flex; align-items:flex-end;">
  <div class="hero-bg" style="background-image:url('${heroImg}')"></div>
  <div class="hero-overlay"></div>
  <div class="wrap" style="position:relative; padding-block:3rem;">
    <p class="eyebrow">対応エリア</p>
    <h1 class="serif" style="font-weight:900; font-size:clamp(1.7rem,5vw,2.8rem); margin-top:.4rem; line-height:1.4;">
      ${esc(label)}の電気工事・公共工事なら<br /><span class="hype-mark">株式会社オールライト</span>
    </h1>
    <p style="color:rgba(255,255,255,.88); margin-top:.8rem; max-width:640px;">${esc(area.context)}</p>
    <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-top:1.6rem;">
      <a href="${p}contact.html" class="btn btn-amber">無料で見積り・相談する</a>
      <a href="${p}works.html" class="btn btn-ghost">施工実績を見る</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap" style="max-width:900px;">
    <div class="reveal">
      <p class="eyebrow">${esc(kw)}</p>
      <h2 class="section-title">${esc(label)}で選ばれる電気設備工事のプロ</h2>
      <div class="divider-gold" style="margin-top:1rem;"></div>
      <p class="lead" style="margin-top:1.2rem;">
        株式会社オールライトは、神戸市兵庫区を拠点に${esc(label)}の公共施設・官公庁の電気設備工事を手がける電気工事会社です。
        ${esc(area.context)}
        積算・入札から施工管理、完成書類の作成までを<strong>自社で一気通貫</strong>して対応し、
        発注者の「安心して任せられる」にお応えします。
      </p>
    </div>
${area.detail && area.detail.length ? `
    <div class="reveal area-detail-block" style="margin-top:1.8rem;">
      <h2 class="serif" style="font-weight:700; font-size:1.4rem; margin:0 0 1rem;">${esc(area.detailTitle || `${label}の電気設備工事について`)}</h2>
      ${area.detail.map((para) => `<p style="margin-bottom:1rem;">${esc(para)}</p>`).join("\n      ")}
    </div>
` : ""}
    <h2 class="serif reveal" style="font-weight:700; font-size:1.4rem; margin:2.4rem 0 1rem;">${esc(label)}で対応できる主な施設・工事</h2>
    <div class="reveal" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:.8rem;">
      ${area.facilities.map((f) => `<div class="card" style="padding:1rem 1.2rem;"><b>▹ ${esc(f)}</b></div>`).join("\n      ")}
    </div>
    ${area.wards && area.wards.length ? `<p class="text-sub reveal" style="margin-top:1rem; font-size:.9rem;">対応区域：${area.wards.map(esc).join("・")} ほか${esc(area.name)}全域</p>` : ""}

    ${services.length ? `<h2 class="serif reveal" style="font-weight:700; font-size:1.4rem; margin:2.4rem 0 1rem;">${esc(label)}で対応する工事の種類</h2>
    <div class="reveal" style="display:flex; gap:.6rem; flex-wrap:wrap;">
      ${services.map((s) => `<a class="chip chip-amber" style="text-decoration:none;" href="${p}service/${s.slug}.html">${esc(s.name)}</a>`).join("\n      ")}
    </div>` : ""}

    <h2 class="serif reveal" style="font-weight:700; font-size:1.4rem; margin:2.4rem 0 1rem;">${esc(label)}の発注者に選ばれる3つの理由</h2>
    <div class="reveal" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:1rem;">
      <div class="card" style="padding:1.6rem;"><b class="serif" style="color:var(--amber); font-size:1.4rem;">01</b><h3 style="font-weight:700; margin:.3rem 0;">工事点数で証明する品質</h3><p class="text-sub" style="font-size:.9rem;">工事成績評定点で高評価を積み上げ、安心の施工品質をお約束します。</p></div>
      <div class="card" style="padding:1.6rem;"><b class="serif" style="color:var(--amber); font-size:1.4rem;">02</b><h3 style="font-weight:700; margin:.3rem 0;">積算〜書類まで自社完結</h3><p class="text-sub" style="font-size:.9rem;">窓口を一本化。連絡・調整・品質の安心を${esc(label)}の現場でお届けします。</p></div>
      <div class="card" style="padding:1.6rem;"><b class="serif" style="color:var(--amber); font-size:1.4rem;">03</b><h3 style="font-weight:700; margin:.3rem 0;">地元・神戸からの機動力</h3><p class="text-sub" style="font-size:.9rem;">${esc(label)}にすぐ動ける立地。急な対応・きめ細かなフォローが可能です。</p></div>
    </div>

    <h2 class="serif reveal" style="font-weight:700; font-size:1.4rem; margin:2.4rem 0 1rem;">${esc(label)}に関するよくある質問</h2>
    <div class="reveal">
      ${faqs.map((f) => `<details class="card" style="padding:1.1rem 1.3rem; margin-bottom:.7rem;"><summary style="font-weight:700; cursor:pointer;">${esc(f.q)}</summary><p class="text-sub" style="margin-top:.6rem; font-size:.92rem;">${esc(f.a)}</p></details>`).join("\n      ")}
    </div>

    <div class="reveal" style="margin-top:2.4rem; padding:1.8rem; background:linear-gradient(120deg,var(--navy),var(--navy-2)); color:#fff; border-radius:16px; display:flex; justify-content:space-between; align-items:center; gap:1.5rem; flex-wrap:wrap;">
      <div><h2 class="serif" style="font-weight:700; font-size:1.3rem;">${esc(label)}の電気工事、まずはご相談を</h2>
        <p style="color:rgba(255,255,255,.8); margin-top:.4rem; font-size:.92rem;">入札・見積・採用のご相談を無料で承ります。</p></div>
      <div style="display:flex; gap:.8rem; flex-wrap:wrap;">
        <a href="${p}contact.html" class="btn btn-amber">お問い合わせ</a>
        <a href="${p}recruit.html" class="btn btn-ghost">採用情報</a>
      </div>
    </div>

    <h2 class="serif reveal" style="font-weight:700; font-size:1.2rem; margin:2.6rem 0 1rem;">その他の対応エリア</h2>
    <div class="reveal" style="display:flex; gap:.6rem; flex-wrap:wrap;">
      ${neighbors.map((a) => `<a class="chip chip-navy" style="text-decoration:none;" href="${a.slug}.html">${esc(labelOf(a))}の電気工事</a>`).join("\n      ")}
    </div>
  </div>
</section>

${footer(p)}
<script src="${p}assets/site.js"></script>
</body>
</html>
`;
}

/* ===== エリアハブ ===== */
function renderAreaHub(areas) {
  const p = "../";
  const url = `${SITE_ORIGIN}/area/index.html`;
  const title = "対応エリア｜兵庫県・大阪府を中心に全国対応｜株式会社オールライト";
  const desc = "株式会社オールライトの対応エリア。兵庫県（神戸市ほか）・大阪府を中心に、東京・石川・長野・神奈川・三重・徳島など全国の官公庁・公共施設の電気設備工事に施工実績があります。";

  const kobe = areas.find((a) => a.slug === "kobe");
  const wards = areas.filter((a) => a.type === "ward");
  const cities = areas.filter((a) => a.type === "city" && a.slug !== "kobe");
  // 全国の施工実績がある都道府県（兵庫・大阪以外／works-data.js と整合）
  const recordPrefs = ["東京都", "石川県", "長野県", "神奈川県", "三重県", "徳島県", "山口県"];
  const chip = (label, href) => `<a class="chip chip-navy" style="text-decoration:none;" href="${href}">${esc(label)}</a>`;

  return `${head({ title, desc, canonical: url, ogimg: "/assets/photos/building-night.jpg" })}
<link rel="stylesheet" href="${p}assets/site.css" />
</head>
<body>
${header(p, "area")}
<section class="hero" style="min-height:40vh; display:flex; align-items:flex-end;">
  <div class="hero-bg" style="background-image:url('/assets/photos/building-night.jpg')"></div>
  <div class="hero-overlay"></div>
  <div class="wrap" style="position:relative; padding-block:2.6rem;">
    <p class="eyebrow">対応エリア</p>
    <h1 class="serif" style="font-weight:900; font-size:clamp(1.7rem,5vw,2.6rem); margin-top:.4rem;">対応エリア（兵庫県・大阪府を中心に、全国）</h1>
    <p style="color:rgba(255,255,255,.85); margin-top:.5rem;">神戸を拠点に、兵庫・大阪はもちろん、各地方の官公庁案件にも施工実績があります。</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="reveal"><p class="eyebrow">県から探す</p><h2 class="section-title">県から探す</h2><div class="divider-gold" style="margin-top:1rem;"></div></div>

    <!-- 兵庫県・大阪府（メイン2県） -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:1.4rem; margin-top:2rem;">
      <div class="card reveal" style="padding:1.8rem;">
        <div style="display:flex; align-items:center; gap:.7rem; flex-wrap:wrap;">
          <span class="chip chip-amber">本社エリア</span>
          <h3 class="serif" style="font-weight:900; font-size:1.6rem;">兵庫県</h3>
        </div>
        <p class="text-sub" style="font-size:.92rem; margin:.7rem 0 1.1rem;">神戸市に本社。県全域の公共施設・官公庁の電気設備工事に、積算から書類まで自社一貫で対応します。</p>
        <p style="font-weight:700; font-size:.9rem; margin-bottom:.5rem;">神戸市</p>
        <div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1rem;">
          ${chip("神戸市全域", `${kobe.slug}.html`)}
          ${wards.map((w) => chip(w.name, `${w.slug}.html`)).join("\n          ")}
        </div>
        <p style="font-weight:700; font-size:.9rem; margin-bottom:.5rem;">兵庫県の主要市</p>
        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
          ${cities.map((c) => chip(c.name, `${c.slug}.html`)).join("\n          ")}
        </div>
      </div>

      <div class="card reveal d1" style="padding:1.8rem;">
        <div style="display:flex; align-items:center; gap:.7rem; flex-wrap:wrap;">
          <span class="chip chip-amber">主要エリア</span>
          <h3 class="serif" style="font-weight:900; font-size:1.6rem;">大阪府</h3>
        </div>
        <p class="text-sub" style="font-size:.92rem; margin:.7rem 0 1.1rem;">神戸の隣接圏として、大阪府内の官公庁案件にも対応。大阪港（海上保安庁）の電気設備工事、法務省・大阪拘置所の照明LED化改修などの実績があります。</p>
        <div style="display:grid; gap:.6rem; font-size:.92rem;">
          <div class="card" style="padding:.9rem 1.1rem;"><b>▹ 大阪港安治川突堤南岸壁 電気設備工事</b><span class="text-sub" style="font-size:.84rem;">　発注：第五管区海上保安本部</span></div>
          <div class="card" style="padding:.9rem 1.1rem;"><b>▹ 大阪拘置所尼崎拘置支所 照明設備LED化改修</b><span class="text-sub" style="font-size:.84rem;">　発注：法務省 大阪拘置所</span></div>
        </div>
        <div style="display:flex; gap:.8rem; flex-wrap:wrap; margin-top:1.2rem;">
          <a href="${p}works.html" class="btn btn-navy" style="padding:.6rem 1.2rem;">大阪の実績を見る</a>
          <a href="${p}contact.html" class="btn btn-ghost" style="padding:.6rem 1.2rem;">大阪の案件を相談する</a>
        </div>
      </div>
    </div>

    <!-- 各地方の施工実績 -->
    <div class="reveal" style="margin-top:3rem;">
      <p class="eyebrow">全国の施工実績</p>
      <h2 class="section-title" style="font-size:clamp(1.4rem,3.8vw,2rem);">各地方にも、<span class="hype-mark">施工実績があります。</span></h2>
      <p class="lead" style="margin-top:.9rem; max-width:760px;">
        「遠方だから」で判断しません。防衛省・国土交通省・日本年金機構など、<strong>全国の官公庁案件</strong>を手がけてきました。
        地方・広域の案件も、自社の施工管理のもとで体制を組んで対応します。
      </p>
      <div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-top:1.2rem;">
        ${chip("大阪府", `${p}works.html`)}
        ${recordPrefs.map((pf) => chip(pf, `${p}works.html`)).join("\n        ")}
      </div>
      <p class="text-sub" style="font-size:.86rem; margin-top:1rem;">※ 例：小松基地 高圧ケーブル更新（石川）、羽田空港 受配電設備（東京）、八王子年金事務所 受変電更新（東京）ほか。</p>
      <div style="margin-top:1.4rem;">
        <a href="${p}works.html#map" class="link-arrow" style="font-weight:700;">全国の施工実績マップを見る</a>
      </div>
    </div>
  </div>
</section>
${footer(p)}
<script src="${p}assets/site.js"></script>
</body>
</html>
`;
}

/* ===== サービス（工種）ページ ===== */
function renderServicePage(svc, allServices, areas) {
  const p = "../";
  const url = `${SITE_ORIGIN}/service/${svc.slug}.html`;
  const title = `${svc.name}（神戸・兵庫）｜株式会社オールライト｜公共工事の電気設備`;
  const desc = `${svc.name}なら株式会社オールライトへ。${svc.intro} 神戸市・兵庫県全域の公共施設・官公庁に対応。無料お見積り受付中。`;
  const primaryAreas = areas.filter((a) => a.type !== "prefecture").slice(0, 12);
  const others = allServices.filter((s) => s.slug !== svc.slug);

  const faqs = [
    { q: `${svc.name}の見積りは無料ですか？`, a: `はい、お見積りは無料です。現地調査のうえ、適正な内容でご提案します。神戸・兵庫のほか、公共案件は広域で対応します。` },
    { q: `公共工事（官公庁・自治体）の${svc.name}に対応できますか？`, a: `はい。積算・入札から施工管理、完成書類の作成まで自社で一貫対応。工事成績評定点でも高評価を積み上げています。` },
    { q: `施設を使いながらの施工は可能ですか？`, a: `可能です。停電・切替計画や分割施工により、施設の稼働を止めない施工を計画します。` }
  ];
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  const serviceSchema = {
    "@context": "https://schema.org", "@type": "Service", serviceType: svc.name,
    provider: { "@type": "ElectricalContractor", name: "株式会社オールライト", url: SITE_ORIGIN },
    areaServed: { "@type": "State", name: "兵庫県" }, description: svc.intro
  };
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "トップ", item: `${SITE_ORIGIN}/index.html` },
    { "@type": "ListItem", position: 2, name: "施工内容", item: `${SITE_ORIGIN}/service/index.html` },
    { "@type": "ListItem", position: 3, name: svc.name, item: url }
  ]};

  return `${head({ title, desc, canonical: url, ogimg: svc.image })}
<link rel="stylesheet" href="${p}assets/site.css" />
<script type="application/ld+json">${JSON.stringify(serviceSchema)}</script>
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
</head>
<body>
${header(p, "service")}

<section class="hero" style="min-height:52vh; display:flex; align-items:flex-end;">
  <div class="hero-bg" style="background-image:url('${esc(svc.image)}')"></div>
  <div class="hero-overlay"></div>
  <div class="wrap" style="position:relative; padding-block:3rem;">
    <p class="eyebrow">${esc(svc.cat || "施工内容")}</p>
    <h1 class="serif" style="font-weight:900; font-size:clamp(1.7rem,5vw,2.8rem); margin-top:.4rem; line-height:1.4;">${esc(svc.name)}</h1>
    <p style="color:rgba(255,255,255,.9); margin-top:.6rem; font-weight:700;">${esc(svc.tagline)}</p>
    <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-top:1.6rem;">
      <a href="${p}contact.html" class="btn btn-amber">無料で見積り・相談する</a>
      <a href="${p}works.html" class="btn btn-ghost">施工実績を見る</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap" style="max-width:900px;">
    <div class="reveal">
      <p class="eyebrow">${esc(svc.name)}</p>
      <h2 class="section-title">${esc(svc.name)}なら、オールライトへ</h2>
      <div class="divider-gold" style="margin-top:1rem;"></div>
      <p class="lead" style="margin-top:1.2rem;">${esc(svc.intro)}</p>
    </div>

    <h2 class="serif reveal" style="font-weight:700; font-size:1.4rem; margin:2.4rem 0 1rem;">対応範囲</h2>
    <div class="reveal" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:.8rem;">
      ${svc.scope.map((x) => `<div class="card" style="padding:1rem 1.2rem;"><b>▹ ${esc(x)}</b></div>`).join("\n      ")}
    </div>

    <h2 class="serif reveal" style="font-weight:700; font-size:1.4rem; margin:2.4rem 0 1rem;">施工の流れ</h2>
    <div class="reveal" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:1rem;">
      ${svc.process.map((x, i) => `<div class="card" style="padding:1.4rem;"><b class="serif" style="color:var(--amber); font-size:1.5rem;">0${i + 1}</b><h3 style="font-weight:700; margin-top:.3rem; font-size:.98rem;">${esc(x)}</h3></div>`).join("\n      ")}
    </div>

    <h2 class="serif reveal" style="font-weight:700; font-size:1.4rem; margin:2.4rem 0 1rem;">なぜオールライトが選ばれるのか</h2>
    <div class="reveal" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:1rem;">
      <div class="card" style="padding:1.6rem;"><h3 style="font-weight:700;">工事点数で証明する品質</h3><p class="text-sub" style="font-size:.9rem; margin-top:.4rem;">工事成績評定点で高評価。安心の施工品質をお約束します。</p></div>
      <div class="card" style="padding:1.6rem;"><h3 style="font-weight:700;">積算〜書類まで自社完結</h3><p class="text-sub" style="font-size:.9rem; margin-top:.4rem;">窓口一本化で、連絡・調整・品質の安心をお届けします。</p></div>
      <div class="card" style="padding:1.6rem;"><h3 style="font-weight:700;">神戸から機動力で対応</h3><p class="text-sub" style="font-size:.9rem; margin-top:.4rem;">兵庫県全域にすぐ動ける立地。急な対応も可能です。</p></div>
    </div>

    <h2 class="serif reveal" style="font-weight:700; font-size:1.4rem; margin:2.4rem 0 1rem;">よくある質問</h2>
    <div class="reveal">
      ${faqs.map((f) => `<details class="card" style="padding:1.1rem 1.3rem; margin-bottom:.7rem;"><summary style="font-weight:700; cursor:pointer;">${esc(f.q)}</summary><p class="text-sub" style="margin-top:.6rem; font-size:.92rem;">${esc(f.a)}</p></details>`).join("\n      ")}
    </div>

    <div class="reveal" style="margin-top:2.4rem; padding:1.8rem; background:linear-gradient(120deg,var(--navy),var(--navy-2)); color:#fff; border-radius:16px; display:flex; justify-content:space-between; align-items:center; gap:1.5rem; flex-wrap:wrap;">
      <div><h2 class="serif" style="font-weight:700; font-size:1.3rem;">${esc(svc.name)}のご相談・お見積り</h2>
        <p style="color:rgba(255,255,255,.8); margin-top:.4rem; font-size:.92rem;">無料で承ります。3営業日以内にご返信します。</p></div>
      <a href="${p}contact.html" class="btn btn-amber">お問い合わせ</a>
    </div>

    <h2 class="serif reveal" style="font-weight:700; font-size:1.2rem; margin:2.6rem 0 1rem;">対応エリア</h2>
    <div class="reveal" style="display:flex; gap:.6rem; flex-wrap:wrap;">
      ${primaryAreas.map((a) => `<a class="chip chip-navy" style="text-decoration:none;" href="${p}area/${a.slug}.html">${esc(labelOf(a))}</a>`).join("\n      ")}
    </div>

    <h2 class="serif reveal" style="font-weight:700; font-size:1.2rem; margin:2rem 0 1rem;">その他の施工内容</h2>
    <div class="reveal" style="display:flex; gap:.6rem; flex-wrap:wrap;">
      ${others.map((s) => `<a class="chip chip-amber" style="text-decoration:none;" href="${s.slug}.html">${esc(s.name)}</a>`).join("\n      ")}
    </div>
  </div>
</section>

${footer(p)}
<script src="${p}assets/site.js"></script>
</body>
</html>
`;
}

function renderServiceHub(services) {
  const p = "../";
  const url = `${SITE_ORIGIN}/service/index.html`;
  const title = "施工内容（電気設備工事の工種）｜株式会社オールライト｜神戸・兵庫";
  const desc = "株式会社オールライトの施工内容一覧。電気設備工事・受変電（キュービクル）・LED照明改修・内線幹線・防災防犯弱電・空調設備まで、公共工事に対応する工種をご紹介します。";
  return `${head({ title, desc, canonical: url, ogimg: "/assets/photos/genba.jpg" })}
<link rel="stylesheet" href="${p}assets/site.css" />
</head>
<body>
${header(p, "service")}
<section class="hero" style="min-height:40vh; display:flex; align-items:flex-end;">
  <div class="hero-bg" style="background-image:url('/assets/photos/genba.jpg')"></div>
  <div class="hero-overlay"></div>
  <div class="wrap" style="position:relative; padding-block:2.6rem;">
    <p class="eyebrow">施工内容</p>
    <h1 class="serif" style="font-weight:900; font-size:clamp(1.7rem,5vw,2.6rem); margin-top:.4rem;">施工内容</h1>
    <p style="color:rgba(255,255,255,.85); margin-top:.5rem;">公共工事に対応する、電気設備の工種一覧。</p>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <div class="reveal"><p class="eyebrow">施工内容</p><h2 class="section-title">工種から探す</h2><div class="divider-gold" style="margin-top:1rem;"></div></div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1.2rem; margin-top:2rem;">
      ${services.map((s, i) => `<a class="card reveal${i % 3 === 1 ? " d1" : i % 3 === 2 ? " d2" : ""}" href="${s.slug}.html" style="display:block;">
        <div style="height:170px; background-size:cover; background-position:center; background-image:url('${esc(s.image)}')"></div>
        <div style="padding:1.4rem;"><span class="chip chip-amber">${esc(s.cat || s.name)}</span>
          <h3 class="serif" style="font-weight:700; font-size:1.15rem; margin:.6rem 0 .3rem;">${esc(s.name)}</h3>
          <p class="text-sub" style="font-size:.88rem;">${esc(s.tagline)}</p>
          <span class="link-arrow" style="margin-top:.5rem;">詳しく見る</span></div>
      </a>`).join("\n      ")}
    </div>
  </div>
</section>
${footer(p)}
<script src="${p}assets/site.js"></script>
</body>
</html>
`;
}

/* ===== Instagram ブロック差し込み ===== */
function renderInstagramBlock(igData, prefix) {
  const profile = igData.profile || "https://www.instagram.com/alllight2018/";
  const posts = (igData.posts || []).slice(0, 6);
  const grid = posts.length
    ? posts.map((it) => `      <a href="${esc(it.permalink || profile)}" target="_blank" rel="noopener" class="ig-cell" style="position:relative; display:block; aspect-ratio:1/1; border-radius:12px; overflow:hidden; background:#222;">
        <img src="${esc(it.image)}" alt="${esc((it.caption || "オールライトの現場・日常").slice(0, 60))}" loading="lazy" style="width:100%; height:100%; object-fit:cover;" />
      </a>`).join("\n")
    : `      <div class="card" style="grid-column:1/-1; padding:1.4rem; border-style:dashed; text-align:center;">Instagramの最新投稿はこちら → <a class="link-arrow" href="${esc(profile)}" target="_blank" rel="noopener">@alllight2018</a></div>`;
  return `<!-- AUTO:INSTAGRAM:START — scripts/generate-seo-pages.mjs が data/instagram.json から自動生成。手動編集しないでください。 -->
<section class="section" style="background:#fff; border-block:1px solid var(--line);">
  <div class="wrap">
    <div class="reveal" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1rem;">
      <div><p class="eyebrow">INSTAGRAM</p><h2 class="section-title">現場と、そこにいる人たち。</h2>
        <p class="lead" style="margin-top:.5rem;">日々の現場・仲間の様子を発信中。フォローで“中の人”が見えます。</p></div>
      <a href="${esc(profile)}" target="_blank" rel="noopener" class="btn btn-navy">@alllight2018 をフォロー</a>
    </div>
    <div class="reveal" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:.8rem; margin-top:1.8rem;">
${grid}
    </div>
  </div>
</section>
<!-- AUTO:INSTAGRAM:END -->`;
}

function injectBetween(html, startMark, endMark, replacement) {
  const s = html.indexOf(startMark);
  const e = html.indexOf(endMark);
  if (s === -1 || e === -1) return null;
  return html.slice(0, s) + replacement + html.slice(e + endMark.length);
}

/* ===== メイン ===== */
async function main() {
  const areasRaw = JSON.parse(await readFile(join(ROOT, "data", "areas.json"), "utf8"));
  const areas = areasRaw.areas;
  let services = [];
  try { services = JSON.parse(await readFile(join(ROOT, "data", "services.json"), "utf8")).services || []; } catch {}

  await mkdir(join(ROOT, "area"), { recursive: true });
  for (const area of areas) {
    await writeFile(join(ROOT, "area", `${area.slug}.html`), renderAreaPage(area, areas, services), "utf8");
  }
  await writeFile(join(ROOT, "area", "index.html"), renderAreaHub(areas), "utf8");
  console.log(`✅ 地域SEOページ ${areas.length} 件＋エリアハブを生成しました。`);

  if (services.length) {
    await mkdir(join(ROOT, "service"), { recursive: true });
    for (const svc of services) {
      await writeFile(join(ROOT, "service", `${svc.slug}.html`), renderServicePage(svc, services, areas), "utf8");
    }
    await writeFile(join(ROOT, "service", "index.html"), renderServiceHub(services), "utf8");
    console.log(`✅ サービスページ ${services.length} 件＋サービスハブを生成しました。`);
  }

  // Instagram 差し込み
  let igData = { profile: "https://www.instagram.com/alllight2018/", posts: [] };
  const igPath = join(ROOT, "data", "instagram.json");
  if (existsSync(igPath)) { try { igData = JSON.parse(await readFile(igPath, "utf8")); } catch {} }
  for (const [file, prefix] of [["index.html", ""], ["recruit.html", ""]]) {
    const fp = join(ROOT, file);
    if (!existsSync(fp)) continue;
    let html = await readFile(fp, "utf8");
    const block = renderInstagramBlock(igData, prefix);
    const injected = injectBetween(html, "<!-- AUTO:INSTAGRAM:START", "<!-- AUTO:INSTAGRAM:END -->", block);
    if (injected) { await writeFile(fp, injected, "utf8"); console.log(`✅ ${file} にInstagramブロックを差し込みました。`); }
    else console.warn(`⚠️  ${file} に AUTO:INSTAGRAM マーカーがありません（スキップ）。`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
