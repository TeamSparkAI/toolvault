/**
 * Container configuration constants
 * 
 * This file contains shared container definitions that are used by both
 * frontend and backend code. These constants should be kept in sync
 * with the actual Docker images and containers used by the system.
 */

/**
 * The default MCP runner container image name
 * This container is used to run MCP servers in a sandboxed environment
 */
export const MCP_RUNNER_CONTAINER = 'teamspark/mcp-runner';

/**
 * Default tag for the MCP runner container
 */
export const MCP_RUNNER_TAG = 'latest';

/**
 * Full image name for the MCP runner container
 */
export const MCP_RUNNER_IMAGE = `${MCP_RUNNER_CONTAINER}:${MCP_RUNNER_TAG}`; 