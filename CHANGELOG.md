# Changelog

## 1.1.6

### Fixed
* **CronJob Compatibility**: Fixed TypeError with cron library v3.2.0+ by using `CronJob.from()` static method instead of object-style constructor
* **Library Compatibility**: Updated cron job initialization to be compatible with newer cron library versions that deprecated object-first constructor pattern

## 1.1.5

### Enhanced
* **Browser Optimization**: Optimized Chromium launch flags for pixel-perfect e-ink rendering
* **Flag Organization**: Reorganized and documented browser flags with clear explanations for e-ink optimization
* **Rendering Quality**: Removed irrelevant color profile flag, prioritized critical sharpness flags
* **Comments**: Added detailed inline documentation for each rendering flag and its impact on e-ink displays

## 1.1.4

### Added
* **MQTT Integration**: Full MQTT support using Home Assistant Services API (automatic credential management, no user configuration needed)
* **Device Tracking**: Device refresh count tracking with MQTT publishing to `inkplate-dashboard/{deviceId}/refresh` topics
* **Battery Monitoring**: Enhanced battery status publishing to MQTT topics `inkplate-dashboard/{deviceId}/battery` and `inkplate-dashboard/{deviceId}/charging`
* **Debug Endpoints**: New `/debug/refreshes` and `/debug/requests` endpoints for monitoring device activity
* **Health Check**: Enhanced `/health` endpoint with MQTT connection status and device count
* **Request Logging**: In-memory request logging with device identification, battery levels, and refresh types
* **ImageMagick Validation**: Startup check to ensure ImageMagick is available before starting

### Fixed
* **Authentication**: Simplified and more reliable authentication approach matching proven working implementation
* **Puppeteer Compatibility**: Better handling of different Puppeteer versions with `waitForTimeout` method compatibility
* **Error Handling**: Improved error handling preventing ImageMagick crashes when screenshots fail
* **CronJob**: Fixed cronJob string conversion issue that could cause startup failures
* **File Safety**: Added input file existence checks before ImageMagick processing
* **Cleanup**: Better temporary file cleanup with error handling

### Enhanced
* **MQTT Topics**: Structured MQTT topic hierarchy for better Home Assistant integration
* **HTTP Caching**: Proper ETags, Last-Modified headers, and 304 Not Modified responses
* **Logging**: Enhanced server logs with device activity, battery status, and refresh type information
* **Error Messages**: Improved error messages with full command output for better debugging

## 1.1.0

### Added
 * A bunch of changes to how we launch Chrome to make screenshots crisper
 * Updated image procssing to use a modern library.
 * Added more image processing capabilities to make crisper images.
 * Added an express webserver, battery status is now a GET param and exposed over MQTT

## 1.0.14

### Added

* Bmp file format support for image generation (thanks to [@macmacs](https://github.com/macmacs))

## 1.0.13

### Added

* Allow configuring contrast, saturation, black level and white level. JPEG quality is set to 100% (thanks to [@harry48225](https://github.com/harry48225))

## 1.0.12

### Fixed

* Fix scaling bug by using zoom css property instead of transforms (thanks to [@avhm](https://github.com/avhm))

## 1.0.11

### Fixed

* Avoid viewport resize causing another rerender when taking screenshot (thanks to [@beeh5](https://github.com/beeh5))

## 1.0.10

### Fixed

* Fix REMOVE_GAMMA and DITHER always being enabled for Home Assistant Add-On

## 1.0.9

### Added

* Add jpeg support via new `IMAGE_TYPE` config env variable (thanks to [@nbarrientos](https://github.com/nbarrientos))

## 1.0.8

### Fixed

* Remove DITHER option from Home Assistant Add-On again until the gm/im incompatibility will be fixed

## 1.0.7

### Added

* Finally there's a changelog
* Allow custom environment variables to Home Assistant Add-On

### Fixed

* Add missing config variables to Home Assistant Add-On
