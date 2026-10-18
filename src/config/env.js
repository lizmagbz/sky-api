import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET'];

export function loadEnv() {
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente ausentes: ${missing.join(', ')}. Copie .env.example para .env e preencha os valores.`,
    );
  }

  return {
    port: Number(process.env.PORT) || 3000,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  };
}
