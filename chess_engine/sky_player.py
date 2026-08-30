import random

import chess


class SkyPlayer:
    """A quick, intentionally gentle opponent for the hackathon MVP."""

    def choose_move(self, board):
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
