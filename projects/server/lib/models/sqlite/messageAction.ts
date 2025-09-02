import { MessageActionModel } from '../messageAction';
import { DatabaseClient } from '../sqlite/database';
import { MessageActionData, MessageActionsData } from '../types/messageAction';
import { MessageOrigin } from '@/lib/jsonrpc';

export class SqliteMessageActionModel extends MessageActionModel {
    private db: DatabaseClient;

    constructor(db: DatabaseClient) {
        super();
        this.db = db;
    }

    async findById(messageActionId: number): Promise<MessageActionData | null> {
        const result = await this.db.queryOne<MessageActionData & { action: string; actionEvents: string }>(
            'SELECT messageActionId, messageId, policyId, origin, severity, action, actionEvents, timestamp, createdAt FROM message_actions WHERE messageActionId = ?',
            [messageActionId]
        );

        if (!result) {
            return null;
        }

        return {
            ...result,
            action: result.action ? JSON.parse(result.action) : null,
            actionEvents: result.actionEvents ? JSON.parse(result.actionEvents) : []
        };
    }

    async findByMessageId(messageId: number): Promise<MessageActionsData | null> {
        const result = await this.db.query<MessageActionData & { action: string; actionEvents: string }>(
            'SELECT messageActionId, messageId, policyId, origin, severity, action, actionEvents, timestamp, createdAt FROM message_actions WHERE messageId = ?',
            [messageId]
        );
        
        if (result.rows.length === 0) {
            return null;
        }

        const actions = result.rows.map(row => ({
            messageActionId: row.messageActionId,
            messageId: row.messageId,
            policyId: row.policyId,
            origin: row.origin as MessageOrigin,
            severity: row.severity,
            action: row.action ? JSON.parse(row.action) : null,
            actionEvents: row.actionEvents ? JSON.parse(row.actionEvents) : [],
            timestamp: row.timestamp,
            createdAt: row.createdAt
        }));

        return {
            messageId,
            actions
        };
    }

    async findByMessageIdAndOrigin(messageId: number, origin: MessageOrigin): Promise<MessageActionData[]> {
        const result = await this.db.query<MessageActionData & { action: string; actionEvents: string }>(
            'SELECT messageActionId, messageId, policyId, origin, severity, action, actionEvents, timestamp, createdAt FROM message_actions WHERE messageId = ? AND origin = ?',
            [messageId, origin]
        );
        
        return result.rows.map(row => ({
            messageActionId: row.messageActionId,
            messageId: row.messageId,
            policyId: row.policyId,
            origin: row.origin as MessageOrigin,
            severity: row.severity,
            action: row.action ? JSON.parse(row.action) : null,
            actionEvents: row.actionEvents ? JSON.parse(row.actionEvents) : [],
            timestamp: row.timestamp,
            createdAt: row.createdAt
        }));
    }

    async findByAlertId(alertId: number): Promise<MessageActionData[]> {
        const result = await this.db.query<MessageActionData & { action: string; actionEvents: string }>(
            'SELECT messageActionId, messageId, policyId, origin, severity, action, actionEvents, timestamp, createdAt FROM message_actions WHERE actionEvents LIKE ?',
            [`%${alertId}%`]
        );
        
        return result.rows.map(row => ({
            messageActionId: row.messageActionId,
            messageId: row.messageId,
            policyId: row.policyId,
            origin: row.origin as MessageOrigin,
            severity: row.severity,
            action: row.action ? JSON.parse(row.action) : null,
            actionEvents: row.actionEvents ? JSON.parse(row.actionEvents) : [],
            timestamp: row.timestamp,
            createdAt: row.createdAt
        }));
    }

    async create(data: Omit<MessageActionData, 'createdAt' | 'messageActionId'>): Promise<MessageActionData> {
        const actionJson = JSON.stringify(data.action);
        const actionEventsJson = JSON.stringify(data.actionEvents);
        const result = await this.db.execute(
            'INSERT INTO message_actions (messageId, policyId, origin, severity, action, actionEvents, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [data.messageId, data.policyId, data.origin, data.severity, actionJson, actionEventsJson, data.timestamp]
        );

        // Get the last inserted ID
        const messageActionId = result.lastID;
        if (typeof messageActionId !== 'number') {
            throw new Error('Failed to get last inserted ID');
        }

        // After creating, fetch the full record
        const createdRecord = await this.findById(messageActionId);
        if (!createdRecord) {
            throw new Error(`Failed to retrieve created message action with ID ${messageActionId}`);
        }
        return createdRecord;
    }
}