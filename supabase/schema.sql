-- Qorli Tog' stansiyasi — Supabase sxemasi
-- Supabase dashboard: SQL Editor'ga shu faylni to'liq nusxalab, "Run" bosing.

create table if not exists signals (
  name       text primary key,
  state      text not null check (state in ('green', 'red')),
  device     text,
  updated_at timestamptz not null default now()
);

create table if not exists archive (
  id         bigint generated always as identity primary key,
  name       text not null,
  state      text not null check (state in ('green', 'red')),
  device     text,
  ts         bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists archive_ts_idx on archive (ts desc);

-- Realtime: signals va archive jadvalidagi o'zgarishlar frontendga jonli yuborilishi uchun
alter publication supabase_realtime add table signals;
alter publication supabase_realtime add table archive;

-- RLS: brauzer (anon key) faqat o'qiy oladi; yozish faqat service_role
-- (Vercel serverless funksiyasi) orqali, u RLS'ni chetlab o'tadi.
alter table signals enable row level security;
alter table archive enable row level security;

create policy "signals_public_read" on signals
  for select using (true);

create policy "archive_public_read" on archive
  for select using (true);
