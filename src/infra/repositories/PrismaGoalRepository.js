import { AppError } from '../../domain/errors/AppError.js';
import { GoalRepository } from '../../domain/repositories/GoalRepository.js';
import { toGoal, toGoalProgress } from './goalRow.js';

export class PrismaGoalRepository extends GoalRepository {
  constructor(session) {
    super();
    this.session = session;
  }

  async listForYear(userId, year) {
    const rows = await this.#run(userId, (tx) => this.#selectYear(tx, year), 'Falha ao consultar metas');
    return rows.map((row) => toGoal(row));
  }

  async upsert(userId, input) {
    const rows = await this.#run(userId, (tx) => this.#upsert(tx, input), 'Falha ao gravar a meta');
    return toGoal(rows[0]);
  }

  async progress(userId, topicId, year) {
    const rows = await this.#run(userId, (tx) => this.#progress(tx, topicId, year), 'Falha ao consultar o progresso');
    return toGoalProgress(rows[0], topicId, year);
  }

  #selectYear(tx, year) {
    return tx.$queryRaw`
      SELECT
        g.id::text AS id,
        g.topic_id::text AS topic_id,
        g.target_count,
        g.year,
        t.name AS topic_name,
        to_char(g.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at
      FROM public.user_goals g
      JOIN public.topics t ON t.id = g.topic_id
      WHERE g.user_id = auth.uid()
        AND g.year = ${year}
      ORDER BY t.name ASC, g.id ASC
    `;
  }

  #upsert(tx, input) {
    return tx.$queryRaw`
      WITH saved AS (
        INSERT INTO public.user_goals (user_id, topic_id, target_count, year, updated_at)
        VALUES (
          auth.uid(),
          ${input.topicId}::bigint,
          ${input.targetCount},
          ${input.year},
          now()
        )
        ON CONFLICT ON CONSTRAINT user_goals_user_topic_year_key
        DO UPDATE SET
          target_count = EXCLUDED.target_count,
          updated_at = now()
        RETURNING id, topic_id, target_count, year, updated_at
      )
      SELECT
        saved.id::text AS id,
        saved.topic_id::text AS topic_id,
        saved.target_count,
        saved.year,
        t.name AS topic_name,
        to_char(saved.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at
      FROM saved
      JOIN public.topics t ON t.id = saved.topic_id
    `;
  }

  #progress(tx, topicId, year) {
    return tx.$queryRaw`
      SELECT
        count(*)::text AS record_count,
        COALESCE(sum(people_count), 0)::text AS people_count
      FROM public.records
      WHERE user_id = auth.uid()
        AND topic_id = ${topicId}::bigint
        AND event_date >= make_date(${year}::int, 1, 1)
        AND event_date <= make_date(${year}::int, 12, 31)
    `;
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
    const code = this.#code(error);
    if (code === '23503') throw new AppError('Tópico inválido', 400);
    if (code === '23514') throw new AppError(this.#checkMessage(this.#message(error)), 400);
    console.error(error);
    throw new AppError(fallback, 500);
  }

  #checkMessage(message) {
    if (message.includes('target_count')) return 'A meta precisa ser maior que zero';
    if (message.includes('year')) return 'Informe um ano entre 2000 e 2100';
    return 'Dados da meta inválidos';
  }

  #code(error) {
    const candidates = [
      error?.meta?.code,
      error?.cause?.code,
      error?.meta?.driverAdapterError?.cause?.code,
    ];
    for (const candidate of candidates) {
      if (candidate && String(candidate) !== 'P2010') return String(candidate);
    }
    const match = this.#message(error).match(/Code: `([0-9A-Z]{5})`/);
    if (match) return match[1];
    if (typeof error?.code === 'string' && error.code !== 'P2010') return error.code;
    return '';
  }

  #message(error) {
    return [
      error?.meta?.message,
      error?.cause?.message,
      error?.meta?.driverAdapterError?.cause?.message,
      error?.message,
    ].filter(Boolean).join(' ');
  }
}
