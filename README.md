# HeyCharge Card for Home Assistant

A Lovelace card for controlling and monitoring your [HeyCharge CONNECT](https://heycharge.com/) device — pairs with the [HeyCharge CONNECT integration for Home Assistant](../integration/) and works with the [CONNECT Bridge](https://heycharge.com/products/connect-bridge) and [CONNECT MagicBox](https://heycharge.com/products/consumer-gateway).

![HeyCharge Card](screenshot.png)

## Features

- **Real-time monitoring** — live power, current, and energy tracking with animated indicators
- **Control** — stop the current session, adjust the current limit, pause/resume charging
- **Statistics** — current and last session energy, duration, and current request
- **Advanced view** — per-phase currents and charger state details
- **Responsive** — optimized for mobile, tablet, and desktop
- **Theme integration** — follows your Home Assistant theme for background, text, and accent colors
- **Visual config editor** — built-in card editor for easy setup

## Prerequisites

- Home Assistant 2023.1.0 or newer (HA 2026.3+ to render the integration's bundled brand icons)
- [HeyCharge CONNECT integration](../integration/) installed and configured
- A [CONNECT Bridge](https://heycharge.com/products/connect-bridge) (running OCPP Translator firmware) or [CONNECT MagicBox](https://heycharge.com/products/consumer-gateway) (running Consumer Gateway firmware) — both expose the local HTTP API the card and integration depend on

## Installation

### Manual

1. Copy the `dist/` contents to your Home Assistant config:

```bash
mkdir -p /path/to/homeassistant/config/www/heycharge-card
cp dist/heycharge-card.js /path/to/homeassistant/config/www/heycharge-card/
cp dist/heycharge-card-editor.js /path/to/homeassistant/config/www/heycharge-card/
cp -r dist/assets /path/to/homeassistant/config/www/heycharge-card/
```

2. Add the resource to your Lovelace configuration:

```yaml
resources:
  - url: /local/heycharge-card/heycharge-card.js
    type: module
```

3. Restart Home Assistant and clear your browser cache (Ctrl+F5)

### HACS

1. Open HACS in your Home Assistant instance.
2. Click the three-dot menu in the top-right → **Custom repositories**.
3. Add the URL `https://github.com/heycharge-hq/lovelace-heycharge-card` and pick **Dashboard** as the type.
4. Click **Download** on the new "HeyCharge Card" entry.
5. Hard-refresh your browser (Cmd/Ctrl + Shift + R).

## Configuration

### Basic (Auto-detection)

The card finds your HeyCharge entities automatically by looking for any entity with `platform: heycharge` in HA's entity registry. No config needed:

```yaml
type: custom:heycharge-card
```

### Full Configuration

```yaml
type: custom:heycharge-card
show_statistics: true                 # Show energy statistics section
show_advanced: false                  # Show advanced details section
compact_mode: false                   # Use compact layout for small cards
charger_name: Garage Charger          # Optional display-name override
entity_prefix: sensor.garage_         # Optional override (rare; see below)
device_id: A1B2C3D4                   # Optional manual device ID hint
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `show_statistics` | boolean | `true` | Display session energy and duration stats |
| `show_advanced` | boolean | `false` | Show per-phase currents and charger state details |
| `compact_mode` | boolean | `false` | Compact layout for smaller dashboard areas |
| `charger_name` | string | (auto) | Override the displayed charger name (defaults to the HA device title) |
| `entity_prefix` | string | (auto) | Override only if auto-detect fails — e.g. you renamed entities or are using legacy MQTT discovery. Card prefers the registry-based detect when this is unset. |
| `device_id` | string | (auto) | Manual device ID hint. Rarely needed; auto-detect picks one when the entity registry has any HeyCharge entity. |

## Entity Mapping

The card reads entities created by the [HeyCharge CONNECT integration](../integration/). With the integration's `_attr_has_entity_name = True`, HA derives entity IDs from the device name plus the entity key — e.g. a device named "Garage" produces `sensor.garage_charging_power`, `switch.garage_pause_charging`, etc. The card auto-discovers them by looking up `platform: heycharge` in the entity registry, so the exact prefix doesn't matter.

### Required Entities

| Entity ID Pattern | Integration Key | Used For |
|-------------------|-----------------|----------|
| `switch.*_pause_charging` | pause_charging | Pause/resume toggle |
| `sensor.*_charging_power` | charging_power | Main power display |
| `number.*_current_limit` | current_limit | Current limit slider |
| `sensor.*_charger_state` | charger_state | Status indicator |

### Optional Entities

| Entity ID Pattern | Integration Key | Used For |
|-------------------|-----------------|----------|
| `sensor.*_current_request` | current_request | Current request display and slider marker |
| `sensor.*_charging_current_l1` | charging_current_l1 | Phase 1 current (advanced) |
| `sensor.*_charging_current_l2` | charging_current_l2 | Phase 2 current (advanced) |
| `sensor.*_charging_current_l3` | charging_current_l3 | Phase 3 current (advanced) |
| `sensor.*_kwh_delivered` | kwh_delivered | Session energy stat |
| `sensor.*_last_session_energy` | last_session_energy | Previous session stat |
| `sensor.*_last_session_duration` | last_session_duration | Previous session stat |
| `sensor.*_current_session_duration` | current_session_duration | Current session stat |
| `binary_sensor.*_session_active` | session_active | Drives Stop-button visibility |
| `binary_sensor.*_p14a_enabled` | p14a_enabled | §14a status LED in header |
| `binary_sensor.*_p14a_active` | p14a_active | §14a curtailment indicator |
| `binary_sensor.*_heycharge_backend_enabled` | heycharge_backend_enabled | Backend status LED in header |
| `binary_sensor.*_heycharge_backend_connected` | heycharge_backend_connected | Backend connectivity indicator |
| `button.*_end_session` | end_session | Stop button |

## Card Sections

### Header
Shows charger name, a status pill (Ready, Charging, Error, etc.), and small indicator LEDs for §14a and HeyCharge-backend status when those features are configured on the device.

### Main Status
When a session is active, shows charging power (kW) and current (A), plus session energy and duration. When idle, shows an idle indicator instead.

### Controls
- **End Session** button (visible when a session is active)
- **Pause Charging** switch
- **Current Limit** slider (6-32A with tick marks; clamps to `current_request` when present)

### Statistics
- Current session energy and duration
- Last session energy and duration
- Current request from the EV

### Advanced (hidden by default)
- Charger state text
- Per-phase current readings (L1, L2, L3)

## Theming

The card consumes the standard Home Assistant theme variables (`--primary-color`, `--ha-card-background`, `--primary-text-color`, `--secondary-text-color`, `--divider-color`, `--error-color`, `--warning-color`, etc.), so it follows whatever theme you have applied. The status pill colors (blue for Ready, green for Charging) are intentionally fixed so the state reads consistently regardless of theme.

## Troubleshooting

### Card Not Showing

1. Clear browser cache (Ctrl+F5)
2. Check browser console (F12) for JS errors
3. Verify the resource is listed in **Settings > Dashboards > Resources**
4. Ensure the JS file is at the correct path under `config/www/`

### Entities Not Detected

1. Verify the HeyCharge integration is installed and connected to your CONNECT device
2. Check that entities exist in **Developer Tools > States**
3. Try specifying `device_id` manually in the card config
4. Adjust `entity_prefix` if your entity naming differs

### Controls Not Responding

1. Check that the gateway is reachable on the network
2. Look at Home Assistant logs for API errors
3. Verify entity permissions
4. Test controls via **Developer Tools > Services** (e.g. `button.press`)

### Slider Snapping Back

The card uses a 5-second latch on the current limit slider to prevent the value from snapping back to the firmware-reported value while you're adjusting it. If it still snaps back, the firmware may be rejecting the value (check logs).
