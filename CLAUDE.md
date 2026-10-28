# chuckle-vision

A fun, interactive browser game. Game spec: `docs/SPEC.md` (to be written from Jason's brief).

## Stack

- Node 24 (`.nvmrc`; run `nvm use` — the shell default v21 is too old for Vite 8). Vite + TypeScript (strict), no framework. Rendering via `<canvas>` unless the spec says otherwise.
- Vitest for unit tests (pure game logic). Playwright may be added for in-browser checks.

## Commands

- `npm run dev` — dev server (http://localhost:5173)
- `npm run build` — typecheck + production build
- `npm test` — unit tests
- `npm run check` — typecheck + tests; must pass before every commit

## Workflow

- **Commit directly to `main`, often.** One logical change per commit, each one green on `npm run check`. Push after committing.
- **No Claude attribution, ever.** No `Co-Authored-By: Claude` trailer, no "Generated with Claude Code" line, in commits or PRs.
- Commit messages: imperative subject ≤ 72 chars, body only when the why isn't obvious.

## Working on long tasks

- `docs/PROGRESS.md` is the handoff file. Keep its task checklist current: tick items as they land, add what's next. A fresh session starts by reading it and `git log --oneline -20`.
- Finish the open checklist before stopping. Stop to ask only when nothing can move without Jason (a design decision the spec doesn't settle, or a blocked action).
- "Done" means: `npm run check` passes, the feature works in the running game (actually play it — load the page, drive the input, look at the result), and PROGRESS.md is updated.

## Code

- Keep game logic (state, rules, physics) pure and separate from rendering and input, so it's unit-testable without a DOM.
- Fixed-timestep simulation (`src/engine/loop.ts`); render interpolates. Don't put game rules in the render path.
- Small modules, no premature abstraction. Add a dependency only when it clearly earns its weight.

## Design

- Make it look deliberate, not generic. Avoid default "AI look" choices: no cream/off-white backgrounds, pill buttons, monospace labels, or purple gradients unless the spec asks. Pick a distinct palette and type for the game and record it in `docs/SPEC.md`.
