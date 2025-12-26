import os
import json
from PyQt5 import QtWidgets, QtGui, QtSvg, QtCore
from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QLineEdit, QTextEdit, QFileDialog
)

from src.api_client import post_component
import src.app_state as app_state

class DraggableGripItem(QtWidgets.QGraphicsEllipseItem):
    """A grip point that can be dragged, deleted, and shows its number"""
    
    def __init__(self, x, y, side, index, editor, radius=4):
        super().__init__(x - radius, y - radius, 2*radius, 2*radius)
        self.editor = editor
        self.index = index
        self.side = side
        self.radius = radius
        self.center_x = x
        self.center_y = y
        
        # Style - red circle with white border for better visibility
        self.setPen(QtGui.QPen(Qt.NoPen))
        self.setBrush(QtGui.QBrush(QtGui.QColor("cyan")))  # Bright red
        self.setFlag(QtWidgets.QGraphicsItem.ItemIsMovable)
        self.setFlag(QtWidgets.QGraphicsItem.ItemSendsGeometryChanges)
        self.setZValue(10)
        self.setCursor(Qt.OpenHandCursor)
        
        # Number label with better visibility
        # self.label = QtWidgets.QGraphicsTextItem(str(index + 1), self)
        # self.label.setDefaultTextColor(Qt.white)
        # font = self.label.font()
        # font.setPixelSize(12)
        # font.setBold(True)
        # self.label.setFont(font)
        
        # # Add text outline/shadow for better visibility
        # effect = QtWidgets.QGraphicsDropShadowEffect()
        # effect.setBlurRadius(2)
        # effect.setColor(QtGui.QColor(0, 0, 0, 180))
        # effect.setOffset(0, 0)
        # self.label.setGraphicsEffect(effect)
        
        # # Center the text
        # text_rect = self.label.boundingRect()
        # self.label.setPos(
        #     radius - text_rect.width() / 2,
        #     radius - text_rect.height() / 2
        # )
        
    def mousePressEvent(self, event):
        # Right-click OR Ctrl/Cmd+Click to delete (Mac trackpad friendly)
        if event.button() == Qt.RightButton or (
            event.button() == Qt.LeftButton and 
            event.modifiers() & (Qt.ControlModifier | Qt.MetaModifier)
        ):
            self.editor.delete_grip(self.index)
            event.accept()
        else:
            self.setCursor(Qt.ClosedHandCursor)
            super().mousePressEvent(event)
    
    def mouseReleaseEvent(self, event):
        self.setCursor(Qt.OpenHandCursor)
        super().mouseReleaseEvent(event)
    
    def itemChange(self, change, value):
        if change == QtWidgets.QGraphicsItem.ItemPositionChange:
            # Update the stored coordinates when moved
            new_pos = value
            self.center_x = new_pos.x() + self.radius
            self.center_y = new_pos.y() + self.radius
            
            # Auto-detect nearest edge
            if self.editor.auto_detect_edge:
                self.side = self.editor.detect_nearest_edge(self.center_x, self.center_y)
            
            # Update in editor's points list
            if 0 <= self.index < len(self.editor.points):
                self.editor.points[self.index] = {
                    "x": self.center_x,
                    "y": self.center_y,
                    "side": self.side
                }
        
        return super().itemChange(change, value)

class GripEditorDialog(QDialog):
    def __init__(self, svg_path, parent=None):
        super().__init__(parent)

        self.setWindowTitle("Grip Editor")
        self.setMinimumSize(900, 800)
        self.svg_path = svg_path
        self.auto_detect_edge = True  # Auto-detect edge by default

        # state
        self.points = []
        self.undo_stack = []
        self.redo_stack = []
        self.grip_items = []  # Track grip graphics items

        # Main layout
        main_layout = QVBoxLayout(self)

        # ---------------- MENU BAR ----------------
        menu_bar = QtWidgets.QMenuBar(self)
        help_menu = menu_bar.addMenu("Help")

        help_text = (
            "🎯 GRIP EDITOR CONTROLS\n\n"
            
            "📌 Adding Grips\n"
            "  • Left Click → Add new grip\n"
            "  • Auto-detects nearest edge (unless manual side selected)\n\n"
            
            "✏️ Editing Grips\n"
            "  • Drag (Left Click + Move) → Move grip\n"
            "  • Right Click → Delete grip\n"
            "  • Ctrl/Cmd + Left Click → Delete grip (Mac trackpad)\n"
            "  • Side updates automatically during drag when Auto mode is enabled\n\n"
            
            "🔍 Zoom Controls\n"
            "  • Mouse Wheel / Trackpad Pinch → Zoom in/out\n"
            "  • Windows/Linux: Ctrl + '+'  /  Ctrl + '-'\n"
            "  • macOS: Cmd + '+'  /  Cmd + '-'\n"
            "  • Ctrl/Cmd + 0 → Reset zoom\n\n"
            
            "🌍 Panning the Canvas\n"
            "  • macOS Trackpad: Two-finger drag\n"
            "  • Windows/Linux Mouse: Left-drag on empty area\n"
            "  • Middle-button drag (if available) also pans\n\n"
            
            "⚡ Undo / Redo\n"
            "  • Ctrl/Cmd + Z → Undo\n"
            "  • Ctrl/Cmd + Shift + Z → Redo\n\n"
            
            "📍 Grip Features\n"
            "  • Grips show a number for easy identification\n"
            "  • Automatic nearest-edge detection (Top / Right / Bottom / Left)\n"
            "  • Manual override available via dropdown\n"
        )

        help_action = QtWidgets.QAction("Show Commands", self)
        help_action.triggered.connect(
            lambda: QtWidgets.QMessageBox.information(self, "Help", help_text)
        )

        help_menu.addAction(help_action)
        main_layout.setMenuBar(menu_bar)

        # ---------------- TOOLBAR ----------------
        toolbar = QHBoxLayout()
        
        # Reset Zoom button
        reset_zoom_btn = QPushButton("Reset Zoom (Ctrl+0)")
        reset_zoom_btn.clicked.connect(self.reset_zoom)
        toolbar.addWidget(reset_zoom_btn)
        
        # Auto-detect edge toggle
        self.auto_edge_checkbox = QtWidgets.QCheckBox("Auto-detect Edge")
        self.auto_edge_checkbox.setChecked(True)
        self.auto_edge_checkbox.stateChanged.connect(self.toggle_auto_edge)
        toolbar.addWidget(self.auto_edge_checkbox)
        
        toolbar.addStretch()
        
        # Info label
        self.info_label = QLabel("Click to add • Drag to move • Right-click or Ctrl+Click to delete")
        self.info_label.setStyleSheet("color: #666; font-size: 12px;")
        toolbar.addWidget(self.info_label)
        
        main_layout.addLayout(toolbar)

        # ---------------- SCENE + VIEW ----------------
        self.scene = QtWidgets.QGraphicsScene()

        # Permanent SVG object (never deleted)
        self.svg_item = QtSvg.QGraphicsSvgItem(svg_path)
        self.scene.addItem(self.svg_item)
        
        # Store SVG bounds for edge detection
        self.svg_bounds = self.svg_item.boundingRect()

        self.view = QtWidgets.QGraphicsView(self.scene)
        self.view.setRenderHints(
            QtGui.QPainter.Antialiasing |
            QtGui.QPainter.SmoothPixmapTransform
        )
        self.view.setDragMode(QtWidgets.QGraphicsView.NoDrag)
        self.view.viewport().setAttribute(Qt.WA_AcceptTouchEvents, True)
        self.view.setTransformationAnchor(QtWidgets.QGraphicsView.AnchorUnderMouse)

        main_layout.addWidget(self.view)

        # Capture events
        self.view.viewport().installEventFilter(self)

        # ---------------- SIDE SELECT (manual override) ----------------
        side_layout = QHBoxLayout()
        side_layout.addWidget(QLabel("Manual Side Override:"))
        self.side_select = QtWidgets.QComboBox()
        self.side_select.addItems(["Auto", "top", "right", "bottom", "left"])
        side_layout.addWidget(self.side_select)
        side_layout.addStretch()
        main_layout.addLayout(side_layout)

        # ---------------- BUTTONS ----------------
        btn_row = QHBoxLayout()
        
        undo_btn = QPushButton("Undo (Ctrl+Z)")
        undo_btn.clicked.connect(self.undo)
        btn_row.addWidget(undo_btn)
        
        redo_btn = QPushButton("Redo (Ctrl+Shift+Z)")
        redo_btn.clicked.connect(self.redo)
        btn_row.addWidget(redo_btn)
        
        btn_row.addStretch()
        
        save_btn = QPushButton("Save Grips")
        save_btn.clicked.connect(self.accept)
        save_btn.setStyleSheet("background-color: #3b82f6; color: white; padding: 8px 16px;")
        btn_row.addWidget(save_btn)
        
        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self.reject)
        btn_row.addWidget(cancel_btn)
        
        main_layout.addLayout(btn_row)

        # ---------------- SHORTCUTS ----------------
        QtWidgets.QShortcut(QtGui.QKeySequence("Ctrl+Z"), self, self.undo)
        QtWidgets.QShortcut(QtGui.QKeySequence("Ctrl+Shift+Z"), self, self.redo)
        QtWidgets.QShortcut(QtGui.QKeySequence("Ctrl++"), self, lambda: self.zoom(True))
        QtWidgets.QShortcut(QtGui.QKeySequence("Ctrl+="), self, lambda: self.zoom(True))
        QtWidgets.QShortcut(QtGui.QKeySequence("Ctrl+-"), self, lambda: self.zoom(False))
        QtWidgets.QShortcut(QtGui.QKeySequence("Ctrl+0"), self, self.reset_zoom)

        # macOS versions
        QtWidgets.QShortcut(QtGui.QKeySequence("Meta+Z"), self, self.undo)
        QtWidgets.QShortcut(QtGui.QKeySequence("Meta+Shift+Z"), self, self.redo)
        QtWidgets.QShortcut(QtGui.QKeySequence("Meta++"), self, lambda: self.zoom(True))
        QtWidgets.QShortcut(QtGui.QKeySequence("Meta+="), self, lambda: self.zoom(True))
        QtWidgets.QShortcut(QtGui.QKeySequence("Meta+-"), self, lambda: self.zoom(False))
        QtWidgets.QShortcut(QtGui.QKeySequence("Meta+0"), self, self.reset_zoom)

    # ------------------------------------------
    # Edge Detection
    # ------------------------------------------
    def detect_nearest_edge(self, x, y):
        """Detect which edge of the SVG is nearest to the point"""
        bounds = self.svg_bounds
        
        # Calculate distances to each edge
        dist_top = abs(y - bounds.top())
        dist_bottom = abs(y - bounds.bottom())
        dist_left = abs(x - bounds.left())
        dist_right = abs(x - bounds.right())
        
        # Find minimum distance
        min_dist = min(dist_top, dist_bottom, dist_left, dist_right)
        
        if min_dist == dist_top:
            return "top"
        elif min_dist == dist_bottom:
            return "bottom"
        elif min_dist == dist_left:
            return "left"
        else:
            return "right"
    
    def toggle_auto_edge(self, state):
        self.auto_detect_edge = (state == Qt.Checked)

    # ------------------------------------------
    # Event handling
    # ------------------------------------------
    def eventFilter(self, obj, event):
        if obj == self.view.viewport():

            # -----------------------------
            # Handle dragging (trackpad or mouse)
            # -----------------------------
            if event.type() == QtCore.QEvent.MouseMove:
                # Check if we're over a grip item
                scene_pos = self.view.mapToScene(event.pos())
                item = self.scene.itemAt(scene_pos, self.view.transform())
                
                # Only allow panning if NOT over a grip
                if not isinstance(item, DraggableGripItem):
                    if getattr(self, "_is_dragging", False):
                        delta = event.pos() - self._last_mouse_pos
                        self.view.horizontalScrollBar().setValue(
                            self.view.horizontalScrollBar().value() - delta.x()
                        )
                        self.view.verticalScrollBar().setValue(
                            self.view.verticalScrollBar().value() - delta.y()
                        )
                        self._last_mouse_pos = event.pos()
                        return True

                    # detect start of drag if moved enough
                    if (event.buttons() & Qt.LeftButton):
                        if (event.pos() - self._press_pos).manhattanLength() > 4:
                            self._is_dragging = True
                            self.view.setCursor(Qt.ClosedHandCursor)
                            self._last_mouse_pos = event.pos()
                            return True

            # -----------------------------
            # Start click
            # -----------------------------
            if event.type() == QtCore.QEvent.MouseButtonPress:
                if event.button() == Qt.LeftButton:
                    self._press_pos = event.pos()
                    self._is_dragging = False
                    
                    # Check if clicking on a grip - let it handle the event
                    scene_pos = self.view.mapToScene(event.pos())
                    item = self.scene.itemAt(scene_pos, self.view.transform())
                    if isinstance(item, DraggableGripItem):
                        return False  # Let the grip handle it
                    
                    return True

            # -----------------------------
            # End click → add point if NOT a drag
            # -----------------------------
            if event.type() == QtCore.QEvent.MouseButtonRelease:
                # end drag
                self.view.setCursor(Qt.ArrowCursor)

                if event.button() == Qt.LeftButton:
                    # If was a drag, do NOT place a grip
                    if getattr(self, "_is_dragging", False):
                        self._is_dragging = False
                        return True

                    # Check if we released on a grip
                    scene_pos = self.view.mapToScene(event.pos())
                    item = self.scene.itemAt(scene_pos, self.view.transform())
                    if isinstance(item, DraggableGripItem):
                        return False  # Let the grip handle it

                    # This was a REAL click → place grip
                    self.push_undo()
                    self.add_point(scene_pos)
                    return True

            # -----------------------------
            # Mouse wheel zoom
            # -----------------------------
            if event.type() == QtCore.QEvent.Wheel:
                self.zoom(event.angleDelta().y() > 0)
                return True

        return super().eventFilter(obj, event)

    # ------------------------------------------
    # Zoom Handling
    # ------------------------------------------
    def zoom(self, zoom_in=True):
        factor = 1.15 if zoom_in else 1 / 1.15

        # Prevent infinite zoom in/out
        current = self.view.transform().m11()
        if zoom_in and current > 40:
            return
        if (not zoom_in) and current < 0.05:
            return

        self.view.scale(factor, factor)
    
    def reset_zoom(self):
        """Reset zoom to fit SVG in view"""
        self.view.resetTransform()
        self.view.fitInView(self.svg_item, Qt.KeepAspectRatio)

    # ------------------------------------------
    # Adding points
    # ------------------------------------------
    def add_point(self, pos):
        # Determine side
        if self.side_select.currentText() == "Auto":
            side = self.detect_nearest_edge(pos.x(), pos.y())
        else:
            side = self.side_select.currentText()
        
        # Add to points list
        index = len(self.points)
        self.points.append({"x": pos.x(), "y": pos.y(), "side": side})
        
        # Draw the grip
        self.draw_grip(pos.x(), pos.y(), side, index)

    def draw_grip(self, x, y, side, index):
        """Draw a draggable grip item"""
        grip = DraggableGripItem(x, y, side, index, self)
        self.scene.addItem(grip)
        self.grip_items.append(grip)

    def delete_grip(self, index):
        """Delete a grip by index"""
        if 0 <= index < len(self.points):
            self.push_undo()
            self.points.pop(index)
            self.refresh_grips()

    # ------------------------------------------
    # Undo / Redo
    # ------------------------------------------
    def push_undo(self):
        import copy
        self.undo_stack.append(copy.deepcopy(self.points))
        self.redo_stack.clear()

    def undo(self):
        if not self.undo_stack:
            return

        import copy
        self.redo_stack.append(copy.deepcopy(self.points))
        self.points = self.undo_stack.pop()
        self.refresh_grips()

    def redo(self):
        if not self.redo_stack:
            return

        import copy
        self.undo_stack.append(copy.deepcopy(self.points))
        self.points = self.redo_stack.pop()
        self.refresh_grips()

    def refresh_grips(self):
        """Refresh all grip items (not SVG)"""
        # Remove all grip items
        for grip in self.grip_items:
            self.scene.removeItem(grip)
        self.grip_items.clear()

        # Redraw all grips
        for i, p in enumerate(self.points):
            self.draw_grip(p["x"], p["y"], p["side"], i)

    # ------------------------------------------
    # JSON output
    # ------------------------------------------
    def get_grips_json(self):
        """Convert absolute coordinates to percentages (0-100) relative to SVG bounds"""
        bounds = self.svg_bounds
        width = bounds.width()
        height = bounds.height()
        left = bounds.left()
        top = bounds.top()
        
        # Convert to percentages
        percentage_grips = []
        for p in self.points:
            x_percent = ((p["x"] - left) / width) * 100.0 if width > 0 else 0
            y_percent = ((p["y"] - top) / height) * 100.0 if height > 0 else 0
            
            percentage_grips.append({
                "x": round(x_percent, 2),
                "y": round(y_percent, 2),
                "side": p["side"]
            })
        
        return json.dumps(percentage_grips, indent=2)

class AddSymbolDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)

        self.setWindowTitle("Add New Symbol")
        self.setModal(True)
        self.setMinimumWidth(480)
        self.setMinimumHeight(800)

        # Modern rounded popup
        self.setStyleSheet("""
            QDialog {
                border-radius: 16px;
                background-color: #ffffff;
            }
            QLabel {
                font-size: 14px;
                font-weight: 500;
            }
            QLineEdit, QTextEdit {
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 6px;
                font-size: 14px;
            }
            QPushButton {
                padding: 8px 18px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
            }
            QPushButton#submitBtn {
                background-color: #3b82f6;
                color: white;
            }
            QPushButton#submitBtn:hover {
                background-color: #2563eb;
            }
            QPushButton#cancelBtn {
                background-color: #e5e7eb;
            }
            QPushButton#fileBtn {
                background-color: #d1d5db;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 13px;
            }
        """)

        self.svg_path = None
        self.png_path = None

        outer_layout = QVBoxLayout(self)

        scroll = QtWidgets.QScrollArea()
        scroll.setWidgetResizable(True)
        outer_layout.addWidget(scroll)

        container = QtWidgets.QWidget()
        layout = QVBoxLayout(container)
        layout.setSpacing(14)

        scroll.setWidget(container)

        # Header
        title = QLabel("Add New Symbol")
        title.setStyleSheet("font-size: 20px; font-weight: 600; margin-bottom: 10px;")
        layout.addWidget(title)

        # --- Input Fields ---
        self.sno = self._line(layout, "S No")
        self.parent = self._line(layout, "Parent")
        self.name = self._line(layout, "Name")
        self.legend = self._line(layout, "Legend")
        self.suffix = self._line(layout, "Suffix")
        self.object = self._line(layout, "Object")

        # Grips field
        grips_label = QLabel("Grips (JSON)")
        layout.addWidget(grips_label)

        self.grips = QTextEdit()
        self.grips.setPlaceholderText('[{"x":50,"y":100,"side":"top"}]')
        layout.addWidget(self.grips)

        # File pickers
        layout.addWidget(QLabel("SVG File"))
        self.svg_btn = QPushButton("Choose SVG File")
        self.svg_btn.setObjectName("fileBtn")
        self.svg_btn.clicked.connect(self.pick_svg)
        layout.addWidget(self.svg_btn)

        # Grip Editor
        self.edit_grips_btn = QPushButton("Open Grip Editor")
        self.edit_grips_btn.setObjectName("fileBtn")
        self.edit_grips_btn.clicked.connect(self.open_grip_editor)
        layout.addWidget(self.edit_grips_btn)

        layout.addWidget(QLabel("PNG File"))
        self.png_btn = QPushButton("Choose PNG File")
        self.png_btn.setObjectName("fileBtn")
        self.png_btn.clicked.connect(self.pick_png)
        layout.addWidget(self.png_btn)

        # Buttons
        btn_row = QHBoxLayout()
        btn_row.addStretch(1)

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setObjectName("cancelBtn")
        self.cancel_btn.clicked.connect(self.reject)
        btn_row.addWidget(self.cancel_btn)

        self.submit_btn = QPushButton("Submit")
        self.submit_btn.setObjectName("submitBtn")
        self.submit_btn.clicked.connect(self.submit)
        btn_row.addWidget(self.submit_btn)

        layout.addLayout(btn_row)

    def _line(self, layout, placeholder):
        lbl = QLabel(placeholder)
        layout.addWidget(lbl)
        line = QLineEdit()
        line.setPlaceholderText(placeholder)
        layout.addWidget(line)
        return line

    def pick_svg(self):
        path, _ = QFileDialog.getOpenFileName(self, "Select SVG", "", "SVG Files (*.svg)")
        if path:
            self.svg_path = path
            self.svg_btn.setText(os.path.basename(path))

    def pick_png(self):
        path, _ = QFileDialog.getOpenFileName(self, "Select PNG", "", "PNG Files (*.png)")
        if path:
            self.png_path = path
            self.png_btn.setText(os.path.basename(path))

    def submit(self):
        if not all([self.sno.text(), self.name.text(), self.object.text()]):
            QtWidgets.QMessageBox.warning(self, "Missing Fields", "S No, Name & Object are required.")
            return

        data = {
            "s_no": self.sno.text(),
            "parent": self.parent.text(),
            "name": self.name.text(),
            "legend": self.legend.text(),
            "suffix": self.suffix.text(),
            "object": self.object.text(),
            "grips": self.grips.toPlainText(),
        }

        files = {}
        if self.svg_path:
            files["svg"] = open(self.svg_path, "rb")
        if self.png_path:
            files["png"] = open(self.png_path, "rb")

        response = post_component(data, files)

        if hasattr(response, "status_code") and response.status_code in (200, 201):
            QtWidgets.QMessageBox.information(self, "Success", "Symbol added successfully.")
            self.accept()
        else:
            QtWidgets.QMessageBox.critical(self, "Error", "Failed to add component.")

    def open_grip_editor(self):
        if not self.svg_path:
            QtWidgets.QMessageBox.warning(self, "No SVG", "Please select an SVG file first.")
            return

        dlg = GripEditorDialog(self.svg_path, self)
        if dlg.exec_() == QDialog.Accepted:
            grips_json = dlg.get_grips_json()
            self.grips.setText(grips_json)