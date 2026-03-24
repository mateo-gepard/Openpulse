#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# OpenPulse Test Runner
# Compiles and runs the desktop test harness
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FRAMEWORK_DIR="$PROJECT_ROOT/firmware/src/framework"
TEST_DIR="$PROJECT_ROOT/firmware/test"
OUTPUT="$TEST_DIR/test_runner"

echo "═══════════════════════════════════════════"
echo "  OpenPulse Test Harness — Build & Run"
echo "═══════════════════════════════════════════"
echo ""

# Compile
echo "Compiling..."
clang++ -std=c++17 \
    -I"$FRAMEWORK_DIR" \
    -Wall -Wextra -Wpedantic \
    -O2 \
    -o "$OUTPUT" \
    "$TEST_DIR/test_runner.cpp"

echo "Compiled successfully."
echo ""

# Run
"$OUTPUT"
EXIT_CODE=$?

# Cleanup binary
rm -f "$OUTPUT"

exit $EXIT_CODE
