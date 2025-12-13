from rest_framework import serializers
from .models import Component, Project, ProjectComponent



class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = '__all__'  
class ComponentSerializer(serializers.ModelSerializer):
    svg_url = serializers.SerializerMethodField()
    png_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Component
        fields = '__all__'  # Or list specific fields
        # fields = ['id', 's_no', 'parent', 'name', 'legend', 'suffix', 'object', 'grips', 'svg_url', 'png_url']
    
    def get_svg_url(self, obj):
        request = self.context.get('request')
        if obj.svg and hasattr(obj.svg, 'url'):
            if request:
                return request.build_absolute_uri(obj.svg.url)
            return obj.svg.url
        return None
    
    def get_png_url(self, obj):
        request = self.context.get('request')
        if obj.png and hasattr(obj.png, 'url'):
            if request:
                return request.build_absolute_uri(obj.png.url)
            return obj.png.url
        return None
    
class ProjectComponentSerializer(serializers.ModelSerializer):
    component = ComponentSerializer(read_only=True)
    class Meta:
        model = ProjectComponent
        fields = [ "component", "component_unique_id", "connections"]