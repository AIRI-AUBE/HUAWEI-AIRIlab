import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';

type Props = {
  label: string;
  eyebrow?: string;
  icon: string;
  multiple?: boolean;
  maxImages?: number;
  images: string[];
  activeIndex?: number;
  onImages: (files: File[]) => void;
  onSelect?: (index: number) => void;
  onRemove: (index: number) => void;
};

export function ImageUploadField({ label, eyebrow, icon, multiple = false, maxImages = 1, images, activeIndex = 0, onImages, onSelect, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const accept = (files: File[]) => onImages(files.filter(file => file.type.startsWith('image/')));
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    accept(Array.from(event.dataTransfer.files));
  };
  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length) { event.preventDefault(); accept(files); }
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click(); }
  };

  return <div className={`image-upload${dragging ? ' image-upload--dragging' : ''}${images.length ? ' image-upload--filled' : ''}`}
    role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={keyDown} onPaste={paste}
    onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
    <input ref={inputRef} type="file" accept="image/*" multiple={multiple} hidden onChange={event => { accept(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
    {images.length ? <div className={`image-upload__previews${images.length >= 3 ? ' image-upload__previews--compact' : ''}`}>
      {images.map((src, index) => <button key={src} type="button" className={`upload-preview${activeIndex === index ? ' upload-preview--active' : ''}`}
        onClick={event => { event.stopPropagation(); onSelect?.(index); }} aria-label={`Reference image ${index + 1}`}>
        <img src={src} alt="" />
        <span className="upload-preview__label">Image {index + 1}</span>
        <span className="upload-preview__remove" role="button" tabIndex={0} aria-label={`Remove image ${index + 1}`}
          onClick={event => { event.stopPropagation(); onRemove(index); }}>×</span>
      </button>)}
      {multiple && images.length < maxImages && <span className="upload-preview__add" aria-hidden="true">+</span>}
    </div> : <div className="image-upload__empty">{eyebrow && <span>{eyebrow}</span>}<span className="image-upload__icon"><img src={icon} alt="" /></span><span>{label}</span></div>}
  </div>;
}
