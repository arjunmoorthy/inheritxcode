"""
================================================================================
Chat Service - Patient API
================================================================================

Module:         chat_service.py
Description:    Service for chat and symptom checker operations. Integrates
                the rule-based symptom checker engine for predictable,
                clinically-validated responses.

Created:        2025-12-12
Modified:       2026-01-16
Author:         Naveen Babu S A
Version:        2.1.0

Features:
    - Daily symptom check-in sessions
    - 7-phase symptom checker flow
    - Severity assessment (mild/moderate/severe/urgent)
    - Escalation detection and handling
    - WebSocket support for real-time chat
    - Automatic diary entry creation

Usage:
    from services import ChatService
    
    chat_service = ChatService(db)
    session = chat_service.get_or_create_today_session(patient_uuid)

Copyright:
    (c) 2026 OncoLife Health Technologies. All rights reserved.
================================================================================
"""

from typing import Dict, Any, List, Tuple, Optional, AsyncGenerator
from uuid import UUID
from datetime import datetime, time, date
import re
from sqlalchemy.orm import Session
import pytz
from services.symptom_analytics_service import save_symptom_analytics
from services.chemo_service import ChemoService
from services.clinical_narrative_summary import build_clinical_narrative_summary
from services.ai_clinical_summary_service import AIClinicalSummaryService

# Symptom checker engine
from routers.chat.symptom_checker import SymptomCheckerEngine, TriageLevel
from routers.chat.symptom_checker.symptom_engine import ConversationState, EngineResponse
from routers.chat.models import (
    WebSocketMessageIn, WebSocketMessageOut,
    ConnectionEstablished, Message
)
from routers.chat.symptom_checker_service import _display_content_for_user_symptom_message

# Database models
from db.patient_models import (
    ChatPatient,
    Conversations as ChatModel,
    Messages as MessageModel,
    PatientDiaryEntries as DiaryEntry,
)
from db.models import ConversationSummary


# Core
from core.logging import get_logger
from core.exceptions import NotFoundError, ValidationError

logger = get_logger(__name__)


class ChatService:
    """
    Service for chat and symptom checker operations.
    
    Uses a rule-based symptom checker engine for:
    - Greeting and symptom selection
    - Screening and follow-up questions
    - Triage level determination
    
    All operations are logged for audit purposes.
    """
    
    def __init__(self, db: Session):
        """
        Initialize the chat service.
        
        Args:
            db: Database session
        """
        self.db = db
        self.engine = None

    def _ensure_chat_patient(self, patient_uuid: UUID, source: str = "fax") -> None:
        """
        Ensure this patient is registered in chat_patients (link to fax_patient via same UUID).
        Called before creating a conversation so the FK is satisfied.
        """
        existing = self.db.query(ChatPatient).filter(ChatPatient.uuid == patient_uuid).first()
        if not existing:
            self.db.add(ChatPatient(uuid=patient_uuid, source=source))
            self.db.commit()
            logger.info(f"Registered chat_patient: uuid={patient_uuid} source={source}")
    
    # =========================================================================
    # Session Management
    # =========================================================================
    
    def get_or_create_today_session(
        self,
        patient_uuid: UUID,
        user_timezone: str = "America/Los_Angeles",
    ) -> Tuple[ChatModel, List[MessageModel], bool]:
        """
        Get or create today's chat session.
        
        Gets the most recent chat for today, or creates a new one.
        
        Args:
            patient_uuid: The patient's UUID
            user_timezone: User's timezone for date calculation
            
        Returns:
            Tuple of (chat, messages, is_new_session)
        """
        logger.info(f"Get/create today session: patient={patient_uuid} tz={user_timezone}")
        
        # Get today's date range in user's timezone
        user_tz = pytz.timezone(user_timezone)
        user_now = datetime.now(user_tz)
        today_start = datetime.combine(user_now.date(), time.min)
        today_end = datetime.combine(user_now.date(), time.max)
        
        # Convert to UTC for database query
        utc_today_start = user_tz.localize(today_start).astimezone(pytz.UTC)
        utc_today_end = user_tz.localize(today_end).astimezone(pytz.UTC)
        
        # Query for today's chat
        today_chat = self.db.query(ChatModel).filter(
            ChatModel.patient_uuid == patient_uuid,
            ChatModel.created_at >= utc_today_start,
            ChatModel.created_at <= utc_today_end,
        ).order_by(ChatModel.created_at.desc()).first()
        
        if today_chat:
            messages = self.db.query(MessageModel).filter(
                MessageModel.chat_uuid == today_chat.uuid
            ).order_by(MessageModel.created_at).all()
            logger.info(f"Found existing session: chat={today_chat.uuid} messages={len(messages)}")
            return today_chat, messages, False
        
        # Create new chat
        new_chat, initial_question = self.create_chat(patient_uuid, user_timezone=user_timezone)
        
        # Create the first assistant message
        first_message = MessageModel(
            chat_uuid=new_chat.uuid,
            sender="assistant",
            message_type=initial_question["type"],
            content=initial_question["text"],
            structured_data={
                "options": initial_question.get("options", []),
                "options_data": initial_question.get("options_data", []),
                "frontend_type": initial_question.get("frontend_type", "text"),
                "symptom_groups": initial_question.get("symptom_groups"),
                "summary_data": initial_question.get("summary_data"),
                "sender": initial_question.get("sender"),
            },
        )
        
        self.db.add(first_message)
        self.db.commit()
        self.db.refresh(first_message)
        
        logger.info(f"Created new session: chat={new_chat.uuid}")
        return new_chat, [first_message], True
    
    def create_chat(
        self,
        patient_uuid: UUID,
        user_timezone: str = "America/Los_Angeles",
    ) -> Tuple[ChatModel, Dict[str, Any]]:
        """
        Create a new symptom checker chat session (e.g. for "New Check-In").
        If the patient already answered the chemo question today in another chat,
        that answer is copied so we skip the chemo question in this new session.
        
        Args:
            patient_uuid: The patient's UUID
            user_timezone: Timezone for "today" when checking existing same-day chemo answer
            
        Returns:
            Tuple of (chat, initial_question)
        """
        logger.info(f"Create chat: patient={patient_uuid}")
        self._ensure_chat_patient(patient_uuid)
        
        # Create the conversation record
        new_chat = ChatModel(
            patient_uuid=patient_uuid,
            conversation_state="symptom_selection",
            symptom_list=[],
        )
        self.db.add(new_chat)
        self.db.commit()
        self.db.refresh(new_chat)
        
        # Initialize the engine and get the greeting (disclaimer first, then chemo today check)
        engine = SymptomCheckerEngine()
        response = engine.start_conversation()
        
        # Store engine state in chat metadata; conversation_state tracks current phase
        new_chat.engine_state = response.state.to_dict() if response.state else {}
        new_chat.conversation_state = response.state.phase.value if response.state else "disclaimer"

        # If patient already answered chemo today in another check-in, copy so we skip chemo in this one
        user_tz = pytz.timezone(user_timezone)
        user_now = datetime.now(user_tz)
        today_start = datetime.combine(user_now.date(), time.min)
        today_end = datetime.combine(user_now.date(), time.max)
        utc_today_start = user_tz.localize(today_start).astimezone(pytz.UTC)
        utc_today_end = user_tz.localize(today_end).astimezone(pytz.UTC)
        other_today = self.db.query(ChatModel).filter(
            ChatModel.patient_uuid == patient_uuid,
            ChatModel.uuid != new_chat.uuid,
            ChatModel.created_at >= utc_today_start,
            ChatModel.created_at <= utc_today_end,
        ).first()
        if other_today and getattr(other_today, "engine_state", None):
            es = other_today.engine_state or {}
            if es.get("chemo_today") is not None or es.get("next_chemo_date") or es.get("last_chemo_date"):
                new_chat.engine_state["chemo_today"] = es.get("chemo_today")
                new_chat.engine_state["next_chemo_date"] = es.get("next_chemo_date")
                new_chat.engine_state["last_chemo_date"] = es.get("last_chemo_date")
                logger.info(f"Copied chemo answer from existing today chat for patient {patient_uuid}")

        self.db.commit()
        
        initial_message = {
            "text": response.message,
            "type": self._map_message_type(response.message_type),
            "frontend_type": response.message_type,
            "options": [opt['label'] for opt in response.options] if response.options else [],
            "options_data": response.options,
            "symptom_groups": response.symptom_groups,
            "summary_data": response.summary_data,
            "sender": response.sender,
        }
        
        return new_chat, initial_message
    
    def delete_chat(
        self,
        chat_uuid: UUID,
        patient_uuid: UUID,
    ) -> None:
        """
        Delete a chat conversation.
        
        Args:
            chat_uuid: The chat's UUID
            patient_uuid: The patient's UUID (for authorization)
            
        Raises:
            NotFoundError: If chat not found or access denied
        """
        logger.info(f"Delete chat: chat={chat_uuid} patient={patient_uuid}")
        
        chat = self.db.query(ChatModel).filter(
            ChatModel.uuid == chat_uuid,
            ChatModel.patient_uuid == patient_uuid,
        ).first()
        
        if not chat:
            raise NotFoundError(
                message="Chat not found or access denied",
                resource_type="Chat",
                resource_id=str(chat_uuid),
            )
        
        self.db.delete(chat)
        self.db.commit()
        logger.info(f"Chat deleted: chat={chat_uuid}")
    
    def get_chat(
        self,
        chat_uuid: UUID,
        patient_uuid: UUID,
    ) -> ChatModel:
        """
        Get a chat by UUID.
        
        Args:
            chat_uuid: The chat's UUID
            patient_uuid: The patient's UUID (for authorization)
            
        Returns:
            The ChatModel instance
            
        Raises:
            NotFoundError: If chat not found or access denied
        """
        chat = self.db.query(ChatModel).filter(
            ChatModel.uuid == chat_uuid,
            ChatModel.patient_uuid == patient_uuid,
        ).first()
        
        if not chat:
            raise NotFoundError(
                message="Chat not found or access denied",
                resource_type="Chat",
                resource_id=str(chat_uuid),
            )
        
        return chat
    
    def update_overall_feeling(
        self,
        chat_uuid: UUID,
        patient_uuid: UUID,
        feeling: str,
    ) -> None:
        """
        Update the overall feeling for a chat.
        
        Args:
            chat_uuid: The chat's UUID
            patient_uuid: The patient's UUID
            feeling: The feeling value
        """
        chat = self.get_chat(chat_uuid, patient_uuid)
        chat.overall_feeling = feeling
        self.db.commit()
        logger.info(f"Updated feeling: chat={chat_uuid} feeling={feeling}")
    
    # =========================================================================
    # Message Processing
    # =========================================================================
    
    async def process_message_stream(
        self,
        chat_uuid: UUID,
        message: WebSocketMessageIn,
    ) -> AsyncGenerator[Any, None]:
        """
        Process a message using the symptom checker engine.
        
        Yields Message objects for:
        1. The saved user message
        2. The assistant's response
        
        Args:
            chat_uuid: The chat's UUID
            message: The incoming message
            
        Yields:
            Message objects for the frontend
        """
        logger.info(f"Process message: chat={chat_uuid} content={message.content[:50]}")
        
        chat = self.db.query(ChatModel).filter(
            ChatModel.uuid == chat_uuid
        ).first()
        
        if not chat:
            logger.error(f"Chat not found: {chat_uuid}")
            return
        
        # 1. Save the user's message (symptom codes -> display names; engine still parses raw message below)
        display_content = _display_content_for_user_symptom_message(message)
        user_msg = MessageModel(
            chat_uuid=chat_uuid,
            sender="user",
            message_type=message.message_type,
            content=display_content,
        )
        self.db.add(user_msg)
        self.db.commit()
        self.db.refresh(user_msg)
        yield Message.from_orm(user_msg)
        
        # 2. Load or create the engine with saved state
        engine_state_data = getattr(chat, 'engine_state', None) or {}
        if engine_state_data:
            state = ConversationState.from_dict(engine_state_data)
            engine = SymptomCheckerEngine(state=state)
        else:
            engine = SymptomCheckerEngine()
        
        # 3. Parse the user's response
        user_response = self._parse_user_response(message)
        
        # 3a. Check if this is a diary save action - handle before engine
        if message.content == 'save_diary' or user_response == 'save_diary':
            try:
                self._save_chat_to_diary(chat)
                logger.info(f"Saved chat to diary: chat={chat_uuid}")
            except Exception as e:
                logger.error(f"Failed to save to diary: {e}")
        
        # 4. Process the response through the engine
        try:
            engine_response = engine.process_response(user_response)
        except Exception as e:
            logger.error(f"Engine processing error: {e}")
            error_msg = MessageModel(
                chat_uuid=chat_uuid,
                sender="assistant",
                message_type="text",
                content="I'm sorry, I encountered an error. Please try again.",
            )
            self.db.add(error_msg)
            self.db.commit()
            self.db.refresh(error_msg)
            yield Message.from_orm(error_msg)
            return
        
        # 5. Save the engine state
        if engine_response.state:
            chat.engine_state = engine_response.state.to_dict()
            chat.symptom_list = engine_response.state.selected_symptoms

            # When user just submitted next chemo date (previous phase was NEXT_CHEMO_DATE), persist it
            prev_phase = (engine_state_data or {}).get("phase")
            next_chemo = getattr(engine_response.state, "next_chemo_date", None)
            if prev_phase == "next_chemo_date" and next_chemo:
                try:
                    chemo_date_parsed = date.fromisoformat(next_chemo) if isinstance(next_chemo, str) else next_chemo
                    ChemoService(self.db).log_chemo_date(chat.patient_uuid, chemo_date_parsed)
                    logger.info(f"Logged next chemo date for patient: {next_chemo}")
                except Exception as e:
                    logger.warning(f"Could not log next chemo date: {e}")
            
            summary_data = engine_response.summary_data or {}
            should_refine_ai_summary = bool(summary_data.get("regenerate_ai_summary"))

            if should_refine_ai_summary:
                edited_summary = str(summary_data.get("user_edited_summary", "")).strip()
                original_summary = (
                    (chat.patient_narrative_summary or "").strip()
                    or (getattr(engine_response.state, "ai_generated_summary", "") or "").strip()
                    or (chat.longer_summary or "").strip()
                )

                refined_summary = None
                if edited_summary and original_summary:
                    ai_service = AIClinicalSummaryService()
                    refined_summary = await ai_service.generate_refined_patient_summary(
                        original_summary=original_summary,
                        user_edited_summary=edited_summary,
                    )

                final_summary = refined_summary or edited_summary or original_summary
                if final_summary:
                    chat.patient_narrative_summary = final_summary
                    if engine_response.state:
                        engine_response.state.ai_generated_summary = final_summary
                        chat.engine_state = engine_response.state.to_dict()

            if engine_response.is_complete:
                should_emit_summary_progress_flag = (
                    engine_response.message_type == "summary"
                    and engine_response.triage_level != TriageLevel.CALL_911
                )
                if should_emit_summary_progress_flag:
                    # Emit an immediate backend flag so FE can show a progress bar
                    # while AI summary generation is running.
                    yield Message(
                        id=0,
                        chat_uuid=chat_uuid,
                        sender="system",
                        message_type="system",
                        content="",
                        structured_data={
                            "frontend_type": "summary_generation_status",
                            "summary_generation_in_progress": True,
                            "summary_generation_completed": False,
                        },
                        created_at=datetime.utcnow(),
                    )

                if engine_response.triage_level == TriageLevel.CALL_911:
                    chat.conversation_state = "EMERGENCY"
                else:
                    chat.conversation_state = "COMPLETED"
                
                # Set triage level and summaries for completed conversations
                chat.triage_level = engine_response.triage_level.value if engine_response.triage_level else 'none'
                chat.is_complete = "true"
                chat.completed_at = datetime.utcnow()

                try:
                    # symptom_details/symptom_time_series use patient_id as UUID (FK to patients.uuid).
                    # chat.patient_uuid is the same identity as doctor-api User.uuid for the fax patient.
                    save_symptom_analytics(
                        db=self.db,
                        patient_id=chat.patient_uuid,
                        conversation_id=chat_uuid,
                        engine_state=engine_response.state.to_dict()
                    )
                except Exception as e:
                    self.db.rollback()
                    logger.error(f"Failed to save symptom analytics: {e}", exc_info=True)
                
                # Generate summaries for the conversation
                summaries = self._generate_conversation_summaries(
                    chat=chat,
                    engine_state=engine_response.state.to_dict(),
                    triage_level=chat.triage_level
                )
                chat.bulleted_summary = summaries['bulleted']
                chat.longer_summary = summaries['longer']
                conversation_messages = self.db.query(MessageModel).filter(
                    MessageModel.chat_uuid == chat_uuid
                ).order_by(MessageModel.created_at, MessageModel.id).all()
                (
                    chat.clinical_narrative_summary,
                    chat.patient_narrative_summary,
                ) = await self._build_narrative_summaries(
                    engine_state=engine_response.state.to_dict(),
                    messages=conversation_messages,
                    chat_uuid=chat_uuid,
                    patient_fallback=summaries["longer"],
                )
                
                # AUTO-SAVE to conversation summaries when conversation completes
                # This happens automatically - no user action required
                try:
                    self._save_chat_to_conversation_summary(chat)
                    logger.info(f"Auto-saved symptom check to conversation summaries: chat={chat_uuid}")
                except Exception as e:
                    # Don't fail the whole flow if summary save fails
                    self.db.rollback()
                    logger.error(f"Failed to auto-save to conversation summaries: {e}")

                # AUTO-SAVE to diary when conversation completes (deprecated)
                # This happens automatically - no user action required
                # try:
                #     self._save_chat_to_diary(chat)
                #     logger.info(f"Auto-saved symptom check to diary: chat={chat_uuid}")
                # except Exception as e:
                #     # Don't fail the whole flow if diary save fails
                #     logger.error(f"Failed to auto-save to diary: {e}")
            else:
                chat.conversation_state = engine_response.state.phase.value
        
        self.db.commit()
        
        # 6. Create and save the assistant message
        ai_generated_summary: Optional[str] = None
        if engine_response.message_type == "summary" and getattr(chat, "patient_narrative_summary", None):
            ai_generated_summary = chat.patient_narrative_summary

        structured = {
            "options": [opt['label'] for opt in engine_response.options] if engine_response.options else None,
            "options_data": engine_response.options,
            "frontend_type": engine_response.message_type,
            "triage_level": engine_response.triage_level.value if engine_response.triage_level else None,
            "is_complete": engine_response.is_complete,
            "symptom_groups": engine_response.symptom_groups,
            "summary_data": engine_response.summary_data,
            "ai_generated_summary": ai_generated_summary,
            "summary_generation_in_progress": False,
            "summary_generation_completed": bool(
                engine_response.message_type == "summary" and ai_generated_summary
            ),
            "sender": engine_response.sender,
            "phase": engine_response.state.phase.value if engine_response.state else None,
        }
        # Explicit flag for FE: show calendar when asking for next chemo date
        if engine_response.message_type == "next_chemo_date":
            structured["show_date_picker"] = True
            structured["input_type"] = "date_picker"

        assistant_content = engine_response.message
        if engine_response.message_type == "summary" and ai_generated_summary:
            assistant_content = self._replace_summary_section_with_ai(
                message=assistant_content,
                ai_summary=ai_generated_summary,
            )

        assistant_msg = MessageModel(
            chat_uuid=chat_uuid,
            sender="assistant",
            message_type=self._map_message_type(engine_response.message_type),
            content=assistant_content,
            structured_data=structured,
        )
        self.db.add(assistant_msg)
        self.db.commit()
        self.db.refresh(assistant_msg)
        
        # Convert for frontend
        frontend_message = Message.from_orm(assistant_msg)
        frontend_message.message_type = self._map_frontend_type(engine_response.message_type)
        
        yield frontend_message

    def _replace_summary_section_with_ai(self, message: str, ai_summary: str) -> str:
        """Replace '**Summary:** ...' block with AI-generated summary text."""
        clean_summary = (ai_summary or "").strip()
        if not clean_summary:
            return message

        pattern = r"(\*\*Summary:\*\*\s*)(.*?)(\n\n)"
        replacement = r"\1" + clean_summary + r"\3"
        updated_message, count = re.subn(pattern, replacement, message, count=1, flags=re.DOTALL)
        if count > 0:
            return updated_message

        # Fallback if template changes and Summary marker isn't present.
        return f"**Summary:** {clean_summary}\n\n{message}"
    
    def _parse_user_response(self, message: WebSocketMessageIn) -> Any:
        """Parse the user's response based on message type."""
        content = message.content
        msg_type = message.message_type
        
        # Handle yes/no responses
        if msg_type == 'button_response':
            if content.lower() in ['yes', 'true']:
                return True
            elif content.lower() in ['no', 'false']:
                return False
            return content
        
        # Handle multi-select responses (comma-separated)
        if msg_type == 'multi_select_response':
            values = [v.strip() for v in content.split(',') if v.strip()]
            
            if message.structured_data and 'selected_values' in message.structured_data:
                return message.structured_data['selected_values']
            
            return values
        
        # Handle number responses
        try:
            return float(content)
        except (ValueError, TypeError):
            pass
        
        return content
    
    def _map_message_type(self, engine_type: str) -> str:
        """Map engine message types to database message types."""
        mapping = {
            'text': 'text',
            'yes_no': 'single_select',
            'choice': 'single_select',
            'multiselect': 'multi_select',
            'number': 'text',
            'symptom_select': 'multi_select',
            'triage_result': 'text',
            'chemo_today_check': 'single_select',
            'next_chemo_date': 'text',
        }
        return mapping.get(engine_type, 'text')
    
    def _map_frontend_type(self, engine_type: str) -> str:
        """Map engine message types to frontend message types."""
        mapping = {
            'text': 'text',
            'yes_no': 'single-select',
            'choice': 'single-select',
            'multiselect': 'multi-select',
            'number': 'text',
            'symptom_select': 'symptom-select',
            'triage_result': 'text',
            'chemo_today_check': 'single-select',
            'next_chemo_date': 'next_chemo_date',
        }
        return mapping.get(engine_type, 'text')
    
    # =========================================================================
    # Summary Generation
    # =========================================================================
    
    def _get_symptom_name(self, symptom_id: str) -> str:
        """Get the human-readable name for a symptom ID."""
        from routers.chat.symptom_checker.symptom_definitions import SYMPTOMS
        
        # SYMPTOMS is a dict with symptom_id as key, SymptomDef as value
        symptom = SYMPTOMS.get(symptom_id)
        if symptom:
            return symptom.name
        return symptom_id  # Fallback to ID if not found
    
    def _generate_conversation_summaries(
        self, 
        chat: ChatModel, 
        engine_state: Dict[str, Any],
        triage_level: str
    ) -> Dict[str, str]:
        """
        Generate bulleted and longer summaries for a completed conversation.
        
        Args:
            chat: The chat model
            engine_state: The engine state dictionary
            triage_level: The final triage level
            
        Returns:
            Dictionary with 'bulleted' and 'longer' summaries
        """
        symptom_list = chat.symptom_list or []
        symptom_names = [self._get_symptom_name(s) for s in symptom_list]
        symptoms_str = ", ".join(symptom_names) if symptom_names else "No symptoms reported"
        
        triage_results = engine_state.get('triage_results', [])
        triage_display = triage_level.replace('_', ' ').title() if triage_level else 'None'
        
        # Generate CONCISE bulleted summary (2-3 sentences as per requirement)
        # This is what shows in the Summaries page
        bulleted_lines = []
        
        # Line 1: Symptoms reported
        bulleted_lines.append(f"Symptoms: {symptoms_str}")
        
        # Line 2: Assessment level with context
        if triage_level == 'call_911':
            bulleted_lines.append("Assessment: Emergency - Immediate attention required")
        elif triage_level in ['urgent', 'notify_care_team']:
            bulleted_lines.append(f"Assessment: {triage_display} - Please contact your care team")
        else:
            bulleted_lines.append("Assessment: No urgent concerns identified")
        
        # Line 3: Specific alerts if any
        if triage_results:
            alert_items = [f"{r.get('symptom_name', 'Unknown')}" for r in triage_results]
            bulleted_lines.append(f"Flagged: {', '.join(alert_items)}")
        
        # Add personal notes if available (important for diary)
        personal_notes = engine_state.get('personal_notes')
        if personal_notes:
            # Truncate to keep concise
            notes_preview = personal_notes[:80] + '...' if len(personal_notes) > 80 else personal_notes
            bulleted_lines.append(f"Notes: {notes_preview}")
        
        bulleted_summary = " | ".join(bulleted_lines)
        
        # Generate longer narrative summary (2-3 sentences)
        longer_summary = f"You reported {symptoms_str}. "
        
        if triage_level == 'call_911':
            longer_summary += "This requires immediate emergency attention. Please call 911."
        elif triage_level in ['urgent', 'notify_care_team']:
            longer_summary += f"Please contact your care team for further evaluation."
            if triage_results:
                flagged = [r.get('symptom_name', '') for r in triage_results]
                longer_summary += f" Concerns flagged: {', '.join(flagged)}."
        else:
            longer_summary += "No urgent concerns were identified. Continue monitoring your symptoms."
        
        if personal_notes:
            longer_summary += f" Your notes: {personal_notes}"
        
        return {
            'bulleted': bulleted_summary,
            'longer': longer_summary
        }

    async def _build_narrative_summaries(
        self,
        engine_state: Dict[str, Any],
        messages: List[MessageModel],
        chat_uuid: UUID,
        patient_fallback: str,
    ) -> Tuple[str, str]:
        """
        Build clinical + patient narrative summaries with optional AI generation.

        Uses Gemini when enabled/configured, otherwise deterministic fallback.
        """
        clinical_fallback = build_clinical_narrative_summary(
            engine_state,
            self._get_symptom_name,
        )
        ai_service = AIClinicalSummaryService()
        ai_clinical_summary = await ai_service.generate_clinical_summary(messages=messages)
        ai_patient_summary = await ai_service.generate_patient_summary(messages=messages)

        if ai_clinical_summary:
            logger.info(f"Generated AI clinical summary for chat={chat_uuid}")
        else:
            logger.info(
                f"Using deterministic clinical summary fallback for chat={chat_uuid}"
            )

        if ai_patient_summary:
            logger.info(f"Generated AI patient summary for chat={chat_uuid}")
        else:
            logger.info(
                f"Using patient summary fallback from longer_summary for chat={chat_uuid}"
            )

        return (
            ai_clinical_summary or clinical_fallback,
            ai_patient_summary or patient_fallback,
        )
    
    # =========================================================================
    # Diary Integration
    # =========================================================================
    
    def _save_chat_to_conversation_summary(self, chat: ChatModel) -> ConversationSummary:
        """
        Save a completed symptom check session to conversation_summaries.
        
        Args:
            chat: The chat model with symptom check data
            
        Returns:
            The created conversation summary
        """
        # conversation_summaries.patient_uuid maps to chat_patients.uuid
        # because patient identity comes from doctor-api fax flow.
        self._ensure_chat_patient(chat.patient_uuid)

        engine_state = getattr(chat, "engine_state", {}) or {}
        triage_level = chat.triage_level or engine_state.get("highest_triage_level", "none")
        summaries = self._generate_conversation_summaries(
            chat=chat,
            engine_state=engine_state,
            triage_level=triage_level,
        )
        symptom_list = chat.symptom_list or []
        symptom_names = [self._get_symptom_name(s) for s in symptom_list]
        triage_results = engine_state.get("triage_results", [])
        triage_reasons = [r.get("message", "") for r in triage_results if r.get("message")]
        follow_up_needed = triage_level in ["call_911", "urgent", "same_day", "notify_care_team"]
        
        # One summary row per conversation (conversation_uuid is unique)
        existing = self.db.query(ConversationSummary).filter(
            ConversationSummary.conversation_uuid == chat.uuid
        ).first()
        if existing:
            existing.summary_type = "symptom_check"
            existing.chief_complaints = symptom_names[:3]
            existing.symptoms_reported = symptom_names
            existing.triage_level = triage_level
            existing.triage_reasons = triage_reasons
            existing.recommendations = []
            existing.follow_up_needed = follow_up_needed
            existing.follow_up_timeframe = "immediate" if follow_up_needed else None
            existing.brief_summary = summaries["bulleted"]
            existing.detailed_summary = summaries["longer"]
            self.db.commit()
            self.db.refresh(existing)
            logger.info(f"Updated conversation summary: {existing.uuid} for chat: {chat.uuid}")
            return existing
        
        conversation_summary = ConversationSummary(
            conversation_uuid=chat.uuid,
            patient_uuid=chat.patient_uuid,
            summary_type="symptom_check",
            chief_complaints=symptom_names[:3],
            symptoms_reported=symptom_names,
            triage_level=triage_level,
            triage_reasons=triage_reasons,
            recommendations=[],
            follow_up_needed=follow_up_needed,
            follow_up_timeframe="immediate" if follow_up_needed else None,
            brief_summary=summaries["bulleted"],
            detailed_summary=summaries["longer"],
        )
        
        self.db.add(conversation_summary)
        self.db.commit()
        self.db.refresh(conversation_summary)
        
        logger.info(
            f"Created conversation summary: {conversation_summary.uuid} "
            f"for patient: {chat.patient_uuid}"
        )
        return conversation_summary
    
    def _save_chat_to_diary(self, chat: ChatModel) -> DiaryEntry:
        """
        Save a symptom check session to the patient's diary.
        
        Args:
            chat: The chat model with symptom check data
            
        Returns:
            The created diary entry
        """
        # Get engine state for summary data
        engine_state = getattr(chat, 'engine_state', {}) or {}
        symptom_list = chat.symptom_list or []
        
        # Use proper symptom names
        symptom_names = [self._get_symptom_name(s) for s in symptom_list]
        symptoms_str = ", ".join(symptom_names) if symptom_names else "No symptoms reported"
        
        # Use the triage level from chat model (set when conversation completes)
        triage_level = chat.triage_level or engine_state.get('highest_triage_level', 'none')
        triage_display = triage_level.replace('_', ' ').title() if triage_level else 'None'
        
        # Create a summary for the diary
        diary_text = f"Symptom Check Summary\n"
        diary_text += f"Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}\n"
        diary_text += f"Symptoms: {symptoms_str}\n"
        diary_text += f"Assessment Level: {triage_display}\n"
        
        # Add completed symptom triage results if available
        triage_results = engine_state.get('triage_results', [])
        if triage_results:
            diary_text += "\nTriage Results:\n"
            for result in triage_results:
                symptom_name = result.get('symptom_name', 'Unknown')
                level = result.get('level', 'unknown')
                diary_text += f"- {symptom_name}: {level.replace('_', ' ').title()}\n"
        
        # Add personal notes if available
        personal_notes = engine_state.get('personal_notes')
        if personal_notes:
            diary_text += f"\nPatient Notes:\n{personal_notes}\n"
        
        # Create diary entry
        diary_entry = DiaryEntry(
            patient_uuid=chat.patient_uuid,
            diary_entry=diary_text,
            marked_for_doctor=(triage_level in ['call_911', 'urgent', 'same_day', 'notify_care_team']),
        )
        
        self.db.add(diary_entry)
        self.db.commit()
        self.db.refresh(diary_entry)
        
        logger.info(f"Created diary entry: {diary_entry.entry_uuid} for patient: {chat.patient_uuid}")
        return diary_entry

    # =========================================================================
    # WebSocket Helpers
    # =========================================================================
    
    def get_connection_ack(self, chat_uuid: UUID) -> ConnectionEstablished:
        """Get connection acknowledgment message."""
        return ConnectionEstablished(
            content="Connection established successfully.",
            chat_state={
                "chat_uuid": str(chat_uuid),
                "status": "connected",
            },
        )

