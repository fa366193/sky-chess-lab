# Sky Chess Lab

A physical AI chess tutor by Decision Systems Lab, featuring Sky.

This repository contains the hackathon MVP: a polished browser interface, a
legal chess game powered by `python-chess`, Sky's animated coaching reactions,
and a camera-calibration tool for turning an angled Mac camera view into a
normalized 8x8 board.

Sky has eight separate transparent reaction poses in `assets/sky/reactions`.
The UI combines pose transitions, continuous idle breathing, attention shifts,
micro-movements, speaking motion, live text, microphone listening, and voice
output so she feels present rather than like a single static image. Sky stops
listening while she speaks and automatically resumes afterward.
The target calibration experience is shown in `assets/ui/calibration-concept.png`.

## Run the app

### Easiest way on a Mac

Double-click `start_sky_chess.command`. The first launch creates the Python
environment, installs the requirements, starts the app, and opens it in your
browser. Leave the Terminal window open while playing.

If macOS blocks the first launch, Control-click the file, choose **Open**, then
confirm **Open**.

### Terminal method

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5050>. The app immediately requests the Mac camera and
walks through four-corner calibration of the physical board. After calibration,
choose White or Black and the interface transforms into Sky sitting at her
desk. There is intentionally no digital chessboard in the play interface.

Press **Hear Sky** to use the browser's built-in voice. After color selection,
the camera learns a baseline of all 64 physical squares. It waits for hand
motion to finish, compares the settled position with that baseline, and accepts
only a changed-square pair that belongs to the player's selected color and
matches a legal move. Board orientation is locked from the selected side. When
Sky announces a move, the detector switches to strict synchronization mode and
accepts only her exact announced origin and destination. A wrong destination
produces a spoken correction without advancing the game. The collapsible
recovery control beneath the room scene remains
available for difficult lighting conditions and accepts notation such as
`e2e4`.

The play header includes a live vision meter (`Δ score · changed squares`). A
completed move should settle with at least two changed squares. This makes
lighting, framing, and sensitivity problems visible instead of silently failing.

Sky uses Stockfish 18 at bounded strength for strategic move selection. The
rule-based legal player remains available automatically if Stockfish is not
installed.

## Calibrate the physical board

Camera calibration is now built into the opening screen. macOS or your browser
may ask for camera access on the first run; choose **Allow**. The standalone
`camera_calibration.command` remains available as a computer-vision diagnostic.
Sky appears throughout setup and gives a new spoken-style instruction after
each selected corner.

After the four corners, a required smart verification wizard prevents play
until the real board passes four checks: Sky identifies the white `e2` pawn,
identifies the black `e7` pawn, recognizes `e2 → e4`, and recognizes `e7 → e5`.
Both pawns must be returned to their starting squares. These checks determine
physical orientation and tune the change threshold from the actual camera,
pieces, and lighting instead of inferring orientation from the player's color.

## Camera lifecycle

- **Pause game** stops the camera, visual detector, microphone, and speech.
- **Resume game** requests the camera again and relearns the current position.
- **End game** stops all camera and microphone access and resets the game.
- **Start new game** turns the camera back on and returns to guided calibration.

With the chessboard fully visible to the Mac camera:

```bash
source .venv/bin/activate
python -m vision.calibration
```

Click the inner corners of the 8x8 grid in this order: top-left, top-right,
bottom-right, bottom-left. Press `S` to save `calibration.json`, `R` to reset,
and `Q` to quit.

## MVP roadmap

- [x] Sky-branded playable interface
- [x] Legal move highlighting and validation
- [x] Sky opponent and coaching dialogue
- [x] Voice output
- [x] Four-corner camera calibration
- [x] Occupancy/appearance baseline from the physical board
- [x] Settled-frame physical move detection
- [x] Connect detected physical moves to the game loop
- [ ] Stockfish evaluation and difficulty controls
- [ ] Addressable physical lighting

## Project layout

```text
app.py                  Flask app and JSON API
chess_engine/game.py    authoritative chess state
chess_engine/sky_player.py  Sky move choice and dialogue
vision/camera.py        camera access
vision/calibration.py   perspective calibration
ui/templates/           interface markup
ui/static/              visual design and interactions
```
