import multer from 'multer';
import { AppError } from '../../../domain/errors/AppError.js';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('avatar');

export function receiveAvatar(req, res, next) {
  parser(req, res, (error) => finishUpload(error, next));
}

function finishUpload(error, next) {
  if (!error) return next();
  if (error instanceof AppError) return next(error);
  if (error.code === 'LIMIT_FILE_SIZE') {
    return next(new AppError('A imagem deve ter no máximo 5 MB', 400));
  }
  return next(new AppError('Não foi possível ler a imagem', 400));
}
