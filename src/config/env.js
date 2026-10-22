import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];

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
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '',
  };
}
