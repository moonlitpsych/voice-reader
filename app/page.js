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

export default function VoiceReader() {
  const [text, setText] = useState('');
  const [sentences, setSentences] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showText, setShowText] = useState(true);
  const [estimatedTotal, setEstimatedTotal] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isStandalone, setIsStandalone] = useState(false);

  const sentenceRefs = useRef([]);
  const utteranceRef = useRef(null);
  const currentIndexRef = useRef(-1);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(1.0);
  const selectedVoiceRef = useRef(null);
  const audioContextRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const sentencesRef = useRef([]);

  // Keep refs in sync
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { sentencesRef.current = sentences; }, [sentences]);

  // Detect standalone (Add to Home Screen) mode
  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }, []);

  // Load voices
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    const loadVoices = () => {
      const v = synth.getVoices();
      const english = v.filter(voice => voice.lang.startsWith('en'));
      setVoices(english.length > 0 ? english : v);
      if (!selectedVoice && v.length > 0) {
        const preferred =
          v.find(voice => voice.lang.startsWith('en') && (
            voice.name.includes('Samantha') ||
            voice.name.includes('Natural') ||
            voice.name.includes('Enhanced') ||
            voice.name.includes('Premium')
          )) ||
          v.find(voice => voice.lang.startsWith('en')) ||
          v[0];
        setSelectedVoice(preferred);
      }
    };

    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);
    return () => synth.removeEventListener?.('voiceschanged', loadVoices);
  }, []);

  // iOS Safari workaround: keep speechSynthesis alive
  // Safari pauses speechSynthesis after ~15s. This nudges it.
  useEffect(() => {
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
  }, [isPlaying]);

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

  const speakSentence = useCallback((index, sentenceList) => {
    const list = sentenceList || sentencesRef.current;
    if (index >= list.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentIndex(-1);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(list[index]);
    utterance.rate = speedRef.current;
    if (selectedVoiceRef.current) utterance.voice = selectedVoiceRef.current;

    utterance.onend = () => {
      if (isPlayingRef.current) {
        const next = currentIndexRef.current + 1;
        setCurrentIndex(next);
        speakSentence(next, list);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && isPlayingRef.current) {
        const next = currentIndexRef.current + 1;
        setCurrentIndex(next);
        speakSentence(next, list);
      }
    };

    utteranceRef.current = utterance;
    setCurrentIndex(index);
    window.speechSynthesis.speak(utterance);
  }, []);

  const handlePlay = () => {
    if (!text.trim()) return;
    const s = splitIntoSentences(text);
    setSentences(s);

    if (isPaused && currentIndexRef.current >= 0) {
      setIsPaused(false);
      setIsPlaying(true);
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      speakSentence(currentIndexRef.current, s);
    } else {
      setIsPlaying(true);
      setIsPaused(false);
      setElapsedTime(0);
      startTimeRef.current = Date.now();
      speakSentence(0, s);
      setShowText(true);
    }
  };

  const handlePause = () => {
    window.speechSynthesis.cancel();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(-1);
    setElapsedTime(0);
    startTimeRef.current = null;
  };

  const handleSkipForward = () => {
    if (!isPlaying && !isPaused) return;
    const next = Math.min(currentIndexRef.current + 1, sentences.length - 1);
    window.speechSynthesis.cancel();
    setCurrentIndex(next);
    if (isPlaying) speakSentence(next);
  };

  const handleSkipBack = () => {
    if (!isPlaying && !isPaused) return;
    const prev = Math.max(currentIndexRef.current - 1, 0);
    window.speechSynthesis.cancel();
    setCurrentIndex(prev);
    if (isPlaying) speakSentence(prev);
  };

  const handleSentenceTap = (index) => {
    if (!isPlaying && !isPaused) return;
    window.speechSynthesis.cancel();
    setCurrentIndex(index);
    setIsPaused(false);
    setIsPlaying(true);
    speakSentence(index);
  };

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
            marginBottom: 4,
          }}>
            Voice Reader
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#e8e4de' }}>
            Paste → Listen
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
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const v = voices.find(v => v.name === e.target.value);
                setSelectedVoice(v);
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
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
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
                  onClick={() => setSpeed(s)}
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
        </div>
      )}

      {/* Text Input / Display Area */}
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
                📋 Paste from Clipboard
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

      {/* Player Controls */}
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
                onClick={() => {
                  setSpeed(s);
                  if (isPlaying && currentIndexRef.current >= 0) {
                    window.speechSynthesis.cancel();
                    setTimeout(() => speakSentence(currentIndexRef.current), 50);
                  }
                }}
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
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={!text.trim() && !isPaused}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: (!text.trim() && !isPaused) ? '#1a1a1c' : '#c45a3c',
              border: 'none', color: '#fff', fontSize: 26,
              cursor: (!text.trim() && !isPaused) ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: (text.trim() || isPaused) ? '0 0 24px rgba(196, 90, 60, 0.3)' : 'none',
              transition: 'all 0.2s',
            }}
          >{isPlaying ? '⏸' : '▶'}</button>

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
              onClick={() => {
                const jump = Math.min(currentIndexRef.current + 5, sentences.length - 1);
                window.speechSynthesis.cancel();
                setCurrentIndex(jump);
                if (isPlaying) speakSentence(jump);
              }}
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

        {!isPlaying && !isPaused && (
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
    </div>
  );
}
