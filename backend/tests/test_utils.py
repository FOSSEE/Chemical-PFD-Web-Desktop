from django.test import TestCase

import zipfile
from io import BytesIO, StringIO
from unittest.mock import patch, Mock
from django.test import TestCase, RequestFactory
from django.contrib.admin import AdminSite
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib import messages
from django.core.files import File
from api.models import Component
from api.admin import ComponentAdmin
from django.urls import reverse


class ComponentAdminMinimalTest(TestCase):
    """Minimal tests for ComponentAdmin upload."""
    
    def setUp(self):
        # Create admin user
        User.objects.create_superuser(
            username='admin',
            password='password',
            email='admin@example.com'
        )
        self.client.login(username='admin', password='password')
    
    def create_test_zip(self):
        """Create a simple test zip with one component."""
        csv_content = """s_no,parent,name,legend,suffix,object,grips
1,,Resistor,R,R,,"""
        
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zf:
            zf.writestr('components/components.csv', csv_content)
            zf.writestr('components/svg/Resistor.svg', '<svg>Resistor</svg>')
            zf.writestr('components/png/Resistor.png', b'PNG')
        
        zip_buffer.seek(0)
        return zip_buffer
    
    def test_successful_upload(self):
        """Test that upload works with valid zip."""
        zip_buffer = self.create_test_zip()
        
        url = reverse('admin:component_upload_zip')
        zip_file = SimpleUploadedFile(
            'test.zip',
            zip_buffer.getvalue(),
            content_type='application/zip'
        )
        
        response = self.client.post(url, {'zip_file': zip_file})
        
        # Should redirect to component list
        self.assertRedirects(response, reverse('admin:api_component_changelist'))
        
        # Component should be created
        self.assertEqual(Component.objects.count(), 1)
        self.assertEqual(Component.objects.first().name, 'Resistor')
    
    def test_no_file_upload(self):
        """Test error when no file is uploaded."""
        url = reverse('admin:component_upload_zip')
        response = self.client.post(url, {}, follow=True)
        
        # Should show error
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'error')
    
    def test_non_zip_file(self):
        """Test error when non-zip file is uploaded."""
        url = reverse('admin:component_upload_zip')
        text_file = SimpleUploadedFile(
            'test.txt',
            b'Not a zip',
            content_type='text/plain'
        )
        
        response = self.client.post(url, {'zip_file': text_file}, follow=True)
        
        # Should show error
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'error')
    
    def test_get_upload_page(self):
        """Test that the upload page loads."""
        url = reverse('admin:component_upload_zip')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'form')