from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QFrame, QSpacerItem, QSizePolicy,
    QMessageBox, QToolButton, QScrollArea
)
from PyQt5.QtCore import Qt, pyqtSignal, QEvent
from PyQt5.QtGui import QFont

from src.theme import apply_theme_to_screen
from src.theme_manager import theme_manager
from src.navigation import slide_to_index
from src import api_client
from datetime import datetime
import src.app_state as app_state

# Action Card
class ActionCard(QFrame):
    """A clickable card widget that acts as a large button."""
    clicked = pyqtSignal()

    def __init__(self, icon_text, title, description, parent=None):
        super().__init__(parent)

        self.setObjectName("actionCard")
        self.setCursor(Qt.PointingHandCursor)
        self.setMinimumSize(240, 170)

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
    clicked = pyqtSignal(int)  # Changed to emit project ID instead of name
    edit_requested = pyqtSignal(int)
    delete_requested = pyqtSignal(int)

    def __init__(self, project_id, project_name, last_opened, parent=None):
        super().__init__(parent)

        self.setObjectName("recentProjectItem")
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setCursor(Qt.PointingHandCursor)
        self.project_id = project_id
        self.project_name = project_name

        layout = QHBoxLayout(self)
        layout.setContentsMargins(12, 10, 12, 10)
        layout.setSpacing(14)

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

        action_layout = QHBoxLayout()
        action_layout.setContentsMargins(0, 0, 0, 0)
        action_layout.setSpacing(8)

        self.edit_btn = QToolButton()
        self.edit_btn.setText("Edit")
        self.edit_btn.setCursor(Qt.PointingHandCursor)
        self.edit_btn.setObjectName("recentActionEdit")
        self.edit_btn.setAutoRaise(True)
        self.edit_btn.setFixedSize(54, 28)
        self.edit_btn.clicked.connect(lambda: self.edit_requested.emit(self.project_id))
        action_layout.addWidget(self.edit_btn)

        self.delete_btn = QToolButton()
        self.delete_btn.setText("Delete")
        self.delete_btn.setCursor(Qt.PointingHandCursor)
        self.delete_btn.setObjectName("recentActionDelete")
        self.delete_btn.setAutoRaise(True)
        self.delete_btn.setFixedSize(62, 28)
        self.delete_btn.clicked.connect(lambda: self.delete_requested.emit(self.project_id))
        action_layout.addWidget(self.delete_btn)

        layout.addLayout(action_layout)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.clicked.emit(self.project_id)  # Emit ID instead of name
        super().mousePressEvent(event)


# Landing Page Screen
class LandingPage(QWidget):
    new_project_clicked = pyqtSignal()
    open_project_clicked = pyqtSignal()

    def __init__(self, parent=None, canvas_screen=None):
        super().__init__(parent)
        self.canvas_screen = canvas_screen
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
        self.open_card.clicked.connect(self.open_project_clicked.emit)
        cards_layout.addWidget(self.open_card)

        center_layout.addLayout(cards_layout)
        center_layout.addSpacing(30)

        # Recent Projects
        recent_header = QLabel("Recent Projects")
        recent_header.setObjectName("sectionHeader")
        center_layout.addWidget(recent_header)

        self.recent_container = QFrame()
        self.recent_container.setObjectName("recentContainer")
        self.recent_container.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Maximum)
        self.recent_layout = QVBoxLayout(self.recent_container)
        self.recent_layout.setContentsMargins(0, 0, 0, 0)
        self.recent_layout.setSpacing(0)

        self.recent_scroll = QScrollArea()
        self.recent_scroll.setObjectName("recentScroll")
        self.recent_scroll.setWidgetResizable(True)
        self.recent_scroll.setFrameShape(QFrame.NoFrame)
        self.recent_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.recent_scroll.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        self.recent_scroll.setMinimumHeight(220)
        self.recent_scroll.setMaximumHeight(320)
        self.recent_scroll.setWidget(self.recent_container)
        center_layout.addWidget(self.recent_scroll)


        # placeholder_projects = [
        #     ("Distillation_Unit_A.pfd", "2 hours ago"),
        #     ("Heat_Exchanger_Network.pfd", "Yesterday"),
        #     ("Reactor_Setup_V2.pfd", "3 days ago")
        # ]

        # for name, time in placeholder_projects:
        #     item = RecentProjectItem(name, time)
        #     recent_layout.addWidget(item)

        #     # Divider
        #     line = QFrame()
        #     line.setFrameShape(QFrame.HLine)
        #     line.setObjectName("divider")
        #     recent_layout.addWidget(line)

        # center_layout.addWidget(recent_container)

        # Center alignment
        h = QHBoxLayout()
        h.addStretch()
        h.addWidget(center_widget)
        h.addStretch()

        self.content_layout.addLayout(h)
        self.content_layout.addStretch()

        # Connect to theme manager
        theme_manager.theme_changed.connect(self.on_theme_changed)
        
        # Apply initial theme
        self.on_theme_changed(theme_manager.current_theme)

        # Logout
        self.logout_btn.clicked.connect(self.on_logout_clicked)
        
        # Connect to canvas screen save signal to refresh recent projects
        if self.canvas_screen:
            self.canvas_screen.project_saved.connect(self.load_recent_projects)

    def showEvent(self, event):
        """Called when the widget becomes visible (e.g. after login)."""
        super().showEvent(event)
        self.load_recent_projects()

    def _format_time(self, iso_time: str) -> str:
        try:
            dt = datetime.fromisoformat(iso_time.replace("Z", ""))
            delta = datetime.now() - dt

            if delta.days == 0:
                return "Today"
            if delta.days == 1:
                return "Yesterday"
            return f"{delta.days} days ago"
        except Exception:
            return ""
        
    def load_recent_projects(self):
        """Load recent projects from backend API."""
        while self.recent_layout.count():
            item = self.recent_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        projects = api_client.get_projects()
        print(f"[DEBUG] Got {len(projects)} projects from backend")
        print(f"[DEBUG] Projects: {[(p.get('id'), p.get('name'), p.get('updated_at')) for p in projects]}")

        if not projects:
            empty = QLabel("No recent projects")
            empty.setAlignment(Qt.AlignCenter)
            empty.setObjectName("emptyRecent")
            self.recent_layout.addWidget(empty)
            return

        # Sort by updated_at (most recent first)
        projects.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        
        # Show all projects
        for index, proj in enumerate(projects):
            project_id = proj.get("id")
            name = proj.get("name", "Untitled Project")
            updated = proj.get("updated_at", "")
            time_label = self._format_time(updated)

            item = RecentProjectItem(project_id, name, time_label)
            item.clicked.connect(self.on_recent_project_clicked)
            item.edit_requested.connect(self.on_recent_project_edit_clicked)
            item.delete_requested.connect(self.on_recent_project_delete_clicked)
            self.recent_layout.addWidget(item)

            if index < len(projects) - 1:
                divider = QFrame()
                divider.setFrameShape(QFrame.HLine)
                divider.setObjectName("divider")
                self.recent_layout.addWidget(divider)

    def on_recent_project_clicked(self, project_id: int):
        """Handle click on recent project - navigate to canvas and load project."""
        print(f"[DEBUG] Clicked project: {project_id}")
        print(f"[DEBUG] Setting pending_project_id")
        # Store project ID to load after navigation
        app_state.pending_project_id = project_id
        
        # Navigate to canvas screen (index 4)
        print(f"[DEBUG] Navigating to index 4")
        slide_to_index(4, direction=1)

    def on_recent_project_edit_clicked(self, project_id: int):
        """Edit a recent project by opening it in the canvas screen."""
        self.on_recent_project_clicked(project_id)

    def on_recent_project_delete_clicked(self, project_id: int):
        """Delete a recent project after user confirmation."""
        reply = QMessageBox.question(
            self,
            "Delete Project",
            "Delete this project? This action cannot be undone.",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )

        if reply != QMessageBox.Yes:
            return

        result = api_client.delete_project(project_id)
        if result is None:
            QMessageBox.critical(
                self,
                "Delete Project",
                "Failed to delete the project. Please try again.",
            )
            return

        self.load_recent_projects()

        if self.canvas_screen and getattr(app_state, "pending_project_id", None) == project_id:
            app_state.pending_project_id = None

    def on_theme_changed(self, theme):
        """Called when theme changes from theme manager."""
        apply_theme_to_screen(self, theme)

    def changeEvent(self, event):
        """Detect system theme changes."""
        if event.type() in (QEvent.PaletteChange, QEvent.ApplicationPaletteChange):
            theme_manager.on_system_theme_changed()
        super().changeEvent(event)

    def on_logout_clicked(self):
        app_state.access_token = None
        app_state.refresh_token = None
        app_state.current_user = None

        print("Logged out. Tokens cleared.")
        slide_to_index(0, direction=-1)