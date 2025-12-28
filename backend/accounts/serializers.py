from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    referral_code_input = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            "id",
            "user_uid",
            "username",
            "email",
            "password",
            "full_name",
            "phone_number",
            "referral_code",
            "referral_code_input",
        )
        extra_kwargs = {
            "email": {"required": True},
        }

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value.lower()

    def create(self, validated_data):
        ref_code = validated_data.pop("referral_code_input", None)
        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)

        if ref_code:
            referrer = User.objects.filter(referral_code=ref_code).first()
            if referrer:
                user.referred_by = referrer

        user.save()
        return user
