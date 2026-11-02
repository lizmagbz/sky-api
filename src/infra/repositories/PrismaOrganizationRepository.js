import { CatalogItem } from '../../domain/entities/CatalogItem.js';
import { SchoolAssociationLink } from '../../domain/entities/SchoolAssociationLink.js';
import { UnionSchool } from '../../domain/entities/UnionSchool.js';
import { AppError } from '../../domain/errors/AppError.js';
import { OrganizationRepository } from '../../domain/repositories/OrganizationRepository.js';

export class PrismaOrganizationRepository extends OrganizationRepository {
  constructor(session) {
    super();
    this.session = session;
  }

  async listLinkedSchools(userId) {
    const rows = await this.#read(userId, (tx) => tx.$queryRaw`
      SELECT s.id::text AS id, s.name
      FROM public.school_user su
      JOIN public.school s ON s.id = su.school_id
      WHERE su.user_id = auth.uid()
      ORDER BY s.name
    `);
    return rows.map((row) => new CatalogItem({ id: Number(row.id), name: row.name }));
  }

  async listAssociationSchools(userId) {
    const rows = await this.#read(userId, (tx) => tx.$queryRaw`
      SELECT s.id::text AS id, s.name
      FROM public.school s
      WHERE s.association_id = (
        SELECT user_school.association_id
        FROM public.school_user su
        JOIN public.school user_school ON user_school.id = su.school_id
        WHERE su.user_id = auth.uid()
          AND user_school.association_id IS NOT NULL
        ORDER BY su.id
        LIMIT 1
      )
      AND public.can_access_school(s.id)
      ORDER BY s.name
    `);
    return rows.map((row) => new CatalogItem({ id: Number(row.id), name: row.name }));
  }

  async listUnionSchools(userId) {
    const rows = await this.#read(userId, (tx) => tx.$queryRaw`
      SELECT s.id::text AS id, s.name, s.association_id::text AS association_id
      FROM public.school s
      WHERE public.current_app_role() = 'coordenador_uniao'
        AND public.school_belongs_to_user_union(s.id)
      ORDER BY s.name
    `);
    return rows.map((row) => this.#unionSchool(row));
  }

  async listUnionAssociations(userId) {
    const rows = await this.#read(userId, (tx) => tx.$queryRaw`
      SELECT a.id::text AS id, a.name
      FROM public.association a
      WHERE public.current_app_role() = 'coordenador_uniao'
        AND a.union_id = public.user_union_id()
      ORDER BY a.name
    `);
    return rows.map((row) => new CatalogItem({ id: Number(row.id), name: row.name }));
  }

  async findCurrentUnion(userId) {
    const rows = await this.#read(userId, (tx) => tx.$queryRaw`
      SELECT u.id::text AS id, u.name
      FROM public.unions u
      WHERE u.id = COALESCE(
        public.user_union_id(),
        (
          SELECT a.union_id
          FROM public.school_user su
          JOIN public.school s ON s.id = su.school_id
          JOIN public.association a ON a.id = s.association_id
          WHERE su.user_id = auth.uid()
            AND a.union_id IS NOT NULL
          ORDER BY su.id
          LIMIT 1
        )
      )
    `);
    if (rows.length === 0) return null;
    return new CatalogItem({ id: Number(rows[0].id), name: rows[0].name });
  }

  async listSchoolAssociations(userId) {
    const rows = await this.#read(userId, (tx) => tx.$queryRaw`
      SELECT s.id::text AS id, s.association_id::text AS association_id
      FROM public.school s
      WHERE public.can_access_school(s.id)
        OR (
          public.current_app_role() = 'coordenador_uniao'
          AND public.school_belongs_to_user_union(s.id)
        )
      ORDER BY s.name
    `);
    return rows.map((row) => this.#schoolAssociation(row));
  }

  #unionSchool(row) {
    return new UnionSchool({
      id: Number(row.id),
      name: row.name,
      associationId: this.#numberOrNull(row.association_id),
    });
  }

  #schoolAssociation(row) {
    return new SchoolAssociationLink({
      id: Number(row.id),
      associationId: this.#numberOrNull(row.association_id),
    });
  }

  #numberOrNull(value) {
    if (value == null) return null;
    return Number(value);
  }

  async #read(userId, query) {
    try {
      return await this.session.asUser(userId, query);
    } catch (error) {
      console.error(error);
      throw new AppError('Falha ao consultar a organização', 500);
    }
  }
}
