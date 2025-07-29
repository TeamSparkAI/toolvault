# Filter technologies and approaches

We have a system for filtering message payloads going between AI clients and MCP tools (in both directions)

These filters are able to detect a variety of security issues of varying severity

The filtering system applies "Policies" and when a policy matches on message content it generates an "Alert"

An alert is correlated to the message that triggered it

Policy matching/triggering is determined by matching patterns of text in the message against defined text patterns
- We also support validation functions and proxmity text matches
  - For things like credit cards, the checksum is important
  - For many kinds of PII, additional context is required for confidence of the match (proximity matches)
- In later development filters may indicate probability (for now it will just be match/no-match)
  - How will we use these probabilities (combine them for overal probability, threshold to match, map to severity)?

Policies may be applied selectively
- Direction (request/response/both)
- Method (tools/call, etc)
- Later: Other filters (user, client, etc?)

Policies may be enabled or disabled

Alerts indicate a severity:
  1 - Critical (Immediate action required, direct breach or imminent threat)
  2 - High (Urgent attention required, potential security risk)
  3 - Medium (Important to address, security best practices violation)
  4 - Low (Should be reviewed, minor policy deviation)
  5 - Info (For awareness only, no immediate action required)

Policy filtering application
- General purpose message - look at all json attribute values
- tools/call - look at request args (can be arbitrarily complex tree) and response content (text and non-text, multi-part)

Policy hits can generate actions on the content, including:
  - remove: Remove match
  - redact: Redact match with text [REDACTED]
  - redactPattern: Redact match with pattern [X]
  - replace: Replace value with text [THIS MESSAGE CONTAINED SENSITIVE DATA AND HAS BEEN REDACTED]
  - none
  - Future: Generate error with text (this would short circuit server call on client->server message)

One or more filter matches generates a policy alert for the policy filter (where the alert contains the details of the one or more matches)
- For example, two Visa carts will generate one Credit Card policy alert for the Visa filter with the two matches

Filter matching
- Regex (must match, no other criteria evaluated unless regex matched)
- Keywords (comma sep list, if present, at least on must be found in proximity to the match for the filter to be considered a match)
- Validator (if present, validator function will be called and must return true for the filter to be considered a match)
  - Currently support luhn for credit card checksums

## Optimization

- We currently run each filter independently, which is not very efficient

- A first approximation would be to combine all filter regexes into a single regex so we one have to run through the text once
  - This will make things faster, by more than an order of magnitude (number of filters, so about 24x with current default filters)

- The final step would be to use re2 to convert the "all filters" combined regex into a DFA (which will be fast, run in linear time, and not be subject to ReDoS)
  - Involves a native code complilation (would probably want to make it optional/swappable so we could use it in pre-built version, but not require it for local builds)

NOTE: In testing, we process about 750 messages per second on a dev MacBook applying default policies, so we're not going to worry
      about this anytime soon (maybe if we start doing enterprise/cloud workloads, but maybe not even then).

## Future

We might consider the below tooling in the future

Note: In terms of functionality our current implementation is pretty close to Presidio, except for the weighting part

### Microsoft Presidio

Open source PII detector from Microsoft

- https://microsoft.github.io/presidio/supported_entities/
- https://github.com/microsoft/presidio

NOTE: We've pretty much implemented something comparable (including validators and keyword qualifiers)

### Yelp detect-secrets

https://github.com/Yelp/detect-secrets (Python, looks somewhat stale)

### Gitleaks

https://github.com/gitleaks/gitleaks


## Policy definition

Policy
- name
- description
- direction (request/response/[both])
- method (ex: tools/call, defaults to all)
- filters
  - name
  - notes (description or implementation notes)
  - regex (main regex to match)
  - keywords (case insesitive plain strings for now)
  - validator (none,luhn)
- enabled (bool)
- severity (numeric 1-5)
- action (remove, redact, redactMatch, replace, none)
- actionText

## Filter details

### Email Address

[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}

### SSN

\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b

Keywords: 
SSN
Social Security Number
Tax ID
TIN
Employee ID
EIN

### US Phone number

(?:\+1\s?)?(?:\d{3}[\s.-]\d{3}[\s.-]\d{4}|\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4})\b

### Credit cards

Visa: \b4[0-9]{12}(?:[0-9]{3})?\b
Mastercard: \b5[1-5][0-9]{14}\b
Amex: \b3[47][0-9]{13}\b
Discover Card: \b6(?:011|5[0-9]{2})[0-9]{12}\b
Diners Club/Carte Blanche: \b3(?:0[0-5]|[68][0-9])[0-9]{11}\b
JCB: \b(?:2131|1800|35[0-9]{3})[0-9]{11}\b

Validator: Luhn

### AWS Access Key

(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}

### AWS Secrey key (needs some context or will FP)

[A-Za-z0-9/\+=]{40}

Keywords:
AWS_SECRET_ACCESS_KEY
AWS_ACCESS_KEY_ID
secretAccessKey
awsSecretKey
secret_access_key
access_key_id
aws_access_key

### GitHub Persponal Access Token (PAT)

ghp_[0-9a-zA-Z]{36}

### GitHub OAUTH token

gho_[0-9a-zA-Z]{36}

### Bearer token header

Bearer\s[A-Za-z0-9\-\._~+\/=]{20,}

### PEM Encoded private key

-----BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----[\s\S]*?-----END (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----

### Generic secrets with keyword prefixes

(API_KEY|CLIENT_SECRET|AUTH_TOKEN|PASSWORD|PRIVATE_KEY)[ =:\"]{0,3}([a-zA-Z0-9\-_]{16,}|[A-Za-z0-9\-_.~+=%@]{20,})

### Private IP Addresses (RFC1918 ranges):

\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b

### Slack webhook URL

https://hooks\.slack\.com/services/[A-Za-z0-9\/]{40,}

### Open API key

sk-[a-zA-Z0-9]{48}

### Anthropic API key

sk-ant-api-[a-zA-Z0-9_-]{32,}

### Hugging Face API token

hf_[a-zA-Z0-9]{36}

### UUID

[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}

### Google Cloud API key

AIza[0-9A-Za-z\-_]{35}

### Base64 encoded JWT

eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+


## Intial Policies (see policies.json for implementation)

Cloud Account Secrets
- AWS Access key
- AWS Secret key
- Google Cloud API key

GitHub Secrets
- GitHub PAT
- GitHub OAUTH

Application Tokens
- Slack webhook URL

LLM API keys
- Anthropic
- OpenAP
- Hugging Face

General secrets
- JWT (base64)
- Private key (PEM)
- Prefixed secrets
- Bearer token

PII
- Email
- SSN
- Phone number

Credit Card Numbers
- Visa
- Mastercard
- Amex
- Discover
- Diners Club
- JCB

Internal Network Details
- Private IP Address

Misc
- UUID

## Sample trigger data (not real values, but will trigger filter matches)

GitHub PAT: ghp_123456789012345678901234567890123456

AMEX: 372119825827619
Visa: 4024007142599025
MasterCard: 5140477210796058

UUID: 17e14e73-4f83-43bc-b564-35889d1fd658

Internal IP: 10.0.0.1

Phone number: (555) 555-5555

SSN: 123-45-6789

Anthropic API key: sk-ant-api-1234567890123456789012