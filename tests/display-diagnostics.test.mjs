import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
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
    'writes a passing diagnostic report when localhost and the API boundary are reachable',
    { skip: process.platform !== 'win32' },
    async (t) => {
        const outputDir = await mkdtemp(join(tmpdir(), 'airi-diagnostics-'));
        const reportPath = join(outputDir, 'AIRI-Diagnostic-Report.txt');
        const server = createServer((request, response) => {
            if (request.method === 'OPTIONS') {
                response.writeHead(204, {
                    'Access-Control-Allow-Origin': 'http://localhost:3000',
                    'Access-Control-Allow-Methods': 'POST',
                    'Access-Control-Allow-Headers': 'authorization',
                });
                response.end();
                return;
            }
            response.writeHead(200, { 'Content-Type': 'text/html' });
            response.end('<div id="root"></div>');
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        assert(address && typeof address === 'object');

        t.after(async () => {
            await new Promise((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve())),
            );
            await rm(outputDir, { recursive: true, force: true });
        });

        const result = await run(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                join(process.cwd(), 'scripts', 'display-package', 'diagnose-upload.ps1'),
                '-ReportPath',
                reportPath,
                '-LocalUrl',
                `http://127.0.0.1:${address.port}`,
                '-ApiHost',
                '127.0.0.1',
                '-ApiPort',
                String(address.port),
                '-UploadUrl',
                `http://127.0.0.1:${address.port}/upload`,
                '-Origin',
                'http://localhost:3000',
            ],
            { cwd: process.cwd() },
        );

        assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
        const report = await readFile(reportPath, 'utf8');
        assert.match(report, /\[PASS\] Node\.js:/);
        assert.match(report, /\[PASS\] Local website: HTTP 200/);
        assert.match(report, /\[PASS\] API port:/);
        assert.match(report, /\[PASS\] API CORS: HTTP 204; localhost origin allowed/);
        assert.match(report, /OVERALL RESULT: PASS/);
    },
);

test(
    'directs support to the display server when the local website is unreachable',
    { skip: process.platform !== 'win32' },
    async (t) => {
        const outputDir = await mkdtemp(join(tmpdir(), 'airi-diagnostics-'));
        const reportPath = join(outputDir, 'AIRI-Diagnostic-Report.txt');
        const apiServer = createServer((request, response) => {
            if (request.method === 'OPTIONS') {
                response.writeHead(204, {
                    'Access-Control-Allow-Origin': 'http://localhost:3000',
                    'Access-Control-Allow-Methods': 'POST',
                    'Access-Control-Allow-Headers': 'authorization',
                });
                response.end();
                return;
            }
            response.writeHead(404);
            response.end();
        });
        await new Promise((resolve) => apiServer.listen(0, '127.0.0.1', resolve));
        const address = apiServer.address();
        assert(address && typeof address === 'object');

        t.after(async () => {
            await new Promise((resolve, reject) =>
                apiServer.close((error) => (error ? reject(error) : resolve())),
            );
            await rm(outputDir, { recursive: true, force: true });
        });

        const result = await run(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                join(process.cwd(), 'scripts', 'display-package', 'diagnose-upload.ps1'),
                '-ReportPath',
                reportPath,
                '-LocalUrl',
                'http://127.0.0.1:1',
                '-ApiHost',
                '127.0.0.1',
                '-ApiPort',
                String(address.port),
                '-UploadUrl',
                `http://127.0.0.1:${address.port}/upload`,
                '-Origin',
                'http://localhost:3000',
            ],
            { cwd: process.cwd() },
        );

        assert.notEqual(result.code, 0, `${result.stdout}\n${result.stderr}`);
        const report = await readFile(reportPath, 'utf8');
        assert.match(report, /\[FAIL\] Local website:/);
        assert.match(report, /NEXT ACTION: START_LOCAL_SERVER/);
    },
);
test(
    'rejects a CORS preflight that omits POST or the authorization header',
    { skip: process.platform !== 'win32' },
    async (t) => {
        const outputDir = await mkdtemp(join(tmpdir(), 'airi-diagnostics-cors-'));
        const reportPath = join(outputDir, 'AIRI-Diagnostic-Report.txt');
        const server = createServer((request, response) => {
            if (request.method === 'OPTIONS') {
                response.writeHead(204, {
                    'Access-Control-Allow-Origin': 'http://localhost:3000',
                    'Access-Control-Allow-Methods': 'GET',
                    'Access-Control-Allow-Headers': 'content-type',
                });
                response.end();
                return;
            }
            response.writeHead(200, { 'Content-Type': 'text/html' });
            response.end('<div id="root"></div>');
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        assert(address && typeof address === 'object');

        t.after(async () => {
            await new Promise((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve())),
            );
            await rm(outputDir, { recursive: true, force: true });
        });

        const result = await run(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                join(process.cwd(), 'scripts', 'display-package', 'diagnose-upload.ps1'),
                '-ReportPath',
                reportPath,
                '-LocalUrl',
                `http://127.0.0.1:${address.port}`,
                '-ApiHost',
                '127.0.0.1',
                '-ApiPort',
                String(address.port),
                '-UploadUrl',
                `http://127.0.0.1:${address.port}/upload`,
            ],
            { cwd: process.cwd() },
        );

        assert.notEqual(result.code, 0, `${result.stdout}\n${result.stderr}`);
        const report = await readFile(reportPath, 'utf8');
        assert.match(report, /\[FAIL\] API CORS:/);
        assert.match(report, /POST allowed=False/);
        assert.match(report, /authorization allowed=False/);
    },
);

test(
    'fails when Node.js architecture does not match 64-bit Windows',
    { skip: process.platform !== 'win32' || process.arch !== 'x64' },
    async (t) => {
        const outputDir = await mkdtemp(join(tmpdir(), 'airi-diagnostics-arch-'));
        const reportPath = join(outputDir, 'AIRI-Diagnostic-Report.txt');
        const fakeNodePath = join(outputDir, 'fake-node.cmd');
        await writeFile(
            fakeNodePath,
            '@echo off\r\nif "%1"=="--version" echo v24.0.0\r\nif "%1"=="-p" echo arm64\r\n',
        );
        t.after(() => rm(outputDir, { recursive: true, force: true }));

        const result = await run(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                join(process.cwd(), 'scripts', 'display-package', 'diagnose-upload.ps1'),
                '-ReportPath',
                reportPath,
                '-NodeExecutable',
                fakeNodePath,
                '-LocalUrl',
                'http://127.0.0.1:1',
                '-ApiHost',
                '127.0.0.1',
                '-ApiPort',
                '1',
                '-UploadUrl',
                'http://127.0.0.1:1/upload',
            ],
            { cwd: process.cwd() },
        );

        assert.notEqual(result.code, 0);
        const report = await readFile(reportPath, 'utf8');
        assert.match(report, /\[FAIL\] Node\.js architecture mismatch: Windows=X64; Node=arm64/);
    },
);
