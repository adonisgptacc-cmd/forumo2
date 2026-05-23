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

## Sharp edges

- There is no Storybook or visual test suite. Changes to components can silently break both `apps/web` and `apps/admin` — manually check both after edits.
- `DataTable` and `FilterBar` are generic but their prop APIs are not documented in the code. Read the source before using.
- The package has no build step. It ships raw TypeScript source. This means it cannot be published to npm as-is — it only works as a workspace dependency.
- Do not add app-specific logic (auth checks, API calls, routing) into this package. It must remain a pure UI library.
