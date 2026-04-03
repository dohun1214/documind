-- ============================================
-- Documents
-- ============================================
create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  file_url text not null,
  file_type text not null check (file_type in ('pdf', 'docx')),
  file_size integer,
  page_count integer,
  char_count integer,
  summary text,
  key_points jsonb,          -- string[]
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.documents enable row level security;

create policy "Users can manage own documents"
  on public.documents for all
  using (auth.uid() = user_id);

-- ============================================
-- Chunks
-- ============================================
create table if not exists public.chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  chunk_index integer not null,
  content text not null,
  page_number integer,
  created_at timestamptz default now()
);

alter table public.chunks enable row level security;

create policy "Users can read own document chunks"
  on public.chunks for select
  using (
    exists (
      select 1 from public.documents
      where documents.id = chunks.document_id
        and documents.user_id = auth.uid()
    )
  );

create policy "Service role can manage chunks"
  on public.chunks for all
  using (auth.role() = 'service_role');

-- Index for fast chunk lookups
create index if not exists chunks_document_id_idx on public.chunks(document_id);
create index if not exists chunks_document_chunk_idx on public.chunks(document_id, chunk_index);

-- ============================================
-- Conversations
-- ============================================
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  question text not null,
  answer text not null,
  created_at timestamptz default now()
);

alter table public.conversations enable row level security;

create policy "Users can manage own conversations"
  on public.conversations for all
  using (auth.uid() = user_id);

create index if not exists conversations_document_id_idx on public.conversations(document_id);

-- ============================================
-- Storage bucket for documents
-- ============================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Users can upload own documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read own documents"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
