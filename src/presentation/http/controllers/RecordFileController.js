import { AppError } from '../../../domain/errors/AppError.js';
import { readPositiveId } from '../readPositiveId.js';

export class RecordFileController {
  constructor({ listRecordFiles, uploadRecordFile, updateRecordFile, deleteRecordFile, deleteRecordFiles }) {
    this.listRecordFiles = listRecordFiles;
    this.uploadRecordFile = uploadRecordFile;
    this.updateRecordFile = updateRecordFile;
    this.deleteRecordFile = deleteRecordFile;
    this.deleteRecordFiles = deleteRecordFiles;
  }

  list = async (req, res) => {
    const files = await this.listRecordFiles.execute({
      userId: req.userId,
      recordId: readPositiveId(req.params.id, 'Registro'),
    });
    res.status(200).json(files);
  };

  upload = async (req, res) => {
    const file = await this.uploadRecordFile.execute({
      userId: req.userId,
      recordId: readPositiveId(req.params.id, 'Registro'),
      bytes: req.file?.buffer,
      contentType: req.file?.mimetype,
      isCover: readFlag(req.body?.isCover ?? req.body?.is_cover),
      focusX: readOptionalNumber(req.body?.focusX ?? req.body?.focus_x),
      focusY: readOptionalNumber(req.body?.focusY ?? req.body?.focus_y),
      focusScale: readOptionalNumber(req.body?.focusScale ?? req.body?.focus_scale),
    });
    res.status(201).json(file);
  };

  update = async (req, res) => {
    const file = await this.updateRecordFile.execute({
      userId: req.userId,
      recordId: readPositiveId(req.params.id, 'Registro'),
      fileId: readPositiveId(req.params.fileId, 'Arquivo'),
      frame: req.body,
    });
    res.status(200).json(file);
  };

  remove = async (req, res) => {
    await this.deleteRecordFile.execute({
      userId: req.userId,
      recordId: readPositiveId(req.params.id, 'Registro'),
      fileId: readPositiveId(req.params.fileId, 'Arquivo'),
    });
    res.status(204).send();
  };

  removeAll = async (req, res) => {
    await this.deleteRecordFiles.execute({
      userId: req.userId,
      recordId: readPositiveId(req.params.id, 'Registro'),
    });
    res.status(204).send();
  };
}

function readFlag(value) {
  return value === true || value === 'true';
}

function readOptionalNumber(value) {
  if (value == null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new AppError('Enquadramento inválido', 400);
  return number;
}
