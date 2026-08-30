# Sky Chess Lab

A physical AI chess tutor by Decision Systems Lab, featuring Sky.

This repository contains the hackathon MVP: a polished browser interface, a
legal chess game powered by `python-chess`, Sky's animated coaching reactions,
and a camera-calibration tool for turning an angled Mac camera view into a
normalized 8x8 board.

Sky has eight separate transparent reaction poses in `assets/sky/reactions`.
The UI combines pose transitions, idle breathing, speaking motion, live text,
and voice output so she feels present rather than like a single static image.
The target calibration experience is shown in `assets/ui/calibration-concept.png`.

## Run the app

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5050>. Click one of your white pieces, then click a
highlighted square. Sky will respond with a legal black move. Press **Hear Sky**
to use the browser's built-in voice.

## Calibrate the physical board

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
- [ ] Occupancy baseline from the physical board
- [ ] Lift/drop move detection
- [ ] Connect physical moves to the game loop
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
