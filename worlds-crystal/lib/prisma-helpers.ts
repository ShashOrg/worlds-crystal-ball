import { prisma } from "./prisma";

/**
 * Returns true when the database has the UserPickSelection table that backs
 * Crystal Ball statistic selections.
 */
export async function isUserPickSelectionTableReady(): Promise<boolean> {
    try {
        const result = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name = 'UserPickSelection'
            ) AS "exists"
        `;

        return Boolean(result?.[0]?.exists);
    } catch (error) {
        console.warn("Failed to verify UserPickSelection table existence", error);
        return false;
    }
}
