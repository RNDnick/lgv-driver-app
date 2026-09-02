-- SafeCouple: schema, RLS policies, and storage bucket.
-- Run this once in the Supabase SQL Editor for this project.

-- ── profiles ────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'driver' check (role in ('driver', 'manager')),
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

alter table public.profiles enable row level security;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_manager(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'manager'
  );
$$;

create function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.is_manager(auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

grant select, update on public.profiles to authenticated;

-- ── jobs ────────────────────────────────────────────────────────────────
create table public.jobs (
  id uuid primary key,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'complete')),
  created_at bigint not null,
  customer text,
  collection_site text,
  delivery_site text,
  trailer_reg text,
  mileage_start integer,
  mileage_end integer,
  notes text,
  pod_photo_path text,
  pod_photo_hash text,
  completed_at bigint
);

create index jobs_driver_id_idx on public.jobs (driver_id);
alter table public.jobs enable row level security;

create policy "jobs_select" on public.jobs
  for select using (driver_id = auth.uid() or public.is_manager(auth.uid()));
create policy "jobs_insert" on public.jobs
  for insert with check (driver_id = auth.uid());
create policy "jobs_update" on public.jobs
  for update using (driver_id = auth.uid());
create policy "jobs_delete" on public.jobs
  for delete using (driver_id = auth.uid());

grant select, insert, update, delete on public.jobs to authenticated;

-- ── checklists ──────────────────────────────────────────────────────────
create table public.checklists (
  id uuid primary key,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('connect', 'disconnect')),
  trailer_reg text,
  job_id uuid references public.jobs(id) on delete set null,
  started_at bigint,
  completed_at bigint,
  steps jsonb not null default '[]'::jsonb
);

create index checklists_driver_id_idx on public.checklists (driver_id);
create index checklists_job_id_idx on public.checklists (job_id);
alter table public.checklists enable row level security;

create policy "checklists_select" on public.checklists
  for select using (driver_id = auth.uid() or public.is_manager(auth.uid()));
create policy "checklists_insert" on public.checklists
  for insert with check (driver_id = auth.uid());
create policy "checklists_update" on public.checklists
  for update using (driver_id = auth.uid());
create policy "checklists_delete" on public.checklists
  for delete using (driver_id = auth.uid());

grant select, insert, update, delete on public.checklists to authenticated;

-- ── storage: checklist-photos bucket ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('checklist-photos', 'checklist-photos', false)
on conflict (id) do nothing;

create policy "checklist_photos_select" on storage.objects
  for select using (
    bucket_id = 'checklist-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_manager(auth.uid())
    )
  );

create policy "checklist_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'checklist-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Uploads use upsert:true so a retry after a partial sync failure safely
-- re-uploads to the same deterministic path rather than erroring on
-- "already exists" - which needs update permission on top of insert, not
-- just insert, or every retry past the first successful photo in a given
-- attempt fails with a permission error indistinguishable from an auth
-- problem. Photos are otherwise still effectively immutable in practice:
-- nothing in the app lets a driver edit a checklist once its row exists.
create policy "checklist_photos_update" on storage.objects
  for update using (
    bucket_id = 'checklist-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'checklist-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
