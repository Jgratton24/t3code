import * as FS from "node:fs";
import * as Path from "node:path";
import * as OS from "node:os";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseWslDistroList, loadWslConfig, saveWslConfig } from "./wsl";

describe("parseWslDistroList", () => {
  function makeUtf16LeBuffer(text: string): Buffer {
    return Buffer.from("\uFEFF" + text, "utf16le");
  }

  it("parses standard output with default distro marked", () => {
    const output = makeUtf16LeBuffer(
      [
        "  NAME            STATE           VERSION",
        "* Ubuntu           Running         2",
        "  Debian           Stopped         2",
        "  Ubuntu-22.04     Running         1",
      ].join("\r\n"),
    );
    const distros = parseWslDistroList(output);
    expect(distros).toEqual([
      { name: "Ubuntu", isDefault: true, version: 2 },
      { name: "Debian", isDefault: false, version: 2 },
      { name: "Ubuntu-22.04", isDefault: false, version: 1 },
    ]);
  });

  it("returns empty array for empty buffer", () => {
    expect(parseWslDistroList(Buffer.alloc(0))).toEqual([]);
  });

  it("returns empty array for header-only output", () => {
    const output = makeUtf16LeBuffer("  NAME            STATE           VERSION\r\n");
    expect(parseWslDistroList(output)).toEqual([]);
  });

  it("skips malformed lines", () => {
    const output = makeUtf16LeBuffer(
      [
        "  NAME            STATE           VERSION",
        "* Ubuntu           Running         2",
        "  bad line",
        "",
        "  Debian           Stopped         2",
      ].join("\r\n"),
    );
    const distros = parseWslDistroList(output);
    expect(distros).toEqual([
      { name: "Ubuntu", isDefault: true, version: 2 },
      { name: "Debian", isDefault: false, version: 2 },
    ]);
  });

  it("handles output without BOM", () => {
    const text = [
      "  NAME            STATE           VERSION",
      "* Ubuntu           Running         2",
    ].join("\r\n");
    const output = Buffer.from(text, "utf16le");
    const distros = parseWslDistroList(output);
    expect(distros).toEqual([{ name: "Ubuntu", isDefault: true, version: 2 }]);
  });
});

describe("loadWslConfig / saveWslConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = FS.mkdtempSync(Path.join(OS.tmpdir(), "wsl-test-"));
  });

  afterEach(() => {
    FS.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns default config when file does not exist", () => {
    const config = loadWslConfig(tmpDir);
    expect(config).toEqual({ enabled: false, distro: null });
  });

  it("returns default config when file is invalid JSON", () => {
    FS.writeFileSync(Path.join(tmpDir, "wsl-config.json"), "not json", "utf8");
    const config = loadWslConfig(tmpDir);
    expect(config).toEqual({ enabled: false, distro: null });
  });

  it("returns default config when enabled field is missing", () => {
    FS.writeFileSync(Path.join(tmpDir, "wsl-config.json"), '{"distro":"Ubuntu"}', "utf8");
    const config = loadWslConfig(tmpDir);
    expect(config).toEqual({ enabled: false, distro: null });
  });

  it("round-trips config correctly", () => {
    const original = { enabled: true, distro: "Ubuntu" };
    saveWslConfig(tmpDir, original);
    const loaded = loadWslConfig(tmpDir);
    expect(loaded).toEqual(original);
  });

  it("round-trips config with null distro", () => {
    const original = { enabled: true, distro: null };
    saveWslConfig(tmpDir, original);
    const loaded = loadWslConfig(tmpDir);
    expect(loaded).toEqual(original);
  });

  it("creates directory if it does not exist", () => {
    const nested = Path.join(tmpDir, "nested", "dir");
    saveWslConfig(nested, { enabled: true, distro: "Debian" });
    const loaded = loadWslConfig(nested);
    expect(loaded).toEqual({ enabled: true, distro: "Debian" });
  });
});
