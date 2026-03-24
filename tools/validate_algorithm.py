#!/usr/bin/env python3
"""
OpenPulse Skill Compliance Validator
─────────────────────────────────────
Validates that generated algorithm code follows ALL rules from SKILL.md.
Checks spec completeness, firmware code compliance, and test coverage.

Usage:
    python3 tools/validate_algorithm.py algorithms/A01_heart_rate/
    python3 tools/validate_algorithm.py algorithms/A01_heart_rate/ --strict
    python3 tools/validate_algorithm.py --all

Returns exit code 0 if all checks pass, 1 if any fail.
"""

import argparse
import os
import re
import sys
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


# ─── Result Types ───────────────────────────────────────────────

@dataclass
class CheckResult:
    name: str
    passed: bool
    message: str
    severity: str = "error"  # "error", "warning", "info"


@dataclass
class ValidationReport:
    algorithm_id: str
    algorithm_dir: str
    checks: list = field(default_factory=list)

    def add(self, name: str, passed: bool, message: str, severity: str = "error"):
        self.checks.append(CheckResult(name, passed, message, severity))

    @property
    def passed(self) -> int:
        return sum(1 for c in self.checks if c.passed)

    @property
    def failed(self) -> int:
        return sum(1 for c in self.checks if not c.passed and c.severity == "error")

    @property
    def warnings(self) -> int:
        return sum(1 for c in self.checks if not c.passed and c.severity == "warning")

    @property
    def total(self) -> int:
        return len(self.checks)

    @property
    def all_passed(self) -> bool:
        return self.failed == 0

    def print_report(self):
        print(f"\n{'═' * 60}")
        print(f"  Validation: {self.algorithm_id}")
        print(f"  Directory:  {self.algorithm_dir}")
        print(f"{'═' * 60}")

        for check in self.checks:
            if check.passed:
                icon = "✅"
            elif check.severity == "warning":
                icon = "⚠️ "
            else:
                icon = "❌"
            print(f"  {icon} {check.name}")
            print(f"      {check.message}")

        print(f"\n{'─' * 60}")
        status = "PASSED" if self.all_passed else "FAILED"
        color = "" if self.all_passed else ""
        print(f"  RESULT: {self.passed}/{self.total} passed", end="")
        if self.failed > 0:
            print(f", {self.failed} FAILED", end="")
        if self.warnings > 0:
            print(f", {self.warnings} warnings", end="")
        print(f"  [{status}]")
        print(f"{'═' * 60}\n")


# ─── Spec Validation ───────────────────────────────────────────

REQUIRED_SPEC_SECTIONS = [
    "Classification",
    "Sensor Input",
    "Algorithm",
    "Output",
    "Edge Cases",
    "Medical References",
    "Test Vectors",
]

REQUIRED_CLASSIFICATION_FIELDS = [
    "Layer",
    "Tier",
    "Regulatory",
    "Dependencies",
]

VALID_LAYERS = ["Base", "Cross-Sensor", "Composite"]
VALID_TIERS = ["0", "1", "2", "3"]
VALID_REGULATORY = ["Wellness", "Health Indicator", "Health Screening"]


def validate_spec(algo_dir: str, report: ValidationReport):
    """Validate the spec.md file."""
    spec_path = os.path.join(algo_dir, "spec.md")

    if not os.path.exists(spec_path):
        report.add("Spec exists", False, f"spec.md not found at {spec_path}")
        return None

    with open(spec_path, "r") as f:
        spec_content = f.read()

    report.add("Spec exists", True, f"Found {len(spec_content)} bytes")

    # Check required sections
    missing_sections = []
    for section in REQUIRED_SPEC_SECTIONS:
        # Look for heading lines containing the section name
        found = False
        for line in spec_content.split("\n"):
            stripped = line.strip()
            if stripped.startswith("#") and section.lower() in stripped.lower():
                found = True
                break
        if not found:
            missing_sections.append(section)

    if missing_sections:
        report.add("Spec sections complete", False,
                    f"Missing sections: {', '.join(missing_sections)}")
    else:
        report.add("Spec sections complete", True,
                    f"All {len(REQUIRED_SPEC_SECTIONS)} required sections present")

    # Check classification fields
    reg_class = None
    uses_ppg_ecg = False
    classification_section = extract_section(spec_content, "Classification")
    if classification_section:
        missing_fields = []
        for field_name in REQUIRED_CLASSIFICATION_FIELDS:
            if field_name.lower() not in classification_section.lower():
                missing_fields.append(field_name)

        if missing_fields:
            report.add("Classification fields", False,
                        f"Missing: {', '.join(missing_fields)}")
        else:
            report.add("Classification fields", True,
                        "Layer, Tier, Regulatory, Dependencies all specified")

        # Validate specific values
        layer_match = re.search(r"Layer.*?:\s*(.+)", classification_section)
        if layer_match:
            layer = layer_match.group(1).strip()
            if not any(v in layer for v in VALID_LAYERS):
                report.add("Valid layer", False,
                            f"'{layer}' not in {VALID_LAYERS}", "warning")

        tier_match = re.search(r"Tier.*?:\s*(\d)", classification_section)
        if tier_match:
            tier = tier_match.group(1)
            if tier not in VALID_TIERS:
                report.add("Valid tier", False,
                            f"Tier {tier} not in {VALID_TIERS}", "warning")

        regulatory_match = re.search(r"Regulatory.*?:\s*(.+)", classification_section)
        if regulatory_match:
            reg = regulatory_match.group(1).strip()
            if not any(v in reg for v in VALID_REGULATORY):
                report.add("Valid regulatory", False,
                            f"'{reg}' not in {VALID_REGULATORY}", "warning")
            if "Screening" in reg:
                reg_class = "screening"
            elif "Indicator" in reg:
                reg_class = "indicator"
            else:
                reg_class = "wellness"

    # Check sensor input completeness
    sensor_section = extract_section(spec_content, "Sensor Input")
    if sensor_section:
        required_sensor_fields = ["Chip", "Sample Rate", "Buffer Size"]
        missing = [f for f in required_sensor_fields if f.lower() not in sensor_section.lower()]
        if missing:
            report.add("Sensor input complete", False,
                        f"Missing: {', '.join(missing)}")
        else:
            report.add("Sensor input complete", True,
                        "Chip, Sample Rate, Buffer Size specified")
        uses_ppg_ecg = any(s in sensor_section.lower()
                          for s in ["ppg", "ecg", "max86150", "max30102"])

    # Check test vectors (minimum 5)
    test_section = extract_section(spec_content, "Test Vectors")
    if test_section:
        # Count table rows (lines starting with |, excluding header/separator)
        rows = [l for l in test_section.split("\n")
                if l.strip().startswith("|") and not l.strip().startswith("| #")
                and not l.strip().startswith("|--") and not l.strip().startswith("|-")
                and l.strip() != "|"]
        # Filter out the header row
        data_rows = [r for r in rows
                     if "Input Scenario" not in r and "---" not in r]
        count = len(data_rows)
        if count < 5:
            report.add("Test vectors (≥5)", False,
                        f"Only {count} test vectors found (minimum 5 required)")
        else:
            report.add("Test vectors (≥5)", True,
                        f"{count} test vectors defined")

    # Check medical references
    ref_section = extract_section(spec_content, "Medical References")
    if ref_section:
        # Count numbered references
        refs = re.findall(r"^\d+\.", ref_section, re.MULTILINE)
        if len(refs) < 1:
            report.add("Medical references", False,
                        "No numbered references found")
        else:
            report.add("Medical references", True,
                        f"{len(refs)} reference(s) cited")

    # Check edge cases table
    edge_section = extract_section(spec_content, "Edge Cases")
    if edge_section:
        edge_rows = [l for l in edge_section.split("\n")
                     if l.strip().startswith("|") and "Condition" not in l
                     and "---" not in l and l.strip() != "|"]
        if len(edge_rows) < 3:
            report.add("Edge cases (≥3)", False,
                        f"Only {len(edge_rows)} edge cases (minimum 3)", "warning")
        else:
            report.add("Edge cases (≥3)", True,
                        f"{len(edge_rows)} edge cases defined")

    return {"regulatory": reg_class, "uses_ppg_ecg": uses_ppg_ecg}


# ─── Code Validation ───────────────────────────────────────────

FORBIDDEN_PATTERNS = {
    "malloc": (r"\bmalloc\s*\(", "Dynamic allocation (malloc) forbidden — use static buffers"),
    "new": (r"\bnew\s+\w", "Dynamic allocation (new) forbidden — use static buffers"),
    "String": (r"\bString\s+\w", "Arduino String class forbidden — use char[]"),
    "delay": (r"\bdelay\s*\(", "delay() forbidden — use state machines"),
    "double": (r"\bdouble\s+\w", "double type forbidden — use float (Cortex-M4)"),
}

REQUIRED_PATTERNS = {
    "AlgoState usage": r"AlgoState::",
    "SQI computation": r"sqi|computeSQI|signal.quality",
    "State machine": r"state_\s*=\s*AlgoState::",
    "Physiological clamping": r"constrain|clamp|fmin.*fmax|min.*max",
    "Output valid flag": r"\.valid\s*=",
    "Timestamp": r"timestamp|now_ms",
}


def validate_code(algo_dir: str, report: ValidationReport, spec_info: Optional[dict]):
    """Validate firmware .h and .cpp files."""
    h_files = list(Path(algo_dir).glob("*.h"))
    cpp_files = list(Path(algo_dir).glob("*.cpp"))

    # Also check in firmware/src/algorithms/
    project_root = find_project_root(algo_dir)
    if project_root:
        algo_id = os.path.basename(algo_dir).split("_")[0].upper()
        for subdir in ["base", "fusion"]:
            fw_dir = os.path.join(project_root, "firmware", "src", "algorithms", subdir)
            h_files.extend(Path(fw_dir).glob(f"*{algo_id}*.*h"))
            cpp_files.extend(Path(fw_dir).glob(f"*{algo_id}*.*cpp"))

    all_code_files = h_files + cpp_files

    if not all_code_files:
        report.add("Code files exist", False,
                    "No .h or .cpp files found (algorithm not yet implemented)")
        return

    report.add("Code files exist", True,
                f"{len(h_files)} header(s), {len(cpp_files)} source(s)")

    # Read all code
    all_code = ""
    for f in all_code_files:
        with open(f, "r") as fh:
            all_code += fh.read() + "\n"

    # Check forbidden patterns
    for name, (pattern, message) in FORBIDDEN_PATTERNS.items():
        matches = re.findall(pattern, all_code)
        if matches:
            report.add(f"No {name}", False,
                        f"{message} — found {len(matches)} occurrence(s)")
        else:
            report.add(f"No {name}", True,
                        f"No {name} usage found")

    # Check required patterns
    for name, pattern in REQUIRED_PATTERNS.items():
        if re.search(pattern, all_code, re.IGNORECASE):
            report.add(name, True, "Pattern found in code")
        else:
            report.add(name, False,
                        f"Required pattern not found: {pattern}")

    # Check citation comments
    # Look for lines with mathematical operators near comment lines
    code_lines = all_code.split("\n")
    formula_lines = []
    citation_lines = []
    for i, line in enumerate(code_lines):
        stripped = line.strip()
        # Lines with math operations (excluding loop counters, array indices)
        if re.search(r"[+\-*/]\s*(?:0\.\d+|\d+\.\d+)", stripped) and not stripped.startswith("//"):
            formula_lines.append(i)
        # Citation comments
        if re.search(r"(Source|Citation|Reference|DOI|Paper|AN\d+)", stripped, re.IGNORECASE):
            citation_lines.append(i)

    if formula_lines:
        # Check that at least some formulas have nearby citations
        cited_formulas = 0
        for fl in formula_lines:
            # Look within 5 lines above for a citation
            for cl in citation_lines:
                if 0 <= fl - cl <= 5:
                    cited_formulas += 1
                    break

        ratio = cited_formulas / len(formula_lines) if formula_lines else 1.0
        if ratio < 0.5:
            report.add("Formula citations", False,
                        f"Only {cited_formulas}/{len(formula_lines)} formulas have nearby citations",
                        "warning")
        else:
            report.add("Formula citations", True,
                        f"{cited_formulas}/{len(formula_lines)} formulas have citations")

    # Motion rejection check (only for PPG/ECG algorithms)
    if spec_info and spec_info.get("uses_ppg_ecg"):
        has_motion = re.search(r"accel|motion|imu|movement", all_code, re.IGNORECASE)
        if has_motion:
            report.add("Motion artifact rejection", True,
                        "PPG/ECG algorithm includes motion checking")
        else:
            report.add("Motion artifact rejection", False,
                        "PPG/ECG algorithm MUST check IMU for motion artifacts")

    # Health screening disclaimer check
    if spec_info and spec_info.get("regulatory") == "screening":
        has_disclaimer = re.search(r"disclaimer|not.a.medical.device|HEALTH_SCREENING",
                                   all_code, re.IGNORECASE)
        if has_disclaimer:
            report.add("Health screening disclaimer", True,
                        "Disclaimer flag found")
        else:
            report.add("Health screening disclaimer", False,
                        "Health Screening algorithms MUST set disclaimer flag")
    elif spec_info and spec_info.get("regulatory"):
        report.add("Disclaimer check", True,
                    f"Not required (classification: {spec_info['regulatory']})", )


# ─── Test Vector Validation ────────────────────────────────────

def validate_tests(algo_dir: str, report: ValidationReport):
    """Check test vector file exists."""
    test_files = list(Path(algo_dir).glob("test_vectors*"))

    # Also check firmware/test/
    project_root = find_project_root(algo_dir)
    if project_root:
        algo_id = os.path.basename(algo_dir).split("_")[0].upper()
        test_dir = os.path.join(project_root, "firmware", "test")
        test_files.extend(Path(test_dir).glob(f"*{algo_id}*"))

    if test_files:
        report.add("Test vector file", True,
                    f"Found: {', '.join(f.name for f in test_files)}")
    else:
        report.add("Test vector file", False,
                    "No test_vectors file found", "warning")


# ─── Helpers ────────────────────────────────────────────────────

def extract_section(content: str, section_name: str) -> Optional[str]:
    """Extract content under a markdown heading."""
    pattern = rf"^(#{1,3})\s+.*{re.escape(section_name)}.*$"
    match = re.search(pattern, content, re.MULTILINE | re.IGNORECASE)
    if not match:
        return None

    level = len(match.group(1))  # Number of #
    start = match.end()

    # Find next heading of same or higher level
    next_heading = re.search(rf"^#{{{1},{level}}}\s+", content[start:], re.MULTILINE)
    if next_heading:
        return content[start:start + next_heading.start()]
    return content[start:]


def find_project_root(algo_dir: str) -> Optional[str]:
    """Find project root by looking for README.md."""
    current = os.path.abspath(algo_dir)
    for _ in range(5):
        parent = os.path.dirname(current)
        if os.path.exists(os.path.join(parent, "README.md")):
            return parent
        current = parent
    return None


def find_all_algorithm_dirs(project_root: str) -> list:
    """Find all algorithm directories."""
    algo_base = os.path.join(project_root, "algorithms")
    if not os.path.isdir(algo_base):
        return []
    dirs = []
    for entry in sorted(os.listdir(algo_base)):
        full = os.path.join(algo_base, entry)
        if os.path.isdir(full) and re.match(r"[AXC]\d{2}_", entry):
            dirs.append(full)
    return dirs


# ─── Main ───────────────────────────────────────────────────────

def validate_algorithm(algo_dir: str, strict: bool = False) -> ValidationReport:
    """Run all validations on an algorithm directory."""
    algo_name = os.path.basename(algo_dir)
    algo_id = algo_name.split("_")[0].upper() if "_" in algo_name else algo_name
    report = ValidationReport(algo_id, algo_dir)

    # Phase 1: Validate spec
    spec_info = validate_spec(algo_dir, report)

    # Phase 2: Validate code (if it exists)
    validate_code(algo_dir, report, spec_info)

    # Phase 3: Validate tests
    validate_tests(algo_dir, report)

    return report


def main():
    parser = argparse.ArgumentParser(
        description="Validate OpenPulse algorithm compliance with SKILL.md rules"
    )
    parser.add_argument("path", nargs="?",
                        help="Path to algorithm directory (e.g., algorithms/A01_heart_rate/)")
    parser.add_argument("--all", action="store_true",
                        help="Validate all algorithms")
    parser.add_argument("--strict", action="store_true",
                        help="Treat warnings as errors")
    parser.add_argument("--json", action="store_true",
                        help="Output as JSON")
    parser.add_argument("--summary", action="store_true",
                        help="Only show summary (no per-check details)")
    args = parser.parse_args()

    if not args.path and not args.all:
        parser.print_help()
        print("\nExamples:")
        print("  python3 tools/validate_algorithm.py algorithms/A01_heart_rate/")
        print("  python3 tools/validate_algorithm.py --all")
        print("  python3 tools/validate_algorithm.py --all --summary")
        sys.exit(0)

    reports = []

    if args.all:
        # Find project root
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        algo_dirs = find_all_algorithm_dirs(project_root)

        if not algo_dirs:
            print("No algorithm directories found.")
            sys.exit(1)

        print(f"\nValidating {len(algo_dirs)} algorithm directories...\n")

        for algo_dir in algo_dirs:
            report = validate_algorithm(algo_dir, args.strict)
            reports.append(report)

            if not args.summary and not args.json:
                report.print_report()

    else:
        algo_dir = os.path.abspath(args.path)
        if not os.path.isdir(algo_dir):
            print(f"Error: {algo_dir} is not a directory")
            sys.exit(1)

        report = validate_algorithm(algo_dir, args.strict)
        reports.append(report)

        if not args.json:
            report.print_report()

    # JSON output
    if args.json:
        output = []
        for r in reports:
            output.append({
                "id": r.algorithm_id,
                "dir": r.algorithm_dir,
                "passed": r.passed,
                "failed": r.failed,
                "warnings": r.warnings,
                "total": r.total,
                "all_passed": r.all_passed,
                "checks": [
                    {"name": c.name, "passed": c.passed,
                     "message": c.message, "severity": c.severity}
                    for c in r.checks
                ]
            })
        print(json.dumps(output, indent=2))
        sys.exit(0)

    # Summary (for --all)
    if len(reports) > 1:
        print(f"\n{'═' * 60}")
        print(f"  SUMMARY: {len(reports)} algorithms validated")
        print(f"{'═' * 60}")

        total_passed = 0
        total_failed = 0
        total_warnings = 0
        total_no_spec = 0

        for r in reports:
            status = "✅" if r.all_passed else "❌"
            has_spec = any(c.name == "Spec exists" and c.passed for c in r.checks)
            if not has_spec:
                status = "⬜"
                total_no_spec += 1
            elif r.all_passed:
                total_passed += 1
            else:
                total_failed += 1

            total_warnings += r.warnings

            if args.summary:
                print(f"  {status} {r.algorithm_id:6s}  {r.passed}/{r.total} checks", end="")
                if r.failed > 0:
                    print(f"  ({r.failed} failed)", end="")
                if r.warnings > 0:
                    print(f"  ({r.warnings} warn)", end="")
                if not has_spec:
                    print(f"  (no spec yet)", end="")
                print()

        print(f"\n  ✅ Compliant:  {total_passed}")
        print(f"  ❌ Non-compliant: {total_failed}")
        print(f"  ⬜ No spec yet: {total_no_spec}")
        print(f"  ⚠️  Total warnings: {total_warnings}")
        print(f"{'═' * 60}\n")

    # Exit code
    any_failed = any(not r.all_passed for r in reports)
    if args.strict:
        any_failed = any_failed or any(r.warnings > 0 for r in reports)
    sys.exit(1 if any_failed else 0)


if __name__ == "__main__":
    main()
