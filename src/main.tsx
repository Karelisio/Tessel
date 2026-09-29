import { SplashScreen } from '@capacitor/splash-screen';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito';
import './ui/styles.css';
import { App } from './ui/App';

const root = document.getElementById('root');
if (!root) throw new Error('#root introuvable');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// filet de sécurité : l'écran de démarrage natif ne doit jamais rester bloqué
setTimeout(() => {
  void SplashScreen.hide().catch(() => undefined);
}, 4000);
