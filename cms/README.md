# React + Vite Project Setup

This repository demonstrates how to set up a modern React project using [Vite](https://vitejs.dev/). Vite is a fast build tool that provides a superior developer experience with its fast refresh and optimized build processes.

## Features

- **React**: A JavaScript library for building user interfaces.
- **Vite**: A next-generation frontend tool for fast and optimized builds.
- **ES6+ Support**: Modern JavaScript syntax support out of the box.
- **Hot Module Replacement (HMR)**: Lightning-fast updates during development.

---

## Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing purposes.

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 14 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/faizal108/PharmaClick.git
   cd PharmaClick
   ```

2. **Install Dependencies**:

   Using npm:
   ```bash
   npm install
   ```

   Or using yarn:
   ```bash
   yarn
   ```

3. **Start Development Server**:

   Using npm:
   ```bash
   npm run dev
   ```

   Or using yarn:
   ```bash
   yarn dev
   ```

   The application will be available at `http://localhost:5173` by default.

4. **Build for Production**:

   To generate a production build, run:

   Using npm:
   ```bash
   npm run build
   ```

   Or using yarn:
   ```bash
   yarn build
   ```

   The built files will be available in the `dist` directory.

5. **Preview Production Build**:

   To preview the production build locally, run:

   Using npm:
   ```bash
   npm run preview
   ```

   Or using yarn:
   ```bash
   yarn preview
   ```

   The preview will be available at `http://localhost:4173` by default.

---

## Design System & Theming

The UI is built on **Tailwind CSS + Headless UI + Heroicons**. There is no
component library dependency — primitives in `src/components/ui/` define every
button, input, modal, dropdown, table, etc.

### Theme tokens

All colors are declared once as HSL channel CSS variables in `src/index.css`
(e.g. `--background`, `--foreground`, `--card`, `--muted`, `--border`,
`--primary`, `--success`, `--danger`). Tailwind maps these tokens to utility
classes (`bg-background`, `text-foreground`, `border-border`, …) via
`tailwind.config.js`. Authoring rule: **never hard-code a color**; use a
token utility.

### Modes & accents

- **Modes**: `light`, `dark`, `system` — applied as the `dark` class on
  `<html>`. `system` follows `prefers-color-scheme` and re-evaluates live.
- **Accents**: `indigo` (default), `emerald`, `rose`, `amber`, `slate` —
  applied as `data-accent="…"` on `<html>`, which swaps the `--primary*`
  tokens.

State lives in `src/context/ThemeContext.jsx` and is persisted to
`localStorage` under the key `ui-theme`. A pre-paint script in `index.html`
applies the stored mode/accent before React mounts to avoid a flash of
unthemed content. End users change the theme from the **Settings** page.

### UI primitives

Imported from a single barrel: `import { Button, Card, Input, PowerTable }
from "src/components/ui"`. Notable entries:

| Primitive | Notes |
|---|---|
| `Button` | variants: `primary`/`secondary`/`outline`/`ghost`/`danger`/`success`/`link`; sizes `xs`–`lg` + `icon`; renders as `<button>`, `<a>`, or `<Link>` via `to`/`href`/`as` |
| `Input`, `Textarea`, `Select`, `FormField` | themed form controls; `Select` is Headless UI `Listbox`-based |
| `Card` (+ `CardHeader`/`CardTitle`/`CardBody`/`CardFooter`) | surface container |
| `Modal`, `ConfirmDialog`, `Dropdown`, `Tabs` | Headless UI under the hood |
| `Badge`, `EmptyState`, `Spinner`, `Skeleton`, `PageHeader` | misc |
| `ErrorBoundary` | wraps each protected route — a crash in one feature page keeps the shell (sidebar/topbar) alive |
| `PowerTable` | client-side table with global search, sortable headers, pagination + page size, column visibility menu, row selection + bulk actions, and CSV export |

### Error & loading UX

- Lazy routes show a centered themed `Spinner` while their chunk loads.
- Unknown authenticated routes render a themed **404** page.
- Unauthorized routes render a themed **Access Denied** page.
- Each protected route is wrapped in `ErrorBoundary`, so a runtime error in
  one screen shows a recoverable error card instead of blanking the app.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Headless UI](https://headlessui.com/)
- [Node.js](https://nodejs.org/)

---

### Author

Maintained by [faizal108](https://github.com/faizal108).

