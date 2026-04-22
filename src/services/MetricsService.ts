import client from 'prom-client';

export type HttpObservation = {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
};

const registry = new client.Registry();
registry.setDefaultLabels({ service: 'attendance_ogs_backend' });

if (process.env.NODE_ENV !== 'test') {
  client.collectDefaultMetrics({ register: registry, prefix: 'ogs_' });
}

const httpRequestsTotal = new client.Counter({
  name: 'ogs_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'ogs_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const MetricsService = {
  observeHttpRequest(obs: HttpObservation): void {
    const status = String(obs.statusCode);
    const labels = {
      method: obs.method,
      route: obs.route,
      status,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, obs.durationMs / 1000);
  },

  contentType(): string {
    return registry.contentType;
  },

  async metrics(): Promise<string> {
    return registry.metrics();
  },
};
