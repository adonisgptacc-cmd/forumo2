# packages/design-system

Shared React component library used by `apps/web` and `apps/admin`. Thin wrapper — four components, no custom styling engine. Relies on TailwindCSS being available in the consuming app.

## Tech stack

- React 18 (peer dependency)
- clsx 2.x
- tailwind-merge 3.x
- TypeScript 5.x

No bundler config of its own — consumed as a workspace package and transpiled by the host app's bundler (Next.js handles this via `transpilePackages` in `next.config.mjs`).

## Components

| Component | File | Purpose |
|---|---|---|
| `Button` | `src/button.tsx` | Themed button with variant/size props |
| `Card` | `src/card.tsx` | Surface container with optional padding and border |
| `DataTable` | `src/data-table.tsx` | Sortable/filterable table for tabular data |
| `FilterBar` | `src/filter-bar.tsx` | Row of filter controls (dropdowns, search input) |

All four are exported from `src/index.ts`.

## Import

```ts
import { Button, Card, DataTable, FilterBar } from '@forumo/design-system';
```

## Usage examples

```tsx
import { Button, Card } from '@forumo/design-system';

<Card>
  <h2>Order #1234</h2>
  <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
  <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
</Card>
```

## TailwindCSS dependency

Components use Tailwind utility classes directly. The consuming app must have TailwindCSS 4 configured and must include this package's source in its content scan so Tailwind can detect the classes.

In `apps/web` and `apps/admin`, `next.config.mjs` includes `transpilePackages: ['@forumo/design-system']`, which ensures Next.js compiles the package source and Tailwind sees its class names.

If you add a new component that uses Tailwind classes, no extra config is needed — the transpile step already covers it.

## How to add a new component

1. Create `src/my-component.tsx`:
   ```tsx
   import { clsx } from 'clsx';
   import { twMerge } from 'tailwind-merge';

   interface MyComponentProps {
     className?: string;
     children: React.ReactNode;
   }

   export function MyComponent({ className, children }: MyComponentProps) {
     return (
       <div className={twMerge(clsx('base-classes', className))}>
         {children}
       </div>
     );
   }
   ```
2. Export it from `src/index.ts`:
   ```ts
   export * from './my-component';
   ```
3. Import and use in the consuming app:
   ```ts
   import { MyComponent } from '@forumo/design-system';
   ```

## Storybook

Storybook 8 is configured with the Vite builder (port **6006**). Run from the monorepo root or from this package:

```bash
# from repo root
pnpm --filter @forumo/design-system storybook

# or from this directory
pnpm storybook
```

Stories live alongside each component in `src/`:

| Story file | Component | Covers |
|---|---|---|
| `src/button.stories.tsx` | Button | Default, all 4 variants, 3 sizes, disabled, loading, interactive |
| `src/card.stories.tsx` | Card | Default, with heading + actions, custom padding, nested |
| `src/data-table.stories.tsx` | DataTable | With data, empty, custom empty state, single row |
| `src/filter-bar.stories.tsx` | FilterBar | Default, title, chips, actions, interactive toggle, with children, full |

Storybook config lives in `.storybook/`:
- `main.ts` — Vite builder + `@tailwindcss/vite` plugin
- `preview.ts` — global backgrounds (light/dark), control matchers
- `tailwind.css` — `@import "tailwindcss"` entry point

To add stories for a new component, create `src/my-component.stories.tsx` following the CSF3 pattern in the existing story files.

## Sharp edges

- `DataTable` and `FilterBar` use a dark slate colour scheme — switch to the **dark** background in the Storybook toolbar to see them correctly.
- `DataTable` and `FilterBar` are generic but their prop APIs are not documented in the code. Read the source before using.
- The package has no build step. It ships raw TypeScript source. This means it cannot be published to npm as-is — it only works as a workspace dependency.
- Do not add app-specific logic (auth checks, API calls, routing) into this package. It must remain a pure UI library.
