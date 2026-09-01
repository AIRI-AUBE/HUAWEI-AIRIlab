import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageUploadField } from '../components/ImageUploadField';
import { OptionGrid, RefinementSection } from '../components/RefinementControls';
import { ReferenceImageTagSelector } from '../components/ReferenceImageTagSelector';
import options from '../data/imageToImageOptions.json';

type ReferenceImage = { previewUrl: string };

type V3FormState = {
    baseImageType: string;
    baseImage: string[];
    referenceImages: ReferenceImage[];
    referenceImageTags: string[];
    prompt: string;
};

export function ImageToImagePage() {
    const { t, i18n } = useTranslation();
    const language = i18n.language.startsWith('chs') ? 'chs' : 'en';
    const [form, setForm] = useState<V3FormState>({
        baseImageType: 'architecture',
        baseImage: [],
        referenceImages: [],
        referenceImageTags: [],
        prompt: '',
    });
    const [activeReference, setActiveReference] = useState(0);
    const addBase = (files: File[]) => {
        const file = files[0];
        if (!file) return;
        setForm((current) => {
            current.baseImage.forEach(URL.revokeObjectURL);
            return { ...current, baseImage: [URL.createObjectURL(file)] };
        });
    };
    const addReferences = (files: File[]) =>
        setForm((current) => {
            const available = Math.max(0, 3 - current.referenceImages.length);
            return {
                ...current,
                referenceImages: [
                    ...current.referenceImages,
                    ...files.slice(0, available).map((file) => ({
                        previewUrl: URL.createObjectURL(file),
                    })),
                ],
            };
        });
    const removeReference = (index: number) =>
        setForm((current) => {
            URL.revokeObjectURL(current.referenceImages[index].previewUrl);
            const next = current.referenceImages.filter((_, itemIndex) => itemIndex !== index);
            setActiveReference((value) => Math.max(0, Math.min(value, next.length - 1)));
            return { ...current, referenceImages: next };
        });

    return (
        <main className="image-workspace">
            <aside className="refinement-panel">
                <div className="refinement-panel__scroll">
                    <h1>{t('imageToImage.title')}</h1>
                    <button className="refinement-template" type="button">
                        <img src="/assets/figma/template-icon.svg" alt="" />
                        {t('imageToImage.template')}
                        <img src="/assets/figma/menu-chevron.svg" alt="" />
                    </button>
                    <RefinementSection
                        title={t('imageToImage.baseHeading')}
                        className="refinement-section--base"
                    >
                        <ImageUploadField
                            label={t('imageToImage.baseUpload')}
                            eyebrow={options.baseUploadEyebrow[language]}
                            icon="/assets/figma/upload.svg"
                            images={form.baseImage}
                            onImages={addBase}
                            onRemove={() => setForm((current) => ({ ...current, baseImage: [] }))}
                        />
                        <p className="control-label">{t('imageToImage.baseType')}</p>
                        <OptionGrid
                            className="base-types"
                            options={options.baseTypes}
                            language={language}
                            selected={[form.baseImageType]}
                            onToggle={(baseImageType) =>
                                setForm((current) => ({ ...current, baseImageType }))
                            }
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
                        />
                        <p className="control-label control-label--tags">
                            {t('imageToImage.tags')}
                        </p>
                        <ReferenceImageTagSelector
                            className="reference-tags"
                            language={language}
                            selectedIds={form.referenceImageTags}
                            onChange={(referenceImageTags) =>
                                setForm((current) => ({ ...current, referenceImageTags }))
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
                                setForm((current) => ({
                                    ...current,
                                    prompt: event.target.value,
                                }))
                            }
                            placeholder={t('imageToImage.promptPlaceholder')}
                        />
                    </RefinementSection>
                </div>
                <button
                    className="refinement-generate"
                    type="button"
                    disabled={!form.baseImage.length}
                >
                    {t('imageToImage.generate')}
                </button>
            </aside>
            <section className="image-preview-panel">
                <header>
                    <h2>{t('imageToImage.preview')}</h2>
                    <p>{t('imageToImage.previewDescription')}</p>
                </header>
                <div className="image-preview-canvas">
                    <div>
                        <img src="/assets/figma/image-placeholder-large.svg" alt="" />
                        <strong>{t('imageToImage.previewDescription')}</strong>
                    </div>
                </div>
            </section>
        </main>
    );
}
