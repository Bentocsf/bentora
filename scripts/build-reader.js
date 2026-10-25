const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const outputDirectory = path.join(__dirname, '..', 'assets', 'reader');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.copyFileSync(
  path.resolve(path.dirname(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')), '..', '..', 'LICENSE'),
  path.join(outputDirectory, 'PDFJS-LICENSE.txt')
);
fs.copyFileSync(
  path.resolve(path.dirname(require.resolve('epubjs')), '..', 'LICENSE'),
  path.join(outputDirectory, 'EPUBJS-LICENSE.txt')
);

async function build() {
  await esbuild.build({
    stdin: {
      contents: `import ePub from 'epubjs';\nimport * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';\nwindow.BentoraReader = { ePub, pdfjsLib };`,
      resolveDir: path.join(__dirname, '..'),
      sourcefile: 'bentora-reader-entry.js',
      loader: 'js',
    },
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2020'],
    outfile: path.join(outputDirectory, 'reader-runtime.html'),
  });

  await esbuild.build({
    entryPoints: [require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')],
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'esm',
    target: ['es2020'],
    outfile: path.join(outputDirectory, 'pdf-worker.html'),
  });
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
