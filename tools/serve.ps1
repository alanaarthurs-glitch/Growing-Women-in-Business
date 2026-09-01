<#
  Local preview server for the Growing Women in Business site.
  No Node required. Serves public/ on http://localhost:8080/ with clean
  URLs, a 404 page and stub POST /api/* responses so forms can be tested.

  Run:   powershell -ExecutionPolicy Bypass -File tools\serve.ps1
  Stop:  Ctrl+C
#>

$publicDir = Join-Path (Split-Path -Parent $PSScriptRoot) "public"
$publicDir = (Resolve-Path $publicDir).Path
$prefix = "http://localhost:8080/"

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".xml"  = "application/xml; charset=utf-8"
  ".txt"  = "text/plain; charset=utf-8"
  ".pdf"  = "application/pdf"
}

function Write-ResponseBytes($response, $bytes, $contentType, $statusCode, $isHead) {
  $response.StatusCode = $statusCode
  $response.ContentType = $contentType
  $response.ContentLength64 = $bytes.Length
  # A HEAD reply carries the same headers as GET but no body: HttpListener
  # throws if you write any bytes to the stream on a HEAD response.
  if (-not $isHead) {
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  }
  $response.OutputStream.Close()
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $publicDir"
Write-Host "Listening on $prefix (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
    $isHead = $request.HttpMethod -eq "HEAD"

    Write-Host "$($request.HttpMethod) $urlPath"

    try {
      if ($urlPath.StartsWith("/api/")) {
        if ($request.HttpMethod -eq "POST") {
          $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
          Write-ResponseBytes $response $bytes "application/json; charset=utf-8" 200 $isHead
        } else {
          $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":false,"error":"Method not allowed"}')
          Write-ResponseBytes $response $bytes "application/json; charset=utf-8" 405 $isHead
        }
        continue
      }

      $relativePath = $urlPath.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
      if ([string]::IsNullOrEmpty($relativePath)) { $relativePath = "index.html" }
      $filePath = Join-Path $publicDir $relativePath

      if ((Test-Path $filePath -PathType Container)) {
        $filePath = Join-Path $filePath "index.html"
      } elseif (-not (Test-Path $filePath -PathType Leaf)) {
        if ([string]::IsNullOrEmpty([System.IO.Path]::GetExtension($filePath))) {
          $htmlPath = "$filePath.html"
          if (Test-Path $htmlPath -PathType Leaf) { $filePath = $htmlPath }
        }
      }

      $fullFilePath = [System.IO.Path]::GetFullPath($filePath)
      $withinPublic = $fullFilePath.StartsWith([System.IO.Path]::GetFullPath($publicDir), [System.StringComparison]::OrdinalIgnoreCase)

      if ($withinPublic -and (Test-Path $fullFilePath -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($fullFilePath).ToLowerInvariant()
        $contentType = $mimeTypes[$ext]
        if (-not $contentType) { $contentType = "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($fullFilePath)
        Write-ResponseBytes $response $bytes $contentType 200 $isHead
      } else {
        $notFoundPath = Join-Path $publicDir "404.html"
        if (Test-Path $notFoundPath -PathType Leaf) {
          $bytes = [System.IO.File]::ReadAllBytes($notFoundPath)
          Write-ResponseBytes $response $bytes "text/html; charset=utf-8" 404 $isHead
        } else {
          $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
          Write-ResponseBytes $response $bytes "text/plain; charset=utf-8" 404 $isHead
        }
      }
    } catch {
      # A single bad request should never take the whole server down.
      Write-Host "Request error: $($_.Exception.Message)"
      try { $response.OutputStream.Close() } catch {}
    }
  }
}
finally {
  $listener.Stop()
  $listener.Close()
  Write-Host "Server stopped."
}
