-- Qorli Tog' stansiyasi — Supabase sxemasi
-- Supabase dashboard: SQL Editor'ga shu faylni to'liq nusxalab, "Run" bosing.

create table if not exists signals (
  name       text primary key,
  state      text not null default 'red' check (state in ('green', 'red')),
  device     text,
  voltage    numeric,
  updated_at timestamptz not null default now()
);

-- Eski bazalarda ustun bo'lmasa qo'shib qo'yadi (yangi o'rnatishda no-op)
alter table signals add column if not exists voltage numeric;
alter table signals alter column state set default 'red';

create table if not exists archive (
  id         bigint generated always as identity primary key,
  name       text not null,
  state      text not null check (state in ('green', 'red')),
  device     text,
  ts         bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists archive_ts_idx on archive (ts desc);

-- Rels zanjiri kuchlanishi: har bir seksiya uchun 2 ta ZMPT101B (quvvat
-- tomoni + rele tomoni), 3 ta alohida ESP32 (esp32-3, esp32-4, esp32-5)
-- orqali yuboriladi. 'signals' jadvalidagi 'voltage' ustunidan farqli —
-- bu butunlay alohida qurilmalar va seksiyalarning to'liq ro'yxati uchun.
create table if not exists rail_voltages (
  name           text primary key,
  power_voltage  numeric,
  relay_voltage  numeric,
  device         text,
  updated_at     timestamptz not null default now()
);

-- Realtime: signals, archive va rail_voltages jadvalidagi o'zgarishlar
-- frontendga jonli yuborilishi uchun
alter publication supabase_realtime add table signals;
alter publication supabase_realtime add table archive;
alter publication supabase_realtime add table rail_voltages;

-- RLS: brauzer (anon key) faqat o'qiy oladi; yozish faqat service_role
-- (Vercel serverless funksiyasi) orqali, u RLS'ni chetlab o'tadi.
alter table signals enable row level security;
alter table archive enable row level security;
alter table rail_voltages enable row level security;

create policy "signals_public_read" on signals
  for select using (true);

create policy "archive_public_read" on archive
  for select using (true);

create policy "rail_voltages_public_read" on rail_voltages
  for select using (true);

-- Arxivga yozishni Postgres'ning o'ziga topshirish: avval Vercel funksiyasi
-- signals'ni SELECT qilib holatni qo'lda solishtirar, keyin alohida INSERT
-- qilardi — bu ESP32'dan har bir so'rov uchun 3 ta ketma-ket Supabase
-- so'rovi (va sekundlab kechikish) degani edi. Endi bitta UPSERT yetarli,
-- haqiqiy o'zgarishni trigger o'zi aniqlab arxivga yozadi.
create or replace function log_signal_change() returns trigger as $$
begin
  if (TG_OP = 'INSERT') or (NEW.state is distinct from OLD.state) then
    insert into archive (name, state, device, ts)
    values (NEW.name, NEW.state, NEW.device, (extract(epoch from NEW.updated_at) * 1000)::bigint);
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists signals_archive_trigger on signals;
create trigger signals_archive_trigger
  after insert or update on signals
  for each row execute function log_signal_change();
