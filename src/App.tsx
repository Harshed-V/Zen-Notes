import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Moon,
  Sun,
  FileText,
  Trash2,
  Pin,
  PinOff,
  Download,
  Eye,
  Code2,
  Menu,
  X,
  Check,
  Clock,
} from "lucide-react";
import "./styles.css";

type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  pinned?: boolean;
};

const STORAGE_KEY = "zen.notes.v1";
const THEME_KEY = "zen.theme";
const AUTOSAVE_DELAY = 1000; // 1 second

// Markdown rendering utilities
const renderMarkdown = (text: string): React.ReactNode[] => {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      let codeBlock = "";
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeBlock += (codeBlock ? "\n" : "") + lines[i];
        i++;
      }
      result.push(
        <pre
          key={`code-${result.length}`}
          className="bg-surface rounded-lg p-3 my-3 text-[13px] overflow-x-auto border border-border"
        >
          <code className="text-ink-primary font-mono">{codeBlock}</code>
        </pre>,
      );
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      result.push(
        <h1 key={`h1-${result.length}`} className="text-2xl font-serif font-bold mt-4 mb-2">
          {line.substring(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      result.push(
        <h2 key={`h2-${result.length}`} className="text-xl font-serif font-bold mt-3 mb-2">
          {line.substring(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      result.push(
        <h3 key={`h3-${result.length}`} className="text-lg font-serif font-bold mt-2 mb-1">
          {line.substring(4)}
        </h3>,
      );
    }
    // Blockquotes
    else if (line.startsWith("> ")) {
      result.push(
        <blockquote
          key={`quote-${result.length}`}
          className="border-l-4 border-accent pl-4 my-2 italic text-ink-secondary"
        >
          {line.substring(2)}
        </blockquote>,
      );
    }
    // Lists
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      result.push(
        <li key={`li-${result.length}`} className="ml-4 my-1">
          {line.substring(2)}
        </li>,
      );
    } else if (line.trim() === "") {
      result.push(<div key={`space-${result.length}`} className="h-2" />);
    } else {
      // Process inline markdown
      const processed = processInlineMarkdown(line);
      if (processed.length > 0) {
        result.push(
          <p key={`p-${result.length}`} className="my-2 leading-relaxed">
            {processed}
          </p>,
        );
      }
    }

    i++;
  }

  return result;
};

const processInlineMarkdown = (text: string): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < text.length) {
    // Bold
    if (text[i] === "*" && text[i + 1] === "*") {
      const endIdx = text.indexOf("**", i + 2);
      if (endIdx !== -1) {
        result.push(
          <strong key={`bold-${result.length}`}>
            {text.substring(i + 2, endIdx)}
          </strong>,
        );
        i = endIdx + 2;
        continue;
      }
    }

    // Italic
    if (text[i] === "*") {
      const endIdx = text.indexOf("*", i + 1);
      if (endIdx !== -1) {
        result.push(
          <em key={`italic-${result.length}`}>
            {text.substring(i + 1, endIdx)}
          </em>,
        );
        i = endIdx + 1;
        continue;
      }
    }

    // Inline code
    if (text[i] === "`") {
      const endIdx = text.indexOf("`", i + 1);
      if (endIdx !== -1) {
        result.push(
          <code key={`inline-${result.length}`} className="bg-surface px-1.5 py-0.5 rounded text-[12px] font-mono">
            {text.substring(i + 1, endIdx)}
          </code>,
        );
        i = endIdx + 1;
        continue;
      }
    }

    // Regular text
    const nextSpecial = Math.min(
      text.indexOf("*", i) === -1 ? Infinity : text.indexOf("*", i),
      text.indexOf("`", i) === -1 ? Infinity : text.indexOf("`", i),
    );

    if (nextSpecial === Infinity) {
      result.push(text.substring(i));
      break;
    } else {
      result.push(text.substring(i, nextSpecial));
      i = nextSpecial;
    }
  }

  return result;
};

// Calculate reading time
const getReadingTime = (text: string): number => {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200)); // 200 WPM average
};

function NotesApp() {
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Note[] = JSON.parse(raw);
        setNotes(parsed);
        if (parsed[0]) setActiveId(parsed[0].id);
      }
      const theme = localStorage.getItem(THEME_KEY);
      if (theme === "dark") setDark(true);
    } catch {}
    setHydrated(true);
  }, []);

  // Persist notes with autosave indicator
  useEffect(() => {
    if (!hydrated) return;

    // Clear existing timer
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    // Set new timer for autosave
    autoSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        setLastSaved(Date.now());
      } catch {}
    }, AUTOSAVE_DELAY);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [notes, hydrated]);

  // Persist theme
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {}
  }, [dark, hydrated]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return notes
      .filter(
        (n) =>
          !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, query]);

  const active = notes.find((n) => n.id === activeId) ?? null;

  const createNote = useCallback(() => {
    const n: Note = { id: crypto.randomUUID(), title: "", body: "", updatedAt: Date.now() };
    setNotes((p) => [n, ...p]);
    setActiveId(n.id);
  }, []);

  const updateActive = useCallback((patch: Partial<Note>) => {
    if (!active) return;
    setNotes((p) =>
      p.map((n) => (n.id === active.id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    );
  }, [active]);

  const togglePin = useCallback(() => {
    if (!active) return;
    setNotes((p) => p.map((n) => (n.id === active.id ? { ...n, pinned: !n.pinned } : n)));
  }, [active]);

  const deleteActive = useCallback(() => {
    if (!active) return;
    setNotes((p) => p.filter((n) => n.id !== active.id));
    setActiveId(null);
  }, [active]);

  const exportActive = useCallback(() => {
    if (!active) return;
    const title = active.title.trim() || "untitled";
    const safe = title.replace(/[^a-z0-9-_ ]/gi, "").slice(0, 60) || "untitled";
    const content = `# ${title}\n\n${active.body}`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [active]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        createNote();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
          setLastSaved(Date.now());
        } catch {}
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.querySelector("[data-search-input]") as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && active && query === "") {
        const target = e.target as HTMLElement;
        if (!target.closest("input") && !target.closest("textarea")) {
          e.preventDefault();
          deleteActive();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, query, createNote, deleteActive, notes]);

  const stats = useMemo(() => {
    if (!active) return { words: 0, chars: 0, readTime: 0 };
    const text = `${active.title} ${active.body}`.trim();
    const words = text ? text.split(/\s+/).length : 0;
    return { words, chars: active.body.length, readTime: getReadingTime(active.body) };
  }, [active]);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-canvas text-ink-primary flex flex-col">
        {/* Header */}
        <header className="h-14 px-4 md:px-6 flex items-center justify-between border-b border-border/50 bg-canvas/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden size-9 grid place-items-center rounded-full hover:bg-surface text-ink-secondary transition-colors"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <div className="size-2 rounded-full bg-ink-primary" />
            <span className="font-serif text-xl tracking-tight">ZEN</span>
            <span className="text-[13px] text-ink-secondary">notes</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle theme"
              className="size-9 grid place-items-center rounded-full hover:bg-surface text-ink-secondary transition-colors hover:text-ink-primary"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              onClick={createNote}
              title="New note (⌘/Ctrl+N)"
              className="ml-1 h-9 inline-flex items-center gap-1.5 px-3.5 text-[13px] font-medium bg-ink-primary text-primary-foreground rounded-full hover:bg-ink-primary/90 transition-all hover:shadow-md active:scale-95"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr]">
          {/* Sidebar */}
          <aside
            className={`border-r border-border/50 flex flex-col transition-all duration-300 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            } fixed md:static left-0 top-14 bottom-0 w-full md:w-auto md:top-0 z-30 bg-canvas`}
          >
            <div className="p-4 border-b border-border/50">
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none" />
                <input
                  data-search-input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search notes…"
                  className="w-full h-10 pl-9 pr-3 text-[14px] bg-surface border border-border/50 rounded-lg focus:bg-canvas focus:border-border focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-ink-secondary/60 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {filtered.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <FileText className="size-6 text-ink-secondary/40 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-[13px] text-ink-secondary">
                    {query ? "No notes match your search." : "Create your first note to begin writing"}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((n) => {
                    const isActive = activeId === n.id;
                    const preview = n.body.split("\n")[0]?.substring(0, 50) || "No text";
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => {
                            setActiveId(n.id);
                            setSidebarOpen(false);
                          }}
                          className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                            isActive
                              ? "bg-surface border-l-2 border-accent shadow-sm"
                              : "hover:bg-surface/60 border-l-2 border-transparent"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {n.pinned && (
                              <Pin className="size-3 text-accent shrink-0 mt-1" strokeWidth={2} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className={`text-[14px] font-medium truncate ${
                                isActive ? "text-ink-primary" : "text-ink-primary"
                              }`}>
                                {n.title || "Untitled"}
                              </div>
                              <div className="text-[12px] text-ink-secondary truncate mt-0.5">
                                {preview}
                              </div>
                              <div className="text-[11px] text-ink-secondary/60 mt-1">
                                {new Date(n.updatedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="px-4 py-3 border-t border-border/50 text-[11px] text-ink-secondary flex items-center justify-between bg-surface/40">
              <span>
                {notes.length} {notes.length === 1 ? "note" : "notes"}
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface text-[10px] border border-border/50">
                ⌘N
              </kbd>
            </div>
          </aside>

          {/* Editor */}
          <main className="flex flex-col bg-canvas/50">
            {active ? (
              <>
                <div className="h-12 px-4 md:px-8 flex items-center justify-between border-b border-border/50 bg-canvas/80 backdrop-blur-sm sticky top-14 md:top-14 z-20">
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="text-[12px] text-ink-secondary/70 whitespace-nowrap">
                      {new Date(active.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="text-[12px] text-ink-secondary/50">•</span>
                    <span className="text-[12px] text-ink-secondary/70 whitespace-nowrap">
                      {stats.words} words
                    </span>
                    <span className="text-[12px] text-ink-secondary/50">•</span>
                    <span className="text-[12px] text-ink-secondary/70 whitespace-nowrap flex items-center gap-1">
                      <Clock className="size-3" />
                      {stats.readTime} min
                    </span>
                    {lastSaved && Date.now() - lastSaved < 3000 && (
                      <>
                        <span className="text-[12px] text-ink-secondary/50">•</span>
                        <span className="text-[12px] text-accent/80 flex items-center gap-1 animate-pulse">
                          <Check className="size-3" />
                          Saved
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => setPreviewMode(!previewMode)}
                      aria-label={previewMode ? "Edit mode" : "Preview mode"}
                      title={previewMode ? "Edit mode (⌘/Ctrl+E)" : "Preview mode (⌘/Ctrl+P)"}
                      className="size-8 grid place-items-center rounded-lg text-ink-secondary hover:bg-surface hover:text-ink-primary transition-colors"
                    >
                      {previewMode ? <Code2 className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    <button
                      onClick={togglePin}
                      aria-label={active.pinned ? "Unpin" : "Pin"}
                      title={active.pinned ? "Unpin note" : "Pin note"}
                      className="size-8 grid place-items-center rounded-lg text-ink-secondary hover:bg-surface hover:text-accent transition-colors"
                    >
                      {active.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                    </button>
                    <button
                      onClick={exportActive}
                      aria-label="Export as markdown"
                      title="Export as .md"
                      className="size-8 grid place-items-center rounded-lg text-ink-secondary hover:bg-surface hover:text-ink-primary transition-colors"
                    >
                      <Download className="size-4" />
                    </button>
                    <button
                      onClick={deleteActive}
                      aria-label="Delete note"
                      title="Delete note (Del)"
                      className="size-8 grid place-items-center rounded-lg text-ink-secondary hover:bg-surface hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Editor or Preview */}
                {previewMode ? (
                  <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 md:py-12 max-w-3xl w-full mx-auto">
                    <div className="prose prose-invert max-w-none">
                      <h1 className="font-serif text-4xl md:text-5xl font-bold mb-8 tracking-tight">
                        {active.title || "Untitled"}
                      </h1>
                      <div className="text-ink-primary text-[17px] md:text-[19px] leading-[1.7] space-y-5">
                        {renderMarkdown(active.body)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 md:py-12 max-w-3xl w-full mx-auto">
                    <input
                      value={active.title}
                      onChange={(e) => updateActive({ title: e.target.value })}
                      placeholder="Title"
                      className="w-full font-serif text-4xl md:text-6xl font-bold tracking-tight bg-transparent outline-none placeholder:text-ink-secondary/30 mb-8"
                    />
                    <textarea
                      value={active.body}
                      onChange={(e) => updateActive({ body: e.target.value })}
                      placeholder="Begin writing…"
                      className="w-full min-h-[60vh] md:min-h-[70vh] resize-none bg-transparent outline-none text-[17px] md:text-[19px] leading-[1.7] placeholder:text-ink-secondary/30"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 grid place-items-center px-4 md:px-6 py-12 md:py-24">
                <div className="text-center max-w-2xl px-6">
                  <div className="mx-auto mb-10 size-20 grid place-items-center rounded-2xl bg-surface/60 border border-border/50 shadow-sm animate-fade-in">
                    <FileText className="size-10 text-ink-secondary/60" strokeWidth={1.2} />
                  </div>
                  <h1 className="font-serif text-4xl md:text-6xl tracking-tight font-bold mb-8 animate-slide-in-top">
                    Zen Notes: A quiet space <span className="italic text-ink-secondary">to think</span>.
                  </h1>
                  <p className="mt-6 text-[16px] md:text-[18px] text-ink-secondary/80 leading-relaxed max-w-xl mx-auto animate-fade-in" style={{ animationDelay: '100ms' }}>
                    Welcome to the ultimate distraction-free markdown notes app. Zen Notes is designed for deep work, focused writing, and privacy-conscious thinking. Your notes are saved locally, ensuring you can write offline with full markdown support, keyboard shortcuts, and a premium aesthetic.
                  </p>
                  <div className="mt-10 text-[13px] md:text-[14px] text-ink-secondary/60 flex flex-wrap justify-center gap-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/40 border border-border/30"><Check className="size-4 text-accent" /> Markdown Support</span>
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/40 border border-border/30"><Check className="size-4 text-accent" /> Offline-First</span>
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/40 border border-border/30"><Check className="size-4 text-accent" /> Secure & Private</span>
                  </div>
                  <button
                    onClick={createNote}
                    className="mt-8 h-10 inline-flex items-center gap-1.5 px-4 text-[13px] font-medium bg-ink-primary text-primary-foreground rounded-lg hover:bg-ink-primary/90 transition-all hover:shadow-md active:scale-95"
                  >
                    <Plus className="size-4" />
                    Create your first note
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotesApp />
    </QueryClientProvider>
  );
}
