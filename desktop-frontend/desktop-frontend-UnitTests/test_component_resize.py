import unittest
from unittest.mock import patch, Mock

from PyQt5.QtWidgets import QApplication, QWidget
from PyQt5.QtCore import QSize, QRectF, QPoint, Qt, QEvent
from PyQt5.QtGui import QMouseEvent

import src.component_widget as cw


class ComponentResizeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not QApplication.instance():
            cls._app = QApplication([])

    def make_renderer_mock(self, w=200, h=100):
        m = Mock()
        m.defaultSize.return_value = QSize(w, h)
        m.isValid.return_value = True
        return m

    def test_resize_br_keeps_aspect_ratio(self):
        with patch("src.component_widget.QSvgRenderer") as MockRenderer:
            MockRenderer.return_value = self.make_renderer_mock(200, 100)
            parent = QWidget()
            parent.zoom_level = 1.0

            widget = cw.ComponentWidget(svg_path="dummy.svg", parent=parent, config={})
            parent.components = [widget]

            widget.logical_rect = QRectF(0, 0, 200, 100)
            widget.resize_handle = "br"
            widget.resize_start_rect = QRectF(widget.logical_rect)
            widget.resize_start_global = QPoint(100, 100)

            event = QMouseEvent(
                QEvent.MouseMove,
                QPoint(0, 0),
                QPoint(0, 0),
                QPoint(120, 110),
                Qt.LeftButton,
                Qt.LeftButton,
                Qt.NoModifier,
            )
            widget.mouseMoveEvent(event)

            self.assertAlmostEqual(widget.logical_rect.width(), 220.0)
            self.assertAlmostEqual(widget.logical_rect.height(), 110.0)

    def test_resize_tl_keeps_aspect_ratio_and_moves_origin(self):
        with patch("src.component_widget.QSvgRenderer") as MockRenderer:
            MockRenderer.return_value = self.make_renderer_mock(200, 100)
            parent = QWidget()
            parent.zoom_level = 1.0

            widget = cw.ComponentWidget(svg_path="dummy.svg", parent=parent, config={})
            parent.components = [widget]

            widget.logical_rect = QRectF(0, 0, 200, 100)
            widget.resize_handle = "tl"
            widget.resize_start_rect = QRectF(widget.logical_rect)
            widget.resize_start_global = QPoint(100, 100)

            event = QMouseEvent(
                QEvent.MouseMove,
                QPoint(0, 0),
                QPoint(0, 0),
                QPoint(80, 90),
                Qt.LeftButton,
                Qt.LeftButton,
                Qt.NoModifier,
            )
            widget.mouseMoveEvent(event)

            self.assertAlmostEqual(widget.logical_rect.width(), 220.0)
            self.assertAlmostEqual(widget.logical_rect.height(), 110.0)
            self.assertAlmostEqual(widget.logical_rect.left(), -20.0)
            self.assertAlmostEqual(widget.logical_rect.top(), -10.0)

    def test_resize_r_stretches_width_only(self):
        with patch("src.component_widget.QSvgRenderer") as MockRenderer:
            MockRenderer.return_value = self.make_renderer_mock(200, 100)
            parent = QWidget()
            parent.zoom_level = 1.0

            widget = cw.ComponentWidget(svg_path="dummy.svg", parent=parent, config={})
            parent.components = [widget]

            widget.logical_rect = QRectF(0, 0, 200, 100)
            widget.resize_handle = "r"
            widget.resize_start_rect = QRectF(widget.logical_rect)
            widget.resize_start_global = QPoint(100, 100)

            event = QMouseEvent(
                QEvent.MouseMove,
                QPoint(0, 0),
                QPoint(0, 0),
                QPoint(120, 110), # Moved right by 20, down by 10
                Qt.LeftButton,
                Qt.LeftButton,
                Qt.NoModifier,
            )
            widget.mouseMoveEvent(event)

            # Width should increase by 20, height should remain 100
            self.assertAlmostEqual(widget.logical_rect.width(), 220.0)
            self.assertAlmostEqual(widget.logical_rect.height(), 100.0)
            self.assertAlmostEqual(widget.logical_rect.left(), 0.0)
            self.assertAlmostEqual(widget.logical_rect.top(), 0.0)

    def test_resize_b_stretches_height_only(self):
        with patch("src.component_widget.QSvgRenderer") as MockRenderer:
            MockRenderer.return_value = self.make_renderer_mock(200, 100)
            parent = QWidget()
            parent.zoom_level = 1.0

            widget = cw.ComponentWidget(svg_path="dummy.svg", parent=parent, config={})
            parent.components = [widget]

            widget.logical_rect = QRectF(0, 0, 200, 100)
            widget.resize_handle = "b"
            widget.resize_start_rect = QRectF(widget.logical_rect)
            widget.resize_start_global = QPoint(100, 100)

            event = QMouseEvent(
                QEvent.MouseMove,
                QPoint(0, 0),
                QPoint(0, 0),
                QPoint(120, 110), # Moved right by 20, down by 10
                Qt.LeftButton,
                Qt.LeftButton,
                Qt.NoModifier,
            )
            widget.mouseMoveEvent(event)

            # Height should increase by 10, width should remain 200
            self.assertAlmostEqual(widget.logical_rect.width(), 200.0)
            self.assertAlmostEqual(widget.logical_rect.height(), 110.0)
            self.assertAlmostEqual(widget.logical_rect.left(), 0.0)
            self.assertAlmostEqual(widget.logical_rect.top(), 0.0)

    def test_resize_blocks_overlap(self):
        with patch("src.component_widget.QSvgRenderer") as MockRenderer:
            MockRenderer.return_value = self.make_renderer_mock(200, 100)
            parent = QWidget()
            parent.zoom_level = 1.0

            widget = cw.ComponentWidget(svg_path="dummy.svg", parent=parent, config={})
            other = cw.ComponentWidget(svg_path="dummy.svg", parent=parent, config={})
            parent.components = [widget, other]

            widget.logical_rect = QRectF(0, 0, 100, 50)
            other.logical_rect = QRectF(120, 0, 60, 60)

            widget.resize_handle = "br"
            widget.resize_start_rect = QRectF(widget.logical_rect)
            widget.resize_start_global = QPoint(100, 100)

            event = QMouseEvent(
                QEvent.MouseMove,
                QPoint(0, 0),
                QPoint(0, 0),
                QPoint(140, 110),
                Qt.LeftButton,
                Qt.LeftButton,
                Qt.NoModifier,
            )
            widget.mouseMoveEvent(event)

            self.assertEqual(widget.logical_rect, QRectF(0, 0, 100, 50))


if __name__ == "__main__":
    unittest.main()
