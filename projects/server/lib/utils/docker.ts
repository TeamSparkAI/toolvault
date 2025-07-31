import { spawn, SpawnOptions } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import * as fs from 'fs';
import { logger } from '../logging/server';
import { 
    NPX_RUNNER_IMAGE, 
    UVX_RUNNER_IMAGE,
    NPX_PROXY_CONTAINER,
    UVX_PROXY_CONTAINER,
    NPX_PROXY_IMAGE,
    UVX_PROXY_IMAGE,
    NPX_PROXY_PORT,
    UVX_PROXY_PORT
} from '../config/containers';

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
        args.push('--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}');

        const output = await this.executeDockerCommand(args);
        const lines = output.trim().split('\n');

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
     * Ensure runner containers are built
     */
    async ensureRunnerContainersBuilt(): Promise<boolean> {
        try {
            // Check if Docker is available
            if (!(await this.isDockerInstalled())) {
                logger.warn('Docker is not installed or not available');
                return false;
            }

            // Check if images already exist
            const npxExists = await this.imageExists(NPX_RUNNER_IMAGE);
            const uvxExists = await this.imageExists(UVX_RUNNER_IMAGE);

            if (npxExists && uvxExists) {
                logger.info('Runner containers already exist');
                return true;
            }

            // Try to find docker directory in multiple locations
            let dockerDir: string;
            let contextPath: string;
            
            // Try dev location first (projects/docker/)
            const devDockerDir = path.join(__dirname, '..', '..', '..', 'docker');
            const devDockerfilePath = path.join(devDockerDir, 'Dockerfile.npx-runner');
            
            // Try prod location (dist/docker/)
            const prodDockerDir = path.join(__dirname, 'docker');
            const prodDockerfilePath = path.join(prodDockerDir, 'Dockerfile.npx-runner');
            
            if (fs.existsSync(devDockerfilePath)) {
                // Dev environment: files are in projects/docker/
                dockerDir = devDockerDir;
                contextPath = devDockerDir;
            } else if (fs.existsSync(prodDockerfilePath)) {
                // Prod environment: files are in dist/docker/, context is dist/
                dockerDir = prodDockerDir;
                contextPath = path.dirname(prodDockerDir);
            } else {
                throw new Error(`Dockerfile.npx-runner not found in either ${devDockerfilePath} or ${prodDockerfilePath}`);
            }

            // Build npx runner if needed
            if (!npxExists) {
                logger.info('Building npx runner container...');
                const npxDockerfilePath = path.join(dockerDir, 'Dockerfile.npx-runner');
                
                if (!fs.existsSync(npxDockerfilePath)) {
                    throw new Error(`npx runner Dockerfile not found at ${npxDockerfilePath}`);
                }

                await this.buildImage({
                    dockerfile: npxDockerfilePath,
                    context: contextPath,
                    tag: NPX_RUNNER_IMAGE,
                    noCache: false
                });
            }

            // Build python runner if needed
            if (!uvxExists) {
                logger.info('Building uvx runner container...');
                const uvxDockerfilePath = path.join(dockerDir, 'Dockerfile.uvx-runner');
                
                if (!fs.existsSync(uvxDockerfilePath)) {
                    throw new Error(`Python runner Dockerfile not found at ${uvxDockerfilePath}`);
                }

                await this.buildImage({
                    dockerfile: uvxDockerfilePath,
                    context: contextPath,
                    tag: UVX_RUNNER_IMAGE,
                    noCache: false
                });
            }

            logger.info('Successfully built runner containers');
            return true;
        } catch (error) {
            logger.error('Failed to build runner containers:', error);
            return false;
        }
    }

    /**
     * Ensure proxy containers are running
     */
    async ensureProxyContainersRunning(): Promise<boolean> {
        try {
            // Check if Docker is available
            if (!(await this.isDockerInstalled())) {
                logger.warn('Docker is not installed or not available');
                return false;
            }

            // Check if containers are already running
            const containers = await this.listContainers(true);
            const npxProxyRunning = containers.some(c => 
                c.name === NPX_PROXY_CONTAINER && c.status.includes('Up')
            );
            const uvxProxyRunning = containers.some(c => 
                c.name === UVX_PROXY_CONTAINER && c.status.includes('Up')
            );

            if (npxProxyRunning && uvxProxyRunning) {
                logger.info('Proxy containers already running');
                return true;
            }

            // Start npx proxy if not running
            if (!npxProxyRunning) {
                logger.info('Starting npx proxy container...');
                try {
                    await this.runContainer({
                        image: NPX_PROXY_IMAGE,
                        containerName: NPX_PROXY_CONTAINER,
                        ports: { [`${NPX_PROXY_PORT}`]: `${NPX_PROXY_PORT}` },
                        detach: true,
                        rm: false
                    });
                    logger.info('npx proxy container started successfully');
                } catch (error) {
                    logger.error('Failed to start npx proxy container:', error);
                    return false;
                }
            }

            // Start uvx proxy if not running
            if (!uvxProxyRunning) {
                logger.info('Starting uvx proxy container...');
                try {
                    await this.runContainer({
                        image: UVX_PROXY_IMAGE,
                        containerName: UVX_PROXY_CONTAINER,
                        ports: { [`${UVX_PROXY_PORT}`]: '5000' },
                        detach: true,
                        rm: false
                    });
                    logger.info('uvx proxy container started successfully');
                } catch (error) {
                    logger.error('Failed to start uvx proxy container:', error);
                    return false;
                }
            }

            logger.info('Successfully started proxy containers');
            return true;
        } catch (error) {
            logger.error('Failed to start proxy containers:', error);
            return false;
        }
    }

    /**
     * Execute a Docker command and return the output
     */
    private async executeDockerCommand(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const options: SpawnOptions = {
                stdio: ['pipe', 'pipe', 'pipe']
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
export const ensureRunnerContainersBuilt = () => dockerUtils.ensureRunnerContainersBuilt();
export const ensureProxyContainersRunning = () => dockerUtils.ensureProxyContainersRunning();
export const buildImage = (options: DockerBuildOptions) => dockerUtils.buildImage(options);
export const runContainer = (options: DockerRunOptions) => dockerUtils.runContainer(options); 