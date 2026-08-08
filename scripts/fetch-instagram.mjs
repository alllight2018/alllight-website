#!/usr/bin/env node
/**
 * fetch-instagram.mjs
 * ------------------------------------------------------------------
 * Instagram Graph API から @alllight2018 の最新投稿を取得し、
 * data/instagram.json を更新します（トップ・採用ページに反映）。
 *
 * 必要な環境変数（どちらか一方の方式）:
 *   ● Instagram Graph API（Facebook連携・推奨）
 *       IG_TOKEN     … 長期アクセストークン
 *       IG_USER_ID   … InstagramビジネスアカウントのユーザーID
 *
 * トークンが無いときは何もしません（既存のフォールバック投稿を保持）。
 * 取得後は generate-seo-pages.mjs が各ページへ差し込みます。
 * ------------------------------------------------------------------
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const IG_TOKEN = process.env.IG_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const PROFILE = process.env.IG_PROFILE || "https://www.instagram.com/alllight2018/";

async function main() {
  if (!IG_TOKEN || !IG_USER_ID) {
    console.log("ℹ️  IG_TOKEN / IG_USER_ID 未設定のため、Instagram取得をスキップします（フォールバック投稿を使用）。");
    return;
  }
  const fields = "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp";
  const url = `https://graph.facebook.com/v20.0/${IG_USER_ID}/media?fields=${fields}&limit=12&access_token=${IG_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`⚠️  Instagram取得に失敗 (${res.status})。据え置きます。`); return; }
  const json = await res.json();
  const posts = (json.data || [])
    .filter((m) => m.media_type !== "VIDEO" || m.thumbnail_url)
    .slice(0, 6)
    .map((m) => ({
      image: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url,
      permalink: m.permalink,
      caption: (m.caption || "").slice(0, 80)
    }));
  if (!posts.length) { console.warn("⚠️  取得できた投稿が0件。据え置きます。"); return; }

  const outPath = join(ROOT, "data", "instagram.json");
  let existing = {};
  try { existing = JSON.parse(await readFile(outPath, "utf8")); } catch {}
  const data = { ...existing, profile: PROFILE, posts, updated_at: new Date().toISOString() };
  await writeFile(outPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`✅ Instagram投稿 ${posts.length} 件を data/instagram.json に更新しました。`);
}

main().catch((e) => { console.error(e); process.exit(1); });
