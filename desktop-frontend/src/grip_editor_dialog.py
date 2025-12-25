import json
from PyQt5 import QtWidgets, QtGui, QtSvg, QtCore
from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import ( QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton)

class DraggableGripItem(QtWidgets.QGraphicsEllipseItem):
    """Draggable grip with proper text label that does not break hit detection."""

    def __init__(self, x, y, side, index, editor, radius=10):
        super().__init__(-radius, -radius, radius*2, radius*2)

        self.editor = editor
        self.index = index
        self.side = side
        self.radius = radius

        # Move item center to (x,y)
        self.setPos(x, y)

        # Circle styling
        self.setPen(QtGui.QPen(Qt.white, 2))
        self.setBrush(QtGui.QBrush(QtGui.QColor("#ef4444")))
        self.setZValue(10)
        self.setFlag(self.ItemIsMovable)
        self.setFlag(self.ItemSendsGeometryChanges)
        self.setCursor(Qt.OpenHandCursor)

        # -------- LABEL (REAL QGraphicsTextItem) --------
        self.label = QtWidgets.QGraphicsTextItem(str(index + 1), self)
        self.label.setDefaultTextColor(Qt.black)

        font = QtGui.QFont()
        font.setPixelSize(11)
        font.setBold(True)
        self.label.setFont(font)

        # Add white outline
        outline = QtWidgets.QGraphicsDropShadowEffect()
        outline.setColor(Qt.white)
        outline.setBlurRadius(5)
        outline.setOffset(0, 0)
        self.label.setGraphicsEffect(outline)

        self.center_label()

    def center_label(self):
        """Centers the label inside the circle using item coordinates."""
        rect = self.label.boundingRect()
        self.label.setPos(
            -rect.width() / 2,
            -rect.height() / 2
        )

    # ----------- Interaction ----------------
    def mousePressEvent(self, event):
        # Right-click OR Ctrl/Cmd-click → delete
        if event.button() == Qt.RightButton or (
            event.button() == Qt.LeftButton and 
            event.modifiers() & (Qt.ControlModifier | Qt.MetaModifier)
        ):
            self.editor.delete_grip(self.index)
            event.accept()
            return

        self.setCursor(Qt.ClosedHandCursor)
        super().mousePressEvent(event)

    def mouseReleaseEvent(self, event):
        self.setCursor(Qt.OpenHandCursor)
        super().mouseReleaseEvent(event)

    def itemChange(self, change, value):
        if change == self.ItemPositionChange:
            new_pos = value
            x = new_pos.x()
            y = new_pos.y()

            # auto update side
            if self.editor.auto_detect_edge:
                self.side = self.editor.detect_nearest_edge(x, y)

            if 0 <= self.index < len(self.editor.points):
                self.editor.points[self.index] = {"x": x, "y": y, "side": self.side}

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
            "GRIP EDITOR CONTROLS\n\n"
            
            "Adding Grips\n"
            "  • Left Click → Add new grip\n"
            "  • Auto-detects nearest edge (unless manual side selected)\n\n"
            
            "Editing Grips\n"
            "  • Drag (Left Click + Move) → Move grip\n"
            "  • Right Click → Delete grip\n"
            "  • Ctrl/Cmd + Left Click → Delete grip (Mac trackpad)\n"
            "  • Side updates automatically during drag when Auto mode is enabled\n\n"
            
            "Zoom Controls\n"
            "  • Mouse Wheel / Trackpad Pinch → Zoom in/out\n"
            "  • Windows/Linux: Ctrl + '+'  /  Ctrl + '-'\n"
            "  • macOS: Cmd + '+'  /  Cmd + '-'\n"
            "  • Ctrl/Cmd + 0 → Reset zoom\n\n"
            
            "Panning the Canvas\n"
            "  • macOS Trackpad: Two-finger drag\n"
            "  • Windows/Linux Mouse: Left-drag on empty area\n"
            "  • Middle-button drag (if available) also pans\n\n"
            
            "Undo / Redo\n"
            "  • Ctrl/Cmd + Z → Undo\n"
            "  • Ctrl/Cmd + Shift + Z → Redo\n\n"
            
            "Grip Features\n"
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
        import json
        return json.dumps(self.points, indent=2)
