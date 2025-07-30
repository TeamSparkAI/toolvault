import { spawn, SpawnOptions } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import * as fs from 'fs';
import { logger } from '../logging/server';
import { MCP_RUNNER_IMAGE } from '../config/containers';

const execAsync = promisify(exec);

export interface DockerBuildOptions {
    dockerfile?: string;
    context?: string;
    tag?: string;
    buildArgs?: Record<string, string>;
    noCache?: boolean;
    pull?: boolean;
}

export interface DockerRunOptions {
    image: string;
    containerName?: string;
    ports?: Record<string, string>;
    volumes?: Record<string, string>;
    environment?: Record<string, string>;
    detach?: boolean;
    rm?: boolean;
    command?: string[];
}

export interface DockerContainerInfo {
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
    created: string;
}

export class DockerError extends Error {
    constructor(message: string, public exitCode?: number, public stderr?: string) {
        super(message);
        this.name = 'DockerError';
    }
}

export class DockerUtils {
    private static instance: DockerUtils;
    private dockerAvailable: boolean | null = null;

    private constructor() { }

    static getInstance(): DockerUtils {
        if (!DockerUtils.instance) {
            DockerUtils.instance = new DockerUtils();
        }
        return DockerUtils.instance;
    }

    /**
     * Check if Docker is installed and available
     */
    async isDockerInstalled(): Promise<boolean> {
        if (this.dockerAvailable !== null) {
            return this.dockerAvailable;
        }

        try {
            await execAsync('docker --version');
            this.dockerAvailable = true;
            return true;
        } catch (error) {
            this.dockerAvailable = false;
            return false;
        }
    }

    /**
     * Check if Docker daemon is running
     */
    async isDockerRunning(): Promise<boolean> {
        try {
            await execAsync('docker info');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if a Docker image exists locally
     */
    async imageExists(imageName: string): Promise<boolean> {
        try {
            const { stdout } = await execAsync(`docker images -q ${imageName}`);
            const exists = stdout.trim().length > 0;
            logger.debug(`docker images -q ${imageName} returned: "${stdout.trim()}" (exists: ${exists})`);
            return exists;
        } catch (error) {
            logger.debug(`docker images -q ${imageName} failed:`, error);
            return false;
        }
    }

    /**
     * Build a Docker image
     */
    async buildImage(options: DockerBuildOptions): Promise<string> {
        const {
            dockerfile = 'Dockerfile',
            context = '.',
            tag = 'toolvault:latest',
            buildArgs = {},
            noCache = false,
            pull = false
        } = options;

        const args = ['build'];

        if (noCache) {
            args.push('--no-cache');
        }

        if (pull) {
            args.push('--pull');
        }

        // Add build args
        Object.entries(buildArgs).forEach(([key, value]) => {
            args.push('--build-arg', `${key}=${value}`);
        });

        args.push('-f', dockerfile, '-t', tag, context);

        logger.debug(`Building Docker image with command: docker ${args.join(' ')}`);
        return this.executeDockerCommand(args);
    }

    /**
     * Run a Docker container
     */
    async runContainer(options: DockerRunOptions): Promise<string> {
        const {
            image,
            containerName,
            ports = {},
            volumes = {},
            environment = {},
            detach = true,
            rm = true,
            command = []
        } = options;

        const args = ['run'];

        if (detach) {
            args.push('-d');
        }

        if (rm) {
            args.push('--rm');
        }

        if (containerName) {
            args.push('--name', containerName);
        }

        // Add port mappings
        Object.entries(ports).forEach(([hostPort, containerPort]) => {
            args.push('-p', `${hostPort}:${containerPort}`);
        });

        // Add volume mappings
        Object.entries(volumes).forEach(([hostPath, containerPath]) => {
            args.push('-v', `${hostPath}:${containerPath}`);
        });

        // Add environment variables
        Object.entries(environment).forEach(([key, value]) => {
            args.push('-e', `${key}=${value}`);
        });

        args.push(image, ...command);

        return this.executeDockerCommand(args);
    }

    /**
     * Stop a running container
     */
    async stopContainer(containerNameOrId: string): Promise<string> {
        return this.executeDockerCommand(['stop', containerNameOrId]);
    }

    /**
     * Remove a container
     */
    async removeContainer(containerNameOrId: string, force = false): Promise<string> {
        const args = ['rm'];
        if (force) {
            args.push('-f');
        }
        args.push(containerNameOrId);
        return this.executeDockerCommand(args);
    }

    /**
     * Remove an image
     */
    async removeImage(imageName: string, force = false): Promise<string> {
        const args = ['rmi'];
        if (force) {
            args.push('-f');
        }
        args.push(imageName);
        return this.executeDockerCommand(args);
    }

    /**
     * List running containers
     */
    async listContainers(all = false): Promise<DockerContainerInfo[]> {
        const args = ['ps'];
        if (all) {
            args.push('-a');
        }
        args.push('--format', 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}');

        const output = await this.executeDockerCommand(args);
        const lines = output.trim().split('\n').slice(1); // Skip header

        return lines.map(line => {
            const [id, name, image, status, ports, created] = line.split('\t');
            return { id, name, image, status, ports, created };
        });
    }

    /**
     * Get container logs
     */
    async getContainerLogs(containerNameOrId: string, follow = false, tail?: number): Promise<string> {
        const args = ['logs'];
        if (follow) {
            args.push('-f');
        }
        if (tail) {
            args.push('--tail', tail.toString());
        }
        args.push(containerNameOrId);

        return this.executeDockerCommand(args);
    }

    /**
     * Build the project's Docker image if it doesn't exist
     */
    async ensureProjectImageBuilt(imageTag = MCP_RUNNER_IMAGE): Promise<boolean> {
        try {
            // Check if Docker is available
            if (!(await this.isDockerInstalled())) {
                logger.warn('Docker is not installed or not available');
                return false;
            }

            // Check if image already exists
            const imageExists = await this.imageExists(imageTag);
            logger.debug(`Image ${imageTag} exists: ${imageExists}`);
            if (imageExists) {
                logger.info(`Docker image ${imageTag} already exists`);
                return true;
            }

            // Build the image
            logger.info(`Building Docker image ${imageTag}...`);
            
            // Try to find Dockerfile in both dev and dist locations
            let dockerfilePath: string;
            let contextPath: string;
            
            // First try dev location (relative to projects directory)
            const devDockerfilePath = path.join(__dirname, '..', '..', '..', 'docker', 'Dockerfile');
            const devContextPath = path.join(__dirname, '..', '..', '..');
            
            // Then try dist location (relative to dist directory)
            const distDockerfilePath = path.join(__dirname, 'Dockerfile');
            const distContextPath = path.join(__dirname, '.');
            
            // Check which location exists
            if (fs.existsSync(distDockerfilePath)) {
                dockerfilePath = distDockerfilePath;
                contextPath = distContextPath;
                logger.debug('Using dist Dockerfile location');
            } else if (fs.existsSync(devDockerfilePath)) {
                dockerfilePath = devDockerfilePath;
                contextPath = devContextPath;
                logger.debug('Using dev Dockerfile location');
            } else {
                // This error is really for production, so we'll just show the dist path
                throw new Error(`Dockerfile not found in ${distDockerfilePath}`);
            }

            await this.buildImage({
                dockerfile: dockerfilePath,
                context: contextPath,
                tag: imageTag,
                noCache: false
            });

            logger.info(`Successfully built Docker image ${imageTag}`);
            return true;
        } catch (error) {
            logger.error('Failed to build Docker image:', error);
            return false;
        }
    }

    /**
     * Execute a Docker command and return the output
     */
    private async executeDockerCommand(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const options: SpawnOptions = {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            };

            const process = spawn('docker', args, options);
            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                const output = data.toString();
                stdout += output;

            });

            process.stderr?.on('data', (data) => {
                const output = data.toString();
                stderr += output;
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new DockerError(
                        `Docker command failed: docker ${args.join(' ')}`,
                        code || undefined,
                        stderr
                    ));
                }
            });

            process.on('error', (error) => {
                reject(new DockerError(
                    `Failed to execute Docker command: ${error.message}`,
                    undefined,
                    stderr
                ));
            });
        });
    }

    /**
     * Get Docker system information
     */
    async getDockerInfo(): Promise<any> {
        try {
            const output = await this.executeDockerCommand(['info', '--format', '{{json .}}']);
            return JSON.parse(output);
        } catch (error) {
            throw new DockerError('Failed to get Docker info', undefined, error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Get Docker version information
     */
    async getDockerVersion(): Promise<any> {
        try {
            const output = await this.executeDockerCommand(['version', '--format', '{{json .}}']);
            return JSON.parse(output);
        } catch (error) {
            throw new DockerError('Failed to get Docker version', undefined, error instanceof Error ? error.message : String(error));
        }
    }
}

// Export singleton instance
export const dockerUtils = DockerUtils.getInstance();

// Export convenience functions
export const isDockerInstalled = () => dockerUtils.isDockerInstalled();
export const ensureProjectImageBuilt = (imageTag = MCP_RUNNER_IMAGE) => dockerUtils.ensureProjectImageBuilt(imageTag);
export const buildImage = (options: DockerBuildOptions) => dockerUtils.buildImage(options);
export const runContainer = (options: DockerRunOptions) => dockerUtils.runContainer(options); 