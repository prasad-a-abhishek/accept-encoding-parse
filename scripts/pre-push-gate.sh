#!/bin/bash
# pre-push gate for accept-encoding-parse
# Fails if: tests fail, secrets detected, working tree dirty, or QA_REPORT does not end with VERDICT: SHIP
set -e

cd /root/projects/accept-encoding-parse

echo "[pre-push] running accept-encoding-parse gate..."

# 1. Tests must pass
echo "[pre-push] running tests..."
npm test || { echo "[pre-push] FAILED: tests failed"; exit 1; }
echo "[pre-push] tests OK"

# 2. No secrets
echo "[pre-push] scanning for secrets..."
if grep -r -i -E "(password|secret|api_key|apikey|token|auth)\s*=\s*['\"][a-zA-Z0-9]" src/ tests/ 2>/dev/null; then
    echo "[pre-push] FAILED: potential secret found"
    exit 1
fi
echo "[pre-push] secrets scan OK"

# 3. QA_REPORT must end with VERDICT: SHIP
echo "[pre-push] verifying QA_REPORT.md..."
if [ ! -f QA_REPORT.md ]; then
    echo "[pre-push] FAILED: QA_REPORT.md not found"
    exit 1
fi
grep -q "^VERDICT: SHIP" QA_REPORT.md || { echo "[pre-push] FAILED: QA_REPORT.md missing VERDICT: SHIP"; exit 1; }
echo "[pre-push] QA_REPORT verdict OK"

# 4. Working tree must be clean (the gate itself does not commit)
echo "[pre-push] checking working tree..."
if [ -n "$(git status --porcelain)" ]; then
    echo "[pre-push] FAILED: working tree is dirty"
    git status --short
    exit 1
fi
echo "[pre-push] working tree clean"

echo "[pre-push] gate passed"
exit 0
