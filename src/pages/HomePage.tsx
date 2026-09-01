import { useTranslation } from 'react-i18next';
import { defaultModes } from '../data/modes';
import { ModeCard } from '../components/ModeCard';
export function HomePage() {
    const { t } = useTranslation();
    return (
        <main className="home">
            <section className="mode-section">
                <div className="mode-heading">
                    <h1>{t('home.title')}</h1>
                    <p>{t('home.tagline')}</p>
                </div>
                <div className="mode-grid">
                    {defaultModes.map((mode) => (
                        <ModeCard key={mode.id} mode={mode} />
                    ))}
                </div>
            </section>
        </main>
    );
}
