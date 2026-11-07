/**
 * The newest `MJ: Audit Logs` row of one type, for the screenshot script: the grant-run shot opens a real run's record.
 * Reads the database the way `magic-link-session.ts` does (the `.env` at the repo root).
 */
import sql from 'mssql';

export async function latestAuditLogId(auditLogTypeId: string): Promise<string | null> {
    const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD, MJ_CORE_SCHEMA } = process.env;
    const pool = await new sql.ConnectionPool({
        server: DB_HOST!, port: Number(DB_PORT ?? 1433), database: DB_DATABASE!, user: DB_USERNAME!, password: DB_PASSWORD!,
        options: { trustServerCertificate: true, encrypt: false },
    }).connect();
    try {
        const schema = MJ_CORE_SCHEMA || '__mj';
        const result = await pool.request().input('type', sql.UniqueIdentifier, auditLogTypeId)
            .query<{ ID: string }>(`SELECT TOP 1 ID FROM [${schema}].[AuditLog] WHERE AuditLogTypeID = @type ORDER BY __mj_CreatedAt DESC`);
        return result.recordset[0]?.ID ?? null;
    } finally {
        await pool.close();
    }
}
