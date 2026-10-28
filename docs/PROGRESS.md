# Progress

## Status

MVP built for the 2026-10-29 user-testing demo. Spec and architecture: `docs/SPEC.md`.

## Checklist

- [x] Spec, stack choice, toolchain
- [x] Pose matching, round state machine, scoring (unit tested)
- [x] Claude Silent Critic endpoint (verified live against the API)
- [x] Mascot, scene, confetti, synthesised sound, replay recorder
- [x] Played in Chrome with the camera (Jason, 2026-10-28)
- [x] Prepared repo for public sharing: README, .env.example
- [ ] Tune thresholds and move angles with real bodies at 2 m

## Notes / decisions

- 2026-10-28: Team score, hybrid judging, adults (API OK), laptop screen only. Confirmed by Jason.
- Port 5188 with strictPort, because 5173 was already in use on this machine.
- Machine note: shell default Node is v21 (EOL). nvm has v20, v22 and v24; the project uses 24.
