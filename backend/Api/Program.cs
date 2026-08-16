using Api.Endpoints;
using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Service;
using Service.Services;
using Api.BackgroundServices;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

// 1. Configure CORS to allow React frontend (Vite default port 5173)
var allowReactApp = "_allowReactApp";
builder.Services.AddCors(options =>
{
    options.AddPolicy(name: allowReactApp,
        policy =>
        {
            policy.WithOrigins("http://localhost:5173") 
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
});

// Add services to the container
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new() { Title = "Annotate Pro API", Version = "v1" });
});
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is required.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Existing generic entity services
builder.Services.AddScoped<VideoService>();
builder.Services.AddScoped<IEntityService<Admin>, AdminService>();
builder.Services.AddScoped<IEntityService<Annotator>, AnnotatorService>();
builder.Services.AddScoped<IEntityService<AnnotationSession>, AnnotationSessionService>();
builder.Services.AddScoped<IEntityService<SegmentResponse>, SegmentResponseService>();
builder.Services.AddScoped<IEntityService<QuestionAnswer>, QuestionAnswerService>();
builder.Services.AddScoped<ManifestService>();
builder.Services.AddScoped<VideoUploadService>();
builder.Services.AddScoped<AnnotationAssignmentService>();
builder.Services.AddScoped<AnnotationExportService>();
builder.Services.AddHostedService<AssignmentExpirationWorker>();
builder.Services.AddScoped<ArchiveService>();
builder.Services.AddHostedService<DatasetArchiveWorker>();
builder.Services.AddHttpClient();


builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ISurveyService, SurveyService>();
// builder.Services.AddScoped<VideoUploadService>();

var app = builder.Build();

app.UseExceptionHandler();

// Enable CORS middleware (Must be before app.MapGet / endpoints)
app.UseCors(allowReactApp);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Annotate Pro API v1");
        options.RoutePrefix = "swagger";
    });
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

// 2. Temporary test endpoint to verify React -> ASP.NET connection
app.MapGet("/api/test", () => Results.Ok(new { message = "Backend connection successful!" }));

// Existing endpoint mappings
// app.MapAdminEndpoints().RequireAuthorization(policy => policy.RequireRole("Admin"));
// app.MapAnnotatorEndpoints().RequireAuthorization();
// app.MapVideoEndpoints().RequireAuthorization();
// app.MapAnnotationSessionEndpoints().RequireAuthorization();
// app.MapSegmentResponseEndpoints().RequireAuthorization();
// app.MapQuestionAnswerEndpoints().RequireAuthorization();
// app.MapAuthEndpoints();

app.MapAdminEndpoints().RequireAuthorization(policy => policy.RequireRole("Admin"));
app.MapAnnotatorEndpoints().RequireAuthorization();
app.MapVideoEndpoints().RequireAuthorization();
app.MapAnnotationSessionEndpoints().RequireAuthorization();
app.MapSegmentResponseEndpoints().RequireAuthorization();
app.MapQuestionAnswerEndpoints().RequireAuthorization();
app.MapAuthEndpoints();

app.MapTranscriptionEndpoints();

// TODO: Map these once AuthEndpoints.cs, SurveyEndpoints.cs, and UploadEndpoints.cs are created:
app.MapSurveyEndpoints().RequireAuthorization(policy => policy.RequireRole("Annotator"));
// app.MapUploadEndpoints();
app.MapUploadEndpoints();
app.MapAnnotationExportEndpoints();
app.MapDatasetEndpoints();

if (app.Environment.IsDevelopment())
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.Run();
