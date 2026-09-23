-- Quanta Analytica GSOC: database schema
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once.

create extension if not exists "pgcrypto";

-- 1. Aggregated news metadata (no full article text is stored)
create table if not exists public.articles (
  id            text primary key,
  url           text not null,
  title         text not null,
  excerpt       text not null default '',
  source_name   text not null,
  domain        text not null,
  source_type   text not null default 'unclassified',
  family        text not null,
  band          text not null default 'unrated',
  aggregator    text not null,
  feed_id       text not null default '',
  published_at  timestamptz not null,
  fetched_at    timestamptz not null default now(),
  lang          text not null default 'en',
  countries     text[] not null default '{}',
  regions       text[] not null default '{}',
  themes        text[] not null default '{}'
);
create index if not exists articles_published_idx on public.articles (published_at desc);
create index if not exists articles_countries_idx on public.articles using gin (countries);
create index if not exists articles_themes_idx    on public.articles using gin (themes);
create index if not exists articles_regions_idx   on public.articles using gin (regions);

-- 2. Saved SitReps and comparisons
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  analyst     text not null default '',
  kind        text not null check (kind in ('sitrep','compare')),
  title       text not null,
  scope       jsonb not null,
  report      jsonb not null,
  evidence    jsonb,
  meta        jsonb
);
create index if not exists reports_created_idx on public.reports (created_at desc);

-- 3. AI usage log (drives the daily cost guard)
create table if not exists public.ai_usage (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  kind              text not null,
  analyst           text not null default '',
  model             text not null default '',
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0
);
create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);

-- 4. Small key-value cache (structural baselines and similar)
create table if not exists public.cache (
  key         text primary key,
  value       jsonb not null,
  expires_at  timestamptz not null
);

-- 5. Ingest log (source health)
create table if not exists public.ingest_runs (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  source      text not null,
  ok          boolean not null,
  count       integer not null default 0,
  detail      jsonb
);
create index if not exists ingest_runs_created_idx on public.ingest_runs (created_at desc);

-- SECURITY: turn on Row Level Security and add NO public policies.
-- The app talks to the database only from the server using the service role key,
-- which bypasses RLS. The public (anon) key can read nothing.
alter table public.articles    enable row level security;
alter table public.reports     enable row level security;
alter table public.ai_usage    enable row level security;
alter table public.cache       enable row level security;
alter table public.ingest_runs enable row level security;
