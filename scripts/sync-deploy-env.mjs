import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const OVERRIDE_ENV_KEYS = [
  'OTP_HASH_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
];

// Keys that MUST be present on EC2 for the deploy to proceed.
// Core infrastructure keys only — app-level keys (SMTP, OTP) are warned below.
export const REQUIRED_DEPLOY_ENV_KEYS = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];

// Keys that the application validates at startup; we warn (not block) if absent
// so the first deploy after adding OTP/email features can proceed even before
// GitHub Secrets or the EC2 .env have been manually updated.
export const WARN_DEPLOY_ENV_KEYS = [
  'OTP_HASH_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
];

function formatEnvValue(value) {
  if (/[\r\n]/.test(value)) {
    throw new Error('Environment override values must not contain newlines.');
  }
  return value.includes("'") ? JSON.stringify(value) : `'${value}'`;
}

export function prepareOverridesBase64(envSource = process.env) {
  const payload = {};
  for (const key of OVERRIDE_ENV_KEYS) {
    const value = envSource[key];
    if (typeof value === 'string' && value.trim() !== '') {
      payload[key] = value;
    }
  }
  if (Object.keys(payload).length === 0) {
    return '';
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function upsertEnvContent(existingContent, overrides) {
  const remaining = { ...overrides };
  const lines = existingContent.split(/\r?\n/);
  const updated = lines.map((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match && Object.prototype.hasOwnProperty.call(remaining, match[1])) {
      const value = remaining[match[1]];
      delete remaining[match[1]];
      return `${match[1]}=${formatEnvValue(value)}`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(remaining)) {
    updated.push(`${key}=${formatEnvValue(value)}`);
  }

  const trimmedTrailing = updated.filter(
    (line, idx, arr) => idx < arr.length - 1 || line !== '',
  );
  return trimmedTrailing.join('\n') + '\n';
}

export function findMissingEnvKeys(content, requiredKeys = REQUIRED_DEPLOY_ENV_KEYS) {
  const present = new Set();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
    const val = line.slice(eq + 1).trim();
    if (key && val !== '' && val !== '""' && val !== "''") {
      present.add(key);
    }
  }
  return requiredKeys.filter((key) => !present.has(key));
}

export function syncAndValidateDeployEnv({
  sourceEnvPath = '/srv/scaniro/.env',
  targetEnvPath = '/srv/scaniro/backend/.env',
  overridesB64 = process.env.DEPLOY_ENV_OVERRIDES_B64 ?? '',
} = {}) {
  const sourceExists = fs.existsSync(sourceEnvPath);
  if (overridesB64 && sourceExists) {
    const overrides = JSON.parse(
      Buffer.from(overridesB64, 'base64').toString('utf8'),
    );
    if (Object.keys(overrides).length > 0) {
      const existing = fs.readFileSync(sourceEnvPath, 'utf8');
      const nextContent = upsertEnvContent(existing, overrides);
      fs.writeFileSync(sourceEnvPath, nextContent, { mode: 0o600 });
    }
  }

  if (sourceExists && path.resolve(sourceEnvPath) !== path.resolve(targetEnvPath)) {
    fs.copyFileSync(sourceEnvPath, targetEnvPath);
  }

  if (!fs.existsSync(targetEnvPath)) {
    throw new Error(`Deployment blocked: ${sourceEnvPath} is missing on EC2.`);
  }

  const targetContent = fs.readFileSync(targetEnvPath, 'utf8');

  // Hard block: core infrastructure keys must be present.
  const missingRequired = findMissingEnvKeys(targetContent, REQUIRED_DEPLOY_ENV_KEYS);
  if (missingRequired.length > 0) {
    throw new Error(
      `Deployment blocked: ${sourceEnvPath} is missing required infrastructure keys: ${missingRequired.join(', ')}. ` +
        'Add them to /srv/scaniro/.env on EC2.',
    );
  }

  // Soft warn: application-level keys (SMTP, OTP). Missing after inject means
  // GitHub Secrets are not configured yet — the app will error at startup, but
  // the deploy itself can still proceed so the user can manually update EC2 .env.
  const missingWarn = findMissingEnvKeys(targetContent, WARN_DEPLOY_ENV_KEYS);
  if (missingWarn.length > 0) {
    console.warn(
      `⚠️  WARNING: ${sourceEnvPath} is missing application keys: ${missingWarn.join(', ')}. ` +
        'The app may fail to start. Add these keys to /srv/scaniro/.env on EC2 ' +
        'or configure matching GitHub Actions Secrets (OTP_HASH_SECRET, SMTP_HOST, ' +
        'SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM) to auto-inject them on future deploys.',
    );
  }
}

function runCli() {
  if (process.argv.includes('--prepare')) {
    const b64 = prepareOverridesBase64(process.env);
    if (b64) {
      console.log(`::add-mask::${b64}`);
    }
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(outputFile, `b64=${b64}\n`);
    }
    return;
  }

  syncAndValidateDeployEnv({
    sourceEnvPath: process.env.DEPLOY_SOURCE_ENV_PATH || '/srv/scaniro/.env',
    targetEnvPath: process.env.DEPLOY_TARGET_ENV_PATH || '/srv/scaniro/backend/.env',
    overridesB64: process.env.DEPLOY_ENV_OVERRIDES_B64 ?? '',
  });
}

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
