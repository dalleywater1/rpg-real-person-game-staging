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
['dumbbell_shoulder_press','Dumbbell Shoulder Press','Shoulder Press','Shoulders','Triceps','Dumbbell','Push','c',''],
['arnold_press','Arnold Press','','Shoulders','Triceps','Dumbbell','Push','c',''],
['machine_shoulder_press','Machine Shoulder Press','Shoulder Press','Shoulders','Triceps','Machine','Push','c',''],
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
['reverse_sled_drag','Reverse Sled Drag','','Legs','','Cardio Equipment','Carry','','rehab,quads']
];
function EL_row(r){
  const [id,name,aliases,primaryMuscle,secondaryMuscles,equipment,movement,flags,categories]=r;
  return {
    id,name,
    aliases:aliases?aliases.split(','):[],
    primaryMuscle,
    secondaryMuscles:secondaryMuscles?secondaryMuscles.split(','):[],
    equipment,movement,
    unilateral:flags.includes('u'),
    compound:flags.includes('c'),
    bodyweight:flags.includes('b'),
    custom:false,
    categories:categories?categories.split(','):[]
  };
}
const EXERCISE_LIBRARY_BUILTIN=EXERCISE_ROWS.map(EL_row);
const EXERCISE_FILTER_MUSCLES=['Chest','Back','Shoulders','Biceps','Triceps','Forearms','Legs','Glutes','Calves','Core','Full Body'];
const EXERCISE_FILTER_EQUIPMENT=['Barbell','Dumbbell','Kettlebell','Machine','Cable','Bodyweight','Bands','Cardio Equipment','Other'];
const EXERCISE_FILTER_MOVEMENT=['Push','Pull','Squat','Hinge','Carry','Rotation','Isolation'];

/* ---------- Custom exercises + Recent/Favourites (persisted) ---------- */
function ensureExerciseLibraryState(){
  if(!Array.isArray(state.customExercises))state.customExercises=[];
  const t=ensureTrainingState();
  if(!Array.isArray(t.recentExerciseIds))t.recentExerciseIds=[];
  if(!Array.isArray(t.favouriteExerciseIds))t.favouriteExerciseIds=[];
  if(!Array.isArray(t.workoutTemplates))t.workoutTemplates=[];
  return t;
}
function allExercises(){
  ensureExerciseLibraryState();
  return EXERCISE_LIBRARY_BUILTIN.concat(state.customExercises);
}
function exerciseById(id){return allExercises().find(e=>e.id===id)}
function addCustomExercise({name,primaryMuscle,equipment,movement,aliases,secondaryMuscles,notes}){
  ensureExerciseLibraryState();
  const ex={id:'custom_'+uid(),name:String(name||'').trim()||'Custom Exercise',aliases:aliases?aliases.split(',').map(x=>x.trim()).filter(Boolean):[],primaryMuscle:primaryMuscle||'Full Body',secondaryMuscles:secondaryMuscles?secondaryMuscles.split(',').map(x=>x.trim()).filter(Boolean):[],equipment:equipment||'Other',movement:movement||'Isolation',unilateral:false,compound:false,bodyweight:equipment==='Bodyweight',custom:true,categories:[],notes:notes||''};
  state.customExercises.push(ex);save();
  return ex;
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
  return 0;
}
function searchExercises(query,filters={}){
  const q=normalizeSearchText(query);
  const {muscle,equipment,movement}=filters;
  let pool=allExercises();
  if(muscle)pool=pool.filter(e=>e.primaryMuscle===muscle||e.secondaryMuscles.includes(muscle));
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
function exerciseLibraryModal(onPick){
  ensureExerciseLibraryState();
  __elOnPick=onPick;__elFilters={muscle:'',equipment:'',movement:''};
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
function exerciseResultRowHTML(ex,t){
  const fav=t.favouriteExerciseIds.includes(ex.id);
  return `<div class="exercise-result-row" data-el-pick="${ex.id}">
    <div><strong>${esc(ex.name)}</strong><span>${esc(ex.primaryMuscle)} · ${esc(ex.equipment)} · ${esc(ex.movement)}</span></div>
    <button type="button" class="exercise-fav-btn ${fav?'active':''}" data-el-fav="${ex.id}" aria-label="Toggle favourite">★</button>
    <button type="button" class="exercise-add-btn" data-el-pick="${ex.id}" aria-label="Add ${esc(ex.name)}">+</button>
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

/* ---------- Workout Builder (section 13) ----------
   Builds/edits a reusable template (My Workouts). The template stores
   the PLAN only -- targetSets/targetReps/targetWeight/rest/RPE/RIR/notes
   per exercise -- never actual performed values (section 14). Reordering
   uses plain up/down buttons, not drag-and-drop, so it works identically
   on mobile and desktop (section 13's explicit requirement). */
let __wbDraft=null;
function workoutBuilderModal(templateId){
  const t=ensureExerciseLibraryState();
  const existing=templateId?t.workoutTemplates.find(w=>w.id===templateId):null;
  __wbDraft=existing?JSON.parse(JSON.stringify(existing)):{id:'wt_'+uid(),name:'',notes:'',exercises:[]};
  wbRender();
}
function wbRender(){
  const d=__wbDraft;
  modal(`<h2>${d.id&&ensureExerciseLibraryState().workoutTemplates.some(w=>w.id===d.id)?'Edit Workout':'New Workout'}</h2>
    <div class="form-row"><label>Workout name</label><input id="wbName" value="${esc(d.name)}" placeholder="e.g. Upper Body A"></div>
    <div class="form-row"><label>Notes</label><textarea id="wbNotes" rows="2">${esc(d.notes)}</textarea></div>
    <div id="wbExerciseList">${d.exercises.map((ex,i)=>wbExerciseRowHTML(ex,i,d.exercises.length)).join('')||'<p class="helper">No exercises yet — add one below.</p>'}</div>
    <button type="button" class="text-btn accent" id="wbAddExercise" style="width:100%">+ Add Exercise</button>
    <button type="button" class="rpg-btn accent" id="wbSave" style="width:100%">Save Workout</button>`);
  modalRoot.querySelector('#wbName').oninput=e=>{d.name=e.target.value};
  modalRoot.querySelector('#wbNotes').oninput=e=>{d.notes=e.target.value};
  modalRoot.querySelector('#wbAddExercise').onclick=()=>exerciseLibraryModal(ex=>{
    d.exercises.push({exerciseId:ex.id,name:ex.name,order:d.exercises.length,targetSets:3,targetReps:'8-10',targetWeight:null,restSeconds:90,targetRpe:null,targetRir:null,notes:''});
    wbRender();
  });
  modalRoot.querySelectorAll('[data-wb-up]').forEach(b=>b.onclick=()=>{wbMove(Number(b.dataset.wbUp),-1)});
  modalRoot.querySelectorAll('[data-wb-down]').forEach(b=>b.onclick=()=>{wbMove(Number(b.dataset.wbDown),1)});
  modalRoot.querySelectorAll('[data-wb-remove]').forEach(b=>b.onclick=()=>{d.exercises.splice(Number(b.dataset.wbRemove),1);wbRender()});
  modalRoot.querySelectorAll('[data-wb-field]').forEach(inp=>inp.oninput=()=>{
    const [idx,field]=inp.dataset.wbField.split('|');
    const ex=d.exercises[Number(idx)];if(!ex)return;
    ex[field]=field==='targetSets'||field==='restSeconds'?Number(inp.value||0):(field==='targetWeight'||field==='targetRpe'||field==='targetRir')?(inp.value===''?null:Number(inp.value)):inp.value;
  });
  modalRoot.querySelector('#wbSave').onclick=()=>{
    if(!d.name.trim()){toast('Name the workout.');return}
    if(!d.exercises.length){toast('Add at least one exercise.');return}
    const tr=ensureExerciseLibraryState();
    d.exercises.forEach((ex,i)=>ex.order=i);
    const idx=tr.workoutTemplates.findIndex(w=>w.id===d.id);
    if(idx>=0)tr.workoutTemplates[idx]=d;else tr.workoutTemplates.push(d);
    save();closeModal();toast('Workout saved.');renderTrainingArea();
  };
}
function wbMove(i,dir){
  const arr=__wbDraft.exercises,j=i+dir;
  if(j<0||j>=arr.length)return;
  [arr[i],arr[j]]=[arr[j],arr[i]];
  wbRender();
}
function wbExerciseRowHTML(ex,i,total){
  return `<div class="wb-exercise-row">
    <div class="wb-exercise-head"><strong>${esc(ex.name)}</strong><div class="wb-exercise-move"><button type="button" class="text-btn" data-wb-up="${i}" ${i===0?'disabled':''} aria-label="Move up">↑</button><button type="button" class="text-btn" data-wb-down="${i}" ${i===total-1?'disabled':''} aria-label="Move down">↓</button><button type="button" class="text-btn danger" data-wb-remove="${i}" aria-label="Remove">✕</button></div></div>
    <div class="three-col">
      <div class="form-row"><label>Sets</label><input type="number" min="1" data-wb-field="${i}|targetSets" value="${ex.targetSets}"></div>
      <div class="form-row"><label>Reps</label><input data-wb-field="${i}|targetReps" value="${esc(ex.targetReps||'')}" placeholder="8-10"></div>
      <div class="form-row"><label>Rest (sec)</label><input type="number" min="0" data-wb-field="${i}|restSeconds" value="${ex.restSeconds||''}"></div>
    </div>
    <div class="three-col">
      <div class="form-row"><label>Target weight <small>optional</small></label><input type="number" step="0.5" data-wb-field="${i}|targetWeight" value="${ex.targetWeight??''}"></div>
      <div class="form-row"><label>RPE <small>optional</small></label><input type="number" step="0.5" data-wb-field="${i}|targetRpe" value="${ex.targetRpe??''}"></div>
      <div class="form-row"><label>RIR <small>optional</small></label><input type="number" step="1" data-wb-field="${i}|targetRir" value="${ex.targetRir??''}"></div>
    </div>
    <div class="form-row"><label>Notes <small>optional</small></label><input data-wb-field="${i}|notes" value="${esc(ex.notes||'')}"></div>
  </div>`;
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
  const activity={id:uid(),name:tpl.name,type:'Gym / Strength',date:todayISO(),time:'',duration:0,distance:0,source:'Manual',completed:false,xpAwarded:false,planText:tpl.notes||'',startedAt:Date.now(),sportData:{strength:{exercises:tpl.exercises.slice().sort((a,b)=>a.order-b.order).map(te=>({exerciseId:uid(),name:te.name,notes:'',sets:Array.from({length:Math.max(1,Number(te.targetSets||1))},()=>({weight:te.targetWeight||0,reps:Number(String(te.targetReps||'').split('-')[0])||0,rpe:te.targetRpe??null,rir:te.targetRir??null,completed:false,warmup:false}))})),sessionNotes:''}},workoutTemplateId:templateId};
  state.activities.push(activity);save();
  journalActivityId=activity.id;trainingTab='Journal';renderTrainingArea();
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
function workoutLibraryFullHTML(){
  const t=ensureExerciseLibraryState();
  const recent=(t.recentWorkoutTemplateIds||[]).map(id=>t.workoutTemplates.find(w=>w.id===id)).filter(Boolean);
  const myCards=t.workoutTemplates.map(w=>`<article class="training-library-card" data-my-workout="${w.id}"><div class="wl-card-shield">🏋</div><strong>${esc(w.name)}</strong><span class="wl-card-meta">${w.exercises.length} exercise${w.exercises.length===1?'':'s'}</span><div class="wl-card-actions"><button type="button" class="text-btn accent" data-start-workout="${w.id}">START</button><button type="button" class="text-btn" data-edit-workout="${w.id}">EDIT</button></div></article>`).join('');
  return `<section class="rpg-frame primary training-library-section"><div class="training-panel-title">MY WORKOUTS</div><div class="training-library-grid">${myCards||'<p class="helper">No saved workouts yet — build one below, or save a Journal session as a template.</p>'}</div><button type="button" class="text-btn accent" id="newWorkoutBuilder" style="width:100%">+ Build a Workout</button></section>
  ${recent.length?`<section class="rpg-frame minor training-library-section"><div class="training-panel-title">RECENT</div><div class="training-library-grid">${recent.map(w=>`<article class="training-library-card" data-my-workout="${w.id}"><div class="wl-card-shield">🏋</div><strong>${esc(w.name)}</strong><button type="button" class="text-btn accent" data-start-workout="${w.id}" style="width:100%">START</button></article>`).join('')}</div></section>`:''}
  ${workoutLibraryHTML()}`;
}
