import * as ChildProcess from "node:child_process";
import * as FS from "node:fs";
import * as Path from "node:path";

export interface WslDistro {
  name: string;
  isDefault: boolean;
  version: 1 | 2;
}

export interface WslConfig {
  enabled: boolean;
  distro: string | null;
}

const DEFAULT_WSL_CONFIG: WslConfig = { enabled: false, distro: null };
const WSL_CONFIG_FILENAME = "wsl-config.json";

export function isWslAvailable(): boolean {
  if (process.platform !== "win32") return false;
  const windir = process.env.WINDIR ?? "C:\\Windows";
  return FS.existsSync(Path.join(windir, "System32", "wsl.exe"));
}

export function listWslDistros(): WslDistro[] {
  try {
    const result = ChildProcess.spawnSync("wsl.exe", ["--list", "--verbose"], {
      encoding: "buffer",
      timeout: 8_000,
      windowsHide: true,
    });
    if (result.status !== 0 || !result.stdout || result.stdout.length === 0) return [];
    return parseWslDistroList(result.stdout);
  } catch {
    return [];
  }
}

export function parseWslDistroList(stdout: Buffer): WslDistro[] {
  // wsl.exe --list --verbose outputs UTF-16LE with a BOM
  let text = stdout.toString("utf16le");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  // First line is the header ("NAME STATE VERSION"), skip it
  const distros: WslDistro[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const isDefault = line.startsWith("*");
    const cleaned = isDefault ? line.slice(1).trim() : line.trim();
    // Fields are separated by 2+ spaces
    const fields = cleaned.split(/\s{2,}/);
    if (fields.length < 3) continue;
    const name = fields[0]!.trim();
    const versionNum = parseInt(fields[2]!, 10);
    if (!name || (versionNum !== 1 && versionNum !== 2)) continue;
    distros.push({ name, isDefault, version: versionNum as 1 | 2 });
  }
  return distros;
}

export function checkWslNode(distro: string | null): { available: boolean; path: string | null } {
  try {
    const distroArgs = distro ? ["-d", distro] : [];
    const result = ChildProcess.spawnSync("wsl.exe", [...distroArgs, "--", "which", "node"], {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    });
    if (result.status === 0 && result.stdout) {
      const nodePath = result.stdout.trim();
      return { available: nodePath.length > 0, path: nodePath || null };
    }
    return { available: false, path: null };
  } catch {
    return { available: false, path: null };
  }
}

export function windowsToWslPath(distro: string | null, windowsPath: string): string {
  try {
    const distroArgs = distro ? ["-d", distro] : [];
    // wsl.exe interprets backslashes as escape chars — normalize to forward slashes
    const normalized = windowsPath.replaceAll("\\", "/");
    const result = ChildProcess.spawnSync(
      "wsl.exe",
      [...distroArgs, "--", "wslpath", "-u", normalized],
      { encoding: "utf8", timeout: 3_000, windowsHide: true },
    );
    if (result.status === 0 && result.stdout) {
      const converted = result.stdout.trim();
      if (converted.length > 0) return converted;
    }
    return windowsPath;
  } catch {
    return windowsPath;
  }
}

export function wslToWindowsPath(distro: string | null, linuxPath: string): string {
  try {
    const distroArgs = distro ? ["-d", distro] : [];
    const result = ChildProcess.spawnSync(
      "wsl.exe",
      [...distroArgs, "--", "wslpath", "-w", linuxPath],
      { encoding: "utf8", timeout: 3_000, windowsHide: true },
    );
    if (result.status === 0 && result.stdout) {
      const converted = result.stdout.trim();
      if (converted.length > 0) return converted;
    }
    return linuxPath;
  } catch {
    return linuxPath;
  }
}

export async function listWslDistrosAsync(): Promise<WslDistro[]> {
  if (process.platform !== "win32") return [];
  return new Promise((resolve) => {
    const child = ChildProcess.spawn("wsl.exe", ["--list", "--verbose"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    const timeout = setTimeout(() => {
      child.kill();
      resolve([]);
    }, 8_000);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 || chunks.length === 0) {
        resolve([]);
        return;
      }
      resolve(parseWslDistroList(Buffer.concat(chunks)));
    });
    child.on("error", () => {
      clearTimeout(timeout);
      resolve([]);
    });
  });
}

export function loadWslConfig(stateDir: string): WslConfig {
  try {
    const raw = FS.readFileSync(Path.join(stateDir, WSL_CONFIG_FILENAME), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.enabled !== "boolean") return DEFAULT_WSL_CONFIG;
    const distro =
      typeof parsed.distro === "string" && parsed.distro.length > 0 ? parsed.distro : null;
    return { enabled: parsed.enabled, distro };
  } catch {
    return DEFAULT_WSL_CONFIG;
  }
}

export function saveWslConfig(stateDir: string, config: WslConfig): void {
  const filePath = Path.join(stateDir, WSL_CONFIG_FILENAME);
  FS.mkdirSync(stateDir, { recursive: true });
  FS.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf8");
}
