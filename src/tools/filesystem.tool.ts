// TODO [VR]: Brush up filesystem tool

import { permissions } from "@/core/permissions";
import { paths } from "@/utils/paths.util";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { z } from "zod";
import type { Tool, ToolContext } from "./tool.types";

interface SearchResult {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
}

const SearchInputSchema = z.object({
  query: z.string().min(1).describe("Search query (filename pattern or text)"),
  maxResults: z.number().int().positive().default(20).describe("Maximum results to return"),
});

const ReadFileInputSchema = z.object({
  path: z.string().min(1).describe("Path to the file to read"),
  maxLines: z.number().int().positive().optional().describe("Maximum lines to read"),
});

function queryToRegex(query: string): RegExp {
  const escaped = query.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");

  return new RegExp(pattern, "i");
}

// Agent home + whitelisted paths, deduplicated
function getSearchRoots(): string[] {
  const agentHome = resolve(permissions.getAgentHome());
  const whitelisted = permissions.listWhitelistedPaths().map((p) => resolve(p.path));
  const all = [agentHome, ...whitelisted];
  const resolved = [...new Set(all)];

  return resolved.filter((R) => {
    const containedInOther = resolved.some((S) => R !== S && (R === S || R.startsWith(S + "/")));

    return !containedInOther;
  });
}

function searchDirectory(
  dir: string,
  pattern: RegExp,
  results: SearchResult[],
  maxResults: number,
  visited: Set<string> = new Set()
): void {
  const realPath = resolve(dir);
  if (visited.has(realPath)) return;

  visited.add(realPath);

  try {
    permissions.assertRead(dir);
  } catch {
    return;
  }

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= maxResults) return;

    if (entry.startsWith(".") || entry === "node_modules") {
      continue;
    }

    const fullPath = join(dir, entry);

    try {
      const stat = statSync(fullPath);

      if (pattern.test(entry)) {
        results.push({
          path: fullPath,
          name: entry,
          type: stat.isDirectory() ? "directory" : "file",
          size: stat.isFile() ? stat.size : undefined,
          modified: stat.mtime.toISOString(),
        });
      }

      if (stat.isDirectory() && results.length < maxResults) {
        searchDirectory(fullPath, pattern, results, maxResults, visited);
      }
    } catch {
      continue;
    }
  }
}

export const searchTool: Tool = {
  name: "search",
  description:
    "Search for files and directories by name pattern in ~/.camille/ and whitelisted paths only",
  parameters: SearchInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = SearchInputSchema.parse(input);
    const { query, maxResults } = parsed;

    const roots = getSearchRoots();
    const pattern = queryToRegex(query);
    const results: SearchResult[] = [];
    const visited = new Set<string>();

    for (const root of roots) {
      if (results.length >= maxResults) break;
      searchDirectory(root, pattern, results, maxResults, visited);
    }

    if (results.length === 0) {
      return {
        message: `No files matching "${query}" found in ~/.camille/ or whitelisted paths`,
        results: [],
      };
    }

    return {
      message: `Found ${results.length} result(s) matching "${query}"`,
      results,
    };
  },
};

export const readFileTool: Tool = {
  name: "read",
  description: "Read the contents of a file",
  parameters: ReadFileInputSchema,

  async execute(input: unknown, _context: ToolContext): Promise<unknown> {
    const parsed = ReadFileInputSchema.parse(input);
    const { path: filePath, maxLines } = parsed;

    const absolutePath = resolve(paths.expandTilde(filePath));
    permissions.assertRead(absolutePath);

    const content = readFileSync(absolutePath, "utf-8");

    if (maxLines) {
      const lines = content.split("\n").slice(0, maxLines);

      return {
        path: absolutePath,
        content: lines.join("\n"),
        truncated: content.split("\n").length > maxLines,
      };
    }

    return {
      path: absolutePath,
      content,
    };
  },
};
