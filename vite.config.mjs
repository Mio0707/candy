import { defineConfig } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function gestureSampleReceiver() {
  return {
    name: 'gesture-sample-receiver',
    configureServer(server) {
      server.middlewares.use('/gesture-samples', (request, response, next) => {
        if (request.method !== 'POST') {
          next();
          return;
        }

        let body = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
          body += chunk;
        });
        request.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const outputDir = path.resolve('gesture-samples');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const pretty = `${JSON.stringify(payload, null, 2)}\n`;

            await mkdir(outputDir, { recursive: true });
            await writeFile(path.join(outputDir, 'latest.json'), pretty, 'utf8');
            await writeFile(path.join(outputDir, `sample-${timestamp}.json`), pretty, 'utf8');

            response.statusCode = 200;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({ ok: true, path: 'gesture-samples/latest.json' }));
          } catch (error) {
            response.statusCode = 500;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [gestureSampleReceiver()],
  build: {
    rollupOptions: {
      input: {
        'model-stage': 'model-stage/index.html',
        'gesture-sampler': 'model-stage/gesture-sampler.html',
      },
    },
  },
});
