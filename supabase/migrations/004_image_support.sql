-- Add 'image' to the file_type check constraint
alter table public.documents
  drop constraint if exists documents_file_type_check;

alter table public.documents
  add constraint documents_file_type_check
  check (file_type in ('pdf', 'docx', 'image'));
