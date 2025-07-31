#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# --- Configuration ---
# The URL of your local caching proxy. Use 'host.docker.internal' for Docker Desktop on Mac/Windows,
# or the actual host IP if on Linux/VMs and configured.
LOCAL_PROXY_REGISTRY="http://host.docker.internal:4873/"
# The default public NPM registry URL
DEFAULT_NPM_REGISTRY="https://registry.npmjs.org/"

# A URL to check if the proxy is alive. This can be the base URL or a specific health endpoint
PROXY_CHECK_URL="${LOCAL_PROXY_REGISTRY}"

# Timeout for the proxy check in seconds
PROXY_CHECK_TIMEOUT=5

# --- Proxy Availability Check ---
echo "Checking if local NPM proxy is running at ${PROXY_CHECK_URL} (at container startup)..." >&2

if curl --silent --output /dev/null --fail --max-time ${PROXY_CHECK_TIMEOUT} --retry 0 "${PROXY_CHECK_URL}"; then
  echo "Local NPM proxy is reachable. Setting NPM_CONFIG_REGISTRY to ${LOCAL_PROXY_REGISTRY}." >&2
  export NPM_CONFIG_REGISTRY="${LOCAL_PROXY_REGISTRY}"
else
  echo "Local NPM proxy is NOT reachable (or timed out after ${PROXY_CHECK_TIMEOUT}s). Falling back to ${DEFAULT_NPM_REGISTRY}." >&2
  export NPM_CONFIG_REGISTRY="${DEFAULT_NPM_REGISTRY}"
fi

# --- Execute the original command passed to the container ---
echo "Executing command with registry: ${NPM_CONFIG_REGISTRY}" >&2
echo "Command to execute: $@" >&2 # For debugging, shows what command was passed

# The 'exec' command ensures that the subsequent command replaces the current shell process.
# This is important for correct signal handling (e.g., Ctrl+C) and process management by Docker.
exec "$@" 