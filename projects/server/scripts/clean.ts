import { dockerUtils } from "@/lib/utils/docker";
import { getAppDataPath } from "../../shared/paths";
import * as fs from 'fs';
import { NPX_RUNNER_IMAGE, UVX_RUNNER_IMAGE } from "@/lib/config/containers";

async function clean() {
    // We need to remove the Docker image first because it will emit log messages which will fail if we've deleted the app data directory
    console.log('Removing Docker image...');
    try {
        const npxImageExists = await dockerUtils.imageExists(NPX_RUNNER_IMAGE);
        if (npxImageExists) {
            await dockerUtils.removeImage(NPX_RUNNER_IMAGE);
            console.log('npx runner image removed');
        } else {
            console.log('npx runner image not found');
        }
        const uvxImageExists = await dockerUtils.imageExists(UVX_RUNNER_IMAGE);
        if (uvxImageExists) {
            await dockerUtils.removeImage(UVX_RUNNER_IMAGE);
            console.log('uvx runner image removed');
        } else {
            console.log('uvx runner image not found');
        }
    } catch (error) {
        console.error('Error removing Docker images', error);
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