"""Vistas y endpoints REST para autenticación y gestión de usuarios (HU-001)."""
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Usuario
from .permissions import IsAdministrador
from .serializers import LoginRequestSerializer, UsuarioSerializer
from .services import authenticate_user, unlock_user_account


class LoginAPIView(APIView):
    """Endpoint de inicio de sesión con control de bloqueo tras 5 intentos fallidos (HU-001)."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        auth_payload = authenticate_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        return Response(auth_payload, status=status.HTTP_200_OK)


class CurrentUserAPIView(APIView):
    """Devuelve el perfil del usuario actualmente autenticado."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UsuarioSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UsuarioViewSet(viewsets.ModelViewSet):
    """
    ABM de cuentas de usuario y asignación de roles.
    Restringido exclusivamente al rol Administrador (Tabla 21 TFG - HU-001 Criterio 4).
    """

    queryset = Usuario.objects.all().order_by("id_usuario")
    serializer_class = UsuarioSerializer
    permission_classes = [IsAdministrador]

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get("search") or "").strip()
        rol = (self.request.query_params.get("rol") or "").strip()
        if search:
            qs = qs.filter(
                Q(nombre_completo__icontains=search) | Q(email__icontains=search)
            )
        if rol:
            qs = qs.filter(rol=rol)
        return qs

    @action(detail=True, methods=["post"], url_path="desbloquear")
    def desbloquear(self, request, pk=None):
        """Desbloquea manualmente una cuenta bloqueada por intentos fallidos."""
        usuario = self.get_object()
        unlock_user_account(usuario)
        return Response(
            {
                "detail": f"La cuenta de {usuario.nombre_completo} fue desbloqueada exitosamente.",
                "usuario": UsuarioSerializer(usuario).data,
            },
            status=status.HTTP_200_OK,
        )
