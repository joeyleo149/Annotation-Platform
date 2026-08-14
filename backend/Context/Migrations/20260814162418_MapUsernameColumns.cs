using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Context.Migrations
{
    /// <inheritdoc />
    public partial class MapUsernameColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Name",
                table: "Annotators",
                newName: "Username");

            migrationBuilder.RenameIndex(
                name: "IX_Annotators_Name",
                table: "Annotators",
                newName: "IX_Annotators_Username");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "Admins",
                newName: "Username");

            migrationBuilder.RenameIndex(
                name: "IX_Admins_Name",
                table: "Admins",
                newName: "IX_Admins_Username");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Username",
                table: "Annotators",
                newName: "Name");

            migrationBuilder.RenameIndex(
                name: "IX_Annotators_Username",
                table: "Annotators",
                newName: "IX_Annotators_Name");

            migrationBuilder.RenameColumn(
                name: "Username",
                table: "Admins",
                newName: "Name");

            migrationBuilder.RenameIndex(
                name: "IX_Admins_Username",
                table: "Admins",
                newName: "IX_Admins_Name");
        }
    }
}
