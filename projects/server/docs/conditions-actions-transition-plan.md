# Detailed Plan: Complete Transition to Conditions/Actions (Revised)

## Current State Assessment:
- ✅ **Phase 1 Complete**: PolicyEngine uses new `conditions`/`actions` model
- ✅ **Phase 2A Complete**: Alert model has new `condition`/`findings` fields  
- ✅ **Phase 2B Complete**: ActionEvent stores full `PolicyAction` object
- ✅ **Message Modification Logic**: Centralized in `messageModifications.ts` with `applyModificationsToPayload`
- ✅ **MessageActions API**: Available at `/api/v1/messageActions/[messageId]`
- ✅ **Message Processing**: Modifications applied during message processing and returned
- ❌ **Message Details UX**: Still uses old data structures in existing functions

## Implementation Plan:

### Phase 3: Update Message Details UX (Reimplement Existing Functions)

#### 3.1 Update Message Details Page Core Logic ✅ COMPLETE
- **File**: `projects/server/app/messages/[messageId]/page.tsx`
- **Changes**:
  - **Add MessageActions state**: `const [messageActions, setMessageActions] = useState<MessageActionsData | null>(null);` ✅
  - **Update fetchData()**: Add MessageActions fetch alongside existing message/alerts fetches ✅
  - **Add imports**: 
    ```typescript
    import { applyModificationsToPayload } from '@/lib/policy-engine/utils/messageModifications';
    import { JsonRpcMessageWrapper } from '@/lib/jsonrpc';
    import { MessageActionData } from '@/lib/models/types/messageAction';
    ``` ✅

#### 3.2 Reimplement Message Modification Functions ❌ INCOMPLETE
- **File**: `projects/server/app/messages/[messageId]/page.tsx`
- **Approach**: Keep existing function signatures, update internals to use new data structures
- **Changes**:
  - **Reimplement `getHighlightedRedactedPayload()` internals**:
    - Use `getModifiedMessage()` to get modified payload
    - Use `alert.findings` instead of `alert.matches` for highlighting
    - Keep same function signature and return behavior
  - **Reimplement `highlightMatchedText()` internals**:
    - Use `alert.findings` instead of `alert.matches`
    - Update highlighting logic to work with new findings structure
    - Keep same function signature and return behavior
  - **Remove dependency on `applyMatchesFromAlerts()`**: Use new action-based system internally

#### 3.3 Update Alert Display Components ❌ INCOMPLETE
- **File**: `projects/server/app/components/alerts/AlertList.tsx`
- **Changes**:
  - **Replace old field references**: `filterName` → `condition.name`, `matches` → `findings`
  - **Update alert card display**:
    - Replace `alert.filterName` with `alert.condition?.name || 'Unknown Condition'`
    - Replace `alert.matches` display with `alert.findings` display
    - Update any alert detail components that show individual alert data
- **Update alert highlighting logic** to work with new data structure

#### 3.4 Update Message Details Page Alert Display ❌ INCOMPLETE
- **File**: `projects/server/app/messages/[messageId]/page.tsx`
- **Changes**:
  - **Replace old field references**: `filterName` → `condition.name`, `matches` → `findings`
  - **Update alert table display**:
    - Replace `alert.filterName` with `alert.condition?.name`
    - Replace `alert.matches` references with `alert.findings`
  - **Update alert highlighting logic** to work with new data structure

### Phase 4: Alert Filtering and Analytics Update

#### 4.1 Database Schema Optimization (SQLite 3.44.2) ❌ INCOMPLETE
- **Add generated column** `conditionName TEXT GENERATED ALWAYS AS (json_extract(condition, '$.name')) VIRTUAL` to `alerts` table
- **Create index** `idx_alerts_condition_name ON alerts(conditionName)`
- **Purpose**: Enable efficient filtering and analytics on condition names

#### 4.2 Update Alert Filtering System ❌ INCOMPLETE
- **Update Analytics Dimensions API** (`projects/server/app/api/v1/analytics/dimensions/route.ts`) to use `conditionName` instead of `filterName`
- **Update Alert Analytics APIs** (`projects/server/app/api/v1/analytics/alerts/aggregate/route.ts`, `projects/server/app/api/v1/analytics/alerts/timeSeries/route.ts`) to use `conditionName` in filtering
- **Update Alert Model** (`projects/server/lib/models/sqlite/alert.ts`) to use `conditionName` for dimension values, aggregation, and time series
- **Update Alert API** (`projects/server/app/api/v1/alerts/route.ts`) to use `conditionName` for filtering, while maintaining backward compatibility

#### 4.3 Update Alert Filter Components ❌ INCOMPLETE
- **Update `AlertFilters.tsx`**, `AlertsSection.tsx`, and `projects/server/app/alerts/page.tsx` to use `conditionName` instead of `filterName` for API calls, URL parameters, and dimension fetching
- **Maintain backward compatibility** during transition

#### 4.4 Update Alert Data Models and Types ❌ INCOMPLETE
- **Update `AlertData` interface** (`projects/server/lib/models/types/alert.ts`) to add `conditionName?: string` and deprecation comments for old fields
- **Update `AlertFilter` interface** to include `conditionName`
- **Update database queries** to handle both old and new field structures

### Phase 5: Remove Old Code and Cleanup

#### 5.1 Remove Old Functions from messageModifications.ts ❌ INCOMPLETE
- **File**: `projects/server/lib/policy-engine/utils/messageModifications.ts`
- **Remove**:
  - `applyMatchesFromAlerts()` function
  - `MatchResult` interface
  - `AppliedMatch` interface
  - Any other old compatibility functions

#### 5.2 Remove Old Alert Fields ❌ INCOMPLETE
- **Database Migration**: Create migration to remove old columns
  - Remove `filterName` column from alerts table
  - Remove `matches` column from alerts table
- **Models**: Update `AlertData` interface
  - Remove `filterName?: string`
  - Remove `matches?: FieldMatch[]`
- **API**: Update alert responses to exclude old fields

#### 5.3 Remove Old Policy Fields ❌ INCOMPLETE
- **Database Migration**: Create migration to remove old columns
  - Remove `filters` column from policies table
  - Remove `action` column from policies table
- **Models**: Update `PolicyData` interface
  - Remove `filters?: PolicyFilter[]`
  - Remove `action?: PolicyAction`
- **API**: Update policy responses to exclude old fields

#### 5.4 Update Imports and References ❌ INCOMPLETE
- **Remove old imports**: Any files still importing removed functions
- **Update type references**: Any files still referencing removed interfaces
- **Clean up unused code**: Remove any other references to old field names

### Phase 6: Testing and Validation

#### 6.1 Message Processing Validation ❌ INCOMPLETE
- Verify that new conditions/actions work correctly in PolicyEngine
- Verify that alerts are created with new `condition`/`findings` fields
- Verify that message actions are stored correctly with full `PolicyAction` objects
- Verify that `applyModificationsToPayload` works correctly

#### 6.2 Message Display Validation ❌ INCOMPLETE
- Verify that modified messages display correctly in message details page
- Verify that highlighting works for both content modifications and message replacements
- Verify that alert filtering and analytics work with new `conditionName` field
- Verify that all edge cases work correctly (no alerts, alerts but no actions, etc.)

## Key Architectural Changes Made:

### Policy/Alert/Action Relationship (Corrected)
- **Conditions** → Generate **Alerts** with **Findings**
- **Actions** → Generate **ActionEvents** (some correlated to specific findings via `conditionInstanceId`)
- **MessageActions** → Store action results with optional `alertId` correlation
- **Message Processing** → Applies modifications and returns modified messages

### Finding Structure (Updated)
- Uses `location` instead of `match` for text position data
- `location?: { fieldPath: string; start: number; end: number; }`

### ActionEvent Correlation
- `alertId` is optional in message actions
- Only text-related actions (rewrites, redactions) correlate to specific alerts
- Correlation happens via `conditionInstanceId` in field modifications

### Message Processing Flow
- PolicyEngine processes conditions and actions
- MessageFilter applies modifications during processing
- UI displays both original and modified messages with highlighting
