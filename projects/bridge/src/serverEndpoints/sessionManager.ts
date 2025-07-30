import { Session } from "./session";

export interface SessionManager {
    getSession(sessionId: string): Session | undefined;
}

export class SessionManagerImpl implements SessionManager {
    private sessions: Map<string, Session> = new Map();

    getSessions(): Session[] {
        return Array.from(this.sessions.values());
    }

    getSession(sessionId: string): Session | undefined {
        return this.sessions.get(sessionId);
    }

    addSession(session: Session): void {
        this.sessions.set(session.id, session);
    }

    removeSession(sessionId: string): void {
        this.sessions.delete(sessionId);
    }
}