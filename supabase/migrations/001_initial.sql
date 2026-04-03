-- ============================================
-- Profiles
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  updated_at timestamptz default now()
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
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- Subscriptions
-- ============================================
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'cancelled', 'past_due', 'paused')),
  lemon_squeezy_subscription_id text unique,
  lemon_squeezy_customer_id text,
  lemon_squeezy_order_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Service role can insert/update (webhook handler)
create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- Auto-create free subscription on signup
create or replace function public.handle_new_subscription()
returns trigger as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute procedure public.handle_new_subscription();

-- ============================================
-- Usage Logs
-- ============================================
create table if not exists public.usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  action text not null default 'default',
  date date not null default current_date,
  count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, action, date)
);

alter table public.usage_logs enable row level security;

create policy "Users can view own usage"
  on public.usage_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own usage"
  on public.usage_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own usage"
  on public.usage_logs for update
  using (auth.uid() = user_id);
