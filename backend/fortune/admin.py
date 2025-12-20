# fortune/admin.py
from django.contrib import admin
from .models import RTPConfig, GameSession, GameRound, GameOutcome, PlayerStats

@admin.register(RTPConfig)
class RTPConfigAdmin(admin.ModelAdmin):
    list_display = ("game", "target_rtp", "win_prob_cap", "max_steps", "max_multiplier", "daily_win_cap_per_user", "updated_at")
    list_editable = ("target_rtp", "win_prob_cap", "max_steps", "max_multiplier", "daily_win_cap_per_user")
    search_fields = ("game",)

@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "game", "bet_amount", "status", "step_index", "current_multiplier", "payout_amount", "created_at")
    list_filter = ("game", "status")
    search_fields = ("id", "user__email", "user__username")
    readonly_fields = ("server_seed_hash", "server_seed", "server_nonce", "created_at", "finished_at")

@admin.register(GameRound)
class GameRoundAdmin(admin.ModelAdmin):
    list_display = ("session", "step", "client_action", "client_choice", "safe_prob", "result", "rng_u", "created_at")
    list_filter = ("result", "session__game")

@admin.register(GameOutcome)
class GameOutcomeAdmin(admin.ModelAdmin):
    list_display = ("session", "win", "gross_payout", "net_profit", "rtp_used", "house_edge", "reason", "created_at")
    list_filter = ("win", "reason", "session__game")

@admin.register(PlayerStats)
class PlayerStatsAdmin(admin.ModelAdmin):
    list_display = ("user", "total_sessions", "total_wins", "total_bet", "total_payout", "suspicious_score", "fastest_step_ms", "updated_at")
