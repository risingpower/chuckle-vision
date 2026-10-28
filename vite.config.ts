import { defineConfig, loadEnv, type Plugin } from 'vite';
import { createCriticHandler } from './server/critic.ts';

function critic(apiKey: string | undefined): Plugin {
  const handler = createCriticHandler(apiKey);
  return {
    name: 'silent-critic',
    configureServer(server) {
      server.middlewares.use('/api/critic', (req, res) => void handler(req, res));
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/critic', (req, res) => void handler(req, res));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [critic(env.ANTHROPIC_API_KEY)],
    server: { port: 5188, strictPort: true },
    preview: { port: 5188, strictPort: true },
  };
});
