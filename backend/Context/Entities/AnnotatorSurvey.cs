namespace Context.Entities;

using System;
using System.ComponentModel.DataAnnotations;

/// <summary>
/// Anonymous survey entity capturing annotator driving background and demographics 
/// for statistical reporting. Contains NO foreign key to protect user anonymity.
/// </summary>
public class AnnotatorSurvey
{
    [Key]
    public int Id { get; set; }

    // --- Snapshotted Demographics (Copied from Registration for Anonymous Stats) ---

    [Required]
    [MaxLength(100)]
    public string Nationality { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Gender { get; set; } = string.Empty;

    [Required]
    [Range(18, 120)]
    public int Age { get; set; }

    // --- Question 1: Do you have a driving license? ---
    [Required]
    public bool HasDriverLicense { get; set; }

    // --- Question 2: What's the main country you mainly drive in? ---
    [Required]
    [MaxLength(100)]
    public string PrimaryDrivingCountry { get; set; } = string.Empty;

    // --- Question 3: How often do you drive? ---
    // Options: "Daily / Near Daily (5–7 days per week)", "Regular (2–4 days per week)", 
    // "Occasional (1–3 days per month)", "Infrequent (A few times per year)", "Inactive / Non-Driver"
    [Required]
    [MaxLength(100)]
    public string DrivingFrequency { get; set; } = string.Empty;

    // --- Question 4: Have you ever driven in any of these scenarios? (Multi-select) ---
    // Stored as individual boolean flags for fast SQL aggregation in Admin statistics
    public bool DrivingScenarioNighttime { get; set; }
    public bool DrivingScenarioSnowyWeather { get; set; }
    public bool DrivingScenarioHeavyRain { get; set; }
    public bool DrivingScenarioConstructionZone { get; set; }
    public bool DrivingScenarioNone { get; set; }

    // --- Question 5: Have you ever annotated datasets related to autonomous driving? ---
    [Required]
    public bool HasPriorDatasetAnnotationExperience { get; set; }

    // --- Question 6: Have you ever been involved in accidents in the last 5 years? ---
    [Required]
    public bool HasAccidentsInLastFiveYears { get; set; }


    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
}