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

  async assignUnion(userId, unionId) {
    try {
      await this.prisma.$transaction((tx) => this.#saveUnionScope(tx, userId, unionId));
    } catch (error) {
      throw this.#scopeError(error, 'União inválida');
    }
  }

  async linkSchools(userId, schoolIds) {
    for (const schoolId of schoolIds) {
      await this.#linkSchool(userId, schoolId);
    }
  }

  async #linkSchool(userId, schoolId) {
    try {
      await this.prisma.schoolUser.create({ data: this.#schoolLink(userId, schoolId) });
    } catch (error) {
      this.#keepExistingLink(error);
    }
  }

  #keepExistingLink(error) {
    if (this.#isDuplicate(error)) return;
    throw this.#scopeError(error, 'Escola inválida');
  }

  async #saveUnionScope(tx, userId, unionId) {
    await tx.user.update({
      where: { id: userId },
      data: { unionId: BigInt(unionId) },
    });
    await tx.schoolUser.deleteMany({ where: { userId } });
  }

  #schoolLink(userId, schoolId) {
    return {
      userId,
      schoolId: BigInt(schoolId),
    };
  }

  #scopeError(error, message) {
    if (this.#isForeignKey(error)) throw new AppError(message, 400);
    console.error(error);
    throw new AppError('Falha ao criar usuário', 500);
  }

  #isForeignKey(error) {
    return error instanceof PrismaClientKnownRequestError && error.code === 'P2003';
  }

  #isDuplicate(error) {
    return error instanceof PrismaClientKnownRequestError && error.code === 'P2002';
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
