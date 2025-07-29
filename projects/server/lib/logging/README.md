# Logging System

This project implements a dual logging system with separate loggers for different use cases. The logging system is modularized to avoid frontend code importing server-side dependencies.

## Loggers

### `logger` (Winston)
- **Purpose**: Server-side logging with file output
- **Features**: 
  - Timestamped logs
  - Colorized console output
  - File logging (combined.log and error.log)
  - Structured logging with metadata
- **Use cases**: Server errors, API requests, database operations, system events

### `log` (Loglevel)
- **Purpose**: Console logging for UX code
- **Features**:
  - Simple console output
  - Lightweight
  - No file output
- **Use cases**: User-facing messages, development debugging, UI state changes

## Configuration

### Log Levels

Both loggers support the same core log levels:

**Common Levels:**
- `error` (0) - Errors that need immediate attention
- `warn` (1) - Warnings that should be investigated  
- `info` (2) - General information
- `debug` (3) - Detailed debugging information
- `trace` (4) - Most verbose debugging information (equivalent to loglevel's TRACE)

**Note:** Both winston and loglevel use these same levels, making the logging system consistent across server and frontend code.

### Setting Log Level

#### Environment Variable
```bash
export LOG_LEVEL=debug
npm run start
```

#### Command Line Parameter
```bash
npm run start -- --log-level debug
```

#### Default Behavior
- Development: `debug` level
- Production: `info` level

## File Structure

```
lib/logging/
├── server.ts      # Winston logger for server-side code
├── console.ts     # Loglevel logger for frontend/UX code
├── utils.ts       # Shared utilities for log level parsing
└── README.md      # This documentation
```

## Usage Examples

### Importing Loggers

**For server-side code (API routes, server.ts, etc.):**
```typescript
import { logger } from '@/lib/logging/server';
```

**For frontend/UX code (React components, etc.):**
```typescript
import { log } from '@/lib/logging/console';
```

**For backward compatibility (imports both):**
```typescript
import { logger, log } from '@/lib/logging';
```

### Server-side Logging (Winston)
```typescript
// Error logging
logger.error('Database connection failed:', error);

// Info logging
logger.info('Server started on port 3000');

// Debug logging
logger.debug('Processing request:', { method: 'GET', url: '/api/users' });

// Trace logging (most verbose)
logger.trace('Function entry:', { functionName: 'processRequest', args: { userId: 123 } });
```

### Console Logging (Loglevel)
```typescript
// Info logging
log.info('User logged in successfully');

// Debug logging
log.debug('Component state updated:', { userId: 123, action: 'login' });

// Warning
log.warn('Form validation failed');

// Error
log.error('Failed to load user data');

// Trace (very detailed debugging)
log.trace('Function entry point:', { functionName: 'handleClick' });
```

## File Output

### Combined Log (`logs/combined.log`)
Contains all log messages from the Winston logger.

### Error Log (`logs/error.log`)
Contains only error-level messages from the Winston logger.

## Migration Notes

When replacing existing `console.log` statements:

1. **Server/API code**: Use `logger` (Winston)
2. **UI/UX code**: Use `log` (Loglevel)
3. **Error handling**: Always use `logger.error` for server errors
4. **User feedback**: Use `log.info` for user-facing messages

## Future Enhancements

- Add log rotation
- Implement structured logging with correlation IDs
- Add log aggregation for distributed tracing
- Configure different log levels for different modules 