import sqlite3

from PyQt5.uic import loadUi
from PyQt5 import QtWidgets, QtGui, QtCore
from PyQt5.QtWidgets import QDialog
import os

import src.app_state as app_state
from src.theme import apply_theme_to_screen, apply_theme_to_all
from src.navigation import slide_to_index
from src.toast import show_toast


class WelcomeScreen(QDialog):
    def __init__(self):
        super(WelcomeScreen, self).__init__()
        loadUi("ui/welcomescreen.ui", self)

        self.login.clicked.connect(self.gotologin)
        self.create.clicked.connect(self.gotocreate)

        if hasattr(self, "themeToggle"):
            self.themeToggle.clicked.connect(self.toggle_theme)
            self.update_theme_button()

        apply_theme_to_screen(self)
        self.center_content()

    def gotologin(self):
        slide_to_index(1, direction=1)

    def gotocreate(self):
        slide_to_index(2, direction=1)

    def toggle_theme(self):
        new_theme = "dark" if app_state.current_theme == "light" else "light"
        apply_theme_to_all(new_theme)
        self.update_theme_button()
        self.center_content()

    def update_theme_button(self):
        if not hasattr(self, "themeToggle"):
            return
        if app_state.current_theme == "light":
            # Current is light -> Show Moon (to switch to dark)
            icon_path = os.path.join("ui", "res", "moon.png")
        else:
            # Current is dark -> Show Sun (to switch to light)
            icon_path = os.path.join("ui", "res", "sun.png")
            
        if os.path.exists(icon_path):
            self.themeToggle.setIcon(QtGui.QIcon(icon_path))
            self.themeToggle.setIconSize(QtCore.QSize(32, 32))
            self.themeToggle.setText("")
        else:
            # Fallback if icon missing
            self.themeToggle.setText("Dark mode" if app_state.current_theme == "light" else "Light mode")

    def resizeEvent(self, event):
        self.center_content()
        self.position_theme_toggle()

        bg = self.findChild(QtWidgets.QWidget, "bgwidget")
        if bg:
            bg.setGeometry(self.rect())
        super().resizeEvent(event)

    def center_content(self):
        names = ["label", "label_2", "login", "create"]
        for name in names:
            w = getattr(self, name, None)
            if not w:
                continue
            geo = w.geometry()
            new_x = (self.width() - geo.width()) // 2
            geo.moveLeft(new_x)
            w.setGeometry(geo)
    # keep toggle at top-right with a margin
    def position_theme_toggle(self):
        btn = getattr(self, "themeToggle", None)
        if not btn:
            return
        geo = btn.geometry()
        margin_right = 40
        geo.moveLeft(self.width() - geo.width() - margin_right)
        btn.setGeometry(geo)

class LoginScreen(QDialog):
    def __init__(self):
        super(LoginScreen, self).__init__()
        loadUi("ui/login.ui", self)

        self.passwordfield.setEchoMode(QtWidgets.QLineEdit.Password)
        self.login.clicked.connect(self.loginfunction)
        self.error.setWordWrap(True)

        if hasattr(self, "backToWelcome"):
            self.backToWelcome.clicked.connect(self.gotowelcome)

        if hasattr(self, "themeToggle"):
            self.themeToggle.clicked.connect(self.toggle_theme)
            self.update_theme_button()

        apply_theme_to_screen(self)

        # center once at startup
        self.center_content()

    def gotowelcome(self):
        slide_to_index(0, direction=-1)

    def toggle_theme(self):
        new_theme = "dark" if app_state.current_theme == "light" else "light"
        apply_theme_to_all(new_theme)
        self.update_theme_button()
        self.center_content()

    def update_theme_button(self):
        if not hasattr(self, "themeToggle"):
            return
        if app_state.current_theme == "light":
            icon_path = os.path.join("ui", "res", "moon.png")
        else:
            icon_path = os.path.join("ui", "res", "sun.png")

        if os.path.exists(icon_path):
            self.themeToggle.setIcon(QtGui.QIcon(icon_path))
            self.themeToggle.setIconSize(QtCore.QSize(32, 32))
            self.themeToggle.setText("")
        else:
            self.themeToggle.setText("Dark mode" if app_state.current_theme == "light" else "Light mode")
    
    def resizeEvent(self, event):
        self.center_content()

        bg = self.findChild(QtWidgets.QWidget, "bgwidget")
        if bg:
            bg.setGeometry(self.rect())
        super().resizeEvent(event)

    def center_content(self):
        # widgets we want in the vertical column
        names = [
            "label", "label_2",
            "label_3", "emailfield",
            "label_4", "passwordfield",
            "error", "login", "backToWelcome"
        ]
        for name in names:
            w = getattr(self, name, None)
            if not w:
                continue
            geo = w.geometry()
            new_x = (self.width() - geo.width()) // 2
            geo.moveLeft(new_x)
            w.setGeometry(geo)

    def loginfunction(self):
        user = self.emailfield.text()
        password = self.passwordfield.text()

        if len(user) == 0 or len(password) == 0:
            self.error.setText("Please input all fields.")
            return

        conn = sqlite3.connect("app_users.db")
        cur = conn.cursor()
        query = "SELECT password FROM login_info WHERE username = ?"
        cur.execute(query, (user,))
        result = cur.fetchone()
        conn.close()

        if result is None:
            self.error.setText("Invalid username or password")
            return

        result_pass = result[0]
        if result_pass == password:
            print("Successfully logged in.")
            self.error.setText("")
            show_toast("Logged in successfully!")
            # later: slide_to_index(3) for a dashboard
        else:
            self.error.setText("Invalid username or password")


class CreateAccScreen(QDialog):
    def __init__(self):
        super(CreateAccScreen, self).__init__()
        loadUi("ui/createacc.ui", self)

        self.passwordfield.setEchoMode(QtWidgets.QLineEdit.Password)
        self.confirmpasswordfield.setEchoMode(QtWidgets.QLineEdit.Password)
        self.signup.clicked.connect(self.signupfunction)

        self.error.setWordWrap(True)
        self.backToLogin.clicked.connect(self.gotologin)

        if hasattr(self, "themeToggle"):
            self.themeToggle.clicked.connect(self.toggle_theme)
            self.update_theme_button()

        apply_theme_to_screen(self)
        self.center_content()

    def gotologin(self):
        slide_to_index(1, direction=-1)

    def toggle_theme(self):
        new_theme = "dark" if app_state.current_theme == "light" else "light"
        apply_theme_to_all(new_theme)
        self.update_theme_button()
        self.center_content()

    def update_theme_button(self):
        if not hasattr(self, "themeToggle"):
            return
        if app_state.current_theme == "light":
            icon_path = os.path.join("ui", "res", "moon.png")
        else:
            icon_path = os.path.join("ui", "res", "sun.png")

        if os.path.exists(icon_path):
            self.themeToggle.setIcon(QtGui.QIcon(icon_path))
            self.themeToggle.setIconSize(QtCore.QSize(32, 32))
            self.themeToggle.setText("")
        else:
            self.themeToggle.setText("Dark mode" if app_state.current_theme == "light" else "Light mode")
    
    def resizeEvent(self, event):
        self.center_content()

        bg = self.findChild(QtWidgets.QWidget, "bgwidget")
        if bg:
            bg.setGeometry(self.rect())
        super().resizeEvent(event)

    def center_content(self):
        names = [
            "label", "label_2",
            "label_3", "emailfield",
            "label_4", "passwordfield",
            "label_5", "confirmpasswordfield",
            "error", "signup", "backToLogin"
        ]
        for name in names:
            w = getattr(self, name, None)
            if not w:
                continue
            geo = w.geometry()
            new_x = (self.width() - geo.width()) // 2
            geo.moveLeft(new_x)
            w.setGeometry(geo)


    def signupfunction(self):
        user = self.emailfield.text()
        password = self.passwordfield.text()
        confirmpassword = self.confirmpasswordfield.text()

        if len(user) == 0 or len(password) == 0 or len(confirmpassword) == 0:
            self.error.setText("Please fill in all inputs.")
            return

        if password != confirmpassword:
            self.error.setText("Passwords do not match.")
            return

        conn = sqlite3.connect("app_users.db")
        cur = conn.cursor()

        try:
            cur.execute(
                "INSERT INTO login_info (username, password) VALUES (?, ?)",
                (user, password)
            )
            conn.commit()
            conn.close()

            show_toast("Account created successfully!")
            slide_to_index(0, direction=-1)

        except sqlite3.IntegrityError:
            self.error.setText("ERROR: That username is already taken. Please choose another.")
            conn.close()
        except Exception as e:
            self.error.setText(f"An unexpected database error occurred: {e}")
            conn.close()
