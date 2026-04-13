# PLAN: Premium App Redesign (Deep Navy & Glassmorphism)

This plan coordinates the migration from the current generic UI to a sophisticated "Intelligence-Centric" interface.

## Agents Involved
- `project-planner`: Technical orchestration (Lead)
- `frontend-specialist`: Styling, Layout, and Component refactoring
- `orchestrator`: QA on design system consistency

## Phase 1: Global Aesthetic Overhaul
- [ ] **index.css**: Define "Deep Navy" design tokens.
    - Base: `#020617` (Deep Slate/Navy)
    - Accents: Ultra-saturated Cyan/Indigo
    - Surfaces: 10% opacity white/navy blurs
- [ ] **Tailwind Config**: Ensure blurs and backdrop utilities are active.

## Phase 2: Navigation & Layout
- [ ] **layout.tsx**: Remove Sidebar. Implement Floating Sticky Header.
    - Needs `backdrop-filter: blur(20px)`
    - Contextual links (Dynamic center section)
- [ ] **App.tsx**: Minor routing adjustments if needed.

## Phase 3: Page-Specific Premiumization
- [ ] **home.tsx**: Full redesign of the hero and "How it works" section.
- [ ] **recommendations.tsx**: Upgrade Job cards to use depth-layers instead of flat card containers.
- [ ] **profile.tsx**: Clean, data-driven dashboard layout.

## Phase 4: Atomic Interactions
- [ ] Implement `framer-motion` for snappy atomic interactions.
- [ ] Add loading states using blurred skeletons.

## Verification
- Accessibility: Contrast ratio check for deep navy backgrounds.
- Responsiveness: Floating header behavior on mobile.
- Performance: Impact of intensive `backdrop-filter` usage.
