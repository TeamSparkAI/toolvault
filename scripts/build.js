#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Starting ToolVault build orchestration...\n');

// Clean and recreate dist directory
const distDir = path.join(__dirname, '..', 'dist');
console.log('🧹 Cleaning dist directory...');
if (fs.existsSync(distDir)) {
  try {
    // Try to remove with force first
    fs.rmSync(distDir, { recursive: true, force: true });
  } catch (error) {
    // If that fails, try using rm command
    try {
      execSync('rm -rf dist', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
    } catch (rmError) {
      console.error('❌ Failed to clean dist directory:', rmError.message);
      process.exit(1);
    }
  }
}
fs.mkdirSync(distDir, { recursive: true });

// Build bridge project
console.log('🔧 Building bridge project...');
try {
  execSync('npm run build --workspace=projects/bridge', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('✅ Bridge build completed');
} catch (error) {
  console.error('❌ Bridge build failed:', error.message);
  process.exit(1);
}

// Build proxy project
console.log('🔧 Building proxy project...');
try {
  execSync('npm run build --workspace=projects/proxy', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('✅ Proxy build completed');
} catch (error) {
  console.error('❌ Proxy build failed:', error.message);
  process.exit(1);
}

// Copy proxy executable to root dist
console.log('📋 Copying proxy executable...');
const proxyExecutable = path.join(__dirname, '..', 'projects', 'proxy', 'dist', 'index.js');
const proxyDest = path.join(distDir, 'tsh');
fs.copyFileSync(proxyExecutable, proxyDest);
fs.chmodSync(proxyDest, 0o755); // Make executable
console.log('✅ Proxy executable copied');

// Build server project - Next.js and esbuild bundle
console.log('🔧 Building server project...');
try {
  // Build Next.js and esbuild bundle
  execSync('npm run build:prod --workspace=projects/server', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('✅ Server build completed');
} catch (error) {
  console.error('❌ Server build failed:', error.message);
  process.exit(1);
}

// Copy Next.js standalone build to dist/.next
console.log('📋 Copying Next.js build...');
const nextSrc = path.join(__dirname, '..', 'projects', 'server', '.next', 'standalone', '.next');
const nextDest = path.join(distDir, '.next');
if (fs.existsSync(nextSrc)) {
  fs.cpSync(nextSrc, nextDest, { recursive: true });
  console.log('✅ Next.js build copied');
} else {
  console.error('❌ Next.js build not found');
  process.exit(1);
}

// Copy Next.js static assets to dist/.next/static
console.log('📋 Copying Next.js static assets...');
const nextStaticSrc = path.join(__dirname, '..', 'projects', 'server', '.next', 'static');
const nextStaticDest = path.join(distDir, '.next', 'static');
if (fs.existsSync(nextStaticSrc)) {
  fs.cpSync(nextStaticSrc, nextStaticDest, { recursive: true });
  console.log('✅ Next.js static assets copied');
} else {
  console.error('❌ Next.js static directory not found');
  process.exit(1);
}

// Copy bundled server executable to dist/toolvault
console.log('📋 Copying server executable to dist/toolvault...');
const serverExecutable = path.join(__dirname, '..', 'projects', 'server', 'dist', 'server.js');
const serverDest = path.join(distDir, 'toolvault');
fs.copyFileSync(serverExecutable, serverDest);
fs.chmodSync(serverDest, 0o755); // Make executable
console.log('✅ Server executable copied to dist/toolvault');

// Copy appData directory to dist/appData
console.log('📋 Copying appData files to dist/appData...');
const appDataSrc = path.join(__dirname, '..', 'projects', 'server', 'appData');
const appDataDest = path.join(distDir, 'appData');
if (fs.existsSync(appDataSrc)) {
  fs.cpSync(appDataSrc, appDataDest, { recursive: true });
  console.log('✅ appData files copied to dist/appData');
} else {
  console.error('❌ appData directory not found');
  process.exit(1);
}

// Copy public assets
console.log('📋 Copying public assets...');
const publicSrc = path.join(__dirname, '..', 'projects', 'server', 'public');
const publicDest = path.join(distDir, 'public');
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log('✅ Public assets copied');
}



// Copy runner Dockerfiles and scripts
console.log('📋 Copying runner Dockerfiles and scripts...');
const dockerDir = path.join(__dirname, '..', 'projects', 'docker');
const distDockerDir = path.join(distDir, 'docker');

// Create docker directory in dist
if (!fs.existsSync(distDockerDir)) {
  fs.mkdirSync(distDockerDir, { recursive: true });
}

// Copy Dockerfiles
const npxDockerfileSrc = path.join(dockerDir, 'Dockerfile.npx-runner');
const npxDockerfileDest = path.join(distDockerDir, 'Dockerfile.npx-runner');
const uvxDockerfileSrc = path.join(dockerDir, 'Dockerfile.uvx-runner');
const uvxDockerfileDest = path.join(distDockerDir, 'Dockerfile.uvx-runner');

if (fs.existsSync(npxDockerfileSrc)) {
  fs.copyFileSync(npxDockerfileSrc, npxDockerfileDest);
  console.log('✅ npx-runner Dockerfile copied');
} else {
  console.error('❌ npx-runner Dockerfile not found');
  process.exit(1);
}

if (fs.existsSync(uvxDockerfileSrc)) {
  fs.copyFileSync(uvxDockerfileSrc, uvxDockerfileDest);
  console.log('✅ uvx-runner Dockerfile copied');
} else {
  console.error('❌ uvx-runner Dockerfile not found');
  process.exit(1);
}

// Copy scripts to dist/scripts/ (build context for Docker)
const runNpmScriptSrc = path.join(dockerDir, 'scripts', 'run_npm.sh');
const runNpmScriptDest = path.join(distDir, 'scripts', 'run_npm.sh');
const runUvxScriptSrc = path.join(dockerDir, 'scripts', 'run_uvx.sh');
const runUvxScriptDest = path.join(distDir, 'scripts', 'run_uvx.sh');

// Create scripts directory in dist
const distScriptsDir = path.join(distDir, 'scripts');
if (!fs.existsSync(distScriptsDir)) {
  fs.mkdirSync(distScriptsDir, { recursive: true });
}

if (fs.existsSync(runNpmScriptSrc)) {
  fs.copyFileSync(runNpmScriptSrc, runNpmScriptDest);
  console.log('✅ run_npm.sh copied');
} else {
  console.error('❌ run_npm.sh not found');
  process.exit(1);
}

if (fs.existsSync(runUvxScriptSrc)) {
  fs.copyFileSync(runUvxScriptSrc, runUvxScriptDest);
  console.log('✅ run_uvx.sh copied');
} else {
  console.error('❌ run_uvx.sh not found');
  process.exit(1);
}

// Verify executables
console.log('\n🔍 Verifying executables...');
const tshExists = fs.existsSync(path.join(distDir, 'tsh'));
const toolvaultExists = fs.existsSync(path.join(distDir, 'toolvault'));
const nextExists = fs.existsSync(path.join(distDir, '.next'));
const npxDockerfileExists = fs.existsSync(path.join(distDir, 'docker', 'Dockerfile.npx-runner'));
const uvxDockerfileExists = fs.existsSync(path.join(distDir, 'docker', 'Dockerfile.uvx-runner'));
const npmScriptExists = fs.existsSync(path.join(distDir, 'scripts', 'run_npm.sh'));
const uvxScriptExists = fs.existsSync(path.join(distDir, 'scripts', 'run_uvx.sh'));
const scriptsExist = npmScriptExists && uvxScriptExists;

if (tshExists && toolvaultExists && nextExists && npxDockerfileExists && uvxDockerfileExists && scriptsExist) {
  console.log('✅ All components created successfully');
  console.log(`📁 Distribution in: ${distDir}`);
  console.log('   - tsh (proxy)');
  console.log('   - toolvault (bundled server)');
  console.log('   - .next/ (Next.js build)');
  console.log('   - public/ (static assets)');
  console.log('   - appData/ (migrations, data)');
  console.log('   - docker/ (runner containers and scripts)');
} else {
  console.error('❌ Failed to create all components');
  if (!tshExists) console.error('   - Missing: tsh executable');
  if (!toolvaultExists) console.error('   - Missing: toolvault executable');
  if (!nextExists) console.error('   - Missing: .next directory');
  if (!npxDockerfileExists) console.error('   - Missing: npx-runner Dockerfile');
  if (!uvxDockerfileExists) console.error('   - Missing: uvx-runner Dockerfile');
  if (!npmScriptExists) console.error('   - Missing: run_npm.sh script');
  if (!uvxScriptExists) console.error('   - Missing: run_uvx.sh script');
  process.exit(1);
}

console.log('\n🎉 Build orchestration completed successfully!');