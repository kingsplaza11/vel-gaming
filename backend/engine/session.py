from django.utils import timezone

def create_session(model, user, stake):
    return model.objects.create(
        user=user,
        stake=stake,
        multiplier=1.0,
        active=True,
        started_at=timezone.now()
    )
