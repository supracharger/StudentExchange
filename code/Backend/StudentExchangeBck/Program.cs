using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;      // NEW
using StudentExchangeBck;
using StudentExchangeBck.Controllers;          // NEW

// Get Enviroment
Env.GetEnv();

Directory.CreateDirectory("public");
Directory.CreateDirectory(Listing.UploadsPath);

// Tasks that need to be occasionally cleaned
Action Schedule = () =>
{
    LogIn.CleanUp();
    Users.CleanUp();
    IP.CleanUp();
    Listing.CleanUp();               // NEW
};
// Run Clean up at program start
var tsk = Task.Run(Schedule);
// Schedule Clean up each day at time.
using var schedule = new Maitenance(324, Schedule);

// ==================== Created by Visual Studio 2022 ============================

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto;
});

var app = builder.Build();          // <-- 'app' is created here

app.UseForwardedHeaders();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// NEW: serve listing images from the uploads folder at /uploads/...
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Listing.UploadsPath),
    RequestPath = "/uploads"
});

app.UseAuthorization();

app.MapControllers();

app.Run();