import { AppError } from '../../domain/errors/AppError.js';
import { AccountRepository } from '../../domain/repositories/AccountRepository.js';

export class PrismaAccountRepository extends AccountRepository {
  constructor(session) {
    super();
    this.session = session;
  }

  async listOwned(userId) {
    const rows = await this.#run(userId, (tx) => this.#owned(tx, userId), 'Falha ao consultar a conta');
    return this.#ownedFrom(rows[0]);
  }

  async erase(userId) {
    await this.#run(userId, (tx) => this.#erase(tx, userId), 'Falha ao apagar os dados da conta');
  }

  async remaining(userId) {
    const rows = await this.#run(userId, (tx) => this.#remaining(tx, userId), 'Falha ao consultar a conta');
    return this.#remainingFrom(rows[0]);
  }

  async #owned(tx, userId) {
    await this.#assertSession(tx, userId);
    return tx.$queryRaw`
      SELECT
        COALESCE((
          SELECT json_agg(DISTINCT files.url)
          FROM (
            SELECT f.file_url AS url
            FROM public.record_files f
            JOIN public.records r ON r.id = f.record_id
            WHERE r.user_id = ${userId}::uuid
              AND r.user_id = auth.uid()
              AND f.file_url IS NOT NULL
            UNION
            SELECT r.image_url AS url
            FROM public.records r
            WHERE r.user_id = ${userId}::uuid
              AND r.user_id = auth.uid()
              AND r.image_url IS NOT NULL
          ) files
        ), '[]'::json) AS record_file_urls,
        (
          SELECT u.avatar_url
          FROM public."user" u
          WHERE u.id = ${userId}::uuid
            AND u.id = auth.uid()
        ) AS avatar_url
    `;
  }

  async #erase(tx, userId) {
    await this.#assertSession(tx, userId);
    await tx.$executeRaw`
      DELETE FROM public.record_files f
      USING public.records r
      WHERE f.record_id = r.id
        AND r.user_id = ${userId}::uuid
        AND r.user_id = auth.uid()
    `;
    await tx.$executeRaw`
      DELETE FROM public.records
      WHERE user_id = ${userId}::uuid
        AND user_id = auth.uid()
    `;
    await tx.$executeRaw`
      DELETE FROM public.school_user
      WHERE user_id = ${userId}::uuid
        AND user_id = auth.uid()
    `;
    await tx.$executeRaw`
      DELETE FROM public.user_goals
      WHERE user_id = ${userId}::uuid
        AND user_id = auth.uid()
    `;
    await tx.$executeRaw`
      DELETE FROM public.schedule_events
      WHERE user_id = ${userId}::uuid
        AND user_id = auth.uid()
    `;
  }

  #remaining(tx, userId) {
    return tx.$queryRaw`
      SELECT
        EXISTS(
          SELECT 1 FROM public."user" u
          WHERE u.id = ${userId}::uuid
        ) AS usuario,
        (SELECT count(*)::int FROM public.school_user WHERE user_id = ${userId}::uuid) AS vinculos,
        (SELECT count(*)::int FROM public.user_goals WHERE user_id = ${userId}::uuid) AS metas,
        (SELECT count(*)::int FROM public.schedule_events WHERE user_id = ${userId}::uuid) AS agenda,
        (SELECT count(*)::int FROM public.records WHERE user_id = ${userId}::uuid) AS registros,
        (
          SELECT count(*)::int
          FROM public.record_files f
          JOIN public.records r ON r.id = f.record_id
          WHERE r.user_id = ${userId}::uuid
        ) AS arquivos,
        EXISTS(
          SELECT 1 FROM public."user" u
          WHERE u.id = ${userId}::uuid
            AND u.avatar_url IS NOT NULL
        ) AS avatar,
        (SELECT count(*)::int FROM public.memberships WHERE user_id = ${userId}::uuid) AS memberships,
        EXISTS(
          SELECT 1 FROM public.profiles WHERE id = ${userId}::uuid
        ) AS perfil,
        (
          SELECT count(*)::int
          FROM public.user_google_calendar_connections
          WHERE user_id = ${userId}::uuid
        ) AS conexao_google
    `;
  }

  async #assertSession(tx, userId) {
    const rows = await tx.$queryRaw`SELECT auth.uid() AS uid`;
    if (String(rows[0]?.uid ?? '').toLowerCase() === String(userId).toLowerCase()) return;
    throw new AppError('Não foi possível confirmar a sessão da conta', 500);
  }

  #ownedFrom(row) {
    return {
      recordFileUrls: this.#urls(row?.record_file_urls),
      avatarUrl: row?.avatar_url ?? null,
    };
  }

  #urls(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((url) => typeof url === 'string' && url.length > 0);
  }

  #remainingFrom(row) {
    return {
      usuario: row?.usuario === true,
      vinculos: Number(row?.vinculos ?? 0),
      metas: Number(row?.metas ?? 0),
      agenda: Number(row?.agenda ?? 0),
      registros: Number(row?.registros ?? 0),
      arquivos: Number(row?.arquivos ?? 0),
      avatar: row?.avatar === true,
      memberships: Number(row?.memberships ?? 0),
      perfil: row?.perfil === true,
      conexaoGoogle: Number(row?.conexao_google ?? 0) > 0,
    };
  }

  async #run(userId, query, fallback) {
    try {
      return await this.session.asUser(userId, query);
    } catch (error) {
      throw this.#fail(error, fallback);
    }
  }

  #fail(error, fallback) {
    if (error instanceof AppError) throw error;
    console.error(error);
    throw new AppError(fallback, 500);
  }
}
