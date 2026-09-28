begin;

-- Keep the RDL exercise intact so past workouts retain their original identity.
insert into exercises (
  name, category, equipment, load_mode, guidance_summary, setup_cues,
  execution_cues, common_mistakes, default_increment, unit
)
values (
  'Dumbbell Glute Bridge',
  'Hinge',
  'Dumbbell and exercise mat',
  'weight',
  'Train hip extension with an emphasis on the glutes and help from the hamstrings.',
  'Lie on your back with knees bent and feet flat, hip-width apart. Place a padded dumbbell across your hips and hold it steady with both hands.',
  'Brace your stomach, squeeze your glutes, and lift until shoulders, hips, and knees form a straight line. Pause briefly, then lower slowly.',
  'Do not arch your lower back, flare your ribs, or bounce the weight. Keep both feet planted.',
  5,
  'lb'
)
on conflict (name) do nothing;

update workout_template_exercises wte
set
  exercise_id = (select id from exercises where name = 'Dumbbell Glute Bridge'),
  target_sets = 3,
  target_rep_min = 10,
  target_rep_max = 15,
  target_seconds_min = null,
  target_seconds_max = null,
  starting_load_value = 0,
  starting_seconds_value = null,
  progression_rule_type = 'top_of_range_increase',
  progression_increment = 5,
  notes = 'Rest 60-90 seconds between sets. Start with bodyweight (log 0 lb), then add a padded dumbbell held across the hips. Log the weight of the single dumbbell. Add 5 lb once all three sets reach 15 controlled reps.'
where wte.workout_template_id = (select id from workout_templates where name = 'Workout A')
  and wte.exercise_id = (select id from exercises where name = 'Dumbbell Romanian Deadlift');

commit;
