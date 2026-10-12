import { AppError } from '../../../domain/errors/AppError.js';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(new AppError('Dados inválidos', 400, result.error.flatten()));
    }

    req.body = result.data;
    return next();
  };
}
