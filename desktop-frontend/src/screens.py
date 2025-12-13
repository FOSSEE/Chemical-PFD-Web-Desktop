from PyQt5.uic import loadUi
from PyQt5 import QtWidgets, QtGui, QtCore
from PyQt5.QtWidgets import QDialog
import os

import src.app_state as app_state
from src.theme import apply_theme_to_screen, apply_theme_to_all
from src.navigation import slide_to_index
from src.toast import show_toast
from src.api_client import login as api_login, register as api_register, ApiError

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
        self.position_theme_toggle()

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

    def position_theme_toggle(self):
        btn = getattr(self, "themeToggle", None)
        if not btn:
            return
        geo = btn.geometry()
        margin_right = 40
        geo.moveLeft(self.width() - geo.width() - margin_right)
        btn.setGeometry(geo)


    def loginfunction(self):
        user = self.emailfield.text().strip()
        password = self.passwordfield.text()

        if not user or not password:
            self.error.setText("Please input all fields.")
            return

        # Clear previous error
        self.error.setText("")

        try:
            access, refresh = api_login(user, password)
        except ApiError as e:
            # Backend / network / invalid creds
            self.error.setText(str(e))
            return

        # Store tokens in global app_state
        app_state.access_token = access
        app_state.refresh_token = refresh
        app_state.current_user = user

        print("Successfully logged in via backend.")
        show_toast("Logged in successfully!")

        # Canvas screen
        slide_to_index(3, direction=1)


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
        self.position_theme_toggle()

        bg = self.findChild(QtWidgets.QWidget, "bgwidget")
        if bg:
            bg.setGeometry(self.rect())
        super().resizeEvent(event)

    def center_content(self):
        # 1) Center the main column (title, subtitle, inputs, buttons)
        center_names = [
            "label", "label_2",
            "emailfield", "passwordfield", "confirmpasswordfield",
            "error", "signup", "backToLogin"
        ]

        base_x = None  # we'll capture the x of emailfield after centering

        for name in center_names:
            w = getattr(self, name, None)
            if not w:
                continue
            geo = w.geometry()
            new_x = (self.width() - geo.width()) // 2
            geo.moveLeft(new_x)
            w.setGeometry(geo)

            if name == "emailfield":
                base_x = new_x
                field_width = geo.width()

        # 2) Left-indent the labels (Username / Password / Confirm Password)
        if base_x is None:
            email = getattr(self, "emailfield", None)
            if email:
                base_x = email.geometry().x()
                field_width = email.geometry().width()

        if base_x is not None:
            for name in ["label_3", "label_4", "label_5"]:
                lab = getattr(self, name, None)
                if not lab:
                    continue
                geo = lab.geometry()
                geo.moveLeft(base_x)        # align with field's left start
                geo.setWidth(field_width)   # same width as field (for consistent wrapping)
                lab.setGeometry(geo)

    def position_theme_toggle(self):
        btn = getattr(self, "themeToggle", None)
        if not btn:
            return
        geo = btn.geometry()
        margin_right = 40
        geo.moveLeft(self.width() - geo.width() - margin_right)
        btn.setGeometry(geo)

    def signupfunction(self):
        # Treat this as email input
        email = self.emailfield.text().strip()
        password = self.passwordfield.text()
        confirmpassword = self.confirmpasswordfield.text()

        if not email or not password or not confirmpassword:
            self.error.setText("Please fill in all inputs.")
            return

        if password != confirmpassword:
            self.error.setText("Passwords do not match.")
            return

        # For backend: use email as both username & email
        username = email

        # Clear previous error
        self.error.setText("")

        try:
            api_register(username, email, password)
        except ApiError as e:
            self.error.setText(str(e))
            return

        # Success
        show_toast("Account created successfully!")

        # Optionally clear inputs
        self.emailfield.clear()
        self.passwordfield.clear()
        self.confirmpasswordfield.clear()

        # Back to welcome
        slide_to_index(0, direction=-1)
