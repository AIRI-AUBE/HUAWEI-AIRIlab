export function insertSpeech(text: string, speech: string, start: number, end = start) {
    const spoken = speech.trim();
    if (!spoken) return { text, cursor: start };
    const left = text.slice(0, start);
    const right = text.slice(end);
    const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
    const separator = (a: string, b: string) =>
        a &&
        b &&
        !/\s$/u.test(a) &&
        !/^\s|^[,.;:!?，。！？、)\]}]/u.test(b) &&
        !/[([{]$/u.test(a) &&
        !cjk.test(a.slice(-1)) &&
        !cjk.test(b[0])
            ? ' '
            : '';
    const insertion = separator(left, spoken) + spoken;
    return {
        text: left + insertion + separator(spoken, right) + right,
        cursor: left.length + insertion.length,
    };
}
