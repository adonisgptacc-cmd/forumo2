import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";

export interface TracerOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  endpoint?: string;
  samplingRatio?: number;
}

export const startTracing = (options: TracerOptions): NodeSDK => {
  const exporterConfig = options.endpoint ? { url: options.endpoint } : {};
  const exporter = new OTLPTraceExporter(exporterConfig);

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: options.serviceName,
    [ATTR_SERVICE_VERSION]: options.serviceVersion ?? "0.1.0",
    "deployment.environment": options.environment ?? "development",
  });

  const sdk = new NodeSDK({
    traceExporter: exporter,
    resource,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-http": { enabled: true },
        "@opentelemetry/instrumentation-pg": { enabled: true },
        "@opentelemetry/instrumentation-redis": { enabled: true },
        "@opentelemetry/instrumentation-express": { enabled: true },
      }),
    ],
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(options.samplingRatio ?? 1),
    }),
  });

  try {
    sdk.start();
  } catch (error) {
    console.error("Failed to initialize tracing", error);
  }

  return sdk;
};
