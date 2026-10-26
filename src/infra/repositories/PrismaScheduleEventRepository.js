import { Prisma } from '../../../generated/prisma/client.ts';
import { AppError } from '../../domain/errors/AppError.js';
import { ScheduleEventRepository } from '../../domain/repositories/ScheduleEventRepository.js';
import { assertSchedulePeriod } from '../../domain/schedule/assertSchedulePeriod.js';
import {
  associationAudience,
  privateAudience,
  unionAudience,
} from '../../domain/schedule/scheduleAudiences.js';
import { toScheduleEvent } from './scheduleEventRow.js';

const audienceDenied = 'Audiência do evento incompatível com o papel ou o escopo do autor';
const missingAssociation = 'Não foi possível resolver a associação do coordenador';
const missingUnion = 'Não foi possível resolver a união do coordenador';

export class PrismaScheduleEventRepository extends ScheduleEventRepository {
  constructor(session) {
    super();
    this.session = session;
  }

  async list(userId, googleEventId) {
    const rows = await this.#run(
      userId,
      (tx) => this.#select(tx, this.#googleFilter(googleEventId)),
      'Falha ao consultar a agenda',
    );
    return rows.map((row) => toScheduleEvent(row));
  }

  async create(userId, input) {
    return this.#run(userId, (tx) => this.#insert(tx, input), 'Falha ao gravar o evento');
  }

  async update(userId, eventId, input) {
    return this.#run(userId, (tx) => this.#update(tx, userId, eventId, input), 'Falha ao gravar o evento');
  }

  async remove(userId, eventId) {
    await this.#run(userId, (tx) => this.#remove(tx, userId, eventId), 'Falha ao apagar o evento');
  }

  async #insert(tx, input) {
    const scope = await this.#scope(tx, {
      audience: input.audience,
      associationId: input.associationId ?? null,
      unionId: input.unionId ?? null,
    });
    await this.#assertAudience(tx, scope);
    const rows = await tx.$queryRaw`
      INSERT INTO public.schedule_events (
        user_id, title, description, start_at, end_at,
        google_event_id, google_calendar_id, is_all_day,
        audience, association_id, union_id
      ) VALUES (
        auth.uid(),
        ${input.title},
        ${this.#blankToNull(input.description)},
        ${input.startAt}::timestamptz,
        ${input.endAt}::timestamptz,
        ${this.#blankToNull(input.googleEventId)},
        ${this.#blankToNull(input.googleCalendarId)},
        ${input.isAllDay},
        ${scope.audience},
        ${scope.associationId}::bigint,
        ${scope.unionId}::bigint
      )
      RETURNING id::text AS id
    `;
    return this.#one(tx, rows[0].id);
  }

  async #update(tx, userId, eventId, input) {
    const current = await this.#requireAuthor(tx, userId, eventId, 'change');
    assertSchedulePeriod(input.startAt ?? current.startAt, input.endAt ?? current.endAt);
    const scope = await this.#scopeIfNeeded(tx, current, input);
    if (scope) await this.#assertAudience(tx, scope);
    const rows = await tx.$queryRaw`
      UPDATE public.schedule_events
      SET ${this.#assignments(input, scope)}
      WHERE id = ${eventId}::uuid
        AND user_id = auth.uid()
      RETURNING id::text AS id
    `;
    if (rows[0]) return this.#one(tx, rows[0].id);
    throw new AppError('Evento não encontrado', 404);
  }

  async #remove(tx, userId, eventId) {
    await this.#requireAuthor(tx, userId, eventId, 'delete');
    const deleted = await tx.$executeRaw`
      DELETE FROM public.schedule_events
      WHERE id = ${eventId}::uuid
        AND user_id = auth.uid()
    `;
    if (Number(deleted) > 0) return;
    throw new AppError('Evento não encontrado', 404);
  }

  #select(tx, extra) {
    return tx.$queryRaw`
      SELECT
        e.id::text AS id,
        e.user_id::text AS user_id,
        e.title,
        e.description,
        to_char(e.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS start_at,
        to_char(e.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS end_at,
        to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
        e.google_event_id,
        e.google_calendar_id,
        to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at,
        e.is_all_day,
        e.audience,
        e.association_id::text AS association_id,
        e.union_id::text AS union_id
      FROM public.schedule_events e
      WHERE public.schedule_event_is_visible(e.user_id, e.audience, e.association_id, e.union_id)
        AND ${extra}
      ORDER BY e.start_at ASC, e.id ASC
    `;
  }

  async #one(tx, eventId) {
    const rows = await this.#select(tx, Prisma.sql`e.id = ${eventId}::uuid`);
    if (rows[0]) return toScheduleEvent(rows[0]);
    throw new AppError('Evento não encontrado', 404);
  }

  #googleFilter(googleEventId) {
    if (!googleEventId) return Prisma.sql`TRUE`;
    return Prisma.sql`e.user_id = auth.uid() AND e.google_event_id = ${googleEventId}`;
  }

  async #requireAuthor(tx, userId, eventId, action) {
    const location = await this.#locate(tx, eventId);
    if (!location || !location.visible) throw new AppError('Evento não encontrado', 404);
    if (location.userId === userId) return location;
    throw new AppError(this.#authorMessage(action), 403);
  }

  async #locate(tx, eventId) {
    const rows = await tx.$queryRaw`
      SELECT
        e.user_id::text AS user_id,
        e.audience,
        e.association_id::text AS association_id,
        e.union_id::text AS union_id,
        to_char(e.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS start_at,
        to_char(e.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS end_at,
        public.schedule_event_is_visible(e.user_id, e.audience, e.association_id, e.union_id) AS visible
      FROM public.schedule_events e
      WHERE e.id = ${eventId}::uuid
    `;
    if (!rows[0]) return null;
    return this.#location(rows[0]);
  }

  #location(row) {
    return {
      userId: row.user_id,
      audience: row.audience,
      associationId: this.#numberOrNull(row.association_id),
      unionId: this.#numberOrNull(row.union_id),
      startAt: row.start_at,
      endAt: row.end_at,
      visible: row.visible === true,
    };
  }

  async #scopeIfNeeded(tx, current, input) {
    if (!this.#changesAudience(input)) return null;
    return this.#scope(tx, {
      audience: input.audience ?? current.audience,
      associationId: this.#keptId(input.associationId, current.associationId),
      unionId: this.#keptId(input.unionId, current.unionId),
    });
  }

  #changesAudience(input) {
    if (input.audience !== undefined) return true;
    if (input.associationId !== undefined) return true;
    return input.unionId !== undefined;
  }

  #keptId(next, current) {
    if (next === undefined) return current;
    return next;
  }

  async #scope(tx, input) {
    if (input.audience === privateAudience) return this.#privateScope();
    if (input.audience === associationAudience) return this.#associationScope(tx, input.associationId);
    if (input.audience === unionAudience) return this.#unionScope(tx, input.unionId);
    throw new AppError('Público do evento inválido', 400);
  }

  #privateScope() {
    return { audience: privateAudience, associationId: null, unionId: null };
  }

  async #associationScope(tx, associationId) {
    const resolved = associationId ?? await this.#authorAssociationId(tx);
    if (resolved == null) throw new AppError(missingAssociation, 403);
    return { audience: associationAudience, associationId: resolved, unionId: null };
  }

  async #unionScope(tx, unionId) {
    const resolved = unionId ?? await this.#authorUnionId(tx);
    if (resolved == null) throw new AppError(missingUnion, 403);
    return { audience: unionAudience, associationId: null, unionId: resolved };
  }

  async #authorAssociationId(tx) {
    const rows = await tx.$queryRaw`
      SELECT user_school.association_id::text AS association_id
      FROM public.school_user su
      JOIN public.school user_school ON user_school.id = su.school_id
      WHERE su.user_id = auth.uid()
        AND user_school.association_id IS NOT NULL
      ORDER BY su.id
      LIMIT 1
    `;
    return this.#numberOrNull(rows[0]?.association_id);
  }

  async #authorUnionId(tx) {
    const rows = await tx.$queryRaw`
      SELECT public.user_union_id()::text AS union_id
    `;
    return this.#numberOrNull(rows[0]?.union_id);
  }

  async #assertAudience(tx, scope) {
    const rows = await tx.$queryRaw`
      SELECT public.schedule_event_audience_allowed(
        auth.uid(),
        ${scope.audience},
        ${scope.associationId}::bigint,
        ${scope.unionId}::bigint
      ) AS allowed
    `;
    if (rows[0]?.allowed === true) return;
    throw new AppError(audienceDenied, 403);
  }

  #assignments(input, scope) {
    const sets = [Prisma.sql`updated_at = now()`];
    if (input.title !== undefined) sets.push(Prisma.sql`title = ${input.title}`);
    if (input.description !== undefined) sets.push(Prisma.sql`description = ${this.#blankToNull(input.description)}`);
    if (input.startAt !== undefined) sets.push(Prisma.sql`start_at = ${input.startAt}::timestamptz`);
    if (input.endAt !== undefined) sets.push(Prisma.sql`end_at = ${input.endAt}::timestamptz`);
    if (input.googleEventId !== undefined) sets.push(Prisma.sql`google_event_id = ${this.#blankToNull(input.googleEventId)}`);
    if (input.googleCalendarId !== undefined) sets.push(Prisma.sql`google_calendar_id = ${this.#blankToNull(input.googleCalendarId)}`);
    if (input.isAllDay !== undefined) sets.push(Prisma.sql`is_all_day = ${input.isAllDay}`);
    this.#assignScope(sets, scope);
    return Prisma.join(sets, ', ');
  }

  #assignScope(sets, scope) {
    if (!scope) return;
    sets.push(Prisma.sql`audience = ${scope.audience}`);
    sets.push(Prisma.sql`association_id = ${scope.associationId}::bigint`);
    sets.push(Prisma.sql`union_id = ${scope.unionId}::bigint`);
  }

  #blankToNull(value) {
    if (value == null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed;
  }

  #numberOrNull(value) {
    if (value == null) return null;
    return Number(value);
  }

  #authorMessage(action) {
    if (action === 'delete') return 'Só o autor pode apagar este evento';
    return 'Só o autor pode alterar este evento';
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
    if (code === '42501') throw new AppError(audienceDenied, 403);
    if (code === '23505') throw new AppError('Este evento do Google já está na agenda', 409);
    if (code === '23503') throw new AppError('Associação ou união inválida', 400);
    if (code === '23514') throw new AppError(this.#checkMessage(this.#message(error)), 400);
    if (code === '22P02') throw new AppError('Evento inválido', 400);
    console.error(error);
    throw new AppError(fallback, 500);
  }

  #checkMessage(message) {
    if (message.includes('end_at') || message.includes('end_after_start') || message.includes('period')) {
      return 'O horário final precisa ser depois do início';
    }
    if (message.includes('audience') || message.includes('Audiência')) return audienceDenied;
    return 'Dados do evento inválidos';
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
