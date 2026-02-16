/**
 * Export the Agora Almanac to PDF
 *
 * Usage:
 *   1. Start the dev server: npm run dev
 *   2. In another terminal: npx tsx scripts/export-pdf.ts
 *
 * Options:
 *   --url http://localhost:3001    Dev server URL
 *   --output output/book.pdf      Output file path
 *   --dpi 300                     DPI (default 300)
 *   --crop-marks true             Add crop marks
 *   --no-cover true               Skip cover template generation
 */

import { config } from '../book.config';

// Dynamic import to get the types right
async function main() {
  // We need puppeteer and pdf-lib installed
  console.log('');
  console.log('📚 Agora Almanac PDF Export');
  console.log('===========================');
  console.log('');
  console.log(`📖 ${config.title} by ${config.author}`);
  console.log(`📐 ${config.dimensions.width}" × ${config.dimensions.height}"`);
  console.log('');

  // Check for puppeteer
  try {
    await import('puppeteer');
  } catch {
    console.error('❌ puppeteer is not installed.');
    console.error('   Run: npm install -D puppeteer pdf-lib');
    process.exit(1);
  }

  try {
    await import('pdf-lib');
  } catch {
    console.error('❌ pdf-lib is not installed.');
    console.error('   Run: npm install -D pdf-lib');
    process.exit(1);
  }

  // Import our export function — since this is a local demo, we import from the core package
  // In production, this would be from @bookmotion/core
  const { exportToPDF } = await import('../../../packages/core/src/utils/export-pdf');

  const devServerUrl = process.argv.includes('--url')
    ? process.argv[process.argv.indexOf('--url') + 1]
    : 'http://localhost:3001';

  const outputPath = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : 'output/agora-almanac-interior.pdf';

  console.log(`🌐 Connecting to: ${devServerUrl}`);
  console.log(`📄 Output: ${outputPath}`);
  console.log('');

  const result = await exportToPDF(config, {
    devServerUrl,
    outputPath,
    dpi: 300,
    generateCover: true,
    cropMarks: process.argv.includes('--crop-marks'),
    onProgress: (current, total, status) => {
      console.log(`  [${current}/${total}] ${status}`);
    },
  });

  console.log('');

  if (result.success) {
    console.log('✅ Export complete!');
    console.log(`   Interior: ${result.interiorPath} (${result.pageCount} pages)`);
    if (result.coverPath) {
      console.log(`   Cover template: ${result.coverPath}`);
    }

    if (result.kdpValidation) {
      console.log('');
      console.log(result.kdpValidation.valid ? '✅ KDP: PASSED' : '❌ KDP: ISSUES FOUND');
      result.kdpValidation.errors.forEach(e => console.log(`   ❌ ${e}`));
      result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));

      if (result.kdpValidation.coverDimensions) {
        const cd = result.kdpValidation.coverDimensions;
        console.log('');
        console.log(`📐 Cover: ${cd.totalWidth}" × ${cd.totalHeight}" (spine: ${cd.spineWidth}")`);
      }
    }
  } else {
    console.log('❌ Export failed:');
    result.errors.forEach(e => console.log(`   ${e}`));
  }

  console.log('');
}

main().catch(console.error);
