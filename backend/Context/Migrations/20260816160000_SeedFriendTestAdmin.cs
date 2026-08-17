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
                WHERE [Username] = N'FriendAdmin'
                   OR [Email] = N'friend.admin@example.com'
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
                    N'FriendAdmin',
                    N'friend.admin@example.com',
                    N'pbkdf2-sha256$120000$R0Oq6VYK0IWEuVpiwTHItQ==$pW2dpbhfLkNVFhndZLQWA9w1427IRysrpXt4h/A4Jn8='
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
            WHERE [Username] = N'FriendAdmin'
              AND [Email] = N'friend.admin@example.com';
            """);
    }
}