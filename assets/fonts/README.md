# Sinhala Font Files

This directory holds web font files for offline Sinhala text rendering.

## Required Files

| File | Weight | Usage |
|------|--------|-------|
| `NotoSansSinhala-Regular.woff2` | 400 | Body text, paragraphs |
| `NotoSansSinhala-Medium.woff2` | 500 | Buttons, labels, nav items |
| `NotoSansSinhala-Bold.woff2` | 700 | Headings, stat values |

## How to Obtain

1. Visit https://fonts.google.com/noto/specimen/Noto+Sans+Sinhala
2. Download the font family
3. Convert .ttf files to .woff2 using a tool like https://cloudconvert.com/ttf-to-woff2
4. Place the .woff2 files in this directory

Alternatively, use the Google Fonts CSS API to get direct .woff2 URLs:
```
https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;700&display=swap
```
Open that URL in a browser to find the .woff2 file URLs, then download them.

## License

Noto Sans Sinhala is licensed under the SIL Open Font License, Version 1.1.
https://scripts.sil.org/OFL

## Service Worker Caching

When a service worker is added, include these font files in the precache list:
```js
const FONT_ASSETS = [
  '/assets/fonts/NotoSansSinhala-Regular.woff2',
  '/assets/fonts/NotoSansSinhala-Medium.woff2',
  '/assets/fonts/NotoSansSinhala-Bold.woff2',
];
```

## Fallback Behavior

Until font files are added, the CSS font stack falls back to:
- `Iskoola Pota` (Windows built-in Sinhala font)
- `Sinhala Sangam MN` (macOS built-in Sinhala font)
- `system-ui` / `sans-serif`

The `font-display: swap` rule ensures text is visible immediately using a fallback,
then swaps to Noto Sans Sinhala once loaded.
