using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Context.Migrations
{
    /// <inheritdoc />
    public partial class AddDatasetQuotaAndSessionLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AnnotationSessions_AnnotatorId",
                table: "AnnotationSessions");

            migrationBuilder.DropIndex(
                name: "IX_AnnotationSessions_VideoId",
                table: "AnnotationSessions");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ArchivedAt",
                table: "Videos",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DatasetId",
                table: "Videos",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "Videos",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "RequiredAnnotationCount",
                table: "Videos",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CancelledAt",
                table: "AnnotationSessions",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CompletedAt",
                table: "AnnotationSessions",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StartedAt",
                table: "AnnotationSessions",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "AnnotationSessions",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Assigned");

            migrationBuilder.CreateTable(
                name: "Datasets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DatasetType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ManifestFileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: false),
                    ManifestPath = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: false),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ArchivedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Datasets", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Videos_DatasetId",
                table: "Videos",
                column: "DatasetId");

            migrationBuilder.CreateIndex(
                name: "IX_Videos_IsArchived",
                table: "Videos",
                column: "IsArchived");

            migrationBuilder.CreateIndex(
                name: "IX_Videos_IsArchived_ProcessingStatus",
                table: "Videos",
                columns: new[] { "IsArchived", "ProcessingStatus" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Videos_RequiredAnnotationCount_Positive",
                table: "Videos",
                sql: "[RequiredAnnotationCount] >= 1");

            migrationBuilder.CreateIndex(
                name: "IX_AnnotationSessions_AnnotatorId_Status",
                table: "AnnotationSessions",
                columns: new[] { "AnnotatorId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_AnnotationSessions_Status",
                table: "AnnotationSessions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_AnnotationSessions_VideoId_Status",
                table: "AnnotationSessions",
                columns: new[] { "VideoId", "Status" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_AnnotationSessions_ExpiryAfterAssignment",
                table: "AnnotationSessions",
                sql: "[ExpiresAt] > [AssignedAt]");

            migrationBuilder.AddCheckConstraint(
                name: "CK_AnnotationSessions_Status",
                table: "AnnotationSessions",
                sql: "[Status] IN ('Assigned', 'InProgress', 'Completed', 'Expired', 'Cancelled')");

            migrationBuilder.CreateIndex(
                name: "IX_Datasets_IsArchived",
                table: "Datasets",
                column: "IsArchived");

            migrationBuilder.CreateIndex(
                name: "IX_Datasets_Name",
                table: "Datasets",
                column: "Name");

            migrationBuilder.AddForeignKey(
                name: "FK_Videos_Datasets_DatasetId",
                table: "Videos",
                column: "DatasetId",
                principalTable: "Datasets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Videos_Datasets_DatasetId",
                table: "Videos");

            migrationBuilder.DropTable(
                name: "Datasets");

            migrationBuilder.DropIndex(
                name: "IX_Videos_DatasetId",
                table: "Videos");

            migrationBuilder.DropIndex(
                name: "IX_Videos_IsArchived",
                table: "Videos");

            migrationBuilder.DropIndex(
                name: "IX_Videos_IsArchived_ProcessingStatus",
                table: "Videos");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Videos_RequiredAnnotationCount_Positive",
                table: "Videos");

            migrationBuilder.DropIndex(
                name: "IX_AnnotationSessions_AnnotatorId_Status",
                table: "AnnotationSessions");

            migrationBuilder.DropIndex(
                name: "IX_AnnotationSessions_Status",
                table: "AnnotationSessions");

            migrationBuilder.DropIndex(
                name: "IX_AnnotationSessions_VideoId_Status",
                table: "AnnotationSessions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_AnnotationSessions_ExpiryAfterAssignment",
                table: "AnnotationSessions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_AnnotationSessions_Status",
                table: "AnnotationSessions");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "DatasetId",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "RequiredAnnotationCount",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "AnnotationSessions");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "AnnotationSessions");

            migrationBuilder.DropColumn(
                name: "StartedAt",
                table: "AnnotationSessions");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "AnnotationSessions");

            migrationBuilder.CreateIndex(
                name: "IX_AnnotationSessions_AnnotatorId",
                table: "AnnotationSessions",
                column: "AnnotatorId");

            migrationBuilder.CreateIndex(
                name: "IX_AnnotationSessions_VideoId",
                table: "AnnotationSessions",
                column: "VideoId");
        }
    }
}
