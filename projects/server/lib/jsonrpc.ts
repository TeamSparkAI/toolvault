import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';

export function jsonRpcError(message: string, code: number = -32000): JSONRPCMessage {
  return {
      jsonrpc: '2.0',
      id: 'error',
      error: { code, message }
  };
}

export type MessageOrigin = 'client' | 'server';

export class JsonRpcValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonRpcValidationError';
  }
}

export class JsonRpcMessageWrapper {
  private _origin: MessageOrigin;
  private message: JSONRPCMessage;

  constructor(origin: MessageOrigin, message: JSONRPCMessage) {
    this._origin = origin;
    this.message = message;
  }

  get origin(): MessageOrigin {
    return this._origin;
  }

  get messageId(): string | null {
    if ('id' in this.message && this.message.id !== undefined) {
      return this.message.id.toString();
    }
    return null;
  }

  get method(): string | null {
    if ('method' in this.message) {
      return this.message.method;
    }
    return null;
  }

  get params(): any | null {
    if ('params' in this.message && this.message.params) {
      return this.message.params;
    }
    return null;
  }

  get result(): any | null {
    if ('result' in this.message && this.message.result) {
      return this.message.result;
    }
    return null;
  }

  get errorCode(): number | null {
    if ('error' in this.message && this.message.error && typeof this.message.error === 'object') {
      return this.message.error.code;
    }
    return null;
  }

  get errorMessage(): string | null {
    if ('error' in this.message && this.message.error && typeof this.message.error === 'object') {
      return this.message.error.message;
    }
    return null;
  }

  withPayload(payloadType: 'params' | 'result', value: any): JsonRpcMessageWrapper {
    const newMessage = JSON.parse(JSON.stringify(this.message));
    newMessage[payloadType] = value;
    return new JsonRpcMessageWrapper(this._origin, newMessage);
  }

  toJSON(): JSONRPCMessage {
    return this.message;
  }
}

/**
 * Validates and returns a JSON-RPC 2.0 message or throws a detailed error
 * @throws {JsonRpcValidationError} If the message is invalid
 */
export function validateJsonRpcMessage(origin: MessageOrigin, message: unknown): JsonRpcMessageWrapper {
  if (!message || typeof message !== 'object') {
    throw new JsonRpcValidationError('Message must be a non-null object');
  }
  
  const msg = message as any;
  
  // Check for required jsonrpc version
  if (msg.jsonrpc !== '2.0') {
    throw new JsonRpcValidationError('Message must have jsonrpc version "2.0"');
  }
  
  // Check for id if present (can be string or number)
  if ('id' in msg) {
    if (typeof msg.id !== 'string' && typeof msg.id !== 'number') {
      throw new JsonRpcValidationError('Message id must be a string or number');
    }
  }
  
  // Check for method (required for requests)
  if ('method' in msg && typeof msg.method !== 'string') {
    throw new JsonRpcValidationError('Message method must be a string');
  }
  
  // Check for result (for responses)
  if ('result' in msg && typeof msg.result !== 'object') {
    throw new JsonRpcValidationError('Message result must be an object');
  }
  
  // Check for error (for error responses)
  if ('error' in msg) {
    if (!msg.error || typeof msg.error !== 'object') {
      throw new JsonRpcValidationError('Message error must be an object');
    }
    if (typeof msg.error.code !== 'number') {
      throw new JsonRpcValidationError('Message error code must be a number');
    }
    if (typeof msg.error.message !== 'string') {
      throw new JsonRpcValidationError('Message error message must be a string');
    }
  }
  
  return new JsonRpcMessageWrapper(origin, msg as JSONRPCMessage);
} 