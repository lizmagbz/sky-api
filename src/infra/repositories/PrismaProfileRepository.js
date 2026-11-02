import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { UserProfile } from '../../domain/entities/UserProfile.js';
import { AppError } from '../../domain/errors/AppError.js';
import { ProfileRepository } from '../../domain/repositories/ProfileRepository.js';

export class PrismaProfileRepository extends ProfileRepository {
  constructor(prisma) {
    super();
    this.prisma = prisma;
  }

  async findByUserId(userId) {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: this.#profileInclude(),
    });
    if (!row) return null;
    return new UserProfile(this.#toProfile(row));
  }

  #profileInclude() {
    return {
      union: { select: { id: true, name: true } },
      schoolUsers: {
        orderBy: { id: 'asc' },
        include: {
          school: {
            include: {
              association: {
                include: {
                  union: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    };
  }

  async save(userId, change) {
    try {
      await this.prisma.$transaction((tx) => this.#write(tx, userId, change));
    } catch (error) {
      throw this.#saveError(error);
    }
  }

  async #write(tx, userId, change) {
    const data = this.#data(change);
    if (Object.keys(data).length > 0) {
      await tx.user.update({ where: { id: userId }, data });
    }
    if (!change.removeSchoolLinks) return;
    await tx.schoolUser.deleteMany({ where: { userId } });
  }

  #data(change) {
    const data = {};
    if (change.name != null) data.name = change.name;
    if (change.role != null) data.role = change.role;
    if (change.avatarFocusX != null) data.avatarFocusX = change.avatarFocusX;
    if (change.avatarFocusY != null) data.avatarFocusY = change.avatarFocusY;
    if (change.avatarFocusScale != null) data.avatarFocusScale = change.avatarFocusScale;
    if (change.unionId != null) data.unionId = BigInt(change.unionId);
    if (change.clearUnion) data.unionId = null;
    return data;
  }

  async replaceSchoolLinks(userId, { deleteLinkIds, schoolIds }) {
    try {
      await this.prisma.$transaction((tx) => this.#replace(tx, userId, deleteLinkIds, schoolIds));
    } catch (error) {
      throw this.#linkError(error);
    }
  }

  async #replace(tx, userId, deleteLinkIds, schoolIds) {
    await this.#deleteLinks(tx, userId, deleteLinkIds);
    await this.#insertLinks(tx, userId, schoolIds);
  }

  async #deleteLinks(tx, userId, deleteLinkIds) {
    if (deleteLinkIds.length === 0) return;
    await tx.schoolUser.deleteMany({
      where: {
        userId,
        id: { in: deleteLinkIds.map((id) => BigInt(id)) },
      },
    });
  }

  async #insertLinks(tx, userId, schoolIds) {
    if (schoolIds.length === 0) return;
    await tx.schoolUser.createMany({
      data: schoolIds.map((schoolId) => this.#link(userId, schoolId)),
      skipDuplicates: true,
    });
  }

  #link(userId, schoolId) {
    return {
      userId,
      schoolId: BigInt(schoolId),
    };
  }

  async saveAvatarUrl(userId, avatarUrl) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl },
      });
    } catch (error) {
      throw this.#saveError(error);
    }
  }

  #toProfile(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      avatar_url: row.avatarUrl,
      avatar_focus_x: row.avatarFocusX,
      avatar_focus_y: row.avatarFocusY,
      avatar_focus_scale: row.avatarFocusScale,
      union_id: this.#numberOrNull(row.unionId),
      unions: this.#named(row.union),
      school_user: row.schoolUsers.map((link) => this.#schoolLink(link)).filter(Boolean),
    };
  }

  #schoolLink(link) {
    if (!link.school) return null;
    return {
      id: Number(link.id),
      school: {
        id: Number(link.school.id),
        name: link.school.name,
        association: this.#association(link.school.association),
      },
    };
  }

  #association(association) {
    if (!association) return null;
    return {
      id: Number(association.id),
      name: association.name,
      unions: this.#named(association.union),
    };
  }

  #named(row) {
    if (!row) return null;
    return {
      id: Number(row.id),
      name: row.name,
    };
  }

  #numberOrNull(value) {
    if (value == null) return null;
    return Number(value);
  }

  #saveError(error) {
    if (this.#isForeignKey(error)) throw new AppError('União inválida', 400);
    if (this.#isNotFound(error)) throw new AppError('Usuário não encontrado', 404);
    console.error(error);
    throw new AppError('Falha ao atualizar perfil', 500);
  }

  #linkError(error) {
    if (this.#isForeignKey(error)) throw new AppError('Escola inválida', 400);
    console.error(error);
    throw new AppError('Falha ao atualizar vínculos', 500);
  }

  #isForeignKey(error) {
    return error instanceof PrismaClientKnownRequestError && error.code === 'P2003';
  }

  #isNotFound(error) {
    return error instanceof PrismaClientKnownRequestError && error.code === 'P2025';
  }
}
