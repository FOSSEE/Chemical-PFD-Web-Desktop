import os
import json

from PyQt5 import QtWidgets, QtGui
from PyQt5.QtCore import Qt, QPoint, QPointF
from PyQt5.QtGui import QPainter, QColor, QPen, QBrush

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QLabel,
    QHBoxLayout, QPushButton
)

from src.component_library import ComponentLibrary
from src.component_widget import ComponentWidget
import src.app_state as app_state
from src.theme import apply_theme_to_screen
from src.navigation import slide_to_index

class CanvasWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)

        # Canvas background (your version)
        self.setObjectName("canvasArea")
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setAutoFillBackground(True)

        palette = self.palette()
        # Always keep canvas white as per requirement
        palette.setColor(self.backgroundRole(), Qt.white)
        self.setPalette(palette)

        self.setAcceptDrops(True)
        self.setMouseTracking(True)
        self.setFocusPolicy(Qt.StrongFocus)

        # Combined component & connection systems
        self.components = []
        self.connections = []
        self.active_connection = None

        # Load grips.json
        self.component_config = {}
        self._load_config()

        # Load label generation CSV
        self.label_data = {}
        self._load_label_data()

    def update_canvas_theme(self):
        palette = self.palette()
        # Always keep canvas white as per requirement
        palette.setColor(self.backgroundRole(), Qt.white)

        self.setPalette(palette)
        self.update()

    def _load_label_data(self):
        import csv
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            csv_path = os.path.join(base_dir, "ui", "assets", "Component_Details.csv")

            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    key = row.get("object", "").strip() or row.get("name", "").strip()
                    if not key:
                        continue

                    self.label_data[self._clean_string(key)] = {
                        "legend": row.get("legend", "").strip(),
                        "suffix": row.get("suffix", "").strip(),
                        "count": 0
                    }
        except Exception as e:
            print("Failed to load Component_Details.csv:", e)

    def _clean_string(self, s):
        return s.lower().translate(str.maketrans("", "", " ,_/-()"))

    def _load_config(self):
        """Load grips.json into self.component_config with full fuzzy matching support."""
        try:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            path = os.path.join(base, "ui", "assets", "grips.json")

            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    self.component_config[item["component"]] = item

        except Exception as e:
            print("Failed to load grips.json:", e)

    def get_component_config(self, name):
        """
        Finds config from grips.json using exact or fuzzy matching.
        Includes ID_MAP compatibility for legacy naming.
        """
        ID_MAP = {
            'Exchanger905': "905Exchanger",
            'KettleReboiler907': "907Kettle Reboiler",
            'OneCellFiredHeaterFurnace': "One Cell Fired Heater",
            'TwoCellFiredHeaterFurnace': "Two Cell Fired Heater"
        }
        name = ID_MAP.get(name, name)

        # Exact match
        if name in self.component_config:
            return self.component_config[name]

        # Fuzzy match
        def clean(s):
            return s.lower().translate(str.maketrans('', '', ' ,_/-()'))

        target = clean(name)

        for key, cfg in self.component_config.items():
            if clean(key) == target:
                return cfg

        return {}

    def find_svg_for_component(self, name):
        """
        Fuzzy-matching SVG search inside ui/assets/svg.
        Supports ID_MAP + case-insensitive + punctuation-insensitive matching.
        """

        ID_MAP = {
            'Exchanger905': "905Exchanger",
            'KettleReboiler907': "907Kettle Reboiler",
            'OneCellFiredHeaterFurnace': "One Cell Fired Heater, Furnace",
            'TwoCellFiredHeaterFurnace': "Two Cell Fired Heater, Furnace"
        }
        name = ID_MAP.get(name, name)

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        svg_dir = os.path.join(base_dir, "ui", "assets", "svg")

        def clean(s):
            return s.lower().translate(str.maketrans('', '', ' ,_/-()'))

        target = clean(name)

        if not os.path.exists(svg_dir):
            print(f"SVG directory missing: {svg_dir}")
            return None

        for root, _, files in os.walk(svg_dir):
            for f in files:
                if not f.lower().endswith(".svg"):
                    continue

                fname = f[:-4]  # remove .svg

                # Direct match
                if fname == name:
                    return os.path.join(root, f)

                # Clean match
                if clean(fname) == target:
                    return os.path.join(root, f)

        # No match
        print(f"No SVG found for: {name}")
        return None

    # ---------------------- DRAG & DROP ----------------------
    def dragEnterEvent(self, event):
        if event.mimeData().hasText():
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event):
        pos = event.pos()
        text = event.mimeData().text()
        self.add_component_label(text, pos)
        event.acceptProposedAction()

    def deselect_all(self):
        """Deselects all ComponentWidgets and all Connections."""
        # Deselect components
        for comp in self.components:
            comp.set_selected(False)

        # Deselect connections
        if hasattr(self, "connections"):
            for conn in self.connections:
                conn.is_selected = False

        self.update()

    # ---------------------- SELECTION + CONNECTION LOGIC ----------------------
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:

            # Deselect all first
            self.deselect_all()

            # Check if clicking on connection
            hit_connection = None
            hit_index = -1
            for conn in self.connections:
                idx = conn.hit_test(event.pos())
                if idx != -1:
                    hit_connection = conn
                    hit_index = idx
                    break

            if hit_connection:
                # Smart drag logic
                hit_connection.is_selected = True
                self.drag_connection = hit_connection
                self.drag_start_pos = event.pos()

                best_param = "path_offset"
                best_sensitivity = QPointF(0, 0)
                best_mag_sq = -1

                params = ["path_offset", "start_adjust", "end_adjust"]
                base_points = list(hit_connection.path)

                for p in params:
                    old = getattr(hit_connection, p)
                    setattr(hit_connection, p, old + 1.0)

                    hit_connection.calculate_path()
                    new_points = hit_connection.path

                    sens = QPointF(0, 0)
                    if hit_index < len(base_points) - 1 and hit_index < len(new_points) - 1:
                        a = (base_points[hit_index] + base_points[hit_index + 1]) / 2
                        b = (new_points[hit_index] + new_points[hit_index + 1]) / 2
                        sens = b - a

                    setattr(hit_connection, p, old)
                    mag = sens.x()**2 + sens.y()**2
                    if mag > best_mag_sq:
                        best_mag_sq = mag
                        best_param = p
                        best_sensitivity = sens

                hit_connection.path = list(base_points)
                hit_connection.calculate_path()

                self.drag_param_name = best_param
                self.drag_sensitivity = best_sensitivity
                self.drag_start_param_val = getattr(hit_connection, best_param)

                self.setFocus()
                self.update()
                event.accept()
                return

        # Clicked blank space
        self.active_connection = None
        self.drag_connection = None
        self.setFocus()
        event.accept()

    def mouseMoveEvent(self, event):
        # Connection being created
        if self.active_connection:
            self.update_connection_drag(event.pos())
            return super().mouseMoveEvent(event)

        # Dragging existing connection
        if hasattr(self, "drag_connection") and self.drag_connection:
            delta = event.pos() - self.drag_start_pos
            sens_sq = self.drag_sensitivity.x()**2 + self.drag_sensitivity.y()**2

            if sens_sq > 0.001:
                dot = delta.x() * self.drag_sensitivity.x() + delta.y() * self.drag_sensitivity.y()
                change = dot / sens_sq
                new_val = self.drag_start_param_val + change
                setattr(self.drag_connection, self.drag_param_name, new_val)

                self.drag_connection.calculate_path()
                self.update()

        super().mouseMoveEvent(event)

    def update_connection_drag(self, pos):
        if not self.active_connection:
            return

        snap = False

        for comp in self.components:
            if not comp.geometry().adjusted(-30, -30, 30, 30).contains(pos):
                continue

            grips = comp.config.get("grips") or [
                {"x": 0, "y": 50, "side": "left"},
                {"x": 100, "y": 50, "side": "right"}
            ]

            content = comp.get_content_rect()

            for i, g in enumerate(grips):
                cx = content.x() + (g["x"] / 100) * content.width()
                cy = content.y() + (g["y"] / 100) * content.height()
                center = comp.mapToParent(QPoint(int(cx), int(cy)))

                if (pos - center).manhattanLength() < 20 and comp != self.active_connection.start_component:
                    self.active_connection.set_snap_target(comp, i, g["side"])
                    snap = True
                    break
            if snap:
                break

        if not snap:
            self.active_connection.clear_snap_target()
            self.active_connection.current_pos = pos

        self.active_connection.calculate_path(self.components)
        self.update()

    def mouseReleaseEvent(self, event):
        self.handle_connection_release(event.pos())
        self.drag_connection = None
        super().mouseReleaseEvent(event)

    def keyPressEvent(self, event):
        if event.key() in (Qt.Key_Delete, Qt.Key_Backspace):
            self.delete_selected_components()
        else:
            super().keyPressEvent(event)

    def delete_selected_components(self):
        to_del_comps = [c for c in self.components if c.is_selected]
        to_del_conns = [c for c in self.connections if c.is_selected]

        # Remove connections linked to deleted components
        for i in range(len(self.connections) - 1, -1, -1):
            conn = self.connections[i]
            if (
                conn.start_component in to_del_comps or
                conn.end_component in to_del_comps or
                conn in to_del_conns
            ):
                self.connections.pop(i)

        # Remove components
        for comp in to_del_comps:
            if comp in self.components:
                self.components.remove(comp)
            comp.deleteLater()

        self.update()

    def handle_connection_release(self, pos):
        if self.active_connection:
            if self.active_connection.snap_component:
                self.active_connection.set_end_grip(
                    self.active_connection.snap_component,
                    self.active_connection.snap_grip_index,
                    self.active_connection.snap_side
                )
                self.active_connection.calculate_path(self.components)
                self.connections.append(self.active_connection)

            self.active_connection = None
            self.update()

    # ---------------------- PAINT EVENT ----------------------
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        # Grid (your version)
        dot_color = QColor(90, 90, 90) if app_state.current_theme == "dark" else QColor(
            180, 180, 180)
        painter.setPen(dot_color)

        grid_spacing = 30
        for x in range(0, self.width(), grid_spacing):
            for y in range(0, self.height(), grid_spacing):
                painter.drawPoint(x, y)

        # Draw all finished connections
        for conn in self.connections:
            conn.calculate_path(self.components)

            if conn.is_selected:
                painter.setPen(QPen(QColor("#2563eb"), 3))
            else:
                painter.setPen(QPen(Qt.black, 2))

            for i in range(len(conn.path) - 1):
                painter.drawLine(conn.path[i], conn.path[i + 1])

            if conn.is_selected:
                painter.setBrush(QColor("#2563eb"))
                painter.setPen(Qt.NoPen)
                for pt in conn.path:
                    painter.drawEllipse(pt, 4, 4)

        # Active connection (dashed)
        if self.active_connection:
            painter.setPen(QPen(Qt.black, 2, Qt.DashLine))
            path = self.active_connection.path
            for i in range(len(path) - 1):
                painter.drawLine(path[i], path[i + 1])

    # ---------------------- COMPONENT CREATION ----------------------
    def add_component_label(self, text, pos):
        svg = self.find_svg_for_component(text)
        config = self.get_component_config(text) or {}

        # Label generation
        key = self._clean_string(text)
        label_text = text

        if key in self.label_data:
            d = self.label_data[key]
            d["count"] += 1
            label_text = f"{d['legend']}{d['count']:02d}{d['suffix']}"

        config["default_label"] = label_text

        if not svg:
            lbl = QLabel(label_text, self)
            lbl.move(pos)
            lbl.setStyleSheet(
                "color:white; background:rgba(0,0,0,0.5); padding:4px; border-radius:4px;"
            )
            lbl.show()
            lbl.adjustSize()
            return

        comp = ComponentWidget(svg, self, config=config)
        comp.move(pos)
        comp.show()
        self.components.append(comp)

# ============================================================
#                   MAIN EDITOR WINDOW
# ============================================================

class CanvasScreen(QMainWindow):
    def __init__(self):
        super().__init__()

        # --- Menu Bar ---
        from src.menubar import MenuBarManager
        self.menu_manager = MenuBarManager(self)
        self._connect_menu_signals()

        # --- Central Widget (Stack) ---
        self.central_stack = QtWidgets.QStackedWidget()
        self.setCentralWidget(self.central_stack)

        # Page 0: Empty / Placeholder (No Project Open)
        self.empty_page = QWidget()
        self.empty_page.setObjectName("emptyPage")
        # Optional: Add a label or styling to indicate "No Project Open"
        empty_layout = QVBoxLayout(self.empty_page)
        empty_label = QLabel("Go to File > New to start a project", self.empty_page)
        empty_label.setAlignment(Qt.AlignCenter)
        empty_label.setStyleSheet("color: #888; font-size: 16px;")
        empty_layout.addWidget(empty_label)
        
        self.central_stack.addWidget(self.empty_page)

        # Page 1: Canvas
        self.canvas = CanvasWidget(self)
        self.central_stack.addWidget(self.canvas)

        # Show empty page by default
        self.central_stack.setCurrentIndex(0)

        # --- Left Component Library ---
        self.library = ComponentLibrary(self)
        self.library.setMinimumWidth(280)
        main_layout.addWidget(self.library)

        self.mdi_area = QtWidgets.QMdiArea()
        self.mdi_area.setViewMode(QtWidgets.QMdiArea.TabbedView)
        self.mdi_area.setTabsClosable(True)
        self.mdi_area.setTabsMovable(True)
        self.mdi_area.setBackground(QBrush(QColor("#505050")))
        
        main_layout.addWidget(self.mdi_area)

        apply_theme_to_screen(self)

    def _connect_menu_signals(self):
        self.menu_manager.new_project_clicked.connect(self.on_new_project)
        self.menu_manager.back_home_clicked.connect(self.on_back_home)
        self.menu_manager.delete_clicked.connect(self.on_delete_component)
        self.menu_manager.logout_clicked.connect(self.logout)

        # Placeholders
        self.menu_manager.open_project_clicked.connect(lambda: print("Open Project clicked"))
        self.menu_manager.save_project_clicked.connect(lambda: print("Save Project clicked"))
        self.menu_manager.generate_image_clicked.connect(lambda: print("Generate Image clicked"))
        self.menu_manager.generate_report_clicked.connect(lambda: print("Generate Report clicked"))

    def on_new_project(self):
        canvas = CanvasWidget(self)
        canvas.update_canvas_theme()
        
        sub = self.mdi_area.addSubWindow(canvas)
        sub.setWindowTitle("New Project")
        sub.showMaximized()

    def on_back_home(self):
        slide_to_index(3, direction=-1)

    def on_delete_component(self):
        active_sub = self.mdi_area.currentSubWindow()
        if active_sub and isinstance(active_sub.widget(), CanvasWidget):
            active_sub.widget().delete_selected_components()

    def _connect_menu_signals(self):
        # File
        self.menu_manager.new_project_clicked.connect(self.on_new_project)
        self.menu_manager.back_home_clicked.connect(self.on_back_home)
        
        # Edit
        self.menu_manager.delete_clicked.connect(self.on_delete_component)
        
        # Profile
        self.menu_manager.logout_clicked.connect(self.logout)

        # Placeholders
        self.menu_manager.open_project_clicked.connect(lambda: print("Open Project clicked"))
        self.menu_manager.save_project_clicked.connect(lambda: print("Save Project clicked"))
        self.menu_manager.generate_image_clicked.connect(lambda: print("Generate Image clicked"))
        self.menu_manager.generate_report_clicked.connect(lambda: print("Generate Report clicked"))

    def on_new_project(self):
        """Switch to the canvas view."""
        self.central_stack.setCurrentIndex(1)
        # Optional: Reset canvas or load new state here if needed
        print("New Project started - Canvas Active")

    def on_back_home(self):
        """Navigate back to Landing Page (Index 3)."""
        slide_to_index(3, direction=-1)

    def on_delete_component(self):
        """Trigger delete on the canvas."""
        if self.central_stack.currentIndex() == 1:
            self.canvas.delete_selected_components()

    def logout(self):
        app_state.access_token = None
        app_state.refresh_token = None
        app_state.current_user = None
        slide_to_index(0, direction=-1)
