export type DiagnosticConfig = {
  enabled: boolean;
  disableBuildings: boolean;
  disableOSM: boolean;
  disableShadows: boolean;
  disableTextures: boolean;
  disableNPCs: boolean;
  disableDistantChunks: boolean;
};

function parseDiagnosticConfig(): DiagnosticConfig {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      disableBuildings: false,
      disableOSM: false,
      disableShadows: false,
      disableTextures: false,
      disableNPCs: false,
      disableDistantChunks: false,
    };
  }

  const search = new URLSearchParams(window.location.search);
  const stored = sessionStorage.getItem('mm_diag_config');
  const storedConfig = stored ? JSON.parse(stored) : null;

  const disableList = (search.get('disable') || '').toLowerCase().split(',');
  const hasDiag = search.has('diag') || search.has('diagnostic') || !!storedConfig;

  const config: DiagnosticConfig = {
    enabled: hasDiag,
    disableBuildings: search.get('buildings') === '0' || disableList.includes('buildings') || !!storedConfig?.disableBuildings,
    disableOSM: search.get('osm') === '0' || disableList.includes('osm') || !!storedConfig?.disableOSM,
    disableShadows: search.get('shadows') === '0' || disableList.includes('shadows') || !!storedConfig?.disableShadows,
    disableTextures: search.get('textures') === '0' || disableList.includes('textures') || !!storedConfig?.disableTextures,
    disableNPCs: search.get('npcs') === '0' || disableList.includes('npcs') || !!storedConfig?.disableNPCs,
    disableDistantChunks: search.get('chunks') === '0' || disableList.includes('chunks') || !!storedConfig?.disableDistantChunks,
  };

  if (hasDiag) {
    console.info('[DiagnosticMode] Active configuration:', config);
  }

  return config;
}

export const diagnosticConfig: DiagnosticConfig = parseDiagnosticConfig();

if (typeof window !== 'undefined') {
  (window as any).__DIAGNOSTIC_MODE__ = {
    config: diagnosticConfig,
    set(patch: Partial<DiagnosticConfig>) {
      Object.assign(diagnosticConfig, patch);
      sessionStorage.setItem('mm_diag_config', JSON.stringify(diagnosticConfig));
      console.info('[DiagnosticMode] Updated configuration saved to sessionStorage. Reload to apply:', diagnosticConfig);
    },
    reset() {
      sessionStorage.removeItem('mm_diag_config');
      console.info('[DiagnosticMode] Configuration reset. Reload to restore defaults.');
    },
  };
}
