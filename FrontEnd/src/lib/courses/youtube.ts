// The few pieces of the YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference) the
// course player uses: it needs the current time, seeking and the playback rate to keep track of what was watched.

export const PlayerState = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;

export type YouTubePlayer = {
  getCurrentTime(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  pauseVideo(): void;
  destroy(): void;
};

type PlayerEvent = { target: YouTubePlayer; data: number };

export type PlayerOptions = {
  videoId: string;
  host?: string;
  width?: string;
  height?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: PlayerEvent) => void;
    onStateChange?: (event: PlayerEvent) => void;
    onPlaybackRateChange?: (event: PlayerEvent) => void;
    onError?: (event: PlayerEvent) => void;
  };
};

type YouTubeApi = { Player: new (element: HTMLElement, options: PlayerOptions) => YouTubePlayer };

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_URL = "https://www.youtube.com/iframe_api";
let loading: Promise<YouTubeApi> | null = null;

/** Loads the API script once. Rejects when it is blocked (an ad blocker, no network), so the page can say so. */
export function loadYouTubeApi(timeoutMs = 15000): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YouTubeApi>((resolve, reject) => {
    const timer = window.setTimeout(() => fail(new Error("YouTube API timed out")), timeoutMs);
    function fail(error: Error) {
      window.clearTimeout(timer);
      loading = null; // a later attempt may succeed (the blocker turned off)
      reject(error);
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
      else fail(new Error("YouTube API missing"));
    };
    const script = document.createElement("script");
    script.src = API_URL;
    script.async = true;
    script.onerror = () => {
      script.remove();
      fail(new Error("YouTube API blocked"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** 83 -> "1:23" */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
