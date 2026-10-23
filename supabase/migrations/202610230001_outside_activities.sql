-- Outside activities are deliberately separate from gym sessions and progression.
create table public.outside_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity text not null check (char_length(btrim(activity)) between 1 and 100),
  activity_date date not null,
  distance_miles numeric(6,2) not null check (distance_miles > 0 and distance_miles <= 9999.99),
  created_at timestamptz not null default now()
);

create index outside_activities_user_date on public.outside_activities (user_id, activity_date);
alter table public.outside_activities enable row level security;
create policy "users manage own outside activities"
  on public.outside_activities for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
