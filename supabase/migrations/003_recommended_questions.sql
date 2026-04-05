-- Add recommended_questions column to documents table
alter table public.documents
  add column if not exists recommended_questions jsonb;
