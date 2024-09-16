import { and, count, eq, gte, lte } from 'drizzle-orm'
import dayjs from 'dayjs'
import { db } from '../db'
import { goalCompletions, goals } from '../db/schema'

export async function getWeekSummary() {
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

    const goalsCompletedInWeek = db.$with('goal_completions_counts').as(
        db
            .select({
                id: goals.id,
                title: goals.title,
                createdAt: goals.createdAt,
            })
            .from(goalCompletions)
            .innerJoin(goals, eq(goals.id, goalCompletions.goalId))
            .where(
                and(
                    lte(goalCompletions.createdAt, lastDayOfWeek),
                    gte(goalCompletions.createdAt, firstDayOfWeek)
                )
            )
    )

    return {
        summary: 'teste',
    }
}
