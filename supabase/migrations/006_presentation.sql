-- ============================================
-- Presentations
-- ============================================
create table if not exists public.presentations (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  settings jsonb not null,  -- { slides, style, language }
  title text not null,
  data jsonb not null,      -- { title, slides: Slide[] }
  created_at timestamptz default now()
);

alter table public.presentations enable row level security;

create policy "Users can manage own presentations"
  on public.presentations for all
  using (auth.uid() = user_id);

create index if not exists presentations_document_id_idx on public.presentations(document_id);
create index if not exists presentations_user_id_idx on public.presentations(user_id);
