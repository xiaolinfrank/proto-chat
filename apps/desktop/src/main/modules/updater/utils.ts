import semver from 'semver';

/**
 * Determines whether an application update is needed rather than just a renderer update
 * @param currentVersion Current version
 * @param nextVersion New version
 * @returns Whether an application update is required
 */
export const shouldUpdateApp = (currentVersion: string, nextVersion: string): boolean => {
  // If the version number contains the .app suffix, force an application update
  if (nextVersion.includes('.app')) {
    return true;
  }

  try {
    // Parse version numbers
    const current = semver.parse(currentVersion);
    const next = semver.parse(nextVersion);

    if (!current || !next) return true;

    // When major or minor version changes, an application update is required
    if (current.major !== next.major || current.minor !== next.minor) {
      return true;
    }

    // Only patch version changes, prefer renderer hot update
    return false;
  } catch {
    // If parsing fails, default to application update
    return true;
  }
};
