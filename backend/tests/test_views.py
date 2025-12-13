from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from django.urls import reverse
from django.test import TestCase
from api.models import Component
from django.core.files.uploadedfile import SimpleUploadedFile


class RegisterAPITest(APITestCase):
    def test_register_user(self):
        url = reverse('auth_register')
        data = {
            'username': 'testuser',
            'email': 'testuser@example.com',
            'password': 'testpassword123'
        }
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 1)

class RefreshTokenAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword123')
    def test_refresh_token(self):
        # First, obtain a token pair
        login_url = reverse('auth_login')
        login_data = {
            'username': 'testuser',
            'password': 'testpassword123'
        }
        login_response = self.client.post(login_url, login_data, format='json')
        refresh_token = login_response.data['refresh']

        # Now, refresh the token
        refresh_url = reverse('token_refresh')
        refresh_data = {
            'refresh': refresh_token
        }
        refresh_response = self.client.post(refresh_url, refresh_data, format='json')

        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_response.data)

class LoginAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpassword123'
        )
    
    def test_login_user(self):
        url = reverse('auth_login')
        data = {
            'username': 'testuser',
            'password': 'testpassword123'
        }
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

class ComponentListAPITest(APITestCase):
    def setUp(self):
        Component.objects.create(
            s_no='1',
            parent='',
            name='Resistor',
            legend='R',
            suffix='R',
            object='Object',
            grips='Grips'
        )
        Component.objects.create(
            s_no='2',
            parent='',
            name='Capacitor',
            legend='C',
            suffix='C',
            object='Object',
            grips='Grips'
        )
    
    def test_list_components(self):
        url = reverse('component-list')
        response = self.client.get(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)