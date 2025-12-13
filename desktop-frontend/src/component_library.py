import os
import csv
from PyQt5.QtCore import Qt, QMimeData, QSize
from PyQt5.QtGui import QIcon, QDrag
from PyQt5.QtWidgets import (
    QDockWidget, QWidget, QVBoxLayout, QLineEdit, 
    QScrollArea, QLabel, QToolButton, QGridLayout
)


class ComponentButton(QToolButton):
    def __init__(self, component_data, icon_path, parent=None):
        super().__init__(parent)
        self.component_data = component_data
        
        if os.path.exists(icon_path):
            self.setIcon(QIcon(icon_path))
            self.setIconSize(QSize(48, 48))
        
        self.setToolTip(component_data['name'])
        self.setFixedSize(60, 60)
        self.setStyleSheet("""
            QToolButton {
                border: 1px solid #ccc;
                border-radius: 4px;
                background-color: white;
                padding: 2px;
            }
            QToolButton:hover {
                border: 2px solid #0078d7;
                background-color: #e5f3ff;
            }
        """)
        
        self.dragStartPosition = None
    
    def mousePressEvent(self, event):
        super().mousePressEvent(event)
        if event.button() == Qt.LeftButton:
            self.dragStartPosition = event.pos()
    
    def mouseMoveEvent(self, event):
        if not (event.buttons() & Qt.LeftButton):
            return
        if not self.dragStartPosition:
            return
        if (event.pos() - self.dragStartPosition).manhattanLength() < 10:
            return
        
        drag = QDrag(self)
        mimeData = QMimeData()
        mimeData.setText(self.component_data['object'])
        drag.setMimeData(mimeData)
        
        if not self.icon().isNull():
            drag.setPixmap(self.icon().pixmap(32, 32))
        
        drag.exec_(Qt.CopyAction)


class ComponentLibrary(QDockWidget):
    def __init__(self, parent=None):
        super(ComponentLibrary, self).__init__("Component Library", parent)
        
        self.setFeatures(QDockWidget.DockWidgetFloatable | QDockWidget.DockWidgetMovable)
        self.setAllowedAreas(Qt.LeftDockWidgetArea | Qt.RightDockWidgetArea)
        
        self.component_data = []
        self.icon_buttons = []
        self.category_widgets = []
        
        self._setup_ui()
        self._load_components()
        self._populate_icons()
        
        self.setMinimumWidth(400)
    
    def _setup_ui(self):
        main_widget = QWidget()
        main_layout = QVBoxLayout(main_widget)
        main_layout.setContentsMargins(5, 5, 5, 5)
        main_layout.setSpacing(5)
        
        self.search_box = QLineEdit()
        self.search_box.setPlaceholderText("Search components...")
        self.search_box.textChanged.connect(self._filter_icons)
        main_layout.addWidget(self.search_box)
        
        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        self.scroll_widget = QWidget()
        self.scroll_layout = QVBoxLayout(self.scroll_widget)
        self.scroll_layout.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        self.scroll_layout.setSpacing(10)
        
        self.scroll_area.setWidget(self.scroll_widget)
        main_layout.addWidget(self.scroll_area)
        
        self.setWidget(main_widget)
    
    def _load_components(self):
        csv_path = os.path.join("ui", "assets", "Component_Details.csv")
        
        if not os.path.exists(csv_path):
            return
        
        try:
            with open(csv_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    if row['parent'] and row['name']:
                        self.component_data.append({
                            'parent': row['parent'].strip(),
                            'name': row['name'].strip(),
                            'object': row['object'].strip() if row['object'] else ''
                        })
        except Exception as e:
            print(f"Error loading components: {e}")
    
    def _populate_icons(self):
        for i in reversed(range(self.scroll_layout.count())):
            widget = self.scroll_layout.itemAt(i).widget()
            if widget:
                widget.deleteLater()
        
        self.icon_buttons.clear()
        self.category_widgets.clear()
        
        grouped = {}
        seen_components = set()
        
        for component in self.component_data:
            parent = component['parent']
            name = component['name']
            
            unique_key = (parent, name, component.get('object', ''))
            
            if unique_key in seen_components:
                # If we've seen this exact combination, skip
                continue
            
            # Additional check: If name is "Filter" in "Fittings", only allow one
            if parent == "Fittings" and name == "Filter":
                filter_key = ("Fittings", "Filter")
                if filter_key in seen_components:
                    continue
                seen_components.add(filter_key)

            seen_components.add(unique_key)
            
            if parent not in grouped:
                grouped[parent] = []
            grouped[parent].append(component)
        
        for parent_name in sorted(grouped.keys()):
            category_label = QLabel(parent_name)
            category_label.setStyleSheet("""
                QLabel {
                    font-size: 8pt;
                    padding: 5px;
                    background-color: #f0f0f0;
                    border-radius: 3px;
                }
            """)
            
            grid_widget = QWidget()
            grid_layout = QGridLayout(grid_widget)
            grid_layout.setSpacing(5)
            grid_layout.setContentsMargins(5, 5, 5, 5)
            grid_layout.setAlignment(Qt.AlignLeft)
            
            row, col = 0, 0
            max_cols = 5
            category_buttons = []
            
            for component in sorted(grouped[parent_name], key=lambda x: x['name']):
                icon_path = self._get_icon_path(parent_name, component['name'], component.get('object', ''))
                
                if os.path.exists(icon_path):
                    button = ComponentButton(component, icon_path)
                    button.setProperty('category', parent_name)
                    button.setProperty('component_name', component['name'])
                    grid_layout.addWidget(button, row, col)
                    self.icon_buttons.append(button)
                    category_buttons.append(button)
                    
                    col += 1
                    if col >= max_cols:
                        col = 0
                        row += 1
            
            if category_buttons:
                self.scroll_layout.addWidget(category_label)
                self.scroll_layout.addWidget(grid_widget)
                self.category_widgets.append({
                    'label': category_label,
                    'grid': grid_widget,
                    'buttons': category_buttons,
                    'name': parent_name
                })
    
    # Mappings for icon path resolution
    FOLDER_MAP = {
        "Furnance and Boilers": "Furnaces and Boilers",
        "Storage Vessels/ Tanks": "Storage Vessels Tanks",
        "Size Reduction Equipments": "Size Reduction Equipements"
    }

    NAME_CORRECTIONS = {
        "/": ", ",  # "Reducer/Expander" → "Reducer, Expander"
        "Furnance": "Furnace",  # Fix CSV typo
        "Drier": "Dryer",  # British to American spelling
        "Oil, Gas": "Oil Gas",  # Remove comma from compound name
        "Centrifugal Pumps": "Centrifugal Pump",  # Singular
        "Ejector (vapour service)": "Ejector(Vapor Service)",  # Match exact case
        "Plates, Trays (For mass Transfer)": "Trays or plates",  # Process Vessels  
        "Separators for Liquids, Decanters": "Separators for Liquids, Decanter"  # Separators
    }

    PREFIXED_COMPONENTS = {
        'Exchanger905': "905Exchanger",
        'KettleReboiler907': "907Kettle Reboiler"
    }

    def _get_icon_path(self, parent, name, obj=''):
        folder = self.FOLDER_MAP.get(parent, parent)
        
        # Check for specific object override first
        if obj in self.PREFIXED_COMPONENTS:
            clean_name = self.PREFIXED_COMPONENTS[obj]
        else:
            clean_name = name
            for old, new in self.NAME_CORRECTIONS.items():
                clean_name = clean_name.replace(old, new)
        
        return os.path.join("ui", "assets", "png", folder, f"{clean_name}.png")

    
    def _filter_icons(self, search_text):
        search_text = search_text.lower()
        
        if not search_text:
            for category in self.category_widgets:
                category['label'].setVisible(True)
                category['grid'].setVisible(True)
                for button in category['buttons']:
                    button.setVisible(True)
            return
        
        for category in self.category_widgets:
            has_match = False
            
            for button in category['buttons']:
                component = button.property('component_name').lower()
                category_name = button.property('category').lower()
                
                matches = search_text in component or search_text in category_name
                button.setVisible(matches)
                
                if matches:
                    has_match = True
            
            category['label'].setVisible(has_match)
            category['grid'].setVisible(has_match)
