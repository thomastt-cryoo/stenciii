"""Collect completed local M0 runs into portable, reviewable audit evidence.

Raw build products and test runs stay in ignored sandbox/m0. This copies selected
logs and summarizes every Playwright result; it never marks an unexecuted check passed.
"""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
RUNS = ROOT / "sandbox/m0"
OUT = ROOT / "docs/audit"
OUT.mkdir(parents=True, exist_ok=True)


def portable(text):
    for raw, replacement in [(str(ROOT), "<workspace>"), (str(Path.home()), "<user>")]:
        text = text.replace(raw.replace("\\", "\\\\"), replacement)
        text = text.replace(raw, replacement).replace(raw.replace("\\", "/"), replacement)
    return text


def clean_log(text):
    return "\n".join(line.rstrip() for line in portable(text).splitlines()).rstrip() + "\n"


logs = ["rust-tests.log", "rust-tests-configured.log", "rust-tests-final.log", "npm-ci.log",
        "wasm-build-configured.log", "wasm-mt-build.log", "web-build-st.log", "web-build-mt.log",
        "mt-patch.log", "embedded-build.log", "native-smoke.log", "seam-routing.log", "source-smoke.log"]
for name in logs:
    folder = OUT / "logs"
    folder.mkdir(exist_ok=True)
    (folder / name).write_text(clean_log((RUNS / name).read_text(encoding="utf-8-sig")), encoding="utf-8", newline="\n")

help_file = OUT / "cli-help.txt"
help_file.write_text(clean_log(help_file.read_text(encoding="utf-8-sig")), encoding="utf-8", newline="\n")


def browser_report(name):
    data = json.loads((RUNS / name).read_text(encoding="utf-8-sig"))
    tests = []
    def walk(s):
        for spec in s.get("specs", []):
            for test in spec["tests"]:
                tests.append({"title": spec["title"], "file": spec["file"], "line": spec["line"],
                              "outcome": test["status"], "expected_status": test["expectedStatus"],
                              "results": [{"status": r["status"], "duration_ms": r["duration"],
                                           "errors": [portable(e.get("message", "")) for e in r.get("errors", [])]}
                                          for r in test["results"]]})
        for child in s.get("suites", []):
            walk(child)
    for suite in data["suites"]:
        walk(suite)
    return {"stats": data["stats"], "tests": tests}


rust = (RUNS / "rust-tests-final.log").read_text(encoding="utf-8-sig")
native = [tuple(map(int, m)) for m in re.findall(r"test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored", rust)]
summary = {
    "source": {"version": "2.9.4", "commit": "5d8df15b798b859faf72248a35d156d6e9aaffc7", "audit_date_dubai": "2026-10-29"},
    "log_note": "Local workspace/user path prefixes, line endings and trailing log whitespace are normalized. Test outcomes are not changed.",
    "rust": {"command": "cargo test --release --workspace --no-fail-fast", "passed": sum(x[0] for x in native),
             "failed": sum(x[1] for x in native), "ignored": sum(x[2] for x in native)},
    "browser_single_thread_initial": browser_report("e2e-st.json"),
    "browser_single_thread_border_after_sync_fix": browser_report("e2e-st-border-retry.json"),
    "browser_multi_thread_after_fixes": {"environment": {"EXPECT_THREADS": "1"}, **browser_report("e2e-mt.json")},
    "not_run": ["macOS/Linux execution", "Safari/Firefox", "Tauri/WebView2/WKWebView", "clean-machine disconnected installs",
                "exhaustive value combinations for all parameters", "replacement UI parity (UI not implemented)"]
}
(OUT / "test-results.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

for name in ["npm-audit.json", "artifact-validation.json", "source-artifact-validation.json", "layout-validation.json",
             "seam-routing.json", "package-sizes.json", "embedded-http-check.json", "release-diagnostic.json",
             "site-st-manifest.json"]:
    text = portable((RUNS / name).read_text(encoding="utf-8-sig"))
    (OUT / name).write_text(text.rstrip() + "\n", encoding="utf-8", newline="\n")

smoke = json.loads((RUNS / "source-smoke/summary.json").read_text(encoding="utf-8-sig"))
smoke.pop("body", None)
(OUT / "source-browser-smoke.json").write_text(json.dumps(smoke, indent=2) + "\n", encoding="utf-8", newline="\n")
print(f"Collected Rust {summary['rust']['passed']} passing tests and all browser outcomes, including original failures.")
