# Chuckle Vision: spec

Plan page with architecture diagrams: https://claude.ai/artifact/DRmjtpjhQNPUv7nATB9y9B

## Brief

A wordless icebreaker for two strangers, mostly university students from different backgrounds who may not share a first language. They stand side by side in front of the laptop webcam. A cartoon mascot (Bop) acts out a silly pose, they copy it, and the game scores them **as a team**. The goal is laughter. Demo: user testing on 2026-10-29.

## Decisions (confirmed with Jason 2026-10-28)

- Team score, not head-to-head.
- Hybrid judging: live scoring runs on the laptop. Claude vision sees one snapshot per round and returns only an emoji award, three judge cards and a smile count.
- Players are adults. Snapshots may go to the Anthropic API with verbal consent, are held in memory only and are never saved.
- Laptop screen only, so the layout is big and bold enough to read from about 2 m.

## Stack

- **Vite + TypeScript, Canvas 2D, no game engine.** Camera, pose tracking, audio and fullscreen all work natively in Chrome. An engine adds build and camera-plugin risk and gives nothing back for a 2D overlay.
- **MediaPipe Pose Landmarker (full model, 2 poses, GPU with CPU fallback).** The wasm and model are served from `public/` by `scripts/fetch-assets.mjs`, so the game runs offline.
- **Claude (`claude-opus-5-5`, effort low, structured output)** via a Vite dev-server middleware (`server/critic.ts`), so the API key stays in `.env.local` on the server side. Server-side refusal fallbacks are on (`fallbacks: "default"`).
- **Web Audio**: every sound is synthesised. There are no assets and no speech.

## Architecture

- `src/core/`: pure, unit-tested game logic.
  - `shape.ts`: limb directions, matching, mirror-forgiveness, sync, energy.
  - `moves.ts`: move library and the mascot demo animation.
  - `game.ts`: round state machine and scoring.
  - `judging.ts`: verdict validation and the local fallback.
- `src/vision/`: camera, tracking, slot assignment (screen-left = player 1), and the hold-phase recorder for replays and photos.
- `src/render/`: mascot, scene and confetti.
- `src/audio/`: synthesised sounds.
- `src/net/`: the critic client.
- `src/main.ts`: wiring and host keys.

Every move is stored once as a target Shape. That Shape animates the mascot and is also the scoring target. Scoring compares limb angles in mirrored screen space, so body size and distance don't matter. Mirror images of a pose also count.

## Round (about 22 s), 7 rounds

1. Demo, 4 s: the mascot performs the move.
2. Countdown: 3 beats.
3. Hold (freeze), 4 s, scored every frame.
4. React, 3.2 s:
   - Success: stars, confetti, fanfare, the mascot backflips.
   - Failure: rain cloud, sad trombone, the mascot deflates. The mascot always takes the sadness, never the players.
5. Replay, 4.6 s: the best moment in slow motion, with the judges' cards, the award and the laugh bonus.

The final screen shows a trophy (gold, silver, bronze or tin can), the total and a photo strip of the four best moments.

Scoring:
- Team match is the best 0.6 s rolling average of the players' mean match during the hold.
- Stars at 0.5, 0.65 and 0.8.
- Points = match × 100, plus a sync bonus of up to 40, plus 15 per smiling face (from Claude).

Moves: starfish, robot, chicken wings, superhero, slow-mo dodge, wildcard "copy your partner" (scored on sync × energy) and a team-arch finale.

## Cultural guardrails

- Excluded:
  - Hand signs: thumbs up, OK, V, pointing, beckoning, crossed fingers.
  - Showing the soles of the feet, and any touching.
  - Hip or chest moves, and anything flirtatious.
  - Pig, dog and cow impressions; prayer-like poses.
  - Accents, costumes and stereotypes.
- The mascot has no skin tone, gender or nationality.
- On screen: no words during play, only numbers, symbols and emoji. The product name shows on the attract screen.
- Claude awards come from a fixed emoji allowlist. Claude is told never to judge appearance.

## Look

- Ultramarine stage (`#1E2BC4`) with a dot grid, ink (`#12122A`) camera side.
- Sunflower mascot (`#FFC21A`).
- Players: tomato (`#FF5A36`) and cyan (`#22C7EE`).
- Mint (`#3DDC97`) for success, frost (`#BFE9FF`) for the freeze.
- Type: Bungee (bundled through @fontsource), used for numbers and the logo.

## Host keys

| Key | Action |
|---|---|
| Space / Enter | Start or skip ahead |
| R | Reset |
| 1 | Solo test mode on or off |
| E | Cycle difficulty (easy, normal, hard) |
| D | Show tracking skeletons |
| M | Mute |
| F | Fullscreen |
| S | Save a screenshot |

Players can also start by both raising their hands above their heads for 1 s.
