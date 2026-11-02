export const privateAudience = 'private';
export const associationAudience = 'association';
export const unionAudience = 'union';

export const scheduleAudiences = [privateAudience, associationAudience, unionAudience];

export function isScheduleAudience(value) {
  return scheduleAudiences.includes(value);
}
