using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Context.Migrations
{
    /// <inheritdoc />
    public partial class AddAnnotationTaskRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AnnotationTaskRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AnnotatorId = table.Column<int>(type: "int", nullable: false),
                    DatasetId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "Waiting"),
                    RequestedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    FulfilledAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CancelledAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    AnnotationSessionId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnnotationTaskRequests", x => x.Id);
                    table.CheckConstraint("CK_AnnotationTaskRequests_Status", "[Status] IN ('Waiting', 'Fulfilled', 'Cancelled')");
                    table.ForeignKey(
                        name: "FK_AnnotationTaskRequests_AnnotationSessions_AnnotationSessionId",
                        column: x => x.AnnotationSessionId,
                        principalTable: "AnnotationSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AnnotationTaskRequests_Annotators_AnnotatorId",
                        column: x => x.AnnotatorId,
                        principalTable: "Annotators",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AnnotationTaskRequests_Datasets_DatasetId",
                        column: x => x.DatasetId,
                        principalTable: "Datasets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnnotationTaskRequests_AnnotationSessionId",
                table: "AnnotationTaskRequests",
                column: "AnnotationSessionId",
                unique: true,
                filter: "[AnnotationSessionId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_AnnotationTaskRequests_AnnotatorId_DatasetId_Status",
                table: "AnnotationTaskRequests",
                columns: new[] { "AnnotatorId", "DatasetId", "Status" },
                unique: true,
                filter: "[Status] = 'Waiting'");

            migrationBuilder.CreateIndex(
                name: "IX_AnnotationTaskRequests_DatasetId_Status_RequestedAt",
                table: "AnnotationTaskRequests",
                columns: new[] { "DatasetId", "Status", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AnnotationTaskRequests_Status",
                table: "AnnotationTaskRequests",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AnnotationTaskRequests");
        }
    }
}
