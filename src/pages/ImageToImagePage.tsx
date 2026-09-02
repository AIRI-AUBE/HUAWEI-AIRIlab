import { useTranslation } from 'react-i18next';
import { CreativeRefinementPreview } from '../components/CreativeRefinementPreview';
import { ImageUploadField } from '../components/ImageUploadField';
import { OptionGrid, RefinementSection } from '../components/RefinementControls';
import { ReferenceImageTagSelector } from '../components/ReferenceImageTagSelector';
import { V3TemplateSelector } from '../components/V3TemplateSelector';
import options from '../data/imageToImageOptions.json';
import { v3Templates } from '../data/v3/cases';
import { useCreativeRefinement } from '../features/creativeRefinement/CreativeRefinementContext';
import { useCreativeRefinementActions } from '../features/creativeRefinement/useCreativeRefinementActions';

export function ImageToImagePage() {
    const { t, i18n } = useTranslation();
    const language = i18n.language.startsWith('chs') ? 'chs' : 'en';
    const {
        form,
        setForm,
        activeReference,
        setActiveReference,
        templateOpen,
        setTemplateOpen,
        selectedTemplateId,
        baseStatus,
        baseError,
        referenceError,
        referenceStatus,
        referenceLoadingCount,
        templateStatus,
        templateError,
        loadingTemplateId,
        generationStatus,
        generationError,
    } = useCreativeRefinement();
    const actions = useCreativeRefinementActions();

    const activeTags = form.referenceImages[activeReference]?.tags ?? [];
    const templateLoading = templateStatus === 'loading';
    const baseLoading =
        !form.baseImage &&
        (templateLoading || baseStatus === 'validating' || baseStatus === 'uploading');
    const referenceLoading = referenceStatus === 'validating' || referenceStatus === 'uploading';
    const generating = ['validating', 'submitting', 'generating'].includes(generationStatus);
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
                        onSelect={actions.selectTemplate}
                        loadingId={loadingTemplateId}
                    />
                    {templateError && (
                        <p className="template-error" role="alert">
                            {templateError}
                        </p>
                    )}
                    <RefinementSection
                        title={t('imageToImage.baseHeading')}
                        className="refinement-section--base"
                    >
                        <ImageUploadField
                            label={t('imageToImage.baseUpload')}
                            eyebrow={options.baseUploadEyebrow[language]}
                            icon="/assets/figma/upload.svg"
                            images={form.baseImage ? [form.baseImage.previewUrl] : []}
                            onImages={actions.addBase}
                            onRemove={actions.removeBase}
                            statusText={
                                baseStatus === 'validating'
                                    ? t('imageToImage.validating')
                                    : baseStatus === 'uploading'
                                      ? t('imageToImage.uploading')
                                      : undefined
                            }
                            error={baseError}
                            loadingCount={baseLoading ? 1 : 0}
                            loadingText={
                                templateLoading
                                    ? t('imageToImage.loadingTemplate')
                                    : baseStatus === 'validating'
                                      ? t('imageToImage.validating')
                                      : t('imageToImage.uploading')
                            }
                        />
                        <p className="control-label">{t('imageToImage.baseType')}</p>
                        <OptionGrid
                            className="base-types"
                            options={options.baseTypes}
                            language={language}
                            selected={[form.baseImageType]}
                            onToggle={actions.selectBaseImageType}
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
                            onImages={actions.addReferences}
                            onSelect={setActiveReference}
                            onRemove={actions.removeReference}
                            error={referenceError}
                            loadingCount={referenceLoadingCount}
                            loadingText={
                                templateLoading
                                    ? t('imageToImage.loadingTemplate')
                                    : referenceLoading
                                      ? t('imageToImage.uploading')
                                      : undefined
                            }
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
                    disabled={
                        !form.baseImage ||
                        baseStatus !== 'success' ||
                        templateLoading ||
                        referenceLoading ||
                        referenceLoadingCount > 0 ||
                        generating
                    }
                    onClick={actions.startGeneration}
                >
                    {generating ? t('imageToImage.generating') : t('imageToImage.generate')}
                </button>
                {generationError && (
                    <p className="generation-error" role="alert">
                        {generationError}
                    </p>
                )}
            </aside>
            <CreativeRefinementPreview />
        </main>
    );
}
