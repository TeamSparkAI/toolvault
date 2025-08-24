# Server Pinning Validation

## Overview

Server pinning validation is a security mechanism that ensures MCP (Model Context Protocol) servers maintain consistent behavior by validating their responses against previously captured and stored responses. This prevents potential security risks from server updates or malicious modifications.

## Core Concept

When a server is "pinned" to a specific version, the system:

1. **Captures** the raw JSONRPC responses from `initialize` and `tools/list` commands
2. **Stores** these responses along with the package version information
3. **Validates** future responses against the stored responses during message processing
4. **Enforces** consistency by overriding responses that don't match the pinned data

## Architecture

### Data Model

```typescript
interface ServerPinningInfo {
  package: {
    registry: 'npm' | 'pypi';
    name: string;
    version: string;
  };
  mcpResponses: {
    initialize: object;  // Raw JSONRPC initialize response
    toolsList: object;   // Raw JSONRPC tools/list response
  };
  pinnedAt: string;     // ISO timestamp
  pinnedBy?: string;    // Optional: who/what pinned it
}
```

### Database Schema

```sql
ALTER TABLE servers ADD COLUMN pinningInfo JSON;
```

### Policy System Integration

The validation is implemented through the existing policy system using a new filter type:

```typescript
interface MessageFilter {
  type: 'message';
  filter: string; // Required filter implementation name
}

interface TextFilter {
  type: 'text';
  regex: string;
  keywords?: string[];
  filter?: string;
}
```

## Design Decisions

### 1. Global Policy Approach
- **Single policy** applies to ALL pinned servers
- **No server-specific policies** - simpler configuration and management
- **Automatic application** - any server with pinning data gets validated

### 2. Error Action (Simple and Clean)
- **Continue processing** - all policies run to completion
- **Error action** - new policy action type that takes code/message
- **Final check** - if any policy has Error action, return error instead of content

### 3. Self-Service Validator
- **Server ID only** - validator gets minimal context
- **Model access** - uses existing model layer for data access
- **Encapsulated** - validator handles all pinning logic internally

### 4. Filter Type Separation
- **Text filters** - operate on regex matches with optional keywords
- **Message filters** - operate on entire messages with required filter implementation
- **Type-based UI** - interface adapts based on filter type

## Implementation Plan

### Phase 1: Core Infrastructure ✅ COMPLETED

**Database & Model Layer**
- [x] Add `pinningInfo` column to servers table
- [x] Create `ServerPinningInfo` interface
- [x] Update `ServerModel` and `SqliteServerModel` to handle pinning data
- [x] Create database migration (002_add_server_pinning.sql)

**API Layer**
- [x] Update server API endpoints to handle pinning info
- [x] Add validation logic for pinning data consistency
- [x] Support clearing pinning data with explicit null

**MCP Client Enhancements**
- [x] Modify `McpClient` to capture raw JSONRPC responses
- [x] Implement transport layer interception for response capture
- [x] Add methods to retrieve captured responses
- [x] Update `SecurityValidationService` to return raw responses

### Phase 2: Pinning UI ✅ COMPLETED

**Server Pinning Tab**
- [x] Add pinning tab to server details page
- [x] Implement version selection and validation
- [x] Add pin/unpin functionality
- [x] Cache raw responses from validation for pinning
- [x] Display pinning status and information

### Phase 3: Policy System Integration

**Filter Infrastructure**
- [ ] Create filter type system (`text` vs `message`)
- [ ] Implement filter registry with implementations
- [ ] Add `MessageFilter` and `TextFilter` interfaces
- [ ] Update policy configuration schema

**Pinning Validator**
- [ ] Create `validate-pinning` filter implementation
- [ ] Implement server lookup and pinning data retrieval
- [ ] Add response comparison logic
- [ ] Handle validation errors and edge cases

**Policy Engine Updates**
- [ ] Support message-level validators in policy engine
- [ ] Implement error action type
- [ ] Add final error check after all policies complete
- [ ] Add server ID injection for validators
- [ ] Update policy processing pipeline

### Phase 4: Message Processing Integration

**Message Processor Updates**
- [ ] Integrate pinning validation into message processing
- [ ] Add server ID context to message processing
- [ ] Implement error action handling
- [ ] Handle validation failures gracefully

**Global Pinning Policy**
- [ ] Create default pinning validation policy
- [ ] Configure policy for `initialize` and `tools/list` methods
- [ ] Set up automatic policy application
- [ ] Add policy management UI

### Phase 5: Security and Alerting

**Security Alerts**
- [ ] Create alert types for pinning violations
- [ ] Implement alert generation for validation failures
- [ ] Add alert UI components
- [ ] Configure alert notifications

**Validation Workflow**
- [ ] Design security violation response workflow
- [ ] Implement validation failure reporting
- [ ] Add audit logging for pinning violations
- [ ] Create validation status dashboard

### Phase 6: Testing and Documentation

**Comprehensive Testing**
- [ ] Unit tests for all components
- [ ] Integration tests for pinning workflow
- [ ] End-to-end tests for validation scenarios
- [ ] Performance testing for validation overhead

**Documentation**
- [ ] Update API documentation
- [ ] Create user guide for pinning feature
- [ ] Document security considerations
- [ ] Add troubleshooting guide

### Phase 7: Migration and Cleanup

**Existing Server Migration**
- [ ] Assess existing servers for pinning eligibility
- [ ] Create migration scripts if needed
- [ ] Update existing server configurations
- [ ] Validate migration results

**Performance Optimization**
- [ ] Optimize database queries for pinning data
- [ ] Implement caching for frequently accessed pinning info
- [ ] Optimize validation performance
- [ ] Monitor and tune system performance

**Code Cleanup**
- [ ] Remove temporary debugging code
- [ ] Clean up unused imports and dependencies
- [ ] Refactor for code quality
- [ ] Update code comments and documentation

## Security Considerations

### 1. Response Tampering Detection
- Validates that server responses haven't been modified
- Prevents malicious server updates from going undetected
- Ensures consistent server behavior over time

### 2. Package Version Integrity
- Validates that server package version matches pinned version
- Prevents server configuration changes that could bypass pinning
- Maintains package version consistency

### 3. Validation Scope
- Only validates `initialize` and `tools/list` responses
- These are the most critical for server identity and capabilities
- Balances security with performance

### 4. Error Handling
- Graceful handling of validation failures
- Clear error messages for debugging
- Non-blocking validation to prevent system disruption

## Usage Examples

### Pinning a Server
1. Navigate to server details page
2. Go to "Pinning" tab
3. Select target version from dropdown
4. Click "Validate Version" to test server
5. Click "Pin to This Version" to lock server
6. Server is now pinned with stored responses

### Validation During Message Processing
1. Message arrives for pinned server
2. Policy system applies pinning validation filter
3. Validator retrieves stored pinning data
4. Compares current response with stored response
5. If mismatch detected, error action is triggered
6. After all policies complete, error is returned instead of content
7. Security alert is generated

### Policy Configuration
```json
{
  "name": "Server Pinning Validation",
  "enabled": true,
  "conditions": {
    "methods": ["initialize", "tools/list"],
    "direction": "server-to-client"
  },
  "filters": [
    {
      "id": "pinning-validation",
      "name": "Validate Pinning",
      "type": "message",
      "filter": "validate-pinning"
    }
  ],
  "actions": [
    {
      "type": "error",
      "code": 4001,
      "message": "Server response validation failed - possible security violation"
    }
  ]
}
```

## Future Enhancements

### 1. Extended Validation
- Validate additional MCP methods beyond `initialize` and `tools/list`
- Support for custom validation rules per server
- Validation of server metadata and capabilities

### 2. Advanced Pinning
- Support for pinning multiple versions per server
- Time-based pinning with automatic expiration
- Conditional pinning based on environment or context

### 3. Monitoring and Analytics
- Pinning validation statistics and metrics
- Historical validation failure analysis
- Performance impact monitoring

### 4. Integration Features
- Integration with package registries for version verification
- Support for automated pinning based on CI/CD pipelines
- Integration with security scanning tools
