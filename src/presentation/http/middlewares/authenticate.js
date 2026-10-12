import { AppError } from '../../../domain/errors/AppError.js';

export function authenticate(tokenProvider) {
  return (req, _res, next) => {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      return next(new AppError('Token de acesso ausente', 401));
    }

    const token = header.slice('Bearer '.length).trim();

    try {
      const payload = tokenProvider.verify(token);
      req.userId = payload.sub;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
