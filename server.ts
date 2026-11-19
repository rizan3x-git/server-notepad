import express from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const DATA_DIR = path.resolve(__dirname, 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize notes file if not exists
if (!fs.existsSync(NOTES_FILE)) {
  const initialNotes = [
    {
      id: 'note-1',
      syncId: 'default-sync-room',
      title: 'Welcome to CloudNote Pro 🚀',
      content: `# Welcome to CloudNote Pro!\n\nYour notes automatically sync between your **Windows PC** and **Mobile Phone** in real-time.\n\n### How to sync between devices:\n1. Click on the **Sync / QR Code** button in the top header.\n2. Scan the QR code with your mobile camera or copy the Sync Link.\n3. Open it on your phone - all notes appear instantly!\n\n### Features:\n- ☁️ Real-time cloud sync\n- 📱 QR code mobile pairing\n- 🤖 Gemini AI writing assistant\n- 🏷️ Tags, categories & markdown support\n- ✅ Interactive checklists`,
      category: 'Work',
      tags: ['welcome', 'guide', 'sync'],
      isPinned: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'note-2',
      syncId: 'default-sync-room',
      title: 'Shopping List & Tasks 🛒',
      content: `- [ ] Buy fresh milk and eggs\n- [x] Read chapter 4 of TypeScript handbook\n- [ ] Fix navbar CSS bug on mobile screen\n- [ ] Schedule team sync call for Thursday`,
      category: 'Todo',
      tags: ['shopping', 'tasks'],
      isPinned: false,
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    }
  ];
  fs.writeFileSync(NOTES_FILE, JSON.stringify(initialNotes, null, 2));
}

// Helper to read notes
function readNotes(): any[] {
  try {
    if (!fs.existsSync(NOTES_FILE)) return [];
    const data = fs.readFileSync(NOTES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading notes:', err);
    return [];
  }
}

// Helper to write notes
function writeNotes(notes: any[]) {
  try {
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
  } catch (err) {
    console.error('Error writing notes:', err);
  }
}

// ==========================================
// API ROUTES (Registered Synchronously FIRST)
// ==========================================

app.get('/api/notes', (req, res) => {
  const syncId = (req.query.syncId as string) || 'default-sync-room';
  const notes = readNotes();
  const roomNotes = notes.filter((n: any) => n.syncId === syncId);
  res.json(roomNotes);
});

app.post('/api/notes', (req, res) => {
  const { id, syncId, title, content, category, tags, isPinned, updatedAt } = req.body;
  if (!syncId || !id) {
    return res.status(400).json({ error: 'Missing syncId or id' });
  }

  const notes = readNotes();
  const existingIndex = notes.findIndex((n: any) => n.id === id && n.syncId === syncId);

  const newNote = {
    id,
    syncId,
    title: title || 'Untitled Note',
    content: content || '',
    category: category || 'Personal',
    tags: Array.isArray(tags) ? tags : [],
    isPinned: !!isPinned,
    updatedAt: updatedAt || new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    notes[existingIndex] = newNote;
  } else {
    notes.unshift(newNote);
  }

  writeNotes(notes);
  res.json(newNote);
});

app.delete('/api/notes/:id', (req, res) => {
  const { id } = req.params;
  const syncId = (req.query.syncId as string) || 'default-sync-room';

  let notes = readNotes();
  const initialLength = notes.length;
  notes = notes.filter((n: any) => !(n.id === id && n.syncId === syncId));

  if (notes.length === initialLength) {
    return res.status(404).json({ error: 'Note not found' });
  }

  writeNotes(notes);
  res.json({ success: true, id });
});

// AI Assistant Endpoint using Gemini API
app.post('/api/ai/assist', async (req, res) => {
  const { prompt, content, action } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let systemInstruction = "You are a helpful AI writing assistant embedded in a cloud notepad app. Provide concise, clean, and directly usable text in Markdown format.";
    let userPrompt = "";

    if (action === 'summarize') {
      userPrompt = `Please summarize the following note content concisely:\n\n${content}`;
    } else if (action === 'grammar') {
      userPrompt = `Please correct any spelling and grammar mistakes in the following note, keeping the original tone and markdown formatting:\n\n${content}`;
    } else if (action === 'expand') {
      userPrompt = `Please expand on the following note ideas with useful details, bullet points, or structure:\n\n${content}`;
    } else if (action === 'checklist') {
      userPrompt = `Convert the following text or notes into a structured interactive checklist using markdown (- [ ] task):\n\n${content}`;
    } else if (action === 'translate_bn') {
      userPrompt = `Translate the following text into natural Bengali (বাংলা), keeping markdown formatting:\n\n${content}`;
    } else {
      userPrompt = prompt || content;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const resultText = response.text || 'No response generated.';
    res.json({ result: resultText });
  } catch (error: any) {
    console.error('AI Assist error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate AI response' });
  }
});

// ==========================================
// START SERVER & ATTACH VITE MIDDLEWARE
// ==========================================

const PORT = Number(process.env.PORT) || 3000;

async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return;
      }
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`CloudNote Pro server running on http://localhost:${PORT}`);
  });
}

setupServer();
