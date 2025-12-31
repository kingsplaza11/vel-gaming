# fortune/consumers.py
from __future__ import annotations
import uuid
import random
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async
import urllib.parse

from .models import GameSession, GameRound
from .views import verify_ws_token
from .wallet import credit_payout

MIN_MULTIPLIER = Decimal("0.45")


class FortuneConsumer(AsyncJsonWebsocketConsumer):
    
    async def connect(self):
        """
        Connect and authenticate
        """
        print(f"[FortuneConsumer] New connection attempt")
        
        # Accept the connection first
        await self.accept()
        print(f"[FortuneConsumer] Connection accepted")
        
        # Send a welcome message
        await self.send_json({
            "type": "connected",
            "message": "Connected to Fortune Mouse"
        })
        
        # Set initial state
        self.user_id = None
        self.session_id = None
        self.authenticated = False
    
    async def receive_json(self, content, **kwargs):
        """
        Handle incoming messages
        """
        msg_type = content.get("type")
        print(f"[FortuneConsumer] Received message type: {msg_type}")
        
        if msg_type == "ping":
            await self.send_json({"type": "pong"})
            return
        
        if msg_type == "join":
            await self.handle_join(content)
        elif msg_type == "step":
            await self.handle_step(content)
        elif msg_type == "cashout":
            await self.handle_cashout(content)
        else:
            await self.send_json({
                "type": "error",
                "code": "invalid_message_type",
                "message": f"Unknown message type: {msg_type}"
            })
    
    async def handle_join(self, content):
        """
        Handle join/authentication message
        """
        token = content.get("ws_token")
        
        if not token:
            await self.send_json({
                "type": "error",
                "code": "missing_token",
                "message": "No authentication token provided"
            })
            return
        
        try:
            # Verify the token
            user_id, session_id, nonce = await sync_to_async(verify_ws_token)(token, 120)
            print(f"[FortuneConsumer] Token verified: user={user_id}, session={session_id}")
        except Exception as e:
            print(f"[FortuneConsumer] Token verification failed: {e}")
            await self.send_json({
                "type": "error",
                "code": "auth_failed",
                "message": "Authentication failed"
            })
            await self.close(code=4001)
            return
        
        # Bind to session
        ok = await self.bind_to_session(user_id, session_id, nonce)
        if not ok:
            await self.send_json({
                "type": "error",
                "code": "session_not_found",
                "message": "Session not found or invalid"
            })
            await self.close(code=4002)
            return
        
        # Send success response
        session = await self.get_session()
        await self.send_json({
            "type": "joined",
            "status": session.status,
            "step_index": session.step_index,
            "current_multiplier": str(session.current_multiplier),
            "payout_amount": str(session.payout_amount),
        })
    
    async def bind_to_session(self, user_id, session_id, nonce):
        """
        Bind this connection to a game session
        """
        try:
            session = await sync_to_async(GameSession.objects.get)(
                id=session_id, 
                user_id=user_id
            )
            
            if str(session.server_nonce) != str(nonce):
                print(f"[FortuneConsumer] Nonce mismatch")
                return False
            
            self.user_id = user_id
            self.session_id = session_id
            self.authenticated = True
            return True
            
        except GameSession.DoesNotExist:
            print(f"[FortuneConsumer] Session {session_id} not found")
            return False
        except Exception as e:
            print(f"[FortuneConsumer] Bind error: {e}")
            return False
    
    async def get_session(self):
        """
        Get the current session
        """
        if not self.session_id or not self.user_id:
            return None
        
        try:
            return await sync_to_async(GameSession.objects.get)(
                id=self.session_id,
                user_id=self.user_id
            )
        except GameSession.DoesNotExist:
            return None
    
    async def handle_step(self, content):
        """
        Handle tile pick/step action
        """
        if not self.authenticated:
            await self.send_json({
                "type": "error",
                "code": "not_authenticated",
                "message": "Not authenticated. Send join message first."
            })
            return
        
        msg_id = content.get("msg_id")
        action = content.get("action")
        choice = content.get("choice")
        
        if not all([msg_id, action, choice]):
            await self.send_json({
                "type": "error",
                "code": "missing_parameters",
                "message": "Missing required parameters"
            })
            return
        
        # Process the step
        result = await sync_to_async(self.process_step)(
            msg_id, action, choice, self.user_id, self.session_id
        )
        
        await self.send_json(result)
    
    async def handle_cashout(self, content):
        """
        Handle cashout action
        """
        if not self.authenticated:
            await self.send_json({
                "type": "error",
                "code": "not_authenticated",
                "message": "Not authenticated"
            })
            return
        
        msg_id = content.get("msg_id")
        
        if not msg_id:
            await self.send_json({
                "type": "error",
                "code": "missing_parameters",
                "message": "Missing msg_id"
            })
            return
        
        # Process cashout
        result = await sync_to_async(self.process_cashout)(
            msg_id, self.user_id, self.session_id
        )
        
        await self.send_json(result)
    
    def process_step(self, msg_id, action, choice, user_id, session_id):
        """
        Process a step (synchronous version)
        """
        try:
            msg_uuid = uuid.UUID(msg_id)
        except (ValueError, TypeError):
            return {
                "type": "error",
                "code": "invalid_msg_id",
                "message": "Invalid message ID"
            }
        
        with transaction.atomic():
            try:
                session = GameSession.objects.select_for_update().get(
                    id=session_id,
                    user_id=user_id
                )
            except GameSession.DoesNotExist:
                return {
                    "type": "error",
                    "code": "session_not_found",
                    "message": "Session not found"
                }
            
            # Check if session is active
            if session.status != GameSession.STATUS_ACTIVE:
                return {
                    "type": "state",
                    "status": session.status,
                    "step_index": session.step_index,
                    "current_multiplier": str(session.current_multiplier),
                    "payout_amount": str(session.payout_amount),
                }
            
            # Check for duplicate
            if session.last_client_msg_id == msg_uuid:
                return {"type": "duplicate"}
            
            # Generate random result and calculate probabilities
            roll = random.random()
            
            # Calculate safe probability based on step (simplified logic)
            # You can implement more complex logic based on your game design
            safe_prob = Decimal("0.55")  # Default 55% safe chance for step 0
            if session.step_index > 0:
                # Decrease safe probability as steps increase
                safe_prob = max(Decimal("0.10"), Decimal("0.55") - Decimal(session.step_index) * Decimal("0.05"))
            
            rng_u = Decimal(str(roll)).quantize(Decimal("0.000000000001"))
            
            if roll < 0.55:
                tile_kind = "safe"
                delta = Decimal(random.choice(["0.15", "0.25", "0.40"]))
                session.current_multiplier += delta
            elif roll < 0.70:
                tile_kind = "penalty"
                session.current_multiplier *= Decimal("0.5")
            elif roll < 0.85:
                tile_kind = "reset"
                session.current_multiplier = MIN_MULTIPLIER
            else:
                tile_kind = "trap"
                session.status = GameSession.STATUS_LOST
                session.finished_at = timezone.now()
                session.last_client_msg_id = msg_uuid
                session.save()
                
                # Create round record for trap
                GameRound.objects.create(
                    session=session,
                    step=session.step_index + 1,  # This will be the step that caused loss
                    client_action=action,
                    client_choice=choice,
                    safe_prob=safe_prob,
                    result="trap",  # Use the constant from models
                    rng_u=rng_u,
                    multiplier_after=session.current_multiplier,
                    survival_prob_after=Decimal("0.0"),  # Game over, survival is 0
                )
                
                return {
                    "type": "step_result",
                    "result": tile_kind,
                    "status": "lost",
                    "step_index": session.step_index,
                    "current_multiplier": str(session.current_multiplier),
                }
            
            # Ensure minimum multiplier
            if session.current_multiplier < MIN_MULTIPLIER:
                session.current_multiplier = MIN_MULTIPLIER
            
            # Calculate survival probability after this step
            # This is simplified - implement your actual survival probability logic
            survival_prob_after = Decimal("1.0")
            if session.step_index > 0:
                # Decrease survival probability with each safe step
                survival_prob_after = max(Decimal("0.0"), Decimal("1.0") - Decimal(session.step_index + 1) * Decimal("0.05"))
            
            # Update session
            session.step_index += 1
            session.survival_prob = survival_prob_after
            session.last_client_msg_id = msg_uuid
            session.save()
            
            # Create round record with all required fields
            GameRound.objects.create(
                session=session,
                step=session.step_index,
                client_action=action,
                client_choice=choice,
                safe_prob=safe_prob,
                result="safe" if tile_kind in ["safe", "penalty", "reset"] else "trap",
                rng_u=rng_u,
                multiplier_after=session.current_multiplier,
                survival_prob_after=survival_prob_after,
            )
            
            return {
                "type": "step_result",
                "result": tile_kind,
                "step_index": session.step_index,
                "current_multiplier": str(session.current_multiplier),
            }
    
    def process_cashout(self, msg_id, user_id, session_id):
        """
        Process cashout (synchronous version)
        """
        try:
            msg_uuid = uuid.UUID(msg_id)
        except (ValueError, TypeError):
            return {
                "type": "error",
                "code": "invalid_msg_id",
                "message": "Invalid message ID"
            }
        
        with transaction.atomic():
            try:
                session = GameSession.objects.select_for_update().get(
                    id=session_id,
                    user_id=user_id
                )
            except GameSession.DoesNotExist:
                return {
                    "type": "error",
                    "code": "session_not_found",
                    "message": "Session not found"
                }
            
            if session.status != GameSession.STATUS_ACTIVE:
                return {
                    "type": "state",
                    "status": session.status,
                    "payout_amount": str(session.payout_amount),
                }
            
            # Calculate payout
            payout = (session.bet_amount * session.current_multiplier).quantize(Decimal("0.01"))
            
            # Update session
            session.status = GameSession.STATUS_CASHED
            session.payout_amount = payout
            session.finished_at = timezone.now()
            session.last_client_msg_id = msg_uuid
            session.save()
            
            # Create GameOutcome record
            from .models import GameOutcome
            GameOutcome.objects.create(
                session=session,
                house_edge=Decimal("0.75"),  # 1 - RTP (adjust based on your RTP)
                rtp_used=Decimal("0.25"),    # Your RTP
                win=True,
                gross_payout=payout,
                net_profit=payout - session.bet_amount,
                reason="cashout",
            )
            
            # Credit payout
            try:
                credit_payout(
                    user_id=session.user_id,
                    payout=payout,
                    ref=f"fortune:{session.id}:cashout"
                )
            except Exception as e:
                print(f"[FortuneConsumer] Credit payout error: {e}")
                # Continue anyway - the session is already marked as cashed
            
            return {
                "type": "cashout_result",
                "payout_amount": str(payout),
                "current_multiplier": str(session.current_multiplier),
                "step_index": session.step_index,
            }
    
    async def disconnect(self, close_code):
        """
        Handle disconnection
        """
        print(f"[FortuneConsumer] Disconnected with code {close_code}")