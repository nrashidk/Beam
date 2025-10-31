#!/usr/bin/env python3
"""
One-time script to restore SUPER_ADMIN role on production database
Run this directly against the production database to fix the admin account.
"""
import os
import bcrypt
from sqlalchemy import create_engine, text

# Use production database URL
DATABASE_URL = os.getenv("DATABASE_URL")

def restore_superadmin():
    """Restore SUPER_ADMIN role for the admin email"""
    engine = create_engine(DATABASE_URL)
    
    super_admin_email = "nrashidk@gmail.com"
    super_admin_password = "AbuDhabi@123"
    
    # Hash the password
    password_hash = bcrypt.hashpw(super_admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    with engine.connect() as conn:
        # Check if user exists
        result = conn.execute(
            text("SELECT id, role, email FROM users WHERE email = :email"),
            {"email": super_admin_email}
        )
        user = result.fetchone()
        
        if user:
            print(f"Found user: {user.email} with role: {user.role}")
            
            # Update to SUPER_ADMIN
            conn.execute(
                text("""
                    UPDATE users 
                    SET role = 'SUPER_ADMIN',
                        password_hash = :password_hash,
                        company_id = NULL,
                        is_owner = FALSE
                    WHERE email = :email
                """),
                {"password_hash": password_hash, "email": super_admin_email}
            )
            conn.commit()
            print(f"✅ Successfully restored SUPER_ADMIN role for {super_admin_email}")
            print(f"✅ Password reset to: AbuDhabi@123")
        else:
            print(f"❌ User not found: {super_admin_email}")
            print("Creating new SUPER_ADMIN user...")
            
            import uuid
            user_id = f"user_{uuid.uuid4().hex[:8]}"
            
            conn.execute(
                text("""
                    INSERT INTO users (id, email, password_hash, role, company_id, is_owner, full_name)
                    VALUES (:id, :email, :password_hash, 'SUPER_ADMIN', NULL, FALSE, 'Super Admin')
                """),
                {
                    "id": user_id,
                    "email": super_admin_email,
                    "password_hash": password_hash
                }
            )
            conn.commit()
            print(f"✅ Created SUPER_ADMIN user: {super_admin_email}")

if __name__ == "__main__":
    print("🔧 Restoring SUPER_ADMIN role...")
    restore_superadmin()
    print("\n✅ Done! You can now login as Super Admin on involinks.ae")
    print(f"   Email: nrashidk@gmail.com")
    print(f"   Password: AbuDhabi@123")
