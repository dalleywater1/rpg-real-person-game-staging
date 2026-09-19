/* RPG v0.02.17 — Exercise Library, Workout Library & Workout Builder
   (Astra Strength Library handover, 2026-09-11). Implements the approved
   spec: a searchable canonical Exercise Library (~150-180 built-ins,
   de-duplicated per section 11 — one canonical record per movement, cross-
   cutting muscle/context carried in `categories` rather than duplicate
   rows), instant live local search with ranked matching (name > alias >
   tag, section 19), Recent/Favourites, Custom Exercises, a Workout
   Library (My Workouts / RPG Templates / Recent) and Workout Builder
   (planned template, never overwritten by actual performance — section
   14), wired into the existing Strength Journal's "Add Exercise" flow.

   primaryMuscle uses the approved 11-value filter vocabulary (section 7);
   finer-grained tags (e.g. "hamstrings" vs the filter's single "Legs"
   bucket) live in `categories` so searches like "hamstring unilateral"
   (section 8's own example) still work without adding filter buckets the
   spec didn't ask for. */

/* ---------- Canonical exercise data ----------
   Compact tuple rows -> full objects via EL_row(), far less error-prone
   than 180 hand-written object literals for the same data.
   Row shape: [id, name, aliases(csv), primaryMuscle, secondaryMuscles(csv),
   equipment, movement, flags('u'=unilateral 'c'=compound 'b'=bodyweight),
   categories(csv, lowercase, extra search tags beyond the fields above)] */
const EXERCISE_ROWS=[
['barbell_bench_press','Barbell Bench Press','Bench Press,Flat Bench Press','Chest','','Barbell','Push','c',''],
['incline_barbell_bench_press','Incline Barbell Bench Press','Incline Bench Press','Chest','Shoulders','Barbell','Push','c',''],
['decline_barbell_bench_press','Decline Barbell Bench Press','','Chest','','Barbell','Push','c',''],
['dumbbell_bench_press','Dumbbell Bench Press','','Chest','','Dumbbell','Push','c',''],
['incline_dumbbell_press','Incline Dumbbell Press','','Chest','Shoulders','Dumbbell','Push','c',''],
['decline_dumbbell_press','Decline Dumbbell Press','','Chest','','Dumbbell','Push','c',''],
['dumbbell_fly','Dumbbell Fly','','Chest','','Dumbbell','Isolation','',''],
['incline_dumbbell_fly','Incline Dumbbell Fly','','Chest','','Dumbbell','Isolation','',''],
['cable_fly','Cable Fly','','Chest','','Cable','Isolation','',''],
['low_to_high_cable_fly','Low-to-High Cable Fly','','Chest','','Cable','Isolation','',''],
['high_to_low_cable_fly','High-to-Low Cable Fly','','Chest','','Cable','Isolation','',''],
['machine_chest_press','Machine Chest Press','','Chest','','Machine','Push','c',''],
['pec_deck','Pec Deck','Chest Fly Machine','Chest','','Machine','Isolation','',''],
['push_up','Push-Up','','Chest','Shoulders,Triceps','Bodyweight','Push','cb',''],
['incline_push_up','Incline Push-Up','','Chest','','Bodyweight','Push','b',''],
['decline_push_up','Decline Push-Up','','Chest','Shoulders','Bodyweight','Push','b',''],
['close_grip_push_up','Close-Grip Push-Up','','Chest','Triceps','Bodyweight','Push','b',''],
['chest_dip','Chest Dip','','Chest','Triceps,Shoulders','Bodyweight','Push','cb',''],

['barbell_row','Barbell Row','Bent-Over Row','Back','Biceps','Barbell','Pull','c',''],
['pendlay_row','Pendlay Row','','Back','Biceps','Barbell','Pull','c',''],
['dumbbell_row','Dumbbell Row','One-Arm Dumbbell Row','Back','Biceps','Dumbbell','Pull','uc',''],
['chest_supported_dumbbell_row','Chest-Supported Dumbbell Row','','Back','Biceps','Dumbbell','Pull','c',''],
['t_bar_row','T-Bar Row','','Back','Biceps','Machine','Pull','c',''],
['seated_cable_row','Seated Cable Row','','Back','Biceps','Cable','Pull','c',''],
['machine_row','Machine Row','','Back','Biceps','Machine','Pull','c',''],
['lat_pulldown','Lat Pulldown','','Back','Biceps','Cable','Pull','c',''],
['wide_grip_lat_pulldown','Wide-Grip Lat Pulldown','','Back','Biceps','Cable','Pull','c',''],
['neutral_grip_lat_pulldown','Neutral-Grip Lat Pulldown','','Back','Biceps','Cable','Pull','c',''],
['close_grip_lat_pulldown','Close-Grip Lat Pulldown','','Back','Biceps','Cable','Pull','c',''],
['pull_up','Pull-Up','','Back','Biceps','Bodyweight','Pull','cb',''],
['chin_up','Chin-Up','','Back','Biceps','Bodyweight','Pull','cb',''],
['assisted_pull_up','Assisted Pull-Up','','Back','Biceps','Machine','Pull','c',''],
['straight_arm_pulldown','Straight-Arm Pulldown','','Back','','Cable','Isolation','',''],
['face_pull','Face Pull','','Back','Shoulders','Cable','Pull','','rehab'],
['dumbbell_pullover','Dumbbell Pullover','','Back','Chest','Dumbbell','Isolation','',''],
['rack_pull','Rack Pull','','Back','Legs','Barbell','Hinge','c','posterior-chain'],

['barbell_overhead_press','Barbell Overhead Press','Overhead Press,Shoulder Press,Military Press,OHP','Shoulders','Triceps','Barbell','Push','c',''],
['dumbbell_shoulder_press','Dumbbell Shoulder Press','DB Shoulder Press','Shoulders','Triceps','Dumbbell','Push','c',''],
['arnold_press','Arnold Press','','Shoulders','Triceps','Dumbbell','Push','c',''],
['machine_shoulder_press','Machine Shoulder Press','Machine OHP','Shoulders','Triceps','Machine','Push','c',''],
['push_press','Push Press','','Shoulders','Triceps,Legs','Barbell','Push','c',''],
['dumbbell_lateral_raise','Dumbbell Lateral Raise','Lateral Raise','Shoulders','','Dumbbell','Isolation','',''],
['cable_lateral_raise','Cable Lateral Raise','','Shoulders','','Cable','Isolation','',''],
['machine_lateral_raise','Machine Lateral Raise','','Shoulders','','Machine','Isolation','',''],
['dumbbell_front_raise','Dumbbell Front Raise','','Shoulders','','Dumbbell','Isolation','',''],
['cable_front_raise','Cable Front Raise','','Shoulders','','Cable','Isolation','',''],
['rear_delt_fly','Rear Delt Fly','Reverse Fly','Shoulders','Back','Dumbbell','Isolation','',''],
['reverse_pec_deck','Reverse Pec Deck','Rear Delt Machine','Shoulders','Back','Machine','Isolation','',''],
['upright_row','Upright Row','','Shoulders','Back','Barbell','Pull','',''],

['barbell_curl','Barbell Curl','Bicep Curl','Biceps','','Barbell','Isolation','',''],
['ez_bar_curl','EZ-Bar Curl','','Biceps','','Barbell','Isolation','',''],
['dumbbell_curl','Dumbbell Curl','','Biceps','','Dumbbell','Isolation','',''],
['alternating_dumbbell_curl','Alternating Dumbbell Curl','','Biceps','','Dumbbell','Isolation','',''],
['hammer_curl','Hammer Curl','','Biceps','Forearms','Dumbbell','Isolation','','forearms'],
['cross_body_hammer_curl','Cross-Body Hammer Curl','','Biceps','Forearms','Dumbbell','Isolation','','forearms'],
['incline_dumbbell_curl','Incline Dumbbell Curl','','Biceps','','Dumbbell','Isolation','',''],
['concentration_curl','Concentration Curl','','Biceps','','Dumbbell','Isolation','',''],
['preacher_curl','Preacher Curl','','Biceps','','Barbell','Isolation','',''],
['cable_curl','Cable Curl','','Biceps','','Cable','Isolation','',''],
['bayesian_cable_curl','Bayesian Cable Curl','','Biceps','','Cable','Isolation','',''],
['machine_curl','Machine Curl','','Biceps','','Machine','Isolation','',''],
['reverse_curl','Reverse Curl','','Biceps','Forearms','Barbell','Isolation','','forearms'],
['zottman_curl','Zottman Curl','','Biceps','Forearms','Dumbbell','Isolation','','forearms'],

['cable_triceps_pushdown','Cable Triceps Pushdown','Triceps Pushdown','Triceps','','Cable','Isolation','',''],
['rope_pushdown','Rope Pushdown','','Triceps','','Cable','Isolation','',''],
['straight_bar_pushdown','Straight-Bar Pushdown','','Triceps','','Cable','Isolation','',''],
['overhead_cable_extension','Overhead Cable Extension','','Triceps','','Cable','Isolation','',''],
['dumbbell_overhead_triceps_extension','Dumbbell Overhead Triceps Extension','','Triceps','','Dumbbell','Isolation','',''],
['skull_crusher','Skull Crusher','','Triceps','','Barbell','Isolation','',''],
['ez_bar_skull_crusher','EZ-Bar Skull Crusher','','Triceps','','Barbell','Isolation','',''],
['close_grip_bench_press','Close-Grip Bench Press','','Triceps','Chest','Barbell','Push','c',''],
['triceps_dip','Triceps Dip','Dip','Triceps','Chest,Shoulders','Bodyweight','Push','cb',''],
['assisted_dip','Assisted Dip','','Triceps','Chest','Machine','Push','c',''],
['bench_dip','Bench Dip','','Triceps','','Bodyweight','Push','b',''],
['kickback','Kickback','Triceps Kickback','Triceps','','Dumbbell','Isolation','',''],
['single_arm_cable_extension','Single-Arm Cable Extension','','Triceps','','Cable','Isolation','u',''],

['wrist_curl','Wrist Curl','Barbell Wrist Curl','Forearms','','Barbell','Isolation','',''],
['reverse_wrist_curl','Reverse Wrist Curl','','Forearms','','Barbell','Isolation','',''],
['dumbbell_wrist_curl','Dumbbell Wrist Curl','','Forearms','','Dumbbell','Isolation','',''],
['farmers_carry',"Farmer's Carry",'','Forearms','Core,Full Body','Dumbbell','Carry','c','full-body'],
['plate_pinch','Plate Pinch','Plate Pinch Hold','Forearms','','Other','Isolation','',''],
['dead_hang','Dead Hang','','Forearms','','Bodyweight','Isolation','b',''],
['towel_hang','Towel Hang','','Forearms','','Bodyweight','Isolation','b',''],
['wrist_roller','Wrist Roller','','Forearms','','Other','Isolation','',''],
['hand_gripper','Hand Gripper','','Forearms','','Other','Isolation','',''],
['finger_curl','Finger Curl','','Forearms','','Dumbbell','Isolation','',''],

['back_squat','Back Squat','Squat,Barbell Squat','Legs','Glutes','Barbell','Squat','c','quads'],
['front_squat','Front Squat','','Legs','Glutes','Barbell','Squat','c','quads'],
['goblet_squat','Goblet Squat','','Legs','Glutes','Dumbbell','Squat','c','quads'],
['hack_squat','Hack Squat','','Legs','Glutes','Machine','Squat','c','quads'],
['leg_press','Leg Press','','Legs','Glutes','Machine','Squat','c','quads'],
['bulgarian_split_squat','Bulgarian Split Squat','','Legs','Glutes','Dumbbell','Squat','uc','quads'],
['split_squat','Split Squat','','Legs','Glutes','Bodyweight','Squat','ub','quads'],
['walking_lunge','Walking Lunge','','Legs','Glutes','Bodyweight','Squat','cb','quads,full-body'],
['reverse_lunge','Reverse Lunge','','Legs','Glutes','Bodyweight','Squat','ub','quads'],
['step_up','Step-Up','','Legs','Glutes','Dumbbell','Squat','ub','quads'],
['leg_extension','Leg Extension','','Legs','','Machine','Isolation','','quads'],
['sissy_squat','Sissy Squat','','Legs','','Bodyweight','Squat','b','quads'],
['wall_sit','Wall Sit','','Legs','','Bodyweight','Isolation','b','quads'],

['romanian_deadlift','Romanian Deadlift','RDL','Legs','Glutes,Back','Barbell','Hinge','c','hamstrings,posterior-chain'],
['stiff_leg_deadlift','Stiff-Leg Deadlift','','Legs','Back','Barbell','Hinge','c','hamstrings,posterior-chain'],
['good_morning','Good Morning','','Legs','Back','Barbell','Hinge','c','hamstrings,posterior-chain'],
['seated_leg_curl','Seated Leg Curl','','Legs','','Machine','Isolation','','hamstrings'],
['lying_leg_curl','Lying Leg Curl','','Legs','','Machine','Isolation','','hamstrings'],
['standing_leg_curl','Standing Leg Curl','','Legs','','Machine','Isolation','u','hamstrings'],
['nordic_hamstring_curl','Nordic Hamstring Curl','','Legs','','Bodyweight','Isolation','b','hamstrings'],
['glute_ham_raise','Glute-Ham Raise','GHR','Legs','Glutes','Machine','Isolation','','hamstrings'],
['single_leg_romanian_deadlift','Single-Leg Romanian Deadlift','','Legs','Glutes','Dumbbell','Hinge','u','hamstrings'],

['barbell_hip_thrust','Barbell Hip Thrust','Hip Thrust','Glutes','Legs','Barbell','Hinge','c',''],
['dumbbell_hip_thrust','Dumbbell Hip Thrust','','Glutes','Legs','Dumbbell','Hinge','c',''],
['glute_bridge','Glute Bridge','','Glutes','','Bodyweight','Hinge','b',''],
['single_leg_glute_bridge','Single-Leg Glute Bridge','','Glutes','','Bodyweight','Hinge','ub',''],
['cable_pull_through','Cable Pull-Through','','Glutes','Legs','Cable','Hinge','',''],
['cable_kickback','Cable Kickback','Glute Kickback','Glutes','','Cable','Isolation','u',''],
['sumo_deadlift','Sumo Deadlift','','Glutes','Legs,Back','Barbell','Hinge','c','posterior-chain'],
['hip_abduction_machine','Hip Abduction Machine','','Glutes','','Machine','Isolation','',''],

['standing_calf_raise','Standing Calf Raise','Calf Raise','Calves','','Machine','Isolation','',''],
['seated_calf_raise','Seated Calf Raise','','Calves','','Machine','Isolation','',''],
['leg_press_calf_raise','Leg Press Calf Raise','','Calves','','Machine','Isolation','',''],
['single_leg_calf_raise','Single-Leg Calf Raise','','Calves','','Bodyweight','Isolation','ub',''],
['donkey_calf_raise','Donkey Calf Raise','','Calves','','Machine','Isolation','',''],
['smith_machine_calf_raise','Smith Machine Calf Raise','','Calves','','Machine','Isolation','',''],
['tibialis_raise','Tibialis Raise','','Calves','','Bodyweight','Isolation','b','rehab'],

['conventional_deadlift','Conventional Deadlift','Deadlift','Back','Legs,Glutes','Barbell','Hinge','c','posterior-chain'],
['trap_bar_deadlift','Trap Bar Deadlift','Hex Bar Deadlift','Back','Legs,Glutes','Barbell','Hinge','c','posterior-chain'],
['deficit_deadlift','Deficit Deadlift','','Back','Legs,Glutes','Barbell','Hinge','c','posterior-chain'],
['snatch_grip_deadlift','Snatch-Grip Deadlift','','Back','Legs,Glutes','Barbell','Hinge','c','posterior-chain'],
['kettlebell_swing','Kettlebell Swing','','Glutes','Back,Legs','Kettlebell','Hinge','c','posterior-chain,full-body'],

['plank','Plank','','Core','','Bodyweight','Isolation','b',''],
['side_plank','Side Plank','','Core','','Bodyweight','Isolation','ub',''],
['weighted_plank','Weighted Plank','','Core','','Other','Isolation','',''],
['crunch','Crunch','','Core','','Bodyweight','Isolation','b',''],
['cable_crunch','Cable Crunch','','Core','','Cable','Isolation','',''],
['reverse_crunch','Reverse Crunch','','Core','','Bodyweight','Isolation','b',''],
['sit_up','Sit-Up','','Core','','Bodyweight','Isolation','b',''],
['decline_sit_up','Decline Sit-Up','','Core','','Bodyweight','Isolation','b',''],
['hanging_knee_raise','Hanging Knee Raise','','Core','','Bodyweight','Isolation','b',''],
['hanging_leg_raise','Hanging Leg Raise','','Core','','Bodyweight','Isolation','b',''],
['captains_chair_knee_raise',"Captain's Chair Knee Raise",'','Core','','Machine','Isolation','',''],
['ab_wheel_rollout','Ab Wheel Rollout','Ab Rollout','Core','','Other','Isolation','',''],
['dead_bug','Dead Bug','','Core','','Bodyweight','Rotation','b',''],
['bird_dog','Bird Dog','','Core','','Bodyweight','Rotation','b',''],
['pallof_press','Pallof Press','','Core','','Cable','Rotation','',''],
['russian_twist','Russian Twist','','Core','','Bodyweight','Rotation','b',''],
['bicycle_crunch','Bicycle Crunch','','Core','','Bodyweight','Rotation','b',''],
['mountain_climber','Mountain Climber','','Core','','Bodyweight','Isolation','b','cardio'],
['hollow_hold','Hollow Hold','','Core','','Bodyweight','Isolation','b',''],
['suitcase_carry','Suitcase Carry','','Core','Forearms','Dumbbell','Carry','u','forearms'],

['clean','Clean','','Full Body','Back,Legs','Barbell','Pull','c',''],
['power_clean','Power Clean','','Full Body','Back,Legs','Barbell','Pull','c',''],
['hang_clean','Hang Clean','','Full Body','Back,Legs','Barbell','Pull','c',''],
['clean_and_press','Clean and Press','','Full Body','Shoulders,Legs','Barbell','Pull','c',''],
['clean_and_jerk','Clean and Jerk','','Full Body','Shoulders,Legs','Barbell','Pull','c',''],
['snatch','Snatch','','Full Body','Shoulders,Legs','Barbell','Pull','c',''],
['power_snatch','Power Snatch','','Full Body','Shoulders,Legs','Barbell','Pull','c',''],
['thruster','Thruster','','Full Body','Shoulders,Legs','Barbell','Squat','c',''],
['dumbbell_thruster','Dumbbell Thruster','','Full Body','Shoulders,Legs','Dumbbell','Squat','c',''],
['kettlebell_clean','Kettlebell Clean','','Full Body','Back,Legs','Kettlebell','Pull','c',''],
['kettlebell_snatch','Kettlebell Snatch','','Full Body','Shoulders,Back','Kettlebell','Pull','uc',''],
['turkish_get_up','Turkish Get-Up','','Full Body','Shoulders,Core','Kettlebell','Rotation','uc',''],
['burpee','Burpee','','Full Body','Chest,Legs','Bodyweight','Squat','cb','cardio'],
['sled_push','Sled Push','Prowler Push','Full Body','Legs','Cardio Equipment','Carry','c',''],
['sled_pull','Sled Pull','','Full Body','Back,Legs','Cardio Equipment','Carry','c',''],

['bodyweight_squat','Bodyweight Squat','Air Squat','Legs','Glutes','Bodyweight','Squat','b','quads'],

['band_pull_apart','Band Pull-Apart','','Shoulders','Back','Bands','Pull','','rehab'],
['external_rotation','External Rotation','','Shoulders','','Bands','Rotation','','rehab'],
['internal_rotation','Internal Rotation','','Shoulders','','Bands','Rotation','','rehab'],
['scapular_pull_up','Scapular Pull-Up','','Back','','Bodyweight','Pull','b','rehab'],
['scapular_push_up','Scapular Push-Up','','Chest','','Bodyweight','Push','b','rehab'],
['wall_slide','Wall Slide','','Shoulders','','Bodyweight','Rotation','b','rehab'],
['hip_airplane','Hip Airplane','','Glutes','','Bodyweight','Rotation','ub','rehab'],
['copenhagen_plank','Copenhagen Plank','','Legs','Core','Bodyweight','Isolation','ub','adductors,rehab'],
['clamshell','Clamshell','','Glutes','','Bands','Isolation','','rehab'],
['monster_walk','Monster Walk','','Glutes','','Bands','Carry','','rehab'],
['terminal_knee_extension','Terminal Knee Extension','TKE','Legs','','Bands','Isolation','','rehab,quads'],
['reverse_sled_drag','Reverse Sled Drag','','Legs','','Cardio Equipment','Carry','','rehab,quads'],
/* Imported from RPG_Training_Strength_Exercise_Library (Google Sheet), 2026-09-18.
   Names/canonical IDs only -- the sheet's own muscle-tag/equipment/movement
   columns are blank for these rows (status: Draft across the whole sheet),
   so those fields are left blank here too rather than fabricated. primaryMuscle
   is set from the sheet's own body-part tab (the one populated signal available)
   so these are at least body-zone-browsable; equipment/movement/aliases need a
   follow-up pass once the sheet is filled in. 9 sheet rows were excluded as
   duplicates of exercises already in this list under a different ID (e.g. sheet's
   'Incline Bench Press' vs existing incline_barbell_bench_press). */
// -- Chest (from sheet) --
['neutral_grip_dumbbell_press','Neutral-Grip Dumbbell Press','','Chest','','','','',''],
['single_arm_cable_fly','Single-Arm Cable Fly','','Chest','','','','',''],
['incline_machine_press','Incline Machine Press','','Chest','','','','',''],
['smith_machine_bench_press','Smith Machine Bench Press','','Chest','','','','',''],
['smith_incline_press','Smith Incline Press','','Chest','','','','',''],
['wide_push_up','Wide Push-Up','','Chest','','','','',''],
['deficit_push_up','Deficit Push-Up','','Chest','','','','',''],
['weighted_push_up','Weighted Push-Up','','Chest','','','','',''],
// -- Back (from sheet) --
['neutral_grip_pull_up','Neutral-Grip Pull-Up','','Back','','','','',''],
['single_arm_pulldown','Single-Arm Pulldown','','Back','','','','',''],
['underhand_barbell_row','Underhand Barbell Row','','Back','','','','',''],
['incline_bench_row','Incline Bench Row','','Back','','','','',''],
['chest_supported_t_bar_row','Chest-Supported T-Bar Row','','Back','','','','',''],
['meadows_row','Meadows Row','','Back','','','','',''],
['landmine_row','Landmine Row','','Back','','','','',''],
['wide_cable_row','Wide Cable Row','','Back','','','','',''],
['single_arm_cable_row','Single-Arm Cable Row','','Back','','','','',''],
['high_row','High Row','','Back','','','','',''],
['low_row','Low Row','','Back','','','','',''],
['seal_row','Seal Row','','Back','','','','',''],
['machine_pullover','Machine Pullover','','Back','','','','',''],
['back_extension','Back Extension','','Back','','','','',''],
// -- Shoulders (from sheet) --
['seated_barbell_press','Seated Barbell Press','','Shoulders','','','','',''],
['seated_dumbbell_press','Seated Dumbbell Press','','Shoulders','','','','',''],
['smith_machine_shoulder_press','Smith Machine Shoulder Press','','Shoulders','','','','',''],
['landmine_press','Landmine Press','','Shoulders','','','','',''],
['single_arm_landmine_press','Single-Arm Landmine Press','','Shoulders','','','','',''],
['seated_lateral_raise','Seated Lateral Raise','','Shoulders','','','','',''],
['leaning_lateral_raise','Leaning Lateral Raise','','Shoulders','','','','',''],
['behind_the_back_cable_lateral_raise','Behind-the-Back Cable Lateral Raise','','Shoulders','','','','',''],
['plate_front_raise','Plate Front Raise','','Shoulders','','','','',''],
['cable_rear_delt_fly','Cable Rear Delt Fly','','Shoulders','','','','',''],
['lu_raise','Lu Raise','','Shoulders','','','','',''],
// -- Biceps (from sheet) --
['spider_curl','Spider Curl','','Biceps','','','','',''],
['dumbbell_preacher_curl','Dumbbell Preacher Curl','','Biceps','','','','',''],
['high_cable_curl','High Cable Curl','','Biceps','','','','',''],
['drag_curl','Drag Curl','','Biceps','','','','',''],
// -- Triceps (from sheet) --
['cable_pushdown','Cable Pushdown','','Triceps','','','','',''],
['v_bar_pushdown','V-Bar Pushdown','','Triceps','','','','',''],
['reverse_grip_pushdown','Reverse-Grip Pushdown','','Triceps','','','','',''],
['single_arm_pushdown','Single-Arm Pushdown','','Triceps','','','','',''],
['cross_body_cable_extension','Cross-Body Cable Extension','','Triceps','','','','',''],
['single_arm_overhead_extension','Single-Arm Overhead Extension','','Triceps','','','','',''],
['dumbbell_overhead_extension','Dumbbell Overhead Extension','','Triceps','','','','',''],
['dumbbell_skull_crusher','Dumbbell Skull Crusher','','Triceps','','','','',''],
['jm_press','JM Press','','Triceps','','','','',''],
['diamond_push_up','Diamond Push-Up','','Triceps','','','','',''],
// -- Forearms & Grip (from sheet) --
['behind_the_back_wrist_curl','Behind-the-Back Wrist Curl','','Forearms','','','','',''],
['fat_grip_hold','Fat-Grip Hold','','Forearms','','','','',''],
['barbell_hold','Barbell Hold','','Forearms','','','','',''],
['rice_bucket_work','Rice-Bucket Work','','Forearms','','','','',''],
// -- Core (from sheet) --
['machine_crunch','Machine Crunch','','Core','','','','',''],
['captain_s_chair_raise',"Captain's Chair Raise",'','Core','','','','',''],
['toes_to_bar','Toes-to-Bar','','Core','','','','',''],
['cable_rotation','Cable Rotation','','Core','','','','',''],
['cable_wood_chop','Cable Wood Chop','','Core','','','','',''],
['v_up','V-Up','','Core','','','','',''],
// -- Glutes (from sheet) --
['smith_hip_thrust','Smith Hip Thrust','','Glutes','','','','',''],
['weighted_glute_bridge','Weighted Glute Bridge','','Glutes','','','','',''],
['frog_pump','Frog Pump','','Glutes','','','','',''],
['machine_kickback','Machine Kickback','','Glutes','','','','',''],
['cable_hip_abduction','Cable Hip Abduction','','Glutes','','','','',''],
['band_abduction','Band Abduction','','Glutes','','','','',''],
['lateral_band_walk','Lateral Band Walk','','Glutes','','','','',''],
// -- Quads (from sheet) --
['high_bar_squat','High-Bar Squat','','Legs','','','','','quads'],
['zercher_squat','Zercher Squat','','Legs','','','','','quads'],
['pendulum_squat','Pendulum Squat','','Legs','','','','','quads'],
['smith_squat','Smith Squat','','Legs','','','','','quads'],
['belt_squat','Belt Squat','','Legs','','','','','quads'],
['single_leg_press','Single-Leg Press','','Legs','','','','','quads'],
['forward_lunge','Forward Lunge','','Legs','','','','','quads'],
['lateral_lunge','Lateral Lunge','','Legs','','','','','quads'],
['single_leg_extension','Single-Leg Extension','','Legs','','','','','quads'],
['spanish_squat','Spanish Squat','','Legs','','','','','quads'],
['cyclist_squat','Cyclist Squat','','Legs','','','','','quads'],
['heel_elevated_goblet_squat','Heel-Elevated Goblet Squat','','Legs','','','','','quads'],
// -- Hamstrings (from sheet) --
['dumbbell_romanian_deadlift','Dumbbell Romanian Deadlift','','Legs','','','','','hamstrings'],
['single_leg_curl','Single-Leg Curl','','Legs','','','','','hamstrings'],
['nordic_curl','Nordic Curl','','Legs','','','','','hamstrings'],
['assisted_nordic_curl','Assisted Nordic Curl','','Legs','','','','','hamstrings'],
['stability_ball_leg_curl','Stability-Ball Leg Curl','','Legs','','','','','hamstrings'],
['slider_leg_curl','Slider Leg Curl','','Legs','','','','','hamstrings'],
['cable_leg_curl','Cable Leg Curl','','Legs','','','','','hamstrings'],
['45_degree_back_extension','45-Degree Back Extension','','Legs','','','','','hamstrings'],
// -- Calves & Tibialis (from sheet) --
['hack_squat_calf_raise','Hack-Squat Calf Raise','','Calves','','','','',''],
['machine_calf_raise','Machine Calf Raise','','Calves','','','','',''],
['bodyweight_calf_raise','Bodyweight Calf Raise','','Calves','','','','',''],
['machine_tibialis_raise','Machine Tibialis Raise','','Calves','','','','','']
];
/* ---------- Canonical muscle taxonomy (Master Build decision,
   2026-09-17 — RPG_TRAINING_STRENGTH_EXERCISE_LIBRARY_LYRA_REVIEW) ----------
   Two-level model: PRECISE_MUSCLE_REGIONS is the detailed layer the
   visual body diagram selects from; MUSCLE_TO_ZONE derives the 9 broad
   player-facing browse zones from it at read time — one source of
   truth, never a second hand-maintained zone list per exercise (point
   4). Every zone id also maps to itself, so a tag can be either a
   precise region (e.g. 'biceps') or, where the source data only ever
   asserted the broad zone, the zone id itself (e.g. 'chest') — that's
   an honest "we know the zone, not the sub-region" state, never a
   fabricated precise tag standing in for missing data. */
const PRECISE_MUSCLE_REGIONS={
  chest:['upper_chest','mid_chest','lower_chest'],
  back:['lats','upper_back','traps','lower_back'],
  shoulders:['front_delts','side_delts','rear_delts'],
  arms:['biceps','brachialis','triceps'],
  forearms:['forearm_flexors','forearm_extensors','brachioradialis','grip'],
  core:['abs','obliques','deep_core'],
  glutes:['glute_max','glute_med_abductors'],
  legs:['quads','hamstrings','calves','tibialis'],
  'full-body':[]
};
const MUSCLE_TO_ZONE={
  upper_chest:'chest',mid_chest:'chest',lower_chest:'chest',chest:'chest',
  lats:'back',upper_back:'back',traps:'back',lower_back:'back',back:'back',
  front_delts:'shoulders',side_delts:'shoulders',rear_delts:'shoulders',shoulders:'shoulders',
  biceps:'arms',brachialis:'arms',triceps:'arms',arms:'arms',
  forearm_flexors:'forearms',forearm_extensors:'forearms',brachioradialis:'forearms',grip:'forearms',forearms:'forearms',
  abs:'core',obliques:'core',deep_core:'core',core:'core',
  glute_max:'glutes',glute_med_abductors:'glutes',glutes:'glutes',
  quads:'legs',hamstrings:'legs',calves:'legs',tibialis:'legs',legs:'legs',
  'full-body':'full-body'
};
/* Old 11-value filter vocabulary -> new canonical tag. Biceps/Triceps/
   Calves already WERE precise in the old vocabulary, so they map 1:1
   onto their existing precise region; everything else the old data
   only ever asserted at zone level, so it maps onto the zone id
   itself (via MUSCLE_TO_ZONE's self-reference above) rather than
   inventing a specific sub-region the source data never captured. */
const OLD_MUSCLE_TO_TAG={
  Chest:'chest',Back:'back',Shoulders:'shoulders',Biceps:'biceps',Triceps:'triceps',
  Forearms:'forearms',Legs:'legs',Glutes:'glutes',Calves:'calves',Core:'core','Full Body':'full-body'
};
/* Reverse map for display labels (Exercise Detail / result rows still
   show a human label like "Chest" or "Quads", not a raw tag). */
const MUSCLE_TAG_LABEL={
  chest:'Chest',back:'Back',shoulders:'Shoulders',arms:'Arms',forearms:'Forearms',
  core:'Core',glutes:'Glutes',legs:'Legs','full-body':'Full Body',
  biceps:'Biceps',brachialis:'Brachialis',triceps:'Triceps',
  upper_chest:'Upper Chest',mid_chest:'Mid Chest',lower_chest:'Lower Chest',
  lats:'Lats',upper_back:'Upper Back',traps:'Traps',lower_back:'Lower Back',
  front_delts:'Front Delts',side_delts:'Side Delts',rear_delts:'Rear Delts',
  forearm_flexors:'Forearm Flexors',forearm_extensors:'Forearm Extensors',grip:'Grip',
  abs:'Abs',obliques:'Obliques',deep_core:'Deep Core',
  glute_max:'Glute Max',glute_med_abductors:'Glute Med / Abductors',
  quads:'Quads',hamstrings:'Hamstrings',calves:'Calves',tibialis:'Tibialis'
};
function muscleTagLabel(tag){return MUSCLE_TAG_LABEL[tag]||tag}
/* Legs is the old vocabulary's single coarsest bucket (quads/
   hamstrings/calves/tibialis all collapse to one value) — but many
   rows already encode real precision in their own `categories` free-
   text tags (e.g. 'quads', 'hamstrings') from the original authoring
   pass. Promoting to that already-asserted precise tag is using data
   that already exists, not inventing new precision; anything without
   a confident categories match stays at the honest zone-level 'legs'. */
function promoteLegsTag(categories){
  const cats=categories||[];
  if(cats.some(c=>/hamstring/.test(c)))return 'hamstrings';
  if(cats.some(c=>/quad/.test(c)))return 'quads';
  if(cats.some(c=>/calf|calves/.test(c)))return 'calves';
  if(cats.some(c=>/tibialis|shin/.test(c)))return 'tibialis';
  return 'legs';
}
/* Old->new tag, with the Legs precision promotion applied. */
function oldMuscleToTag(oldValue,categories){
  const tag=OLD_MUSCLE_TO_TAG[oldValue];
  if(tag==='legs')return promoteLegsTag(categories);
  return tag;
}
/* Every old-vocab zone-level label that promoteLegsTag() can now
   produce a more precise derived label for, so a plain "Legs" filter
   value (the muscle dropdown passes exactly one scalar, unlike the
   zone-tap picker's already-expanded array) still matches those
   exercises instead of only matching the ones that stayed at "Legs". */
const OLD_MUSCLE_ZONE_EXPANSION={Legs:['Legs','Quads','Hamstrings','Tibialis','Calves']};
function expandMuscleFilterSet(set){
  const out=new Set();
  set.forEach(m=>{out.add(m);(OLD_MUSCLE_ZONE_EXPANSION[m]||[]).forEach(x=>out.add(x))});
  return[...out];
}
/* Primary/Secondary/Stabilizer involvement model (point 1, LOCKED):
   Stabilizer participates but doesn't surface the exercise in zone
   browsing. The old data never captured a 3rd tier — everything sat
   in one flat secondaryMuscles array — so this migration applies one
   narrow, documented heuristic rather than guessing per exercise:
   Core and Forearms are near-universally stabilizers (bracing/grip),
   not meaningfully loaded movers, when they show up as a SECONDARY
   entry on a COMPOUND lift specifically (e.g. Core on a Barbell
   Squat). Isolation exercises' secondary muscles are left as real
   secondary movers unchanged. This is the one reclassification this
   pass makes; it doesn't attempt to re-judge every exercise's full
   involvement profile — that remains real content-authoring work for
   a follow-up pass, not something to fabricate here. */
function classifyInvolvement(secondaryTags,isCompound){
  const secondary=[],stabilizer=[];
  secondaryTags.forEach(tag=>{
    const zone=MUSCLE_TO_ZONE[tag];
    if(isCompound&&(zone==='core'||zone==='forearms'))stabilizer.push(tag);
    else secondary.push(tag);
  });
  return{secondary,stabilizer};
}
function EL_row(r){
  const [id,name,aliases,primaryMuscle,secondaryMuscles,equipment,movement,flags,categories]=r;
  const categoriesArr=categories?categories.split(','):[];
  const compound=flags.includes('c');
  const primaryTag=oldMuscleToTag(primaryMuscle,categoriesArr);
  const secondaryTags=(secondaryMuscles?secondaryMuscles.split(','):[]).map(m=>oldMuscleToTag(m,categoriesArr)).filter(Boolean);
  const{secondary,stabilizer}=classifyInvolvement(secondaryTags,compound);
  return {
    id,name,
    aliases:aliases?aliases.split(','):[],
    muscles:{primary:[primaryTag],secondary,stabilizer},
    /* Derived, not hand-maintained — one source of truth (point 4).
       Existing UI that reads primaryMuscle/secondaryMuscles keeps
       working unchanged; stabilizer-reclassified tags correctly drop
       out of secondaryMuscles, which is what actually declutters zone
       browsing (point 1's whole point) without touching the browse
       filter code itself. */
    get primaryMuscle(){return muscleTagLabel(this.muscles.primary[0])},
    get secondaryMuscles(){return this.muscles.secondary.map(muscleTagLabel)},
    equipment,movement,
    unilateral:flags.includes('u'),
    compound,
    bodyweight:flags.includes('b'),
    custom:false,
    exerciseType:'strength',
    trackingType:'reps_weight',
    categories:categoriesArr
  };
}
const EXERCISE_LIBRARY_BUILTIN=EXERCISE_ROWS.map(EL_row);
const EXERCISE_FILTER_MUSCLES=['Chest','Back','Shoulders','Biceps','Triceps','Forearms','Legs','Glutes','Calves','Core','Full Body'];
const EXERCISE_FILTER_EQUIPMENT=['Barbell','Dumbbell','Kettlebell','Machine','Cable','Bodyweight','Bands','Cardio Equipment','Other'];
const EXERCISE_FILTER_MOVEMENT=['Push','Pull','Squat','Hinge','Carry','Rotation','Isolation'];
/* Versioned canonical dataset (point 12). Bump when EXERCISE_ROWS or
   the taxonomy above changes shape, not on every content tweak. */
const EXERCISE_DATASET_VERSION='2026.09.17.1';
/* Explicit rename/merge table (point 6, LOCKED RULE): existing ids are
   NEVER regenerated. Empty today — every current id is retained as-is
   — but this is where a future rename/de-dupe goes, so saved
   History/PBs/Templates/Favourites keep resolving instead of silently
   breaking. */
const EXERCISE_ID_MIGRATION={};
function resolveExerciseId(id){return EXERCISE_ID_MIGRATION[id]||id}

/* ---------- Custom exercises + Recent/Favourites (persisted) ---------- */
function ensureExerciseLibraryState(){
  if(!Array.isArray(state.customExercises))state.customExercises=[];
  const t=ensureTrainingState();
  if(!Array.isArray(t.recentExerciseIds))t.recentExerciseIds=[];
  if(!Array.isArray(t.favouriteExerciseIds))t.favouriteExerciseIds=[];
  if(!Array.isArray(t.workoutTemplates))t.workoutTemplates=[];
  if(!Array.isArray(t.favouriteWorkoutIds))t.favouriteWorkoutIds=[];
  return t;
}
/* Favourite Workouts (Training Header & Strength Workflow Corrections
   handover, 2026-09-18) — same toggle-array pattern as
   toggleFavouriteExercise, just for workout templates. */
function toggleFavouriteWorkout(id){
  const t=ensureExerciseLibraryState();
  if(t.favouriteWorkoutIds.includes(id))t.favouriteWorkoutIds=t.favouriteWorkoutIds.filter(x=>x!==id);
  else t.favouriteWorkoutIds=[...t.favouriteWorkoutIds,id];
  save();
}
function allExercises(){
  ensureExerciseLibraryState();
  return EXERCISE_LIBRARY_BUILTIN.concat(state.customExercises);
}
function exerciseById(id){return allExercises().find(e=>e.id===resolveExerciseId(id))}
/* custom_<uuid> (point 7) — a random id space that can never collide
   with a built-in slug id, distinct from the numeric custom_<uid()>
   scheme used before. crypto.randomUUID is available in every browser
   this app already requires (Leaflet/fetch-dependent Routes feature
   needs the same modern baseline); a tiny fallback covers any
   environment where it's missing rather than hard-failing. */
function newCustomExerciseId(){
  if(typeof crypto!=='undefined'&&crypto.randomUUID)return 'custom_'+crypto.randomUUID();
  return 'custom_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
}
function addCustomExercise({name,primaryMuscle,equipment,movement,aliases,secondaryMuscles,notes}){
  ensureExerciseLibraryState();
  const primaryTag=OLD_MUSCLE_TO_TAG[primaryMuscle]||'full-body';
  const secondaryTags=(secondaryMuscles?secondaryMuscles.split(',').map(x=>x.trim()).filter(Boolean):[]).map(m=>OLD_MUSCLE_TO_TAG[m]).filter(Boolean);
  const ex={
    id:newCustomExerciseId(),
    name:String(name||'').trim()||'Custom Exercise',
    aliases:aliases?aliases.split(',').map(x=>x.trim()).filter(Boolean):[],
    muscles:{primary:[primaryTag],secondary:secondaryTags,stabilizer:[]},
    get primaryMuscle(){return muscleTagLabel(this.muscles.primary[0])},
    get secondaryMuscles(){return this.muscles.secondary.map(muscleTagLabel)},
    equipment:equipment||'Other',movement:movement||'Isolation',
    unilateral:false,compound:false,bodyweight:equipment==='Bodyweight',custom:true,
    exerciseType:'strength',trackingType:'reps_weight',
    categories:[],notes:notes||''
  };
  state.customExercises.push(ex);save();
  return ex;
}
/* ---------- Dataset validator (point 12) ----------
   Not wired into any UI — a dev-console QA tool
   (validateExerciseDataset() in devtools) that checks the invariants
   Master Build's review requires. Run after any dataset edit. */
function validateExerciseDataset(){
  const issues=[];
  const all=EXERCISE_LIBRARY_BUILTIN;
  const seenIds=new Set(),seenNames=new Map(),seenAliases=new Map();
  all.forEach(ex=>{
    if(!ex.id)issues.push(`Missing id: "${ex.name}"`);
    else if(seenIds.has(ex.id))issues.push(`Duplicate id: ${ex.id}`);
    seenIds.add(ex.id);
    if(!ex.name||!ex.name.trim())issues.push(`Missing canonical name: ${ex.id}`);
    const nameKey=normalizeSearchText(ex.name);
    if(seenNames.has(nameKey))issues.push(`Duplicate exercise name: "${ex.name}" (${ex.id} / ${seenNames.get(nameKey)})`);
    seenNames.set(nameKey,ex.id);
    ex.aliases.forEach(a=>{
      const aKey=normalizeSearchText(a);
      if(seenAliases.has(aKey)&&seenAliases.get(aKey)!==ex.id)issues.push(`Alias collision: "${a}" used by ${ex.id} and ${seenAliases.get(aKey)}`);
      seenAliases.set(aKey,ex.id);
    });
    ['primary','secondary','stabilizer'].forEach(tier=>{
      (ex.muscles[tier]||[]).forEach(tag=>{
        if(!(tag in MUSCLE_TO_ZONE))issues.push(`${ex.id}: unknown ${tier} tag "${tag}"`);
      });
    });
    if(!ex.muscles.primary.length)issues.push(`${ex.id}: no primary muscle set`);
    if(!EXERCISE_FILTER_EQUIPMENT.includes(ex.equipment))issues.push(`${ex.id}: unknown equipment "${ex.equipment}"`);
    if(!EXERCISE_FILTER_MOVEMENT.includes(ex.movement))issues.push(`${ex.id}: unknown movement "${ex.movement}"`);
    if(ex.trackingType!=='reps_weight')issues.push(`${ex.id}: unexpected trackingType "${ex.trackingType}"`);
  });
  return{ok:issues.length===0,count:all.length,issues};
}
function markExerciseUsed(id){
  const t=ensureExerciseLibraryState();
  t.recentExerciseIds=[id,...t.recentExerciseIds.filter(x=>x!==id)].slice(0,12);
  save();
}
function toggleFavouriteExercise(id){
  const t=ensureExerciseLibraryState();
  if(t.favouriteExerciseIds.includes(id))t.favouriteExerciseIds=t.favouriteExerciseIds.filter(x=>x!==id);
  else t.favouriteExerciseIds=[...t.favouriteExerciseIds,id];
  save();
}

/* ---------- Search (section 19) ----------
   name matches outrank alias matches outrank tag matches, exact beats
   starts-with beats contains, per the approved ranking concept. Runs
   entirely against the in-memory arrays above -- no network request for
   the ~180-entry built-in catalogue, per section 20. */
function normalizeSearchText(s){return String(s||'').toLowerCase().trim().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()}
function exerciseSearchScore(ex,q){
  const name=normalizeSearchText(ex.name);
  if(name===q)return 100;
  if(name.startsWith(q))return 90;
  if(name.includes(q))return 80;
  for(const a of ex.aliases){
    const an=normalizeSearchText(a);
    if(an===q||an.startsWith(q))return 70;
    if(an.includes(q))return 60;
  }
  const tagFields=[ex.primaryMuscle,...ex.secondaryMuscles,ex.equipment,ex.movement,...ex.categories].map(normalizeSearchText);
  if(tagFields.some(t=>t===q))return 40;
  if(tagFields.some(t=>t.includes(q)))return 20;
  /* Stabilizer tags are explicitly excluded from zone-browse filtering
     (point 9: "Stabilizer does not normally surface the exercise") but
     still searchable by free-text keyword at the lowest tier — someone
     typing "core" plausibly does want to find a Squat, just ranked
     behind anything where Core is a real primary/secondary mover. */
  const stabilizerFields=(ex.muscles?.stabilizer||[]).map(t=>normalizeSearchText(muscleTagLabel(t)));
  if(stabilizerFields.some(t=>t===q||t.includes(q)))return 10;
  return 0;
}
function searchExercises(query,filters={}){
  const q=normalizeSearchText(query);
  const {muscle,equipment,movement}=filters;
  let pool=allExercises();
  /* muscle may be a single value (the dropdown) or an array (a Strength
     Home body-zone group, e.g. Arms -> [Biceps,Triceps] — v0.0.5 §9
     "Body-zone-first exercise discovery"), matching on primary OR
     secondary involvement either way. Expanded through
     OLD_MUSCLE_ZONE_EXPANSION first so a plain "Legs" dropdown pick
     still matches an exercise whose derived label got promoted to
     "Quads"/"Hamstrings"/"Tibialis" (categories-based precision,
     2026-09-17) — without this the promotion that makes Exercise
     Detail/search more precise would silently drop those exercises
     out of the coarser Legs filter instead of including them. */
  if(muscle){const set=expandMuscleFilterSet(Array.isArray(muscle)?muscle:[muscle]);pool=pool.filter(e=>set.includes(e.primaryMuscle)||e.secondaryMuscles.some(m=>set.includes(m)))}
  if(equipment)pool=pool.filter(e=>e.equipment===equipment);
  if(movement)pool=pool.filter(e=>e.movement===movement);
  if(!q)return pool.sort((a,b)=>a.name.localeCompare(b.name));
  return pool.map(e=>({e,score:exerciseSearchScore(e,q)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.e.name.localeCompare(b.e.name)).map(x=>x.e);
}

/* ---------- Exercise Library picker (section 5/6/7/16) ----------
   One reusable modal, opened from either the Strength Journal or the
   Workout Builder (section 5's "Return behavior"): pass an onPick(ex)
   callback, the modal closes itself and hands the chosen exercise back
   to whichever caller opened it -- not two separate picker
   implementations to keep in sync. Live search re-renders only the
   results list on each keystroke (no Search button, section 5/22),
   leaving the search input's own focus/cursor untouched. */
let __elOnPick=null,__elFilters={muscle:'',equipment:'',movement:''};
function exerciseLibraryModal(onPick,initialMuscleFilter=''){
  ensureExerciseLibraryState();
  __elOnPick=onPick;__elFilters={muscle:initialMuscleFilter,equipment:'',movement:''};
  modal(`<h2>Exercise Library</h2>
    <div class="form-row"><input id="elSearch" placeholder="Search exercises..." autofocus></div>
    <div class="three-col">
      <div class="form-row"><label>Muscle</label><select id="elFilterMuscle"><option value="">All</option>${EXERCISE_FILTER_MUSCLES.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select></div>
      <div class="form-row"><label>Equipment</label><select id="elFilterEquipment"><option value="">All</option>${EXERCISE_FILTER_EQUIPMENT.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select></div>
      <div class="form-row"><label>Movement</label><select id="elFilterMovement"><option value="">All</option>${EXERCISE_FILTER_MOVEMENT.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select></div>
    </div>
    <div id="elResults" class="exercise-library-results"></div>
    <button type="button" class="text-btn accent" id="elAddCustom" style="width:100%">+ Add Custom Exercise</button>`);
  elRenderResults();
  const search=modalRoot.querySelector('#elSearch');
  search.oninput=elRenderResults;
  modalRoot.querySelector('#elFilterMuscle').onchange=e=>{__elFilters.muscle=e.target.value;elRenderResults()};
  modalRoot.querySelector('#elFilterEquipment').onchange=e=>{__elFilters.equipment=e.target.value;elRenderResults()};
  modalRoot.querySelector('#elFilterMovement').onchange=e=>{__elFilters.movement=e.target.value;elRenderResults()};
  modalRoot.querySelector('#elAddCustom').onclick=()=>customExerciseModal(ex=>{closeModal();__elOnPick&&__elOnPick(ex)});
}
/* Fixed a real duplicate-add bug (found 2026-09-17 while testing the
   Strength Muscle Group Selector integration): the row div AND the +
   button both carried data-el-pick, so a click on + fired the button's
   own handler, then bubbled to the row's identical handler, picking
   the same exercise twice. data-el-pick now lives only on the +
   button — the row itself is no longer clickable, matching the ★/ⓘ
   buttons' own single-purpose behavior. */
function exerciseResultRowHTML(ex,t){
  const fav=t.favouriteExerciseIds.includes(ex.id);
  /* Sheet-imported stub exercises (2026-09-18) can have a real
     primaryMuscle but no equipment/movement yet -- join only the
     populated fields rather than showing dangling " · " separators
     for data that's honestly just not filled in yet. */
  const meta=[ex.primaryMuscle,ex.equipment,ex.movement].filter(Boolean).map(esc).join(' · ');
  return `<div class="exercise-result-row">
    <div><strong>${esc(ex.name)}</strong><span>${meta}</span></div>
    <button type="button" class="exercise-fav-btn ${fav?'active':''}" data-el-fav="${ex.id}" aria-label="Toggle favourite"><img src="${asset('Training/UI/UI_STAR.svg')}" alt=""></button>
    <button type="button" class="exercise-detail-btn" data-el-detail="${ex.id}" aria-label="View ${esc(ex.name)} detail"><img src="${asset('Training/UI/UI_INFO.svg')}" alt=""></button>
    <button type="button" class="exercise-add-btn" data-el-pick="${ex.id}" aria-label="Add ${esc(ex.name)}"><img src="${asset('Training/UI/UI_ADD.svg')}" alt=""></button>
  </div>`;
}
function elRenderResults(){
  const t=ensureExerciseLibraryState();
  const q=modalRoot.querySelector('#elSearch').value;
  const results=modalRoot.querySelector('#elResults');
  const filtersActive=__elFilters.muscle||__elFilters.equipment||__elFilters.movement;
  let html='';
  if(!q.trim()&&!filtersActive){
    const recent=t.recentExerciseIds.map(id=>exerciseById(id)).filter(Boolean);
    const favs=t.favouriteExerciseIds.map(id=>exerciseById(id)).filter(Boolean);
    if(recent.length)html+=`<div class="exercise-result-group"><small>RECENT</small>${recent.map(ex=>exerciseResultRowHTML(ex,t)).join('')}</div>`;
    if(favs.length)html+=`<div class="exercise-result-group"><small>FAVOURITES</small>${favs.map(ex=>exerciseResultRowHTML(ex,t)).join('')}</div>`;
    html+=`<div class="exercise-result-group"><small>ALL EXERCISES</small>${searchExercises('',__elFilters).map(ex=>exerciseResultRowHTML(ex,t)).join('')}</div>`;
  }else{
    const found=searchExercises(q,__elFilters);
    html=found.length?found.map(ex=>exerciseResultRowHTML(ex,t)).join(''):'<p class="helper">No exercises match. Try Add Custom Exercise below.</p>';
  }
  results.innerHTML=html;
  results.querySelectorAll('[data-el-pick]').forEach(el=>el.onclick=()=>{
    const ex=exerciseById(el.dataset.elPick);if(!ex)return;
    markExerciseUsed(ex.id);
    /* Close THIS modal before invoking the caller's callback, not after
       -- a caller like Workout Builder reopens its own modal from inside
       onPick, and closing afterward would tear that back down again. */
    closeModal();
    __elOnPick&&__elOnPick(ex);
  });
  results.querySelectorAll('[data-el-fav]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();toggleFavouriteExercise(btn.dataset.elFav);elRenderResults()});
  results.querySelectorAll('[data-el-detail]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();exerciseDetailModal(exerciseById(btn.dataset.elDetail))});
}
function customExerciseModal(onCreate){
  modal(`<h2>Add Custom Exercise</h2>
    <div class="form-row"><label>Name</label><input id="ceName" placeholder="e.g. Cable Y-Raise" autofocus></div>
    <div class="two-col">
      <div class="form-row"><label>Primary muscle</label><select id="ceMuscle">${EXERCISE_FILTER_MUSCLES.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select></div>
      <div class="form-row"><label>Equipment</label><select id="ceEquipment">${EXERCISE_FILTER_EQUIPMENT.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select></div>
    </div>
    <div class="form-row"><label>Movement</label><select id="ceMovement">${EXERCISE_FILTER_MOVEMENT.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select></div>
    <div class="form-row"><label>Aliases <small>(optional, comma-separated)</small></label><input id="ceAliases"></div>
    <button type="button" class="rpg-btn accent" id="ceSave" style="width:100%">Add Exercise</button>`);
  modalRoot.querySelector('#ceSave').onclick=()=>{
    const name=modalRoot.querySelector('#ceName').value.trim();
    if(!name){toast('Name the exercise.');return}
    const ex=addCustomExercise({name,primaryMuscle:modalRoot.querySelector('#ceMuscle').value,equipment:modalRoot.querySelector('#ceEquipment').value,movement:modalRoot.querySelector('#ceMovement').value,aliases:modalRoot.querySelector('#ceAliases').value});
    toast(`${ex.name} added to your library.`);
    onCreate&&onCreate(ex);
  };
}

/* ---------- Build a Workout (Astra "Strength Architecture Reset"
   handover, 2026-09-18) ----------
   Supersedes the old modal-based Workout Builder. Now a Persistent
   Category Bar destination (strengthScreen==='Builder') on the
   Strength page itself, not a modal over it -- body-zone selection
   filters exercises IN PLACE on this
   same screen (wbExerciseResultsHTML/data-wb-pick), so adding a
   exercise never navigates away, matching the handover's own explicit
   Builder QA line. Builds/edits a reusable template -- still only the
   PLAN (targetSets/targetReps/targetWeight/rest/RPE/RIR/notes), never
   actual performed values. No Draft/status concept anymore (the
   Workout Drafts system is explicitly removed this pass) -- there is
   exactly one way to persist a template now: Save Workout. Reordering
   stays plain up/down buttons (works identically on mobile/desktop). */
let __wbDraft=null;
function workoutBuilderModal(templateId){
  const t=ensureExerciseLibraryState();
  const existing=templateId?t.workoutTemplates.find(w=>w.id===templateId):null;
  __wbDraft=existing?JSON.parse(JSON.stringify(existing)):{id:'wt_'+uid(),name:'',notes:'',exercises:[]};
  delete __wbDraft.status;
  /* The Builder now only exists as a Strength gateway screen (no more
     modal) -- also true when this is reached from the legacy top-level
     Workouts tab (trainingWorkoutsTabHTML/workoutLibraryFullHTML,
     outside any gateway), so jump into the gateway explicitly rather
     than leaving trainingGatewayId unset, which would otherwise render
     the top-level Training tabs with nowhere for strengthScreen to
     show up. */
  trainingGatewayId='strength';strengthReportId=null;
  strengthScreen='Builder';
  renderTrainingArea();
}
function wbMove(i,dir){
  const arr=__wbDraft.exercises,j=i+dir;
  if(j<0||j>=arr.length)return;
  [arr[i],arr[j]]=[arr[j],arr[i]];
  renderTrainingArea();
}
function wbExerciseRowHTML(ex,i,total){
  /* Sets + Reps are the only always-visible fields; Rest/Target
     weight/RPE/RIR/Notes are collapsed into a native <details> unless
     one of them already carries a real value (e.g. editing a workout
     someone already filled in), so re-opening an existing plan
     doesn't hide data the user set. */
  const hasAdvanced=ex.targetWeight!=null||ex.targetRpe!=null||ex.targetRir!=null||(ex.notes&&ex.notes.trim())||(ex.restSeconds&&ex.restSeconds!==90);
  return `<div class="wb-exercise-row">
    <div class="wb-exercise-head"><strong>${i+1}. ${esc(ex.name)}</strong><div class="wb-exercise-move"><button type="button" class="text-btn" data-wb-up="${i}" ${i===0?'disabled':''} aria-label="Move up">↑</button><button type="button" class="text-btn" data-wb-down="${i}" ${i===total-1?'disabled':''} aria-label="Move down">↓</button><button type="button" class="text-btn danger" data-wb-remove="${i}" aria-label="Remove">✕</button></div></div>
    <div class="two-col">
      <div class="form-row"><label>Sets</label><input type="number" min="1" data-wb-field="${i}|targetSets" value="${ex.targetSets}"></div>
      <div class="form-row"><label>Reps</label><input data-wb-field="${i}|targetReps" value="${esc(ex.targetReps||'')}" placeholder="8-10"></div>
    </div>
    <details class="wb-advanced" ${hasAdvanced?'open':''}>
      <summary>More options <small>weight / rest / RPE / notes</small></summary>
      <div class="three-col">
        <div class="form-row"><label>Target weight</label><input type="number" step="0.5" data-wb-field="${i}|targetWeight" value="${ex.targetWeight??''}"></div>
        <div class="form-row"><label>RPE</label><input type="number" step="0.5" data-wb-field="${i}|targetRpe" value="${ex.targetRpe??''}"></div>
        <div class="form-row"><label>RIR</label><input type="number" step="1" data-wb-field="${i}|targetRir" value="${ex.targetRir??''}"></div>
      </div>
      <div class="form-row"><label>Rest (sec)</label><input type="number" min="0" data-wb-field="${i}|restSeconds" value="${ex.restSeconds||''}"></div>
      <div class="form-row"><label>Notes</label><input data-wb-field="${i}|notes" value="${esc(ex.notes||'')}"></div>
    </details>
  </div>`;
}
/* In-place body-zone-filtered exercise picker for the Builder --
   mirrors muscleSelectorResultsHTML's own filter logic but the "+"
   pushes straight onto __wbDraft.exercises instead of a live session,
   and never navigates. "Search All Exercises" stays available as the
   fallback into the full picker modal, whose own onPick also just
   pushes onto __wbDraft and re-renders this same screen. */
function wbExerciseResultsHTML(){
  const zone=STRENGTH_BODY_ZONES.find(z=>z.id===muscleSelectorSelectedZone);
  const muscleFilter=muscleSelectorSelectedZone?(zone?zone.muscles:[muscleTagLabel(muscleSelectorSelectedZone)]):null;
  const results=muscleFilter?searchExercises('',{muscle:muscleFilter}).slice(0,8):[];
  return `<div class="mg-results">
    ${muscleSelectorSelectedZone?(results.length?`<div class="exercise-library-results">${results.map(ex=>`<div class="exercise-result-row"><div><strong>${esc(ex.name)}</strong><span>${[ex.primaryMuscle,ex.equipment,ex.movement].filter(Boolean).map(esc).join(' · ')}</span></div><button type="button" class="exercise-add-btn" data-wb-pick="${ex.id}" aria-label="Add ${esc(ex.name)}"><img src="${asset('Training/UI/UI_ADD.svg')}" alt=""></button></div>`).join('')}</div>`:'<p class="helper">No exercises tagged for this zone yet.</p>'):''}
    <button type="button" class="text-btn accent" id="wbSearchAll" style="width:100%">Search All Exercises</button>
  </div>`;
}
function wbAddExercise(ex){
  __wbDraft.exercises.push({exerciseId:ex.id,name:ex.name,order:__wbDraft.exercises.length,targetSets:3,targetReps:'8-10',targetWeight:null,restSeconds:90,targetRpe:null,targetRir:null,notes:''});
  renderTrainingArea();
}
function wbSaveWorkout(){
  const d=__wbDraft;
  if(!d.name.trim()){toast('Name the workout.');return}
  if(!d.exercises.length){toast('Add at least one exercise.');return}
  const tr=ensureExerciseLibraryState();
  d.exercises.forEach((ex,i)=>ex.order=i);
  const idx=tr.workoutTemplates.findIndex(w=>w.id===d.id);
  if(idx>=0)tr.workoutTemplates[idx]=d;else tr.workoutTemplates.push(d);
  save();toast('Workout saved.');
  strengthScreen='Workouts';__wbDraft=null;
  renderTrainingArea();
}

/* ---------- Workout Library (section 12) ----------
   My Workouts (workoutBuilderModal templates) / RPG Templates (the
   existing TRAINING_TEMPLATES quick-starts, unchanged) / Recent (last 3
   templates actually started). Starting a My Workouts template creates
   today's activity pre-populated with the PLANNED exercises/sets ready
   to log -- target values become starting suggestions on empty,
   uncompleted sets, never pre-marked complete (section 14/15). */
function startWorkoutTemplate(templateId){
  const t=ensureExerciseLibraryState();
  const tpl=t.workoutTemplates.find(w=>w.id===templateId);if(!tpl)return;
  t.recentWorkoutTemplateIds=[templateId,...(t.recentWorkoutTemplateIds||[]).filter(x=>x!==templateId)].slice(0,6);
  /* rowId is the fresh per-session lookup key (Strength correction
     pass, 2026-09-17); exerciseId carries the template's own real
     canonical id forward -- it must never be regenerated here, or a
     completed session (and any template later re-saved from it) loses
     its real Exercise Library reference. */
  const activity={id:uid(),name:tpl.name,type:'Gym / Strength',date:todayISO(),time:'',duration:0,distance:0,source:'Manual',completed:false,xpAwarded:false,planText:tpl.notes||'',startedAt:Date.now(),sportData:{strength:{exercises:tpl.exercises.slice().sort((a,b)=>a.order-b.order).map(te=>({rowId:uid(),exerciseId:te.exerciseId,name:te.name,notes:'',plannedRestSeconds:te.restSeconds||null,sets:Array.from({length:Math.max(1,Number(te.targetSets||1))},()=>({weight:te.targetWeight||0,reps:Number(String(te.targetReps||'').split('-')[0])||0,rpe:te.targetRpe??null,rir:te.targetRir??null,completed:false,warmup:false}))})),sessionNotes:''}},workoutTemplateId:templateId};
  state.activities.push(activity);save();
  trainingGatewayId='strength';strengthReportId=null;
  journalActivityId=activity.id;strengthScreen='Journal';renderTrainingArea();
}
/* Schedules a template for a future/dated session via the shared
   Activity modal (section 5's shared schedule) instead of starting it
   immediately -- the resulting activity is planned/uncompleted, exactly
   like startWorkoutTemplate's session shape, just not opened into the
   Journal or stamped with startedAt (Strength correction pass,
   2026-09-17, "Workout Builder... schedule via shared schedule"). */
function scheduleWorkoutTemplateModal(templateId){
  const t=ensureExerciseLibraryState();
  const tpl=t.workoutTemplates.find(w=>w.id===templateId);if(!tpl)return;
  const exercises=tpl.exercises.slice().sort((a,b)=>a.order-b.order).map(te=>({rowId:uid(),exerciseId:te.exerciseId,name:te.name,notes:'',plannedRestSeconds:te.restSeconds||null,sets:Array.from({length:Math.max(1,Number(te.targetSets||1))},()=>({weight:te.targetWeight||0,reps:Number(String(te.targetReps||'').split('-')[0])||0,rpe:te.targetRpe??null,rir:te.targetRir??null,completed:false,warmup:false}))}));
  activityModal('add',{name:tpl.name,type:'Gym / Strength',date:todayISO(),planText:tpl.notes||'',sportData:{strength:{exercises,sessionNotes:''}},workoutTemplateId:templateId});
}
function duplicateWorkoutTemplate(templateId){
  const t=ensureExerciseLibraryState();
  const tpl=t.workoutTemplates.find(w=>w.id===templateId);if(!tpl)return;
  const copy=JSON.parse(JSON.stringify(tpl));
  copy.id='wt_'+uid();copy.name=tpl.name+' Copy';
  t.workoutTemplates.push(copy);save();toast('Workout copied.');renderTrainingArea();
}
/* Template-level delete (§Save / Delete Rules: "unless explicitly
   deleting that template from Saved Workouts") -- removes only the
   reusable template row. Any past sessions built from it keep their
   own workoutTemplateId pointer untouched (it simply won't resolve to
   a template any more), exactly mirroring how deleting a SESSION
   already leaves its source template alone. */
function deleteWorkoutTemplateModal(templateId){
  const t=ensureExerciseLibraryState();
  const tpl=t.workoutTemplates.find(w=>w.id===templateId);if(!tpl)return;
  modal(`<h2>Delete Workout Template</h2>
    <p class="helper">Delete the saved workout "<b>${esc(tpl.name)}</b>"? This only removes the reusable template -- any past sessions logged from it are not affected.</p>
    <div class="two-col"><button type="button" class="rpg-btn" id="dwtCancel">Cancel</button><button type="button" class="rpg-btn danger" id="dwtConfirm">Delete Template</button></div>`);
  modalRoot.querySelector('#dwtCancel').onclick=closeModal;
  modalRoot.querySelector('#dwtConfirm').onclick=()=>{
    t.workoutTemplates=t.workoutTemplates.filter(w=>w.id!==templateId);
    t.favouriteWorkoutIds=(t.favouriteWorkoutIds||[]).filter(id=>id!==templateId);
    save();closeModal();toast('Workout template deleted.');renderTrainingArea();
  };
}
/* Read-only workout detail (View action, §Saved Workouts) -- name/
   count/muscle-coverage/exercise list plus the full action set: Edit/
   Copy/Favourite/Schedule/Start/Delete. Opened by tapping a My
   Workouts card itself; the card's own inline Start/Edit/Copy/
   Schedule/Delete buttons stay for one-tap access and stop propagation
   so they don't also open this. Muscle coverage reuses the same
   read-only MuscleGroupSelector highlight as Exercise Detail, built
   from every exercise's real primary/secondary tags -- not a new
   diagram or a second muscle vocabulary. */
function workoutDetailModal(templateId){
  const t=ensureExerciseLibraryState();
  const tpl=t.workoutTemplates.find(w=>w.id===templateId);if(!tpl)return;
  const rows=tpl.exercises.slice().sort((a,b)=>a.order-b.order);
  const highlightMap={};
  rows.forEach(r=>{
    const ex=exerciseById(r.exerciseId);if(!ex)return;
    const primary=ex.muscles.primary[0];
    if(primary&&!highlightMap[primary])highlightMap[primary]='primary';
    ex.muscles.secondary.forEach(tag=>{if(!highlightMap[tag])highlightMap[tag]='secondary'});
  });
  const tags=Object.keys(highlightMap);
  const view=tags.some(t=>CAELEN_VIEW_TAGS.front.includes(t))?'front':'back';
  const isFav=t.favouriteWorkoutIds.includes(templateId);
  modal(`<h2>${esc(tpl.name)}</h2>
    <p class="helper">${rows.length} exercise${rows.length===1?'':'s'}</p>
    ${tags.length?muscleGroupSelectorHTML(view,null,{interactive:false,highlightMap}):''}
    <div class="workout-detail-list">${rows.map(r=>`<div class="training-record-row"><div><b>${esc(r.name)}</b></div><strong>${r.targetSets} × ${esc(r.targetReps||'-')}</strong></div>`).join('')}</div>
    <div class="two-col">
      <button type="button" class="rpg-btn" id="wdEdit">Edit</button>
      <button type="button" class="rpg-btn" id="wdCopy">Copy</button>
    </div>
    <div class="two-col">
      <button type="button" class="rpg-btn" id="wdFav">${isFav?'Unfavourite':'Favourite'}</button>
      <button type="button" class="rpg-btn" id="wdSchedule">Schedule</button>
    </div>
    <div class="two-col">
      <button type="button" class="rpg-btn accent" id="wdStart">Start</button>
      <button type="button" class="rpg-btn danger" id="wdDelete">Delete</button>
    </div>`);
  modalRoot.querySelector('#wdEdit').onclick=()=>{closeModal();workoutBuilderModal(templateId)};
  modalRoot.querySelector('#wdCopy').onclick=()=>{closeModal();duplicateWorkoutTemplate(templateId)};
  modalRoot.querySelector('#wdFav').onclick=()=>{closeModal();toggleFavouriteWorkout(templateId);renderTrainingArea()};
  modalRoot.querySelector('#wdSchedule').onclick=()=>scheduleWorkoutTemplateModal(templateId);
  modalRoot.querySelector('#wdStart').onclick=()=>{closeModal();startWorkoutTemplate(templateId)};
  modalRoot.querySelector('#wdDelete').onclick=()=>{closeModal();deleteWorkoutTemplateModal(templateId)};
}
function saveJournalAsTemplateModal(a){
  const strength=a.sportData&&a.sportData.strength;
  if(!strength||!strength.exercises.length){toast('Add at least one exercise before saving a template.');return}
  modal(`<h2>Save as Workout Template</h2><div class="form-row"><label>Workout name</label><input id="satName" value="${esc(a.name)}" autofocus></div><p class="helper">Saves the exercise list as a reusable plan (sets/reps only) — not today's actual weights.</p><button type="button" class="rpg-btn accent" id="satSave" style="width:100%">Save Template</button>`);
  modalRoot.querySelector('#satSave').onclick=()=>{
    const name=modalRoot.querySelector('#satName').value.trim();if(!name){toast('Name the workout.');return}
    const t=ensureExerciseLibraryState();
    const tpl={id:'wt_'+uid(),name,notes:'',exercises:strength.exercises.map((ex,i)=>({exerciseId:ex.exerciseId,name:ex.name,order:i,targetSets:Math.max(1,ex.sets.length),targetReps:String(ex.sets[0]?.reps||8),targetWeight:null,restSeconds:90,targetRpe:null,targetRir:null,notes:''}))};
    t.workoutTemplates.push(tpl);save();closeModal();toast('Workout template saved.');renderTrainingArea();
  };
}
/* One-time recovery for templates saved through the pre-correction-pass
   saveJournalAsTemplateModal, which forwarded a fabricated uid() instead
   of the real Exercise Library id (Strength correction pass, 2026-09-17,
   point 3 "Recover/migrate existing affected templates where
   practical"). Recovery is name-based -- the only reliably real field a
   broken row still carries -- and only ever fills in an id that's
   currently unresolvable; a template whose name no longer matches any
   library exercise (e.g. a deleted custom exercise) is left alone
   rather than guessed at. Runs once per save file, gated by a flag on
   the training state so it never re-scans on every load. */
function migrateWorkoutTemplateExerciseIds(){
  const t=ensureTrainingState();
  if(t.__exerciseIdsMigrated)return;
  t.__exerciseIdsMigrated=true;
  let recovered=0;
  (t.workoutTemplates||[]).forEach(tpl=>{
    (tpl.exercises||[]).forEach(te=>{
      if(exerciseById(te.exerciseId))return;
      const match=allExercises().find(e=>normalizeSearchText(e.name)===normalizeSearchText(te.name));
      if(match){te.exerciseId=match.id;recovered++}
    });
  });
  if(recovered)save();
}
function workoutLibraryFullHTML({includeQuickTemplates=true}={}){
  const t=ensureExerciseLibraryState();
  migrateWorkoutTemplateExerciseIds();
  const recent=(t.recentWorkoutTemplateIds||[]).map(id=>t.workoutTemplates.find(w=>w.id===id)).filter(Boolean);
  const myCards=t.workoutTemplates.map(w=>`<article class="training-library-card" data-my-workout="${w.id}"><div class="wl-card-shield">🏋</div><strong>${esc(w.name)}</strong><span class="wl-card-meta">${w.exercises.length} exercise${w.exercises.length===1?'':'s'}</span><div class="wl-card-actions"><button type="button" class="text-btn accent" data-start-workout="${w.id}">START</button><button type="button" class="text-btn" data-edit-workout="${w.id}">EDIT</button></div></article>`).join('');
  return `<section class="rpg-frame primary training-library-section"><div class="training-panel-title">MY WORKOUTS</div><div class="training-library-grid">${myCards||'<p class="helper">No saved workouts yet — build one below, or save a Journal session as a template.</p>'}</div><button type="button" class="text-btn accent" id="newWorkoutBuilder" style="width:100%">+ Create Workout</button></section>
  ${recent.length?`<section class="rpg-frame minor training-library-section"><div class="training-panel-title">RECENT</div><div class="training-library-grid">${recent.map(w=>`<article class="training-library-card" data-my-workout="${w.id}"><div class="wl-card-shield">🏋</div><strong>${esc(w.name)}</strong><button type="button" class="text-btn accent" data-start-workout="${w.id}" style="width:100%">START</button></article>`).join('')}</div></section>`:''}
  ${includeQuickTemplates?workoutLibraryHTML():''}`;
}
