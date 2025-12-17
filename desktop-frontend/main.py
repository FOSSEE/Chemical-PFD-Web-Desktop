import sys
from PyQt5.QtWidgets import QApplication, QStackedWidget
from PyQt5.QtCore import Qt, QCoreApplication

import src.app_state as app_state
from src.screens import WelcomeScreen, LoginScreen, CreateAccScreen
from src.canvas_screen import CanvasScreen
from src.landing_page import LandingPage
from src.navigation import slide_to_index


def load_stylesheet(app):
    import os
    path = os.path.join("ui", "assets", "styles.qss")
    if os.path.exists(path):
        with open(path, "r") as f:
            app.setStyleSheet(f.read())


def main():
    # high-DPI awareness
    QCoreApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    QCoreApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)


    app = QApplication(sys.argv)
    QApplication.setStyle('Fusion')
    load_stylesheet(app)

    stacked = QStackedWidget()
    stacked.setMinimumSize(1200, 800)

    # open maximized or fullscreen
    stacked.showMaximized()   # or 
    # stacked.showFullScreen()

    # Expose stacked widget globally for navigation/toast
    app_state.widget = stacked

    welcome = WelcomeScreen()
    login = LoginScreen()
    create = CreateAccScreen()
    landing = LandingPage()
    canvas = CanvasScreen()

    app_state.screens = {
    "welcome": welcome,
    "login": login,
    "create": create,
    "landing": landing,
    "canvas": canvas
    }

    stacked.addWidget(welcome)  # index 0
    stacked.addWidget(login)    # index 1
    stacked.addWidget(create)   # index 2
    stacked.addWidget(landing)  # index 3
    stacked.addWidget(canvas)   # index 4
    
    # Connect landing page signal
    landing.new_project_clicked.connect(lambda: slide_to_index(4))

    stacked.setCurrentIndex(0)
    stacked.show()

    sys.exit(app.exec_())


if __name__ == "__main__":
    main()