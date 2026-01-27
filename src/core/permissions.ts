import { existsSync, realpathSync } from "fs";
import { normalize, resolve } from "path";
import { allowedPathsRepo, type PathPermissions } from "@/db";
import { logger } from "@/logging";
import { paths } from "@/utils/paths.util";

export class PermissionError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly operation: "read" | "write"
  ) {
    super(message);
    this.name = "PermissionError";
  }
}

function resolvePath(inputPath: string): string {
  const normalized = normalize(resolve(inputPath));

  if (existsSync(normalized)) {
    try {
      return realpathSync(normalized);
    } catch {
      return normalized;
    }
  }

  const parts = normalized.split("/");
  for (let i = parts.length - 1; i >= 0; i--) {
    const parentPath = parts.slice(0, i).join("/") || "/";
    if (existsSync(parentPath)) {
      try {
        const realParent = realpathSync(parentPath);
        return realParent + "/" + parts.slice(i).join("/");
      } catch {
        break;
      }
    }
  }

  return normalized;
}

function isInsideAgentHome(absolutePath: string): boolean {
  const homeDir = paths.data();
  const resolvedHome = resolvePath(homeDir);
  const resolvedPath = resolvePath(absolutePath);

  return resolvedPath.startsWith(resolvedHome + "/") || resolvedPath === resolvedHome;
}

function isInsideWhitelistedPath(absolutePath: string): {
  allowed: boolean;
  permissions: PathPermissions | null;
} {
  const resolvedPath = resolvePath(absolutePath);
  const allowedPaths = allowedPathsRepo.findAll();

  for (const entry of allowedPaths) {
    const resolvedAllowed = resolvePath(entry.path);
    if (resolvedPath.startsWith(resolvedAllowed + "/") || resolvedPath === resolvedAllowed) {
      return { allowed: true, permissions: entry.permissions };
    }
  }

  return { allowed: false, permissions: null };
}

export const permissions = {
  canRead(absolutePath: string): boolean {
    if (isInsideAgentHome(absolutePath)) {
      return true;
    }
    const { allowed } = isInsideWhitelistedPath(absolutePath);

    return allowed;
  },

  canWrite(absolutePath: string): boolean {
    return isInsideAgentHome(absolutePath);
  },

  assertRead(absolutePath: string): void {
    if (!this.canRead(absolutePath)) {
      const resolved = resolvePath(absolutePath);
      logger.warn("Read permission denied", { path: resolved });
      throw new PermissionError(
        `Read access denied: ${resolved} is not in ~/.camille/ or whitelisted paths`,
        resolved,
        "read"
      );
    }
  },

  assertWrite(absolutePath: string): void {
    if (!this.canWrite(absolutePath)) {
      const resolved = resolvePath(absolutePath);
      logger.warn("Write permission denied", { path: resolved });
      throw new PermissionError(
        `Write access denied: ${resolved} is outside ~/.camille/`,
        resolved,
        "write"
      );
    }
  },

  getAgentHome(): string {
    return paths.data();
  },

  listWhitelistedPaths(): Array<{ path: string; permissions: PathPermissions }> {
    return allowedPathsRepo.findAll().map((p) => ({
      path: p.path,
      permissions: p.permissions,
    }));
  },
};
