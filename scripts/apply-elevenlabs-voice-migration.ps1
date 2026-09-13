$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

$projectRef = 'dhpubzhobcccfbcmbvua'
$projectRoot = Split-Path -Parent $PSScriptRoot
$migrationPath = Join-Path $projectRoot 'supabase\migrations\20260816164000_migrate_voice_aliases_to_elevenlabs.sql'
if (-not (Test-Path -LiteralPath $migrationPath)) { throw 'Voice migration file is missing.' }

Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class CodexMigrationCredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags; public uint Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
    public uint AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError=true)] private static extern void CredFree(IntPtr buffer);
  public static byte[] ReadGeneric(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      CREDENTIAL credential = Marshal.PtrToStructure<CREDENTIAL>(pointer);
      byte[] bytes = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
      return bytes;
    } finally { CredFree(pointer); }
  }
}
'@

$credentialBytes = [CodexMigrationCredentialReader]::ReadGeneric('Supabase CLI:supabase')
$accessToken = [Text.Encoding]::UTF8.GetString($credentialBytes).Trim([char]0)
if (-not $accessToken.StartsWith('sbp_')) { $accessToken = [Text.Encoding]::Unicode.GetString($credentialBytes).Trim([char]0) }
if (-not $accessToken.StartsWith('sbp_')) { throw 'Stored Supabase token is invalid.' }

$client = [Net.Http.HttpClient]::new()
try {
  $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $accessToken)
  [string]$sql = [IO.File]::ReadAllText($migrationPath)
  $payloadObject = New-Object PSObject -Property @{ query = $sql; read_only = $false }
  $payload = ConvertTo-Json -InputObject $payloadObject -Compress
  $content = [Net.Http.StringContent]::new($payload, [Text.Encoding]::UTF8, 'application/json')
  $endpoint = "https://api.supabase.com/v1/projects/$projectRef/database/query"
  $response = $client.PostAsync($endpoint, $content).GetAwaiter().GetResult()
  $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if (-not $response.IsSuccessStatusCode) { throw "Voice migration failed ($([int]$response.StatusCode)): $body" }
  Write-Output 'MIGRATED:elevenlabs-voice-aliases'
} finally {
  $accessToken = $null
  if ($content) { $content.Dispose() }
  if ($client) { $client.Dispose() }
}
