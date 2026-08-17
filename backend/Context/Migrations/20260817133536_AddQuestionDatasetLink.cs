using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Context.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionDatasetLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Questions_SegmentNo_IsActive",
                table: "Questions");

            migrationBuilder.AddColumn<int>(
                name: "DatasetId",
                table: "Questions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Questions_DatasetId_SegmentNo_IsActive",
                table: "Questions",
                columns: new[] { "DatasetId", "SegmentNo", "IsActive" });

            migrationBuilder.AddForeignKey(
                name: "FK_Questions_Datasets_DatasetId",
                table: "Questions",
                column: "DatasetId",
                principalTable: "Datasets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Questions_Datasets_DatasetId",
                table: "Questions");

            migrationBuilder.DropIndex(
                name: "IX_Questions_DatasetId_SegmentNo_IsActive",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "DatasetId",
                table: "Questions");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_SegmentNo_IsActive",
                table: "Questions",
                columns: new[] { "SegmentNo", "IsActive" });
        }
    }
}
