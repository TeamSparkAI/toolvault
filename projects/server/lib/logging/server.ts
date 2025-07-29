import winston from 'winston';
import path from 'path';
import { parseLogLevel, LogLevel } from './utils';
import { getAppDataPath } from '../../../shared/paths';
import * as fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';

// Define log levels - using common levels that work for both winston and loglevel
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4, // Most verbose level, equivalent to loglevel's TRACE
};

// Define colors for winston
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'white',
  trace: 'gray',
};

// Add colors to winston
winston.addColors(colors);

// Define the format for winston logs
const winstonFormat = winston.format.combine(
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

// Ensure logs directory exists
const logsDir = path.join(getAppDataPath(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define winston transports
const transports = [
  // Console transport for all logs
  new winston.transports.Console({
    stderrLevels: ['error', 'warn', 'info', 'debug', 'trace']
  }),
  // Error transport for error logs with rotation
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m', // 20MB max file size
    maxFiles: '14d', // Keep 14 days of error logs
  }),
  // Combined transport for all logs with rotation
  new DailyRotateFile({
    filename: path.join(logsDir, 'toolvault-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m', // 20MB max file size
    maxFiles: '7d', // Keep 7 days of combined logs
  }),
];

// Create the winston logger
const logger = winston.createLogger({
  level: parseLogLevel(),
  levels,
  format: winstonFormat,
  transports,
});

// Add the trace method to the actual logger object
(logger as any).trace = (message: string, ...meta: any[]) => {
  logger.log('trace', message, ...meta);
};

// Add getCurrentLogLevel method to the logger
(logger as any).getCurrentLogLevel = (): LogLevel => parseLogLevel();

// Create properly typed logger export
const typedLogger = logger as winston.Logger & {
  trace(message: string, ...meta: any[]): void;
  getCurrentLogLevel(): LogLevel;
};

export { typedLogger as logger }; 