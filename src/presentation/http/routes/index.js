import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { receiveAvatar } from '../middlewares/uploadAvatar.js';
import { validate } from '../middlewares/validate.js';
import {
  loginSchema,
  reauthenticateSchema,
  registerSchema,
  requestPasswordResetSchema,
  updatePasswordSchema,
  verifyRecoveryCodeSchema,
} from '../validators/authSchemas.js';
import { replaceSchoolLinksSchema, updateProfileSchema } from '../validators/profileSchemas.js';

export function createRouter({
  authController,
  schoolController,
  userController,
  organizationController,
  catalogController,
  authGateway,
}) {
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
  router.get('/users/me', authenticate(authGateway), userController.show);
  router.patch('/users/me', authenticate(authGateway), validate(updateProfileSchema), userController.update);
  router.put(
    '/users/me/schools',
    authenticate(authGateway),
    validate(replaceSchoolLinksSchema),
    userController.replaceSchools,
  );
  router.post('/users/me/avatar', authenticate(authGateway), receiveAvatar, userController.upload);

  router.get('/me/schools', authenticate(authGateway), schoolController.listMine);
  router.get('/me/schools/linked', authenticate(authGateway), organizationController.listLinked);
  router.get('/me/schools/associations', authenticate(authGateway), organizationController.listSchoolMap);
  router.get('/me/association/schools', authenticate(authGateway), organizationController.listAssociation);
  router.get('/me/union', authenticate(authGateway), organizationController.currentUnion);
  router.get('/me/union/schools', authenticate(authGateway), organizationController.listByUnion);
  router.get('/me/union/associations', authenticate(authGateway), organizationController.listAssociations);

  router.get('/schools', catalogController.listSchools);
  router.get('/unions', catalogController.listUnions);

  return router;
}
