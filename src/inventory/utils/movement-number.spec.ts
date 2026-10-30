import { nextBatchNumber, nextMovementNumber } from './movement-number';

describe('numeración de inventario', () => {
  const prefix = (kind: string) => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    return `${kind}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-`;
  };

  it('toma el candado de inventario y sigue después del mayor', async () => {
    const query = jest.fn(async (sql: string, _params?: any[]) =>
      sql.includes('advisory') ? [] : [{ value: `${prefix('MOV')}000041` }],
    );
    await expect(nextMovementNumber('org', { query } as any)).resolves.toBe(`${prefix('MOV')}000042`);
    expect(query.mock.calls[0][1]).toEqual(['movement_number_org']);
    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('ORDER BY "movementNumber" DESC');
    expect(sql).toContain('LIMIT 1');
  });

  it('mes sin movimientos empieza en 000001', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await expect(nextMovementNumber('org', { query } as any)).resolves.toBe(`${prefix('MOV')}000001`);
  });

  it('lotes: candado de inventario ANTES del de lotes', async () => {
    const query = jest.fn(async (sql: string, _params?: any[]) => (sql.includes('advisory') ? [] : []));
    await expect(nextBatchNumber('org', { query } as any)).resolves.toBe(`${prefix('BATCH')}000001`);
    expect(query.mock.calls.map((c) => (c[1] as any)?.[0]).slice(0, 2)).toEqual([
      'movement_number_org',
      'batch_number_org',
    ]);
  });
});
