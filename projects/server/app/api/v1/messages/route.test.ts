/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { StatusCodes } from 'http-status-codes';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { SqliteMessageModel } from '@/lib/models/sqlite/message';

// Mock the model factory
jest.mock('@/lib/models', () => ({
  ModelFactory: {
    getInstance: jest.fn().mockReturnValue({
      getMessageModel: jest.fn()
    })
  }
}));

describe('Messages API', () => {
  let mockMessageModel: jest.Mocked<SqliteMessageModel>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMessageModel = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      timeSeries: jest.fn(),
      aggregate: jest.fn()
    } as any;
    (ModelFactory.getInstance().getMessageModel as jest.Mock).mockResolvedValue(mockMessageModel);
  });

  it('should return messages with default pagination', async () => {
    // Mock model responses
    mockMessageModel.list.mockResolvedValue({
      messages: [{
        id: 1,
        timestamp: '2024-02-20T12:00:00Z',
        userId: 'user1',
        clientId: 'client1',
        sourceIP: '127.0.0.1',
        serverName: 'test-server',
        sessionId: 'session1',
        messageId: 'msg1',
        method: 'test.method',
        params: '{"param1": "value1"}',
        result: '{"result1": "value1"}',
        error: null,
        requestAction: 'request',
        rawParams: '{"raw1": "value1"}',
        responseAction: 'response',
        rawResult: '{"rawResult1": "value1"}',
        created_at: '2024-02-20T12:00:00Z',
        updated_at: '2024-02-20T12:00:00Z'
      }],
      pagination: {
        total: 50,
        remaining: 0,
        hasMore: false,
        nextCursor: null,
        limit: 20,
        sort: 'desc'
      }
    });

    const request = new NextRequest('http://localhost:3000/api/v1/messages');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(StatusCodes.OK);
    expect(data.messages).toHaveLength(1);
    expect(data.pagination).toEqual({
      total: 50,
      remaining: 0,
      hasMore: false,
      nextCursor: null,
      limit: 20,
      sort: 'desc'
    });
  });

  it('should handle server name filter', async () => {
    mockMessageModel.list.mockResolvedValue({
      messages: [],
      pagination: {
        total: 10,
        remaining: 0,
        hasMore: false,
        nextCursor: null,
        limit: 20,
        sort: 'desc'
      }
    });

    const request = new NextRequest('http://localhost:3000/api/v1/messages?serverName=test-server');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(StatusCodes.OK);
    expect(mockMessageModel.list).toHaveBeenCalledWith(
      { serverName: 'test-server' },
      expect.any(Object)
    );
  });

  it('should handle database errors gracefully', async () => {
    const dbError = new Error('Database error');
    mockMessageModel.list.mockRejectedValue(dbError);

    const request = new NextRequest('http://localhost:3000/api/v1/messages');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(data.meta.message).toBe('Internal server error');
  });
}); 