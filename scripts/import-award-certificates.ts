import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Winners' award certificates — separate from the per-team participation
 * certificates in import-certificates.ts. Their source PDFs are named only by a
 * number (Clinical/1.pdf, Popular & Grand/2.pdf), so the file name reveals
 * nothing: the booth is recovered from the PDF's own text instead.
 *
 * Each certificate names the project (matching a team's projectName verbatim),
 * the award ("1st Place" / "Honorable Mention" / "Grand Prize" / "Popular Vote"),
 * and the category/track. We pdftotext each file, read the project title, and
 * match it to a team to get the booth. Two of the Grand Prize winners are also
 * category golds, so a booth can have both a medal certificate and a special one.
 *
 * Output mirrors import-certificates.ts:
 *   public/award-certificates/<id>.pdf            — the medal certificate
 *   public/award-certificates/<id>-<special>.pdf  — grand / popular, when present
 *   src/generated/award-certificates.json         — { id: { medal?, special? } }
 *
 * Both the ~source PDFs and the served copies are gitignored; the build
 * regenerates public/award-certificates/, and the committed manifest is what dev
 * reads. Requires the `pdftotext` binary (poppler-utils) at build time.
 */

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(repositoryRoot, 'data/certificate/PDF_AWARD');
const outputDir = path.join(repositoryRoot, 'public/award-certificates');
const manifestPath = path.join(repositoryRoot, 'src/generated/award-certificates.json');
const teamsPath = path.join(repositoryRoot, 'src/generated/teams.json');
const awardsPath = path.join(repositoryRoot, 'src/generated/awards.json');

type Medal = 'gold' | 'silver' | 'bronze' | 'honorable';
type Special = 'grand' | 'popular';
type Team = { id: string; booth: string; category: string; track: string; projectName: string };
type MedalEntry = { type: Medal; version: string };
type SpecialEntry = { award: Special; version: string };
type AwardCert = { medal?: MedalEntry; special?: SpecialEntry };

const PLACE_TO_MEDAL: Record<string, Medal> = { '1': 'gold', '2': 'silver', '3': 'bronze' };

const normalizeProject = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function findPdfs(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === '__MACOSX' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await findPdfs(full)));
    else if (entry.name.toLowerCase().endsWith('.pdf')) files.push(full);
  }
  return files;
}

/** Read the award kind and the project title out of the certificate's text. */
function parseCertificate(text: string): { award: Medal | Special; project: string } | null {
  const flat = text.replace(/\s+/g, ' ');
  let award: Medal | Special | null = null;
  if (/Grand Prize/i.test(flat)) award = 'grand';
  else if (/Popular Vote/i.test(flat)) award = 'popular';
  else {
    const place = flat.match(/(\d)\s*(?:st|nd|rd|th)?\s*Place/i)?.[1];
    if (place && PLACE_TO_MEDAL[place]) award = PLACE_TO_MEDAL[place];
    else if (/Honorable Mention/i.test(flat)) award = 'honorable';
  }

  const project = flat.match(/For the Project Entitled\s+(.*?)\s+Category\b/i)?.[1]?.trim();
  if (!award || !project) return null;
  return { award, project };
}

function isSpecial(award: Medal | Special): award is Special {
  return award === 'grand' || award === 'popular';
}

async function main() {
  const pdfs = await findPdfs(sourceDir);

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });

  if (pdfs.length === 0) {
    await writeFile(manifestPath, '{}\n', 'utf8');
    console.warn(
      `Warning: no award certificates found under ${path.relative(repositoryRoot, sourceDir)}. ` +
      'Wrote an empty manifest; award download buttons will be hidden.',
    );
    return;
  }

  // Fail early with a clear message rather than a cryptic spawn error per file.
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
  } catch {
    throw new Error('Award-certificate import needs the `pdftotext` binary (install poppler-utils).');
  }

  const teams = JSON.parse(await readFile(teamsPath, 'utf8')) as Team[];
  const teamByProject = new Map(teams.map((team) => [normalizeProject(team.projectName), team]));

  const manifest: Record<string, AwardCert> = {};
  const errors: string[] = [];

  for (const file of pdfs.sort()) {
    const rel = path.relative(sourceDir, file);
    const text = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' });
    const parsed = parseCertificate(text);
    if (!parsed) {
      errors.push(`${rel}: could not read the award and project title from the certificate text.`);
      continue;
    }

    const team = teamByProject.get(normalizeProject(parsed.project));
    if (!team) {
      errors.push(`${rel}: project "${parsed.project}" matches no team in teams.json.`);
      continue;
    }

    const buffer = await readFile(file);
    const version = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 8);
    const cert = (manifest[team.id] ??= {});

    if (isSpecial(parsed.award)) {
      if (cert.special) {
        errors.push(`${rel}: ${team.booth} already has a ${cert.special.award} certificate.`);
        continue;
      }
      cert.special = { award: parsed.award, version };
      await writeFile(path.join(outputDir, `${team.id}-${parsed.award}.pdf`), buffer);
    } else {
      if (cert.medal) {
        errors.push(`${rel}: ${team.booth} already has a ${cert.medal.type} medal certificate.`);
        continue;
      }
      cert.medal = { type: parsed.award, version };
      await writeFile(path.join(outputDir, `${team.id}.pdf`), buffer);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Award-certificate import failed:\n- ${errors.join('\n- ')}`);
  }

  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((id) => [id, manifest[id]]),
  );
  await writeFile(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

  // Cross-check against the medal board so gaps and stray winners surface at build.
  try {
    const board = JSON.parse(await readFile(awardsPath, 'utf8')) as { booth: string; medal: Medal }[];
    const medalById = new Map(board.map((row) => [row.booth.toLowerCase(), row.medal]));
    for (const [booth, medal] of medalById) {
      if (!manifest[booth]?.medal) {
        console.warn(`Warning: ${booth.toUpperCase()} is a ${medal} on the board but has no medal certificate.`);
      }
    }
    for (const [id, cert] of Object.entries(manifest)) {
      if (cert.medal && medalById.get(id) && medalById.get(id) !== cert.medal.type) {
        console.warn(`Warning: ${id.toUpperCase()} certificate says ${cert.medal.type}, board says ${medalById.get(id)}.`);
      }
      if (cert.special && !medalById.has(id)) {
        console.warn(`Warning: ${id.toUpperCase()} won ${cert.special.award} but is not on the medal board, so it won't appear.`);
      }
    }
  } catch {
    /* awards.json not present — skip the cross-check. */
  }

  const specials = Object.values(manifest).filter((c) => c.special).length;
  const medals = Object.values(manifest).filter((c) => c.medal).length;
  console.log(
    `Copied ${pdfs.length} award certificates (${medals} medal, ${specials} special) to ` +
    `${path.relative(repositoryRoot, outputDir)}/ and wrote ${path.relative(repositoryRoot, manifestPath)}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
