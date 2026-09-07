import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CreativeRefinementPreview } from '../components/CreativeRefinementPreview';
import { ImageUploadField } from '../components/ImageUploadField';
import { OptionGrid, RefinementSection } from '../components/RefinementControls';
import { ReferenceImageTagSelector } from '../components/ReferenceImageTagSelector';
import { V3TemplateSelector } from '../components/V3TemplateSelector';
import options from '../data/imageToImageOptions.json';
import { getReferenceImageTags } from '../data/referenceImageTags';
import { getV3Case, v3Templates } from '../data/v3/cases';
import { useCreativeRefinement } from '../features/creativeRefinement/CreativeRefinementContext';
import { deriveTemplateAssetPresentation } from '../features/creativeRefinement/templatePresentation';
import { useCreativeRefinementActions } from '../features/creativeRefinement/useCreativeRefinementActions';
import {
    hasRequiredImageToImageInputs,
    imageToImagePromptMaxLength,
} from '../features/generation/imageToImage';

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

    useEffect(() => {
        setForm((current) => (current.language === language ? current : { ...current, language }));
    }, [language, setForm]);

    useEffect(() => {
        if (!form.categoryNotice) return;
        const timer = window.setTimeout(
            () =>
                setForm((current) =>
                    current.categoryNotice ? { ...current, categoryNotice: undefined } : current,
                ),
            5000,
        );
        return () => window.clearTimeout(timer);
    }, [form.categoryNotice, setForm]);

    const referenceTagOptions = getReferenceImageTags(form.baseImageType);
    const categoryNoticeLabel = form.categoryNotice
        ? options.baseTypes.find(({ id }) => id === form.categoryNotice)?.[language]
        : undefined;
    const templateLoading = templateStatus === 'loading';
    const loadingCase = loadingTemplateId ? getV3Case(loadingTemplateId) : undefined;
    const assetPresentation = deriveTemplateAssetPresentation({
        form,
        activeReference,
        templateLoading,
        targetHasBaseImage: Boolean(loadingCase?.baseImage),
        targetReferenceCount: [
            loadingCase?.ref1Image,
            loadingCase?.ref2Image,
            loadingCase?.ref3Image,
        ].filter(Boolean).length,
    });
    const baseLoadingCount = templateLoading
        ? assetPresentation.baseLoadingCount
        : !form.baseImage && (baseStatus === 'validating' || baseStatus === 'uploading')
          ? 1
          : 0;
    const visibleReferenceLoadingCount = templateLoading
        ? assetPresentation.referenceLoadingCount
        : referenceLoadingCount;
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
                            images={assetPresentation.baseImages}
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
                            loadingCount={baseLoadingCount}
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
                        <p className="category-options-hint">
                            {t('imageToImage.categoryOptionsHint')}
                        </p>
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
                            images={assetPresentation.referenceImages}
                            activeIndex={activeReference}
                            onImages={actions.addReferences}
                            onSelect={setActiveReference}
                            onRemove={actions.removeReference}
                            error={referenceError}
                            loadingCount={visibleReferenceLoadingCount}
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
                        {categoryNoticeLabel && (
                            <div className="category-reset-notice" role="status">
                                <strong>
                                    {t('imageToImage.categorySwitched', {
                                        category: categoryNoticeLabel,
                                    })}
                                </strong>
                                <span>{t('imageToImage.categoryResetNotice')}</span>
                            </div>
                        )}
                        <ReferenceImageTagSelector
                            className="reference-tags"
                            language={language}
                            options={referenceTagOptions}
                            selectedIds={assetPresentation.activeTags}
                            onChange={actions.updateReferenceTags}
                        />
                    </RefinementSection>
                    <RefinementSection
                        title={t('imageToImage.promptHeading')}
                        className="refinement-section--prompt"
                    >
                        <textarea
                            value={form.prompt}
                            maxLength={imageToImagePromptMaxLength}
                            onChange={(event) => actions.updatePrompt(event.target.value)}
                            placeholder={t('imageToImage.promptPlaceholder')}
                        />
                    </RefinementSection>
                </div>
                <button
                    className="refinement-generate"
                    type="button"
                    disabled={
                        !hasRequiredImageToImageInputs(form) ||
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
