# crash/management/commands/reset_risk_settings.py
from django.core.management.base import BaseCommand
from crash.models import RiskSettings

class Command(BaseCommand):
    help = 'Completely reset RiskSettings to default values'

    def handle(self, *args, **kwargs):
        # Delete all existing settings
        RiskSettings.objects.all().delete()
        
        # Create new settings with defaults
        risk = RiskSettings.get()
        
        # Display the new values
        self.stdout.write(self.style.SUCCESS('Successfully reset RiskSettings to defaults:'))
        self.stdout.write(f"  min_bet_per_player: ₦{risk.min_bet_per_player:,.2f}")
        self.stdout.write(f"  max_bet_per_player: ₦{risk.max_bet_per_player:,.2f}")
        self.stdout.write(f"  max_bet_per_player_per_round: ₦{risk.max_bet_per_player_per_round:,.2f}")
        self.stdout.write(f"  max_exposure_per_round: ₦{risk.max_exposure_per_round:,.2f}")
        self.stdout.write(f"  max_win_per_bet: ₦{risk.max_win_per_bet:,.2f}")
        self.stdout.write(f"  max_multiplier_cap: {risk.max_multiplier_cap}x")
        self.stdout.write(f"  house_edge_percent: {risk.house_edge_percent}%")
        self.stdout.write(f"  min_auto_cashout: {risk.min_auto_cashout}x")
        self.stdout.write(f"  max_auto_cashout: {risk.max_auto_cashout}x")
        self.stdout.write(f"  allow_demo: {risk.allow_demo}")
        self.stdout.write(f"  allow_real_money: {risk.allow_real_money}")
        self.stdout.write(f"  bet_cooldown_seconds: {risk.bet_cooldown_seconds}s")
        self.stdout.write(f"  max_bets_per_minute: {risk.max_bets_per_minute}")