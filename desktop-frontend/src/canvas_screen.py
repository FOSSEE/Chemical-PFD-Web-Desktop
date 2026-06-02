import os
from PyQt5 import QtWidgets
from PyQt5.QtGui import QColor, QBrush, QKeySequence
from PyQt5.QtWidgets import QMainWindow, QWidget, QHBoxLayout, QShortcut, QMdiSubWindow, QSplitter
from PyQt5.QtCore import Qt, QTimer, pyqtSignal

from src.canvas.widget import CanvasWidget
from src.component_library import ComponentLibrary
from src.theme import apply_theme_to_screen
from src.navigation import slide_to_index
import src.app_state as app_state
from src.theme_manager import theme_manager

class OverlayContainer(QWidget):
    def __init__(self, canvas, scroll_area, parent=None):
        super().__init__(parent)
        self.canvas = canvas
        self.scroll_area = scroll_area
        
        layout = QtWidgets.QGridLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        layout.addWidget(self.scroll_area, 0, 0)
        
        self.toolbar_frame = QtWidgets.QFrame()
        self.toolbar_frame.setStyleSheet("background-color: white; border: 1px solid #e2e8f0; border-radius: 8px;")
        btn_layout = QtWidgets.QHBoxLayout(self.toolbar_frame)
        btn_layout.setContentsMargins(5, 5, 5, 5)
        
        self.zoom_out_btn = QtWidgets.QPushButton("-")
        self.zoom_out_btn.setFixedSize(30, 30)
        self.zoom_out_btn.clicked.connect(self.canvas.zoom_out)
        
        self.zoom_fit_btn = QtWidgets.QPushButton("Fit")
        self.zoom_fit_btn.setFixedSize(40, 30)
        self.zoom_fit_btn.clicked.connect(self.canvas.zoom_fit)
        
        self.zoom_in_btn = QtWidgets.QPushButton("+")
        self.zoom_in_btn.setFixedSize(30, 30)
        self.zoom_in_btn.clicked.connect(self.canvas.zoom_in)
        
        btn_layout.addWidget(self.zoom_out_btn)
        btn_layout.addWidget(self.zoom_fit_btn)
        btn_layout.addWidget(self.zoom_in_btn)
        
        layout.addWidget(self.toolbar_frame, 0, 0, Qt.AlignBottom | Qt.AlignRight)
        layout.setContentsMargins(0, 0, 20, 20)
        
        layout.setContentsMargins(0, 0, 20, 20)


class ImageSubWindow(QMdiSubWindow):
    def __init__(self, image_path, parent=None):
        super().__init__(parent)
        self.image_path = image_path
        self.setAttribute(Qt.WA_DeleteOnClose)
        
        self.scale_factor = 1.0
        self.original_pixmap = None
        self.first_show = True
        
        self.scroll_area = QtWidgets.QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.setWidget(self.scroll_area)
        
        self.image_label = QtWidgets.QLabel()
        self.image_label.setAlignment(Qt.AlignCenter)
        self.scroll_area.setWidget(self.image_label)
        
        self.load_image()
        
    def load_image(self):
        from PyQt5.QtGui import QPixmap
        self.original_pixmap = QPixmap(self.image_path)
        if not self.original_pixmap.isNull():
            self.image_label.setPixmap(self.original_pixmap)
        else:
            self.image_label.setText("Failed to load image.")

    def wheelEvent(self, event):
        if event.modifiers() & Qt.ControlModifier:
            delta = event.angleDelta().y()
            if delta > 0:
                self.zoom_in()
            else:
                self.zoom_out()
            event.accept()
        else:
            super().wheelEvent(event)

    def zoom_in(self):
        self.scale_factor *= 1.1
        self.update_image_size()

    def zoom_out(self):
        self.scale_factor /= 1.1
        if self.scale_factor < 0.1: self.scale_factor = 0.1
        self.update_image_size()

    def showEvent(self, event):
        super().showEvent(event)
        if self.first_show:
            self.first_show = False
            from PyQt5.QtCore import QTimer
            QTimer.singleShot(50, self.fit_to_window)

    def fit_to_window(self):
        if not self.original_pixmap: return
        viewport = self.scroll_area.viewport()
        view_size = viewport.size()
        
        if view_size.width() <= 0 or view_size.height() <= 0: return
        
        img_size = self.original_pixmap.size()
        if img_size.width() <= 0 or img_size.height() <= 0: return
        
        ratio_w = view_size.width() / img_size.width()
        ratio_h = view_size.height() / img_size.height()
        
        self.scale_factor = min(ratio_w, ratio_h) * 0.95
        self.update_image_size()

    def update_image_size(self):
        if self.original_pixmap and not self.original_pixmap.isNull():
            new_size = self.original_pixmap.size() * self.scale_factor
            self.image_label.setPixmap(
                self.original_pixmap.scaled(
                    new_size, Qt.KeepAspectRatio, Qt.SmoothTransformation
                )
            )

class PDFSubWindow(QMdiSubWindow):
    def __init__(self, pdf_path, parent=None):
        from PyQt5.QtWidgets import QVBoxLayout, QLabel, QScrollArea, QWidget
        from PyQt5.QtCore import Qt
        
        super().__init__(parent)
        self.pdf_path = pdf_path
        self.setAttribute(Qt.WA_DeleteOnClose)
        
        self.zoom_level = 1.0
        self.doc = None
        self.first_show = True

        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.setWidget(self.scroll_area)

        self.container = QWidget()
        self.layout = QVBoxLayout(self.container)
        self.layout.setSpacing(20)
        self.layout.setAlignment(Qt.AlignCenter)
        self.scroll_area.setWidget(self.container)
        
        self.load_pdf()

    def load_pdf(self):
        try:
            import fitz
            self.doc = fitz.open(self.pdf_path)
            self.render_pages()
        except Exception as e:
            err_lbl = QtWidgets.QLabel(f"Failed to load PDF: {str(e)}")
            self.layout.addWidget(err_lbl)

    def render_pages(self):
        if not self.doc:
            return

        import fitz
        from PyQt5.QtGui import QImage, QPixmap
        from PyQt5.QtWidgets import QLabel
        from PyQt5.QtCore import Qt

        for i in reversed(range(self.layout.count())): 
            widget = self.layout.itemAt(i).widget()
            if widget is not None:
                widget.deleteLater()

        for page_num in range(len(self.doc)):
            page = self.doc.load_page(page_num)
            pix = page.get_pixmap(matrix=fitz.Matrix(self.zoom_level, self.zoom_level))
            
            fmt = QImage.Format_RGB888
            if pix.alpha:
                fmt = QImage.Format_RGBA8888
                
            qimg = QImage(pix.samples, pix.width, pix.height, pix.stride, fmt)
            qpix = QPixmap.fromImage(qimg)
            
            lbl = QLabel()
            lbl.setPixmap(qpix)
            lbl.setAlignment(Qt.AlignCenter)
            lbl.setStyleSheet("border: 1px solid #ccc; background-color: white;")
            
            self.layout.addWidget(lbl)

    def wheelEvent(self, event):
        if event.modifiers() & Qt.ControlModifier:
            delta = event.angleDelta().y()
            if delta > 0:
                self.zoom_in()
            else:
                self.zoom_out()
            event.accept()
        else:
            super().wheelEvent(event)

    def zoom_in(self):
        self.zoom_level *= 1.2
        if self.zoom_level > 20.0: self.zoom_level = 20.0
        self.render_pages()

    def zoom_out(self):
        self.zoom_level /= 1.2
        if self.zoom_level < 0.1: self.zoom_level = 0.1
        self.render_pages()

    def showEvent(self, event):
        super().showEvent(event)
        if self.first_show:
            self.first_show = False
            from PyQt5.QtCore import QTimer
            QTimer.singleShot(50, self.fit_to_window)

    def fit_to_window(self):
        if not self.doc: return
        
        viewport = self.scroll_area.viewport()
        view_size = viewport.size()
        
        if view_size.width() <= 0: return
        
        page = self.doc.load_page(0)
        rect = page.rect
        
        ratio_w = view_size.width() / rect.width
        ratio_h = view_size.height() / rect.height
        
        self.zoom_level = min(ratio_w, ratio_h) * 0.95
        self.render_pages()

class CanvasSubWindow(QMdiSubWindow):
    def get_canvas(self):
        w = self.widget()
        if isinstance(w, OverlayContainer):
            return w.canvas
        if isinstance(w, QtWidgets.QScrollArea):
            return w.widget()
        return w

    def closeEvent(self, event):
        canvas = self.get_canvas()
        if canvas and hasattr(canvas, "is_modified"): 
            from src.canvas.commands import handle_close_event
            handle_close_event(canvas, event)
        else:
            event.accept()

class CanvasScreen(QMainWindow):
    # Signal emitted when a project is successfully saved
    project_saved = pyqtSignal()
    
    def closeEvent(self, event):
        """Handle application close by attempting to close all tabs."""
        self.mdi_area.closeAllSubWindows()
        if self.mdi_area.subWindowList():
            event.ignore()
        else:
            event.accept()

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

        self.splitter = QSplitter(Qt.Horizontal)
        self.splitter.setHandleWidth(2)
        self.splitter.setStyleSheet("QSplitter::handle { background-color: #e2e8f0; }")

        self.library = ComponentLibrary(self)
        self.library.setMinimumWidth(360)
        
        self.mdi_area = QtWidgets.QMdiArea()
        self.mdi_area.setViewMode(QtWidgets.QMdiArea.TabbedView)
        self.mdi_area.setTabsClosable(True)
        self.mdi_area.setTabsMovable(True)
        self.mdi_area.setBackground(QBrush(QColor("#505050")))

        self.splitter.addWidget(self.library)
        self.splitter.addWidget(self.mdi_area)
        
        self.splitter.setStretchFactor(0, 0)
        self.splitter.setStretchFactor(1, 1)
        
        main_layout.addWidget(self.splitter)

        QTimer.singleShot(0, self._apply_default_library_size)

        theme_manager.theme_changed.connect(self.apply_mdi_theme)
        self.apply_mdi_theme(theme_manager.current_theme)

        apply_theme_to_screen(self)
        self._register_shortcuts()

    def _connect_menu_signals(self):
        self.menu_manager.new_project_clicked.connect(self.on_new_project)
        self.menu_manager.back_home_clicked.connect(self.on_back_home)
        self.menu_manager.delete_clicked.connect(self.on_delete_component)
        self.menu_manager.logout_clicked.connect(self.logout)
        self.menu_manager.undo_clicked.connect(self.on_undo)
        self.menu_manager.redo_clicked.connect(self.on_redo)
        self.menu_manager.open_project_clicked.connect(self.on_open_file)
        self.menu_manager.save_project_clicked.connect(self.on_save_file)
        self.menu_manager.save_project_as_clicked.connect(self.on_save_as_file)
        self.menu_manager.generate_excel_clicked.connect(self.on_generate_excel)
        self.menu_manager.generate_report_clicked.connect(self.on_generate_report)
        self.menu_manager.add_symbols_clicked.connect(self.open_add_symbol_dialog)

    def apply_mdi_theme(self, theme):
        """Apply theme to MDI area title bar and tabs."""
        if theme == "dark":
            mdi_stylesheet = """
                QMdiArea { background-color: #0f172a; }
                QTabBar::tab {
                    background-color: #1e293b; color: #cbd5e1;
                    border: 1px solid #334155; border-bottom: none;
                    border-top-left-radius: 6px; border-top-right-radius: 6px;
                    padding: 10px 16px; margin-right: 2px; font-size: 13px;
                    min-height: 28px;
                    font-family: "Segoe UI Emoji", "Segoe UI Symbol", "Segoe UI";
                }
                QTabBar::tab:selected {
                    background-color: #3b82f6; color: #ffffff;
                    border-color: #3b82f6; font-weight: bold;
                }
                QTabBar::tab:hover:!selected {
                    background-color: #334155; color: #f1f5f9;
                }
                QMdiSubWindow { background-color: #0f172a; }
            """
        else:
            mdi_stylesheet = """
                QMdiArea { background-color: #fffaf5; }
                QTabBar::tab {
                    background-color: #f4e8dc; color: #3A2A20;
                    border: 1px solid #C97B5A; border-bottom: none;
                    border-top-left-radius: 6px; border-top-right-radius: 6px;
                    padding: 10px 16px; margin-right: 2px; font-size: 13px;
                    min-height: 28px;
                    font-family: "Segoe UI Emoji", "Segoe UI Symbol", "Segoe UI";
                }
                QTabBar::tab:selected {
                    background-color: #C97B5A; color: #ffffff;
                    border-color: #C97B5A; font-weight: bold;
                }
                QTabBar::tab:hover:!selected {
                    background-color: #ffffff; color: #3A2A20;
                }
                QMdiSubWindow { background-color: #fffaf5; }
            """
        
        self.mdi_area.setStyleSheet(mdi_stylesheet)

    def on_new_project(self):
        """Create a new canvas and immediately create a backend project."""
        from src.api_client import create_project
        from PyQt5.QtWidgets import QInputDialog
        
        # Ask for project name
        project_name, ok = QInputDialog.getText(
            self, 
            "New Project", 
            "Enter project name:",
            text="Untitled Project"
        )
        
        if not ok or not project_name.strip():
            return
        
        # Create project on backend
        project_data = create_project(name=project_name.strip(), description="")
        
        if not project_data:
            QtWidgets.QMessageBox.critical(
                self, 
                "Error", 
                "Failed to create project on server."
            )
            return
        
        # Create and open the project (Pass True for is_freshly_created)
        self._create_canvas_for_project(project_data, is_freshly_created=True)

    def _create_canvas_for_project(self, project_data, is_freshly_created=False):
        """Helper to create a canvas window for a project (new or existing)"""
        # Store project info in app state
        app_state.current_project_id = project_data.get("id")
        app_state.current_project_name = project_data.get("name")
        
        print(f"[PROJECT] Opening project: ID={app_state.current_project_id}, Name={app_state.current_project_name}")
        
        # Create canvas
        canvas = CanvasWidget(self)
        canvas.update_canvas_theme()
        
        # Link canvas to project
        canvas.project_id = app_state.current_project_id
        canvas.project_name = app_state.current_project_name

        # Set flag on canvas ---
        canvas.is_new_project = is_freshly_created
        
        # Load existing canvas state if it exists
        canvas_state = project_data.get("canvas_state")
        if canvas_state and canvas_state.get("items"):
            from src.canvas.export import load_canvas_from_project
            if not load_canvas_from_project(canvas, project_data):
                QtWidgets.QMessageBox.warning(
                    self,
                    "Warning",
                    "Project loaded but some components may be missing."
                )
        
        # Run initial validation
        canvas.run_validation()
        
        # Mark as clean after loading
        canvas.undo_stack.setClean()
        canvas.is_modified = False
        
        # Setup UI
        scroll = QtWidgets.QScrollArea()
        scroll.setWidget(canvas)
        scroll.setWidgetResizable(False)
        scroll.setAlignment(Qt.AlignCenter)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")

        overlay = OverlayContainer(canvas, scroll)

        sub = CanvasSubWindow()
        sub.setWidget(overlay)
        sub.setAttribute(Qt.WA_DeleteOnClose)
        self.mdi_area.addSubWindow(sub)
        sub.setWindowTitle(f"{app_state.current_project_name}")
        sub.showMaximized()

        if is_freshly_created:
            QTimer.singleShot(0, self._apply_default_library_size)

    def _apply_default_library_size(self):
        target_width = 360
        total_width = self.splitter.size().width() or self.width()
        if total_width <= 0:
            total_width = 1200
        right_width = max(0, total_width - target_width)
        self.splitter.setSizes([target_width, right_width])
        
    def open_project_from_backend(self, project_id):
        """Load and open a project from backend by ID."""
        from src.api_client import get_project
        
        # Fetch project data
        project_data = get_project(project_id)
        
        if not project_data:
            QtWidgets.QMessageBox.critical(
                self,
                "Error",
                f"Failed to load project (ID: {project_id})"
            )
            return
        
        # Existing project -> is_freshly_created=False
        self._create_canvas_for_project(project_data, is_freshly_created=False)

    def showEvent(self, event):
        """Handle show event - check if there's a pending project to load."""
        super().showEvent(event)
        
        # Check if there's a pending project to load
        if app_state.pending_project_id:
            project_id = app_state.pending_project_id
            app_state.pending_project_id = None
            
            # Load project after a short delay to ensure UI is ready
            from PyQt5.QtCore import QTimer
            QTimer.singleShot(100, lambda: self.open_project_from_backend(project_id))

    def open_add_symbol_dialog(self):
        from src.add_symbol_dialog import AddSymbolDialog
        # Get current theme from manager
        current_theme = theme_manager.current_theme
        dlg = AddSymbolDialog(self, theme=current_theme)
        if dlg.exec_() == QtWidgets.QDialog.Accepted:
            self.library.reload_components()

    def on_back_home(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub, CanvasSubWindow):
            slide_to_index(3, direction=-1)
            return

        canvas = active_sub.get_canvas()
        
        # Check if there are unsaved changes
        if not canvas.is_modified:
            # No changes, just go back
            self._close_current_project()
            return
            
        reply = QtWidgets.QMessageBox.question(
            self,
            "Unsaved Changes",
            "Do you want to save changes before going back home?",
            QtWidgets.QMessageBox.Save | QtWidgets.QMessageBox.Discard | QtWidgets.QMessageBox.Cancel,
            QtWidgets.QMessageBox.Save,
        )

        if reply == QtWidgets.QMessageBox.Cancel:
            return

        if reply == QtWidgets.QMessageBox.Save:
            # Save to backend
            self.on_save_file()

        # If Discard or after Save, close the project
        self._close_current_project()

    def _close_current_project(self):
        self.mdi_area.closeAllSubWindows()
        if self.mdi_area.subWindowList():
            return
        app_state.current_project_id = None
        app_state.current_project_name = None
        app_state.pending_project_id = None
        slide_to_index(3, direction=-1)

    def _register_shortcuts(self):
        """Register cross-platform shortcuts for Add Symbol dialog."""
        shortcut_ctrl_a = QShortcut(QKeySequence("Ctrl+A"), self)
        shortcut_ctrl_a.activated.connect(self.open_add_symbol_dialog)

        shortcut_cmd_a = QShortcut(QKeySequence("Meta+A"), self)
        shortcut_cmd_a.activated.connect(self.open_add_symbol_dialog)

    def on_delete_component(self):
        active_sub = self.mdi_area.currentSubWindow()
        if active_sub and isinstance(active_sub, CanvasSubWindow):
            active_sub.get_canvas().delete_selected_components()

    def on_undo(self):
        active_sub = self.mdi_area.currentSubWindow()
        if active_sub and isinstance(active_sub, CanvasSubWindow):
            active_sub.get_canvas().undo_stack.undo()

    def on_redo(self):
        active_sub = self.mdi_area.currentSubWindow()
        if active_sub and isinstance(active_sub, CanvasSubWindow):
            active_sub.get_canvas().undo_stack.redo()

    def on_generate_excel(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub, CanvasSubWindow):
            return
            
        canvas = active_sub.get_canvas()
        options = QtWidgets.QFileDialog.Options()
        filename, _ = QtWidgets.QFileDialog.getSaveFileName(
            self, "Generate Excel Report", "", 
            "Excel Files (*.xlsx)", 
            options=options
        )
        
        if filename:
            if not filename.lower().endswith(".xlsx"):
                filename += ".xlsx"
            try:
                canvas.export_to_excel(filename)
                QtWidgets.QMessageBox.information(self, "Success", f"Excel report saved to {filename}")
            except Exception as e:
                QtWidgets.QMessageBox.critical(self, "Error", f"Failed to generate excel:\n{str(e)}")
            
    def on_generate_report(self):
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub, CanvasSubWindow):
            return
            
        canvas = active_sub.get_canvas()
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

    def on_save_file(self):
        """Save current canvas to backend."""
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub, CanvasSubWindow):
            QtWidgets.QMessageBox.information(self, "Information", "No file to save.")
            return
            
        canvas = active_sub.get_canvas()
        
        # Check if canvas has project ID (should always have one after new project)
        if not hasattr(canvas, 'project_id') or not canvas.project_id:
            QtWidgets.QMessageBox.warning(
                self,
                "Warning",
                "This canvas is not linked to a backend project."
            )
            return
        
        from src.canvas.export import save_canvas_state
        
        try:
            result = save_canvas_state(canvas)
            
            if result:
                # Mark as saved
                canvas.undo_stack.setClean()

                # Update flag on canvas
                canvas.is_new_project = False

                QtWidgets.QMessageBox.information(
                    self, 
                    "Success", 
                    f"Project '{canvas.project_name}' saved successfully to your account."
                )
                
                # Emit signal after a short delay so backend has time to process
                QTimer.singleShot(500, self.project_saved.emit)
            else:
                QtWidgets.QMessageBox.critical(
                    self,
                    "Error",
                    "Failed to save project to server."
                )
                
        except Exception as e:
            QtWidgets.QMessageBox.critical(
                self, 
                "Error", 
                f"Failed to save project:\n{str(e)}"
            )

    def on_save_as_file(self):
        """Save project to local file (.pfd, .pdf, or .jpg)."""
        active_sub = self.mdi_area.currentSubWindow()
        if not active_sub or not isinstance(active_sub, CanvasSubWindow):
             QtWidgets.QMessageBox.information(self, "Information", "No file to save.")
             return False
             
        canvas = active_sub.get_canvas()
        options = QtWidgets.QFileDialog.Options()
        filename, filter_type = QtWidgets.QFileDialog.getSaveFileName(
            self, "Save Project to Local Folder", "", 
            "Process Flow Diagram (*.pfd);;PDF Files (*.pdf);;JPEG Files (*.jpg);;PNG Files (*.png)", 
            options=options
        )
        
        if not filename:
             return False

        try:
            if filter_type.startswith("PDF") or filename.lower().endswith(".pdf"):
                if not filename.lower().endswith(".pdf"):
                    filename += ".pdf"
                canvas.export_to_pdf(filename)
                QtWidgets.QMessageBox.information(self, "Success", f"Saved to {filename}")
                return True
                
            elif filter_type.startswith("JPEG") or filter_type.startswith("PNG") or filename.lower().endswith((".jpg", ".jpeg", ".png")):
                if not filename.lower().endswith((".jpg", ".jpeg", ".png")):
                    if filter_type.startswith("PNG"):
                        filename += ".png"
                    else:
                        filename += ".jpg"
                canvas.export_to_image(filename)
                QtWidgets.QMessageBox.information(self, "Success", f"Saved to {filename}")
                return True

            else:
                if not filename.lower().endswith(".pfd"):
                    filename += ".pfd"
                from src.canvas.export import save_to_pfd
                save_to_pfd(canvas, filename)
                QtWidgets.QMessageBox.information(self, "Success", f"Project saved locally to {filename}")
                return True

        except Exception as e:
            QtWidgets.QMessageBox.critical(self, "Error", f"Failed to save file:\n{str(e)}")
            return False

    def on_open_file(self):
        options = QtWidgets.QFileDialog.Options()
        filename, filter_type = QtWidgets.QFileDialog.getOpenFileName(
            self, "Open File", "", 
            "All Supported (*.pfd *.pdf *.jpg *.jpeg *.png);;Process Flow Diagram (*.pfd);;PDF Files (*.pdf);;Images (*.jpg *.jpeg *.png)", 
            options=options
        )
        
        if not filename:
            return False

        if filename.lower().endswith(".pfd"):
            # For .pfd files, create a NEW project (don't ask for name)
            from src.api_client import create_project
            
            # Create project with filename as name
            base_name = os.path.splitext(os.path.basename(filename))[0]
            project_data = create_project(name=f"{base_name} (Imported)", description="")
            
            if not project_data:
                QtWidgets.QMessageBox.critical(
                    self, 
                    "Error", 
                    "Failed to create project on server."
                )
                return False
            
            # Set global state
            app_state.current_project_id = project_data.get("id")
            app_state.current_project_name = project_data.get("name")
            
            # Create canvas WITHOUT loading backend state
            canvas = CanvasWidget(self)
            canvas.update_canvas_theme()
            canvas.project_id = app_state.current_project_id
            canvas.project_name = app_state.current_project_name
            canvas._is_loading = True  # Block auto-save

            # Treat imported project as NEW (delete if discarded) ---
            canvas.is_new_project = True
            
            # Load from .pfd file
            try:
                if not canvas.open_file(filename):
                    canvas._is_loading = False
                    QtWidgets.QMessageBox.warning(self, "Error", "Failed to load file.")
                    return False
                # Run validation after loading pfd content
                canvas.run_validation()
            except Exception as e:
                canvas._is_loading = False
                QtWidgets.QMessageBox.critical(self, "Error", f"Failed to open file:\n{str(e)}")
                return False
            
            canvas._is_loading = False
            canvas.undo_stack.setClean()  # ✅ Mark as saved
            
            # ✅ Setup UI (THIS WAS MISSING!)
            scroll = QtWidgets.QScrollArea()
            scroll.setWidget(canvas)
            scroll.setWidgetResizable(False)
            scroll.setAlignment(Qt.AlignCenter)
            scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")

            overlay = OverlayContainer(canvas, scroll)

            sub = CanvasSubWindow()
            sub.setWidget(overlay)
            sub.setAttribute(Qt.WA_DeleteOnClose)
            self.mdi_area.addSubWindow(sub)
            sub.setWindowTitle(f"{canvas.project_name} - {os.path.basename(filename)}")
            sub.showMaximized()

        elif filename.lower().endswith((".png", ".jpg", ".jpeg")):
            sub = ImageSubWindow(filename)
            self.mdi_area.addSubWindow(sub)
            sub.setWindowTitle(f"Image - {os.path.basename(filename)}")
            sub.showMaximized()

        elif filename.lower().endswith(".pdf"):
            sub = PDFSubWindow(filename)
            self.mdi_area.addSubWindow(sub)
            sub.setWindowTitle(f"PDF - {os.path.basename(filename)}")
            sub.showMaximized()
            
        else:
             QtWidgets.QMessageBox.warning(self, "Error", "Unsupported file type.")
        
        return True

    def logout(self):
        app_state.access_token = None
        app_state.refresh_token = None
        app_state.current_user = None
        slide_to_index(0, direction=-1)