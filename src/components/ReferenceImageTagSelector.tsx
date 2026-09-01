import { referenceImageTags, type ReferenceImageTag } from '../data/referenceImageTags';

type Props = {
    selectedIds: string[];
    onChange: (selectedIds: string[]) => void;
    language: 'en' | 'chs';
    options?: readonly ReferenceImageTag[];
    className?: string;
};

export function ReferenceImageTagSelector({
    selectedIds,
    onChange,
    language,
    options = referenceImageTags,
    className = '',
}: Props) {
    const selected = new Set(selectedIds);
    const toggle = (id: string) => {
        onChange(
            selected.has(id)
                ? selectedIds.filter((selectedId) => selectedId !== id)
                : [...selected, id],
        );
    };

    return (
        <div className={`reference-tag-selector ${className}`.trim()}>
            {options.map((option) => {
                const isSelected = selected.has(option.id);

                return (
                    <button
                        key={option.id}
                        type="button"
                        className={isSelected ? 'selected' : ''}
                        aria-pressed={isSelected}
                        onClick={() => toggle(option.id)}
                    >
                        <span>{option[language]}</span>
                    </button>
                );
            })}
        </div>
    );
}
