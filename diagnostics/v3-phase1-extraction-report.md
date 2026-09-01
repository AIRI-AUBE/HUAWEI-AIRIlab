# V3 Phase 1 extraction report

- Worksheet: `推敲V3_case`
- Populated Excel rows: 17 (2–18)
- Generated cases: 17
- Embedded images: 66
- Generated and validated WebP files: 66
- Base images: 16
- Ref1 images: 17
- Ref2 images: 11
- Ref3 images: 5
- Expected output images: 17
- Every generated image passed Pillow verify/load and WebP format validation.
- Excel row 4 has no mapped base image; no `base.webp` was created.

## Cases

| Case | Excel row | Type | Base | Ref1 | Ref2 | Ref3 | Output |
|---|---:|---|---|---|---|---|---|
| case-001 | 2 | 建筑 | yes | yes | — | — | yes |
| case-002 | 3 | 建筑 | yes | yes | yes | yes | yes |
| case-003 | 4 | 建筑 | — | yes | yes | yes | yes |
| case-004 | 5 | 建筑 | yes | yes | yes | — | yes |
| case-005 | 6 | 建筑 | yes | yes | yes | — | yes |
| case-006 | 7 | 室内 | yes | yes | yes | yes | yes |
| case-007 | 8 | 室内 | yes | yes | yes | — | yes |
| case-008 | 9 | 室内 | yes | yes | — | — | yes |
| case-009 | 10 | 室内 | yes | yes | — | — | yes |
| case-010 | 11 | 室内 | yes | yes | — | — | yes |
| case-011 | 12 | 景观 | yes | yes | — | — | yes |
| case-012 | 13 | 景观 | yes | yes | yes | yes | yes |
| case-013 | 14 | 景观 | yes | yes | — | — | yes |
| case-014 | 15 | 景观 | yes | yes | yes | yes | yes |
| case-015 | 16 | 规划 | yes | yes | yes | — | yes |
| case-016 | 17 | 规划 | yes | yes | yes | — | yes |
| case-017 | 18 | 规划 | yes | yes | yes | — | yes |
