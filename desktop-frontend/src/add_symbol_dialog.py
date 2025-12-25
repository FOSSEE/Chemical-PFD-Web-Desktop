import os
from PyQt5 import QtWidgets
from PyQt5.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QLineEdit, QTextEdit, QFileDialog
)

from src.api_client import post_component
import src.app_state as app_state
from src.grip_editor_dialog import GripEditorDialog

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