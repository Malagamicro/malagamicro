import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// This version must match the APP_VERSION in Sidebar.tsx
const CURRENT_VERSION = 'v2.9.0';

export function VersionChecker() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        // Fetch the latest index.html to check if a new version is available
        const response = await fetch('/', { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const html = await response.text();
        
        // Look for the version meta tag or build hash differences
        // We compare the current script src hashes with the fetched ones
        const currentScripts = Array.from(document.querySelectorAll('script[src]'))
          .map(s => s.getAttribute('src'))
          .filter(Boolean);
        
        // Extract script srcs from fetched HTML
        const scriptRegex = /<script[^>]+src="([^"]+)"/g;
        const fetchedScripts: string[] = [];
        let match;
        while ((match = scriptRegex.exec(html)) !== null) {
          fetchedScripts.push(match[1]);
        }
        
        // If the main JS bundle hash has changed, a new version is available
        const currentMain = currentScripts.find(s => s?.includes('/assets/'));
        const fetchedMain = fetchedScripts.find(s => s.includes('/assets/'));
        
        if (currentMain && fetchedMain && currentMain !== fetchedMain) {
          setShowBanner(true);
        }
      } catch (error) {
        // Silently fail - network issues shouldn't show update banner
        console.log('Version check failed:', error);
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkVersion, 5 * 60 * 1000);
    
    // Also check 30 seconds after load
    const timeout = setTimeout(checkVersion, 30 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground px-4 py-2 flex items-center justify-center gap-3 shadow-lg animate-in slide-in-from-top duration-300">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm font-medium">
        Hay una nueva versión disponible de la aplicación
      </span>
      <Button 
        size="sm" 
        variant="secondary"
        className="h-7 text-xs gap-1"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="h-3 w-3" />
        Actualizar ahora
      </Button>
      <button 
        onClick={() => setShowBanner(false)}
        className="ml-2 hover:opacity-70 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
