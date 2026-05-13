import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Try to load local firebase config for AI Studio compatibility
  let firebaseFallback: Record<string, string> = {};
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      firebaseFallback = {
        VITE_FIREBASE_API_KEY: config.apiKey,
        VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
        VITE_FIREBASE_PROJECT_ID: config.projectId,
        VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket,
        VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
        VITE_FIREBASE_APP_ID: config.appId,
        VITE_FIREBASE_DATABASE_ID: config.firestoreDatabaseId
      };
    }
  } catch (e) {
    // Ignore errors reading local config
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      // Inject Firebase config fallbacks
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY || firebaseFallback.VITE_FIREBASE_API_KEY),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN || firebaseFallback.VITE_FIREBASE_AUTH_DOMAIN),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID || firebaseFallback.VITE_FIREBASE_PROJECT_ID),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET || firebaseFallback.VITE_FIREBASE_STORAGE_BUCKET),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseFallback.VITE_FIREBASE_MESSAGING_SENDER_ID),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID || firebaseFallback.VITE_FIREBASE_APP_ID),
      'import.meta.env.VITE_FIREBASE_DATABASE_ID': JSON.stringify(env.VITE_FIREBASE_DATABASE_ID || firebaseFallback.VITE_FIREBASE_DATABASE_ID),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
