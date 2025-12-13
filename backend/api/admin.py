from django.contrib import admin
from .models import Project, Component, ProjectComponent

# -----------------------------
# Project Admin
# -----------------------------
@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "user", "created_at")
    search_fields = ("name", "user__username")
    list_filter = ("created_at",)


# -----------------------------
# Component Admin
# -----------------------------
@admin.register(Component)
class ComponentAdmin(admin.ModelAdmin):
    list_display = ("id", "s_no", "name", "legend", "parent")
    search_fields = ("name", "s_no", "legend", "parent")


# -----------------------------
# ProjectComponent Admin
# -----------------------------
@admin.register(ProjectComponent)
class ProjectComponentAdmin(admin.ModelAdmin):
    list_display = ("id", "project_name", "component_name", "component_unique_id")
    search_fields = ("component_unique_id", "project__name", "component__name")
    list_filter = ("project", "component")

    # Show project name
    def project_name(self, obj):
        return obj.project.name
    project_name.short_description = "Project"

    # Show component name
    def component_name(self, obj):
        return obj.component.name
    component_name.short_description = "Component"
