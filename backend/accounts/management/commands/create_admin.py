from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


# ============================
# 🔧 CONFIGURE USER HERE
# ============================
USER_DATA = {
    "email": "support@veltoragames.com",
    "username": "support@veltoragames.com",
    "password": "2uKXq@1XZkA).?J-k8#Q",
    "full_name": "Customer Support",
    "phone_number": "+2348178734",

    # 🔐 ROLE SETTINGS
    "is_staff": True,       # True → staff
    "is_superuser": True,   # True → admin
    "is_active": True,
}
# ============================


class Command(BaseCommand):
    help = "Create user/admin from predefined config (no CLI input)"

    def handle(self, *args, **kwargs):
        email = USER_DATA.get("email")

        if not email:
            self.stdout.write(self.style.ERROR("❌ Email is required in USER_DATA"))
            return

        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.WARNING(f"⚠️ User with email {email} already exists")
            )
            return

        user = User.objects.create_user(
            email=email,
            username=USER_DATA.get("username"),
            password=USER_DATA.get("password"),
        )

        # Optional fields
        user.full_name = USER_DATA.get("full_name", "")
        user.phone_number = USER_DATA.get("phone_number", "")

        # Role flags
        user.is_staff = USER_DATA.get("is_staff", False)
        user.is_superuser = USER_DATA.get("is_superuser", False)
        user.is_active = USER_DATA.get("is_active", True)

        user.save()

        self.stdout.write(self.style.SUCCESS("✅ User account created successfully"))
        self.stdout.write(f"📧 Email: {user.email}")
        self.stdout.write(f"👤 Username: {user.username}")
        self.stdout.write(f"🆔 UID: {user.user_uid}")
        self.stdout.write(
            "🔐 Role: "
            + ("Admin" if user.is_superuser else "Staff" if user.is_staff else "Regular User")
        )
