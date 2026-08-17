using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Context.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                INSERT INTO [Questions] ([QuestionNumber], [Text])
                SELECT DISTINCT qa.[QuestionNumber], CONCAT(N'Legacy question ', qa.[QuestionNumber])
                FROM [QuestionAnswers] qa
                WHERE NOT EXISTS (
                    SELECT 1 FROM [Questions] q WHERE q.[QuestionNumber] = qa.[QuestionNumber]);

                UPDATE qa
                SET qa.[QuestionNumber] = (
                    SELECT MIN(q.[Id]) FROM [Questions] q
                    WHERE q.[QuestionNumber] = qa.[QuestionNumber])
                FROM [QuestionAnswers] qa;

                IF OBJECT_ID(N'[CK_QuestionAnswers_QuestionNumber]', N'C') IS NOT NULL
                    ALTER TABLE [QuestionAnswers] DROP CONSTRAINT [CK_QuestionAnswers_QuestionNumber];
                """);

            migrationBuilder.RenameColumn(
                name: "Text",
                table: "Questions",
                newName: "QuestionText");

            migrationBuilder.RenameColumn(
                name: "QuestionNumber",
                table: "Questions",
                newName: "SegmentNo");

            migrationBuilder.RenameColumn(
                name: "QuestionNumber",
                table: "QuestionAnswers",
                newName: "QuestionId");

            migrationBuilder.Sql(
                "UPDATE [Questions] SET [SegmentNo] = 1 WHERE [SegmentNo] NOT IN (1, 2, 3);");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Questions",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AlterColumn<string>(
                name: "QuestionText",
                table: "Questions",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_SegmentNo_IsActive",
                table: "Questions",
                columns: new[] { "SegmentNo", "IsActive" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Questions_SegmentNo",
                table: "Questions",
                sql: "[SegmentNo] IN (1, 2, 3)");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionAnswers_QuestionId",
                table: "QuestionAnswers",
                column: "QuestionId");

            migrationBuilder.AddForeignKey(
                name: "FK_QuestionAnswers_Questions_QuestionId",
                table: "QuestionAnswers",
                column: "QuestionId",
                principalTable: "Questions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_QuestionAnswers_Questions_QuestionId",
                table: "QuestionAnswers");

            migrationBuilder.DropIndex(
                name: "IX_Questions_SegmentNo_IsActive",
                table: "Questions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Questions_SegmentNo",
                table: "Questions");

            migrationBuilder.DropIndex(
                name: "IX_QuestionAnswers_QuestionId",
                table: "QuestionAnswers");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Questions");

            migrationBuilder.AlterColumn<string>(
                name: "QuestionText",
                table: "Questions",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(1000)",
                oldMaxLength: 1000);

            migrationBuilder.RenameColumn(
                name: "SegmentNo",
                table: "Questions",
                newName: "QuestionNumber");

            migrationBuilder.RenameColumn(
                name: "QuestionId",
                table: "QuestionAnswers",
                newName: "QuestionNumber");

            migrationBuilder.AddCheckConstraint(
                name: "CK_QuestionAnswers_QuestionNumber",
                table: "QuestionAnswers",
                sql: "[QuestionNumber] >= 1 AND [QuestionNumber] <= 5");

            migrationBuilder.RenameColumn(
                name: "QuestionText",
                table: "Questions",
                newName: "Text");
        }
    }
}
