import { BadRequestException } from '@nestjs/common';
import { SyncService } from './sync.service';

describe('SyncService.countRows', () => {
  const query = jest.fn();
  const service = new SyncService({ query } as any, {} as any);

  beforeEach(() => query.mockReset());

  it('cuenta los registros vivos del negocio', async () => {
    query.mockResolvedValue([{ count: 119 }]);
    await expect(service.countRows('customers', 'org-1', 'u-1')).resolves.toEqual({
      entity: 'customers',
      count: 119,
    });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('FROM "customers" e');
    expect(sql).toContain('e.organization_id = $1');
    expect(sql).toContain('e.deleted_at IS NULL');
    expect(params).toEqual(['org-1']);
  });

  it('presentaciones se filtran por el producto del negocio', async () => {
    query.mockResolvedValue([{ count: 3 }]);
    await service.countRows('product_presentations', 'org-1', 'u-1');
    expect(query.mock.calls[0][0]).toContain('JOIN products tp');
  });

  it('rechaza entidades desconocidas', async () => {
    await expect(service.countRows('users', 'org-1', 'u-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
