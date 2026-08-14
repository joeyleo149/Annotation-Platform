using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Context.Migrations
{
    /// <inheritdoc />
    public partial class MakeDatasetNamesAndVideoFilesUnique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Videos_DatasetId",
                table: "Videos");

            migrationBuilder.DropIndex(
                name: "IX_Videos_FileName",
                table: "Videos");

            migrationBuilder.DropIndex(
                name: "IX_Datasets_Name",
                table: "Datasets");

            migrationBuilder.CreateIndex(
                name: "IX_Videos_DatasetId_FileName",
                table: "Videos",
                columns: new[] { "DatasetId", "FileName" },
                unique: true,
                filter: "[DatasetId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Datasets_Name",
                table: "Datasets",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Videos_DatasetId_FileName",
                table: "Videos");

            migrationBuilder.DropIndex(
                name: "IX_Datasets_Name",
                table: "Datasets");

            migrationBuilder.CreateIndex(
                name: "IX_Videos_DatasetId",
                table: "Videos",
                column: "DatasetId");

            migrationBuilder.CreateIndex(
                name: "IX_Videos_FileName",
                table: "Videos",
                column: "FileName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Datasets_Name",
                table: "Datasets",
                column: "Name");
        }
    }
}
