import random
import shutil
from pathlib import Path

import chess
import chess.engine


class SkyPlayer:
    """A quick, intentionally gentle opponent for the hackathon MVP."""

    def __init__(self, use_engine=True):
        self.engine = None
        self.use_engine = use_engine

    def _stockfish_path(self):
        discovered = shutil.which("stockfish")
        if discovered:
            return discovered
        homebrew = Path("/opt/homebrew/opt/stockfish/bin/stockfish")
        return str(homebrew) if homebrew.exists() else None

    def _engine(self):
        if not self.use_engine:
            return None
        if self.engine is None:
            path = self._stockfish_path()
            if path:
                self.engine = chess.engine.SimpleEngine.popen_uci(path)
                options = self.engine.options
                settings = {}
                if "UCI_LimitStrength" in options:
                    settings["UCI_LimitStrength"] = True
                if "UCI_Elo" in options:
                    minimum = options["UCI_Elo"].min or 1320
                    settings["UCI_Elo"] = max(minimum, 1450)
                if settings:
                    self.engine.configure(settings)
        return self.engine

    def choose_move(self, board):
        engine = self._engine()
        if engine:
            try:
                return engine.play(board, chess.engine.Limit(time=0.35)).move
            except Exception:
                # A local engine can be interrupted by app restarts. The legal
                # rule-based player below keeps the game responsive.
                pass
            finally:
                try:
                    engine.quit()
                except chess.engine.EngineError:
                    pass
                self.engine = None
        moves = list(board.legal_moves)
        captures = [move for move in moves if board.is_capture(move)]
        checks = [move for move in moves if board.gives_check(move)]
        developing = [
            move for move in moves
            if board.piece_at(move.from_square)
            and board.piece_at(move.from_square).piece_type in (chess.KNIGHT, chess.BISHOP)
        ]
        pool = checks or captures or developing or moves
        return random.choice(pool)

    def react_to_human_move(self, board, move, was_capture=False):
        if board.is_check():
            return "You found a check—sharp eyes.", "surprised"
        if was_capture:
            return "A capture changes the balance. Keep watching what is defended.", "thinking"
        piece = board.piece_at(move.to_square)
        if piece and piece.piece_type in (chess.KNIGHT, chess.BISHOP):
            return "Nice development. More active pieces give you more choices.", "happy"
        if move.to_square in (chess.D4, chess.E4, chess.D5, chess.E5):
            return "You're claiming space in the center. I like the intention.", "happy"
        return "Interesting choice. Let's see how the position changes.", "thinking"

    def game_over_message(self, board):
        if board.is_checkmate():
            winner = "White" if not board.turn else "Black"
            return f"Checkmate—{winner} wins. Want to reset and explore a different plan?"
        return "Game complete. Every position leaves us something to learn."
