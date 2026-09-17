-- Apply after 001 and 002. No existing business or conversation data is deleted.
-- One workspace per user is the current UI contract; serialize concurrent setup.
create or replace function public.create_business_workspace(
  owner_id uuid, business_name text, business_industry text, business_address text
) returns public.businesses
language plpgsql security definer set search_path = public
as $$
declare workspace public.businesses;
begin
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  select b.* into workspace from public.businesses b
    join public.business_members m on m.business_id = b.id
    where m.user_id = owner_id order by m.created_at limit 1;
  if found then return workspace; end if;
  insert into public.businesses(name, industry, address)
    values (trim(business_name), trim(business_industry), trim(business_address))
    returning * into workspace;
  insert into public.business_members(business_id, user_id, role)
    values (workspace.id, owner_id, 'owner');
  return workspace;
end;
$$;
revoke all on function public.create_business_workspace(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.create_business_workspace(uuid,text,text,text) to service_role;

create or replace function public.match_document_chunks(
  query_embedding vector(768), match_business_id uuid, match_count int
) returns table(id uuid, document_id uuid, filename text, chunk_text text, similarity float)
language sql stable set search_path = public
as $$
  select c.id, c.document_id, d.filename, c.chunk_text,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c join public.documents d
    on d.id = c.document_id and d.business_id = c.business_id
  where c.business_id = match_business_id and d.status = 'ready'
  order by c.embedding <=> query_embedding limit least(greatest(match_count, 1), 20);
$$;

-- Browser clients read tenant data; mutations go through checked API routes.
drop policy if exists "members can manage faqs" on public.faqs;
drop policy if exists "members can manage conversations" on public.conversations;
drop policy if exists "members can manage messages" on public.messages;
drop policy if exists "members can read faqs" on public.faqs;
drop policy if exists "members can read conversations" on public.conversations;
drop policy if exists "members can read messages" on public.messages;
create policy "members can read faqs" on public.faqs for select using (public.is_business_member(business_id));
create policy "members can read conversations" on public.conversations for select using (public.is_business_member(business_id));
create policy "members can read messages" on public.messages for select using (public.is_business_member(business_id));
create index if not exists idx_customer_conversations on public.conversations(customer_id, business_id, created_at desc);
