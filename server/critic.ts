// The Silent Critic: one Claude vision call per round. Runs in the local dev
// server so the API key never reaches the browser. Snapshots stay in memory.

import Anthropic from '@anthropic-ai/sdk';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AWARDS } from '../src/core/judging.ts';

const MODEL = 'claude-opus-5-5';
const MAX_BODY = 4 * 1024 * 1024;

const MOVE_NAMES: Record<string, string> = {
  starfish: 'a starfish: arms flung wide and up',
  robot: 'a robot: elbows bent at right angles, forearms up',
  chicken: 'chicken wings: hands near shoulders, elbows flapping',
  superhero: 'a superhero: one fist to the sky, the other hand on the hip',
  dodge: 'a slow-motion action-film dodge: leaning sideways, arms flailing',
  partner: 'copy your partner: the two players mirror each other',
  arch: 'a team arch: both lean in and raise their inner arms to make one shape',
};

const SYSTEM = `You are a panel of three judges at a wordless icebreaker game. Two university students who have just met, often from different countries, stand side by side and copy a cartoon mascot's silly pose. You see the moment they held the pose.

Judge commitment, energy and how well they matched the pose and each other. Be warm and generous: anyone visibly trying scores at least 5. Judges one and two are enthusiastic. Judge three (judge3) is the famously hard-to-please one and usually scores one to three points lower, for comic effect.

Never judge or mention appearance, bodies, clothing, skin, ethnicity, gender or age. Your output is only numbers and one award symbol from the allowed list, chosen to fit the pose and the energy. Count how many people in the image are visibly smiling or laughing (0, 1 or 2). If nobody is visible, still give low scores from 1 to 3.`;

const SCHEMA = {
  type: 'object',
  properties: {
    award: { type: 'string', enum: [...AWARDS] },
    judge1: { type: 'integer' },
    judge2: { type: 'integer' },
    judge3: { type: 'integer' },
    smiles: { type: 'integer' },
  },
  required: ['award', 'judge1', 'judge2', 'judge3', 'smiles'],
  additionalProperties: false,
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) reject(new Error('Snapshot too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function createCriticHandler(apiKey: string | undefined) {
  const client = apiKey ? new Anthropic({ apiKey, timeout: 20_000, maxRetries: 0 }) : null;
  if (!client) console.warn('[critic] ANTHROPIC_API_KEY not set: judges will use local scores.');

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    if (!client) return send(res, 503, { error: 'No API key configured' });
    const started = Date.now();
    try {
      const { image, move } = JSON.parse(await readBody(req)) as { image?: string; move?: string };
      if (typeof image !== 'string' || !image) return send(res, 400, { error: 'Missing image' });
      const moveName = MOVE_NAMES[move ?? ''] ?? 'a silly pose';

      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
              { type: 'text', text: `The pose was ${moveName}. Give your verdict.` },
            ],
          },
        ],
      });

      if (response.stop_reason === 'refusal') return send(res, 422, { error: 'Declined' });
      const text = response.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') return send(res, 502, { error: 'No verdict' });
      const v = JSON.parse(text.text) as { award: string; judge1: number; judge2: number; judge3: number; smiles: number };
      console.log(`[critic] ${move} verdict in ${Date.now() - started} ms`);
      return send(res, 200, { award: v.award, judges: [v.judge1, v.judge2, v.judge3], smiles: v.smiles });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) console.error('[critic] API key rejected');
      else if (err instanceof Anthropic.RateLimitError) console.error('[critic] Rate limited');
      else if (err instanceof Anthropic.APIError) console.error(`[critic] API error ${err.status}: ${err.message}`);
      else console.error('[critic]', err instanceof Error ? err.message : err);
      return send(res, 502, { error: 'Critic unavailable' });
    }
  };
}
