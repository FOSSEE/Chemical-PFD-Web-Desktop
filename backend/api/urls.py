from django.urls import path
from . import views


urlpatterns = [
    path("hello/", views.hello_world),

    # Auth endpoints
    path('auth/register/', views.RegisterView.as_view(), name='auth_register'),
    path('auth/login/', views.LoginView.as_view(), name='auth_login'),  # JWT login
    path('auth/refresh/', views.TokenRefreshView.as_view(), name='token_refresh'),

    # Component endpoints
    path('components/', views.ComponentListView.as_view(), name='component-list'),
    
  
    # Project endpoints
    path('project/', views.ProjectListCreateView.as_view(), name='project-list'),
    path('project/<int:id>/', views.ProjectDetailView.as_view(), name='project-detail'),
  ]
