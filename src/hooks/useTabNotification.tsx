import { useEffect, useRef } from 'react';

const ORIGINAL_TITLE = 'MalagaMicro CRM';
const FAVICON_PATH = '/favicon.png';

function createNotificationFavicon(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return FAVICON_PATH;

  const img = new Image();
  img.src = FAVICON_PATH;

  return new Promise<string>((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      // Red dot
      ctx.beginPath();
      ctx.arc(24, 8, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(FAVICON_PATH);
  }) as unknown as string;
}

export function useTabNotification(hasNotification: boolean) {
  const faviconDataRef = useRef<string | null>(null);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate notification favicon once
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = FAVICON_PATH;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      ctx.beginPath();
      ctx.arc(24, 8, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      faviconDataRef.current = canvas.toDataURL('image/png');
    };
  }, []);

  useEffect(() => {
    const setFavicon = (href: string) => {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = href;
    };

    if (hasNotification) {
      // Set notification favicon
      if (faviconDataRef.current) {
        setFavicon(faviconDataRef.current);
      }

      // Blink title
      let show = true;
      blinkIntervalRef.current = setInterval(() => {
        document.title = show ? '🔴 Nuevo mensaje' : ORIGINAL_TITLE;
        show = !show;
      }, 1500);
    } else {
      // Restore
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
      document.title = ORIGINAL_TITLE;
      setFavicon(FAVICON_PATH);
    }

    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
      document.title = ORIGINAL_TITLE;
      setFavicon(FAVICON_PATH);
    };
  }, [hasNotification]);
}
