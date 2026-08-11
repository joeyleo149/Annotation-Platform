using Api.Endpoints;
using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;
using Service;
using Service.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<IEntityService<Admin>, AdminService>();
builder.Services.AddScoped<IEntityService<Annotator>, AnnotatorService>();
builder.Services.AddScoped<IEntityService<Video>, VideoService>();
builder.Services.AddScoped<IEntityService<AnnotationSession>, AnnotationSessionService>();
builder.Services.AddScoped<IEntityService<SegmentResponse>, SegmentResponseService>();
builder.Services.AddScoped<IEntityService<QuestionAnswer>, QuestionAnswerService>();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapAdminEndpoints();
app.MapAnnotatorEndpoints();
app.MapVideoEndpoints();
app.MapAnnotationSessionEndpoints();
app.MapSegmentResponseEndpoints();
app.MapQuestionAnswerEndpoints();

app.Run();
