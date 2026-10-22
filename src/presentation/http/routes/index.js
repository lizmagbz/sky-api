import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import {
  loginSchema,
  reauthenticateSchema,
  registerSchema,
  requestPasswordResetSchema,
  updatePasswordSchema,
  verifyRecoveryCodeSchema,
} from '../validators/authSchemas.js';

export function createRouter({ authController, schoolController, authGateway }) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.post('/auth/register', validate(registerSchema), authController.register);
  router.post('/auth/login', validate(loginSchema), authController.login);
  router.get('/auth/me', authenticate(authGateway), authController.me);
  router.post(
    '/auth/reauthenticate',
    authenticate(authGateway),
    validate(reauthenticateSchema),
    authController.reauthenticate,
  );
  router.post(
    '/auth/password/recover',
    validate(requestPasswordResetSchema),
    authController.recoverPassword,
  );
  router.post(
    '/auth/password/verify',
    validate(verifyRecoveryCodeSchema),
    authController.verifyRecovery,
  );
  router.post(
    '/auth/password',
    authenticate(authGateway),
    validate(updatePasswordSchema),
    authController.resetPassword,
  );
  router.get('/me/schools', authenticate(authGateway), schoolController.listMine);

  return router;
}
