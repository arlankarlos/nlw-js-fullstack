import dayjs from 'dayjs'
import { db } from '../db'
import { goalCompletions, goals } from '../db/schema'
import { and, gte, lte, count, eq, sql } from 'drizzle-orm'

interface CreateGoalCompletionRequest {
    goalId: string
}

export async function createGoalCompletion({
    goalId,
}: CreateGoalCompletionRequest) {
    const firstDayOfWeek = dayjs().startOf('week').toDate()
    const lastDayOfWeek = dayjs().endOf('week').toDate()

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
                    gte(goalCompletions.createdAt, firstDayOfWeek),
                    eq(goalCompletions.goalId, goalId)
                )
            )
            .groupBy(goalCompletions.goalId)
    )

    const result = await db
        .with(goalCompletionsCounts)
        .select({
            desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
            completionCount:
                sql /*sql*/`coalesce(goal_completions_counts.completion_count, 0)`.mapWith(
                    Number
                ),
        })
        .from(goals)
        .leftJoin(
            goalCompletionsCounts,
            eq(goalCompletionsCounts.goalId, goals.id)
        )
        .where(eq(goals.id, goalId))
        .limit(1)

    const { desiredWeeklyFrequency, completionCount } = result[0]

    if (completionCount >= desiredWeeklyFrequency) {
        throw new Error('Goal has been completed for the week!')
    }

    const insertResult = await db
        .insert(goalCompletions)
        .values({ goalId })
        .returning()
    const goalCompletion = insertResult[0]

    return { goalCompletion }
}
