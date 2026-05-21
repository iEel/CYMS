import sql from 'mssql';

type BranchInput = {
  branch_id?: unknown;
  [key: string]: unknown;
};

interface DbRequest {
  input(name: string, type: unknown, value: unknown): DbRequest;
  query(statement: string): Promise<unknown>;
}

interface DbPool {
  request(): DbRequest;
}

export function parseBranchId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('branch_id must be a positive integer');
  }
  return parsed;
}

export function collectExistingBranchIds(branches: BranchInput[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();

  for (const branch of branches) {
    const id = parseBranchId(branch.branch_id);
    if (id && !seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }

  return ids;
}

export async function deleteRemovedCustomerBranches(
  pool: DbPool,
  customerId: number,
  branches: BranchInput[]
) {
  const branchIds = collectExistingBranchIds(branches);
  const req = pool.request().input('cid', sql.Int, customerId);

  if (branchIds.length === 0) {
    await req.query('DELETE FROM CustomerBranches WHERE customer_id = @cid');
    return;
  }

  const placeholders = branchIds.map((id, index) => {
    const name = `branchId${index}`;
    req.input(name, sql.Int, id);
    return `@${name}`;
  });

  await req.query(`
    DELETE FROM CustomerBranches
    WHERE customer_id = @cid
      AND branch_id NOT IN (${placeholders.join(', ')})
  `);
}
