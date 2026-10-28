# chuckle-vision

A wordless two-player camera icebreaker game. Spec: `docs/SPEC.md`.

## Stack

Vite + TypeScript + Canvas 2D, MediaPipe pose tracking, Claude vision through a dev-server middleware. Why: `docs/SPEC.md`.

Node 24 via nvm (`nvm use`). The API key goes in `.env.local` as `ANTHROPIC_API_KEY` (gitignored).

- Run: `npm run dev`, then open http://localhost:5188 in Chrome. This also fetches the pose model and wasm into `public/` on first run.
- Test: `npm test`
- Check (types + tests): `npm run check`

## Workflow

- **Commit directly to `main`, often.** One logical change per commit, each one passing the project's checks. Push after committing.
- **No Claude attribution, ever.** No `Co-Authored-By: Claude` trailer, no "Generated with Claude Code" line, in commits or PRs.
- Commit messages: imperative subject ≤ 72 chars, body only when the why isn't obvious.

## Working on long tasks

- `docs/PROGRESS.md` is the handoff file. Keep its task checklist current: tick items as they land, add what's next. A fresh session starts by reading it and `git log --oneline -20`.
- Finish the open checklist before stopping. Stop to ask only when nothing can move without Jason (a design decision the spec doesn't settle, or a blocked action).
- "Done" means: checks pass, the feature works in the running game (actually play it — launch it, drive the input, look at the result), and PROGRESS.md is updated.

## Code

- Keep game logic (state, rules, physics) pure and separate from rendering and input, so it's testable without the renderer.
- Small modules, no premature abstraction. Add a dependency only when it clearly earns its weight.

## Design

- Make it look deliberate, not generic. Avoid default "AI look" choices: no cream/off-white backgrounds, pill buttons, monospace labels, or purple gradients unless the spec asks. Pick a distinct palette and type for the game and record it in `docs/SPEC.md`.
