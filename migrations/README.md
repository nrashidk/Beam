# Database Migrations

This folder contains SQL migration files used to initialize and update the Neon PostgreSQL database for this project.  
All migrations are written in raw SQL and executed using SQLAlchemy (no external drivers required).

---

## 📂 Folder Structure

migrations/
│
├── 2025_01_001_init_schema.sql
├── run_migration_sqlalchemy.py
└── README.md

---

## 📄 Migration Files

### 2025_01_001_init_schema.sql
Initial schema migration containing:

- All tables  
- ENUM types  
- Foreign key constraints  
- Indexes  
- Default values  
- Relationships  

This file must be executed on a fresh Neon database.

---

## 🐍 Migration Runner Script

### run_migration_sqlalchemy.py
Runs the SQL migration using SQLAlchemy.

- No `psycopg` required  
- Executes the SQL file inside a transaction  
- Commits on success, rolls back on failure  

---

# 🚀 How to Run Migrations

## 1️⃣ Install dependencies

SQLAlchemy is already installed in the project.  
If needed:

```
pip install sqlalchemy
```

---

## 2️⃣ Set the Neon database URL

Neon requires SSL.  
Append `?sslmode=require` to your connection string.

### Linux / MacOS:
```
export DATABASE_URL="postgresql://xxx:xxxx@ep-host.ap-south-1.aws.neon.tech/neondb?sslmode=require"
```

### Windows (PowerShell):
```
setx DATABASE_URL "postgresql://xxx:xxxx@ep-host.ap-south-1.aws.neon.tech/neondb?sslmode=require"
```

---

## 3️⃣ Run the migration

From the project root directory:

```
python migrations/run_migration_sqlalchemy.py
```

Expected output:

```
Running migration with SQLAlchemy...
Migration completed successfully.
```

---

# 🛠 Troubleshooting

### 🔹 Missing DATABASE_URL

If you see:

```
Please set DATABASE_URL environment variable.
```

You must export the variable as shown above.

---

### 🔹 SSL Error on Neon

Always include:

```
?sslmode=require
```

---

### 🔹 Permission Issues

Ensure your Neon user has:

- CREATE  
- ALTER  
- INSERT  
- UPDATE  
- DELETE  

---


