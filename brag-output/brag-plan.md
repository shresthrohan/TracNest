# Brag Plan: TraceNest

## What is this app?
An API reliability studio: send requests through an SSRF-guarded server, save them, write assertion
suites, and get told exactly what changed when an API's response shape shifts between runs.

## The angle
Every developer has shipped against an API that quietly changed under them. TraceNest's best moment is
real and specific: a suite that passed 8/8 runs again, a field vanished, and TraceNest names the field,
shows the diff, and flags the two checks that just started failing. The video *is* that moment, told in
the app's own dark Linear-style UI. No invented metrics — the numbers on screen are the ones from the
live demo run (8 passed, 6/2 after the change, `age` removed, `phone` added).

## Hook (first 2-3 seconds)
A single JSON response, centered, monospace, in the app's response viewer style. The line `"age": 29`
turns red and strikes out; `"phone": "+81 965-431-3024"` slides in green. Caption types in:
**"Your API just changed."** Silence-to-music: the bed starts under it.

## Key moments (the middle)
- **Suite passes, then breaks.** 8 assertion rows tick green one by one ("All passed · 8 passed"),
  then the rerun flips two rows red: `age is missing`, `age: expected type number, got undefined`.
- **Regression panel names the cause.** "age — removed", "phone — added", "2 newly failing".
- **The guard.** Playground URL types `http://169.254.169.254/latest/meta-data` → Send →
  `BLOCKED · Target address is not allowed`. Caption: "Checked at connect time."

## Outro / punchline
TraceNest wordmark with the Waypoints mark, then the README tagline verbatim:
**"Find API problems before your users do."** Lands on a strong cue, music rings out.

## User flow worth showing
Saved request → run the test suite (all green) → API changes → rerun → regression panel shows the
removed/added fields and newly failing assertions. Secondary beat: Playground send blocked by the
SSRF guard.

## Tone
- Preset: polished
- Creative direction: quiet, confident dev-tool launch film (Linear / Vercel product video)
- Interpretation: 5 scenes, soft crossfades and slides, generous holds, mixed-case Geist type, one
  teal accent; the drama comes from red/green state changes in real UI, not from motion graphics.

## Format: landscape — 1920x1080
## Duration: 21.5s

## Visual identity (from the project)
- Background: oklch(0.155 0.004 270)
- Surface / card: oklch(0.185 0.005 270) / oklch(0.2 0.005 270), border oklch(1 0 0 / 8%)
- Accent (primary teal): oklch(0.78 0.12 180)
- Success: oklch(0.76 0.15 155) · Destructive: oklch(0.68 0.19 22) · Muted text: oklch(0.68 0.01 270)
- Text: oklch(0.96 0.003 270)
- Display + body font: Geist Variable · Code: JetBrains Mono Variable
- Strongest visual element: response viewer JSON, suite assertion rows with check marks, method/status badges

## Share copy (draft)
Built TraceNest: send an API request, save it, add assertions — and when the response quietly changes,
it tells you which field moved and which checks just broke.

## Audio direction
- Role: warm bed with sparse professional accents
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (120 BPM, beats from 3.02s)
- Music treatment: start at 0 at moderate level (~0.55), soft fade-in 0.4s, fade out over the last 1.5s
- Music cue guidance: preset read. Strong cues 16.02, 17.02, 18.02, 20.02. Lock the BLOCKED badge near
  17.02 and the outro wordmark near 20.02. Beat grid every 0.5s; assertion ticks on every other beat.
- Audio-reactive treatment: subtle — bass/RMS warms the teal glow behind the wordmark only
- SFX posture: sparse, motion-matched, low HF risk
- Audio-coupled moments: hook strike/insert, typed captions (very quiet key ticks), assertion ticks,
  red flip on rerun, Send click, BLOCKED badge, wordmark landing
- Restraint rule: no hit on every element; nothing bright or repeated in the foreground

## Storyboard

### Scene 1 — Hook: the response changed — 3.0s
Centered response viewer card (200 · 182 ms · 77 B). JSON lines `id`, `firstName`, `email`, `age`.
`"age": 29` turns red + strikethrough and collapses; `"phone"` line slides in green. Caption below,
typed: "Your API just changed." (settled ≥1.2s).
Sequential/interaction: yes — strike, then insert, then typed caption
Audio intent: curiosity; soft impact on the strike
Audio-coupled idea: soft key ticks while the caption types
Music: bed starts softly
Transition mood: soft → Scene 2

### Scene 2 — Reveal — 3.0s
Waypoints mark + "TraceNest" large, then "Find API problems before your users do." (settled ≥2s).
Sequential/interaction: mark, then wordmark, then tagline
Audio intent: confident arrival
Audio-coupled idea: one warm soft impact on the wordmark
Transition mood: slide up → Scene 3

### Scene 3 — Suite passes — 4.5s
Test Suites UI: header "User 1 contract", `GET Get user 1`, "Run suite" button gets a simulated
click. 8 rows (Field exists/type for id, firstName, email, age) tick green, then summary
"All passed · 8 passed · 949 ms". Small caption top-left: "Assertions on every run."
Sequential/interaction: cursor click on Run suite; rows tick one by one (fast), summary holds ≥1.2s
Audio intent: tidy, satisfying
Audio-coupled idea: quiet click per tick (every other beat), button click
Transition mood: none (same UI continues) → Scene 4

### Scene 4 — Rerun breaks, regression explains — 5.0s
Same UI. Rerun click. Two `age` rows flip to red ✗ with messages `age is missing` and
`age: expected type number, got undefined`; summary turns red "2 failed · 6 passed". Regression panel
slides in: `age` removed (before 29), `phone` added, "2 newly failing". Caption: "Every run is diffed
against the last one." (settled ≥2s).
Sequential/interaction: click → flips → panel
Audio intent: tension then clarity
Audio-coupled idea: soft low hit on the red flip; card slide for the panel
Transition mood: soft crossfade → Scene 5

### Scene 5 — The guard — 3.0s
Playground bar: method GET, URL types `http://169.254.169.254/latest/meta-data`, Send click, badge
`BLOCKED` with "Target address is not allowed". Caption: "SSRF-guarded. Checked at connect time."
Sequential/interaction: typing, click, badge
Audio intent: firm "no"
Audio-coupled idea: key ticks, click, single soft impact on BLOCKED (near 17.02 strong cue)
Transition mood: soft → Scene 6

### Scene 6 — Outro — 3.0s
Mark + "TraceNest" + tagline, teal glow breathing subtly with the music. Holds to the end.
Audio intent: resolve; music fades out
Audio-coupled idea: wordmark lands on 20.02 strong cue
Transition mood: end

Total: 3.0 + 3.0 + 4.5 + 5.0 + 3.0 + 3.0 = 21.5s

**Music mood for this video:** upbeat but restrained
**Audio summary:** a warm bed enters under the hook, small tidy ticks through the passing suite, one low
hit when it breaks, a firm accent on BLOCKED, and the bed rings out under the wordmark.

Data note: all data shown is public DummyJSON sample data or invented stand-ins (`api.example.com`);
no real users, hosts or secrets.
