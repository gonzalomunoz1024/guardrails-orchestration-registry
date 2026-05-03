import { useEffect } from 'react';
import { useUIStore } from '@/store';

export function useTheme() {
  const { theme, resolvedTheme, setTheme, setResolvedTheme } = useUIStore();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateResolvedTheme = () => {
      const resolved =
        theme === 'system'
          ? mediaQuery.matches
            ? 'dark'
            : 'light'
          : theme;
      setResolvedTheme(resolved);

      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    updateResolvedTheme();

    if (theme === 'system') {
      mediaQuery.addEventListener('change', updateResolvedTheme);
      return () => mediaQuery.removeEventListener('change', updateResolvedTheme);
    }
  }, [theme, setResolvedTheme]);

  return { theme, resolvedTheme, setTheme };
}
