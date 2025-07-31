#!/bin/bash
set -e

# --- Configuration ---
# The URL of your local caching proxy
LOCAL_PROXY_REGISTRY="http://host.docker.internal:4874/index/"
# The default public PyPI registry URL
DEFAULT_PYPI_REGISTRY="https://pypi.org/simple/"
# A URL to check if the proxy is alive
PROXY_CHECK_URL="http://host.docker.internal:4874/"
# Timeout for the proxy check in seconds
PROXY_CHECK_TIMEOUT=5

# --- Proxy Availability Check ---
echo "Checking if local Python proxy is running at ${PROXY_CHECK_URL} (at container startup)..." >&2

if curl --silent --output /dev/null --fail --max-time ${PROXY_CHECK_TIMEOUT} --retry 0 "${PROXY_CHECK_URL}"; then
    echo "Local Python proxy is reachable. Setting UV_DEFAULT_INDEX to ${LOCAL_PROXY_REGISTRY}." >&2
    export UV_DEFAULT_INDEX="${LOCAL_PROXY_REGISTRY}"
    export PIP_INDEX_URL="${LOCAL_PROXY_REGISTRY}"
else
    echo "Local Python proxy is NOT reachable (or timed out after ${PROXY_CHECK_TIMEOUT}s). Falling back to ${DEFAULT_PYPI_REGISTRY}." >&2
    export UV_DEFAULT_INDEX="${DEFAULT_PYPI_REGISTRY}"
    export PIP_INDEX_URL="${DEFAULT_PYPI_REGISTRY}"
fi

# --- Execute the original command passed to the container ---
echo "Executing command with registry: ${UV_DEFAULT_INDEX}" >&2
echo "Command to execute: $@" >&2

# The 'exec' command ensures that the subsequent command replaces the current shell process.
# This is important for correct signal handling (e.g., Ctrl+C) and process management by Docker.
exec "$@" 