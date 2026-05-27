"""
Export utilities for canvas content.
"""
import json
import os
import datetime
import pandas as pd
from PyQt5.QtCore import Qt, QRectF, QPoint, QSizeF, QSize
from PyQt5.QtGui import QPainter, QImage, QPageSize, QRegion, QColor
from PyQt5.QtWidgets import QWidget, QLabel
from PyQt5.QtPrintSupport import QPrinter
from src.canvas import painter as canvas_painter
from src.canvas import resources
from src.component_widget import ComponentWidget
from src.connection import Connection
import src.app_state as app_state
from src.api_client import update_project, get_components

# ---------------------- CANVAS STATE SERIALIZATION ----------------------
# ✅ Module-level cache
_component_cache = None
_cache_timestamp = None


def _display_name(value, default):
    if value is None:
        return default
    if isinstance(value, dict):
        for key in ("username", "name", "full_name", "email"):
            nested_value = value.get(key)
            if nested_value:
                return str(nested_value)
        return default
    text = str(value).strip()
    return text or default


def get_export_metadata(canvas):
    """Build display metadata for export and report title blocks."""
    project_name = _display_name(
        getattr(canvas, "project_name", None) or app_state.current_project_name,
        "Untitled Project",
    )
    created_by = _display_name(app_state.current_user, "Unknown User")
    export_date = datetime.datetime.now().strftime("%B %d, %Y")
    return {
        "project_name": project_name,
        "created_by": created_by,
        "date": export_date,
    }

def get_component_id_map():
    """Get s_no → id mapping with caching (5 min TTL)"""
    global _component_cache, _cache_timestamp
    
    import time
    now = time.time()
    
    # Cache for 5 minutes
    if _component_cache and _cache_timestamp and (now - _cache_timestamp < 300):
        return _component_cache
    
    backend_components = get_components()
    _component_cache = {str(c.get('s_no', '')): c.get('id') 
                        for c in backend_components if c.get('s_no')}
    _cache_timestamp = now
    
    return _component_cache

def serialize_canvas_state(canvas):
    """
    Convert canvas components and connections to backend-compatible format.
    Returns dict matching the canvas_state structure from API docs.
    """
    # Use cached mapping
    sno_to_id = get_component_id_map()

    items = []
    comp_map = {}  # Maps component object to its ID
    
    missing_snos = set()
    
    for i, comp in enumerate(canvas.components):
        c_dict = comp.to_dict()
        s_no = str(comp.config.get("s_no", ""))
        
        # Get component ID from backend using s_no
        component_backend_id = sno_to_id.get(s_no)
        
        if not component_backend_id:
            if s_no not in missing_snos:
                print(f"[EXPORT ERROR] Component '{comp.config.get('name')}' (s_no: {s_no}) not found in DB. Skipping.")
                missing_snos.add(s_no)
            continue
        
        # KEY CHANGE: Start ID from 1 instead of 0
        # The backend rejects '0' because it evaluates to False/Empty.
        safe_id = i + 1
        
        item = {
            "id": safe_id,    # Sends 1, 2, 3... (Backend accepts this)
            "component_id": component_backend_id,
            "component": {
                "id": component_backend_id
            },
            "label": comp.config.get("default_label", ""),
            "x": float(c_dict["x"]),
            "y": float(c_dict["y"]),
            "width": float(c_dict["width"]),
            "height": float(c_dict["height"]),
            "rotation": float(c_dict["rotation"]),
            "scaleX": 1.0,
            "scaleY": 1.0,
            "sequence": safe_id # Keep sequence matching ID for clarity
        }
        items.append(item)
        comp_map[comp] = safe_id  # Store the 1-based ID for connection mapping
    
    connections = []
    for i, conn in enumerate(canvas.connections):
        # Resolve component using the safe_id (1-based)
        start_id = comp_map.get(conn.start_component, -1)
        end_id = comp_map.get(conn.end_component, -1)
        
        # Skip connections if the components attached were skipped
        if start_id == -1 or end_id == -1:
            continue
        
        connection_data = {
            "id": i + 1, # Good practice to make connection IDs 1-based too
            "sourceItemId": start_id,
            "sourceGripIndex": conn.start_grip_index,
            "targetItemId": end_id,
            "targetGripIndex": conn.end_grip_index,
            "waypoints": [
                {"x": float(p.x()), "y": float(p.y())}
                for p in conn.path
            ]
        }
        connections.append(connection_data)
    
    return {
        "items": items,
        "connections": connections,
        "sequence_counter": len(items)
    }

def save_canvas_state(canvas):
    """
    Save canvas state to backend via UPDATE API.
    This is called every time the canvas is modified.
    """
    if not canvas.project_id:
        print("[EXPORT ERROR] No project ID. Cannot save.")
        return None
    
    canvas_state = serialize_canvas_state(canvas)
    
    # Debug output
    print(f"[EXPORT] Saving {len(canvas_state['items'])} items and {len(canvas_state['connections'])} connections")
    if canvas_state['items']:
        print(f"[EXPORT] First item: {canvas_state['items'][0]}")
    
    result = update_project(
        project_id=canvas.project_id,
        name=canvas.project_name,
        canvas_state=canvas_state
    )
    
    if result:
        print(f"[EXPORT] Canvas saved successfully to project {canvas.project_id}")
    else:
        print(f"[EXPORT ERROR] Failed to save canvas state")
    
    return result

def load_canvas_from_project(canvas, project_data):
    """
    Load canvas from backend project data.
    Expects project_data to have 'canvas_state' with items and connections.
    """
    try:
        # Block auto-save during load
        canvas._is_loading = True
        canvas_state = project_data.get("canvas_state")
        if not canvas_state:
            print("[LOAD] No canvas_state in project data")
            return True # Empty project is valid
        
        items_data = canvas_state.get("items", [])
        conns_data = canvas_state.get("connections", [])
        
        print(f"[LOAD] Loading {len(items_data)} items and {len(conns_data)} connections")

        # Clear existing canvas
        canvas.components = []
        canvas.connections = []
        for c in canvas.children():
            if isinstance(c, (ComponentWidget, QLabel)):
                c.deleteLater()
        
        # Reset label counters to prevent sequence collisions
        canvas.label_data = resources.load_label_data(canvas.base_dir)
        
        # Load Components
        id_map = {}
        
        try:
            # Fetch latest component map for ID resolution
            backend_components = get_components()
            # Create ID -> Component Data map
            # backend_components is a list of dicts
            id_to_comp = {c.get("id"): c for c in backend_components if c.get("id")}
        except Exception as e:
            print(f"[LOAD] Failed to fetch components for ID lookup: {e}")
            id_to_comp = {}

        for d in items_data:
            # Get component data from nested structure
            component_data = d.get("component", {})
            
            # --- RESOLUTION STRATEGY ---
            # 1. Try to resolve by Component ID (Best for Web Projects & Consistency)
            # 2. Key matching fallback
            
            comp_id = d.get("component_id") or component_data.get("id")
            resolved_from_id = False
            
            s_no = ""
            name = ""
            svg_path = ""
            
            # Strategy 1: Look up by ID
            if comp_id and comp_id in id_to_comp:
                api_data = id_to_comp[comp_id]
                name = api_data.get("name", "")
                s_no = str(api_data.get("s_no", ""))
                # Find local SVG for this name
                svg_path = resources.find_svg_path(name, canvas.base_dir)
                if svg_path:
                    resolved_from_id = True
                    # print(f"[LOAD] Resolved component {comp_id} ('{name}') from Library")
            
            # Strategy 2: Fallback to Project Data (with intelligent path fix)
            if not resolved_from_id:
                s_no = d.get("s_no") or component_data.get("s_no", "") or s_no
                name = d.get("name") or component_data.get("name", "") or name
                
                raw_svg = d.get("svg") or component_data.get("svg")
                if raw_svg:
                    # Check if it's a URL or absolute path from another machine
                    if "http" in raw_svg or "/" in raw_svg or "\\" in raw_svg:
                        # Extract just the filename/basename
                        base_name = os.path.basename(raw_svg)
                        # Remove extension for fuzzy search
                        search_name = os.path.splitext(base_name)[0]
                        # Try to find local match
                        found_path = resources.find_svg_path(search_name, canvas.base_dir)
                        if found_path:
                            svg_path = found_path
                        elif os.path.exists(raw_svg):
                            svg_path = raw_svg
                    else:
                         svg_path = raw_svg

                # Last ditch: Try finding by name if SVG still missing
                if not svg_path and name:
                    svg_path = resources.find_svg_path(name, canvas.base_dir)
            
            if not svg_path:
                print(f"[LOAD] No SVG path found for component: {name} (ID: {comp_id})")
                continue
            
            # Validate existence
            if not os.path.exists(svg_path):
                # Clean name search
                found = resources.find_svg_path(name or os.path.basename(svg_path), canvas.base_dir)
                if found:
                    svg_path = found
                else:
                    print(f"[LOAD] SVG file missing: {svg_path}")
                    continue
            
            # Build config from item data
            # Include grips from best available source (critical for web-desktop sync)
            grips_data = d.get("grips")                            # 1. Item data (web project)
            if not grips_data and resolved_from_id:
                grips_data = api_data.get("grips")                 # 2. API library
            if not grips_data:
                grips_data = component_data.get("grips")           # 3. Nested component data
            
            config = {
                "s_no": s_no,
                "parent": d.get("parent") or component_data.get("parent", ""),
                "name": name,
                "object": d.get("object") or component_data.get("object", "") or name,
                "legend": d.get("legend") or component_data.get("legend", ""),
                "suffix": d.get("suffix") or component_data.get("suffix", ""),
                "default_label": resources.normalize_component_label(
                    d.get("label", ""),
                    d.get("legend") or component_data.get("legend", ""),
                    d.get("suffix") or component_data.get("suffix", ""),
                ),
                "grips": grips_data,
            }
            
            comp = ComponentWidget(svg_path, canvas, config=config)
            
            # Calculate the mathematical Desktop default size
            svg_dims = comp.get_svg_dimensions()
            native_w, native_h = comp.calculate_logical_size(svg_dims)

            # Set position and size from backend data
            x = float(d.get("x", 0))
            y = float(d.get("y", 0))
            w = float(d.get("width", native_w))
            h = float(d.get("height", native_h))
            
            # Enforce minimum size: if Web saved a tiny component, forcibly 
            # scale it up to the Desktop's default native dimensions.
            if w < native_w or h < native_h:
                w = native_w
                h = native_h
            
            comp.logical_rect = QRectF(x, y, w, h)
            comp.rotation_angle = float(d.get("rotation", 0))
            
            # Apply visuals
            comp.update_visuals(canvas.zoom_level)
            comp.show()
            
            canvas.components.append(comp)
            id_map[d.get("id")] = comp

            # --- UPDATE LABEL COUNTERS ---
            # Ensure future drops continue the sequence correctly
            key_text = comp.config.get("object") or comp.config.get("name")
            if key_text:
                key = resources.clean_string(key_text)
                legend = comp.config.get("legend", "")
                suffix = comp.config.get("suffix", "")
                
                # Auto-initialize if missing (Sync with widget.py logic)
                if key not in canvas.label_data and legend:
                    canvas.label_data[key] = {
                        "legend": legend,
                        "suffix": suffix,
                        "count": 0
                    }
                
                if key in canvas.label_data:
                    canvas.label_data[key]["count"] += 1
        
        # Load Connections
        for d in conns_data:
            sid = d.get("sourceItemId")
            eid = d.get("targetItemId")
            
            start_comp = id_map.get(sid)
            end_comp = id_map.get(eid)
            
            if start_comp:
                sg = d.get("sourceGripIndex", 0)
                eg = d.get("targetGripIndex", 0)
                
                # Derive side from grip position (matches web's getClosestSide)
                start_side = _get_grip_side(start_comp, sg)
                conn = Connection(start_comp, sg, start_side)
                if end_comp:
                    end_side = _get_grip_side(end_comp, eg)
                    conn.set_end_grip(end_comp, eg, end_side)
                
                conn.update_path(canvas.components, canvas.connections)
                canvas.connections.append(conn)
        
        canvas.update()
        return True
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[LOAD ERROR] Failed to load project: {e}")
        return False
    
    finally:
        # Re-enable auto-save
        canvas._is_loading = False
    
# ---------------------- HELPERS ----------------------

def _get_grip_side(component, grip_index):
    """
    Derive connection side from grip position.
    Matches web's getClosestSide (routing.ts:131-145).
    
    Web convention: y=100 is top, y=0 is bottom.
    """
    grips = component.get_grips()
    if grip_index < len(grips):
        g = grips[grip_index]
        
        # If grip has explicit "side" key, use it
        side = g.get("side")
        if side:
            return side
        
        x = g.get("x", 50)
        y = g.get("y", 50)
        
        # Distances to each edge (web convention: y=100 is top)
        dist_left = x
        dist_right = 100 - x
        dist_top = 100 - y      # y=100 → 0 distance to top
        dist_bottom = y          # y=0 → 0 distance to bottom
        
        min_dist = min(dist_left, dist_right, dist_top, dist_bottom)
        if min_dist == dist_left: return "left"
        if min_dist == dist_right: return "right"
        if min_dist == dist_top: return "top"
        return "bottom"
    return "right"

def get_content_rect(canvas, padding=50):
    """Calculates the bounding rectangle of all canvas content."""
    content_rect = QRectF()
    for comp in canvas.components:
        content_rect = content_rect.united(QRectF(comp.geometry()))
        
    for conn in canvas.connections:
        if not conn.path: continue
        for p in conn.path:
            content_rect = content_rect.united(QRectF(p.x(), p.y(), 1, 1))

    if content_rect.isEmpty():
        return QRectF(canvas.rect())
        
    content_rect.adjust(-padding, -padding, padding, padding)
    return content_rect

def render_to_image(canvas, rect, scale=1.0):
    """Renders the specified canvas area to a QImage."""
    img_size = rect.size().toSize() * scale
    image = QImage(img_size, QImage.Format_ARGB32)
    image.fill(Qt.white)
    
    painter = QPainter(image)
    try:
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setRenderHint(QPainter.SmoothPixmapTransform)
        painter.setRenderHint(QPainter.TextAntialiasing)
        painter.setRenderHint(QPainter.HighQualityAntialiasing)
        
        painter.scale(scale, scale)
        painter.translate(-rect.topLeft())
        
        # Draw Connections
        painter.save()
        if hasattr(canvas, 'zoom_level'):
            z = canvas.zoom_level
            painter.scale(z, z)
        canvas_painter.draw_connections(painter, canvas.connections, canvas.components)
        painter.restore()
        
        # Draw Components
        for comp in canvas.components:
            painter.save()
            painter.translate(comp.pos())
            comp.render(painter, QPoint(), QRegion(), QWidget.DrawChildren)
            painter.restore()
    finally:
        painter.end()
    return image

def draw_equipment_table(painter, canvas, page_rect, start_y):
    """Draws the equipment table on the painter."""
    row_height = 35
    w = page_rect.width()
    col_widths = [w * 0.15, w * 0.25, w * 0.60]
    headers = ["Sr. No.", "Tag Number", "Equipment Description"]
    
    # Headers
    y = start_y
    painter.setFont(QPainter().font())
    f = painter.font()
    f.setPointSize(10); f.setBold(True); painter.setFont(f)
    
    current_x = 0
    for i, h in enumerate(headers):
        r = QRectF(current_x, y, col_widths[i], row_height)
        painter.setBrush(QColor("#e0e0e0")); painter.setPen(Qt.black)
        painter.drawRect(r); painter.drawText(r, Qt.AlignCenter, h)
        current_x += col_widths[i]
    y += row_height
    
    # Data Preparation
    equipment_list = []
    for comp in canvas.components:
        tag = comp.config.get("default_label", "")
        name = comp.config.get("name", "")
        if (not name or name == "Unknown Component") and getattr(comp, "svg_path", None):
            name = os.path.splitext(os.path.basename(comp.svg_path))[0]
            if name.startswith(("905", "907")): name = name[3:]
            name = name.replace("_", " ").strip()
        equipment_list.append((tag, name or "Unknown Component"))
    equipment_list.sort(key=lambda x: x[0])
    
    # Draw Rows
    f.setBold(False); painter.setFont(f)
    for idx, (tag, name) in enumerate(equipment_list):
        current_x = 0
        vals = [str(idx+1), tag, name]
        aligns = [Qt.AlignCenter, Qt.AlignCenter, Qt.AlignLeft | Qt.AlignVCenter]
        
        for i, val in enumerate(vals):
            r = QRectF(current_x, y, col_widths[i], row_height)
            painter.setBrush(Qt.NoBrush)
            painter.drawRect(r)
            rect_adj = r.adjusted(10,0,-10,0) if i==2 else r
            painter.drawText(rect_adj, aligns[i], val)
            current_x += col_widths[i]
        y += row_height


def draw_title_block(painter, rect, metadata):
    """Draw a small footer/title block in the bottom-right corner."""
    block_width = min(480, max(320, rect.width() * 0.4))
    block_height = 140
    margin = 24

    x = rect.width() - block_width - margin
    y = rect.height() - block_height - margin
    block_rect = QRectF(x, y, block_width, block_height)

    painter.save()
    try:
        painter.setPen(QColor("#C97B5A"))
        painter.setBrush(QColor("#FFF8F2"))
        painter.drawRoundedRect(block_rect, 8, 8)

        label_font = painter.font()
        label_font.setPointSize(11)
        label_font.setBold(True)
        painter.setFont(label_font)
        painter.setPen(QColor("#6B4A3B"))

        line_gap = 34
        text_x = block_rect.left() + 20
        label_y = block_rect.top() + 30

        rows = [
            ("Project Name", metadata.get("project_name", "Untitled Project")),
            ("Created By", metadata.get("created_by", "Unknown User")),
            ("Date", metadata.get("date", datetime.datetime.now().strftime("%B %d, %Y"))),
        ]

        value_font = painter.font()
        value_font.setPointSize(12)
        value_font.setBold(False)

        for index, (label, value) in enumerate(rows):
            row_y = label_y + (index * line_gap)
            painter.setFont(label_font)
            painter.drawText(QRectF(text_x, row_y - 14, 110, 20), Qt.AlignLeft | Qt.AlignVCenter, f"{label}:")
            painter.setFont(value_font)
            painter.drawText(QRectF(text_x + 120, row_y - 14, block_width - 140, 20), Qt.AlignLeft | Qt.AlignVCenter, str(value))
    finally:
        painter.restore()


def compose_export_image(canvas, scale=3.0, footer_height=190):
    """Render the canvas and append a footer/title block area."""
    rect = get_content_rect(canvas)
    base_image = render_to_image(canvas, rect, scale=scale)

    composed = QImage(base_image.width(), base_image.height() + footer_height, QImage.Format_ARGB32)
    composed.fill(Qt.white)

    painter = QPainter(composed)
    try:
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setRenderHint(QPainter.SmoothPixmapTransform)
        painter.setRenderHint(QPainter.TextAntialiasing)
        painter.drawImage(0, 0, base_image)
        draw_title_block(painter, QRectF(0, 0, composed.width(), composed.height()), get_export_metadata(canvas))
    finally:
        painter.end()

    return composed

# ---------------------- EXPORT FUNCTIONS ----------------------
def export_to_image(canvas, filename):
    """Export canvas to high-quality image with proper rendering"""
    # STRATEGY: 
    # 1. Save current zoom
    # 2. Reset zoom to 1.0 (This forces all components to render at logic size = visual size)
    # 3. Export with Scale 3.0 (High Res)
    # 4. Restore zoom
    
    old_z = getattr(canvas, 'zoom_level', 1.0)
    
    # 1. & 2. Reset Zoom
    if old_z != 1.0:
        canvas.zoom_level = 1.0
        canvas.apply_zoom()
        
    try:
        # 3. Export
        image = compose_export_image(canvas, scale=3.0)
        image.save(filename, quality=100)
    finally:
        # 4. Restore Zoom
        if old_z != 1.0:
            canvas.zoom_level = old_z
            canvas.apply_zoom()

def export_to_pdf(canvas, filename):
    """Export canvas to high-quality PDF"""
    
    # STRATEGY: Reset Zoom to 1.0
    old_z = getattr(canvas, 'zoom_level', 1.0)
    if old_z != 1.0:
        canvas.zoom_level = 1.0
        canvas.apply_zoom()
        
    try:
        image = compose_export_image(canvas, scale=4.0)
        
        # PDF Setup with HighResolution mode
        printer = QPrinter(QPrinter.HighResolution)
        printer.setOutputFormat(QPrinter.PdfFormat)
        printer.setOutputFileName(filename)
        
        # Calculate size in millimeters for proper scaling
        mm_per_inch = 25.4
        # Use printer's resolution for accurate conversion
        dpi = printer.resolution()
        
        s = QSizeF(image.width(), image.height())
        w_mm = (s.width() / dpi) * mm_per_inch
        h_mm = (s.height() / dpi) * mm_per_inch
        
        printer.setPageSize(QPageSize(QSizeF(w_mm, h_mm), QPageSize.Millimeter))
        printer.setPageMargins(0, 0, 0, 0, QPrinter.Millimeter)
        
        painter = QPainter(printer)
        try:
            # Enable high-quality rendering
            painter.setRenderHint(QPainter.Antialiasing)
            painter.setRenderHint(QPainter.SmoothPixmapTransform)
            painter.setRenderHint(QPainter.HighQualityAntialiasing)
            
            # Draw the high-res image to fill the page
            target_rect = painter.viewport()
            painter.drawImage(target_rect, image)
        finally:
            painter.end()
    finally:
        # Restore Zoom
        if old_z != 1.0:
            canvas.zoom_level = old_z
            canvas.apply_zoom()

def generate_report_pdf(canvas, filename):
    """Generate professional PDF report using ReportLab"""
    try:
        from src.reports.generator import PDFReportGenerator
    except ImportError:
        print("ReportLab not found. Please install it: pip install reportlab")
        return

    # Extract Data
    data = []
    
    # Sort components by tag for cleaner report
    sorted_components = sorted(canvas.components, key=lambda c: c.config.get("default_label", ""))
    
    for comp in sorted_components:
        # Extract basic fields
        tag = comp.config.get("default_label", "")
        name = comp.config.get("name", "")
        obj_type = comp.config.get("object", "")
        
            
        # FORCE "no description" for all components per user request
        name = "no description"
            
        # Fallback for Type if empty (use name or generic)
        if not obj_type:
            obj_type = name if name else "Equipment"
            
        data.append({
            'tag': tag,
            'type': obj_type,
            'description': name
        })
        
    # Generate
    generator = PDFReportGenerator(filename)
    generator.generate(data, metadata=get_export_metadata(canvas))
    print(f"Report generated at {filename}")

def export_to_excel(canvas, filename):
    """Exports the list of equipment to an Excel file with auto-width columns."""
    equipment_list = []
    
    # Logic similar to draw_equipment_table to extract data
    for idx, comp in enumerate(canvas.components):
        tag = comp.config.get("default_label", "")
        name = comp.config.get("name", "")
        if (not name or name == "Unknown Component") and getattr(comp, "svg_path", None):
            name = os.path.splitext(os.path.basename(comp.svg_path))[0]
            if name.startswith(("905", "907")): name = name[3:]
            name = name.replace("_", " ").strip()
            
        equipment_list.append({
            "Sr. No.": idx + 1,
            "Tag Number": tag,
            "Equipment Description": name or "Unknown Component"
        })
        
    # Sort by Tag Number as in the table
    equipment_list.sort(key=lambda x: x["Tag Number"])
    
    # Re-assign Sr. No. after sort
    for i, item in enumerate(equipment_list):
        item["Sr. No."] = i + 1
        
    df = pd.DataFrame(equipment_list)
    
    # Ensure columns are in order
    df = df[["Sr. No.", "Tag Number", "Equipment Description"]]
    
    # Save to Excel with auto-width columns
    with pd.ExcelWriter(filename, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Equipment List')
        
        # Get workbook and worksheet objects
        workbook = writer.book
        worksheet = writer.sheets['Equipment List']
        
        # Auto-adjust column widths
        for idx, col in enumerate(df.columns):
            # Get the maximum length of data in each column
            max_len = max(
                df[col].astype(str).apply(len).max(),
                len(str(col))
            )
            # Add some padding
            worksheet.set_column(idx, idx, max_len + 2)

# ---------------------- PFD SERIALIZATION ----------------------
def save_to_pfd(canvas, filename):
    """Saves project in legacy .pfd format"""
    import datetime
    
    items = []
    comp_map = {c: i for i, c in enumerate(canvas.components)}
    
    for i, c in enumerate(canvas.components):
        c_dict = c.to_dict()
        
        item = {
            "id": i,
            "x": c_dict["x"],
            "y": c_dict["y"],
            "width": c_dict["width"],
            "height": c_dict["height"],
            "rotation": c_dict["rotation"],
            "svg": c_dict["svg_path"],
            "name": c_dict["config"].get("name", ""),
            "object": c_dict["config"].get("object", ""),
            "s_no": c_dict["config"].get("s_no", ""),
            "legend": c_dict["config"].get("legend", ""),
            "suffix": c_dict["config"].get("suffix", ""),
            "label": c_dict["config"].get("default_label", ""),
            "config": c_dict["config"],
            "grips": c.get_grips()
        }
        items.append(item)

    connections = []
    for i, c in enumerate(canvas.connections):
        start_id = comp_map.get(c.start_component, -1)
        end_id = comp_map.get(c.end_component, -1)
        
        conn = {
            "id": i,
            "sourceItemId": start_id,
            "sourceGripIndex": c.start_grip_index,
            "targetItemId": end_id,
            "targetGripIndex": c.end_grip_index,
            "start_side": c.start_side,
            "end_side": c.end_side,
            "path_offset": c.path_offset,
            "start_adjust": c.start_adjust,
            "end_adjust": c.end_adjust,
        }
        connections.append(conn)

    data = {
        "version": "1.0.0",
        "displayedAt": datetime.datetime.now().isoformat(),
        "editorVersion": "1.0.0",
        "canvasState": {
            "items": items,
            "connections": connections,
            "sequenceCounter": len(items)
        },
        "viewport": {
            "scale": getattr(canvas, "zoom_level", 1.0),
            "position": {"x": 0, "y": 0}
        },
        "project": {
            "id": "desktop-export",
            "name": os.path.basename(filename).replace(".pfd", ""),
            "createdAt": datetime.datetime.now().isoformat()
        }
    }
        
    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)

def load_from_pfd(canvas, filename):
    """Load from legacy .pfd format"""
    if not os.path.exists(filename): return False
    try:
        with open(filename, 'r') as f: data = json.load(f)
        
        canvas.components = []
        canvas.connections = []
        for c in canvas.children():
            if isinstance(c, (ComponentWidget, QLabel)): c.deleteLater()
            
        if "canvasState" in data:
            items_data = data["canvasState"].get("items", [])
            conns_data = data["canvasState"].get("connections", [])
        elif "components" in data:
            items_data = data.get("components", [])
            conns_data = data.get("connections", [])
        else:
            print("Unknown file format")
            return False

        id_map = {}
        
        for d in items_data:
            svg_path = d.get("svg_path") or d.get("svg")
            if not svg_path: continue
            
            if not os.path.exists(svg_path):
                name = d.get("name") or d.get("object") or os.path.basename(svg_path)
                found = resources.find_svg_path(name, canvas.base_dir)
                if found:
                    svg_path = found
                else:
                    print(f"Warning: SVG not found for {name} ({svg_path})")
                    continue
            
            config = d.get("config", {})
            if not config:
                config = {
                    "name": d.get("name", ""),
                    "object": d.get("object", ""),
                    "s_no": d.get("s_no", ""),
                    "legend": d.get("legend", ""),
                    "suffix": d.get("suffix", ""),
                    "default_label": d.get("label", "")
                }

            config["default_label"] = resources.normalize_component_label(
                config.get("default_label") or d.get("label", ""),
                config.get("legend", ""),
                config.get("suffix", ""),
            )
            
            comp = ComponentWidget(svg_path, canvas, config=config)
            
            x = d.get("x", 0)
            y = d.get("y", 0)
            w = d.get("width", 100)
            h = d.get("height", 100)
            
            comp.logical_rect = QRectF(x, y, w, h)
            comp.rotation_angle = d.get("rotation", 0)
            
            comp.update_visuals(canvas.zoom_level)
            comp.show()
            canvas.components.append(comp)
            
            comp_id = d.get("id")
            if comp_id is not None:
                id_map[comp_id] = comp
            
        for d in conns_data:
            sid = d.get("sourceItemId") if "sourceItemId" in d else d.get("start_id")
            eid = d.get("targetItemId") if "targetItemId" in d else d.get("end_id")
            
            s = id_map.get(sid)
            e = id_map.get(eid)
            
            if s:
                sg = d.get("sourceGripIndex") if "sourceGripIndex" in d else d.get("start_grip")
                eg = d.get("targetGripIndex") if "targetGripIndex" in d else d.get("end_grip")
                
                ss = d.get("start_side", "right")
                es = d.get("end_side", "left")

                c = Connection(s, sg, ss)
                if e: c.set_end_grip(e, eg, es)
                
                c.path_offset = d.get("path_offset", 0.0)
                c.start_adjust = d.get("start_adjust", 0.0)
                c.end_adjust = d.get("end_adjust", 0.0)
                
                c.update_path(canvas.components, canvas.connections)
                canvas.connections.append(c)
                
        canvas.update()
        return True
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error loading PFD: {e}")
        return False