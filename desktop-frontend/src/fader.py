
from PyQt5 import QtWidgets, QtGui, QtCore

class ThemeFader(QtWidgets.QWidget):
    def __init__(self, parent):
        super().__init__(parent)
        self.setAttribute(QtCore.Qt.WA_TransparentForMouseEvents)  # Let clicks pass through if needed, though usually we block interaction during fade
        self.setAttribute(QtCore.Qt.WA_DeleteOnClose)
        self.setGeometry(parent.rect())
        
        # Grab screenshot of parent
        self.pixmap = parent.grab()
        
        self.show()
        
        # Setup fade animation
        self.opacity_effect = QtWidgets.QGraphicsOpacityEffect(self)
        self.setGraphicsEffect(self.opacity_effect)
        
        self.anim = QtCore.QPropertyAnimation(self.opacity_effect, b"opacity")
        self.anim.setDuration(350) # ms
        self.anim.setStartValue(1.0)
        self.anim.setEndValue(0.0)
        self.anim.finished.connect(self.close)
        self.anim.start()

    def paintEvent(self, event):
        painter = QtGui.QPainter(self)
        painter.drawPixmap(0, 0, self.pixmap)
