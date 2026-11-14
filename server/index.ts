import { createTownServer } from './server.ts';

const port = Number(process.env.PORT ?? 2567);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const host = process.env.HOST ?? '127.0.0.1';
const { server } = createTownServer();
await server.listen(port, host);
console.log(`Town presence server listening on ${host}:${port}`);
let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  await server.gracefullyShutdown(false);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
