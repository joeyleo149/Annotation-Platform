using System.Text.Json;

namespace Service.Services;

public sealed class ManifestService
{
    private const int ExpectedPastWaypointCount = 21;
    private const int ExpectedFutureWaypointCount = 25;

    public async Task<ManifestImportResult> ValidateAndStoreAsync(
        Stream uploadedStream,
        string destinationPath,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(uploadedStream);

        var destinationDirectory = Path.GetDirectoryName(destinationPath);

        if (string.IsNullOrWhiteSpace(destinationDirectory))
        {
            throw new InvalidOperationException(
                "The manifest destination directory is invalid.");
        }

        Directory.CreateDirectory(destinationDirectory);

        var temporaryPath =
            destinationPath + "." + Guid.NewGuid() + ".tmp";

        try
        {
            await using (var temporaryFile = new FileStream(
                temporaryPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true))
            {
                await uploadedStream.CopyToAsync(
                    temporaryFile,
                    cancellationToken);
            }

            var validationResult = await ValidateFileAsync(
                temporaryPath,
                cancellationToken);

            File.Move(
                temporaryPath,
                destinationPath,
                overwrite: true);

            return new ManifestImportResult(
                StoredFileName: Path.GetFileName(destinationPath),
                ScenarioCount: validationResult.ScenarioCount,
                UniqueVideoFileNames:
                    validationResult.UniqueVideoFileNames,
                UniqueScenarioIds:
                    validationResult.UniqueScenarioIds,
                ValidTrajectoryCount:
                    validationResult.ValidTrajectoryCount,
                IncompleteTrajectoryCount:
                    validationResult.IncompleteTrajectoryCount,
                ReasoningAvailableCount:
                    validationResult.ReasoningAvailableCount,
                ReasoningUnavailableCount:
                    validationResult.ReasoningUnavailableCount,
                WarningCount: validationResult.Warnings.Count,
                Warnings: validationResult.Warnings,
                ImportedAtUtc: DateTimeOffset.UtcNow);
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
    }

    private static async Task<ManifestValidationResult> ValidateFileAsync(
        string filePath,
        CancellationToken cancellationToken)
    {
        await using var fileStream = new FileStream(
            filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 81920,
            useAsync: true);

        using var document = await JsonDocument.ParseAsync(
            fileStream,
            new JsonDocumentOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = 128
            },
            cancellationToken);

        var root = document.RootElement;

        if (root.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidDataException(
                "The manifest root must be a JSON object.");
        }

        if (!root.TryGetProperty("manifest_version", out var version) ||
            version.ValueKind != JsonValueKind.String ||
            string.IsNullOrWhiteSpace(version.GetString()))
        {
            throw new InvalidDataException(
                "The manifest must contain a valid manifest_version.");
        }

        if (!root.TryGetProperty("scenarios", out var scenarios) ||
            scenarios.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidDataException(
                "The manifest must contain a scenarios array.");
        }

        if (scenarios.GetArrayLength() == 0)
        {
            throw new InvalidDataException(
                "The scenarios array cannot be empty.");
        }

        var videoFileNames =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var scenarioIds =
            new HashSet<string>(StringComparer.Ordinal);

        var errors = new List<string>();
        var warnings = new List<ManifestWarning>();

        var scenarioNumber = 0;
        var validTrajectoryCount = 0;
        var incompleteTrajectoryCount = 0;
        var reasoningAvailableCount = 0;

        foreach (var scenario in scenarios.EnumerateArray())
        {
            scenarioNumber++;

            var result = ValidateScenario(
                scenario,
                scenarioNumber,
                videoFileNames,
                scenarioIds,
                errors,
                warnings);

            if (result.HasCompleteTrajectory)
            {
                validTrajectoryCount++;
            }
            else
            {
                incompleteTrajectoryCount++;
            }

            if (result.HasReasoning)
            {
                reasoningAvailableCount++;
            }
        }

        if (errors.Count > 0)
        {
            var displayedErrors = errors.Take(20);

            var message = string.Join(
                Environment.NewLine,
                displayedErrors);

            if (errors.Count > 20)
            {
                message += Environment.NewLine +
                    $"...and {errors.Count - 20} additional error(s).";
            }

            throw new InvalidDataException(message);
        }

        return new ManifestValidationResult(
            ScenarioCount: scenarioNumber,
            UniqueVideoFileNames: videoFileNames.Count,
            UniqueScenarioIds: scenarioIds.Count,
            ValidTrajectoryCount: validTrajectoryCount,
            IncompleteTrajectoryCount: incompleteTrajectoryCount,
            ReasoningAvailableCount: reasoningAvailableCount,
            ReasoningUnavailableCount:
                scenarioNumber - reasoningAvailableCount,
            Warnings: warnings);
    }

    private static ScenarioValidationResult ValidateScenario(
        JsonElement scenario,
        int scenarioNumber,
        HashSet<string> videoFileNames,
        HashSet<string> scenarioIds,
        List<string> errors,
        List<ManifestWarning> warnings)
    {
        var label = $"Scenario entry {scenarioNumber}";

        if (scenario.ValueKind != JsonValueKind.Object)
        {
            errors.Add($"{label} must be a JSON object.");

            return new ScenarioValidationResult(
                HasCompleteTrajectory: false,
                HasReasoning: false);
        }

        var scenarioId = ReadRequiredString(
            scenario,
            "scenario_id",
            label,
            errors);

        if (scenarioId is not null &&
            !scenarioIds.Add(scenarioId))
        {
            errors.Add(
                $"{label} has duplicate scenario_id '{scenarioId}'.");
        }

        if (!scenario.TryGetProperty("dataset", out var dataset) ||
            dataset.ValueKind != JsonValueKind.Object)
        {
            errors.Add($"{label} must contain a dataset object.");
        }
        else if (!dataset.TryGetProperty(
                     "row_index",
                     out var rowIndex) ||
                 !rowIndex.TryGetInt32(out var parsedRowIndex) ||
                 parsedRowIndex < 0)
        {
            errors.Add(
                $"{label} must contain a non-negative " +
                "dataset.row_index.");
        }

        string? fileName = null;

        if (!scenario.TryGetProperty("video", out var video) ||
            video.ValueKind != JsonValueKind.Object)
        {
            errors.Add($"{label} must contain a video object.");
        }
        else
        {
            fileName = ReadRequiredString(
                video,
                "filename",
                $"{label}.video",
                errors);

            if (fileName is not null)
            {
                if (!string.Equals(
                        fileName,
                        Path.GetFileName(fileName),
                        StringComparison.Ordinal))
                {
                    errors.Add(
                        $"{label} video filename must not contain a path.");
                }

                if (!fileName.EndsWith(
                        ".mp4",
                        StringComparison.OrdinalIgnoreCase))
                {
                    errors.Add(
                        $"{label} video filename must end with .mp4.");
                }

                if (!videoFileNames.Add(fileName))
                {
                    errors.Add(
                        $"{label} has duplicate video filename " +
                        $"'{fileName}'.");
                }
            }
        }

        var hasCompleteTrajectory = ValidateTrajectory(
            scenario,
            scenarioNumber,
            scenarioId,
            fileName,
            label,
            errors,
            warnings);

        var hasReasoning = HasAvailableReasoning(scenario);

        return new ScenarioValidationResult(
            HasCompleteTrajectory: hasCompleteTrajectory,
            HasReasoning: hasReasoning);
    }

    private static bool ValidateTrajectory(
        JsonElement scenario,
        int scenarioNumber,
        string? scenarioId,
        string? fileName,
        string label,
        List<string> errors,
        List<ManifestWarning> warnings)
    {
        if (!scenario.TryGetProperty(
                "trajectory",
                out var trajectory) ||
            trajectory.ValueKind != JsonValueKind.Object)
        {
            errors.Add($"{label} must contain a trajectory object.");
            return false;
        }

        var pastIsComplete = ValidateWaypointSection(
            trajectory,
            sectionName: "past",
            expectedCount: ExpectedPastWaypointCount,
            label,
            errors);

        var futureIsComplete = ValidateWaypointSection(
            trajectory,
            sectionName: "expert_future",
            expectedCount: ExpectedFutureWaypointCount,
            label,
            errors,
            countMismatchIsFatal: false);

        if (!futureIsComplete &&
            trajectory.TryGetProperty(
                "expert_future",
                out var expertFuture) &&
            expertFuture.ValueKind == JsonValueKind.Object &&
            expertFuture.TryGetProperty(
                "waypoints",
                out var futureWaypoints) &&
            futureWaypoints.ValueKind == JsonValueKind.Array)
        {
            warnings.Add(new ManifestWarning(
                ScenarioNumber: scenarioNumber,
                ScenarioId: scenarioId,
                VideoFileName: fileName,
                Code: "INCOMPLETE_FUTURE_TRAJECTORY",
                Message:
                    $"Future trajectory contains " +
                    $"{futureWaypoints.GetArrayLength()} points; " +
                    $"expected {ExpectedFutureWaypointCount}."));
        }

        return pastIsComplete && futureIsComplete;
    }

    private static bool ValidateWaypointSection(
        JsonElement trajectory,
        string sectionName,
        int expectedCount,
        string label,
        List<string> errors,
        bool countMismatchIsFatal = true)
    {
        if (!trajectory.TryGetProperty(
                sectionName,
                out var section) ||
            section.ValueKind != JsonValueKind.Object ||
            !section.TryGetProperty(
                "waypoints",
                out var waypoints) ||
            waypoints.ValueKind != JsonValueKind.Array)
        {
            errors.Add(
                $"{label} must contain " +
                $"trajectory.{sectionName}.waypoints.");

            return false;
        }

        var hasExpectedCount =
            waypoints.GetArrayLength() == expectedCount;

        if (!hasExpectedCount && countMismatchIsFatal)
        {
            errors.Add(
                $"{label} trajectory.{sectionName}.waypoints contains " +
                $"{waypoints.GetArrayLength()} points; " +
                $"expected {expectedCount}.");
        }

        var pointNumber = 0;

        foreach (var point in waypoints.EnumerateArray())
        {
            pointNumber++;

            if (point.ValueKind != JsonValueKind.Array ||
                point.GetArrayLength() != 2 ||
                point[0].ValueKind != JsonValueKind.Number ||
                point[1].ValueKind != JsonValueKind.Number)
            {
                errors.Add(
                    $"{label} trajectory.{sectionName} point " +
                    $"{pointNumber} must have numeric [x, y] coordinates.");
            }
        }

        return hasExpectedCount;
    }

    private static bool HasAvailableReasoning(
        JsonElement scenario)
    {
        if (!scenario.TryGetProperty(
                "actions",
                out var actions) ||
            actions.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var requiredActionNames = new[]
        {
            "acceleration_first_3s",
            "steering_first_3s",
            "acceleration_last_2s",
            "steering_last_2s"
        };

        foreach (var actionName in requiredActionNames)
        {
            if (!actions.TryGetProperty(
                    actionName,
                    out var actionValue) ||
                actionValue.ValueKind != JsonValueKind.String ||
                string.IsNullOrWhiteSpace(actionValue.GetString()))
            {
                return false;
            }
        }

        return true;
    }

    private static string? ReadRequiredString(
        JsonElement parent,
        string propertyName,
        string label,
        List<string> errors)
    {
        if (!parent.TryGetProperty(
                propertyName,
                out var property) ||
            property.ValueKind != JsonValueKind.String ||
            string.IsNullOrWhiteSpace(property.GetString()))
        {
            errors.Add(
                $"{label} must contain a non-empty {propertyName}.");

            return null;
        }

        return property.GetString();
    }

    private sealed record ManifestValidationResult(
        int ScenarioCount,
        int UniqueVideoFileNames,
        int UniqueScenarioIds,
        int ValidTrajectoryCount,
        int IncompleteTrajectoryCount,
        int ReasoningAvailableCount,
        int ReasoningUnavailableCount,
        IReadOnlyList<ManifestWarning> Warnings);

    private sealed record ScenarioValidationResult(
        bool HasCompleteTrajectory,
        bool HasReasoning);
}

public sealed record ManifestWarning(
    int ScenarioNumber,
    string? ScenarioId,
    string? VideoFileName,
    string Code,
    string Message);

public sealed record ManifestImportResult(
    string StoredFileName,
    int ScenarioCount,
    int UniqueVideoFileNames,
    int UniqueScenarioIds,
    int ValidTrajectoryCount,
    int IncompleteTrajectoryCount,
    int ReasoningAvailableCount,
    int ReasoningUnavailableCount,
    int WarningCount,
    IReadOnlyList<ManifestWarning> Warnings,
    DateTimeOffset ImportedAtUtc);