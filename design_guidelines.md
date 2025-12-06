# SourceScout Design Guidelines

## Design Approach
**System**: Hybrid approach drawing from Linear (modern productivity), Material Design (data density), and Notion (clarity). This enterprise tool prioritizes efficiency, information hierarchy, and professional polish for supply chain professionals.

**Core Principles**:
- Clarity over decoration - every element serves a function
- Progressive disclosure - complex features revealed as needed
- Generous whitespace around dense data clusters
- Consistent information architecture across workflows

---

## Typography System

**Font Stack**: Inter (primary), system-ui fallback
- **Hero/Page Titles**: 2.5rem (40px), font-weight 700, tracking tight
- **Section Headers**: 1.75rem (28px), font-weight 600
- **Card Titles**: 1.125rem (18px), font-weight 600
- **Body Text**: 0.9375rem (15px), font-weight 400, line-height 1.6
- **Labels/Metadata**: 0.8125rem (13px), font-weight 500, uppercase tracking-wide
- **Small Text/Captions**: 0.75rem (12px), font-weight 400

---

## Layout & Spacing System

**Tailwind Units**: Use 2, 3, 4, 6, 8, 12, 16, 20, 24 for consistency
- Component padding: p-4 to p-6
- Section spacing: py-12 to py-16
- Card gaps: gap-4 to gap-6
- Form element spacing: space-y-4

**Container Strategy**:
- Main workflow areas: max-w-7xl mx-auto px-6
- Forms/inputs: max-w-2xl
- Comparison tables: full-width with horizontal scroll
- Modals: max-w-4xl

**Grid Patterns**:
- Results cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Comparison view: Two-column split (lg:grid-cols-2)
- Spec checklist: Single column max-w-3xl for scannability

---

## Component Library

### 1. File Upload Zone
**The Drop Zone** - Hero section on main page
- Large drop target: min-h-64, dashed border (border-2 border-dashed)
- Centered content with upload icon (64px) and instruction text
- Supported formats badge below
- Active drag state with subtle scale transform

### 2. Multi-Step Progress Indicator
Horizontal stepper: Upload → Analyze → Configure → Search → Results
- Connected line pattern with numbered circles
- Active step: filled, Completed: checkmark, Upcoming: outline
- Placed at top of workflow container

### 3. Specification Extraction Display
**Split-Screen Analysis**
- Left panel: Original product preview (image/URL screenshot)
- Right panel: Extracted specs as structured list
- Each spec row: Icon + Label + Value + Toggle (Must Have/Flexible)
- Visual distinction between locked (non-negotiable) and flexible specs
- Sticky constraint summary footer showing selected requirements

### 4. Search Agent Activity Panel
**Collapsible "Agent Thoughts" Log**
- Expandable drawer from bottom or side
- Timeline view with timestamps
- Each log entry: Agent icon + Action description + Status badge
- Auto-scroll to latest activity
- Three states: Searching, Analyzing, Completed

### 5. Results Comparison Cards
**Primary Display Pattern**
- Card design: Rounded corners (rounded-lg), shadow-sm on hover
- Top section: Supplier thumbnail + name + trust badges
- Middle: Key spec comparison grid (3-4 rows max)
- Bottom: Price delta badge + MOQ + Lead time pills
- Primary CTA: "Contact Supplier" button
- Secondary action: "View Details" link

### 6. Comparison Matrix Table
**Side-by-Side Analysis**
- Fixed first column (spec names)
- Horizontal scroll for multiple suppliers
- Row alternation for readability
- Highlight cells: Match (checkmark), Mismatch (warning), Better (arrow-up)
- Sticky header row
- Compact row height with adequate padding (py-3)

### 7. Constraint Input Forms
**Target Parameters Section**
- Inline label-input pairs
- Number inputs with unit suffixes ($, units, days)
- Range sliders for flexible constraints
- Clear visual hierarchy: Required fields bold labels

### 8. Badge System
- **Savings Badge**: "-20%" with distinct styling
- **Match Quality**: "Exact Match", "Partial Match" (95%)
- **Certifications**: Small pills (ISO, RoHS, FDA)
- **Status**: "In Stock", "MOQ: 500", "Lead: 14 days"
- Consistent height (h-6), rounded-full, px-3

### 9. Navigation
**Top Bar**: Logo + Session title + User menu
- Height: h-16
- Sticky positioning
- Subtle bottom border

**Action Bar** (context-aware):
- Fixed to workflow step
- Primary actions right-aligned
- Secondary actions left-aligned
- Spacing between: gap-3

### 10. Empty States
- Centered icon (96px) + Heading + Description + CTA
- Used for: No results, Upload prompt, Session history
- Maximum width: max-w-md mx-auto

---

## Images

**Hero Section Image**: No
This is a productivity tool - lead with the upload drop zone instead of hero imagery.

**Product Images**:
- Uploaded product photos displayed in 1:1 aspect ratio cards
- Supplier logos: Small circular avatars (48px)
- Placeholder patterns for missing supplier images
- All images: object-cover with consistent border-radius

---

## Interaction Patterns

**Animations**: Minimal, functional only
- Page transitions: Subtle fade (200ms)
- Loading states: Skeleton screens, not spinners
- Success feedback: Brief checkmark animation
- No decorative motion

**Hover States**:
- Cards: Subtle elevation increase (shadow-md)
- Buttons: Built-in component states
- Table rows: Slight background shift

**Loading States**:
- Skeleton screens for spec extraction
- Progress bar for agent search phases
- Inline spinners for individual card updates

---

## Accessibility

- All form inputs: Visible labels, not placeholders
- Minimum touch target: 44px height
- Focus indicators: 2px outline with offset
- Table markup: Proper thead/tbody/th scope attributes
- ARIA labels for icon-only buttons

---

This design prioritizes **information density without clutter**, **workflow efficiency**, and **enterprise credibility** - appropriate for procurement professionals managing complex sourcing decisions.