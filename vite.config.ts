import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

/**
 * Read straight off the PDF so the size and page count shown next to a download
 * link cannot drift when the file is replaced.
 *
 * `version` is a hash of the bytes. Vite content-hashes the JS and CSS filenames,
 * but files in public/ keep stable URLs, and deploy.sh scp's over them in place —
 * so without this a browser could serve a cached copy of the old manual, deadlines
 * and all. The query string changes only when the file's contents do.
 */
function readPdfStats(name: string) {
  const file = path.resolve(__dirname, 'public', name);
  if (!fs.existsSync(file)) return { size: '', pages: 0, version: '' };

  const buffer = fs.readFileSync(file);
  const contents = buffer.toString('latin1');
  const pages = (contents.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const size = buffer.length >= 1024 * 1024
    ? `${(buffer.length / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(buffer.length / 1024)} KB`;
  const version = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 8);

  return { size, pages, version };
}

export default defineConfig(() => {
  const manual = readPdfStats('manual.pdf');
  const teamList = readPdfStats('team-list.pdf');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __MANUAL_SIZE__: JSON.stringify(manual.size),
      __MANUAL_PAGES__: JSON.stringify(manual.pages),
      __MANUAL_VERSION__: JSON.stringify(manual.version),
      __TEAM_LIST_SIZE__: JSON.stringify(teamList.size),
      __TEAM_LIST_PAGES__: JSON.stringify(teamList.pages),
      __TEAM_LIST_VERSION__: JSON.stringify(teamList.version),
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
