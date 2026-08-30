import json
from pathlib import Path

import cv2
import numpy as np

from vision.camera import Camera


BOARD_SIZE = 800
OUTPUT = Path("calibration.json")


def run():
    camera = Camera()
    points = []
    window = "Sky Chess — Calibration"

    def click(event, x, y, _flags, _param):
        if event == cv2.EVENT_LBUTTONDOWN and len(points) < 4:
            points.append((x, y))
            print(f"Corner {len(points)}: {x}, {y}")

    cv2.namedWindow(window)
    cv2.setMouseCallback(window, click)
    print("Click: top-left, top-right, bottom-right, bottom-left. S saves; R resets; Q quits.")

    try:
        while True:
            frame = camera.read()
            display = frame.copy()
            for index, point in enumerate(points):
                cv2.circle(display, point, 8, (49, 95, 214), -1)
                cv2.putText(display, str(index + 1), (point[0] + 10, point[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, .7, (49, 95, 214), 2)
            cv2.imshow(window, display)

            if len(points) == 4:
                destination = np.float32([[0, 0], [BOARD_SIZE, 0], [BOARD_SIZE, BOARD_SIZE], [0, BOARD_SIZE]])
                matrix = cv2.getPerspectiveTransform(np.float32(points), destination)
                warped = cv2.warpPerspective(frame, matrix, (BOARD_SIZE, BOARD_SIZE))
                for position in range(0, BOARD_SIZE + 1, BOARD_SIZE // 8):
                    cv2.line(warped, (position, 0), (position, BOARD_SIZE), (56, 179, 116), 1)
                    cv2.line(warped, (0, position), (BOARD_SIZE, position), (56, 179, 116), 1)
                cv2.imshow("Sky Chess — Flattened Board", warped)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("r"):
                points.clear()
            if key == ord("s") and len(points) == 4:
                OUTPUT.write_text(json.dumps({"points": points, "board_size": BOARD_SIZE}, indent=2))
                print(f"Saved {OUTPUT.resolve()}")
    finally:
        camera.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    run()

