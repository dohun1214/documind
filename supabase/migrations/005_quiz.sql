-- ============================================
-- Quizzes
-- ============================================
create table if not exists public.quizzes (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  settings jsonb not null,    -- { count, difficulty, type }
  questions jsonb not null,   -- QuizQuestion[]
  created_at timestamptz default now()
);

alter table public.quizzes enable row level security;

create policy "Users can manage own quizzes"
  on public.quizzes for all
  using (auth.uid() = user_id);

create index if not exists quizzes_document_id_idx on public.quizzes(document_id);
create index if not exists quizzes_user_id_idx on public.quizzes(user_id);

-- ============================================
-- Quiz Results
-- ============================================
create table if not exists public.quiz_results (
  id uuid default gen_random_uuid() primary key,
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  score integer not null,
  total integer not null,
  answers jsonb not null,   -- { [questionId]: { userAnswer, correct } }[]
  completed_at timestamptz default now()
);

alter table public.quiz_results enable row level security;

create policy "Users can manage own quiz results"
  on public.quiz_results for all
  using (auth.uid() = user_id);

create index if not exists quiz_results_quiz_id_idx on public.quiz_results(quiz_id);
