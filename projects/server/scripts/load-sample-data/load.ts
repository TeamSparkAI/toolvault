import { MessageFilterService } from '@/lib/services/messageFilter';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { validateJsonRpcMessage } from '@/lib/jsonrpc';
import { ProxyJwtPayload } from '@/lib/proxyJwt';
import { ModelFactory } from '../../lib/models';
import { ServerData } from '@/lib/models/types/server';
import { logger } from '@/lib/logging/server';

// Create 60 days of data, going back from today.  Select random file and session data (using weights) and a random interval between 0 and 60 minutes.
//
// Files in data directory are json objects with metadata and message arrays representing MCP sessions to be replayed and inserted into the database.
//
// TODO: We should have some periodic pings also (a couple of files that just di protocol init and ping)
// TODO: When we have policies, we'll want a small number of messages to generate policy violations (we can use weights for that)
//

async function processMessages(jwtPayload: ProxyJwtPayload, serverName: string, messages: any[], timestamp: Date) {
    const sessionName = `test-${Date.now()}`;
    let messageCount = 0;
    for (const message of messages) {
        // Bump timestamp by a very small increment (10 to 1000ms per message)
        timestamp = new Date(timestamp.getTime() + (Math.random() * 990) + 10);
        await MessageFilterService.processMessage(jwtPayload, sessionName, validateJsonRpcMessage(message.origin, message.payload), timestamp);
        messageCount++;
    }
    return messageCount;
}

async function loadSampleData() {
    try {
        // Initialize database through model factory
        await ModelFactory.getInstance().initialize();

        const dataDir = join(__dirname, 'data');

        // Load and process config/servers.json
        const servers = JSON.parse(readFileSync(join(dataDir, 'config', 'servers.json'), 'utf-8'));
        const serverNames = Object.keys(servers.mcpServers);
        logger.debug("Loading servers: ", serverNames);
        
        // Create a map of server names to IDs
        const serverMap = new Map<string, ServerData>();
        
        const serverModel = await ModelFactory.getInstance().getServerModel();
        for (const serverName of serverNames) {
            const server = servers.mcpServers[serverName];
            logger.debug("Loading server: ", serverName);

            // If server contains a catalogId, extract it and remove the property from the server object
            const serverCatalogId = server.catalogId;
            if (serverCatalogId) {
                delete server.catalogId;
            }

            // Create server through model layer
            const createdServer = await serverModel.create({
                name: serverName,
                config: server,
                serverCatalogId,
                enabled: true
            });
            serverMap.set(serverName, createdServer);
        }

        logger.debug("Server map: ", serverMap);

        // Load and process config/clients.json
        const clients = JSON.parse(readFileSync(join(dataDir, 'config', 'clients.json'), 'utf-8'));
        logger.debug("Loading clients: ", clients);
        const clientMap = new Map<string, number>();
        const clientModel = await ModelFactory.getInstance().getClientModel();
        for (const client of clients) {
            if (client.type === 'ttv') {
                clientMap.set(client.name, 1); // Hardcoded id for ttv client (inserted as first client in 001 migration)
            } else {
                logger.debug("Loading client: ", client.name);
                const createdClient = await clientModel.create({
                    name: client.name,
                    type: client.type,
                    scope: client.scope,
                    description: client.description,
                    token: client.token ?? null,
                    configPath: client.configPath ?? null,
                    enabled: true,
                    autoUpdate: false
                });
                clientMap.set(client.name, createdClient.clientId);
            }
        }

        // Load and process messages from /messages directory
        const messagesDir = join(dataDir, 'messages');
        
        // Get all of the files in the data directory and parse them into an array of objects
        const messagesFiles = readdirSync(messagesDir).map(file => JSON.parse(readFileSync(join(messagesDir, file), 'utf-8')));
        
        // Get random file object using weights from the weight field of the file object
        const getRandomFile = () => {
            const totalWeight = messagesFiles.reduce((sum, file) => sum + file.weight, 0);
            const random = Math.random() * totalWeight;
            let weightSum = 0;
            return messagesFiles.find(file => {
                weightSum += file.weight;
                return random < weightSum;
            }) || messagesFiles[messagesFiles.length - 1];
        }

        const sessionData = [
            {
                user: 'bob',
                clientId: clientMap.get('Cursor'),
                weight: 4
            },
            {
                user: 'bob',
                clientId: clientMap.get('Workbench'),
                weight: 1
            },
            {
                user: 'bob',
                clientId: clientMap.get('Claude Code'),
                weight: 2
            }
        ];
        
        // Get random session using weights from the weight field of the sessionData object
        const getRandomSession = () => {
            const totalWeight = sessionData.reduce((sum, session) => sum + session.weight, 0);
            const random = Math.random() * totalWeight;
            let weightSum = 0;
            return sessionData.find(session => {
                weightSum += session.weight;
                return random < weightSum;  
            }) || sessionData[sessionData.length - 1];
        }

        for (const file of messagesFiles) {
            logger.debug(`Got file ${file.file} with weight ${file.weight}`);
        }

        let totalFiles = 0;
        let totalMessageCount = 0;

        const daysOfData = 60;

        logger.info(`Loading ${daysOfData} days of data, ${messagesFiles.length} files, ${sessionData.length} sessions, ${serverNames.length} servers`);

        const now = new Date();
        // Start time = today - 60 days
        let processingDate = new Date(now.getTime() - daysOfData * 24 * 60 * 60 * 1000);
        while (processingDate < now) {
            const data = getRandomFile();
            logger.info(`Processing ${data.server} (${data.file}) at ${processingDate}`);
            totalFiles++;

            const selectedSession = getRandomSession();
            const server = serverMap.get(data.server);
            if (!server) {
                logger.error(`No server found for server ${data.server}`);
                continue;
            }
            const jwtPayload: ProxyJwtPayload = {
                user: selectedSession.user,
                clientId: selectedSession.clientId || null,
                sourceIp: '127.0.0.1',
                serverName: data.server,
                serverId: server.serverId,
                serverToken: server.token
            }
            const messageCount = await processMessages(jwtPayload, data.server, data.messages, processingDate);
            totalMessageCount += messageCount;
            logger.debug(`Loaded ${messageCount} messages from ${data.file}`);
            // Compute a time between 0 and 60 minutes, increment start time by that amount
            processingDate = new Date(processingDate.getTime() + Math.random() * 60 * 60 * 1000);
        }
        
        logger.info(`Loaded ${totalMessageCount} messages from ${totalFiles} file runs`);

        // Run ANALYZE to optimize query performance after bulk loading
        logger.debug('Running ANALYZE to optimize query performance...');
        await ModelFactory.getInstance().analyze();
        logger.debug('ANALYZE completed');

        process.exit(0);
    } catch (error) {
        logger.error('Error loading sample data:', error);
        process.exit(1);
    }
}

loadSampleData(); 