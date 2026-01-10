-- Core schema for generic Postgres (no Supabase)
-- Safe, idempotent-ish creation with IF NOT EXISTS where supported

-- UUID generation
create extension if not exists pgcrypto;

-- Profiles (minimal)
create table if not exists public.profiles (
  user_id uuid primary key,
  email text unique not null,
  full_name text
);

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  approval_quota int not null default 1,
  admin_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_teams_admin on public.teams(admin_id);

-- Team members
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  unique(team_id, user_id)
);
create index if not exists idx_team_members_user on public.team_members(user_id);

-- Team invitations
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('admin','member')),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  invited_by_user_id uuid,
  created_at timestamptz not null default now(),
  unique(team_id, invited_email, status)
);

-- Folders
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  user_id uuid,
  created_by_email text,
  parent_folder_id uuid references public.folders(id) on delete set null,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_folders_team on public.folders(team_id);
create index if not exists idx_folders_parent on public.folders(parent_folder_id);

-- Queries
create table if not exists public.sql_queries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sql_content text not null,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','rejected')),
  team_id uuid not null references public.teams(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  created_by_email text,
  last_modified_by_email text,
  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_queries_team on public.sql_queries(team_id);
create index if not exists idx_queries_folder on public.sql_queries(folder_id);

-- Update updated_at on change
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;$$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_sql_queries_updated_at'
  ) then
    create trigger trg_sql_queries_updated_at before update on public.sql_queries
    for each row execute function public.set_updated_at();
  end if;
end $$;
