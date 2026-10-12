import { loadEnv } from './config/env.js';
import { createApp } from './app.js';

const env = loadEnv();
const app = createApp(env);

app.listen(env.port, () => {
  console.log(`API disponível em http://localhost:${env.port}`);
});
