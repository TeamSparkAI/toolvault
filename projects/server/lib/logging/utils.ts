export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

// Parse log level from environment variable or command line
export function parseLogLevel(): LogLevel {
  // Check command line arguments for --log-level
  const logLevelArgIndex = process.argv.indexOf('--log-level');
  if (logLevelArgIndex !== -1 && logLevelArgIndex + 1 < process.argv.length) {
    const logLevelArg = process.argv[logLevelArgIndex + 1];
    if (['error', 'warn', 'info', 'debug', 'trace'].includes(logLevelArg)) {
      return logLevelArg as LogLevel;
    }
  }
  
  // Check environment variable LOG_LEVEL
  if (process.env.TOOLVAULT_LOG_LEVEL) {
    const envLogLevel = process.env.TOOLVAULT_LOG_LEVEL.toLowerCase();
    if (['error', 'warn', 'info', 'debug', 'trace'].includes(envLogLevel)) {
      return envLogLevel as LogLevel;
    }
  }
  
  return 'info';
}

import log from 'loglevel';

// Convert winston log level to loglevel compatible level
export function convertToLoglevelLevel(winstonLevel: string): log.LogLevelDesc {
  const levelMap: Record<string, log.LogLevelDesc> = {
    'error': 'ERROR',
    'warn': 'WARN', 
    'info': 'INFO',
    'debug': 'DEBUG',
    'trace': 'TRACE'
  };
  
  return levelMap[winstonLevel] || 'INFO';
}