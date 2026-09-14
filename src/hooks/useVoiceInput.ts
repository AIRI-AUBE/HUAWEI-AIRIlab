import { useCallback, useEffect, useRef, useState } from 'react';
import {
    createVoiceInputController,
    initialVoiceState,
    isVoiceInputSupported,
} from '../features/speech/voiceInput';

export function useVoiceInput(onFinalTranscript?: (text: string) => void) {
    const [state, setState] = useState(initialVoiceState);
    const latest = useRef(onFinalTranscript);
    latest.current = onFinalTranscript;
    const controller = useRef<ReturnType<typeof createVoiceInputController> | null>(null);
    useEffect(() => {
        const active = createVoiceInputController(setState, (text) => latest.current?.(text));
        controller.current = active;
        return () => {
            active.dispose();
            controller.current = null;
        };
    }, []);
    const startListening = useCallback(() => {
        void controller.current?.start();
    }, []);
    const stopListening = useCallback(() => controller.current?.stop(), []);
    const cancelListening = useCallback(() => controller.current?.cancel(), []);
    return {
        ...state,
        isSupported: isVoiceInputSupported(),
        startListening,
        stopListening,
        cancelListening,
    };
}
