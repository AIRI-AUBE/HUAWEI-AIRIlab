import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { defaultPromptTemplates, type PromptTemplate } from '../data/prompts';
import { PromptTemplateModal } from '../components/PromptTemplateModal';
import { generate, waitForResult } from '../features/generation/universalGeneration';
import { mapTextToImagePayload } from '../features/generation/textToImage';
import type { GenerationOutput } from '../features/generation/types';

type GenerationStatus = 'idle' | 'submitting' | 'generating' | 'completed' | 'failed';

export function TextToImagePage() {
    const { t, i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
    const [generationError, setGenerationError] = useState('');
    const [output, setOutput] = useState<GenerationOutput>();
    const controlsRef = useRef<HTMLDivElement>(null);
    const generationLock = useRef(false);
    const generationAbort = useRef<AbortController | undefined>(undefined);
    const language: 'en' | 'chs' = i18n.language.startsWith('chs') ? 'chs' : 'en';
    const closeModal = useCallback(() => setIsOpen(false), []);
    const selectPrompt = (template: PromptTemplate) => {
        setSelectedId(template.id);
        setPrompt(template[language]);
        setIsOpen(false);
    };
    const generating = generationStatus === 'submitting' || generationStatus === 'generating';

    useEffect(() => () => generationAbort.current?.abort(), []);

    const startGeneration = async () => {
        const submittedPrompt = prompt.trim();
        if (!submittedPrompt || generationLock.current) return;

        generationLock.current = true;
        generationAbort.current?.abort();
        const controller = new AbortController();
        generationAbort.current = controller;
        setGenerationError('');
        setOutput(undefined);

        try {
            const payload = mapTextToImagePayload({
                prompt: submittedPrompt,
            });
            setGenerationStatus('submitting');
            const jobId = await generate(payload, controller.signal);
            setGenerationStatus('generating');
            const result = await waitForResult(jobId, { signal: controller.signal });
            const generatedOutput = (result.outputs ?? []).find(
                (item) => typeof item.url === 'string' && item.url.length > 0,
            );
            if (!generatedOutput) {
                throw new Error('Generation completed without an output image.');
            }
            setOutput(generatedOutput);
            setGenerationStatus('completed');
        } catch (error) {
            if (controller.signal.aborted) return;
            setGenerationStatus('failed');
            setGenerationError(
                error instanceof Error ? error.message : t('textToImage.generationFailed'),
            );
        } finally {
            if (generationAbort.current === controller) {
                generationAbort.current = undefined;
                generationLock.current = false;
            }
        }
    };

    return (
        <main className="text-workspace">
            <section className="preview-card">
                <div className="preview-card__header">
                    <h1>{t('textToImage.preview')}</h1>
                    <p>{t('textToImage.previewDescription')}</p>
                </div>
                <div className="preview-canvas">
                    <div
                        className={`preview-placeholder${output ? ' preview-placeholder--result' : ''}${generating ? ' generation-preview--loading' : ''}`}
                    >
                        {generating && <span className="image-skeleton" aria-hidden="true" />}
                        {output ? (
                            <img
                                className="text-generation-output"
                                src={output.thumbnail || output.url}
                                alt={t('textToImage.generatedImageAlt')}
                            />
                        ) : !generating ? (
                            <>
                                <img
                                    className="image-placeholder-icon"
                                    src="/assets/figma/preview-placeholder.svg"
                                    alt=""
                                />
                                <strong>{t('textToImage.previewDescription')}</strong>
                            </>
                        ) : null}
                        {generating && (
                            <span className="generation-preview__status">
                                {t('textToImage.generating')}
                            </span>
                        )}
                    </div>
                </div>
            </section>
            <section className="prompt-composer" ref={controlsRef}>
                {isOpen && (
                    <>
                        <button
                            className="prompt-dismiss"
                            type="button"
                            aria-label={t('textToImage.closeTemplates')}
                            onClick={closeModal}
                        />
                        <PromptTemplateModal
                            prompts={defaultPromptTemplates}
                            language={language}
                            selectedId={selectedId}
                            onSelect={selectPrompt}
                            onClose={closeModal}
                        />
                    </>
                )}
                <div className="prompt-composer__row">
                    <button
                        type="button"
                        className="square-control"
                        aria-label={t('textToImage.voice')}
                    >
                        <img className="voice-icon" src="/assets/figma/voice.svg" alt="" />
                    </button>
                    <div className="prompt-field">
                        <button
                            type="button"
                            className={`template-trigger${isOpen ? ' template-trigger--open' : ''}`}
                            aria-haspopup="dialog"
                            aria-expanded={isOpen}
                            onClick={() => setIsOpen((open) => !open)}
                        >
                            <img
                                className="template-trigger__icon"
                                src="/assets/figma/prompt-template.svg"
                                alt=""
                            />
                            {t('textToImage.template')}
                            <img
                                className="template-trigger__chevron"
                                src="/assets/figma/prompt-chevron.svg"
                                alt=""
                            />
                        </button>
                        <textarea
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            aria-label={t('textToImage.promptLabel')}
                            placeholder={t('textToImage.promptPlaceholder')}
                            rows={2}
                        />
                    </div>
                    {/* <button type="button" className="square-control square-control--refresh" aria-label={t('textToImage.refresh')} onClick={() => { setPrompt(''); setSelectedId(null); }}><img className="refresh-icon" src="/assets/figma/refresh.svg" alt="" /></button> */}
                </div>
                <button
                    type="button"
                    className="generate-button"
                    disabled={!prompt.trim() || generating}
                    onClick={startGeneration}
                >
                    <img src="/assets/figma/sparkles.svg" alt="" />
                    {generating ? t('textToImage.generating') : t('textToImage.start')}
                </button>
                {generationError && (
                    <p className="text-generation-error" role="alert">
                        {generationError}
                    </p>
                )}
            </section>
        </main>
    );
}
