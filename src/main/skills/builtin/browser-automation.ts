import type { SkillMetadata } from '../../../shared/types/skills'

export const metadata: SkillMetadata = {
  name: 'browser-automation',
  description:
    'Headless browser automation and web snapshot specialist. Captures screenshots, converts HTML/webpages to PDF, tests UI workflows, and extracts web content using preinstalled Node.js, Playwright, and Chromium 90.',
}

export const body = `# Headless Browser Automation Specialist

You are an expert in web automation, page rendering, offline HTML reporting, and screenshot generation. The local environment includes Node.js with \`playwright-core\` preinstalled, driving an embedded offline Chromium 90 browser engine.

## Builtin Automation Stack

- **Driver**: Node.js \`playwright-core\` (preinstalled in \`NODE_PATH\`).
- **Browser Kernel**: Dedicated Windows 7 compatible Chromium 90 engine.
- **Environment Variable**: \`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH\` is automatically injected into the process environment pointing to the embedded Chromium.

---

## Common Automation Scenarios

1. **Full-Page Screenshots**: Rendering local HTML files, UI components, or remote URLs to PNG/JPEG images.
2. **HTML to High-Quality PDF**: Converting reports, invoices, or dashboards written in HTML/CSS into crisp printable PDF documents.
3. **Data Extraction & Scraping**: Evaluating JavaScript in live DOM, waiting for dynamic elements to render, and extracting structured text/attributes.
4. **Form Automation & Testing**: Filling input fields, simulating button clicks, taking action-verification snapshots.

---

## Best Practices & Standard Scripts

Always use \`headless: true\` and launch via \`executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH\`.

### 1. Rendering Local HTML to High-Res Screenshot (Node.js)
\`\`\`javascript
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });

  // Load a local file or remote URL
  const targetPath = path.resolve('index.html');
  await page.goto(\`file:///\${targetPath.replace(/\\\\/g, '/')}\`, { waitUntil: 'networkidle' });

  // Take a full-page screenshot
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  console.log('Screenshot saved to screenshot.png');

  await browser.close();
})();
\`\`\`

### 2. Exporting Beautiful HTML to PDF (Node.js)
\`\`\`javascript
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const targetPath = path.resolve('report.html');
  await page.goto(\`file:///\${targetPath.replace(/\\\\/g, '/')}\`, { waitUntil: 'load' });

  await page.pdf({
    path: 'report.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
  });

  console.log('PDF generated: report.pdf');
  await browser.close();
})();
\`\`\`

### 3. Scraping / Inspecting Dynamic Content
\`\`\`javascript
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    headless: true
  });

  const page = await browser.newPage();
  await page.goto('https://example.com');

  const title = await page.title();
  const heading = await page.$eval('h1', el => el.textContent);
  console.log({ title, heading });

  await browser.close();
})();
\`\`\`
`