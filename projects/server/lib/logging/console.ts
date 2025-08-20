import logLevel from 'loglevel';
import { convertToLoglevelLevel } from './utils';
import { clientSettings } from '@/lib/clientSettings';

// Track initialization state
let logLevelUpdated = false;
let initializationFailed = false;
let initializationPromise: Promise<void> | null = null;

// Queue for storing log events during initialization
interface QueuedLogEvent {
    level: 'debug' | 'info' | 'warn' | 'error' | 'trace';
    args: any[];
}

const logQueue: QueuedLogEvent[] = [];

// Update log level from client settings
async function updateLogLevelFromSettings(): Promise<void> {
    if (logLevelUpdated) return;
    
    // Don't retry if initialization has already failed
    if (initializationFailed) {
        console.warn('Log level initialization previously failed, skipping retry');
        return;
    }

    // Prevent multiple simultaneous initialization calls
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            const serverLogLevel = await clientSettings.getLogLevel();
            const consoleLogLevel = convertToLoglevelLevel(serverLogLevel);
            logLevel.setLevel(consoleLogLevel);
            logLevelUpdated = true;

            // Replay all queued log events
            logQueue.forEach(({ level, args }) => {
                logLevel[level](`[${level}]`, ...args);
            });
            logQueue.length = 0; // Clear queue
        } catch (error) {
            // Mark initialization as failed to prevent repeated attempts
            initializationFailed = true;
            console.warn('Failed to update log level from settings:', error);
        } finally {
            // Clear the promise so future calls can be attempted if needed
            initializationPromise = null;
        }
    })();

    return initializationPromise;
}

// Central internal log function that handles initialization, queueing, and logging
function internalLog(level: 'debug' | 'info' | 'warn' | 'error' | 'trace', args: any[]) {
    if (!logLevelUpdated && !initializationFailed) {
        updateLogLevelFromSettings();
        logQueue.push({ level, args });
        return;
    }
    // Log immediately if initialization is complete or failed
    return logLevel[level](`[${level}]`, ...args);
}

// Set initial level
logLevel.setLevel('info');

// Create our own log object with wrapper methods
const log = {
    debug: (...args: any[]) => internalLog('debug', args),
    info: (...args: any[]) => internalLog('info', args),
    warn: (...args: any[]) => internalLog('warn', args),
    error: (...args: any[]) => internalLog('error', args),
    trace: (...args: any[]) => internalLog('trace', args),

    // Expose other loglevel methods as needed
    setLevel: (level: any) => logLevel.setLevel(level),
    getLevel: () => logLevel.getLevel(),
    enableAll: () => logLevel.enableAll(),
    disableAll: () => logLevel.disableAll(),

    // Initialize logging from server settings
    init: async () => {
        return updateLogLevelFromSettings();
    }
};

// Export our wrapper
export { log }; 