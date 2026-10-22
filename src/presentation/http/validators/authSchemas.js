import { z } from 'zod';

const signupRoles = ['pastor', 'coordenador', 'coordenador_uniao'];

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(signupRoles).optional(),
  schoolId: z.number().int().positive().optional(),
  additionalSchoolIds: z.array(z.number().int().positive()).optional(),
  unionId: z.number().int().positive().optional(),
});

export const loginSchema = z.object({
  email: z.email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export const reauthenticateSchema = z.object({
  password: z.string().min(1, 'Senha obrigatória'),
});
