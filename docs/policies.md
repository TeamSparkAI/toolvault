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

Conditons:
- Text match (regex, with keywords and validator)
- Keyword match (from keyword list)
- Secret detection (using configured secret manager)
- DLP Analysis (Data Loss Prevention using configured ICAP endpoint)
- Pinned server validation
- Message validation (fields, format, range and length, etc) 
- AI Threat Detection (AI-powered analysis to detect malicious prompt injection and novel attacks in tool responses)

Actions:
- Rewrite (replace, remove, redact text matches)
- Error (return error code/message)
- Response (return specific payload)
- Log event (to configured log file)
- Send event to SIEM (to configured SIEM endpoint)
- Send email (via configured SMTP server)
- Send message to OpenTelemetry (via configured OLTP endpoint)

Extensible via runtime modules to make it easy to build conditions or actions that integrate with any other system

## New actions use cases

For any policy match, we might want to take zero, one, or more than one actions
- Any policy might want to take certain generic actions
  - Return an MCP error (error code and message)
  - Return specific result (result payload as text or JSON)
  - Log a security event (local log)
  - Log an event to a SIEM
  - Send message to opentelemetry
    - If we wanted to do something like this on every message, we'd need for policies with no conditions to apply all actions
    - This implies that actions should be able to run with no findings
- "No Action" should always be an option
  - Even with no action, if any filter matches an alert will be generated, and if is a text matcher, the matching text will be identified in the alert for audit/review

For multiple actions, some are mutually exclusive and require prioritization, others are not (but questions about triggering/context)
- We currently do a priority based coalesce of all match modification actions
- If a specific response is specified, that would take precedence over match modifications
- If an error response is specified, that would take precendence over a specific response (or would it be at the same level?)
- If we have multiple conflicting errors/specific responses, do we use severity as the tiebreaker (and what if that ties too)?
- The rest of the actions are unrelated to each other and can be executed as specified
- For actions (consider log/SIEM), the action gets all findings and can determine whether to take an action per finding, or one action for all findings

## Application and instance configuration

Some conditions or actions could require configuration
- Conditions could require application-level config (DLP system config, etc)
- Conditions could require condition-instance params (regexes to match, validator function, etc)
- Actions could require application-level config (SIEM config, etc)
- Actions could require action-level params (what to send to log/SIEM, etc, examples?)

Some conditions or actions may need more context than just the text when being called during processing
- They will need their application-level config, if any
- They will need their params
- They may need to know the serverId (for pinning validator)
- They may need access to models/data (pinning validator) or other servies (secrets manager service for secrets condition)

## New Conditions and Actions system

Policies have a set of conditions and a set of actions.

These conditions and actions are implemented as Policy Elements, available from a factory, and installable/configurable via API
- This is an extensible system, where the policy engine logic knows nothing about the specific conditions/actions

Policy conditions have name and notes (especially to distinguish between multiple instances of the same policy condition type in generating alerts)

Each policy condition or action instance contains params to determine how it should be applied
- The UX uses the policly element schema to dynamically generate config to collect/populate params
- The UX also can call the policy element optional param validator to validate the set of params

When a condition is applied it reports findings (one or more)
- The findings can indicate details and metatata about the finding
- The findings can indicate whether the finding is a text match, suitable for individual action (redaction, etc)
- The findings can indicate a location (field, range)

For each policy, all conditions are applied to a message and all findings collected.

If any findings were produced, all policy actions are applied (the set of findings are passed to each action)

Actions produce ActionEvents (one or more)
- Each ActionEvent may optionally be linked to the condition that produced the finding that generated it

After all policy actions are applied
- The set of conditions which produced findings are used to generated an Alert for each set of findings (by policy/condition)
- The set of ActionEvents for each policy are used to generate a MessageAction with all ActionEvents (by policy/action)

The action events from all policies for a message are evaluted to determine which ones modify content
Those action events are evaluted as a group to determine the final content modification, which is then applied
- If any action event is a message replacement, the one associated with the highest severity policy wins
- If no action event is a message replacement, all content modification actions are applied (coalesced)

### Policy conditions findings use cases

Some findings may indicate a text match (regex condition, secrets manager condition, etc)
- These findings may be handled specially by actions that can operate on matches (specifically the built-in rewrite action)
Some findings may indicate referenced text that is not a match
- Example: Pinning condition identified new tool (will indicate tool in payload, but not as a text "match")
- UX can still highlight referenced text in payload, but match processing actions will not process it
Some findings may indicate an issue, but no referenced text (location)
- Example: Message validator - Message too large
Some conditions might want to add metadata to findings 
- Example: Confident score for a secret or DLP match (can be set in finding metadata)
- The metadata will be available to actions
  - Some actions may know about sepcific metadata
  - Some actions may allow metadata to be accessed generally (through tokens, for example, like "DLP leak detected with confidence $match.score")
    - This might imply that the user knows about the metadata
    - Should alert metadata schema be part of the policy condition definition?

## Policy condition

A policy condition is a module implementing the PolicyCondition interface
It will have metadata (name, description)
- In new implementation it takes a message, has base class utility methods to process as fields
A policy processor can have it's own application-level configuration
- It has a schema indicating fields, required/optional, default values, etc
- It has an optional validator to validate a config
A list of installed policy processors is maintained (policy processors can be added, removed or configured through our UX)
A policy condition may have instance params
- A schema indicating fields, required/optional, default values, etc
- It has an optional validator to validte instance params

Condition type: Text matching (regex/validator/keywords):
- Metadata
  - name: Text Match
  - description: Match regular expressions in message text, with optional keyword and function validators
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

Action type: Text replacement (replace, redact, remove)
- Metadata
  - name: Message modification
  - description: Replace, redact, or remove matched text
  - configSchema: null
  - actionSchema: action [replace, remove, redact], redactionPattern (optional) 

We could allow policy conditions to produce general purpose state that actions could access, or we could put that in actions
- This way a policy log action could indicate the matching text, confidence score, etc/.

## Other 

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

## Policy/Alert/Action Data relationship

Note: Made action event alertId optional, and set it only for actions related to specific conditions (text match condition alerts, and rewrite actions)

Policy
- Conditions
  - Generates alert on match
    - Polulates alert with condition and findings
- Actions
  - Generate ActionEvents when any condition matches
    - Some action events may be correlated to findings (text modification) - and thus indirectly the alerts/conditions which produced the findings
      - This is the "highlight the redacted text in the final message" functionality

The message details UX currently has a list of alerts
- When you click one, it highlights the findings in the original message and the modification generated by those fidings in the final message (if any)

It would be nice to have a list of actions also (there would be no other way to see the actions otherwise)
- When you click one, it should highlight the fingings in the original message (if any linked by alertId), and the modifications in the final message for the action (if any)

## TODO LATER

Implement granular pinning findings (highlight new, changed tools, missing tool is finding without location)
Display policy actions in message details (with new selection/highlighting logic)
Implement policy config (condition/action) UX (need a multi-config element for this)
- Start implementing more conditions/actions