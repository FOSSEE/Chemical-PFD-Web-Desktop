import os
from PyQt5 import QtWidgets
from PyQt5.QtCore import Qt, QPoint
from PyQt5.QtWidgets import QMainWindow, QWidget, QVBoxLayout, QLabel

from src.component_library import ComponentLibrary
import src.app_state as app_state
from src.theme import apply_theme_to_screen

class CanvasWidget(QWidget):
    """Simple canvas area that accepts drops and places basic widgets."""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("canvasArea")
        self.setAcceptDrops(True)
        self.setStyleSheet("""
            QWidget#canvasArea {
                background: transparent;
            }
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0,0,0,0)
        layout.setAlignment(Qt.AlignTop | Qt.AlignLeft)

    def dragEnterEvent(self, event):
        if event.mimeData().hasText():
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event):
        text = event.mimeData().text()
        pos = event.pos()
        self.add_component_label(text, pos)
        event.acceptProposedAction()

    def add_component_label(self, text, pos: QPoint):
        """Creates a simple label at the drop position. Replace with your real component creation."""
        lbl = QLabel(text, self)
        lbl.setAttribute(Qt.WA_TransparentForMouseEvents, False)
        lbl.move(pos)
        lbl.setStyleSheet("""
            QLabel {
                background: rgba(255,255,255,230);
                border: 1px solid #999;
                padding: 6px;
                border-radius: 6px;
                font: 9pt "Segoe UI";
            }
        """)
        lbl.show()
        lbl.adjustSize()


class CanvasScreen(QMainWindow):
    """
    QMainWindow so we can attach docks (ComponentLibrary) easily.
    We'll embed a central QWidget named 'bgwidget' so theme.apply works.
    """
    def __init__(self):
        super().__init__()

        # central container (bgwidget) so theme.apply_theme_to_screen can find it
        central = QWidget()
        central.setObjectName("bgwidget")
        self.setCentralWidget(central)

        # layout for central area
        central_layout = QVBoxLayout(central)
        central_layout.setContentsMargins(0,0,0,0)

        # actual canvas
        self.canvas = CanvasWidget(self)
        central_layout.addWidget(self.canvas)

        # Create and add the component library (dock)
        self.library = ComponentLibrary(self)
        # library is a QDockWidget already
        self.addDockWidget(Qt.LeftDockWidgetArea, self.library)

        # allow floating / moving and max width
        self.library.setFeatures(self.library.features() | QtWidgets.QDockWidget.DockWidgetClosable)
        # If you want library initially collapsed or hidden:
        # self.library.hide()

        # Apply theme (theme module expects a child named 'bgwidget')
        apply_theme_to_screen(self)


    # Helper: expose a method to programmatically toggle the dock visibility
    def toggle_library(self, show: bool):
        self.library.setVisible(show)
