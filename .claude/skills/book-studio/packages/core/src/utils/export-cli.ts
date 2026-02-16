#!/usr/bin/env node
/**
 * Bookmotion PDF Export CLI
 *
 * Usage (from a book project directory):
 *   npx ts-node node_modules/@bookmotion/core/src/utils/export-cli.ts
 *
 * Or add to package.json scripts:
 *   "render:pdf": "ts-node ./scripts/export-pdf.ts"
 *
 * This script:
 * 1. Reads book.config.ts from the current directory
 * 2. Starts or connects to the Vite dev server
 * 3. Exports all pages to a single PDF
 * 4. Validates against KDP requirements
 * 5. Generates a cover template PDF
 */

import { exportToPDF, type PDFExportOptions } from './export-pdf.js';
import type { BookConfig } from '../types.js';

async function main() {
  console.log('');
  console.log('📚 Bookmotion PDF Export');
  console.log('========================');
  console.log('');

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1] || 'true';
      i++;
    }
  }

  const devServerUrl = flags['url'] || flags['server'] || 'http://localhost:5173';
  const outputPath = flags['output'] || flags['o'] || 'output/book-interior.pdf';
  const dpi = parseInt(flags['dpi'] || '300', 10);
  const cropMarks = flags['crop-marks'] === 'true';
  const noCover = flags['no-cover'] === 'true';
  const paperType = (flags['paper'] || 'white') as 'white' | 'cream';

  // Try to load book config
  let config: BookConfig;
  try {
    const configModule = await import(`${process.cwd()}/book.config.ts`);
    config = configModule.config || configModule.default;
  } catch {
    try {
      const configModule = await import(`${process.cwd()}/book.config.js`);
      config = configModule.config || configModule.default;
    } catch {
      console.error('❌ Could not load book.config.ts or book.config.js');
      console.error('   Make sure you are in the book project directory.');
      process.exit(1);
    }
  }

  console.log(`📖 Book: ${config.title} by ${config.author}`);
  console.log(`📐 Size: ${config.dimensions.width}" × ${config.dimensions.height}"`);
  console.log(`📏 Bleed: ${config.bleed || 0}"`);
  console.log(`🖨️  DPI: ${dpi}`);
  console.log(`🌐 Dev server: ${devServerUrl}`);
  console.log(`📄 Output: ${outputPath}`);
  console.log('');

  const options: PDFExportOptions = {
    devServerUrl,
    outputPath,
    dpi,
    cropMarks,
    generateCover: !noCover,
    paperType,
    onProgress: (current, total, status) => {
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      process.stdout.write(`\r  [${bar}] ${pct}% ${status}`);
      if (current === total) process.stdout.write('\n');
    },
  };

  console.log('🚀 Starting export...');
  console.log('');

  const result = await exportToPDF(config, options);

  console.log('');

  if (result.success) {
    console.log('✅ Export complete!');
    console.log(`   Interior: ${result.interiorPath} (${result.pageCount} pages)`);
    if (result.coverPath) {
      console.log(`   Cover:    ${result.coverPath}`);
    }

    // Show KDP validation
    if (result.kdpValidation) {
      console.log('');
      if (result.kdpValidation.valid) {
        console.log('✅ KDP Validation: PASSED');
      } else {
        console.log('❌ KDP Validation: FAILED');
        result.kdpValidation.errors.forEach(e => console.log(`   ❌ ${e}`));
      }

      if (result.warnings.length > 0) {
        console.log('');
        console.log('⚠️  Warnings:');
        result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
      }

      if (result.kdpValidation.coverDimensions) {
        const cd = result.kdpValidation.coverDimensions;
        console.log('');
        console.log('📐 KDP Cover Dimensions:');
        console.log(`   Total: ${cd.totalWidth}" × ${cd.totalHeight}"`);
        console.log(`   Spine width: ${cd.spineWidth}"`);
        console.log(`   Front/Back: ${cd.frontWidth}" × ${cd.trimHeight}"`);
        console.log(`   Bleed: ${cd.bleed}" on all sides`);
      }
    }
  } else {
    console.log('❌ Export failed:');
    result.errors.forEach(e => console.log(`   ❌ ${e}`));
    process.exit(1);
  }

  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
