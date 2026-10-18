import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { User } from '../../domain/entities/User.js';
import { AppError } from '../../domain/errors/AppError.js';
import { UserRepository } from '../../domain/repositories/UserRepository.js';

export class PrismaUserRepository extends UserRepository {
  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async findByEmail(email) {
    const row = await this.#findUnique({ email });
    return this.#toEntity(row);
  }

  async findById(id) {
    const row = await this.#findUnique({ id });
    return this.#toEntity(row);
  }

  async create({ name, email, passwordHash }) {
    try {
      const row = await this.prisma.user.create({
        data: { name, email, passwordHash },
      });
      return this.#toEntity(row);
    } catch (error) {
      throw this.#toCreateError(error);
    }
  }

  async #findUnique(where) {
    try {
      return await this.prisma.user.findUnique({ where });
    } catch (error) {
      return this.#recoverFind(error);
    }
  }

  #recoverFind(error) {
    if (this.#isInvalidIdentifier(error)) return null;
    throw new AppError('Falha ao consultar usuário', 500);
  }

  #toCreateError(error) {
    if (this.#isUniqueEmail(error)) {
      return new AppError('E-mail já cadastrado', 409);
    }

    return new AppError('Falha ao criar usuário', 500);
  }

  #isInvalidIdentifier(error) {
    return error instanceof PrismaClientKnownRequestError && error.code === 'P2023';
  }

  #isUniqueEmail(error) {
    return error instanceof PrismaClientKnownRequestError && error.code === 'P2002';
  }

  #toEntity(row) {
    if (!row) return null;

    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.passwordHash,
      createdAt: row.createdAt,
    });
  }
}
