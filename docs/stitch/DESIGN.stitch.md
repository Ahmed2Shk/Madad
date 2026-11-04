---
name: Humanitarian Medical Availability Directory
colors:
  surface: '#e3fffd'
  surface-dim: '#bce1df'
  surface-bright: '#e3fffd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#d6fbf9'
  surface-container: '#d0f5f3'
  surface-container-high: '#caefed'
  surface-container-highest: '#c5eae8'
  on-surface: '#00201f'
  on-surface-variant: '#3f4948'
  inverse-surface: '#123635'
  inverse-on-surface: '#d3f8f6'
  outline: '#6f7978'
  outline-variant: '#bec9c7'
  surface-tint: '#116966'
  primary: '#00514f'
  on-primary: '#ffffff'
  primary-container: '#146b68'
  on-primary-container: '#9de9e4'
  inverse-primary: '#88d4cf'
  secondary: '#006a63'
  on-secondary: '#ffffff'
  secondary-container: '#98f3e8'
  on-secondary-container: '#007169'
  tertiary: '#3f4a48'
  on-tertiary: '#ffffff'
  tertiary-container: '#57625f'
  on-tertiary-container: '#d1ddd9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a4f0ec'
  primary-fixed-dim: '#88d4cf'
  on-primary-fixed: '#00201f'
  on-primary-fixed-variant: '#00504d'
  secondary-fixed: '#98f3e8'
  secondary-fixed-dim: '#7bd6cc'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#00504a'
  tertiary-fixed: '#d9e5e1'
  tertiary-fixed-dim: '#bdc9c5'
  on-tertiary-fixed: '#131e1b'
  on-tertiary-fixed-variant: '#3e4946'
  background: '#e3fffd'
  on-background: '#00201f'
  surface-variant: '#c5eae8'
typography:
  display:
    fontFamily: IBM Plex Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 44px
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 36px
  headline-lg-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-base:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  timestamp:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system is engineered for critical civic infrastructure: an Arabic-first medical availability intelligence directory designed for emergency and strained healthcare contexts. The brand identity prioritizes sober authority, operational clarity, and immediate cognitive relief over commercial ornament.

### Brand Personality & Emotional Response
- **Sober & Trustworthy:** Presents information without panic, sensationalism, or false optimism. The interface projects quiet institutional competence.
- **Empathetic Utility:** Designed for citizens, pharmacists, and field relief coordinators in high-stress scenarios. Cognitive load is minimized to zero friction.
- **Clarity over Commerce:** Contains strictly no commercial vectors—no shopping baskets, pricing highlights, checkout paths, delivery metaphors, or sales mechanics. It operates purely as an objective verification ledger.

### Visual Style
- **Minimalist Clinical Clean:** Structured, high-contrast readability against soft, glare-free surfaces.
- **Strict Anti-Patterns:** Absolute ban on decorative gradients, marketing stock photography, and cartoon medical illustrations. Imagery is strictly limited to clear packaging identifiers or clinical reference documentation when essential.
- **Wordmark Identity:** Identity is conveyed exclusively through an unadorned, typographic wordmark: **مَدَد**. In non-production or staging environments, every viewport renders a subtle, persistent test indicator: **بيانات تجريبية**.

## Colors

The palette uses low-fatigue, balanced teal and pine primaries paired with functional validation hues. Every surface is tuned for outdoor reading under harsh sunlight and low-spec screens.

### Core Architecture
- **Primary Canvas (`#F7FAF9`):** A soft, pale clinical grey-green preventing eye strain compared to pure `#FFFFFF`.
- **Card Surface (`#FFFFFF`):** High-clarity focal cards elevated from the canvas.
- **Structural Outlines (`#DCE8E5`):** Soft, low-contrast structural boundaries defining interactive zones without visual heaviness.
- **Primary Interactive (`#146B68`):** Deep pine-teal signaling authority and stability.
- **Primary Hover (`#0F5653`):** Weighted state reaction for interactive controls.
- **Secondary Accent (`#2A8C83`):** Reserved strictly for non-interactive line iconography and metadata accents.
- **Mint Tint (`#EAF6F2`):** Primary highlight tone used for selected states, active navigation tabs, and subtle container fills.
- **Text Body & Headers (`#183B3A`):** Deep slate-pine delivering optimal legibility without the harshness of pitch black.
- **Text Muted (`#5E6E6B`):** Functional secondary text for timestamps, serial numbers, and geographic subtitles.

### Functional Status System
Every availability indicator is paired with dedicated semantic colors ensuring immediate triage recognition:
- **Available (`متوفر`):** Surface `#E3F2EA`, Text & Icon `#1E6E4C`
- **Limited (`كمية محدودة`) / Needs Update (`يحتاج تحديث`):** Surface `#FBF0DD`, Text & Icon `#8A5A12`
- **Unavailable (`غير متوفر`):** Surface `#F9E4E4`, Text & Icon `#A43F3F`
- **Unconfirmed (`غير مؤكد`):** Surface `#EEF1F0`, Text & Icon `#5C6A67`
- **Pending Review (`قيد المراجعة`):** Surface `#E4EEF7`, Text & Icon `#1F5F8B`

## Typography

The typography is built around native RTL support using **IBM Plex Sans Arabic** as the primary script driver and **Inter** for Latin technical labels, dosage codes, and Western numerals.

### Script & Numeral Direction
- **Root Direction:** `dir="rtl"`, default text alignment `text-align: right` (or CSS logical `start`).
- **Numerals:** Strictly Western Arabic digits (`0-9`) across all data displays, quantities, and timestamps to eliminate regional ambiguity in emergency contexts.
- **Latin Fallbacks:** Latin drug trade names (e.g., *Amoxicillin 500mg*) inherit `Inter`, integrated cleanly into the Arabic reading baseline without baseline jumping.
- **Reading Rhythm:** The foundational body font size is strictly locked at `15px` with a `22px` line-height for dense yet breathable scanning.

## Layout & Spacing

Layout geometry follows an exact, responsive grid system calibrated for quick information parsing on field laptops, dispatch centers, and mobile devices.

### Grid & Breakpoints
- **Canvas Baseline:** Optimized for 1440px desktop displays, constrained within a centered `max-width: 1200px` content container.
- **Columns:** 12-column layout on desktop (breakpoint: ≥1024px) with `20px` (`1.25rem`) gutters; 4-column layout on mobile (<768px) with `12px` (`0.75rem`) gutters.
- **Lateral Canvas Margins:** Desktop standard margin is `32px` (`2rem`); Mobile margin compresses to `16px` (`1rem`).

### Rhythm & Alignment
Spacing adheres to a strict 4px/8px incremental rhythm. Empty space within cards communicates category grouping rather than decoration:
- Card interior padding is fixed at `space-md` (`16px`) on mobile and scales to `space-lg` (`24px`) on desktop.
- Adjacent status badges, icons, and timestamps use `space-xs` (4px) to `space-sm` (8px) gaps.
- Complex medicine records never split key info across horizontal breaks; metadata remains vertically stacked in high-contrast groups.

## Elevation & Depth

Visual hierarchy uses flat, clinical containment reinforced by a single, carefully calibrated ambient shadow. Deep drops, dynamic parallax, and high-offset elevations are prohibited.

### Tonal Hierarchy
- **Level 0 (Canvas):** `#F7FAF9` background base.
- **Level 1 (Card & Containers):** `#FFFFFF` surfaces bounded by a crisp 1px `#DCE8E5` structural border.
- **Level 2 (Active Dropdowns & Modals):** `#FFFFFF` surfaces with the system soft shadow applied over subtle scrims (`rgba(24, 59, 58, 0.25)`).

### Shadow Specification
To prevent dirty grey edges, shadows are explicitly tinted with the primary teal palette:
- `box-shadow: 0 1px 3px rgba(20, 107, 104, 0.05), 0 4px 12px rgba(20, 107, 104, 0.04);`
- Hover states do not lift cards upward; instead, they transition the structural border from `#DCE8E5` to `#2A8C83` or `#146B68`.

## Shapes

The geometric form language communicates clinical safety and precision through intentional corner radius scaling.

### Corner Radius Standards
- **Buttons & Form Inputs:** Fixed at `10px` (`rounded-md`). This delivers a modern, accessible touch target without appearing toy-like.
- **Cards, Panels & Modal Containers:** Fixed at `14px` (`rounded-lg`). Encloses medical metadata within clean, defined corners.
- **Status Badges & Chips:** Completely pill-shaped (`9999px`), distinguishing informational states immediately from interactive square-corner inputs.

## Components

### 1. Buttons
- **Height:** Strictly 40px to 44px to satisfy emergency finger-tap accuracy.
- **Primary:** Background `#146B68`, Text `#FFFFFF`, Border radius `10px`. Hover: `#0F5653`. Active: `#0A3F3D`.
- **Secondary / Outline:** Background `#FFFFFF`, Border `1px solid #DCE8E5`, Text `#183B3A`. Hover: Background `#EAF6F2`, Border `#146B68`.
- **Padding:** 12px vertical, 20px horizontal. Line icons positioned on the logical start (right) side with 8px margin.

### 2. Status Badges & Availability Indicators
Pill components (`border-radius: 9999px`) featuring a subtle tinted background, saturated status text, a Lucide-style 16px/20px outline icon, and an accompanying relative timestamp:
- **Available (`متوفر`):**
  - Container: Background `#E3F2EA`, Text `#1E6E4C`.
  - Icon: `check-circle`.
  - Accompanying timestamp: Text `#5E6E6B`, e.g., `حُدّث قبل 12 د` (Updated 12m ago).
- **Limited Quantity (`كمية محدودة`):**
  - Container: Background `#FBF0DD`, Text `#8A5A12`.
  - Icon: `alert-triangle`.
- **Needs Verification (`يحتاج تحديث`):**
  - Container: Background `#FBF0DD`, Text `#8A5A12`.
  - Icon: `clock`.
- **Unavailable (`غير متوفر`):**
  - Container: Background `#F9E4E4`, Text `#A43F3F`.
  - Icon: `x-circle`.
- **Unconfirmed (`غير مؤكد`):**
  - Container: Background `#EEF1F0`, Text `#5C6A67`.
  - Icon: `help-circle`.
- **Pending Review (`قيد المراجعة`):**
  - Container: Background `#E4EEF7`, Text `#1F5F8B`.
  - Icon: `hourglass`.

### 3. Search & Input Fields
- **Dimensions:** 42px height, 10px corner radius, 1px border `#DCE8E5`.
- **Typography:** IBM Plex Sans 15px, text aligned to logical right. Placeholder color `#5E6E6B`.
- **Focus State:** 1px border `#146B68` with an inset `0 0 0 1px #146B68` focus ring (no generic browser blue).
- **Search Prefix Icon:** Lucide `search` (20px, `#5E6E6B`) docked on the right side with 12px inner offset.

### 4. Medicine Availability Cards
- **Structure:** Surface `#FFFFFF`, border `1px solid #DCE8E5`, radius `14px`, system ambient shadow.
- **Header Row:** Primary generic name in bold Arabic, secondary Latin trade name below in Inter (`#5E6E6B`).
- **Body Row:** Center-aligned status badge paired with pharmacy or facility location, distance in Western numerals, and verification freshness indicator.
- **Card Action:** "View Details / عرض التفاصيل" text link or secondary button triggering verified contact points and stock logs. No "Buy", "Cart", or "Order" triggers.

### 5. Watermark / Test Environment Flag
- In test environments, display a non-intrusive floating or header badge: `بيانات تجريبية` (Test Data) rendered in `#5C6A67` over `#EEF1F0` with `10px` radius to prevent false medical security during simulation cycles.