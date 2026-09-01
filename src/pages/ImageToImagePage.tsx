import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageUploadField } from '../components/ImageUploadField';
import { OptionGrid, RefinementSection } from '../components/RefinementControls';
import { ReferenceImageTagSelector } from '../components/ReferenceImageTagSelector';
import { V3TemplateSelector } from '../components/V3TemplateSelector';
import options from '../data/imageToImageOptions.json';
import {
    caseToFormAssets,
    getV3Case,
    v3Templates,
    type BaseImageType,
    type V3Template,
} from '../data/v3/cases';
import { generate, waitForResult } from '../features/generation/universalGeneration';
import { mapWorkflow44Payload } from '../features/generation/workflow44';
import {
    disposeUploadedImage,
    errorMessage,
    runImageUploadPipeline,
} from '../features/imageUpload/pipeline';
import type { UploadedImage, UploadStatus } from '../features/imageUpload/types';

type V3FormState = {
    baseImageType: BaseImageType;
    baseImage?: UploadedImage;
    referenceImages: UploadedImage[];
    prompt: string;
};

export function ImageToImagePage() {
    const { t, i18n } = useTranslation();
    const language = i18n.language.startsWith('chs') ? 'chs' : 'en';
    const [form, setForm] = useState<V3FormState>({
        baseImageType: 'architecture',
        referenceImages: [],
        prompt: '',
    });
    const [activeReference, setActiveReference] = useState(0);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
    const [expectedOutput, setExpectedOutput] = useState('');
    const [baseStatus, setBaseStatus] = useState<UploadStatus>('idle');
    const [baseError, setBaseError] = useState('');
    const [referenceError, setReferenceError] = useState('');
    const [generating, setGenerating] = useState(false);
    const [generationError, setGenerationError] = useState('');
    const [resultUrl, setResultUrl] = useState('');

    useEffect(
        () => () => {
            if (form.baseImage) disposeUploadedImage(form.baseImage);
            form.referenceImages.forEach(disposeUploadedImage);
        },
        [],
    );

    const addBase = async (files: File[]) => {
        if (!files[0]) return;
        setBaseError('');
        try {
            const image = await runImageUploadPipeline(files[0], 'base-image', setBaseStatus);
            setForm((current) => {
                disposeUploadedImage(current.baseImage);
                return { ...current, baseImage: image };
            });
        } catch (error) {
            setBaseStatus('error');
            setBaseError(errorMessage(error));
        }
    };

    const addReferences = async (files: File[]) => {
        const available = Math.max(0, 3 - form.referenceImages.length);
        setReferenceError(
            files.length > available ? 'Workflow 44 accepts at most three reference images.' : '',
        );
        for (const file of files.slice(0, available)) {
            try {
                const image = await runImageUploadPipeline(file, 'reference-image');
                setForm((current) => ({
                    ...current,
                    referenceImages: [...current.referenceImages, image],
                }));
            } catch (error) {
                setReferenceError(`${file.name}: ${errorMessage(error)}`);
            }
        }
    };

    const removeReference = (index: number) =>
        setForm((current) => {
            disposeUploadedImage(current.referenceImages[index]);
            const next = current.referenceImages.filter((_, itemIndex) => itemIndex !== index);
            setActiveReference((value) => Math.max(0, Math.min(value, next.length - 1)));
            return { ...current, referenceImages: next };
        });

    const selectBaseImageType = (baseImageType: string) => {
        setForm((current) => ({ ...current, baseImageType: baseImageType as BaseImageType }));
        setSelectedTemplateId(undefined);
        setExpectedOutput('');
        setTemplateOpen(false);
    };

    const selectTemplate = (template: V3Template) => {
        const selectedCase = getV3Case(template.caseId);
        if (!selectedCase) return;
        const assets = caseToFormAssets(selectedCase);
        setForm((current) => {
            if (current.baseImage?.file) disposeUploadedImage(current.baseImage);
            current.referenceImages.filter((image) => image.file).forEach(disposeUploadedImage);
            return {
                ...current,
                baseImageType: template.baseImageType,
                baseImage: assets.baseImage,
                referenceImages: assets.referenceImages,
            };
        });
        setBaseStatus(assets.baseImage ? 'success' : 'idle');
        setBaseError('');
        setReferenceError('');
        setActiveReference(0);
        setSelectedTemplateId(template.id);
        setExpectedOutput(assets.expectedOutput);
        setTemplateOpen(false);
    };

    const startGeneration = async () => {
        if (!form.baseImage) return;
        setGenerating(true);
        setGenerationError('');
        try {
            const payload = mapWorkflow44Payload({
                baseImage: form.baseImage,
                referenceImages: form.referenceImages,
                imageType: form.baseImageType,
                prompt: form.prompt,
            });
            const result = await waitForResult(await generate(payload));
            const url = result.outputs.find((output) => typeof output.url === 'string')?.url;
            if (!url) throw new Error('Generation completed without an output image.');
            setResultUrl(url);
        } catch (error) {
            setGenerationError(error instanceof Error ? error.message : 'Generation failed.');
        } finally {
            setGenerating(false);
        }
    };

    const activeTags = form.referenceImages[activeReference]?.tags ?? [];
    return (
        <main className="image-workspace">
            <aside className="refinement-panel">
                <div className="refinement-panel__scroll">
                    <h1>{t('imageToImage.title')}</h1>
                    <V3TemplateSelector
                        open={templateOpen}
                        selectedId={selectedTemplateId}
                        templates={v3Templates}
                        onOpenChange={setTemplateOpen}
                        onSelect={selectTemplate}
                    />
                    <RefinementSection
                        title={t('imageToImage.baseHeading')}
                        className="refinement-section--base"
                    >
                        <ImageUploadField
                            label={t('imageToImage.baseUpload')}
                            eyebrow={options.baseUploadEyebrow[language]}
                            icon="/assets/figma/upload.svg"
                            images={form.baseImage ? [form.baseImage.previewUrl] : []}
                            onImages={addBase}
                            onRemove={() =>
                                setForm((current) => {
                                    disposeUploadedImage(current.baseImage);
                                    setBaseStatus('idle');
                                    setBaseError('');
                                    return { ...current, baseImage: undefined };
                                })
                            }
                            statusText={
                                baseStatus === 'validating'
                                    ? 'Validating image…'
                                    : baseStatus === 'uploading'
                                      ? 'Uploading image…'
                                      : undefined
                            }
                            error={baseError}
                        />
                        <p className="control-label">{t('imageToImage.baseType')}</p>
                        <OptionGrid
                            className="base-types"
                            options={options.baseTypes}
                            language={language}
                            selected={[form.baseImageType]}
                            onToggle={selectBaseImageType}
                        />
                    </RefinementSection>
                    <RefinementSection
                        title={t('imageToImage.referenceHeading')}
                        className="refinement-section--references"
                    >
                        <ImageUploadField
                            label={t('imageToImage.referenceUpload')}
                            icon="/assets/figma/upload-reference.svg"
                            multiple
                            maxImages={3}
                            images={form.referenceImages.map((image) => image.previewUrl)}
                            activeIndex={activeReference}
                            onImages={addReferences}
                            onSelect={setActiveReference}
                            onRemove={removeReference}
                            error={referenceError}
                        />
                        <p className="control-label control-label--tags">
                            {t('imageToImage.tags')}
                        </p>
                        <ReferenceImageTagSelector
                            className="reference-tags"
                            language={language}
                            selectedIds={activeTags}
                            onChange={(tags) =>
                                setForm((current) => ({
                                    ...current,
                                    referenceImages: current.referenceImages.map((image, index) =>
                                        index === activeReference ? { ...image, tags } : image,
                                    ),
                                }))
                            }
                        />
                    </RefinementSection>
                    <RefinementSection
                        title={t('imageToImage.promptHeading')}
                        className="refinement-section--prompt"
                    >
                        <textarea
                            value={form.prompt}
                            onChange={(event) =>
                                setForm((current) => ({ ...current, prompt: event.target.value }))
                            }
                            placeholder={t('imageToImage.promptPlaceholder')}
                        />
                    </RefinementSection>
                </div>
                <button
                    className="refinement-generate"
                    type="button"
                    disabled={!form.baseImage || baseStatus !== 'success' || generating}
                    onClick={startGeneration}
                >
                    {generating ? 'Generating…' : t('imageToImage.generate')}
                </button>
                {generationError && (
                    <p className="generation-error" role="alert">
                        {generationError}
                    </p>
                )}
            </aside>
            <section className="image-preview-panel">
                <header>
                    <h2>{t('imageToImage.preview')}</h2>
                    <p>{t('imageToImage.previewDescription')}</p>
                </header>
                <div className="image-preview-canvas">
                    <div className={expectedOutput && !resultUrl ? 'expected-output' : ''}>
                        <img
                            src={
                                resultUrl ||
                                expectedOutput ||
                                '/assets/figma/image-placeholder-large.svg'
                            }
                            alt={
                                resultUrl
                                    ? 'Generated result'
                                    : expectedOutput
                                      ? 'Expected template output'
                                      : ''
                            }
                        />
                        {!resultUrl && !expectedOutput && (
                            <strong>{t('imageToImage.previewDescription')}</strong>
                        )}
                        {!resultUrl && expectedOutput && <span>Expected output</span>}
                    </div>
                </div>
            </section>
        </main>
    );
}
