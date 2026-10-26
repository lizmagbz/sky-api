import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { AccountErasure } from './application/use-cases/account/AccountErasure.js';
import { DeleteAccount } from './application/use-cases/account/DeleteAccount.js';
import { ExternalAccountRemoval } from './application/use-cases/account/ExternalAccountRemoval.js';
import { OwnedFileRemoval } from './application/use-cases/account/OwnedFileRemoval.js';
import { AuthenticateUser } from './application/use-cases/auth/AuthenticateUser.js';
import { GetAuthenticatedUser } from './application/use-cases/auth/GetAuthenticatedUser.js';
import { ReauthenticateUser } from './application/use-cases/auth/ReauthenticateUser.js';
import { RegisterUser } from './application/use-cases/auth/RegisterUser.js';
import { RequestPasswordReset } from './application/use-cases/auth/RequestPasswordReset.js';
import { UpdatePassword } from './application/use-cases/auth/UpdatePassword.js';
import { VerifyRecoveryCode } from './application/use-cases/auth/VerifyRecoveryCode.js';
import { ListPublicSchools } from './application/use-cases/catalog/ListPublicSchools.js';
import { ListPublicUnions } from './application/use-cases/catalog/ListPublicUnions.js';
import { ListGoals } from './application/use-cases/goals/ListGoals.js';
import { ReadGoalProgress } from './application/use-cases/goals/ReadGoalProgress.js';
import { UpsertGoal } from './application/use-cases/goals/UpsertGoal.js';
import { CreateRecord } from './application/use-cases/records/CreateRecord.js';
import { DeleteRecord } from './application/use-cases/records/DeleteRecord.js';
import { DeleteRecordFile } from './application/use-cases/records/DeleteRecordFile.js';
import { DeleteRecordFiles } from './application/use-cases/records/DeleteRecordFiles.js';
import { ListRecordFiles } from './application/use-cases/records/ListRecordFiles.js';
import { ListRecords } from './application/use-cases/records/ListRecords.js';
import { ListTopics } from './application/use-cases/records/ListTopics.js';
import { UpdateRecord } from './application/use-cases/records/UpdateRecord.js';
import { UpdateRecordFile } from './application/use-cases/records/UpdateRecordFile.js';
import { UploadRecordFile } from './application/use-cases/records/UploadRecordFile.js';
import { CreateScheduleEvent } from './application/use-cases/schedule/CreateScheduleEvent.js';
import { DeleteScheduleEvent } from './application/use-cases/schedule/DeleteScheduleEvent.js';
import { ListScheduleEvents } from './application/use-cases/schedule/ListScheduleEvents.js';
import { UpdateScheduleEvent } from './application/use-cases/schedule/UpdateScheduleEvent.js';
import { GetCurrentUnion } from './application/use-cases/organization/GetCurrentUnion.js';
import { ListAssociationSchools } from './application/use-cases/organization/ListAssociationSchools.js';
import { ListLinkedSchools } from './application/use-cases/organization/ListLinkedSchools.js';
import { ListSchoolAssociations } from './application/use-cases/organization/ListSchoolAssociations.js';
import { ListUnionAssociations } from './application/use-cases/organization/ListUnionAssociations.js';
import { ListUnionSchools } from './application/use-cases/organization/ListUnionSchools.js';
import { GetCurrentProfile } from './application/use-cases/profile/GetCurrentProfile.js';
import { ReplaceSchoolLinks } from './application/use-cases/profile/ReplaceSchoolLinks.js';
import { UpdateCurrentProfile } from './application/use-cases/profile/UpdateCurrentProfile.js';
import { UploadAvatar } from './application/use-cases/profile/UploadAvatar.js';
import { ListAccessibleSchools } from './application/use-cases/schools/ListAccessibleSchools.js';
import { UserDatabaseSession } from './infra/database/UserDatabaseSession.js';
import { createPrismaClient } from './infra/database/prismaClient.js';
import { PrismaAccessibleSchoolRepository } from './infra/repositories/PrismaAccessibleSchoolRepository.js';
import { PrismaAccountRepository } from './infra/repositories/PrismaAccountRepository.js';
import { PrismaCatalogRepository } from './infra/repositories/PrismaCatalogRepository.js';
import { PrismaOrganizationRepository } from './infra/repositories/PrismaOrganizationRepository.js';
import { PrismaProfileRepository } from './infra/repositories/PrismaProfileRepository.js';
import { PrismaGoalRepository } from './infra/repositories/PrismaGoalRepository.js';
import { PrismaRecordRepository } from './infra/repositories/PrismaRecordRepository.js';
import { PrismaScheduleEventRepository } from './infra/repositories/PrismaScheduleEventRepository.js';
import { PrismaTopicRepository } from './infra/repositories/PrismaTopicRepository.js';
import { PrismaUserRepository } from './infra/repositories/PrismaUserRepository.js';
import { SupabaseAuthAdmin } from './infra/security/SupabaseAuthAdmin.js';
import { SupabaseAuthGateway } from './infra/security/SupabaseAuthGateway.js';
import { SupabaseAvatarStorage } from './infra/storage/SupabaseAvatarStorage.js';
import { SupabaseRecordImageStorage } from './infra/storage/SupabaseRecordImageStorage.js';
import { AccountController } from './presentation/http/controllers/AccountController.js';
import { AuthController } from './presentation/http/controllers/AuthController.js';
import { CatalogController } from './presentation/http/controllers/CatalogController.js';
import { GoalController } from './presentation/http/controllers/GoalController.js';
import { OrganizationController } from './presentation/http/controllers/OrganizationController.js';
import { RecordController } from './presentation/http/controllers/RecordController.js';
import { RecordFileController } from './presentation/http/controllers/RecordFileController.js';
import { ScheduleEventController } from './presentation/http/controllers/ScheduleEventController.js';
import { SchoolController } from './presentation/http/controllers/SchoolController.js';
import { TopicController } from './presentation/http/controllers/TopicController.js';
import { UserController } from './presentation/http/controllers/UserController.js';
import { errorHandler, notFoundHandler } from './presentation/http/middlewares/errorHandler.js';
import { createRouter } from './presentation/http/routes/index.js';

export function createApp(env) {
  const prisma = createPrismaClient(env.databaseUrl);
  const userRepository = new PrismaUserRepository(prisma);
  const authGateway = new SupabaseAuthGateway({
    url: env.supabaseUrl,
    anonKey: env.supabaseAnonKey,
  });

  const session = new UserDatabaseSession(prisma);
  const profileRepository = new PrismaProfileRepository(prisma);
  const organizationRepository = new PrismaOrganizationRepository(session);
  const catalogRepository = new PrismaCatalogRepository(prisma);
  const reauthenticateUser = new ReauthenticateUser({ userRepository, authGateway });
  const avatarStorage = new SupabaseAvatarStorage({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });
  const recordImageStorage = new SupabaseRecordImageStorage({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });
  const authController = new AuthController({
    registerUser: new RegisterUser({ userRepository, authGateway }),
    authenticateUser: new AuthenticateUser({ userRepository, authGateway }),
    getAuthenticatedUser: new GetAuthenticatedUser({ userRepository }),
    reauthenticateUser,
    requestPasswordReset: new RequestPasswordReset({ authGateway }),
    verifyRecoveryCode: new VerifyRecoveryCode({ authGateway }),
    updatePassword: new UpdatePassword({ authGateway }),
  });
  const schoolController = new SchoolController({
    listAccessibleSchools: new ListAccessibleSchools({
      accessibleSchoolRepository: new PrismaAccessibleSchoolRepository(session),
    }),
  });
  const userController = new UserController({
    getCurrentProfile: new GetCurrentProfile({ profileRepository }),
    updateCurrentProfile: new UpdateCurrentProfile({ profileRepository, authGateway }),
    replaceSchoolLinks: new ReplaceSchoolLinks({ profileRepository }),
    uploadAvatar: new UploadAvatar({
      profileRepository,
      avatarStorage,
    }),
  });
  const accountController = new AccountController({
    deleteAccount: new DeleteAccount({
      reauthenticateUser,
      accountErasure: new AccountErasure({
        accountRepository: new PrismaAccountRepository(session),
        externalRemoval: new ExternalAccountRemoval({
          ownedFileRemoval: new OwnedFileRemoval({ avatarStorage, recordImageStorage }),
          authAdmin: new SupabaseAuthAdmin({
            url: env.supabaseUrl,
            serviceRoleKey: env.supabaseServiceRoleKey,
          }),
        }),
      }),
    }),
  });
  const organizationController = new OrganizationController({
    listLinkedSchools: new ListLinkedSchools({ organizationRepository }),
    listAssociationSchools: new ListAssociationSchools({ organizationRepository }),
    listUnionSchools: new ListUnionSchools({ organizationRepository }),
    listUnionAssociations: new ListUnionAssociations({ organizationRepository }),
    getCurrentUnion: new GetCurrentUnion({ organizationRepository }),
    listSchoolAssociations: new ListSchoolAssociations({ organizationRepository }),
  });
  const catalogController = new CatalogController({
    listPublicSchools: new ListPublicSchools({ catalogRepository }),
    listPublicUnions: new ListPublicUnions({ catalogRepository }),
  });
  const recordRepository = new PrismaRecordRepository(session);
  const topicController = new TopicController({
    listTopics: new ListTopics({ topicRepository: new PrismaTopicRepository(prisma) }),
  });
  const recordController = new RecordController({
    listRecords: new ListRecords({ recordRepository }),
    createRecord: new CreateRecord({ recordRepository, userRepository }),
    updateRecord: new UpdateRecord({ recordRepository }),
    deleteRecord: new DeleteRecord({ recordRepository, recordImageStorage }),
  });
  const goalRepository = new PrismaGoalRepository(session);
  const goalController = new GoalController({
    listGoals: new ListGoals({ goalRepository }),
    upsertGoal: new UpsertGoal({ goalRepository }),
    readGoalProgress: new ReadGoalProgress({ goalRepository }),
  });
  const scheduleEventRepository = new PrismaScheduleEventRepository(session);
  const scheduleEventController = new ScheduleEventController({
    listScheduleEvents: new ListScheduleEvents({ scheduleEventRepository }),
    createScheduleEvent: new CreateScheduleEvent({ scheduleEventRepository }),
    updateScheduleEvent: new UpdateScheduleEvent({ scheduleEventRepository }),
    deleteScheduleEvent: new DeleteScheduleEvent({ scheduleEventRepository }),
  });
  const recordFileController = new RecordFileController({
    listRecordFiles: new ListRecordFiles({ recordRepository }),
    uploadRecordFile: new UploadRecordFile({ recordRepository, recordImageStorage }),
    updateRecordFile: new UpdateRecordFile({ recordRepository }),
    deleteRecordFile: new DeleteRecordFile({ recordRepository, recordImageStorage }),
    deleteRecordFiles: new DeleteRecordFiles({ recordRepository, recordImageStorage }),
  });

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use('/api', createRouter({
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
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, prisma };
}
