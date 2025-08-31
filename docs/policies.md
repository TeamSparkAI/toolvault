# Policy System

## Current

Current policy application logic is in /lib/services/MessageFilter.ts

Our current policy system is somewhat limiting (it doesn't support some specific new use cases).

Currently we have a policy with a set of filters and a single action.  

All filters have a name and notes, and require a regex for matching
- There is an optional validator function which gets passed the match to validate that it is actually a match (bool result)
- There are optional keywords which, if present, must be found in the vicinity of the match for the match to be valid

The policy actions (applied to each filter match) revolve around content modification:
- remove
- redact
- redactPattern
- replace
- none

There can be multiple content modification actions within and across policies and we coalesce (merge) them as best we can to the final message

## New filterting use cases
    
These are specific cases, but we also want to support these kinds of things generally:

For server pinning, when we receive a response to an initialize or tools/list message, we want to compare that to stored payloads and take action if they don't match
- The likely action is return MCP protocol error (error code and message)
- There isn't a "text match" (with or without regex), so text replacement actions wouldn't make sense as options on this kind of policy

For secret leak detection, we want to run all message text against a list of secrets we manange, and if found, take the kind
of text modification actions we currenty take on regex matching filters.  In contrast to a regex validator that matches a regex
and then just validates the match, this kind of validator (filter) wouldn't have a regex and would just take each text chunk (each message
attribute value) and process it for matches using it's own logic, generating potential text modification or other actions per match.

For data loss preventions (DLP) we might want a validator to take the entire JSONRPC message, process it, and send it to an external
DLP detection engine for processing (possibly via ICAP).  The actions may include text modifications or other actions, and results/matches
might be scored where that score drives the filter or specific match qualification.

For message validation, review message to make sure it contains appropriate fields, no extra fields (including no tool call response fields not defined in schema),
proper format or message and contents, apply length and range constraints, etc.

For opentelemetry, send every message to opentelemetry (maybe some other mechanism makes more sense, but mabye the policy engine is the right place for this)

## New actions

For any policy match, we might want to take zero, one, or more than one actions
- The text processing actions should only be available to filters/validators that produce matches
  - Maybe we don't care - if you have text processing actions and no filters that produce matches, it's a noop (reasonable)
- Any policy might want to take certain generic actions
  - Return an MCP error (error code and message)
  - Return specific result (result payload as text or JSON)
  - Log a security event (local log)
  - Log an event to a SIEM
  - Send message to opentelemetry
- "No Action" should always be an option
  - Even with no action, if any filter matches an alert will be generated, and if is a text matcher, the matching text will be identified in the alert for audit/review

For multiple actions, some are mutually exclusive and require prioritization, others are not (but questions about triggering/context)
- We currently do a priority based coalesce of all match modification actions
- If a specific response is specified, that would take precedence over match modifications
- If an error response is specified, that would take precendence over a specific response (or would it be at the same level?)
- If we have multiple conflicting errors/specific responses, do we use severity as the tiebreaker (and what if that ties too)?
- The rest of the actions are unrelated to each other and can be executed as specified
- For things like log/SIEM do we do action for every match, every filter, or just at the policy level (the decision impacts context available)

## Application and instance configuration

Some conditions or actions could require configuration
- Conditions could require applicaiton-level config (DLP system config, etc)
- Conditions could require condition-instance params (regexes to match, validator function, etc)
- Actions could require application-level config (SIEM config, etc)
- Actions could require action-level params (what to send to log/SIEM, etc, examples?)

Some conditions or actions may need more context than just the text when being called during processing
- They will need their application-level config, if any
- They will need their params
- They may need to know the serverId (for pinning validator)
- They may need access to models/data (pinning validator) or other servies (secrets manager service for secrets condition)

## Module system

For each policy we have a list of policy conditions and policy actions, with their respective instance confugration
We apply the policy conditions, which produce alerts, then we send those alers to the configured policy actions

Policy condition instances will have name/notes (as current)

All policy conditions will produce alerts
- Currently alerts contain filterName and array of matches
- It seems like we will need to add some more context?  Look at examples.
  - For something like pinning, new tool showed up, tool disappeard, tool description changed, tool schema changed, etc
  - This would be per match (at least in this specific case)
- Some conditions may produce alert "matches" with no matching text
  - Message validator might have a "exceeds maximum message size" alert that doesn't relate to any specific text match
- Some conditions might want to add metadata to alerts or alert matchs (for example, confident score for a secret or DLP match)
  - Maybe the matches contain a description, the match data (optional), and then a metadata JSON object (optional)
  - The metadata will be available to actions
    - Some actions may know about sepcific metadata
    - Some actions may allow metadata to be accessed generally (through tokens, for example, like "DLP leak detected with confidence $match.score")
      - This might imply that the user knows about the metadata
      - Should alert metadata schema be part of the policy condition definition?

Some of those alerts will be specific text matches (suitable for text replacement action)

Some of the alerts will not reference any text in the message

Some of the alerts might reference text in the message (so that the UX can highlight the matched/offending content), but those matches may not be suitable for replacement actions
- Let's say message contained invalid JSON element (or out of range, etc) - we might want to indicate the content, but it is not suitable for replacement
- Let's say pinning validation wants to indicate the values that didn't match the stored elements (like this new method showed up, or this too description changed)
  - Indication is at the message level, matches might highlight bad content, but it's not suitable for replacement
- Note: This probably means "Finding" needa a bool for suitable for replacement (or "text match")

## Policy condition

A policy condition is a module implementing the PolicyCondition interface
It will have metadata (name, description, input type: message or text, and output type - produces matches)
- In new implementation it takes a message, has base class utility methods to process as fields
A policy processor can have it's own application-level configuration
- It has a schema indicating fields, required/optional, default values, etc
- It has an optional validator to validate a config
A list of installed policy processors is maintained (policy processors can be added, removed or configured through our UX)
A policy condition may have instance params
- A schema indicating fields, required/optional, default values, etc
- It has an optional validator to validte instance params

If we made this general purpose / pluggable, you could imagine the current regex/validator/keywords condition being one of these things
- Metadata
  - name: Text Match
  - description: Match regular expressions in message text, with optional keyword and function validators
  - input: text
  - producesMatches: true
  - configSchema: null
  - paramsSchema: requires a regex, allows an option validator from a list (containing only Luhn for now) and an optional keywords string value
- Migration - we could migtrate all existing filters to instances of this Text Match policyCondition fairly directly

Things like text match condition (with no config, as evidenced by no configSchema) might be single instance installed globally and not removable
Others might be multi-instance (for example, you could have two secret conditions configured against two different secret stores)
- In this case, we need to be able to distinguish the instances (maybe we have a user provided "name" and a model provided "type", "instance", or "id"?)

## Policy Action

Similar to policy condition, an action can have application-level config via schema and instance params via schema
Similar to policy condition, we can install, remove, and configure a policy action through the UX
Metadata
- name
- description
- configSchema
- actionSchema (per action data)
The policy action receives the set of all alerts generate by the conditions and has access to the output context (returned message)
It is up to the policy action to determine how to prioritize or otherwise reconcile multiple alerts/matches (there is no implied priority)
It is up to the policy action if it wants to generate an action per policy, per alert, or per alert match (this could be static or by instance config)

Action type: text replacement (replace, redact, remove)
Metadata
- name: Message modification
- description: Replace, redact, or remove matched text
- configSchema: null
- actionSchema: action [replace, remove, redact], redactionPattern (optional) 

We could allow policy conditions to produce general purpose state that actions could access, or we could put that in actions
- This way a policy log action could indicate the matching text, confidence score, etc/.

## Other 

Validators will indicate whether they produce matches (not sure we need this - it's just for UX to know whether to show text replacement action)

If any condition has a validator that produces matches, the match processing actions will be avalable on the policy

Text replacement and error return actions are contradictory
- If both, message level action wins
- We could try to prevent the user from indicating both somehow in the UX (maybe later)

Examples:
- A pinning validator would be a "message" validator that doesn't produce matches
  - If pinning match failed, we'd want to indicate some details in the alert
- An MCP message validator would be a "message" validator that doesn't produce matches
  - If message validation failed, we'd want to indicate some details in the alert
- A DLP validator would be a "message" validator that does produce matches
  - Is there any match context that we'd want to include in the alert (along with the match/matches)
- A secrets validator would be a "text" validator that does produce matches
- A normal "match" condition with regex, optional Luhn validation, and keywords, produces matches
  - All "match" conditions should produce matches and their validators are simple bool returns for match validation

So we have a series of policies, where each policy has a series of conditions, where each condition can product an alert (with zero or more matches)

Content actions (replace, redact, remove, error) must be coalesced across all policies/conditions/alerts for a message
Non-content actions will accumulate for a message

## Data structures

### Policy Condition

We have a policy condition object and we have an installed/confured instance of the policy condition object we call a "configuration" that is referenced in policy conditions by configId

### Policy Action

We have a policy action object and we have an installed/confured instance of the policy action object we call a "configuration" that is referenced in policy actions by configId

### Alert (model)

#### Current:

export interface FieldMatch {
    fieldPath: string;   // JSON path like "params.args[0].apiKey"
    start: number;       // Start position within the field value
    end: number;         // End position within the field value
    action: PolicyAction;
    actionText: string;
}

export interface AlertData {
    alertId: number;
    messageId: number;
    policyId: number;
    filterName: string; // Should we copy the filter from the policy (it can changed or be removed after this alert is generated)?
    origin: MessageOrigin;
    matches: FieldMatch[] | null;
    timestamp: string;
    createdAt: string;
    seenAt: string | null;
}

#### Future:

// Incident of data relevant to policy condition (replaces FieldMatch in AlertData)
export interface Finding {
  details: string,
  metadata: any
  match: {
    fieldPath: string.
    start: number,
    end: number,
  }
}

### Policy Condition (policy model)

#### Current:

export interface PolicyData {
    ...policy model fields...
    filters: Array<{
        name: string;
        notes?: string;
        regex: string;
        keywords?: string[];
        validator?: 'none' | 'luhn';
    }>;
}

#### Future:

conditions: PolicyCondition

PolicyCondition
- type
- instance
- name
- notes
- params

#### Examples:

PolicyCondition
- type: 'regex'
- name: 'Visa'
- notes: 'Matches Visa card format and checksum;
- params: { regex: 'xxxxx', keywords: 'yyyy, zzzz', validator: 'luhn' }

PolicyCondition
- type: 'pinning'
- params: {}


### Policy Actions (policy model)

#### Current:

export type PolicyAction = 'remove' | 'redact' | 'redactPattern' | 'replace' | 'none';

export interface PolicyData {
    ...policy model fields...
    action: PolicyAction;
    actionText?: string;

#### Future:

actions: PolicyAction[]

PolicyAction
- type
- instance
- params

#### Examples:

PolicyAction
- type: 'rewrite'
- params: { action: 'remove' | 'redact' | 'redactPattern' | 'replace', actionText: 'xxx' } // actionText required for redactPattern and replace

PolicyAction
- type: 'error'
- params: { code: 32000, message: 'Tools did not match pinned tools' }

PolicyAction
- type: 'log'
- instance (id?): points to log action instance with it's own settings:, like: { logfile: 'security.log' }
- params: { level: 'info', message: 'This is the log message' }

### Policy Actions taken

We currently stick the policy action taken on an alert into the Alert (the Alert.FieldMatch.action)
- This does allow us to reproduce the final message by processing all alerts

In the new implementation, actions can be taken at the alert or message level.  We need to store the actions taken in another model at the message level.

The content modifying types (rewrite and error) are built-in and have no instance config, so we can apply them to Alerts reliably after the fact to recreated the output message

Policy application accumulates policy actions by message, by policy withing message, and by actions per policy

We'll write this to a new model MessageActions (table: message_actions)

### Available and Installed Conditions and Actions

An installed condition or action is called a "configuration"

There needs to be a way to enumerate condition and action classes (so they can be installed into the system)

There needs to be a way to enumerate installed condition and action instances (so they can be configured in the system, or used in policies)

We need CRUD actions for installed conditions/actions (install new from class, get/getAll, update, remove)

We use the policy element configId in policies/alerts/actions references to the policy element configuration

Aynthing without an instance config can be pre-installed and non-removable (maybe they can be enabled/disabled to prevent them showing as options in new policies)

Anything with an instance config can be deleted, but if used in policies, we need to prevent or handle in some way (remove from policies, gracefully fail when applying?)

The policyElement model represents installed actions/conditions and their config

PolicyElement
- configId
- className
- elementType: string (condition/action)
- config: any (JSON), null for static element (no config)
- enabled: boolean
- createdAt/updateAt: timestamp

### Notes

We have condition and action classes, configurations, and instances

- ConditionClass: the actual implementation class of the Condition (PolicyConditionBase)
- ConditionConfiguration: an instance of the class installed on the system, referencing the class, with metadata (name, desc, etc) and configuration
- ConditionInstance: an instace of the condition in a policy, referencing the ConditionConfiguration by id, and having it's own params

- ActionClass: the actual implementation class of the Action (PolicyActionBase)
- ActionConfiguration: an instance of the class installed on the system, referencing the class, with metadata (name, desc, etc) and configuration
- ActionInstance: an instace of the action in a policy, referencing the ActionConfiguration by id, and having it's own params

## Migration

Note: Need to update policy import script / data to support new policy model

### Pass 1 - Prepare new schema (merge into 002)

ALTER TABLE policies ADD COLUMN actions JSON NOT NULL;

ALTER TABLE alerts ADD COLUMN condition JSON NOT NULL; 
ALTER TABLE alerts ADD COLUMN findings JSON NOT NULL;

CREATE TABLE message_actions (
    messageId INTEGER NOT NULL,
    actions JSON NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE policy_elements (
    configId INTEGER PRIMARY KEY AUTOINCREMENT,
    className TEXT NOT NULL,
    elementType TEXT NOT NULL,
    config JSON,
    enabled BOOLEAN DEFAULT 1,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO policy_elements (className, elementType)
VALUES 
    ('regex', 'condition'),
    ('rewrite', 'action');

### Pass 2 - Convert data

Process policies
- Update conditions field, converting existing array to new conditions object array (convert existing conditions to new regex conditions)

Process alerts
- Update filterName to new condition field/object (referencing regex condition config, with params)
- Convert matches to new findings field/object
- Generate message_actions using policy action/actionText and matches/findings

### Pass 3 - Clean up schema (003)

ALTER TABLE policies REMOVE COLUMN action;
ALTER TABLE policies REMOVE COLUMN actionText;

ALTER TABLE alerts REMOVE COLUMN filterName;
ALTER TABLE alerts REMOVE COLUMN matches;

## Next (we can do this without any migration)

[DONE] Implement the PolicyElement model and CRUD interface
- Implement config UX (install/uninstall, configure) - LATER (we have existing regex/rewrite pre-installed and usable now)
[DONE] Implement the MessageAction model and write message actions to it

## Then

Implement the new policy model and types (conditions/actions)
Implement policy config (condition/action) UX
At this point conditions/actions will have configId and everything should work end-to-end

## Policy/Alert/Action Data relationship

Note: Made action event alertId optional, and set it only for actions related to specific conditions (text match condition alerts, and rewrite actions)

Policy
- Conditions
  - Generates alert on match
    - Polulates alert with condition and findings
- Actions
  - Genete ActionEvents when any condition matches
    - Some action events may be correlated to findings (text modification) - and thus indirectly the alerts/conditions which produced the findings
      - This is the "highlight the redacted text in the final message" functionality

From the UX, if I click an alert that is a text match with a content mod action, and the mod was applied, I want to see it in the output
Any other alert (finding) doesn't directly drive output.  It is the actions driving the output.  If we wanted to see the reasons for other 
changes it would be in response to those actions.  One or more contions/alerts caused one or more actions/actionEvents.

Our message details should probably show alerts and actions (we'd want to see if a SIEM event as created, etc).  How/where else would we even
see action details?

Alert
- alertId
- messageId
- policyId
- origin
- conditions - PolicyCondition
- findings - Finding[]

export interface PolicyCondition {
    elementClassName: string;  // e.g., "regex"
    elementConfigId: number;   // references policy_elements table
    instanceId: string;        // instance of condition in policy (random base32 id)
    name: string;              // display name
    notes?: string;            // optional description
    params: any;               // configuration
}

// Incident of data produced by policy condition
export interface Finding {
    details: string;
    metadata?: any;
    match?: boolean // suitable for item replacement, redaction, etc
    location?: {
        fieldPath: string;
        start: number;
        end: number;
    };
}

ActionEvent
- messageId
- policyId
- alertId (optional, ActionEvent will only be related to an alertId of it's a rewrite of an alert finding)
- origin
- severity
- actionResults

// Action event types for policy engine
export interface ActionEvent {
    action: PolicyAction; // The policy action that triggered this event
    description: string;  // details?
    metadata?: any;
    contentModification?: ContentModification; // field or message type - added conditionInstanceId to field modification details for correlation
}

// A collection of actions resulting from a given policy action
export interface ActionResults {
    action: PolicyActionInstance;
    actionEvents: ActionEvent[];
}

// Defines the policy action (the instance on the policy) that triggered the resilts
export interface PolicyActionInstance {
    elementClassName: string;
    elementConfigId: number;
    instanceId: string; // The is the instance of the action in the policy
    params: any;
}

## Notes

Perf seems slower (maybe 50%) on import
- Review log output
- Review algo
  - Did we introduce any new per-message db reads?
  - It doens't seem like adding ActionEvents writes would slow us down that much (maybe), but there might be room to make it more efficient.
  - Would be interesting to profile policy evaluation-only (no match) versus match (less concerned about action perf as it's way less frequent).