# HeyCharge Card

A modern Home Assistant Lovelace card for controlling and monitoring your HeyCharge EV charger via the HeyCharge Gateway Integration (HTTP REST API).

## Features

- Real-time power, current, and energy monitoring with animated indicators
- Start/stop charging sessions with company car mode support
- Current limit slider (6-32A) with live feedback
- Session statistics (energy, duration, current request)
- Per-phase current readings in advanced view
- Responsive layout for mobile, tablet, and desktop
- Automatic theme integration

## What's Displayed

### Main Status
- Current charging power (kW) with approximate amps
- Charger state with animated status indicator
- Session type badge (Personal/Company)

### Controls
- Start charging buttons (Personal/Company modes)
- Stop charging button
- Pause charging switch
- Current limit slider (6-32A)

### Statistics
- Current session duration and energy
- Last session energy and duration
- Current request from the EV

### Advanced (Optional)
- Charger state details
- Per-phase current readings (L1, L2, L3)

## Configuration

The card automatically detects your HeyCharge entities:

```yaml
type: custom:heycharge-card
entity_prefix: sensor.heycharge_  # Optional: entity prefix for auto-discovery
device_id: ABCD                  # Optional: manually specify device ID
charger_name: My Charger          # Optional: custom display name
show_company_mode: true           # Show company car features
show_statistics: true             # Show energy statistics
show_advanced: false              # Show advanced settings section
compact_mode: false               # Use compact layout
```

## Requirements

- Home Assistant 2023.1.0+
- HeyCharge Gateway Integration installed and configured
- Gateway running Consumer Gateway firmware

## Installation

### HACS
1. Add this repository to HACS as a custom repository (category: Lovelace)
2. Search for "HeyCharge Card" and install
3. Refresh your browser
4. Add the card to your dashboard

### Manual
1. Copy the contents of `dist/` to your `config/www/heycharge-card/` directory
2. Add the resource in Lovelace configuration:
```yaml
resources:
  - url: /local/heycharge-card/heycharge-card.js
    type: module
```
3. Restart Home Assistant and clear browser cache
