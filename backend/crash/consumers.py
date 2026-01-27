import json
from decimal import Decimal
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.db import transaction, DatabaseError, models
from django.conf import settings
from django.core.cache import cache
import logging

from .models import GameRound, CrashBet, RiskSettings
from wallets.services import place_bet_atomic, cashout_atomic, process_auto_cashout
from wallets.models import Wallet

logger = logging.getLogger(__name__)

class CrashConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        if self.scope["user"].is_anonymous:
            await self.close()
            return

        self.user = self.scope["user"]
        self.mode = self.scope["url_route"]["kwargs"]["mode"]
        self.is_demo = self.mode == "demo"
        self.group_name = f"crash_{self.mode}"
        self.user_group_name = f"crash_user_{self.user.id}_{self.mode}"

        # Join both main group and user-specific group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.accept()

        logger.info(f"[CRASH] User {self.user.username} connected in {self.mode} mode")

        # Send current round info
        current_round = await self._get_current_round()
        if current_round:
            await self.send_json({
                "event": "connected",
                "mode": self.mode,
                "data": {
                    "round_id": current_round.id,
                    "status": current_round.status,
                    "multiplier": 1.0,
                    "phase": "running" if current_round.status == "RUNNING" else "betting"
                }
            })
        else:
            await self.send_json({
                "event": "connected",
                "mode": self.mode,
            })

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        await self.channel_layer.group_discard(self.user_group_name, self.channel_name)
        logger.info(f"[CRASH] User {self.user.username if hasattr(self, 'user') else 'Anonymous'} disconnected")

    async def receive_json(self, content, **kwargs):
        event = content.get("event")
        data = content.get("data") or {}
        
        logger.info(f"[CRASH] Received WebSocket event: {event} from user {self.user.username}")
        logger.info(f"[CRASH] Event data: {data}")
        
        if event == "place_bet":
            await self.handle_place_bet(data)
        elif event == "cashout":
            await self.handle_cashout(data)
        elif event == "cancel_auto_cashout":
            await self.handle_cancel_auto_cashout(data)
        else:
            logger.warning(f"[CRASH] Unknown event received: {event}")

    @database_sync_to_async
    def _get_current_round(self):
        return GameRound.objects.filter(
            is_demo=self.is_demo, 
            status__in=["PENDING", "RUNNING"]
        ).order_by("-id").first()

    @database_sync_to_async
    def _get_active_bet(self, round_obj=None):
        """Get user's active bet for current round"""
        if not round_obj:
            round_obj = GameRound.objects.filter(is_demo=self.is_demo).order_by("-id").first()
        
        if not round_obj:
            return None
            
        return CrashBet.objects.filter(
            user=self.user,
            round=round_obj,
            status="ACTIVE",
            is_demo=self.is_demo
        ).first()

    @database_sync_to_async
    def _place_bet(self, user, amount, auto_cashout, ip, device_fp):
        logger.info(f"[CRASH] Placing bet: user={user.username}, amount={amount}, auto_cashout={auto_cashout}")
        
        with transaction.atomic():
            round_obj = GameRound.objects.filter(
                is_demo=self.is_demo, 
                status="PENDING"
            ).select_for_update().order_by("-id").first()
            
            if not round_obj:
                logger.warning("[CRASH] No active betting round available")
                raise ValueError("No active betting round available")
            
            logger.info(f"[CRASH] Round found: {round_obj.id}, status: {round_obj.status}")
            
            risk = RiskSettings.get()
            
            # Validate bet amount against risk settings
            if amount > risk.max_bet_per_player:
                error_msg = f"Maximum bet is ₦{risk.max_bet_per_player:,.2f}"
                logger.warning(f"[CRASH] {error_msg}")
                raise ValueError(error_msg)
            
            if amount < risk.min_bet_per_player:
                error_msg = f"Minimum bet is ₦{risk.min_bet_per_player:,.2f}"
                logger.warning(f"[CRASH] {error_msg}")
                raise ValueError(error_msg)
            
            # Check user's existing active bet (using unique_together constraint)
            existing_bet = CrashBet.objects.filter(
                user=user,
                round=round_obj,
                status="ACTIVE",
                is_demo=self.is_demo
            ).first()
            
            if existing_bet:
                logger.warning(f"[CRASH] User already has active bet: {existing_bet.id}")
                raise ValueError("You already have an active bet in this round")
            
            # Check max bet per player per round
            total_player_bet = CrashBet.objects.filter(
                user=user,
                round=round_obj,
                is_demo=self.is_demo
            ).aggregate(total=models.Sum('bet_amount'))['total'] or Decimal('0')
            
            if total_player_bet + amount > risk.max_bet_per_player_per_round:
                error_msg = f"Maximum bet per round is ₦{risk.max_bet_per_player_per_round:,.2f}"
                logger.warning(f"[CRASH] {error_msg}")
                raise ValueError(error_msg)
            
            # Calculate total exposure for the round
            total_exposure = CrashBet.objects.filter(
                round=round_obj, 
                status__in=["ACTIVE", "CASHED_OUT", "PENDING"]
            ).aggregate(total=models.Sum('bet_amount'))['total'] or Decimal('0')
            
            if total_exposure + amount > risk.max_exposure_per_round:
                logger.warning(f"[CRASH] Round exposure limit reached: {total_exposure + amount} > {risk.max_exposure_per_round}")
                raise ValueError("Round exposure limit reached")
            
            # Validate auto cashout if provided
            if auto_cashout:
                if auto_cashout < risk.min_auto_cashout:
                    error_msg = f"Minimum auto cashout is {risk.min_auto_cashout}x"
                    logger.warning(f"[CRASH] {error_msg}")
                    raise ValueError(error_msg)
                if auto_cashout > risk.max_auto_cashout:
                    error_msg = f"Maximum auto cashout is {risk.max_auto_cashout}x"
                    logger.warning(f"[CRASH] {error_msg}")
                    raise ValueError(error_msg)
            
            # Check user's wallet balance - check both balance and spot_balance
            wallet = Wallet.objects.select_for_update().get(user=user)
            total_available_balance = wallet.balance + wallet.spot_balance
            
            logger.info(f"[CRASH] Wallet balance: {wallet.balance}, Spot balance: {wallet.spot_balance}, Total: {total_available_balance}")
            
            if total_available_balance < amount:
                logger.warning(f"[CRASH] Insufficient total balance: {total_available_balance} < {amount}")
                raise ValueError("Insufficient balance")
            
            logger.info(f"[CRASH] Sufficient balance: {total_available_balance} >= {amount}")
            
            # Place bet atomically (service will handle the split between balance and spot_balance)
            ref = f"CRASHBET-{round_obj.id}-{user.id}-{int(timezone.now().timestamp())}"
            logger.info(f"[CRASH] Processing bet with ref: {ref}")
            
            try:
                # Call place_bet_atomic which handles the split between balance and spot_balance
                new_balance = place_bet_atomic(user, amount, ref)
                logger.info(f"[CRASH] Bet atomic completed, new balance: {new_balance}")
                
                # Refresh wallet to get updated balances
                wallet.refresh_from_db()
                logger.info(f"[CRASH] Updated wallet - Balance: {wallet.balance}, Spot: {wallet.spot_balance}")
                
            except Exception as e:
                logger.error(f"[CRASH] Error in place_bet_atomic: {str(e)}")
                raise ValueError("Failed to process bet. Please try again.")
            
            # Create bet record
            bet = CrashBet.objects.create(
                user=user,
                round=round_obj,
                bet_amount=amount,
                auto_cashout=auto_cashout,
                status="ACTIVE",
                is_demo=self.is_demo,
                ip_address=ip,
                device_fingerprint=device_fp,
            )
            
            logger.info(f"[CRASH] Bet created successfully: {bet.id}")
            
            # Return the wallet's total available balance for response
            total_balance = wallet.balance + wallet.spot_balance
            
            return round_obj, bet, total_balance

    @database_sync_to_async
    def _cashout(self, user, bet_id, current_multiplier):
        """Process manual cashout by user"""
        logger.info(f"[CRASH] Processing cashout: user={user.username}, bet_id={bet_id}, multiplier={current_multiplier}")
        
        with transaction.atomic():
            bet = CrashBet.objects.select_for_update().select_related('round').get(
                id=bet_id, 
                user=user, 
                is_demo=self.is_demo
            )
            
            logger.info(f"[CRASH] Bet found: {bet.id}, status: {bet.status}")
            
            if bet.status != "ACTIVE":
                logger.warning(f"[CRASH] Bet is not active: {bet.status}")
                raise ValueError("Bet is not active")
            
            round_obj = bet.round
            
            if round_obj.status != "RUNNING":
                logger.warning(f"[CRASH] Round is not running: {round_obj.status}")
                raise ValueError("Cannot cashout - round is not running")
            
            # Ensure current multiplier is valid (not after crash)
            if round_obj.crash_point and current_multiplier > round_obj.crash_point:
                logger.warning(f"[CRASH] Round has already crashed at {round_obj.crash_point}, current: {current_multiplier}")
                raise ValueError("Round has already crashed")
            
            # Calculate payout and validate max win
            payout = (bet.bet_amount * Decimal(str(current_multiplier))).quantize(Decimal("0.01"))
            logger.info(f"[CRASH] Calculated payout: {bet.bet_amount} * {current_multiplier} = {payout}")
            
            risk = RiskSettings.get()
            if payout > risk.max_win_per_bet:
                logger.warning(f"[CRASH] Payout exceeds max win: {payout} > {risk.max_win_per_bat}")
                raise ValueError(f"Maximum win per bet is ₦{risk.max_win_per_bet:,.2f}")
            
            # Process cashout
            ref = f"CRASHCASHOUT-{bet.id}-{int(timezone.now().timestamp())}"
            logger.info(f"[CRASH] Processing cashout with ref: {ref}")
            
            try:
                # Use atomic cashout service
                wallet_balance = cashout_atomic(user, bet, payout, ref)
                logger.info(f"[CRASH] Cashout atomic completed, new balance: {wallet_balance}")
                
                # Update bet status
                bet.status = "CASHED_OUT"
                bet.cashout_multiplier = Decimal(str(current_multiplier))
                bet.win_amount = payout
                bet.cashed_out_at = timezone.now()
                bet.save()
                
                logger.info(f"[CRASH] Bet updated to CASHED_OUT: {bet.id}")
                
                # Get wallet to return total balance
                wallet = Wallet.objects.get(user=user)
                total_balance = wallet.balance + wallet.spot_balance
                
                return bet, payout, round_obj, total_balance
                
            except Exception as e:
                logger.error(f"[CRASH] Cashout failed for bet {bet_id}: {str(e)}")
                raise ValueError("Cashout failed. Please try again.")

    @database_sync_to_async
    def _process_auto_cashout(self, round_obj, current_multiplier):
        """Process auto cashouts for all qualifying bets"""
        try:
            logger.info(f"[CRASH] Processing auto cashouts for round {round_obj.id} at multiplier {current_multiplier}")
            
            active_bets = CrashBet.objects.filter(
                round=round_obj,
                status="ACTIVE",
                auto_cashout__isnull=False,
                auto_cashout__lte=Decimal(str(current_multiplier)),
                is_demo=self.is_demo
            ).select_for_update().select_related('user')
            
            results = []
            for bet in active_bets:
                try:
                    payout = (bet.bet_amount * Decimal(str(current_multiplier))).quantize(Decimal("0.01"))
                    
                    # Validate max win
                    risk = RiskSettings.get()
                    if payout > risk.max_win_per_bet:
                        logger.warning(f"Auto cashout payout {payout} exceeds max win for bet {bet.id}")
                        continue
                    
                    ref = f"AUTOCASHOUT-{bet.id}-{int(timezone.now().timestamp())}"
                    
                    # Process auto cashout
                    wallet_balance = process_auto_cashout(bet.user, bet, payout, ref)
                    
                    # Update bet
                    bet.status = "CASHED_OUT"
                    bet.cashout_multiplier = Decimal(str(current_multiplier))
                    bet.win_amount = payout
                    bet.cashed_out_at = timezone.now()
                    bet.save()
                    
                    # Get total wallet balance
                    wallet = Wallet.objects.get(user=bet.user)
                    total_balance = wallet.balance + wallet.spot_balance
                    
                    results.append({
                        'bet_id': bet.id,
                        'user_id': bet.user.id,
                        'username': bet.user.username,
                        'payout': payout,
                        'multiplier': current_multiplier,
                        'wallet_balance': total_balance
                    })
                    
                    logger.info(f"[CRASH] Auto cashout processed for bet {bet.id}")
                    
                except Exception as e:
                    logger.error(f"[CRASH] Auto cashout failed for bet {bet.id}: {str(e)}")
                    continue
            
            logger.info(f"[CRASH] Auto cashout processing completed: {len(results)} bets")
            return results
            
        except Exception as e:
            logger.error(f"[CRASH] Auto cashout processing failed: {str(e)}")
            return []

    @database_sync_to_async
    def _process_end_of_game_cashouts(self, round_obj, crash_multiplier):
        """Process all remaining active bets at the end of the game"""
        try:
            logger.info(f"[CRASH] Processing end of game for round {round_obj.id} at crash {crash_multiplier}")
            
            active_bets = CrashBet.objects.filter(
                round=round_obj,
                status="ACTIVE",
                is_demo=self.is_demo
            ).select_for_update().select_related('user')
            
            results = []
            for bet in active_bets:
                try:
                    # At crash, bets lose (status becomes LOST)
                    bet.status = "LOST"
                    bet.save()
                    
                    results.append({
                        'bet_id': bet.id,
                        'user_id': bet.user.id,
                        'username': bet.user.username,
                        'status': 'LOST',
                        'crash_multiplier': crash_multiplier,
                        'lost_amount': bet.bet_amount
                    })
                    
                    logger.info(f"[CRASH] Bet {bet.id} marked as LOST")
                    
                except Exception as e:
                    logger.error(f"[CRASH] End game processing failed for bet {bet.id}: {str(e)}")
                    continue
            
            logger.info(f"[CRASH] End of game processing completed: {len(results)} bets")
            return results
            
        except Exception as e:
            logger.error(f"[CRASH] End of game processing failed: {str(e)}")
            return []

    @database_sync_to_async
    def _cancel_auto_cashout(self, user, bet_id):
        """Cancel auto cashout setting for a bet"""
        logger.info(f"[CRASH] Cancelling auto cashout for bet {bet_id}")
        
        with transaction.atomic():
            bet = CrashBet.objects.select_for_update().get(
                id=bet_id, 
                user=user, 
                status="ACTIVE",
                is_demo=self.is_demo
            )
            
            round_obj = bet.round
            if round_obj.status != "PENDING" and round_obj.status != "RUNNING":
                logger.warning(f"[CRASH] Cannot cancel auto cashout - round status: {round_obj.status}")
                raise ValueError("Cannot modify auto cashout - round is not active")
            
            bet.auto_cashout = None
            bet.save()
            
            logger.info(f"[CRASH] Auto cashout cancelled for bet {bet_id}")
            return bet

    @database_sync_to_async
    def _get_round_by_id(self, round_id):
        try:
            return GameRound.objects.get(id=round_id, is_demo=self.is_demo)
        except GameRound.DoesNotExist:
            logger.warning(f"[CRASH] Round {round_id} not found")
            return None

    async def handle_place_bet(self, data):
        logger.info(f"[CRASH] handle_place_bet called for user {self.user.username}")
        
        user = self.scope["user"]
        
        try:
            amount_str = data.get("amount", "0")
            auto_cashout_str = data.get("auto_cashout")
            
            logger.info(f"[CRASH] Parsing amount: {amount_str}, auto_cashout: {auto_cashout_str}")
            
            amount = Decimal(str(amount_str))
            auto_cashout = Decimal(str(auto_cashout_str)) if auto_cashout_str else None
            
            ip = self.scope.get("client")[0] if self.scope.get("client") else "0.0.0.0"
            device_fp = data.get("device_fp", "web_client")
            
            logger.info(f"[CRASH] Calling _place_bet with: amount={amount}, auto_cashout={auto_cashout}")
            
            round_obj, bet, new_balance = await self._place_bet(user, amount, auto_cashout, ip, device_fp)
            
            logger.info(f"[CRASH] Bet placed successfully: {bet.id}, new total balance: {new_balance}")
            
            # Broadcast to all users
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "player.bet",
                    "data": {
                        "user": user.username,
                        "bet_id": bet.id,
                        "amount": str(amount),
                        "auto_cashout": str(auto_cashout) if auto_cashout else None,
                        "timestamp": timezone.now().isoformat()
                    },
                },
            )

            # Send confirmation to user
            await self.send_json({
                "event": "bet_accepted",
                "data": {
                    "round_id": round_obj.id,
                    "bet_id": bet.id,
                    "amount": str(amount),
                    "auto_cashout": str(auto_cashout) if auto_cashout else None,
                    "balance": str(new_balance),
                    "placed_at": bet.created_at.isoformat()
                }
            })
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[CRASH] Error in handle_place_bet: {error_msg}", exc_info=True)
            await self.send_json({
                "event": "bet_failed", 
                "error": error_msg,
                "data": {"bet_amount": data.get("amount", "0")}
            })

    async def handle_cashout(self, data):
        logger.info(f"[CRASH] handle_cashout called for user {self.user.username}")
        
        user = self.scope["user"]
        bet_id = data.get("bet_id")
        current_multiplier_str = data.get("multiplier", "1.0")
        
        try:
            current_multiplier = Decimal(str(current_multiplier_str))
            logger.info(f"[CRASH] Calling _cashout with: bet_id={bet_id}, multiplier={current_multiplier}")
            
            bet, payout, round_obj, new_balance = await self._cashout(user, bet_id, current_multiplier)
            
            logger.info(f"[CRASH] Cashout successful: {bet.id}, new total balance: {new_balance}")
            
            # Broadcast to all users
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "player.cashout",
                    "data": {
                        "user": user.username,
                        "bet_id": bet.id,
                        "payout": str(payout),
                        "multiplier": str(bet.cashout_multiplier),
                        "cashout_type": "MANUAL",
                        "timestamp": timezone.now().isoformat()
                    },
                },
            )

            # Send confirmation to user
            await self.send_json({
                "event": "cashout_success",
                "data": {
                    "bet_id": bet.id,
                    "payout": str(payout),
                    "multiplier": str(bet.cashout_multiplier),
                    "balance": str(new_balance),
                    "cashout_type": "MANUAL",
                    "cashed_out_at": bet.cashed_out_at.isoformat() if bet.cashed_out_at else timezone.now().isoformat()
                }
            })
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[CRASH] Error in handle_cashout: {error_msg}", exc_info=True)
            await self.send_json({
                "event": "cashout_failed", 
                "error": error_msg,
                "data": {"bet_id": bet_id, "multiplier": str(current_multiplier_str)}
            })

    async def handle_cancel_auto_cashout(self, data):
        logger.info(f"[CRASH] handle_cancel_auto_cashout called for user {self.user.username}")
        
        user = self.scope["user"]
        bet_id = data.get("bet_id")
        
        try:
            bet = await self._cancel_auto_cashout(user, bet_id)
            
            await self.send_json({
                "event": "auto_cashout_cancelled",
                "data": {
                    "bet_id": bet.id,
                    "message": "Auto cashout disabled"
                }
            })
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[CRASH] Error in handle_cancel_auto_cashout: {error_msg}")
            await self.send_json({
                "event": "cancel_auto_cashout_failed", 
                "error": error_msg,
                "data": {"bet_id": bet_id}
            })

    # Group handlers from game engine
    async def round_start(self, event):
        logger.info(f"[CRASH] Broadcasting round_start event")
        await self.send_json({"event": "round_start", "data": event["data"]})

    async def round_countdown(self, event):
        await self.send_json({"event": "round_countdown", "data": event["data"]})

    async def round_lock_bets(self, event):
        logger.info(f"[CRASH] Broadcasting round_lock_bets event")
        await self.send_json({"event": "round_lock_bets", "data": event["data"]})

    async def round_multiplier(self, event):
        data = event["data"]
        current_multiplier = Decimal(str(data["multiplier"]))
        
        logger.info(f"[CRASH] Handling round_multiplier: {current_multiplier}")
        
        # Process auto cashouts when multiplier updates
        round_id = data.get("round_id")
        if round_id:
            # Get round object
            round_obj = await self._get_round_by_id(round_id)
            if round_obj:
                # Process auto cashouts
                auto_cashout_results = await self._process_auto_cashout(round_obj, current_multiplier)
                
                # If any auto cashouts happened, broadcast them
                if auto_cashout_results:
                    logger.info(f"[CRASH] Processing {len(auto_cashout_results)} auto cashouts")
                    for result in auto_cashout_results:
                        await self.channel_layer.group_send(
                            self.group_name,
                            {
                                "type": "player.cashout",
                                "data": {
                                    "user": result['username'],
                                    "bet_id": result['bet_id'],
                                    "payout": str(result['payout']),
                                    "multiplier": str(result['multiplier']),
                                    "cashout_type": "AUTO",
                                    "timestamp": timezone.now().isoformat()
                                },
                            },
                        )
                        
                        # Send individual notification to user
                        await self.channel_layer.group_send(
                            f"crash_user_{result['user_id']}_{self.mode}",
                            {
                                "type": "bet.auto.cashout",
                                "data": {
                                    "bet_id": result['bet_id'],
                                    "multiplier": str(result['multiplier']),
                                    "payout": str(result['payout']),
                                    "balance": str(result['wallet_balance'])
                                }
                            }
                        )
        
        await self.send_json({"event": "multiplier_update", "data": data})

    async def round_crash(self, event):
        data = event["data"]
        crash_multiplier = Decimal(str(data["crash_point"]))
        round_id = data.get("round_id")
        
        logger.info(f"[CRASH] Handling round_crash at {crash_multiplier}")
        
        if round_id:
            round_obj = await self._get_round_by_id(round_id)
            if round_obj:
                # Process all remaining bets as LOST
                crash_results = await self._process_end_of_game_cashouts(round_obj, crash_multiplier)
                
                # Send crash notifications to affected users
                if crash_results:
                    logger.info(f"[CRASH] Processing {len(crash_results)} lost bets")
                    for result in crash_results:
                        await self.channel_layer.group_send(
                            f"crash_user_{result['user_id']}_{self.mode}",
                            {
                                "type": "bet.crashed",
                                "data": {
                                    "bet_id": result['bet_id'],
                                    "crash_multiplier": str(result['crash_multiplier']),
                                    "lost_amount": str(result['lost_amount'])
                                }
                            }
                        )
        
        await self.send_json({"event": "round_crash", "data": data})

    async def player_bet(self, event):
        await self.send_json({"event": "player_bet", "data": event["data"]})

    async def player_cashout(self, event):
        await self.send_json({"event": "player_cashout", "data": event["data"]})

    # User-specific handlers
    async def bet_auto_cashout(self, event):
        """Handle auto cashout notification for specific user"""
        await self.send_json({"event": "auto_cashout_triggered", "data": event["data"]})

    async def bet_crashed(self, event):
        """Handle crash notification for specific user"""
        await self.send_json({"event": "bet_crashed", "data": event["data"]})