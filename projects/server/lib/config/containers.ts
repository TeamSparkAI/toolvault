/**
 * Container configuration constants
 * 
 * This file contains shared container definitions that are used by both
 * frontend and backend code. These constants should be kept in sync
 * with the actual Docker images and containers used by the system.
 */

/**
 * Default tag for the MCP runner container
 */
export const MCP_RUNNER_TAG = 'latest';


/**
 * NPM runner container for running npx commands
 */
export const NPX_RUNNER_CONTAINER = 'teamspark/npx-runner';

/**
 * Python runner container for running uvx commands
 */
export const UVX_RUNNER_CONTAINER = 'teamspark/uvx-runner';

/**
 * Default tag for runner containers
 */
export const RUNNER_TAG = 'latest';

/**
 * Full image names for runner containers
 */
export const NPX_RUNNER_IMAGE = `${NPX_RUNNER_CONTAINER}:${RUNNER_TAG}`;
export const UVX_RUNNER_IMAGE = `${UVX_RUNNER_CONTAINER}:${RUNNER_TAG}`;

/**
 * Proxy container names and configuration
 */
export const NPX_PROXY_CONTAINER = 'teamspark-npx-proxy';
export const UVX_PROXY_CONTAINER = 'teamspark-uvx-proxy';

/**
 * Proxy container images
 */
export const NPX_PROXY_IMAGE = 'verdaccio/verdaccio:latest';
export const UVX_PROXY_IMAGE = 'epicwink/proxpi';

/**
 * Proxy ports
 */
export const NPX_PROXY_PORT = 4873;
export const UVX_PROXY_PORT = 4874;