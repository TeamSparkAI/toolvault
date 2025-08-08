import { McpConfigFileService } from './mcpConfigFileService';
import * as fs from 'fs/promises';
import { McpServerConfig } from '../types/server';
import { logger } from '@/lib/logging/server';

// Mock the fs module
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('McpConfigFileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fs.stat to return file exists for most tests
    mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
  });

  describe('constructor', () => {
    it('should create service with default options', () => {
      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      expect(service).toBeDefined();
    });

    it('should create service with custom options', () => {
      const service = new McpConfigFileService({
        filePath: '/test/path/settings.json',
        mcpConfig: 'mcp',
        mcpServers: 'mcpServers'
      });

      expect(service).toBeDefined();
    });
  });

  describe('load', () => {
    it('should load standard JSON config', async () => {
      const mockContent = JSON.stringify({
        mcpServers: {
          'test-server': {
            type: 'stdio',
            command: 'tsh',
            args: ['server-name', 'token']
          }
        }
      });

      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      const result = await service.load();

      expect(mockFs.readFile).toHaveBeenCalledWith('/test/path/mcp.json', 'utf8');
      expect(result.mcpServers['test-server']).toBeDefined();
      expect(result.mcpServers['test-server'].type).toBe('stdio');
    });

    it('should load JSONC with comments', async () => {
      logger.debug("Load JSONC");
      const mockContent = [
      '{',
      '  // This is a comment',
      '  "mcpServers": {',
      '    "test-server": {',
      '      "type": "stdio",',
      '      "command": "tsh",',
      '      "args": ["server-name", "token"]',
      '    }',
      '  }',
      '}'
      ].join("\n");

      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      const result = await service.load();

      expect(result.mcpServers['test-server']).toBeDefined();
      expect(result.mcpServers['test-server'].type).toBe('stdio');
    });

    it('should load nested config (VS Code settings.json)', async () => {
      const mockContent = JSON.stringify({
        mcp: {
          mcpServers: {
            'test-server': {
              type: 'stdio',
              command: 'tsh',
              args: ['server-name', 'token']
            }
          }
        }
      });

      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/settings.json',
        mcpConfig: 'mcp',
        mcpServers: 'mcpServers'
      });

      const result = await service.load();

      expect(result.mcp.mcpServers['test-server']).toBeDefined();
    });

    it('should throw error for invalid JSON', async () => {
      const mockContent = '{ invalid json }';
      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await expect(service.load()).rejects.toThrow();
    });

    it('should throw error for missing file', async () => {
      mockFs.stat.mockRejectedValue(new Error('ENOENT'));

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await expect(service.load()).rejects.toThrow('Config file does not exist: /test/path/mcp.json');
    });
  });

  describe('getMcpServers', () => {
         it('should get mcpServers from direct config', async () => {
       const mockContent = JSON.stringify({
         mcpServers: {
           'test-server': { type: 'stdio', command: 'tsh', args: ['server-name'] }
         }
       });

      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();
      const mcpServers = service.getMcpServers();

      expect(mcpServers['test-server']).toBeDefined();
    });

         it('should get mcpServers from nested config', async () => {
       const mockContent = JSON.stringify({
         mcp: {
           mcpServers: {
             'test-server': { type: 'stdio', command: 'tsh', args: ['server-name'] }
           }
         }
       });

      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/settings.json',
        mcpConfig: 'mcp',
        mcpServers: 'mcpServers'
      });

      await service.load();
      const mcpServers = service.getMcpServers();

      expect(mcpServers['test-server']).toBeDefined();
    });

    it('should return undefined for missing mcpServers', async () => {
      const mockContent = JSON.stringify({ other: 'config' });
      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();
      const mcpServers = service.getMcpServers();

      expect(mcpServers).toBeUndefined();
    });
  });

  describe('addServer', () => {
    it('should add stdio server', async () => {
      const mockContent = [
        '{',
        '  // This is a comment',
        '  "mcpServers": { }',
        '}'
      ].join("\n");
      
      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();

      const serverConfig: McpServerConfig = {
        type: 'stdio',
        command: 'tsh',
        args: ['server-name', 'token']
      };

      service.addServer('test-server', serverConfig);

      expect(service.hasEdits()).toBe(true);

      await service.save();

      const savedContent = mockFs.writeFile.mock.calls[0][1] as string;

      const expectedContent = [
        '{',
        '  // This is a comment',
        '  "mcpServers": {',
        '    "test-server": {',
        '      "type": "stdio",',
        '      "command": "tsh",',
        '      "args": [',
        '        "server-name",',
        '        "token"',
        '      ]',
        '    }',
        '  }',
        '}'
      ].join("\n");

      expect(savedContent).toEqual(expectedContent);
    });

    it('should add SSE server', async () => {
      const mockContent = JSON.stringify({ mcpServers: {} });
      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();

      const serverConfig: McpServerConfig = {
        type: 'sse',
        url: 'http://localhost:3000'
      };

      service.addServer('test-server', serverConfig);

      expect(service.hasEdits()).toBe(true);
    });
  });

  describe('updateServer', () => {
    it('should update existing server', async () => {
      const mockContent = [
        '{',
        '  // These are my servers',
        '  "mcpServers": {',
        '    "test-server": {',
        '      /* This is my favorite server */',
        '      "type": "sse",',
        '      "url": "http://localhost:3000",',
        '      "foo": "bar",', // <-- extra property with illegal trailing comma for fun
        '    }',
        '  }',
        '}'
      ].join("\n");
      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();

      const serverConfig: McpServerConfig = {
        type: 'stdio',
        command: 'tsh',
        args: ['server-name', 'token']
      };

      service.updateServer('test-server', serverConfig);

      await service.save();

      const savedContent = mockFs.writeFile.mock.calls[0][1] as string;

      const expectedContent = [
        '{',
        '  // These are my servers',
        '  "mcpServers": {',
        '    "test-server": {',
        '      /* This is my favorite server */',
        '      "type": "stdio",',
        '      "foo": "bar",', // <-- extra property shows up here (properties removed above it, and new properties added below it)
        '      "command": "tsh",',
        '      "args": [',
        '        "server-name",',
        '        "token"',
        '      ],', // <-- illegal trailing comma shows up here (kind of makes sense that it was at the end of server attributes)
        '    }',
        '  }',
        '}'
      ].join("\n");

      expect(savedContent).toEqual(expectedContent);
    });
  });

  describe('removeServer', () => {
    it('should remove server', async () => {
      const mockContent = JSON.stringify({
        mcpServers: {
          'test-server': { type: 'stdio', command: 'tsh' }
        }
      });
      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();

      service.removeServer('test-server');

      expect(service.hasEdits()).toBe(true);
    });
  });

  describe('save', () => {
    it('should save config with edits', async () => {
      const mockContent = JSON.stringify({
        mcpServers: {
          'existing-server': { type: 'stdio', command: 'old' }
        }
      });
      mockFs.readFile.mockResolvedValue(mockContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();

      const serverConfig: McpServerConfig = {
        type: 'stdio',
        command: 'tsh',
        args: ['server-name', 'token']
      };

      service.addServer('new-server', serverConfig);
      await service.save();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/path/mcp.json',
        expect.stringContaining('"new-server"')
      );
    });

    it('should save nested config', async () => {
      const mockContent = JSON.stringify({
        mcp: {
          mcpServers: {
            'existing-server': { type: 'stdio', command: 'old' }
          }
        }
      });
      mockFs.readFile.mockResolvedValue(mockContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const service = new McpConfigFileService({
        filePath: '/test/path/settings.json',
        mcpConfig: 'mcp',
        mcpServers: 'mcpServers'
      });

      await service.load();

      const serverConfig: McpServerConfig = {
        type: 'stdio',
        command: 'tsh',
        args: ['server-name', 'token']
      };

      service.addServer('new-server', serverConfig);
      await service.save();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/path/settings.json',
        expect.stringContaining('"new-server"')
      );
    });

    it('should throw error on write failure', async () => {
      const mockContent = JSON.stringify({ mcpServers: {} });
      mockFs.readFile.mockResolvedValue(mockContent);
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();
      service.addServer('test-server', { type: 'stdio', command: 'tsh', args: ['server-name'] });

      await expect(service.save()).rejects.toThrow('Failed to save config file');
    });

    it('should not write if no edits', async () => {
      const mockContent = JSON.stringify({ mcpServers: {} });
      mockFs.readFile.mockResolvedValue(mockContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();
      await service.save();

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('edit management', () => {
    it('should track edits correctly', async () => {
      const mockContent = JSON.stringify({ mcpServers: {} });
      mockFs.readFile.mockResolvedValue(mockContent);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();

      expect(service.hasEdits()).toBe(false);

      service.addServer('test-server', { type: 'stdio', command: 'tsh', args: ['server-name'] });
      expect(service.hasEdits()).toBe(true);

      service.clearEdits();
      expect(service.hasEdits()).toBe(false);
    });

    it('should clear edits after save', async () => {
      const mockContent = JSON.stringify({ mcpServers: {} });
      mockFs.readFile.mockResolvedValue(mockContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();
      service.addServer('test-server', { type: 'stdio', command: 'tsh', args: ['server-name'] });
      expect(service.hasEdits()).toBe(true);

      await service.save();
      expect(service.hasEdits()).toBe(false);
    });
  });

  describe('config operations', () => {
    it('should handle stdio to SSE conversion', async () => {
      const mockContent = JSON.stringify({
        mcpServers: {
          'test-server': {
            type: 'stdio',
            command: 'tsh',
            args: ['server-name', 'token']
          }
        }
      });
      mockFs.readFile.mockResolvedValue(mockContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();

      const newConfig: McpServerConfig = {
        type: 'sse',
        url: 'http://localhost:3000'
      };

      service.updateServer('test-server', newConfig);
      await service.save();

      const savedContent = mockFs.writeFile.mock.calls[0][1] as string;
      const savedConfig = JSON.parse(savedContent);
      
      expect(savedConfig.mcpServers['test-server'].type).toBe('sse');
      expect(savedConfig.mcpServers['test-server'].url).toBe('http://localhost:3000');
      expect(savedConfig.mcpServers['test-server'].command).toBeUndefined();
    });

    it('should handle SSE to stdio conversion', async () => {
      const mockContent = JSON.stringify({
        mcpServers: {
          'test-server': {
            type: 'sse',
            url: 'http://localhost:3000'
          }
        }
      });
      mockFs.readFile.mockResolvedValue(mockContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();

      const newConfig: McpServerConfig = {
        type: 'stdio',
        command: 'tsh',
        args: ['server-name', 'token']
      };

      service.updateServer('test-server', newConfig);
      await service.save();

      const savedContent = mockFs.writeFile.mock.calls[0][1] as string;
      const savedConfig = JSON.parse(savedContent);
      
      expect(savedConfig.mcpServers['test-server'].type).toBe('stdio');
      expect(savedConfig.mcpServers['test-server'].command).toBe('tsh');
      expect(savedConfig.mcpServers['test-server'].url).toBeUndefined();
    });

    it('should handle stdio server with cwd field', async () => {
      const mockContent = JSON.stringify({
        mcpServers: {
          'test-server': {
            type: 'stdio',
            command: 'tsh',
            args: ['server-name', 'token'],
            cwd: '/home/user/project'
          }
        }
      });
      mockFs.readFile.mockResolvedValue(mockContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      const service = new McpConfigFileService({
        filePath: '/test/path/mcp.json'
      });

      await service.load();

      const newConfig: McpServerConfig = {
        type: 'stdio',
        command: 'tsh',
        args: ['server-name', 'token'],
        cwd: '/new/path'
      };

      service.updateServer('test-server', newConfig);
      await service.save();

      const savedContent = mockFs.writeFile.mock.calls[0][1] as string;
      const savedConfig = JSON.parse(savedContent);
      
      expect(savedConfig.mcpServers['test-server'].type).toBe('stdio');
      expect(savedConfig.mcpServers['test-server'].command).toBe('tsh');
      expect(savedConfig.mcpServers['test-server'].cwd).toBe('/new/path');
    });
  });
}); 