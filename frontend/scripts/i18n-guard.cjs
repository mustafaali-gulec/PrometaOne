#!/usr/bin/env node
/**
 * Prometa One — i18n Guard (Dil Ajanı koruması)
 * ------------------------------------------------------------------
 * Pre-commit'te (lint-staged) çalışır. Staged frontend kodunda YENİ EKLENEN
 * satırlarda çok-dilli olmayan kalıpları yakalar ve commit'i durdurur:
 *   • İkili dil ternary'si:  lang === "en" ? "EN" : "TR"   (de/ar yok)
 *   • 2-dilli etiket nesnesi: { tr: "...", en: "..." }      (de/ar yok)
 * Çözüm: 4-dilli yap (TR/EN/DE/AR) — t()/I18N_DICT, 4-dilli inline ternary,
 * ya da { tr, en, de, ar }. Bilinçli istisna için satıra `i18n-ignore` ekle.
 *
 * Yalnız frontend/src altındaki .js/.jsx/.ts/.tsx dosyalarını ve yalnız
 * git diff --cached'deki EKLENEN ('+') satırları denetler (mevcut kod muaf).
 */
/* global process, console */
const { execSync } = require('child_process');

const files = process.argv
  .slice(2)
  .filter((f) => /frontend[\\/]src[\\/].*\.(jsx?|tsx?|mjs|cjs)$/.test(f));
if (files.length === 0) process.exit(0);

// İkili (4-yollu olmayan) lang ternary: ":" dalı bir literal (lang=== değil)
const reBinaryTernary =
  /lang\s*===\s*"en"\s*\?\s*(?:"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*')\s*:\s*(?:"|`|')/;
// Tam olarak { tr: "...", en: "..." } (de/ar yok)
const reTwoLangObj = /\{\s*tr:\s*"(?:[^"\\]|\\.)*",\s*en:\s*"(?:[^"\\]|\\.)*"\s*\}/;

const violations = [];
for (const file of files) {
  let diff = '';
  try {
    diff = execSync(`git diff --cached --unified=0 -- "${file}"`, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    continue; // diff alınamazsa atla
  }
  let curLine = 0;
  for (const raw of diff.split('\n')) {
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      curLine = parseInt(hunk[1], 10);
      continue;
    }
    if (raw.startsWith('+++')) continue;
    if (raw.startsWith('+')) {
      const line = raw.slice(1);
      const trimmed = line.trim();
      const skip =
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*') ||
        line.includes('i18n-ignore');
      if (!skip) {
        if (reBinaryTernary.test(line))
          violations.push({
            file,
            line: curLine,
            kind: 'ikili lang ternary (de/ar yok)',
            text: trimmed.slice(0, 120),
          });
        else if (reTwoLangObj.test(line))
          violations.push({
            file,
            line: curLine,
            kind: '2-dilli {tr,en} nesnesi (de/ar yok)',
            text: trimmed.slice(0, 120),
          });
      }
      curLine++;
    } else if (!raw.startsWith('-')) {
      curLine++;
    }
  }
}

if (violations.length) {
  const RED = '\x1b[31m',
    YEL = '\x1b[33m',
    DIM = '\x1b[2m',
    RST = '\x1b[0m',
    B = '\x1b[1m';
  console.error(
    `\n${RED}${B}✖ i18n Guard — çok-dilli olmayan kod eklendi (Dil Ajanı kuralı)${RST}`,
  );
  console.error(
    `${DIM}Her kullanıcı-görünür metin TR/EN/DE/AR olmalı. Aşağıdaki yeni satırları düzelt:${RST}\n`,
  );
  for (const v of violations) {
    console.error(`  ${YEL}${v.file}:${v.line}${RST}  ${v.kind}`);
    console.error(`    ${DIM}${v.text}${RST}`);
  }
  console.error(`\n${B}Çözüm:${RST} 4-dilli yap →`);
  console.error(
    `  • ${DIM}lang === "en" ? EN : lang === "de" ? DE : lang === "ar" ? AR : TR${RST}`,
  );
  console.error(
    `  • ${DIM}{ tr, en, de, ar }${RST}  ya da  ${DIM}t("key", lang)${RST} + I18N_DICT (4 dil)`,
  );
  console.error(
    `${DIM}Bilinçli istisna (özel ad/HTML export) için satıra "i18n-ignore" yorumu ekle.${RST}\n`,
  );
  process.exit(1);
}
process.exit(0);
