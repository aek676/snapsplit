# SnapSplit — Screen Prompts (Stitch)

> Structural prompts for generating the SnapSplit screens in Stitch.
> **Theme is intentionally omitted** — colors, fonts, radii and mood come from the
> project-level design system (`.stitch/DESIGN.md`, warm-lavender / light & airy).
> Do **not** paste hex codes or fonts into these generation prompts.
>
> Global: **Platform Mobile, mobile-first.** Domain from [`docs/srs.md`](../docs/srs.md).
> Money values use tabular numerals and right-align. Tap targets ≥44px. Respect safe-area insets.
> **Typography:** use only the named type-scale tokens from [`DESIGN.md`](./DESIGN.md) §3 (`hero-title`
> 32, `screen-title` 24, `item-name`/`price-total` 16, `body` 15, `unit-meta` 13, `label-nav` 13,
> `overline` 11) — each carries family+size+weight. Never eyeball sizes or use Tailwind default steps
> (`text-sm`/`text-lg`/`text-2xl`…). The same role must be the same px on every screen.
> "Avatars" are always **initials badges** (a circle with the person's initials) — guests join with
> just a name, so there are never profile photos.
>
> **5 screens.** The **Session** screen (#5) is a *single stateful screen shared by payer and guests*,
> driven by session `status` (`open` → `closed`) and `is_owner` — not four separate screens. Both
> flows land here: the payer after confirming Review, the guest after Link landing.

---

## 1. Home — Capture entry (Payer)

A warm, welcoming home screen that invites the payer to start splitting a bill.

**PLATFORM:** Mobile, mobile-first

**PAGE STRUCTURE:**
1. **Header:** Slim top bar with the app name/wordmark centered or left, and a small help/info icon button on the right.
2. **Hero Card:** Large rounded card with a friendly flat illustration (a receipt + a group of friends). Short serif headline ("Split the bill, snap it") and one line of supporting copy.
3. **Primary Action:** Full-width primary call-to-action button "Take a photo of the receipt".
4. **Reassurance row:** A single small line of microcopy under the action ("No sign-up — just snap and share the link").
5. **Feature highlights:** A row of two compact cards below the reassurance line, each with a small icon, an uppercase overline label and a short value — "SPEED — Split in seconds" and "SOCIAL — No app required".

**NOTE:** This is the payer's starting screen only. Guests never come here — they join exclusively via the shared invite link (the session code lives in the URL), so there is **no code-entry field or button** anywhere.

**INTERACTIONS:** Primary button triggers the camera.

---

## 2. Capture & Analysis (Payer)

The moment right after taking the photo: a calm AI-analysis loading state while the receipt is parsed.

**PLATFORM:** Mobile, mobile-first

**PAGE STRUCTURE:**
1. **Header:** Back chevron on the left, screen title "Reading your receipt".
2. **Receipt Preview:** Centered thumbnail of the captured receipt, softly blurred/dimmed.
3. **Analysis Indicator:** A calm circular progress/spinner overlaid on the preview with a status label ("Extracting items…") and a subtle animated shimmer.
4. **Step Hints:** A short vertical list of progress steps ("Detecting items", "Reading prices", "Checking the total") with the current step highlighted.
5. **Secondary Action:** A quiet "Retake photo" text button at the bottom.

**INTERACTIONS:** Auto-advances to Receipt Review when analysis completes; "Retake photo" returns to camera.

---

## 3. Receipt Review (Payer)

The editable draft of the extracted receipt — the payer corrects items and confirms before publishing.
This is the **only** place line items are edited.

**PLATFORM:** Mobile, mobile-first

**PAGE STRUCTURE:**
1. **Header:** Back chevron, title "Review receipt", and merchant name + date as a small subtitle.
2. **Line-item List (read-only, column-aligned):** A rounded white list where every row is a clean **5-column table** aligned consistently: **name** (left, flexible) · **units** (single number, tabular) · **price** (line total only, right-aligned, tabular) · **pencil** (warm lavender edit icon, 44×44) · **trash** (dusty rose delete icon, 44×44). Show a **single price per line** — no separate "€/unit" meta beneath the name (avoid duplicated price info). No column-header row (columns are self-explanatory). The list stays in a calm read-only state — no inline-expanding rows.
3. **Low-confidence Flags:** Doubtful rows carry a soft "check this" warning marker (icon + short overline), inviting review without alarm.
4. **Add Item:** A ghost "Add item by hand" row/button at the end of the list.
5. **Total Block:** An editable/confirmable grand total with a note validating that items sum to the receipt total.
6. **Edit Modal (per line):** Tapping a row's pencil opens a centered modal over a dimmed, softly-blurred scrim. It edits a single line: an editable **name** field, a **quantity** stepper (`– units +`), and an editable **unit price** field (currency symbol + tabular numerals), with **Cancel** (ghost) and **Save** (primary) actions. The modal has **no delete action** — removing a line is done only from the row's trash icon.
7. **Sticky Bottom Bar:** two buttons side by side — a secondary "Retake photo" (with camera icon) and the primary "Confirm & create link". No running total is repeated here (the grand total lives in the Total Block above).

**INTERACTIONS:** The pencil opens the per-line edit modal (name, qty, unit price → Save/Cancel); the trash icon deletes that line; "Retake photo" returns to the camera; Confirm publishes the session and moves to the shared **Session** screen (#5).

---

## 4. Guest — Link Landing (Join)

A friction-free entry for a guest opening the shared link: just say who you are.

**PLATFORM:** Mobile, mobile-first

**PAGE STRUCTURE:**
1. **Header:** App wordmark, small and centered.
2. **Context Card:** A short welcome that names the session/merchant and who invited them ("Ana invited you to split the bill at Bar Paco").
3. **Name Input:** A single large labeled text field — "Your name" — with a friendly placeholder, no password or sign-up.
4. **Primary Action:** Full-width "Join Session" button.

**INTERACTIONS:** Entering a name and tapping "Join Session" enters the shared **Session** screen (#5).

---

## 5. Session (Shared — stateful, role-aware)

**One screen for everyone.** Payer and guests share this exact screen; the payer is just a
participant who also claims their consumptions. What's shown is driven by two axes:

- **`status`:** `open` (live claiming) → `closed` (frozen summary).
- **`is_owner`:** owner (payer) vs guest.

The **only** owner-exclusive control is **Close session**. Everything else (invite link, claiming,
the live panel) is available to all participants.

**PLATFORM:** Mobile, mobile-first

**PAGE STRUCTURE (state: OPEN) — density solved by progressive disclosure:** the claimable item
list is the single primary scroll; people and invite are surfaced compactly and expand into bottom
sheets on demand.
1. **Header:** Back chevron, merchant + date, a status pill ("Open"), and a **share icon** on the right that opens the **Invite sheet**. Title adapts to role ("Your session" for the owner, "<Merchant> — split" for a guest).
2. **Totals summary block (sticky under header):** Two figures side by side acting as the live progress indicator — "Ticket total" (grand total, tabular) on the left and "Collected" (sum claimed so far, in gold, tabular) on the right.
3. **Unassigned Banner (contextual):** An Amber Warning strip pinned above the list only when units remain unclaimed ("3 units still unassigned — needed before closing"); it gates closing.
4. **Claimable Line-item List (primary scroll — all users claim):** Rows with item name + unit price and a "– units +" stepper. Units you've claimed show your initials badge + a claimed highlight; fully-claimed lines are marked; unclaimed/unassigned units are visually flagged.
5. **Sticky Bottom Bar — personal total (role-adaptive):**
   - *Guest:* "You owe" + your running total (tabular), updating live.
   - *Owner:* "Your share" + your running total (tabular).
   - **Owner only:** a "Close session" button (disabled/blocked while anything is unassigned).

**BOTTOM SHEETS (open state):**
- **Invite sheet:** the shareable invite link in a read-only field, with a "Copy" button and a native "Share" button. **No QR code** — people join only by opening the link.
- **People sheet:** the full live breakdown — each participant as an initials badge + name, an "OWNER" badge on the payer, and their running claimed total (tabular), plus the overall claimed-vs-total progress. **Public to everyone:** any participant (not only the payer) sees each person's amount — a transparent, shared split.

**PAGE STRUCTURE (state: CLOSED — same screen, frozen → summary):**
1. **Header:** Merchant + date; status pill switches to "Closed"; steppers are disabled.
2. **Totals Overview:** A hero figure of the balanced grand total, with a small note that everything adds up exactly.
3. **Per-person List (public to everyone, accordion):** One row per participant — initials badge + name on the left (an "OWNER" badge on the payer), amount owed to the payer on the right as a large money-highlight figure. Each row expands to reveal that participant's claimed items/units with per-line amounts. Visible to all participants, not just the payer. The current user's own row is marked ("(You)").
4. **Personal Block (role-adaptive):**
   - *Guest:* "You owe X € to <payer>" as the focal figure, plus a collapsible recap of the items/units they claimed.
   - *Owner:* the breakdown of who owes them and the balanced total.
5. **Footer Actions:** "Share summary" for all; a quiet note that the payer confirms once everyone has paid.

**INTERACTIONS:** The share icon opens the Invite sheet (copy/share the link); tapping a participant's initials badge opens the People sheet. Steppers increment/decrement capped at remaining units; the People strip, totals and remaining counts update live across devices. The owner's Close is gated until nothing is unassigned, then confirmed via a sheet; on close the same screen transitions in place to the CLOSED/summary layout (no navigation). Guest personal totals also update live if the payer edits lines before closing.

**NOTE:** This is a single screen with two states and two roles — not four screens. In code it is one component parameterized by `status` and `is_owner`; for Stitch mockups it is represented as a few variants (Open/Owner, Open/Guest, Closed/Owner, Closed/Guest). The two bottom sheets (Invite, People) keep the main screen uncluttered so everything fits comfortably on a phone.
