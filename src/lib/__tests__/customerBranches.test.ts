import { collectExistingBranchIds, deleteRemovedCustomerBranches } from '../customerBranches';

function makeDb() {
  const query = jest.fn().mockResolvedValue({ recordset: [] });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query };
}

describe('customer branch SQL helpers', () => {
  it('accepts positive integer branch ids and removes duplicates', () => {
    expect(collectExistingBranchIds([
      { branch_id: 5 },
      { branch_id: '6' },
      { branch_id: 5 },
      { branch_name: 'new branch' },
    ])).toEqual([5, 6]);
  });

  it('rejects non-integer branch ids before they can reach SQL', () => {
    expect(() => collectExistingBranchIds([
      { branch_id: '1); DELETE FROM Customers;--' },
    ])).toThrow('branch_id must be a positive integer');
  });

  it('deletes missing branches with parameterized branch ids', async () => {
    const db = makeDb();

    await deleteRemovedCustomerBranches(db, 10, [
      { branch_id: 2 },
      { branch_id: 9 },
    ]);

    expect(db.input).toHaveBeenCalledWith('cid', expect.anything(), 10);
    expect(db.input).toHaveBeenCalledWith('branchId0', expect.anything(), 2);
    expect(db.input).toHaveBeenCalledWith('branchId1', expect.anything(), 9);

    const statement = db.query.mock.calls[0][0] as string;
    expect(statement).toContain('branch_id NOT IN (@branchId0, @branchId1)');
    expect(statement).not.toContain('2,9');
    expect(statement).not.toContain('DELETE FROM Customers');
  });

  it('deletes all branches for the customer when no existing branch ids remain', async () => {
    const db = makeDb();

    await deleteRemovedCustomerBranches(db, 10, [{ branch_name: 'new branch' }]);

    expect(db.input).toHaveBeenCalledWith('cid', expect.anything(), 10);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE customer_id = @cid'));
    expect(db.query).toHaveBeenCalledWith(expect.not.stringContaining('NOT IN'));
  });
});
