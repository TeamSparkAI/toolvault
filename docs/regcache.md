# Securing Shared Module Caches for Containerized `npx`/`uvx` Workloads

## 1\. The Challenge: Performance vs. Security with Untrusted Code

We are running Docker containers that execute arbitrary `npx` (Node.js) and `uvx` (Python) packages. These packages, by their nature, can be untrusted or even malicious. To achieve fast startup times, we need to cache these package downloads, as repeatedly fetching them over the network is slow (and these are short-lived, ephemeral containers that are started frequently).

The goal is to maintain a persistent, shared cache on the host machine that containers can utilize, but prevent malicious code within an `npx` or `uvx` package from tampering with (polluting or corrupting) the cached code of other modules.

### 1.1. Why Direct Writable Volume Mounts are Risky

When you mount a Docker volume (e.g., `npm_cache_vol` or `uv_cache_vol`) directly into a container with write (`rw`) access:

  * **Process Permissions:** The `npm` or `uv` process running inside the container (and by extension, any arbitrary code it executes) gains write permissions to the *entire mounted volume*.
  * **Lack of Granularity:** Filesystems (like ext4, NTFS) manage permissions at the directory and file level. They cannot discern the *intent* of a write operation. They don't know "this write is a legitimate download for package A" versus "this write is malicious code from package B attempting to corrupt package C's cache entry."
  * **Cache Structure:** `npm`'s `_cacache` and `uv`'s cache store packages using internal, often hash-based, structures. They also maintain central index files at or near the cache's root. They require write access to these central files to operate correctly.

### 1.2. Why "Selective RO/RW Mounts" Don't Work for Caches

You might consider mounting the entire cache as Read-Only (`ro`) and then mounting specific subdirectories (where a module's "own files would go") as Read-Write (`rw`). While this is a valid Docker technique for other scenarios (where you have a predictable, isolated subdirectory for writes), it **does not work for `npm` and `uv` caches** because:

  * **Centralized Indexing:** These tools need to update central index files (e.g., `npm`'s `index-v5`) that are located at the *root* of the cache directory. If this root is mounted read-only, the tools cannot update their indexes and will fail or become dysfunctional.
  * **Unpredictable Write Locations:** You cannot reliably predict a single, isolated subdirectory where an arbitrary package would *only* write its files. Downloads go into hash-based content directories, and the tools manage their internal state across the entire cache hierarchy.

Because of these limitations, granting write access to the main cache directory essentially grants write access to the entire cache, making it vulnerable to pollution if untrusted code is executed.

-----

## 2\. The Solution: A Trusted Local Proxy Cache

The most robust and recommended solution to balance performance (caching) and security (protecting cache integrity from untrusted code) is to introduce a **trusted proxy cache server** running on your local machine (the Docker host).

### 2.1. Core Concept

Instead of containers talking directly to public package registries and writing to a shared volume, they talk to your local proxy. This proxy then acts as the gatekeeper for all package downloads and cache interactions.

### 2.2. How the Proxy Architecture Works

1.  **Trusted Proxy Server (on Host):**
      * You install and run a dedicated proxy server (e.g., Verdaccio for `npm`, proxpi for `uv`) directly on your host machine.
      * This proxy has full, trusted write access to your persistent cache volume (e.g., `npm_cache_vol`, `uv_cache_vol`).
2.  **Container Configuration:**
      * Your Docker containers are configured to fetch all their `npm` or `uv` packages **from this local proxy server's address** (e.g., `http://host.docker.internal:4873/`).
      * Crucially, the containers **do not have direct volume mounts** to the package cache with write access. Their access to the cache is **indirect, via the proxy.**
3.  **Proxy's Role as Gatekeeper:**
      * When a container requests a package, it asks the local proxy.
      * The proxy first checks its local cache. If the package is found, it's served immediately.
      * If not found, the proxy fetches the package from the official public registry (npm, PyPI).
      * **Security Layer:** Before storing the package in its local cache and serving it to the container, the proxy can perform security checks:
          * Verify package hashes/signatures.
          * Check against blacklists/whitelists.
          * Potentially even run basic vulnerability scans (if the proxy supports it or integrates with external tools).
      * Only "clean" and verified packages are then written to the persistent cache.

```
+------------------+
| Docker Host      |
| (Local Machine)  |
|                  |
| +--------------+ |
| | Persistent   | |
| | Module Cache | |
| | (Local Vol)  | |
| +--------------+ |
|       ^          |
|       |          |
|       V          |                            +-------------------+
| +--------------+ |                            | Public Registry   |
| | Proxy Server | |<---------------------------| (npm, PyPI, etc.) |
| | (Verdaccio/  | |  (Fetch if not in cache)   |                   |
| | proxpi)      | |                            |                   |
| +--------------+ |                            |                   |
+------------------+                            +-------------------+
        ^
        |   (Requests from Container)
        |
+--------------------+
| Container          |
| (Running Untrusted |
|  npx/uvx)          |
|                    |
| +--------------+   |
| | npm/uv/uvx   |---| (Configured to use Local Proxy ONLY)
| | (Configured  |   |
| |  to use      |   |
| |  Proxy)      |   |
| +--------------+   |
|                    |
+--------------------+

Key:
----> Direct Network Request/Response
----|---- Indirect Access via Proxy (Proxy acts as intermediary)
```

### 2.3. Key Benefits

  * **Strong Security Isolation:** The container itself *never* has direct write access to your valuable, shared cache. The proxy is the only component that writes, and it can be designed to write only verified content. This effectively prevents cache pollution from rogue packages.
  * **Performance:** Once packages are in the proxy's cache, they are served locally and instantly to containers, maintaining fast startup times.
  * **Centralized Control and Policy:** The proxy becomes a single point where you can enforce policies:
      * What packages are allowed (whitelisting/blacklisting).
      * Which versions are acceptable.
      * Audit all package access.
      * Integrity verification (hashes, signatures).
  * **Offline Capability:** Once packages are cached by the proxy, you can run your containers offline.
  * **Consistency:** Ensures all containers use the exact same cached versions.

### 2.4. Potential Drawbacks and Complexity

  * **Setup and Management Overhead:** You need to install, configure, and maintain an additional service (the proxy) on your local machine.
  * **Proxy Security:** The proxy itself must be a trusted, well-secured, and regularly updated component. Its security is paramount.
  * **Configuration:** Containers need to be explicitly configured to use the proxy (e.g., environment variables).
  * **Network Access:** Ensuring containers can consistently reach the proxy (especially on Linux hosts where `host.docker.internal` may require extra configuration) adds a layer of networking complexity.
  * **Resource Usage:** The proxy will consume some CPU, memory, and disk space on your host.

-----

## 3\. Current Implementation: Containerized Proxy Cache Solution

We have implemented a secure proxy-based caching solution that eliminates direct write access to shared caches from untrusted containers while maintaining fast startup times.

### 3.1. Architecture Overview

- **Proxy Containers**: Long-running containerized proxy servers (Verdaccio for npm, proxpi for Python)
- **Runner Containers**: Custom containers for executing `npx` and `uvx` commands with proxy detection
- **Fallback Mechanism**: Automatic fallback to public registries if proxies are unavailable
- **Dynamic Configuration**: Proxy availability is checked at container startup time

### 3.2. Proxy Containers

We use containerized proxy servers that are started automatically by the main application:

- **NPM Proxy**: `verdaccio/verdaccio:latest` running on port 4873
- **Python Proxy**: `epicwink/proxpi` running on port 4874 (mapped to internal port 5000)
- **Container Names**: `teamspark-npx-proxy` and `teamspark-uvx-proxy`

### 3.3. Runner Containers

Custom containers for executing commands with proxy detection:

- **npx-runner**: Based on `node:20-slim` with proxy detection script
- **uvx-runner**: Based on `python:3.11-slim` with proxy detection script
- **Image Names**: `teamspark/npx-runner:latest` and `teamspark/uvx-runner:latest`

### 3.4. Proxy Detection and Fallback

Both runner containers use wrapper scripts that:

1. **Check proxy availability** using `curl` with a 5-second timeout
2. **Set environment variables dynamically**:
   - npm: `NPM_CONFIG_REGISTRY` to proxy or `https://registry.npmjs.org/`
   - uvx: `UV_DEFAULT_INDEX` and `PIP_INDEX_URL` to proxy or `https://pypi.org/simple/`
3. **Execute the original command** with appropriate registry configuration
4. **Output diagnostics to stderr** to avoid interfering with MCP protocol

### 3.5. Server Integration

The main Node.js server:

- **Starts proxy containers** on server startup via `ensureProxyContainersRunning()`
- **Builds runner containers** if needed via `ensureRunnerContainersBuilt()`
- **Wraps commands** via `wrapSecurity()` to use appropriate runner containers
- **Handles container lifecycle** including cleanup and error handling

### 3.6. Performance Characteristics

- **Startup time**: ~1.8 seconds for cached `uvx` commands (vs 10-15 seconds without cache)
- **Proxy hit rate**: High for frequently used packages
- **Fallback reliability**: Automatic fallback to public registries if proxies unavailable
- **Concurrent access**: Handled gracefully by proxy servers

### 3.7. Security Benefits

- **No direct cache access**: Runner containers have no volume mounts to shared caches
- **Proxy isolation**: Proxy containers manage their own cache directories
- **Fallback security**: Even if proxies fail, containers can still function via public registries
- **Container naming**: All custom containers prefixed with `teamspark/` for easy identification

-----

## 4\. Implementation Details

### 4.1. Choosing a Proxy Server

  * **For Node.js (`npm`/`npx`):**

      * **Verdaccio:** A lightweight, easy-to-use private npm registry and caching proxy. Ideal for individual developers or small teams.
      * **Nexus Repository Manager (OSS):** A more robust, enterprise-grade solution supporting various formats (npm, PyPI, Maven, Docker, etc.). More complex to set up but highly versatile.

  * **For Python (`uv`/`pip`):**

      * **proxpi:** An open-source PyPI proxy and index server. Provides caching and can host your own private packages.
      * **Nexus Repository Manager (OSS):** Can also proxy PyPI.
      * **Simple HTTP Caching Proxy (e.g., Nginx):** For basic caching without deep registry features, Nginx can be configured to cache HTTP requests to PyPI.

### 4.2. General Proxy Configuration (on Your Host Machine)

1.  **Installation:** Install your chosen proxy server software.
2.  **Port:** Configure it to listen on a specific port (e.g., 4873 for Verdaccio, 4874 for proxpi).
3.  **Upstream Registry:** Point it to the public npm registry (`https://registry.npmjs.org/`) or PyPI (`https://pypi.org/simple/`).
4.  **Cache Location:** Configure the proxy to store its cache in a persistent directory on your host machine (this is where your Docker named volume would be mounted, or simply a host path).
5.  **Authentication/Access (Optional but Recommended):** Consider if you need to secure access to the proxy itself (e.g., with basic authentication) if it's exposed beyond your local machine.

### 4.3. Container Configuration

You'll need to tell `npm` and `uv` inside your Docker containers to use your local proxy.

#### 4.3.1. Dockerfile Snippets

```dockerfile
# Assuming your proxy is running on port 4873 for npm and 4874 for Python

FROM node:20-slim

# Set environment variables for non-interactive apt installs
ENV DEBIAN_FRONTEND=noninteractive

# Install curl, unzip (if needed by your application)
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip && \
    rm -rf /var/lib/apt/lists/*

# Copy uv binaries (as you already do)
COPY --from=ghcr.io/astral-sh/uv:0.5.5 /uv /uvx /bin/

# --- Proxy Configuration for npm and uv/pip ---
# For Docker Desktop (Mac/Windows) and some Linux setups:
# This relies on Docker's special DNS name for the host
ENV NPM_CONFIG_REGISTRY=http://host.docker.internal:4873/
ENV PIP_INDEX_URL=http://host.docker.internal:4874/index/
ENV UV_DEFAULT_INDEX=http://host.docker.internal:4874/index/

# For Linux host where host.docker.internal might not resolve by default,
# you might need to add an --add-host to docker run (see below)
# and use that IP or a specific bridge IP.
# Example if your host IP on the Docker bridge is 172.17.0.1:
# ENV NPM_CONFIG_REGISTRY=http://172.17.0.1:4873/
# ENV PIP_INDEX_URL=http://172.17.0.1:4874/index/
# ENV UV_DEFAULT_INDEX=http://172.17.0.1:4874/index/

# --- End Proxy Configuration ---

# Set up home directory and environment (good practice)
ENV HOME=/home/appuser # Or whatever user you create
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Set a working directory for your projects
WORKDIR /app

# Your application files would go here, and your CMD/ENTRYPOINT
# would run your npx/uvx commands.
# CMD ["npx", "@modelcontextprotocol/everything"]
# CMD ["uvx", "your_python_app"]
```

#### 4.3.2. `docker run` Command Considerations

  * **Docker Desktop (Mac/Windows):** `host.docker.internal` works out of the box.
    ```bash
    docker run --rm your_image_name npx @modelcontextprotocol/everything
    ```
  * **Linux Host:** `host.docker.internal` is not automatically available, but our implementation automatically handles this:
      * The `wrapSecurity()` function detects Linux platform and adds `--add-host host.docker.internal:172.17.0.1`
      * This uses the default Docker bridge gateway IP (`172.17.0.1`)
      * The `unwrapSecurity()` and `getSecurityType()` functions are updated to handle this parameter
      * No manual configuration required - works automatically on all platforms

-----

## 5\. Final Security Considerations for the Proxy

  * **Keep Proxy Software Updated:** Just like any other critical software, keep your proxy server patched to defend against vulnerabilities.
  * **Restrict Access:** If possible, limit network access to your proxy server to only your local machine or specific trusted IPs. Don't expose it to the public internet unless absolutely necessary and with strong authentication.
  * **Monitor Logs:** Regularly check the proxy's logs for suspicious activity (e.g., attempts to download non-existent packages, unusual traffic patterns).

By implementing a local proxy, you introduce a powerful layer of control and security that directly addresses your concerns about untrusted code compromising your shared module cache, while preserving fast startup times.
