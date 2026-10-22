import { z } from 'zod';
import { appRoles } from '../../../domain/profile/appRoles.js';

export const updateProfileSchema = z.strictObject({
  name: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').optional(),
  role: z.enum(appRoles).optional(),
  unionId: z.number().int().positive().nullable().optional(),
  avatarFocusX: z.number().min(-1).max(1).optional(),
  avatarFocusY: z.number().min(-1).max(1).optional(),
  avatarFocusScale: z.number().min(1).max(3).optional(),
});

export const replaceSchoolLinksSchema = z.strictObject({
  deleteLinkIds: z.array(z.number().int().positive()).default([]),
  schoolIds: z.array(z.number().int().positive()).default([]),
});
