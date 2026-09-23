// Use the visible WebView height, including on engines without dvh support.
// Do not resize the layout for a pinch gesture; only for real viewport/keyboard changes.
const updateViewport = () => {
    const viewport = window.visualViewport;
    const height =
        viewport && Math.abs(viewport.scale - 1) < 0.01
            ? Math.min(window.innerHeight, viewport.height)
            : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    document.documentElement.style.setProperty(
        '--background-height',
        `${window.innerHeight * 1.32}px`,
    );
};
updateViewport();
window.addEventListener('resize', updateViewport);
window.visualViewport?.addEventListener('resize', updateViewport);
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        window.removeEventListener('resize', updateViewport);
        window.visualViewport?.removeEventListener('resize', updateViewport);
    });
}
