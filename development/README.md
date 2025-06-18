# Development Directory

This directory contains the core application code for local development and testing.

## Structure

```
development/
├── index.js           # Main application entry point
├── config.js          # Configuration handling
├── package.json       # Node.js dependencies  
├── package-lock.json  # Dependency lock file
└── Dockerfile         # Development container build
```

## Local Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Chrome/Chromium browser (for Puppeteer)

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set environment variables**:
   ```bash
   export HA_BASE_URL="https://your-home-assistant.com:8123"
   export HA_SCREENSHOT_URL="/lovelace/dashboard?kiosk"
   export HA_ACCESS_TOKEN="your-long-lived-access-token"
   export RENDERING_SCREEN_WIDTH="600"
   export RENDERING_SCREEN_HEIGHT="800"
   ```

3. **Run the application**:
   ```bash
   node index.js
   ```

4. **Access screenshots**:
   - Navigate to `http://localhost:5000/`
   - Images are saved to `./output/` directory

### Environment Variables

All environment variables from the main application are supported. Key development variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `OUTPUT_PATH` | `./output` | Image output directory |
| `USE_IMAGE_MAGICK` | `false` | Use ImageMagick instead of GraphicsMagick |
| `UNSAFE_IGNORE_CERTIFICATE_ERRORS` | `false` | Ignore SSL certificate errors |

### Docker Development

Build and run the development container:

```bash
# Build the image
docker build -t inkplate-dev .

# Run with environment variables
docker run -p 5000:5000 \
  -e HA_BASE_URL="https://your-home-assistant.com:8123" \
  -e HA_SCREENSHOT_URL="/lovelace/dashboard?kiosk" \
  -e HA_ACCESS_TOKEN="your-token" \
  inkplate-dev
```

## Testing

### Manual Testing

1. **Test single screenshot**:
   ```bash
   curl http://localhost:5000/ -o test.png
   ```

2. **Test with parameters**:
   ```bash
   curl 'http://localhost:5000/?id=test&battery=85&charging=true' -o test.png
   ```

3. **Test multiple pages**:
   ```bash
   # Assuming HA_SCREENSHOT_URL_2 is configured
   curl http://localhost:5000/2 -o page2.png
   ```

### Debug Mode

Enable debug logging:

```bash
export DEBUG="*"
node index.js
```

## Code Structure

### `index.js`
- Main Express.js server
- Screenshot rendering logic
- MQTT client setup
- Battery reporting endpoints

### `config.js`  
- Environment variable parsing
- Configuration validation
- Multi-page URL handling

## Contributing

When making changes:

1. Test locally with `node index.js`
2. Test with Docker build
3. Verify MQTT functionality if enabled
4. Check image output quality

## Common Issues

- **Puppeteer fails**: Install Chrome/Chromium dependencies
- **MQTT connection fails**: Check broker settings and credentials
- **Images are blank**: Verify Home Assistant URL and access token
- **Permission denied**: Check file system permissions for output directory 