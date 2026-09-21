# Background and prompt-template QA

Date: 2026-09-21

## Source and scope

Source visual truth: `C:/Users/FENGDA~1/AppData/Local/Temp/codex-clipboard-3d6ad51b-0733-496e-8fba-49942de24482.png` plus the requested corrections: white template text, higher contrast, no landscape. The 863 x 594 source is a cropped defect screenshot, not a full viewport reference; source density is unknown. No pixel-perfect layout equivalence is claimed.

Implementation: `http://localhost:3000/text-to-image`, Chinese, template menu open. Desktop capture is 1280 x 800 pixels at 1280 x 800 CSS pixels, density 1. Portrait crop check is 800 x 1280, density 1.

Evidence directory: `D:/codex-home/airi-background-reference-20260921/`.

## Comparison history

- P1: dark template text on navy was illegible in the source screenshot. Fixed `.prompt-option` to white, including selection. Source and corrected `templates-white.png` were opened together in one comparison input. Text is now readable; list copy, typography and spacing remain unchanged.
- P2: bottom landscape remained in the earlier background crop. Increased proportional background overscan from 122% to 132%. `templates-white.png` and `sky-portrait.png` show no landscape at the checked viewports; original image bytes are unchanged.
- Selected and hover states were inspected in `templates-selected.png` and `templates-hover.png`. Selection has a brighter navy background and white text. White-text contrast is 15.03:1 on the normal panel and 7.89:1 on the selected background.

## Fidelity and behavior

- Typography: existing family, size, weight, line height and wrapping retained.
- Layout: no spacing, dimensions, radii or control placement changed. Full-view captures confirm the existing composition. The source is itself a focused template-region reference; menu text is readable at native screenshot size, so no additional magnification was needed.
- Colors: only template foreground/selection styling changed this iteration; Huawei red is retained.
- Imagery: original photo, proportional cover sizing, increased crop; no stretch or replacement assets.
- Content: original Chinese template copy retained. Clicking a template populates the prompt; reopening marks it selected; Escape closes the menu.
- Production build passed; browser errors command returned no errors. No generation request was submitted.

Final result: passed

Scope limitation: targeted styling QA, not an Android-device certification or a full product audit.

## Follow-up: image-to-image sidebar

Source references: `C:/Users/FENGDA~1/AppData/Local/Temp/codex-clipboard-0f6eae4d-b05d-486d-820d-ac2a8be9044a.png` (263 x 828 sidebar crop) and `C:/Users/FENGDA~1/AppData/Local/Temp/codex-clipboard-7b7a51e4-553e-4175-a865-7cc27c152cb8.png` (958 x 825 annotated crop). Source viewport/density are unknown. Scope is the explicitly requested sidebar contrast and separate bottom action area.

- P1 corrected: weak text/icon contrast. Sidebar labels and option text are white; helper text is pale blue. Original upload SVG strokes are white, and the reference icon renders at its native 32px size to avoid a tiny nested icon. Selected options use blue fill and a white border.
- P2 corrected: button overlaid the scrollable form. The form now flexes above a non-scrolling footer with a solid navy background and divider. Generation errors participate in layout below the footer instead of overlapping it.
- Post-fix evidence: `panel-footer.png`, `panel-footer-scrolled.png`, and `panel-footer-1024.png` in the evidence directory above. The annotated source and scrolled implementation were opened together; the sidebar controls and footer were inspected at readable native size. At 1280 x 800, the form bottom and footer top both equal 704px, and footer top remains 704px after scrolling. Footer bottom is 777px, within the viewport. Also checked at 1024 x 768.
- Typography and copy retained; spacing changes limited to the footer allocation and form bottom padding. Source photo, Huawei branding, and enabled red button color retained. Disabled button retains its darker red background while its label stays white; disabled semantics are unchanged. Browser console errors: none reported. Production build: passed. No API generation submitted.

Follow-up final result: passed

## Subsequent tablet assessment (not changed in this commit)

The targeted contrast/footer checks above passed, but the later broader tablet check found existing portrait limitations at 800 x 1280 CSS pixels: the image-to-image preview exceeds the workspace by 96px and is clipped; the text-to-image template trigger shrinks to 48px while its content needs 111px. Landscape layouts fit at 1280 x 800 and 1024 x 640. Category buttons are about 37 x 29px with 10px text, so touch sizing remains a follow-up. These findings were reported to the user before the commit request. No portrait or touch-target redesign is included here; overall tablet readiness remains blocked pending those improvements and physical-device testing.
