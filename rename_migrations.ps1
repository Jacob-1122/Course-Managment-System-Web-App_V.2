$renames = @{
    "Initial Schema Setup.sql" = "00000000000000_initial_schema_setup.sql"
    "20250311145919_cool_ocean.sql" = "20250311145919_create_initial_admin_user.sql"
    "20250311151134_quick_spring.sql" = "20250311151134_update_course_schema_and_add_logging.sql"
    "20250311151820_hidden_canyon.sql" = "20250311151820_create_user_profiles_and_policies.sql"
    "20250311152029_rough_sunset.sql" = "20250311152029_add_course_metadata.sql"
    "20250311152210_bronze_smoke.sql" = "20250311152210_add_enrollment_constraints.sql"
    "20250311152523_little_gate.sql" = "20250311152523_create_role_based_management_system.sql"
    "20250311152745_icy_sunset.sql" = "20250311152745_add_course_scheduling.sql"
    "20250311152940_frosty_shore.sql" = "20250311152940_add_student_progress_tracking.sql"
    "20250311154033_dawn_lantern.sql" = "20250311154033_add_course_materials.sql"
    "20250311154200_young_grass.sql" = "20250311154200_add_notifications_system.sql"
    "20250311154329_floating_wind.sql" = "20250311154329_add_assessment_system.sql"
    "20250311154652_delicate_wood.sql" = "20250311154652_add_course_prerequisites.sql"
    "20250311155119_maroon_waterfall.sql" = "20250311155119_add_instructor_office_hours.sql"
    "20250311155624_icy_shadow.sql" = "20250311155624_add_student_attendance.sql"
    "20250311155704_dark_butterfly.sql" = "20250311155704_add_course_discussions.sql"
    "20250311161840_young_sun.sql" = "20250311161840_add_assignment_submissions.sql"
    "20250311162219_fancy_lagoon.sql" = "20250311162219_add_grading_system.sql"
    "20250311162916_silent_credit.sql" = "20250311162916_add_course_feedback.sql"
    "20250311164522_billowing_paper.sql" = "20250311164522_add_course_resources.sql"
    "20250311164645_silent_portal.sql" = "20250311164645_add_student_groups.sql"
    "20250311164656_silent_manor.sql" = "20250311164656_add_course_announcements.sql"
    "20250311164931_azure_disk.sql" = "20250311164931_add_file_storage.sql"
    "20250311165250_turquoise_bird.sql" = "20250311165250_add_course_calendar.sql"
    "20250311170239_soft_mountain.sql" = "20250311170239_add_user_settings.sql"
    "20250311171005_silver_grove.sql" = "20250311171005_add_course_analytics.sql"
    "20250311172159_little_snow.sql" = "20250311172159_add_course_export.sql"
}

$migrationsPath = "supabase/migrations"

# Create backup directory
$backupPath = "supabase/migrations_backup"
if (-not (Test-Path $backupPath)) {
    New-Item -ItemType Directory -Path $backupPath
}

# Copy all files to backup
Copy-Item "$migrationsPath/*" $backupPath -Force

# Perform renames
foreach ($rename in $renames.GetEnumerator()) {
    $oldPath = Join-Path $migrationsPath $rename.Key
    $newPath = Join-Path $migrationsPath $rename.Value
    
    if (Test-Path $oldPath) {
        Write-Host "Renaming '$($rename.Key)' to '$($rename.Value)'"
        Rename-Item -Path $oldPath -NewName $rename.Value -Force
    } else {
        Write-Host "Warning: Could not find file '$($rename.Key)'"
    }
}

Write-Host "`nMigration files have been renamed. Backup of original files is stored in $backupPath" 