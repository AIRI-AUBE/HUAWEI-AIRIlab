const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE ||
        'C:/Users/fengdayuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
(async () => {
    const b = await chromium.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true,
    });
    let failed = 0;
    try {
        for (const hasTouch of [false, true]) {
            const c = await b.newContext({ hasTouch });
            const p = await c.newPage();
            for (const [width, height] of [
                [800, 1280],
                [390, 844],
                [844, 390],
            ]) {
                await p.setViewportSize({ width, height });
                await p.goto('http://localhost:3000/text-to-image');
                const t = p.locator('.template-trigger');
                await t.waitFor();
                const v = await t.evaluate((e) => ({
                    clipped: e.scrollWidth > e.clientWidth + 1,
                    width: e.getBoundingClientRect().width,
                }));
                const disabled = await p.locator('.generate-button').isDisabled();
                await p.locator('.prompt-field textarea').fill('   ');
                const blank = await p.locator('.generate-button').isDisabled();
                await p.locator('.prompt-field textarea').fill('Architecture');
                const enabled = await p.locator('.generate-button').isEnabled();
                await t.click();
                await p.getByRole('dialog').waitFor();
                const pass = !v.clipped && v.width > 100 && disabled && blank && enabled;
                console.log({ width, hasTouch, pass, ...v });
                if (!pass) failed++;
            }
            await c.close();
        }
    } finally {
        await b.close();
    }
    process.exitCode = failed ? 1 : 0;
})();
