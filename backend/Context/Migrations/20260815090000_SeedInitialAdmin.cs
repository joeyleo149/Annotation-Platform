using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Context.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260815090000_SeedInitialAdmin")]
public sealed class SeedInitialAdmin : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            SET IDENTITY_INSERT [Admins] ON;

            IF EXISTS (SELECT 1 FROM [Admins] WHERE [Id] = 1)
            BEGIN
                UPDATE [Admins]
                SET [Username] = N'Admin1',
                    [Email] = N'admin@gmail.com',
                    [PasswordHash] = N'pbkdf2-sha256$120000$a/sOGutrdIqOrerEDFxSVg==$v/oVmnFfED2JNC8GvdN3femwCWPLQZ9PyfmTTRkonNc='
                WHERE [Id] = 1;
            END
            ELSE
            BEGIN
                INSERT INTO [Admins] ([Id], [Username], [Email], [PasswordHash])
                VALUES (1, N'Admin1', N'admin@gmail.com', N'pbkdf2-sha256$120000$a/sOGutrdIqOrerEDFxSVg==$v/oVmnFfED2JNC8GvdN3femwCWPLQZ9PyfmTTRkonNc=');
            END;

            SET IDENTITY_INSERT [Admins] OFF;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DELETE FROM [Admins]
            WHERE [Id] = 1
              AND [Username] = N'Admin1'
              AND [Email] = N'admin@gmail.com';
            """);
    }
}
