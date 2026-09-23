import { useTranslation } from 'react-i18next';
import { useCreativeRefinement } from '../features/creativeRefinement/CreativeRefinementContext';
import { ResultImage } from './ResultImage';

export function CreativeRefinementPreview() {
    const { t } = useTranslation();
    const { generationStatus, outputs } = useCreativeRefinement();
    const generating = ['validating', 'submitting', 'generating'].includes(generationStatus);
    const primaryOutput = outputs[0];

    return (
        <section className="image-preview-panel">
            <header>
                <h2>{t('imageToImage.preview')}</h2>
                <p>{t('imageToImage.previewDescription')}</p>
            </header>
            <div className="image-preview-canvas">
                <div
                    className={`${primaryOutput ? 'generation-preview--result' : ''}${generating ? ' generation-preview--loading' : ''}`}
                >
                    {generating && <span className="image-skeleton" aria-hidden="true" />}
                    {primaryOutput ? (
                        <ResultImage key={primaryOutput.url} output={primaryOutput} />
                    ) : (
                        <img src="/assets/figma/image-placeholder-large.svg" alt="" />
                    )}
                    {!primaryOutput && !generating && (
                        <strong>{t('imageToImage.previewDescription')}</strong>
                    )}
                    {generating && (
                        <span className="generation-preview__status">
                            {t('imageToImage.generating')}
                        </span>
                    )}
                </div>
            </div>
        </section>
    );
}
