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

-- Rele tomoni chegaralari: har bir seksiya uchun alohida (quvvat tomonidan
-- farqli — u barcha seksiyalarda bir xil, shuning uchun trigger ichida
-- qat'iy son sifatida yozilgan). Qiymatlar boshida bo'sh (NULL) — sensorlar
-- ulanib kalibrlangandan keyin foydalanuvchi o'zi to'ldiradi/yangilaydi.
-- NULL bo'lgan seksiyada rele tomoni uchun ogohlantirish ishlamaydi.
create table if not exists rail_voltage_limits (
  name       text primary key,
  relay_high numeric,
  relay_low  numeric
);

insert into rail_voltage_limits (name) values
  ('2СП'), ('1ЧП'), ('1НП'), ('IП'), ('1СП'),
  ('4-6СП'), ('IIП'), ('3-5СП'), ('IVП')
on conflict (name) do nothing;

-- Kuchlanish ogohlantirishlari arxivi: chegaradan chiqqanda ("boshlandi")
-- va qaytib normal holatga qaytganda ("tugadi") — ikkalasi ham yoziladi.
create table if not exists rail_voltage_archive (
  id         bigint generated always as identity primary key,
  name       text not null,
  side       text not null check (side in ('power', 'relay')),
  event      text not null check (event in ('high_start', 'high_end', 'low_start', 'low_end')),
  voltage    numeric,
  device     text,
  ts         timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rail_voltage_archive_ts_idx on rail_voltage_archive (ts desc);

-- Realtime: signals, archive, rail_voltages va rail_voltage_archive
-- jadvalidagi o'zgarishlar frontendga jonli yuborilishi uchun.
-- Shart bilan qo'shiladi — fayl qayta-qayta ishga tushirilsa ham
-- ("allaqachon a'zo" xatosisiz) xavfsiz.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'signals') then
    alter publication supabase_realtime add table signals;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'archive') then
    alter publication supabase_realtime add table archive;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rail_voltages') then
    alter publication supabase_realtime add table rail_voltages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rail_voltage_archive') then
    alter publication supabase_realtime add table rail_voltage_archive;
  end if;
end $$;

-- RLS: brauzer (anon key) faqat o'qiy oladi; yozish faqat service_role
-- (Vercel serverless funksiyasi) orqali, u RLS'ni chetlab o'tadi.
alter table signals enable row level security;
alter table archive enable row level security;
alter table rail_voltages enable row level security;
alter table rail_voltage_limits enable row level security;
alter table rail_voltage_archive enable row level security;

create policy "signals_public_read" on signals
  for select using (true);

create policy "archive_public_read" on archive
  for select using (true);

create policy "rail_voltages_public_read" on rail_voltages
  for select using (true);

create policy "rail_voltage_limits_public_read" on rail_voltage_limits
  for select using (true);

create policy "rail_voltage_archive_public_read" on rail_voltage_archive
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

-- Rels zanjiri kuchlanishi bo'yicha ogohlantirish: chegaradan chiqish va
-- qaytib normal holatga tushish — ikkalasi ham rail_voltage_archive'ga
-- yoziladi (faqat chegarani kesib o'tgan payt, har yangilanishda emas).
-- Quvvat tomoni: barcha seksiyalarda bir xil (235V yuqori, 185V past).
-- Rele tomoni: har seksiyaning o'z chegarasi (rail_voltage_limits), NULL
-- bo'lsa o'sha seksiyada rele tomoni uchun ogohlantirish o'chirilgan.
create or replace function log_voltage_alarm() returns trigger as $$
declare
  power_high constant numeric := 235;
  power_low  constant numeric := 185;
  r_high numeric;
  r_low  numeric;
  old_power numeric;
  old_relay numeric;
begin
  if TG_OP = 'INSERT' then
    old_power := null;
    old_relay := null;
  else
    old_power := OLD.power_voltage;
    old_relay := OLD.relay_voltage;
  end if;

  if NEW.power_voltage is not null then
    if NEW.power_voltage > power_high and (old_power is null or old_power <= power_high) then
      insert into rail_voltage_archive (name, side, event, voltage, device)
      values (NEW.name, 'power', 'high_start', NEW.power_voltage, NEW.device);
    elsif NEW.power_voltage <= power_high and old_power is not null and old_power > power_high then
      insert into rail_voltage_archive (name, side, event, voltage, device)
      values (NEW.name, 'power', 'high_end', NEW.power_voltage, NEW.device);
    end if;

    if NEW.power_voltage < power_low and (old_power is null or old_power >= power_low) then
      insert into rail_voltage_archive (name, side, event, voltage, device)
      values (NEW.name, 'power', 'low_start', NEW.power_voltage, NEW.device);
    elsif NEW.power_voltage >= power_low and old_power is not null and old_power < power_low then
      insert into rail_voltage_archive (name, side, event, voltage, device)
      values (NEW.name, 'power', 'low_end', NEW.power_voltage, NEW.device);
    end if;
  end if;

  select relay_high, relay_low into r_high, r_low
  from rail_voltage_limits where name = NEW.name;

  if NEW.relay_voltage is not null and r_high is not null then
    if NEW.relay_voltage > r_high and (old_relay is null or old_relay <= r_high) then
      insert into rail_voltage_archive (name, side, event, voltage, device)
      values (NEW.name, 'relay', 'high_start', NEW.relay_voltage, NEW.device);
    elsif NEW.relay_voltage <= r_high and old_relay is not null and old_relay > r_high then
      insert into rail_voltage_archive (name, side, event, voltage, device)
      values (NEW.name, 'relay', 'high_end', NEW.relay_voltage, NEW.device);
    end if;
  end if;

  if NEW.relay_voltage is not null and r_low is not null then
    if NEW.relay_voltage < r_low and (old_relay is null or old_relay >= r_low) then
      insert into rail_voltage_archive (name, side, event, voltage, device)
      values (NEW.name, 'relay', 'low_start', NEW.relay_voltage, NEW.device);
    elsif NEW.relay_voltage >= r_low and old_relay is not null and old_relay < r_low then
      insert into rail_voltage_archive (name, side, event, voltage, device)
      values (NEW.name, 'relay', 'low_end', NEW.relay_voltage, NEW.device);
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists rail_voltage_alarm_trigger on rail_voltages;
create trigger rail_voltage_alarm_trigger
  after insert or update on rail_voltages
  for each row execute function log_voltage_alarm();
