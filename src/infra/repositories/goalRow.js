import { Goal } from '../../domain/entities/Goal.js';
import { GoalProgress } from '../../domain/entities/GoalProgress.js';

export function toGoal(row) {
  return new Goal({
    id: requiredNumber(row.id),
    topicId: requiredNumber(row.topic_id),
    targetCount: requiredNumber(row.target_count),
    year: requiredNumber(row.year),
    topicName: row.topic_name,
    updatedAt: row.updated_at,
  });
}

export function toGoalProgress(row, topicId, year) {
  return new GoalProgress({
    topicId,
    year,
    recordCount: requiredNumber(row.record_count),
    peopleCount: requiredNumber(row.people_count),
  });
}

function requiredNumber(value) {
  return Number(value);
}
