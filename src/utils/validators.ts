export function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function isValidRegoPackage(code: string): boolean {
  return /^\s*package\s+\w+/.test(code);
}

export function validatePolicyName(name: string): string | null {
  if (!name.trim()) {
    return 'Policy name is required';
  }
  if (name.length < 3) {
    return 'Policy name must be at least 3 characters';
  }
  if (name.length > 64) {
    return 'Policy name must be less than 64 characters';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    return 'Policy name must start with a letter and contain only letters, numbers, hyphens, and underscores';
  }
  return null;
}
