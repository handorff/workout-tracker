create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'load_mode') then
    create type load_mode as enum ('weight', 'assistance', 'bodyweight');
  end if;

  if not exists (select 1 from pg_type where typname = 'progression_rule_type') then
    create type progression_rule_type as enum (
      'top_of_range_increase',
      'complete_all_sets_increase',
      'reduce_assistance'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type session_status as enum ('in_progress', 'completed', 'abandoned');
  end if;

  if not exists (select 1 from pg_type where typname = 'completion_status') then
    create type completion_status as enum ('pending', 'completed');
  end if;
end $$;

create table if not exists workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  order_index integer not null unique,
  warmup_notes text,
  finisher_notes text
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  equipment text,
  load_mode load_mode not null,
  guidance_summary text not null,
  setup_cues text not null,
  execution_cues text not null,
  common_mistakes text not null,
  default_increment numeric(8,2),
  unit text not null
);

create table if not exists workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_template_id uuid not null references workout_templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  order_index integer not null,
  target_sets integer not null,
  target_rep_min integer,
  target_rep_max integer,
  target_seconds_min integer,
  target_seconds_max integer,
  starting_load_value numeric(8,2),
  starting_seconds_value integer,
  progression_rule_type progression_rule_type not null,
  progression_increment numeric(8,2),
  notes text,
  unique (workout_template_id, order_index)
);

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_template_id uuid not null references workout_templates(id) on delete restrict,
  status session_status not null default 'in_progress',
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create unique index if not exists workout_sessions_one_in_progress_per_user
  on workout_sessions (user_id)
  where status = 'in_progress';

create table if not exists exercise_performances (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  exercise_order integer not null,
  recommended_load_value numeric(8,2),
  recommended_seconds_value integer,
  recommendation_text text not null,
  completion_status completion_status not null default 'pending',
  notes text,
  unique (workout_session_id, exercise_order)
);

create table if not exists logged_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_performance_id uuid not null references exercise_performances(id) on delete cascade,
  set_number integer not null,
  load_value numeric(8,2),
  reps integer,
  seconds integer,
  completed boolean not null default false,
  unique (exercise_performance_id, set_number)
);

alter table workout_templates enable row level security;
alter table exercises enable row level security;
alter table workout_template_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table exercise_performances enable row level security;
alter table logged_sets enable row level security;

drop policy if exists "authenticated users read templates" on workout_templates;
create policy "authenticated users read templates"
  on workout_templates
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "authenticated users read exercises" on exercises;
create policy "authenticated users read exercises"
  on exercises
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "authenticated users read template slots" on workout_template_exercises;
create policy "authenticated users read template slots"
  on workout_template_exercises
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "users manage own sessions" on workout_sessions;
create policy "users manage own sessions"
  on workout_sessions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own performances" on exercise_performances;
create policy "users manage own performances"
  on exercise_performances
  for all
  to authenticated
  using (
    exists (
      select 1
      from workout_sessions ws
      where ws.id = exercise_performances.workout_session_id
        and ws.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from workout_sessions ws
      where ws.id = exercise_performances.workout_session_id
        and ws.user_id = auth.uid()
    )
  );

drop policy if exists "users manage own logged sets" on logged_sets;
create policy "users manage own logged sets"
  on logged_sets
  for all
  to authenticated
  using (
    exists (
      select 1
      from exercise_performances ep
      join workout_sessions ws on ws.id = ep.workout_session_id
      where ep.id = logged_sets.exercise_performance_id
        and ws.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from exercise_performances ep
      join workout_sessions ws on ws.id = ep.workout_session_id
      where ep.id = logged_sets.exercise_performance_id
        and ws.user_id = auth.uid()
    )
  );

insert into workout_templates (name, order_index, warmup_notes, finisher_notes)
values
  (
    'Workout A',
    1,
    '5 minutes easy row or bike, then 1 round of: 8 bodyweight squats, 8 hip hinges, 8 arm circles each way, 20-30 second plank.',
    null
  ),
  (
    'Workout B',
    2,
    '5 minutes easy row or bike, then 1 round of: 8 bodyweight squats, 8 hip hinges, 8 arm circles each way, 20-30 second plank.',
    'Optional finisher: 5-8 minutes easy/moderate cardio if time remains.'
  )
on conflict (name) do update
set
  order_index = excluded.order_index,
  warmup_notes = excluded.warmup_notes,
  finisher_notes = excluded.finisher_notes;

insert into exercises (
  name,
  category,
  equipment,
  load_mode,
  guidance_summary,
  setup_cues,
  execution_cues,
  common_mistakes,
  default_increment,
  unit
)
values
  (
    'Goblet Squat',
    'Squat',
    'Dumbbell or kettlebell',
    'weight',
    'Build full-body bracing and comfortable squat mechanics.',
    'Hold the weight close to the chest, brace hard, and plant the whole foot.',
    'Sit down between the hips, keep the chest tall, and drive up through the midfoot.',
    'Do not let the heels lift or let the weight drift away from the body.',
    5,
    'lb'
  ),
  (
    'Dumbbell Bench Press',
    'Push',
    'Dumbbells',
    'weight',
    'Train horizontal pressing with a little more stability demand than a machine.',
    'Set the shoulder blades first and keep both feet planted.',
    'Lower under control and press the dumbbells up in a smooth path.',
    'Do not flare the elbows hard or lose upper-back tension.',
    5,
    'lb'
  ),
  (
    'Assisted Pull-up',
    'Pull',
    'Assisted pull-up machine',
    'assistance',
    'Build vertical pulling strength while gradually reducing assistance.',
    'Set the pad, grip the bar firmly, and start with shoulders active.',
    'Pull elbows down toward the ribs and control the way down.',
    'Do not swing or lose tension at the bottom.',
    5,
    'lb'
  ),
  (
    'Dumbbell Romanian Deadlift',
    'Hinge',
    'Dumbbells',
    'weight',
    'Train glutes, hamstrings, grip, and back tension through a hinge.',
    'Keep the dumbbells close to the legs, soften the knees, and brace before hinging.',
    'Push the hips back until the hamstrings load, then stand tall.',
    'Do not round hard at the bottom or turn it into a squat.',
    5,
    'lb'
  ),
  (
    'Farmer Carry',
    'Carry',
    'Dumbbells or trap handles',
    'weight',
    'Train bracing, grip, posture, and loaded movement.',
    'Stand tall, brace the trunk, and hold the weights evenly.',
    'Walk under control with short steady steps and level shoulders.',
    'Do not lean, shuffle, or let the weights pull the posture apart.',
    null,
    'lb'
  ),
  (
    'Dead Bug',
    'Core',
    'Bodyweight',
    'bodyweight',
    'Train trunk control and rib-to-pelvis positioning.',
    'Flatten the low back gently into the floor before moving.',
    'Reach long with the opposite arm and leg without losing the brace.',
    'Do not let the ribs flare or the low back arch off the floor.',
    null,
    'bodyweight'
  ),
  (
    'Trap-Bar Deadlift',
    'Hinge',
    'Trap bar',
    'weight',
    'Build general lower-body and pulling strength with a friendlier deadlift pattern.',
    'Stand through the middle of the handles, brace, and pack the shoulders.',
    'Push the floor away and finish tall without overleaning back.',
    'Do not yank the first rep or let the hips shoot up early.',
    10,
    'lb'
  ),
  (
    'Split Squat',
    'Single leg',
    'Dumbbells or bodyweight',
    'weight',
    'Train balance, stability, and single-leg strength.',
    'Take a stable stance and stay tall before you descend.',
    'Lower straight down and drive through the front foot to stand.',
    'Do not rush the reps or let the front knee cave inward.',
    5,
    'lb'
  ),
  (
    'Dumbbell Overhead Press',
    'Push',
    'Dumbbells',
    'weight',
    'Train shoulder strength and overhead control.',
    'Brace the trunk, squeeze the glutes, and start with wrists stacked.',
    'Press up smoothly and finish with the biceps close to the ears.',
    'Do not lean back or lose tension through the ribcage.',
    5,
    'lb'
  ),
  (
    'Cable Row',
    'Pull',
    'Cable machine',
    'weight',
    'Build upper-back strength and help offset desk posture.',
    'Set the chest tall and reach long without rounding hard.',
    'Drive elbows back and pause with the shoulder blades set.',
    'Do not yank with momentum or shrug the shoulders up.',
    5,
    'lb'
  ),
  (
    'Side Plank',
    'Core',
    'Bodyweight',
    'bodyweight',
    'Train lateral trunk stability and control.',
    'Stack shoulder over elbow and make one straight line from head to heel.',
    'Brace the abs and squeeze the glutes while you breathe steadily.',
    'Do not let the hips sag or twist open.',
    null,
    'bodyweight'
  )
on conflict (name) do update
set
  category = excluded.category,
  equipment = excluded.equipment,
  load_mode = excluded.load_mode,
  guidance_summary = excluded.guidance_summary,
  setup_cues = excluded.setup_cues,
  execution_cues = excluded.execution_cues,
  common_mistakes = excluded.common_mistakes,
  default_increment = excluded.default_increment,
  unit = excluded.unit;

with template_lookup as (
  select id, name from workout_templates
),
exercise_lookup as (
  select id, name from exercises
)
insert into workout_template_exercises (
  workout_template_id,
  exercise_id,
  order_index,
  target_sets,
  target_rep_min,
  target_rep_max,
  target_seconds_min,
  target_seconds_max,
  starting_load_value,
  starting_seconds_value,
  progression_rule_type,
  progression_increment,
  notes
)
values
  (
    (select id from template_lookup where name = 'Workout A'),
    (select id from exercise_lookup where name = 'Goblet Squat'),
    1,
    3,
    6,
    8,
    null,
    null,
    null,
    null,
    'top_of_range_increase',
    5,
    'Goblet squat is the seeded default. This slot can later support leg press or other squat regressions if needed.'
  ),
  (
    (select id from template_lookup where name = 'Workout A'),
    (select id from exercise_lookup where name = 'Dumbbell Bench Press'),
    2,
    3,
    6,
    8,
    null,
    null,
    null,
    null,
    'top_of_range_increase',
    5,
    'Machine chest press is an acceptable alternative, but dumbbell bench press is the canonical movement in MVP.'
  ),
  (
    (select id from template_lookup where name = 'Workout A'),
    (select id from exercise_lookup where name = 'Assisted Pull-up'),
    3,
    3,
    6,
    8,
    null,
    null,
    null,
    null,
    'reduce_assistance',
    5,
    'Lat pulldown is the fallback alternative when assisted pull-ups are unavailable.'
  ),
  (
    (select id from template_lookup where name = 'Workout A'),
    (select id from exercise_lookup where name = 'Dumbbell Romanian Deadlift'),
    4,
    3,
    8,
    8,
    null,
    null,
    null,
    null,
    'complete_all_sets_increase',
    5,
    'Barbell RDL is a valid alternative once the movement pattern feels stable.'
  ),
  (
    (select id from template_lookup where name = 'Workout A'),
    (select id from exercise_lookup where name = 'Farmer Carry'),
    5,
    3,
    null,
    null,
    30,
    45,
    null,
    30,
    'complete_all_sets_increase',
    0,
    'Increase load conservatively over time if all rounds are stable and posture stays strong.'
  ),
  (
    (select id from template_lookup where name = 'Workout A'),
    (select id from exercise_lookup where name = 'Dead Bug'),
    6,
    3,
    6,
    8,
    null,
    null,
    null,
    null,
    'complete_all_sets_increase',
    0,
    'Dead bug is the default core choice. Front plank and Pallof press remain alternatives in notes only.'
  ),
  (
    (select id from template_lookup where name = 'Workout B'),
    (select id from exercise_lookup where name = 'Trap-Bar Deadlift'),
    1,
    3,
    5,
    5,
    null,
    null,
    null,
    null,
    'complete_all_sets_increase',
    10,
    'If the gym does not have a trap bar, substitute kettlebell deadlift or conservative barbell deadlift outside MVP.'
  ),
  (
    (select id from template_lookup where name = 'Workout B'),
    (select id from exercise_lookup where name = 'Split Squat'),
    2,
    3,
    8,
    8,
    null,
    null,
    null,
    null,
    'complete_all_sets_increase',
    5,
    'Reverse lunge is the alternative, but split squat is the canonical movement in MVP.'
  ),
  (
    (select id from template_lookup where name = 'Workout B'),
    (select id from exercise_lookup where name = 'Dumbbell Overhead Press'),
    3,
    3,
    6,
    8,
    null,
    null,
    null,
    null,
    'top_of_range_increase',
    5,
    'Machine shoulder press is the alternative if dumbbells are not a good fit that day.'
  ),
  (
    (select id from template_lookup where name = 'Workout B'),
    (select id from exercise_lookup where name = 'Cable Row'),
    4,
    3,
    8,
    10,
    null,
    null,
    null,
    null,
    'top_of_range_increase',
    5,
    'Chest-supported row is an acceptable alternative if the cable is unavailable.'
  ),
  (
    (select id from template_lookup where name = 'Workout B'),
    (select id from exercise_lookup where name = 'Side Plank'),
    5,
    3,
    null,
    null,
    20,
    30,
    null,
    20,
    'complete_all_sets_increase',
    0,
    'Side plank is the default core choice. Dead bug and suitcase carry remain alternatives in notes only.'
  )
on conflict (workout_template_id, order_index) do update
set
  exercise_id = excluded.exercise_id,
  target_sets = excluded.target_sets,
  target_rep_min = excluded.target_rep_min,
  target_rep_max = excluded.target_rep_max,
  target_seconds_min = excluded.target_seconds_min,
  target_seconds_max = excluded.target_seconds_max,
  starting_load_value = excluded.starting_load_value,
  starting_seconds_value = excluded.starting_seconds_value,
  progression_rule_type = excluded.progression_rule_type,
  progression_increment = excluded.progression_increment,
  notes = excluded.notes;
