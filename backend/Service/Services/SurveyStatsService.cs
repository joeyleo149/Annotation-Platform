namespace Service.Services;

using Context;
using Context.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public class StatCountGroup
{
    public string Label { get; set; } = string.Empty;
    public int Count { get; set; }
    public double Percentage { get; set; }
}

public class SurveyStatsResult
{
    public int TotalResponses { get; set; }
    public double LicenseHolderPercentage { get; set; }
    public List<StatCountGroup> TopCountries { get; set; } = [];
    public List<StatCountGroup> DrivingFrequencyDistribution { get; set; } = [];
    public Dictionary<string, int> ScenarioPrevalence { get; set; } = [];
    public double PriorAnnotationExperiencePercentage { get; set; }
    public double AccidentHistoryPercentage { get; set; }
    public double AverageAge { get; set; }
    public double AverageYearsExperience { get; set; }
}

public interface ISurveyStatsService
{
    Task<SurveyStatsResult> GetOverallStatsAsync();
}

public class SurveyStatsService : ISurveyStatsService
{
    private readonly AppDbContext _context;

    public SurveyStatsService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<SurveyStatsResult> GetOverallStatsAsync()
    {
        var surveys = await _context.Set<AnnotatorSurvey>()
            .AsNoTracking()
            .ToListAsync();

        int total = surveys.Count;
        if (total == 0)
        {
            return new SurveyStatsResult { TotalResponses = 0 };
        }

        // Aggregate statistics from live survey entities
        double licensePct = Math.Round((surveys.Count(s => s.HasDriverLicense) / (double)total) * 100, 1);
        double priorExpPct = Math.Round((surveys.Count(s => s.HasPriorDatasetAnnotationExperience) / (double)total) * 100, 1);
        double accidentPct = Math.Round((surveys.Count(s => s.HasAccidentsInLastFiveYears) / (double)total) * 100, 1);
        double avgAge = Math.Round(surveys.Average(s => s.Age), 1);
        double avgExp = Math.Round(surveys.Average(s => s.YearsOfDrivingExperience), 1);

        var topCountries = surveys
            .GroupBy(s => s.PrimaryDrivingCountry)
            .Select(g => new StatCountGroup
            {
                Label = g.Key,
                Count = g.Count(),
                Percentage = Math.Round((g.Count() / (double)total) * 100, 1)
            })
            .OrderByDescending(c => c.Count)
            .Take(5)
            .ToList();

        var frequencies = surveys
            .GroupBy(s => s.DrivingFrequency)
            .Select(g => new StatCountGroup
            {
                Label = g.Key,
                Count = g.Count(),
                Percentage = Math.Round((g.Count() / (double)total) * 100, 1)
            })
            .OrderByDescending(f => f.Count)
            .ToList();

        var scenarios = new Dictionary<string, int>
        {
            { "Nighttime", surveys.Count(s => s.DrivingScenarioNighttime) },
            { "Snowy Weather", surveys.Count(s => s.DrivingScenarioSnowyWeather) },
            { "Heavy Rain", surveys.Count(s => s.DrivingScenarioHeavyRain) },
            { "Construction Zone", surveys.Count(s => s.DrivingScenarioConstructionZone) },
            { "None / Public Transit Only", surveys.Count(s => s.DrivingScenarioNone) }
        };

        return new SurveyStatsResult
        {
            TotalResponses = total,
            LicenseHolderPercentage = licensePct,
            TopCountries = topCountries,
            DrivingFrequencyDistribution = frequencies,
            ScenarioPrevalence = scenarios,
            PriorAnnotationExperiencePercentage = priorExpPct,
            AccidentHistoryPercentage = accidentPct,
            AverageAge = avgAge,
            AverageYearsExperience = avgExp
        };
    }
}