# Use a Node.js base image as npx is part of npm, which comes with Node.js.
# We choose a version that's recent and includes a common Linux distribution (like Debian/Ubuntu)
# for easier installation of other tools.
FROM node:20-slim

# Set environment variables for non-interactive installs
ENV DEBIAN_FRONTEND=noninteractive
ENV UV_CACHE_DIR=/usr/local/uv
ENV UV_PYTHON_INSTALL_DIR=/usr/local/uv/python

# 1. Install utilities
WORKDIR /tmp
RUN apt-get update && apt-get install -y curl unzip && \
    rm -rf /var/lib/apt/lists/*

# 2. Install uv (for uvx)
COPY --from=ghcr.io/astral-sh/uv:0.5.5 /uv /uvx /bin/

# Add uv to the PATH for all users
ENV PATH="/root/.cargo/bin:/usr/local/uv/bin:${PATH}"

# 3. Set up home directory and environment
RUN mkdir -p /home && chmod 755 /home
ENV HOME=/home

# 4. Set a working directory for your projects inside the container
# This is where your commands will typically run.
WORKDIR /app

# Define the default command to run when the container starts without a specific command.
# This makes it flexible; you can override it with `docker run <image> <command>`.
# Here, we'll just keep the container alive or provide a shell.
# CMD ["bash"] # Or "sh" for a lighter shell

# Instructions for the user:
# To run npx: docker run --rm -it <your-image-name> npx <package-name> [args]
# To run uvx: docker run --rm -it <your-image-name> uvx <package-name> [args]