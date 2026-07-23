import crypto from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Certificates arrive as one PDF per booth, sorted into folders by category:
 *
 *   data/certificate/PDF/Medical Education/Bridge Certificate Medical Education_A01.pdf
 *   data/certificate/PDF/Digital Technology/Bridge Certificate Digital Technology 2_C26.pdf
 *
 * The booth suffix at the end of the file name (A01, C26, …) is the only part
 * that matters: prefix it with "BAI-" and you have the team's booth. The folder
 * and the trailing " 1"/" 2" batch label are decorative and ignored.
 *
 * This copies each file to public/certificates/<id>.pdf (id = "bai-c26"), which
 * gives space-free, predictable URLs the app can build straight from team.id, and
 * lets the site serve them as plain static files — vite build folds public/ into
 * dist/, and deploy.sh scp's dist/* to the server, so nothing else has to change.
 *
 * It also writes src/generated/certificates.json, a { id: version } manifest. The
 * version is a short hash of the bytes; the app appends it as ?v= so a replaced
 * certificate busts the browser cache (public/ URLs are otherwise stable). A team
 * with no entry simply shows no download button.
 *
 * The 51 MB of source PDFs and the served copies are both gitignored; this script
 * regenerates public/certificates/ on every build, so the committed manifest is
 * what dev (npm run dev, which does not build) reads. If the source folder is
 * missing the build still succeeds with an empty manifest — the machine that has
 * the PDFs is the one that deploys.
 */

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(repositoryRoot, 'data/certificate/PDF');
const outputDir = path.join(repositoryRoot, 'public/certificates');
const manifestPath = path.join(repositoryRoot, 'src/generated/certificates.json');
const teamsPath = path.join(repositoryRoot, 'src/generated/teams.json');

const BOOTH_SUFFIX = /_([A-D]\d+)\.pdf$/i;

async function findPdfs(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    // Skip the macOS archive junk (__MACOSX, .DS_Store, ._resource-fork files).
    if (entry.name === '__MACOSX' || entry.name.startsWith('.') || entry.name.startsWith('._')) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findPdfs(full)));
    } else if (entry.name.toLowerCase().endsWith('.pdf')) {
      files.push(full);
    }
  }
  return files;
}

async function teamBooths(): Promise<Set<string> | null> {
  try {
    const teams = JSON.parse(await readFile(teamsPath, 'utf8')) as { id: string }[];
    return new Set(teams.map((team) => team.id));
  } catch {
    return null; // teams.json not generated yet — skip the cross-check.
  }
}

async function main() {
  const pdfs = await findPdfs(sourceDir);

  // Start from a clean folder so a renamed or removed source file never leaves a
  // stale certificate behind for the site to serve.
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });

  if (pdfs.length === 0) {
    await writeFile(manifestPath, '{}\n', 'utf8');
    console.warn(
      `Warning: no certificates found under ${path.relative(repositoryRoot, sourceDir)}. ` +
      'Wrote an empty manifest; download buttons will be hidden.',
    );
    return;
  }

  const manifest: Record<string, string> = {};
  const errors: string[] = [];

  for (const file of pdfs) {
    const suffix = file.match(BOOTH_SUFFIX)?.[1];
    if (!suffix) {
      errors.push(`Cannot read a booth suffix (e.g. _A01) from "${path.basename(file)}".`);
      continue;
    }

    const id = `bai-${suffix.toLowerCase()}`;
    if (manifest[id]) {
      errors.push(`Booth ${id.toUpperCase()} has more than one certificate file.`);
      continue;
    }

    const buffer = await readFile(file);
    manifest[id] = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 8);
    await copyFile(file, path.join(outputDir, `${id}.pdf`));
  }

  if (errors.length > 0) {
    throw new Error(`Certificate import failed:\n- ${errors.join('\n- ')}`);
  }

  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((id) => [id, manifest[id]]),
  );
  await writeFile(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

  // Cross-check against the imported teams so a mismatch surfaces at build time.
  const booths = await teamBooths();
  if (booths) {
    const missing = [...booths].filter((id) => !manifest[id]).sort();
    const orphan = Object.keys(manifest).filter((id) => !booths.has(id)).sort();
    for (const id of missing) console.warn(`Warning: team ${id.toUpperCase()} has no certificate.`);
    for (const id of orphan) console.warn(`Warning: certificate ${id.toUpperCase()} matches no team.`);
  }

  console.log(
    `Copied ${Object.keys(manifest).length} certificates to ${path.relative(repositoryRoot, outputDir)}/ ` +
    `and wrote ${path.relative(repositoryRoot, manifestPath)}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
