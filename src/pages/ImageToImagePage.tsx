import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageUploadField } from '../components/ImageUploadField';
import { OptionGrid, RefinementSection } from '../components/RefinementControls';
import options from '../data/imageToImageOptions.json';

type ReferenceImage = { url: string; tags: string[] };

export function ImageToImagePage() {
    const { t, i18n } = useTranslation();
    const language = i18n.language.startsWith('chs') ? 'chs' : 'en';
    const [baseImage, setBaseImage] = useState<string[]>([]);
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [activeReference, setActiveReference] = useState(0);
    const [baseType, setBaseType] = useState('architecture');
    const [prompt, setPrompt] = useState('');
    const addBase = (files: File[]) => {
        const file = files[0];
        if (!file) return;
        setBaseImage((current) => {
            current.forEach(URL.revokeObjectURL);
            return [URL.createObjectURL(file)];
        });
    };
    const addReferences = (files: File[]) =>
        setReferences((current) => {
            const available = Math.max(0, 2 - current.length);
            return [
                ...current,
                ...files.slice(0, available).map((file) => ({
                    url: URL.createObjectURL(file),
                    tags: ['design', 'materials', 'style'],
                })),
            ];
        });
    const removeReference = (index: number) =>
        setReferences((current) => {
            URL.revokeObjectURL(current[index].url);
            const next = current.filter((_, itemIndex) => itemIndex !== index);
            setActiveReference((value) => Math.max(0, Math.min(value, next.length - 1)));
            return next;
        });
    const toggleTag = (tag: string) =>
        setReferences((current) =>
            current.map((image, index) =>
                index === activeReference
                    ? {
                          ...image,
                          tags: image.tags.includes(tag)
                              ? image.tags.filter((item) => item !== tag)
                              : [...image.tags, tag],
                      }
                    : image,
            ),
        );
    const selectedTags = references[activeReference]?.tags ?? [];

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
                            images={baseImage}
                            onImages={addBase}
                            onRemove={() => setBaseImage([])}
                        />
                        <p className="control-label">{t('imageToImage.baseType')}</p>
                        <OptionGrid
                            className="base-types"
                            options={options.baseTypes}
                            language={language}
                            selected={[baseType]}
                            onToggle={setBaseType}
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
                            maxImages={2}
                            images={references.map((image) => image.url)}
                            activeIndex={activeReference}
                            onImages={addReferences}
                            onSelect={setActiveReference}
                            onRemove={removeReference}
                        />
                        <p className="control-label control-label--tags">
                            {t('imageToImage.tags')}
                        </p>
                        <OptionGrid
                            className="reference-tags"
                            options={options.referenceTags}
                            language={language}
                            selected={selectedTags}
                            disabled={!references.length}
                            onToggle={toggleTag}
                        />
                    </RefinementSection>
                    <RefinementSection
                        title={t('imageToImage.promptHeading')}
                        className="refinement-section--prompt"
                    >
                        <textarea
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            placeholder={t('imageToImage.promptPlaceholder')}
                        />
                    </RefinementSection>
                </div>
                <button className="refinement-generate" type="button" disabled={!baseImage.length}>
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
