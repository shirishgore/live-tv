'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Channel } from '@/lib/types';
import { recordWatch } from '@/lib/actions';

type HlsClass = typeof import('hls.js').default;
type HlsInstance = InstanceType<HlsClass>;

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const WATCHDOG_MS = 12_000;
const FLUSH_EVERY_S = 15;
const BOOST_GAIN = 1.6;

type Phase = 'loading' | 'ready' | 'switching' | 'failed' | 'offline';

interface SubtitleOption {
  index: number;
  label: string;
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export interface PlayerProps {
  channel: Channel;
  streams: string[];
  related: Channel[];
}

export default function Player({
  channel,
  streams,
  related,
  autoFailover,
}: PlayerProps & { autoFailover: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const hlsClassRef = useRef<HlsClass | null>(null);
  const hlsRef = useRef<HlsInstance | null>(null);
  const nativeModeRef = useRef(false);
  const loadTokenRef = useRef(0);
  const mountedRef = useRef(true);

  const streamsRef = useRef(streams);
  const autoFailoverRef = useRef(autoFailover);
  const channelIdRef = useRef(channel.id);
  useEffect(() => {
    streamsRef.current = streams;
  }, [streams]);
  useEffect(() => {
    autoFailoverRef.current = autoFailover;
  }, [autoFailover]);
  useEffect(() => {
    channelIdRef.current = channel.id;
  }, [channel.id]);

  const currentIndexRef = useRef(0);
  const recoveredOnceRef = useRef(false);
  const hasProgressedRef = useRef(false);
  const watchdogRef = useRef<number | null>(null);
  const fatalCountRef = useRef(0);
  const fatalWindowStartRef = useRef(0);
  const pendingSecondsRef = useRef(0);
  const lastElapsedSecRef = useRef(-1);
  const controlsTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const boostRef = useRef(false);
  const autoPlayRef = useRef(true);
  const lockedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const settingsOpenRef = useRef(false);
  const subsOpenRef = useRef(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [switchNote, setSwitchNote] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState<number>(1);
  const [elapsed, setElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [boost, setBoost] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleOption[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState(-1);

  // Keep mutable refs in sync with state used inside callbacks.
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);
  useEffect(() => {
    boostRef.current = boost;
  }, [boost]);
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);
  useEffect(() => {
    subsOpenRef.current = subsOpen;
  }, [subsOpen]);

  /* ---------------- watch-progress reporting ---------------- */

  const flushWatch = useCallback(() => {
    const secs = Math.floor(pendingSecondsRef.current);
    if (secs > 0) {
      pendingSecondsRef.current = 0;
      void recordWatch(channelIdRef.current, secs).catch(() => {
        // Progress reporting is best-effort; never break playback.
      });
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && !video.ended) {
        pendingSecondsRef.current += 1;
        if (pendingSecondsRef.current >= FLUSH_EVERY_S) flushWatch();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [flushWatch]);

  // Flush once on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      flushWatch();
    };
  }, [flushWatch]);

  /* ---------------- controls auto-hide ---------------- */

  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
    if (isPlayingRef.current && !lockedRef.current) {
      controlsTimerRef.current = window.setTimeout(() => {
        if (
          isPlayingRef.current &&
          !settingsOpenRef.current &&
          !subsOpenRef.current
        ) {
          setControlsVisible(false);
        }
      }, 3000);
    }
  }, []);

  // When playback pauses, the pause handler shows the controls and the
  // timer above refuses to hide them while paused (isPlayingRef check).

  /* ---------------- playback helpers ---------------- */

  const attemptPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !autoPlayRef.current) return;
    void video.play().catch(() => {
      // Autoplay with sound is often blocked: retry muted.
      video.muted = true;
      setIsMuted(true);
      void video.play().catch(() => {
        // User can press play manually.
      });
    });
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const destroyHls = useCallback(() => {
    const hls = hlsRef.current;
    if (hls) {
      hls.destroy();
      hlsRef.current = null;
    }
  }, []);

  const markProgressed = useCallback(() => {
    if (!hasProgressedRef.current) {
      hasProgressedRef.current = true;
      clearWatchdog();
      setPhase('ready');
      setSwitchNote(null);
      setFailedMessage(null);
    }
  }, [clearWatchdog]);

  /* ---------------- failover core ---------------- */

  const loadStreamRef = useRef<(index: number, opts?: { manual?: boolean }) => void>(() => {});
  const handleFatalRef = useRef<(kind: 'hls' | 'native' | 'timeout' | 'unsupported', data?: unknown) => void>(() => {});

  const recoverInPlace = useCallback(
    (kind: 'hls' | 'native' | 'timeout' | 'unsupported', data?: unknown) => {
      const hls = hlsRef.current;
      const video = videoRef.current;
      if (hls && hlsClassRef.current) {
        const Hls = hlsClassRef.current;
        const type = (data as { type?: string } | undefined)?.type;
        if (type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else {
          // MEDIA_ERROR (and anything else): hls.js in-place media recovery.
          hls.recoverMediaError();
        }
      } else if (nativeModeRef.current && video) {
        // Native HLS: reload the same source once.
        video.load();
        attemptPlay();
      }
      void kind;
    },
    [attemptPlay],
  );

  const advanceRef = useRef<() => void>(() => {});

  const handleFatal = useCallback(
    (kind: 'hls' | 'native' | 'timeout' | 'unsupported', data?: unknown) => {
      const list = streamsRef.current;
      if (list.length === 0) {
        setPhase('offline');
        return;
      }

      if (hasProgressedRef.current) {
        // Mid-playback failure: recover in place and stay on this stream.
        // Only give up on the stream after repeated fatal errors in a
        // short window, so a flapping stream cannot stall forever.
        const now = Date.now();
        if (now - fatalWindowStartRef.current > 30_000) {
          fatalWindowStartRef.current = now;
          fatalCountRef.current = 0;
        }
        fatalCountRef.current += 1;
        if (fatalCountRef.current >= 3) {
          advanceRef.current();
          return;
        }
        recoverInPlace(kind, data);
        return;
      }

      // Stream never produced progress: one in-place recovery, then move on.
      if (!recoveredOnceRef.current) {
        recoveredOnceRef.current = true;
        recoverInPlace(kind, data);
        // Give the recovery a fresh 12s window.
        if (watchdogRef.current !== null) window.clearTimeout(watchdogRef.current);
        watchdogRef.current = window.setTimeout(() => {
          const video = videoRef.current;
          if (video && video.paused) return; // user paused; re-arm on play
          if (!hasProgressedRef.current) handleFatalRef.current('timeout');
        }, WATCHDOG_MS);
        return;
      }

      advanceRef.current();
    },
    [recoverInPlace],
  );
  useEffect(() => {
    handleFatalRef.current = handleFatal;
  }, [handleFatal]);

  const advance = useCallback(() => {
    const list = streamsRef.current;
    const next = currentIndexRef.current + 1;
    if (next < list.length) {
      if (autoFailoverRef.current) {
        setPhase('switching');
        loadStreamRef.current(next);
      } else {
        // Auto-failover is off: stop and let the viewer choose.
        setPhase('failed');
        setFailedMessage(
          `Stream ${currentIndexRef.current + 1} of ${list.length} failed.`,
        );
        setSwitchNote(null);
      }
    } else {
      // Every stream failed: only now is the channel offline.
      clearWatchdog();
      setPhase('offline');
      setSwitchNote(null);
    }
  }, [clearWatchdog]);
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  const armWatchdog = useCallback(() => {
    clearWatchdog();
    watchdogRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && video.paused) return; // user paused before first frame
      if (!hasProgressedRef.current) handleFatalRef.current('timeout');
    }, WATCHDOG_MS);
  }, [clearWatchdog]);

  const loadStream = useCallback(
    async (index: number, opts?: { manual?: boolean }) => {
      const list = streamsRef.current;
      if (list.length === 0) {
        setPhase('offline');
        return;
      }
      if (index < 0 || index >= list.length) return;
      const token = ++loadTokenRef.current;

      destroyHls();
      clearWatchdog();
      recoveredOnceRef.current = false;
      hasProgressedRef.current = false;
      fatalCountRef.current = 0;
      fatalWindowStartRef.current = 0;
      currentIndexRef.current = index;
      setCurrentIndex(index);
      setSubtitleTracks([]);
      setActiveSubtitle(-1);
      setPhase(index === 0 && !opts?.manual ? 'loading' : 'switching');
      setSwitchNote(`Trying another stream… (${index + 1} of ${list.length})`);
      setFailedMessage(null);

      const video = videoRef.current;
      if (!video) return;
      const url = list[index];

      armWatchdog();

      try {
        if (!hlsClassRef.current) {
          const mod = await import('hls.js');
          if (!mountedRef.current || token !== loadTokenRef.current) return;
          hlsClassRef.current = mod.default;
        }
        const Hls = hlsClassRef.current;
        if (!mountedRef.current || token !== loadTokenRef.current) return;

        if (Hls.isSupported()) {
          nativeModeRef.current = false;
          const hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
          hlsRef.current = hls;
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) handleFatalRef.current('hls', data);
          });
          hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
            if (token !== loadTokenRef.current) return;
            setSubtitleTracks(
              hls.subtitleTracks.map((t, i) => ({
                index: i,
                label: t.name || t.lang || `Subtitles ${i + 1}`,
              })),
            );
          });
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (token !== loadTokenRef.current) return;
            attemptPlay();
          });
          hls.loadSource(url);
          hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS fallback.
          nativeModeRef.current = true;
          video.src = url;
          video.load();
          attemptPlay();
        } else {
          handleFatalRef.current('unsupported');
        }
      } catch {
        if (mountedRef.current && token === loadTokenRef.current) {
          handleFatalRef.current('hls');
        }
      }
    },
    [armWatchdog, attemptPlay, clearWatchdog, destroyHls],
  );
  useEffect(() => {
    loadStreamRef.current = loadStream;
  }, [loadStream]);

  // Initial load + teardown.
  useEffect(() => {
    const video = videoRef.current;
    void loadStreamRef.current(0);
    return () => {
      clearWatchdog();
      destroyHls();
      if (video) video.removeAttribute('src');
    };
    // Intentionally run once per channel mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  /* ---------------- video element events ---------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlaying = () => {
      setIsPlaying(true);
      markProgressed();
      pokeControls();
    };
    const onProgress = () => markProgressed();
    const onPause = () => {
      setIsPlaying(false);
      setControlsVisible(true);
      flushWatch();
    };
    const onTimeUpdate = () => {
      const sec = Math.floor(video.currentTime);
      if (sec !== lastElapsedSecRef.current) {
        lastElapsedSecRef.current = sec;
        setElapsed(sec);
      }
    };
    const onPlay = () => {
      // User resumed before first progress: re-arm the watchdog.
      if (!hasProgressedRef.current) armWatchdog();
    };
    const onError = () => {
      // Native HLS path only; hls.js errors arrive via its ERROR event.
      if (nativeModeRef.current && video.error) {
        handleFatalRef.current('native');
      }
    };
    const onLoadedMetadata = () => {
      if (nativeModeRef.current && video.textTracks.length > 0) {
        setSubtitleTracks(
          Array.from(video.textTracks).map((t, i) => ({
            index: i,
            label: t.label || t.language || `Subtitles ${i + 1}`,
          })),
        );
      }
    };
    const onVolumeChange = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('progress', onProgress);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('error', onError);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('volumechange', onVolumeChange);
    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('volumechange', onVolumeChange);
    };
  }, [armWatchdog, flushWatch, markProgressed, pokeControls]);

  // Fullscreen state.
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  /* ---------------- control actions ---------------- */

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || lockedRef.current) return;
    if (video.paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || lockedRef.current) return;
    video.currentTime = Math.max(0, video.currentTime + seconds);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 0.5;
  }, []);

  const changeVolume = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
  }, []);

  const changeSpeed = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = value;
    setSpeed(value);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void wrap.requestFullscreen().catch(() => {});
    }
  }, []);

  const togglePiP = useCallback(() => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => {});
    } else {
      void video.requestPictureInPicture().catch(() => {});
    }
  }, []);

  const ensureAudioGraph = useCallback(() => {
    const video = videoRef.current;
    if (!video || audioCtxRef.current) return;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(video);
      const gain = ctx.createGain();
      gain.gain.value = boostRef.current ? BOOST_GAIN : 1;
      source.connect(gain);
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      gainRef.current = gain;
    } catch {
      // Volume boost is optional; playback continues without it.
    }
  }, []);

  const toggleBoost = useCallback(() => {
    const next = !boostRef.current;
    setBoost(next);
    ensureAudioGraph();
    const ctx = audioCtxRef.current;
    if (ctx) {
      void ctx.resume().catch(() => {});
      if (gainRef.current) gainRef.current.gain.value = next ? BOOST_GAIN : 1;
    }
  }, [ensureAudioGraph]);

  const selectSubtitle = useCallback((index: number) => {
    setActiveSubtitle(index);
    const hls = hlsRef.current;
    if (hls) {
      hls.subtitleTrack = index;
      return;
    }
    const video = videoRef.current;
    if (video) {
      for (let i = 0; i < video.textTracks.length; i += 1) {
        video.textTracks[i].mode = i === index ? 'showing' : 'hidden';
      }
    }
  }, []);

  const switchStream = useCallback((index: number) => {
    setSettingsOpen(false);
    if (index === currentIndexRef.current) return;
    void loadStreamRef.current(index, { manual: true });
  }, []);

  const retryCurrentStream = useCallback(() => {
    void loadStreamRef.current(currentIndexRef.current, { manual: true });
  }, []);

  const tryNextStream = useCallback(() => {
    const next = currentIndexRef.current + 1;
    if (next < streamsRef.current.length) {
      void loadStreamRef.current(next, { manual: true });
    } else {
      setPhase('offline');
    }
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (locked && e.key !== 'l' && e.key !== 'L') return;
      const video = videoRef.current;
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBy(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekBy(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (video) changeVolume(Math.min(1, video.volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (video) changeVolume(Math.max(0, video.volume - 0.1));
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        case 'l':
        case 'L':
          setLocked((v) => !v);
          break;
        default:
          break;
      }
    },
    [changeVolume, locked, seekBy, toggleFullscreen, toggleMute, togglePlay],
  );

  /* ---------------- derived data ---------------- */

  const similar = related
    .filter((c) => c.category === channel.category && c.country === channel.country)
    .slice(0, 3);
  const similarFallback =
    similar.length > 0
      ? similar
      : related.filter((c) => c.category === channel.category).slice(0, 3);
  const offlineChoices = similarFallback.length > 0 ? similarFallback : related.slice(0, 3);

  const showBars = controlsVisible && !locked && phase !== 'offline';
  const busy = phase === 'loading' || phase === 'switching';

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="region"
      aria-label={`${channel.name} live player`}
      onKeyDown={onKeyDown}
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
      className="group relative aspect-video w-full touch-manipulation overflow-hidden rounded-xl bg-black text-white outline-none select-none focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        preload="auto"
        onClick={togglePlay}
        aria-label={`${channel.name} live video`}
      />

      {/* Loading / switching overlay */}
      {busy && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-cyan-400"
            role="status"
            aria-label="Loading stream"
          />
          <p className="px-4 text-center text-sm text-white/90" role="status">
            {phase === 'switching' && switchNote
              ? switchNote
              : 'Loading live stream…'}
          </p>
          {phase === 'switching' && (
            <p className="text-xs text-white/60">
              Stream {currentIndex + 1} of {streams.length}
            </p>
          )}
        </div>
      )}

      {/* Stream failed with auto-failover off: let the viewer choose */}
      {phase === 'failed' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center">
          <p className="text-base font-semibold">This stream failed</p>
          <p className="text-sm text-white/70">
            {failedMessage ?? 'The current stream could not be played.'} Auto
            failover is off.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {currentIndex + 1 < streams.length && (
              <button
                type="button"
                onClick={tryNextStream}
                className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
              >
                Try next stream
              </button>
            )}
            <button
              type="button"
              onClick={retryCurrentStream}
              className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Retry this stream
            </button>
          </div>
        </div>
      )}

      {/* Offline: only after ALL streams failed */}
      {phase === 'offline' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-zinc-950 px-4 py-6 text-center">
          <p className="text-lg font-semibold">This channel is offline</p>
          <p className="max-w-md text-sm text-white/70">
            All {streams.length} stream{streams.length === 1 ? '' : 's'} for{' '}
            {channel.name} failed. Try one of these similar live channels:
          </p>
          {offlineChoices.length > 0 ? (
            <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {offlineChoices.map((c) => (
                <Link
                  key={c.id}
                  href={`/watch/${c.id}`}
                  className="flex items-center gap-3 rounded-lg bg-white/5 p-3 text-left transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.logo}
                      alt={`${c.name} logo`}
                      className="h-10 w-10 shrink-0 rounded bg-white object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-cyan-500/20 text-lg font-bold text-cyan-300">
                      {c.name.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {c.name}
                    </span>
                    <span className="block truncate text-xs text-white/60">
                      {c.category}
                      {c.countryName ? ` • ${c.countryName}` : ''}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/60">
              No similar channels available right now.
            </p>
          )}
          <Link
            href="/"
            className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Browse all channels
          </Link>
        </div>
      )}

      {/* Top bar */}
      {(showBars || phase === 'offline') && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 py-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="Go back"
            className="rounded-full p-2 text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <Link
            href="/"
            aria-label="Home"
            className="rounded-full p-2 text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V21h-6v-6h-6v6H3z" />
            </svg>
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
            {channel.name} • LIVE
          </p>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold tracking-wide">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
            LIVE
          </span>
        </div>
      )}

      {/* Center play button when paused */}
      {phase === 'ready' && !isPlaying && !locked && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 z-10 m-auto h-16 w-16 rounded-full bg-black/60 text-white transition hover:scale-105 hover:bg-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="mx-auto h-8 w-8" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Locked: only the unlock button */}
      {locked && (
        <button
          type="button"
          onClick={() => setLocked(false)}
          aria-label="Unlock controls"
          className="absolute right-3 bottom-3 z-30 rounded-full bg-black/70 p-3 text-white transition hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path strokeLinecap="round" d="M8 11V7a4 4 0 018 0v4" />
          </svg>
        </button>
      )}

      {/* Bottom controls */}
      {showBars && (
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 to-transparent px-3 pt-8 pb-3">
          {/* Subtitle menu */}
          {subsOpen && (
            <div
              role="menu"
              aria-label="Subtitles"
              className="absolute right-3 bottom-16 w-56 rounded-lg bg-zinc-900 p-2 shadow-xl ring-1 ring-white/10"
            >
              <p className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-white/60 uppercase">
                Subtitles
              </p>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={activeSubtitle === -1}
                onClick={() => {
                  selectSubtitle(-1);
                  setSubsOpen(false);
                }}
                className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-white/10 ${activeSubtitle === -1 ? 'text-cyan-300' : 'text-white'}`}
              >
                Off
              </button>
              {subtitleTracks.map((t) => (
                <button
                  key={t.index}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeSubtitle === t.index}
                  onClick={() => {
                    selectSubtitle(t.index);
                    setSubsOpen(false);
                  }}
                  className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-white/10 ${activeSubtitle === t.index ? 'text-cyan-300' : 'text-white'}`}
                >
                  {t.label}
                </button>
              ))}
              {subtitleTracks.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-white/50">
                  No subtitles on this stream
                </p>
              )}
            </div>
          )}

          {/* Settings menu */}
          {settingsOpen && (
            <div
              role="menu"
              aria-label="Settings"
              className="absolute right-3 bottom-16 max-h-72 w-64 overflow-y-auto rounded-lg bg-zinc-900 p-2 shadow-xl ring-1 ring-white/10"
            >
              <p className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-white/60 uppercase">
                Speed
              </p>
              <div className="flex flex-wrap gap-1 px-1 pb-2">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="menuitemradio"
                    aria-checked={speed === s}
                    onClick={() => changeSpeed(s)}
                    className={`rounded px-2 py-1 text-sm ${speed === s ? 'bg-cyan-500 font-semibold text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <p className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-white/60 uppercase">
                Server
              </p>
              {streams.map((s, i) => (
                <button
                  key={`${i}-${s}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={i === currentIndex}
                  onClick={() => switchStream(i)}
                  className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-white/10 ${i === currentIndex ? 'font-semibold text-cyan-300' : 'text-white'}`}
                >
                  Stream {i + 1}
                  {i === currentIndex ? ' • Playing' : ''}
                </button>
              ))}

              <div className="mt-2 border-t border-white/10 pt-2">
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={autoPlay}
                  onClick={() => setAutoPlay((v) => !v)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-white hover:bg-white/10"
                >
                  Auto Play
                  <span className={`text-xs font-semibold ${autoPlay ? 'text-cyan-300' : 'text-white/50'}`}>
                    {autoPlay ? 'On' : 'Off'}
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={boost}
                  onClick={toggleBoost}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-white hover:bg-white/10"
                >
                  Volume boost
                  <span className={`text-xs font-semibold ${boost ? 'text-cyan-300' : 'text-white/50'}`}>
                    {boost ? 'On' : 'Off'}
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="rounded-full p-2 text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => seekBy(-10)}
              aria-label="Back 10 seconds"
              className="rounded-full p-2 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              −10s
            </button>
            <button
              type="button"
              onClick={() => seekBy(10)}
              aria-label="Forward 10 seconds"
              className="rounded-full p-2 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              +10s
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="rounded-full p-2 text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {isMuted || volume === 0 ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.6 3l2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4zM14 3.2v2.1a7 7 0 010 13.4v2.1a9 9 0 000-17.6z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((isMuted ? 0 : volume) * 100)}
              onChange={(e) => changeVolume(Number(e.target.value) / 100)}
              aria-label="Volume"
              className="hidden w-20 accent-cyan-400 sm:block"
            />

            <span className="ml-1 flex items-center gap-2 text-xs text-white/90 sm:text-sm">
              <span className="flex items-center gap-1 font-bold text-red-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
                LIVE
              </span>
              <span aria-label={`Elapsed ${formatTime(elapsed)}`}>
                {formatTime(elapsed)}
              </span>
            </span>

            <span className="flex-1" />

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setSubsOpen((v) => !v);
              }}
              aria-label="Subtitles"
              aria-expanded={subsOpen}
              className="rounded-full p-2 text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span className="block rounded border border-current px-1.5 py-0.5 text-[10px] leading-none font-bold">
                CC
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSubsOpen(false);
                setSettingsOpen((v) => !v);
              }}
              aria-label="Settings"
              aria-expanded={settingsOpen}
              className="rounded-full p-2 text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path strokeLinecap="round" d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.03 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1.11-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1.03H3a2 2 0 110-4h.09A1.7 1.7 0 004.65 8.9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009.1 4.54 1.7 1.7 0 0010.13 3H12a2 2 0 114 0v.09c0 .68.4 1.3 1.03 1.56.6.26 1.3.1 1.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87c.26.63.88 1.03 1.56 1.03H21a2 2 0 110 4h-.09c-.68 0-1.3.4-1.51 1.03z" />
              </svg>
            </button>

            {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
              <button
                type="button"
                onClick={togglePiP}
                aria-label="Picture in picture"
                className="rounded-full p-2 text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <rect x="12" y="12" width="6" height="4" rx="1" fill="currentColor" stroke="none" />
                </svg>
              </button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="rounded-full p-2 text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V5H5M15 9V5h4M9 15v4H5M15 15v4h4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 9V5h4M19 9V5h-4M5 15v4h4M19 15v4h-4" />
                )}
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setLocked(true)}
              aria-label="Lock controls"
              className="rounded-full p-2 text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path strokeLinecap="round" d="M8 11V7a4 4 0 018 0v4" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
