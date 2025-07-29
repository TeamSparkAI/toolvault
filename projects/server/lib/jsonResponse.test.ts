/**
 * @jest-environment node
 */
import { StatusCodes } from 'http-status-codes';
import { JsonResponse } from './jsonResponse';

describe('JsonResponse', () => {
  describe('errorResponse', () => {
    it('should create an error response with default message', async () => {
      const response = JsonResponse.errorResponse(StatusCodes.BAD_REQUEST);
      const data = await response.json();
      
      expect(data).toEqual({
        meta: {
          apiVersion: '1.0',
          status: StatusCodes.BAD_REQUEST,
          message: 'Bad Request'
        }
      });
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should create an error response with custom message', async () => {
      const response = JsonResponse.errorResponse(StatusCodes.BAD_REQUEST, 'Custom error message');
      const data = await response.json();
      
      expect(data).toEqual({
        meta: {
          apiVersion: '1.0',
          status: StatusCodes.BAD_REQUEST,
          message: 'Custom error message'
        }
      });
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('emptyResponse', () => {
    it('should create an empty response with default status', async () => {
      const response = JsonResponse.emptyResponse();
      const data = await response.json();
      
      expect(data).toEqual({
        meta: {
          apiVersion: '1.0',
          status: StatusCodes.OK,
          message: 'OK'
        }
      });
      expect(response.status).toBe(StatusCodes.OK);
    });

    it('should create an empty response with custom status and message', async () => {
      const response = JsonResponse.emptyResponse(StatusCodes.CREATED, 'Resource created');
      const data = await response.json();
      
      expect(data).toEqual({
        meta: {
          apiVersion: '1.0',
          status: StatusCodes.CREATED,
          message: 'Resource created'
        }
      });
      expect(response.status).toBe(StatusCodes.CREATED);
    });
  });

  describe('payloadResponse', () => {
    it('should create a response with a single payload', async () => {
      const payload = { id: 1, name: 'Test' };
      const response = JsonResponse.payloadResponse('data', payload);
      const data = await response.json();
      
      expect(data).toEqual({
        meta: {
          apiVersion: '1.0',
          status: StatusCodes.OK,
          message: 'OK'
        },
        data: payload
      });
      expect(response.status).toBe(StatusCodes.OK);
    });
  });

  describe('payloadsResponse', () => {
    it('should create a response with multiple payloads', async () => {
      const payloads = [
        { key: 'users', payload: [{ id: 1 }, { id: 2 }] },
        { key: 'count', payload: 2 }
      ];
      const response = JsonResponse.payloadsResponse(payloads);
      const data = await response.json();
      
      expect(data).toEqual({
        meta: {
          apiVersion: '1.0',
          status: StatusCodes.OK,
          message: 'OK'
        },
        users: [{ id: 1 }, { id: 2 }],
        count: 2
      });
      expect(response.status).toBe(StatusCodes.OK);
    });
  });
}); 