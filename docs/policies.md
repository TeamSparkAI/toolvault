# Policy System

## Current

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

There can be multiple content modification actions within and across policies and we coalesce (merge) them as best we can

## New filterting use cases
    
These are specific cases, but we also want to support these kinds of things generally

For server pinning, when we receive a response to an initialize or tools/list message, we want to compare that to stored payloads and take action of they don't match
- The likely action is return MCP protocol error (error code and message)
- There isn't a "text match" (with or without regex), so text replacement actions wouldn't make sense as options on this kind of policy

For secret leak detection, we want to run all message text against a list of secrets we manange, and if found, take the kind
of text modification actions we currenty take on regex matching filters.  In contrast to a regex validator that matches a regex
and then just validates the match, this kind of validator wouldn't have a refex and would just take each text chunk (each message
attribute value) and process it for matches using it's own logic, generating potential text modification or other actions per match.

For data loss preventions (DLP) we might want a validator to take the entire JSONRPC message, process it, and send it to an external
DLP detection engine for processing (possibly via ICAP).  The actions may include text modifications or other actions.

For message validation, review message to make sure it contains appropriate fields, no extra fields (including no tool call response fields not defined in schema),
proper format or message and contents, apply length and range constraints, etc.

For opentelemetry, send every message to opentelemetry (maybe some other mechanism makes more sense, but mabye the policy engine is the right place for this)

## New actions

For any policy match, we might want to take zero, one, or more than one actions
- The text processing actions should only be available to filters/validators that produce matches
- Any policy might want to take certain generic actions
  - Return an MCP error (error code and message)
  - Return specific result (result payload as text or JSON)
  - Log a security event (local log)
  - Log an event to a SIEM
  - Send message to opentelemetry
- No action should always be an option
  - Even with no action, if any filter matches an alert will be generated, and if is a text matcher, the matching text will be identified in the alert for audit/review

For multiple actions, some are mutually exclusive and require prioritization, others are not (but questions about triggering/context)
- We currently do a priority based coalesce of all match modification actions
- If a specific response is specified, that would take precedence over match modifications
- If an error response is specified, that would take precendence over a specific response (or would it be at the same level?)
- If we have multiple conflicting errors/specific responses, do we use severity as the tiebreaker (and what if that ties too)?
- The rest of the actions are unrelated to each other and can be executed as specified
- For things like log/SIEM do we do action for every match, every filter, or just at the policy level (the decision impacts context available)

## Application and instance configuration

Some filters or actions could require configuration
- Filters could require applicaiton-level config (DLP system config, etc)
- Filters could require filter-instance config (regexes to match, validator function, etc)
- Actions could require application-level config (SIEM config, etc)
- Actions could require action-level config (what to send to log/SIEM, etc, examples?)

Some filters or actions may need more context than just the text when being called during processing
- They will need their application-level config, if any
- They may need to know the serverId (for pinning validator)
- They may need access to models/data (pinning validator) or other servies (secrets manager service for secrets filter)

## Module system

For each policy we have a list of policy filters and policy actions, with their respective instance confugration
We apply the policy filters, which produce alerts, then we send those alert to the configured policy actions

Policy filter instances will have name/notes (as current)

All policy filters will produce alerts
- Currently alerts contain filterName and array of matches
- It seems like we will need to add some more context?  Look at examples.
  - For something like pinning, new tool showed up, tool disappeard, tool description changed, tool schema changed, etc
  - This would be per match (at least in this specific case)
- Some filters may produce alert "matches" with no matching text
  - Message validator might have a "exceeds maximum message size" alert that doesn't relate to any specific text match
- Some filters might want to add metadata to alerts or alert matchs (for example, confident score for a secret or DLP match)
  - Maybe the matches contain a description, the match data (optional), and then a metadata JSON object (optional)
  - The metadata will be available to actions
    - Some actions may know about sepcific metadata
    - Some actions may allow metadata to be accessed generally (through tokens, for example, like "DLP leak detected with confidence $match.score")
      - This might imply that the user knows about the metadata
      - Should alert metadata schema be part of the policy filter definition?

Some of those alerts will be specific text matches (suitable for text replacement action)

Some of the alerts will not reference any text in the message

Some of the alerts might reference text in the message (so that the UX can highlight the matched/offending content), but those matches may not be suitable for replacement actions
- Let's think about the actual case where this would be true to make sure it's a real thing
- Let's say pinning validation wants to indicate the values that didn't match the stored elements (like this new method showed up, or this too description changed)
  - Indication is at the message level

## Policy Filter

A policy filter is a module implementing the PolicyFilter interface
It will have metadata (name, description, input type: message or text, and output type - produces matches)
A policy processor can have it's own application-level configuration
- It has a schema indicating fields, required/optional, default values, etc
- It has an optional validator to validate a config
A list of installed policy processors is maintained (policy processors can be added, removed or configured through our UX)
A policy filter may have instance config
- A schema indicating fields, required/optional, default values, etc
- It has an optional validator to validte instance fields

If we made this general purpose / pluggable, you could imagine the current regex/validator/keywords filter being one of these things
- Metadata
  - name: Text Filter
  - description: Match regular expressions in message text, with optional keyword and function validators
  - input: text
  - producesMatches: true
  - configSchema: null
  - filterSchema: requires a regex, allows an option validator from a list (containing only Luhn for now) and an optional keywords string value
- Migration - we could migtrate all existing filters to instances of this Text Filter policyFilter fairly directly

Things like text filter (with no config) might be single instance installed globally and not removable
Others might be multi-instance (for example, you could have two secret filters configured against two different secret stores)
- In this case, we need to be able to distinguish the instances (maybe we have a user provided "name" and a model provided "type"?)

## Policy Action

Similar to policy filter, an action can have application-level config via schema and instance data via schema
Similar to policy filter, we can install, remove, and configure a policy action through the UX
Metadata
- name
- description
- configSchema
- actionSchema (per action data)
The policy action receives the set of all alerts generate by the filters and has access to the output context (returned message)
It is up to the policy action to determine how to prioritize or otherwise reconcile multiple alerts/matches (there is no implied priority)
It is up to the policy action if it wants to generate an action per policy, per alert, or per alert match (this could be static or by instance config)

Action type: text replacement (replace, redact, remove)
Metadata
- name: Message modification
- description: Replace, redact, or remove matched text
- configSchema: null
- actionSchema: action [replace, remove, redact], redactionPattern (optional) 

We could allow policy filters to produce general purpose state that actions could access, or we could put that in actions
- This way a policy log action could indicate the matching text, confidence score, etc/.

## Other 

Validators will indicate whether they produce matches

If any filter has a validator that produces matches, the match processing actions will be avalable on the policy

Text replacement and error return actions are contradictory - we'd need to resolve what to do if the user indicated both
- Or prevent the user from indicating both somehow in the UX

Examples:
- A pinning validator would be a "message" validator that doesn't produce matches
  - If pinning match failed, we'd want to indicate some details in the alert
- An MCP message validator would be a "message" validator that doesn't produce matches
  - If message validation failed, we'd want to indicate some details in the alert
- A DLP validator would be a "message" validator that does produce matches
  - Is there any match context that we'd want to include in the alert (along with the match/matches)
- A secrets validator would be a "text" validator that does produce matches
- A normal "match" filter with regex, optional Luhn validation, and keywords, produces matches
  - All "match" filters should produce matches and their validators are simple bool returns for match validation
