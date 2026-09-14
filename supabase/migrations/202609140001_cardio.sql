begin;

insert into workout_templates (name, order_index, warmup_notes)
values ('Cardio', 3, 'Choose any cardio option and record your time in minutes. Finish whenever you are done; you do not need to use every machine.')
on conflict (name) do nothing;

insert into exercises (name, category, equipment, load_mode, guidance_summary, setup_cues, execution_cues, common_mistakes, default_increment, unit)
values
  ('Bike', 'Cardio', 'Stationary bike', 'bodyweight', 'Cardio on a stationary bike.', 'Adjust the seat and choose a comfortable resistance.', 'Pedal at your chosen pace and record the total minutes.', 'Avoid a seat position that makes you reach for the pedals.', 0, 'minutes'),
  ('Stair climber', 'Cardio', 'Stair climber', 'bodyweight', 'Cardio on a stair climbing machine.', 'Choose your pace using the machine controls.', 'Step steadily and record the total minutes.', 'Avoid leaning your weight on the rails.', 0, 'minutes'),
  ('Ladder', 'Cardio', 'Jacob''s Ladder treadmill', 'bodyweight', 'Cardio on a Jacob''s Ladder treadmill.', 'Follow the machine instructions for adjusting and securing the belt.', 'Climb at your chosen pace and record the total minutes.', 'Avoid starting faster than you can comfortably control.', 0, 'minutes'),
  ('Row', 'Cardio', 'Rowing machine', 'bodyweight', 'Cardio on a rowing machine.', 'Adjust the foot straps and choose a comfortable resistance.', 'Row at your chosen pace and record the total minutes.', 'Avoid rushing the return portion of each stroke.', 0, 'minutes')
on conflict (name) do nothing;

insert into workout_template_exercises (
  workout_template_id, exercise_id, order_index, target_sets,
  target_seconds_min, starting_seconds_value, progression_rule_type, progression_increment, notes
)
select t.id, e.id, options.position, 1, 0, 0, 'complete_all_sets_increase', 0, 'Optional. Record time in minutes.'
from workout_templates t
cross join (values ('Bike', 1), ('Stair climber', 2), ('Ladder', 3), ('Row', 4)) as options(name, position)
join exercises e on e.name = options.name
where t.name = 'Cardio'
on conflict (workout_template_id, order_index) do nothing;

commit;
