import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { BaseImageType, V3Template } from '../data/v3/cases';

type Props = {
    open: boolean;
    selectedId?: string;
    templates: V3Template[];
    onOpenChange: (open: boolean) => void;
    onSelect: (template: V3Template) => void;
    loadingId?: string;
};

const typeOrder: BaseImageType[] = ['architecture', 'interior', 'landscape', 'urban'];

export function V3TemplateSelector({
    open,
    selectedId,
    templates,
    onOpenChange,
    onSelect,
    loadingId,
}: Props) {
    const { t } = useTranslation();
    const rootRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useLayoutEffect(() => {
        if (!open) return;
        const updatePosition = () => {
            const panel = rootRef.current?.closest('.refinement-panel');
            const trigger = rootRef.current?.querySelector('.refinement-template');
            if (!(panel instanceof HTMLElement) || !(trigger instanceof HTMLElement)) return;
            const panelRect = panel.getBoundingClientRect();
            const triggerRect = trigger.getBoundingClientRect();
            setPosition({ top: triggerRect.top - 8, left: panelRect.right });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const close = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
                onOpenChange(false);
            }
        };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [open, onOpenChange]);

    return (
        <div className="template-selector" ref={rootRef}>
            <button
                className={`refinement-template${open ? ' refinement-template--open' : ''}`}
                type="button"
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => onOpenChange(!open)}
            >
                <img src="/assets/figma/template-icon.svg" alt="" />
                <span>{t('imageToImage.template')}</span>
                <img src="/assets/figma/menu-chevron.svg" alt="" />
            </button>
            {open &&
                createPortal(
                    <div
                        className="template-popover"
                        role="dialog"
                        aria-label={t('imageToImage.chooseTemplate')}
                        ref={popoverRef}
                        style={{ top: position.top, left: position.left }}
                    >
                        {typeOrder.map((type) => {
                            const group = templates.filter(
                                (template) => template.baseImageType === type,
                            );
                            if (!group.length) return null;
                            return (
                                <section className="template-group" key={type}>
                                    <h2>{t(`imageToImage.types.${type}`)}</h2>
                                    <div className="template-group__grid">
                                        {group.map((template, index) => (
                                            <button
                                                key={template.id}
                                                type="button"
                                                title={t('imageToImage.templateNumber', {
                                                    number: index + 1,
                                                })}
                                                aria-label={t('imageToImage.templateNumber', {
                                                    number: index + 1,
                                                })}
                                                className={`template-card${selectedId === template.id ? ' template-card--selected' : ''}`}
                                                onClick={() => onSelect(template)}
                                                disabled={Boolean(loadingId)}
                                                aria-busy={loadingId === template.id}
                                            >
                                                <img
                                                    src={template.thumbnail}
                                                    alt=""
                                                    loading="lazy"
                                                    width="80"
                                                    height="92"
                                                />
                                                <span className="template-card__label">
                                                    {loadingId === template.id
                                                        ? t('imageToImage.loadingShort')
                                                        : t('imageToImage.templateNumber', {
                                                              number: index + 1,
                                                          })}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
