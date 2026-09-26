import { describe, it, expect, vi, afterEach } from 'vitest';
import { dependencies, parameters } from './metricInput';
import { ApiError, request } from './api/client';
describe('metric inputs', () => {
  it('deduplicates references and ignores literals and comments', () => {
    expect(
      dependencies("SELECT ${revenue} / ${orders}, '${ignored}' /* ${comment} */ FROM ${revenue}"),
    ).toEqual(['revenue', 'orders']);
  });
  it('rejects non-string parameter values', () => {
    expect(() => parameters('{"rate":2}')).toThrow();
    expect(parameters('{"currency":"INR"}')).toEqual({ currency: 'INR' });
  });
});
describe('API failures', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('preserves validation details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'Invalid metric', details: { errors: ['Missing SQL'] } },
          }),
          { status: 400 },
        ),
      ),
    );
    await expect(request('/test')).rejects.toMatchObject({
      status: 400,
      details: { errors: ['Missing SQL'] },
    });
  });
  it('handles non-JSON gateway errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Gateway error</html>', { status: 502 })),
    );
    await expect(request('/test')).rejects.toBeInstanceOf(ApiError);
  });
  it('reports network failure without simulated success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(request('/test')).rejects.toThrow('Cannot reach the API');
  });
});
