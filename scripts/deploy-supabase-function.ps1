param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('generateSpeech', 'generatePitchSpeech', 'regenerateNarration', 'generateBlockVideos', 'replicateGenerate', 'mixAudioVideo', 'admin-pages-tools', 'agent-conversations')]
  [string]$FunctionName
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$projectRef = 'dhpubzhobcccfbcmbvua'
$projectRoot = Split-Path -Parent $PSScriptRoot
$functionsRoot = Join-Path $projectRoot 'supabase\functions'
$functionPath = Join-Path $functionsRoot $FunctionName
$sharedPath = Join-Path $functionsRoot '_shared'

if (-not (Test-Path -LiteralPath (Join-Path $functionPath 'index.ts'))) {
  throw "Missing function entrypoint: $FunctionName/index.ts"
}
if (-not (Test-Path -LiteralPath $sharedPath)) {
  throw 'Missing supabase/functions/_shared'
}

Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class CodexCredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags;
    public uint Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credentialPtr);

  [DllImport("advapi32.dll", SetLastError=true)]
  private static extern void CredFree(IntPtr buffer);

  public static byte[] ReadGeneric(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    try {
      CREDENTIAL credential = Marshal.PtrToStructure<CREDENTIAL>(pointer);
      byte[] bytes = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
      return bytes;
    } finally {
      CredFree(pointer);
    }
  }
}
'@

$credentialBytes = [CodexCredentialReader]::ReadGeneric('Supabase CLI:supabase')
$accessToken = [Text.Encoding]::UTF8.GetString($credentialBytes).Trim([char]0)
if (-not $accessToken.StartsWith('sbp_')) {
  $accessToken = [Text.Encoding]::Unicode.GetString($credentialBytes).Trim([char]0)
}
if (-not $accessToken.StartsWith('sbp_')) {
  throw 'The stored Supabase credential is not a valid personal access token.'
}

try {
  $metadataObject = @{
    name = $FunctionName
    entrypoint_path = "$FunctionName/index.ts"
    verify_jwt = $true
  }
  $metadataJson = $metadataObject | ConvertTo-Json -Compress

  $client = [Net.Http.HttpClient]::new()
  $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $accessToken)
  $multipart = [Net.Http.MultipartFormDataContent]::new()
  $metadataContent = [Net.Http.StringContent]::new($metadataJson, [Text.Encoding]::UTF8, 'application/json')
  $multipart.Add($metadataContent, 'metadata')

  $sourceFiles = @(
    Get-ChildItem -LiteralPath $functionPath -File -Recurse
    Get-ChildItem -LiteralPath $sharedPath -File -Recurse
  )
  foreach ($sourceFile in $sourceFiles) {
    $relativePath = $sourceFile.FullName.Substring($functionsRoot.Length + 1).Replace('\', '/')
    $stream = [IO.File]::OpenRead($sourceFile.FullName)
    $content = [Net.Http.StreamContent]::new($stream)
    $content.Headers.ContentType = [Net.Http.Headers.MediaTypeHeaderValue]::new('application/octet-stream')
    $multipart.Add($content, 'file', $relativePath)
  }

  $endpoint = "https://api.supabase.com/v1/projects/$projectRef/functions/deploy?slug=$FunctionName"
  $response = $client.PostAsync($endpoint, $multipart).GetAwaiter().GetResult()
  $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if (-not $response.IsSuccessStatusCode) {
    throw "Supabase deploy failed ($([int]$response.StatusCode)): $body"
  }
  Write-Output "DEPLOYED:$FunctionName"
} finally {
  $accessToken = $null
  if ($multipart) { $multipart.Dispose() }
  if ($client) { $client.Dispose() }
}
