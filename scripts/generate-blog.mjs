#!/usr/bin/env node
/**
 * generate-blog.mjs
 * ------------------------------------------------------------------
 * 社内アプリ（Supabase: keiei-os）の public.blog_posts テーブルから
 * 「is_public = true」の記事だけを取得し、公開Webサイトの
 *   - blog/report-<slug>.html （個別記事）
 *   - blog/index.html の「現場レポート」ブロック
 *   - sitemap.xml
 * を自動生成・更新します。
 *
 * ★安全設計★
 *  - 公開されるのは is_public=true の行のみ（RLSでも二重に保護）。
 *  - body_format='text'（既定）はHTMLエスケープして段落化 → XSS/情報漏えい防止。
 *  - 認証情報が無いときは何もせず正常終了（Netlifyでsecrets未設定でもビルドを壊さない）。
 *
 * 使い方:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/generate-blog.mjs
 * ------------------------------------------------------------------
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://alllight2018.com";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/* ---------- ユーティリティ ---------- */
const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const safeSlug = (s = "") =>
  String(s).toLowerCase().replace(/[^a-z0-9\-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "post";

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

// プレーンテキスト本文を安全に段落HTMLへ
const textToParagraphs = (text = "") =>
  esc(text).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`).join("\n");

/* ---------- 個別記事テンプレート ---------- */
function renderArticle(post) {
  const url = `${SITE_ORIGIN}/blog/report-${post.slug}.html`;
  const cover = post.cover_image_url || "/assets/photos/building-night.jpg";
  const bodyHtml = post.body_format === "html" ? post.body : textToParagraphs(post.body);
  const desc = esc(post.excerpt || String(post.body).slice(0, 110));
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(post.title)}｜株式会社オールライト 現場ブログ</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${url}" />
<meta name="theme-color" content="#15263d" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="株式会社オールライト" />
<meta property="og:title" content="${esc(post.title)}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${esc(cover.startsWith('http') ? cover : SITE_ORIGIN + cover)}" />
<meta property="og:locale" content="ja_JP" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Noto+Serif+JP:wght@600;700;900&display=swap" rel="stylesheet" />
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="../assets/site.css" />
<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org", "@type": "Article",
  headline: post.title, description: post.excerpt || undefined, image: cover.startsWith('http') ? cover : SITE_ORIGIN + cover,
  datePublished: post.published_at || post.created_at,
  dateModified: post.updated_at || post.published_at || post.created_at,
  author: { "@type": "Organization", name: "株式会社オールライト" },
  publisher: { "@type": "Organization", name: "株式会社オールライト", logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/assets/logo.svg` } },
  mainEntityOfPage: url
})}
</script>
</head>
<body>
<header class="site-header">
  <div class="wrap nav-inner">
    <a class="brand" href="../index.html" aria-label="株式会社オールライト トップへ">
      <img class="brand-logo brand-logo-dark" src="/assets/logo-white.svg" alt="株式会社オールライト" width="150" height="23" /><img class="brand-logo brand-logo-light" src="/assets/logo.svg" alt="株式会社オールライト" width="150" height="23" />
      
    </a>
    <nav class="nav-links" aria-label="グローバルナビゲーション">
      <a href="../index.html">トップ</a><a href="../about.html">会社案内</a><a href="../works.html">公共工事実績</a>
      <a href="../recruit.html">採用情報</a><a href="index.html">現場ブログ</a>
      <a href="../contact.html" class="btn btn-amber" style="padding:.6rem 1.3rem">お問い合わせ</a>
    </nav>
    <button class="nav-toggle" aria-label="メニューを開く" aria-controls="mmenu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
</header>
<div class="menu-backdrop"></div>
<nav id="mmenu" class="mobile-menu" aria-label="モバイルメニュー">
  <button class="menu-close" aria-label="メニューを閉じる">&times;</button>
  <a href="../index.html">トップ</a><a href="../about.html">会社案内</a><a href="../works.html">公共工事実績</a>
  <a href="../recruit.html">採用情報</a><a href="index.html">現場ブログ</a>
  <a href="../contact.html" class="btn btn-amber">お問い合わせ</a>
</nav>

<article class="section" style="padding-top:6rem;">
  <div class="wrap" style="max-width:780px;">
    <nav aria-label="パンくず" style="font-size:.82rem; color:var(--sub); margin-bottom:1.2rem;">
      <a href="../index.html">トップ</a> ／ <a href="index.html">現場ブログ</a> ／ <span>${esc(post.title)}</span>
    </nav>
    <span class="chip chip-amber">${esc(post.category || "現場レポート")}</span>
    <h1 class="serif" style="font-weight:900; font-size:clamp(1.6rem,4.5vw,2.4rem); line-height:1.5; margin:.8rem 0;">${esc(post.title)}</h1>
    <p class="text-sub" style="font-size:.86rem;">公開日：${fmtDate(post.published_at || post.created_at)}</p>
    <img src="${esc(cover)}" alt="${esc(post.title)}" style="border-radius:14px; margin:1.6rem 0; width:100%; height:auto;" loading="lazy" />
    <div class="prose">
${bodyHtml}
    </div>
    <div style="margin-top:2.4rem; padding:1.6rem; background:linear-gradient(120deg,var(--navy),var(--navy-2)); color:#fff; border-radius:14px;">
      <h2 class="serif" style="font-weight:700; font-size:1.2rem;">公共工事のご相談・採用のご質問</h2>
      <p style="color:rgba(255,255,255,.8); margin:.5rem 0 1rem; font-size:.92rem;">お気軽にお問い合わせください。</p>
      <a href="../contact.html" class="btn btn-amber">お問い合わせはこちら</a>
    </div>
  </div>
</article>

<footer class="site-footer">
  <div class="wrap" style="padding-block:3rem; text-align:center; font-size:.82rem;">
    <div class="brand" style="color:#fff; justify-content:center; margin-bottom:1rem;"><img class="brand-logo brand-logo-dark" src="/assets/logo-white.svg" alt="株式会社オールライト" width="150" height="23" /><img class="brand-logo brand-logo-light" src="/assets/logo.svg" alt="株式会社オールライト" width="150" height="23" /></div>
    <p>&copy; <span data-year>2026</span> ALLLIGHT CO., LTD. All rights reserved.</p>
  </div>
</footer>
<script src="../assets/site.js"></script>
</body>
</html>
`;
}

/* ---------- 一覧カード ---------- */
function renderCards(posts) {
  if (!posts.length) {
    return `
      <div class="card" style="padding:1.6rem; border-style:dashed;">
        <span class="chip chip-amber">準備中</span>
        <h3 class="serif" style="font-weight:700; font-size:1.05rem; margin:.6rem 0 .3rem;">現場レポートは自動連携で公開されます</h3>
        <p class="text-sub" style="font-size:.88rem;">社内アプリで記事を「公開」にすると、ここに自動で追加されます。</p>
      </div>`;
  }
  return posts.map((p, i) => {
    const cover = p.cover_image_url || "/assets/photos/building-night.jpg";
    const d = i % 3 === 1 ? " d1" : i % 3 === 2 ? " d2" : "";
    return `      <a class="card reveal${d}" href="report-${p.slug}.html" style="display:block;">
        <div style="height:180px; background-size:cover; background-position:center; background-image:url('${esc(cover)}')"></div>
        <div style="padding:1.4rem;"><span class="chip chip-amber">${esc(p.category || "現場レポート")}</span>
          <h3 class="serif" style="font-weight:700; font-size:1.05rem; margin:.6rem 0 .3rem;">${esc(p.title)}</h3>
          <p class="text-sub" style="font-size:.86rem;">${esc(p.excerpt || String(p.body).slice(0, 60))}</p></div>
      </a>`;
  }).join("\n");
}

/* ---------- sitemap 生成 ---------- */
async function loadJsonSlugs(file, key, prefix) {
  try {
    const raw = JSON.parse(await readFile(join(ROOT, "data", file), "utf8"));
    return (raw[key] || []).map((a) => `${prefix}/${a.slug}.html`);
  } catch { return []; }
}

async function listBlogHtml() {
  // blog/ 配下の全HTML（朝メモ・夕方メモ・コラム・現場レポート等）を自動収集し、
  // sitemap から記事が抜け落ちないようにする（手動リストのメンテ不要）。
  try {
    const files = await readdir(join(ROOT, "blog"));
    return files.filter((f) => f.endsWith(".html")).sort().map((f) => `blog/${f}`);
  } catch { return []; }
}

async function renderSitemap(posts) {
  const areaPages = await loadJsonSlugs("areas.json", "areas", "area");
  const servicePages = await loadJsonSlugs("services.json", "services", "service");
  const blogPages = await listBlogHtml();
  const rootPages = ["index.html","about.html","works.html","recruit.html","contact.html","privacy.html","jigyou-shokei.html","hacchusha.html"]
    .filter((p) => existsSync(join(ROOT, p)));
  const staticPages = [
    ...rootPages,
    "service/index.html", ...servicePages,
    "area/index.html", ...areaPages,
    ...blogPages];
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  const urls = [];
  for (const p of staticPages) { if (seen.has(p)) continue; seen.add(p); urls.push({ loc: `${SITE_ORIGIN}/${p}`, lastmod: today }); }
  for (const post of posts) {
    const rp = `blog/report-${post.slug}.html`;
    if (seen.has(rp)) continue; seen.add(rp);
    urls.push({ loc: `${SITE_ORIGIN}/${rp}`, lastmod: (post.updated_at || post.published_at || today).slice(0, 10) });
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;
}

/* ---------- Supabase 取得 ---------- */
async function fetchPosts() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log("ℹ️  SUPABASE_URL / SUPABASE_ANON_KEY 未設定のため、現場レポートの取得をスキップします。");
    return null; // null = 更新スキップ（既存の一覧を保持）
  }
  // REST(PostgREST)経由で is_public=true のみ取得（依存パッケージ不要）
  const endpoint = `${SUPABASE_URL}/rest/v1/blog_posts` +
    `?select=slug,title,category,excerpt,body,body_format,cover_image_url,published_at,created_at,updated_at` +
    `&is_public=eq.true&order=published_at.desc.nullslast`;
  const res = await fetch(endpoint, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) {
    console.error(`⚠️  Supabase取得に失敗しました (${res.status})。一覧は据え置きます。`);
    return null;
  }
  const rows = await res.json();
  return rows.map((r) => ({ ...r, slug: safeSlug(r.slug) }));
}

/* ---------- メイン ---------- */
async function main() {
  const posts = await fetchPosts();

  // sitemap は常に再生成（動的記事が無ければ静的ページのみ）
  await writeFile(join(ROOT, "sitemap.xml"), await renderSitemap(posts || []), "utf8");
  console.log("✅ sitemap.xml を更新しました。");

  if (posts === null) return; // 認証情報なし → 記事更新はスキップ

  // 個別記事を書き出し
  for (const p of posts) {
    await writeFile(join(ROOT, "blog", `report-${p.slug}.html`), renderArticle(p), "utf8");
  }
  console.log(`✅ 現場レポート ${posts.length} 件を生成しました。`);

  // blog/index.html の AUTO ブロックを差し替え
  const indexPath = join(ROOT, "blog", "index.html");
  if (existsSync(indexPath)) {
    let html = await readFile(indexPath, "utf8");
    const START = "<!-- AUTO:REPORTS:START";
    const END = "<!-- AUTO:REPORTS:END -->";
    const s = html.indexOf(START);
    const e = html.indexOf(END);
    if (s !== -1 && e !== -1) {
      const block =
        `<!-- AUTO:REPORTS:START — この区間は scripts/generate-blog.mjs が自動生成します。手動編集しないでください。 -->\n` +
        `    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:1.2rem; margin-top:2rem;">\n` +
        renderCards(posts) + `\n    </div>\n    ` + END;
      html = html.slice(0, s) + block + html.slice(e + END.length);
      await writeFile(indexPath, html, "utf8");
      console.log("✅ blog/index.html の現場レポート一覧を更新しました。");
    } else {
      console.warn("⚠️  blog/index.html に AUTO:REPORTS マーカーが見つかりませんでした。");
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
