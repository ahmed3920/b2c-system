const STORAGE_KEY = "notifications:sound-muted";
const SOUND_URL = "/notification.wav";

let audio: HTMLAudioElement | null = null;
let unlocked = false;

function getAudio() {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(SOUND_URL);
    audio.preload = "auto";
    audio.volume = 0.6;
  }
  return audio;
}

export function isSoundMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function setSoundMuted(muted: boolean) {
  localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
}

/**
 * Browsers block audio until the user has interacted with the page.
 * Prime the element on the first interaction so later plays succeed.
 */
export function primeNotificationSound() {
  if (unlocked || typeof window === "undefined") return;
  const unlock = () => {
    const el = getAudio();
    if (el) {
      const prevVolume = el.volume;
      el.volume = 0;
      el.play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.volume = prevVolume;
        })
        .catch(() => {
          el.volume = prevVolume;
        });
    }
    unlocked = true;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export function playNotificationSound() {
  if (isSoundMuted()) return;
  const el = getAudio();
  if (!el) return;
  try {
    el.currentTime = 0;
    void el.play().catch(() => {});
  } catch {
    /* ignore */
  }
}
