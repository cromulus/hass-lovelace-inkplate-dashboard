# Troubleshooting Guide for Hass Inkplate Dashboard

## Common Issues and Solutions

### 1. MQTT Connection Errors

#### Error: `Connection refused: Not authorized` (Error code 5)

This error indicates MQTT authentication is failing. Here are the steps to resolve it:

**Step 1: Check MQTT Configuration**
In your Home Assistant addon configuration, ensure:
- `MQTT_HOST`: Usually `core-mosquitto` for HA add-on or your MQTT broker IP
- `MQTT_PORT`: Usually `1883` (or `8883` for SSL)  
- `MQTT_USER`: Your MQTT username (often `homeassistant`)
- `MQTT_PASSWORD`: **This is required** - set your MQTT broker password

**Step 2: Verify MQTT Broker Setup**
1. Go to Home Assistant Settings → Add-ons → Mosquitto broker
2. In the Configuration tab, make sure you have users configured:
```yaml
logins:
  - username: homeassistant
    password: your_secure_password
```
3. Restart the Mosquitto broker add-on

**Step 3: Update Dashboard Configuration**
Set the `MQTT_PASSWORD` in your dashboard add-on configuration to match the password from Step 2.

**Step 4: Graceful Degradation**
The updated code now supports running without MQTT. If you don't need MQTT features:
- Leave `MQTT_PASSWORD` empty
- The addon will log "running without MQTT support" and continue normally

### 2. Puppeteer Execution Context Errors

#### Error: `Execution context was destroyed, most likely because of a navigation`

This happens when Home Assistant redirects during the authentication setup process.

**What was fixed:**
- Added error handling around page navigation
- Implemented `evaluateOnNewDocument` for persistent localStorage setup
- Added page stabilization delays
- Graceful error recovery that allows the app to continue

**If you still see this error:**
1. Check that your `HA_BASE_URL` is correct and accessible
2. Verify your `HA_ACCESS_TOKEN` is valid
3. Consider increasing `RENDERING_TIMEOUT` if your HA instance is slow

### 3. Authentication Issues

#### Symptoms: Blank images or login screens instead of dashboard

**Solution:**
1. **Generate a Long-Lived Access Token:**
   - Go to Home Assistant Profile → Security tab
   - Scroll to "Long-lived access tokens"  
   - Click "Create Token"
   - Copy the token and set it as `HA_ACCESS_TOKEN`

2. **Verify URL accessibility:**
   - Make sure `HA_BASE_URL` points to your actual HA instance
   - Test the URL in a browser to ensure it's reachable
   - Use the full URL with protocol (http:// or https://)

### 4. Rendering Issues

#### Symptoms: Service keeps restarting or rendering fails

**Common fixes:**
1. **Increase timeouts:**
   ```yaml
   RENDERING_TIMEOUT: 60000
   BROWSER_LAUNCH_TIMEOUT: 30000
   ```

2. **Check screenshot URL:**
   - Use `/lovelace/0` for main dashboard
   - Add `?kiosk` for kiosk mode: `/lovelace/0?kiosk`
   - Verify the path exists in your Lovelace setup

3. **Memory issues:**
   - The addon needs sufficient memory for Puppeteer/Chrome
   - Consider reducing `RENDERING_SCREEN_HEIGHT/WIDTH` if needed

### 5. Network Connectivity

#### Error: Connection timeouts or network issues

**Solutions:**
1. **For Docker/Container setups:**
   - Ensure container can reach HA instance
   - Use container networking names if both are containerized
   - Check firewall rules

2. **For Home Assistant Add-on:**
   - Use `http://homeassistant.local:8123` for local HA
   - Or use the supervisor internal IP
   - Avoid localhost/127.0.0.1 in container environments

### 6. Debug Mode

Enable debug mode to troubleshoot rendering issues:

```yaml
DEBUG: true
```

This will:
- Run browser in non-headless mode (if GUI available)
- Provide more detailed logging
- Keep pages open for inspection

### 7. Health Check Endpoints

Monitor your instance health:
- `http://your-addon:5000/health` - Shows MQTT status and general health
- `http://your-addon:5000/debug/requests` - Recent request log
- `http://your-addon:5000/debug/refreshes` - Device refresh statistics

### 8. MQTT Topics for Monitoring

If MQTT is working, monitor these topics:
- `inkplate-dashboard/{deviceId}/battery` - Battery levels
- `inkplate-dashboard/{deviceId}/charging` - Charging status  
- `inkplate-dashboard/{deviceId}/refresh` - Refresh counts

### 9. Log Analysis

**Key log patterns to watch for:**
- ✅ `Connected to MQTT broker` - MQTT working
- ✅ `Express server running on port 5000` - Web server started
- ✅ `Starting first render...` - Rendering pipeline active
- ❌ `MQTT connection error` - Fix MQTT configuration
- ❌ `Execution context was destroyed` - Should be fixed with updates
- ❌ `Error serving image` - Check rendering and file permissions

### 10. Configuration Examples

**Minimal working configuration:**
```yaml
HA_BASE_URL: "http://homeassistant.local:8123"
HA_SCREENSHOT_URL: "/lovelace/0?kiosk"
HA_ACCESS_TOKEN: "your_long_lived_token_here"
MQTT_PASSWORD: ""  # Leave empty to disable MQTT
```

**Full configuration with MQTT:**
```yaml
HA_BASE_URL: "http://homeassistant.local:8123"
HA_SCREENSHOT_URL: "/lovelace/0?kiosk"
HA_ACCESS_TOKEN: "your_long_lived_token_here"
MQTT_HOST: "core-mosquitto"
MQTT_PORT: 1883
MQTT_USER: "homeassistant"
MQTT_PASSWORD: "your_mqtt_password"
```

## Getting Help

If you're still experiencing issues:

1. **Check the logs** in Home Assistant Add-ons → Inkplate Dashboard → Log tab
2. **Test the health endpoint** to verify basic functionality
3. **Enable debug mode** for more detailed information
4. **Create an issue** with logs and configuration (remove sensitive tokens!)

## Changes Made to Fix These Issues

1. **MQTT Error Handling:** Added graceful degradation when MQTT password is not configured
2. **Puppeteer Stability:** Improved page navigation handling and execution context management  
3. **Better Logging:** Enhanced error messages and connection status reporting
4. **Timeout Configuration:** Added proper connection timeouts and retry logic 