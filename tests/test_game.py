import unittest

from app import app
from chess_engine.game import ChessGame
from chess_engine.sky_player import SkyPlayer


class ChessGameTests(unittest.TestCase):
    def test_opening_move_and_sky_reply(self):
        game = ChessGame()
        self.assertEqual(game.legal_destinations("e2"), ["e3", "e4"])
        result = game.play("e2", "e4")
        self.assertTrue(result.ok)
        sky_move = SkyPlayer().choose_move(game.board)
        self.assertIn(sky_move, game.board.legal_moves)

    def test_illegal_move_is_rejected(self):
        game = ChessGame()
        result = game.play("e2", "e5")
        self.assertFalse(result.ok)
        self.assertEqual(game.board.fullmove_number, 1)

    def test_starting_as_black_makes_sky_move_first(self):
        client = app.test_client()
        data = client.post("/api/start", json={"color": "black"}).get_json()
        self.assertEqual(data["humanColor"], "black")
        self.assertIn("lastSkyMove", data)
        self.assertEqual(len(data["lastSkyMove"]), 4)

    def test_starting_as_white_leaves_first_move_to_player(self):
        client = app.test_client()
        data = client.post("/api/start", json={"color": "white"}).get_json()
        self.assertEqual(data["humanColor"], "white")
        self.assertNotIn("lastSkyMove", data)


if __name__ == "__main__":
    unittest.main()
