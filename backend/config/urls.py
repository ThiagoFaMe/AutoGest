"""Rutas principales de la API REST de AutoGest."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/users/", include("apps.users.urls")),
    path("api/core/", include("apps.core.urls")),
    path("api/budgets/", include("apps.budgets.urls")),
    path("api/workorders/", include("apps.workorders.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
