from django.db import models

class Project(models.Model):
    name = models.CharField(max_length=100)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Component(models.Model):
    s_no = models.CharField(max_length=10)
    parent = models.CharField(max_length=100)
    name = models.CharField(max_length=100)
    legend = models.CharField(max_length=100)
    suffix = models.CharField(max_length=10)
    object = models.CharField(max_length=100)
    svg = models.FileField(upload_to='components/')
    png = models.ImageField(upload_to='components/')
    grips = models.TextField()

    def __str__(self):
        return self.name

class ProjectComponent(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    component = models.ForeignKey(Component, on_delete=models.CASCADE)
    component_unique_id = models.CharField(max_length=100)
    connections = models.JSONField()
