import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { receiveAvatar } from '../middlewares/uploadAvatar.js';
import { receiveRecordImage } from '../middlewares/uploadRecordImage.js';
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
import { createRecordSchema, updateRecordFileSchema, updateRecordSchema } from '../validators/recordSchemas.js';
import { upsertGoalSchema } from '../validators/goalSchemas.js';
import { createScheduleEventSchema, updateScheduleEventSchema } from '../validators/scheduleSchemas.js';

export function createRouter({
  authController,
  accountController,
  schoolController,
  userController,
  organizationController,
  catalogController,
  topicController,
  recordController,
  recordFileController,
  goalController,
  scheduleEventController,
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
  router.post(
    '/account',
    authenticate(authGateway),
    validate(reauthenticateSchema),
    accountController.remove,
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

  router.get('/topics', authenticate(authGateway), topicController.list);
  router.get('/records', authenticate(authGateway), recordController.list);
  router.post('/records', authenticate(authGateway), validate(createRecordSchema), recordController.create);
  router.patch('/records/:id', authenticate(authGateway), validate(updateRecordSchema), recordController.update);
  router.delete('/records/:id', authenticate(authGateway), recordController.remove);
  router.get('/records/:id/files', authenticate(authGateway), recordFileController.list);
  router.post('/records/:id/files', authenticate(authGateway), receiveRecordImage, recordFileController.upload);
  router.delete('/records/:id/files', authenticate(authGateway), recordFileController.removeAll);
  router.patch(
    '/records/:id/files/:fileId',
    authenticate(authGateway),
    validate(updateRecordFileSchema),
    recordFileController.update,
  );
  router.delete('/records/:id/files/:fileId', authenticate(authGateway), recordFileController.remove);

  router.get('/goals/progress', authenticate(authGateway), goalController.progress);
  router.get('/goals', authenticate(authGateway), goalController.list);
  router.put('/goals', authenticate(authGateway), validate(upsertGoalSchema), goalController.upsert);

  router.get('/schedule-events', authenticate(authGateway), scheduleEventController.list);
  router.post(
    '/schedule-events',
    authenticate(authGateway),
    validate(createScheduleEventSchema),
    scheduleEventController.create,
  );
  router.patch(
    '/schedule-events/:id',
    authenticate(authGateway),
    validate(updateScheduleEventSchema),
    scheduleEventController.update,
  );
  router.delete('/schedule-events/:id', authenticate(authGateway), scheduleEventController.remove);

  return router;
}
