using Api.BackgroundServices;
using Api.Endpoints;
using Api.Services;
using Context;
using Context.Entities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Service;
using Service.Services;
using System.Text;

var builder =
    WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var allowReactApp = "_allowReactApp";

builder.Services.AddCors(
    options =>
    {
        options.AddPolicy(
            allowReactApp,
            policy =>
            {
                policy
                    .WithOrigins(
                        "http://localhost:5173")
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
    });

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(
    options =>
    {
        options.SwaggerDoc(
            "v1",
            new()
            {
                Title =
                    "Annotate Pro API",
                Version = "v1",
            });
    });

var jwtKey =
    builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "Jwt:Key is required.");

builder.Services
    .AddAuthentication(
        JwtBearerDefaults
            .AuthenticationScheme)
    .AddJwtBearer(
        options =>
        {
            options.TokenValidationParameters =
                new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,

                    ValidateIssuerSigningKey =
                        true,

                    ValidIssuer =
                        builder.Configuration[
                            "Jwt:Issuer"],

                    ValidAudience =
                        builder.Configuration[
                            "Jwt:Audience"],

                    IssuerSigningKey =
                        new SymmetricSecurityKey(
                            Encoding.UTF8.GetBytes(
                                jwtKey)),

                    ClockSkew =
                        TimeSpan.FromMinutes(1),
                };
        });

builder.Services.AddAuthorization();

builder.Services.AddDbContext<AppDbContext>(
    options =>
        options.UseSqlServer(
            builder.Configuration
                .GetConnectionString(
                    "DefaultConnection")));

builder.Services.AddScoped<VideoService>();

builder.Services.AddScoped<
    IEntityService<Admin>,
    AdminService>();

builder.Services.AddScoped<
    IEntityService<Annotator>,
    AnnotatorService>();

builder.Services.AddScoped<
    IEntityService<AnnotationSession>,
    AnnotationSessionService>();

builder.Services.AddScoped<
    IEntityService<SegmentResponse>,
    SegmentResponseService>();

builder.Services.AddScoped<
    IEntityService<QuestionAnswer>,
    QuestionAnswerService>();

builder.Services.AddScoped<ManifestService>();
builder.Services.AddScoped<VideoUploadService>();

builder.Services.AddScoped<
    AnnotationAssignmentService>();

builder.Services.AddScoped<
    AnnotationExportService>();

builder.Services.AddScoped<ArchiveService>();

builder.Services.AddScoped<AuthService>();

builder.Services.AddScoped<
    AdminInvitationEmailSender>();

builder.Services.AddHttpClient();

builder.Services.AddScoped<
    ISurveyService,
    SurveyService>();

builder.Services.AddHostedService<
    AssignmentExpirationWorker>();

builder.Services.AddHostedService<
    DatasetArchiveWorker>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors(allowReactApp);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    app.UseSwagger();

    app.UseSwaggerUI(
        options =>
        {
            options.SwaggerEndpoint(
                "/swagger/v1/swagger.json",
                "Annotate Pro API v1");

            options.RoutePrefix =
                "swagger";
        });
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet(
    "/api/test",
    () =>
        Results.Ok(
            new
            {
                message =
                    "Backend connection successful!",
            }));

app.MapAdminEndpoints()
    .RequireAuthorization(
        policy =>
            policy.RequireRole("Admin"));

app.MapAnnotatorEndpoints()
    .RequireAuthorization();

app.MapVideoEndpoints()
    .RequireAuthorization();

app.MapAnnotationSessionEndpoints()
    .RequireAuthorization();

app.MapSegmentResponseEndpoints()
    .RequireAuthorization();

app.MapQuestionAnswerEndpoints()
    .RequireAuthorization();

app.MapAuthEndpoints();

app.MapSurveyEndpoints()
    .RequireAuthorization(
        policy =>
            policy.RequireRole("Annotator"));

app.MapTranscriptionEndpoints()
    .RequireAuthorization(
        policy =>
            policy.RequireRole("Annotator"));

app.MapUploadEndpoints()
    .RequireAuthorization(
        policy =>
            policy.RequireRole("Admin"));
app.MapAnnotationExportEndpoints();
app.MapDatasetEndpoints();

if (app.Environment.IsDevelopment())
{
    await using var scope =
        app.Services.CreateAsyncScope();

    var dbContext =
        scope.ServiceProvider
            .GetRequiredService<
                AppDbContext>();

    await dbContext.Database
        .MigrateAsync();
}

// 3. RETRY LOGIC / MIGRATIONS GO HERE (Before app.Run)
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    int retries = 10;
    while (retries > 0)
    {
        try
        {
            logger.LogInformation("Connecting to database...");
            await context.Database.MigrateAsync();
            logger.LogInformation("Database connected and migrated successfully!");
            break; // Connection succeeded, break loop and proceed to app.Run()
        }
        catch (Exception ex)
        {
            retries--;
            logger.LogWarning($"Database not ready yet ({ex.Message}). Retrying in 3 seconds... ({retries} attempts left)");
            if (retries == 0) throw;
            await Task.Delay(3000);
        }
    }
}

app.Run();
