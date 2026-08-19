using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Context.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260816160000_SeedFriendTestAdmin")]
public sealed class SeedFriendTestAdmin : Migration
{
    protected override void Up(
        MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            IF NOT EXISTS
            (
                SELECT 1
                FROM [Admins]
                WHERE [Username] = N'Admin'
                   OR [Email] = N'admin@annotatepro.local'
            )
            BEGIN
                INSERT INTO [Admins]
                (
                    [Username],
                    [Email],
                    [PasswordHash]
                )
                VALUES
                (
                    N'Admin',
                    N'admin@annotatepro.local',
                    N'pbkdf2-sha256$120000$8uH3dxMLem2bDGv/3K8BzQ==$7T1blYGeVgUCy+TdscWHpRxSuUT/6GGpDZoigaiw/hk='
                );
            END;
            """);
    }

    protected override void Down(
        MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DELETE FROM [Admins]
            WHERE [Username] = N'Admin'
              AND [Email] =
                  N'admin@annotatepro.local';
            """);
    }
}