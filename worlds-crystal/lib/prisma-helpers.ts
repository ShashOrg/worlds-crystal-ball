import { prisma } from "./prisma";

async function doesTableExist(tableName: string): Promise<boolean> {
    try {
        const result = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name = ${tableName}
            ) AS "exists"
        `;

        return Boolean(result?.[0]?.exists);
    } catch (error) {
        console.warn(`Failed to verify ${tableName} table existence`, error);
        return false;
    }
}

/**
 * Returns true when the database has the Statistic table seeded by migrations.
 */
export async function isStatisticTableReady(): Promise<boolean> {
    return doesTableExist("Statistic");
}

/**
 * Returns true when the database has the UserPickSelection table that backs
 * Crystal Ball statistic selections.
 */
export async function isUserPickSelectionTableReady(): Promise<boolean> {
    return doesTableExist("UserPickSelection");
}
