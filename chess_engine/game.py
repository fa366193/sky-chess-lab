from dataclasses import dataclass
from typing import Optional

import chess


@dataclass
class MoveResult:
    ok: bool
    move: Optional[chess.Move] = None
    error: Optional[str] = None
    was_capture: bool = False


class ChessGame:
    def __init__(self):
        self.board = chess.Board()

    def reset(self):
        self.board.reset()

    def snapshot(self):
        return {
            "fen": self.board.fen(),
            "pieces": {
                chess.square_name(square): piece.symbol()
                for square, piece in self.board.piece_map().items()
            },
            "turn": "white" if self.board.turn else "black",
            "moveNumber": self.board.fullmove_number,
            "check": self.board.is_check(),
            "gameOver": self.board.is_game_over(),
            "result": self.board.result() if self.board.is_game_over() else None,
        }

    def legal_destinations(self, square_name):
        try:
            origin = chess.parse_square(square_name)
        except ValueError:
            return []
        return sorted({chess.square_name(move.to_square) for move in self.board.legal_moves if move.from_square == origin})

    def play(self, origin, destination, promotion="q"):
        uci = f"{origin}{destination}"
        piece = self.board.piece_at(chess.parse_square(origin)) if origin in chess.SQUARE_NAMES else None
        if piece and piece.piece_type == chess.PAWN and destination[-1:] in ("1", "8"):
            uci += promotion if promotion in "qrbn" else "q"
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            return MoveResult(False, error="Invalid move notation")
        if move not in self.board.legal_moves:
            return MoveResult(False, error="Illegal move")
        was_capture = self.board.is_capture(move)
        self.board.push(move)
        return MoveResult(True, move=move, was_capture=was_capture)

    def push(self, move):
        self.board.push(move)

    def describe_move(self, move):
        piece = self.board.piece_at(move.to_square)
        names = {1: "pawn", 2: "knight", 3: "bishop", 4: "rook", 5: "queen", 6: "king"}
        return f"{names.get(piece.piece_type, 'piece')} from {chess.square_name(move.from_square)} to {chess.square_name(move.to_square)}"
