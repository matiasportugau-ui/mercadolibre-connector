-- Atomic reply count increment — called only from the trusted API server (service role).
-- Uses auth.uid() so a client cannot increment another user's counter.
-- Revoke public execute and grant only to the service role.
create or replace function increment_reply_count()
returns void language plpgsql security definer
set search_path = public
as $$
begin
  update profiles
  set reply_count_month = reply_count_month + 1
  where id = auth.uid();
end;
$$;

revoke execute on function increment_reply_count() from public;
grant execute on function increment_reply_count() to service_role;
