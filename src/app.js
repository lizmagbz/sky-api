import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { AuthenticateUser } from './application/use-cases/auth/AuthenticateUser.js';
import { GetAuthenticatedUser } from './application/use-cases/auth/GetAuthenticatedUser.js';
import { RegisterUser } from './application/use-cases/auth/RegisterUser.js';
import { createPrismaClient } from './infra/database/prismaClient.js';
import { PrismaUserRepository } from './infra/repositories/PrismaUserRepository.js';
import { BcryptPasswordHasher } from './infra/security/BcryptPasswordHasher.js';
import { JwtTokenProvider } from './infra/security/JwtTokenProvider.js';
import { AuthController } from './presentation/http/controllers/AuthController.js';
import { errorHandler, notFoundHandler } from './presentation/http/middlewares/errorHandler.js';
import { createRouter } from './presentation/http/routes/index.js';

export function createApp(env) {
  const prisma = createPrismaClient(env.databaseUrl);
  const userRepository = new PrismaUserRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher();
  const tokenProvider = new JwtTokenProvider({
    secret: env.jwtSecret,
    expiresIn: env.jwtExpiresIn,
  });

  const authController = new AuthController({
    registerUser: new RegisterUser({ userRepository, passwordHasher }),
    authenticateUser: new AuthenticateUser({ userRepository, passwordHasher, tokenProvider }),
    getAuthenticatedUser: new GetAuthenticatedUser({ userRepository }),
  });

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use('/api', createRouter({ authController, tokenProvider }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, prisma };
}
