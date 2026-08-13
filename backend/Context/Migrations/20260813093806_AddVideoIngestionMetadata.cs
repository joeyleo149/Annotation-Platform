using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Context.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoIngestionMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ActionsJson",
                table: "Videos",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DatasetRowIndex",
                table: "Videos",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DrivingInstruction",
                table: "Videos",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DurationSeconds",
                table: "Videos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FileSizeBytes",
                table: "Videos",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<double>(
                name: "FrameRate",
                table: "Videos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Height",
                table: "Videos",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ManifestMatched",
                table: "Videos",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MimeType",
                table: "Videos",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OriginalReasoningJson",
                table: "Videos",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProcessingError",
                table: "Videos",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProcessingStatus",
                table: "Videos",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ScenarioId",
                table: "Videos",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScenarioType",
                table: "Videos",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ThumbnailPath",
                table: "Videos",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrajectoryJson",
                table: "Videos",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Width",
                table: "Videos",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Videos_FileName",
                table: "Videos",
                column: "FileName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Videos_ScenarioId",
                table: "Videos",
                column: "ScenarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Videos_FileName",
                table: "Videos");

            migrationBuilder.DropIndex(
                name: "IX_Videos_ScenarioId",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "ActionsJson",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "DatasetRowIndex",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "DrivingInstruction",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "DurationSeconds",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "FileSizeBytes",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "FrameRate",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "Height",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "ManifestMatched",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "MimeType",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "OriginalReasoningJson",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "ProcessingError",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "ProcessingStatus",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "ScenarioId",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "ScenarioType",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "ThumbnailPath",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "TrajectoryJson",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "Width",
                table: "Videos");
        }
    }
}
