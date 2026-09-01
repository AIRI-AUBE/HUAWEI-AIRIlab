import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Mode } from '../data/modes';
export function ModeCard({ mode }: { mode: Mode }) {
    const { t } = useTranslation();
    return (
        <article className="mode-card">
            <span className="mode-card__number" aria-hidden="true">
                {mode.number}
            </span>
            <div>
                <h2>{t(mode.titleKey)}</h2>
                <p>{t(mode.descriptionKey)}</p>
            </div>
            <div className="mode-card__footer">
                <Link to={mode.path}>
                    {t('home.start')} <span aria-hidden="true">→</span>
                </Link>
                <small>{t('home.configuration')}</small>
            </div>
        </article>
    );
}
