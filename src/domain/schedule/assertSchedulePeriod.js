import { AppError } from '../errors/AppError.js';

export function assertSchedulePeriod(startAt, endAt) {
  const start = readTimestamp(startAt);
  const end = readTimestamp(endAt);
  if (end > start) return;
  throw new AppError('O horário final precisa ser depois do início', 400);
}

function readTimestamp(value) {
  if (value instanceof Date) return value.getTime();
  const time = Date.parse(value);
  if (Number.isNaN(time)) throw new AppError('Data inválida', 400);
  return time;
}
