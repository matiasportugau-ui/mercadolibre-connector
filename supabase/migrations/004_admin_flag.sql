-- Add is_admin flag to profiles
alter table profiles add column if not exists is_admin boolean not null default false;
