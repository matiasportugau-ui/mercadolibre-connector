-- Seller reputation snapshots (daily cron)
create table ml_seller_metrics (
  id uuid primary key default gen_random_uuid(),
  ml_account_id uuid references ml_accounts not null,
  snapshot_date date not null,
  level text,                    -- '5_green', '4_light_green', etc.
  power_seller_status text,      -- 'platinum', 'gold', 'silver', null
  total_sales int,
  completed_sales int,
  canceled_sales int,
  delayed_shipments int,
  claims int,
  reputation_score numeric,
  raw jsonb,
  unique(ml_account_id, snapshot_date)
);
alter table ml_seller_metrics enable row level security;
create policy "owner" on ml_seller_metrics
  using (ml_account_id in (select id from ml_accounts where user_id = auth.uid()));

-- Normalized orders from orders_v2 webhook
create table ml_orders (
  id uuid primary key default gen_random_uuid(),
  ml_account_id uuid references ml_accounts not null,
  ml_order_id bigint not null,
  ml_buyer_id bigint,
  buyer_nickname text,
  status text,                   -- 'confirmed', 'cancelled', 'invalid', 'payment_required'
  total_amount numeric,
  currency_id text,
  date_created timestamptz,
  date_closed timestamptz,
  items jsonb,                   -- [{id, title, quantity, unit_price}]
  raw jsonb,
  upserted_at timestamptz default now(),
  unique(ml_account_id, ml_order_id)
);
alter table ml_orders enable row level security;
create policy "owner" on ml_orders
  using (ml_account_id in (select id from ml_accounts where user_id = auth.uid()));

-- Post-sale messages
create table ml_messages (
  id uuid primary key default gen_random_uuid(),
  ml_account_id uuid references ml_accounts not null,
  pack_id bigint not null,
  message_id text not null,
  from_user_id bigint,
  from_role text,                -- 'buyer' | 'seller'
  text text,
  status text,
  auto_replied boolean default false,
  created_at timestamptz,
  upserted_at timestamptz default now(),
  unique(ml_account_id, message_id)
);
alter table ml_messages enable row level security;
create policy "owner" on ml_messages
  using (ml_account_id in (select id from ml_accounts where user_id = auth.uid()));

-- Listing metrics snapshots (daily cron)
create table ml_item_metrics (
  id uuid primary key default gen_random_uuid(),
  ml_account_id uuid references ml_accounts not null,
  ml_item_id text not null,
  snapshot_date date not null,
  title text,
  status text,                   -- 'active', 'paused', 'closed', 'under_review'
  available_quantity int,
  visits int,
  questions_count int,
  raw jsonb,
  unique(ml_account_id, ml_item_id, snapshot_date)
);
alter table ml_item_metrics enable row level security;
create policy "owner" on ml_item_metrics
  using (ml_account_id in (select id from ml_accounts where user_id = auth.uid()));
