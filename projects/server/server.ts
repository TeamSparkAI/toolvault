#!/usr/bin/env node

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { BridgeManager } from '@/lib/bridge/BridgeManager';
import { ModelFactory } from '@/lib/models';
import { getApiConfigPath, getAppDataPath } from '../shared/utils/paths';
import { logger } from '@/lib/logging/server';
import { dockerUtils } from '@/lib/utils/docker';
import * as fs from 'fs';
import * as path from 'path';
import { uvxCacheDir } from './lib/utils/security';
import { npxCacheDir } from './lib/utils/security';
import { ConfigBackupService } from '@/lib/services/configBackupService';
import packageJson from '../../package.json';

const dev = false; // process.env.NODE_ENV !== 'production';
const hostname = 'localhost';

// Handle all commands
async function handleCommands(): Promise<boolean> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    handleHelpCommand();
    return true;
  }
  
  if (args.includes('--backups')) {
    await handleInspectCommand();
    return true;
  }
  
  // Handle --clean (which includes revert functionality)
  if (args.includes('--clean')) {
    await handleCleanCommand();
    return true;
  }
  
  // Handle --revert (only if --clean is not also specified)
  if (args.includes('--revert')) {
    await handleRevertCommand();
    return true;
  }
  
  return false;
}

function handleHelpCommand(): void {
  console.log(`
ToolVault Server

Usage: toolvault [options]

Options:
  --port <number>      Specify port to run on (default: auto-detect)
  --log-level <level>  Specify log level (error, warn, info, debug, trace)
  --backups            List all backup files with details
  --revert             Revert all active backups
  --clean              Remove all ToolVault app data (includes revert)
  --help, -h           Show this help message

Environment Variables:
  TOOLVAULT_PORT       Specify port via environment variable
  TOOLVAULT_LOG_LEVEL  Specify log level via environment variable

Examples:
  toolvault                      # Run on auto-detected port
  toolvault --port 3000          # Run on port 3000
  toolvault --log-level debug    # Set log level to debug
  toolvault --backups            # List all backups
  toolvault --revert             # Revert all active backups
  toolvault --clean              # Remove all app data (with revert)

The server will automatically detect an available port if none is specified.
`);
  process.exit(0);
}

async function handleInspectCommand(): Promise<void> {
  try {
    const backupService = new ConfigBackupService();
    const backups = await backupService.getAllBackups();
    
    if (backups.length === 0) {
      console.log('No backups found.');
      return;
    }
    
    console.log('Backup Files:');
    console.log('');
    
    for (const backup of backups) {
      // Determine tags for display
      let suffix = '';
      if (backup.status === 'reverted') {
        // For reverted backups, distinguish between removed (empty) and restored (non-empty)
        const isEmpty = (backup as any).empty === true;
        suffix = isEmpty ? ' (removed)' : ' (restored)';
      } else if (backup as any) {
        let isEmpty = (backup as any).empty === true;
        if (!isEmpty) {
          try {
            const st = await fs.promises.stat(backup.backupFile);
            isEmpty = st.size === 0;
          } catch {}
        }
        if (isEmpty) suffix = ' (empty)';
      }

      console.log(`  Original: ${backup.originalFile}${backup.status === 'reverted' ? ((backup as any).empty === true ? ' (removed)' : ' (restored)') : ''}`);
      console.log(`  Backup:   ${backup.backupFile}${backup.status === 'reverted' ? ' (removed)' : suffix}`);
      console.log(`  Created:  ${backup.timestamp}`);
      console.log(`  Client:   ${backup.clientName} (${backup.clientType})`);
      
      console.log(`  Status:   ${backup.status.charAt(0).toUpperCase() + backup.status.slice(1)}${backup.statusAt ? ` (${backup.statusAt})` : ''}`);
      console.log('');
    }
  } catch (error) {
    console.error('Error inspecting backups:', error);
    process.exit(1);
  }
}

async function handleRevertCommand(): Promise<void> {
  try {
    const backupService = new ConfigBackupService();
    const results = await backupService.revertAllActiveBackups();
    
    if (results.length === 0) {
      console.log('No active backups to revert.');
      return;
    }
    
    console.log(`Reverting ${results.length} backup(s)...`);
    console.log('');
    
    for (const result of results) {
      if (result.success) {
        const detail = result.action === 'removed' ? '(removed config file)' : '(restored from backup)';
        console.log(`✅ Reverted: ${result.originalFile} ${detail}`);
      } else {
        console.log(`❌ Failed to revert ${result.originalFile}: ${result.error}`);
      }
    }
    
    console.log('');
    console.log('Revert operation completed.');
    
  } catch (error) {
    console.error('Error during revert operation:', error);
    process.exit(1);
  }
}

async function handleCleanCommand(): Promise<void> {
  try {
    const appDataPath = getAppDataPath();
    
    console.log('🧹 Cleaning ToolVault app data...');
    console.log(`📁 App data directory: ${appDataPath}`);
    console.log('');
    
    // First, revert any active backups
    console.log('🔄 Reverting active backups...');
    try {
      const backupService = new ConfigBackupService();
      const results = await backupService.revertAllActiveBackups();
      
      if (results.length > 0) {
        console.log(`✅ Reverted ${results.length} backup(s) before cleaning.`);
      } else {
        console.log('✅ No active backups to revert.');
      }
    } catch (revertError) {
      console.log('⚠️  Warning: Failed to revert backups, continuing with cleanup...');
      console.log(`   Error: ${revertError}`);
    }
    console.log('');
    
    // Check if app data directory exists
    if (!fs.existsSync(appDataPath)) {
      console.log('✅ App data directory does not exist (already clean).');
      return;
    }
    
    // Remove the entire app data directory
    await fs.promises.rm(appDataPath, { recursive: true, force: true });
    
    console.log('✅ Successfully removed all ToolVault app data.');
    console.log('');
    console.log('This includes:');
    console.log('  • Database files');
    console.log('  • Backup files');
    console.log('  • Log files');
    console.log('  • Configuration files');
    console.log('');
    console.log('⚠️  All ToolVault data has been permanently deleted.');
    
  } catch (error) {
    console.error('❌ Error cleaning app data:', error);
    process.exit(1);
  }
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
    // Check for commands first
    const handledCommand = await handleCommands();
    if (handledCommand) {
      return; // Exit after handling command
    }

    logger.info('Starting server');
    logger.info(`Log level set to: ${logger.getCurrentLogLevel()}`);

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

logger.info(`ToolVault v${packageJson.version}`);
start();