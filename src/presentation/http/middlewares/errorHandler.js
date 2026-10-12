import { AppError } from '../../../domain/errors/AppError.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  console.error(error);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}
