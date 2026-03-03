# Apple Human Interface Guidelines (HIG) - Comprehensive Design Language Research

**Research Date:** March 3, 2026
**Sources:** Apple Developer Documentation, HIG Official Pages, iOS 17/18 Design Patterns

---

## Table of Contents
1. [Foundations](#foundations)
   - [Typography System](#typography-system)
   - [Color System](#color-system)
   - [Spacing and Layout](#spacing-and-layout)
   - [Iconography](#iconography)
   - [Motion and Animation](#motion-and-animation)
   - [Depth and Layering](#depth-and-layering)
2. [Navigation Patterns](#navigation-patterns)
3. [Components and Controls](#components-and-controls)
4. [Visual Language](#visual-language)
5. [Interaction Patterns](#interaction-patterns)
6. [Apple App Examples](#apple-app-examples)

---

## FOUNDATIONS

### Typography System

#### SF Pro Font Family
- **System Font:** SF Pro is the official system font for iOS and iPadOS
- **Language Support:** Over 150 languages across Latin, Greek, and Cyrillic scripts
- **Optical Variants:**
  - **SF Pro Text:** Use for text 19pt or smaller
  - **SF Pro Display:** Use for text 20pt or larger
  - **Variable Font Transition:** SF Pro transitions from Text to Display between 17pt and 28pt

#### Font Weights
**Available Weights (9 total):**
- Ultralight
- Thin
- Light
- Regular
- Medium
- Semibold
- Bold
- Heavy
- Black

**Recommended Weights for Accessibility:**
- Regular
- Medium
- Semibold
- Bold
- Avoid: Ultralight, Thin, and Light for accessibility

#### Text Styles and Default Sizes

iOS provides 11 semantic text styles that automatically scale with Dynamic Type:

| Text Style | Default Size (pt) | When to Use |
|------------|------------------|-------------|
| **Large Title** | 34pt | Top-level navigation screens, main headings |
| **Title 1** | 28pt | Primary section titles |
| **Title 2** | 22pt | Secondary section titles |
| **Title 3** | 20pt | Tertiary section titles |
| **Headline** | 17pt | Emphasized content, list headers |
| **Body** | 17pt | Primary text content |
| **Callout** | 16pt | Supplementary information |
| **Subheadline** | 15pt | Secondary descriptive text |
| **Footnote** | 13pt | Less important information |
| **Caption 1** | 12pt | Image captions, small labels |
| **Caption 2** | 11pt | Minimal supporting text |

**Minimum Font Size:** 11pt for iOS and iPadOS apps

#### Dynamic Type Scale

Dynamic Type allows users to adjust text size system-wide. The scale includes:
- **Standard Sizes:** xSmall, Small, Medium (default), Large, xLarge, xxLarge, xxxLarge
- **Accessibility Sizes:** AX1, AX2, AX3, AX4, AX5

Each text style scales proportionally across all size settings, maintaining hierarchy while respecting user preferences.

#### Character Spacing (Tracking)

San Francisco features dynamic tracking that varies by size:
- Tracking tables are published in Apple Design Resources
- Values were updated when SF Pro became a variable font
- New tracking values required between 17pt and 28pt for smooth optical sizing transitions
- Tracking automatically adjusts based on point size to maintain optimal legibility

#### Typography Best Practices

- Use system text styles to automatically support Dynamic Type
- Maintain clear hierarchy through variations in font weight, size, and color
- Ensure legibility by not going below 11pt
- Let tracking adjust automatically rather than manually overriding
- Support Dynamic Type in custom fonts using `UIFontMetrics`

---

### Color System

#### Semantic Color Philosophy

Apple's semantic color system uses dynamic colors that automatically adapt to:
- Light Mode / Dark Mode
- Vibrancy effects
- User interface context
- Accessibility settings (increased contrast)

**Key Principle:** Colors are not inverted between modes; separate carefully-selected palettes ensure consistency and appropriate contrast.

#### System Background Colors

iOS provides two background "stacks" for different UI patterns:

**Stack 1: Standard Backgrounds**
| Color | Usage | Light Mode | Dark Mode |
|-------|-------|------------|-----------|
| `systemBackground` | Main app background | Pure White | Pure Black |
| `secondarySystemBackground` | Content layered on main background | Light Gray | Dark Gray |
| `tertiarySystemBackground` | Content layered on secondary | Lighter Gray | Darker Gray |

**Best for:** Standard table views, white primary backgrounds

**Stack 2: Grouped Backgrounds**
| Color | Usage |
|-------|-------|
| `systemGroupedBackground` | Grouped content main background |
| `secondarySystemGroupedBackground` | Grouped content cards/cells |
| `tertiarySystemGroupedBackground` | Grouped content tertiary layer |

**Best for:** Grouped tables, platter-based designs, Settings-style interfaces

#### Label Colors (Text Hierarchy)

Four levels of text colors for establishing information hierarchy:
| Color | Opacity/Emphasis | Usage |
|-------|-----------------|-------|
| `label` | 100% | Primary text |
| `secondaryLabel` | ~60% | Secondary descriptive text |
| `tertiaryLabel` | ~30% | Tertiary/placeholder text |
| `quaternaryLabel` | ~18% | Disabled or watermark text |

#### System Colors

**Standard Colors:**
- `systemBlue`: #007AFF (Light), #0A84FF (Dark)
- `systemGreen`, `systemIndigo`, `systemOrange`, `systemPink`, `systemPurple`, `systemRed`, `systemTeal`, `systemYellow`

All system colors adapt between light and dark modes automatically.

#### Fill Colors

Used for backgrounds of components like buttons, switches:
- `systemFill`
- `secondarySystemFill`
- `tertiarySystemFill`
- `quaternarySystemFill`

#### Color Usage Guidelines

- **Always use semantic colors** rather than hard-coded values
- Prefer system-provided colors for consistency across iOS
- Test designs in both Light and Dark Mode
- Avoid creating app-specific appearance mode options
- Use destructive colors (red) for delete actions with confirmation
- Apply vibrancy effects to enhance foreground content on translucent backgrounds

#### Dark Mode Specifications

**Philosophy:**
- Darker backgrounds with lighter foreground colors
- Maintains contrast ratios for accessibility
- Uses vibrancy to make content "pop" against dark backgrounds
- Apps should respect system appearance setting

**Background Colors in Dark Mode:**
- Pure black (#000000) for systemBackground
- Elevated surfaces use systemGray tones
- Navigation bars use #1C1C1E

---

### Spacing and Layout

#### Grid System

**8-Point Grid System:**
- All spacing should work in multiples of 8px (or 4px for fine adjustments)
- Creates consistent rhythm and alignment across the interface
- Ensures elements align properly across different screen sizes

#### Standard Spacing Values

Common spacing increments used throughout iOS:
- **4pt** - Minimal spacing (between related small elements)
- **8pt** - Tight spacing (within components)
- **16pt** - Standard spacing (default padding/margins)
- **20pt** - Grid margins (screen edge to content)
- **24pt** - Comfortable spacing
- **32pt** - Section spacing
- **40pt** - Large section breaks
- **48pt** - Extra large spacing

#### Layout Margins

**Screen Margins:**
- **Standard:** 16pt on iPhone (both sides)
- **Alternative:** 20pt for more breathing room
- Prevents content from feeling cramped against edges

**Form Sheet Padding:** 16pt

#### Safe Areas

- **Purpose:** Prevent UI from being clipped by device sensors, notches, rounded corners
- **Implementation:** Use Auto Layout or SwiftUI to respect system-defined safe areas
- **Key Areas:**
  - Top: Status bar, Dynamic Island, notch clearance
  - Bottom: Home indicator area on Face ID devices
  - Sides: Respect rounded corner radius

#### Interactive Element Sizing

**Minimum Touch Target:**
- **44pt × 44pt** - Absolute minimum for any tappable element
- Ensures accessibility and ease of interaction
- Applies to buttons, switches, list rows, etc.

**Standard Element Heights:**
- **List Row:** 44pt minimum
- **Large Button:** 50pt
- **Medium Button:** 34pt
- **Small Button:** 28pt
- **Navigation Bar (standard):** 44pt
- **Navigation Bar (large title):** 96pt (44pt bar + 52pt large title space)
- **Tab Bar:** ~49pt (iPhone), varies on iPad
- **Search Bar:** 44pt-56pt

#### Layout Adaptability

- Use Auto Layout or SwiftUI for responsive interfaces
- Adapt to various screen sizes and orientations
- Support dynamic content sizing
- Respect multitasking on iPad (split view, slide over)

---

### Iconography

#### SF Symbols

**Overview:**
- Thousands of consistent, configurable symbols
- Integrates seamlessly with San Francisco system font
- Automatically aligns with adjacent text
- Available in all weights and scales

#### Weights

**9 Weights Available:**
- Ultralight, Thin, Light, Regular, Medium, Semibold, Bold, Heavy, Black
- Each weight corresponds to SF Pro font weights
- Enables precise weight matching between symbols and text

#### Scales

**3 Symbol Scales:**
| Scale | Usage | Context |
|-------|-------|---------|
| **Small** | Compact spaces | Tight layouts, limited space |
| **Medium** | Default | General purpose, most UI contexts |
| **Large** | Emphasis | Navigation bars, toolbars, tab bars (when space allows) |

**Key Characteristics:**
- Point size stays the same; scale adjusts relative rendering
- Scales are relative to San Francisco cap height
- Stroke thickness optically adjusted per scale
- Symbols auto-center vertically to cap height

#### Scale Usage Guidelines

**Based on Container Height:**
- **Regular height (spacious):** Use .large scale
- **Compact height (limited):** Use .medium scale
- All three scales work with same point size (e.g., 17pt)

**Common Placements:**
- **Tab Bars:** Medium scale (or Large if space permits)
- **Navigation Bars:** Large scale
- **Toolbars:** Large scale
- **Inline with Body Text:** Medium scale
- **List Accessories:** Small or Medium

#### Tab Bar Icon Specifications

**Portrait Mode:**
- **Recommended Size:** 25pt × 25pt
- **Asset Sizes:**
  - @1x: 25px × 25px
  - @2x: 50px × 50px
  - @3x: 75px × 75px

**Landscape Mode:**
- **Recommended Size:** 18pt × 18pt
- **Asset Sizes:**
  - @1x: 18px × 18px
  - @2x: 36px × 36px
  - @3x: 54px × 54px

**Additional Sizing:**
- **Wide Icons:** 31pt max
- **Tall Icons:** 28pt max

#### Icon Design Guidelines

**Style:**
- Use solid/glyph style (no outlines for tab bars since iOS 11)
- Fill variant preferred for tab bars (more visual emphasis)
- Outline variant preferred for navigation bars
- Single solid color on transparent background
- Shape used as mask; color applied programmatically

**Design Constraints:**
- No text in custom tab bar icons
- No drop shadows
- Antialiasing applied
- System ignores color information (alpha channel matters)

#### SF Symbols Best Practices

- Match symbol weight to adjacent text weight
- Use appropriate scale for context
- Leverage built-in symbols before creating custom icons
- Test symbols at multiple sizes and weights
- Maintain consistency across your app

---

### Motion and Animation

#### Core Principles

**Apple's Animation Philosophy:**
- **Lightweight and precise:** Quick animations feel less intrusive
- **Convey information effectively:** Animation should have purpose
- **Natural and believable:** Physics-based motion feels intuitive
- **Subtle and fluid:** Match iOS system animations
- **Respectful of user time:** Don't delay interactions unnecessarily

#### Spring Animations

**Why Springs:**
- Based on physical spring behavior
- Feel more natural than linear or ease curves
- Objects can finish at different times (realistic physics)
- Slowed by friction, mimicking real-world motion

**Design-Friendly Parameters:**

**Bounce Parameter:**
| Bounce Value | Feel | Usage |
|--------------|------|-------|
| 0 (default) | Smooth, gradual | General purpose UI, versatile |
| ~0.15 | Brisk, slightly snappy | Responsive actions |
| ~0.30 | Noticeably bouncy | Playful interactions |
| >0.40 | Too exaggerated | Avoid for standard UI |

**Response (Frequency):**
- Duration of one period in undamped system
- Controls how fast the animation feels
- Not the same as total animation duration

**Damping Ratio:**
- Controls how much the spring oscillates
- 1.0 = critically damped (no bounce)
- <1.0 = underdamped (bouncy)
- >1.0 = overdamped (sluggish)

#### Animation Duration Guidelines

**General Timing:**
- **Quick interactions:** 0.2s - 0.3s (most UI transitions)
- **Modal presentations:** 0.3s - 0.4s
- **Complex transitions:** 0.4s - 0.6s (max recommended)
- **Avoid:** Animations longer than 0.6s feel sluggish

**System Defaults:**
- Use `UIView.animate(withDuration:...)` defaults when possible
- Match system animation timing for consistency
- User-initiated actions should feel immediate (<0.3s)

#### Common Animation Types

**Transitions:**
- Smooth screen transitions
- Fluid orientation changes
- Modal presentations (sheet up, fade in)
- Navigation push/pop

**Physics-Based:**
- Physics-based scrolling with momentum and bounce
- Pull-to-refresh with spring resistance
- Rubber-banding at scroll boundaries

**Interactive:**
- Swipe gestures (dismissible, cancelable)
- Drag and drop with physics
- Interactive navigation transitions

**Microinteractions:**
- Button press (scale down slightly)
- Switch toggle
- Selection feedback
- Loading indicators

#### Animation Best Practices

- **Match system behavior:** Users are accustomed to iOS patterns
- **Test on device:** Simulator timing can differ
- **Support reduced motion:** Respect accessibility preferences
- **Cancelable when appropriate:** Allow gesture cancellation
- **Avoid blocking UI:** Don't prevent interaction during animation
- **Use spring defaults:** Start with bounce 0 for general UI
- **Be consistent:** Similar actions should use similar animation

---

### Depth and Layering

#### Materials

**Definition:**
A material is a visual effect creating depth, layering, and hierarchy between foreground and background elements through translucency and blurring.

#### UIBlurEffect and System Materials

**Purpose:**
- Impart translucency and blurring to backgrounds
- Create visual separation between layers
- Add depth without hard shadows
- Adapt to Light and Dark Mode automatically

**Implementation:**
- Use `UIVisualEffectView` with `UIBlurEffect`
- Apply vibrancy effects on top for enhanced legibility

**System Material Styles (iOS 13+):**
| Style | Thickness | Usage |
|-------|-----------|-------|
| `.systemUltraThinMaterial` | Thinnest | Subtle overlay |
| `.systemThinMaterial` | Thin | Light separation |
| `.systemMaterial` | Normal | Standard overlay (default) |
| `.systemThickMaterial` | Thick | Strong separation |
| `.systemChromeMaterial` | Chrome | Toolbars, navigation bars |

**Grouped Material Variants:**
- `.systemUltraThinMaterialLight` / `...Dark`
- `.systemThinMaterialLight` / `...Dark`
- `.systemMaterialLight` / `...Dark`
- `.systemThickMaterialLight` / `...Dark`
- `.systemChromeMaterialLight` / `...Dark`

#### Material Thickness Considerations

**Choosing Material Thickness:**
- **Thicker materials:** Better contrast for text and fine details
- **Thinner materials:** More subtle, show more background
- **Context matters:** Consider content behind the material
- **Accessibility:** Thicker materials improve legibility

#### Glassmorphism and Liquid Glass (iOS 16+)

**Evolution of Apple's Translucency:**

**Traditional Materials (iOS 7-15):**
- Blur + translucency
- Static appearance
- Vibrancy for foreground content

**Liquid Glass (iOS 16+):**
- Translucent, dynamic material
- Reflects and refracts surrounding content
- Physically accurate lensing
- Responds to light, motion, environment in real-time

**Design Philosophy:**
- **Hierarchy:** Controls float above content
- **Exclusivity:** Only for navigation layer, never content itself
- **Content stays primary:** Glass provides functional overlay

**Layer Structure:**
| Layer | Contents | Treatment |
|-------|----------|-----------|
| **Background Layer** | Content (wallpapers, imagery, lists, media) | Opaque or content-appropriate |
| **Glass Layer** | Controls (panels, modals, cards, navigation) | Semi-transparent with Liquid Glass |

**Translucency Variants:**
| Variant | Transparency | Usage |
|---------|--------------|-------|
| `.regular` | Medium | Default for most UI |
| `.clear` | High | Media-rich backgrounds |
| `.identity` | None (disabled) | Conditional disable |

**Technical Characteristics:**
- Lighting and shaders suggest clear or frosted glass
- Adapts to light/dark appearance for legibility
- Refraction and reflection of background elements
- Real-time environmental response

#### Vibrancy

**Purpose:**
- Enhances foreground content on translucent backgrounds
- Makes text and symbols more legible
- Creates visual "pop" against blur

**Usage:**
- Apply via `UIVibrancyEffect` on top of `UIBlurEffect`
- Automatic color adjustment based on background
- System handles contrast and legibility

#### Design Guidelines for Materials

**When to Use Materials:**
- Overlays (sheets, alerts, context menus)
- Navigation bars and toolbars
- Sidebars and panels
- Controls floating over content
- Provide context by showing background behind UI

**When to Avoid:**
- Primary content (text, images, videos)
- List items and table cells (unless specific design pattern)
- When clarity and contrast are critical
- Over complex or colorful backgrounds (may reduce legibility)

**Best Practices:**
- Test materials over various backgrounds
- Ensure text legibility with vibrancy
- Respect system appearance (Light/Dark Mode)
- Don't over-layer materials (visual noise)
- Use thicker materials for text-heavy content

---

## NAVIGATION PATTERNS

### Tab Bar (Bottom Navigation)

#### Purpose and Usage
- **Primary navigation** for top-level sections
- Persistent across the app
- Provides quick switching between main areas

#### Specifications

**Height:**
- **iPhone:** ~49pt
- **iPad:** Varies, typically taller with more spacing

**Tab Count:**
- **iPhone:** 3-5 tabs recommended, 5 maximum displayed
- **iPad:** Up to 7 tabs possible
- More than max displayed: "More" tab appears

#### Icon Specifications

**Portrait:**
- 25pt × 25pt (target area)
- @3x: 75px × 75px
- @2x: 50px × 50px
- @1x: 25px × 25px

**Landscape:**
- 18pt × 18pt
- @3x: 54px × 54px
- @2x: 36px × 36px
- @1x: 18px × 18px

**Icon Style (iOS 11+):**
- Solid/glyph style (filled)
- Single color on transparent background
- No text, shadows, or gradients
- Fill variant for selected state

#### Label Treatment

**iPhone:**
- Labels render below icon
- Small font size
- Concrete nouns or verbs

**iPad:**
- Labels render next to icon (horizontal)
- Larger font size

**Text Guidelines:**
- Use clear, concrete terms
- Short (1-2 words max)
- Describes content type or action

#### States

**Unselected:**
- Gray color (#8E8E93 at 30% opacity)
- Outline or regular weight icon

**Selected:**
- Tint color (default: systemBlue)
- Filled/solid icon variant
- Bold label (optional)

#### Badging

**Purpose:** Indicate new information, notifications, updates

**Style:**
- Red oval
- White text
- Number or exclamation point
- Positioned top-right of icon

#### Best Practices

- **Navigation only:** Don't use for actions
- **Consistency:** Keep same tabs across app
- **Selected state:** Always indicate current tab
- **Avoid overflow:** Stay within 3-5 tabs on iPhone
- **Icons + labels:** Both improve understanding
- **No empty states:** All tabs should have content

---

### Navigation Bar (Top)

#### Standard Navigation Bar

**Height:** 44pt

**Components:**
- Back button (left)
- Title (center)
- Action buttons (right, 1-2 max)

**Usage:**
- Standard for most screens
- Inline title for secondary views
- Provides hierarchical navigation context

#### Large Title Navigation Bar

**Height:** 96pt (44pt bar + 52pt title space)
**With Status Bar:** 116pt total (96pt + 20pt status bar)

**Behavior:**
- Large title displays when scrolled to top
- Collapses to inline title when scrolling down
- Smooth animated transition

**When to Use:**
- Root view controller of navigation stack
- Top-level screens
- Main sections that benefit from prominent heading
- Apps with clear content hierarchy

**When to Avoid:**
- Secondary/detail views (use inline)
- Screens with limited content
- When space is critical

**Large Title Display Mode:**
- `.automatic` - Inherits from previous controller
- `.always` - Always displays large
- `.never` - Always inline

#### Navigation Bar Components

**Back Button:**
- Left side of bar
- Chevron (<) + previous screen title (or "Back")
- Automatic in navigation controller
- Tappable, also swipe from left edge

**Title:**
- Center-aligned (standard bar)
- Left-aligned (large title)
- Clear, concise description of current view

**Toolbar Buttons:**
- Right side (primary actions)
- Left side (secondary actions, if no back button)
- Use SF Symbols or short text
- 1-2 buttons max to avoid crowding

#### Best Practices

- Use large titles for top-level navigation
- Inline titles for detail/secondary views
- Keep toolbar button count minimal
- Use clear, actionable button labels
- Support swipe-back gesture
- Maintain consistent styling across app

---

### Back Navigation and Swipe Gestures

#### Back Button

**Appearance:**
- Chevron (<) + previous screen title
- Tint color (typically systemBlue)
- Left side of navigation bar

**Behavior:**
- Tapping navigates to previous screen
- Animation: slide from left (push), slide to right (pop)

#### Edge Swipe Gesture

**Activation:**
- Swipe right from left screen edge
- System-standard gesture across iOS

**Behavior:**
- Interactive, cancelable transition
- User controls transition speed
- Can cancel mid-swipe by swiping back left

**iOS 16+ Enhancement:**
- Swipe can start anywhere on screen (not just edge)
- Makes navigation easier on larger iPhones
- More forgiving, user-friendly

#### Implementation Guidelines

- Support both tap and swipe
- Don't disable swipe gesture without good reason
- Make transition interactive and cancelable
- Mimic iOS standard: screen-edge pan gesture
- Provide visible back button as alternative

---

### Modal Sheets

#### Sheet Types

**Full Sheet:**
- Covers entire screen
- Modal, requires dismissal to return
- Used for complex, focused tasks

**Half Sheet (iOS 15+):**
- Rests at ~50% screen height
- Can be dragged to full or dismissed
- Less intrusive than full modal

**Detent System:**
- `.medium()` - Approximately half-screen (~50%)
- `.large()` - Full-screen modal
- Can specify multiple detents for draggable sheets

#### When to Use Sheets

**Appropriate Use Cases:**
- Scoped task closely related to current context
- Temporary focus (compose message, select item)
- User completes or dismisses to continue
- Form input
- Content detail that doesn't fit main hierarchy

**Avoid For:**
- Primary navigation (use tab bar or navigation stack)
- Multi-step complex flows (consider navigation stack)
- Frequent back-and-forth with underlying content

#### Sheet Presentation Styles

**iOS/iPadOS:**
- **Modal (default):** Blocks interaction with content below
- **Non-modal:** Allows interaction with content below (context-dependent)

**iPad-Specific:**
- **Form Sheet:** Centered on screen, dimmed background
- **Page Sheet:** Partially covers content, card-like

**Form vs Page Sheets:**
- Identical on iPhone
- Differ only on iPad (size and positioning)

#### Dismissal Methods

- **Drag Down:** Swipe gesture from top
- **Dismiss Button:** Explicit "Done," "Cancel," "Close"
- **Action Completion:** Automatically dismiss on task completion
- **Tap Outside:** Non-modal sheets (iPad)

#### Best Practices

- Provide clear dismissal affordance
- Use half-sheet for quick actions
- Full sheet for immersive tasks
- Don't nest sheets deeply (1 level preferred, 2 max)
- Indicate whether changes are saved on dismiss
- Support drag-to-dismiss gesture

---

### Context Menus and Long-Press

#### Context Menus

**Activation:**
- Long-press on an element
- 3D Touch (legacy devices)

**Purpose:**
- Quick access to related commands
- Contextual actions for specific content
- Reduces interface clutter

#### Menu Structure

**Components:**
- **Preview:** Shows content preview (optional)
- **Actions:** List of commands
- **Submenus:** One level allowed (avoid deep nesting)

**Preview Behavior:**
- Can tap preview to open content
- Can drag preview to another area
- Not required; some menus are action-only

#### Menu Design Guidelines

**Menu Length:**
- Keep menus short (3-7 items ideal)
- Long menus are hard to scan and scroll
- Group related actions

**Action Types:**
- **Positive actions** (Copy, Share)
- **Destructive actions** (Delete - shown in red)
- **Cancel** (dismisses menu)

**Icons:**
- Use SF Symbols for menu items
- Aids quick scanning and recognition

#### Best Practices

- **Relevance:** Only include contextually relevant actions
- **Main interface availability:** All context menu actions should also be available in main UI
- **Advanced vs. common:** Don't hide essential actions in context menu
- **Consistency:** Similar items should have similar menus
- **One-level submenus:** Avoid deep menu hierarchies
- **Preview when useful:** Show preview if it aids decision-making

---

## COMPONENTS AND CONTROLS

### Buttons

#### Button Styles (iOS 15+)

Apple introduced four standard button styles in iOS 15:

| Style | Appearance | Usage |
|-------|------------|-------|
| **Filled** | Background filled with tint color | Primary actions, most prominent |
| **Tinted** | Tinted background (lighter than filled) | Secondary actions, softer emphasis |
| **Gray** | Gray background | Neutral actions |
| **Plain** | No background, text only | Tertiary actions, minimal emphasis |

#### Button Sizes

| Size | Height | Usage |
|------|--------|-------|
| **Large** | 50pt | Primary screen actions, prominent CTAs |
| **Medium** | 34pt | Standard buttons, balanced |
| **Small** | 28pt | Compact spaces, secondary actions |

#### Corner Radius

- **Standard Buttons:** ~10-12pt corner radius
- **Pill-Shaped:** cornerRadius = height / 2
- **Customizable:** Can adjust to match app design
- **Continuous Curve:** Use `.continuous` corner style in SwiftUI for iOS-native feel

#### Padding

- **Horizontal Padding:** 16pt (typical for text buttons)
- **Vertical Padding:** Auto-calculated based on button size
- **Minimum Touch Target:** 44pt × 44pt (even if visual size is smaller)

#### Button Configurations (UIKit)

**UIButton.Configuration (iOS 15+):**
- Centralized styling system
- Supports dynamic type automatically
- Multiline text support built-in
- Enhanced accessibility

**Properties:**
- Title, subtitle
- Image (icon)
- Padding, spacing
- Background, foreground styles
- Corner radius

#### SwiftUI Button Styles

- `.bordered`
- `.borderedProminent` (filled style)
- `.borderless` (plain)
- `.plain`

#### Best Practices

- **Hierarchy:** Use filled for primary, tinted/gray for secondary, plain for tertiary
- **Accessibility:** Maintain 44pt min touch target
- **Dynamic Type:** Support text scaling
- **Clear labels:** Actionable verbs (Save, Cancel, Delete)
- **Loading states:** Show activity indicator during processing
- **Destructive actions:** Use red color + confirmation for dangerous actions

---

### Lists and Tables

#### List Styles

**Grouped Style:**
- Sections with headers/footers
- Rounded corners on section groups
- Background color distinct from screen background
- Used in Settings, configuration screens

**Inset Grouped Style (iOS 13+):**
- Grouped sections with insets (margins from edges)
- Rounded corners per section
- Modern, card-like appearance
- Preferred for contemporary designs

**Plain/Default Style:**
- No section grouping visuals
- Separators between all rows
- Used for long, homogeneous lists (Contacts, Messages)

#### Row Specifications

**Row Height:**
- **Minimum:** 44pt (standard, one line)
- **Dynamic:** Auto-height based on content
- **Custom:** Can be taller for rich content

**Row Components:**
- Leading accessory (icon, image, checkbox)
- Primary text (title)
- Secondary text (subtitle, detail)
- Trailing accessory (disclosure, detail button, toggle)

#### Separators

**Appearance:**
- Thin line (1px hairline)
- Light gray color
- Inset from left edge (typically aligns with text)

**Customization:**
- Can hide separators
- Adjust inset values
- Change color (rare, maintain consistency)

#### Disclosure Indicators

**Chevron (>):**
- Indicates row is tappable, leads to another screen
- Right-aligned
- Gray color
- Standard navigation affordance

**Detail Disclosure (i):**
- Info button
- Reveals more information about row
- Doesn't navigate to new screen

**Checkmark:**
- Indicates selection state
- Used in selection lists

#### Swipe Actions

**Trailing Actions (Swipe Left):**
- Primary/destructive actions (Delete, Archive)
- Red for destructive
- Can show multiple actions (prioritize 1-2)

**Leading Actions (Swipe Right):**
- Secondary/positive actions (Mark as Read, Pin)
- Blue or custom color

#### Best Practices

- Use inset grouped for modern look
- Keep row height consistent within a list
- Disclosure indicator when row is tappable
- Swipe actions for common, quick tasks
- Don't combine index (A-Z) with right-aligned elements
- Support dynamic type for row text

---

### Cards

Cards are not an official system component but are a common design pattern in iOS apps.

#### Specifications

**Corner Radius:**
- **Typical:** 12pt - 16pt
- **iOS Standard Feel:** cornerRadius = width × 0.222, corner smoothing 61%
- **Continuous Curve:** Use `.continuous` style for authentic iOS look

**Shadows:**
- **Color:** Black
- **Opacity:** 0.1 (10%)
- **Radius:** 8pt
- **Offset:** x: 0, y: 4pt

**Padding:**
- **Internal Padding:** 16pt (standard)
- **Between Cards:** 12pt - 16pt
- **Screen Margins:** 16pt - 20pt

#### Visual Treatment

**Backgrounds:**
- Use `secondarySystemGroupedBackground` for card color
- Contrast with `systemGroupedBackground` for screen
- Maintains light/dark mode consistency

**Elevation:**
- Subtle shadow (as specified above)
- Or use system materials for translucent cards
- Avoid heavy shadows (not iOS-native)

#### Best Practices

- Use cards for related, self-contained content
- Maintain consistent corner radius across app
- Don't over-nest cards
- Ensure adequate padding for breathing room
- Tappable cards should have clear affordance (no shadow change alone)

---

### Search Bars

#### Specifications

**Height:** 44pt - 56pt (depending on style and OS version)

**Placement:**
- Navigation bar (integrated)
- Top of scrollable content (inline)
- Dedicated search screen

#### Styles

**Default:**
- Rounded rectangle background
- Magnifying glass icon (left)
- Placeholder text
- Clear button (x) when typing

**Minimal (iOS 13+):**
- No visible background when inactive
- Expands when tapped
- Integrates seamlessly into navigation bar

#### Components

**Placeholder:**
- Descriptive text ("Search Messages," "Search for apps")
- Gray color, disappears when typing

**Cancel Button:**
- Appears when search is active
- Returns to previous state
- Located right of search field

**Scope Buttons:**
- Optional filter buttons below search bar
- Segmented control style
- Narrow search scope ("All," "Unread," "Flagged")

#### Best Practices

- Use search when content is extensive
- Clear placeholder text describing search scope
- Show cancel button when search is active
- Provide recent searches or suggestions
- Real-time results as user types (when practical)
- Clear button always visible when text is present

---

### Segmented Controls

#### Purpose
- Mutually exclusive selection (radio buttons)
- 2-5 segments typical
- Switch between views or filter content

#### Specifications

**Height:** ~32pt (standard)

**Segments:**
- Equal width (divided evenly across control)
- Can contain text or icons (don't mix in one control)

**Selected State:**
- Filled background (tint color or white, depending on style)
- Bold text (optional)

#### Styles

**Modern (iOS 13+):**
- Rounded rectangle background
- Selected segment has contrasting fill
- Smooth animated transition between selections

**Legacy:**
- Bordered segments
- Clear divisions between segments

#### Usage Guidelines

- **iPhone:** 5 or fewer segments
- **iPad:** Can have more, but keep readable
- **Text:** Short, clear labels (1-2 words)
- **Icons:** Use consistent SF Symbols, same weight

#### Common Use Cases

- View switchers (Map, Transit, Satellite)
- Filters (All, Active, Completed)
- Time ranges (Day, Week, Month)

#### Best Practices

- Don't mix text and icons
- Keep labels short
- Use for mutually exclusive choices only
- Limit to 2-5 segments on iPhone
- Provide immediate feedback on selection

---

### Form Inputs and Text Fields

#### Text Field Specifications

**Height:** 44pt (minimum touch target)

**Components:**
- Optional leading icon or label
- Placeholder text
- Input text
- Optional trailing button (clear, visibility toggle)

**Border Styles:**
- **Rounded rectangle** (most common)
- **Line/underline** (minimal)
- **Bezel** (legacy)
- **None** (custom)

#### Keyboard Types

iOS provides specialized keyboards for different input types:
- Default (text)
- Number pad
- Phone pad
- Email address
- URL
- Decimal pad
- Twitter (@ and # easily accessible)

**Always use appropriate keyboard type** for faster input and fewer errors.

#### Input Accessory View

**Purpose:** Toolbar above keyboard

**Common Uses:**
- Done button (dismiss keyboard)
- Next/Previous buttons (navigate fields)
- Autocomplete suggestions

#### Validation and Feedback

**Real-Time:**
- Show errors as user types (after initial blur)
- Checkmark for valid input

**On Submit:**
- Validate before processing
- Show inline error messages (red text below field)
- Highlight invalid fields

**Error Messages:**
- Specific, actionable (not just "Invalid")
- Example: "Email must include @" instead of "Invalid email"

#### Best Practices

- Use clear placeholder text
- Label fields above or inline
- Appropriate keyboard type always
- Support autofill (name, email, address, passwords)
- Provide clear button to erase input
- Group related fields
- Minimize required fields
- Support accessibility (VoiceOver labels)

---

### Toggles and Sliders

#### Toggle/Switch

**Specifications:**
- Standard iOS switch component
- **Width:** ~51pt
- **Height:** ~31pt
- Binary on/off state

**Colors:**
- **Off:** White/light gray
- **On:** Green (default), or custom tint color

**Usage:**
- Tables/lists (Settings pattern)
- Enable/disable features
- Boolean preferences

**Best Practices:**
- Use in lists/tables
- Don't provide redundant labels ("On"/"Off" - unnecessary)
- Label describes feature, not state
- Immediate effect on toggle (no separate Save button needed)

#### Sliders

**Specifications:**
- **Height:** ~34pt (including touch target)
- **Thumb (handle):** Circular, draggable
- **Track:** Filled to left of thumb, empty to right

**Optional Elements:**
- Min/max icons or labels at ends
- Value display (current value shown)

**Colors:**
- Filled track: Tint color (default systemBlue)
- Unfilled track: Light gray
- Thumb: White with subtle shadow

**Usage:**
- Continuous value selection
- Volume, brightness adjustments
- Range selection (price, distance)

**Best Practices:**
- Provide min/max context (icons or labels)
- Show current value if precise value matters
- Use for continuous ranges, not discrete steps
- Support accessibility (VoiceOver with value announcements)

---

### Pull to Refresh

#### Behavior

**Activation:**
- Drag down from top of scrollable content
- Release to trigger refresh

**Feedback:**
- Activity indicator appears
- Spins while loading
- Disappears when complete

**Animation:**
- Smooth, physics-based
- Rubber-banding effect
- Content bounces back into place

#### Specifications

**Indicator:**
- System-provided activity spinner
- Centered horizontally
- Appears just below navigation bar or at top of content

**States:**
- Inactive (hidden)
- Pulling (indicator visible but not triggered)
- Loading (spinning)
- Complete (fades out)

#### Best Practices

- Use for time-sensitive content (feeds, messages, data lists)
- Ensure refresh actually fetches new content
- Provide immediate feedback (spinner)
- Keep refresh time reasonable (<3 seconds ideal)
- Don't use if content doesn't change frequently

---

## VISUAL LANGUAGE

### Rounded Rectangles

#### Corner Radius Values by Component

**Buttons:**
- Small elements: 8pt - 10pt
- Standard buttons: 10pt - 12pt
- Large buttons/cards: 12pt - 16pt
- Pill-shaped: height / 2

**Cards:**
- Standard: 12pt - 16pt
- Large cards: 16pt - 20pt

**Sheets/Modals:**
- Top corners: 10pt - 16pt

**App Icons:**
- Complex formula: width × 0.222
- 60px icon: ~13px radius
- Scales proportionally

#### Continuous Curve vs. Standard Radius

**Standard Radius:**
- Circular arc (constant radius)
- Mathematical simplicity

**Continuous Curve (.continuous in iOS):**
- Smoothly varying curvature
- Appears more organic and refined
- **This is the iOS-native look**
- Used throughout system UI

**Always prefer continuous curves** in SwiftUI:
```swift
RoundedRectangle(cornerRadius: 16, style: .continuous)
```

#### Display Corner Radii

Device screens themselves have rounded corners:
- **iPhone X:** ~40pt physical radius
- Varies by device model
- SwiftUI respects safe areas automatically

---

### Shadows and Elevation

#### Apple's Shadow Philosophy

**Minimal Use:**
- iOS design favors flat, layered design over heavy shadows
- Subtle shadows or no shadows at all
- Depth created through layering, materials, color contrast

#### When Shadows Are Used

**Floating Elements:**
- Modal sheets (very subtle)
- Context menus (system-provided)
- Drag-and-drop (temporary)

**Cards (Optional):**
- **Color:** Black
- **Opacity:** 0.1 (10%)
- **Radius:** 8pt
- **Offset:** x: 0, y: 4pt

**Avoid:**
- Heavy drop shadows
- Multiple shadow layers
- Shadows on buttons (not iOS style)

#### Alternative Elevation Techniques

**Preferred over shadows:**
- **Materials:** Translucent blur backgrounds
- **Borders:** Subtle hairlines
- **Background colors:** Secondary/tertiary system backgrounds
- **Layering:** Stacking UI on distinct background levels

---

### Background Layering System

#### Layer Hierarchy

iOS uses a three-level background system to create depth and structure:

**Three-Tier System:**

**Level 1: Base**
- `systemBackground` (light/dark)
- Main app canvas
- White (light mode), Black (dark mode)

**Level 2: Elevated**
- `secondarySystemBackground`
- Cards, table cells, grouped content
- Slightly contrasted from base

**Level 3: Further Elevated**
- `tertiarySystemBackground`
- Content on cards, nested elements
- Additional contrast layer

#### Grouped Background Variant

**For Grouped Designs:**
- `systemGroupedBackground` (base)
- `secondarySystemGroupedBackground` (cards)
- `tertiarySystemGroupedBackground` (content on cards)

**Usage:**
- Settings-style interfaces
- Platter-based designs
- Grouped table views

#### Combining Layers

**Visual Hierarchy:**
- Base layer: Screen background
- Cards/cells: Secondary background
- Content within cards: Tertiary background (if needed)

**Example (Settings):**
- Screen: systemGroupedBackground
- Each setting group: secondarySystemGroupedBackground
- (Rare) Nested content: tertiarySystemGroupedBackground

---

### Glassmorphism and Translucency

#### Traditional Materials (iOS 7-15)

**Characteristics:**
- Blur effect
- Translucency (shows content behind)
- Vibrancy for foreground elements
- Static appearance

**Common Uses:**
- Navigation bars
- Toolbars
- Sidebars
- Control panels

#### Liquid Glass (iOS 16+)

**Next Evolution:**
- Dynamic, refraction-based materials
- Physically accurate lensing
- Responds to light, motion, environment
- Real-time reflections and refractions

**Design Hierarchy:**
- **Content layer:** Opaque, primary (lists, media, text)
- **Control layer:** Translucent, overlay (navigation, toolbars, floating controls)

**Variants:**
- `.regular` - Medium transparency (default)
- `.clear` - High transparency (media-rich backgrounds)
- `.identity` - No effect (conditional disable)

**When to Use:**
- Navigation and control elements
- Floating panels
- Overlays
- Toolbars and sidebars

**When NOT to Use:**
- Primary content (text, images, videos)
- Lists and tables (unless specific pattern)
- Critical information requiring maximum contrast

---

### Whitespace Philosophy

#### Importance of Whitespace

**Apple's Approach:**
- Generous whitespace
- Breathing room between elements
- Uncluttered, focused interfaces
- Guides user attention

#### Spacing Strategy

**Consistent Increments:**
- Use 8pt grid system
- Standard spacing: 8pt, 16pt, 24pt, 32pt, 40pt, 48pt

**Grouping:**
- Related elements: closer spacing (8pt)
- Separate sections: larger spacing (24pt-32pt)
- Major breaks: 40pt-48pt

#### Layout Density

**Avoid Cramped Layouts:**
- Don't fill every pixel
- Let content breathe
- Use margins generously (16pt-20pt)

**Prioritize Content:**
- Remove unnecessary chrome
- Let important content dominate
- Use whitespace to create focus

#### Examples from Apple Apps

**Apple Music:**
- Large album art with ample margins
- Generous spacing between sections

**Settings:**
- Grouped lists with clear section breaks
- Plenty of padding in cells

**Notes:**
- Minimal interface, maximum content space
- Clean, uncluttered writing surface

---

## INTERACTION PATTERNS

### Haptic Feedback

#### Types of Haptic Feedback

iOS provides three categories of haptic feedback:

**1. Notification Feedback:**
- **Success:** Action completed successfully
- **Warning:** Proceed with caution
- **Error:** Action failed or error occurred

**2. Impact Feedback:**
- **Light:** Subtle, small UI changes
- **Medium:** Standard interactions
- **Heavy:** Significant events, drag and drop

**3. Selection Feedback:**
- Single, subtle tap
- Used when making selections (picker, segmented control)

#### System-Provided Haptics

**Automatic Haptics (Built-in):**
- Pickers (wheel spin)
- Switches (toggle)
- Sliders (discrete values)

**No additional code needed** for standard system controls.

#### When to Use Haptic Feedback

**Appropriate Use Cases:**
- Confirm actions (button press, toggle)
- Signal completion (task finished)
- Warn (destructive action about to happen)
- Provide selection feedback (scrolling through options)
- Enhance interactions (drag, swipe)

**Avoid Overuse:**
- Not every tap needs haptics
- Don't use for decorative purposes
- Can be overwhelming if overused
- Respect user's haptic settings

#### Best Practices

- **Reinforce actions, don't replace visual feedback**
- **Match intensity to action significance**
- **Use consistent patterns** (same action = same haptic)
- **Test on device** (simulator doesn't provide haptics)
- **Respect accessibility settings** (some users disable haptics)

---

### Loading States

#### Types of Loading Indicators

**1. Activity Indicator (Spinner):**
- System-provided spinning wheel
- Indeterminate progress
- Use when duration is unknown

**2. Progress Bar:**
- Determinate progress (0-100%)
- Use when progress can be calculated
- Shows user how much longer

**3. Skeleton Screens:**
- Placeholder content structure
- Gradually replaced by real content
- Modern, perceived as faster

#### Activity Indicators

**Specifications:**
- Two sizes: standard, large
- Colors: gray (default), or tint color
- Animates automatically when added to view

**Placement:**
- Center of loading area
- Can include label ("Loading...")

**Usage:**
- Short waits (<5 seconds)
- Background data fetching
- Indeterminate operations

#### Progress Indicators

**Specifications:**
- Horizontal bar
- Fills from left to right (0% to 100%)
- Can show percentage text

**Usage:**
- Downloads
- Uploads
- Multi-step processes
- Long operations (>5 seconds)

#### Skeleton Screens

**Structure:**
- Gray placeholder boxes
- Match layout of actual content
- Subtle shimmer/pulse animation

**Advantages:**
- Perceived faster load times
- User understands content structure
- Modern, polished feel

**Usage:**
- Lists and feeds
- Cards with images and text
- Profile screens

#### Best Practices

- **Minimize load times:** Best loading experience finishes before user notices
- **Provide feedback immediately:** Show loading state within 0.5 seconds
- **Match pattern to duration:**
  - <2s: Activity indicator or none
  - 2-5s: Activity indicator with label
  - >5s: Progress bar or skeleton screen
- **Don't block the entire UI:** Allow interaction with other parts if possible
- **Provide context:** Explain what's loading ("Loading messages...")

---

### Empty States

#### Purpose

- Inform user when content is unavailable
- Explain why content is missing
- Guide user on next steps

#### Components

**Image/Icon:**
- Relevant SF Symbol or custom illustration
- Large, centered
- Gray or muted color

**Headline:**
- Clear, concise message
- Example: "No Messages," "No Results Found"

**Description (optional):**
- Brief explanation or guidance
- Example: "Start a conversation by tapping the compose button."

**Action Button (optional):**
- Primary action to populate content
- Example: "Add Item," "Get Started"

#### Types of Empty States

**First Use:**
- User has never added content
- Welcome, guide them to first action

**User Cleared:**
- User deleted all items
- Positive reinforcement ("All done!")

**No Results:**
- Search or filter returned nothing
- Suggest adjusting criteria

**Error State:**
- Content failed to load
- Provide retry option

#### Best Practices

- **Be helpful and friendly:** Avoid negative language
- **Provide clear next step:** How to populate content
- **Use appropriate imagery:** Matches content type
- **Keep it simple:** Don't overwhelm with text
- **Action buttons:** Make it easy to add first item

---

### Error Handling

#### Inline Errors

**Preferred Method:**
- Show errors next to relevant fields/content
- Less intrusive than alerts

**Components:**
- Red text or icon
- Specific, actionable message
- Appears immediately or on blur/submit

**Example:**
- Text field with error below
- "Password must be at least 8 characters"

#### Alerts for Errors

**When to Use:**
- Critical errors requiring acknowledgment
- Errors affecting entire app state
- Network failures, server errors

**Structure:**
- Title: Brief error type ("Unable to Send Message")
- Message: Explanation and suggested action
- Buttons: "OK," "Retry," "Cancel"

#### Error Message Guidelines

**Be Specific:**
- Not: "Invalid input"
- Yes: "Email must include @"

**Be Actionable:**
- Tell user how to fix
- Example: "Check your internet connection and try again"

**Be Friendly:**
- Avoid technical jargon
- Example: "Something went wrong" > "Error code 500"

#### Best Practices

- **Prefer inline errors** over alerts
- **Prevent errors when possible** (disable invalid options)
- **Validate in real-time** (after first blur)
- **Provide retry options** for transient failures
- **Log errors** for debugging, but don't expose details to user

---

### Destructive Actions

#### Destructive Action Definition

Actions that permanently delete or modify content in a way that can't be easily undone.

**Examples:**
- Delete email
- Remove account
- Clear all data

#### Design Patterns

**1. Confirmation Alerts:**
- **When to use:** When user didn't explicitly choose destructive action
- **Style:** Alert with destructive button (red)
- **Buttons:**
  - Destructive action (red): "Delete"
  - Cancel (bold, default): "Cancel"

**Example:**
- Title: "Delete Item?"
- Message: "This action cannot be undone."
- Buttons: "Delete" (red), "Cancel" (bold)

**2. Action Sheets:**
- **When to use:** Multiple options including destructive action
- **Style:** Sheet with destructive button at top (red)

**3. No Confirmation:**
- **When to use:** User explicitly chose destructive action (e.g., "Empty Trash")
- **Rationale:** User already indicated intent
- **Safety:** Still use red color to signal destructiveness

#### Swipe to Delete

**Pattern:**
- Swipe left on list row
- Delete button appears (red)
- Tap to confirm delete
- Can cancel by swiping back or tapping elsewhere

**Usage:**
- Common in Messages, Mail, Notes
- Requires explicit swipe + tap (confirmation built-in)

#### Best Practices

- **Use red color** for destructive actions
- **Provide confirmation** unless user explicitly chose action
- **Make Cancel bold** and default button
- **Clear consequences:** Explain what will be deleted
- **Offer alternatives:** "Archive" instead of "Delete" when possible
- **Undo when feasible:** Provide undo option after action

---

## APPLE APP EXAMPLES

### Common Patterns Across iOS 17/18

#### Design Trends in Apple's Apps

**Liquid Glass (iOS 16+):**
- Increased translucency
- Floating controls
- Dynamic, refraction-based materials

**Generous Whitespace:**
- Uncluttered interfaces
- Focused content
- Clear hierarchy

**Large Titles:**
- Prominent section headings
- Collapses on scroll
- Clear navigation context

**Bottom-Aligned Actions:**
- Primary buttons at bottom of screen
- Easier thumb reach
- Common in forms and detail screens

**SF Symbols Everywhere:**
- Consistent iconography
- Weight-matched to text
- Scales with Dynamic Type

---

### Wallet App

#### Visual Characteristics

**Card Design:**
- Large, rounded rectangle cards
- **Corner Radius:** 12pt-16pt
- Layered, stacked appearance
- Realistic shadows and depth

**Bottom Navigation (iOS 17+):**
- Tab bar with categories: Cards, Cash, Keys, IDs, Orders
- SF Symbols for icons
- Clear, icon-driven navigation

**Interaction:**
- Swipe through cards
- Tap to expand for details
- NFC/contactless payment on device bring-near

**Search:**
- Swipe down to reveal search
- Find specific card or pass quickly

#### Design Lessons

- **Rich visual representation:** Cards look like real objects
- **Depth and layering:** Creates realistic stack effect
- **Clear categories:** Bottom nav separates content types
- **Quick access:** Search and favorites for speed

---

### Health App

#### Visual Characteristics (iOS 17+)

**Favorites Tab:**
- **Square tiles** for metrics
- Each tile: small colored graph or table
- More metrics visible without scrolling

**Data Visualization:**
- Charts and graphs prominent
- Color-coded by health category
- Interactive, tap to see details

**Navigation:**
- Tab bar: Summary, Favorites, Sharing, Browse
- Large titles on main screens

**Typography:**
- Large, bold numbers for key metrics
- Clear hierarchy: value > label > unit

#### Design Lessons

- **Data clarity:** Numbers and charts easy to read
- **Customization:** Users choose favorite metrics
- **Color coding:** Consistent categories (heart = red, activity = green)
- **Glanceable info:** Key data visible at a glance

---

### Reminders App

#### Visual Characteristics (iOS 17)

**List Organization:**
- Grouped lists with colors and icons
- Sections within lists (new in iOS 17)
- Automatic grocery list sections

**Smart Features:**
- Link reminders together
- Tag-based organization
- Date and time grouping

**Visual Design:**
- Clean, minimal list view
- Color-coded lists (user-chosen)
- Checkboxes for completion
- Subtle separators

**Actions:**
- Swipe to mark complete
- Tap to edit details
- Context menu for quick actions

#### Design Lessons

- **Customization:** Users control colors and icons
- **Sections:** Organize long lists
- **Quick actions:** Swipe and context menus
- **Clear completion:** Checkboxes, satisfying animation

---

### Notes App

#### Visual Characteristics

**Minimal Interface:**
- Maximum content space
- Minimal chrome
- Focus on writing surface

**List and Gallery Views:**
- Toggle between list and grid
- Thumbnails in gallery view
- Preview text in list view

**Rich Content:**
- Inline PDFs (iOS 17)
- Tables, checklists
- Sketches, scanned documents

**Collaboration:**
- Shared notes
- Real-time updates
- Activity view

**Navigation:**
- Folders and subfolders
- Search across all notes
- Recent notes quick access

#### Design Lessons

- **Content first:** UI gets out of the way
- **Rich editing:** Tables, links, attachments
- **Simple organization:** Folders + search
- **Collaboration built-in:** Not an afterthought

---

### Maps App

#### Visual Characteristics

**Map View:**
- Large, immersive map
- Minimal UI overlay
- Bottom sheet for details

**Segmented Control:**
- Switch views: Map, Transit, Satellite
- Top-center placement
- Clear visual differentiation

**Search:**
- Prominent search bar at top
- Autocomplete suggestions
- Recent searches

**Bottom Sheet:**
- Place details
- Draggable (detents)
- Half-sheet by default, expandable to full

**Floating Controls:**
- Current location button
- Zoom controls (optional, gesture-driven)
- 3D view toggle

#### Design Lessons

- **Immersive content:** Map dominates screen
- **Floating overlays:** Controls don't block map
- **Bottom sheets:** Efficient detail views
- **Gestures preferred:** Pinch zoom, rotate, pan

---

### Settings App

#### Visual Characteristics

**Grouped Lists:**
- `insetGrouped` table style
- Clear sections with headers
- Rounded corners on groups
- Margins from screen edges

**Hierarchy:**
- Top-level categories
- Drill-down navigation
- Breadcrumb via back button

**Controls:**
- Toggles for on/off settings
- Disclosure indicators for sub-screens
- Value display on right (e.g., "Wi-Fi Network Name")

**Search:**
- Persistent search bar at top
- Searches all settings
- Jumps directly to setting

**Visual Consistency:**
- SF Symbols for all icons
- Color-coded categories (Wi-Fi = blue, Privacy = blue shield, etc.)
- Standard row height (44pt)

#### Design Lessons

- **Clear hierarchy:** Top-level > sub-categories > individual settings
- **Inset grouped style:** Modern, Settings-style standard
- **Toggles for binary:** Direct manipulation
- **Disclosure for complex:** More settings await
- **Search essential:** Too many settings to browse

---

## SUMMARY OF KEY VALUES

### Typography
- **Text Styles:** 11 styles from Large Title (34pt) to Caption 2 (11pt)
- **Minimum Size:** 11pt
- **System Font:** SF Pro (Text < 20pt, Display ≥ 20pt)
- **Weights:** 9 weights; use Regular, Medium, Semibold, Bold for accessibility
- **Dynamic Type:** Always support, scales across accessibility sizes

### Color
- **Semantic Colors:** Use system-provided dynamic colors
- **Backgrounds:** Three-tier system (system, secondary, tertiary)
- **Two Stacks:** Standard (systemBackground) and Grouped (systemGroupedBackground)
- **Adapt Automatically:** Light and Dark Mode

### Spacing
- **Grid:** 8pt system
- **Margins:** 16pt-20pt from screen edges
- **Touch Target:** 44pt × 44pt minimum
- **Common Spacing:** 8pt, 16pt, 24pt, 32pt, 40pt, 48pt

### Iconography
- **SF Symbols:** Weight and scale matched to text
- **Tab Bar Icons:** 25pt × 25pt (portrait), 18pt × 18pt (landscape)
- **Scales:** Small, Medium, Large

### Motion
- **Duration:** 0.2-0.4s typical
- **Spring Default:** Bounce 0
- **Physics-Based:** Natural, believable motion

### Materials
- **Types:** Ultra Thin, Thin, Material (default), Thick, Chrome
- **Liquid Glass (iOS 16+):** Dynamic, refraction-based
- **Usage:** Controls and overlays, not content

### Components
- **Navigation Bar:** 44pt (standard), 96pt (large title)
- **Tab Bar:** ~49pt
- **Buttons:** Large (50pt), Medium (34pt), Small (28pt)
- **Lists:** Row height 44pt minimum
- **Cards:** Corner radius 12-16pt, shadow (0, 4, 8, 0.1)
- **Corner Radius:** Use `.continuous` style for iOS-native feel

### Interaction
- **Haptics:** Success, warning, error; light, medium, heavy impact; selection
- **Loading:** Activity indicator, progress bar, skeleton screens
- **Errors:** Inline preferred, alerts for critical
- **Destructive Actions:** Red color, confirmation required (usually)

---

## CONCLUSION

Apple's Human Interface Guidelines provide a comprehensive framework for creating intuitive, beautiful, and accessible iOS applications. Key takeaways:

1. **Use System Components:** Leverage built-in UI elements, text styles, colors, and symbols for consistency and automatic adaptation (Dark Mode, Dynamic Type, accessibility).

2. **Prioritize Content:** Generous whitespace, minimal chrome, clear hierarchy. Let content breathe.

3. **Respect User Preferences:** Support Dynamic Type, Dark Mode, accessibility features, haptic settings.

4. **Physics-Based Motion:** Animations should feel natural, spring-based, and respectful of user time.

5. **Semantic, Not Absolute:** Use semantic colors, text styles, and materials that adapt to context and user settings.

6. **Depth Through Layering:** Use background tiers, materials, and subtle shadows (or none) instead of heavy drop shadows.

7. **Clear Interaction Affordances:** Make tappable elements obvious, provide feedback, support gestures.

8. **Test on Device:** Simulators don't capture true appearance, haptics, or performance.

By adhering to these guidelines, your app will feel native, polished, and delightful to iOS users.

---

**References:**
- https://developer.apple.com/design/human-interface-guidelines/
- https://developer.apple.com/design/resources/
- https://developer.apple.com/sf-symbols/
- iOS 17/18 system apps and design patterns
