import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
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
                completedAtDate:
                    sql /*sql*/`DATE(${goalCompletions.createdAt})`.as(
                        'completedAtDate'
                    ),
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

    const goalsCompletedByWeekDay = db.$with('goal_completions_by_week_day').as(
        db
            .select({
                completedAtDate: goalsCompletedInWeek.completedAtDate,
                completions:
                    sql /*sql*/`JSON_AGG(JSON_BUILD_OBJECT('id', ${goalsCompletedInWeek.id}, 'title', ${goalsCompletedInWeek.title}, 'completedAt', ${goalsCompletedInWeek.completedAtDate}))`.as(
                        'completions'
                    ),
            })
            .from(goalsCompletedInWeek)
            .groupBy(goalsCompletedInWeek.completedAtDate)
    )

    const result = await db
        .with(
            goalsCreatedUpToWeek,
            goalsCompletedInWeek,
            goalsCompletedByWeekDay
        )
        .select({
            completed:
                sql /*sql*/`(SELECT COUNT (*) FROM ${goalsCompletedByWeekDay})`.mapWith(
                    Number
                ),
            total: sql /*sql*/`(SELECT SUM (${goalsCreatedUpToWeek.desiredWeeklyFrequency}) FROM ${goalsCreatedUpToWeek})`.mapWith(
                Number
            ),
            goalsPerDay: sql /*sql*/`(SELECT JSON_OBJECT_AGG(${goalsCompletedByWeekDay.completedAtDate}, ${goalsCompletedByWeekDay.completions}))`,
        })
        .from(goalsCompletedByWeekDay)

    return {
        summary: result,
    }
}
