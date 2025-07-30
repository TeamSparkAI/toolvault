import winston from 'winston';
import { LogLevel } from './types/config';

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
};

// Define level based on environment
const level = () => {
    const env = process.env.MCP_BRIDGE_LOG_LEVEL;
    return env ?? 'info';
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'white',
    trace: 'cyan',
};

// Add colors to winston
winston.addColors(colors);

// Define the format for the logs
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:SSS' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...rest } = info as any;
        const args = [message];
        // Add any additional arguments
        if (rest[Symbol.for('splat')]) {
        args.push(...rest[Symbol.for('splat')].map((arg: any) => 
            typeof arg === 'object' ? JSON.stringify(arg) : arg
        ));
        }
        return `${timestamp} ${level}: ${args.join(' ')}`;
    }),
);

// Define which transports the logger must use
const transports = [
    // Console transport for all logs - using stderr (so we can use stdout for program output in stdio mode)
    new winston.transports.Console({
        stderrLevels: ['error', 'warn', 'info', 'debug', 'trace']
    }),
    // Error transport for error logs
    new winston.transports.File({
        filename: 'logs/mcp-link-error.log',
        level: 'error',
    }),
    // Combined transport for all logs
    new winston.transports.File({ filename: 'logs/mcp-link.log' }),
];

// Create the logger
const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
});

// Add the trace method to the actual logger object
(logger as any).trace = (message: string, ...meta: any[]) => {
    logger.log('trace', message, ...meta);
};

// Function to update log level
export function setLogLevel(level: LogLevel) {
    logger.level = level;
}

export default logger as winston.Logger & {
    trace(message: string, ...meta: any[]): void;
}; 