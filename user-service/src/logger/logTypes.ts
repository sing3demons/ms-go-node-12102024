// logTypes.ts
interface LogEntry {
    name: string;
    log_name: string;
    context: {
        trace_id: string;
        span_id: string;
    };
    parent_id: string | null;
    start_time: string;
    end_time?: string;
    response_time?: string;
    attributes: {
        'http.route': string;
        'http.method': string;
    };
    events: LogEvent[];
}

interface LogEvent {
    name: string;
    timestamp: string;
    attributes?: Record<string, any>;
}