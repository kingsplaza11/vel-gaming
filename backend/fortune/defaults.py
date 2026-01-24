# fortune/defaults.py
from decimal import Decimal

DEFAULT_RTP = {
    "fortune_mouse": {
        "target_rtp": Decimal("0.25"),
        "win_prob_cap": Decimal("0.30"),
        "max_steps": 25,
        "max_multiplier": Decimal("50.0000"),
        "base_safe_prob": Decimal("0.40"),
        "safe_prob_decay": Decimal("0.020"),
        "min_safe_prob": Decimal("0.05"),
        "daily_win_cap_per_user": Decimal("0.00"),
    },
    "fortune_tiger": {
        "target_rtp": Decimal("0.26"),
        "win_prob_cap": Decimal("0.28"),
        "max_steps": 20,
        "max_multiplier": Decimal("40.0000"),
        "base_safe_prob": Decimal("0.38"),
        "safe_prob_decay": Decimal("0.025"),
        "min_safe_prob": Decimal("0.05"),
        "daily_win_cap_per_user": Decimal("0.00"),
    },
    "fortune_rabbit": {
        "target_rtp": Decimal("0.27"),
        "win_prob_cap": Decimal("0.30"),
        "max_steps": 30,
        "max_multiplier": Decimal("60.0000"),
        "base_safe_prob": Decimal("0.42"),
        "safe_prob_decay": Decimal("0.018"),
        "min_safe_prob": Decimal("0.06"),
        "daily_win_cap_per_user": Decimal("0.00"),
    },
}
