using Api.Endpoints;
using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;
using Service;
using Service.Services;

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
builder.Services.AddScoped<IEntityService<Admin>, AdminService>();
builder.Services.AddScoped<IEntityService<Annotator>, AnnotatorService>();
builder.Services.AddScoped<IEntityService<Video>, VideoService>();
builder.Services.AddScoped<IEntityService<AnnotationSession>, AnnotationSessionService>();
builder.Services.AddScoped<IEntityService<SegmentResponse>, SegmentResponseService>();
builder.Services.AddScoped<IEntityService<QuestionAnswer>, QuestionAnswerService>();

// TODO: Register these once the files are created in your project:
// builder.Services.AddScoped<AuthService>();
// builder.Services.AddScoped<SurveyService>();
// builder.Services.AddScoped<VideoUploadService>();

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

// TODO: Map these once AuthEndpoints.cs, SurveyEndpoints.cs, and UploadEndpoints.cs are created:
// app.MapAuthEndpoints();
// app.MapSurveyEndpoints();
// app.MapUploadEndpoints();

app.Run();