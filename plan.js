// plan.js — the workout plan as plain data.
// Edit names, explanations and suggested weights here; app.js reads this file.
//
// Each exercise has:
//   id      stable ID that never changes, even if the name or position changes
//   name    what the app shows as the title
//   muscle  the small tag above the title
//   how     plain-English explanation of the machine and the movement
//   tip     wrist tip
//   start   suggested starting weight
//   unit    "kg" (weight + reps) or "min" (minutes, one entry)
//   elbow   true = hidden when Elbow-friendly mode is ON
//
// Logs are saved by id, so you can reorder exercises freely. Never reuse an
// old id for a different exercise, and never change an existing id, or that
// exercise's history won't show up any more.

var SETS = [3,3,3,4]; // sets per exercise in week 1, 2, 3, 4

var WARM = "Treadmill incline walk. Enter what you did below. Then do 10 slow wrist circles each way.";

var DAYS = [
  {n: "Day 1", t: "Legs + core", ex: [
    {id: "d1-leg-press", name: "Leg Press", muscle: "Legs",
     how: "Big seated machine with a sliding platform. Sit back, put feet shoulder-width on the platform, push it away, then bend knees slowly back. Don’t lock your knees at the top.",
     tip: "No wrist use at all.",
     start: "40–60 kg", unit: "kg"},
    {id: "d1-seated-leg-curl", name: "Seated Leg Curl", muscle: "Back of thighs",
     how: "Machine where you sit upright, like in a chair, with a pad on top of your thighs and a roller behind your lower legs. Pull your heels down and back, then let them come up slowly. Pick the seated one, not the lying one.",
     tip: "Hold the handles lightly.",
     start: "20–30 kg", unit: "kg"},
    {id: "d1-leg-extension", name: "Leg Extension", muscle: "Front of thighs",
     how: "Seated machine with a pad on your shins. Straighten your legs, pause, lower slowly.",
     tip: "Light weight, smooth reps.",
     start: "20–30 kg", unit: "kg"},
    {id: "d1-stepper-or-bike", name: "Stepper or Stationary Bike", muscle: "Legs and calves",
     how: "Stepper (stair climber): step up and down steadily, standing tall. Or the stationary bike: sit and pedal at an easy pace. Either one works your calves and legs. Enter the minutes you did.",
     tip: "Rest your hands lightly on the rails, don’t lean on them.",
     start: "5–10 minutes, easy pace", unit: "min"},
    {id: "d1-floor-crunch", name: "Floor Crunch", muscle: "Stomach",
     how: "Lie on your back on the mat with your knees bent and feet flat. Cross your arms over your chest. Curl only your head and shoulder blades off the floor, pause for a second, then lower slowly. Don’t pull on your neck.",
     tip: "Arms crossed on your chest, so no wrist load.",
     start: "Bodyweight, 10 reps (enter 0 kg)", unit: "kg"}
  ]},
  {n: "Day 2", t: "Push (chest, shoulders, triceps)", ex: [
    {id: "d2-chest-press", name: "Chest Press Machine", muscle: "Chest",
     how: "Seated machine with two handles at chest height. Push the handles forward, then return slowly. Pick the neutral grip (palms facing each other) if there is one.",
     tip: "Keep wrists straight, strap on.",
     start: "20–30 kg", unit: "kg", elbow: true},
    {id: "d2-shoulder-press", name: "Shoulder Press Machine", muscle: "Shoulders",
     how: "Seated machine, handles by your shoulders. Press up overhead without arching your back.",
     tip: "Neutral grip if possible.",
     start: "15–20 kg", unit: "kg", elbow: true},
    {id: "d2-triceps-pushdown", name: "Triceps Rope Pushdown", muscle: "Back of arms",
     how: "Cable station with a rope on a high pulley. Elbows pinned to your sides, push the rope down and spread the ends.",
     tip: "Don’t bend the wrists.",
     start: "15–20 kg", unit: "kg", elbow: true},
    {id: "d2-db-lateral-raise", name: "Dumbbell Lateral Raise", muscle: "Side shoulders",
     how: "Stand holding a light dumbbell in each hand at your sides. Lift both arms out to the side up to shoulder height with a soft bend in the elbows, then lower slowly. Go light and smooth, no swinging.",
     tip: "Keep wrists straight, strap on.",
     start: "2–4 kg per dumbbell", unit: "kg"},
    {id: "d2-floor-crunch", name: "Floor Crunch", muscle: "Stomach",
     how: "Lie on your back on the mat with your knees bent and feet flat. Cross your arms over your chest. Curl only your head and shoulder blades off the floor, pause for a second, then lower slowly. Don’t pull on your neck.",
     tip: "Arms crossed on your chest, so no wrist load.",
     start: "Bodyweight, 10–12 reps (enter 0 kg)", unit: "kg"},
    {id: "d2-lateral-raise-machine", name: "Lateral Raise Machine", muscle: "Side shoulders",
     how: "Seated machine with side pads. Set the seat so your shoulders line up with the machine’s rotating axes, press your lower back into the cushion and your forearms into the side pads. Lift your elbows up to shoulder height, then lower slowly.",
     tip: "Pads press on your forearms, not the elbow joint.",
     start: "About 20 kg, adjust by feel", unit: "kg"},
    {id: "d2-butterfly", name: "Butterfly Machine (Chest Fly)", muscle: "Chest",
     how: "Sit with your back flat against the pad and your forearms or hands on the handles, elbows at about chest height. Bring the handles together in front of your chest in a hugging motion, squeeze for a second, then open slowly until you feel a gentle stretch across the chest.",
     tip: "Keep a soft bend in the elbows, light grip.",
     start: "15–20 kg", unit: "kg"}
  ]},
  {n: "Day 3", t: "Pull (back, biceps)", ex: [
    {id: "d3-lat-pulldown", name: "Lat Pulldown", muscle: "Upper back",
     how: "Seated machine with a bar overhead and a pad over your thighs. Pull the bar to your upper chest, elbows down. Use the handle with palms facing each other if available.",
     tip: "Think ‘pull with elbows’, not hands.",
     start: "30–40 kg", unit: "kg", elbow: true},
    {id: "d3-seated-cable-row", name: "Seated Cable Row", muscle: "Mid back",
     how: "Sit at the low pulley with a handle, feet on the plates. Pull the handle to your belly, squeeze shoulder blades, return slowly.",
     tip: "Keep wrists straight.",
     start: "30–40 kg", unit: "kg", elbow: true},
    {id: "d3-lateral-raise-machine", name: "Lateral Raise Machine", muscle: "Side shoulders",
     how: "Seated machine with side pads. Set the seat so your shoulders line up with the machine’s rotating axes, press your lower back into the cushion and your forearms into the side pads. Lift your elbows up to shoulder height, then lower slowly until the weight almost touches the stack.",
     tip: "Pads press on your forearms, not the elbow joint.",
     start: "About 10 kg, adjust by feel", unit: "kg"},
    {id: "d3-hammer-curl", name: "Hammer Curl", muscle: "Biceps",
     how: "Light dumbbells held with palms facing each other (like holding a hammer). Curl up, lower slowly.",
     tip: "Start very light.",
     start: "4–6 kg per dumbbell", unit: "kg", elbow: true},
    {id: "d3-back-extension", name: "Back Extension", muscle: "Lower back and butt",
     how: "The angled bench with your feet locked in. Bend forward from the hips, then lift your body until it forms one straight line from head to heels. Pause, then lower slowly. Don’t arch past a straight line.",
     tip: "If you add a plate later, hold it against your chest, not out in front.",
     start: "Bodyweight first, 10 reps (enter 0 kg)", unit: "kg"}
  ]}
];
