import os
import csv 
import json
from PyQt5.QtWidgets import QWidget
from PyQt5.QtSvg import QSvgRenderer
from PyQt5.QtCore import Qt, QRectF, QPoint
from PyQt5.QtGui import QPainter, QColor, QPen

class ComponentWidget(QWidget):
    def __init__(self, svg_path, parent=None, config=None):
        super().__init__(parent)
        self.svg_path = svg_path
        self.config = config or {}
        self.renderer = QSvgRenderer(svg_path)

        # Standard component size
        self.setFixedSize(100, 80)

        self.hover_port = None
        self.is_selected = False
        self.drag_start_global = None

        self.setAttribute(Qt.WA_Hover, True)
        self.setMouseTracking(True)

    def get_content_rect(self):
        bottom_pad = 25 if self.config.get('default_label') else 10
        w = max(1, self.width() - 20)
        h = max(1, self.height() - 10 - bottom_pad)
        return QRectF(10, 10, w, h)
    
    def load_grips_from_csv(self):
        """
        Load grips from Component_Details.csv using s_no for unique matching.
        Falls back to object name if s_no is not available.
        Returns a list or None.
        """
        # Priority 1: Match by s_no (most specific)
        s_no = self.config.get("s_no", "").strip()
        object_name = self.config.get("object", "").strip()
        
        if not s_no and not object_name:
            return None

        csv_path = os.path.join("ui", "assets", "Component_Details.csv")
        if not os.path.exists(csv_path):
            return None

        try:
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Try matching by s_no first (unique identifier)
                    if s_no and row.get("s_no", "").strip() == s_no:
                        grips_str = row.get("grips", "").strip()
                        if grips_str:
                            try:
                                # Convert Python dict syntax to JSON (single quotes to double quotes)
                                grips_str_fixed = grips_str.replace("'", '"')
                                grips_json = json.loads(grips_str_fixed)
                                if isinstance(grips_json, list):
                                    # print(f"[GRIPS] Loaded {len(grips_json)} grips from CSV for s_no={s_no}")
                                    return grips_json
                            except Exception as e:
                                print(f"[GRIPS] Invalid JSON for s_no={s_no}: {grips_str}")
                                print(f"[GRIPS] Error: {e}")
                                return None
                    
                    # Fallback: match by object name
                    elif not s_no and object_name and row.get("object", "").strip() == object_name:
                        grips_str = row.get("grips", "").strip()
                        if grips_str:
                            try:
                                grips_str_fixed = grips_str.replace("'", '"')
                                grips_json = json.loads(grips_str_fixed)
                                if isinstance(grips_json, list):
                                    # print(f"[GRIPS] Loaded {len(grips_json)} grips from CSV for object={object_name}")
                                    return grips_json
                            except Exception as e:
                                print(f"[GRIPS] Invalid JSON for object={object_name}: {grips_str}")
                                print(f"[GRIPS] Error: {e}")
                                return None
        except Exception as e:
            print("[CSV ERROR]", e)

        return None

    def get_grips(self):
        """
        Centralized grip loading with priority:
        1. CSV grips (highest priority)
        2. Config grips
        3. Default fallback grips
        """
        # 1. First priority → CSV grips (force override)
        grips = self.load_grips_from_csv()

        # 2. Second → config grips (convert string to JSON if needed)
        if grips is None:
            cfg = self.config.get("grips")
            if isinstance(cfg, str):
                try:
                    grips = json.loads(cfg)
                except:
                    grips = None
            elif isinstance(cfg, list):
                grips = cfg

        # 3. Final fallback → default grips
        if grips is None:
            grips = [
                {"x": 0, "y": 50, "side": "left"},
                {"x": 100, "y": 50, "side": "right"},
            ]

        return grips

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        # Selection Border
        if self.is_selected:
            painter.setPen(QPen(QColor("#60a5fa"), 2))
            painter.setBrush(Qt.NoBrush)
            painter.drawRoundedRect(self.rect().adjusted(1, 1, -1, -1), 8, 8)

        content_rect = self.get_content_rect()

        # Render SVG
        view_box = self.renderer.viewBoxF()
        if not view_box.isEmpty():
            src_aspect = view_box.width() / view_box.height()
            dest_aspect = content_rect.width() / content_rect.height()

            target_rect = QRectF(content_rect)
            if src_aspect > dest_aspect:
                # SVG is wider than destination: fit to width
                new_h = content_rect.width() / src_aspect
                target_rect.setHeight(new_h)
                target_rect.moveTop(content_rect.top() + (content_rect.height() - new_h) / 2)
            else:
                # SVG is taller/same: fit to height
                new_w = content_rect.height() * src_aspect
                target_rect.setWidth(new_w)
                target_rect.moveLeft(content_rect.left() + (content_rect.width() - new_w) / 2)
            
            self.renderer.render(painter, target_rect)
        else:
            self.renderer.render(painter, content_rect)

        # Label
        if self.config.get('default_label'):
            painter.setPen(QPen(Qt.black))
            text_rect = QRectF(0, content_rect.bottom() + 2, self.width(), 20)
            painter.drawText(text_rect, Qt.AlignCenter, self.config['default_label'])

        # Draw Ports using centralized grip loading
        grips = self.get_grips()
        for idx, grip in enumerate(grips):
            self.draw_dynamic_port(painter, grip, idx, content_rect)

    def draw_dynamic_port(self, painter, grip, idx, content_rect):
        cx = content_rect.x() + (grip["x"] / 100.0) * content_rect.width()
        cy = content_rect.y() + (grip["y"] / 100.0) * content_rect.height()
        center = QPoint(int(cx), int(cy))

        radius = 6 if self.hover_port == idx else 4
        color = QColor("#22c55e") if self.hover_port == idx else QColor("cyan")

        painter.setBrush(color)
        painter.setPen(Qt.NoPen)
        painter.drawEllipse(center, radius, radius)

    def get_grip_position(self, idx):
        """Get grip position using centralized loading"""
        grips = self.get_grips()

        if 0 <= idx < len(grips):
            grip = grips[idx]
            content_rect = self.get_content_rect()
            cx = content_rect.x() + (grip["x"] / 100.0) * content_rect.width()
            cy = content_rect.y() + (grip["y"] / 100.0) * content_rect.height()
            return QPoint(int(cx), int(cy))

        return QPoint(0, 0)

    # SELECTION
    def set_selected(self, selected: bool):
        self.is_selected = selected
        self.update()

    # MOUSE PRESS
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:

            # FIRST: CHECK IF CLICKED A PORT — START A CONNECTION
            if self.hover_port is not None:
                if hasattr(self.parent(), "start_connection"):
                    grips = self.get_grips()  # Use centralized loading
                    side = grips[self.hover_port].get("side", "right")
                    self.parent().start_connection(self, self.hover_port, side)
                    self.parent().setFocus()
                    event.accept()
                    return

            # SELECTION HANDLING
            ctrl = bool(event.modifiers() & Qt.ControlModifier)
            if hasattr(self.parent(), "handle_selection"):
                self.parent().handle_selection(self, ctrl)
            else:
                self.is_selected = True
                self.update()

            if self.parent():
                self.parent().setFocus()

            # PREPARE DRAG
            self.drag_start_global = event.globalPos()

            event.accept()
        else:
            super().mousePressEvent(event)

    # MOUSE MOVE
    def mouseMoveEvent(self, event):
        # If drawing connection, forward movement to canvas
        if hasattr(self.parent(), "active_connection") and self.parent().active_connection:
            g = self.mapToGlobal(event.pos())
            parent_pos = self.parent().mapFromGlobal(g)
            if hasattr(self.parent(), "update_connection_drag"):
                self.parent().update_connection_drag(parent_pos)
            return

        # PORT HOVER DETECTION using centralized grip loading
        pos = event.pos()
        prev = self.hover_port
        self.hover_port = None

        grips = self.get_grips()  # Use centralized loading
        content_rect = self.get_content_rect()

        for idx, grip in enumerate(grips):
            cx = content_rect.x() + (grip["x"] / 100.0) * content_rect.width()
            cy = content_rect.y() + (grip["y"] / 100.0) * content_rect.height()
            center = QPoint(int(cx), int(cy))

            if (pos - center).manhattanLength() < 10:
                self.hover_port = idx
                break

        if prev != self.hover_port:
            self.update()

        # DRAGGING
        if event.buttons() & Qt.LeftButton and self.drag_start_global:
            curr_global = event.globalPos()
            delta = curr_global - self.drag_start_global

            parent = self.parent()
            if parent and hasattr(parent, "components"):
                # move all selected
                for comp in parent.components:
                    if comp.is_selected:
                        # Calculate new pos
                        new_pos = comp.pos() + delta
                        
                        # Boundary checks
                        pw = parent.width()
                        ph = parent.height()
                        cw = comp.width()
                        ch = comp.height()
                        
                        # Clamp X and Y
                        nx = max(0, min(new_pos.x(), pw - cw))
                        ny = max(0, min(new_pos.y(), ph - ch))
                        
                        # Apply new position
                        comp.move(nx, ny)
                        
                parent.update()
            else:
                new_pos = self.pos() + delta
                
                # Boundary Check for single item (if unrelated parent)
                if parent:
                    pw = parent.width()
                    ph = parent.height()
                    nx = max(0, min(new_pos.x(), pw - self.width()))
                    ny = max(0, min(new_pos.y(), ph - self.height()))
                    self.move(nx, ny)
                    parent.update()
                else:
                    self.move(new_pos)

            self.drag_start_global = curr_global

    # MOUSE RELEASE
    def mouseReleaseEvent(self, event):
        # Forward release during connection building
        if hasattr(self.parent(), "active_connection") and self.parent().active_connection:
            g = self.mapToGlobal(event.pos())
            parent_pos = self.parent().mapFromGlobal(g)
            if hasattr(self.parent(), "handle_connection_release"):
                self.parent().handle_connection_release(parent_pos)

        self.drag_start_global = None
        super().mouseReleaseEvent(event)