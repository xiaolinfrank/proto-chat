import semver from 'semver';

/**
 * Determine whether an app update is needed rather than just a renderer layer update
 * @param currentVersion Current version
 * @param nextVersion New version
 * @returns Whether an app update is needed
 */
export const shouldUpdateApp = (currentVersion: string, nextVersion: string): boolean => {
  // If the version includes the .app suffix, force an app update
  if (nextVersion.includes('.app')) {
    return true;
  }

  try {
    // Parse version numbers
    const current = semver.parse(currentVersion);
    const next = semver.parse(nextVersion);

    if (!current || !next) return true;

    // When the major or minor version changes, an app update is required
    if (current.major !== next.major || current.minor !== next.minor) {
      return true;
    }

    // Only patch version changed — prefer renderer hot update
    return false;
  } catch {
    // On parse failure, default to performing an app update
    return true;
  }
};
