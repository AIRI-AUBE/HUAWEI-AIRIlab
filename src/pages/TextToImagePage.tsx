import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { defaultPromptTemplates, type PromptTemplate } from '../data/prompts';
import { PromptTemplateModal } from '../components/PromptTemplateModal';

export function TextToImagePage() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const controlsRef = useRef<HTMLDivElement>(null);
  const language: 'en' | 'chs' = i18n.language.startsWith('chs') ? 'chs' : 'en';
  const closeModal = useCallback(() => setIsOpen(false), []);
  const selectPrompt = (template: PromptTemplate) => { setSelectedId(template.id); setPrompt(template[language]); setIsOpen(false); };

  return <main className="text-workspace">
    <section className="preview-card">
      <div className="preview-card__header"><h1>{t('textToImage.preview')}</h1><p>{t('textToImage.previewDescription')}</p></div>
      <div className="preview-canvas"><div className="preview-placeholder"><img className="image-placeholder-icon" src="/assets/figma/preview-placeholder.svg" alt="" /><strong>{t('textToImage.previewDescription')}</strong></div></div>
    </section>
    <section className="prompt-composer" ref={controlsRef}>
      {isOpen && <><button className="prompt-dismiss" type="button" aria-label={t('textToImage.closeTemplates')} onClick={closeModal}/><PromptTemplateModal prompts={defaultPromptTemplates} language={language} selectedId={selectedId} onSelect={selectPrompt} onClose={closeModal}/></>}
      <div className="prompt-composer__row">
        <button type="button" className="square-control" aria-label={t('textToImage.voice')}><img className="voice-icon" src="/assets/figma/voice.svg" alt="" /></button>
        <div className="prompt-field">
          <button type="button" className={`template-trigger${isOpen ? ' template-trigger--open' : ''}`} aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}><img className="template-trigger__icon" src="/assets/figma/prompt-template.svg" alt="" />{t('textToImage.template')}<img className="template-trigger__chevron" src="/assets/figma/prompt-chevron.svg" alt="" /></button>
          <textarea value={prompt} onChange={event => setPrompt(event.target.value)} aria-label={t('textToImage.promptLabel')} placeholder={t('textToImage.promptPlaceholder')} rows={2}/>
        </div>
        {/* <button type="button" className="square-control square-control--refresh" aria-label={t('textToImage.refresh')} onClick={() => { setPrompt(''); setSelectedId(null); }}><img className="refresh-icon" src="/assets/figma/refresh.svg" alt="" /></button> */}
      </div>
      <button type="button" className="generate-button"><img src="/assets/figma/sparkles.svg" alt="" />{t('textToImage.start')}</button>
    </section>
  </main>;
}
