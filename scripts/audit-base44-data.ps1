param(
    [Parameter(Mandatory = $true)]
    [string]$ExportDirectory,

    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$schemaDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'base44\entities'
$metadataColumns = @(
    'id',
    'created_date',
    'updated_date',
    'created_by_id',
    'created_by',
    'is_sample'
)

if (-not (Test-Path -LiteralPath $ExportDirectory -PathType Container)) {
    throw "Dossier d'export introuvable : $ExportDirectory"
}

$results = foreach ($csvFile in Get-ChildItem -LiteralPath $ExportDirectory -Filter '*_export.csv' | Sort-Object Name) {
    $entityName = $csvFile.BaseName -replace '_export$', ''
    $schemaPath = Join-Path $schemaDirectory "$entityName.jsonc"
    $schemaExists = Test-Path -LiteralPath $schemaPath -PathType Leaf
    $header = Get-Content -LiteralPath $csvFile.FullName -TotalCount 1
    $rows = @(if ([string]::IsNullOrWhiteSpace($header)) {
        @()
    } else {
        Import-Csv -LiteralPath $csvFile.FullName
    })

    $actualColumns = if ($rows.Count -gt 0) {
        @($rows[0].PSObject.Properties.Name)
    } elseif (-not [string]::IsNullOrWhiteSpace($header)) {
        @((ConvertFrom-Csv -InputObject @($header, '') | Select-Object -First 1).PSObject.Properties.Name)
    } else {
        @()
    }

    $requiredColumns = @()
    $expectedColumns = @($metadataColumns)
    if ($schemaExists) {
        $schema = Get-Content -LiteralPath $schemaPath -Raw | ConvertFrom-Json
        $schemaColumns = @($schema.properties.PSObject.Properties.Name)
        $requiredColumns = @($schema.required)
        $expectedColumns += $schemaColumns
    }

    $unknownColumns = @($actualColumns | Where-Object { $_ -notin $expectedColumns })
    $missingColumns = if ($actualColumns.Count -eq 0) {
        @()
    } else {
        @($expectedColumns | Where-Object { $_ -notin $actualColumns })
    }

    $blankIds = 0
    $duplicateIds = 0
    $rowsMissingRequired = 0
    if ($rows.Count -gt 0) {
        if ('id' -in $actualColumns) {
            $blankIds = @($rows | Where-Object { [string]::IsNullOrWhiteSpace($_.id) }).Count
            $duplicateIds = @(
                $rows |
                    Where-Object { -not [string]::IsNullOrWhiteSpace($_.id) } |
                    Group-Object id |
                    Where-Object Count -gt 1
            ).Count
        }

        if ($requiredColumns.Count -gt 0) {
            $rowsMissingRequired = @(
                $rows | Where-Object {
                    $row = $_
                    @($requiredColumns | Where-Object {
                        [string]::IsNullOrWhiteSpace($row.$_)
                    }).Count -gt 0
                }
            ).Count
        }
    }

    [pscustomobject]@{
        entity = $entityName
        rows = $rows.Count
        columns = $actualColumns.Count
        schema_exists = $schemaExists
        blank_ids = $blankIds
        duplicate_id_groups = $duplicateIds
        rows_missing_required = $rowsMissingRequired
        unknown_columns = @($unknownColumns)
        missing_columns = @($missingColumns)
    }
}

$summary = [pscustomobject]@{
    csv_files = @($results).Count
    non_empty_files = @($results | Where-Object rows -gt 0).Count
    empty_files = @($results | Where-Object rows -eq 0).Count
    records = ($results | Measure-Object rows -Sum).Sum
    files_without_schema = @($results | Where-Object { -not $_.schema_exists }).Count
    blank_ids = ($results | Measure-Object blank_ids -Sum).Sum
    duplicate_id_groups = ($results | Measure-Object duplicate_id_groups -Sum).Sum
    rows_missing_required = ($results | Measure-Object rows_missing_required -Sum).Sum
    files_with_unknown_columns = @($results | Where-Object { $_.unknown_columns.Count -gt 0 }).Count
}

$audit = [pscustomobject]@{
    generated_at = (Get-Date).ToString('o')
    export_directory = (Resolve-Path -LiteralPath $ExportDirectory).Path
    summary = $summary
    entities = @($results)
}

if ($OutputPath) {
    $audit | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
}

$summary | Format-List
