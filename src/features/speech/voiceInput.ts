export interface VoiceState {
    isListening: boolean;
    isTranscribing: boolean;
    transcript: string;
    detectedLanguage: string | null;
    error: string | null;
}

export const initialVoiceState: VoiceState = {
    isListening: false,
    isTranscribing: false,
    transcript: '',
    detectedLanguage: null,
    error: null,
};

export const isVoiceInputSupported = () =>
    typeof window !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function';

export function recordingError(error: unknown): string {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError')
        return 'Microphone permission is required.';
    if (name === 'NotFoundError' || name === 'NotReadableError')
        return 'Microphone is unavailable. Check your microphone and try again.';
    return 'Unable to record audio. Please try again.';
}

export async function transcribeAudio(audio: Blob, signal: AbortSignal) {
    if (!audio.size) throw new Error('No audio recorded. Please try again.');
    if (audio.size > 10 * 1024 * 1024)
        throw new Error('Recording is too large. Please record a shorter prompt.');
    const form = new FormData();
    const extension = audio.type.includes('mp4')
        ? 'mp4'
        : audio.type.includes('ogg')
          ? 'ogg'
          : 'webm';
    form.append('audio', audio, `recording.${extension}`);
    const url = (import.meta.env.VITE_SPEECH_API_URL ?? '').replace(/\/$/, '');
    let response: Response;
    try {
        response = await fetch(`${url}/api/transcribe`, {
            method: 'POST',
            body: form,
            signal,
            credentials: 'omit',
        });
    } catch (error) {
        if (signal.aborted) throw error;
        throw new Error('Speech service is unavailable. Check your connection and try again.');
    }
    if (!response.ok) {
        const messages: Record<number, string> = {
            413: 'Recording is too large. Please record a shorter prompt.',
            415: 'This audio format is not supported by the speech service.',
            422: 'Speech could not be recognized reliably. Please record again.',
            429: 'Speech service is busy. Please try again shortly.',
            503: 'Speech service is unavailable. Please try again shortly.',
        };
        throw new Error(
            messages[response.status] ?? 'Unable to transcribe audio. Please try again.',
        );
    }
    let result: unknown;
    try {
        result = await response.json();
    } catch {
        throw new Error('Unable to transcribe audio. Please try again.');
    }
    if (
        !result ||
        typeof result !== 'object' ||
        !('text' in result) ||
        typeof result.text !== 'string' ||
        !('language' in result) ||
        typeof result.language !== 'string' ||
        !result.language.trim()
    ) {
        throw new Error('Unable to transcribe audio. Please try again.');
    }
    if (!result.text.trim()) throw new Error('No speech detected. Please try again.');
    return { text: result.text, language: result.language };
}

interface Dependencies {
    getUserMedia: () => Promise<MediaStream>;
    createRecorder: (stream: MediaStream) => MediaRecorder;
    transcribe: typeof transcribeAudio;
}

const browserDependencies: Dependencies = {
    getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    createRecorder: (stream) => {
        const mimeType = [
            'audio/webm;codecs=opus',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/webm',
        ].find((type) => MediaRecorder.isTypeSupported(type));
        return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    },
    transcribe: transcribeAudio,
};

// A single owner for capture/upload resources also makes cancellation and permission races testable.
export function createVoiceInputController(
    onState: (state: VoiceState) => void,
    onTranscript: (text: string) => void,
    dependencies: Dependencies = browserDependencies,
) {
    let state = { ...initialVoiceState };
    let phase: 'idle' | 'starting' | 'recording' | 'transcribing' = 'idle';
    let generation = 0;
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let upload: AbortController | undefined;
    let recordingTimer: ReturnType<typeof setTimeout> | undefined;
    let uploadTimer: ReturnType<typeof setTimeout> | undefined;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    const update = (next: Partial<VoiceState>) => {
        state = { ...state, ...next };
        onState(state);
    };
    const releaseTracks = () => {
        stream?.getTracks().forEach((track) => track.stop());
        stream = undefined;
    };
    const cleanup = () => {
        clearTimeout(recordingTimer);
        clearTimeout(uploadTimer);
        clearTimeout(stopTimer);
        if (recorder) {
            recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
            if (recorder.state !== 'inactive') {
                try {
                    recorder.stop();
                } catch {
                    /* Device already stopped. */
                }
            }
            recorder = undefined;
        }
        releaseTracks();
        upload?.abort();
        upload = undefined;
    };
    const cancel = (notify = true) => {
        generation++;
        cleanup();
        phase = 'idle';
        if (notify) update({ isListening: false, isTranscribing: false, error: null });
    };
    const fail = (message: string) => {
        generation++;
        cleanup();
        phase = 'idle';
        update({ isListening: false, isTranscribing: false, error: message });
    };
    const stop = () => {
        if (phase === 'starting') {
            cancel();
            return;
        }
        if (phase !== 'recording' || !recorder) return;
        phase = 'transcribing';
        update({ isListening: false, isTranscribing: true });
        clearTimeout(recordingTimer);
        stopTimer = setTimeout(() => fail('Unable to finish recording. Please try again.'), 5000);
        try {
            recorder.stop();
            releaseTracks();
        } catch {
            fail('Unable to finish recording. Please try again.');
        }
    };
    const start = async () => {
        if (phase !== 'idle') return;
        phase = 'starting';
        const current = ++generation;
        update({ ...initialVoiceState, isListening: true });
        try {
            const acquired = await dependencies.getUserMedia();
            if (current !== generation) {
                acquired.getTracks().forEach((track) => track.stop());
                return;
            }
            stream = acquired;
            const active = dependencies.createRecorder(acquired);
            recorder = active;
            const chunks: Blob[] = [];
            let bytes = 0;
            let uploadStarted = false;
            active.ondataavailable = (event) => {
                if (current !== generation || !event.data.size) return;
                bytes += event.data.size;
                if (bytes > 10 * 1024 * 1024) {
                    fail('Recording is too large. Please record a shorter prompt.');
                    return;
                }
                chunks.push(event.data);
            };
            active.onerror = () => {
                if (current === generation) fail('Unable to record audio. Please try again.');
            };
            active.onstop = async () => {
                if (current !== generation || uploadStarted) return;
                uploadStarted = true;
                clearTimeout(recordingTimer);
                clearTimeout(stopTimer);
                releaseTracks();
                phase = 'transcribing';
                update({ isListening: false, isTranscribing: true });
                const controller = new AbortController();
                upload = controller;
                uploadTimer = setTimeout(
                    () => fail('Transcription timed out. Please try a shorter recording.'),
                    120000,
                );
                try {
                    const audio = new Blob(chunks, {
                        type: active.mimeType || chunks[0]?.type || 'audio/webm',
                    });
                    if (!audio.size) throw new Error('No audio recorded. Please try again.');
                    const result = await dependencies.transcribe(audio, controller.signal);
                    if (current !== generation) return;
                    cleanup();
                    phase = 'idle';
                    update({
                        isListening: false,
                        isTranscribing: false,
                        transcript: result.text,
                        detectedLanguage: result.language,
                    });
                    onTranscript(result.text);
                } catch (error) {
                    if (current === generation)
                        fail(
                            error instanceof Error
                                ? error.message
                                : 'Unable to transcribe audio. Please try again.',
                        );
                }
            };
            active.start(1000);
            phase = 'recording';
            recordingTimer = setTimeout(stop, 120000);
        } catch (error) {
            if (current === generation) fail(recordingError(error));
        }
    };
    return { start, stop, cancel, dispose: () => cancel(false) };
}
