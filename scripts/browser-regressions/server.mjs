// Local-only, synthetic UI fixture. No production auth, database or model access.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../..', import.meta.url));
const projectId = '111111111111111111111111';
const projects = [{ id: projectId, name: 'Synthetic launch project' }, { id: '222222222222222222222222', name: 'Synthetic support project' }];
const rows = [];
const server = await createServer({
  configFile: false, root,
  envDir: false,
  define: { 'process.env': '{}' },
  resolve: { alias: { '@': path.join(root, 'src') } },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 4178, strictPort: true },
  plugins: [{ name: 'synthetic-api', configureServer(vite) {
    vite.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith('/api/')) return next();
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      if (request.url === '/api/ai/team/projects') return response.end(JSON.stringify({ projects, limited: false }));
      if (request.url.startsWith('/api/ai/team/queue?') && request.method === 'GET') {
        const query = new URL(request.url, 'http://127.0.0.1').searchParams;
        const matching = rows.filter(row => row.kind === 'task' &&
          ['employee', 'status'].every(key => !query.has(key) || row[key] === query.get(key)) &&
          (!query.has('recurring') || row.cadence !== 'once') && (!query.has('cursor') || row.id < query.get('cursor'))).slice().reverse();
        return response.end(JSON.stringify({ items: matching.slice(0, 25).map(row => ({ ...row, projectName: projects.find(project => project.id === row.projectId)?.name })), nextCursor: matching.length > 25 ? matching[24].id : null }));
      }
      const selected = projects.find(project => request.url.startsWith(`/api/projects/${project.id}/ai/team`));
      if (!selected) { response.statusCode = 404; return response.end('{}'); }
      if (request.method === 'GET') {
        const query = new URL(request.url, 'http://127.0.0.1').searchParams;
        const matching = rows.filter(row => row.projectId === selected.id &&
          ['employee', 'kind', 'status'].every(key => !query.has(key) || row[key] === query.get(key)) &&
          (!query.has('recurring') || row.cadence !== 'once') && (!query.has('cursor') || row.id < query.get('cursor'))).slice().reverse();
        return response.end(JSON.stringify({
          project: selected,
          context: {
            projectName: selected.name,
            inferenceReady: false,
            remoteEnabled: false,
            planningEnabled: true,
            unavailableReason: 'Synthetic fixture does not call a model.',
            included: [
              `Project name: ${selected.name}`,
              'Selected AI employee role preset',
              'Recent objectives in project: 0',
              'Recent AI runs in project: 0',
            ],
            recentObjectiveCount: 0,
            recentRunCount: 0,
          },
          items: matching.slice(0, 25),
          nextCursor: matching.length > 25 ? matching[24].id : null,
        }));
      }
      let body = ''; for await (const chunk of request) { body += chunk; if (body.length > 10000) { response.statusCode = 413; return response.end('{}'); } }
      try {
        const input = JSON.parse(body);
        if (request.method === 'PATCH') {
          const row = rows.find(row => row.id === input.id && row.projectId === selected.id);
          if (row) row.status = 'cancelled';
          response.end(JSON.stringify({ status: 'cancelled' }));
        } else if (request.method === 'POST' && !rows.some(row => row.requestId === input.requestId)) {
          const userRow = {
            ...input,
            projectId: selected.id,
            id: String(rows.length + 1).padStart(24, '0'),
            role: 'user',
            status: 'saved',
            createdAt: new Date().toISOString(),
          };
          rows.push(userRow);
          let reply = null;
          if (input.kind === 'message') {
            reply = {
              id: String(rows.length + 1).padStart(24, '0'),
              role: 'status',
              text: 'Synthetic fixture does not call a model.',
              failureCategory: 'unavailable',
            };
            rows.push({
              requestId: crypto.randomUUID(),
              employee: input.employee,
              kind: 'message',
              role: 'status',
              text: reply.text,
              cadence: 'once',
              failureCategory: 'unavailable',
              parentRequestId: input.requestId,
              projectId: selected.id,
              id: reply.id,
              status: 'saved',
              createdAt: new Date().toISOString(),
            });
          }
          response.end(JSON.stringify({ id: userRow.id, status: 'saved', reply }));
        } else {
          response.end(JSON.stringify({ status: 'saved' }));
        }
      } catch { response.statusCode = 400; response.end('{}'); }
    });
  } }],
});
await server.listen();
console.log('Synthetic browser fixture: http://127.0.0.1:4178/scripts/browser-regressions/index.html');
