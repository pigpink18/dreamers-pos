-- =====================================================================
--  DREAMERS POS — CƠ SỞ DỮ LIỆU NHIỀU QUÁN (Supabase)
--  Chạy 1 lần trong Supabase › SQL Editor › New query › dán toàn bộ file này › Run
--  (Chạy lại nhiều lần vẫn an toàn.)
--
--  Mô hình:
--    • Mỗi chủ quán có 1 tài khoản (email + mật khẩu) — tự đăng ký trên app.
--    • 1 tài khoản có thể có nhiều quán (chi nhánh). Mỗi quán là 1 dòng trong `shops`.
--    • `shop_members` cho biết tài khoản nào được vào quán nào.
--    • Mọi dữ liệu của quán (menu, phòng, hoá đơn, nhân viên…) nằm trong `shop_docs`, có cột shop_id.
--    • Bảo mật hàng (RLS): tài khoản CHỈ đọc/ghi được dữ liệu của quán mình là thành viên.
--      Quán khác không thể đọc, ghi hay biết đến dữ liệu của nhau — kể cả khi tự gọi API.
-- =====================================================================

-- ---------- Quán ----------
create table if not exists public.shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 120),
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------- Thành viên quán ----------
create table if not exists public.shop_members (
  shop_id    uuid not null references public.shops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index if not exists shop_members_user_idx on public.shop_members (user_id);

-- Tài khoản đang đăng nhập có phải thành viên của quán không (dùng trong mọi quy tắc bảo mật)
create or replace function public.is_shop_member(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shop_members where shop_id = p_shop and user_id = auth.uid())
$$;
create or replace function public.is_shop_owner(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shop_members where shop_id = p_shop and user_id = auth.uid() and role = 'owner')
$$;

alter table public.shops enable row level security;
drop policy if exists "member reads shop" on public.shops;
drop policy if exists "owner renames shop" on public.shops;
create policy "member reads shop"  on public.shops for select to authenticated using (public.is_shop_member(id));
create policy "owner renames shop" on public.shops for update to authenticated using (public.is_shop_owner(id)) with check (public.is_shop_owner(id));
-- Tạo quán: chỉ qua hàm create_shop bên dưới (để tự thêm người tạo làm chủ quán). Xoá quán: chưa mở cho app.

alter table public.shop_members enable row level security;
drop policy if exists "member reads members" on public.shop_members;
create policy "member reads members" on public.shop_members for select to authenticated
  using (user_id = auth.uid() or public.is_shop_member(shop_id));

-- Tạo quán mới: người gọi tự thành chủ quán. Giới hạn 20 quán / tài khoản để chống lạm dụng.
create or replace function public.create_shop(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if (select count(*) from public.shop_members where user_id = auth.uid() and role = 'owner') >= 20 then
    raise exception 'Mỗi tài khoản tạo tối đa 20 quán';
  end if;
  insert into public.shops (name, created_by) values (trim(p_name), auth.uid()) returning id into v_id;
  insert into public.shop_members (shop_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;
revoke all on function public.create_shop(text) from public, anon;
grant execute on function public.create_shop(text) to authenticated;

-- ---------- Dữ liệu của quán ----------
-- Mỗi bản ghi của app (1 hoá đơn, 1 món, 1 phòng, …) là 1 dòng, thuộc đúng 1 quán.
create table if not exists public.shop_docs (
  shop_id     uuid        not null references public.shops(id) on delete cascade,
  collection  text        not null,               -- products, invoices, rooms, bookings, …
  id          text        not null,               -- id của bản ghi trong app
  data        jsonb,                              -- nội dung bản ghi
  deleted     boolean     not null default false, -- xoá mềm (để máy khác biết mà xoá theo)
  ord         integer     not null default 0,     -- thứ tự hiển thị (menu, phòng)
  device      text,                               -- máy đã ghi (để không nhận lại thay đổi của chính mình)
  updated_at  timestamptz not null default now(),
  primary key (shop_id, collection, id)
);
create index if not exists shop_docs_sync_idx on public.shop_docs (shop_id, updated_at);

-- Luôn lấy giờ máy chủ cho updated_at (không tin giờ của máy bán hàng)
create or replace function public.shop_docs_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists shop_docs_touch on public.shop_docs;
create trigger shop_docs_touch before insert or update on public.shop_docs
  for each row execute function public.shop_docs_touch();

alter table public.shop_docs enable row level security;
drop policy if exists "member reads docs"   on public.shop_docs;
drop policy if exists "member writes docs"  on public.shop_docs;
drop policy if exists "member updates docs" on public.shop_docs;
create policy "member reads docs"   on public.shop_docs for select to authenticated using (public.is_shop_member(shop_id));
create policy "member writes docs"  on public.shop_docs for insert to authenticated with check (public.is_shop_member(shop_id));
create policy "member updates docs" on public.shop_docs for update to authenticated
  using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
-- (không cho xoá cứng từ app — app chỉ xoá mềm)

-- Realtime: máy khác trong CÙNG quán thấy thay đổi ngay (Realtime cũng tuân theo RLS ở trên)
do $$ begin
  alter publication supabase_realtime add table public.shop_docs;
exception when duplicate_object then null; end $$;

-- ---------- Kênh đặt phòng (iCal): mã bí mật cho link lịch của từng phòng ----------
create table if not exists public.shop_ical_tokens (
  shop_id uuid not null references public.shops(id) on delete cascade,
  room_id text not null,
  token   text not null unique default replace(gen_random_uuid()::text, '-', ''),
  primary key (shop_id, room_id)
);
alter table public.shop_ical_tokens enable row level security;
drop policy if exists "member tokens" on public.shop_ical_tokens;
create policy "member tokens" on public.shop_ical_tokens for all to authenticated
  using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
