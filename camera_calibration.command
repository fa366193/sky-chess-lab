#!/bin/zsh

set -e

PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR"

if [[ ! -x ".venv/bin/python" ]]; then
  echo "Run start_sky_chess.command once before calibration."
  read -k 1 "?Press any key to close."
  exit 1
fi

echo "Click the four INNER chessboard corners in this order:"
echo "1. Top-left"
echo "2. Top-right"
echo "3. Bottom-right"
echo "4. Bottom-left"
echo ""
echo "Press S to save, R to reset, or Q to quit."
.venv/bin/python -m vision.calibration
