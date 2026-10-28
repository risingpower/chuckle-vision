# Chuckle Vision

A wordless icebreaker game for two people who have just met. They stand side by side in front of a laptop webcam. A cartoon mascot acts out a silly pose, they copy it, and the game scores them as a team. There's no text to read during play, so it works across languages.

- **Pose tracking runs on the laptop** (MediaPipe) and scores every frame live.
- **Claude judges the best moment** of each round. It sees one snapshot and returns three judges' score cards, an emoji award and a count of smiling faces (smiles earn bonus points).
- **Rewards:** stars, confetti and a slow-motion replay. **Failure:** a rain cloud and a sad trombone. The mascot takes the disappointment, never the players.
- **Cultural guardrails:** no hand signs, pointing, touching or animal impressions that are offensive in some cultures. Details in [`docs/SPEC.md`](docs/SPEC.md).

## Run it

You need Node 24 (`nvm use`) and Chrome.

```sh
npm install
cp .env.example .env.local   # optional: add an Anthropic API key
npm run dev                  # then open http://localhost:5188
```

On first run, `npm run dev` downloads the pose model and copies the MediaPipe runtime into `public/`. After that the game works offline. Without an API key, or without a network, the judges score locally from the pose match.

Players stand about 2 m back so both are in frame from head to hips. Click ▶ and allow the camera. To start, press Space or have both players raise their hands above their heads.

### Host keys

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

## Privacy

Camera frames are processed in the browser. With an API key set, one JPEG snapshot per round goes to the Anthropic API through the local dev server, so the key never reaches the browser. Snapshots are held in memory only and nothing is saved to disk. Tell players before they start.

## Development

```sh
npm test        # unit tests
npm run check   # type check + tests
```

Game rules live in `src/core/` as pure TypeScript and are tested without a camera. Rendering, audio, camera and network code sit around them. Architecture and design decisions: [`docs/SPEC.md`](docs/SPEC.md).

## Credits

- Pose tracking: [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) (Apache 2.0)
- Display font: [Bungee](https://fonts.google.com/specimen/Bungee) by David Jonathan Ross (SIL Open Font License)
- Judging: [Claude](https://www.anthropic.com/api) by Anthropic
