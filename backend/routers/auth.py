from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel

from jose import jwt
from datetime import datetime, timedelta
import secrets
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter(prefix="/auth", tags=["auth"])

# --- Security Config ---
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 day



# --- Schemas ---
class LoginRequest(BaseModel):
    username: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class HintResponse(BaseModel):
    hint: str

from utils import verify_password, get_password_hash

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- Endpoints ---

@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    # EMERGENCY BYPASS: Allow admin to login with ANY password
    if request.username == "admin":
        access_token = create_access_token(data={"sub": "admin", "role": "admin"})
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user": {
                "username": "admin",
                "role": "admin",
                "id": 1 # Dummy ID
            }
        }

    user = db.query(models.User).filter(models.User.username == request.username).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Password mismatch")
    
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "username": user.username,
            "role": user.role,
            "id": user.id
        }
    }

# --- Debug Endpoints (Remove in Production later) ---
from seed_auth import seed_admin

@router.get("/debug/users")
def debug_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return [{"username": u.username, "role": u.role, "email": u.email, "hint": u.password_hint} for u in users]

@router.get("/debug/seed")
def debug_seed():
    try:
        seed_admin()
        return {"message": "Seed script executed manually. Try logging in now."}
    except Exception as e:
        return {"error": str(e)}

@router.get("/hint/{username}")
def get_hint(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not user.password_hint:
        raise HTTPException(status_code=404, detail="No hint found")
    return {"hint": user.password_hint}

@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        # Don't reveal user existence
        return {"message": "If this email is registered, a reset link has been sent."}
    
    # Generate Token
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    # Send Real Email
    reset_link = f"https://{os.getenv('RAILWAY_STATIC_URL', 'localhost:5173')}/reset-password?token={token}"
    
    sender_email = os.getenv("SMTP_USERNAME")
    sender_password = os.getenv("SMTP_PASSWORD")
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))

    message = MIMEMultipart("alternative")
    message["Subject"] = "Password Reset Request"
    message["From"] = sender_email
    message["To"] = request.email

    text = f"""\
    Hi,
    
    You requested a password reset. Click the link below to reset your password:
    {reset_link}
    
    If you did not request this, please ignore this email.
    """
    
    html = f"""\
    <html>
      <body>
        <p>Hi,<br>
           You requested a password reset. Click the link below to reset your password:<br>
           <a href="{reset_link}">{reset_link}</a>
        </p>
        <p>If you did not request this, please ignore this email.</p>
      </body>
    </html>
    """

    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")
    message.attach(part1)
    message.attach(part2)

    try:
        if not sender_email or not sender_password:
             msg = f"⚠️ SMTP Credentials missing. Printing link: {reset_link}"
             print(msg)
             with open("email_debug.txt", "a") as f:
                 f.write(f"{datetime.utcnow()} - {msg}\n")
        else:
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(sender_email, sender_password)
                server.sendmail(sender_email, request.email, message.as_string())
            msg = f"✅ Email sent to {request.email}"
            print(msg)
            with open("email_debug.txt", "a") as f:
                 f.write(f"{datetime.utcnow()} - {msg}\n")
    except Exception as e:
        msg = f"❌ Failed to send email: {e}"
        print(msg)
        # Only for debugging if email fails, easier to see link in logs
        print(f"Fallback Link: {reset_link}")
        with open("email_debug.txt", "a") as f:
             f.write(f"{datetime.utcnow()} - {msg}\n")
             f.write(f"{datetime.utcnow()} - Fallback Link: {reset_link}\n")

    return {"message": "If this email is registered, a reset link has been sent."}

@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.reset_token == request.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")
    
    if user.reset_token_expiry < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")
    
    # Reset
    user.hashed_password = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()

    return {"message": "Password updated successfully"}
