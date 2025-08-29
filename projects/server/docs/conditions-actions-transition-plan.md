# Detailed Plan: Complete Transition to Conditions/Actions (Revised)

## Current State Assessment:
- ✅ **Phase 1 Complete**: PolicyEngine uses new `conditions`/`actions` model
- ✅ **Phase 2A Complete**: Alert model has new `condition`/`findings` fields  
- ✅ **Phase 2B Complete**: ActionEvent stores full `PolicyAction` object
- ✅ **Message Modification Logic**: Centralized in `messageModifications.ts` with `applyModificationsFromActions`
- ✅ **MessageActions API**: Available at `/api/v1/messageActions/[messageId]`
- ❌ **Message Details UX**: Still uses old `applyMatchesFromAlerts` logic

## Implementation Plan:

### Phase 3: Update Message Details UX (Atomic - All Changes Together)

#### 3.1 Update Message Details Page Core Logic
- **File**: `projects/server/app/messages/[messageId]/page.tsx`
- **Changes**:
  - **Add MessageActions state**: `const [messageActions, setMessageActions] = useState<MessageActionData | null>(null);`
  - **Update fetchData()**: Add MessageActions fetch alongside existing message/alerts fetches
  - **Add imports**: 
    ```typescript
    import { applyModificationsFromActions } from '@/lib/policy-engine/utils/messageModifications';
    import { JsonRpcMessageWrapper } from '@/lib/jsonrpc';
    import { MessageActionData } from '@/lib/models/types/messageAction';
    ```

#### 3.2 Replace Message Modification Functions
- **Remove old functions**:
  - `getHighlightedRedactedPayload()` - uses `applyMatchesFromAlerts`
  - `highlightMatchedText()` - uses `applyMatchesFromAlerts`
- **Create new function**: `getModifiedMessage()` that:
  - Constructs `JsonRpcMessageWrapper` from `message` data
  - Calls `applyModificationsFromActions(originalMessage, messageActions.actions)`
  - Returns `{ modifiedMessage, appliedMessageReplacement }`
- **Update message display logic** to use new function

#### 3.3 Update Alert Display Components
- **File**: `projects/server/app/components/alerts/AlertList.tsx`
- **Changes**:
  - **Remove old field references**: `filterName`, `matches`
  - **Add new field references**: `condition.name`, `findings`
  - **Update alert card display**:
    - Replace `alert.filterName` with `alert.condition.name`
    - Replace `alert.matches` display with `alert.findings` display
    - Update any alert detail components that show individual alert data
- **Update alert highlighting logic** to work with new data structure

#### 3.4 Implement New Message Highlighting Logic
- **Create new highlighting function**: `highlightMessageModifications()`
- **Logic for different scenarios**:
  - **Message Replacement**: If `appliedMessageReplacement` exists, highlight the replacement action
  - **Content Modifications**: If no replacement but content modifications, highlight modified fields
  - **No Modifications**: Show original message without highlighting
- **Use findings from alerts** to show original match positions
- **Use appliedMatches from applyModificationsFromActions** for final positions

#### 3.5 Update Message Display Rendering
- **Replace old message display logic**:
  - Remove calls to `applyMatchesFromAlerts()`
  - Remove old field match highlighting
  - Remove old redaction highlighting
- **Implement new display logic**:
  - Show original message vs modified message when modifications exist
  - Highlight modifications based on `appliedMessageReplacement` type
  - Show correlation between findings (from alerts) and applied actions (from messageActions)
  - Handle edge cases: no alerts, alerts but no actions, etc.

#### 3.6 Update Alert Detail Components
- **Files**: Any components that display individual alert details
- **Changes**:
  - Update to use `condition` object instead of `filterName`
  - Update to use `findings` array instead of `matches`
  - Update highlighting logic to use new data structure
  - Ensure all alert-related components work with new field names

### Phase 4: Remove Old Code and Cleanup

#### 4.1 Remove Old Functions from messageModifications.ts
- **File**: `projects/server/lib/policy-engine/utils/messageModifications.ts`
- **Remove**:
  - `applyMatchesFromAlerts()` function
  - `MatchResult` interface
  - `AppliedMatch` interface
  - Any other old compatibility functions

#### 4.2 Remove Old Alert Fields
- **Database Migration**: Create migration to remove old columns
  - Remove `filterName` column from alerts table
  - Remove `matches` column from alerts table
- **Models**: Update `AlertData` interface
  - Remove `filterName?: string`
  - Remove `matches?: FieldMatch[]`
- **API**: Update alert responses to exclude old fields

#### 4.3 Remove Old Policy Fields
- **Database Migration**: Create migration to remove old columns
  - Remove `filters` column from policies table
  - Remove `action` column from policies table
- **Models**: Update `PolicyData` interface
  - Remove `filters?: PolicyFilter[]`
  - Remove `action?: PolicyAction`
- **API**: Update policy responses to exclude old fields

#### 4.4 Update Imports and References
- **Remove old imports**: Any files still importing removed functions
- **Update type references**: Any files still referencing removed interfaces
- **Clean up unused code**: Remove any other references to old field names

### Phase 5: Testing and Validation

#### 5.1 Message Processing Validation
- Verify that new conditions/actions work correctly in PolicyEngine
- Verify that alerts are created with new `condition`/`findings` fields
- Verify that message actions are stored correctly with full `PolicyAction` objects
- Verify that `applyModificationsFromActions` works correctly

#### 5.2 Message Display Validation
- Verify that modified messages display correctly in message details page
- Verify that highlighting works for both content modifications and message replacements
- Verify that alert details show new condition/findings data correctly
- Verify that correlation between findings and applied actions is displayed

#### 5.3 Edge Case Testing
- **Messages with no alerts**: Should display normally without modification
- **Messages with alerts but no actions**: Should show alerts but no modifications
- **Messages with content modifications only**: Should highlight field changes
- **Messages with message replacements only**: Should show replacement and highlight it
- **Messages with both types**: Should prioritize message replacement
- **Messages with multiple policies**: Should handle priority correctly

#### 5.4 Performance Testing
- Verify that MessageActions fetch doesn't impact page load time significantly
- Verify that new highlighting logic performs well with large messages
- Verify that alert display updates don't cause performance issues

## Implementation Notes:

### Critical Dependencies in Phase 3:
- **Message Details Page** and **AlertList Component** must be updated simultaneously
- **All alert display components** must be updated to use new field names
- **New highlighting logic** must be implemented before removing old logic

### Build Safety:
- **Phase 3**: All changes must be made together as one atomic update
- **Phase 4**: Can be done incrementally after Phase 3 is complete and tested
- **Phase 5**: Validation can be done incrementally

### Rollback Strategy:
- **Phase 3**: If issues arise, can revert entire phase as one unit
- **Phase 4**: Each cleanup step can be reverted individually
- **Database migrations**: Can be rolled back if needed

### Key Technical Considerations:
- **Frontend Safety**: All message modification logic is now frontend-safe via `applyModificationsFromActions`
- **Data Consistency**: New alert fields are populated correctly by PolicyEngine
- **Performance**: MessageActions are fetched once per message, not per alert
- **UX Consistency**: New highlighting logic should provide same visual feedback as old system
- **Error Handling**: Graceful fallback when MessageActions don't exist or when alerts have old format

This plan ensures each phase is buildable and stable, with Phase 3 being the critical atomic change that updates all UI components to use the new data model simultaneously.
