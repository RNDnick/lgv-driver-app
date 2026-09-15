-- SafeCouple: schema, RLS policies, and storage bucket.
-- Run this once in the Supabase SQL Editor for this project.

-- ── companies ───────────────────────────────────────────────────────────
-- Every fleet (paying customer) is a company. Every other table below is
-- scoped to one, so one fleet's manager can never see another fleet's data
-- - a signup always creates its own new company (see handle_new_user below);
-- there's no self-serve "join an existing company" flow yet, that's a known
-- gap until there's a real second paying customer.
create table public.companies (
  id uuid primary key,
  name text not null,
  created_at bigint not null
);

-- ── profiles ────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  full_name text,
  role text not null default 'driver' check (role in ('driver', 'manager')),
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index profiles_company_id_idx on public.profiles (company_id);
alter table public.profiles enable row level security;

-- Every signup creates its own new company and becomes its first (driver)
-- member - promoting that account to 'manager' is still the manual Table
-- Editor step it always was.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
begin
  insert into public.companies (id, name, created_at)
  values (
    gen_random_uuid(),
    coalesce(new.raw_user_meta_data ->> 'company_name', 'My Company'),
    (extract(epoch from now()) * 1000)::bigint
  )
  returning id into new_company_id;

  insert into public.profiles (id, company_id, full_name)
  values (new.id, new_company_id, new.raw_user_meta_data ->> 'full_name');

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

-- security definer so it bypasses RLS itself (same reasoning as is_manager
-- above) - every company-scoped policy below calls this rather than
-- repeating the subquery, and rather than risking a recursive-policy issue
-- by selecting from profiles under profiles' own RLS.
create function public.my_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.profiles where id = auth.uid();
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
  for select using (
    auth.uid() = id
    or (public.is_manager(auth.uid()) and company_id = public.my_company_id())
  );

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

grant select, update on public.profiles to authenticated;

-- ── jobs ────────────────────────────────────────────────────────────────
create table public.jobs (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
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
create index jobs_company_id_idx on public.jobs (company_id);
alter table public.jobs enable row level security;

create policy "jobs_select" on public.jobs
  for select using (
    driver_id = auth.uid()
    or (public.is_manager(auth.uid()) and company_id = public.my_company_id())
  );
create policy "jobs_insert" on public.jobs
  for insert with check (driver_id = auth.uid() and company_id = public.my_company_id());
create policy "jobs_update" on public.jobs
  for update using (driver_id = auth.uid());
create policy "jobs_delete" on public.jobs
  for delete using (driver_id = auth.uid());

grant select, insert, update, delete on public.jobs to authenticated;

-- ── checklists ──────────────────────────────────────────────────────────
create table public.checklists (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('connect', 'disconnect', 'close-connect', 'close-disconnect')),
  trailer_reg text,
  job_id uuid references public.jobs(id) on delete set null,
  started_at bigint,
  completed_at bigint,
  steps jsonb not null default '[]'::jsonb
);

create index checklists_driver_id_idx on public.checklists (driver_id);
create index checklists_job_id_idx on public.checklists (job_id);
create index checklists_company_id_idx on public.checklists (company_id);
alter table public.checklists enable row level security;

create policy "checklists_select" on public.checklists
  for select using (
    driver_id = auth.uid()
    or (public.is_manager(auth.uid()) and company_id = public.my_company_id())
  );
create policy "checklists_insert" on public.checklists
  for insert with check (driver_id = auth.uid() and company_id = public.my_company_id());
create policy "checklists_update" on public.checklists
  for update using (driver_id = auth.uid());
create policy "checklists_delete" on public.checklists
  for delete using (driver_id = auth.uid());

grant select, insert, update, delete on public.checklists to authenticated;

-- ── walkaround_checks ───────────────────────────────────────────────────
-- The daily HGV pre-trip check - separate from trailer coupling, done every
-- shift. RLS mirrors checklists exactly, same reasoning throughout.
create table public.walkaround_checks (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_reg text not null,
  started_at bigint,
  completed_at bigint,
  items jsonb not null default '[]'::jsonb
);

create index walkaround_checks_driver_id_idx on public.walkaround_checks (driver_id);
create index walkaround_checks_company_id_idx on public.walkaround_checks (company_id);
alter table public.walkaround_checks enable row level security;

create policy "walkaround_checks_select" on public.walkaround_checks
  for select using (
    driver_id = auth.uid()
    or (public.is_manager(auth.uid()) and company_id = public.my_company_id())
  );
create policy "walkaround_checks_insert" on public.walkaround_checks
  for insert with check (driver_id = auth.uid() and company_id = public.my_company_id());
create policy "walkaround_checks_update" on public.walkaround_checks
  for update using (driver_id = auth.uid());
create policy "walkaround_checks_delete" on public.walkaround_checks
  for delete using (driver_id = auth.uid());

grant select, insert, update, delete on public.walkaround_checks to authenticated;

-- ── defects ─────────────────────────────────────────────────────────────
-- Raised from either check (a walkaround item marked "Defect", or the
-- optional "Report a defect" affordance on a coupling checklist step).
-- Deliberately asymmetric RLS: a driver can raise and read their own
-- defects, but can never change one's status themselves - only a
-- same-company manager can move it open -> acknowledged -> resolved. That
-- asymmetry is what makes the trail a real audit record instead of
-- something a driver could quietly self-close, which is the actual point
-- of this feature for a transport manager's compliance exposure.
create table public.defects (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('walkaround', 'coupling')),
  source_id uuid not null,
  item_label text not null,
  vehicle_reg text,
  description text not null,
  photo_path text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at bigint not null,
  acknowledged_at bigint,
  resolved_at bigint,
  resolved_notes text
);

create index defects_driver_id_idx on public.defects (driver_id);
create index defects_company_id_idx on public.defects (company_id);
create index defects_status_idx on public.defects (status);
alter table public.defects enable row level security;

create policy "defects_select" on public.defects
  for select using (
    driver_id = auth.uid()
    or (public.is_manager(auth.uid()) and company_id = public.my_company_id())
  );
create policy "defects_insert" on public.defects
  for insert with check (driver_id = auth.uid() and company_id = public.my_company_id());
create policy "defects_update" on public.defects
  for update using (public.is_manager(auth.uid()) and company_id = public.my_company_id())
  with check (public.is_manager(auth.uid()) and company_id = public.my_company_id());

-- No driver update grant/policy at all (see comment above) - the client
-- inserts defects with upsert(..., { ignoreDuplicates: true }) so a retry
-- after a dropped response does a harmless ON CONFLICT DO NOTHING instead
-- of needing UPDATE privilege, which a driver must never have here.
grant select, insert, update on public.defects to authenticated;

-- ── feedback ────────────────────────────────────────────────────────────
create table public.feedback (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at bigint not null
);

create index feedback_driver_id_idx on public.feedback (driver_id);
create index feedback_company_id_idx on public.feedback (company_id);
alter table public.feedback enable row level security;

-- Attributed, not anonymous, so a manager can follow up on a message.
create policy "feedback_select" on public.feedback
  for select using (
    driver_id = auth.uid()
    or (public.is_manager(auth.uid()) and company_id = public.my_company_id())
  );
create policy "feedback_insert" on public.feedback
  for insert with check (driver_id = auth.uid() and company_id = public.my_company_id());

-- The client sends feedback via upsert() for retry-safety (same reasoning as
-- checklist_photos_update above: a retried send after a dropped response
-- reuses the same client-generated id, which becomes an UPDATE on conflict)
-- - that needs actual UPDATE privilege/policy, not just INSERT, or every
-- retry past a successful-but-unconfirmed first send fails with a permission
-- error indistinguishable from an auth problem. Still effectively immutable
-- in practice: nothing in the app lets a driver edit a message once sent.
create policy "feedback_update" on public.feedback
  for update using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

grant select, insert, update on public.feedback to authenticated;

-- ── storage: checklist-photos bucket ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('checklist-photos', 'checklist-photos', false)
on conflict (id) do nothing;

-- storage.objects has no company_id column of its own, so the manager-bypass
-- branch here joins from the driver_id folder segment back to that driver's
-- own profile to compare companies, rather than a flat column check.
create policy "checklist_photos_select" on storage.objects
  for select using (
    bucket_id = 'checklist-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        public.is_manager(auth.uid())
        and exists (
          select 1 from public.profiles p
          where p.id = ((storage.foldername(name))[1])::uuid
          and p.company_id = public.my_company_id()
        )
      )
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

-- No delete capability in the app itself (photos are meant to be permanent
-- evidence) - this exists purely so a manager can clear out orphaned photos
-- left behind by a deleted duplicate/erroneous checklist row, via the
-- Storage API (Supabase blocks direct SQL DELETE on storage.objects).
create policy "checklist_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'checklist-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        public.is_manager(auth.uid())
        and exists (
          select 1 from public.profiles p
          where p.id = ((storage.foldername(name))[1])::uuid
          and p.company_id = public.my_company_id()
        )
      )
    )
  );
