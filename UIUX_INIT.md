UI/UX animation init for insight-bank-ai

What I added:

- `animate-reveal` already existed; added `animate-float` and `animate-pulse-soft` in `src/styles.css`.
- Created `src/components/ui/animated-card.tsx` as a reusable floating card.
- Added an animated preview card to the landing page (`src/routes/index.tsx`) that uses `animate-pulse-soft`.

Recommendations:

- Gradually add motion to interactive elements (buttons, forms) with subtle easing and limited duration.
- Consider the `@headlessui/react` or `framer-motion` libraries for richer animation control when needed.
- Test motion accessibility: offer a reduced-motion preference respecting `prefers-reduced-motion`.
