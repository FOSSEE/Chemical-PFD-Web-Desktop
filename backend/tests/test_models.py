from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from api.models import Component


class ComponentModelTest(TestCase):
    
    def setUp(self):
        self.svg_file = SimpleUploadedFile(
            'test.svg',
            b'<svg>Test SVG</svg>',
            content_type='image/svg+xml'
        )
        
        self.png_file = SimpleUploadedFile(
            'test.png',
            b'PNG data',
            content_type='image/png'
        )
    
    def test_create_component(self):
        """Test creating a component with all fields."""
        component = Component.objects.create(
            s_no='1',
            parent='',
            name='Resistor',
            legend='R',
            suffix='R',
            object='Object',
            grips='Grips',
            svg=self.svg_file,
            png=self.png_file
        )
        
        self.assertEqual(component.name, 'Resistor')
        self.assertEqual(component.s_no, '1')
        self.assertEqual(component.legend, 'R')
        self.assertEqual(component.suffix, 'R')
        self.assertEqual(component.object, 'Object')
        self.assertEqual(component.grips, 'Grips')
        self.assertIsNotNone(component.svg)
        self.assertIsNotNone(component.png)
    
    def test_create_component_minimal_fields(self):
        """Test creating a component with minimal required fields."""
        component = Component.objects.create(
            name='Resistor',
            svg=self.svg_file,
            png=self.png_file
        )

        
        self.assertEqual(component.name, 'Resistor')
        self.assertIsNotNone(component.svg)
        self.assertIsNotNone(component.png)
        self.assertEqual(component.s_no, '')
        self.assertEqual(component.parent, '')
        self.assertEqual(component.legend, '')
        self.assertEqual(component.suffix, '')
        self.assertEqual(component.object, '')
        self.assertEqual(component.grips, '')