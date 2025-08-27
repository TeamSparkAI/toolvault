import { MessageActionData } from './types/messageAction';

export abstract class MessageActionModel {
    abstract findByMessageId(messageId: number): Promise<MessageActionData | null>;
    abstract create(data: Omit<MessageActionData, 'createdAt'>): Promise<MessageActionData>;
}
