import os
import sys
import unittest
import tempfile
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

import src.app_state as app_state
from src.canvas.export import (
    get_export_metadata,
    draw_title_block,
    compose_export_image,
    export_to_image,
    export_to_pdf,
)
from src.reports.generator import PDFReportGenerator


class ExportMetadataTests(unittest.TestCase):
    """Tests for export metadata retrieval and formatting."""

    def setUp(self):
        """Reset app_state before each test."""
        self.original_user = app_state.current_user
        self.original_project_id = app_state.current_project_id
        self.original_project_name = app_state.current_project_name
        
        app_state.current_user = None
        app_state.current_project_id = None
        app_state.current_project_name = None

    def tearDown(self):
        """Restore app_state after each test."""
        app_state.current_user = self.original_user
        app_state.current_project_id = self.original_project_id
        app_state.current_project_name = self.original_project_name

    def test_get_export_metadata_with_all_values(self):
        """Test metadata extraction with all values present."""
        app_state.current_user = "john.doe"
        app_state.current_project_name = "Test Project"

        mock_canvas = Mock()
        mock_canvas.project_name = "Test Project"

        metadata = get_export_metadata(mock_canvas)

        self.assertEqual(metadata["project_name"], "Test Project")
        self.assertEqual(metadata["created_by"], "john.doe")
        self.assertIn("date", metadata)
        self.assertIsInstance(metadata["date"], str)

    def test_get_export_metadata_with_default_user(self):
        """Test metadata with missing user falls back to 'Unknown User'."""
        app_state.current_user = None
        app_state.current_project_name = "Test Project"

        mock_canvas = Mock()
        mock_canvas.project_name = "Test Project"

        metadata = get_export_metadata(mock_canvas)

        self.assertEqual(metadata["created_by"], "Unknown User")

    def test_get_export_metadata_with_default_project_name(self):
        """Test metadata with missing project name falls back to 'Untitled Project'."""
        app_state.current_user = "john.doe"
        app_state.current_project_name = None

        mock_canvas = Mock()
        mock_canvas.project_name = None

        metadata = get_export_metadata(mock_canvas)

        self.assertEqual(metadata["project_name"], "Untitled Project")

    def test_get_export_metadata_date_format(self):
        """Test that date is formatted correctly (e.g., 'May 18, 2026')."""
        app_state.current_user = "john.doe"
        app_state.current_project_name = "Test Project"

        mock_canvas = Mock()
        mock_canvas.project_name = "Test Project"

        metadata = get_export_metadata(mock_canvas)

        # Check format: should match "Month DD, YYYY"
        date_str = metadata["date"]
        parts = date_str.split()
        self.assertEqual(len(parts), 3)
        self.assertTrue(parts[1].endswith(","))
        self.assertEqual(len(parts[2]), 4)  # Year is 4 digits

    def test_get_export_metadata_with_dict_user_object(self):
        """Test metadata extraction when current_user is a dict."""
        app_state.current_user = {"username": "alice.smith", "email": "alice@example.com"}
        app_state.current_project_name = "Test Project"

        mock_canvas = Mock()
        mock_canvas.project_name = "Test Project"

        metadata = get_export_metadata(mock_canvas)

        self.assertEqual(metadata["created_by"], "alice.smith")

    def test_get_export_metadata_uses_canvas_project_name_priority(self):
        """Test that canvas.project_name takes priority over app_state."""
        app_state.current_user = "john.doe"
        app_state.current_project_name = "App State Project"

        mock_canvas = Mock()
        mock_canvas.project_name = "Canvas Project"

        metadata = get_export_metadata(mock_canvas)

        self.assertEqual(metadata["project_name"], "Canvas Project")


class DrawTitleBlockTests(unittest.TestCase):
    """Tests for title block rendering."""

    @patch("src.canvas.export.QPainter")
    def test_draw_title_block_calls_painter_methods(self, mock_painter_class):
        """Test that draw_title_block calls appropriate painter methods."""
        from PyQt5.QtCore import QRectF
        from PyQt5.QtGui import QColor

        mock_painter = Mock()
        rect = QRectF(0, 0, 1000, 800)
        metadata = {
            "project_name": "Test Project",
            "created_by": "john.doe",
            "date": "May 18, 2026",
        }

        draw_title_block(mock_painter, rect, metadata)

        # Verify painter.save() and restore() were called
        mock_painter.save.assert_called()
        mock_painter.restore.assert_called()

        # Verify setPen and setBrush were called (for drawing the box)
        mock_painter.setPen.assert_called()
        mock_painter.setBrush.assert_called()

        # Verify drawRoundedRect was called
        mock_painter.drawRoundedRect.assert_called()

        # Verify drawText was called multiple times (for labels and values)
        self.assertGreater(mock_painter.drawText.call_count, 0)

    @patch("src.canvas.export.QPainter")
    def test_draw_title_block_with_fallback_metadata(self, mock_painter_class):
        """Test draw_title_block renders with fallback values."""
        from PyQt5.QtCore import QRectF

        mock_painter = Mock()
        rect = QRectF(0, 0, 1000, 800)
        metadata = {}  # Empty metadata should use defaults

        # Should not raise an error
        draw_title_block(mock_painter, rect, metadata)

        mock_painter.drawText.assert_called()


class ComposeExportImageTests(unittest.TestCase):
    """Tests for image composition with footer."""

    @patch("src.canvas.export.QPainter")
    @patch("src.canvas.export.QImage")
    @patch("src.canvas.export.render_to_image")
    @patch("src.canvas.export.draw_title_block")
    @patch("src.canvas.export.get_content_rect")
    @patch("src.canvas.export.get_export_metadata")
    def test_compose_export_image_returns_qimage(
        self, mock_get_metadata, mock_get_rect, mock_draw_block, mock_render,
        mock_qimage_class, mock_qpainter_class
    ):
        """Test that compose_export_image returns a valid QImage."""
        from PyQt5.QtCore import QRectF

        mock_get_metadata.return_value = {"project_name": "Test", "created_by": "user", "date": "May 18, 2026"}
        mock_get_rect.return_value = QRectF(0, 0, 800, 600)

        # Create a mock QImage
        mock_base_image = Mock()
        mock_base_image.width.return_value = 2400
        mock_base_image.height.return_value = 1800
        mock_render.return_value = mock_base_image

        mock_composed_image = Mock()
        mock_composed_image.width.return_value = 2400
        mock_composed_image.height.return_value = 1924
        mock_qimage_class.return_value = mock_composed_image

        mock_painter = Mock()
        mock_qpainter_class.return_value = mock_painter

        mock_canvas = Mock()

        result = compose_export_image(mock_canvas, scale=3.0)

        # Verify the functions were called
        mock_get_rect.assert_called_once_with(mock_canvas)
        mock_render.assert_called_once()
        mock_draw_block.assert_called_once()

    @patch("src.canvas.export.QPainter")
    @patch("src.canvas.export.QImage")
    @patch("src.canvas.export.render_to_image")
    @patch("src.canvas.export.get_content_rect")
    @patch("src.canvas.export.get_export_metadata")
    def test_compose_export_image_with_different_scales(
        self, mock_get_metadata, mock_get_rect, mock_render,
        mock_qimage_class, mock_qpainter_class
    ):
        """Test compose_export_image with different scale factors."""
        from PyQt5.QtCore import QRectF

        mock_get_metadata.return_value = {"project_name": "Test", "created_by": "user", "date": "May 18, 2026"}
        mock_get_rect.return_value = QRectF(0, 0, 800, 600)

        mock_base_image = Mock()
        mock_base_image.width.return_value = 2400
        mock_base_image.height.return_value = 1800
        mock_render.return_value = mock_base_image

        mock_composed_image = Mock()
        mock_composed_image.width.return_value = 2400
        mock_composed_image.height.return_value = 1924
        mock_qimage_class.return_value = mock_composed_image

        mock_painter = Mock()
        mock_qpainter_class.return_value = mock_painter

        mock_canvas = Mock()

        # Test with scale 3.0
        compose_export_image(mock_canvas, scale=3.0)
        self.assertEqual(mock_render.call_args[1]["scale"], 3.0)

        mock_render.reset_mock()

        # Test with scale 4.0
        compose_export_image(mock_canvas, scale=4.0)
        self.assertEqual(mock_render.call_args[1]["scale"], 4.0)


class ExportToImageTests(unittest.TestCase):
    """Tests for image export functionality."""

    @patch("src.canvas.export.compose_export_image")
    def test_export_to_image_saves_file(self, mock_compose):
        """Test that export_to_image saves a file."""
        from PyQt5.QtGui import QImage

        mock_image = Mock(spec=QImage)
        mock_image.save.return_value = True
        mock_compose.return_value = mock_image

        mock_canvas = Mock()
        mock_canvas.zoom_level = 1.0

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            export_to_image(mock_canvas, tmp_path)
            mock_image.save.assert_called_once_with(tmp_path, quality=100)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    @patch("src.canvas.export.compose_export_image")
    def test_export_to_image_restores_zoom(self, mock_compose):
        """Test that export_to_image restores original zoom level."""
        from PyQt5.QtGui import QImage

        mock_image = Mock(spec=QImage)
        mock_image.save.return_value = True
        mock_compose.return_value = mock_image

        mock_canvas = Mock()
        mock_canvas.zoom_level = 2.0
        mock_canvas.apply_zoom = Mock()

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            export_to_image(mock_canvas, tmp_path)
            self.assertEqual(mock_canvas.zoom_level, 2.0)
            self.assertEqual(mock_canvas.apply_zoom.call_count, 2)  # Once to reset, once to restore
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)


class ExportToPDFTests(unittest.TestCase):
    """Tests for PDF export functionality."""

    @patch("src.canvas.export.compose_export_image")
    @patch("src.canvas.export.QPrinter")
    @patch("src.canvas.export.QPainter")
    def test_export_to_pdf_creates_file(self, mock_painter_class, mock_printer_class, mock_compose):
        """Test that export_to_pdf creates a file."""
        from PyQt5.QtGui import QImage
        from PyQt5.QtCore import QSizeF

        mock_image = Mock(spec=QImage)
        mock_image.width.return_value = 3200
        mock_image.height.return_value = 2400
        mock_compose.return_value = mock_image

        mock_printer = Mock()
        mock_printer.resolution.return_value = 300
        mock_printer_class.return_value = mock_printer

        mock_painter = Mock()
        mock_painter_class.return_value = mock_painter

        mock_canvas = Mock()
        mock_canvas.zoom_level = 1.0

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            export_to_pdf(mock_canvas, tmp_path)
            mock_printer.setOutputFileName.assert_called_once_with(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    @patch("src.canvas.export.compose_export_image")
    @patch("src.canvas.export.QPrinter")
    @patch("src.canvas.export.QPainter")
    def test_export_to_pdf_restores_zoom(self, mock_painter_class, mock_printer_class, mock_compose):
        """Test that export_to_pdf restores original zoom level."""
        from PyQt5.QtGui import QImage

        mock_image = Mock(spec=QImage)
        mock_image.width.return_value = 3200
        mock_image.height.return_value = 2400
        mock_compose.return_value = mock_image

        mock_printer = Mock()
        mock_printer.resolution.return_value = 300
        mock_printer_class.return_value = mock_printer

        mock_painter = Mock()
        mock_painter_class.return_value = mock_painter

        mock_canvas = Mock()
        mock_canvas.zoom_level = 2.5
        mock_canvas.apply_zoom = Mock()

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            export_to_pdf(mock_canvas, tmp_path)
            self.assertEqual(mock_canvas.zoom_level, 2.5)
            self.assertEqual(mock_canvas.apply_zoom.call_count, 2)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)


class ReportGeneratorMetadataTests(unittest.TestCase):
    """Tests for PDFReportGenerator with metadata."""

    def test_report_generator_accepts_metadata(self):
        """Test that PDFReportGenerator accepts metadata parameter."""
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            generator = PDFReportGenerator(tmp_path)
            metadata = {
                "project_name": "Test Project",
                "created_by": "john.doe",
                "date": "May 18, 2026",
            }
            data = [
                {
                    "tag": "P-101",
                    "type": "Pump",
                    "description": "Centrifugal Pump",
                    "s_no": 1,
                }
            ]

            # Should not raise an error
            generator.generate(data, metadata=metadata)

            self.assertEqual(generator.metadata, metadata)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def test_report_generator_with_empty_metadata(self):
        """Test that PDFReportGenerator handles empty metadata gracefully."""
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            generator = PDFReportGenerator(tmp_path)
            data = [
                {
                    "tag": "P-101",
                    "type": "Pump",
                    "description": "Centrifugal Pump",
                    "s_no": 1,
                }
            ]

            # Should not raise an error with None metadata
            generator.generate(data, metadata=None)

            self.assertEqual(generator.metadata, {})
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def test_report_generator_metadata_in_footer(self):
        """Test that metadata is stored for use in footer rendering."""
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            generator = PDFReportGenerator(tmp_path)
            metadata = {
                "project_name": "Custom Project",
                "created_by": "alice.smith",
                "date": "May 18, 2026",
            }

            # Verify metadata is set before generation
            self.assertEqual(generator.metadata, {})

            data = [
                {
                    "tag": "T-100",
                    "type": "Tank",
                    "description": "Storage Tank",
                    "s_no": 1,
                }
            ]
            generator.generate(data, metadata=metadata)

            # Verify metadata is stored
            self.assertEqual(generator.metadata["project_name"], "Custom Project")
            self.assertEqual(generator.metadata["created_by"], "alice.smith")
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)


if __name__ == "__main__":
    unittest.main()
