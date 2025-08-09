# MCP Config File Backup System

## Overview

When converting servers from unmanaged to managed, ToolVault automatically creates backup files of the original MCP configuration files to ensure no data is lost during the conversion process.

## Backup File Naming Convention

- **Pattern**: `{originalFilename}.tbk`
- **Examples**: 
  - `mcp.json` → `mcp.json.tbk`
  - `settings.json` → `settings.json.tbk`
- **Location**: Same directory as original file
- **Never overwrite**: If `.tbk` file already exists, skip backup creation

## Backup Tracking Structure

```typescript
interface ConfigBackup {
  originalFile: string;      // Full path to original file
  backupFile: string;        // Full path to backup file  
  timestamp: string;         // ISO timestamp of backup creation
  clientId: number;          // ID of the client that triggered backup
  clientType: string;        // Type of client (vscode, cursor, etc.)
  clientName: string;        // Name of the client
  operation: 'convert';      // Operation that triggered backup
  reverted?: boolean;        // Whether this backup has been reverted
  revertedAt?: string;       // Timestamp when backup was reverted
}
```

## Backup Storage

- **File**: `{appDataPath}/backups.json`
- **Structure**: Array of `ConfigBackup` objects
- **Persistence**: Append new backups, never overwrite existing entries
- **Location**: Uses existing `getAppDataPath()` utility

## Default Behavior

**Backup operations are enabled by default** for all convert operations. No user intervention is required to enable backups.

## Integration Points

### A. McpConfigFileService Enhancements

- Add `createBackup()` method that:
  - Checks if `.tbk` file exists
  - If not, copies original file to `.tbk`
  - Validates backup file size matches original
  - Returns backup metadata
- Add `backupEnabled` parameter to constructor (defaults to `true`)
- Modify `save()` method to trigger backup before writing changes

### B. SyncOptions Enhancement

- Add `createBackups?: boolean` flag to `SyncOptions` interface
- Default to `true` for backward compatibility
- Pass through to `McpConfigFileService` constructor

### C. ClientSyncService Integration

- Modify `syncClient()` to pass backup flag to config service
- Collect backup results in `SyncResponse`
- Add `backupResults?: ConfigBackup[]` to response (for internal use only)

### D. API Response Enhancement

- Update `SyncResponse` interface to include backup results
- Update OpenAPI documentation
- Backup information is collected but not exposed to UX

## Implementation Steps

1. **Create backup service** (`ConfigBackupService`)
   - Handle backup file creation
   - Manage `backups.json` file
   - Provide backup listing/cleanup utilities
   - Validate backup file integrity

2. **Enhance McpConfigFileService**
   - Add backup creation logic
   - Integrate with backup service
   - Add backup flag parameter (defaults to true)
   - Validate backup file size after creation

3. **Update SyncOptions and SyncResponse**
   - Add backup-related fields
   - Update TypeScript interfaces

4. **Modify clientSyncService**
   - Pass backup flag through to config service
   - Collect and return backup results (internal use)

5. **Update API endpoints**
   - Accept backup flag in requests
   - Return backup information in responses (internal)

6. **Add CLI commands**
   - `--inspect`: List all backups with details
   - `--revert`: Revert specific backup (only if both files exist)

## Error Handling

- **File system errors**: Log and continue without backup
- **Permission errors**: Skip backup, log warning
- **Disk space issues**: Check available space before backup
- **Backup validation failures**: Log error, continue with operation
- **Revert failures**: Only revert if both original and backup exist

## Backup Validation

After creating a backup file, the system validates:
- Backup file exists
- Backup file is not empty (size > 0)
- If validation fails, log error but continue with operation

## CLI Commands

### Command Priority
When multiple commands are specified, the following priority applies:
- `--clean` takes precedence over `--revert` (includes revert functionality)
- `--inspect` and `--revert` are mutually exclusive

### --inspect Command

Lists all backups with details:

```bash
toolvault --inspect
```

**Output format:**
```
Backup Files:
  Original: /path/to/mcp.json
  Backup:   /path/to/mcp.json.tbk
  Created:  2024-01-15T10:30:00Z
  Client:   VS Code (vscode)
  Status:   Active

  Original: /path/to/settings.json  
  Backup:   /path/to/settings.json.tbk (removed)
  Created:  2024-01-15T11:45:00Z
  Client:   Cursor (cursor)
  Status:   Reverted (2024-01-16T09:15:00Z)
```

### --revert Command

Reverts all active backups:

```bash
toolvault --revert
```

**Behavior:**
- Reverts all non-reverted backups in `backups.json`
- Only reverts if both original file and backup file exist
- Validates backup file is not empty before reverting
- Marks backup as reverted in `backups.json`
- Removes the `.tbk` backup file after successful revert

**Safety checks:**
- Verify original file still exists
- Verify backup file exists
- Verify backup file is not empty
- Only proceed with revert if all checks pass

## Backup Management

### Backup File Lifecycle

1. **Creation**: During convert operation
   - Check if `.tbk` file exists
   - If not, copy original to `.tbk`
   - Validate backup integrity
   - Record in `backups.json`

2. **Revert**: Via `--revert` command
   - Validate both files exist
   - Validate backup file is not empty
   - Restore from backup
   - Mark as reverted in `backups.json`
   - Remove the `.tbk` backup file

3. **Cleanup**: Manual or automated
   - Remove old backup files
   - Clean up `backups.json` entries
   - Archive old backups

### Backup Retention

- **Default**: Keep all backups indefinitely
- **Manual cleanup**: User can delete backup files and entries
- **Future enhancement**: Configurable retention policy

## Configuration Options

- **Global setting**: Enable/disable backups system-wide (default: enabled)
- **Per-operation**: Enable backups for specific operations (default: enabled)
- **Backup location**: Configurable backup directory (default: same as original)

## Usage Examples

### API Usage

```json
POST /api/v1/clients/123/sync
{
  "convert": true,
  "update": true,
  "createBackups": true,  // Default: true
  "serverIds": [1, 2, 3]
}
```

**Response includes:**
```json
{
  "sync": {
    "clientId": 123,
    "syncOptions": { ... },
    "convertResults": [ ... ],
    "updateResults": { ... },
    "backupResults": [  // Internal use only
      {
        "originalFile": "/path/to/mcp.json",
        "backupFile": "/path/to/mcp.json.tbk",
        "timestamp": "2024-01-15T10:30:00Z",
        "clientId": 123,
        "clientType": "vscode",
        "clientName": "VS Code",
        "operation": "convert",
        "reverted": false
      }
    ]
  }
}
```

### CLI Usage

```bash
# List all backups
toolvault --inspect

# Revert all active backups
toolvault --revert

# Remove all app data (includes revert)
toolvault --clean

# Convert with backups (default behavior)
toolvault convert --client 123

# Convert without backups (explicit disable)
toolvault convert --client 123 --no-backups
```

## Benefits

1. **Safety**: Never lose original configurations
2. **Audit trail**: Complete history of all modifications
3. **Recovery**: Easy restoration of original files
4. **Transparency**: Clear visibility into what was backed up
5. **Flexibility**: Optional feature that doesn't break existing workflows
6. **Validation**: Ensures backup integrity
7. **CLI tools**: Easy inspection and reversion

## Implementation Notes

- Backups are created automatically during convert operations
- No UX reporting of backup operations (internal only)
- Backup validation ensures data integrity
- CLI commands provide easy management
- Revert operations are safe and validated
- All operations are logged for audit purposes
