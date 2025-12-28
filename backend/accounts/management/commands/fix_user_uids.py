from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import string, random

User = get_user_model()

def generate_uid():
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=8))

class Command(BaseCommand):
    help = "Generate unique user_uid for existing users"

    def handle(self, *args, **kwargs):
        users = User.objects.filter(user_uid__isnull=True) | User.objects.filter(user_uid="")

        count = 0
        for user in users:
            while True:
                uid = generate_uid()
                if not User.objects.filter(user_uid=uid).exists():
                    user.user_uid = uid
                    user.save(update_fields=["user_uid"])
                    count += 1
                    break

        self.stdout.write(self.style.SUCCESS(f"✔ Assigned user_uid to {count} users"))
