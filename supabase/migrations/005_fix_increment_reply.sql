-- Fix increment_reply_count: service-role context has no auth.uid(), so pass user_id explicitly.
-- Drop the old zero-arg signature first to avoid overload ambiguity.
drop function if exists increment_reply_count();

create or replace function increment_reply_count(target_user_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  update profiles
  set reply_count_month = reply_count_month + 1
  where id = target_user_id;
end;
$$;

revoke execute on function increment_reply_count(uuid) from public;
grant execute on function increment_reply_count(uuid) to service_role;
