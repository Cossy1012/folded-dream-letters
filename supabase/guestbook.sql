-- 在 Supabase 项目的 SQL Editor 执行。公开访客只可读取和新增留言。
begin;
create table if not exists public.guestbook_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'LOEY'
    check (char_length(name) between 1 and 20 and char_length(btrim(name)) > 0),
  body text not null check (char_length(body) between 1 and 300 and char_length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists guestbook_messages_created_idx
  on public.guestbook_messages (created_at desc, id desc);
alter table public.guestbook_messages enable row level security;
revoke all on table public.guestbook_messages from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.guestbook_messages to anon, authenticated;
-- 访客不可自定义 id 或时间，亦不可更新或删除他人的留言。
grant insert (name, body) on table public.guestbook_messages to anon, authenticated;
drop policy if exists "guestbook_public_read" on public.guestbook_messages;
create policy "guestbook_public_read" on public.guestbook_messages
  for select to anon, authenticated using (true);
drop policy if exists "guestbook_public_insert" on public.guestbook_messages;
create policy "guestbook_public_insert" on public.guestbook_messages
  for insert to anon, authenticated
  with check (char_length(name) between 1 and 20 and char_length(btrim(name)) > 0
    and char_length(body) between 1 and 300 and char_length(btrim(body)) > 0);
commit;
