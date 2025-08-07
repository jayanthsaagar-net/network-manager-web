@echo off
setlocal ENABLEDELAYEDEXPANSION

:: Step 1: Check Docker installation
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo Docker is not installed. Please install Docker Desktop manually from:
    echo https://www.docker.com/products/docker-desktop/
    pause
    exit /b
)

:: Step 2: Start Docker Desktop (if not already running)
echo Checking if Docker Desktop is running...
tasklist /FI "IMAGENAME eq Docker Desktop.exe" | find /I "Docker Desktop.exe" >nul
if %errorlevel% neq 0 (
    echo Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker to start...
    timeout /t 20
)

:: Step 3: Prompt for MongoDB backup or restore
echo.
echo Choose an option:
echo [1] Start application
echo [2] Backup MongoDB database
echo [3] Restore MongoDB database
set /p option=Enter your choice: 

if "%option%"=="2" goto backup
if "%option%"=="3" goto restore

:: Step 4: Start the Docker containers
echo Starting the application with Docker Compose...
docker-compose up --build -d

echo Application is running.
goto end

:backup
echo Backing up MongoDB database...
mkdir backups 2>nul
docker exec netman_mongo sh -c "mongodump --username root --password example --authenticationDatabase admin --out /data/db/backup"
docker cp netman_mongo:/data/db/backup ./backups
echo Backup completed. Files saved in 'backups\' folder.
goto end

:restore
echo Restoring MongoDB database from latest backup...
set /p backup_folder=Enter the backup folder name inside 'backups\': 
if not exist backups\%backup_folder%\ (
    echo Folder not found.
    goto end
)
docker cp backups\%backup_folder% netman_mongo:/data/db/restore
docker exec netman_mongo sh -c "mongorestore --username root --password example --authenticationDatabase admin /data/db/restore"
echo Restore completed.
goto end

:end
pause
exit /b
