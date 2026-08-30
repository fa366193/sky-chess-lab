import cv2


class Camera:
    def __init__(self, index=0):
        self.capture = cv2.VideoCapture(index)
        if not self.capture.isOpened():
            raise RuntimeError("Could not open camera. Check macOS camera permissions.")

    def read(self):
        ok, frame = self.capture.read()
        if not ok:
            raise RuntimeError("Could not read a camera frame.")
        return frame

    def close(self):
        self.capture.release()

