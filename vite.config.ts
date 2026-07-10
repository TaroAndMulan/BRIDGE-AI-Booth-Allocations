import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

/**
 * Read straight off the PDF so the size and page count shown next to a download
 * link cannot drift when the file is replaced.
 */
function readPdfStats(name: string) {
  const file = path.resolve(__dirname, 'public', name);
  if (!fs.existsSync(file)) return { size: '', pages: 0 };

  const bytes = fs.statSync(file).size;
  const contents = fs.readFileSync(file, 'latin1');
  const pages = (contents.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const size = bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

  return { size, pages };
}

export default defineConfig(() => {
  const manual = readPdfStats('manual.pdf');
  const teamList = readPdfStats('team-list.pdf');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __MANUAL_SIZE__: JSON.stringify(manual.size),
      __MANUAL_PAGES__: JSON.stringify(manual.pages),
      __TEAM_LIST_SIZE__: JSON.stringify(teamList.size),
      __TEAM_LIST_PAGES__: JSON.stringify(teamList.pages),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
