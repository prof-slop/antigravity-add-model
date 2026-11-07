/** Read a public desktop OAuth profile from a recognized local vendor installation; never execute its code. */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface GoogleNativeClient {
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

export interface GoogleNativeClientOptions {
  resources?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  home?: string;
  runtimeResources?: string;
}

const SUPPORTED_COMMIT = 'ecfbad74d93962fc8ca485d93ab9b4f3d4cb6cf8';
const MODULE_MARKER = '"out-build/vs/platform/cloudCode/common/oauthClient.js"(){"use strict";';
export const GOOGLE_NATIVE_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
] as const;
const UNAVAILABLE =
  'A supported Antigravity IDE installation (2.5.5) is required for Antigravity sign-in. ' +
  'For a portable installation, set ANTIGRAVITY_IDE_RESOURCES to its resources directory and restart the service, ' +
  'or use Custom Desktop OAuth.';

/**
 * Public installed-app client identifier for the personal account flow. Client identifiers appear in every OAuth
 * authorize URL and are not confidential; only the matching client secret is, and that is read from the vendor binary.
 */
const PERSONAL_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
/** Non-reversible 64-bit SHA-256 fingerprint of `${clientId}:${clientSecret}` to verify pairing regardless of Go rodata sort order. */
const PERSONAL_PAIR_SHA256_PREFIX = '6f5c1920f8566f36';
const CLIENT_ID_SUFFIX = '.apps.googleusercontent.com';
const CLIENT_SECRET_PREFIX = 'GOCSPX-';
/** Installed-app secrets are "GOCSPX-" plus a 28-character body; the vendor string table stores no delimiter. */
const CLIENT_SECRET_LENGTH = 35;

function ensureNoSymlinks(filename: string): string {
  const resolved = path.resolve(filename);
  let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(UNAVAILABLE);
  }
  return resolved;
}

function readFile(filename: string, maximum: number): string {
  const resolved = ensureNoSymlinks(filename);
  const handle = fs.openSync(resolved, 'r');
  try {
    const stat = fs.fstatSync(handle);
    if (!stat.isFile() || stat.size > maximum) throw new Error(UNAVAILABLE);
    const value = fs.readFileSync(handle, 'utf8');
    if (Buffer.byteLength(value) > maximum) throw new Error(UNAVAILABLE);
    return value;
  } finally {
    fs.closeSync(handle);
  }
}

function readBinary(filename: string, maximum: number): Buffer {
  const resolved = ensureNoSymlinks(filename);
  const handle = fs.openSync(resolved, 'r');
  try {
    const stat = fs.fstatSync(handle);
    if (!stat.isFile() || stat.size > maximum) throw new Error(UNAVAILABLE);
    return fs.readFileSync(handle);
  } finally {
    fs.closeSync(handle);
  }
}

/**
 * Recover the personal OAuth pair from the vendor binary's string table. The vendor emits its client identifiers and
 * client secrets in matching declaration order, so the secret is selected by the identifier's ordinal position.
 * Any layout that does not line up fails closed instead of pairing the wrong secret with the personal client.
 */
function readVendorCredentials(binary: Buffer): { clientId: string; clientSecret: string } {
  const identifiers: string[] = [];
  for (let at = binary.indexOf(CLIENT_ID_SUFFIX); at !== -1; at = binary.indexOf(CLIENT_ID_SUFFIX, at + 1)) {
    const window = binary.toString('latin1', Math.max(0, at - 64), at);
    const match = /([0-9]{6,}-[a-z0-9]{20,})$/.exec(window);
    if (match) identifiers.push(match[1] + CLIENT_ID_SUFFIX);
  }
  const secrets: string[] = [];
  for (let at = binary.indexOf(CLIENT_SECRET_PREFIX); at !== -1; at = binary.indexOf(CLIENT_SECRET_PREFIX, at + 1)) {
    const candidate = binary.toString('latin1', at, Math.min(binary.length, at + CLIENT_SECRET_LENGTH));
    if (/^GOCSPX-[A-Za-z0-9_-]{28}$/.test(candidate)) secrets.push(candidate);
  }
  const index = identifiers.indexOf(PERSONAL_CLIENT_ID);
  if (index < 0 || new Set(identifiers).size !== identifiers.length || new Set(secrets).size !== secrets.length) {
    throw new Error(UNAVAILABLE);
  }
  const verified = secrets.find(
    (secret) =>
      createHash('sha256').update(`${PERSONAL_CLIENT_ID}:${secret}`).digest('hex').slice(0, 16) ===
      PERSONAL_PAIR_SHA256_PREFIX,
  );
  if (verified) return { clientId: PERSONAL_CLIENT_ID, clientSecret: verified };
  if (identifiers.length !== secrets.length) throw new Error(UNAVAILABLE);
  return { clientId: PERSONAL_CLIENT_ID, clientSecret: secrets[index] };
}

function inspectLanguageServer(resourcesDir: string): GoogleNativeClient {
  const binaryName = process.platform === 'win32' ? 'language_server.exe' : 'language_server';
  const binary = readBinary(path.join(resourcesDir, 'bin', binaryName), 256 * 1024 * 1024);
  const credentials = readVendorCredentials(binary);
  for (const scope of GOOGLE_NATIVE_SCOPES) {
    if (!binary.includes(Buffer.from(scope))) throw new Error(UNAVAILABLE);
  }
  return { ...credentials, scopes: [...GOOGLE_NATIVE_SCOPES] };
}

function inspect(app: string): GoogleNativeClient {
  const pkg = JSON.parse(readFile(path.join(app, 'package.json'), 256 * 1024));
  const product = JSON.parse(readFile(path.join(app, 'product.json'), 1024 * 1024));
  const extension = JSON.parse(readFile(path.join(app, 'extensions/antigravity/package.json'), 1024 * 1024));
  if (
    pkg.name !== 'Antigravity IDE' ||
    pkg.version !== '1.107.0' ||
    pkg.author?.name !== 'Google' ||
    pkg.main !== './out/main.js' ||
    product.nameShort !== 'Antigravity IDE' ||
    product.applicationName !== 'antigravity-ide' ||
    product.ideVersion !== '2.5.5' ||
    product.commit !== SUPPORTED_COMMIT ||
    extension.name !== 'antigravity' ||
    extension.publisher !== 'google' ||
    extension.main !== './dist/extension.js'
  )
    throw new Error(UNAVAILABLE);

  const source = readFile(path.join(app, 'out/main.js'), 64 * 1024 * 1024);
  const start = source.indexOf(MODULE_MARKER);
  if (start < 0 || source.indexOf(MODULE_MARKER, start + MODULE_MARKER.length) !== -1) throw new Error(UNAVAILABLE);
  const end = source.indexOf('}})', start);
  if (end < 0 || end - start > 8192) throw new Error(UNAVAILABLE);
  const body = source.slice(start + MODULE_MARKER.length, end);
  const profile =
    /^([\w$]+)="([A-Za-z0-9_.-]+\.apps\.googleusercontent\.com)",([\w$]+)="(GOCSPX-[A-Za-z0-9_-]+)",([\w$]+)="([A-Za-z0-9_.-]+\.apps\.googleusercontent\.com)",([\w$]+)="(GOCSPX-[A-Za-z0-9_-]+)",([\w$]+)=(\[[^\]]+\])$/.exec(
      body,
    );
  if (!profile) throw new Error(UNAVAILABLE);
  const [, personalId, clientId, personalSecret, clientSecret, gcpId, , gcpSecret, , scopeVariable, rawScopes] =
    profile;
  const scopes: unknown = JSON.parse(rawScopes);
  if (
    !Array.isArray(scopes) ||
    JSON.stringify(scopes) !== JSON.stringify(GOOGLE_NATIVE_SCOPES) ||
    clientId.length > 512 ||
    clientSecret.length > 2048 ||
    new Set([personalId, personalSecret, gcpId, gcpSecret, scopeVariable]).size !== 5
  )
    throw new Error(UNAVAILABLE);

  // Confirm that the first pair is actually selected by the personal-account branch.
  // Unknown vendor layouts fail closed rather than guessing which OAuth identity to use.
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const selection = `${escape(gcpId)}:${escape(personalId)},[\\w$]+=[\\w$]+\\?${escape(gcpSecret)}:${escape(personalSecret)}`;
  if (
    !new RegExp(`getLoginUrl\\([\\w$]+\\)\\{[^}]{0,500}${selection}`).test(source) ||
    !new RegExp(`exchangeCodeForToken\\([^)]*\\)\\{[^}]{0,500}${selection}`).test(source) ||
    !source.includes(`scope:${scopeVariable},state:`) ||
    !source.includes('.generateAuthUrl({access_type:"offline",') ||
    !source.includes(
      'getLocalhostRedirectUri(){return this._port===null?null:`http://localhost:${this._port}/oauth-callback`}',
    )
  )
    throw new Error(UNAVAILABLE);
  return { clientId, clientSecret, scopes: scopes as string[] };
}

export function resolveGoogleNativeClient(options: GoogleNativeClientOptions = {}): GoogleNativeClient {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const home = options.home || os.homedir();
  const explicit = options.resources || env.ANTIGRAVITY_IDE_RESOURCES;
  const runtime = options.runtimeResources ?? (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const roots = explicit
    ? [path.resolve(explicit)]
    : [
        ...(runtime ? [runtime] : []),
        ...(platform === 'win32'
          ? [
              path.join(env.LOCALAPPDATA || path.join(home, 'AppData/Local'), 'Programs/Antigravity IDE'),
              path.join(env.LOCALAPPDATA || path.join(home, 'AppData/Local'), 'Programs/Antigravity'),
              ...(env.ProgramFiles
                ? [path.join(env.ProgramFiles, 'Antigravity IDE'), path.join(env.ProgramFiles, 'Antigravity')]
                : []),
            ]
          : platform === 'darwin'
            ? [
                '/Applications/Antigravity IDE.app',
                '/Applications/Antigravity.app',
                path.join(home, 'Applications/Antigravity IDE.app'),
                path.join(home, 'Applications/Antigravity.app'),
              ]
            : [
                '/opt/antigravity',
                '/usr/share/antigravity',
                '/usr/lib/antigravity',
                '/usr/local/lib/antigravity',
                path.join(home, '.local/share/antigravity-ide'),
              ]),
      ];
  for (const root of roots) {
    for (const app of [
      path.join(root, 'app'),
      path.join(root, 'resources/app'),
      path.join(root, 'Contents/Resources/app'),
      root,
    ]) {
      try {
        return inspect(app);
      } catch {
        /* Try other recognized install layouts without exposing vendor contents or paths. */
      }
    }
  }
  for (const root of roots) {
    for (const resDir of [
      path.join(root, 'Contents/Resources'),
      path.join(root, 'resources'),
      root,
    ]) {
      try {
        return inspectLanguageServer(resDir);
      } catch {
        /* Try other recognized install layouts without exposing vendor contents or paths. */
      }
    }
  }
  throw new Error(UNAVAILABLE);
}
