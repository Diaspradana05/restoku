import { useEffect, useRef } from 'react';

// Menjalankan fn sekarang lalu berkala; berhenti saat tab tersembunyi (hemat request ke server/database).
export function usePolling(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let timer;
    const run = () => ref.current();
    const start = () => { run(); timer = setInterval(run, ms); };
    const onVis = () => { clearInterval(timer); if (!document.hidden) start(); };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [ms]);
}
