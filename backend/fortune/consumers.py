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
import traceback

from .models import GameSession, GameRound, GameOutcome
from .views import verify_ws_token
from .wallet import credit_payout

MIN_MULTIPLIER = Decimal("0.45")
BASE_SAFE_PROB = Decimal("0.55")


class FortuneConsumer(AsyncJsonWebsocketConsumer):
    
    async def connect(self):
        """
        Connect and authenticate
        """
        print(f"[FortuneConsumer] New connection attempt from {self.scope['client'][0]}")
        
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
        try:
            msg_type = content.get("type")
            print(f"[FortuneConsumer] Received message type: {msg_type}, content: {content}")
            
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
        except Exception as e:
            print(f"[FortuneConsumer] Error processing message: {e}")
            traceback.print_exc()
            
            await self.send_json({
                "type": "error",
                "code": "server_error",
                "message": "Internal server error"
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
            print(f"[FortuneConsumer] Token verified: user={user_id}, session={session_id}, nonce={nonce}")
        except Exception as e:
            print(f"[FortuneConsumer] Token verification failed: {e}")
            traceback.print_exc()
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
        if not session:
            await self.send_json({
                "type": "error",
                "code": "session_not_found",
                "message": "Session not found"
            })
            await self.close(code=4002)
            return
        
        await self.send_json({
            "type": "joined",
            "session_id": str(session.id),
            "game": "fortune_mouse",
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
            print(f"[FortuneConsumer] Attempting to bind to session: {session_id}, user: {user_id}")
            session = await sync_to_async(GameSession.objects.get)(
                id=session_id, 
                user_id=user_id
            )
            
            print(f"[FortuneConsumer] Session found: id={session.id}, status={session.status}, nonce={session.server_nonce}")
            
            if str(session.server_nonce) != str(nonce):
                print(f"[FortuneConsumer] Nonce mismatch: expected {session.server_nonce}, got {nonce}")
                return False
            
            self.user_id = user_id
            self.session_id = session_id
            self.authenticated = True
            
            print(f"[FortuneConsumer] Successfully bound to session")
            return True
            
        except GameSession.DoesNotExist:
            print(f"[FortuneConsumer] Session {session_id} not found for user {user_id}")
            return False
        except Exception as e:
            print(f"[FortuneConsumer] Bind error: {e}")
            traceback.print_exc()
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
            print(f"[FortuneConsumer] Session {self.session_id} not found when retrieving")
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
                "message": "Missing required parameters: msg_id, action, choice"
            })
            return
        
        print(f"[FortuneConsumer] Processing step: msg_id={msg_id}, action={action}, choice={choice}")
        
        # Process the step
        try:
            result = await sync_to_async(self.process_step)(
                msg_id, action, choice, self.user_id, self.session_id
            )
            print(f"[FortuneConsumer] Step result: {result}")
            await self.send_json(result)
        except Exception as e:
            print(f"[FortuneConsumer] Error in handle_step: {e}")
            traceback.print_exc()
            await self.send_json({
                "type": "error",
                "code": "processing_error",
                "message": f"Error processing step: {str(e)}"
            })
    
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
        
        print(f"[FortuneConsumer] Processing cashout: msg_id={msg_id}")
        
        # Process cashout
        try:
            result = await sync_to_async(self.process_cashout)(
                msg_id, self.user_id, self.session_id
            )
            print(f"[FortuneConsumer] Cashout result: {result}")
            await self.send_json(result)
        except Exception as e:
            print(f"[FortuneConsumer] Error in handle_cashout: {e}")
            traceback.print_exc()
            await self.send_json({
                "type": "error",
                "code": "processing_error",
                "message": f"Error processing cashout: {str(e)}"
            })
    
    def process_step(self, msg_id, action, choice, user_id, session_id):
        """
        Process a step (synchronous version)
        """
        print(f"[FortuneConsumer.process_step] Processing step for user={user_id}, session={session_id}")
        
        try:
            msg_uuid = uuid.UUID(msg_id)
        except (ValueError, TypeError) as e:
            print(f"[FortuneConsumer.process_step] Invalid msg_id: {msg_id}, error: {e}")
            return {
                "type": "error",
                "code": "invalid_msg_id",
                "message": "Invalid message ID format"
            }
        
        with transaction.atomic():
            try:
                session = GameSession.objects.select_for_update().get(
                    id=session_id,
                    user_id=user_id
                )
                print(f"[FortuneConsumer.process_step] Session found: id={session.id}, status={session.status}, step={session.step_index}")
            except GameSession.DoesNotExist as e:
                print(f"[FortuneConsumer.process_step] Session not found: {e}")
                return {
                    "type": "error",
                    "code": "session_not_found",
                    "message": "Session not found"
                }
            
            # Check if session is active
            if session.status != GameSession.STATUS_ACTIVE:
                print(f"[FortuneConsumer.process_step] Session not active: status={session.status}")
                return {
                    "type": "state",
                    "status": session.status,
                    "step_index": session.step_index,
                    "current_multiplier": str(session.current_multiplier),
                    "payout_amount": str(session.payout_amount),
                }
            
            # Check for duplicate message
            if session.last_client_msg_id == msg_uuid:
                print(f"[FortuneConsumer.process_step] Duplicate message detected: {msg_uuid}")
                return {"type": "duplicate"}
            
            # Generate random result
            roll = random.random()
            print(f"[FortuneConsumer.process_step] Random roll: {roll}")
            
            # Calculate safe probability based on current step
            if session.step_index > 0:
                safe_prob = max(
                    Decimal("0.10"), 
                    BASE_SAFE_PROB - Decimal(session.step_index) * Decimal("0.05")
                )
            else:
                safe_prob = BASE_SAFE_PROB
            
            print(f"[FortuneConsumer.process_step] Safe probability: {safe_prob}")
            
            rng_u = Decimal(str(roll)).quantize(Decimal("0.000000000001"))
            
            # Determine tile kind based on roll
            tile_kind = None
            survival_prob_after = Decimal("1.0")
            
            if roll < float(safe_prob):
                tile_kind = "safe"
                delta = Decimal(random.choice(["0.15", "0.25", "0.40"]))
                session.current_multiplier += delta
                print(f"[FortuneConsumer.process_step] Safe tile, adding {delta}, new multiplier: {session.current_multiplier}")
            elif roll < 0.70:
                tile_kind = "penalty"
                session.current_multiplier *= Decimal("0.5")
                print(f"[FortuneConsumer.process_step] Penalty tile, halving multiplier: {session.current_multiplier}")
            elif roll < 0.85:
                tile_kind = "reset"
                session.current_multiplier = MIN_MULTIPLIER
                print(f"[FortuneConsumer.process_step] Reset tile, multiplier reset to: {session.current_multiplier}")
            else:
                tile_kind = "trap"
                session.status = GameSession.STATUS_LOST
                survival_prob_after = Decimal("0.0")
                print(f"[FortuneConsumer.process_step] Trap tile, game over")
            
            # Ensure minimum multiplier
            if session.current_multiplier < MIN_MULTIPLIER:
                session.current_multiplier = MIN_MULTIPLIER
                print(f"[FortuneConsumer.process_step] Enforced minimum multiplier: {session.current_multiplier}")
            
            # Calculate survival probability after this step
            if tile_kind != "trap":
                # Decrease survival probability with each step
                survival_prob_after = max(
                    Decimal("0.0"), 
                    Decimal("1.0") - Decimal(session.step_index + 1) * Decimal("0.05")
                )
                session.survival_prob = survival_prob_after
            
            # Always increment step_index
            new_step_index = session.step_index + 1
            session.step_index = new_step_index
            session.last_client_msg_id = msg_uuid
            
            if tile_kind == "trap":
                session.finished_at = timezone.now()
            
            session.save()
            print(f"[FortuneConsumer.process_step] Session saved: step_index={session.step_index}, multiplier={session.current_multiplier}, status={session.status}")
            
            # Determine result type for GameRound
            result_type = "trap" if tile_kind == "trap" else "safe"
            
            # Create round record
            try:
                game_round = GameRound.objects.create(
                    session=session,
                    step=session.step_index,
                    client_action=action,
                    client_choice=choice,
                    safe_prob=safe_prob,
                    result=result_type,
                    rng_u=rng_u,
                    multiplier_after=session.current_multiplier,
                    survival_prob_after=survival_prob_after,
                )
                print(f"[FortuneConsumer.process_step] GameRound created: id={game_round.id}")
            except Exception as e:
                print(f"[FortuneConsumer.process_step] Error creating GameRound: {e}")
                traceback.print_exc()
                # Continue anyway
            
            # Prepare response
            response = {
                "type": "step_result",
                "result": tile_kind,
                "step_index": session.step_index,
                "current_multiplier": str(session.current_multiplier),
                "survival_prob": str(survival_prob_after),
            }
            
            if tile_kind == "trap":
                response["status"] = "lost"
                print(f"[FortuneConsumer.process_step] Returning trap response: {response}")
            else:
                print(f"[FortuneConsumer.process_step] Returning safe response: {response}")
            
            return response
    
    def process_cashout(self, msg_id, user_id, session_id):
        """
        Process cashout (synchronous version)
        """
        print(f"[FortuneConsumer.process_cashout] Processing cashout for user={user_id}, session={session_id}")
        
        try:
            msg_uuid = uuid.UUID(msg_id)
        except (ValueError, TypeError) as e:
            print(f"[FortuneConsumer.process_cashout] Invalid msg_id: {msg_id}, error: {e}")
            return {
                "type": "error",
                "code": "invalid_msg_id",
                "message": "Invalid message ID format"
            }
        
        with transaction.atomic():
            try:
                session = GameSession.objects.select_for_update().get(
                    id=session_id,
                    user_id=user_id
                )
                print(f"[FortuneConsumer.process_cashout] Session found: id={session.id}, status={session.status}, multiplier={session.current_multiplier}")
            except GameSession.DoesNotExist as e:
                print(f"[FortuneConsumer.process_cashout] Session not found: {e}")
                return {
                    "type": "error",
                    "code": "session_not_found",
                    "message": "Session not found"
                }
            
            if session.status != GameSession.STATUS_ACTIVE:
                print(f"[FortuneConsumer.process_cashout] Session not active: status={session.status}")
                return {
                    "type": "state",
                    "status": session.status,
                    "payout_amount": str(session.payout_amount),
                    "current_multiplier": str(session.current_multiplier),
                    "step_index": session.step_index,
                }
            
            # Calculate payout
            payout = (session.bet_amount * session.current_multiplier).quantize(Decimal("0.01"))
            print(f"[FortuneConsumer.process_cashout] Calculated payout: {payout} = {session.bet_amount} * {session.current_multiplier}")
            
            # Update session
            session.status = GameSession.STATUS_CASHED
            session.payout_amount = payout
            session.finished_at = timezone.now()
            session.last_client_msg_id = msg_uuid
            session.save()
            print(f"[FortuneConsumer.process_cashout] Session updated to cashed out")
            
            # Create GameOutcome record
            try:
                outcome = GameOutcome.objects.create(
                    session=session,
                    house_edge=Decimal("0.75"),
                    rtp_used=Decimal("0.25"),
                    win=True,
                    gross_payout=payout,
                    net_profit=payout - session.bet_amount,
                    reason="cashout",
                )
                print(f"[FortuneConsumer.process_cashout] GameOutcome created: id={outcome.id}")
            except Exception as e:
                print(f"[FortuneConsumer.process_cashout] Error creating GameOutcome: {e}")
                traceback.print_exc()
                # Continue anyway
            
            # Credit payout to wallet
            try:
                credit_payout(
                    user_id=session.user_id,
                    payout=payout,
                    ref=f"fortune:{session.id}:cashout"
                )
                print(f"[FortuneConsumer.process_cashout] Payout credited to wallet")
            except Exception as e:
                print(f"[FortuneConsumer.process_cashout] Error crediting payout: {e}")
                traceback.print_exc()
                # Don't fail the cashout - the session is already marked as cashed
            
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
        print(f"[FortuneConsumer] Disconnected with code {close_code}, user={self.user_id}, session={self.session_id}")
        self.authenticated = False
        self.user_id = None
        self.session_id = None