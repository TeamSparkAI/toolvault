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

    async findByMessageId(messageId: number): Promise<MessageActionsData | null> {
        const result = await this.db.query<MessageActionData & { actionResults: string }>(
            'SELECT messageId, policyId, alertId, origin, severity, actionResults, timestamp, createdAt FROM message_actions WHERE messageId = ?',
            [messageId]
        );
        
        if (result.rows.length === 0) {
            return null;
        }

        const actions = result.rows.map(row => ({
            messageId: row.messageId,
            policyId: row.policyId,
            alertId: row.alertId,
            origin: row.origin as MessageOrigin,
            severity: row.severity,
            actionResults: row.actionResults ? JSON.parse(row.actionResults) : [],
            timestamp: row.timestamp,
            createdAt: row.createdAt
        }));

        return {
            messageId,
            actions
        };
    }

    async findByMessageIdAndOrigin(messageId: number, origin: MessageOrigin): Promise<MessageActionData[]> {
        const result = await this.db.query<MessageActionData & { actionResults: string }>(
            'SELECT messageId, policyId, alertId, origin, severity, actionResults, timestamp, createdAt FROM message_actions WHERE messageId = ? AND origin = ?',
            [messageId, origin]
        );
        
        return result.rows.map(row => ({
            messageId: row.messageId,
            policyId: row.policyId,
            alertId: row.alertId,
            origin: row.origin as MessageOrigin,
            severity: row.severity,
            actionResults: row.actionResults ? JSON.parse(row.actionResults) : [],
            timestamp: row.timestamp,
            createdAt: row.createdAt
        }));
    }

    async findByAlertId(alertId: number): Promise<MessageActionData[]> {
        const result = await this.db.query<MessageActionData & { actionResults: string }>(
            'SELECT messageId, policyId, alertId, origin, severity, actionResults, timestamp, createdAt FROM message_actions WHERE alertId = ?',
            [alertId]
        );
        
        return result.rows.map(row => ({
            messageId: row.messageId,
            policyId: row.policyId,
            alertId: row.alertId,
            origin: row.origin as MessageOrigin,
            severity: row.severity,
            actionResults: row.actionResults ? JSON.parse(row.actionResults) : [],
            timestamp: row.timestamp,
            createdAt: row.createdAt
        }));
    }

    async create(data: Omit<MessageActionData, 'createdAt'>): Promise<MessageActionData> {
        const actionResultsJson = JSON.stringify(data.actionResults);
        await this.db.execute(
            'INSERT INTO message_actions (messageId, policyId, alertId, origin, severity, actionResults, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [data.messageId, data.policyId, data.alertId ?? null, data.origin, data.severity, actionResultsJson, data.timestamp]
        );

        return {
            ...data,
            createdAt: new Date().toISOString()
        };
    }
}
