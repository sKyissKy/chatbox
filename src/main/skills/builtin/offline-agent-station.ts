import type { SkillMetadata } from '../../../shared/types/skills'

export const metadata: SkillMetadata = {
  name: 'offline-agent-station',
  description:
    'Offline full-featured agent workstation runtime reference. Details all preinstalled Python 3.8, Node.js 16, Chromium 90, and FFmpeg environments, packages, CLI commands, and execution patterns for Windows 7.',
}

export const body = `# Offline Agent Workstation Reference (Windows 7 Edition)

This system is an all-in-one **Offline Autonomous Agent Workstation** tailored for Windows 7. All critical development, office, automation, and multimedia toolchains are completely preinstalled and ready to use without any internet connection.

## Complete Runtime Overview

### 1. Python 3.8.10 (64-bit Portable)
- **Executable**: \`python.exe\`, \`pip.exe\`
- **Preinstalled Packages**:
  - **Data & Math**: \`numpy==1.24.4\`, \`pandas==1.5.3\`, \`matplotlib==3.7.5\`
  - **Office Documents**: \`openpyxl\`, \`xlsxwriter\`, \`python-docx\`, \`python-pptx\`, \`pypdf\`, \`pdfplumber\`
  - **Images & Media**: \`Pillow==9.5.0\`, \`qrcode\`
  - **Web & Scraping**: \`requests\`, \`urllib3\`, \`beautifulsoup4\`, \`lxml\`, \`chardet\`
  - **Config & Formats**: \`PyYAML\`, \`toml\`

### 2. Node.js 16.20.2 LTS
- **Executable**: \`node.exe\`, \`npm.cmd\`, \`npx.cmd\`, \`tsx.cmd\`
- **Preinstalled Global & Runtime Packages**:
  - \`tsx@3.14.0\`: Execute TypeScript directly with zero compilation step (\`tsx script.ts\`).
  - \`playwright-core@1.35.1\`: Headless browser control.
  - \`typescript@5.3.3\` & \`prettier@2.8.8\`
  - \`xlsx@0.18.5\` (SheetJS), \`axios@1.6.8\`, \`cheerio@1.0.0-rc.12\`, \`lodash@4.17.21\`, \`dayjs@1.11.10\`

### 3. Chromium 90 Portable Engine
- **Executable**: Embedded under \`runtime/browser/chrome.exe\`
- **Environment**: Automatically exported as \`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH\` and \`CHROME_PATH\`.

### 4. Multimedia & Utilities
- **FFmpeg 6.0 & FFprobe**: Full static binaries in \`PATH\` for video/audio conversion, compression, and analysis.
- **VC++ Redistributables**: Runtime DLLs bundled.

### 5. MinGit (Windows 7 Edition)
- **Executable**: \`git.exe\` in \`PATH\`
- **Purpose**: Local autonomous version tracking, change snapshots, and automated rollback before and after agent modifications.

---

## Autonomous Package Expansion

If a user requests an additional library not already present, you can install it into the user-writable persistent directory (\`%APPDATA%\\Chatbox\\agent_env\`):

- **Python**: \`python -m pip install <package_name> --user\`
- **Node.js**: \`npm install <package_name>\`
`