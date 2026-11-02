import { AppError } from '../../domain/errors/AppError.js';
import { School } from '../../domain/entities/School.js';
import { AccessibleSchoolRepository } from '../../domain/repositories/AccessibleSchoolRepository.js';

export class PrismaAccessibleSchoolRepository extends AccessibleSchoolRepository {
  constructor(session) {
    super();
    this.session = session;
  }

  async listFor(userId) {
    try {
      const rows = await this.session.asUser(userId, (tx) => this.#selectSchools(tx));
      return rows.map((row) => this.#toSchool(row));
    } catch {
      throw new AppError('Falha ao consultar escolas', 500);
    }
  }

  #selectSchools(tx) {
    return tx.$queryRaw`
      SELECT s.id::text AS id, s.name
      FROM public.school s
      WHERE public.can_access_school(s.id)
        OR (
          public.current_app_role() = 'coordenador_uniao'
          AND public.school_belongs_to_user_union(s.id)
        )
      ORDER BY s.name
    `;
  }

  #toSchool(row) {
    return new School({
      id: Number(row.id),
      name: row.name,
    });
  }
}
