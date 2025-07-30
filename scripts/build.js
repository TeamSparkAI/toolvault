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

// Copy Dockerfile for container builds
console.log('📋 Copying Dockerfile...');
const dockerfileSrc = path.join(__dirname, '..', 'projects', 'docker', 'Dockerfile');
const dockerfileDest = path.join(distDir, 'Dockerfile');
if (fs.existsSync(dockerfileSrc)) {
  fs.copyFileSync(dockerfileSrc, dockerfileDest);
  console.log('✅ Dockerfile copied');
} else {
  console.error('❌ Dockerfile not found');
  process.exit(1);
}

// Verify executables
console.log('\n🔍 Verifying executables...');
const tshExists = fs.existsSync(path.join(distDir, 'tsh'));
const toolvaultExists = fs.existsSync(path.join(distDir, 'toolvault'));
const nextExists = fs.existsSync(path.join(distDir, '.next'));
const dockerfileExists = fs.existsSync(path.join(distDir, 'Dockerfile'));

if (tshExists && toolvaultExists && nextExists && dockerfileExists) {
  console.log('✅ All components created successfully');
  console.log(`📁 Distribution in: ${distDir}`);
  console.log('   - tsh (proxy)');
  console.log('   - toolvault (bundled server)');
  console.log('   - .next/ (Next.js build)');
  console.log('   - public/ (static assets)');
  console.log('   - appData/ (migrations, data)');
  console.log('   - Dockerfile (for container builds)');
} else {
  console.error('❌ Failed to create all components');
  process.exit(1);
}

console.log('\n🎉 Build orchestration completed successfully!');