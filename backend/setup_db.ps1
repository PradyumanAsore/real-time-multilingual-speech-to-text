#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Creates the PostgreSQL user and database for the Speech-to-Text app.

.DESCRIPTION
  Run this once before running Alembic migrations.
  It connects to PostgreSQL as the 'postgres' superuser and creates:
    - Role: speech_user (password: speech_password)
    - Database: speech_db

.EXAMPLE
  .\setup_db.ps1
  .\setup_db.ps1 -PostgresPassword "myAdminPass"
#>

param(
  [string]$PostgresPassword = "",
  [string]$PgHost = "localhost",
  [string]$PgPort = "5432"
)

$pg = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
# Fallback to other versions
foreach ($v in @(16, 15, 14)) {
  if (-not (Test-Path $pg)) {
    $pg = "C:\Program Files\PostgreSQL\$v\bin\psql.exe"
  }
}

if (-not (Test-Path $pg)) {
  Write-Error "psql.exe not found. Make sure PostgreSQL is installed."
  exit 1
}

if (-not $PostgresPassword) {
  $securePass = Read-Host "Enter PostgreSQL 'postgres' superuser password" -AsSecureString
  $PostgresPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
  )
}

$env:PGPASSWORD = $PostgresPassword

Write-Host "`n[1/4] Testing connection to PostgreSQL as postgres..." -ForegroundColor Cyan
$testResult = & $pg -U postgres -h $PgHost -p $PgPort -c "SELECT version();" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Error "Cannot connect as postgres: $testResult"
  Write-Host "`nTip: Make sure PostgreSQL is running and the password is correct." -ForegroundColor Yellow
  exit 1
}
Write-Host "     Connected OK." -ForegroundColor Green

Write-Host "[2/4] Creating role 'speech_user'..." -ForegroundColor Cyan
$sql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'speech_user') THEN
    CREATE ROLE speech_user LOGIN PASSWORD 'speech_password';
    RAISE NOTICE 'speech_user created.';
  ELSE
    ALTER ROLE speech_user WITH LOGIN PASSWORD 'speech_password';
    RAISE NOTICE 'speech_user already exists – password refreshed.';
  END IF;
END
`$`$;
"@
& $pg -U postgres -h $PgHost -p $PgPort -c $sql
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create role."; exit 1 }

Write-Host "[3/4] Creating database 'speech_db'..." -ForegroundColor Cyan
# Check if db exists first
$dbExists = & $pg -U postgres -h $PgHost -p $PgPort -tAc "SELECT 1 FROM pg_database WHERE datname='speech_db';"
if ($dbExists -eq "1") {
  Write-Host "     Database 'speech_db' already exists – skipping." -ForegroundColor Yellow
} else {
  & $pg -U postgres -h $PgHost -p $PgPort -c "CREATE DATABASE speech_db OWNER speech_user;"
  if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create database."; exit 1 }
  Write-Host "     Database created." -ForegroundColor Green
}

Write-Host "[4/4] Granting privileges..." -ForegroundColor Cyan
& $pg -U postgres -h $PgHost -p $PgPort -c "GRANT ALL PRIVILEGES ON DATABASE speech_db TO speech_user;"

Write-Host "`n✅ Database setup complete!" -ForegroundColor Green
Write-Host "   User:     speech_user"
Write-Host "   Password: speech_password"
Write-Host "   Database: speech_db"
Write-Host "   Host:     $PgHost`:$PgPort"
Write-Host "`nNext step: run Alembic migrations"
Write-Host "   cd backend"
Write-Host "   .venv\Scripts\activate"
Write-Host "   alembic upgrade head`n"
