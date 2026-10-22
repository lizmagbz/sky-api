import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { AuthenticateUser } from './application/use-cases/auth/AuthenticateUser.js';
import { GetAuthenticatedUser } from './application/use-cases/auth/GetAuthenticatedUser.js';
import { ReauthenticateUser } from './application/use-cases/auth/ReauthenticateUser.js';
import { RegisterUser } from './application/use-cases/auth/RegisterUser.js';
import { RequestPasswordReset } from './application/use-cases/auth/RequestPasswordReset.js';
import { UpdatePassword } from './application/use-cases/auth/UpdatePassword.js';
import { VerifyRecoveryCode } from './application/use-cases/auth/VerifyRecoveryCode.js';
import { ListPublicSchools } from './application/use-cases/catalog/ListPublicSchools.js';
import { ListPublicUnions } from './application/use-cases/catalog/ListPublicUnions.js';
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
import { PrismaCatalogRepository } from './infra/repositories/PrismaCatalogRepository.js';
import { PrismaOrganizationRepository } from './infra/repositories/PrismaOrganizationRepository.js';
import { PrismaProfileRepository } from './infra/repositories/PrismaProfileRepository.js';
import { PrismaUserRepository } from './infra/repositories/PrismaUserRepository.js';
import { SupabaseAuthGateway } from './infra/security/SupabaseAuthGateway.js';
import { SupabaseAvatarStorage } from './infra/storage/SupabaseAvatarStorage.js';
import { AuthController } from './presentation/http/controllers/AuthController.js';
import { CatalogController } from './presentation/http/controllers/CatalogController.js';
import { OrganizationController } from './presentation/http/controllers/OrganizationController.js';
import { SchoolController } from './presentation/http/controllers/SchoolController.js';
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
  const authController = new AuthController({
    registerUser: new RegisterUser({ userRepository, authGateway }),
    authenticateUser: new AuthenticateUser({ userRepository, authGateway }),
    getAuthenticatedUser: new GetAuthenticatedUser({ userRepository }),
    reauthenticateUser: new ReauthenticateUser({ userRepository, authGateway }),
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
      avatarStorage: new SupabaseAvatarStorage({
        url: env.supabaseUrl,
        serviceRoleKey: env.supabaseServiceRoleKey,
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

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use('/api', createRouter({
    authController,
    schoolController,
    userController,
    organizationController,
    catalogController,
    authGateway,
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, prisma };
}
