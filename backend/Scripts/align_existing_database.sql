SET XACT_ABORT ON;
BEGIN TRANSACTION;
BEGIN TRY
    IF COL_LENGTH('dbo.AnnotationSessions', 'Status') IS NULL
        ALTER TABLE dbo.AnnotationSessions ADD Status int NOT NULL CONSTRAINT DF_AnnotationSessions_Status DEFAULT (0);
    IF COL_LENGTH('dbo.SegmentResponses', 'StartTime') IS NULL
        ALTER TABLE dbo.SegmentResponses ADD StartTime time NOT NULL CONSTRAINT DF_SegmentResponses_StartTime DEFAULT ('00:00:00');
    IF COL_LENGTH('dbo.SegmentResponses', 'EndTime') IS NULL
        ALTER TABLE dbo.SegmentResponses ADD EndTime time NOT NULL CONSTRAINT DF_SegmentResponses_EndTime DEFAULT ('00:00:00');

    ALTER TABLE dbo.Admins ALTER COLUMN Username nvarchar(200) NOT NULL;
    ALTER TABLE dbo.Admins ALTER COLUMN Email nvarchar(320) NOT NULL;
    ALTER TABLE dbo.Annotators ALTER COLUMN Username nvarchar(200) NOT NULL;
    ALTER TABLE dbo.Annotators ALTER COLUMN Email nvarchar(320) NOT NULL;
    ALTER TABLE dbo.Annotators ALTER COLUMN Gender nvarchar(50) NOT NULL;

    IF OBJECT_ID('dbo.DF_AnnotationSessions_AssignedAt', 'D') IS NOT NULL
        ALTER TABLE dbo.AnnotationSessions DROP CONSTRAINT DF_AnnotationSessions_AssignedAt;
    IF OBJECT_ID('dbo.CK_AnnotationSessions_ExpiresAt', 'C') IS NOT NULL
        ALTER TABLE dbo.AnnotationSessions DROP CONSTRAINT CK_AnnotationSessions_ExpiresAt;
    ALTER TABLE dbo.AnnotationSessions ALTER COLUMN AssignedAt datetimeoffset NOT NULL;
    ALTER TABLE dbo.AnnotationSessions ALTER COLUMN ExpiresAt datetimeoffset NOT NULL;
    ALTER TABLE dbo.AnnotationSessions ADD CONSTRAINT DF_AnnotationSessions_AssignedAt DEFAULT (sysdatetimeoffset()) FOR AssignedAt;
    ALTER TABLE dbo.AnnotationSessions ADD CONSTRAINT CK_AnnotationSessions_ExpiresAt CHECK (ExpiresAt > AssignedAt);

    IF OBJECT_ID('dbo.DF_SegmentResponses_SubmittedAt', 'D') IS NOT NULL
        ALTER TABLE dbo.SegmentResponses DROP CONSTRAINT DF_SegmentResponses_SubmittedAt;
    ALTER TABLE dbo.SegmentResponses ALTER COLUMN SubmittedAt datetimeoffset NOT NULL;
    ALTER TABLE dbo.SegmentResponses ADD CONSTRAINT DF_SegmentResponses_SubmittedAt DEFAULT (sysdatetimeoffset()) FOR SubmittedAt;

    IF OBJECT_ID('dbo.DF_Videos_UploadedAt', 'D') IS NOT NULL
        ALTER TABLE dbo.Videos DROP CONSTRAINT DF_Videos_UploadedAt;
    ALTER TABLE dbo.Videos ALTER COLUMN UploadedAt datetimeoffset NOT NULL;
    ALTER TABLE dbo.Videos ADD CONSTRAINT DF_Videos_UploadedAt DEFAULT (sysdatetimeoffset()) FOR UploadedAt;

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.QuestionAnswers') AND name='PK_QuestionAnswers')
        ALTER TABLE dbo.QuestionAnswers DROP CONSTRAINT PK_QuestionAnswers;
    IF OBJECT_ID('dbo.CK_QuestionAnswers_QuestionNumber', 'C') IS NOT NULL
        ALTER TABLE dbo.QuestionAnswers DROP CONSTRAINT CK_QuestionAnswers_QuestionNumber;
    ALTER TABLE dbo.QuestionAnswers ALTER COLUMN QuestionNumber int NOT NULL;
    ALTER TABLE dbo.QuestionAnswers ADD CONSTRAINT PK_QuestionAnswers PRIMARY KEY (SegmentResponseId, QuestionNumber);
    ALTER TABLE dbo.QuestionAnswers ADD CONSTRAINT CK_QuestionAnswers_QuestionNumber CHECK (QuestionNumber >= 1 AND QuestionNumber <= 5);

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.SegmentResponses') AND name='UQ_SegmentResponses_Session_Segment')
        ALTER TABLE dbo.SegmentResponses DROP CONSTRAINT UQ_SegmentResponses_Session_Segment;
    IF OBJECT_ID('dbo.CK_SegmentResponses_SegmentNumber', 'C') IS NOT NULL
        ALTER TABLE dbo.SegmentResponses DROP CONSTRAINT CK_SegmentResponses_SegmentNumber;
    ALTER TABLE dbo.SegmentResponses ALTER COLUMN SegmentNumber int NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.SegmentResponses') AND name='IX_SegmentResponses_AnnotationSessionId_SegmentNumber')
        CREATE UNIQUE INDEX IX_SegmentResponses_AnnotationSessionId_SegmentNumber ON dbo.SegmentResponses(AnnotationSessionId, SegmentNumber);
    ALTER TABLE dbo.SegmentResponses ADD CONSTRAINT CK_SegmentResponses_SegmentNumber CHECK (SegmentNumber >= 1 AND SegmentNumber <= 3);

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Videos') AND name='UQ_Videos_StoragePath')
        ALTER TABLE dbo.Videos DROP CONSTRAINT UQ_Videos_StoragePath;
    ALTER TABLE dbo.Videos ALTER COLUMN StoragePath nvarchar(2048) NOT NULL;

    IF OBJECT_ID(N'dbo.__EFMigrationsHistory', N'U') IS NULL
        CREATE TABLE dbo.__EFMigrationsHistory (
            MigrationId nvarchar(150) NOT NULL CONSTRAINT PK___EFMigrationsHistory PRIMARY KEY,
            ProductVersion nvarchar(32) NOT NULL
        );

    IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId='20260811183506_InitialCreate')
        INSERT dbo.__EFMigrationsHistory VALUES ('20260811183506_InitialCreate','10.0.11');
    IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId='20260814104613_AddStatusAndTimestamps')
        INSERT dbo.__EFMigrationsHistory VALUES ('20260814104613_AddStatusAndTimestamps','10.0.11');
    IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId='20260814155217_AddUniqueUsernames')
        INSERT dbo.__EFMigrationsHistory VALUES ('20260814155217_AddUniqueUsernames','10.0.11');
    IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId='20260814162418_MapUsernameColumns')
        INSERT dbo.__EFMigrationsHistory VALUES ('20260814162418_MapUsernameColumns','10.0.11');

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
