'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

function splitIntoSentences(text) {
  if (!text.trim()) return [];
  const raw = text.replace(/\n{2,}/g, '\n\n').split(/(?<=[.!?…])\s+|(?=\n\n)/);
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- IndexedDB wrapper ---
const DB_NAME = 'VoiceReaderDB';
const DB_VERSION = 1;
const STORE_NAME = 'clips';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllClips() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

async function saveClipToDB(clip) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(clip);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteClipFromDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Table detection ---
function isTableLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Pipe table row: 2+ pipes
  const pipeCount = (trimmed.match(/\|/g) || []).length;
  if (pipeCount >= 2) return true;
  // Separator patterns like |---|---|  or +---+---+
  if (/^[\s|+:-]+$/.test(trimmed) && (trimmed.includes('---') || trimmed.includes('==='))) return true;
  // Tab-delimited: 2+ tabs
  const tabCount = (trimmed.match(/\t/g) || []).length;
  if (tabCount >= 2) return true;
  return false;
}

function detectTables(text) {
  const lines = text.split('\n');
  const tables = [];
  let tableStart = -1;
  let consecutiveTableLines = 0;

  for (let i = 0; i <= lines.length; i++) {
    const isTable = i < lines.length && isTableLine(lines[i]);
    if (isTable) {
      if (tableStart === -1) tableStart = i;
      consecutiveTableLines++;
    } else {
      if (consecutiveTableLines >= 2) {
        tables.push({
          startLine: tableStart,
          endLine: i - 1,
          text: lines.slice(tableStart, i).join('\n'),
        });
      }
      tableStart = -1;
      consecutiveTableLines = 0;
    }
  }

  return tables;
}

async function preprocessText(text) {
  const tables = detectTables(text);
  if (tables.length === 0) return { text, tablesConverted: 0 };

  try {
    const res = await fetch('/api/preprocess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables: tables.map(t => t.text) }),
    });

    if (!res.ok) return { text, tablesConverted: 0 };

    const { conversions } = await res.json();
    let result = text;
    // Replace tables in reverse order to preserve line offsets
    for (let i = tables.length - 1; i >= 0; i--) {
      const lines = result.split('\n');
      const before = lines.slice(0, tables[i].startLine);
      const after = lines.slice(tables[i].endLine + 1);
      result = [...before, conversions[i], ...after].join('\n');
    }

    return { text: result, tablesConverted: tables.length };
  } catch {
    return { text, tablesConverted: 0 };
  }
}

const NEURAL2_VOICES = [
  { id: 'en-US-Neural2-F', label: 'Aria (F)' },
  { id: 'en-US-Neural2-C', label: 'Bella (F)' },
  { id: 'en-US-Neural2-H', label: 'Clara (F)' },
  { id: 'en-US-Neural2-D', label: 'David (M)' },
  { id: 'en-US-Neural2-A', label: 'Adam (M)' },
  { id: 'en-US-Neural2-J', label: 'James (M)' },
  { id: 'en-US-Neural2-I', label: 'Ian (M)' },
];
const PREFETCH_AHEAD = 3;

export default function VoiceReader() {
  const [text, setText] = useState('');
  const [sentences, setSentences] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState('en-US-Neural2-F');
  const [showSettings, setShowSettings] = useState(false);
  const [showText, setShowText] = useState(true);
  const [estimatedTotal, setEstimatedTotal] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isStandalone, setIsStandalone] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [view, setView] = useState('reader'); // 'reader' | 'library'
  const [clips, setClips] = useState([]);
  const [clipsLoaded, setClipsLoaded] = useState(false);
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [tablesConverted, setTablesConverted] = useState(0);

  // Refs for speechSynthesis fallback
  const [webVoices, setWebVoices] = useState([]);
  const [selectedWebVoice, setSelectedWebVoice] = useState(null);

  const sentenceRefs = useRef([]);
  const currentIndexRef = useRef(-1);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const speedRef = useRef(1.0);
  const selectedVoiceRef = useRef('en-US-Neural2-F');
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const sentencesRef = useRef([]);

  // Audio element refs
  const audioRef = useRef(null);
  const audioCacheRef = useRef(new Map()); // index -> blob URL
  const prefetchingRef = useRef(new Set()); // indices currently being fetched
  const abortControllerRef = useRef(null);

  // SpeechSynthesis fallback refs
  const utteranceRef = useRef(null);
  const selectedWebVoiceRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { sentencesRef.current = sentences; }, [sentences]);
  useEffect(() => { selectedWebVoiceRef.current = selectedWebVoice; }, [selectedWebVoice]);

  // Detect standalone mode
  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }, []);

  // Load saved clips from IndexedDB
  useEffect(() => {
    getAllClips()
      .then(c => { setClips(c); setClipsLoaded(true); })
      .catch(() => setClipsLoaded(true));
  }, []);

  // Auto-dismiss tables converted banner
  useEffect(() => {
    if (tablesConverted > 0) {
      const t = setTimeout(() => setTablesConverted(0), 3000);
      return () => clearTimeout(t);
    }
  }, [tablesConverted]);

  // Create persistent audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Load speechSynthesis voices for fallback
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const loadVoices = () => {
      const v = synth.getVoices();
      const english = v.filter(voice => voice.lang.startsWith('en'));
      setWebVoices(english.length > 0 ? english : v);
      if (!selectedWebVoice && v.length > 0) {
        const preferred =
          v.find(voice => voice.lang.startsWith('en') && (
            voice.name.includes('Samantha') ||
            voice.name.includes('Natural') ||
            voice.name.includes('Enhanced') ||
            voice.name.includes('Premium')
          )) ||
          v.find(voice => voice.lang.startsWith('en')) ||
          v[0];
        setSelectedWebVoice(preferred);
      }
    };
    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);
    return () => synth.removeEventListener?.('voiceschanged', loadVoices);
  }, []);

  // iOS Safari workaround for speechSynthesis fallback
  useEffect(() => {
    if (!useFallback) return;
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        if (window.speechSynthesis?.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, useFallback]);

  // Estimate total listening time
  useEffect(() => {
    if (sentences.length > 0) {
      const totalWords = sentences.join(' ').split(/\s+/).length;
      const wpm = 160 * speed;
      setEstimatedTotal((totalWords / wpm) * 60);
    }
  }, [sentences, speed]);

  // Elapsed time tracker
  useEffect(() => {
    if (isPlaying && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, isPaused]);

  // Auto-scroll to current sentence
  useEffect(() => {
    if (currentIndex >= 0 && sentenceRefs.current[currentIndex]) {
      sentenceRefs.current[currentIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentIndex]);

  // Media Session API for lock screen controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Voice Reader',
      artist: currentIndex >= 0 && sentences[currentIndex]
        ? sentences[currentIndex].slice(0, 60) + (sentences[currentIndex].length > 60 ? '...' : '')
        : 'Paste → Listen',
    });

    navigator.mediaSession.setActionHandler('play', () => {
      if (isPausedRef.current) handleResume();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (isPlayingRef.current) handlePause();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      handleSkipForward();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      handleSkipBack();
    });
  }, [currentIndex, sentences]);

  // Cleanup audio cache when sentences change
  useEffect(() => {
    return () => {
      audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
      audioCacheRef.current.clear();
      prefetchingRef.current.clear();
    };
  }, [sentences]);

  // --- TTS fetch ---
  const fetchTTSAudio = useCallback(async (index, sentenceList, signal) => {
    const list = sentenceList || sentencesRef.current;
    if (index < 0 || index >= list.length) return null;
    if (audioCacheRef.current.has(index)) return audioCacheRef.current.get(index);
    if (prefetchingRef.current.has(index)) {
      // Wait for ongoing fetch to complete
      while (prefetchingRef.current.has(index)) {
        await new Promise(r => setTimeout(r, 50));
        if (signal?.aborted) return null;
      }
      return audioCacheRef.current.get(index) || null;
    }

    prefetchingRef.current.add(index);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: list[index],
          voice: selectedVoiceRef.current,
          speed: speedRef.current,
        }),
        signal,
      });
      if (!res.ok) throw new Error(`TTS API returned ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioCacheRef.current.set(index, url);
      return url;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('TTS fetch failed for sentence', index, err.message);
      }
      return null;
    } finally {
      prefetchingRef.current.delete(index);
    }
  }, []);

  // Prefetch upcoming sentences
  const prefetchAhead = useCallback((fromIndex, sentenceList) => {
    const list = sentenceList || sentencesRef.current;
    for (let i = 1; i <= PREFETCH_AHEAD; i++) {
      const idx = fromIndex + i;
      if (idx < list.length && !audioCacheRef.current.has(idx) && !prefetchingRef.current.has(idx)) {
        fetchTTSAudio(idx, list).catch(() => {});
      }
    }
  }, [fetchTTSAudio]);

  // --- Audio element playback ---
  const playAudioSentence = useCallback(async (index, sentenceList) => {
    const list = sentenceList || sentencesRef.current;
    if (index >= list.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentIndex(-1);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      return;
    }

    setCurrentIndex(index);
    prefetchAhead(index, list);

    const audioUrl = await fetchTTSAudio(index, list);
    if (!audioUrl) {
      // Fallback to speechSynthesis for this sentence
      console.warn('Falling back to speechSynthesis for sentence', index);
      speakSentenceFallback(index, list);
      return;
    }

    const audio = audioRef.current;
    audio.src = audioUrl;

    audio.onended = () => {
      if (isPlayingRef.current) {
        const next = currentIndexRef.current + 1;
        playAudioSentence(next, list);
      }
    };

    audio.onerror = () => {
      if (isPlayingRef.current) {
        console.warn('Audio playback error, trying next sentence');
        const next = currentIndexRef.current + 1;
        playAudioSentence(next, list);
      }
    };

    try {
      await audio.play();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    } catch (err) {
      console.warn('Audio play failed:', err.message);
      speakSentenceFallback(index, list);
    }
  }, [fetchTTSAudio, prefetchAhead]);

  // --- SpeechSynthesis fallback ---
  const speakSentenceFallback = useCallback((index, sentenceList) => {
    const list = sentenceList || sentencesRef.current;
    if (index >= list.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentIndex(-1);
      return;
    }

    setUseFallback(true);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(list[index]);
    utterance.rate = speedRef.current;
    if (selectedWebVoiceRef.current) utterance.voice = selectedWebVoiceRef.current;

    utterance.onend = () => {
      if (isPlayingRef.current) {
        const next = currentIndexRef.current + 1;
        setCurrentIndex(next);
        // Try TTS again for next sentence
        playAudioSentence(next, list);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && isPlayingRef.current) {
        const next = currentIndexRef.current + 1;
        setCurrentIndex(next);
        playAudioSentence(next, list);
      }
    };

    utteranceRef.current = utterance;
    setCurrentIndex(index);
    window.speechSynthesis.speak(utterance);
  }, [playAudioSentence]);

  // --- Controls ---
  const handlePlay = useCallback(async () => {
    if (!text.trim()) return;

    // If resuming from pause, skip preprocessing
    if (isPaused && currentIndexRef.current >= 0) {
      const s = splitIntoSentences(text);
      setSentences(s);
      setUseFallback(false);
      audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
      audioCacheRef.current.clear();
      prefetchingRef.current.clear();
      setIsPaused(false);
      setIsPlaying(true);
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      playAudioSentence(currentIndexRef.current, s);
      return;
    }

    // Preprocess tables if present
    setIsPreprocessing(true);
    let processedText = text;
    try {
      const result = await preprocessText(text);
      processedText = result.text;
      if (result.tablesConverted > 0) setTablesConverted(result.tablesConverted);
    } catch {
      // fallback: use original text
    }
    setIsPreprocessing(false);

    const s = splitIntoSentences(processedText);
    setSentences(s);
    setUseFallback(false);

    // Clear old cache
    audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
    audioCacheRef.current.clear();
    prefetchingRef.current.clear();

    setIsPlaying(true);
    setIsPaused(false);
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    playAudioSentence(0, s);
    setShowText(true);
  }, [text, isPaused, playAudioSentence]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    setIsPlaying(true);
    if (useFallback) {
      speakSentenceFallback(currentIndexRef.current);
    } else {
      playAudioSentence(currentIndexRef.current);
    }
  }, [useFallback, playAudioSentence, speakSentenceFallback]);

  const handlePause = useCallback(() => {
    if (useFallback) {
      window.speechSynthesis.cancel();
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    setIsPaused(true);
    setIsPlaying(false);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }, [useFallback]);

  const handleStop = useCallback(() => {
    if (useFallback) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.src = '';
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(-1);
    setElapsedTime(0);
    startTimeRef.current = null;
    setUseFallback(false);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }, [useFallback]);

  const handleSkipForward = useCallback(() => {
    if (!isPlayingRef.current && !isPausedRef.current) return;
    const next = Math.min(currentIndexRef.current + 1, sentencesRef.current.length - 1);
    if (useFallback) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; }
    setCurrentIndex(next);
    if (isPlayingRef.current) playAudioSentence(next);
  }, [useFallback, playAudioSentence]);

  const handleSkipBack = useCallback(() => {
    if (!isPlayingRef.current && !isPausedRef.current) return;
    const prev = Math.max(currentIndexRef.current - 1, 0);
    if (useFallback) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; }
    setCurrentIndex(prev);
    if (isPlayingRef.current) playAudioSentence(prev);
  }, [useFallback, playAudioSentence]);

  const handleSentenceTap = useCallback((index) => {
    if (!isPlayingRef.current && !isPausedRef.current) return;
    if (useFallback) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; }
    setCurrentIndex(index);
    setIsPaused(false);
    setIsPlaying(true);
    playAudioSentence(index);
  }, [useFallback, playAudioSentence]);

  const handleSkip5 = useCallback(() => {
    const jump = Math.min(currentIndexRef.current + 5, sentencesRef.current.length - 1);
    if (useFallback) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; }
    setCurrentIndex(jump);
    if (isPlayingRef.current) playAudioSentence(jump);
  }, [useFallback, playAudioSentence]);

  const handleSpeedChange = useCallback((s) => {
    setSpeed(s);
    // Clear cache since speed changed -> audio needs re-generation
    audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
    audioCacheRef.current.clear();
    prefetchingRef.current.clear();
    if (isPlaying && currentIndexRef.current >= 0) {
      if (useFallback) {
        window.speechSynthesis.cancel();
        setTimeout(() => speakSentenceFallback(currentIndexRef.current), 50);
      } else {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; }
        // speed ref will be updated by the effect, slight delay to ensure sync
        setTimeout(() => playAudioSentence(currentIndexRef.current), 50);
      }
    }
  }, [isPlaying, useFallback, playAudioSentence, speakSentenceFallback]);

  const handleSaveClip = useCallback(async () => {
    if (!text.trim()) return;
    const firstSentence = splitIntoSentences(text)[0] || 'Untitled';
    const autoTitle = firstSentence.length > 60 ? firstSentence.slice(0, 60) + '...' : firstSentence;
    const title = window.prompt('Save clip as:', autoTitle);
    if (!title) return;
    const clip = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      text,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveClipToDB(clip);
    setClips(prev => [clip, ...prev]);
  }, [text]);

  const handleDeleteClip = useCallback(async (id) => {
    if (!window.confirm('Delete this clip?')) return;
    await deleteClipFromDB(id);
    setClips(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleLoadClip = useCallback((clip) => {
    setText(clip.text);
    setView('reader');
  }, []);

  const progress = sentences.length > 0 && currentIndex >= 0
    ? ((currentIndex + 1) / sentences.length) * 100
    : 0;

  const speeds = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e4de',
      fontFamily: "'IBM Plex Sans', 'SF Pro Text', -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
      position: 'relative',
      paddingTop: isStandalone ? 'env(safe-area-inset-top)' : 0,
      paddingBottom: isStandalone ? 'env(safe-area-inset-bottom)' : 0,
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div style={{
        padding: '20px 20px 12px',
        borderBottom: '1px solid #1a1a1c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontSize: 11,
            fontFamily: "'IBM Plex Mono', monospace",
            color: '#6b6560',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Voice Reader
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['reader', 'library'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 14px',
                  background: view === v ? '#c45a3c' : '#1a1a1c',
                  border: view === v ? '1px solid #c45a3c' : '1px solid #2a2a2d',
                  borderRadius: 6,
                  color: view === v ? '#fff' : '#9b9590',
                  fontSize: 13,
                  fontWeight: view === v ? 600 : 400,
                  fontFamily: "'IBM Plex Mono', monospace",
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: showSettings ? '#1f1f22' : 'transparent',
            border: '1px solid #2a2a2d',
            borderRadius: 8,
            color: '#9b9590',
            padding: '8px 12px',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          ⚙ Settings
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          padding: '16px 20px',
          background: '#111113',
          borderBottom: '1px solid #1a1a1c',
        }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#6b6560',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: 8,
            }}>
              Voice
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => {
                setSelectedVoice(e.target.value);
                // Clear cache since voice changed
                audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
                audioCacheRef.current.clear();
                prefetchingRef.current.clear();
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#1a1a1c',
                border: '1px solid #2a2a2d',
                borderRadius: 8,
                color: '#e8e4de',
                fontSize: 14,
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              {NEURAL2_VOICES.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#6b6560',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: 8,
            }}>
              Speed
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {speeds.map(s => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    background: speed === s ? '#c45a3c' : '#1a1a1c',
                    border: speed === s ? '1px solid #c45a3c' : '1px solid #2a2a2d',
                    borderRadius: 6,
                    color: speed === s ? '#fff' : '#9b9590',
                    fontSize: 13,
                    fontWeight: speed === s ? 600 : 400,
                    fontFamily: "'IBM Plex Mono', monospace",
                    cursor: 'pointer',
                  }}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {useFallback && (
            <div style={{
              marginTop: 12,
              padding: '8px 12px',
              background: 'rgba(196, 90, 60, 0.15)',
              borderRadius: 6,
              fontSize: 12,
              color: '#c45a3c',
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              Using device voice (API unavailable)
            </div>
          )}
        </div>
      )}

      {/* Tables converted banner */}
      {tablesConverted > 0 && (
        <div style={{
          padding: '8px 20px',
          background: 'rgba(196, 90, 60, 0.15)',
          fontSize: 12,
          color: '#c45a3c',
          fontFamily: "'IBM Plex Mono', monospace",
          textAlign: 'center',
        }}>
          {tablesConverted} table{tablesConverted > 1 ? 's' : ''} converted to speech
        </div>
      )}

      {/* Text Input / Display Area */}
      {view === 'reader' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {(!isPlaying && !isPaused) ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste Claude's response here..."
                style={{
                  width: '100%',
                  minHeight: 300,
                  background: '#111113',
                  border: '1px solid #1f1f22',
                  borderRadius: 12,
                  color: '#e8e4de',
                  fontSize: 15,
                  lineHeight: 1.65,
                  padding: 16,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.target.style.borderColor = '#c45a3c'}
                onBlur={(e) => e.target.style.borderColor = '#1f1f22'}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={async () => {
                    try {
                      const clip = await navigator.clipboard.readText();
                      setText(clip);
                    } catch {
                      // Clipboard might not be available
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: 12,
                    background: '#1a1a1c',
                    border: '1px solid #2a2a2d',
                    borderRadius: 8,
                    color: '#9b9590',
                    fontSize: 14,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    cursor: 'pointer',
                  }}
                >
                  📋 Paste
                </button>
                <button
                  onClick={handleSaveClip}
                  disabled={!text.trim()}
                  style={{
                    flex: 1,
                    padding: 12,
                    background: '#1a1a1c',
                    border: '1px solid #2a2a2d',
                    borderRadius: 8,
                    color: text.trim() ? '#9b9590' : '#3a3530',
                    fontSize: 14,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    cursor: text.trim() ? 'pointer' : 'default',
                  }}
                >
                  💾 Save
                </button>
                <button
                  onClick={() => setText('')}
                  style={{
                    padding: '12px 16px',
                    background: '#1a1a1c',
                    border: '1px solid #2a2a2d',
                    borderRadius: 8,
                    color: '#6b6560',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </>
          ) : (
            <div>
              <button
                onClick={() => setShowText(!showText)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b6560',
                  fontSize: 12,
                  fontFamily: "'IBM Plex Mono', monospace",
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  padding: '0 0 12px 0',
                }}
              >
                {showText ? '▾ Hide text' : '▸ Show text'}
              </button>
              {showText && (
                <div style={{
                  background: '#111113',
                  borderRadius: 12,
                  padding: 16,
                  maxHeight: '50vh',
                  overflow: 'auto',
                }}>
                  {sentences.map((s, i) => (
                    <span
                      key={i}
                      ref={el => sentenceRefs.current[i] = el}
                      onClick={() => handleSentenceTap(i)}
                      style={{
                        display: 'inline',
                        fontSize: 15,
                        lineHeight: 1.75,
                        color: i === currentIndex ? '#fff' : i < currentIndex ? '#5a5550' : '#9b9590',
                        background: i === currentIndex ? 'rgba(196, 90, 60, 0.2)' : 'transparent',
                        borderRadius: i === currentIndex ? 4 : 0,
                        padding: i === currentIndex ? '2px 4px' : '2px 0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: "'IBM Plex Sans', sans-serif",
                      }}
                    >
                      {s}{' '}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Library View */
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {!clipsLoaded ? (
            <div style={{ textAlign: 'center', color: '#5a5550', padding: 40, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
              Loading...
            </div>
          ) : clips.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#5a5550', padding: 40, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, lineHeight: 1.6 }}>
              No saved clips yet.<br />Use the Save button in Reader to save text for later.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clips.map(clip => (
                <div
                  key={clip.id}
                  style={{
                    background: '#111113',
                    border: '1px solid #1f1f22',
                    borderRadius: 10,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                  onClick={() => handleLoadClip(clip)}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2a2a2d'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1f1f22'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#e8e4de',
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {clip.title}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: '#5a5550',
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {new Date(clip.createdAt).toLocaleDateString()} · {clip.text.split(/\s+/).length} words
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteClip(clip.id); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#4a4540',
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: '0 0 0 8px',
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: '#6b6560',
                    marginTop: 6,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {clip.text.slice(0, 200)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Player Controls - visible in reader, or in library if playback active */}
      {(view === 'reader' || isPlaying || isPaused) && (
        <div style={{
          borderTop: '1px solid #1a1a1c',
          background: '#0e0e10',
          padding: '0 20px 28px',
        }}>
          {/* Progress Bar */}
          {(isPlaying || isPaused) && (
            <div style={{ padding: '12px 0 4px' }}>
              <div
                style={{
                  height: 3,
                  background: '#1a1a1c',
                  borderRadius: 2,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  const targetIndex = Math.floor(pct * sentences.length);
                  handleSentenceTap(Math.max(0, Math.min(targetIndex, sentences.length - 1)));
                }}
              >
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: '#c45a3c',
                  borderRadius: 2,
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace",
                color: '#5a5550',
                marginTop: 6,
              }}>
                <span>{formatTime(elapsedTime)}</span>
                <span>{currentIndex >= 0 ? `${currentIndex + 1} / ${sentences.length}` : ''}</span>
                <span>~{formatTime(Math.max(0, estimatedTotal - elapsedTime))}</span>
              </div>
            </div>
          )}

          {/* Speed toggle during playback */}
          {(isPlaying || isPaused) && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 4,
              marginBottom: 12,
              marginTop: 4,
            }}>
              {speeds.map(s => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  style={{
                    padding: '4px 10px',
                    background: speed === s ? '#c45a3c' : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    color: speed === s ? '#fff' : '#5a5550',
                    fontSize: 12,
                    fontWeight: speed === s ? 600 : 400,
                    fontFamily: "'IBM Plex Mono', monospace",
                    cursor: 'pointer',
                  }}
                >
                  {s}×
                </button>
              ))}
            </div>
          )}

          {/* Main Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
          }}>
            {(isPlaying || isPaused) && (
              <button onClick={handleStop} title="Stop" style={{
                width: 44, height: 44, borderRadius: '50%',
                background: '#1a1a1c', border: '1px solid #2a2a2d',
                color: '#9b9590', fontSize: 18, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>◼</button>
            )}

            {(isPlaying || isPaused) && (
              <button onClick={handleSkipBack} title="Previous" style={{
                width: 48, height: 48, borderRadius: '50%',
                background: '#1a1a1c', border: '1px solid #2a2a2d',
                color: '#e8e4de', fontSize: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>⏮</button>
            )}

            <button
              onClick={isPlaying ? handlePause : (isPaused ? handleResume : handlePlay)}
              disabled={(!text.trim() && !isPaused) || isPreprocessing}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: (!text.trim() && !isPaused) || isPreprocessing ? '#1a1a1c' : '#c45a3c',
                border: 'none', color: '#fff', fontSize: 26,
                cursor: ((!text.trim() && !isPaused) || isPreprocessing) ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: (text.trim() || isPaused) && !isPreprocessing ? '0 0 24px rgba(196, 90, 60, 0.3)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {isPreprocessing ? (
                <span style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : isPlaying ? '⏸' : '▶'}
            </button>

            {(isPlaying || isPaused) && (
              <button onClick={handleSkipForward} title="Next" style={{
                width: 48, height: 48, borderRadius: '50%',
                background: '#1a1a1c', border: '1px solid #2a2a2d',
                color: '#e8e4de', fontSize: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>⏭</button>
            )}

            {(isPlaying || isPaused) && (
              <button
                onClick={handleSkip5}
                title="Skip 5" style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: '#1a1a1c', border: '1px solid #2a2a2d',
                  color: '#9b9590', fontSize: 11, fontWeight: 600,
                  fontFamily: "'IBM Plex Mono', monospace", cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >+5</button>
            )}
          </div>

          {!isPlaying && !isPaused && view === 'reader' && (
            <div style={{
              textAlign: 'center', marginTop: 16,
              fontSize: 12, color: '#4a4540',
              fontFamily: "'IBM Plex Mono', monospace",
              lineHeight: 1.5,
            }}>
              Tap any sentence while playing to jump to it
            </div>
          )}
        </div>
      )}
    </div>
  );
}
