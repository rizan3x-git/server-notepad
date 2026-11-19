/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  CloudCheck,
  QrCode,
  Plus,
  Search,
  Trash2,
  Pin,
  Sparkles,
  Copy,
  Check,
  Download,
  Share2,
  Smartphone,
  Monitor,
  RefreshCw,
  Folder,
  Tag,
  Menu,
  X,
  FileText,
  CheckSquare,
  Edit3,
  BookOpen,
  ArrowRight,
  HelpCircle,
  ExternalLink,
  Key,
  ShieldCheck
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface Note {
  id: string;
  syncId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isPinned: boolean;
  updatedAt: string;
}

const CATEGORIES = ['All', 'Work', 'Personal', 'Ideas', 'Todo', 'Archive'];

export default function App() {
  const [syncId, setSyncId] = useState<string>('default-sync-room');
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  
  // UI states
  const [showQRModal, setShowQRModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [customSyncInput, setCustomSyncInput] = useState('');

  // Initialize Sync ID from URL params or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSync = params.get('sync');
    const storedSync = localStorage.getItem('cloudnote_sync_id');

    const activeSync = urlSync || storedSync || 'default-sync-room';
    setSyncId(activeSync);
    localStorage.setItem('cloudnote_sync_id', activeSync);
    if (!urlSync) {
      const newUrl = `${window.location.pathname}?sync=${activeSync}`;
      window.history.replaceState({}, '', newUrl);
    }
    setCustomSyncInput(activeSync);

    // Load local cache immediately for instant render without flashing empty
    const localCache = localStorage.getItem(`cloudnote_notes_${activeSync}`);
    if (localCache) {
      try {
        const parsed = JSON.parse(localCache);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed);
          setActiveNoteId(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to parse local notes cache', e);
      }
    }
  }, []);

  // Fetch notes on mount and when syncId changes
  useEffect(() => {
    if (!syncId) return;
    fetchNotes();
  }, [syncId]);

  // Periodic auto-sync polling (every 4 seconds) between devices
  useEffect(() => {
    if (!syncId) return;
    const interval = setInterval(() => {
      fetchNotes(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [syncId]);

  // Save notes to localStorage whenever notes change
  useEffect(() => {
    if (syncId && notes.length > 0) {
      localStorage.setItem(`cloudnote_notes_${syncId}`, JSON.stringify(notes));
    }
  }, [notes, syncId]);

  const fetchNotes = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsSyncing(true);

    try {
      const res = await fetch(`/api/notes?syncId=${encodeURIComponent(syncId)}`);
      if (res.ok) {
        const serverNotes = await res.json();
        if (Array.isArray(serverNotes) && serverNotes.length > 0) {
          // Merge server notes with local cache (keeping the most recently updated version)
          setNotes((prevNotes) => {
            const mergedMap = new Map<string, Note>();
            // Add server notes first
            serverNotes.forEach((n: Note) => mergedMap.set(n.id, n));
            // Add local notes if newer or not present
            prevNotes.forEach((n: Note) => {
              const existing = mergedMap.get(n.id);
              if (!existing || new Date(n.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
                mergedMap.set(n.id, n);
              }
            });
            const finalNotes = Array.from(mergedMap.values());
            return finalNotes;
          });

          if (serverNotes.length > 0 && !activeNoteId) {
            setActiveNoteId(serverNotes[0].id);
          }
        }
        setLastSynced(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch notes from server, using local cache:', err);
    } finally {
      if (!isBackground) setIsLoading(false);
      setIsSyncing(false);
    }
  };

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  // Auto-save debounce ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdateNote = (updatedFields: Partial<Note>) => {
    if (!activeNote) return;

    const updatedNote: Note = {
      ...activeNote,
      ...updatedFields,
      updatedAt: new Date().toISOString(),
    };

    const newNotes = notes.map((n) => (n.id === activeNote.id ? updatedNote : n));
    setNotes(newNotes);
    localStorage.setItem(`cloudnote_notes_${syncId}`, JSON.stringify(newNotes));

    // Debounced server save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSyncing(true);
      try {
        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedNote),
        });
        setLastSynced(new Date());
      } catch (err) {
        console.error('Failed to save note to cloud:', err);
      } finally {
        setIsSyncing(false);
      }
    }, 400);
  };

  const handleCreateNewNote = async () => {
    const newId = 'note-' + Date.now();
    const newNote: Note = {
      id: newId,
      syncId,
      title: 'Untitled Note',
      content: '# New Note\n\nStart writing your thoughts here...',
      category: selectedCategory !== 'All' ? selectedCategory : 'Personal',
      tags: ['new'],
      isPinned: false,
      updatedAt: new Date().toISOString(),
    };

    const newNotes = [newNote, ...notes];
    setNotes(newNotes);
    setActiveNoteId(newId);
    setIsMobileMenuOpen(false);
    localStorage.setItem(`cloudnote_notes_${syncId}`, JSON.stringify(newNotes));

    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote),
      });
    } catch (err) {
      console.error('Failed to create note on cloud:', err);
    }
  };

  const handleDeleteNote = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this note?')) return;

    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    localStorage.setItem(`cloudnote_notes_${syncId}`, JSON.stringify(remaining));

    if (activeNoteId === id) {
      setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
    }

    try {
      await fetch(`/api/notes/${id}?syncId=${encodeURIComponent(syncId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete note from cloud:', err);
    }
  };

  const handleRunAiAssist = async (action: string) => {
    if (!activeNote) return;
    setAiLoading(true);
    setAiResult('');

    try {
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          content: activeNote.content,
          prompt: aiPrompt,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiResult(data.result);
      } else {
        setAiResult('Error: ' + (data.error || 'Failed to generate'));
      }
    } catch (err: any) {
      setAiResult('Error: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiResult = () => {
    if (!aiResult) return;
    handleUpdateNote({ content: aiResult });
    setShowAIModal(false);
    setAiResult('');
  };

  const handleSwitchSyncRoom = (newRoom: string) => {
    if (!newRoom.trim()) return;
    const cleanRoom = newRoom.trim().replace(/\s+/g, '-').toLowerCase();
    setSyncId(cleanRoom);
    localStorage.setItem('cloudnote_sync_id', cleanRoom);
    const newUrl = `${window.location.pathname}?sync=${cleanRoom}`;
    window.history.replaceState({}, '', newUrl);
    setShowQRModal(false);
    setShowRoomModal(false);
    
    // Load local cache for new room if exists
    const localCache = localStorage.getItem(`cloudnote_notes_${cleanRoom}`);
    if (localCache) {
      try {
        const parsed = JSON.parse(localCache);
        if (Array.isArray(parsed)) {
          setNotes(parsed);
          if (parsed.length > 0) setActiveNoteId(parsed[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      setNotes([]);
      setActiveNoteId(null);
    }
    fetchNotes();
  };

  // Filtered notes
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'All' || note.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Sort: Pinned first, then recently updated
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const currentSyncUrl = window.location.origin + window.location.pathname + '?sync=' + syncId;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Sidebar for Desktop & Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* App Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                CloudNote Pro
              </h1>
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Auto-Sync Active</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-2 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Room ID Search & Switcher */}
        <div className="p-3 mx-3 mt-3 rounded-xl bg-indigo-950/40 border border-indigo-800/50 space-y-2">
          <div className="flex items-center justify-between text-xs text-indigo-300">
            <span className="font-medium flex items-center space-x-1">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>Current Room: <strong className="text-white font-mono">{syncId}</strong></span>
            </span>
            <button
              onClick={() => setShowQRModal(true)}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-medium flex items-center space-x-1 shadow transition"
              title="Show QR Code"
            >
              <QrCode className="w-3 h-3" />
              <span>QR</span>
            </button>
          </div>
          <div className="flex items-center space-x-1.5">
            <input
              type="text"
              placeholder="Type Room ID & press Enter..."
              value={customSyncInput}
              onChange={(e) => setCustomSyncInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSwitchSyncRoom(customSyncInput);
                }
              }}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => handleSwitchSyncRoom(customSyncInput)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition shrink-0"
            >
              Open Room
            </button>
          </div>
        </div>

        {/* Search & New Note */}
        <div className="p-3 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
          <button
            onClick={handleCreateNewNote}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-3 pb-2 flex space-x-1 overflow-x-auto scrollbar-none border-b border-slate-800/60">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-indigo-500" />
              Loading cloud notes...
            </div>
          ) : sortedNotes.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-500 text-sm">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-400" />
              <p>No notes found in this room.</p>
              <p className="text-xs text-slate-600 mt-1">Create a note or switch room.</p>
            </div>
          ) : (
            sortedNotes.map((note) => {
              const isActive = note.id === activeNoteId;
              const dateStr = new Date(note.updatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={note.id}
                  onClick={() => {
                    setActiveNoteId(note.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`group relative p-3 rounded-xl cursor-pointer border transition-all ${
                    isActive
                      ? 'bg-indigo-950/50 border-indigo-500/60 shadow-lg shadow-indigo-950/50'
                      : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-sm text-slate-200 truncate pr-6">
                      {note.title || 'Untitled Note'}
                    </h3>
                    {note.isPinned && (
                      <Pin className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {note.content.replace(/[#*`_]/g, '') || 'No additional text...'}
                  </p>
                  <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-medium">
                      {note.category}
                    </span>
                    <span>{dateStr}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteNote(note.id, e)}
                    className="absolute right-2 bottom-2 p-1.5 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition rounded-lg hover:bg-slate-800"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Sync Status */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            {isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Syncing cloud...</span>
              </>
            ) : (
              <>
                <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Synced {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </>
            )}
          </div>
          <button
            onClick={() => fetchNotes()}
            className="hover:text-white p-1 rounded transition"
            title="Refresh Notes"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 flex items-center justify-between z-30">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 text-sm text-slate-400 hidden sm:flex">
              <Folder className="w-4 h-4 text-indigo-400" />
              <span>{activeNote?.category || 'Notes'}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-200 font-medium truncate max-w-xs">
                {activeNote?.title || 'Select a note'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {activeNote && (
              <>
                <button
                  onClick={() => setShowAIModal(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-medium flex items-center space-x-1.5 shadow-lg shadow-indigo-600/20 transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">Gemini AI</span>
                </button>

                <button
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center space-x-1.5 ${
                    isPreviewMode
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isPreviewMode ? 'Edit' : 'Preview'}</span>
                </button>

                <button
                  onClick={() =>
                    handleUpdateNote({ isPinned: !activeNote.isPinned })
                  }
                  className={`p-2 rounded-xl border transition ${
                    activeNote.isPinned
                      ? 'bg-indigo-950 border-indigo-500 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={activeNote.isPinned ? 'Unpin Note' : 'Pin Note'}
                >
                  <Pin className={`w-4 h-4 ${activeNote.isPinned ? 'fill-indigo-400' : ''}`} />
                </button>

                <button
                  onClick={() => {
                    const blob = new Blob([activeNote.content], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${activeNote.title || 'note'}.md`;
                    a.click();
                  }}
                  className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-white transition"
                  title="Download Markdown"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              onClick={() => setShowQRModal(true)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-xs font-medium text-indigo-300 flex items-center space-x-1.5 transition"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span className="hidden md:inline">Sync QR</span>
            </button>
          </div>
        </header>

        {/* Editor or Empty State */}
        {activeNote ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
            {/* Note Metadata Bar */}
            <div className="px-6 py-3 border-b border-slate-900 bg-slate-900/30 flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) => handleUpdateNote({ title: e.target.value })}
                placeholder="Note title..."
                className="flex-1 bg-transparent text-xl font-bold text-white placeholder-slate-600 focus:outline-none min-w-[200px]"
              />

              <div className="flex items-center space-x-2">
                <select
                  value={activeNote.category}
                  onChange={(e) => handleUpdateNote({ category: e.target.value })}
                  className="bg-slate-900 border border-slate-800 text-xs text-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Note Content Input / Preview */}
            <div className="flex-1 flex overflow-hidden">
              {isPreviewMode ? (
                <div className="flex-1 p-6 overflow-y-auto prose prose-invert max-w-none bg-slate-950">
                  <div className="whitespace-pre-wrap text-slate-200 leading-relaxed font-normal">
                    {activeNote.content}
                  </div>
                </div>
              ) : (
                <textarea
                  value={activeNote.content}
                  onChange={(e) => handleUpdateNote({ content: e.target.value })}
                  placeholder="Type your note content here (Markdown supported)..."
                  className="flex-1 w-full p-6 bg-transparent text-slate-200 placeholder-slate-600 resize-none focus:outline-none font-mono text-sm leading-relaxed"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <div className="w-16 h-16 rounded-2xl bg-indigo-950/50 border border-indigo-800/40 flex items-center justify-center mb-4 text-indigo-400">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-semibold text-slate-300">No Note Selected</h2>
            <p className="text-sm text-slate-500 max-w-md mt-1 mb-6">
              Select a note from the sidebar or create a new note in room <span className="text-indigo-400 font-mono">"{syncId}"</span>.
            </p>
            <button
              onClick={handleCreateNewNote}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-600/20 transition flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Note</span>
            </button>
          </div>
        )}
      </main>

      {/* Room Change Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowRoomModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base">Change Sync Room Code</h2>
                <p className="text-xs text-slate-400">Type the exact same room name on your mobile & PC</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Room Code / Name</label>
                <input
                  type="text"
                  value={customSyncInput}
                  onChange={(e) => setCustomSyncInput(e.target.value)}
                  placeholder="e.g. my-private-room"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Tip: Use any secret room name (e.g. <span className="text-indigo-400">office-notes</span>) and open it on both your phone and computer to sync instantly.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowRoomModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSwitchSyncRoom(customSyncInput)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition shadow-lg shadow-indigo-600/20"
                >
                  Join / Switch Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code / Sync Pairing Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-800 flex items-center justify-center mx-auto mb-3 text-indigo-400">
                <QrCode className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Cross-Device Cloud Sync</h2>
              <p className="text-xs text-slate-400 mt-1">
                Scan this QR code with your mobile camera to instantly access room <span className="text-indigo-300 font-mono">"{syncId}"</span> on your phone!
              </p>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-4 rounded-xl w-fit mx-auto shadow-inner mb-6">
              <QRCodeSVG value={currentSyncUrl} size={180} level="H" includeMargin={true} />
            </div>

            {/* Sync URL & Copy */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Direct Sync Room URL</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={currentSyncUrl}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono truncate"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentSyncUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center space-x-1 shrink-0 transition"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400">Current Room Code: <strong className="text-indigo-300 font-mono">{syncId}</strong></span>
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setShowRoomModal(true);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-xs font-medium transition"
                >
                  Change Room Name
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gemini AI Assistant Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            <button
              onClick={() => {
                setShowAIModal(false);
                setAiResult('');
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base">Gemini AI Writing Assistant</h2>
                <p className="text-xs text-slate-400">Summarize, polish, translate or format your note instantly</p>
              </div>
            </div>

            {/* Quick Action Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              <button
                onClick={() => handleRunAiAssist('summarize')}
                disabled={aiLoading}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-violet-500/50 text-left text-xs font-medium text-slate-300 hover:text-white transition flex items-center space-x-2"
              >
                <span>✨</span>
                <span>Summarize</span>
              </button>
              <button
                onClick={() => handleRunAiAssist('grammar')}
                disabled={aiLoading}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-violet-500/50 text-left text-xs font-medium text-slate-300 hover:text-white transition flex items-center space-x-2"
              >
                <span>📝</span>
                <span>Fix Grammar</span>
              </button>
              <button
                onClick={() => handleRunAiAssist('expand')}
                disabled={aiLoading}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-violet-500/50 text-left text-xs font-medium text-slate-300 hover:text-white transition flex items-center space-x-2"
              >
                <span>💡</span>
                <span>Expand Ideas</span>
              </button>
              <button
                onClick={() => handleRunAiAssist('checklist')}
                disabled={aiLoading}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-violet-500/50 text-left text-xs font-medium text-slate-300 hover:text-white transition flex items-center space-x-2"
              >
                <span>☑️</span>
                <span>Make Checklist</span>
              </button>
              <button
                onClick={() => handleRunAiAssist('translate_bn')}
                disabled={aiLoading}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-violet-500/50 text-left text-xs font-medium text-slate-300 hover:text-white transition flex items-center space-x-2 col-span-2"
              >
                <span>🇧🇩</span>
                <span>Translate to Bengali (বাংলা)</span>
              </button>
            </div>

            {/* Custom AI Prompt input */}
            <div className="mb-4">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Or ask Gemini anything about this note..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRunAiAssist('custom')}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={() => handleRunAiAssist('custom')}
                  disabled={aiLoading}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium transition"
                >
                  Ask
                </button>
              </div>
            </div>

            {/* AI Result Box */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-y-auto min-h-[150px] max-h-[250px] text-xs font-mono text-slate-300 whitespace-pre-wrap">
              {aiLoading ? (
                <div className="flex items-center justify-center h-full text-violet-400 space-x-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Gemini is thinking...</span>
                </div>
              ) : aiResult ? (
                aiResult
              ) : (
                <span className="text-slate-600 italic">Select an action or enter a prompt above...</span>
              )}
            </div>

            {/* AI Modal Actions */}
            {aiResult && !aiLoading && (
              <div className="mt-4 flex items-center justify-end space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(aiResult);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
                >
                  Copy Result
                </button>
                <button
                  onClick={applyAiResult}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-medium shadow-lg shadow-violet-600/20 transition"
                >
                  Replace Note Content
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
