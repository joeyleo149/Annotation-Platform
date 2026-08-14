namespace Service.Services;

using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

public interface ISurveyService
{
    /// <summary>
    /// Checks whether the specified annotator has completed the survey.
    /// </summary>
    Task<bool> HasCompletedSurveyAsync(int annotatorId);

    /// <summary>
    /// Binds demographic stats to the survey entity, validates answers, 
    /// persists the survey, and updates the annotator's status.
    /// </summary>
    Task SubmitSurveyAsync(int annotatorId, AnnotatorSurvey survey);
}

public class SurveyService : ISurveyService
{
    private readonly AppDbContext _context;

    public SurveyService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> HasCompletedSurveyAsync(int annotatorId)
    {
        var annotator = await _context.Set<Annotator>()
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == annotatorId);

        if (annotator == null)
        {
            throw new InvalidOperationException($"Annotator with ID {annotatorId} was not found.");
        }

        return annotator.HasCompletedSurvey;
    }

    public async Task SubmitSurveyAsync(int annotatorId, AnnotatorSurvey survey)
    {
        // 1. Fetch user account
        var annotator = await _context.Set<Annotator>()
            .FirstOrDefaultAsync(a => a.Id == annotatorId);

        if (annotator == null)
        {
            throw new InvalidOperationException($"Annotator with ID {annotatorId} was not found.");
        }

        if (annotator.HasCompletedSurvey)
        {
            throw new InvalidOperationException("You have already completed the background survey.");
        }

        // 2. Validate input fields directly on entity
        ValidateSurvey(survey);

        // 3. Snapshot demographic fields onto the entity before saving
        survey.Nationality = annotator.Nationality;
        survey.Gender = annotator.Gender;
        survey.Age = CalculateAge(annotator.DateOfBirth);
        survey.SubmittedAt = DateTime.UtcNow;
        survey.AnnotatorId = annotator.Id;

        // 4. Save entity & unlock workspace
        _context.Set<AnnotatorSurvey>().Add(survey);
        annotator.HasCompletedSurvey = true;

        await _context.SaveChangesAsync();
    }

    private static void ValidateSurvey(AnnotatorSurvey survey)
    {
        if (survey.YearsOfDrivingExperience < 0 || survey.YearsOfDrivingExperience > 100)
        {
            throw new ArgumentException("Years of driving experience must be between 0 and 100.");
        }

        if (!survey.HasDriverLicense && survey.YearsOfDrivingExperience > 0)
        {
            throw new ArgumentException("Driving experience must be 0 when no driving license is held.");
        }
        if (string.IsNullOrWhiteSpace(survey.PrimaryDrivingCountry))
        {
            throw new ArgumentException("Primary driving country is required.");
        }

        if (string.IsNullOrWhiteSpace(survey.DrivingFrequency))
        {
            throw new ArgumentException("Driving frequency selection is required.");
        }

        // Scenario validation rule
        bool selectedAnyScenario = survey.DrivingScenarioNighttime ||
                                   survey.DrivingScenarioSnowyWeather ||
                                   survey.DrivingScenarioHeavyRain ||
                                   survey.DrivingScenarioConstructionZone;

        if (survey.DrivingScenarioNone && selectedAnyScenario)
        {
            throw new ArgumentException("Cannot select 'None of the above' alongside specific driving scenarios.");
        }

        if (!survey.DrivingScenarioNone && !selectedAnyScenario)
        {
            throw new ArgumentException("Please select at least one driving scenario or 'None of the above'.");
        }
    }

    private static int CalculateAge(DateOnly dateOfBirth)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        int age = today.Year - dateOfBirth.Year;
        if (dateOfBirth > today.AddYears(-age))
        {
            age--;
        }
        return age;
    }
}
