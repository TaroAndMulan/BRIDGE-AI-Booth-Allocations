import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fileEnvironment = loadEnv('production', repositoryRoot, '');
const dataSource = (process.env.VITE_DATA_SOURCE ?? fileEnvironment.VITE_DATA_SOURCE ?? 'excel').trim().toLowerCase();

if (dataSource !== 'mock' && dataSource !== 'excel') {
  throw new Error(`Invalid VITE_DATA_SOURCE "${dataSource}". Use "mock" or "excel".`);
}

if (dataSource === 'excel') {
  const generatedDataPath = path.join(repositoryRoot, 'src/generated/teams.json');
  const teams = JSON.parse(await readFile(generatedDataPath, 'utf8'));

  if (!Array.isArray(teams) || teams.length === 0) {
    throw new Error('Excel data is enabled, but no teams were imported. Run "npm run import:excel" first.');
  }
}

console.log(`Building with the ${dataSource} data source.`);
