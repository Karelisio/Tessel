/** Configuration statique de l'application. */
export const APP_CONFIG = {
  appId: 'com.karelisio.tessel',
  version: __APP_VERSION__,
  github: { owner: 'Karelisio', repo: 'Tessel' },
  /** Intervalle minimal entre deux vérifications automatiques de mise à jour. */
  updateCheckIntervalMs: 24 * 60 * 60 * 1000,
} as const;
