import { initTracer as initJaegerTracer, TracingConfig, TracingOptions } from 'jaeger-client'

import { serviceName } from './loggerEntry'

const initTracer = (service_name: string = serviceName) => {
  const config: TracingConfig = {
    serviceName: service_name,
    sampler: {
      type: 'const',
      param: 1,
    },
    reporter: {
      collectorEndpoint: 'http://localhost:14268/api/traces',
      logSpans: true,
    },
  }

  const options: TracingOptions = {
    logger: {
      info(msg) {
        console.log('INFO ', msg)
      },
      error(msg) {
        console.log('ERROR', msg)
      },
    },
  }
  return initJaegerTracer(config, options)
}

export { initTracer }
