#!/usr/bin/env python3
"""Idempotently seed local SQL Server development data for Annotate Pro."""
import base64
import hashlib
import os
import pyodbc

CONNECTION_STRING = os.getenv("ANNOTATION_DB_CONNECTION", r"DRIVER={ODBC Driver 18 for SQL Server};SERVER=.\SQLEXPRESS;DATABASE=KitScenesAnnotationDb;Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes")

def password_hash(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000, 32)
    return f"pbkdf2-sha256$120000${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"

def upsert_user(cursor, table, username, email, password, extra_columns="", extra_values=()):
    cursor.execute(f"SELECT Id FROM dbo.{table} WHERE Username = ?", username)
    row = cursor.fetchone()
    if row: return row[0]
    placeholders = ", ".join("?" for _ in range(3 + len(extra_values)))
    cursor.execute(f"INSERT INTO dbo.{table} (Username, Email, PasswordHash{extra_columns}) OUTPUT INSERTED.Id VALUES ({placeholders})", username, email, password_hash(password), *extra_values)
    return cursor.fetchone()[0]

def main():
    with pyodbc.connect(CONNECTION_STRING) as connection:
        cursor = connection.cursor()
        admin_id = upsert_user(cursor, "Admins", "SeedAdmin", "seed.admin@example.com", "Admin123!")
        alice_id = upsert_user(cursor, "Annotators", "SeedAlice", "alice@example.com", "Annotator123!", ", DateOfBirth, Gender, Nationality, HasCompletedSurvey", ("1995-04-12", "Female", "Egypt", True))
        bob_id = upsert_user(cursor, "Annotators", "SeedBob", "bob@example.com", "Annotator123!", ", DateOfBirth, Gender, Nationality, HasCompletedSurvey", ("1990-08-20", "Male", "Germany", False))
        cursor.execute("SELECT 1 FROM dbo.AnnotatorSurveys WHERE AnnotatorId = ?", alice_id)
        if not cursor.fetchone():
            cursor.execute("""INSERT INTO dbo.AnnotatorSurveys (AnnotatorId, Nationality, Gender, Age, HasDriverLicense, YearsOfDrivingExperience, PrimaryDrivingCountry, DrivingFrequency, DrivingScenarioNighttime, DrivingScenarioSnowyWeather, DrivingScenarioHeavyRain, DrivingScenarioConstructionZone, DrivingScenarioNone, HasPriorDatasetAnnotationExperience, HasAccidentsInLastFiveYears, SubmittedAt) VALUES (?, 'Egypt', 'Female', 31, 1, 8, 'Egypt', 'Daily', 1, 0, 1, 1, 0, 1, 0, SYSUTCDATETIME())""", alice_id)
        cursor.execute("SELECT Id FROM dbo.Datasets WHERE Name = 'Seed Dataset'")
        row = cursor.fetchone()
        if row: dataset_id = row[0]
        else:
            cursor.execute("""INSERT INTO dbo.Datasets (Name, DatasetType, ManifestFileName, ManifestPath, IsArchived, CreatedAt) OUTPUT INSERTED.Id VALUES ('Seed Dataset', 'Development', 'seed.json', 'seed/seed.json', 0, SYSDATETIMEOFFSET())""")
            dataset_id = cursor.fetchone()[0]
        cursor.execute("SELECT Id FROM dbo.Videos WHERE DatasetId = ? AND FileName = 'seed-video.mp4'", dataset_id)
        row = cursor.fetchone()
        if row: video_id = row[0]
        else:
            cursor.execute("""INSERT INTO dbo.Videos (DatasetId, FileName, StoragePath, MimeType, FileSizeBytes, ProcessingStatus, ManifestMatched, RequiredAnnotationCount, IsArchived, UploadedByAdminId, UploadedAt) OUTPUT INSERTED.Id VALUES (?, 'seed-video.mp4', 'Storage/Videos/seed-video.mp4', 'video/mp4', 0, 'Ready', 1, 2, 0, ?, SYSDATETIMEOFFSET())""", dataset_id, admin_id)
            video_id = cursor.fetchone()[0]
        cursor.execute("SELECT 1 FROM dbo.AnnotationSessions WHERE AnnotatorId = ? AND VideoId = ?", alice_id, video_id)
        if not cursor.fetchone():
            cursor.execute("INSERT INTO dbo.AnnotationSessions (AnnotatorId, VideoId, Status, AssignedAt, ExpiresAt) VALUES (?, ?, 'Assigned', SYSDATETIMEOFFSET(), DATEADD(day, 7, SYSDATETIMEOFFSET()))", alice_id, video_id)
        connection.commit()
        print(f"Seed complete: admin={admin_id}, completed annotator={alice_id}, pending annotator={bob_id}, video={video_id}")

if __name__ == "__main__": main()
