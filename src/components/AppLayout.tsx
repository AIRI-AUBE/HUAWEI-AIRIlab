import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
export function AppLayout() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const isHome = pathname === '/';
    const toggle = () => {
        const next = i18n.language.startsWith('en') ? 'chs' : 'en';
        void i18n.changeLanguage(next);
        localStorage.setItem('airi-language', next);
        document.documentElement.lang = next === 'chs' ? 'zh-CN' : 'en';
    };
    return (
        <div className={`app-shell${isHome ? ' app-shell--home' : ''}`}>
            <header className="header">
                <button
                    className="brand"
                    onClick={() => navigate('/')}
                    aria-label={t('common.homeLabel')}
                >
                    <img src="/assets/figma/huawei-logo.svg" alt="" />
                    <span>HUAWEI</span>
                </button>
                <nav className="nav" aria-label={t('common.mainNavigation')}>
                    <NavLink to="/text-to-image">{t('nav.textToImage')}</NavLink>
                    <NavLink to="/image-to-image">{t('nav.imageToImage')}</NavLink>
                </nav>
                <Button variant="ghost" onClick={toggle} aria-label={t('common.switchLanguage')}>
                    {t('nav.language')}
                </Button>
            </header>
            <Outlet />
        </div>
    );
}
