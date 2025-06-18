# Extras Directory

This directory contains additional files and configurations that complement the Inkplate Dashboard addon but are not part of the core addon functionality.

## Files

### `mqtt_sensors.yaml`
**Purpose**: Home Assistant MQTT sensor configurations for tracking your e-ink devices.

**Features**:
- Battery level monitoring
- Charging status tracking  
- Refresh count statistics
- Device identification and grouping

**Usage**:
1. Copy the content to your Home Assistant `configuration.yaml` under the `mqtt:` section
2. Replace `your_device_id` with your actual device identifier
3. The device ID should match the `?id=` parameter your device sends in HTTP requests
4. Restart Home Assistant to load the new sensors

**Example**:
```yaml
mqtt:
  sensor: !include mqtt_sensors.yaml
```

### `battery_sensor_blueprint.yaml`
**Purpose**: Home Assistant blueprint for creating battery level automations.

**Usage**:
1. Go to Home Assistant Settings → Automations & Scenes → Blueprints
2. Click "Import Blueprint" 
3. Upload or paste this file
4. Create automations based on the blueprint

### `lovelace-eink-theme.yml`
**Purpose**: Custom Home Assistant theme optimized for e-ink displays.

**Features**:
- High contrast colors
- Simplified styling
- Reduced visual noise
- E-ink friendly color palette

**Usage**:
1. Copy to your Home Assistant `themes/` directory
2. Add to `configuration.yaml`:
   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
   ```
3. Restart Home Assistant
4. Select the theme in your user profile

## Device Setup

When setting up your e-ink device, make sure to:

1. **Set a unique device ID**: Use the `?id=your_device_name` parameter in your HTTP requests
2. **Enable battery reporting**: Add `?battery=85&charging=true` parameters if your device supports it
3. **Track refresh types**: Use `?refresh=full` or `?refresh=partial` to categorize refresh operations

## MQTT Topics

The addon publishes to these MQTT topics:
- `inkplate-dashboard/{deviceId}/battery` - Battery level (0-100%)
- `inkplate-dashboard/{deviceId}/charging` - Charging status (true/false)
- `inkplate-dashboard/{deviceId}/refresh` - Refresh count and type

## Multiple Devices

To track multiple devices, duplicate the sensor configurations in `mqtt_sensors.yaml` with different:
- Device IDs in the topic paths
- `unique_id` values  
- Sensor names
- Device identifiers 