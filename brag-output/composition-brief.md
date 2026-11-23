# Hyperframes Composition Brief: TraceNest

## Objective
Create a short launch-style brag video for TraceNest.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080, 30fps
- Duration: 21.5 seconds

## Source Material
- Project root: `F:\Coding\PROJECTS\TracNest`
- Primary files read: README.md, client/src/index.css, client/src/pages/TestSuites.tsx,
  client/src/components/response/ResponseViewer.tsx, client/src/components/Sidebar.tsx,
  server/src/services/executor/execute.ts, live demo run results
- Product name: TraceNest
- Tagline / strongest claim: "Find API problems before your users do." (README)
- Key UI to recreate: Test Suites assertion rows + run summary + regression panel; response viewer
  JSON; Playground URL bar with BLOCKED badge
- Copy that must appear verbatim:
  - Find API problems before your users do.
  - All passed · 8 passed · 949 ms
  - age is missing
  - age: expected type number, got undefined
  - Target address is not allowed

## Creative Direction
- Tone preset: polished
- Creative direction: quiet, confident dev-tool launch film (Linear / Vercel product video)
- Interpretation: soft crossfades/slides, generous holds, mixed-case Geist, one teal accent; drama from
  red/green state changes inside real UI
- Angle: the moment a passing suite breaks because a field vanished, and TraceNest names the field
- Hook: JSON `"age": 29` strikes out red, `"phone"` slides in green — "Your API just changed."
- Outro: mark + TraceNest + tagline on the 20.02s strong cue
- Avoid: generic SaaS language, abstract filler, redesigning the app's look

## Visual Identity
- Background oklch(0.155 0.004 270); surface oklch(0.185 0.005 270); card oklch(0.2 0.005 270);
  border oklch(1 0 0 / 8%)
- Text oklch(0.96 0.003 270); muted oklch(0.68 0.01 270)
- Accent oklch(0.78 0.12 180); success oklch(0.76 0.15 155); destructive oklch(0.68 0.19 22)
- Fonts: Geist Variable (display/body), JetBrains Mono Variable (code) — local woff2 copied into assets
- Logo: lucide Waypoints mark in teal

## Storyboard
Contract: `brag-output/brag-plan.md`.
1. Hook — 3.0s — JSON strike/insert, "Your API just changed."
2. Reveal — 3.0s — mark, TraceNest, tagline
3. Suite passes — 4.5s — click Run suite, 8 green ticks, "All passed · 8 passed · 949 ms"
4. Rerun breaks — 5.0s — two red rows, regression panel (age removed, phone added, 2 newly failing)
5. Guard — 3.0s — URL types metadata IP, Send, BLOCKED
6. Outro — 3.0s — mark + wordmark + tagline

## Audio
- Role: warm bed with sparse accents
- Music: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`, ~0.55 volume, fade-in
  0.4s, fade-out 1.5s
- Cue source: bundled preset (strong cues 16.02, 17.02, 18.02, 20.02; beats every ~0.5s from 3.02)
- Audio-reactive: subtle — outro glow intensity follows precomputed music energy (not waveform UI)
- SFX (Kenney, low HF risk): impactSoft_medium for strike/wordmark/red flip/BLOCKED; ui/click2 for
  button presses; interface/click_003 for assertion ticks and typing at low volume; card-slide-1 for the
  regression panel
- Audio files copied into `composition/assets/`
