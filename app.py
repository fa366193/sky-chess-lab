import os

from flask import Flask, jsonify, render_template, request, send_from_directory

from chess_engine.game import ChessGame
from chess_engine.sky_player import SkyPlayer


app = Flask(__name__, template_folder="ui/templates", static_folder="ui/static")
game = ChessGame()
sky = SkyPlayer()
human_color = "white"


def snapshot(message=None, mood="neutral"):
    return {
        **game.snapshot(),
        "message": message or "Your move. Pick a piece and let's think it through.",
        "mood": mood,
        "humanColor": human_color,
    }


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/assets/<path:filename>")
def assets(filename):
    return send_from_directory("assets", filename)


@app.get("/api/game")
def get_game():
    return jsonify(snapshot())


@app.post("/api/legal-moves")
def legal_moves():
    square = (request.get_json(silent=True) or {}).get("square", "")
    return jsonify({"square": square, "moves": game.legal_destinations(square)})


@app.post("/api/move")
def move():
    payload = request.get_json(silent=True) or {}
    result = game.play(payload.get("from", ""), payload.get("to", ""), payload.get("promotion", "q"))
    if not result.ok:
        return jsonify({"error": result.error, **snapshot("That square isn't available. Try a highlighted move.", "surprised")}), 400

    reaction, mood = sky.react_to_human_move(game.board, result.move, result.was_capture)
    if game.board.is_game_over():
        return jsonify(snapshot(sky.game_over_message(game.board), "happy"))

    sky_move = sky.choose_move(game.board)
    game.push(sky_move)
    message = f"{reaction} My move is {game.describe_move(sky_move)}. Your turn."
    if game.board.is_game_over():
        message = sky.game_over_message(game.board)
    data = snapshot(message, mood)
    data["lastHumanMove"] = result.move.uci()
    data["lastSkyMove"] = sky_move.uci()
    return jsonify(data)


@app.post("/api/start")
def start():
    global human_color
    payload = request.get_json(silent=True) or {}
    human_color = payload.get("color", "white")
    if human_color not in ("white", "black"):
        human_color = "white"
    game.reset()
    if human_color == "black":
        sky_move = sky.choose_move(game.board)
        game.push(sky_move)
        data = snapshot(f"I'll take White. My first move is {game.describe_move(sky_move)}. Make that move for me, then we'll begin.", "move")
        data["lastSkyMove"] = sky_move.uci()
        return jsonify(data)
    return jsonify(snapshot("You're White, so you move first. I'm watching the physical board.", "neutral"))


@app.post("/api/reset")
def reset():
    game.reset()
    return jsonify(snapshot("Fresh board, fresh decisions.", "happy"))


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.environ.get("SKY_CHESS_PORT", "5050")),
        debug=os.environ.get("SKY_CHESS_DEBUG") == "1",
    )
