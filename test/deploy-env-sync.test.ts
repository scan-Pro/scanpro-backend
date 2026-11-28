import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import dotenv from 'dotenv';

const {
  prepareOverridesBase64,
  syncAndValidateDeployEnv,
} = await import('../scripts/sync-deploy-env.mjs');

test('prepareOverridesBase64 and syncAndValidateDeployEnv preserve existing vars and safely handle special password characters', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanpro-deploy-env-'));
  try {
    const sourceEnvPath = path.join(dir, 'shared.env');
    const targetEnvPath = path.join(dir, 'backend.env');

    fs.writeFileSync(
      sourceEnvPath,
      [
        'NODE_ENV=production',
        'DATABASE_URL=mysql://user:pass@rds:3306/scaniro',
        'JWT_ACCESS_SECRET=existing-access-secret-at-least-32-chars',
        'JWT_REFRESH_SECRET=existing-refresh-secret-at-least-32-chars',
        'AWS_ACCESS_KEY_ID=test-access',
        'AWS_SECRET_ACCESS_KEY=test-secret',
        'SMTP_HOST=old.example.com',
      ].join('\n') + '\n',
    );

    const overridesB64 = prepareOverridesBase64({
      OTP_HASH_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      SMTP_HOST: 'mail.ruhsolution.com',
      SMTP_PORT: '465',
      SMTP_USER: 'docscaniro@ruhsolution.com',
      SMTP_PASSWORD: 'bCO+mzb--$-BPJV8',
      SMTP_FROM: 'docscaniro@ruhsolution.com',
    });
    assert.ok(overridesB64.length > 0);

    syncAndValidateDeployEnv({
      sourceEnvPath,
      targetEnvPath,
      overridesB64,
    });

    const parsed = dotenv.parse(fs.readFileSync(targetEnvPath, 'utf8'));
    assert.equal(parsed.DATABASE_URL, 'mysql://user:pass@rds:3306/scaniro');
    assert.equal(parsed.SMTP_HOST, 'mail.ruhsolution.com');
    assert.equal(parsed.SMTP_PORT, '465');
    assert.equal(parsed.SMTP_PASSWORD, 'bCO+mzb--$-BPJV8');
    assert.equal(
      parsed.OTP_HASH_SECRET,
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('syncAndValidateDeployEnv blocks cleanly when required keys are missing and overrides are empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanpro-deploy-env-missing-'));
  try {
    const sourceEnvPath = path.join(dir, 'shared.env');
    const targetEnvPath = path.join(dir, 'backend.env');
    fs.writeFileSync(sourceEnvPath, 'DATABASE_URL=mysql://user:pass@rds:3306/scaniro\n');

    assert.equal(prepareOverridesBase64({}), '');

    assert.throws(
      () =>
        syncAndValidateDeployEnv({
          sourceEnvPath,
          targetEnvPath,
          overridesB64: '',
        }),
      /missing required keys: .*OTP_HASH_SECRET.*SMTP_HOST/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
