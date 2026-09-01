import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
export function WorkspacePage({ mode }: { mode: 'text' | 'image' }) {
    const { t } = useTranslation();
    const prefix = mode === 'text' ? 'text' : 'image';
    return (
        <main className="workspace">
            <span className="workspace__eyebrow">AIRI Explore V3</span>
            <h1>{t(`workspace.${prefix}Title`)}</h1>
            <p>{t(`workspace.${prefix}Description`)}</p>
            <div className="workspace__panel">{t('workspace.comingSoon')}</div>
            <Link to="/">← {t('workspace.back')}</Link>
        </main>
    );
}
