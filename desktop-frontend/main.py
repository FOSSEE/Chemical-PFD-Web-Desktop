import sys
from PyQt5.QtWidgets import QApplication, QMainWindow

def main():
    app = QApplication(sys.argv)
    window = QMainWindow()
    window.setWindowTitle('Chemical PFD - Desktop')
    window.resize(800, 600)
    window.show()
    sys.exit(app.exec_())

if __name__ == '__main__':
    main()