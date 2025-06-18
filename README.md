# Home Assistant Lovelace Inkplate Dashboard

![ci](https://github.com/cromulus/hass-lovelace-inkplate-dashboard/workflows/ci/badge.svg)

This tool can be used to display a Lovelace view of your Home Assistant instance on an e-ink device like a [jailbroken](https://www.mobileread.com/forums/showthread.php?t=320564) Kindle or an Inkplate. It regularly takes a screenshot which can be polled and displayed.

## Repository Structure

```
├── inkplate-dashboard/          # 📱 Home Assistant Addon
│   ├── config.yaml             # Addon configuration & schema
│   ├── Dockerfile              # Container build instructions  
│   ├── run.sh                  # Startup script
│   └── fonts/                  # Font configuration for e-ink
├── development/                # 🔧 Development & Testing
│   ├── index.js                # Main application logic
│   ├── config.js               # Configuration handling
│   ├── package.json            # Node.js dependencies
│   └── Dockerfile              # Development container
├── extras/                     # 🎁 Additional Resources
│   ├── mqtt_sensors.yaml       # MQTT sensor configurations
│   ├── battery_sensor_blueprint.yaml # HA automation blueprint
│   ├── lovelace-eink-theme.yml # E-ink optimized theme
│   └── README.md               # Usage instructions
└── assets/                     # 📸 Documentation images
```

## Credits
This project is a fork of the amazing [hass-lovelace-kindle-screensaver](https://github.com/sibbl/hass-lovelace-kindle-screensaver) by [sibbl](https://github.com/sibbl). A big thank you for all the hard work and inspiration!

## Sample image

![Sample image](https://raw.githubusercontent.com/cromulus/hass-lovelace-inkplate-dashboard/main/assets/sample.png)

## Features

This tool regularly takes a screenshot of a specific page of your home assistant setup. It converts it into the PNG/JPEG grayscale format which e-ink displays can display.

**Key Features:**
- 🖼️ **Multi-page support** - Render multiple dashboard pages
- 🔋 **Battery monitoring** - Track device battery levels via MQTT  
- 🎨 **E-ink optimization** - Custom fonts and color processing
- ⚡ **MQTT integration** - Publish device status and metrics
- 🎯 **Multiple output formats** - PNG, JPEG with customizable processing
- 🔄 **Flexible scheduling** - Configurable refresh intervals

## Quick Start

### Option 1: Home Assistant Add-on (Recommended)

1. **Add the repository** to Home Assistant:
   - Go to **Settings → Add-ons → Add-on Store**
   - Click the **⋮** menu → **Repositories**
   - Add: `https://github.com/cromulus/hass-lovelace-inkplate-dashboard`

2. **Install the addon**: Look for "Lovelace Inkplate Dashboard" and install it

3. **Configure**: Set your Home Assistant URL, access token, and display preferences

4. **Start**: The addon will begin taking screenshots on your configured schedule

### Option 2: Docker Container

```bash
docker run -d \
  --name inkplate-dashboard \
  -p 5000:5000 \
  -e HA_BASE_URL="https://your-hass-instance.com:8123" \
  -e HA_SCREENSHOT_URL="/lovelace/dashboard?kiosk" \
  -e HA_ACCESS_TOKEN="your-long-lived-access-token" \
  cromulus/hass-lovelace-inkplate-dashboard
```

### Option 3: Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  inkplate-dashboard:
    image: cromulus/hass-lovelace-inkplate-dashboard
    ports:
      - "5000:5000"
    environment:
      HA_BASE_URL: "https://your-hass-instance.com:8123"
      HA_SCREENSHOT_URL: "/lovelace/dashboard?kiosk"
      HA_ACCESS_TOKEN: "your-long-lived-access-token"
      RENDERING_SCREEN_WIDTH: 600
      RENDERING_SCREEN_HEIGHT: 800
    restart: unless-stopped
```

## Accessing Images

Once running, access your rendered images:
- **Main image**: `http://localhost:5000/`
- **Additional pages**: `http://localhost:5000/2`, `http://localhost:5000/3`, etc.
- **Device-specific**: `http://localhost:5000/?id=kitchen` (for device tracking)

## Configuration Reference

### Core Settings

| Environment Variable      | Example Value                         | Required | Description                                                                                      |
|--------------------------|---------------------------------------| -------- |--------------------------------------------------------------------------------------------------|
| `HA_BASE_URL`            | `https://your-hass-instance.com:8123` | ✅       | Base URL of your Home Assistant instance                                                         |
| `HA_SCREENSHOT_URL`      | `/lovelace/screensaver?kiosk`         | ✅       | Relative URL to screenshot (supports multiple pages with `_2`, `_3` suffix)                      |
| `HA_ACCESS_TOKEN`        | `eyJ0...`                             | ✅       | [Long-lived access token](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token) |
| `LANGUAGE`               | `en`                                  | ❌       | Browser and Home Assistant language                                                              |
| `CRON_JOB`               | `* * * * *`                           | ❌       | Screenshot schedule (cron format)                                                                |

### Display Settings

| Environment Variable      | Example Value | Description                                                    |
|--------------------------|---------------|----------------------------------------------------------------|
| `RENDERING_SCREEN_WIDTH`  | `600`         | Display width in pixels                                        |
| `RENDERING_SCREEN_HEIGHT` | `800`         | Display height in pixels                                       |
| `ROTATION`               | `90`          | Image rotation in degrees (0, 90, 180, 270)                   |
| `SCALING`                | `1.5`         | Zoom factor (1.0 = normal, 1.5 = 150% zoom)                   |
| `PREFERS_COLOR_SCHEME`   | `light`       | Browser color scheme (`light` or `dark`)                       |

### Image Processing

| Environment Variable | Example Value | Description                                                |
|---------------------|---------------|------------------------------------------------------------|
| `IMAGE_FORMAT`      | `png`         | Output format (`png` or `jpeg`)                            |
| `COLOR_MODE`        | `GrayScale`   | Color processing (`GrayScale` or `TrueColor`)              |
| `GRAYSCALE_DEPTH`   | `8`           | Bit depth for grayscale (1, 4, 8)                         |
| `DITHER`            | `true`        | Apply dithering for better e-ink display                   |
| `DITHER_ALGO`       | `Riemersma`   | Dithering algorithm (`Riemersma`, `FloydSteinberg`, `None`) |
| `REMOVE_GAMMA`      | `true`        | Remove gamma correction (recommended for e-ink)            |
| `CONTRAST`          | `1.2`         | Contrast multiplier                                        |
| `SATURATION`        | `0.8`         | Saturation multiplier                                      |
| `BLACK_LEVEL`       | `10%`         | Black point percentage                                     |
| `WHITE_LEVEL`       | `95%`         | White point percentage                                     |

### MQTT Integration

| Environment Variable | Example Value      | Description                    |
|---------------------|-------------------|--------------------------------|
| `MQTT_HOST`         | `core-mosquitto`  | MQTT broker hostname           |
| `MQTT_PORT`         | `1883`            | MQTT broker port               |
| `MQTT_USER`         | `homeassistant`   | MQTT username                  |
| `MQTT_PASSWORD`     | `your-password`   | MQTT password                  |
| `MQTT_PROTOCOL`     | `4`               | MQTT protocol version (4 or 5) |

### Battery Monitoring

| Environment Variable  | Example Value           | Description                                               |
|----------------------|------------------------|-----------------------------------------------------------|
| `HA_BATTERY_WEBHOOK` | `set_kindle_battery`   | Webhook name for battery level updates                    |

For multiple devices, use `HA_BATTERY_WEBHOOK_2`, `HA_BATTERY_WEBHOOK_3`, etc.

### Multi-Page Support

Create multiple dashboard views by adding numbered environment variables:

```yaml
HA_SCREENSHOT_URL: "/lovelace/main?kiosk"
HA_SCREENSHOT_URL_2: "/lovelace/weather?kiosk"  
HA_SCREENSHOT_URL_3: "/lovelace/security?kiosk"
ROTATION_2: "90"                                # Page 2 specific rotation
SCALING_3: "1.2"                               # Page 3 specific scaling
```

## Device Setup & Battery Monitoring

### MQTT Device Tracking

Your e-ink device can be tracked in Home Assistant using MQTT sensors. See `extras/mqtt_sensors.yaml` for ready-to-use sensor configurations.

**Device requests should include an ID parameter:**
```
http://your-server:5000/?id=kitchen_display&battery=85&charging=false
```

### Battery Level Integration

To enable battery monitoring:

1. **Configure the webhook** in Home Assistant (see `extras/battery_sensor_blueprint.yaml`)
2. **Set the webhook name** in `HA_BATTERY_WEBHOOK`
3. **Modify your device** to send battery parameters (see patches below)

#### Kindle Online Screensaver Patch

Modify `/mnt/us/extensions/onlinescreensaver/bin/update.sh`:

```bash
# Add before the wget command:
batteryLevel=`/usr/bin/powerd_test -s | awk -F: '/Battery Level/ {print substr($2, 0, length($2)-1) - 0}'`
isCharging=`/usr/bin/powerd_test -s | awk -F: '/Charging/ {print substr($2,2,length($2))}'`

# Modify the wget line:
if wget -q "$IMAGE_URI?batteryLevel=$batteryLevel&isCharging=$isCharging" -O $TMPFILE; then
```

## Additional Resources

- **📋 MQTT Sensors**: `extras/mqtt_sensors.yaml` - Copy-paste sensor configs
- **🔋 Battery Blueprint**: `extras/battery_sensor_blueprint.yaml` - HA automation template  
- **🎨 E-ink Theme**: `extras/lovelace-eink-theme.yml` - Optimized HA theme
- **📖 Detailed Setup**: `extras/README.md` - Complete usage guide

## Development

The `development/` directory contains the core application for local development and testing:

```bash
cd development/
npm install
node index.js
```

## Troubleshooting

### Common Issues

- **Addon not appearing**: Ensure repository structure has `inkplate-dashboard/config.yaml`
- **Blank images**: Check HA access token and URL accessibility  
- **MQTT not working**: Verify broker settings and credentials
- **Font rendering issues**: Check font configuration in `inkplate-dashboard/fonts/`

### Advanced Configuration

```yaml
# Ignore SSL certificate errors (use at your own risk)
UNSAFE_IGNORE_CERTIFICATE_ERRORS: true

# Custom output path
OUTPUT_PATH: "/custom/path"

# Extended timeouts
RENDERING_TIMEOUT: 30000
BROWSER_LAUNCH_TIMEOUT: 60000
```

## Support & Contributing

- 🐛 **Issues**: [GitHub Issues](https://github.com/cromulus/hass-lovelace-inkplate-dashboard/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/cromulus/hass-lovelace-inkplate-dashboard/discussions)  
- 🔧 **Pull Requests**: Welcome! Please read contributing guidelines

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
