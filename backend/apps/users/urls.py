"""Rutas del módulo de usuarios y autenticación (HU-001)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import CurrentUserAPIView, LoginAPIView, UsuarioViewSet

router = DefaultRouter()
router.register(r"usuarios", UsuarioViewSet, basename="usuario")

urlpatterns = [
    path("login/", LoginAPIView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", CurrentUserAPIView.as_view(), name="auth-me"),
    path("", include(router.urls)),
]
