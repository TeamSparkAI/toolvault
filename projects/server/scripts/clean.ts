import { dockerUtils } from "@/lib/utils/docker";
import { getAppDataPath } from "../../shared/paths";
import * as fs from 'fs';
import { MCP_RUNNER_IMAGE } from "@/lib/config/containers";

async function clean() {
    // We need to remove the Docker image first because it will emit log messages which will fail if we've deleted the app data directory
    console.log('Removing Docker image...');
    try {
        const imageExists = await dockerUtils.imageExists(MCP_RUNNER_IMAGE);
        if (imageExists) {
            await dockerUtils.removeImage(MCP_RUNNER_IMAGE);
            console.log('Docker image removed');
        } else {
            console.log('Docker image not found');
        }
    } catch (error) {
        console.error('Error removing Docker image:', error);
    }

    const appDataPath = getAppDataPath();
    console.log(`Removing installation at ${appDataPath}...`);
    try {
        if (fs.existsSync(appDataPath)) {
            fs.rmSync(appDataPath, { recursive: true, force: true });
            console.log('Installation removed');
        } else {
            console.log('Installation not found');
        }
    } catch (error) {
        console.error('Error removing installation:', error);
    }
}

clean();