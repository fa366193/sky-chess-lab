#!/bin/zsh

set -e

PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR"

if [[ ! -x ".venv/bin/python" ]]; then
  echo "Setting up Sky Chess Lab for the first time…"
  python3 -m venv .venv
fi

if ! .venv/bin/python -c "import flask, chess, cv2" >/dev/null 2>&1; then
  echo "Installing Sky Chess Lab requirements…"
  .venv/bin/python -m pip install -r requirements.txt
fi

if curl --silent --fail http://127.0.0.1:5050/api/game >/dev/null 2>&1; then
  echo "Sky Chess Lab is already running."
  open http://127.0.0.1:5050
  exit 0
fi

echo "Starting Sky Chess Lab…"
echo "Leave this window open while you play."
echo "Press Control-C here when you are finished."
(sleep 1; open http://127.0.0.1:5050) &
exec .venv/bin/python app.py
