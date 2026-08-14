using Api.Endpoints;
using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;
using Service;
using Service.Services;
using Api.BackgroundServices;

var builder = WebApplication.CreateBuilder(args);

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


var app = builder.Build();

// Enable CORS middleware (Must be before app.MapGet / endpoints)
app.UseCors(allowReactApp);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// 2. Temporary test endpoint to verify React -> ASP.NET connection
app.MapGet("/api/test", () => Results.Ok(new { message = "Backend connection successful!" }));

// Existing endpoint mappings
app.MapAdminEndpoints();
app.MapAnnotatorEndpoints();
app.MapVideoEndpoints();
app.MapAnnotationSessionEndpoints();
app.MapSegmentResponseEndpoints();
app.MapQuestionAnswerEndpoints();
app.MapUploadEndpoints();
app.MapAnnotationExportEndpoints();
app.MapDatasetEndpoints();

app.Run();