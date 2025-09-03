import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';

export class JsonResponse {
    static errorResponse(status: number, message?: string) {
        return NextResponse.json({
            meta: {
                apiVersion: '1.0',
                status: status,
                message: message ?? getReasonPhrase(status)
            },
        }, { status: status });
    }

    static emptyResponse(status?: number, message?: string) {
        const responseStatus = status ?? StatusCodes.OK;
        return NextResponse.json({
            meta: {
                apiVersion: '1.0',
                status: responseStatus,
                message: message ?? getReasonPhrase(responseStatus)
            },
        }, { status: responseStatus });
    }

    static payloadResponse<T>(payloadKey: string, payload: T, status?: number, message?: string) {
        return NextResponse.json({
            meta: {
                apiVersion: '1.0',
                status: status ?? StatusCodes.OK,
                message: message ?? getReasonPhrase(status ?? StatusCodes.OK)
            },
            [payloadKey]: payload
        }, { status: status ?? StatusCodes.OK });
    }

    static payloadsResponse(payloads: { key: string, payload: any }[], status?: number, message?: string) {
        return NextResponse.json({
            meta: {
                apiVersion: '1.0',
                status: status ?? StatusCodes.OK,
                message: message ?? getReasonPhrase(status ?? StatusCodes.OK)
            },
            ...Object.fromEntries(payloads.map(p => [p.key, p.payload]))
        }, { status: status ?? StatusCodes.OK });
    }
}

/**
 * Client-side class for handling JSON API responses from fetch calls.
 * Provides type-safe access to response payload and meta information.
 */
export class JsonResponseFetch<T> {
    private _meta: {
        status: number;
        message?: string;
    };
    private _payload?: T;

    constructor(jsonResponse: any, payloadKey: string) {
        if (!jsonResponse.meta) {
            throw new Error('Invalid response format: missing meta field');
        }
        this._meta = jsonResponse.meta;
        this._payload = jsonResponse[payloadKey];
        if (this._payload === undefined) {
            throw new Error(`Invalid response format: missing ${payloadKey} field, full response: ${JSON.stringify(jsonResponse)}`);
        }
    }

    /**
     * Get the HTTP status code of the response
     */
    get status(): number {
        return this._meta.status;
    }

    /**
     * Get the response message if any
     */
    get message(): string | undefined {
        return this._meta.message;
    }

    /**
     * Get the typed payload of the response.
     * Throws if status is not 200 or if no payload is available.
     */
    get payload(): T {
        if (this.status !== 200) {
            throw new Error(`Cannot access payload on non-200 response: ${this.status}`);
        }
        if (this._payload === undefined) {
            throw new Error('No payload available');
        }
        return this._payload;
    }

    /**
     * Check if the response was successful (status 200)
     */
    isSuccess(): boolean {
        return this.status === 200;
    }
}