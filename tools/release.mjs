#!/usr/bin/env node
/**
 * Prometa One / M Suite — surum kesme araci.
 *
 * POLITIKA (docs/RELEASE.md):
 *   • Tek urun surumu. Kok package.json kaynak-of-truth; frontend, api-server ve
 *     construction-service ayni numarayi tasir (UI rozeti frontend/package.json'dan okur).
 *   • Bump master'a her merge'de DEGIL, surum kesildiginde olur.
 *   • Bump son v* tag'inden beri gelen Conventional Commit'lerden turetilir:
 *       BREAKING CHANGE / type!  -> major
 *       feat                     -> minor
 *       fix, perf                -> patch
 *       digerleri (docs, chore…) -> tek basina kalirsa patch
 *
 * KULLANIM:
 *   node tools/release.mjs                 # KURU CALISMA — ne yapacagini yazar, dosyaya dokunmaz
 *   node tools/release.mjs --yes           # uygular: package.json'lar + CHANGELOG + commit + tag
 *   node tools/release.mjs --yes --push    # ayrica origin'e commit + tag push eder
 *   node tools/release.mjs --minor         # otomatik bump'i ez
 *   node tools/release.mjs --set 3.0.0     # surumu dogrudan belirle
 *   node tools/release.mjs --baseline      # ilk kez: mevcut surumu commit'siz sadece tag'ler
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Surumu tasiyan tum manifest'ler — hepsi ayni numarada tutulur. */
const MANIFESTS = [
  'package.json',
  'frontend/package.json',
  'api-server/package.json',
  'construction-service/package.json',
];

const CHANGELOG = 'CHANGELOG.md';

/* ------------------------------------------------------------------ yardimcilar */

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/** Var-yok yoklamalari icin: hata bekleniyor, git'in stderr'i kullaniciya sizmasin. */
const gitQuiet = (...args) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

/** package.json'i 2 boslukla + sondaki yeni satirla yazar (prettier ile ayni bicim). */
const writeJson = (rel, obj) =>
  writeFileSync(join(ROOT, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8');

const die = (msg) => {
  console.error('HATA: ' + msg);
  process.exit(1);
};

/* ------------------------------------------------------------------ argumanlar */

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const APPLY = has('--yes');
const PUSH = has('--push');
const BASELINE = has('--baseline');
const setIdx = argv.indexOf('--set');
const EXPLICIT = setIdx >= 0 ? argv[setIdx + 1] : null;
const FORCED = ['major', 'minor', 'patch'].find((b) => has('--' + b)) || null;

if (EXPLICIT && !/^\d+\.\d+\.\d+$/.test(EXPLICIT)) die('--set X.Y.Z biciminde olmali: ' + EXPLICIT);

/* ------------------------------------------------------------------ mevcut durum */

const current = readJson('package.json').version;

let lastTag = null;
try {
  lastTag = gitQuiet('describe', '--tags', '--match', 'v*', '--abbrev=0');
} catch {
  /* henuz surum tag'i yok */
}

/* ------------------------------------------------------------------ commit analizi */

const SEP = '\x1e'; // kayit ayiraci
const FIELD = '\x1f'; // alan ayiraci
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const raw = execFileSync(
  'git',
  ['log', range, `--format=%H${FIELD}%s${FIELD}%b${SEP}`, '--no-merges'],
  {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  },
);

const commits = raw
  .split(SEP)
  .map((c) => c.trim())
  .filter(Boolean)
  .map((c) => {
    const [sha, subject, body = ''] = c.split(FIELD);
    const m = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/.exec(subject.trim());
    return {
      sha: sha.slice(0, 7),
      subject: subject.trim(),
      type: m ? m[1] : null,
      scope: m ? m[2] || null : null,
      bang: !!(m && m[3]),
      description: m ? m[4] : subject.trim(),
      breaking: !!(m && m[3]) || /^BREAKING[ -]CHANGE:/m.test(body),
    };
  });

const bumpFromCommits = () => {
  if (commits.some((c) => c.breaking)) return 'major';
  if (commits.some((c) => c.type === 'feat')) return 'minor';
  if (commits.some((c) => c.type === 'fix' || c.type === 'perf')) return 'patch';
  return commits.length ? 'patch' : null;
};

const bump = FORCED || (EXPLICIT ? null : bumpFromCommits());

const nextVersion = () => {
  if (EXPLICIT) return EXPLICIT;
  if (!bump) return null;
  const [ma, mi, pa] = current.split('.').map(Number);
  if (bump === 'major') return `${ma + 1}.0.0`;
  if (bump === 'minor') return `${ma}.${mi + 1}.0`;
  return `${ma}.${mi}.${pa + 1}`;
};

const next = BASELINE ? current : nextVersion();

/* ------------------------------------------------------------------ CHANGELOG uretimi */

const SECTIONS = [
  { title: 'Breaking', match: (c) => c.breaking },
  { title: 'Added', match: (c) => c.type === 'feat' },
  { title: 'Fixed', match: (c) => c.type === 'fix' },
  {
    title: 'Changed',
    match: (c) => ['refactor', 'perf', 'style', 'build', 'ci', 'chore'].includes(c.type),
  },
  { title: 'Docs', match: (c) => c.type === 'docs' },
];

const bullet = (c) => `- ${c.scope ? `**${c.scope}:** ` : ''}${c.description} (${c.sha})`;

const buildSection = (version, dateStr) => {
  const used = new Set();
  const parts = [`## [${version}] — ${dateStr}`, ''];
  for (const s of SECTIONS) {
    const list = commits.filter((c) => !used.has(c.sha) && s.match(c));
    if (!list.length) continue;
    list.forEach((c) => used.add(c.sha));
    parts.push(`### ${s.title}`, '', ...list.map(bullet), '');
  }
  const rest = commits.filter((c) => !used.has(c.sha));
  if (rest.length) parts.push('### Other', '', ...rest.map((c) => `- ${c.subject} (${c.sha})`), '');
  return parts.join('\n');
};

/** Yeni surum bolumunu [Unreleased] basliginin hemen ALTINA yerlestirir. */
const insertIntoChangelog = (section) => {
  const path = join(ROOT, CHANGELOG);
  const text = readFileSync(path, 'utf8');
  const m = /^## \[Unreleased\].*$/m.exec(text);
  if (!m) die(`${CHANGELOG} icinde "## [Unreleased]" basligi bulunamadi.`);
  const at = m.index + m[0].length;
  const updated = text.slice(0, at) + '\n\n' + section.trimEnd() + '\n' + text.slice(at);
  writeFileSync(path, updated, 'utf8');
};

/* ------------------------------------------------------------------ rapor */

const today = new Date().toISOString().slice(0, 10);

console.log('');
console.log('  Mevcut surum : ' + current);
console.log('  Son tag      : ' + (lastTag || '(yok — tum gecmis taraniyor)'));
console.log('  Commit sayisi: ' + commits.length);
console.log('  Bump         : ' + (BASELINE ? '(baseline — bump yok)' : bump || '(commit yok)'));
console.log('  Yeni surum   : ' + (next || '(hesaplanamadi)'));
console.log('');

if (commits.length) {
  const counts = {};
  commits.forEach((c) => (counts[c.type || 'other'] = (counts[c.type || 'other'] || 0) + 1));
  console.log(
    '  Commit tipleri: ' +
      Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join('  '),
  );
  const brk = commits.filter((c) => c.breaking);
  if (brk.length) console.log('  BREAKING: ' + brk.map((c) => c.sha).join(', '));
  console.log('');
}

if (!next) die("Kesilecek bir sey yok — son tag'den beri commit gelmemis.");
if (next === current && !BASELINE) die('Yeni surum mevcutla ayni: ' + next);

const tag = 'v' + next;
let tagExists = false;
try {
  gitQuiet('rev-parse', '--verify', 'refs/tags/' + tag);
  tagExists = true;
} catch {
  /* tag yok — beklenen */
}
if (tagExists) die(`${tag} tag'i zaten var.`);

if (!APPLY) {
  console.log('  --- KURU CALISMA (hicbir dosya degismedi) ---');
  console.log('  Guncellenecek: ' + MANIFESTS.join(', ') + ` -> ${next}`);
  if (!BASELINE) {
    console.log('  CHANGELOG bolumu:\n');
    console.log(
      buildSection(next, today)
        .split('\n')
        .map((l) => '    ' + l)
        .join('\n'),
    );
  }
  console.log(`\n  Uygulamak icin: node tools/release.mjs --yes${PUSH ? ' --push' : ''}\n`);
  process.exit(0);
}

/* ------------------------------------------------------------------ uygula */

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== 'master' && branch !== 'main')
  die(`Surum yalnizca master'dan kesilir (su an: ${branch}).`);
if (git('status', '--porcelain')) die('Calisma agaci temiz degil — once commit/stash edin.');

if (BASELINE) {
  git('tag', '-a', tag, '-m', `${tag} — baseline`);
  console.log(`  ${tag} tag'i olusturuldu (baseline, commit yok).`);
} else {
  for (const rel of MANIFESTS) {
    const pkg = readJson(rel);
    pkg.version = next;
    writeJson(rel, pkg);
  }
  insertIntoChangelog(buildSection(next, today));
  git('add', ...MANIFESTS, CHANGELOG);
  git('commit', '-m', `chore(release): ${tag}`);
  git('tag', '-a', tag, '-m', `${tag}`);
  console.log(
    `  ${MANIFESTS.length} manifest + CHANGELOG guncellendi, commit + ${tag} tag'i olusturuldu.`,
  );
}

if (PUSH) {
  git('push', 'origin', 'HEAD');
  git('push', 'origin', tag);
  console.log(
    `  origin'e push edildi. GitHub Release'i .github/workflows/release.yml olusturacak.`,
  );
} else {
  console.log(`  Push icin: git push origin HEAD && git push origin ${tag}`);
}
console.log('');
