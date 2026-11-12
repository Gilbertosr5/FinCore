import { createHttpClient } from '@/services/api/http-client';

import {
  ApiMarketIndicatorRepository,
  DemoMarketIndicatorRepository,
  INVESTMENT_ENDPOINTS,
} from './investment.infrastructure';
import { fakeHttpAdapter, type FakeHandler } from '../../../../tests/helpers/fake-http-adapter';

function setup(handler: FakeHandler) {
  const adapter = fakeHttpAdapter(handler);
  const http = createHttpClient({
    baseUrl: 'http://api.test',
    timeoutMs: 5000,
    adapter,
    refreshSession: () => Promise.resolve(false),
    onUnauthorized: () => undefined,
  });
  return { repository: new ApiMarketIndicatorRepository(http), adapter };
}

describe('indicadores de mercado (contrato futuro)', () => {
  it('demonstração nunca inventa cotações', async () => {
    expect(await new DemoMarketIndicatorRepository().findLatest()).toEqual({
      available: false,
      quotes: [],
    });
  });

  it.each([404, 501])('backend sem o recurso (%i) = integração indisponível', async (status) => {
    const { repository, adapter } = setup(() => ({ status }));
    expect(await repository.findLatest()).toEqual({ available: false, quotes: [] });
    expect(adapter.calls[0]?.url).toBe(INVESTMENT_ENDPOINTS.marketIndicators);
  });

  it('valida as cotações recebidas', async () => {
    const quote = {
      code: 'cdi',
      date: '2026-11-10',
      value: '10.65',
      unit: 'percent_year',
      source: 'BCB/SGS',
    };
    const { repository } = setup(() => ({ status: 200, data: [quote] }));
    expect(await repository.findLatest()).toEqual({ available: true, quotes: [quote] });
  });

  it('erro do servidor não é mascarado como indisponível', async () => {
    const { repository } = setup(() => ({ status: 500 }));
    await expect(repository.findLatest()).rejects.toBeTruthy();
  });
});
