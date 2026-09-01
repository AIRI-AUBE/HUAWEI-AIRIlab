import type { ReactNode } from 'react';

type Option = { id: string; en: string; chs: string };

export function RefinementSection({
    title,
    className = '',
    children,
}: {
    title: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={`refinement-section ${className}`.trim()}>
            <h2>{title}</h2>
            {children}
        </section>
    );
}

export function OptionGrid({
    options,
    language,
    selected,
    onToggle,
    disabled = false,
    className,
}: {
    options: Option[];
    language: 'en' | 'chs';
    selected: string[];
    onToggle: (id: string) => void;
    disabled?: boolean;
    className: string;
}) {
    return (
        <div className={className}>
            {options.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    disabled={disabled}
                    className={selected.includes(option.id) ? 'selected' : ''}
                    onClick={() => onToggle(option.id)}
                >
                    <span>{option[language]}</span>
                </button>
            ))}
        </div>
    );
}
