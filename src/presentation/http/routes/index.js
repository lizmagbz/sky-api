import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, registerSchema } from '../validators/authSchemas.js';

export function createRouter({ authController, schoolController, authGateway }) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.post('/auth/register', validate(registerSchema), authController.register);
  router.post('/auth/login', validate(loginSchema), authController.login);
  router.get('/auth/me', authenticate(authGateway), authController.me);
  router.get('/me/schools', authenticate(authGateway), schoolController.listMine);

  return router;
}
