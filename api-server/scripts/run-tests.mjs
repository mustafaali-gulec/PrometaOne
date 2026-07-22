#!/usr/bin/env node
// Cross-platform, node-20-uyumlu test kosucusu.
//
// Neden: node'un --test glob genisletmesi yalniz node 21+ surumunde var; node
// 20'de (Dockerfile node:20-alpine) ve npm'in cmd.exe script kabugunda glob
// LITERAL kalir -> "Could not find ...". Burada test dosyalarini
// fs.readdirSync(recursive) ile bulup tsx --test'e acikca veriyoruz; hem node
// 20 hem 22+ hem Windows/Linux'ta ayni tam kumeyi calistirir.
//
// Kullanim: node scripts/run-tests.mjs [suffix]   (ondeger: .test.ts)
//   test:             node scripts/run-tests.mjs .test.ts
//   test:integration: node scripts/run-tests.mjs .itest.ts
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const suffix = process.argv[2] ?? '.test.ts';

const files = readdirSync('src', { recursive: true })
  .map((f) => String(f).replaceAll('\\', '/'))
  .filter((f) => f.endsWith(suffix))
  .map((f) => `src/${f}`)
  .sort();

if (files.length === 0) {
  console.error(`Hic test dosyasi bulunamadi (suffix: ${suffix})`);
  process.exit(1);
}

// shell:true (cmd.exe) 8191 karakter komut sinirina takilir — test dosyasi
// sayisi arttikca liste bu siniri asti ("The syntax of the command is
// incorrect."). node'u dogrudan (kabuksuz) calistirip tsx'i --import ile
// yukluyoruz; CreateProcess siniri ~32k oldugundan liste rahat sigar ve
// davranis tsx --test ile ayni kalir (Linux/CI'da da birebir calisir).
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
