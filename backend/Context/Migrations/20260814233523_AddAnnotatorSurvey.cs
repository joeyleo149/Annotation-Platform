using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Context.Migrations
{
    /// <inheritdoc />
    public partial class AddAnnotatorSurvey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasCompletedSurvey",
                table: "Annotators",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "AnnotatorSurveys",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AnnotatorId = table.Column<int>(type: "int", nullable: false),
                    Nationality = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Gender = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Age = table.Column<int>(type: "int", nullable: false),
                    HasDriverLicense = table.Column<bool>(type: "bit", nullable: false),
                    YearsOfDrivingExperience = table.Column<int>(type: "int", nullable: false),
                    PrimaryDrivingCountry = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DrivingFrequency = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DrivingScenarioNighttime = table.Column<bool>(type: "bit", nullable: false),
                    DrivingScenarioSnowyWeather = table.Column<bool>(type: "bit", nullable: false),
                    DrivingScenarioHeavyRain = table.Column<bool>(type: "bit", nullable: false),
                    DrivingScenarioConstructionZone = table.Column<bool>(type: "bit", nullable: false),
                    DrivingScenarioNone = table.Column<bool>(type: "bit", nullable: false),
                    HasPriorDatasetAnnotationExperience = table.Column<bool>(type: "bit", nullable: false),
                    HasAccidentsInLastFiveYears = table.Column<bool>(type: "bit", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnnotatorSurveys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AnnotatorSurveys_Annotators_AnnotatorId",
                        column: x => x.AnnotatorId,
                        principalTable: "Annotators",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnnotatorSurveys_AnnotatorId",
                table: "AnnotatorSurveys",
                column: "AnnotatorId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AnnotatorSurveys");

            migrationBuilder.DropColumn(
                name: "HasCompletedSurvey",
                table: "Annotators");
        }
    }
}
