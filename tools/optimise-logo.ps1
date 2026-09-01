<#
  Resizes the master logo down to what the site actually needs, without
  losing transparency, and renders the Open Graph share image from it.
  Uses System.Drawing only, no external tools.

  Reads:   assets\logo-original-1024.png (the current public\images\logo.png
           is moved there first, the one time this hasn't happened yet)
  Writes:  public\images\logo.png (512x512, transparent)
           public\images\og.png   (1200x630, cream background, logo centred)

  Run: powershell -ExecutionPolicy Bypass -File tools\optimise-logo.ps1
#>

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $root "assets"
$originalPath = Join-Path $assetsDir "logo-original-1024.png"
$logoPath = Join-Path $root "public\images\logo.png"
$ogPath = Join-Path $root "public\images\og.png"

# One-off move: the first time this runs, the only copy of the full-size
# logo is still at public\images\logo.png. Move it to assets\ so it survives
# being overwritten below. Safe to re-run: does nothing once the move is done.
if (-not (Test-Path $originalPath)) {
  if (-not (Test-Path $logoPath)) {
    throw "Can't find the source logo at $originalPath or $logoPath."
  }
  New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
  Move-Item -Path $logoPath -Destination $originalPath
  Write-Host "Moved $logoPath to $originalPath"
}

$source = [System.Drawing.Bitmap]::FromFile($originalPath)
try {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logoPath) | Out-Null

  # --- public/images/logo.png: 512x512, transparency preserved ---
  # The source is already Format32bppArgb with alpha 0 at the edges. Drawing
  # into a fresh Format32bppArgb bitmap with CompositingMode SourceCopy
  # copies colour and alpha straight across instead of blending the
  # transparent edge pixels against anything, which is what keeps them clean.
  $logoSize = 512
  $logoBitmap = New-Object System.Drawing.Bitmap($logoSize, $logoSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $logoGraphics = [System.Drawing.Graphics]::FromImage($logoBitmap)
  try {
    $logoGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $logoGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $logoGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $logoGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $logoGraphics.DrawImage($source, 0, 0, $logoSize, $logoSize)
  }
  finally {
    $logoGraphics.Dispose()
  }
  $logoBitmap.Save($logoPath, [System.Drawing.Imaging.ImageFormat]::Png)

  # --- public/images/og.png: 1200x630, cream fill, logo centred at 520px tall ---
  $ogWidth = 1200
  $ogHeight = 630
  $ogBitmap = New-Object System.Drawing.Bitmap($ogWidth, $ogHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $ogGraphics = [System.Drawing.Graphics]::FromImage($ogBitmap)
  $creamBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#fdf9f1"))
  try {
    $ogGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $ogGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $ogGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Fill the background first with a straight copy so the canvas ends up
    # fully opaque, then switch to the default SourceOver so the logo's soft,
    # semi-transparent edges blend onto the cream instead of punching holes.
    $ogGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $ogGraphics.FillRectangle($creamBrush, 0, 0, $ogWidth, $ogHeight)
    $ogGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver

    $logoHeightOnOg = 520
    $aspect = $source.Width / $source.Height
    $logoWidthOnOg = [int][Math]::Round($logoHeightOnOg * $aspect)
    $logoX = [int](($ogWidth - $logoWidthOnOg) / 2)
    $logoY = [int](($ogHeight - $logoHeightOnOg) / 2)
    $ogGraphics.DrawImage($source, $logoX, $logoY, $logoWidthOnOg, $logoHeightOnOg)
  }
  finally {
    $creamBrush.Dispose()
    $ogGraphics.Dispose()
  }
  $ogBitmap.Save($ogPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $logoBitmap.Dispose()
  $ogBitmap.Dispose()
}
finally {
  $source.Dispose()
}

$logoSizeKB = [Math]::Round((Get-Item $logoPath).Length / 1KB, 1)
Write-Host "Wrote $logoPath ($logoSizeKB KB)"
if ($logoSizeKB -ge 200) {
  Write-Warning "logo.png is $logoSizeKB KB, at or over the 200KB target."
}
Write-Host "Wrote $ogPath"
