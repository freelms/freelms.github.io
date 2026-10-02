import { useCallback, useEffect, useRef } from 'react';

declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void; } }

let apiLoaded = false;
function loadYTApi(): Promise<void> {
  if (apiLoaded && window.YT) return Promise.resolve();
  return new Promise((resolve) => {
    if (document.getElementById('yt-iframe-api')) {
      const check = setInterval(() => { if (window.YT) { clearInterval(check); apiLoaded = true; resolve(); } }, 200);
      return;
    }
    const s = document.createElement('script');
    s.id = 'yt-iframe-api';
    s.src = 'https://www.youtube.com/iframe_api';
    window.onYouTubeIframeAPIReady = () => { apiLoaded = true; resolve(); };
    document.head.appendChild(s);
  });
}

export function YTPlayer({ videoId, startAt, onTime, onPause, onEnded, speed }: {
  videoId: string; startAt?: number;
  onTime?: (t: number, dur: number) => void;
  onPause?: (t: number) => void;
  onEnded?: () => void; speed?: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const cbRef = useRef({ onTime, onPause, onEnded });
  cbRef.current = { onTime, onPause, onEnded };
  const startRef = useRef(startAt ?? 0);
  startRef.current = startAt ?? 0;

  useEffect(() => {
    let dead = false;
    let timer: any;
    (async () => {
      await loadYTApi();
      if (dead || !divRef.current) return;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch { /* ignore */ } }
      playerRef.current = new window.YT.Player(divRef.current, {
        videoId,
        playerVars: { rel: 0, start: Math.floor(startRef.current) },
        events: {
          onReady: (e: any) => {
            try {
              e.target.setPlaybackRate(1);
              if (startRef.current > 0) e.target.seekTo(startRef.current, true);
            } catch { /* ignore */ }
          },
          onStateChange: (e: any) => {
            if (!window.YT) return;
            if (e.data === window.YT.PlayerState.ENDED) cbRef.current.onEnded?.();
            if (e.data === window.YT.PlayerState.PAUSED) {
              try { cbRef.current.onPause?.(e.target.getCurrentTime?.() ?? 0); } catch { /* ignore */ }
            }
          }
        }
      });
      timer = setInterval(() => {
        try {
          const t = playerRef.current?.getCurrentTime?.();
          const d = playerRef.current?.getDuration?.();
          if (typeof t === 'number') cbRef.current.onTime?.(t, d ?? 0);
        } catch { /* ignore */ }
      }, 1000);
    })();
    return () => { dead = true; clearInterval(timer); try { playerRef.current?.destroy(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    try { playerRef.current?.setPlaybackRate?.(speed ?? 1); } catch { /* ignore */ }
  }, [speed]);

  const seek = useCallback((sec: number) => {
    try { playerRef.current?.seekTo?.(Math.max(0, sec), true); } catch { /* ignore */ }
  }, []);
  const toggle = useCallback(() => {
    try {
      const st = playerRef.current?.getPlayerState?.();
      if (st === window.YT?.PlayerState?.PLAYING) playerRef.current.pauseVideo();
      else playerRef.current?.playVideo?.();
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (YTPlayer as any).seek = seek;
    (YTPlayer as any).toggle = toggle;
  }, [seek, toggle]);

  return <div className="aspect-video w-full overflow-hidden rounded-xl bg-black"><div ref={divRef} className="h-full w-full" /></div>;
}

export function seekPlayer(sec: number) {
  try { (YTPlayer as any).seek?.(sec); } catch { /* ignore */ }
}

export function togglePlayer() {
  try { (YTPlayer as any).toggle?.(); } catch { /* ignore */ }
}
