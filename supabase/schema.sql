-- =====================================================================
--  DREAMERS POS — CƠ SỞ DỮ LIỆU SUPABASE
--  Chạy 1 lần trong Supabase › SQL Editor › New query › Run
-- =====================================================================

-- Mỗi bản ghi của app (1 hoá đơn, 1 món, 1 phòng, …) là 1 dòng.
create table if not exists public.docs (
  collection  text        not null,               -- products, invoices, rooms, bookings, …
  id          text        not null,               -- id của bản ghi trong app
  data        jsonb,                              -- nội dung bản ghi
  deleted     boolean     not null default false, -- xoá mềm (để máy khác biết mà xoá theo)
  ord         integer     not null default 0,     -- thứ tự hiển thị (menu, phòng)
  device      text,                               -- máy đã ghi (để không nhận lại thay đổi của chính mình)
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists docs_updated_at_idx on public.docs (updated_at);

-- Luôn lấy giờ máy chủ cho updated_at (không tin giờ của máy bán hàng)
create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.docs_touch();

-- Bảo mật: chỉ tài khoản đã đăng nhập (tài khoản của cửa hàng) mới đọc/ghi được.
-- NHỚ TẮT đăng ký tự do: Authentication › Sign In / Providers › tắt "Allow new users to sign up".
alter table public.docs enable row level security;
drop policy if exists "shop read"  on public.docs;
drop policy if exists "shop write" on public.docs;
drop policy if exists "shop update" on public.docs;
create policy "shop read"   on public.docs for select to authenticated using (true);
create policy "shop write"  on public.docs for insert to authenticated with check (true);
create policy "shop update" on public.docs for update to authenticated using (true) with check (true);
-- (không cho xoá cứng từ app — app chỉ xoá mềm)

-- Bật Realtime cho bảng docs (máy khác thấy thay đổi ngay)
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- =====================================================================
--  KÊNH ĐẶT PHÒNG (iCal) — mã bí mật cho đường link lịch xuất ra Booking.com / Airbnb
-- =====================================================================
create table if not exists public.ical_tokens (
  room_id text primary key,
  token   text not null default replace(gen_random_uuid()::text, '-', '')
);
alter table public.ical_tokens enable row level security;
drop policy if exists "shop tokens" on public.ical_tokens;
create policy "shop tokens" on public.ical_tokens for all to authenticated using (true) with check (true);
