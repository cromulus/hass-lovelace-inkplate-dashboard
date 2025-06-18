# Lovelace Inkplate Dashboard - Configuration Documentation

## Table of Contents
- [Quick Start](#quick-start)
- [Configuration Options](#configuration-options)
- [E-ink Image Optimization](#e-ink-image-optimization)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)
- [Advanced Configuration](#advanced-configuration)
- [MQTT Integration](#mqtt-integration)

## Quick Start

### Basic Setup
1. Install the add-on from the Home Assistant Add-on Store
2. Configure your screenshot URL: `/lovelace/your-dashboard?kiosk`
3. Start the add-on
4. Access your images at: `http://your-ha-instance:5000/`

### Essential Configuration
```yaml
HA_SCREENSHOT_URL: '/lovelace/0?kiosk'
RENDERING_SCREEN_WIDTH: 600   # Your display width
RENDERING_SCREEN_HEIGHT: 800  # Your display height
ROTATION: 0                   # 0, 90, 180, or 270 degrees
```

## Configuration Options

### Core Settings

| Option | Default | Description |
|--------|---------|-------------|
| `HA_BASE_URL` | auto-detected | Home Assistant URL (leave empty for auto-detection) |
| `HA_ACCESS_TOKEN` | auto-detected | Long-lived access token (leave empty for auto-detection) |
| `HA_SCREENSHOT_URL` | `/lovelace/0` | Dashboard path to screenshot |
| `LANGUAGE` | `en` | Browser language |
| `CRON_JOB` | `* * * * *` | Screenshot schedule (every minute) |

### Display Settings

| Option | Default | Description |
|--------|---------|-------------|
| `RENDERING_SCREEN_WIDTH` | `600` | Display width in pixels |
| `RENDERING_SCREEN_HEIGHT` | `800` | Display height in pixels |
| `ROTATION` | `0` | Image rotation (0, 90, 180, 270) |
| `SCALING` | `1` | Zoom factor (0.5-3.0) |
| `RENDERING_DELAY` | `0` | Wait time before screenshot (ms) |

### Image Processing

| Option | Default | Description |
|--------|---------|-------------|
| `IMAGE_FORMAT` | `png` | Output format (png, jpeg, bmp) |
| `GRAYSCALE_DEPTH` | `8` | Bit depth (1, 4, 8) |
| `DITHER` | `true` | Apply dithering for better e-ink display |
| `DITHER_ALGO` | `Riemersma` | Algorithm (Riemersma, FloydSteinberg, None) |

### Image Enhancement

| Option | Default | Description |
|--------|---------|-------------|
| `CONTRAST` | `1` | Contrast multiplier (0.5-3.0) |
| `SATURATION` | `1` | Saturation multiplier (0-2.0) |
| `BLACK_LEVEL` | `0%` | Black point adjustment |
| `WHITE_LEVEL` | `100%` | White point adjustment |
| `SHARPEN` | _(none)_ | Unsharp mask filter (e.g., "0x1") |

### System Settings

| Option | Default | Description |
|--------|---------|-------------|
| `USE_IMAGE_MAGICK` | `true` | Use ImageMagick for processing |
| `DEBUG` | `false` | Enable debug mode |
| `RENDERING_TIMEOUT` | `10000` | Page load timeout (ms) |
| `BROWSER_LAUNCH_TIMEOUT` | `30000` | Browser startup timeout (ms) |

## E-ink Image Optimization

### 🔧 Fix Common Issues

#### Washed Out / Faint / Overexposed Images
**Problem**: Images look pale, low contrast, hard to read

**Solutions**:
```yaml
CONTRAST: 1.5           # Increase contrast
BLACK_LEVEL: 5%         # Darken blacks  
WHITE_LEVEL: 95%        # Brighten whites
DITHER: true            # Enable dithering
DITHER_ALGO: Riemersma  # Use best dithering
```

#### Tiny / Hard to Read Text
**Problem**: Text is too small to read clearly

**Solutions**:
```yaml
SCALING: 1.5            # Zoom content 150%
SHARPEN: "0x1"          # Sharpen text edges
RENDERING_SCREEN_WIDTH: 800   # Match your display exactly
RENDERING_SCREEN_HEIGHT: 600  # Match your display exactly
```

#### Blurry or Unclear Images
**Problem**: Images lack sharpness

**Solutions**:
```yaml
SHARPEN: "0x1"          # Light sharpening
DITHER: true            # Better pixel placement
GRAYSCALE_DEPTH: 8      # Maximum color depth
```

### 📱 Display-Specific Recommendations

#### Inkplate 6 (800x600)
```yaml
RENDERING_SCREEN_WIDTH: 800
RENDERING_SCREEN_HEIGHT: 600
SCALING: 1.2
CONTRAST: 1.3
BLACK_LEVEL: 10%
WHITE_LEVEL: 90%
SHARPEN: "0x1"
```

#### Inkplate 10 (1200x825)
```yaml
RENDERING_SCREEN_WIDTH: 1200
RENDERING_SCREEN_HEIGHT: 825
SCALING: 1.0
CONTRAST: 1.2
BLACK_LEVEL: 5%
WHITE_LEVEL: 95%
SHARPEN: "0x0.5"
```

#### Kindle Paperwhite (1072x1448)
```yaml
RENDERING_SCREEN_WIDTH: 1072
RENDERING_SCREEN_HEIGHT: 1448
SCALING: 1.5
CONTRAST: 1.4
BLACK_LEVEL: 15%
WHITE_LEVEL: 85%
DITHER_ALGO: FloydSteinberg
```

### 🎨 Color Scheme Optimization

#### Light Mode (Recommended)
```yaml
PREFERS_COLOR_SCHEME: light
CONTRAST: 1.3
SATURATION: 0          # Remove colors completely
```

#### Dark Mode
```yaml
PREFERS_COLOR_SCHEME: dark
CONTRAST: 1.5
BLACK_LEVEL: 20%
WHITE_LEVEL: 80%
```

## Troubleshooting Common Issues

### Image Quality Problems

#### ❌ Text is barely visible
```yaml
# Increase contrast aggressively
CONTRAST: 2.0
BLACK_LEVEL: 20%
WHITE_LEVEL: 80%
SHARPEN: "0x2"
```

#### ❌ Images are too dark
```yaml
# Brighten the image
CONTRAST: 0.8
BLACK_LEVEL: 0%
WHITE_LEVEL: 100%
```

#### ❌ Everything looks gray/muddy
```yaml
# Increase contrast and use dithering
CONTRAST: 1.8
DITHER: true
DITHER_ALGO: Riemersma
GRAYSCALE_DEPTH: 1     # Pure black and white only
```

#### ❌ Fine details are lost
```yaml
# Preserve detail with sharpening
SHARPEN: "0x1"
DITHER: true
GRAYSCALE_DEPTH: 8
```

### Rendering Problems

#### ❌ Blank or white images
- Check `HA_SCREENSHOT_URL` is correct
- Verify dashboard exists and is accessible
- Try adding `?kiosk` to the URL
- Check browser console in debug mode

#### ❌ Login screen instead of dashboard
- Generate a long-lived access token
- Set `HA_ACCESS_TOKEN` or leave empty for auto-detection
- Verify token has correct permissions

#### ❌ Rendering too slow
```yaml
RENDERING_TIMEOUT: 30000
RENDERING_DELAY: 2000    # Wait for slow dashboards
BROWSER_LAUNCH_TIMEOUT: 60000
```

### Size and Layout Issues

#### ❌ Content doesn't fit the screen
```yaml
# Adjust scaling to fit content
SCALING: 0.8            # Shrink content
RENDERING_SCREEN_WIDTH: 800   # Must match your display
RENDERING_SCREEN_HEIGHT: 600  # Must match your display
```

#### ❌ Text is too small to read
```yaml
# Zoom in for better readability
SCALING: 1.5
SHARPEN: "0x1"
```

#### ❌ Wrong orientation
```yaml
ROTATION: 90            # Rotate 90 degrees clockwise
# Or: 180 (upside down), 270 (90° counter-clockwise)
```

## Advanced Configuration

### Multiple Dashboards
Configure multiple pages using numbered suffixes:

```yaml
HA_SCREENSHOT_URL: '/lovelace/main?kiosk'
HA_SCREENSHOT_URL_2: '/lovelace/weather?kiosk'
HA_SCREENSHOT_URL_3: '/lovelace/security?kiosk'
ROTATION_2: 90          # Page 2 specific rotation
SCALING_3: 1.5          # Page 3 specific scaling
```

Access them at:
- Page 1: `http://your-server:5000/1`
- Page 2: `http://your-server:5000/2`
- Page 3: `http://your-server:5000/3`

### Custom Scheduling
```yaml
# Every 5 minutes
CRON_JOB: '*/5 * * * *'

# Every hour at :30
CRON_JOB: '30 * * * *'

# Once daily at 6 AM
CRON_JOB: '0 6 * * *'

# Weekdays only at 8 AM
CRON_JOB: '0 8 * * 1-5'
```

### Performance Tuning
```yaml
RENDERING_TIMEOUT: 15000     # Increase for slow dashboards
RENDERING_DELAY: 1000        # Wait for animations to complete
BROWSER_LAUNCH_TIMEOUT: 45000 # Increase for slow systems
```

## MQTT Integration

When MQTT is available, the add-on automatically publishes device metrics:

### Topics Published
- `inkplate-dashboard/{deviceId}/battery` - Battery level updates
- `inkplate-dashboard/{deviceId}/charging` - Charging status
- `inkplate-dashboard/{deviceId}/refresh` - Refresh count tracking

### Device Parameters
Include these in your device requests:
```
http://your-server:5000/?id=kitchen&battery=85&charging=false&refresh=full
```

### Sensor Configuration
See `extras/mqtt_sensors.yaml` for ready-to-use Home Assistant sensor configurations.

## Best Practices

### 🎯 E-ink Optimization Checklist
1. **✅ Use proper screen dimensions** - Must match your device exactly
2. **✅ Enable dithering** - `DITHER: true` for better grayscale conversion
3. **✅ Increase contrast** - `CONTRAST: 1.3-1.5` for better readability
4. **✅ Adjust levels** - `BLACK_LEVEL: 5-15%`, `WHITE_LEVEL: 85-95%`
5. **✅ Add sharpening** - `SHARPEN: "0x1"` for crisp text
6. **✅ Use appropriate scaling** - `SCALING: 1.2-1.5` for readability
7. **✅ Remove colors** - `SATURATION: 0` for pure grayscale

### 🚀 Performance Tips
- Use light themes when possible
- Minimize dashboard complexity
- Avoid animations and auto-refreshing content
- Use kiosk mode (`?kiosk`) to hide UI elements
- Set appropriate rendering delays for complex dashboards

### 🔒 Security
- Use long-lived access tokens with minimal required permissions
- Consider using automatic token detection instead of manual configuration
- Regularly rotate access tokens
- Use HTTPS for production deployments

---

**Need Help?** Check the logs in Home Assistant → Add-ons → Lovelace Inkplate Dashboard → Log tab 