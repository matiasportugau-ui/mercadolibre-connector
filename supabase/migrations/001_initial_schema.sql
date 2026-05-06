-- ML Automator — initial schema
-- Enable uuid extension
create extension if not exists "pgcrypto";

-- ─── Profiles (extends Supabase auth.users) ────────────────────────────────
create table if not exists profiles (
  id                  uuid references auth.users on delete cascade primary key,
  full_name           text,
  plan_id             text not null default 'free',
  subscription_id     text,
  subscription_status text not null default 'active',
  mp_customer_id      text,
  stripe_customer_id  text,
  reply_count_month   int not null default 0,
  reply_count_reset   date not null default current_date,
  created_at          timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "users can read own profile"    on profiles for select using (auth.uid() = id);
create policy "users can update own profile"  on profiles for update using (auth.uid() = id);

-- auto-create profile on new user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── ML Accounts ────────────────────────────────────────────────────────────
create table if not exists ml_accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references profiles on delete cascade not null,
  ml_user_id         text not null,
  ml_nickname        text,
  access_token_enc   text not null,
  refresh_token_enc  text not null,
  expires_at         bigint not null,
  country_site       text not null default 'MLA',
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  unique(user_id, ml_user_id)
);
alter table ml_accounts enable row level security;
create policy "users manage own ml_accounts" on ml_accounts
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Reply Templates ─────────────────────────────────────────────────────────
create table if not exists reply_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles on delete cascade not null,
  name       text not null,
  content    text not null,
  created_at timestamptz not null default now()
);
alter table reply_templates enable row level security;
create policy "users manage own templates" on reply_templates
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Automation Rules ────────────────────────────────────────────────────────
create table if not exists automation_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles on delete cascade not null,
  ml_account_id   uuid references ml_accounts on delete cascade,
  name            text not null,
  enabled         boolean not null default true,
  priority        int not null default 100,
  conditions      jsonb not null default '[]',
  condition_mode  text not null default 'any',
  action          jsonb not null,
  total_matched   int not null default 0,
  last_matched_at timestamptz,
  created_at      timestamptz not null default now()
);
alter table automation_rules enable row level security;
create policy "users manage own rules" on automation_rules
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Webhook Events ──────────────────────────────────────────────────────────
create table if not exists webhook_events (
  id             uuid primary key default gen_random_uuid(),
  ml_account_id  uuid references ml_accounts on delete set null,
  topic          text,
  resource       text,
  raw_body       jsonb,
  processed      boolean not null default false,
  processed_at   timestamptz,
  created_at     timestamptz not null default now()
);
alter table webhook_events enable row level security;
-- service role only — no direct user access

-- ─── Auto Reply Log ──────────────────────────────────────────────────────────
create table if not exists auto_reply_log (
  id             uuid primary key default gen_random_uuid(),
  rule_id        uuid references automation_rules on delete set null,
  ml_account_id  uuid references ml_accounts on delete set null,
  question_id    bigint,
  answer_text    text,
  status         text not null,
  error          text,
  created_at     timestamptz not null default now()
);
alter table auto_reply_log enable row level security;
create policy "users read own reply log" on auto_reply_log for select
  using (
    ml_account_id in (
      select id from ml_accounts where user_id = auth.uid()
    )
  );

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_rules_user_enabled   on automation_rules (user_id, enabled, priority);
create index if not exists idx_webhook_events_topic  on webhook_events (topic, processed, created_at desc);
create index if not exists idx_reply_log_account     on auto_reply_log (ml_account_id, created_at desc);
