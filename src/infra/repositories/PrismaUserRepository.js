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
    const row = await this.#findFirst({ email, deletedAt: null });
    return this.#toEntity(row);
  }

  async findById(id) {
    const row = await this.#findFirst({ id, deletedAt: null });
    return this.#toEntity(row);
  }

  async #findFirst(where) {
    try {
      return await this.prisma.user.findFirst({ where });
    } catch (error) {
      return this.#recoverFind(error);
    }
  }

  #recoverFind(error) {
    if (this.#isInvalidIdentifier(error)) return null;
    throw new AppError('Falha ao consultar usuário', 500);
  }

  #isInvalidIdentifier(error) {
    return error instanceof PrismaClientKnownRequestError && error.code === 'P2023';
  }

  #toEntity(row) {
    if (!row) return null;

    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.createdAt,
    });
  }
}
