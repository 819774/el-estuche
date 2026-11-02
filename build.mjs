// Construye la web en dist/. Lee SUPABASE_URL, SUPABASE_KEY y TEAM_EMAIL del
// entorno o de .env. Sin ellos, la app arranca en modo demostración.
import { build, context } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const serve = args.includes('--serve');
const single = args.includes('--single'); // un solo HTML con todo dentro

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const env = (name) => JSON.stringify((process.env[name] || '').trim());

const options = {
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: !serve,
  sourcemap: serve,
  format: 'esm',
  target: 'es2020',
  jsx: 'automatic',
  outfile: 'dist/app.js',
  define: {
    __SUPABASE_URL__: env('SUPABASE_URL'),
    __SUPABASE_KEY__: env('SUPABASE_KEY'),
    __TEAM_EMAIL__: env('TEAM_EMAIL'),
    'process.env.NODE_ENV': serve ? '"development"' : '"production"',
  },
  alias: process.env.SUPABASE_STUB ? { '@supabase/supabase-js': process.env.SUPABASE_STUB } : {},
  logLevel: 'info',
};

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });

const stamp = Date.now();
let html = readFileSync('src/index.html', 'utf8');

if (serve) {
  writeFileSync('dist/index.html', html.replaceAll('__V__', stamp));
  const ctx = await context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 5173 });
  console.log(`Abierto en http://localhost:${port}`);
} else {
  await build(options);
  if (single) {
    const js = readFileSync('dist/app.js', 'utf8').replace(/<\/script/g, '<\\/script');
    const css = readFileSync('dist/app.css', 'utf8');
    html = html
      .replace(/\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>/g, '')
      .replace(/<link rel="stylesheet" href="app\.css[^>]*>/, () => `<style>${css}</style>`)
      .replace(/<script type="module" src="app\.js[^>]*><\/script>/, () => `<script type="module">${js}</script>`);
    writeFileSync('dist/single.html', html);
  } else {
    writeFileSync('dist/index.html', html.replaceAll('__V__', stamp));
  }
}
