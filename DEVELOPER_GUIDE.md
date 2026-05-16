# Zen Notes - Developer Guide

## Architecture Overview

Zen Notes is a modern React application built with TypeScript, Vite, and TanStack Router. The application is designed to be simple, performant, and maintainable.

### Tech Stack

- **Frontend Framework**: React 19.2.0
- **Language**: TypeScript 5+
- **Build Tool**: Vite 7.3.3
- **Routing**: TanStack React Router 1.168.25
- **Styling**: Tailwind CSS 4.2.1
- **UI Components**: Radix UI
- **Icons**: Lucide React 0.575.0
- **State Management**: React Hooks
- **Storage**: Browser Local Storage API

---

## Project Structure

```
src/
├── routes/
│   ├── __root.tsx          # Root layout component
│   └── index.tsx           # Main notes application
├── components/             # Reusable UI components
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
├── index.css              # Global styles and animations
├── main.tsx               # Entry point
├── styles.css             # Tailwind configuration
└── router.tsx             # Router configuration
```

---

## Core Components

### Main Application: `src/routes/index.tsx`

The entire application is contained in a single route component. This is intentional to keep the codebase simple and maintainable.

#### State Management

```typescript
// Notes storage
const [notes, setNotes] = useState<Note[]>([]);
const [activeId, setActiveId] = useState<string | null>(null);

// UI state
const [dark, setDark] = useState(false);
const [query, setQuery] = useState("");
const [previewMode, setPreviewMode] = useState(false);
const [sidebarOpen, setSidebarOpen] = useState(true);

// Editor state
const [lastSaved, setLastSaved] = useState<number | null>(null);
const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

// Persistence
const [hydrated, setHydrated] = useState(false);
```

#### Note Type Definition

```typescript
type Note = {
  id: string;              // UUID v4
  title: string;           // Note title
  body: string;            // Markdown content
  updatedAt: number;       // Timestamp
  pinned?: boolean;        // Pin status
};
```

---

## Key Features Implementation

### 1. Markdown Rendering

The `renderMarkdown()` function parses markdown syntax and returns React elements:

```typescript
const renderMarkdown = (text: string): React.ReactNode[] => {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  
  // Process each line and return React elements
  // Supports: headings, bold, italic, code, lists, blockquotes
}
```

**Supported Markdown:**
- `# Heading 1` → `<h1>`
- `## Heading 2` → `<h2>`
- `**bold**` → `<strong>`
- `*italic*` → `<em>`
- `` `code` `` → `<code>`
- `\`\`\`block\`\`\`` → `<pre><code>`
- `- list` → `<li>`
- `> quote` → `<blockquote>`

### 2. Autosave with Debounce

Autosave prevents excessive localStorage writes:

```typescript
useEffect(() => {
  if (!hydrated) return;
  
  // Clear existing timer
  if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  
  // Set new timer (1 second delay)
  autoSaveTimer.current = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    setLastSaved(Date.now());
  }, AUTOSAVE_DELAY);
  
  return () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  };
}, [notes, hydrated]);
```

**Benefits:**
- Reduces localStorage writes (expensive operation)
- Shows user visual feedback ("✓ Saved")
- Maintains responsiveness
- Prevents data loss

### 3. Reading Time Calculation

```typescript
const getReadingTime = (text: string): number => {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200)); // 200 WPM
}
```

### 4. Keyboard Shortcuts

```typescript
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    // Ctrl/Cmd + N: New note
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      createNote();
    }
    
    // Ctrl/Cmd + S: Save
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      triggerImmediateSave();
    }
    
    // Ctrl/Cmd + K: Search
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      focusSearch();
    }
    
    // Delete: Remove note
    if ((e.key === "Delete" || e.key === "Backspace") && active && query === "") {
      deleteActive();
    }
  };
  
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [active, query, createNote, deleteActive, notes]);
```

### 5. Search Filtering

Real-time search across title and body:

```typescript
const filtered = useMemo(() => {
  const q = query.toLowerCase();
  return notes
    .filter(
      (n) =>
        !q || 
        n.title.toLowerCase().includes(q) || 
        n.body.toLowerCase().includes(q),
    )
    .sort((a, b) => {
      // Pinned notes first
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      // Then by newest
      return b.updatedAt - a.updatedAt;
    });
}, [notes, query]);
```

### 6. Local Storage Persistence

```typescript
// Hydrate on mount
useEffect(() => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    setNotes(parsed);
  }
  
  const theme = localStorage.getItem(THEME_KEY);
  if (theme === "dark") setDark(true);
  
  setHydrated(true);
}, []);

// Persist notes (with debounce)
useEffect(() => {
  if (!hydrated) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}, [notes, hydrated]);

// Persist theme
useEffect(() => {
  if (!hydrated) return;
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
}, [dark, hydrated]);
```

---

## Styling Architecture

### Tailwind CSS Configuration

Located in `src/styles.css`:

```css
@theme inline {
  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-ink-primary: var(--ink-primary);
  --color-ink-secondary: var(--ink-secondary);
  --color-accent: var(--accent);
  /* ... more theme variables */
}
```

### Color Variables (OKLch Color Space)

Using OKLch for perceptually uniform colors:

```css
:root {
  /* Light Mode */
  --canvas: oklch(0.98 0.001 0);        /* Off-white */
  --surface: oklch(0.94 0.002 255);     /* Light gray */
  --ink-primary: oklch(0.18 0.05 265);  /* Dark navy */
  --ink-secondary: oklch(0.52 0.03 260); /* Medium gray */
  --accent: oklch(0.60 0.20 260);       /* Vibrant blue */
}

.dark {
  /* Dark Mode */
  --canvas: oklch(0.15 0.02 265);       /* Deep dark */
  --surface: oklch(0.20 0.03 265);      /* Slightly lighter */
  --ink-primary: oklch(0.95 0.01 250);  /* Almost white */
  --ink-secondary: oklch(0.68 0.03 260); /* Light gray */
  --accent: oklch(0.65 0.22 260);       /* Bright blue */
}
```

### Custom Animations

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

---

## Performance Optimizations

### 1. Memoization

Functions are memoized with `useCallback`:

```typescript
const createNote = useCallback(() => {
  // Function body
}, []);

const updateActive = useCallback((patch: Partial<Note>) => {
  // Function body
}, [active]);
```

### 2. Computed Values

Heavy computations are memoized with `useMemo`:

```typescript
const filtered = useMemo(() => {
  // Filter and sort logic
}, [notes, query]);

const stats = useMemo(() => {
  // Calculate stats
}, [active]);
```

### 3. Debounced Autosave

Prevents excessive localStorage writes:

```typescript
const AUTOSAVE_DELAY = 1000; // 1 second
autoSaveTimer.current = setTimeout(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}, AUTOSAVE_DELAY);
```

### 4. Responsive Images

Icons from Lucide are loaded on-demand via tree-shaking.

---

## Browser APIs Used

### Local Storage

```typescript
localStorage.setItem(key, value);  // Save
localStorage.getItem(key);          // Load
localStorage.removeItem(key);       // Delete
localStorage.clear();               // Clear all
```

### Event Listeners

```typescript
window.addEventListener("keydown", handler);
window.removeEventListener("keydown", handler);
```

### Clipboard API

Not directly used but can be added for note sharing.

### URL API

```typescript
URL.createObjectURL(blob);    // Create download link
URL.revokeObjectURL(url);     // Clean up
```

---

## Testing the Application

### Manual Testing Checklist

- [ ] Create a new note
- [ ] Type markdown content
- [ ] Switch between edit and preview mode
- [ ] Pin and unpin notes
- [ ] Search for notes
- [ ] Delete a note
- [ ] Toggle dark mode
- [ ] Refresh page (should restore notes)
- [ ] Export note as markdown
- [ ] Test keyboard shortcuts
- [ ] Test on mobile viewport

### Browser DevTools

Check Local Storage in Application tab:

```
zen.notes.v1: [{"id": "...", "title": "...", ...}]
zen.theme: "dark" or "light"
```

---

## Future Enhancement Ideas

1. **Cloud Sync**: Add backend for cross-device sync
2. **Folders/Tags**: Organize notes by category
3. **Sharing**: Generate shareable links
4. **Collaboration**: Real-time collaborative editing
5. **Rich Text**: Add TipTap editor for rich text
6. **Templates**: Note templates for quick start
7. **Analytics**: Track writing stats
8. **Mobile App**: React Native version
9. **Encryption**: End-to-end encryption
10. **AI Integration**: AI-powered suggestions

---

## Code Style Guidelines

### Component Structure

```typescript
// Component
function NotesApp() {
  // State
  const [state, setState] = useState(null);
  
  // Effects
  useEffect(() => { /* ... */ }, []);
  
  // Callbacks
  const handleAction = useCallback(() => { /* ... */ }, []);
  
  // Computed values
  const computed = useMemo(() => { /* ... */ }, []);
  
  // Render
  return (
    // JSX
  );
}
```

### Naming Conventions

- **Components**: PascalCase (`NotesApp`, `Header`)
- **Functions**: camelCase (`renderMarkdown`, `getReadingTime`)
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEY`, `AUTOSAVE_DELAY`)
- **Booleans**: Prefix with `is` or `has` (`isActive`, `hasContent`)

### TypeScript Types

Always define types explicitly:

```typescript
type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  pinned?: boolean;
};

interface AppState {
  notes: Note[];
  activeId: string | null;
}
```

---

## Building & Deployment

### Development

```bash
npm run dev    # Start dev server (port 5173)
```

### Production Build

```bash
npm run build  # Create optimized build
npm run preview # Preview production build
```

### Output

- Bundled to `dist/` directory
- Optimized JavaScript with tree-shaking
- CSS inlined or extracted
- Static assets optimized

---

## Troubleshooting

### Issue: Notes not persisting

**Check:**
1. Browser allows local storage (not private mode)
2. Storage quota not exceeded
3. localStorage API available: `window.localStorage`

**Solution:**
```javascript
try {
  localStorage.setItem('test', '1');
  localStorage.removeItem('test');
} catch (e) {
  console.log('LocalStorage not available');
}
```

### Issue: Markdown not rendering

**Check:**
1. In preview mode (eye icon)
2. Markdown syntax is correct
3. Check browser console for errors

### Issue: Performance issues

**Check:**
1. Number of notes (large arrays)
2. Complex markdown rendering
3. Browser dev tools Performance tab
4. Memory usage

---

## Accessibility

The application includes:
- ✅ ARIA labels on buttons
- ✅ Semantic HTML
- ✅ Keyboard navigation
- ✅ Color contrast ratios meet WCAG AA
- ✅ Focus indicators
- ✅ Touch targets > 44px

---

## Security Considerations

### Current Implementation
- ✅ Input sanitization in markdown parser
- ✅ No XSS vulnerabilities (React escapes)
- ✅ No SQL injection (localStorage only)
- ✅ All data client-side (no server requests)

### Future Security

If adding backend:
- [ ] HTTPS only
- [ ] CSRF protection
- [ ] Input validation
- [ ] Rate limiting
- [ ] Authentication
- [ ] Encryption

---

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [TanStack Router](https://tanstack.com/router)
- [OKLch Color Space](https://oklch.com/)
- [Markdown Spec](https://commonmark.org/)

---

## Contributing

When adding features:

1. Follow the existing code style
2. Add proper type definitions
3. Test in light and dark modes
4. Test on mobile viewport
5. Update this documentation
6. Commit with clear messages

---

**Last Updated**: May 16, 2026
**Version**: 1.0.0
