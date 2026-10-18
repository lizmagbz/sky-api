import { loadEnv } from './config/env.js';
import { createApp } from './app.js';

const env = loadEnv();
const { app, prisma } = createApp(env);

const server = app.listen(env.port, () => {
  console.log(`API disponível em http://localhost:${env.port}`);
});

function shutdown() {
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
