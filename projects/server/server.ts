#!/usr/bin/env node

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { BridgeManager } from '@/lib/bridge/BridgeManager';
import { ModelFactory } from '@/lib/models';
import { getApiConfigPath } from '../shared/paths';
import { logger } from '@/lib/logging/server';
import { dockerUtils } from '@/lib/utils/docker';
import * as fs from 'fs';
import * as path from 'path';
import { uvxCacheDir } from './lib/utils/security';
import { npxCacheDir } from './lib/utils/security';

const dev = false; // process.env.NODE_ENV !== 'production';
const hostname = 'localhost';

// Check for --help argument
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
ToolVault Server

Usage: toolvault [options]

Options:
  --port <number>     Specify port to run on (default: auto-detect)
  --help, -h          Show this help message

Environment Variables:
  TOOLVAULT_PORT     Specify port via environment variable

Examples:
  toolvault                      # Run on auto-detected port
  toolvault --port 3000          # Run on port 3000
  TOOLVAULT_PORT=8080 toolvault  # Run on port 8080

The server will automatically detect an available port if none is specified.
`);
  process.exit(0);
}

// Parse port from command line args or environment variable
function parsePort(): number | undefined {
  // Check command line arguments for --port
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && portArgIndex + 1 < process.argv.length) {
    const portArg = process.argv[portArgIndex + 1];
    const port = parseInt(portArg, 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return port;
    }
  }
  
  // Check environment variable TOOLVAULT_PORT
  if (process.env.TOOLVAULT_PORT) {
    const port = parseInt(process.env.TOOLVAULT_PORT, 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return port;
    }
  }
    
  return undefined; // Will trigger available port detection
}

// No need for findAvailablePort - we'll use server.listen(0) instead

// Next.js will be initialized in start() function

let shuttingDown = false;

async function start() {
  try {
    // Determine port to use
    let port = parsePort();
    let useAutoPort = false;
    
    if (port === undefined) {
      // No port specified, will use auto-port detection
      useAutoPort = true;
      port = 0; // This tells Node.js to find an available port
      logger.info('No port specified, will use auto-port detection');
    }
    
    // Initialize database through model factory
    await ModelFactory.getInstance().initialize();

    // Ensure cache directories exist
    if (!fs.existsSync(uvxCacheDir)) {
      fs.mkdirSync(uvxCacheDir, { recursive: true });
    }
    if (!fs.existsSync(npxCacheDir)) {
      fs.mkdirSync(npxCacheDir, { recursive: true });
    }
    
    // Ensure Docker image is built before starting servers
    logger.debug('Checking Docker image availability...');
    const dockerImageBuilt = await dockerUtils.ensureRunnerContainersBuilt();
    if (!dockerImageBuilt) {
      logger.warn('Failed to build Docker image. Some MCP servers may not work properly.');
    }

    // Ensure proxy containers are running
    logger.debug('Checking proxy containers...');
    const proxyContainersRunning = await dockerUtils.ensureProxyContainersRunning();
    if (!proxyContainersRunning) {
      logger.warn('Failed to start proxy containers. Some MCP servers may not work properly.');
    }
    
    // Prepare Next.js
    const app = next({ dev: false, hostname, port: port, dir: __dirname }); // Point to the directory containing the executable
    const handle = app.getRequestHandler();
    await app.prepare();
    
    // Start MCP bridge
    const bridgeManager = BridgeManager.getInstance();
    await bridgeManager.start();

    // Create and start HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        logger.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    server.listen(port, async () => {
      // Get the actual port that was assigned
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      
      logger.info(`> Ready on http://${hostname}:${actualPort}`);
      
      // Write API configuration for shim discovery
      try {
        const apiConfigPath = getApiConfigPath();
        const configDir = path.dirname(apiConfigPath);
        
        // Ensure config directory exists
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        const apiConfig = {
          apiPath: `http://${hostname}:${actualPort}`
        };
        
        fs.writeFileSync(apiConfigPath, JSON.stringify(apiConfig, null, 2));
        logger.debug(`API config written to: ${apiConfigPath}`);
      } catch (error) {
        logger.error('Failed to write API config:', error);
      }
    }).on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${port} is already in use!`);
        logger.error(`Exiting...`);
        process.exit(1);
      } else {
        logger.error('Server error:', err);
        process.exit(1);
      }
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      if (shuttingDown) {
        logger.info('Shutdown already in progress, skipping...');
        return;
      }
      shuttingDown = true;
      logger.info('Shutting down...');
      
      // Clean up gateway config file
      try {
        const apiConfigPath = getApiConfigPath();
        if (fs.existsSync(apiConfigPath)) {
          fs.unlinkSync(apiConfigPath);
          logger.debug('API config file cleaned up');
        }
      } catch (error) {
        logger.error('Failed to cleanup API config:', error);
      }

      await bridgeManager.stop();

      logger.info('Closing server');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    logger.debug('Setting SIGINT/SIGTERM up signal handlers');
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
}

logger.info('Starting server');
logger.info(`Log level set to: ${logger.getCurrentLogLevel()}`);
start();