const fs = require('fs'),
    http = require('http'),
    path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../dist');
const output =
    process.env.AIRI_QA_OUTPUT || path.join(require('os').tmpdir(), 'airi-responsive-qa');
fs.mkdirSync(output, { recursive: true });
const legacy = process.argv.includes('--legacy');
const server = http.createServer((q, s) => {
    let f = path.join(root, new URL(q.url, 'http://localhost').pathname);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
    const ext = path.extname(f);
    s.setHeader(
        'Content-Type',
        {
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.html': 'text/html',
            '.svg': 'image/svg+xml',
            '.jpg': 'image/jpeg',
        }[ext] || 'application/octet-stream',
    );
    let b = fs.readFileSync(f);
    if (legacy && ext === '.css')
        b = b.toString().replace(/[\w-]+:[^;{}]*\b\d*(?:dvh|lvh|svh)[^;{}]*(?:;|(?=}))/g, '');
    s.end(b);
});
(async () => {
    await new Promise((r) => server.listen(4179, '127.0.0.1', r));
    const browser = await chromium.launch({
        executablePath:
            process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true,
    });
    let failures = [];
    try {
        const c = await browser.newContext({ hasTouch: true, deviceScaleFactor: 2 });
        await c.route('**/*', (r) =>
            new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort(),
        );
        await c.addInitScript(
            (language) => localStorage.setItem('airi-language', language),
            process.env.AIRI_QA_LANGUAGE || 'en',
        );
        const p = await c.newPage();
        for (const [width, height] of [
            [1024, 608],
            [1280, 752],
            [960, 540],
            [800, 360],
            [640, 360],
            [390, 780],
            [800, 1280],
        ]) {
            await p.setViewportSize({ width, height });
            for (const route of ['image-to-image', 'text-to-image']) {
                await p.goto('http://127.0.0.1:4179/' + route);
                await p.locator('main').waitFor();
                const data = await p.evaluate(() => {
                    const button = document.querySelector('.refinement-generate, .generate-button');
                    const scroll = document.querySelector('.refinement-panel__scroll');
                    const b = button?.getBoundingClientRect();
                    return {
                        buttonBottom: b?.bottom,
                        buttonTop: b?.top,
                        viewport: innerHeight,
                        overflow: document.documentElement.scrollWidth > innerWidth + 1,
                        scroll: scroll && [scroll.clientHeight, scroll.scrollHeight],
                        docHeight: document.documentElement.scrollHeight,
                    };
                });
                if (
                    data.buttonBottom == null ||
                    data.overflow ||
                    ((width > 640 || route === 'text-to-image') && data.buttonBottom > height + 1)
                )
                    failures.push({ width, height, route, ...data });
                if (width === 1024)
                    await p.screenshot({
                        path: output + '/' + (legacy ? 'legacy' : 'modern') + '-' + route + '.png',
                    });
                console.log(JSON.stringify({ width, height, route, ...data }));
            }
        }
        fs.writeFileSync(
            output + '/' + (legacy ? 'legacy' : 'modern') + '-results.json',
            JSON.stringify(failures, null, 2),
        );
        if (failures.length) {
            console.log('FAILURES', failures.length);
            process.exitCode = 1;
        } else console.log('ALL PASS');
    } finally {
        await browser.close();
        server.close();
    }
})();
