import { MessageActionModel } from '../messageAction';
import { DatabaseClient } from '../sqlite/database';
import { MessageActionData } from '../types/messageAction';

export class SqliteMessageActionModel extends MessageActionModel {
    private db: DatabaseClient;

    constructor(db: DatabaseClient) {
        super();
        this.db = db;
    }

    async findByMessageId(messageId: number): Promise<MessageActionData | null> {
        const result = await this.db.query<MessageActionData & { actions: string }>(
            'SELECT messageId, actions, timestamp, createdAt FROM message_actions WHERE messageId = ?',
            [messageId]
        );
        
        if (!result.rows[0]) {
            return null;
        }

        const row = result.rows[0];
        return {
            messageId: row.messageId,
            actions: row.actions ? JSON.parse(row.actions) : [],
            timestamp: row.timestamp,
            createdAt: row.createdAt
        };
    }

    async create(data: Omit<MessageActionData, 'createdAt'>): Promise<MessageActionData> {
        const actionsJson = JSON.stringify(data.actions);
        const result = await this.db.execute(
            'INSERT INTO message_actions (messageId, actions, timestamp) VALUES (?, ?, ?)',
            [data.messageId, actionsJson, data.timestamp]
        );

        return {
            ...data,
            createdAt: new Date().toISOString()
        };
    }
}
