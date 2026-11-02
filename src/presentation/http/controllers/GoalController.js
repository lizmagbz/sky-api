import { readGoalYear, readTopicId } from '../readGoalQuery.js';

export class GoalController {
  constructor({ listGoals, upsertGoal, readGoalProgress }) {
    this.listGoals = listGoals;
    this.upsertGoal = upsertGoal;
    this.readGoalProgress = readGoalProgress;
  }

  list = async (req, res) => {
    const goals = await this.listGoals.execute({
      userId: req.userId,
      year: readGoalYear(req.query.year),
    });
    res.status(200).json(goals);
  };

  upsert = async (req, res) => {
    const goal = await this.upsertGoal.execute({
      userId: req.userId,
      input: req.body,
    });
    res.status(200).json(goal);
  };

  progress = async (req, res) => {
    const progress = await this.readGoalProgress.execute({
      userId: req.userId,
      year: readGoalYear(req.query.year),
      topicId: readTopicId(req.query.topicId),
    });
    res.status(200).json(progress);
  };
}
