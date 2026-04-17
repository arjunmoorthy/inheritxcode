"""
Chat/Symptom Checker Endpoints - Patient API
=============================================

Complete endpoints for the symptom checker chat:
- GET /session/today: Get or create today's session
- POST /session/new: Start a new check-in (fresh conversation; chemo skipped if already answered today)
- GET /{chat_uuid}/full: Get full chat history
- GET /{chat_uuid}/state: Get chat state
- POST /{chat_uuid}/feeling: Update overall feeling
- DELETE /{chat_uuid}: Delete chat
- WebSocket /ws/{chat_uuid}: Real-time messaging
"""

import json
import os
from uuid import UUID
from typing import List, Optional, Literal
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import jwt, JWTError
import pytz

from api.deps import get_patient_db, get_optional_patient_uuid
from services import ChatService
from db.patient_models import Conversations as ChatModel
from db.patient_models import Messages as MessageModel
from routers.auth.dependencies import _get_jwks, TokenData
from routers.chat.models import (
    WebSocketMessageIn, Message, FullChatResponse, 
    ChatStateResponse, TodaySessionResponse, LastQuestionForUndo
)
from utils.timezone_utils import utc_to_user_timezone
from core.logging import get_logger
from core.exceptions import NotFoundError
from core import settings

logger = get_logger(__name__)

router = APIRouter()

# Local dev mode test patient UUID
LOCAL_DEV_PATIENT_UUID = "11111111-1111-1111-1111-111111111111"


def _validate_uuid(value: str) -> str:
    """Validate UUID format; raise 400 if invalid."""
    try:
        UUID(value)
        return value
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="patient_uuid must be a valid UUID (e.g. 11111111-1111-1111-1111-111111111111)"
        )


def get_patient_uuid_with_fallback(patient_uuid: Optional[str]) -> str:
    """Get patient UUID from query param, falling back to test UUID in local dev mode."""
    if patient_uuid:
        return _validate_uuid(patient_uuid)
    if settings.local_dev_mode:
        return LOCAL_DEV_PATIENT_UUID
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="patient_uuid is required"
    )


def resolve_patient_uuid(
    patient_uuid: Optional[str],
    auth_uuid: Optional[UUID],
) -> str:
    """
    Resolve patient_uuid for chat: prefer JWT sub (e.g. from doctor-api login)
    so fax patients can use chat after logging in. Fall back to query param or local dev default.
    """
    if auth_uuid is not None:
        logger.info("Chat patient_uuid from Bearer token (sub): %s", auth_uuid)
        return str(auth_uuid)
    resolved = get_patient_uuid_with_fallback(patient_uuid)
    logger.info(
        "Chat patient_uuid from fallback (query param or local dev default): %s",
        resolved,
    )
    return resolved


# =============================================================================
# Request/Response Schemas
# =============================================================================

class OverallFeelingUpdate(BaseModel):
    """Request model for updating overall feeling."""
    feeling: Literal['Very Happy', 'Happy', 'Neutral', 'Bad', 'Very Bad']


# =============================================================================
# Helper Functions
# =============================================================================

def convert_message_for_frontend(message: Message) -> Message:
    """Convert message types from underscore to hyphen for frontend."""
    if hasattr(message, 'message_type') and isinstance(message.message_type, str):
        message.message_type = message.message_type.replace('_', '-')
    return message


def convert_chat_to_user_timezone(chat, messages, user_timezone: str = "America/Los_Angeles"):
    """Convert chat and message timestamps to user timezone."""
    if chat.created_at:
        chat.created_at = utc_to_user_timezone(chat.created_at, user_timezone)
    if chat.updated_at:
        chat.updated_at = utc_to_user_timezone(chat.updated_at, user_timezone)
    
    for message in messages:
        if message.created_at:
            message.created_at = utc_to_user_timezone(message.created_at, user_timezone)
    
    return chat, messages


def extract_last_question_for_undo(messages: List[Message]) -> Optional[LastQuestionForUndo]:
    """
    Find the latest assistant prompt that can be restored for "go back one step".
    """
    prompt_frontend_types = {
        "disclaimer",
        "emergency-check",
        "symptom-select",
        "single-select",
        "multi-select",
        "next-chemo-date",
    }

    for message in reversed(messages):
        if message.sender != "assistant":
            continue

        structured = message.structured_data or {}
        frontend_type = str(structured.get("frontend_type", "")).replace("_", "-")
        has_options = bool(structured.get("options") or structured.get("options_data"))
        is_prompt = has_options or message.message_type in {"single-select", "multi-select"} or frontend_type in prompt_frontend_types

        if is_prompt:
            return LastQuestionForUndo(
                message_id=message.id,
                message_type=message.message_type,
                content=message.content,
                structured_data=structured,
            )

    return None


def inject_session_controls_into_latest_assistant_message(
    messages: List[Message],
    session_entry_action: str,
    can_undo_last_step: bool,
) -> None:
    """
    Add session control hints into the most recent assistant message payload.
    """
    for message in reversed(messages):
        if message.sender != "assistant":
            continue
        structured = dict(message.structured_data or {})
        structured["session_entry_action"] = session_entry_action
        structured["can_undo_last_step"] = can_undo_last_step
        message.structured_data = structured
        return


def _is_session_active(conversation_state: Optional[str]) -> bool:
    state = (conversation_state or "").strip().lower()
    return state not in {"completed", "emergency"}


async def get_user_from_token(token: str) -> Optional[TokenData]:
    """Validate JWT token from WebSocket (Cognito or doctor-api symmetric JWT)."""
    if not token:
        return None
    
    # Local dev mode bypass - accept fake dev tokens
    if settings.local_dev_mode:
        if token.startswith("dev-mode-token-"):
            return TokenData(sub=LOCAL_DEV_PATIENT_UUID, email="dev@oncolife.local")
    
    # Try symmetric JWT first (doctor-api / fax patient token) so we don't hit Cognito when not configured
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub")
        if user_id:
            return TokenData(sub=user_id, email=payload.get("email"))
    except JWTError:
        pass
    
    # Then try Cognito only if configured (avoid _get_jwks() when AWS_REGION/COGNITO_USER_POOL_ID are missing)
    region = os.getenv("AWS_REGION")
    user_pool_id = os.getenv("COGNITO_USER_POOL_ID")
    if region and user_pool_id:
        try:
            jwks = _get_jwks()
            unverified_header = jwt.get_unverified_header(token)
            rsa_key = {}
            for key in jwks.get("keys", []):
                if key.get("kid") == unverified_header.get("kid"):
                    rsa_key = {
                        "kty": key["kty"], "kid": key["kid"], "use": key["use"],
                        "n": key["n"], "e": key["e"]
                    }
                    break
            if not rsa_key:
                return None
            issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
            client_id = os.getenv("COGNITO_CLIENT_ID")
            claims = jwt.get_unverified_claims(token)
            token_use = claims.get("token_use")
            if token_use == "access":
                payload = jwt.decode(
                    token, rsa_key, algorithms=["RS256"],
                    issuer=issuer, options={"verify_aud": False}
                )
                if client_id and payload.get("client_id") != client_id:
                    return None
            else:
                payload = jwt.decode(
                    token, rsa_key, algorithms=["RS256"],
                    audience=client_id, issuer=issuer
                )
            user_id = payload.get("sub")
            if user_id:
                return TokenData(sub=user_id, email=payload.get("email"))
        except JWTError:
            pass
        except Exception:
            pass  # e.g. JWKS fetch failed; already tried symmetric above
    
    return None


# =============================================================================
# REST Endpoints
# =============================================================================

@router.get(
    "/session/today",
    response_model=TodaySessionResponse,
    summary="Get or create today's session",
    description="Fetch the most recent chat for today, or create one."
)
def get_or_create_session(
    db: Session = Depends(get_patient_db),
    patient_uuid: Optional[str] = Query(default=None, description="Patient UUID (optional if Bearer token from doctor-api login)"),
    timezone: str = Query(default="America/Los_Angeles", description="User's timezone"),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    Primary endpoint for starting or resuming a conversation.
    
    If no chat exists for today, creates a new one and returns
    its first message. If a chat exists, returns its full history.
    When the request has a valid Bearer token (e.g. from doctor-api login), patient_uuid is taken from the token.
    """
    patient_uuid = resolve_patient_uuid(patient_uuid, auth_uuid)
    
    logger.info(f"Get/create session: patient={patient_uuid} tz={timezone}")
    
    chat_service = ChatService(db)
    
    try:
        chat, messages, is_new = chat_service.get_or_create_today_session(
            UUID(patient_uuid), timezone
        )
    except Exception as e:
        logger.error(f"Session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # Convert messages to Pydantic models
    pydantic_messages = [convert_message_for_frontend(Message.from_orm(msg)) for msg in messages]
    
    # Convert timestamps
    convert_chat_to_user_timezone(chat, pydantic_messages, timezone)
    
    logger.info(f"Session: chat={chat.uuid} is_new={is_new} messages={len(messages)}")

    last_question_for_undo = None
    if not is_new:
        last_question_for_undo = extract_last_question_for_undo(pydantic_messages)
    session_entry_action = "show_new_checkin" if is_new else "show_undo_last_step"
    can_undo_last_step = _is_session_active(getattr(chat, "conversation_state", None))
    inject_session_controls_into_latest_assistant_message(
        pydantic_messages,
        session_entry_action=session_entry_action,
        can_undo_last_step=can_undo_last_step,
    )
    
    return TodaySessionResponse(
        chat_uuid=chat.uuid,
        conversation_state=chat.conversation_state,
        messages=pydantic_messages,
        is_new_session=is_new,
        symptom_list=chat.symptom_list or [],
        session_entry_action=session_entry_action,
        can_undo_last_step=can_undo_last_step,
        last_question_for_undo=last_question_for_undo,
    )


@router.post(
    "/session/new",
    response_model=TodaySessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new check-in (fresh conversation)",
    description="Creates a new chat and starts from the beginning (disclaimer). Chemo question is skipped if already answered today in another check-in."
)
def force_create_new_session(
    db: Session = Depends(get_patient_db),
    patient_uuid: Optional[str] = Query(default=None, description="Patient UUID (optional if Bearer token)"),
    timezone: str = Query(default="America/Los_Angeles", description="User's timezone"),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    Start a new check-in: creates a new chat and returns the first message (disclaimer).
    If the patient already answered the chemotherapy question today, that answer is
    reused so the chemo question is not asked again in this new check-in.
    """
    patient_uuid = resolve_patient_uuid(patient_uuid, auth_uuid)
    
    logger.info(f"Force new session: patient={patient_uuid}")

    chat_service = ChatService(db)
    chat, initial_question = chat_service.create_chat(UUID(patient_uuid), user_timezone=timezone)

    first_message = MessageModel(
        chat_uuid=chat.uuid,
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
    db.add(first_message)
    db.commit()
    db.refresh(first_message)

    pydantic_messages = [convert_message_for_frontend(Message.from_orm(first_message))]
    convert_chat_to_user_timezone(chat, pydantic_messages, timezone)
    inject_session_controls_into_latest_assistant_message(
        pydantic_messages,
        session_entry_action="show_new_checkin",
        can_undo_last_step=True,
    )

    logger.info(f"New check-in created: chat={chat.uuid}")

    return TodaySessionResponse(
        chat_uuid=chat.uuid,
        conversation_state=chat.conversation_state,
        messages=pydantic_messages,
        is_new_session=True,
        symptom_list=chat.symptom_list or [],
        session_entry_action="show_new_checkin",
        can_undo_last_step=True,
        last_question_for_undo=None,
    )

    # existing_chats = db.query(ChatModel).filter(
    #     ChatModel.patient_uuid == UUID(patient_uuid),
    #     # ChatModel.created_at >= utc_today_start,
    #     # ChatModel.created_at <= utc_today_end,
    #     ChatModel.is_complete == "false"
    # ).all()
    
    # for chat in existing_chats:
    #     chat.is_complete = True
    # db.commit()
    
    # # Create new session
    # chat_service = ChatService(db)
    # # chat, messages, is_new = chat_service.get_or_create_today_session(
    # #     UUID(patient_uuid), timezone
    # # )
    # chat, initial_question = chat_service.create_chat(patient_uuid)

    # first_message = MessageModel(
    #     chat_uuid=chat.uuid,
    #     sender="assistant",
    #     message_type=initial_question["type"],
    #     content=initial_question["text"],
    #     structured_data={
    #         "options": initial_question.get("options", []),
    #         "options_data": initial_question.get("options_data", []),
    #         "frontend_type": initial_question.get("frontend_type", "text"),
    #         "symptom_groups": initial_question.get("symptom_groups"),
    #         "summary_data": initial_question.get("summary_data"),
    #         "sender": initial_question.get("sender"),
    #     },
    # )

    # db.add(first_message)
    # db.commit()
    # db.refresh(first_message)

    # messages = [first_message]

    # # ---------------------------------------------------------------------
    # # Step 4: Convert messages for frontend
    # # ---------------------------------------------------------------------
    # pydantic_messages = [
    #     convert_message_for_frontend(Message.from_orm(first_message))
    # ]

    # convert_chat_to_user_timezone(chat, pydantic_messages, timezone)

    # logger.info(f"New session created: chat={chat.uuid}")

    # # ---------------------------------------------------------------------
    # # Step 5: Return response
    # # ---------------------------------------------------------------------
    # return TodaySessionResponse(
    #     chat_uuid=chat.uuid,
    #     conversation_state=chat.conversation_state,
    #     messages=pydantic_messages,
    #     is_new_session=True,
    #     symptom_list=chat.symptom_list or [],
    # )
    
    # pydantic_messages = [convert_message_for_frontend(Message.from_orm(msg)) for msg in messages]
    # convert_chat_to_user_timezone(chat, pydantic_messages, timezone)
    
    # return TodaySessionResponse(
    #     chat_uuid=chat.uuid,
    #     conversation_state=chat.conversation_state,
    #     messages=pydantic_messages,
    #     is_new_session=is_new,
    #     symptom_list=chat.symptom_list or [],
    # )


@router.get(
    "/{chat_uuid}/full",
    response_model=FullChatResponse,
    summary="Get full chat history",
    description="Fetch entire conversation with all messages."
)
def get_full_chat(
    chat_uuid: UUID,
    db: Session = Depends(get_patient_db),
    patient_uuid: Optional[str] = Query(default=None, description="Patient UUID (optional if Bearer token)"),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    Fetch the entire history of a specific chat.
    
    Useful for rehydrating the UI when a user resumes a conversation.
    """
    patient_uuid = resolve_patient_uuid(patient_uuid, auth_uuid)
    
    chat_service = ChatService(db)
    
    try:
        chat = chat_service.get_chat(chat_uuid, UUID(patient_uuid))
        return FullChatResponse.from_orm(chat)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/{chat_uuid}/state",
    response_model=ChatStateResponse,
    summary="Get chat state",
    description="Get current state without full message history."
)
def get_chat_state(
    chat_uuid: UUID,
    db: Session = Depends(get_patient_db),
    patient_uuid: Optional[str] = Query(default=None, description="Patient UUID (optional if Bearer token)"),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    Quickly retrieve the current state and key data of a chat.
    """
    patient_uuid = resolve_patient_uuid(patient_uuid, auth_uuid)
    
    chat_service = ChatService(db)
    
    try:
        chat = chat_service.get_chat(chat_uuid, UUID(patient_uuid))
        return ChatStateResponse.from_orm(chat)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/{chat_uuid}/feeling",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Update overall feeling",
    description="Update the overall feeling for a chat session."
)
def update_overall_feeling(
    chat_uuid: UUID,
    payload: OverallFeelingUpdate,
    db: Session = Depends(get_patient_db),
    patient_uuid: Optional[str] = Query(default=None, description="Patient UUID (optional if Bearer token)"),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    Update the overall feeling for a chat.
    """
    patient_uuid = resolve_patient_uuid(patient_uuid, auth_uuid)
    
    chat_service = ChatService(db)
    
    try:
        chat_service.update_overall_feeling(chat_uuid, UUID(patient_uuid), payload.feeling)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete(
    "/{chat_uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete chat",
    description="Delete a conversation and all its messages."
)
def delete_chat(
    chat_uuid: UUID,
    db: Session = Depends(get_patient_db),
    patient_uuid: Optional[str] = Query(default=None, description="Patient UUID (optional if Bearer token)"),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    Delete a specific conversation.
    """
    patient_uuid = resolve_patient_uuid(patient_uuid, auth_uuid)
    
    chat_service = ChatService(db)
    
    try:
        chat_service.delete_chat(chat_uuid, UUID(patient_uuid))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# =============================================================================
# WebSocket Endpoint
# =============================================================================

@router.websocket("/ws/{chat_uuid}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_uuid: UUID,
    token: str = Query(...),
    db: Session = Depends(get_patient_db),
):
    """
    Real-time bidirectional communication for chat session.
    
    Authenticated using JWT token from query params.
    """
    # Authenticate
    current_user = await get_user_from_token(token)
    if not current_user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token.")
        return
    
    # Verify chat access
    chat = db.query(ChatModel).filter(
        ChatModel.uuid == chat_uuid,
        ChatModel.patient_uuid == UUID(current_user.sub),
    ).first()
    
    if not chat:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Chat not found.")
        return
    
    await websocket.accept()
    chat_service = ChatService(db)
    
    # Send connection acknowledgment
    ack_message = chat_service.get_connection_ack(chat_uuid)
    if ack_message:
        await websocket.send_text(ack_message.json())
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = WebSocketMessageIn(**json.loads(data))
            
            # Process message through engine
            response_generator = chat_service.process_message_stream(chat_uuid, message_data)
            
            async for chunk in response_generator:
                frontend_chunk = convert_message_for_frontend(chunk)
                json_payload = frontend_chunk.json()
                logger.info(f"WebSocket send: type={getattr(frontend_chunk, 'message_type', 'unknown')}")
                await websocket.send_text(json_payload)
    
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: chat={chat_uuid}")
    except Exception as e:
        logger.error(f"WebSocket error: chat={chat_uuid} error={e}")
        reason = str(e)[:120] + "..." if len(str(e)) > 120 else str(e)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason=reason)
