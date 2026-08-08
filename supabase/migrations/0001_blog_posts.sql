-- ============================================================
--  ブログ自動連携用テーブル: public.blog_posts
--  社内アプリ（keiei-os / 社内SNS）から「公開」に設定された
--  コンテンツだけを、公開Webサイトのブログへ流し込むための橋渡しテーブル。
--
--  ★重要★
--  財務・従業員・案件明細などの内部テーブルは絶対に公開しません。
--  公開されるのは、このテーブルに is_public = true で入った行のみです。
--  社内アプリ側で「Webに公開」トグルを押したときだけ、ここに INSERT / UPDATE
--  する運用にしてください（下部の publish_site_report() 例を参照）。
-- ============================================================

create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,                 -- URL用（英数・ハイフン）例: genba-report-koube-chousha
  title         text not null,                        -- 記事タイトル
  category      text not null default '現場レポート',  -- 表示カテゴリ
  excerpt       text,                                 -- 一覧・meta description 用の要約（120字程度）
  body          text not null default '',             -- 本文（プレーンテキスト推奨。改行=段落）
  body_format   text not null default 'text'          -- 'text'（安全・推奨） or 'html'
                 check (body_format in ('text','html')),
  cover_image_url text,                               -- アイキャッチ画像URL（社内アプリのStorage公開URL等）
  is_public     boolean not null default false,       -- ← true の行だけが公開Webに出ます
  source        text default 'site_report',           -- 由来（監査用）: site_report / manual など
  source_id     uuid,                                 -- 由来レコードのID（任意）
  published_at  timestamptz,                          -- 公開日時（一覧の並び順に使用）
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.blog_posts is '公開Webサイトのブログへ流し込む、社内発の公開許可済みコンテンツ。is_public=true の行のみ公開。';

create index if not exists blog_posts_public_idx
  on public.blog_posts (is_public, published_at desc);

-- updated_at 自動更新
create or replace function public.touch_blog_posts_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_blog_posts on public.blog_posts;
create trigger trg_touch_blog_posts before update on public.blog_posts
  for each row execute function public.touch_blog_posts_updated_at();

-- ------------------------------------------------------------
--  RLS: 匿名(anon)は「公開済みの行だけ」読み取り可能。書き込み不可。
-- ------------------------------------------------------------
alter table public.blog_posts enable row level security;

drop policy if exists "public can read published posts" on public.blog_posts;
create policy "public can read published posts"
  on public.blog_posts for select
  to anon
  using (is_public = true);

-- authenticated（社内アプリのログインユーザー）は全操作可（必要に応じて絞ってください）
drop policy if exists "staff can manage posts" on public.blog_posts;
create policy "staff can manage posts"
  on public.blog_posts for all
  to authenticated
  using (true) with check (true);

-- ------------------------------------------------------------
--  （任意）site_reports から「公開」する際に使うヘルパー関数の例。
--  社内アプリの「Webに公開」ボタンから呼び出す想定。
--  ※ site_reports の列名は実スキーマに合わせて調整してください。
-- ------------------------------------------------------------
-- create or replace function public.publish_site_report(p_report_id uuid, p_slug text)
-- returns void language plpgsql security definer as $$
-- begin
--   insert into public.blog_posts (slug, title, excerpt, body, cover_image_url, is_public, source, source_id, published_at)
--   select p_slug, r.title, left(r.body, 120), r.body, r.cover_url, true, 'site_report', r.id, now()
--   from public.site_reports r where r.id = p_report_id
--   on conflict (slug) do update
--     set title = excluded.title, excerpt = excluded.excerpt, body = excluded.body,
--         cover_image_url = excluded.cover_image_url, is_public = true, published_at = now();
-- end $$;
