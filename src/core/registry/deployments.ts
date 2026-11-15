export type DeploymentTargetId =
  | 'desktop-electron'
  | 'android-app'
  | 'license-server';

export interface DeploymentEnvVar {
  name: string;
  scope: 'server' | 'client';
  required: boolean;
  description: string;
  example: string;
}

export interface DeploymentCommandStep {
  title: string;
  command: string;
  note?: string;
}

export interface DeploymentTarget {
  id: DeploymentTargetId;
  name: string;
  shortLabel: string;
  category: string;
  runtime: string;
  scalingProfile: string;
  configFiles: string[];
  summary: string;
  highlights: string[];
  steps: DeploymentCommandStep[];
  envVars: DeploymentEnvVar[];
}

export const WENDORO_REPO_URL = 'https://github.com/wendoro/Wendoro-Desk';

export const WENDORO_DEPLOYMENT_TARGETS: DeploymentTarget[] = [
  {
    id: 'desktop-electron',
    name: 'Native Desktop Software (Windows, macOS & Linux)',
    shortLabel: 'Desktop Software',
    category: 'Native Desktop · Electron',
    runtime: 'Electron 35 Native Shell (.exe / .dmg / .AppImage / .deb)',
    scalingProfile: 'Offline-first local business workstation with server-verified license activation',
    configFiles: [
      'electron/main.cjs',
      'electron/preload.cjs',
      'electron/package.json',
      '.github/workflows/build-desktop-android.yml',
    ],
    summary:
      'Distribute WENDORO as installable native desktop software for Windows, macOS, and Linux. All ERP modules, double-entry ledger, POS, and inventory run locally on the user’s machine and authenticate their license key against the License Auth Server.',
    highlights: [
      'Native Windows NSIS installer (.exe), macOS universal (.dmg), and Linux (.AppImage/.deb)',
      'Runs completely offline on the local computer after license activation',
      'Automated GitHub Actions workflow compiles desktop installers cleanly',
      'Dedicated Electron wrapper kept isolated inside electron/ directory',
    ],
    steps: [
      {
        title: '1. Build the production desktop UI bundle',
        command: 'npm ci && npm run build',
        note: 'Outputs optimized static assets into dist/ loaded locally by electron/main.cjs.',
      },
      {
        title: '2. Install Electron packager in electron/',
        command: 'npm --prefix electron install',
        note: 'Installs Electron and electron-builder separately from server dependencies.',
      },
      {
        title: '3. Compile native installers for Windows, macOS, or Linux',
        command:
          'npm --prefix electron run dist:win\n# or: npm --prefix electron run dist:mac\n# or: npm --prefix electron run dist:linux',
        note: 'Installers are generated in electron/dist/ ready for direct download.',
      },
    ],
    envVars: [
      {
        name: 'WENDORO_DEV_URL',
        scope: 'client',
        required: false,
        description: 'Optional local dev URL when testing Electron against hot-reload server',
        example: 'http://localhost:3000',
      },
    ],
  },
  {
    id: 'android-app',
    name: 'Native Android App (APK / AAB)',
    shortLabel: 'Android App',
    category: 'Native Mobile · Capacitor',
    runtime: 'Android Native WebView (Capacitor 7 · com.wendoro.erp)',
    scalingProfile: 'Field sales, mobile POS billing, and warehouse stock management on Android phones & tablets',
    configFiles: [
      'capacitor.config.ts',
      'public/pwa-512x512.png',
      'public/pwa-maskable-512x512.png',
      '.github/workflows/build-desktop-android.yml',
    ],
    summary:
      'Package WENDORO into a signed native Android .apk or Google Play .aab bundle. Employees install the app on Android phones/tablets, activate their company license key once against your License Auth Server, and operate seamlessly offline.',
    highlights: [
      'Native Android package ID: com.wendoro.erp configured in capacitor.config.ts',
      'Adaptive Red & Yellow launcher icons ready for Android 8–15',
      'GitHub Actions workflow builds app-debug.apk automatically on every release',
      'Touch-friendly mobile drawer, POS register, and barcode/SKU lookup',
    ],
    steps: [
      {
        title: '1. Build the mobile web bundle',
        command: 'npm ci && npm run build',
        note: 'Bundles the Red & Yellow UI, charts, and offline storage engine into dist/.',
      },
      {
        title: '2. Sync Android native project with Capacitor',
        command:
          'npm install @capacitor/core @capacitor/cli @capacitor/android\nnpx cap add android\nnpx cap sync android',
        note: 'Requires JDK 21 and Android SDK (or run via GitHub Actions).',
      },
      {
        title: '3. Build installable Android APK',
        command:
          'cd android && ./gradlew assembleDebug\n# Output: android/app/build/outputs/apk/debug/app-debug.apk',
        note: 'Use ./gradlew bundleRelease for signed Play Store .aab packages.',
      },
    ],
    envVars: [],
  },
  {
    id: 'license-server',
    name: 'License Authentication Server (Minimal Backend)',
    shortLabel: 'License Server',
    category: 'Auth API · Node.js',
    runtime: 'Node.js 24 + Express (server.ts)',
    scalingProfile: 'Lightweight API server strictly for user registration, license key issuance & activation checks',
    configFiles: ['server.ts', 'src/server/licensing.ts', 'src/core/engine/licenseClient.ts'],
    summary:
      'Your minimal backend server exists purely to let customers register, receive their cryptographically signed WND-... license key, and activate/verify their Desktop or Android installations.',
    highlights: [
      'POST /api/licenses/register — Registers account & issues signed WND-... license key',
      'POST /api/licenses/login — Authenticates user to view & retrieve existing keys',
      'POST /api/licenses/activate — Verifies key & binds Desktop/Android device seat',
      'POST /api/licenses/verify — Lightweight online check for active license status',
    ],
    steps: [
      {
        title: '1. Install dependencies & build',
        command: 'npm ci && npm run build',
      },
      {
        title: '2. Set signing secret in environment (recommended in production)',
        command: 'export LICENSE_SIGNING_SECRET="$(openssl rand -hex 32)"',
        note: 'If omitted locally, a secure random secret is auto-generated in .data/license-secret.key.',
      },
      {
        title: '3. Start the minimal License Auth Server',
        command: 'NODE_ENV=production PORT=3000 npm start',
        note: 'Desktop & Android clients point their License Server URL to this host.',
      },
    ],
    envVars: [
      {
        name: 'LICENSE_SIGNING_SECRET',
        scope: 'server',
        required: false,
        description: 'HMAC-SHA256 secret used to sign & verify WND-... license keys and activation tokens',
        example: 'openssl rand -hex 32',
      },
      {
        name: 'PORT',
        scope: 'server',
        required: false,
        description: 'HTTP port for the License Auth Server',
        example: '3000',
      },
    ],
  },
];

export const OSS_GOVERNANCE_FILES = [
  {
    file: 'electron/main.cjs',
    purpose: 'Native Desktop software launcher for Windows, macOS, and Linux',
  },
  {
    file: 'capacitor.config.ts',
    purpose: 'Native Android APK/AAB wrapper configuration (com.wendoro.erp)',
  },
  {
    file: 'src/server/licensing.ts',
    purpose: 'HMAC-SHA256 license issuance, user registration, and device seat verification',
  },
  {
    file: 'LICENSE',
    purpose: 'Apache-2.0 core license and commercial desktop/mobile distribution governance',
  },
];
