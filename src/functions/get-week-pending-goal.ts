import dayjs from 'dayjs'
import { db } from '../db'
import { goalCompletions, goals } from '../db/schema'
import { and, gte, lte, count, eq, sql } from 'drizzle-orm'

export async function getWeekPendingGoals() {
    const firstDayOfWeek = dayjs().startOf('week').toDate()
    const lastDayOfWeek = dayjs().endOf('week').toDate()

    const goalsCreatedUpToWeek = db.$with('goals_created_up_to_week').as(
        db
            .select({
                id: goals.id,
                title: goals.title,
                desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
                createdAt: goals.createdAt,
            })
            .from(goals)
            .where(lte(goals.createdAt, lastDayOfWeek))
    )

    const goalCompletionsCounts = db.$with('goal_completions_counts').as(
        db
            .select({
                goalId: goalCompletions.goalId,
                completionCount: count(goalCompletions.id).as(
                    'completion_count'
                ),
            })
            .from(goalCompletions)
            .where(
                and(
                    lte(goalCompletions.createdAt, lastDayOfWeek),
                    gte(goalCompletions.createdAt, firstDayOfWeek)
                )
            )
            .groupBy(goalCompletions.goalId)
    )
    // sql`coalesce(${goalCompletionsCounts.completionCount}, 0)`
    const pendingGoals = await db
        .with(goalsCreatedUpToWeek, goalCompletionsCounts)
        .select({
            id: goalsCreatedUpToWeek.id,
            title: goalsCreatedUpToWeek.title,
            desiredWeeklyFrequency: goalsCreatedUpToWeek.desiredWeeklyFrequency,
            completionCount:
                sql /*sql*/`coalesce(goal_completions_counts.completion_count, 0)`.mapWith(
                    Number
                ),
        })
        .from(goalsCreatedUpToWeek)
        .leftJoin(
            goalCompletionsCounts,
            eq(goalCompletionsCounts.goalId, goalsCreatedUpToWeek.id)
        )
        .toSQL()

    return {
        pendingGoals,
    }
}
