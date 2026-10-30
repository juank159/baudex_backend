import { nextInvoiceNumber } from './invoice-number';

describe('nextInvoiceNumber', () => {
  const now = new Date('2026-10-29T15:00:00.123Z'); // termina en ...000123
  const ms = now.getTime().toString().slice(-6);

  it('usa el número del reloj si está libre (mismo formato de siempre)', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await expect(nextInvoiceNumber({ query } as any, 'org', now)).resolves.toBe(`INV-2026-${ms}`);
  });

  it('si ya existe, busca otro libre', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([]) // candado
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValue([]);
    const n = await nextInvoiceNumber({ query } as any, 'org', now);
    expect(n).toMatch(/^INV-2026-\d{6}$/);
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[0][1]).toEqual(['movement_number_org']);
  });
});
