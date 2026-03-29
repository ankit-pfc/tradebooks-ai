# Tradebooks AI — Brand System

## Positioning
- **Brand Name:** Tradebooks AI
- **Tagline:** Ledger Intelligence
- **Internal positioning:** AI-native trading infrastructure layer that converts raw market data into structured, actionable ledger systems.

## Color Palette

### Primary (strict)
| Token | Hex | Usage |
|-------|-----|-------|
| `--tb-navy` | `#0B1F33` | Primary buttons, dark text, footer bg |
| `--tb-blue` | `#2D9CDB` | Accent only (highlights, badges, links). Not dominant. |
| `--tb-white` | `#FFFFFF` | Backgrounds, button text |

### Secondary
| Token | Hex | Usage |
|-------|-----|-------|
| `--tb-green` | `#27AE60` | Success / profit states |
| `--tb-red` | `#EB5757` | Error / bearish states |
| `--tb-grey` | `#6B7280` | Secondary text, tagline |

### Rules
- No random gradients. Use flat fills.
- Blue = accent only, not dominant.

## Typography

```css
font-family: Inter, system-ui, -apple-system, sans-serif;
```

### Scale
| Token | Size |
|-------|------|
| `--text-xs` | 12px |
| `--text-sm` | 14px |
| `--text-md` | 16px |
| `--text-lg` | 20px |
| `--text-xl` | 28px |
| `--text-2xl` | 36px |

### Brand name rendering
- "Tradebooks" — `font-weight: 500` (medium)
- "AI" — `font-weight: 600` (semibold) + `color: #2D9CDB`
- Tagline "Ledger Intelligence" — `font-weight: 400` (regular) + `color: #6B7280`

## Component Tokens

### Borders
```css
--border: 1px solid #E5E7EB;
--border-strong: 1px solid #0B1F33;
```

### Radius
```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
```
Keep it sharp. No big rounding in the app shell.
Marketing pages may use larger radii for visual warmth.

### Cards
```css
background: #FFFFFF;
border: 1px solid #E5E7EB;
padding: 16px;
```

### Buttons
**Primary:** `background: #0B1F33; color: #FFFFFF;`
**Secondary:** `background: transparent; border: 1px solid #0B1F33; color: #0B1F33;`

## Data Visualization
| State | Color |
|-------|-------|
| Bullish | `#27AE60` |
| Bearish | `#EB5757` |
| Neutral | `#6B7280` |

No gradients. Thin lines. Minimal grid.

## Do NOT Do
- No mascots
- No 3D icons
- No heavy gradients
- No crypto-style neon
- No over-illustration
- No playful animations (micro-interactions only: hover, highlight, subtle transitions)

## CSS Variables (globals.css)

All tokens are defined in `src/app/globals.css` under `:root`.
Agents should reference `--tb-*` tokens for brand colors and `--text-*` for typography scale.
