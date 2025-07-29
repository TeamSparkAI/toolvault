import winston from 'winston';

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define level based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    return env === 'development' ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define the format for the logs
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
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
        stderrLevels: ['error', 'warn', 'info', 'http', 'debug']
    }),
    // Error transport for error logs
    new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
    }),
    // Combined transport for all logs
    new winston.transports.File({ filename: 'logs/combined.log' }),
];

// Create the logger
const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
});

export default logger; 