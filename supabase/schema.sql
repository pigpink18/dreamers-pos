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

-- =====================================================================
--  NHÂN VIÊN ĐĂNG NHẬP BẰNG EMAIL (tuỳ chọn) — mời qua link bí mật
--  Chủ quán / quản lý thêm email cho 1 nhân viên → app tạo link mời → gửi qua Zalo / tin nhắn.
--  Người nhận mở link, đăng ký / đăng nhập ĐÚNG email đó → thành thành viên của quán.
--  Cần cả email khớp lẫn mã bí mật trong link: người lạ biết email cũng không vào được.
-- =====================================================================
alter table public.shop_members add column if not exists pos_user_id text; -- người dùng (PIN) tương ứng trong app
do $$ begin
  alter table public.shop_members drop constraint if exists shop_members_role_check;
  alter table public.shop_members add constraint shop_members_role_check check (role in ('owner', 'manager', 'staff'));
end $$;

-- Vai trò của tài khoản đang đăng nhập trong quán ('owner' | 'manager' | 'staff' | null)
create or replace function public.shop_role(p_shop uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.shop_members where shop_id = p_shop and user_id = auth.uid()
$$;

create table if not exists public.shop_invites (
  shop_id     uuid not null references public.shops(id) on delete cascade,
  email       text not null check (email = lower(email) and position('@' in email) > 1),
  role        text not null check (role in ('manager', 'staff')),
  pos_user_id text,
  token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  invited_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (shop_id, email)
);
alter table public.shop_invites enable row level security;
drop policy if exists "managers read invites" on public.shop_invites;
create policy "managers read invites" on public.shop_invites for select to authenticated
  using (public.shop_role(shop_id) in ('owner', 'manager'));
-- thêm / sửa / xoá lời mời: chỉ qua các hàm bên dưới

-- Mời 1 email vào quán (hoặc đổi vai trò nếu đã là thành viên). Trả về mã bí mật cho link mời.
create or replace function public.invite_member(p_shop uuid, p_email text, p_role text, p_pos_user text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_my text := public.shop_role(p_shop); v_email text := lower(trim(p_email)); v_token text; v_uid uuid;
begin
  if v_my is null or v_my not in ('owner', 'manager') then raise exception 'Không có quyền mời người vào quán'; end if;
  if p_role not in ('manager', 'staff') then raise exception 'Vai trò không hợp lệ'; end if;
  if v_my = 'manager' and p_role <> 'staff' then raise exception 'Quản lý chỉ mời được nhân viên'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email không hợp lệ'; end if;
  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is not null then
    if exists (select 1 from public.shop_members where shop_id = p_shop and user_id = v_uid and role = 'owner') then
      raise exception 'Email này là chủ quán';
    end if;
    -- đã là thành viên: cập nhật vai trò luôn (không cần mời lại)
    update public.shop_members set role = p_role, pos_user_id = p_pos_user where shop_id = p_shop and user_id = v_uid;
    if found then return 'member'; end if;
  end if;
  insert into public.shop_invites (shop_id, email, role, pos_user_id, invited_by)
  values (p_shop, v_email, p_role, p_pos_user, auth.uid())
  on conflict (shop_id, email) do update set role = excluded.role, pos_user_id = excluded.pos_user_id
  returning token into v_token;
  return v_token;
end $$;

-- Nhận lời mời: email của tài khoản đang đăng nhập phải khớp email được mời
create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_inv public.shop_invites; v_email text;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  select * into v_inv from public.shop_invites where token = p_token;
  if v_inv is null then raise exception 'Link mời không còn hiệu lực'; end if;
  if v_inv.email <> v_email then raise exception 'Link mời này dành cho email %', v_inv.email; end if;
  insert into public.shop_members (shop_id, user_id, role, pos_user_id) values (v_inv.shop_id, auth.uid(), v_inv.role, v_inv.pos_user_id)
  on conflict (shop_id, user_id) do update set role = excluded.role, pos_user_id = excluded.pos_user_id
    where public.shop_members.role <> 'owner';
  delete from public.shop_invites where shop_id = v_inv.shop_id and email = v_inv.email;
  return v_inv.shop_id;
end $$;

-- Danh sách người có email trong quán (thành viên + đang chờ nhận lời mời) — chỉ chủ quán / quản lý xem
create or replace function public.list_members(p_shop uuid)
returns table (email text, role text, pos_user_id text, status text, token text)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.shop_role(p_shop), '') not in ('owner', 'manager') then raise exception 'Không có quyền'; end if;
  return query
    select lower(u.email)::text, m.role, m.pos_user_id, 'member'::text, null::text
      from public.shop_members m join auth.users u on u.id = m.user_id where m.shop_id = p_shop
    union all
    select i.email, i.role, i.pos_user_id, 'invited'::text, i.token from public.shop_invites i where i.shop_id = p_shop;
end $$;

-- Thu hồi quyền: xoá thành viên / lời mời (không xoá được chủ quán; quản lý chỉ xoá được nhân viên)
create or replace function public.remove_member(p_shop uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_my text := public.shop_role(p_shop); v_email text := lower(trim(p_email));
begin
  if v_my is null or v_my not in ('owner', 'manager') then raise exception 'Không có quyền'; end if;
  delete from public.shop_members m using auth.users u
   where m.shop_id = p_shop and u.id = m.user_id and lower(u.email) = v_email and m.role <> 'owner'
     and (v_my = 'owner' or m.role = 'staff');
  delete from public.shop_invites i where i.shop_id = p_shop and i.email = v_email and (v_my = 'owner' or i.role = 'staff');
end $$;

revoke all on function public.invite_member(uuid, text, text, text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
revoke all on function public.list_members(uuid) from public, anon;
revoke all on function public.remove_member(uuid, text) from public, anon;
grant execute on function public.invite_member(uuid, text, text, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.list_members(uuid) to authenticated;
grant execute on function public.remove_member(uuid, text) to authenticated;

-- Nhân viên (đăng nhập bằng email của mình) KHÔNG được sửa: người dùng & mã PIN, phân quyền, thông tin quán,
-- quy tắc vận hành, kênh đặt phòng, hoá đơn điện tử. Tài khoản nhận tiền: chỉ chủ quán.
create or replace function public.can_write_doc(p_shop uuid, p_collection text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.shop_role(p_shop) is null then false
    when p_collection = 'payment' then public.shop_role(p_shop) = 'owner'
    when p_collection in ('users', 'roles', 'shop', 'ops', 'channels', 'einvoice') then public.shop_role(p_shop) in ('owner', 'manager')
    else true
  end
$$;
drop policy if exists "member writes docs"  on public.shop_docs;
drop policy if exists "member updates docs" on public.shop_docs;
create policy "member writes docs"  on public.shop_docs for insert to authenticated with check (public.can_write_doc(shop_id, collection));
create policy "member updates docs" on public.shop_docs for update to authenticated
  using (public.is_shop_member(shop_id)) with check (public.can_write_doc(shop_id, collection));
