---
name: SnapSplit
platform: mobile
colors:
  background: "#F7F3F0"
  surface: "#FFFFFF"
  surface-alt: "#EFE7F2"
  border: "#E3D9E8"
  primary: "#8E6BBB"
  primary-pressed: "#70519A"
  primary-tint: "#EFE8F7"
  gold: "#C9A24B"
  text-primary: "#2A2530"
  text-secondary: "#6B6270"
  text-tertiary: "#A79FB0"
  success: "#5B8C6E"
  error: "#C25B6B"
  warning: "#D89A3E"
---

# Design System: SnapSplit

> Status: **New system — designed, not yet built.** This document defines the intended visual
> language for the SnapSplit mobile web app. It is the source of truth for the first
> implementation and for Stitch generation. Domain behaviour is drawn from
> [`docs/srs.md`](../docs/srs.md).

SnapSplit lets a group split a bar/restaurant bill from a photo of the receipt: one payer snaps
and reviews it, and every guest marks what they consumed — live, with no sign-up. The design has
a **light, airy, warm-lavender** identity: friendly and calm, so handling money among friends
feels effortless and trustworthy rather than transactional. Mobile-first, thumb-friendly, and
clear at a glance — because it's used at the table, quickly, by several people at once.

---

## 1. Visual Theme & Atmosphere

SnapSplit should feel like a warm, relaxed moment at the end of a good meal — not a banking app.
The foundation is a **warm cream** (`#F7F3F0`), soft and unclinical, that keeps money talk feeling
casual and human. A single **warm lavender** (`#8E6BBB`) — a gentle, dusty violet warmed toward
mauve — carries all the interactive energy: the "Take a photo" call to action, claimed items,
active participants. Restrained **gilded gold** (`#C9A24B`) marks what matters most: a running
total, the payer's badge, the final "you owe" figure.

The philosophy is **calm clarity under a little social pressure**. Splitting a bill is fiddly and
mildly awkward, so the UI does the opposite: generous whitespace, large tap targets, and quiet
type that make numbers unambiguous and actions obvious. State is always legible — what's claimed,
what's still unassigned, who's in — using soft color coding rather than loud alerts. Confidence
warnings on AI-extracted lines and highlighted unassigned units are handled gently (warm amber, a
soft outline) so nobody feels accused of getting it wrong. Everything is soft-edged, warm, and
reassuring — a tool you'd happily pass around the table.

---

## 2. Color Palette & Roles

### Primary Foundation
| Name | Hex | Role |
|:---|:---|:---|
| **Warm Cream** | `#F7F3F0` | App background — the calm, casual canvas |
| **Petal White** | `#FFFFFF` | Elevated surfaces — receipt lines, cards, bottom sheets |
| **Soft Lavender Mist** | `#EFE7F2` | Secondary surfaces — panels, image backdrops, invite-link wells |
| **Muted Lilac Border** | `#E3D9E8` | Hairline dividers between line items, card outlines, input borders |

### Accent & Interactive
| Name | Hex | Role |
|:---|:---|:---|
| **Warm Lavender** | `#8E6BBB` | Primary CTA, claimed units, active participant, links, selected states |
| **Deep Lavender** | `#70519A` | Pressed / active-touch state; small-size lavender text |
| **Lavender Tint** | `#EFE8F7` | Claimed-item fill, subtle press fills, focus halos |
| **Gilded Gold** | `#C9A24B` | Money highlights — running total, owner badge, final "you owe" figure |

### Typography & Text Hierarchy
| Name | Hex | Role |
|:---|:---|:---|
| **Dark Plum Ink** | `#2A2530` | Headings, item names, and all prices — a near-black warmed toward plum |
| **Muted Mauve Gray** | `#6B6270` | Secondary text — unit prices, metadata, helper copy |
| **Soft Lilac Gray** | `#A79FB0` | Tertiary text — captions, placeholders, disabled labels |

### Functional States
| Name | Hex | Role |
|:---|:---|:---|
| **Sage Success** | `#5B8C6E` | Fully claimed line, session settled, positive confirmation |
| **Dusty Rose Error** | `#C25B6B` | Errors, destructive confirmation (close/reopen), over-claim |
| **Amber Warning** | `#D89A3E` | Low AI confidence, **unassigned units**, "can't close yet" notices |

> **Accessibility:** Dark Plum Ink on Warm Cream and Petal White both exceed WCAG AA for body
> text — prices and item names stay crisp. Warm Lavender is a light hue: white text on Warm
> Lavender buttons passes AA for **large / semibold** labels (use ≥16px semibold on CTAs); for
> small lavender text prefer Deep Lavender `#70519A`. State colors are always paired with an icon
> or label, never color alone, so status is legible for color-blind users.

---

## 3. Typography Rules

Two families in conversation: an **elegant display serif** for headings and hero moments, and a
**humanist sans-serif** for everything functional — especially numbers. Because SnapSplit is
about money, the sans must have **tabular (monospaced) figures** so prices align in columns and
never jitter as they update live.

- **Display / Headings:** `Playfair Display` — a warm, high-contrast serif. Used for screen titles
  and the landing hero. (Fraunces / Cormorant are acceptable alternates.)
- **Body / UI / Numbers:** `Hanken Grotesk` — a neutral humanist sans with excellent tabular
  numerals. Enable `font-variant-numeric: tabular-nums` on all monetary values. (Inter / General
  Sans are acceptable alternates.)

### Hierarchy & Weights (mobile scale)
| Level | Family | Size / Line-height | Weight | Letter-spacing | Usage |
|:---|:---|:---|:---|:---|:---|
| **Hero Title** | Serif | 32 / 38px | 500 Medium | -0.5px | Landing — "Split the bill, snap it" |
| **Screen Title** | Serif | 24 / 30px | 500 Medium | -0.25px | "Review receipt", "Who's paying?" |
| **Item Name** | Sans | 16 / 22px | 600 Semibold | 0 | Line-item name (e.g. "Caña ×3") |
| **Price / Total** | Sans (tabular) | 16 / 22px | 600 Semibold | 0 | Line total, per-person total |
| **Body** | Sans | 15 / 22px | 400 Regular | 0 | Helper copy, instructions |
| **Unit / Meta** | Sans (tabular) | 13 / 18px | 400 Regular | 0 | "2.00 €/unit", "2 of 3 left" |
| **Label / Nav** | Sans | 13 / 16px | 500 Medium | 0.2px | Buttons, chips, tab labels |
| **Overline** | Sans | 11 / 14px | 600 Semibold | 1.2px UPPERCASE | Status eyebrows — "UNASSIGNED", "OWNER" |

> **This scale is canonical and enforced across every screen — do not eyeball sizes.** Each role is a
> named token that carries **family + size + line-height + weight** together (`hero-title`,
> `screen-title`, `item-name`, `price-total`, `body`, `unit-meta`, `label-nav`, `overline`). Apply the
> token, never a raw size. **Never** use Tailwind's default step scale (`text-sm` = 14px, `text-lg` =
> 18px, `text-2xl`, `text-3xl`, …) for text — those sizes are off-grid and are what makes screens drift.
> The same role must render at the **same px on every screen** (an item name is 16px on Review *and* on
> the Session summary — never 20px on one and 14px on another).

### Spacing Principles
- **Prices use tabular numerals** and right-align in lists so decimals stack cleanly.
- **Headings** get slightly negative tracking (`-0.25` to `-0.5px`) so the serif feels intentional.
- **Overlines** are uppercase with `+1.2px` tracking — reserved for status labels (UNASSIGNED, OWNER).
- **Body** stays at 1.45–1.5 line-height for relaxed reading on small screens.
- Text spacing follows the **4/8px rhythm**: 8px between item name and its unit price, 24px between
  a screen title and its content.

---

## 4. Component Stylings

### Buttons
- **Primary:** solid **Warm Lavender** `#8E6BBB`, white semibold label, **12px** corner radius,
  `14px × 20px` padding (≥48px touch height). Presses to **Deep Lavender** `#70519A` with a subtle
  0.98 scale over 150ms ease-out. Used for "Take a photo", "Confirm", "Join".
- **Secondary:** transparent fill, `1px` Warm Lavender border, lavender label — same radius/padding.
- **Ghost / Text:** lavender label only — low-emphasis ("Add item by hand", "See all").
- **Destructive:** Dusty Rose text/border for "Close session" / "Reopen"; confirm in a sheet.
- **Icon buttons** (camera, share, edit): 44×44px tap target, circular, Petal White fill with a
  soft shadow.
- Transitions are soft and quick — 150ms — never bouncy.

### Cards & Receipt Line Items
- **Receipt line-item row:** Petal White surface within a rounded (**16px**) list card, separated by
  Muted Lilac hairlines. Layout: item name + qty on the left, unit price (Muted Mauve Gray) below,
  line total (Dark Plum Ink, tabular) right-aligned, and a claim control on the right.
- **Low-confidence line:** a soft Amber Warning dot/outline and a small "check this" overline; never
  a harsh red — the price is *doubtful*, not wrong.
- **Claimed state:** the units you've taken fill with **Lavender Tint** and show your initials badge;
  a fully-claimed line gets a subtle Sage Success check.
- **Unassigned state:** remaining units carry an Amber Warning left-border and an "UNASSIGNED"
  overline, so the group can see at a glance what still needs a taker.
- **Elevation:** flat at rest with a `1px` border; sheets and the sticky total bar lift with a soft
  diffuse shadow (`0 8px 24px rgba(42,37,48,0.08)`). No hard drop shadows.

### Navigation
- The payer's capture flow is **linear** (Home → Capture → Review) and then lands on the shared
  **Session** screen; the guest flow is Link landing → the same Session screen. Primary navigation is a
  **top bar** with a back chevron, the screen title (serif), and a **status pill** (Open/Closed).
- The **Session** screen is a single stateful screen (see Domain-Specific Components): it swaps from
  live claiming to a frozen summary in place, and adapts by role — the only owner-exclusive control is Close.
- A **sticky bottom action bar** (Petal White, hairline top border, soft upward shadow, safe-area
  inset) holds the running **personal total in Gilded Gold** and the primary action for that step.

### Inputs & Forms
- **Name entry:** Soft Lavender Mist fill, no border at rest, **12px** radius, placeholder in
  Soft Lilac Gray. Focus → `1.5px` Warm Lavender border + faint Lavender Tint halo (150ms). Guests join
  with just a name — there is no code-entry field.
- **Price edit (review):** inline, tabular figures, currency-aware; validates that `Σ lines ≈ total`.
- **Claim stepper:** a `–  units  +` control per line; caps at remaining units and shows
  "2 of 3 left" beneath. Minimum 44px tap targets on the steppers.
- All inputs keep the 12px radius for a unified soft-rectangle language; ≥48px height for thumbs.

### Domain-Specific Components
- **Capture / hero card:** big rounded (20px) card on the Home screen with a friendly illustration
  and a full-width Warm Lavender "Take a photo of the receipt" button. Guests never see this screen —
  they join only via the shared invite link (code in the URL), so there is no code-entry control.
- **Analysis spinner:** calm lavender progress state over a blurred receipt thumbnail while the AI
  extracts — no jarring loaders.
- **Session screen (shared, stateful):** one screen for payer and guests, driven by `status`
  (`open`→`closed`) and `is_owner`. **Open** uses **progressive disclosure so it fits a phone**: the
  claimable line-item list (steppers — everyone claims, the payer is a participant too) is the single
  primary scroll; a compact **People + progress strip** sits sticky under the header (initials badges +
  "+N" overflow + a slim progress bar) and taps open a **People sheet** with the full per-person
  breakdown (initials badge, name, running total, Gilded Gold "OWNER" badge on the payer); invite lives
  behind a **share icon** in the header that opens an **Invite sheet**. **Closed:** the same screen
  freezes into the summary (below). The only owner-exclusive control is **Close session**.
- **Share panel:** Soft Lavender Mist well containing the shareable invite link in a read-only field,
  with a copy-link button and a native "Share" button. No QR — people join by opening the link only.
- **Unassigned banner:** an Amber Warning strip ("3 units still unassigned — session can't close")
  that gates the Close action until resolved.
- **Summary (closed Session state):** per-person rows (initials badge + name + amount owed, large,
  Gilded Gold, tabular) and a balanced grand total. **The per-person breakdown is public** — every
  participant sees each person's amount, a transparent shared split (the claim state is synced to all
  devices anyway). Role-adaptive personal block — a guest sees "You owe X to <payer>" plus the payer's
  payment details; the payer sees who owes them plus their own payment details to share — the calm,
  resolved end state.

---

## 5. Layout Principles

### Grid & Structure
- **Single-column, mobile-first**, on a **4/8px spacing grid**. Base width ~375–390px.
- **Edge padding:** 20px page margins (24px on larger phones).
- Receipt and participant lists are full-width stacked rows; the sticky total/CTA bar pins to the bottom.
- Money values right-align to a shared column so totals scan vertically.

### Whitespace Strategy
- **Base unit: 8px.** Steps: 4, 8, 12, 16, 24, 32, 48.
- **Between major sections:** 32px of vertical air. **Screen title → content:** 16–24px.
- **Between list rows:** hairline + 12–16px internal padding. Calm comes from restraint.

### Alignment & Visual Balance
- Screen titles and item names are **left-aligned**; prices and totals **right-aligned** (tabular).
- The **running total** sits bottom-and-prominent (in gold) so the number in question is always visible.
- Status uses color + icon + short label together — never color alone.

### Responsive Behavior & Touch
- **Mobile-first.** Breakpoints: base `<600px` (phone), `≥600px` (tablet — centered content, max width
  ~560–640px so lists stay readable rather than stretching edge to edge).
- All tap targets ≥44×44px; primary buttons and steppers ≥48px.
- Respect top and bottom **safe-area insets** (notch + home indicator); the sticky bar sits above the inset.
- Real-time updates animate softly (a gentle fade/height change) so live claims don't feel jumpy.

---

## 6. Design System Notes for Stitch Generation

### Language to Use
When prompting Stitch, describe the mood as: *"a light, airy, warm-lavender bill-splitting mobile app;
calm and friendly, not a banking app; creamy off-white backgrounds; a single soft warm-lavender accent;
gilded-gold for money totals; elegant serif titles with a clean humanist sans and tabular numerals;
generous whitespace; soft rounded cards; sticky bottom total-and-CTA bar."*

### Color References
- Warm Cream `#F7F3F0` — background
- Petal White `#FFFFFF` — cards / receipt rows
- Soft Lavender Mist `#EFE7F2` — panels, invite-link wells
- Warm Lavender `#8E6BBB` — primary accent / CTA / claimed
- Deep Lavender `#70519A` — pressed state
- Gilded Gold `#C9A24B` — money totals & owner badge
- Amber Warning `#D89A3E` — unassigned / low-confidence
- Dark Plum Ink `#2A2530` — text & prices

### Component Prompts (examples)
1. *"A mobile Home screen for a friendly bill-splitting app on a warm cream background. A large rounded
   card with a cheerful illustration and a full-width warm-lavender button 'Take a photo of the receipt'.
   Serif greeting header at top. No other buttons."*
2. *"A receipt review screen: a white rounded list of editable line items separated by lavender hairlines.
   Each row shows item name and quantity on the left, unit price in muted gray, and the line total
   right-aligned in dark plum with tabular numerals. One row has a soft amber 'check this' warning.
   A sticky bottom bar shows the running total in gilded gold and a warm-lavender 'Confirm' button."*
3. *"The shared live Session screen (open state), uncluttered for mobile: a header with a back chevron,
   merchant name, an 'Open' status pill, and a share icon. Under the header a compact strip of participant
   initials badges with a '+2' overflow and a slim progress bar. The main scroll is a list of receipt
   lines with a '– units +' stepper where claimed units fill with a light lavender tint and show the
   claimer's initials badge, and unclaimed units show an amber 'UNASSIGNED' label with '2 of 3 left'. A
   sticky bottom bar shows the personal total in gilded gold; for the owner it also shows a 'Close
   session' button. (Invite link and the full people breakdown live in bottom sheets.)"*
4. *"A share panel with a soft lavender-mist well containing a read-only invite link, a copy-link
   button, and a native share button, on a warm cream background. No QR code."*
5. *"The Session screen in its closed/summary state: each person as an initials badge + name with the
   amount they owe in large gilded-gold tabular numbers, and a balanced grand total. For a guest, a
   focal 'You owe X to Ana' with the payer's payment details and a copy button. Calm and resolved."*

### Incremental Iteration
- Start from the **Home capture card + sticky total bar** — they set the tone; get the cream/lavender
  balance right before adding lists.
- Keep lavender as an **accent**, not a fill: if a screen feels heavy, reduce lavender coverage and let
  the cream breathe. Reserve **gold strictly for money** (totals, owed amounts, owner badge).
- Handle warnings **gently** — amber and soft outlines for unassigned/low-confidence, never harsh red.
- Prefer **soft shadows and 12–16px radii** everywhere for the unified friendly-trustworthy feel.
- Always use **tabular numerals** for prices so live updates stay aligned and calm.