import { MessageActionData, MessageActionsData } from './types/messageAction';
import { MessageOrigin } from '@/lib/jsonrpc';

export abstract class MessageActionModel {
    abstract findByMessageId(messageId: number): Promise<MessageActionsData | null>;
    abstract findByMessageIdAndOrigin(messageId: number, origin: MessageOrigin): Promise<MessageActionData[]>;
    abstract findByAlertId(alertId: number): Promise<MessageActionData[]>;
    abstract create(data: Omit<MessageActionData, 'createdAt'>): Promise<MessageActionData>;
}
