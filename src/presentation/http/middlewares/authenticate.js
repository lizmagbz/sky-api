import { AppError } from '../../../domain/errors/AppError.js';

export function authenticate(authGateway) {
  return async (req, _res, next) => {
    const token = readBearer(req.headers.authorization);
    if (!token) return next(new AppError('Token de acesso ausente', 401));

    try {
      const identity = await authGateway.identify(token);
      req.userId = identity.userId;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function readBearer(header) {
  if (!header?.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}
