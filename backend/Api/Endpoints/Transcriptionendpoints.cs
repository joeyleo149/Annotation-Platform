using System.Net.Http.Headers;

namespace Api.Endpoints;

public static class TranscriptionEndpoints
{
    public static RouteGroupBuilder MapTranscriptionEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/transcribe").WithTags("Transcription");

        // Accepts a recorded audio blob (webm/wav/m4a — anything Groq/Whisper supports),
        // forwards it to Groq's Whisper API, returns the transcribed text.
        // Replaces the browser's built-in Web Speech API, which had noticeably
        // worse accuracy and is Chrome/Edge-only.
        group.MapPost("/", async (
            HttpRequest request,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            CancellationToken ct) =>
        {
            if (!request.HasFormContentType)
                return Results.BadRequest(new { error = "Expected multipart/form-data with an 'audio' file." });

            var form = await request.ReadFormAsync(ct);
            var audioFile = form.Files["audio"];
            if (audioFile is null || audioFile.Length == 0)
                return Results.BadRequest(new { error = "No audio file provided." });

            var apiKey = configuration["Groq:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                return Results.Problem("GROQ_API_KEY is not configured on the server.", statusCode: 500);

            var client = httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var content = new MultipartFormDataContent();
            await using var audioStream = audioFile.OpenReadStream();
            var audioContent = new StreamContent(audioStream);
            audioContent.Headers.ContentType = new MediaTypeHeaderValue(audioFile.ContentType);
            content.Add(audioContent, "file", audioFile.FileName);
            content.Add(new StringContent("whisper-large-v3"), "model");
            content.Add(new StringContent("en"), "language");

            var response = await client.PostAsync(
                "https://api.groq.com/openai/v1/audio/transcriptions", content, ct);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                return Results.Problem($"Groq transcription failed: {errorBody}", statusCode: 502);
            }

            var result = await response.Content.ReadFromJsonAsync<GroqTranscriptionResponse>(cancellationToken: ct);
            return Results.Ok(new { text = result?.Text ?? "" });
        })
        .DisableAntiforgery(); // multipart audio upload, no cookie-based auth in play here

        return group;
    }

    private sealed record GroqTranscriptionResponse(string Text);
}