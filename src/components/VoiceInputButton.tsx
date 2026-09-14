import type { useVoiceInput } from '../hooks/useVoiceInput';

export function VoiceInputButton({ speech }: { speech: ReturnType<typeof useVoiceInput> }) {
    const label = !speech.isSupported
        ? 'Microphone recording is not supported in this browser. Use HTTPS and a supported browser.'
        : speech.isTranscribing
          ? 'Transcribing...'
          : speech.isListening
            ? 'Stop voice input'
            : 'Start voice input';
    const status = speech.isListening
        ? 'Listening...'
        : speech.isTranscribing
          ? 'Transcribing...'
          : '';
    return (
        <div className="voice-control" title={label}>
            <button
                type="button"
                className={`square-control${speech.isListening ? ' square-control--listening' : ''}`}
                aria-label={label}
                title={label}
                aria-pressed={speech.isListening}
                aria-busy={speech.isTranscribing}
                disabled={!speech.isSupported || speech.isTranscribing}
                onClick={speech.isListening ? speech.stopListening : speech.startListening}
            >
                <img className="voice-icon" src="/assets/figma/voice.svg" alt="" />
                {(speech.isListening || speech.isTranscribing) && (
                    <span className="voice-indicator" aria-hidden="true">
                        {speech.isTranscribing ? '…' : '■'}
                    </span>
                )}
            </button>
            <span role="status">{status && <span className="voice-status">{status}</span>}</span>
            {speech.error && (
                <span className="voice-status" role="alert">
                    {speech.error}
                </span>
            )}
        </div>
    );
}
