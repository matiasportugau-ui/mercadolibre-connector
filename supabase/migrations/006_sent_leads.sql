-- Sent leads pipeline — richer context than auto_reply_log for CRM/reports use.
-- Populated on every manual or automated question reply.
create table sent_leads (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references profiles on delete cascade not null,
  ml_account_id    uuid references ml_accounts on delete cascade not null,
  question_id      bigint not null,
  question_text    text,
  item_id          text,
  item_title       text,
  buyer_id         bigint,
  quote_text       text,
  sent_at          timestamptz not null default now(),
  source           text not null default 'manual', -- 'manual' | 'auto'
  rule_name        text,
  follow_up_at     timestamptz,
  follow_up_status text not null default 'pending', -- 'pending' | 'sent' | 'skipped' | 'converted'
  notes            text,
  created_at       timestamptz not null default now()
);
alter table sent_leads enable row level security;
create policy "owner_read"   on sent_leads for select using (user_id = auth.uid());
create policy "owner_insert" on sent_leads for insert with check (user_id = auth.uid());
create policy "owner_update" on sent_leads for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create index idx_sent_leads_user      on sent_leads (user_id, sent_at desc);
create index idx_sent_leads_followup  on sent_leads (follow_up_at) where follow_up_status = 'pending';
