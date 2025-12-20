from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'balance')
        extra_kwargs = {'password': {'write_only': True}}

    def get_balance(self, obj):
        try:
            return float(obj.balance)
        except:
            return 0.00
    
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user
