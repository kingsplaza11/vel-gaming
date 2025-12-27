from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=6,
        style={"input_type": "password"},
        required=True,
    )

    full_name = serializers.CharField(
        required=True,
        allow_blank=False,
    )

    phone_number = serializers.CharField(
        required=True,
        allow_blank=False,
    )

    referral_code_input = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "password",
            "full_name",
            "phone_number",
            "referral_code",
            "referral_code_input",
        )

    def create(self, validated_data):
        ref_code = validated_data.pop("referral_code_input", None)
        password = validated_data.pop("password")

        user = User(
            username=validated_data["username"],
            email=validated_data["email"],
            full_name=validated_data["full_name"],
            phone_number=validated_data["phone_number"],
        )
        user.set_password(password)

        if ref_code:
            referrer = User.objects.filter(referral_code=ref_code).first()
            if referrer:
                user.referred_by = referrer

        user.save()
        return user
