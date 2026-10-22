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
import { ListAccessibleSchools } from './application/use-cases/schools/ListAccessibleSchools.js';
import { UserDatabaseSession } from './infra/database/UserDatabaseSession.js';
import { createPrismaClient } from './infra/database/prismaClient.js';
import { PrismaAccessibleSchoolRepository } from './infra/repositories/PrismaAccessibleSchoolRepository.js';
import { PrismaUserRepository } from './infra/repositories/PrismaUserRepository.js';
import { SupabaseAuthGateway } from './infra/security/SupabaseAuthGateway.js';
import { AuthController } from './presentation/http/controllers/AuthController.js';
import { SchoolController } from './presentation/http/controllers/SchoolController.js';
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

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use('/api', createRouter({ authController, schoolController, authGateway }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, prisma };
}
