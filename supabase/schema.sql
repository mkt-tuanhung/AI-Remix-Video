-- ─────────────────────────────────────────────────────────────
-- AI Remix Video — schema Supabase (Postgres)
-- Chỉ cần chạy khi STORE_DRIVER=supabase. Mặc định app chạy store filesystem.
-- Chạy trong Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

create table if not exists projects (
  id text primary key,
  user_id text not null,
  title text not null,
  source_video_id text,
  goal text not null default 'remix',
  language text not null default 'vi',
  target_platforms jsonb not null default '[]'::jsonb,
  target_duration_seconds int not null default 60,
  aspect_ratio text not null default '9:16',
  status text not null default 'DRAFT',
  brand_preset_id text,
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists source_videos (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime text not null,
  size_bytes bigint not null,
  duration_seconds double precision,
  width int,
  height int,
  fps double precision,
  has_audio boolean,
  checksum text not null,
  thumbnail_path text,
  created_at timestamptz not null default now()
);

-- id = project_id (1-1 với project)
create table if not exists source_analyses (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  language text,
  transcript text,
  segments jsonb not null default '[]'::jsonb,
  speakers jsonb not null default '[]'::jsonb,
  shots jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  facts jsonb not null default '[]'::jsonb,
  uncertain_claims jsonb not null default '[]'::jsonb,
  main_topic text,
  source_hook text,
  source_cta text,
  conflicts jsonb not null default '[]'::jsonb,
  transcript_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  variant_id text,
  step text not null,
  status text not null default 'pending',
  attempts int not null default 0,
  max_attempts int not null default 3,
  depends_on jsonb not null default '[]'::jsonb,
  progress double precision not null default 0,
  message text,
  error text,
  cost_estimate double precision default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists jobs_project_idx on jobs(project_id);
create index if not exists jobs_status_idx on jobs(status);

-- id = project_id
create table if not exists content_strategies (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  items jsonb not null default '[]'::jsonb
);

-- id = project_id
create table if not exists hooks (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  items jsonb not null default '[]'::jsonb
);

create table if not exists variants (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  platform text not null,
  target_duration_seconds int not null,
  content_angle text,
  hook text,
  script text,
  cta text,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now()
);

create table if not exists scenes (
  id text primary key,
  variant_id text not null references variants(id) on delete cascade,
  "order" int not null,
  narration text,
  purpose text,
  visual_intent text,
  asset_type text,
  asset_id text,
  search_queries jsonb not null default '[]'::jsonb,
  start_time double precision,
  end_time double precision,
  on_screen_text text,
  effect text,
  transition text,
  priority text,
  scene_voice_match_score double precision
);

create table if not exists assets (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  type text not null,
  source_url text,
  source_page_url text,
  provider text,
  license text,
  width int,
  height int,
  duration_seconds double precision,
  has_logo boolean not null default false,
  quality_score double precision,
  relevance_score double precision,
  crop jsonb
);

-- id = variant_id
create table if not exists audio_mixes (
  id text primary key,
  variant_id text not null references variants(id) on delete cascade,
  voice_asset_id text,
  music_asset_id text,
  voice_gain_db double precision not null default 0,
  music_gain_db double precision not null default -18,
  ducking_enabled boolean not null default true,
  ducking_reduction_db double precision not null default 15,
  attack_ms int not null default 200,
  release_ms int not null default 800
);

-- id = variant_id
create table if not exists quality_reports (
  id text primary key,
  variant_id text not null references variants(id) on delete cascade,
  overall_score double precision,
  scene_voice_match double precision,
  fact_consistency double precision,
  voice_quality double precision,
  music_ducking double precision,
  caption_sync double precision,
  creative_difference double precision,
  platform_fit double precision,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- id = variant_id
create table if not exists renders (
  id text primary key,
  variant_id text not null references variants(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  voice_provider text,
  voice_path text,
  duration double precision,
  srt_path text,
  vtt_path text,
  preview_path text,
  final_path text,
  updated_at timestamptz not null default now()
);

create table if not exists brand_presets (
  id text primary key,
  user_id text not null,
  name text not null,
  logo_url text,
  font text,
  colors jsonb,
  intro_url text,
  outro_url text,
  banned_words jsonb
);

create table if not exists batches (
  id text primary key,
  user_id text not null,
  status text not null default 'pending',
  project_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
