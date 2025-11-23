import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';

export interface TracerOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  endpoint?: string;
  samplingRatio?: number;
}

export const startTracing = (options: TracerOptions): NodeSDK => {
  const exporter = new OTLPTraceExporter({ url: options.endpoint });
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: options.serviceVersion ?? '0.1.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: options.environment ?? 'development',
  });

  const sdk = new NodeSDK({
    traceExporter: exporter,
    resource,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis-4': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-fastify': { enabled: true },
      }),
    ],
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(options.samplingRatio ?? 1),
    }),
  });

  sdk.start().catch((error) => {
    console.error('Failed to initialize tracing', error);
  });

  return sdk;
};
