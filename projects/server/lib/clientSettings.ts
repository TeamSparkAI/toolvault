import { JsonResponseFetch } from '@/lib/jsonResponse';
import type { ClientSettings } from '@/app/api/v1/clientSettings/route';

class ClientSettingsManager {
  private initialized = false;
  private settings: ClientSettings = {
    logLevel: 'info' // Default fallback
  };
  private initializationPromise: Promise<void> | null = null;

  /**
   * Get the current log level, ensuring settings are loaded first
   */
  async getLogLevel(): Promise<string> {
    await this.ensureInitialized();
    return this.settings.logLevel;
  }

  /**
   * Get all settings (useful for debugging or future features)
   */
  async getAllSettings(): Promise<ClientSettings> {
    await this.ensureInitialized();
    return { ...this.settings };
  }

  /**
   * Ensure settings are loaded from server (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Prevent multiple simultaneous initialization calls
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.loadFromServer();
    await this.initializationPromise;
  }

  /**
   * Load settings from the server API
   */
  private async loadFromServer(): Promise<void> {
    try {
      // Only attempt fetch in browser environment
      if (typeof window === 'undefined') {
        // Server-side: use default settings
        // !!! This code should never be called from server-side, but because the MCP client is called from both sides, and uses console
        //     logging, this can happen.  The proper fix is to separate the MCP client support into client-only and server-only code.
        this.settings = {
          logLevel: 'info' // !!! HACK / BAD (see above)
        };
        return;
      }

      const response = await fetch('/api/v1/clientSettings');
      if (response.ok) {
        const jsonResponse = await response.json();
        const typedResponse = new JsonResponseFetch<ClientSettings>(jsonResponse, 'data');
        const settings = typedResponse.payload;
        
        this.settings = {
          logLevel: settings.logLevel || 'debug',
          // Future settings can be mapped here
        };
      }
    } catch (error) {
      // Keep default settings on error
      console.warn('Failed to load client settings from server:', error);
    } finally {
      this.initialized = true;
    }
  }

  /**
   * Reset the settings (useful for testing or manual refresh)
   */
  reset(): void {
    this.initialized = false;
    this.initializationPromise = null;
    this.settings = {
      logLevel: 'info'
    };
  }
}

// Export singleton instance
export const clientSettings = new ClientSettingsManager(); 