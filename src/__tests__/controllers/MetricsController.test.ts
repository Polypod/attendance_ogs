jest.mock('../../services/MetricsService', () => ({
  MetricsService: {
    metrics: jest.fn(async () => '# mock metrics'),
    contentType: jest.fn(() => 'text/plain; version=0.0.4; charset=utf-8'),
  },
}));

import { MetricsController } from '../../controllers/MetricsController';
import { MetricsService } from '../../services/MetricsService';

describe('MetricsController', () => {
  const setHeader = jest.fn();
  const send = jest.fn();
  const status = jest.fn(() => ({ send })) as any;
  const res: any = { setHeader, status, send };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns prometheus metrics with correct content type', async () => {
    await MetricsController.getMetrics({} as any, res);

    expect(MetricsService.metrics).toHaveBeenCalled();
    expect(MetricsService.contentType).toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8'
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith('# mock metrics');
  });
});
