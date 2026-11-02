import { Prisma } from '../../../generated/prisma/client.ts';
import { AppError } from '../../domain/errors/AppError.js';
import { RecordRepository } from '../../domain/repositories/RecordRepository.js';
import { toRecord, toRecordFile } from './recordRow.js';

const maxRecordFiles = 5;
const fileLimitMessage = 'Cada atividade pode ter no máximo 5 fotos.';

export class PrismaRecordRepository extends RecordRepository {
  constructor(session) {
    super();
    this.session = session;
  }

  async list(userId) {
    const rows = await this.#run(userId, (tx) => this.#select(tx, Prisma.sql`TRUE`), 'Falha ao consultar registros');
    return rows.map((row) => toRecord(row));
  }

  async create(userId, input) {
    return this.#run(userId, (tx) => this.#insert(tx, userId, input), 'Falha ao gravar o registro');
  }

  async update(userId, recordId, input) {
    return this.#run(userId, (tx) => this.#update(tx, userId, recordId, input), 'Falha ao gravar o registro');
  }

  async remove(userId, recordId) {
    await this.#run(userId, (tx) => this.#remove(tx, userId, recordId), 'Falha ao apagar o registro');
  }

  async listFiles(userId, recordId) {
    const rows = await this.#run(
      userId,
      (tx) => this.#files(tx, userId, recordId, false),
      'Falha ao consultar arquivos',
    );
    return rows.map((row) => toRecordFile(row));
  }

  async assertCanAttachFile(userId, recordId) {
    await this.#run(userId, (tx) => this.#assertRoom(tx, userId, recordId), 'Falha ao consultar arquivos');
  }

  async addFile(userId, recordId, file) {
    return this.#run(userId, (tx) => this.#addFile(tx, userId, recordId, file), 'Falha ao gravar a imagem');
  }

  async updateFile(userId, recordId, fileId, frame) {
    return this.#run(
      userId,
      (tx) => this.#updateFile(tx, userId, recordId, fileId, frame),
      'Falha ao gravar a imagem',
    );
  }

  async filesToRemove(userId, recordId) {
    const rows = await this.#run(
      userId,
      (tx) => this.#files(tx, userId, recordId, true),
      'Falha ao consultar arquivos',
    );
    return rows.map((row) => toRecordFile(row));
  }

  async fileToRemove(userId, recordId, fileId) {
    const files = await this.filesToRemove(userId, recordId);
    return this.#file(files, fileId);
  }

  async deleteFile(userId, recordId, fileId) {
    await this.#run(userId, (tx) => this.#deleteFile(tx, userId, recordId, fileId), 'Falha ao apagar a imagem');
  }

  async deleteFiles(userId, recordId) {
    await this.#run(userId, (tx) => this.#deleteFiles(tx, userId, recordId), 'Falha ao apagar a imagem');
  }

  async #insert(tx, userId, input) {
    await this.#assertScope(tx, input.schoolId, input.unionId);
    const rows = await tx.$queryRaw`
      INSERT INTO public.records (
        title, description, event_date, event_end_date, people_count,
        author_name, user_id, school_id, union_id, topic_id
      ) VALUES (
        ${input.title},
        ${input.description},
        ${input.eventDate}::date,
        ${input.eventEndDate}::date,
        ${input.peopleCount},
        ${input.authorName},
        ${userId}::uuid,
        ${input.schoolId}::bigint,
        ${input.unionId}::bigint,
        ${input.topicId}::bigint
      )
      RETURNING id::text AS id
    `;
    return Number(rows[0].id);
  }

  async #update(tx, userId, recordId, input) {
    await this.#assertAuthor(tx, userId, recordId, 'change');
    await tx.$executeRaw`
      UPDATE public.records
      SET
        title = ${input.title},
        description = ${input.description},
        event_date = ${input.eventDate}::date,
        event_end_date = ${input.eventEndDate}::date,
        people_count = ${input.peopleCount}
      WHERE id = ${recordId}
        AND user_id = ${userId}::uuid
    `;
    return this.#one(tx, recordId);
  }

  async #remove(tx, userId, recordId) {
    await this.#assertAuthor(tx, userId, recordId, 'delete');
    await tx.$executeRaw`DELETE FROM public.record_files WHERE record_id = ${recordId}`;
    const deleted = await tx.$executeRaw`
      DELETE FROM public.records
      WHERE id = ${recordId}
        AND user_id = ${userId}::uuid
    `;
    this.#assertDeleted(deleted);
  }

  async #files(tx, userId, recordId, authorOnly) {
    await this.#guard(tx, userId, recordId, authorOnly);
    return this.#selectFiles(tx, recordId);
  }

  async #guard(tx, userId, recordId, authorOnly) {
    if (authorOnly) return this.#assertAuthor(tx, userId, recordId, 'delete');
    return this.#assertVisible(tx, recordId);
  }

  async #assertRoom(tx, userId, recordId) {
    await this.#assertAuthor(tx, userId, recordId, 'change');
    await this.#assertFileCount(tx, recordId);
  }

  async #addFile(tx, userId, recordId, file) {
    await this.#assertRoom(tx, userId, recordId);
    const rows = await tx.$queryRaw`
      INSERT INTO public.record_files (
        record_id, file_url, file_type, is_cover, focus_x, focus_y, focus_scale
      ) VALUES (
        ${recordId},
        ${file.fileUrl},
        ${file.fileType},
        ${file.isCover},
        ${file.focusX},
        ${file.focusY},
        ${file.focusScale}
      )
      RETURNING
        id::text AS id,
        record_id::text AS record_id,
        file_url,
        file_type,
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS created_at,
        is_cover,
        focus_x,
        focus_y,
        focus_scale
    `;
    return toRecordFile(rows[0]);
  }

  async #updateFile(tx, userId, recordId, fileId, frame) {
    await this.#assertAuthor(tx, userId, recordId, 'change');
    const rows = await tx.$queryRaw`
      UPDATE public.record_files
      SET
        is_cover = ${frame.isCover},
        focus_x = ${frame.focusX},
        focus_y = ${frame.focusY},
        focus_scale = COALESCE(${frame.focusScale}::double precision, focus_scale)
      WHERE id = ${fileId}
        AND record_id = ${recordId}
      RETURNING
        id::text AS id,
        record_id::text AS record_id,
        file_url,
        file_type,
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS created_at,
        is_cover,
        focus_x,
        focus_y,
        focus_scale
    `;
    if (rows[0]) return toRecordFile(rows[0]);
    throw new AppError('Arquivo não encontrado', 404);
  }

  async #deleteFile(tx, userId, recordId, fileId) {
    await this.#assertAuthor(tx, userId, recordId, 'delete');
    const deleted = await tx.$executeRaw`
      DELETE FROM public.record_files
      WHERE id = ${fileId}
        AND record_id = ${recordId}
    `;
    if (Number(deleted) > 0) return;
    throw new AppError('Arquivo não encontrado', 404);
  }

  async #deleteFiles(tx, userId, recordId) {
    await this.#assertAuthor(tx, userId, recordId, 'delete');
    await tx.$executeRaw`DELETE FROM public.record_files WHERE record_id = ${recordId}`;
  }

  async #one(tx, recordId) {
    const rows = await this.#select(tx, Prisma.sql`r.id = ${recordId}`);
    if (rows[0]) return toRecord(rows[0]);
    throw new AppError('Registro não encontrado', 404);
  }

  #select(tx, extra) {
    return tx.$queryRaw`
      SELECT
        r.id::text AS id,
        r.user_id,
        r.topic_id::text AS topic_id,
        r.school_id::text AS school_id,
        r.union_id::text AS union_id,
        r.title,
        r.description,
        to_char(r.event_date, 'YYYY-MM-DD') AS event_date,
        to_char(r.event_end_date, 'YYYY-MM-DD') AS event_end_date,
        r.people_count,
        r.author_name,
        r.image_url,
        to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS created_at,
        to_char(r.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS updated_at,
        CASE
          WHEN s.id IS NULL THEN NULL
          ELSE json_build_object(
            'name', s.name,
            'association', CASE
              WHEN a.id IS NULL THEN NULL
              ELSE json_build_object('name', a.name)
            END
          )
        END AS school,
        CASE
          WHEN u.id IS NULL THEN NULL
          ELSE json_build_object('name', u.name)
        END AS unions,
        CASE
          WHEN t.id IS NULL THEN NULL
          ELSE json_build_object('name', t.name)
        END AS topics,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', f.id,
              'record_id', f.record_id,
              'file_url', f.file_url,
              'file_type', f.file_type,
              'created_at', to_char(f.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS'),
              'is_cover', f.is_cover,
              'focus_x', f.focus_x,
              'focus_y', f.focus_y,
              'focus_scale', f.focus_scale
            )
            ORDER BY f.created_at ASC, f.id ASC
          )
          FROM public.record_files f
          WHERE f.record_id = r.id
        ), '[]'::json) AS record_files
      FROM public.records r
      LEFT JOIN public.school s ON s.id = r.school_id
      LEFT JOIN public.association a ON a.id = s.association_id
      LEFT JOIN public.unions u ON u.id = r.union_id
      LEFT JOIN public.topics t ON t.id = r.topic_id
      WHERE public.can_access_record_scope(r.school_id, r.union_id)
        AND ${extra}
      ORDER BY r.created_at DESC
    `;
  }

  #selectFiles(tx, recordId) {
    return tx.$queryRaw`
      SELECT
        f.id::text AS id,
        f.record_id::text AS record_id,
        f.file_url,
        f.file_type,
        to_char(f.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS created_at,
        f.is_cover,
        f.focus_x,
        f.focus_y,
        f.focus_scale
      FROM public.record_files f
      WHERE f.record_id = ${recordId}
      ORDER BY f.created_at ASC, f.id ASC
    `;
  }

  async #assertScope(tx, schoolId, unionId) {
    const rows = await tx.$queryRaw`
      SELECT (
        (
          ${schoolId}::bigint IS NULL
          OR public.can_access_school(${schoolId}::bigint)
          OR (
            public.current_app_role() = 'coordenador_uniao'
            AND public.school_belongs_to_user_union(${schoolId}::bigint)
          )
        )
        AND (
          ${unionId}::bigint IS NULL
          OR public.can_access_union(${unionId}::bigint)
        )
        AND public.can_access_record_scope(${schoolId}::bigint, ${unionId}::bigint)
      ) AS allowed
    `;
    if (this.#isAllowed(rows[0]?.allowed)) return;
    throw new AppError('Escola ou união fora do seu escopo', 403);
  }

  async #assertVisible(tx, recordId) {
    const location = await this.#locate(tx, recordId);
    if (location && this.#isAllowed(location.in_scope)) return;
    throw new AppError('Registro não encontrado', 404);
  }

  async #assertAuthor(tx, userId, recordId, action) {
    const location = await this.#locate(tx, recordId);
    if (!location || !this.#isAllowed(location.in_scope)) {
      throw new AppError('Registro não encontrado', 404);
    }
    if (this.#isAuthor(location, userId)) return;
    throw new AppError(this.#authorMessage(action), 403);
  }

  async #locate(tx, recordId) {
    const rows = await tx.$queryRaw`
      SELECT
        r.user_id,
        public.can_access_record_scope(r.school_id, r.union_id) AS in_scope
      FROM public.records r
      WHERE r.id = ${recordId}
    `;
    return rows[0] ?? null;
  }

  async #assertFileCount(tx, recordId) {
    const rows = await tx.$queryRaw`
      SELECT count(*)::int AS total
      FROM public.record_files
      WHERE record_id = ${recordId}
    `;
    if (Number(rows[0].total) < maxRecordFiles) return;
    throw new AppError(fileLimitMessage, 400);
  }

  #file(files, fileId) {
    const file = files.find((item) => item.id === fileId);
    if (file) return file;
    throw new AppError('Arquivo não encontrado', 404);
  }

  #assertDeleted(deleted) {
    if (Number(deleted) > 0) return;
    throw new AppError('Registro não encontrado', 404);
  }

  #isAuthor(location, userId) {
    return String(location.user_id) === userId;
  }

  #isAllowed(value) {
    return value === true;
  }

  #authorMessage(action) {
    if (action === 'delete') return 'Só o autor pode apagar este registro';
    return 'Só o autor pode alterar este registro';
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
    if (code === '23514') throw new AppError(this.#checkMessage(this.#message(error)), 400);
    if (code === '23503') throw new AppError('Tópico, escola ou união inválidos', 400);
    console.error(error);
    throw new AppError(fallback, 500);
  }

  #checkMessage(message) {
    if (message.includes('5 fotos')) return fileLimitMessage;
    if (message.includes('people_count')) return 'A quantidade de pessoas deve ser maior que zero';
    if (message.includes('event')) return 'A data final não pode ser anterior à data inicial';
    if (message.includes('focus_scale')) return 'O zoom da foto deve ficar entre 1 e 3';
    if (message.includes('school') || message.includes('union')) return 'Informe a escola ou a união';
    return 'Dados do registro inválidos';
  }

  #code(error) {
    if (error?.meta?.code) return String(error.meta.code);
    if (error?.cause?.code) return String(error.cause.code);
    if (typeof error?.code === 'string' && error.code !== 'P2010') return error.code;
    return '';
  }

  #message(error) {
    return String(error?.meta?.message ?? error?.cause?.message ?? error?.message ?? '');
  }
}
