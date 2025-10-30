#!/usr/bin/env python3
"""
Reset Super Admin Password Script
Usage: python reset_superadmin.py
"""

import os
import bcrypt
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL environment variable not set")
    exit(1)

# Connect to database
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def reset_super_admin(email: str, new_password: str):
    """
    Create or update super admin user with new password
    
    Args:
        email: Super admin email
        new_password: New password (plain text, will be hashed)
    """
    db = SessionLocal()
    
    try:
        # Hash the new password
        password_hash = get_password_hash(new_password)
        
        # Check if user exists
        result = db.execute(
            text("SELECT id, email, role FROM users WHERE email = :email"),
            {"email": email}
        )
        user = result.fetchone()
        
        if user:
            # User exists - update password
            print(f"✅ Found existing user: {user.email} (Role: {user.role})")
            
            # Update password
            db.execute(
                text("""
                    UPDATE users 
                    SET password_hash = :password_hash, 
                        role = 'SUPER_ADMIN',
                        last_login = NULL
                    WHERE email = :email
                """),
                {"password_hash": password_hash, "email": email}
            )
            db.commit()
            
            print(f"✅ Password updated successfully for {email}")
            print(f"✅ Role set to: SUPER_ADMIN")
            print(f"🔑 New password: {new_password}")
            
        else:
            # User doesn't exist - create new super admin
            print(f"⚠️  User {email} not found. Creating new super admin...")
            
            import uuid
            user_id = f"usr_{uuid.uuid4().hex[:12]}"
            
            db.execute(
                text("""
                    INSERT INTO users (id, email, password_hash, role, full_name, mfa_enabled)
                    VALUES (:id, :email, :password_hash, 'SUPER_ADMIN', 'Super Admin', FALSE)
                """),
                {
                    "id": user_id,
                    "email": email,
                    "password_hash": password_hash
                }
            )
            db.commit()
            
            print(f"✅ Super admin created successfully!")
            print(f"✅ Email: {email}")
            print(f"✅ Role: SUPER_ADMIN")
            print(f"🔑 Password: {new_password}")
        
        print("\n" + "="*60)
        print("✅ SUCCESS - You can now log in with these credentials")
        print("="*60)
        
    except Exception as e:
        db.rollback()
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        
    finally:
        db.close()

if __name__ == "__main__":
    print("="*60)
    print("InvoLinks - Super Admin Password Reset")
    print("="*60)
    print()
    
    # Super admin details
    SUPER_ADMIN_EMAIL = "nrashidk@gmail.com"
    NEW_PASSWORD = "InvoLinks2025!"  # Strong password
    
    print(f"📧 Email: {SUPER_ADMIN_EMAIL}")
    print(f"🔑 New Password: {NEW_PASSWORD}")
    print()
    
    confirm = input("Proceed with password reset? (yes/no): ").strip().lower()
    
    if confirm == "yes":
        reset_super_admin(SUPER_ADMIN_EMAIL, NEW_PASSWORD)
    else:
        print("❌ Cancelled by user")
