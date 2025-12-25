from PyQt5 import QtWidgets, QtGui
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QColor, QBrush, QKeySequence
from PyQt5.QtWidgets import QMainWindow, QWidget, QHBoxLayout, QMdiArea, QShortcut

from src.canvas.widget import CanvasWidget
from src.component_library import ComponentLibrary
from src.theme import apply_theme_to_screen
from src.navigation import slide_to_index
import src.app_state as app_state


class CanvasScreen(QMainWindow):
    def __init__(self):
        super().__init__()

        from src.menubar import MenuBarManager
        self.menu_manager = MenuBarManager(self)
        self._connect_menu_signals()

        container = QWidget()
        self.setCentralWidget(container)
        
        main_layout = QHBoxLayout(container)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

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
        self._register_shortcuts()

    def _connect_menu_signals(self):
        self.menu_manager.new_project_clicked.connect(self.on_new_project)
        self.menu_manager.back_home_clicked.connect(self.on_back_home)
        self.menu_manager.back_home_clicked.connect(self.on_back_home)
        self.menu_manager.delete_clicked.connect(self.on_delete_component)
        self.menu_manager.logout_clicked.connect(self.logout)
        self.menu_manager.undo_clicked.connect(self.on_undo)
        self.menu_manager.redo_clicked.connect(self.on_redo)

        # Placeholders
        self.menu_manager.open_project_clicked.connect(lambda: print("Open Project clicked"))
        self.menu_manager.save_project_clicked.connect(self.on_save_project)
        self.menu_manager.generate_image_clicked.connect(self.on_generate_image)
        self.menu_manager.generate_report_clicked.connect(self.on_generate_report)
        self.menu_manager.add_symbols_clicked.connect(self.open_add_symbol_dialog)

    def on_new_project(self):
        canvas = CanvasWidget(self)
        canvas.update_canvas_theme()
        
        sub = self.mdi_area.addSubWindow(canvas)
        sub.setWindowTitle("New Project")
        sub.showMaximized()

    def open_add_symbol_dialog(self):
        from src.add_symbol_dialog import AddSymbolDialog
        dlg = AddSymbolDialog(self)
        # When dialog is accepted, refresh the library
        if dlg.exec_() == QtWidgets.QDialog.Accepted:
            self.library.reload_components()

    def on_back_home(self):
        slide_to_index(3, direction=-1)

    def _register_shortcuts(self):
        """Register cross-platform shortcuts for Add Symbol dialog."""

        # Windows/Linux -> Ctrl + A
        shortcut_ctrl_a = QShortcut(QKeySequence("Ctrl+A"), self)
        shortcut_ctrl_a.activated.connect(self.open_add_symbol_dialog)

        # macOS -> Cmd + A  (Meta key = Command key)
        shortcut_cmd_a = QShortcut(QKeySequence("Meta+A"), self)
        shortcut_cmd_a.activated.connect(self.open_add_symbol_dialog)

        # print("Shortcut registered: Ctrl+A / Cmd+A -> Add New Symbol")


    def on_delete_component(self):
        active_sub = self.mdi_area.currentSubWindow()
        if active_sub and isinstance(active_sub.widget(), CanvasWidget):
            active_sub.widget().delete_selected_components()

    def on_undo(self):
        active_sub = self.mdi_area.currentSubWindow()
        if active_sub and isinstance(active_sub.widget(), CanvasWidget):
            active_sub.widget().undo_stack.undo()

    def on_redo(self):
        active_sub = self.mdi_area.currentSubWindow()
        if active_sub and isinstance(active_sub.widget(), CanvasWidget):
            active_sub.widget().undo_stack.redo()

    def on_save_project(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub.widget(), CanvasWidget):
            return

        canvas = active_sub.widget()
        options = QtWidgets.QFileDialog.Options()
        filename, filter_type = QtWidgets.QFileDialog.getSaveFileName(
            self, "Save Project", "", 
            "PDF Files (*.pdf);;JPEG Files (*.jpg);;PFD Files (*.pfd)", 
            options=options
        )

        if not filename:
            return

        if filter_type.startswith("PDF"):
            if not filename.lower().endswith(".pdf"):
                filename += ".pdf"
            canvas.export_to_pdf(filename)
        elif filter_type.startswith("JPEG"):
            if not filename.lower().endswith(".jpg"):
                filename += ".jpg"
            canvas.export_to_image(filename)
        elif filter_type.startswith("PFD"):
            print("PFD Save not implemented yet")

    def on_generate_image(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub.widget(), CanvasWidget):
            return
            
        canvas = active_sub.widget()
        options = QtWidgets.QFileDialog.Options()
        filename, _ = QtWidgets.QFileDialog.getSaveFileName(
            self, "Generate Image", "", 
            "JPEG Files (*.jpg);;PNG Files (*.png)", 
            options=options
        )
        
        if filename:
            canvas.export_to_image(filename)
            
    def on_generate_report(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub.widget(), CanvasWidget):
            return
            
        canvas = active_sub.widget()
        options = QtWidgets.QFileDialog.Options()
        filename, _ = QtWidgets.QFileDialog.getSaveFileName(
            self, "Generate PDF Report", "", 
            "PDF Files (*.pdf)", 
            options=options
        )
        
        if filename:
            if not filename.lower().endswith(".pdf"):
                filename += ".pdf"
            try:
                canvas.generate_report(filename)
                QtWidgets.QMessageBox.information(self, "Success", f"Report saved to {filename}")
            except Exception as e:
                QtWidgets.QMessageBox.critical(self, "Error", f"Failed to generate report:\n{str(e)}")

    def logout(self):
        app_state.access_token = None
        app_state.refresh_token = None
        app_state.current_user = None
        slide_to_index(0, direction=-1)
