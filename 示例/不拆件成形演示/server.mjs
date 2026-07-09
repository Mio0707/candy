import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const port = Number(process.env.PORT ?? 5177);

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.glb', 'model/gltf-binary'],
  ['.svg', 'image/svg+xml'],
  ['.md', 'text/markdown; charset=utf-8'],
]);

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/') {
    pathname = '/示例/不拆件成形演示/index.html';
  }

  const filePath = path.resolve(root, `.${pathname}`);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': types.get(path.extname(filePath)) ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`不拆件成形演示: http://127.0.0.1:${port}/示例/不拆件成形演示/index.html`);
});
