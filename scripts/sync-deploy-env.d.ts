export const OVERRIDE_ENV_KEYS: readonly string[];
export const REQUIRED_DEPLOY_ENV_KEYS: readonly string[];

export function prepareOverridesBase64(
  envSource?: Record<string, string | undefined>,
): string;

export function upsertEnvContent(
  existingContent: string,
  overrides: Record<string, string>,
): string;

export function findMissingEnvKeys(
  content: string,
  requiredKeys?: readonly string[],
): string[];

export function syncAndValidateDeployEnv(options?: {
  sourceEnvPath?: string;
  targetEnvPath?: string;
  overridesB64?: string;
}): void;
