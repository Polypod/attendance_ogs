import { MetricsService } from '../../services/MetricsService';

describe('MetricsService', () => {
  it('exposes a prometheus content type', () => {
    expect(MetricsService.contentType()).toContain('text/plain');
  });

  it('records HTTP observations into the registry', async () => {
    MetricsService.observeHttpRequest({
      method: 'GET',
      route: '/api/metrics',
      statusCode: 200,
      durationMs: 123,
    });

    const body = await MetricsService.metrics();

    expect(body).toContain('ogs_http_requests_total');
    expect(body).toContain('ogs_http_request_duration_seconds');
    expect(body).toContain('method="GET"');
    expect(body).toContain('route="/api/metrics"');
    expect(body).toContain('status="200"');
  });
});
