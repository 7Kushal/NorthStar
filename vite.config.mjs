import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const forexFactoryProxy = {
  target: 'https://nfs.faireconomy.media',
  changeOrigin: true,
  secure: true,
  rewrite: () => '/ff_calendar_thisweek.json',
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api/forex-factory': forexFactoryProxy },
  },
  preview: {
    proxy: { '/api/forex-factory': forexFactoryProxy },
  },
});
