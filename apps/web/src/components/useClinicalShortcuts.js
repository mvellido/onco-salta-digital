import { useEffect } from 'react';

export function useClinicalShortcuts({ onToggleVitals, onRefreshPatients, onSectionChange }) {
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onToggleVitals?.();
        return;
      }

      if (event.altKey && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        const sectionMap = {
          '1': 'pacientes',
          '2': 'turnos',
          '3': 'ia',
          '4': 'config',
        };
        onSectionChange?.(sectionMap[event.key]);
        return;
      }

      if (event.key === 'F5') {
        event.preventDefault();
        onRefreshPatients?.();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onToggleVitals, onRefreshPatients, onSectionChange]);
}
