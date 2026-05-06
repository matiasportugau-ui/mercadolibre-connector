-- Atomic reply count increment used by the automation engine
create or replace function increment_reply_count(user_id_arg uuid)
returns void language plpgsql security definer as $$
begin
  update profiles
  set reply_count_month = reply_count_month + 1
  where id = user_id_arg;
end;
$$;
