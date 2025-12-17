from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QFrame, QSpacerItem, QSizePolicy
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont

from src.theme import apply_theme_to_screen
from src.navigation import slide_to_index


# Action Card
class ActionCard(QFrame):
    """A clickable card widget that acts as a large button."""
    clicked = pyqtSignal()

    def __init__(self, icon_text, title, description, parent=None):
        super().__init__(parent)

        self.setObjectName("actionCard")
        self.setCursor(Qt.PointingHandCursor)
        self.setFixedSize(240, 140)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(10)

        # Icon
        icon_label = QLabel(icon_text)
        icon_label.setObjectName("cardIcon")
        icon_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(icon_label)

        # Title
        title_label = QLabel(title)
        title_label.setObjectName("cardTitle")
        title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(title_label)

        # Description
        desc_label = QLabel(description)
        desc_label.setObjectName("cardDesc")
        desc_label.setAlignment(Qt.AlignCenter)
        desc_label.setWordWrap(True)
        layout.addWidget(desc_label)

        layout.addStretch()

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.clicked.emit()
        super().mousePressEvent(event)


# Recent Project Item
class RecentProjectItem(QWidget):
    """A row item showing a recent project."""
    clicked = pyqtSignal(str)

    def __init__(self, project_name, last_opened, parent=None):
        super().__init__(parent)

        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setCursor(Qt.PointingHandCursor)
        self.project_name = project_name

        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 8, 10, 8)
        layout.setSpacing(15)

        # Icon
        icon_label = QLabel("📄")
        icon_label.setObjectName("recentIcon")
        layout.addWidget(icon_label)

        # Text info
        info_layout = QVBoxLayout()
        info_layout.setSpacing(2)

        name_label = QLabel(project_name)
        name_label.setObjectName("recentName")
        info_layout.addWidget(name_label)

        time_label = QLabel(last_opened)
        time_label.setObjectName("recentTime")
        info_layout.addWidget(time_label)

        layout.addLayout(info_layout)
        layout.addStretch()

        # Arrow
        arrow_label = QLabel("→")
        arrow_label.setObjectName("recentArrow")
        layout.addWidget(arrow_label)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.clicked.emit(self.project_name)
        super().mousePressEvent(event)


# Landing Page Screen
class LandingPage(QWidget):
    new_project_clicked = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("landingPage")

        # ROOT layout
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        # Background area
        self.bgwidget = QWidget(self)
        self.bgwidget.setObjectName("bgwidget")
        layout.addWidget(self.bgwidget)

        # Content layout inside bgwidget
        self.content_layout = QVBoxLayout(self.bgwidget)
        self.content_layout.setContentsMargins(40, 40, 40, 40)

        # HEADER BAR
        header_bar = QWidget(self.bgwidget)
        header_bar.setObjectName("headerBar")

        header_layout = QHBoxLayout(header_bar)
        header_layout.setContentsMargins(10, 0, 10, 0)
        header_layout.addStretch()

        # Logout button
        self.logout_btn = QPushButton("Logout")
        self.logout_btn.setObjectName("logoutButton")
        self.logout_btn.setCursor(Qt.PointingHandCursor)
        header_layout.addWidget(self.logout_btn)

        self.content_layout.addWidget(header_bar)

        # CENTER CONTENT
        center_widget = QWidget()
        center_widget.setMaximumWidth(800)

        center_layout = QVBoxLayout(center_widget)
        center_layout.setSpacing(30)

        # Header
        header2 = QVBoxLayout()
        header2.setSpacing(5)

        title = QLabel("Welcome to Chemical PFD")
        title.setObjectName("headerLabel")
        title.setAlignment(Qt.AlignCenter)
        header2.addWidget(title)

        subtitle = QLabel("Create or edit your process flow diagrams")
        subtitle.setObjectName("subtitleLabel")
        subtitle.setAlignment(Qt.AlignCenter)
        header2.addWidget(subtitle)

        center_layout.addLayout(header2)
        center_layout.addSpacing(20)

        # Action Cards
        cards_layout = QHBoxLayout()
        cards_layout.setSpacing(20)
        cards_layout.setAlignment(Qt.AlignCenter)

        self.new_card = ActionCard("📝", "New Project", "Start a new diagram from scratch")
        self.new_card.clicked.connect(self.new_project_clicked.emit)
        cards_layout.addWidget(self.new_card)

        self.open_card = ActionCard("📂", "Open Project", "Open an existing PFD file")
        cards_layout.addWidget(self.open_card)

        center_layout.addLayout(cards_layout)
        center_layout.addSpacing(30)

        # Recent Projects
        recent_header = QLabel("Recent Projects")
        recent_header.setObjectName("sectionHeader")
        center_layout.addWidget(recent_header)

        recent_container = QFrame()
        recent_container.setObjectName("recentContainer")
        recent_layout = QVBoxLayout(recent_container)
        recent_layout.setContentsMargins(0, 0, 0, 0)
        recent_layout.setSpacing(0)

        placeholder_projects = [
            ("Distillation_Unit_A.pfd", "2 hours ago"),
            ("Heat_Exchanger_Network.pfd", "Yesterday"),
            ("Reactor_Setup_V2.pfd", "3 days ago")
        ]

        for name, time in placeholder_projects:
            item = RecentProjectItem(name, time)
            recent_layout.addWidget(item)

            # Divider
            line = QFrame()
            line.setFrameShape(QFrame.HLine)
            line.setObjectName("divider")
            recent_layout.addWidget(line)

        center_layout.addWidget(recent_container)

        # Center alignment
        h = QHBoxLayout()
        h.addStretch()
        h.addWidget(center_widget)
        h.addStretch()

        self.content_layout.addLayout(h)
        self.content_layout.addStretch()

        # Apply theme
        apply_theme_to_screen(self)

        # Logout
        self.logout_btn.clicked.connect(self.on_logout_clicked)

    # LOGOUT LOGIC
    def on_logout_clicked(self):
        import src.app_state as app_state

        app_state.access_token = None
        app_state.refresh_token = None
        app_state.current_user = None

        print("Logged out. Tokens cleared.")
        slide_to_index(0, direction=-1)


