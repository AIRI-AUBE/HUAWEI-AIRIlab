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
        for (const language of ['en', 'chs']) {
            const c = await b.newContext({ hasTouch: true });
            await c.addInitScript((l) => localStorage.setItem('airi-language', l), language);
            const p = await c.newPage();
            for (const [width, height] of [
                [1280, 744],
                [1024, 584],
                [960, 540],
                [800, 360],
                [640, 360],
                [390, 780],
                [800, 1280],
            ]) {
                await p.setViewportSize({ width, height });
                await p.goto('http://localhost:3000');
                await p.locator('.mode-card').first().waitFor();
                const result = await p.evaluate(() => ({
                    overflow: document.documentElement.scrollWidth > innerWidth + 1,
                    cards: [...document.querySelectorAll('.mode-card')].map((c) => {
                        const text = c.querySelector('p').getBoundingClientRect(),
                            footer = c.querySelector('.mode-card__footer').getBoundingClientRect(),
                            card = c.getBoundingClientRect();
                        return {
                            overlap: text.bottom > footer.top,
                            clipped: footer.bottom > card.bottom,
                            short: c.querySelector('a').getBoundingClientRect().height < 44,
                        };
                    }),
                }));
                const pass =
                    !result.overflow &&
                    result.cards.every((c) => !c.overlap && !c.clipped && !c.short);
                if (!pass) failed++;
                console.log(JSON.stringify({ width, height, language, pass, ...result }));
            }
            await c.close();
        }
    } finally {
        await b.close();
    }
    process.exitCode = failed ? 1 : 0;
})();
