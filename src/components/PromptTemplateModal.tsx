import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { PromptTemplate } from '../data/prompts';

type Props = {
    prompts: PromptTemplate[];
    language: 'en' | 'chs';
    selectedId: string | null;
    onSelect: (prompt: PromptTemplate) => void;
    onClose: () => void;
};

export function PromptTemplateModal({ prompts, language, selectedId, onSelect, onClose }: Props) {
    const { t } = useTranslation();
    const modalRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', closeOnEscape);
        modalRef.current?.focus();
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    return (
        <div
            className="prompt-popover"
            ref={modalRef}
            role="dialog"
            aria-label={t('textToImage.promptTemplatesDialog')}
            tabIndex={-1}
        >
            <div className="prompt-list" role="listbox">
                {prompts.map((prompt) => (
                    <button
                        key={prompt.id}
                        type="button"
                        role="option"
                        aria-selected={selectedId === prompt.id}
                        className={`prompt-option${selectedId === prompt.id ? ' prompt-option--selected' : ''}`}
                        onClick={() => onSelect(prompt)}
                    >
                        {prompt[language]}
                    </button>
                ))}
            </div>
        </div>
    );
}
