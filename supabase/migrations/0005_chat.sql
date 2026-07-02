-- Maison Obsidian — concierge chat transcripts
--
-- Persists concierge conversations. Rows are written via the log_chat_message
-- RPC (SECURITY DEFINER) so the caller can't spoof user_id — it's stamped from
-- auth.uid() (null for anonymous visitors). Customers can read their own
-- messages; admins can read all. Direct table writes stay closed by RLS.

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id         uuid references auth.users(id) on delete set null,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  source          text,  -- 'claude' | 'fallback'
  created_at      timestamptz not null default now()
);
create index if not exists chat_messages_conversation_idx on public.chat_messages(conversation_id, created_at);
create index if not exists chat_messages_user_idx         on public.chat_messages(user_id);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_select_own" on public.chat_messages;
create policy "chat_select_own"
  on public.chat_messages for select
  using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "chat_admin_select" on public.chat_messages;
create policy "chat_admin_select"
  on public.chat_messages for select
  using (public.is_admin());

create or replace function public.log_chat_message(
  p_conversation_id uuid,
  p_role text,
  p_content text,
  p_source text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role not in ('user', 'assistant') then
    raise exception 'invalid role %', p_role using errcode = 'check_violation';
  end if;
  insert into public.chat_messages (conversation_id, user_id, role, content, source)
  values (p_conversation_id, auth.uid(), p_role, left(coalesce(p_content, ''), 8000), p_source);
end;
$$;

grant execute on function public.log_chat_message(uuid, text, text, text) to anon, authenticated;
