import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const run = (command, args, options) =>
    new Promise((resolve) => {
        const child = spawn(command, args, options);
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => (stdout += chunk));
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });

test(
    'assembles a self-contained display package with token-free API configuration',
    { skip: process.platform !== 'win32' },
    async (t) => {
        const temporaryRoot = await mkdtemp(join(tmpdir(), 'airi-display-package-'));
        const distPath = join(temporaryRoot, 'dist');
        const environmentPath = join(temporaryRoot, '.env');
        const outputRoot = join(temporaryRoot, 'output');
        const packageName = 'AIRI-Display-Test';
        await mkdir(distPath);
        await writeFile(join(distPath, 'index.html'), '<div id="root"></div>');
        await writeFile(
            environmentPath,
            [
                'VITE_AIRI_API_BASE_URL=https://api.example.test:58013',
                'VITE_AIRI_UPLOAD_PATH=/api/GenerateWorkflow/UploadMedia',
                'VITE_AIRI_AUTH_TOKEN=must-not-be-packaged',
            ].join('\n'),
        );
        t.after(() => rm(temporaryRoot, { recursive: true, force: true }));

        const result = await run(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                join(process.cwd(), 'scripts', 'package-display.ps1'),
                '-DistPath',
                distPath,
                '-EnvironmentPath',
                environmentPath,
                '-OutputRoot',
                outputRoot,
                '-PackageName',
                packageName,
                '-AllowEmbeddedCredentials',
            ],
            { cwd: process.cwd() },
        );

        assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
        const packageRoot = join(outputRoot, packageName);
        for (const path of [
            'dist/index.html',
            'display-server.mjs',
            'display-config.json',
            'start-display.cmd',
            'start-display.ps1',
            'diagnose-upload.cmd',
            'diagnose-upload.ps1',
            'README-FIRST.txt',
        ]) {
            await access(join(packageRoot, path));
        }
        for (const commandFile of [
            'check-windows-architecture.cmd',
            'diagnose-upload.cmd',
            'start-display.cmd',
        ]) {
            const commandText = await readFile(join(packageRoot, commandFile), 'utf8');
            assert.match(commandText, /\r\n/);
            assert.doesNotMatch(commandText, /(?<!\r)\n/);
            assert.doesNotMatch(commandText, /[^\x00-\x7F]/);
        }
        const configText = await readFile(join(packageRoot, 'display-config.json'), 'utf8');
        const config = JSON.parse(configText.replace(/^\uFEFF/, ''));
        assert.deepEqual(config, {
            apiBaseUrl: 'https://api.example.test:58013',
            uploadPath: '/api/GenerateWorkflow/UploadMedia',
        });
        assert.doesNotMatch(configText, /must-not-be-packaged|AUTH_TOKEN/i);
        assert((await stat(join(outputRoot, `${packageName}.zip`))).size > 0);
    },
);

test(
    'starts the packaged AIRI server and returns its health marker',
    { skip: process.platform !== 'win32' },
    async (t) => {
        const packageRoot = await mkdtemp(join(tmpdir(), 'airi-display-launcher-'));
        const distPath = join(packageRoot, 'dist');
        await mkdir(distPath);
        await writeFile(join(distPath, 'index.html'), '<div id="root"></div>');
        await copyFile(
            join(process.cwd(), 'scripts', 'display-server.mjs'),
            join(packageRoot, 'display-server.mjs'),
        );
        await copyFile(
            join(process.cwd(), 'scripts', 'display-package', 'start-display.ps1'),
            join(packageRoot, 'start-display.ps1'),
        );

        const portProbe = createServer();
        await new Promise((resolve) => portProbe.listen(0, '127.0.0.1', resolve));
        const address = portProbe.address();
        assert(address && typeof address === 'object');
        const port = address.port;
        await new Promise((resolve, reject) =>
            portProbe.close((error) => (error ? reject(error) : resolve())),
        );

        let serverProcessId;
        t.after(async () => {
            if (serverProcessId) {
                await run('taskkill.exe', ['/PID', String(serverProcessId), '/T', '/F'], {
                    cwd: packageRoot,
                });
            }
            await rm(packageRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        });

        const result = await run(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                join(packageRoot, 'start-display.ps1'),
                '-Port',
                String(port),
                '-NoBrowser',
            ],
            { cwd: packageRoot },
        );

        assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
        const processMatch = result.stdout.match(/AIRI_DISPLAY_PROCESS_ID=(\d+)/);
        assert(processMatch, result.stdout);
        serverProcessId = Number(processMatch[1]);

        const healthResponse = await fetch(`http://127.0.0.1:${port}/__airi_display_health`);
        assert.equal(healthResponse.status, 200);
        assert.deepEqual(await healthResponse.json(), {
            service: 'airi-display',
            status: 'ok',
        });
    },
);

test(
    'uses Vite production environment precedence when no environment file is specified',
    { skip: process.platform !== 'win32' },
    async (t) => {
        const temporaryRoot = await mkdtemp(join(tmpdir(), 'airi-display-env-'));
        const distPath = join(temporaryRoot, 'dist');
        const environmentRoot = join(temporaryRoot, 'environment');
        const outputRoot = join(temporaryRoot, 'output');
        await mkdir(distPath);
        await mkdir(environmentRoot);
        await writeFile(join(distPath, 'index.html'), '<div id="root"></div>');
        await writeFile(
            join(environmentRoot, '.env'),
            'VITE_AIRI_API_BASE_URL=https://base.example.test\n',
        );
        await writeFile(
            join(environmentRoot, '.env.local'),
            'VITE_AIRI_API_BASE_URL=https://local.example.test\n',
        );
        await writeFile(
            join(environmentRoot, '.env.production'),
            'VITE_AIRI_API_BASE_URL=https://production.example.test\n',
        );
        await writeFile(
            join(environmentRoot, '.env.production.local'),
            [
                'VITE_AIRI_API_BASE_URL=https://production-local.example.test',
                'VITE_AIRI_UPLOAD_PATH=/custom/upload',
            ].join('\n'),
        );
        t.after(() => rm(temporaryRoot, { recursive: true, force: true }));

        const result = await run(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                join(process.cwd(), 'scripts', 'package-display.ps1'),
                '-DistPath',
                distPath,
                '-EnvironmentRoot',
                environmentRoot,
                '-OutputRoot',
                outputRoot,
                '-PackageName',
                'AIRI-Display-Env-Test',
            ],
            {
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    VITE_AIRI_API_BASE_URL: undefined,
                    VITE_AIRI_UPLOAD_PATH: undefined,
                },
            },
        );

        assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
        const configText = await readFile(
            join(outputRoot, 'AIRI-Display-Env-Test', 'display-config.json'),
            'utf8',
        );
        assert.deepEqual(JSON.parse(configText.replace(/^\uFEFF/, '')), {
            apiBaseUrl: 'https://production-local.example.test',
            uploadPath: '/custom/upload',
        });
    },
);

test(
    'packages successfully from Vite process environment variables without env files',
    { skip: process.platform !== 'win32' },
    async (t) => {
        const temporaryRoot = await mkdtemp(join(tmpdir(), 'airi-display-process-env-'));
        const distPath = join(temporaryRoot, 'dist');
        const environmentRoot = join(temporaryRoot, 'empty-environment');
        const outputRoot = join(temporaryRoot, 'output');
        await mkdir(distPath);
        await mkdir(environmentRoot);
        await writeFile(join(distPath, 'index.html'), '<div id="root"></div>');
        t.after(() => rm(temporaryRoot, { recursive: true, force: true }));

        const result = await run(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                join(process.cwd(), 'scripts', 'package-display.ps1'),
                '-DistPath',
                distPath,
                '-EnvironmentRoot',
                environmentRoot,
                '-OutputRoot',
                outputRoot,
                '-PackageName',
                'AIRI-Display-Process-Env-Test',
            ],
            {
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    VITE_AIRI_API_BASE_URL: 'https://process.example.test',
                    VITE_AIRI_UPLOAD_PATH: '/process/upload',
                },
            },
        );

        assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
        const configText = await readFile(
            join(outputRoot, 'AIRI-Display-Process-Env-Test', 'display-config.json'),
            'utf8',
        );
        assert.deepEqual(JSON.parse(configText.replace(/^\uFEFF/, '')), {
            apiBaseUrl: 'https://process.example.test',
            uploadPath: '/process/upload',
        });
    },
);

test(
    'requires explicit authorization before packaging browser-embedded credentials',
    { skip: process.platform !== 'win32' },
    async (t) => {
        const temporaryRoot = await mkdtemp(join(tmpdir(), 'airi-display-credential-gate-'));
        const distPath = join(temporaryRoot, 'dist');
        const environmentPath = join(temporaryRoot, '.env');
        const outputRoot = join(temporaryRoot, 'output');
        await mkdir(distPath);
        await writeFile(join(distPath, 'index.html'), '<div id="root"></div>');
        await writeFile(
            environmentPath,
            [
                'VITE_AIRI_API_BASE_URL=https://api.example.test',
                'VITE_AIRI_AUTH_TOKEN=embedded-test-credential',
            ].join('\n'),
        );
        t.after(() => rm(temporaryRoot, { recursive: true, force: true }));

        const result = await run(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                join(process.cwd(), 'scripts', 'package-display.ps1'),
                '-DistPath',
                distPath,
                '-EnvironmentPath',
                environmentPath,
                '-OutputRoot',
                outputRoot,
                '-PackageName',
                'AIRI-Display-Unauthorized-Test',
            ],
            { cwd: process.cwd() },
        );

        assert.notEqual(result.code, 0);
        assert.match(`${result.stdout}\n${result.stderr}`, /browser-embedded credentials/i);
        await assert.rejects(access(join(outputRoot, 'AIRI-Display-Unauthorized-Test.zip')));
    },
);
