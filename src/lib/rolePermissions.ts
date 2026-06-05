import sql from 'mssql';

interface PermissionDbRequest {
  input(name: string, type: unknown, value: unknown): PermissionDbRequest;
  query(statement: string): Promise<{ recordset: Array<Record<string, unknown>> }>;
}

interface PermissionDb {
  request(): PermissionDbRequest;
}

export async function loadRolePermissionCodes(db: PermissionDb, roleCode: string): Promise<string[]> {
  if (roleCode === 'yard_manager') return ['*'];

  const result = await db.request()
    .input('roleCode', sql.NVarChar, roleCode)
    .query(`
      SELECT p.permission_code
      FROM Roles r
      JOIN RolePermissions rp ON rp.role_id = r.role_id
      JOIN Permissions p ON p.permission_id = rp.permission_id
      WHERE r.role_code = @roleCode
      ORDER BY p.module, p.action, p.permission_code
    `);

  return result.recordset
    .map(row => String(row.permission_code || '').trim())
    .filter(Boolean);
}
