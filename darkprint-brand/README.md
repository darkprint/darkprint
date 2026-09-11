# DarkPrint brand marks

Rendered from `components/site/Logo.tsx` at the 64 rung (the full three-node mark with back
plate, tab and perforation), with theme tokens resolved to hex from `app/globals.css`. Not
hand-drawn and not a screenshot: regenerate rather than edit. The palette is untouched.

Each mark is trimmed to its ink bounds and centred, then set to 72% of the canvas width, so
Instagram's circular crop clears it. The component itself does not centre: it reserves air
under the flap so the mark can sit on a text baseline.

## Which folder

| Folder | Mark | Ground |
| --- | --- | --- |
| `on-black/` | dark pole, three node colours | `--color-void` #05060d |
| `on-white/` | sheet pole, one ink | #ffffff |
| `on-white-alt-dark-mark/` | dark pole, three node colours | #ffffff |
| `transparent/` | **dark pole** | none |

Sizes in every folder: `github-500`, `linkedin-300`, `linkedin-400`, `instagram-320`,
`master-1024`, `master-2048`. Vector sources are `mark-dark.svg` and `mark-sheet.svg`.

| File | Use |
| --- | --- |
| `github-500.png` | GitHub org / user avatar (min 200, max 1 MB) |
| `linkedin-300.png` | LinkedIn company logo, the size they ask for |
| `linkedin-400.png` | LinkedIn, with headroom |
| `instagram-320.png` | Instagram profile; crops to a circle |
| `master-*.png` | anything else; downscale from these |

## LinkedIn banners

Two formats, because "profile" is ambiguous and they are different jobs.

| File | Size | Use |
| --- | --- | --- |
| `linkedin-company-cover-1128x191.png` | 1128 x 191 | company **page** cover, the tight band |
| `linkedin-profile-background-1584x396.png` | 1584 x 396 | **personal** profile background |

In `on-black/` (primary) and `on-white/`. Composed from the site's own parts, not retyped:
the wordmark is `WORDMARK_LETTER_PATHS` laid out with the hero's own -3.5 tracking and its
"Dark" / "Print" tone split at index 4; the tagline is `SITE_TAGLINE` read from `lib/site.ts`
and set in the real Geist Regular that ships inside `@vercel/og`, which is the face
`app/opengraph-image.tsx` renders it in; the grid paper and the token copies follow that same
file. The mark is the one in `on-black/`.

### Safe area assumed

LinkedIn overlays the avatar or company logo on the **lower left** of both formats and
re-crops responsively, taking the sides on narrow viewports. Everything readable is kept
inside a right-hand block:

| Format | left edge of content | outer margin | block actually spans |
| --- | --- | --- | --- |
| 1128 x 191 | 300 px | 32 px | x 667 -> 1096 |
| 1584 x 396 | 420 px | 72 px | x 727 -> 1512 |

The block is also lifted slightly above centre (46% / 44% of height) to clear the overlay,
which hangs below the banner's bottom edge. Check these against LinkedIn's current chrome
before publishing; they are my assumption, not a measurement of their UI.

The 191 band is laid out for its own ratio rather than being the 396 composition shrunk:
larger mark relative to height (46% vs 40%), tighter 32 px grid pitch instead of 48. The
tagline survives at that height and was kept; nothing had to be dropped.

## GitHub README banner

`readme-banner-1600x400.png`, in `on-black/` and `on-white/`. 4:1, so it lands near 210 px
tall at GitHub's default content width and the 2x is there for retina.

Unlike the LinkedIn banners this one is **centred**: nothing overlays a README, so the empty
left third those need would read as a mistake here. Mark, wordmark and tagline sit as one
block on the canvas centre with 384 px of air each side. Same parts as the others, same
grid-paper ground.

Both grounds exist so a README can pick by theme:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="darkprint-brand/on-black/readme-banner-1600x400.png">
  <img alt="DarkPrint: Reusable blueprints for agent workflows" src="darkprint-brand/on-white/readme-banner-1600x400.png">
</picture>
```

**Weight, because these two are committed.** 14.7 KB and 14.5 KB. They are 8-bit palette
PNGs: the artwork is flat colour and antialiased edges, so quantising costs a mean of
0.07/255 per channel with under 0.1% of channels moving by more than 8 — visually lossless
here. Full-colour PNG was 52.8 / 48.6 KB and WebP 19.6 / 20.1 KB, so the palette PNG is both
the smallest and the most widely supported. Re-encoding one of these through a tool that
drops the palette doubles it; copy the file rather than round-tripping it.

## What white costs the mark, measured

Two elements are low-contrast on purpose and rely on a dark ground to separate. Against
white they weaken rather than disappear, but they are weaker than the design assumes.

| Element | on black | on white (sheet) |
| --- | --- | --- |
| flap body | 1.25:1 | 12.34:1 |
| flap stroke | 9.36:1 | 1.31:1 |
| back plate + tab @30% | 1.75:1 | 1.08:1 |

The back plate at 1.08:1 renders as #f1f6ff, a hair off white. It still registers as a shape
down to 300 px, but it is the first thing to go if the avatar is downscaled further or shown
on an off-white card. The flap stroke's 1.31:1 reads better than the number suggests: it sits
against the deep-blue flap, so the eye takes it as a gap rather than as an outline.

**The real difference is not contrast.** On the sheet pole every node is one ink by design
(`TONES.sheet`), so `on-white/` loses the trigger / planner / ship colours that carry the
mark's meaning. `on-white-alt-dark-mark/` is the dark mark on white: the flap goes to 16.21:1,
the back plate to 1.24:1, and the three colours survive. Nothing was recoloured to get that —
it is the other pole the component already ships.

For a white ground the alternate reads better. `on-white/` is the faithful sheet pole and is
kept as the default so the choice stays the owner's.

`transparent/` holds the **dark** mark, so dropping it on a light page hits the same
wash-out: its back plate falls to 1.24:1 and its stroke to 2.16:1 against white.

### The banners on white have a second problem: there is no light palette

`app/globals.css` carries no `prefers-color-scheme` rule at all. The site is dark-only, and
the "sheet" pole in `Logo.tsx` is the cyanotype ground (light ink on `--color-blueprint`
blue), not a light theme. So there is no sanctioned value for `fg`, `cyan` or `muted` on
white, and measured against it every accent fails even the 3:1 non-text floor:

| token | vs white |
| --- | --- |
| `fg` #e9ebf5 | 1.19:1 |
| `cyan-bright` #7dd3fc | 1.67:1 |
| `emerald` #34d399 | 1.92:1 |
| `cyan` #38bdf8 | 2.14:1 |
| `blueprint-line` #74b4ff | 2.16:1 |
| `muted` #9aa1ba | 2.57:1 |
| `blueprint` #0b2f7a | 12.34:1 |
| `blueprint-deep` #061c52 | 16.21:1 |

Only the deep structural tokens carry. Nothing was recoloured: the white banners set "Dark"
in `blueprint-deep` and "Print" in `blueprint`, so the tone split survives as
deeper/deep rather than as foreground/cyan. It is a real split and a much quieter one than
on black. The tagline takes `blueprint` at 75% and the grid takes it at 10%, opacity being
the device the mark itself already uses for its back plate and perforation.

If the white banners need the cyan contrast the dark ones have, that is a palette decision
for the owner, not something to solve at render time.

Do not upload a logo to a Google OAuth consent screen that is Published + External. It
triggers brand verification and takes days.
