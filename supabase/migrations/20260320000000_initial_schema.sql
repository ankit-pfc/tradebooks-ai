-- TradeBooks AI — Initial Schema
-- Tables map directly to domain types in src/lib/types/domain.ts

-- ---------------------------------------------------------------------------
-- Profiles (auto-created on user signup via trigger)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Batches (maps to BatchRecord)
-- ---------------------------------------------------------------------------
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_name text not null,
  accounting_mode text not null check (accounting_mode in ('investor', 'trader')),
  period_from date not null,
  period_to date not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'needs_review')),
  status_message text,
  file_count integer not null default 0,
  voucher_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.batches enable row level security;

create policy "Users can view own batches"
  on public.batches for select
  using (auth.uid() = user_id);

create policy "Users can insert own batches"
  on public.batches for insert
  with check (auth.uid() = user_id);

create policy "Users can update own batches"
  on public.batches for update
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Batch Files (maps to BatchFileMeta + storage_path)
-- ---------------------------------------------------------------------------
create table public.batch_files (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  detected_type text not null default 'unknown',
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.batch_files enable row level security;

create policy "Users can view own batch files"
  on public.batch_files for select
  using (
    exists (
      select 1 from public.batches
      where batches.id = batch_files.batch_id
        and batches.user_id = auth.uid()
    )
  );

create policy "Users can insert own batch files"
  on public.batch_files for insert
  with check (
    exists (
      select 1 from public.batches
      where batches.id = batch_files.batch_id
        and batches.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Batch Exceptions (maps to BatchException)
-- ---------------------------------------------------------------------------
create table public.batch_exceptions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  code text not null,
  severity text not null check (severity in ('error', 'warning', 'info')),
  message text not null,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.batch_exceptions enable row level security;

create policy "Users can view own batch exceptions"
  on public.batch_exceptions for select
  using (
    exists (
      select 1 from public.batches
      where batches.id = batch_exceptions.batch_id
        and batches.user_id = auth.uid()
    )
  );

create policy "Users can insert own batch exceptions"
  on public.batch_exceptions for insert
  with check (
    exists (
      select 1 from public.batches
      where batches.id = batch_exceptions.batch_id
        and batches.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Batch Processing Results
-- ---------------------------------------------------------------------------
create table public.batch_processing_results (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade unique,
  summary jsonb not null default '{}'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.batch_processing_results enable row level security;

create policy "Users can view own processing results"
  on public.batch_processing_results for select
  using (
    exists (
      select 1 from public.batches
      where batches.id = batch_processing_results.batch_id
        and batches.user_id = auth.uid()
    )
  );

create policy "Users can insert own processing results"
  on public.batch_processing_results for insert
  with check (
    exists (
      select 1 from public.batches
      where batches.id = batch_processing_results.batch_id
        and batches.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Export Artifacts (maps to ExportArtifactRef + storage_path)
-- ---------------------------------------------------------------------------
create table public.export_artifacts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  artifact_type text not null
    check (artifact_type in ('masters_xml', 'transactions_xml', 'reconciliation_json')),
  file_name text not null,
  mime_type text not null default 'application/xml',
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.export_artifacts enable row level security;

create policy "Users can view own export artifacts"
  on public.export_artifacts for select
  using (
    exists (
      select 1 from public.batches
      where batches.id = export_artifacts.batch_id
        and batches.user_id = auth.uid()
    )
  );

create policy "Users can insert own export artifacts"
  on public.export_artifacts for insert
  with check (
    exists (
      select 1 from public.batches
      where batches.id = export_artifacts.batch_id
        and batches.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_batches_user_id on public.batches(user_id);
create index idx_batches_status on public.batches(status);
create index idx_batch_files_batch_id on public.batch_files(batch_id);
create index idx_batch_exceptions_batch_id on public.batch_exceptions(batch_id);
create index idx_export_artifacts_batch_id on public.export_artifacts(batch_id);

-- ---------------------------------------------------------------------------
-- Storage Buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false);

insert into storage.buckets (id, name, public)
values ('exports', 'exports', false);

-- Storage policies: users can only access their own files
create policy "Users can upload own files"
  on storage.objects for insert
  with check (
    bucket_id in ('uploads', 'exports')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read own files"
  on storage.objects for select
  using (
    bucket_id in ('uploads', 'exports')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
